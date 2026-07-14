// R2: 사용량 통계 접근을 서버 /api/stats 뒤로 이관. 브라우저 Firestore 직결 제거.
// 서버가 인증 관문(F2)에서 소유권을 강제(기기는 자기 지점/자기 기기, getDashboardStats는 관리자 전용).
// 시그니처는 그대로 유지 → 소비처(AssessmentFlow 등) 무수정. logUsage는 기존처럼 best-effort.
import { apiPost } from './apiClient';

// YYYYMMDD (브라우저 로컬시간) — 서버가 이 값으로 stats/daily_ 키를 만든다(기존 로컬시간 기준 보존).
const getDateStr = () => {
  const today = new Date();
  return `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
};

/**
 * 리포트가 생성될 때 통계를 증가시킵니다. (best-effort — 실패해도 측정 흐름을 막지 않음)
 */
export const logUsage = async (branchId: string, hardwareId: string) => {
  try {
    await apiPost('/api/stats', {
      action: 'logUsage',
      branchId,
      hardwareId,
      dateStr: getDateStr(),
    });
  } catch (e) {
    console.error('Failed to log usage stats', e);
  }
};

/**
 * 대시보드 표시용 전체 통계 수집 (관리자 전용 — 전 지점 집계).
 * dailyStats: 최근 14일 일별 측정량, branchStats: 지점별 누적 사용량 (전체)
 */
export const getDashboardStats = async () => {
  try {
    return await apiPost<{ dailyStats: any[]; branchStats: any[] }>('/api/stats', {
      action: 'getDashboardStats',
    });
  } catch (e) {
    console.error('Failed to get dashboard stats', e);
    return { dailyStats: [], branchStats: [] };
  }
};
