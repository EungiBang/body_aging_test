import { GoogleGenAI, Type } from "@google/genai";
import { BodyReport, CapturedImage, UserInfo, MemberRecord, CheonbugyeongCharacter } from "../types";
import { MASTERS } from '../constants/masters';
import { findSimilarCases, buildFewShotPrompt, findSimilarFaceCases, buildFaceFewShotPrompt, findSimilarTarotCases, buildTarotFewShotPrompt } from "./feedbackService";
import { getRecordsLocally } from "./localDb";

// --- API Key 관리 (SettingsModal에서 사용) ---
let customApiKey: string = '';

export const getActiveApiKey = (): string => {
  return customApiKey || process.env.GEMINI_API_KEY || '';
};

export const setCustomApiKey = (key: string): void => {
  customApiKey = key;
};

export const isUsingCustomKey = (): boolean => {
  return !!customApiKey;
};

// --- 환경 점검 (SystemCheckOverlay에서 사용) ---
export const checkEnvironment = async (imageDataUrl: string): Promise<{ isValid: boolean; message: string }> => {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    return { isValid: true, message: 'API 키 미설정 - 환경 점검을 건너뜁니다.' };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageDataUrl.split(',')[1] } },
          { text: '이 사진의 조명과 촬영 환경이 전신 신체 측정에 적합한지 평가해 주세요. 역광, 과도한 어둠, 화면이 잘린 경우 등을 확인하고, JSON으로만 응답하세요: {"isValid": true/false, "message": "한국어 피드백 (1~2문장)"}' }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            message: { type: Type.STRING }
          }
        }
      }
    });
    const text = response.text;
    if (!text) return { isValid: true, message: '환경 점검 완료' };
    return JSON.parse(text);
  } catch (e) {
    console.error('Environment check error:', e);
    return { isValid: true, message: '환경 점검을 건너뜁니다.' };
  }
};

// --- 핵심 AI 건강 분석 함수 ---
export const analyzeHealth = async (userInfo: UserInfo, images: CapturedImage[]): Promise<BodyReport> => {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const parts = images
    .filter(img => img.dataUrl && img.dataUrl.includes(','))
    .map(img => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: img.dataUrl.split(',')[1]
      }
    }));

  // --- 실시간 균형 추적 데이터 추출 ---
  const balanceImg  = images.find(i => i.step === 'BALANCE_TEST');
  const eyesClosed  = balanceImg?.balanceData?.eyesClosed ?? true; // 기본값: 눈 감음
  const rawFootDrops = balanceImg?.balanceData?.footDrops ?? balanceImg?.reps ?? null;
  // 눈 뜨고 옵션 처리(페널티)는 getBalanceScore 내부로 이관
  const footDrops  = rawFootDrops;
  const swayScore  = balanceImg?.balanceData?.swayScore ?? null;

  const squatReps  = 0;
  const squatFormScore = null;
  const pushupReps = 0;
  const pushupFormScore = null;
  const isKneeAssisted = false;

  // --- 뇌 나이 및 7코드 데이터 추출 ---
  const reactionImg = images.find(i => i.step === 'BRAIN_REACTION');
  const reactionTimeMs = reactionImg?.brainTestData?.reactionTimeMs ?? reactionImg?.reps ?? 500;
  const reactionErrors = reactionImg?.brainTestData?.reactionErrors ?? 0;

  const memoryImg = images.find(i => i.step === 'BRAIN_MEMORY');
  const memorySpan = memoryImg?.brainTestData?.memoryCorrect ?? memoryImg?.reps ?? 0;

  const sevenCodeImg = images.find(i => i.step === 'SEVEN_CODE_CHECK');
  const sevenCodeKeywords = sevenCodeImg?.sevenCodeKeywords ?? [];
  const weakestCode = sevenCodeImg?.weakestCode ?? 1;

  // --- 기하학적 체형 수치 추출 ---
  const frontImg = images.find(i => i.step === 'POSTURE_FRONT');
  const sideImg = images.find(i => i.step === 'POSTURE_SIDE');
  // 정면 분석
  const shoulderTilt = frontImg?.postureData?.shoulderTilt ?? 'N/A';
  const pelvisTilt = frontImg?.postureData?.pelvisTilt ?? 'N/A';
  const shoulderHipRatio = frontImg?.postureData?.shoulderHipRatio ?? 'N/A';
  const legType = frontImg?.postureData?.legType ?? 'N/A';
  const legAngle = frontImg?.postureData?.legAngle ?? 'N/A';
  const kneeAlignment = frontImg?.postureData?.kneeAlignment ?? 'N/A';
  // 측면 분석
  const neckAngle = sideImg?.postureData?.neckAngle ?? 'N/A';
  const torsoAngle = sideImg?.postureData?.torsoAngle ?? 'N/A';
  const roundedShoulderAngle = sideImg?.postureData?.roundedShoulderAngle ?? 'N/A';
  const kyphosisAngle = sideImg?.postureData?.kyphosisAngle ?? 'N/A';

  // --- 팔 올리기 및 유연성 실시간 데이터 추출 ---
  const armRaiseImg = images.find(i => i.step === 'ARM_RAISE_TEST');
  const flexImg = images.find(i => i.step === 'FLEXIBILITY_TEST');
  const armRaiseData = armRaiseImg?.postureData;
  const flexData = flexImg?.postureData;

  // --- 안면 밝기(Luma) 실시간 데이터 추출 ---
  const faceImg = images.find(i => i.step === 'FACE_ANALYSIS');
  const faceBrightness = faceImg?.postureData?.faceBrightness;

  const mathCorrect = memoryImg?.brainTestData?.mathCorrect ?? false;

  // --- 뇌 나이 산출 v3.0 (절대 점수 기반, 실제 나이 무관) ---
  // 1단계: 두뇌 인지 반응 100점 (정확도/오답억제 70점 + 반응속도 30점)
  let reactionTimeScore = 0;
  if (reactionTimeMs <= 600) reactionTimeScore = 30;
  else if (reactionTimeMs <= 900) reactionTimeScore = 20;
  else if (reactionTimeMs <= 1200) reactionTimeScore = 10;

  let reactionErrorScore = 0;
  if (reactionErrors === 0) reactionErrorScore = 70;
  else if (reactionErrors === 1) reactionErrorScore = 50;
  else if (reactionErrors === 2) reactionErrorScore = 30;
  else if (reactionErrors >= 3) reactionErrorScore = 10;

  const test1Score = reactionTimeScore + reactionErrorScore; // 100점 만점

  // 2단계: 마트 장보기 100점 (기억력 50점 + 가격 30점 + 사칙연산 20점)
  let memoryScore2 = 5;
  if (memorySpan >= 6) memoryScore2 = 50;
  else if (memorySpan === 5) memoryScore2 = 40;
  else if (memorySpan === 4) memoryScore2 = 30;
  else if (memorySpan === 3) memoryScore2 = 20;
  else if (memorySpan === 2) memoryScore2 = 10;

  const priceScore = mathCorrect ? 30 : 10; // 정답 30, 오답 10, 시간초과는 false로 처리됨
  const distractionCount = memoryImg?.brainTestData?.distractionCorrect ?? 0;
  let distractionScore = 0;
  if (distractionCount >= 2) distractionScore = 20;
  else if (distractionCount === 1) distractionScore = 10;

  const test2Score = memoryScore2 + priceScore + distractionScore; // 100점 만점

  // 각 테스트 독립 뇌나이 산출: 100점=20세, 0점=90세
  const toAge = (score: number) => Math.max(20, Math.min(90, Math.round(90 - (score / 100) * 70)));
  const reactionAge = toAge(test1Score);
  const memoryAge = toAge(test2Score);
  const calculatedBrainAge = Math.round((reactionAge + memoryAge) / 2);

  // --- 근력 기준표 v3.0 (15초 순간 근력 기준 / 상대 나이 역산 공식) ---
  //
  // [15초 측정 설계 원칙]
  //   - 1분 기준 ÷ 4 가 아님. 15초는 지구력 없이 순간 최대 근력을 발휘하므로
  //     1분 기록의 40~50% 수준이 아닌 훨씬 높은 횟수가 나옴
  //   - 따라서 기준 횟수를 1분 기준보다 높게 설정
  //
  // [설계 원칙]
  //   - 각 나이대별 '15초 평균 수행 횟수'를 정의 → 이 횟수 = 실제나이와 동일한 신체나이
  //   - 평균 초과 시 어림, 미달 시 노화로 계산
  //   - 1회 차이 = 1.8세 변화 (촘촘한 민감도)
  //   - 나이대별 기준 횟수 차이: 2~3회 (근소하게)
  //
  // [15초 스쿼트 나이대별 평균 횟수 기준]
  //   남성: 20대=18 / 30대=15 / 40대=12 / 50대=10 / 60대=8 / 70대=6
  //   여성: 20대=15 / 30대=12 / 40대=10 / 50대= 8 / 60대=6 / 70대=4
  //
  // [15초 푸시업 나이대별 평균 횟수 기준]
  //   남성: 20대=18 / 30대=15 / 40대=12 / 50대= 9 / 60대=7 / 70대=4
  //   여성: 20대=13 / 30대=10 / 40대= 8 / 50대= 6 / 60대=4 / 70대=2

  const getSquatAvgReps = (age: number, gender: string): number => {
    const m = [18, 15, 12, 10, 8, 6];
    const f = [15, 12, 10,  8, 6, 4];
    const idx = Math.min(Math.floor(Math.max(age - 20, 0) / 10), 5);
    return gender === 'male' ? m[idx] : f[idx];
  };

  const getPushupAvgReps = (age: number, gender: string): number => {
    const m = [18, 15, 12,  9, 7, 4];
    const f = [13, 10,  8,  6, 4, 2];
    const idx = Math.min(Math.floor(Math.max(age - 20, 0) / 10), 5);
    return gender === 'male' ? m[idx] : f[idx];
  };

  const getSquatScore = (validReps: number, gender: string, age: number): number => {
    const avg = getSquatAvgReps(age, gender);
    const top10 = Math.ceil(avg * 1.5);
    if (validReps >= top10) return 100;
    if (validReps <= 0) return 0;
    const score = 70 + ((validReps - avg) / (top10 - avg)) * 30;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getPushupScore = (validReps: number, gender: string, age: number, isKneeAssistedMode: boolean): number => {
    let avg = getPushupAvgReps(age, gender);
    if (gender === 'female' && age >= 70 && isKneeAssistedMode) {
      avg = 4;
    }
    const top10 = Math.ceil(Math.max(avg * 1.5, avg + 2));
    if (validReps >= top10) return 100;
    if (validReps <= 0) return 0;
    const score = 70 + ((validReps - avg) / (top10 - avg)) * 30;
    return Math.max(0, Math.min(100, Math.round(score)));
  };

  const getBalanceScore = (footDrops: number | null, swayScore: number | null, eyesClosed: boolean): number => {
    const drops = Math.min(footDrops ?? 0, 4); // 4회 이상은 4로 매핑
    const swayLevel = Math.max(1, Math.min(5, Math.floor((swayScore ?? 0) / 20) + 1));
    
    let score = 100 - (drops * 15) - ((swayLevel - 1) * 4);
    if (!eyesClosed) {
      score -= 20; // 눈 뜨고 하기 패널티
      score = Math.min(60, score); // 최대 60점 제한
    }
    return Math.max(20, Math.min(100, score));
  };

  const getBalancePhysicalAge = (footDrops: number | null, swayScore: number | null, eyesClosed: boolean): number => {
    const drops = Math.min(footDrops ?? 0, 4);
    const swayLevel = Math.max(1, Math.min(5, Math.floor((swayScore ?? 0) / 20) + 1));
    
    let balanceAge = 20 + (drops * 15) + ((swayLevel - 1) * 4);
    if (!eyesClosed) {
      if (drops === 0) balanceAge = 70;
      else if (drops === 1) balanceAge = 75;
      else balanceAge = 80;
    }
    return Math.max(20, Math.min(85, balanceAge));
  };

  // --- formScore 기반 유효 횟수 계산 (임계값: 60점) ---
  // 60점 이상: 정자세로 인정 / 45~59점: 80% 인정 / 44점 이하: 60% 인정
  const FORM_THRESHOLD = 60;
  const validSquatReps = squatFormScore !== null && squatFormScore < FORM_THRESHOLD
    ? squatFormScore >= 45 ? Math.round(squatReps * 0.8) : Math.round(squatReps * 0.6)
    : squatReps;
  const validPushupReps = (() => {
    // formScore 기반 자세 보정 (공통)
    const formCorrected = (base: number) =>
      pushupFormScore !== null && pushupFormScore < FORM_THRESHOLD
        ? pushupFormScore >= 45 ? Math.round(base * 0.8) : Math.round(base * 0.6)
        : base;

    // ① 70세+ 여성 무릎 대고: 정식 기준 — 패널티 없음
    if (isKneeAssisted && userInfo.gender === 'female' && userInfo.age >= 70) {
      return formCorrected(pushupReps);
    }
    // ② 60~69세 여성 무릎 대고: 60% 인정 (부분 패널티)
    if (isKneeAssisted && userInfo.gender === 'female' && userInfo.age >= 60) {
      return Math.round(formCorrected(pushupReps) * 0.6);
    }
    // ③ 그 외 무릎 보조: 0회 강제 (정자세 1회보다 항상 불리)
    const reps = formCorrected(pushupReps);
    return isKneeAssisted ? 0 : reps;
  })();

  // --- 코드 확정 신체 나이 (AI 임의 변경 불가) ---
  const getSquatPhysicalAge = (validReps: number, gender: string, age: number): number => {
    const score = getSquatScore(validReps, gender, age);
    if (score >= 90) return age - 10;
    if (score >= 80) return age - 5;
    if (score >= 70) return age;
    if (score >= 60) return age + 5;
    if (score >= 50) return age + 10;
    return age + 15;
  };

  const getPushupPhysicalAge = (validReps: number, gender: string, age: number, isKneeAssistedMode: boolean): number => {
    const score = getPushupScore(validReps, gender, age, isKneeAssistedMode);
    if (score >= 90) return age - 10;
    if (score >= 80) return age - 5;
    if (score >= 70) return age;
    if (score >= 60) return age + 5;
    if (score >= 50) return age + 10;
    return age + 15;
  };

  const getSquatScoreOutput = (validReps: number, gender: string, age: number): number => {
    return getSquatScore(validReps, gender, age);
  };
  const getPushupScoreOutput = (validReps: number, gender: string, age: number, isKneeAssistedMode: boolean): number => {
    return getPushupScore(validReps, gender, age, isKneeAssistedMode);
  };
  const getBalanceScoreOutput = (footDrops: number | null, swayScore: number | null, eyesClosed: boolean): number => {
    return getBalanceScore(footDrops, swayScore, eyesClosed);
  };

  const squatPhysicalAge  = getSquatPhysicalAge(validSquatReps, userInfo.gender, userInfo.age);
  const pushupPhysicalAge = getPushupPhysicalAge(validPushupReps, userInfo.gender, userInfo.age, isKneeAssisted);

  // --- 근력 기준표 (사용 안함 - 간편 버전) ---
  const squatStandard = '미진행';
  const pushupStandard = '미진행';

  // --- 균형 테스트 참조 기준표 (눈 감고 한발 서기 15초 BTC 자체 기준 / Springer 2007 기반 환산) ---
  const balanceStandard = userInfo.gender === 'male'
    ? '20대:footDrops=0 & sway낮음 / 30대:footDrops=0 / 40대:footDrops=0~1 / 50대:footDrops=1~2 / 60대:footDrops=2~3 / 70대+:footDrops=3이상'
    : '20대:footDrops=0 & sway낮음 / 30대:footDrops=0 / 40대:footDrops=0~1 / 50대:footDrops=1~2 / 60대:footDrops=2~3 / 70대+:footDrops=3이상';

  // --- Few-Shot 학습: 유사 과거 사례 자동 주입 ---
  let fewShotBlock = '';
  try {
    const similarCases = await findSimilarCases(
      { age: userInfo.age, gender: userInfo.gender },
      3
    );
    fewShotBlock = buildFewShotPrompt(similarCases);
    if (fewShotBlock) {
      console.log(`[Few-Shot] ${similarCases.length}건의 유사 사례를 프롬프트에 주입합니다.`);
    }
  } catch (e) {
    console.warn('[Few-Shot] 사례 검색 실패 (무시):', e);
  }

  const prompt = `
${fewShotBlock ? fewShotBlock + '\n---\n' : ''}당신은 운동역학, 노인의학, 신체기능 평가 분야의 최고 전문가입니다.
아래 제공된 사진들과 실시간 측정 데이터를 기반으로, 대상자의 신체 건강 상태를 정밀 분석해 주세요.
(※ 주의: 본 시스템은 의료용 진단기기가 아닌 '체력 및 건강 증진용 웰니스 스크리닝 도구'입니다. 특정 질병이나 질환을 단정 짓거나 확진하는 표현은 절대 사용하지 마세요.)
모든 분석 결과와 권장 사항은 반드시 **한국어**로 작성하세요.

■ 사용자 기본 정보
  - 이름: ${userInfo.name}
  - 성별: ${userInfo.gender === 'male' ? '남성' : '여성'}
  - 실제 나이: ${userInfo.age}세

■ 기하학적 체형 수치 (MoveNet AI 관절 좌표 기반 연산)
  [정면 촬영 분석]
  - 어깨 기울기: ${shoulderTilt}도 (0도=완벽 대칭, 3도 이상=비대칭 주의)
  - 골반 기울기: ${pelvisTilt}도 (0도=완벽 대칭, 3도 이상=비대칭 주의)
  - 어깨-골반 너비 비율: ${shoulderHipRatio} (1.2~1.4=표준, 0.9 이하=비만 체형 경향, 1.5 이상=역삼각형)
  - 다리 형태: ${legType} (정상/O자/X자) — 편차 각도: ${legAngle}도
  - 무릎 정렬: ${kneeAlignment} (정상/비대칭)
  
  [측면 촬영 분석]
  - 거북목(FHP) 기울기: ${neckAngle}도 (정상: 0~15도, 15도 이상=거북목)
  - 상체(흉추) 기울기: ${torsoAngle}도 (정상: 0~10도)
  - 라운드 숄더 각도: ${roundedShoulderAngle}도 (정상: 0~5도, 10도 이상=라운드 숄더)
  - 등 굽힘(흉추 후만) 각도: ${kyphosisAngle}도 (정상: 0~10도, 15도 이상=굽음 주의, 25도 이상=심한 굽음)

※ 위 수치 데이터를 최우선적으로 신뢰하여 분석 결과를 도출하세요.
※ 제공된 사진은 윤곽과 근육의 형태를 파악하는 보조 수단으로만 사용하세요.
※ 틀어짐 분석: 위 수치를 종합하여 '어깨-골반 불균형', '거북목+라운드숄더 복합', 'O/X자 다리로 인한 무릎 부담' 등 연관 패턴을 도출하세요.

■ 실시간 AI 모션 센서 측정 데이터
  - 팔 올리기 (견관절 가동범위):
    · 종합 평가: ${armRaiseData?.armRaiseGrade ?? 'N/A'}
    · 평균 올림 각도: ${armRaiseData?.armAvgAngle ?? 'N/A'}도 (180도가 완벽한 수직)
    · 팔과 귀 밀착도: ${armRaiseData?.earProximity ?? 'N/A'}
    · 팔꿈치 펴짐: ${armRaiseData?.elbowStraight ? '정상' : '굽어짐 (감점)'}
  - 유연성 (전굴):
    · 종합 평가: ${flexData?.flexGrade ?? 'N/A'}
    · 손끝 닿는 위치: ${flexData?.handPosition ?? 'N/A'}
    · 무릎 펴짐: ${flexData?.kneeStraight ? '정상' : '굽어짐 (감점)'}
    · 허리 굽힘 여부: ${flexData?.waistPenalty ? '부족 (감점)' : '정상'}
  - 눈 감고 한발 서기 (15초):
    · 측정 조건: ${eyesClosed ? '눈 감음 (정규 측정)' : '눈 뜨고 수행 (노약자 옵션 - 최고 60점 제한 및 나이 페널티)'}
    · 발 땅 닿음 횟수 (footDrops): ${footDrops !== null ? footDrops + '회' : '데이터 없음'}
    · 몸 흔들림 누적 수치 (swayScore): ${swayScore !== null ? swayScore : '데이터 없음'} (0:아주안정 ~ 80이상:매우불안정)
    · [이 나이/성별의 평가 기준표] ${balanceStandard}

■ 뇌 기능 분석 데이터
  - 두뇌 인지 반응: (속도: ${reactionTimeMs}ms, 오류: ${reactionErrors}회) -> 환산 뇌 나이: ${Math.round(reactionAge)}세
  - 기억력(장보기): ${memorySpan}/5 정답, 가격 계산: ${mathCorrect ? '정답' : '오답/미수행'} -> 환산 뇌 나이: ${Math.round(memoryAge)}세
  - 종합 뇌 나이: ${calculatedBrainAge}세
  ※ 평가 지침: 뇌 나이 테스트 결과에 대해 매우 짧게(1~2문장) "어떤 부분이 강점이고 어떤 부분이 노화되었는지" 평가를 작성하세요.

■ 7코드 건강 점검 다중 선택 결과
  - 선택된 키워드 목록: ${sevenCodeKeywords.join(', ')}
  - 에너지가 가장 부족한(방전된) 코드(BHP) 시스템 도출 결과: ${weakestCode}차크라

  ※ physicalAge(종합 신체 기능 나이) 산출 공식:
     = 균형(40%) + 자세(30%) + 유연성(15%) + 팔올리기(15%) 가중 평균
     균형/자세/유연성/팔올리기의 신체 나이 상당값을 사진으로 추정하여 가중 평균 후 physicalAge 기입.

■ 정확도 강화를 위한 100점 만점 엄격 채점 지침 및 웰니스 가이드라인
- **[법적 주의사항]** "진단", "치료", "환자", "처방" 등의 의료적 단어는 "스크리닝", "웰니스 관리", "고객/회원", "맞춤형 운동 제안" 등의 용어로 교체하세요.

[사진 1~2: 정면/측면 자세 — 5대 항목 세부 채점 기준]
- 다음 5항목을 배열로 출력. 이름(name)은 아래와 정확히 동일하게 작성.

  1) "거북목 (FHP) 및 경추 정렬" [측면 사진 기준]
     • Good(90~100): 귀 중심이 견봉(어깨 끝)과 완벽한 수직 (1cm 미만 오차)
     • Fair(60~89):  귀 중심이 견봉 앞 1~3cm (경미한 거북목 조짐)
     • Poor(0~59):   귀 중심이 3cm 이상 앞 (심한 거북목 — 노화 +5~10세 신호)

  2) "어깨 / 골반 좌우 대칭" [정면 사진 기준]
     • Good(90~100): 양 어깨·골반 높이 차 0.5cm 미만, 거의 완벽한 수평
     • Fair(60~89):  어깨 또는 골반 한쪽 1~2cm 기울어짐
     • Poor(0~59):   2cm 이상 차이 또는 양쪽 모두 비대칭 (척추 비평형 노화 신호)

  3) "측면 척추 정렬 (흉추/요추)" [측면 사진 기준]
     • Good(90~100): 흉추 후만 20~40도 + 요추 전만 30~50도 (자연 S자 곡선)
     • Fair(60~89):  흉추 40~50도 또는 요추 50~60도 (편평등 또는 경미한 굽은등)
     • Poor(0~59):   흉추 50도 초과 또는 요추 60도 초과 (심한 굽은등·과다전만)

  4) "하체 기저면 (무릎/다리/발목)" [정면 사진 기준]
     • Good(90~100): X·O다리 없음, 발 방향 정상, 무릎이 2~3번째 발가락 방향
     • Fair(60~89):  경미한 X다리(외반슬) 또는 O다리(내반슬), 발 외회전 10~20도
     • Poor(0~59):   뚜렷한 X·O다리, 발 외회전 20도 초과 (연골 노화 신호)

  5) "귀-어깨-고관절-무릎 수직선 이탈" [측면 사진 기준]
     • Good(90~100): 귀·견봉·대전자·무릎이 수직선 오차 1cm 이내
     • Fair(60~89):  1개 지점 1~3cm 이탈 (전방·후방 경사 조짐)
     • Poor(0~59):   복수 지점 이탈 또는 1개가 3cm 초과

- 체형 패턴(bodyTypeAnalysis) 별도 평가. 예: 편평등(Flat Back), 굽은등(Kyphosis), Sway Back, 거북목+강직 후만 등

- ★ 자세 신체 나이(posturePhysicalAge) 역산 공식 [항목별 가중치 적용]:
  weightedScore = ①거북목×0.25 + ②어깨골반×0.20 + ③척추정렬×0.25 + ④하체기저면×0.15 + ⑤수직선×0.15
  (③척추정렬 점수 = (③-A흉추 + ③-B요추) ÷ 2 먼저 계산)

  • weightedScore ≥ 90 → posturePhysicalAge = 실제나이 - 10
  • weightedScore ≥ 80 → posturePhysicalAge = 실제나이 -  5
  • weightedScore ≥ 70 → posturePhysicalAge = 실제나이
  • weightedScore ≥ 60 → posturePhysicalAge = 실제나이 +  5
  • weightedScore ≥ 50 → posturePhysicalAge = 실제나이 + 10
  • weightedScore <  50 → posturePhysicalAge = 실제나이 + 15
  (최소 20세, 최대 85세 범위로 제한)

[사진 3~5: 균형·가동범위·유연성]
- 한발 서기 (화면 점수): ${getBalanceScoreOutput(footDrops, swayScore, eyesClosed)}점 / 100점 (AI가 이 점수를 그대로 agingMetrics.score에 기입하세요)
- 한발 서기 (균형 나이): ${getBalancePhysicalAge(footDrops, swayScore, eyesClosed)}세 수준 (AI가 임의 추정하지 말고 이 나이 수치를 100% 반영하여 평가하세요)
- 팔 올리기(견관절 가동범위): armRaiseScore를 100점 만점으로 매우 엄격하게 채점하세요 (일반인 평균 70점).
  • 100점: 양팔이 귀에 완벽히 밀착되고 수직(180도)인 엘리트.
  • 70점: 귀에서 약간 이탈하거나 팔꿈치가 살짝 굽혀짐 (일반인 평균).
  • 50점 이하: 크게 벌어지거나 각도가 낮음.
- 유연성(전굴): flexibilityScore를 100점 만점으로 매우 엄격하게 채점하세요 (일반인 평균 70점).
  [여성 기준]
  • 손바닥 전면 닿음(100점)    → 실제나이 - 13세
  • 손끝 닿음(90점)            → 실제나이 -  8세
  • 정강이 중간(60~80점)       → 실제나이 -  3세
  • 정강이 위(40~59점)         → 실제나이 +  5세
  • 무릎 미만(39점 이하)       → 실제나이 + 13세

  [남성 기준]
  • 손바닥 전면 닿음(100점)    → 실제나이 - 10세
  • 손끝 닿음(90점)            → 실제나이 -  5세
  • 정강이 중간(60~80점)       → 실제나이
  • 정강이 위(40~59점)         → 실제나이 +  7세
  • 무릎 미만(39점 이하)       → 실제나이 + 15세

  (최소 20세, 최대 85세 범위로 제한)

- **[중요 지침 1]** \`agingMetrics\` 배열에는 눈 감고 한발 서기, 유연성, 팔 올리기 등 지표만 기입하세요.
- **[중요 지침 2]** 전체 리포트의 모든 설명창은 미사여구를 빼고 핵심만 1~2문장(최대 100자) 이내로 요약하세요.
- **[중요 지침 4]** 사진 판독 거절 규정: '정상적인 측정이 불가능한 불량 사진'이라고 판단될 경우, 점수를 최하점으로 처리하고, 설명란에 **"오류: 사진에 전신 동작이 정상적으로 인식되지 않아 측정이 취소되었습니다. 올바른 자세로 다시 측정해 주세요."** 라고만 명확하게 작성하세요.
- **[중요 지침 5] 촬영된 사진의 각 항목별 필수 기준**:
  1. 정면 자세: 가장 중요한 것은 완벽한 '정면'이어야 하며, 반드시 '머리에서 발끝까지' 전신이 다 나와야 합니다. 이 기준에 부합하는지 먼저 확인 후 평가하세요.
  2. 측면 자세: '측면'에서 촬영되어야 하며, 반드시 '머리에서 발끝까지' 전신이 다 나와야 합니다.
  3. 팔 들어 올리기: 팔이 귀에 얼마나 밀착되었는지, 팔꿈치가 굽혀지지 않고 쫙 펴졌는지를 최우선으로 판단해서 평가하세요.
  4. 유연성 테스트: 두 발이 땅에 명확히 나오고, 손이 땅을 향해 얼마나 닿았는지를 기준으로 엄격하게 평가하세요.
[사진 8: 안면 노화 및 건강 분석]
- 1. 물리적 노화 평가: 피부 톤과 맑음 정도, 주름, 탄력을 세밀하게 분석하여 기본 안면 노화도를 평가하세요.
- 2. 에너지 및 표정 평가: 카메라 측정 안면 평균 밝기(Luma)는 ${faceBrightness !== undefined ? faceBrightness : '측정불가'}입니다 (50~200 범위). 이 수치와 사진 상의 표정(미소, 생기)을 종합하여 '밝은 에너지'를 평가하세요.
- 3. 종합 '얼굴 건강 나이(faceAgeEstimate)' 산출: 위 1번(물리적 노화)을 기준으로 하되, 2번(밝기와 에너지)이 우수할수록 실제 피부 나이보다 더 젊고 생기 있게(동안으로) 최종 건강 나이를 보정하여 산출하세요.
- 리포트 작성 시, 물리적 노화 상태와 밝은 에너지가 어떻게 결합되어 해당 나이가 도출되었는지(예: "미세 주름은 있으나 표정이 매우 밝고 에너지가 좋아 X세로 평가됩니다") 핵심만 요약해서 설명하세요.

■ 종합 분석 (summary) 및 신체 나이·종합 점수 산출
  - **physicalAge(종합 신체 기능 나이)** 가중 평균 공식을 직접 계산하여 기입:
    physicalAge = 반올림(balancePhysicalAge×0.40 + posturePhysicalAge×0.30 + flexibilityPhysicalAge×0.15 + armRaisePhysicalAge×0.15)
  - **overallScore(3바디 코어 밸런스 점수):** 3바디 코어 밸런스 점수는 신체, 얼굴, 뇌, 마음(7코드) 4가지 요소를 모두 반영한 점수입니다. 시스템이 자동 계산하므로, summary 작성 시 이 점수가 "신체 측정뿐만 아니라 얼굴 노화도, 두뇌 인지 반응, 7코드(K차크라) 에너지 밸런스를 모두 종합한 3바디 코어 밸런스 점수"라는 점을 강조하세요.
- 체형 패턴 안내: bodyTypeAnalysis에서 지방 과다 패턴이 관찰될 경우, summary에 체지방 관리와 관절 부하 감소를 위한 생활 습관 개선 방향을 참고로 안내하세요. (단, 전문 의료기관 상담을 권장하는 표현으로 대체)
- 3바디 7코드 분석: 신체 측정 데이터와 3바디 7코드의 연관성을 관찰형 언어로 설명하고, 광명차크라 수련이 건강 증진에 도움이 될 수 있음을 안내하세요. (절대 단정적 표현 금지)
- **[핵심 결론 메시지 — summary 마지막 부분에 반드시 포함]**
  summary의 최종 마무리에 아래 핵심 메시지를 자연스럽게 녹여 작성하세요:
  "온전한 건강은 몸(Body)과 마음·에너지(Mind), 뇌·의식(Brain) 세 가지가 모두 건강한 상태를 의미합니다. 이 3가지를 '3바디'라고 하며, 7코드 에너지 밸런스를 통해 통합 관리하는 곳이 바로 브레인트레이닝센터(BTC)입니다."
  — 단, 위 문장을 그대로 복사하지 말고, 회원의 측정 결과에 맞게 자연스럽게 연결하여 작성하세요. 예를 들어: "회원님의 신체(Body)는 우수하지만, 에너지(Mind) 밸런스에서 충전이 필요한 코드가 있습니다. 온전한 건강은 몸·마음·뇌 세 가지가 모두 충만해야 이루어집니다. BTC의 3바디 7코드 프로그램으로 부족한 에너지를 채워보세요."

■ 3BODY & 7CODE & 추천 프로그램 JSON 생성 지침 (절대 원칙 준수)
1. **threeBodyAnalysis**: 체형/유연성/근력 분석 결과를 바탕으로 BODY, MIND, BRAIN 각각의 점수와 원인-결과 해석을 작성하세요.
2. **sevenCodeAnalysis (7코드 분석)**:
   사용자가 직접 선택한 '선택된 키워드 목록'과 '에너지가 가장 부족한(방전된) 코드(${weakestCode})'를 바탕으로 작성하세요. 
   해당 코드(${weakestCode})를 중심으로 에너지가 가장 부족하고 방전된 상태로 평가하고, 신체 측정 결과를 보조로 활용하여 각 1~7코드의 0~100점 점수와 해석을 도출하세요. 점수가 낮은 코드에 대해서는 '에너지 충전이 필요한 상태'로, 점수가 높은 코드는 '에너지가 충만한 상태'로 해석하세요.
   * 용어 지침: 반드시 최초 언급 시 "7코드(K차크라)"라고 표기하고, 이후부터는 "7코드"로 통일하세요. 
   * 금지어: "타로", "K-타로", "카드" 등의 단어는 절대 사용하지 마세요! (이것은 타로 서비스가 아니라 선택된 키워드 기반의 에너지 파동 스크리닝입니다). "질환", "병명" 절대 금지!
   * 권장 구조: 관찰형 표현 사용 ("에너지 방전 패턴", "에너지 충전 필요", "충만한 에너지 상태", "밸런스 회복을 위한 충전 권장"). '막혀있다'는 올드한 표현 절대 금지. '부족하다', '방전되었다', '충전이 필요하다', '충만하다' 등의 현대적 표현을 사용하세요.
   * 반드시 "데이터 → 의미 → 웰니스 개선 방향" 순서의 템플릿 구조를 따르세요. 
   * evidence 배열: 각 7코드 점수를 깎아먹은 측정 근거 또는 선택된 키워드 2~3개를 한글 배열로 추가하세요.
3. **kwangmyungChakra (광명차크라 특별수련)**:
   - \`reason\`: 왜 광명차크라가 필요한지 현재 회원의 상태(부정적 키워드나 자세 등)를 기반으로 깊이 공감하며 설명하세요. (예: "현재 머리가 무겁고 집중이 잘 안 되시는 상태로 보입니다. 이는 상위 차크라 에너지가 방전되었기 때문입니다...")
   - \`expectedBenefit\`: 수련을 통해 얻게 될 변화를 삶의 질 향상 측면에서 매력적으로 묘사하세요. (예: "내면의 빛을 밝힘으로써 정신적 혼란이 사라지고, 삶의 활력과 명료한 직관을 되찾게 될 것입니다.")
4. **programRecommendation**: 현재 상태에 가장 적합한 프로그램을 추천하세요.
${userInfo.memberType === 'existing' 
  ? `   **[기존 수련 회원 전용 중요 기준 - 반드시 아래 규칙을 따르세요!]**
   - 기존 회원은 21일/66일/100일 추천 대신, 7코드 중 **가장 점수가 낮거나 불균형한 코드 영역**을 찾아 아래 매핑된 프로그램 리스트 중 **적합한 2~3가지를 쉼표로 연결**하여 \`recommended\` 에 적어주세요.
   - [하위 코드(1,2) 취약]: 광명차크라, 장생스쿨(60세 이상만 기입), 바디프리
   - [중간 코드(3,4) 취약]: 광명차크라, 솔라시스템, 마음프리
   - [상위 코드(5,6,7) 취약]: 광명차크라, PBM(Power Brain Method), 성인운기스쿨
   - \`reason\`과 \`duration\`에는 해당 프로그램들이 왜 다음 단계의 의식 성장을 위해 필요한지 구체적인 기대 효과 위주로 공감되게 설명하세요. (참고: PBM은 Perfect Body가 아닌 Power Brain Method의 약자입니다.)`
  : `   **[신규 회원 전용 중요 기준 - 반드시 아래 규칙을 따르세요!]**
   - 종합 점수(overallScore) 90점 이상: 21일 (건강 유지 및 집중 관리)
   - 종합 점수(overallScore) 70점 ~ 89점: 66일 (습관 개선 및 체질 변화)
   - 종합 점수(overallScore) 70점 미만: 100일 (근본적인 회복 및 재건)
   위 기준에 맞춰서 추천 프로그램(recommended)에 "21일", "66일", "100일" 중 하나만 적고, 그 이유(reason)는 회원의 현재 상태(점수, 자세, 에너지 등)를 짚어주며 **왜 이 기간 동안 꾸준히 수련해야만 근본적인 체질 변화가 일어나는지** 깊이 공감하고 동기를 부여하는 문장으로 작성하세요. 단순히 "점수가 낮아서"가 아니라 "오랜 시간 누적된 긴장을 풀고 새로운 에너지 습관을 몸에 새기기 위해 최소 00일의 시간이 필요합니다"와 같은 형태를 권장합니다.`}
  `;

  // --- 이전 기록 비교 분석 데이터 준비 ---
  let previousReport: BodyReport | null = null;
  if (userInfo.previousRecordId) {
    try {
      const allRecords = await getRecordsLocally();
      const prevRecord = allRecords.find(r => r.id === userInfo.previousRecordId);
      if (prevRecord?.report?.id) {
        previousReport = prevRecord.report;
        console.log(`[비교분석] 이전 기록 로드 성공: ${prevRecord.name} (${new Date(prevRecord.lastTestDate).toLocaleDateString()})`);
      }
    } catch (e) {
      console.warn('[비교분석] 이전 기록 로드 실패:', e);
    }
  }

  try {
    // 타임아웃 90초 + 자동 재시도 (최대 2회)
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 90_000;
    let lastError: Error | null = null;
    let response: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.log(`[Gemini] 분석 시도 ${attempt + 1}/${MAX_RETRIES}...`);
        
        const apiCall = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [...parts, { text: prompt }] },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                postureScore:     { type: Type.NUMBER, description: "자세 분석 종합 점수 (0~100)" },
                flexibilityScore: { type: Type.NUMBER, description: "유연성 분석 종합 점수 (0~100)" },
                armRaiseScore:    { type: Type.NUMBER, description: "팔 올리기 가동범위 종합 점수 (0~100)" },
                faceAgeEstimate:  { type: Type.NUMBER, description: "추정 안면 피부 나이" },
                summary:          { type: Type.STRING, description: "전체적인 건강 상태 종합 평가 한국어 200자 이상" },
                brainHealthImplication: { type: Type.STRING, description: "신체 상태가 뇌 건강에 주는 의미 한국어" },
                bodyTypeAnalysis: { type: Type.STRING, description: "종합 체형 특징 분석 명칭 (예: 편평등 Flat Back, 굽은등 Sway Back 등)" },
                bodyAlignmentAnalysis: {
                  type: Type.ARRAY,
                  description: "신체 틀어짐 분석 결과. 측정된 수치를 기반으로 해당되는 항목만 배열로 출력하세요.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      issue:       { type: Type.STRING, description: "틀어짐 항목명" },
                      severity:    { type: Type.STRING, enum: ['정상', '경미', '주의', '심함'], description: "심각도 등급" },
                      measuredValue: { type: Type.STRING, description: "실측 수치" },
                      normalRange: { type: Type.STRING, description: "정상 범위" },
                      impact:      { type: Type.STRING, description: "이 틀어짐이 신체에 미치는 영향 (50자 이내)" },
                      recommendation: { type: Type.STRING, description: "개선을 위한 운동/습관 제안 (50자 이내)" }
                    }
                  }
                },
                postureMetrics: {
                  type: Type.ARRAY,
                  description: "반드시 지정된 5개의 고정 항목을 출력하세요.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name:        { type: Type.STRING, description: "지정된 5대 항목명" },
                      status:      { type: Type.STRING, enum: ['Good', 'Fair', 'Poor'] },
                      description: { type: Type.STRING },
                      score:       { type: Type.NUMBER, description: "0~100 사이의 배점" }
                    }
                  }
                },

            agingMetrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  testName:    { type: Type.STRING },
                  result:      { type: Type.STRING },
                  score:       { type: Type.NUMBER, description: "0~100 사이의 배점 (100점 만점 기준)" },
                  description: { type: Type.STRING, description: "장황한 설명 금지. 지표 저하 원인과 개선 방안을 핵심만 1~2문장(최대 100자 이내)으로 아주 짧고 명확하게 작성하세요." }
                }
              }
            },
            faceAnalysis: {
              type: Type.OBJECT,
              properties: {
                skinTone:       { type: Type.STRING, description: "피부 톤과 밝기, 맑음 정도 분석" },
                wrinkles:       { type: Type.STRING },
                elasticity:     { type: Type.STRING },
                summary:        { type: Type.STRING },
                recommendation: { type: Type.STRING }
              }
            },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                meditation:    { type: Type.STRING },
                gymnastics:    { type: Type.STRING },
                brainTraining: { type: Type.STRING }
              }
            },
            brainTestEvaluation: { type: Type.STRING, description: "두뇌 인지 반응 및 장보기 기억/계산 테스트 결과에 대한 상세 평가 및 개선 가이드 (2~3문장)" },
            threeBodyAnalysis: {
              type: Type.OBJECT,
              properties: {
                body: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, description: { type: Type.STRING } } },
                mind: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, description: { type: Type.STRING } } },
                brain: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, description: { type: Type.STRING } } }
              }
            },
            sevenCodeAnalysis: {
              type: Type.OBJECT,
              properties: {
                code1: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code2: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code3: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code4: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code5: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code6: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                code7: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, label: { type: Type.STRING }, description: { type: Type.STRING }, evidence: { type: Type.ARRAY, items: { type: Type.STRING } } } }
              }
            },
            kwangmyungChakra: {
              type: Type.OBJECT,
              properties: {
                needLevel: { type: Type.STRING, enum: ['높음', '보통'] },
                reason: { type: Type.STRING },
                expectedBenefit: { type: Type.STRING }
              }
            },
            programRecommendation: {
              type: Type.OBJECT,
              properties: {
                recommended: { type: Type.STRING },
                reason: { type: Type.STRING },
                duration: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

        // 타임아웃 적용
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`AI 분석 타임아웃 (${TIMEOUT_MS/1000}초 초과)`)), TIMEOUT_MS);
        });

        response = await Promise.race([apiCall, timeoutPromise]);
        console.log(`[Gemini] 분석 성공 (시도 ${attempt + 1})`);
        break; // 성공 시 루프 탈출
      } catch (retryError: any) {
        lastError = retryError;
        console.warn(`[Gemini] 시도 ${attempt + 1} 실패:`, retryError?.message);
        if (attempt < MAX_RETRIES - 1) {
          console.log(`[Gemini] ${3}초 후 재시도...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!response) {
      throw lastError || new Error('AI 분석에 실패했습니다.');
    }

    const text = response.text;
    if (!text) throw new Error("AI response text is empty");

    const parsed = JSON.parse(text);

    // ─── 종합 건강 점수 (BTC 통합 측정 기준) ──────────────────────────
    // AI가 반환한 점수(posture, flex, arm)와 시스템 확정 점수(squat, pushup, balance) 병합
    const pScore = typeof parsed.postureScore === 'number' ? parsed.postureScore : 70;
    const fScore = typeof parsed.flexibilityScore === 'number' ? parsed.flexibilityScore : 70;
    const aScore = typeof parsed.armRaiseScore === 'number' ? parsed.armRaiseScore : 70;

    const balanceScoreVal = getBalanceScoreOutput(footDrops, swayScore, eyesClosed);
    const balancePhysicalAge = getBalancePhysicalAge(footDrops, swayScore, eyesClosed);
    // 내부 연산용 상대 평가 점수 변환
    const relativeBalanceScore = Math.max(20, Math.min(100, 70 - (balancePhysicalAge - userInfo.age) * 2.5));

    // 1. 신체 점수 (40%) : 4대 측정 점수 평균 (근력 제외, 균형은 연령보정 상대점수 사용)
    const physicalScoreVal = Math.round((relativeBalanceScore + pScore + fScore + aScore) / 4);
    
    // 2. 뇌 점수 (30%) : 뇌 나이와 실제 나이 비교 (내 나이보다 젊으면 80+, 늙으면 80-)
    const brainAgeDiff = userInfo.age - calculatedBrainAge; // 양수면 젊음, 음수면 늙음
    const brainScoreVal = Math.max(40, Math.min(100, Math.round(80 + (brainAgeDiff * 1.5))));
    
    // 3. 마음(7코드) 다차원 융합 산출 (감정+안면+인지+신체)
    const mindWeightMap: Record<string, number> = {
      '우울': 3, '불면': 3, '공황': 3, '만성 두통': 3, '건망': 2,
      '피로': 1, '긴장': 1, '짜증': 1, '무기력': 1, '혼란': 1, '외로움': 1,
      '평온': -1, '안정': -1, '기쁨': -1, '열정': -1, '설렘': -1, '사랑': -1, '회복': -1
    };
    
    let sevenCodeWeightSum = 0;
    sevenCodeKeywords.forEach(kw => {
      let weight = 1; // 매핑되지 않은 기본 키워드 페널티
      for (const [key, val] of Object.entries(mindWeightMap)) {
        if (kw.includes(key)) { weight = val; break; }
      }
      sevenCodeWeightSum += weight;
    });

    let faceVitalityPenalty = 0;
    if (faceBrightness !== undefined && faceBrightness !== null) {
      if (faceBrightness < 90) faceVitalityPenalty = 2;
      else if (faceBrightness > 150) faceVitalityPenalty = -1;
    }

    let cognitiveFatiguePenalty = 0;
    if (reactionTimeMs > 1500) cognitiveFatiguePenalty = 2;
    else if (reactionTimeMs > 1200) cognitiveFatiguePenalty = 1;
    else if (reactionTimeMs < 800) cognitiveFatiguePenalty = -1;

    let bodyTensionPenalty = 0;
    if (typeof neckAngle === 'number') {
      if (neckAngle >= 20) bodyTensionPenalty = 2;
      else if (neckAngle >= 15) bodyTensionPenalty = 1;
    }

    const calculatedMindAgeRaw = userInfo.age + sevenCodeWeightSum + faceVitalityPenalty + cognitiveFatiguePenalty + bodyTensionPenalty;
    const mindAge = Math.max(20, Math.min(85, Math.round(calculatedMindAgeRaw)));
    const mindScoreVal = Math.max(40, Math.min(100, Math.round(70 - (mindAge - userInfo.age) * 2)));
    // 4. 얼굴 점수 (10%) : 피부/얼굴 나이와 실제 나이 비교
    const faceAge = typeof parsed.faceAgeEstimate === 'number' ? parsed.faceAgeEstimate : userInfo.age;
    const faceAgeDiff = userInfo.age - faceAge;
    const faceScoreVal = Math.max(40, Math.min(100, Math.round(80 + (faceAgeDiff * 2))));

    // 최종 종합 건강 점수
    const overallScore = Math.round(
      (physicalScoreVal * 0.40) +
      (brainScoreVal * 0.30) +
      (mindScoreVal * 0.20) +
      (faceScoreVal * 0.10)
    );

    // 신체 점수 기반 신체 나이 산출
    const scoreDiff = physicalScoreVal - 70;
    let ageDiff = Math.round(scoreDiff * -0.4);
    ageDiff = Math.max(-12, Math.min(20, ageDiff));
    const physicalAge = Math.max(20, Math.min(85, userInfo.age + ageDiff));

    // 종합 건강 나이 (comprehensiveAge): 신체(40) + 뇌(30) + 마음(15) + 얼굴(15)
    // 마음 나이는 다차원 융합 공식으로 이미 계산됨 (mindAge)
    const comprehensiveAge = Math.round((physicalAge * 0.4) + (calculatedBrainAge * 0.3) + (mindAge * 0.15) + (faceAge * 0.15));

    // ─────────────────────────────────────────────────────────────────────────

    const generateSafeId = () => {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
      } catch (e) {}
      return 'local-id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
    };

    // --- 이전 기록 대비 비교 분석 생성 ---
    let comparisonAnalysis = undefined;
    if (previousReport) {
      const prevScore = previousReport.overallScore || 0;
      const curScore = overallScore;
      const diff = curScore - prevScore;
      const overallChange = diff > 3 ? '개선' : diff < -3 ? '악화' : '유지';

      const scoreChanges = [
        { category: '자세 점수', previousScore: previousReport.postureMetrics?.[0]?.score ?? 0, currentScore: pScore, change: pScore - (previousReport.postureMetrics?.[0]?.score ?? 0), comment: '' },
        { category: '유연성 점수', previousScore: 0, currentScore: fScore, change: 0, comment: '' },
        { category: '균형감각', previousScore: 0, currentScore: balanceScoreVal, change: 0, comment: '' },
        { category: '종합 점수', previousScore: prevScore, currentScore: curScore, change: diff, comment: diff > 0 ? `${diff}점 향상` : diff < 0 ? `${Math.abs(diff)}점 하락` : '동일' },
      ];

      scoreChanges.forEach(sc => {
        if (!sc.comment) sc.comment = sc.change > 0 ? `${sc.change}점 향상` : sc.change < 0 ? `${Math.abs(sc.change)}점 하락` : '동일';
      });

      const prevPhysAge = previousReport.physicalAge || userInfo.age;
      const physAgeDiff = physicalAge - prevPhysAge;

      comparisonAnalysis = {
        previousDate: previousReport.date || '',
        overallChange,
        summary: `이전 측정(${new Date(previousReport.date).toLocaleDateString()}) 대비 종합점수 ${diff > 0 ? '+' : ''}${diff}점 변화. 신체나이 ${prevPhysAge}세 → ${physicalAge}세 (${physAgeDiff > 0 ? '+' : ''}${physAgeDiff}세). ${overallChange === '개선' ? '프로그램 참여 효과가 나타나고 있습니다! 🎉' : overallChange === '악화' ? '일부 수치가 하락했습니다. 추가 관리가 필요합니다.' : '안정적으로 유지되고 있습니다.'}`,
        scoreChanges,
        programEffect: overallChange === '개선' ? '프로그램 효과가 긍정적으로 나타나고 있습니다. 지속적인 수련을 권장합니다.' : overallChange === '악화' ? '일부 지표가 하락했습니다. 맞춤 프로그램 재설정을 권장합니다.' : '현재 상태를 잘 유지하고 있습니다. 다음 단계 프로그램 참여를 권장합니다.'
      };
    }

    return {
      ...parsed,
      physicalAge: physicalAge,
      brainAge: calculatedBrainAge,
      mindAge: mindAge,
      comprehensiveAge: comprehensiveAge,
      overallScore: overallScore,
      comparisonAnalysis,
      id: generateSafeId(),
      date: new Date().toISOString(),
      userInfo
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export async function analyzePhysiognomy(
  metrics: any,
  profile?: { displayName?: string; birthDate?: string; gender?: string; age?: number } | null
): Promise<any> {
  const apiKey = getActiveApiKey();
  if (!apiKey) throw new Error("API 키가 설정되지 않았습니다. 설정 화면에서 API 키를 입력해주세요.");

  const ai = new GoogleGenAI({ apiKey });

  // Few-Shot 예제 로드 및 문자열 빌드
  let fewShotPrompt = '';
  if (profile && (profile as UserInfo).age) {
    const age = typeof profile.age === 'number' ? profile.age : parseInt(profile.age, 10) || 40;
    const gender = (profile.gender as "male" | "female" | "other") || 'female';
    const similarCases = await findSimilarFaceCases({ age, gender }, 3);
    fewShotPrompt = buildFaceFewShotPrompt(similarCases);
  }

  const prompt = `
당신은 동양의 '물형관상학(物形觀相學)', 전통 관상학, 그리고 현대의 '에너지 3바디 7코드' 시스템을 결합하여 분석하는 세계 최고의 AI 관상 전략가이자 마스터입니다.
귀하의 분석은 사용자가 기꺼이 고액을 지불할 만큼 깊이 있고 실전적인 통찰을 제공해야 합니다.

${fewShotPrompt}

[사용자 정보]
- 이름: ${profile?.displayName || '익명'}
- 성별: ${profile?.gender === 'male' ? '남성' : profile?.gender === 'female' ? '여성' : '미확인'}
- 생년월일/나이: ${profile?.birthDate || profile?.age || '미확인'}

[정밀 데이터]
- 삼정(상절/중절/하절) 비율: 상정(${metrics.samjeong.upper.toFixed(2)}) : 중정(${metrics.samjeong.middle.toFixed(2)}) : 하정(${metrics.samjeong.lower.toFixed(2)})
- 기하학적 특징값(Face Ratio): ${metrics.geometricRatio.toFixed(3)}
- 눈꼬리 기울기 (Eye Slant Angle): ${metrics.eyeSlant.toFixed(2)}도 (양수면 올라간 눈, 음수면 처진 눈)
- 눈 둥글기 (Eye Roundness): ${metrics.eyeRoundness.toFixed(3)} (높을수록 둥글고 큼)
- 턱선 각도 (Jaw Angle): ${metrics.jawAngle.toFixed(2)}도 (작을수록 날카로운 V라인, 클수록 넓적함)
- 광대 돌출도 (Cheekbone Prominence): ${metrics.cheekboneProminence.toFixed(2)} (숫자가 클수록 광대가 두드러짐)
- 에너지존(7-Code) 활동 데이터:
  - Root(턱): ${metrics.energyZones.root.toFixed(2)}, Sacral(입): ${metrics.energyZones.sacral.toFixed(2)}
  - Solar Plexus(볼): ${metrics.energyZones.solarPlexus.toFixed(2)}, Heart(이마): ${metrics.energyZones.heart.toFixed(2)}
  - Throat(턱선): ${metrics.energyZones.throat.toFixed(2)}, Third Eye(미간): ${metrics.energyZones.thirdEye.toFixed(2)}, Crown(이마위): ${metrics.energyZones.crown.toFixed(2)}

[핵심 분석 가이드라인 - 백재권 동물관상(물형관상) 15종 정밀 매핑]
1. 톤앤매너: '도사님' 같은 말투가 아닌, 현대적이고 세련된 퍼스널 브랜딩 전문가/경영 컨설턴트의 어투를 사용하십시오.
2. **동물상 판정 엄격한 룰셋 (Rule-set)**: 도출된 정밀 데이터 수치를 바탕으로 반드시 아래 15종 중 가장 일치하는 메인 동물상을 하나 선택하십시오.
   [0.58 이하 - 극수직축 발달 (매우 마르고 갸름)]
   - 황조롱이상: 갸름함 + 눈매 예민(Eye Slant 높음) + 턱선 날카로움 (명석, 완벽주의)
   - 살쾡이상: 갸름함 + 각진 얼굴 + 코 날카로움 + 눈매 예민 (정치/전투력, 임기응변)
   - 매상: 갸름함 + 광대/턱 뚜렷 + 매서운 눈 (주관 뚜렷, 카리스마, 리더)
   - 학상: 갸름하고 우아함 + 전반적으로 부드러운 이목구비
   - 여우상: 갸름함 + 눈꼬리 심하게 올라감(Eye Slant 매우 높음)
   
   [0.58 ~ 0.63 - 갸름형 (예민, 민첩, 화려함)]
   - 고양이상: 눈이 크고 둥글며(Eye Roundness 높음) 눈꼬리가 올라감(Eye Slant > 5) (예민, 감각적, 연예인)
   - 독수리상: 날카로운 눈매(Eye Slant > 10) + 얼굴 갸름 (M&A, 리더십, 단기승부)
   - 꽃사슴상: 눈 둥글기(Eye Roundness) 높음 + 턱선(Jaw Angle) 부드러움 (순수, 이타적)
   - 표범상: 얼굴 각짐 + 눈매 날카로움 + 광대(Cheekbone) 도드라짐 (재주, 독재 기질)
   - 늑대상: 얼굴 갸름 + 턱선 강함
   - 원숭이상: 이마 넓고 턱이 좁음 + 다재다능
   
   [0.63 ~ 0.68 - 균형/다소 넓음 (안정, 친화력, 우직함)]
   - 양상: 얼굴 둥글고 눈 둥글며 전체적으로 부드러움 (순수, 얌전, 인내심)
   - 소상: 턱선(Jaw Angle) 부드러움 + 눈 둥글고 순함 (우직, 끈기, 착함)
   - 다람쥐상: 작은 얼굴(또는 하관이 뾰족) + 코 짧음 + 활기참 (명랑, 호기심, 재주)
   - 판다곰상: 얼굴 매우 둥글고 부드러움 + 광대 낮음 + 둥근 눈 (낙천적, 친화력)
   - 세퍼드상: 안정적 너비 + 직선적인 눈매(Eye Slant 낮음) + 견고한 턱선 (충성, 신뢰)
   - 시베리안 허스키상: 눈이 크고 밝음 + 턱선 부드러움 + 얼굴 균형 (친화력, 충성)
   - 강아지상: 둥글고 쳐진 눈매(Eye Slant 음수) + 부드러운 얼굴선 (순종적, 귀여움)
   
   [0.68 이상 - 압도적 횡축 (둥글넓적, 각짐, 카리스마)]
   - 두꺼비상: 얼굴 매우 넓음 + 중간 크기의 둥근 눈 + 광대 부드러움 (소탈, 뚝심, 사업가)
   - 악어상: 턱선 강하고 각짐 + 매서운 눈매(Eye Slant 높음) + 광대 뚜렷 (공격적 기운, 위기영웅)
   - 사자상: 얼굴 넓고 당당함 + 이목구비 균형 + 광대/턱 뚜렷 (위엄, 통솔력, 국가 지도자)
   - 맹견상: 매서운 눈매 + 강한 턱선 + 각진 얼굴 (전투적, 명석)
   - 호랑이상: 넓은 얼굴 + 압도적 카리스마 눈빛
   - 곰상: 매우 넓고 둥글지만 골격이 큰 상 (우직, 힘)
   - 멧돼지상: 콧방울이 크고 턱이 강하며 투박한 상

3. 물형관상 근거 명확화: 결과 보고서 작성 시, 사용자가 납득할 수 있도록 입력된 수치(예: "눈꼬리가 12도 정도로 치켜 올라가 있고...")를 직접 언급하며 도출 사유를 논리적으로 설명하십시오.
4. 7코드(7-Code): 각 코드의 에너지를 현대 심리학 관점에서 해석하고 7개를 모두 포함하십시오.
5. 전통 이목구비 분석: 이마, 눈썹, 눈, 광대뼈, 귀, 코, 입, 턱, 기색을 분석하십시오.
6. **프리미엄 종합 평가 (핵심 요구사항)**: 사용자가 가장 큰 흥미를 느끼는 3대 관심사(건강, 사업/부/성공, 연애/관계)를 구체적으로 풀어내고, 마지막으로 '3바디 7코드(에너지 시스템)' 관점에서 이 모든 것을 아우르는 강력한 마스터 총평을 작성하십시오.

[응답 형식: JSON]
{
  "summary": "MZ세대부터 시니어까지 직관적으로 공감할 수 있는 세련된 한 줄 요약",
  "score": 종합 점수 (0~100),
  "confidenceScore": 분석 신뢰도 (%),
  "samjeongAnalysis": "성장기-전성기-안정기 프레임으로 풀어낸 인생 타임라인 분석",
  "personality": "현대적 성격 이론이 가미된 입체적인 기질 분석",
  "wealthAndCareer": "현대 비즈니스 환경에서의 성공 방정식과 부의 경로",
  "animalMorphology": {
    "type": "분석된 주 물형 (세련된 명칭 사용, 예: '강인한 기운의 호랑이상')",
    "englishType": "영문 타입 (이미지 검색 키워드로 사용되므로 Tiger, Lion, Crane 등 단어 위주로 작성)",
    "description": "물형의 현대적 정의",
    "visualCharacteristics": "해당 물형(동물)의 구체적인 얼굴 형태와 특징 설명",
    "detailedAnalysis": "해당 물형이 현대 경쟁 사회에서 가지는 독보적 장점과 브랜딩 전략",
    "traits": ["키워드1", "키워드2", "키워드3"],
    "geometricBasis": "기하학적 수치를 기반으로 한 논리적 판정 사유",
    "animalMorphologyBlend": [
      {
        "type": "동물명",
        "matchPercentage": 확률(%),
        "characteristic": "해당 부위의 특징적 유사성"
      }
    ]
  },
  "energy3Body7Code": {
    "threeBodyAnalysis": "물리-감성-지성 바디의 시스템적 밸런스 분석",
    "sevenCodeDetailed": [
      {
        "name": "에너지 코드명",
        "region": "신체 부위",
        "bodyPart": "물리적 매칭",
        "state": "Positive" 또는 "Negative" 또는 "Neutral",
        "interpretation": "현대적 심리/행동학적 해석",
        "score": 점수
      }
    ]
  },
  "brightEnergy": {
    "score": 점수 (0-100),
    "description": "안색 기반 에너지 요약"
  },
  "traditionalAnalysis": {
    "forehead": "초년운과 지성, 직관을 나타내는 이마 분석",
    "eyebrows": "형제운과 대인관계, 수명을 나타내는 눈썹 분석",
    "eyes": "소통과 통찰력, 정신력을 중심으로 한 눈 분석",
    "cheekbones": "권세, 사회적 위상, 투쟁력을 나타내는 광대뼈 분석",
    "nose": "실행력, 재물운, 자아를 중심으로 한 코 분석",
    "mouth": "영향력, 포용력, 식록을 중심으로 한 입 분석",
    "jaw": "말년운과 부하운, 인내심을 나타내는 턱 분석",
    "ears": "지혜와 수명, 태생적 에너지를 나타내는 귀 분석",
    "skin": "바이탈리티와 기운의 컨디션(기색) 분석"
  },
  "lifeStrategy": {
    "career": "전문 직군 추천 및 성공 로드맵",
    "wealth": "자산 형성 스타일 및 관리 전략",
    "relationship": "소셜 포지셔닝 및 인맥 관리 전략"
  },
  "comprehensiveEvaluation": {
    "health": "관상과 에너지를 통해 본 선천적 체질과 후천적 건강 관리 포인트",
    "wealthAndSuccess": "재물그릇의 크기와 사업적 성공 포텐셜, 그리고 부를 끌어당기는 방법",
    "loveAndRelationship": "연애 스타일, 매력 포인트, 그리고 좋은 인연을 맺고 유지하는 방법",
    "threeBodySynthesis": "물리(Physical), 감성(Emotional), 지성(Mental) 바디와 7코드의 밸런스를 종합한 최종 마스터의 강렬한 총평"
  },
  "advice": "마스터의 전략적 솔루션 (코칭 말투)"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("분석 결과를 받지 못했습니다.");
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "분석 중 오류가 발생했습니다.");
  }
}

// ==========================================
// K-Tarot (천부경 타로) 해석 API
// ==========================================
export const analyzeTarot = async (
  concern: string,
  name: string,
  age: string,
  gender: string,
  past: CheonbugyeongCharacter,
  present: CheonbugyeongCharacter,
  future: CheonbugyeongCharacter,
  masterId: string
): Promise<string> => {
  const apiKey = getActiveApiKey();
  if (!apiKey) {
    throw new Error("API 키가 설정되지 않았습니다. 설정 화면에서 API 키를 입력해주세요.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const selectedMaster = MASTERS.find(m => m.id === masterId);
  const masterPersonaPrompt = selectedMaster 
    ? selectedMaster.prompt
    : "You are a wise and insightful Cheonbugyeong master. Your tone is mystical and supportive.";

  // Few-Shot 예제 로드 및 문자열 빌드
  const similarCases = await findSimilarTarotCases(3);
  const fewShotPrompt = buildTarotFewShotPrompt(similarCases);

  const prompt = `
    ${masterPersonaPrompt}
    Your role is to provide insightful and empathetic guidance, similar to a Tarot reading, based on its 81 mystical characters.

    ${fewShotPrompt}

    A user is seeking clarity on a personal matter. They have provided their details, their concern, and have drawn three characters from the Cheonbugyeong, representing their Past, Present, and Future.


    **User's Details:**
    - Name: ${name}
    - Age: ${age}
    - Gender: ${gender}

    **User's Concern:** "${concern}"

    **Drawn Characters:**
    1.  **Past:** The character is '${past.char}' ('${past.reading}'), which symbolizes '${past.meaning}'.
    2.  **Present:** The character is '${present.char}' ('${present.reading}'), which symbolizes '${present.meaning}'.
    3.  **Future:** The character is '${future.char}' ('${future.reading}'), which symbolizes '${future.meaning}'.

    **Your Task:**
    Provide a holistic interpretation in **KOREAN** based on the user's details, their concern, and the sequence of these three characters. Structure your response clearly using Markdown H3 headers (###) for each of the following sections:

    ### 총운 (Overall Reading)
    Start with a brief, insightful summary of the overall energy of this reading, subtly acknowledging the user's context (${name}, ${age}).

    ### 과거 (Past)
    Explain how the Past character ('${past.char}') and its meaning relate to the origins and background of the user's concern.

    ### 현재 (Present)
    Analyze the Present character ('${present.char}') and its symbolism in the context of the user's current situation and challenges.

    ### 미래 (Future)
    Interpret the Future character ('${future.char}') as a potential outcome or a guiding energy for resolving the concern.

    ### 조언 (Advice)
    Conclude with a piece of compassionate, actionable advice. This advice MUST follow a specific structure:
    a. Begin by affirming that the user is in a good and positive state right now.
    b. Then, suggest that to further enhance their energy, it is important to focus on charging one of the 7 healing chakras.
    c. You must choose ONE specific chakra that you feel is most relevant to the user's situation (based on their concern and the drawn characters).
    d. Finally, recommend that they incorporate the color associated with that chosen chakra into their daily life through accessories (like bracelets, necklaces) or clothing to help attract and charge that energy.

    ### 라이프스타일 조언 (Lifestyle Advice)
    Provide practical, concise advice tailored to the reading, covering the following five areas:
    - **긍정 에너지:** A simple mindset or affirmation.
    - **운동:** A light and suitable physical activity suggestion.
    - **식사:** A small, helpful dietary tip.
    - **습관:** One constructive daily habit to adopt.
    - **명상:** A brief mindfulness or meditation technique.
    Keep this lifestyle advice supportive and easy to integrate into daily life.

    Maintain your assigned persona's tone throughout your response. Ensure the language is clear, profound, and easy to understand for someone seeking guidance.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = response.text;
    if (!text) throw new Error("타로 해석 결과를 받지 못했습니다.");
    return text;
  } catch (error: any) {
    console.error("Gemini Tarot Analysis Error:", error);
    throw new Error(error.message || "타로 해석 중 오류가 발생했습니다.");
  }
};

