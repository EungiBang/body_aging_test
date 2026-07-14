// 원본(Electron PC) 기기 인증 봉합선 (신원 해석 격리).
// 기존 services/firebaseAuthService.ts 의 checkDeviceStatus(브라우저가 Firestore 직접 조회)를 대체:
//   서버 /api/device-login 으로 상태 확인 → active면 커스텀 토큰으로 Firebase 로그인 →
//   이후 모든 api 호출에 ID 토큰이 자동 첨부(services/apiClient.ts). 비개발자 파일은 건드리지 않는다.
// 라이트 services/liteAuth.ts 와 같은 역할·패턴.
import { signInWithCustomToken, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { apiPost } from './apiClient';

export type DeviceStatus = 'active' | 'pending' | 'revoked' | 'unregistered';

interface DeviceLoginResponse {
  status: DeviceStatus;
  token?: string;
  branchId?: string;
}

// 시작 시 기기 상태 확인 + (active면) 로그인. 반환한 status로 App이 화면을 가른다.
export async function checkDeviceAndSignIn(
  hardwareId: string,
  appVersion?: string,
): Promise<{ status: DeviceStatus; branchId?: string }> {
  const res = await apiPost<DeviceLoginResponse>('/api/device-login', { hardwareId, appVersion });
  if (res.status === 'active' && res.token) {
    await signInWithCustomToken(auth, res.token);
    // 앱 전역이 branchId·기기ID 컨텍스트로 소비하는 currentDevice 캐시(기존 소비처와 동일 형태).
    localStorage.setItem('currentDevice', JSON.stringify({
      id: hardwareId,
      branchId: res.branchId || '',
      status: 'active',
      appVersion: appVersion || 'unknown',
    }));
    return { status: 'active', branchId: res.branchId };
  }
  return { status: res.status };
}

// 현재 로그인 사용자 구독 헬퍼(필요 시). user!=null 이면 인증됨.
export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

// 강제 로그아웃(세션 정리). 서버가 기기 해지(device_inactive 등)를 403으로 통지했을 때 App이 호출한다.
// signOut으로 영속 세션을 지운다. 재시작 시엔 어차피 device-login이 revoked를 반환해 입구에서 막힌다.
export async function signOutDevice(): Promise<void> {
  try { await signOut(auth); } catch { /* best-effort */ }
}
