
import { GoogleGenAI, Modality } from "@google/genai";
import logger from "../utils/logger";
import { preloadedAudio } from '../assets/audio/preloadedTTS';

const TAG = 'TTS';

let currentAudioSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
const audioCache: Record<string, string> = {};
let quotaExceededUntil = 0;
let isPendingRequest = false;
let currentSpeechId = 0;

// 최신 Gemini TTS 모델 (2026-04 기준)
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

export const initAudio = async () => {
  logger.debug(TAG, 'initAudio() 시작');
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    logger.info(TAG, 'AudioContext 생성 완료', { sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
    logger.info(TAG, 'AudioContext resumed (suspended → running)');
  }
  logger.debug(TAG, `initAudio() 완료, state=${audioContext.state}`);
};

export const preloadTTS = async (texts: string[]) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    logger.warn(TAG, 'preloadTTS 건너뜀: API 키 없음');
    return;
  }
  if (Date.now() < quotaExceededUntil) {
    logger.warn(TAG, `preloadTTS 건너뜀: quota 제한 중 (${Math.round((quotaExceededUntil - Date.now()) / 1000)}초 남음)`);
    return;
  }

  logger.info(TAG, `preloadTTS 시작: ${texts.length}건`);
  const ai = new GoogleGenAI({ apiKey });

  for (const text of texts) {
    if (audioCache[text]) {
      logger.debug(TAG, `캐시 히트: "${text.substring(0, 30)}..."`);
      continue;
    }
    
    try {
      logger.apiStart(TAG, `TTS Preload: "${text.substring(0, 30)}..."`);
      const koreanPrompt = `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${text}`;
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [{ parts: [{ text: koreanPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioCache[text] = base64Audio;
        logger.apiEnd(TAG, 'TTS Preload', true, { textLen: text.length, audioLen: base64Audio.length });
      } else {
        logger.apiEnd(TAG, 'TTS Preload', false, '응답에 오디오 데이터 없음');
      }
      // Delay to avoid hitting the API rate limits (15 RPM free tier)
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      logger.error(TAG, `preloadTTS 실패: "${text.substring(0, 30)}..."`, error);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        quotaExceededUntil = Date.now() + 5 * 60 * 1000;
        logger.warn(TAG, 'Rate limit 감지 → 5분간 TTS 일시 중지');
        break; // Stop preloading on rate limit
      }
    }
  }
  logger.info(TAG, `preloadTTS 완료, 캐시 크기: ${Object.keys(audioCache).length}건`);
};

export const speak = async (text: string) => {
  currentSpeechId++;
  const thisSpeechId = currentSpeechId;
  logger.debug(TAG, `speak() 시작 [id=${thisSpeechId}]: "${text.substring(0, 50)}..."`);
  
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {}
  }

  try {
    // 0. Check pre-recorded sample (MP3)
    if (preloadedAudio[text]) {
      logger.info(TAG, `내장 MP3 샘플 음성 재생 [id=${thisSpeechId}]`);
      const audio = new Audio(preloadedAudio[text]);
      audio.play().catch(e => logger.error(TAG, '내장 MP3 재생 실패', e));
      return;
    }

    // 1. Check Cache first (Instant AI Voice)
    if (audioCache[text]) {
      logger.info(TAG, `캐시에서 재생 [id=${thisSpeechId}]`);
      playBase64Audio(audioCache[text]);
      return; // Success!
    }

    // 2. Wait for AI TTS to fetch premium voice
    if (Date.now() >= quotaExceededUntil && process.env.GEMINI_API_KEY && !isPendingRequest) {
      logger.debug(TAG, `Gemini TTS API 호출 시도 [id=${thisSpeechId}]`);
      const success = await fetchAndPlayText(text, thisSpeechId);
      if (success) {
        logger.info(TAG, `Gemini TTS 재생 성공 [id=${thisSpeechId}]`);
        return;
      }
      if (currentSpeechId !== thisSpeechId) {
        logger.debug(TAG, `speak 오버라이드됨 [id=${thisSpeechId}→${currentSpeechId}]`);
        return;
      }
    } else {
      logger.debug(TAG, `Gemini TTS 건너뜀: ${!process.env.GEMINI_API_KEY ? 'API키 없음' : isPendingRequest ? '이전 요청 진행 중' : `quota 제한 (${Math.round((quotaExceededUntil - Date.now()) / 1000)}초 남음)`}`);
    }
    
    // 3. AI TTS 실패 시 브라우저 내장 TTS fallback (무음보다 나음)
    logger.warn(TAG, 'Gemini TTS 실패 → 브라우저 내장 TTS fallback');
    fallbackBrowserTTS(text);
  } catch (error) {
    logger.error(TAG, 'speak() 예외 발생', error, true);
    // 에러 발생 시에도 fallback 시도
    fallbackBrowserTTS(text);
  }
};

/**
 * 브라우저 내장 TTS fallback - Gemini TTS가 실패했을 때만 사용
 */
const fallbackBrowserTTS = (text: string) => {
  if (!('speechSynthesis' in window)) {
    logger.warn(TAG, 'fallbackBrowserTTS: speechSynthesis API 미지원');
    return;
  }
  
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // 한국어 음성 우선 선택
    const voices = window.speechSynthesis.getVoices();
    const koreanVoice = voices.find(v => v.lang.startsWith('ko'));
    if (koreanVoice) {
      utterance.voice = koreanVoice;
      logger.debug(TAG, `fallback 음성 선택: ${koreanVoice.name}`);
    } else {
      logger.debug(TAG, `한국어 음성 없음, 기본 음성 사용 (${voices.length}개 중)`);
    }
    
    window.speechSynthesis.speak(utterance);
    logger.info(TAG, 'fallbackBrowserTTS 재생 시작');
  } catch (e) {
    logger.error(TAG, 'fallbackBrowserTTS 실패', e, true);
  }
};

const fetchAndPlayText = async (text: string, speechId: number): Promise<boolean> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    logger.warn(TAG, 'fetchAndPlayText: API 키 없음');
    return false;
  }
  
  isPendingRequest = true;
  logger.apiStart(TAG, `Gemini TTS (model=${TTS_MODEL})`);
  const startTime = Date.now();
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const koreanPrompt = `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${text}`;

    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: koreanPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const elapsed = Date.now() - startTime;
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      audioCache[text] = base64Audio;
      logger.apiEnd(TAG, `Gemini TTS`, true, { elapsed: `${elapsed}ms`, audioSize: `${(base64Audio.length / 1024).toFixed(1)}KB` });
      
      if (currentSpeechId !== speechId) {
        logger.debug(TAG, `speak 오버라이드됨, 재생 취소 [${speechId}→${currentSpeechId}]`);
        return false; // Another speak was called while we were fetching
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      playBase64Audio(base64Audio);
      return true;
    } else {
      logger.apiEnd(TAG, 'Gemini TTS', false, { elapsed: `${elapsed}ms`, reason: '응답에 오디오 데이터 없음', responseParts: JSON.stringify(response.candidates?.[0]?.content?.parts?.map(p => Object.keys(p))).substring(0, 200) });
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    
    if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      logger.warn(TAG, `Gemini TTS API 할당량 초과 (${elapsed}ms) - 내장 음성으로 대체합니다`);
      quotaExceededUntil = Date.now() + 5 * 60 * 1000;
    } else {
      logger.error(TAG, `Gemini TTS API 실패 (${elapsed}ms)`, error, false);
    }
  } finally {
    isPendingRequest = false;
  }
  return false;
};

const playBase64Audio = async (base64Data: string) => {
  logger.debug(TAG, `playBase64Audio 시작 (${(base64Data.length / 1024).toFixed(1)}KB)`);
  try {
    if (currentAudioSource) {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    }

    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Decode base64 to binary string
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert 16-bit PCM to Float32Array
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }

    const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);

    currentAudioSource = audioContext.createBufferSource();
    currentAudioSource.buffer = audioBuffer;
    currentAudioSource.connect(audioContext.destination);
    currentAudioSource.start();
    logger.info(TAG, `오디오 재생 시작 (${(float32Array.length / 24000).toFixed(1)}초)`);
  } catch (e) {
    logger.error(TAG, 'playBase64Audio 재생 실패', e, true);
  }
};
