import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const VOICE = 'ko-KR-SunHiNeural';

const steps = {
  INTRO: "AI 신체 균형 및 건강 상태 측정 시스템입니다.",
  USER_INFO: "측정 대상자의 정보를 입력해 주세요.",
  POSTURE_FRONT: "정면 전체 몸이 나오도록 서주세요.",
  POSTURE_SIDE: "옆으로 서서 몸의 중심을 맞춰주세요.",
  BALANCE_TEST: "눈을 감고 한 발로 서서 균형을 유지하세요.",
  ARM_RAISE_TEST: "팔을 최대한 높이 들어 올려 주세요.",
  FLEXIBILITY_TEST: "무릎을 펴고 상체를 숙여 주세요.",
  STRENGTH_SQUAT: "측면으로 서주세요. 15초 동안 스쿼트를 반복하세요.",
  STRENGTH_PUSHUP: "대각선으로 서주세요. 15초 동안 푸시업을 반복하세요.",
  BRAIN_MEMORY: "10초 동안 장볼 물건들을 기억하고, 손으로 골라 담아주세요.",
  FACE_ANALYSIS: "안경과 마스크는 벗어주세요. 조명을 더 밝게 해도 좋습니다. 얼굴을 카메라에 가까이 대고 정면을 응시하세요.",
  SEVEN_CODE_CHECK: "해당하는 문항을 선택해 주세요.",
  ANALYZING: "통합 AI 리포트를 생성 중입니다.",
  REPORT: "측정 결과를 확인해 보세요.",
  
  // Also TMT guidance if needed
  TMT_INTRO: "인지 반응 속도 테스트를 시작합니다. 1부터 순서대로 숫자를 빠르고 정확하게 클릭하세요.",
  MART_INTRO: "물건 기억하기 테스트를 시작합니다. 화면에 나온 물건들을 기억한 후 다음 화면에서 골라주세요."
};

function generateTTS() {
  const outputDir = path.join('./assets/audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let outputTs = `// Auto-generated preloaded TTS audio (Edge TTS: ko-KR-SunHiNeural)\n`;
  outputTs += `export const preloadedAudio: Record<string, string> = {\n`;

  for (const [key, text] of Object.entries(steps)) {
    console.log(`Generating TTS for: [${key}] ${text}`);
    const tempFile = path.join(`./temp_${key}.mp3`);
    try {
      // Execute edge-tts synchronously
      execSync(`edge-tts --voice ${VOICE} --text "${text}" --write-media "${tempFile}"`, { stdio: 'inherit' });
      
      if (fs.existsSync(tempFile)) {
        const buffer = fs.readFileSync(tempFile);
        const base64Audio = buffer.toString('base64');
        outputTs += `  "${text}": "data:audio/mp3;base64,${base64Audio}",\n`;
        // clean up
        fs.unlinkSync(tempFile);
      }
    } catch (err) {
      console.error(`Failed to generate TTS for ${key}:`, err);
    }
  }

  outputTs += `};\n`;
  
  const targetFile = path.join(outputDir, 'preloadedTTS.ts');
  fs.writeFileSync(targetFile, outputTs);
  console.log(`\nSuccessfully generated all TTS and saved to ${targetFile}`);

  // Also copy to Lite version
  const liteTargetFile = path.join('./BT_3Body_Online_Lite', 'assets', 'audio', 'preloadedTTS.ts');
  if (fs.existsSync(path.dirname(liteTargetFile))) {
    fs.writeFileSync(liteTargetFile, outputTs);
    console.log(`Successfully copied to Lite version: ${liteTargetFile}`);
  }
}

generateTTS();
