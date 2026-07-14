// R2: 사용량/한도 접근을 서버 /api/usage 뒤로 이관. 브라우저 Firestore 직결 제거.
// 서버가 인증 관문(F2)에서 지점 소유권을 강제하고, updateLimit은 관리자(role=admin) 전용.
// 오프라인/네트워크 실패 시 기존처럼 안전 기본값(0)으로 폴백 — 측정 흐름을 막지 않는다.
// 시그니처는 그대로 유지 → 소비처(KFaceApp/KTarotApp/SettingsModal) 무수정.
import { apiPost } from './apiClient';

export interface UsageStatus {
  kfaceLimit: number;
  kfaceUsed: number;
  ktarotLimit: number;
  ktarotUsed: number;
}

const getTodayString = () => {
  // 브라우저 로컬 시간 기준 YYYY-MM-DD (서버가 이 값으로 daily_usages 키를 만든다 — 기존 로컬시간 기준 보존)
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getUsageStatus = async (branchId: string): Promise<UsageStatus> => {
  if (!branchId) {
    return { kfaceLimit: 0, kfaceUsed: 0, ktarotLimit: 0, ktarotUsed: 0 };
  }

  try {
    return await apiPost<UsageStatus>('/api/usage', {
      action: 'getStatus',
      branchId,
      today: getTodayString(),
    });
  } catch (error) {
    console.warn('사용량 정보를 가져오는데 실패했습니다 (오프라인 등). 기본값을 사용합니다.', error);
    return { kfaceLimit: 0, kfaceUsed: 0, ktarotLimit: 0, ktarotUsed: 0 };
  }
};

export const incrementUsage = async (branchId: string, type: 'kface' | 'ktarot'): Promise<void> => {
  if (!branchId) return;

  try {
    await apiPost('/api/usage', {
      action: 'increment',
      branchId,
      type,
      today: getTodayString(),
    });
  } catch (error) {
    console.warn('사용량 증가에 실패했습니다:', error);
  }
};

export const updateDailyLimit = async (branchId: string, kfaceLimit: number, ktarotLimit: number): Promise<void> => {
  if (!branchId) return;
  await apiPost('/api/usage', {
    action: 'updateLimit',
    branchId,
    kfaceLimit,
    ktarotLimit,
  });
};
