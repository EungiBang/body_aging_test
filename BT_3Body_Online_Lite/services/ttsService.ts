
import { GoogleGenAI, Modality } from "@google/genai";
import { preloadedAudio } from '../assets/audio/preloadedTTS';
import { ErrorLogger } from './ErrorLogger';


let currentAudioSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
const audioCache: Record<string, string> = {};
let quotaExceededUntil = 0;
let isPendingRequest = false;
let currentSpeechId = 0;

export const initAudio = async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
};

export const preloadTTS = async (texts: string[]) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return;
  if (Date.now() < quotaExceededUntil) return;

  const ai = new GoogleGenAI({ apiKey });

  for (const text of texts) {
    if (audioCache[text]) continue;
    
    try {
      const koreanPrompt = `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${text}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: koreanPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        audioCache[text] = base64Audio;
      }
      // Delay to avoid hitting the API rate limits (15 RPM free tier)
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        quotaExceededUntil = Date.now() + 5 * 60 * 1000;
        break; // Stop preloading on rate limit
      }
    }
  }
};

export const speak = async (text: string) => {
  currentSpeechId++;
  const thisSpeechId = currentSpeechId;
  
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {}
  }

  try {
    // 0. Check pre-recorded sample (MP3)
    if (preloadedAudio[text]) {
      console.log(`내장 MP3 샘플 음성 재생 [id=${thisSpeechId}]`);
      const audio = new Audio(preloadedAudio[text]);
      audio.play().catch(e => console.error('내장 MP3 재생 실패', e));
      return;
    }

    // 1. Check Cache first (Instant AI Voice)
    if (audioCache[text]) {
      playBase64Audio(audioCache[text]);
      return; // Success!
    }

    // 2. Wait for AI TTS to fetch premium voice
    if (Date.now() >= quotaExceededUntil && process.env.GEMINI_API_KEY && !isPendingRequest) {
      const success = await fetchAndPlayText(text, thisSpeechId);
      if (success || currentSpeechId !== thisSpeechId) return; // Played successfully via AI! Or overridden!
    }
    
    // AI TTS failed or rate limited -> Remain silent instead of using robotic voice.
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

const fetchAndPlayText = async (text: string, speechId: number): Promise<boolean> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return false;
  
  isPendingRequest = true;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const koreanPrompt = `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: koreanPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      audioCache[text] = base64Audio;
      if (currentSpeechId !== speechId) {
        return false; // Another speak was called while we were fetching
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      playBase64Audio(base64Audio);
      return true;
    }
  } catch (error: any) {
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`[TTS] 할당량 초과 - 내장 음성으로 대체합니다`);
      quotaExceededUntil = Date.now() + 5 * 60 * 1000;
    } else {
      console.error("TTS Fetch Error:", error);
      ErrorLogger.logApiError('ttsService.fetchAndPlayText', 'TTS Fetch Error', error);
    }
  } finally {
    isPendingRequest = false;
  }
  return false;
};

const playBase64Audio = async (base64Data: string) => {
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
  } catch (e) {
    console.error("Audio playback failed:", e);
  }
};

 
