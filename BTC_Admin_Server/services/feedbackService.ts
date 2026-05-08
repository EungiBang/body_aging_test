/**
 * feedbackService.ts
 * 분석 피드백 데이터 저장/로드/검색 + Few-Shot 프롬프트 생성
 *
 * 저장 우선순위:
 *   Electron 환경 → IPC → feedback-db.json (userData 디렉토리)
 *   브라우저(개발) 환경 → localStorage ('btc-feedback-db')
 */

import { FeedbackRecord, DiagnosticFeedback, BodyReport, UserInfo } from '../types';

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

const generateId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
};

// ─── 저장/로드 (환경별 분기) ──────────────────────────────────────────────────

const LOCALSTORAGE_KEY = 'btc-feedback-db';

const loadAllFeedbacks = async (): Promise<FeedbackRecord[]> => {
  try {
    // Electron IPC
    if (window.electronAPI?.getFeedbackRecords) {
      const records = await window.electronAPI.getFeedbackRecords();
      return Array.isArray(records) ? records : [];
    }
  } catch {}
  // 웹/개발 환경 폴백: localStorage
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveAllFeedbacks = async (records: FeedbackRecord[]): Promise<void> => {
  try {
    if (window.electronAPI?.saveFeedbackRecords) {
      await window.electronAPI.saveFeedbackRecords(records);
      return;
    }
  } catch {}
  // 웹/개발 환경 폴백
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('[feedbackService] localStorage 저장 실패:', e);
  }
};

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 새 피드백 저장
 */
export const saveFeedback = async (
  report: BodyReport,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo: {
      age: report.userInfo.age,
      gender: report.userInfo.gender,
    },
    reportSnapshot: {
      overallScore: report.overallScore,
      physicalAge: report.physicalAge,
      summary: report.summary,
      bodyTypeAnalysis: report.bodyTypeAnalysis || '',
      postureMetrics: report.postureMetrics || [],
    },
    feedback,
    feedbackType: 'body',
  };

  const existing = await loadAllFeedbacks();
  // 최대 200건 유지 (오래된 것부터 삭제)
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);
};

/**
 * 전체 피드백 목록 반환
 */
export const getFeedbacks = async (): Promise<FeedbackRecord[]> => {
  return loadAllFeedbacks();
};

/**
 * 유사 사례 검색 (나이 ±10세 AND 동일 성별 AND 만족도 높음)
 * positive 피드백(정확한 분석)만 Few-Shot 대상으로 사용
 */
export const findSimilarCases = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  topN = 3
): Promise<FeedbackRecord[]> => {
  const all = await loadAllFeedbacks();
  return all
    .filter(
      (r) =>
        r.feedbackType === 'body' &&
        r.userInfo.gender === userInfo.gender &&
        Math.abs(r.userInfo.age - userInfo.age) <= 10 &&
        (r.feedback.physicalRating === 'very_satisfied' || r.feedback.physicalRating === 'satisfied')
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, topN);
};

export const findSimilarFaceCases = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  topN = 3
): Promise<FeedbackRecord[]> => {
  const all = await loadAllFeedbacks();
  return all
    .filter(
      (r) =>
        r.feedbackType === 'face' &&
        r.userInfo.gender === userInfo.gender &&
        (r.feedback.faceRating === 'very_satisfied' || r.feedback.faceRating === 'satisfied')
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, topN);
};

export const findSimilarTarotCases = async (
  topN = 3
): Promise<FeedbackRecord[]> => {
  const all = await loadAllFeedbacks();
  return all
    .filter(
      (r) =>
        r.feedbackType === 'tarot' &&
        (r.feedback.tarotRating === 'very_satisfied' || r.feedback.tarotRating === 'satisfied')
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, topN);
};

export const saveFaceFeedback = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  faceSnapshot: NonNullable<FeedbackRecord['faceSnapshot']>,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo,
    faceSnapshot,
    feedback,
    feedbackType: 'face',
  };
  const existing = await loadAllFeedbacks();
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);
};

export const saveTarotFeedback = async (
  userInfo: Pick<UserInfo, 'age' | 'gender'>,
  tarotSnapshot: NonNullable<FeedbackRecord['tarotSnapshot']>,
  feedback: DiagnosticFeedback
): Promise<void> => {
  const record: FeedbackRecord = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    userInfo,
    tarotSnapshot,
    feedback,
    feedbackType: 'tarot',
  };
  const existing = await loadAllFeedbacks();
  const trimmed = [record, ...existing].slice(0, 200);
  await saveAllFeedbacks(trimmed);
};

/**
 * Few-Shot 프롬프트 문자열 생성
 * geminiService.ts의 analyzeHealth 프롬프트 앞에 삽입됩니다.
 */
export const buildFewShotPrompt = (cases: FeedbackRecord[]): string => {
  if (cases.length === 0) return '';

  const lines: string[] = [
    '■ 과거 유사 사례 참고 (Few-Shot Learning)',
    '아래는 실제 분석에서 관리자가 "만족" 이상으로 평가한 사례들입니다.',
    '이 사례들을 참고하여 일관된 기준으로 점수를 산출하세요.',
    '',
  ];

  cases.forEach((c, i) => {
    lines.push(`[참고 사례 ${i + 1}]`);
    lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
    lines.push(`  - 체형 분석: ${c.reportSnapshot.bodyTypeAnalysis || '기록 없음'}`);
    lines.push(`  - 자세 항목 점수: ${c.reportSnapshot.postureMetrics.map(m => `${m.name}=${m.score}`).join(', ')}`);
    lines.push(`  - 확정 신체 나이: ${c.reportSnapshot.physicalAge}세 / 확정 종합 점수: ${c.reportSnapshot.overallScore}점`);
    if (c.feedback.notes) {
      lines.push(`  - 관리자 메모: ${c.feedback.notes}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

export const buildFaceFewShotPrompt = (cases: FeedbackRecord[]): string => {
  if (cases.length === 0) return '';
  const lines: string[] = [
    '■ 과거 K-관상 분석에서 매우 높은 정확도를 보인 사례 (Few-Shot Learning)',
    '이 사례들을 참고하여 일관되고 통찰력 있는 관상 분석을 진행하십시오.',
    '',
  ];
  cases.forEach((c, i) => {
    if (!c.faceSnapshot) return;
    lines.push(`[참고 사례 ${i + 1}]`);
    lines.push(`  - 성별: ${c.userInfo.gender === 'male' ? '남성' : '여성'}, 나이: ${c.userInfo.age}세`);
    lines.push(`  - 도출된 동물상: ${c.faceSnapshot.animalFace}`);
    lines.push(`  - 핵심 요약: ${c.faceSnapshot.summary}`);
    if (c.feedback.notes) lines.push(`  - 관리자 메모: ${c.feedback.notes}`);
    lines.push('');
  });
  return lines.join('\n');
};

export const buildTarotFewShotPrompt = (cases: FeedbackRecord[]): string => {
  if (cases.length === 0) return '';
  const lines: string[] = [
    '■ 과거 천부경 타로 해석에서 높은 만족도를 보인 사례 (Few-Shot Learning)',
    '아래 사례들의 해석 패턴, 어조, 통찰력을 참고하여 이번 분석을 진행하십시오.',
    '',
  ];
  cases.forEach((c, i) => {
    if (!c.tarotSnapshot) return;
    lines.push(`[참고 사례 ${i + 1}]`);
    lines.push(`  - 내담자 고민: "${c.tarotSnapshot.concern}"`);
    lines.push(`  - 뽑힌 카드 (과거/현재/미래): ${c.tarotSnapshot.cards.past} / ${c.tarotSnapshot.cards.present} / ${c.tarotSnapshot.cards.future}`);
    if (c.feedback.notes) lines.push(`  - 관리자 메모: ${c.feedback.notes}`);
    lines.push('');
  });
  return lines.join('\n');
};

/**
 * 피드백 통계 (HistoryManager 등에서 활용 가능)
 */
export const getFeedbackStats = async (): Promise<{
  total: number;
  satisfied: number;
  dissatisfied: number;
}> => {
  const all = await loadAllFeedbacks();
  return {
    total: all.length,
    satisfied: all.filter((r) => r.feedback.physicalRating === 'very_satisfied' || r.feedback.physicalRating === 'satisfied').length,
    dissatisfied: all.filter((r) => r.feedback.physicalRating === 'very_dissatisfied' || r.feedback.physicalRating === 'dissatisfied').length,
  };
};
