import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const VOICE = 'ko-KR-SunHiNeural';

const MART_ITEMS = [
  { id: 'apple', name: '사과' },
  { id: 'banana', name: '바나나' },
  { id: 'milk', name: '우유' },
  { id: 'bread', name: '식빵' },
  { id: 'egg', name: '계란' },
  { id: 'carrot', name: '당근' },
  { id: 'fish', name: '생선' },
  { id: 'cheese', name: '치즈' },
  { id: 'tomato', name: '토마토' },
  { id: 'chicken', name: '치킨' },
  { id: 'grape', name: '포도' },
  { id: 'watermelon', name: '수박' },
  { id: 'onion', name: '양파' },
  { id: 'corn', name: '옥수수' },
  { id: 'shrimp', name: '새우' },
];

const TMT_COLORS = ['빨간색', '파란색', '노란색'];

const baseStrings = [
  // AssessmentFlow
  "AI 신체 균형 및 건강 상태 측정 시스템입니다.",
  "측정 대상자의 정보를 입력해 주세요.",
  "정면 전체 몸이 나오도록 서주세요.",
  "옆으로 서서 몸의 중심을 맞춰주세요.",
  "눈을 감고 한 발로 서서 균형을 유지하세요.",
  "팔을 최대한 높이 들어 올려 주세요.",
  "무릎을 펴고 상체를 숙여 주세요.",
  "측면으로 서주세요. 15초 동안 스쿼트를 반복하세요.",
  "대각선으로 서주세요. 15초 동안 푸시업을 반복하세요.",
  "10초 동안 장볼 물건들을 기억하고, 손으로 골라 담아주세요.",
  "안경과 마스크는 벗어주세요. 조명을 더 밝게 해도 좋습니다. 얼굴을 카메라에 가까이 대고 정면을 응시하세요.",
  "해당하는 문항을 선택해 주세요.",
  "통합 AI 리포트를 생성 중입니다.",
  "측정 결과를 확인해 보세요.",
  "촬영이 완료되었습니다.",
  "뼈대 인식이 일부 누락되었습니다. 화면에 전신이 잘 나왔다면 수동으로 다음 단계를 진행해주세요.",
  "내장 그래픽 환경입니다. 화면에 전신이 잘 나왔다면 다음 단계를 눌러주세요.",
  "다시 촬영합니다. 준비해 주세요.",
  "마지막 측정 11단계, 7코드 건강 점검입니다. 화면에 나타나는 문항 중 본인에게 해당하는 것을 선택해 주세요.",
  "모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.",
  "이 분석은 브레인트레이닝센터와 연구원, 대학교 등 전문가들이 연구, 개발하였고, 최신 AI 기술을 접목하여 개발한 프로그램입니다. 본 시스템은 건강 관리에 도움을 주고자 자세, 동작, 기억력 등을 측정하는 웰니스 프로그램으로서, 의료적 진단과는 무관합니다. 데이터 분석에 약 1분 정도 소요됩니다.",
  "분석 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.",

  // BrainTestModule & TMTBrainTestModule
  "포즈 인식 완료. 이제 손 인식을 확인합니다. 오른손을 들어보세요.",
  "포즈 인식 완료. 3초 후 시작합니다.",
  "오른손 인식 완료! 이제 왼손을 들어보세요.",
  "양손 인식 완료! 3초 후 시작합니다.",
  "오답",
  "정확합니다!",
  "지금부터 20초 동안 살 물건 6개를 확인하세요. 물건의 이름과 총 가격을 기억해 주세요.",
  "이제 10초 동안 수학 문제 2개를 풀어보세요.",
  "이제 아까 본 물건 6개를 찾아서 클릭해 주세요.",
  "다음 문제입니다.",
  "시간 초과입니다.",
  "정답입니다!",
  "아쉽습니다.",
  "마트 장보기 테스트를 시작합니다.",
  "인지 능력 테스트를 시작합니다. 화면에 초록불이 들어오면 오른손을, 파란불이 들어오면 왼손을, 흰색불이 들어오면 양손을 드세요. 빨간불이 들어오면 충동을 억제하고 움직이지 마세요. 카메라에 상반신이 보이도록 서주세요.",
  "뇌 인지 및 반응 테스트입니다. 15초 동안 지시한 색상과 숫자를 순서대로 클릭하세요. 텍스트를 모두 확인하신 후 시작하기 버튼을 눌러주세요.",
  "시간이 초과되었습니다.",
  "성공!",
  "모든 테스트가 완료되었습니다.",

  // CameraModule
  "조명을 밝게 셋팅해 주세요. 5초 뒤에 촬영합니다. 준비해 주세요.",
  "5초 뒤에 촬영합니다. 준비해 주세요.",
  "시작!",
  "측정이 완료되었습니다.",
  
  // Custom numbers
  "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십", "십일", "십이", "십삼", "십사", "십오"
];

// Generate Dynamic Strings
const dynamicStrings: string[] = [];

// Mart Items
MART_ITEMS.forEach(item => {
  dynamicStrings.push(`${item.name} 장바구니에 담았습니다.`);
  dynamicStrings.push(`${item.name} 취소`);
  dynamicStrings.push(`${item.name}`);
});

// Mart Counts (1 to 6)
for (let i = 1; i <= 6; i++) {
  dynamicStrings.push(`6개 중 ${i}개를 골랐습니다. 이제 살 물건의 총 금액을 맞춰주세요!`);
  dynamicStrings.push(`시간 초과! ${i}개를 골랐습니다. 총 금액을 맞춰주세요.`);
}

// TMT Colors
TMT_COLORS.forEach(color => {
  dynamicStrings.push(`${color} 1번부터 10번까지 순서대로 클릭하세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.`);
  dynamicStrings.push(`두 번째 테스트. 이번엔 ${color} 10번부터 1번까지 거꾸로 누르세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.`);
});

const ALL_STRINGS = Array.from(new Set([...baseStrings, ...dynamicStrings]));

function generateAllTTS() {
  const outputDir = path.join('./assets/audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  let outputTs = `// Auto-generated preloaded TTS audio (Edge TTS: ko-KR-SunHiNeural)\n`;
  outputTs += `export const preloadedAudio: Record<string, string> = {\n`;

  for (let i = 0; i < ALL_STRINGS.length; i++) {
    const text = ALL_STRINGS[i];
    console.log(`Generating TTS [${i + 1}/${ALL_STRINGS.length}]: ${text.substring(0, 30)}...`);
    const tempFile = path.join(`./temp_tts_${i}.mp3`);
    try {
      execSync(`edge-tts --voice ${VOICE} --text "${text}" --write-media "${tempFile}"`, { stdio: 'inherit' });
      
      if (fs.existsSync(tempFile)) {
        const buffer = fs.readFileSync(tempFile);
        const base64Audio = buffer.toString('base64');
        outputTs += `  "${text}": "data:audio/mp3;base64,${base64Audio}",\n`;
        fs.unlinkSync(tempFile);
      }
    } catch (err) {
      console.error(`Failed to generate TTS for text: ${text}`);
    }
  }

  outputTs += `};\n`;
  
  const targetFile = path.join(outputDir, 'preloadedTTS.ts');
  fs.writeFileSync(targetFile, outputTs);
  console.log(`\nSuccessfully generated ${ALL_STRINGS.length} TTS files and saved to ${targetFile}`);

  const liteTargetFile = path.join('./BT_3Body_Online_Lite', 'assets', 'audio', 'preloadedTTS.ts');
  if (fs.existsSync(path.dirname(liteTargetFile))) {
    fs.writeFileSync(liteTargetFile, outputTs);
    console.log(`Successfully copied to Lite version: ${liteTargetFile}`);
  }
}

generateAllTTS();
