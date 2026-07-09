// 텍스트를 음성(TTS)으로 합성하여 재생하는 서비스 파일
import { GoogleGenAI, Modality } from "@google/genai";
import i18n from 'i18next';
import { t as translateText } from '../BT_3Body_Online_Lite/i18n';
import { preloadedAudio } from '../assets/audio/preloadedTTS';
import { preloadedAudioEn } from '../assets/audio/preloadedTTS_en';
import { ErrorLogger } from './ErrorLogger';
import { getActiveApiKey } from './geminiService';

const isWebMode = (): boolean => typeof window !== 'undefined' && !window.electronAPI;


let currentAudioSource: AudioBufferSourceNode | null = null;
let currentHtmlAudio: HTMLAudioElement | null = null;
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
  const apiKey = getActiveApiKey();
  if (!apiKey && !isWebMode()) return;
  if (Date.now() < quotaExceededUntil) return;

  const isEnglish = true;

  for (const text of texts) {
    const translatedText = translateText(text);
    if (audioCache[translatedText]) continue;
    
    try {
      const ttsPrompt = isEnglish
        ? `Please read the following text in a natural, warm, and healing voice of a female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${translatedText}`
        : `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${translatedText}`;
      
      const ttsParams = {
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: ttsPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { 
                voiceName: isEnglish ? 'Aoede' : 'Kore' 
              } 
            } 
          },
        },
      };

      let base64Audio: string | undefined;
      if (isWebMode()) {
        const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsParams) });
        if (res.ok) { const data = await res.json(); base64Audio = data.inlineData?.data; }
      } else {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent(ttsParams);
        base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      }
      if (base64Audio) { audioCache[text] = base64Audio; }
      await new Promise(r => setTimeout(r, 2000));
    } catch (error: any) {
      const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        quotaExceededUntil = Date.now() + 5 * 60 * 1000;
        break;
      }
    }
  }
};

/**
 * 모든 TTS 재생 채널(AudioSource + HtmlAudio + SpeechSynthesis)을 즉시 중지합니다.
 */
export const stopSpeaking = () => {
  currentSpeechId++;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentHtmlAudio) {
    try {
      currentHtmlAudio.pause();
      currentHtmlAudio.currentTime = 0;
      currentHtmlAudio = null;
    } catch (e) {}
  }
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
      currentAudioSource = null;
    } catch (e) {}
  }
};

export const speak = async (text: string) => {
  stopSpeaking();
  const thisSpeechId = currentSpeechId;
  
  const translatedText = translateText(text);
  
  try {
    const isEnglish = i18n.language ? i18n.language.startsWith('en') : true;
    
    // 0. Check pre-recorded sample (MP3)
    if (isEnglish) {
      if (preloadedAudioEn && preloadedAudioEn[translatedText]) {
        console.log(`[TTS] Playing preloaded EN voice [id=${thisSpeechId}]: "${translatedText}"`);
        const audio = new Audio(preloadedAudioEn[translatedText]);
        currentHtmlAudio = audio;
        audio.play().catch(e => console.error('[TTS] Failed to play preloaded EN voice', e));
        return;
      }
    } else {
      if (preloadedAudio && preloadedAudio[translatedText]) {
        console.log(`[TTS] Playing preloaded KO voice [id=${thisSpeechId}]: "${translatedText}"`);
        const audio = new Audio(preloadedAudio[translatedText]);
        currentHtmlAudio = audio;
        audio.play().catch(e => console.error('[TTS] Failed to play preloaded KO voice', e));
        return;
      }
    }

    // 1. Check Cache first (Instant AI Voice)
    if (audioCache[translatedText]) {
      playBase64Audio(audioCache[translatedText]);
      return; // Success!
    }

    // 2. Wait for AI TTS to fetch premium voice
    if (Date.now() >= quotaExceededUntil && (isWebMode() || process.env.GEMINI_API_KEY) && !isPendingRequest) {
      const success = await fetchAndPlayText(translatedText, thisSpeechId);
      if (success || currentSpeechId !== thisSpeechId) return; // Played successfully via AI! Or overridden!
    }
    
    // AI TTS failed or rate limited -> Remain silent instead of using robotic voice.
  } catch (error) {
    console.error("TTS Error:", error);
  }
};

const fetchAndPlayText = async (text: string, speechId: number): Promise<boolean> => {
  const apiKey = getActiveApiKey();
  if (!apiKey && !isWebMode()) return false;
  
  isPendingRequest = true;
  try {
    const isEnglish = true;
    const ttsPrompt = isEnglish
      ? `Please read the following text in a natural, warm, and healing voice of a female in her 30s. Make it sound as natural and human-like as possible, with a warm and gentle tone:\n\n${text}`
      : `다음 텍스트를 30대 여성의 힐링이 되는 감성적이고 자연스러운 목소리로 읽어주세요. 기계음처럼 들리지 않게 최대한 사람처럼, 따뜻하고 부드러운 톤으로 말해주세요. 반드시 한국어로만 말하고 숫자도 한국어로 자연스럽게 읽어주세요:\n\n${text}`;
    
    const ttsParams = {
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: ttsPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { 
              voiceName: isEnglish ? 'Aoede' : 'Kore' 
            } 
          } 
        },
      },
    };

    let base64Audio: string | undefined;
    if (isWebMode()) {
      const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsParams) });
      if (res.ok) { const data = await res.json(); base64Audio = data.inlineData?.data; }
    } else {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent(ttsParams);
      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    }

    if (base64Audio) {
      audioCache[text] = base64Audio;
      if (currentSpeechId !== speechId) return false;
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

 
