import { BodyReport, CapturedImage, UserInfo, MemberRecord, CheonbugyeongCharacter } from "../types";
import { getRecordsLocally } from "./localDb";
import { apiPost } from "./apiClient";

// --- API Key 관리 (SettingsModal에서 사용) ---
let customApiKey: string = localStorage.getItem('bt_custom_api_key_lite') || '';

export const getActiveApiKey = (): string => {
  return customApiKey || 'VercelProxy';
};

export const setCustomApiKey = (key: string): void => {
  customApiKey = key;
  if (key) {
    localStorage.setItem('bt_custom_api_key_lite', key);
  } else {
    localStorage.removeItem('bt_custom_api_key_lite');
  }
};

export const isUsingCustomKey = (): boolean => {
  return !!customApiKey;
};

// --- 핵심 AI 건강 분석 함수 ---
export const analyzeHealth = async (userInfo: UserInfo, images: CapturedImage[]): Promise<BodyReport> => {
  // R1: 점수 공식·프롬프트·병합은 서버(/api/analyze 의 v3 브랜치)로 이전됨. 클라는 원시 입력만 전송한다.
  // v3(PC 원본) 브랜치를 명시적으로 요청 → 서버가 원본과 byte-identical 점수/나이를 산출한다.
  // 이전 기록 비교용 previousReport는 클라가 로컬 병합 뷰(getRecordsLocally, 브라우저 전용)에서
  // 해석해 함께 보낸다 — 원본 동작(549-562) 보존.
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

  return await apiPost<BodyReport>('/api/analyze', { userInfo, images, previousReport, analysisVersion: 'v3' });
};

export async function analyzePhysiognomy(
  metrics: any,
  profile?: { displayName?: string; birthDate?: string; gender?: string; age?: number } | null
): Promise<any> {
  // R1: 관상 분석(물형관상 룰셋 프롬프트 + few-shot + Gemini 호출)을 서버로 이전. 클라는 metrics + profile만 전송.
  // 프롬프트/룰셋/호출 로직은 라이트 api/_physiognomy-core.ts + api/analyze-physiognomy.ts에 있음(IP 서버 은닉).
  return await apiPost('/api/analyze-physiognomy', { metrics, profile: profile ?? null });
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
  // R1: 타로 해석(마스터 페르소나 + 프롬프트 + few-shot + Gemini 호출)을 서버로 이전. 클라는 원시입력만 전송한다.
  // 페르소나·프롬프트·호출 로직은 라이트 api/_tarot-core.ts + api/analyze-tarot.ts에 있음(IP 서버 은닉).
  // few-shot도 서버 _analyze-fewshot가 수행 → 클라 findSimilarTarotCases/buildTarotFewShotPrompt는 이 경로에선 죽은 코드.
  return await apiPost<string>('/api/analyze-tarot', { concern, name, age, gender, past, present, future, masterId });
};

// --- IBEL 사례보고서 초안 생성 (관리자 전용) ---
export const generateCaseReportDraft = async (
  record: MemberRecord,
  complaint: string
): Promise<{ diagnosisSummary: string; causeAnalysis: string; interventionStrategy: string }> => {
  // R1: 사례보고서 초안(IBEL) 생성을 서버 /api/casereport로 이전. 프롬프트는 서버 은닉.
  // 클라는 회원 record + 호소문만 전송(용량 방지 위해 이미지 제거). 서버가 record.report 수치로 프롬프트를 조립.
  const pureRecord = JSON.parse(JSON.stringify(record));
  delete (pureRecord as any).images;
  return await apiPost('/api/casereport', { record: pureRecord, complaint });
};
