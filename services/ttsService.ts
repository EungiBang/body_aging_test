
import { GoogleGenAI, Modality } from "@google/genai";

let currentAudioSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
const audioCache: Record<string, string> = {};
let quotaExceededUntil = 0;

export const initAudio = async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
};

export const speak = async (text: string) => {
  try {
    // 1. Check Cache first
    if (audioCache[text]) {
      playBase64Audio(audioCache[text]);
      return;
    }

    // 2. Check if we are in a quota cooldown period (5 minutes)
    if (Date.now() < quotaExceededUntil) {
      fallbackToBrowserTTS(text);
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      fallbackToBrowserTTS(text);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Aoede' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // 3. Save to Cache
      audioCache[text] = base64Audio;
      playBase64Audio(base64Audio);
    } else {
      fallbackToBrowserTTS(text);
    }
  } catch (error: any) {
    // Robust error detection for quota issues
    const errorStr = typeof error === 'object' ? JSON.stringify(error) : String(error);
    const isQuotaError = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED');

    if (isQuotaError) {
      console.warn("Gemini TTS Quota Exceeded. Falling back to browser SpeechSynthesis for 5 minutes.");
      // Set a 5-minute cooldown before trying the API again
      quotaExceededUntil = Date.now() + 5 * 60 * 1000;
    } else {
      console.error("TTS Error:", error);
    }
    
    fallbackToBrowserTTS(text);
  }
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

const fallbackToBrowserTTS = (text: string) => {
  if ('speechSynthesis' in window) {
    // Stop any current speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.0;
    
    // Try to find a natural female Korean voice
    const voices = window.speechSynthesis.getVoices();
    const koVoices = voices.filter(v => v.lang.includes('ko'));
    
    // Heuristics to find a female voice (often contains 'Female', 'Yuna', 'Sora', or is the default Google voice)
    const femaleVoice = koVoices.find(v => 
      v.name.toLowerCase().includes('female') || 
      v.name.includes('Yuna') || 
      v.name.includes('Sora') ||
      v.name.includes('Google 한국의')
    );
    
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    } else if (koVoices.length > 0) {
      utterance.voice = koVoices[0];
    }

    window.speechSynthesis.speak(utterance);
  }
};
