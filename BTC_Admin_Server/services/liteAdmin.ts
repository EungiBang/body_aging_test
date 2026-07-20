// 관리자 기능 봉합선(어댑터). Outdoor Lite의 services/liteAdmin.ts 패턴을 관리자 앱에 이식.
// 목적: AdminDashboard 가 쓰던 클라 직접 Firestore 접근(services/firebaseAuthService.ts)을
//       role=admin 서버 엔드포인트 호출로 옮긴다. 함수 시그니처는 원본과 동일하게 맞춰,
//       AdminDashboard 는 import 출처만 바꾸면 되고 호출부/표시 코드는 그대로 둔다.
// 비개발자 파일 services/firebaseAuthService.ts 는 건드리지 않는다(충돌 방지). 타입은 그 파일이 원본.
//   P1: adminLogin(서버 검증형).  P2a: devices / admin-config / admin-users 클러스터 이관.
//   나머지(members/stats/usage/events/errorlog/feedbacks)는 P2b~P2c에서 이 파일에 추가한다.
import { signInWithCustomToken, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { auth } from '../firebase';
import { apiPost } from './apiClient';
import type { Region, Branch, DeviceLicense, AdminUser } from './firebaseAuthService';
import type { MemberRecord } from '../types';
import type { ErrorLog } from './ErrorLogger';

// ── 타임스탬프 복원 ────────────────────────────────────────────────
// 서버(admin SDK)의 Firestore Timestamp 는 JSON 으로 {_seconds,_nanoseconds} 형태로 내려온다.
// AdminDashboard 는 .toMillis()/.toDate() 를 기대하므로, 그 형태로 감싼 shim 을 돌려준다.
function reviveTimestamp(t: any): any {
  if (!t || typeof t !== 'object') return t;
  const s = typeof t._seconds === 'number' ? t._seconds : (typeof t.seconds === 'number' ? t.seconds : undefined);
  if (typeof s !== 'number') return t;
  const ns = typeof t._nanoseconds === 'number' ? t._nanoseconds : (typeof t.nanoseconds === 'number' ? t.nanoseconds : 0);
  const ms = s * 1000 + Math.floor(ns / 1e6);
  return { toMillis: () => ms, toDate: () => new Date(ms), seconds: s };
}

// ── 기기 관리 (/api/devices) ──────────────────────────────────────
export const getAllDevices = async (): Promise<DeviceLicense[]> => {
  const { devices } = await apiPost<{ devices: any[] }>('/api/devices', { action: 'list' });
  return (devices || []).map((d) => ({
    ...d,
    createdAt: reviveTimestamp(d.createdAt),
    lastActive: reviveTimestamp(d.lastActive),
  })) as DeviceLicense[];
};

export const updateDeviceStatus = async (hardwareId: string, status: 'active' | 'pending' | 'revoked', deviceType: 'pc' | 'lite' = 'lite') => {
  await apiPost('/api/devices', { action: 'updateStatus', hardwareId, status, deviceType });
};

export const deleteDevice = async (hardwareId: string, deviceType: 'pc' | 'lite' = 'lite') => {
  await apiPost('/api/devices', { action: 'delete', hardwareId, deviceType });
};

// ── 지역/지점 + 시스템 설정 (/api/admin-config) ───────────────────
export const getRegions = async (): Promise<Region[]> => {
  const { regions } = await apiPost<{ regions: Region[] }>('/api/admin-config', { action: 'listRegions' });
  return regions || [];
};

export const getBranches = async (regionId?: string): Promise<Branch[]> => {
  const { branches } = await apiPost<{ branches: Branch[] }>('/api/admin-config', { action: 'listBranches', regionId });
  return branches || [];
};

export const saveRegion = async (region: Omit<Region, 'id'> & { id?: string }) => {
  await apiPost('/api/admin-config', { action: 'saveRegion', region });
};

export const deleteRegion = async (regionId: string) => {
  await apiPost('/api/admin-config', { action: 'deleteRegion', regionId });
};

export const saveBranch = async (branch: Omit<Branch, 'id'> & { id?: string }) => {
  await apiPost('/api/admin-config', { action: 'saveBranch', branch });
};

export const deleteBranch = async (branchId: string) => {
  await apiPost('/api/admin-config', { action: 'deleteBranch', branchId });
};

export const getSystemSettings = async (): Promise<{ autoApproveCode?: string; liteAutoApproveCode?: string; tempLiteAutoApproveCode?: string; tempLiteCodeExpiredAt?: string }> => {
  return apiPost('/api/admin-config', { action: 'getSettings' });
};

export const updateSystemSettings = async (
  autoApproveCode: string,
  liteAutoApproveCode?: string,
  tempLiteAutoApproveCode?: string,
  tempLiteCodeExpiredAt?: string,
) => {
  await apiPost('/api/admin-config', { action: 'updateSettings', autoApproveCode, liteAutoApproveCode, tempLiteAutoApproveCode, tempLiteCodeExpiredAt });
};

// ── 관리자 계정 (/api/admin-users) ────────────────────────────────
// 서버는 비밀번호 해시를 제외하고 내려준다(_admin-users-core.listAdminUsers). createdAt 은 shim 복원.
export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const { admins } = await apiPost<{ admins: any[] }>('/api/admin-users', { action: 'list' });
  return (admins || []).map((a) => ({ ...a, createdAt: reviveTimestamp(a.createdAt) })) as AdminUser[];
};

export const saveAdminUser = async (user: Omit<AdminUser, 'createdAt'> & { password: string }) => {
  await apiPost('/api/admin-users', { action: 'save', user });
};

export const deleteAdminUser = async (userId: string) => {
  await apiPost('/api/admin-users', { action: 'delete', userId });
};

// 비밀번호 변경: 원본은 실패 시 throw 하지 않고 {success:false,error} 를 돌려준다.
// 엔드포인트는 검증 실패에 400+{success:false,error} 를 주므로, apiPost 가 던진 400 을 잡아 본문을 복원한다.
export const changeAdminPassword = async (userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
  try {
    return await apiPost('/api/admin-users', { action: 'changePassword', userId, currentPassword, newPassword });
  } catch (e: any) {
    if (e && e.status === 400 && e.body && typeof e.body.success === 'boolean') return e.body;
    throw e;
  }
};

// ── 지점 사용량 / 일일 한도 (/api/usage) ──────────────────────────
// 원본 usageLimitService.getUsageStatus/updateDailyLimit 를 서버 경유로 대체.
// getUsageStatus 는 원본 시그니처(branchId 하나)를 유지하되, 날짜(today)는 여기서
// 브라우저 로컬시간으로 계산해 서버에 넘긴다(원본 getTodayString 동작 보존).
const getTodayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getUsageStatus = async (branchId: string): Promise<{ kfaceLimit: number; kfaceUsed: number; ktarotLimit: number; ktarotUsed: number }> => {
  if (!branchId) return { kfaceLimit: 30, kfaceUsed: 0, ktarotLimit: 30, ktarotUsed: 0 };
  try {
    return await apiPost('/api/usage', { action: 'getStatus', branchId, today: getTodayString() });
  } catch {
    // 원본은 실패 시 기본값을 돌려준다(오프라인 등) — 동작 보존.
    return { kfaceLimit: 30, kfaceUsed: 0, ktarotLimit: 30, ktarotUsed: 0 };
  }
};

export const updateDailyLimit = async (branchId: string, kfaceLimit: number, ktarotLimit: number): Promise<void> => {
  if (!branchId) return;
  await apiPost('/api/usage', { action: 'updateLimit', branchId, kfaceLimit, ktarotLimit });
};

// ── 대시보드 통계 (/api/stats) ────────────────────────────────────
// 원본 statsService.getDashboardStats 대체. 실패 시 빈 통계(원본 catch 동작 보존).
export const getDashboardStats = async (): Promise<{ dailyStats: any[]; branchStats: any[] }> => {
  try {
    return await apiPost('/api/stats', { action: 'getDashboardStats' });
  } catch {
    return { dailyStats: [], branchStats: [] };
  }
};

// ── 회원 (members_v4) (/api/admin-members · /api/sync) ─────────────
// 원본 cloudSyncService.fetchAllMembers/fetchMembersFromCloud/deleteMemberFromCloud 대체.
// fetchAllMembers: 서버가 커서 페이지네이션으로 반환 → 여기서 nextCursor 순회로 전체를 누적한 뒤
//                  원본과 동일하게 최신순(lastTestDate || report.date) 정렬. 실패 시 [](원본 동작 보존).
export const fetchAllMembers = async (): Promise<MemberRecord[]> => {
  try {
    const all: any[] = [];
    let cursor: string | null = null;
    // 안전 상한: 무한 루프 방지 (1000 * 400 = 40만건까지). 목록은 서버가 slim 프로젝션으로 내려줌.
    for (let i = 0; i < 400; i++) {
      const page = await apiPost<{ members: any[]; nextCursor: string | null }>(
        '/api/admin-members', { action: 'list', cursor, limit: 1000 }
      );
      all.push(...(page.members || []));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    all.sort((a, b) => {
      const da = a.lastTestDate || a.report?.date || '';
      const db2 = b.lastTestDate || b.report?.date || '';
      return db2.localeCompare(da);
    });
    return all as MemberRecord[];
  } catch {
    return [];
  }
};

export const fetchMembersFromCloud = async (branchId: string): Promise<MemberRecord[]> => {
  try {
    const { members } = await apiPost<{ members: any[] }>('/api/sync', { action: 'fetchMembersByBranch', branchId });
    return (members || []) as MemberRecord[];
  } catch {
    return [];
  }
};

export const deleteMemberFromCloud = async (memberId: string): Promise<boolean> => {
  try {
    await apiPost('/api/sync', { action: 'deleteMember', memberId });
    return true;
  } catch {
    return false;
  }
};

// 단건 전체 조회(상세 모달용). 목록은 slim이라 report 무거운 필드가 없어, 행 클릭 시 이걸로 전체를 당긴다.
export const getMemberDetail = async (memberId: string): Promise<MemberRecord | null> => {
  try {
    const { member } = await apiPost<{ member: any }>('/api/admin-members', { action: 'get', id: memberId });
    return (member || null) as MemberRecord | null;
  } catch {
    return null;
  }
};

// 엑셀 내보내기용 전량 조회: 서버가 엑셀 필드만 프로젝션해 페이지로 내려주고 여기서 이어붙인다.
// 상시 로딩이 아니라 '엑셀 버튼'을 누를 때만 호출(무거운 sevenCode·측정데이터·이미지는 서버가 제외).
export const fetchMembersForExcel = async (): Promise<MemberRecord[]> => {
  try {
    const all: any[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 400; i++) {
      const page = await apiPost<{ members: any[]; nextCursor: string | null }>(
        '/api/admin-members', { action: 'list', cursor, limit: 1000, projection: 'excel' }
      );
      all.push(...(page.members || []));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return all as MemberRecord[];
  } catch {
    return [];
  }
};

// ── 에러 로그 (/api/admin-errorlog) ───────────────────────────────
// 원본 AdminErrorMonitor의 클라 직접 onSnapshot(error_logs) + updateDoc(상태변경)을 서버 경유로 대체.
// 실시간 구독 → 폴링으로 전환(AdminErrorMonitor가 주기 호출). timestamp는 shim 복원(.toDate() 기대).
export const listErrorLogs = async (): Promise<ErrorLog[]> => {
  const { logs } = await apiPost<{ logs: any[] }>('/api/admin-errorlog', { action: 'list' });
  return (logs || []).map((l) => ({ ...l, timestamp: reviveTimestamp(l.timestamp) })) as ErrorLog[];
};

export const setErrorLogStatus = async (id: string, status: 'new' | 'viewed' | 'resolved'): Promise<void> => {
  await apiPost('/api/admin-errorlog', { action: 'updateStatus', id, status });
};

// ── 연합 행사 전체 조회 (/api/admin-events) ───────────────────────
// 원본 cloudSyncService.fetchAllEvents 대체. 실패 시 [](원본 catch 동작 보존). createdAt은 숫자라 shim 불필요.
export const fetchAllEvents = async (): Promise<any[]> => {
  try {
    const { events } = await apiPost<{ events: any[] }>('/api/admin-events', { action: 'list' });
    return events || [];
  } catch {
    return [];
  }
};

// ── AI 피드백 전체 조회 (/api/admin-feedbacks, G1) ────────────────
// 원본 firebaseAuthService.getAllFeedbacks 대체. 실패 시 [](원본 catch 동작 보존).
// createdAt/syncedAt은 문자열(ISO)일 수도 Timestamp일 수도 있어 방어적으로 shim 복원(문자열이면 그대로 반환).
export const getAllFeedbacks = async (): Promise<any[]> => {
  try {
    const { feedbacks } = await apiPost<{ feedbacks: any[] }>('/api/admin-feedbacks', { action: 'list' });
    return (feedbacks || []).map((f) => ({
      ...f,
      createdAt: reviveTimestamp(f.createdAt),
      syncedAt: reviveTimestamp(f.syncedAt),
    }));
  } catch {
    return [];
  }
};

// ── 관리자 로그인 (/api/admin-login) — 서버 검증형 출입증 발급 ─────
// 원본 adminLogin(클라 해시 비교)을 대체한다: 서버가 admin_users 해시를 검증한 뒤 role=admin
// 커스텀 토큰(교환권)을 발급하고, 그 토큰으로 signInWithCustomToken 해서 ID 토큰(출입증)을 얻는다.
// 이후 모든 관리자 api 호출에 ID 토큰이 자동 첨부된다(apiClient).
// 세션은 inMemoryPersistence — 새로고침/재접속 시 재로그인(원본 useState(false) 동작 보존).
// 반환: 성공 시 AdminUser, 자격 불일치 시 null(원본과 동일 계약). 서버 오류는 throw.
export const adminLogin = async (userId: string, passwordInput: string): Promise<AdminUser | null> => {
  const res = await fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, password: passwordInput }),
  });
  if (res.status === 401) return null; // 자격 불일치
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.token) {
    throw new Error(data.error || `로그인 실패 (${res.status})`);
  }
  await setPersistence(auth, inMemoryPersistence);
  await signInWithCustomToken(auth, data.token);
  return { id: userId, name: data.name, role: (data.adminRole as 'master' | 'manager'), createdAt: null };
};
