export enum AssessmentStep {
  INTRO = 'INTRO',
  USER_INFO = 'USER_INFO',

  POSTURE_FRONT = 'POSTURE_FRONT',
  POSTURE_SIDE = 'POSTURE_SIDE',
  BALANCE_TEST = 'BALANCE_TEST',
  ARM_RAISE_TEST = 'ARM_RAISE_TEST',
  FLEXIBILITY_TEST = 'FLEXIBILITY_TEST',
  STRENGTH_SQUAT = 'STRENGTH_SQUAT',
  STRENGTH_PUSHUP = 'STRENGTH_PUSHUP',
  BRAIN_REACTION = 'BRAIN_REACTION',

  BRAIN_MEMORY = 'BRAIN_MEMORY',
  FACE_ANALYSIS = 'FACE_ANALYSIS',
  SEVEN_CODE_CHECK = 'SEVEN_CODE_CHECK',
  READY_FOR_ANALYSIS = 'READY_FOR_ANALYSIS',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT',
  KFACE = 'KFACE',
  KTAROT = 'KTAROT'
}

export interface PhysiognomyMetrics {
  samjeong: { upper: number; middle: number; lower: number; };
  facialIndex: number;
  eyeDistanceRatio: number;
  noseWidthRatio: number;
  mouthWidthRatio: number;
  geometricRatio: number;
  
  // 동물상 정밀 매핑 4대 지표
  eyeSlant: number;       // 눈꼬리 기울기 (Degree)
  eyeRoundness: number;   // 눈 둥글기 (높이/너비)
  jawAngle: number;       // 턱선 각도 (Degree)
  cheekboneProminence: number; // 광대뼈 돌출도 (상대적 z-값 등)

  energyZones: { root: number; sacral: number; solarPlexus: number; heart: number; throat: number; thirdEye: number; crown: number; };
  brightness: number;
  blendshapes: Record<string, number>;
}

export interface PhysiognomyReport {
  userInfo?: UserInfo;
  summary: string;
  score: number;
  confidenceScore: number;
  samjeongAnalysis: string;
  personality: string;
  wealthAndCareer: string;
  animalMorphology: {
    type: string;
    englishType?: string;
    description?: string;
    detailedAnalysis: string;
    traits: string[];
    visualCharacteristics: string;
    geometricBasis: string;
    animalMorphologyBlend: { type: string; matchPercentage: number; characteristic: string; }[];
  };
  energy3Body7Code: {
    threeBodyAnalysis: string;
    sevenCodeDetailed: { name: string; region: string; bodyPart: string; state: 'Positive' | 'Negative' | 'Neutral'; interpretation: string; score: number; }[];
  };
  brightEnergy: { score: number; description: string; };
  traditionalAnalysis: { 
    forehead: string;
    eyebrows: string;
    eyes: string; 
    cheekbones: string;
    nose: string; 
    mouth: string; 
    jaw: string;
    ears: string;
    skin: string; 
  };
  lifeStrategy: { career: string; wealth: string; relationship?: string; };
  comprehensiveEvaluation: {
    health: string;
    wealthAndSuccess: string;
    loveAndRelationship: string;
    threeBodySynthesis: string; // 3바디 7코드 관점의 최종 마스터 총평
  };
  advice: string;
}

export interface UserInfo {
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  birthDate?: string; // 생년월일 추가
  isAgreed?: boolean; // 약관 동의 여부 추가
  phone?: string;
  resultDelivery?: 'none' | 'sms' | 'kakao';
  memberType: 'new' | 'existing';
  previousRecordId?: string;  // 재측정 시 이전 기록 ID
}

export interface PostureMetric {
  name: string;
  status: 'Good' | 'Fair' | 'Poor';
  description: string;
  score: number;
}

export interface StrengthMetric {
  exercise: string;
  reps: number;
  performance: string;
  formScore: number;
  recommendation: string;
}

export interface AgingMetric {
  testName: string;
  result: string;
  score: number;
  description?: string;
}

export interface BrainTrainingRecommendations {
  meditation: string;
  gymnastics: string;
  brainTraining: string;
}

export interface BrainTestData {
  reactionTimeMs?: number;   // 반응 테스트 반응 시간
  reactionScore?: number;    // 반응 테스트 점수
  reactionErrors?: number;   // 반응 테스트 에러 수
  crossAccuracy?: number;    // 교차 테스트 정확도
  crossAvgTimeMs?: number;   // 교차 테스트 평균 반응 시간
  memoryScore?: number;      // 암기 테스트 점수
  memorySpan?: number;       // (구) 동작 기억 최대 길이 (호환성)
  memoryCorrect?: number;    // 마트 장보기 기억 정답 수
  mathCorrect?: boolean;     // 가격 계산 정답 여부
  distractionCorrect?: number; // 사칙연산 트릭 정답 수 (0~2)
}

export interface BodyReport {
  id: string;
  date: string;
  userInfo: UserInfo;
  physicalAge: number;
  faceAgeEstimate: number;
  brainAge: number;          // optional 제거
  mindAge?: number;          // 마음(7코드) 나이 추가
  comprehensiveAge: number;  // 종합 건강 나이
  overallScore: number;
  bodyTypeAnalysis: string; // 추가: 전체 체형 형태학적 분석 (예: Sway Back 등)
  postureMetrics: PostureMetric[];
  strengthMetrics: StrengthMetric[];
  agingMetrics: AgingMetric[];
  faceAnalysis: {
    skinTone: string; // 추가: 피부 밝기 및 톤
    wrinkles: string;
    elasticity: string;
    summary: string;
    recommendation: string;
  };
  summary: string;
  brainHealthImplication: string;
  brainTestEvaluation?: string; // 추가: 뇌 테스트 상세 분석
  recommendations: BrainTrainingRecommendations;
  // 3BODY & 7CODE
  threeBodyAnalysis: {
    body: { score: number; description: string };
    mind: { score: number; description: string };
    brain: { score: number; description: string };
  };
  sevenCodeAnalysis: {
    code1: { score: number; label: string; description: string; evidence: string[] };
    code2: { score: number; label: string; description: string; evidence: string[] };
    code3: { score: number; label: string; description: string; evidence: string[] };
    code4: { score: number; label: string; description: string; evidence: string[] };
    code5: { score: number; label: string; description: string; evidence: string[] };
    code6: { score: number; label: string; description: string; evidence: string[] };
    code7: { score: number; label: string; description: string; evidence: string[] };
  };
  kwangmyungChakra: {
    needLevel: string;
    reason: string;
    expectedBenefit: string;
  };
  programRecommendation: {
    recommended: string;
    reason: string;
    duration: string;
  };
  energy3Body7Code?: {
    threeBodyAnalysis?: string;
    sevenCodeDetailed: { name: string; region: string; bodyPart: string; state: 'Positive' | 'Negative' | 'Neutral'; interpretation: string; score: number; }[];
  };
  bodyAlignmentAnalysis?: {
    issue: string;
    severity: string;
    measuredValue: string;
    normalRange: string;
    impact: string;
    recommendation?: string;
  }[];
  // 재측정 비교 분석 (이전 기록 대비)
  comparisonAnalysis?: {
    previousDate: string;
    overallChange: string;        // "개선" | "유지" | "악화"
    summary: string;              // 종합 비교 요약
    scoreChanges: {
      category: string;           // "자세", "유연성", "근력" 등
      previousScore: number;
      currentScore: number;
      change: number;             // +/- 값
      comment: string;
    }[];
    programEffect: string;        // 프로그램 효과 평가
  };
}

export interface CaseReport {
  clientProfile: string;      // 1. 내담자 핵심 프로파일
  complaint: string;          // 2. 호소문 & 니즈
  diagnosisSummary: string;   // 3. 진단 요약 (AI + 수정가능)
  causeAnalysis: string;      // 4. 핵심 원인 분석 (AI + 수정가능)
  interventionStrategy: string; // 5. 개입 전략 (AI + 수정가능)
  changeResults: string;      // 6. 변화 결과 (수동 작성, After 기록 기반)
  afterRecordId?: string;     // 매핑된 수련 후 기록 ID
  createdAt: string;
  updatedAt: string;
}

export interface CapturedImage {
  step: AssessmentStep;
  dataUrl: string;
  reps?: number;
  duration?: number;
  brainTestData?: BrainTestData;
  balanceData?: { footDrops: number; swayScore: number; eyesClosed: boolean; };
  formScore?: number;
  kneeAssisted?: boolean;
  sevenCodeKeywords?: string[]; // 사용자가 11단계에서 다중 선택한 7코드 키워드
  weakestCode?: number;         // 11단계에서 도출된 가장 약한 BHP 코드 (1~7)
  postureData?: any;
}

export interface MemberRecord {
  id: string;
  name: string;
  lastTestDate: string;
  report: BodyReport;
  images: CapturedImage[];
  ownerUid?: string; // 로컬 DB 사용 시 필수 아님
  sourceType?: 'PC' | 'LITE'; // 데이터 출처 구분 (PC 앱 또는 온라인 LITE)
  
  // 클라우드 동기화용 메타데이터 (선택적)
  branchId?: string;
  hardwareId?: string;
  regionId?: string;
  
  caseReport?: CaseReport; // 지점 관리자 작성용 사례보고서 데이터
}

/**
 * 진행 중인 측정 데이터를 IndexedDB에 임시 저장하는 인터페이스.
 * 각 단계 완료 시마다 업데이트되며, AI 분석 완료 후 삭제됩니다.
 * 앱 크래시/새로고침 시 이어하기에 사용됩니다.
 */
export interface PendingAssessment {
  id: string;                      // 'pending-{timestamp}'
  userName: string;
  userInfo: UserInfo;
  currentStep: AssessmentStep;     // 현재까지 완료된 마지막 단계
  capturedImages: CapturedImage[]; // 누적된 캡처 이미지 (400px 리사이즈)
  completedStepCount: number;      // 완료된 단계 수
  createdAt: string;               // 측정 시작 시각
  updatedAt: string;               // 마지막 업데이트 시각
}

// ─── 피드백 학습 시스템 타입 ────────────────────────────────────────────────
export interface DiagnosticFeedback {
  physicalRating?: 'very_satisfied' | 'satisfied' | 'normal' | 'dissatisfied' | 'very_dissatisfied';
  faceRating?: 'very_satisfied' | 'satisfied' | 'normal' | 'dissatisfied' | 'very_dissatisfied';
  brainRating?: 'very_satisfied' | 'satisfied' | 'normal' | 'dissatisfied' | 'very_dissatisfied';
  tarotRating?: 'very_satisfied' | 'satisfied' | 'normal' | 'dissatisfied' | 'very_dissatisfied';
  correctedOverallScore?: number;
  correctedPhysicalAge?: number;
  notes?: string;
  submittedAt: string;
}

export interface FeedbackRecord {
  id: string;
  createdAt: string;
  userInfo: Pick<UserInfo, 'age' | 'gender'>; // 익명화 (이름/연락처 제외)
  reportSnapshot?: {
    overallScore: number;
    physicalAge: number;
    summary: string;
    bodyTypeAnalysis: string;
    postureMetrics: PostureMetric[];
  };
  faceSnapshot?: {
    animalFace: string;
    metrics: any; // physiognomy metrics
    summary: string;
  };
  tarotSnapshot?: {
    concern: string;
    cards: { past: string; present: string; future: string };
    reportData: string;
  };
  feedback: DiagnosticFeedback;
  feedbackType: 'body' | 'face' | 'tarot'; // 피드백 유형 구분
}

export interface BranchAuth {
  branchName: string;
  adminName: string;
  contact: string;
  installer: string;
  authCode: string; // 지점 인증 코드 (본사 배포)
  verifiedAt: string;
  machineId?: string; // 통계 카운트를 위한 고유 문서 ID
  hardwareId?: string; // 불법 복제 방지를 위한 물리적 보드 UUID
  lastVerifiedAt?: string; // 마지막 서버 검증 성공 시각 (ISO 8601) — 오프라인 grace period 판단용
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getApiKey: () => Promise<string>;
      setApiKey: (key: string) => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      saveAuthToken: (token: any) => Promise<boolean>;
      loadAuthToken: () => Promise<any>;
      clearAuthToken: () => Promise<boolean>;
      saveMemberRecord: (record: MemberRecord) => Promise<boolean>;
      getMemberRecords: () => Promise<MemberRecord[]>;
      deleteMemberRecord: (id: string) => Promise<boolean>;
      importV3Database: () => Promise<MemberRecord[]>;
      saveFeedbackRecords: (records: FeedbackRecord[]) => Promise<boolean>;
      getFeedbackRecords: () => Promise<FeedbackRecord[]>;
      getHardwareId: () => Promise<string>;
      checkForUpdates?: () => Promise<boolean>;
      downloadUpdate?: () => Promise<boolean>;
      installUpdate?: () => Promise<boolean>;
      onUpdaterMessage?: (callback: (message: string) => void) => () => void;
      onUpdaterProgress?: (callback: (progress: any) => void) => () => void;
    };
  }
}

// ==========================================
// K-Tarot (천부경 타로) 관련 타입 정의
// ==========================================

export interface CheonbugyeongCharacter {
  char: string;
  reading: string;
  meaning: string;
  imageUrl?: string;
}

export interface TarotMaster {
  id: string;
  name: string;
  age: string;
  title: string;
  description: string;
  prompt: string;
}
