import * as fs from 'fs';
import * as path from 'path';

async function generateSample() {
  const text = encodeURIComponent("AI 신체 균형 및 건강 상태 측정 시스템입니다."); // 짧게 수정
  
  // ==========================================
  // [알림] 현재 Gemini API (gemini-3.1-flash-tts)의 일일 할당량(100건)이 초과되어 
  // 임시로 Google Translate TTS를 사용하여 샘플을 생성하도록 설정되어 있습니다.
  // 내일 할당량이 초기화되면 아래 주석 처리된 Gemini API 코드를 활성화하여 
  // 고품질 AI 음성으로 변경할 수 있습니다.
  // ==========================================
  const url = `http://translate.google.com/translate_tts?ie=UTF-8&total=1&idx=0&textlen=32&client=tw-ob&q=${text}&tl=ko-KR`;

  /* Gemini API 사용 시:
  import { GoogleGenAI, Modality } from "@google/genai";
  import * as dotenv from 'dotenv';
  dotenv.config({ path: '.env.local' });
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  ...
  */

  try {
    console.log("Fetching TTS from Google Translate...");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    
    console.log(`Successfully generated audio. Size: ${(base64Audio.length / 1024).toFixed(1)} KB`);
    const outputTs = `// Auto-generated preloaded TTS audio (Google Translate Sample)
export const preloadedAudio = {
  intro: "data:audio/mp3;base64,${base64Audio}"
};
`;
    // Ensure directory exists
    const dir = path.join('./assets/audio');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(path.join(dir, 'preloadedTTS.ts'), outputTs);
    console.log("Saved to assets/audio/preloadedTTS.ts");
  } catch (err) {
    console.error("Error generating TTS:", err);
  }
}

generateSample();
