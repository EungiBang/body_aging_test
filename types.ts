
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
  FACE_ANALYSIS = 'FACE_ANALYSIS',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT'
}

export interface UserInfo {
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
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
}

export interface BrainTrainingRecommendations {
  meditation: string;
  gymnastics: string;
  brainTraining: string;
}

export interface BodyReport {
  id: string;
  date: string;
  userInfo: UserInfo;
  physicalAge: number;
  faceAgeEstimate: number;
  overallScore: number;
  postureMetrics: PostureMetric[];
  strengthMetrics: StrengthMetric[];
  agingMetrics: AgingMetric[];
  faceAnalysis: {
    wrinkles: string;
    elasticity: string;
    summary: string;
  };
  summary: string;
  brainHealthImplication: string;
  recommendations: BrainTrainingRecommendations;
}

export interface CapturedImage {
  step: AssessmentStep;
  dataUrl: string;
  reps?: number;
  duration?: number;
}

export interface MemberRecord {
  id: string;
  name: string;
  lastTestDate: string;
  report: BodyReport;
  images: CapturedImage[];
}
