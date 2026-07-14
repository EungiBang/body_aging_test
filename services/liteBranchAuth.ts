// 원본(Electron PC) 등록화면 봉합선 (신원 해석 격리).
// 기존 services/firebaseAuthService.ts 의 getRegions/getBranches/requestDeviceRegistration
// (브라우저가 Firestore 직접 조회·쓰기)을 대체:
//   - 지역/지점 목록 → 서버 /api/bootstrap (무인증 공개 조회)
//   - 기기 등록 → 서버 /api/register (deviceType:'pc') → 배포코드·허용대수 검증을 서버가 수행,
//     통과 시 커스텀 토큰 발급 → Firebase 로그인 + currentDevice 캐시.
// BranchAuthScreen.tsx 가 쓰는 시그니처를 그대로 유지한다. 비개발자 파일은 건드리지 않는다.
// 라이트 services/liteAuth.ts 와 같은 역할·패턴.
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebase';
import { apiGet, apiPost } from './apiClient';

export interface Region {
  id: string;
  name: string;
  order: number;
}

export interface Branch {
  id: string;
  regionId: string;
  name: string;
  allowedLicenses?: number;
  kfaceDailyLimit?: number;
  ktarotDailyLimit?: number;
}

interface BootstrapData {
  regions: Region[];
  branches: Branch[];
}

// 부트스트랩(지역/지점)은 등록화면 진입 시 getRegions·getBranches가 Promise.all로 함께 호출된다.
// 한 번만 받아 캐시해 중복 요청을 막는다.
let bootstrapPromise: Promise<BootstrapData> | null = null;
function loadBootstrap(): Promise<BootstrapData> {
  if (!bootstrapPromise) {
    bootstrapPromise = apiGet<BootstrapData>('/api/bootstrap').catch((e) => {
      bootstrapPromise = null; // 실패 시 다음 호출에서 재시도 가능하도록
      throw e;
    });
  }
  return bootstrapPromise;
}

// 지역 목록 (order 오름차순) — firebaseAuthService.getRegions 와 동일 시그니처.
export async function getRegions(): Promise<Region[]> {
  const { regions } = await loadBootstrap();
  return [...regions].sort((a, b) => (a.order || 0) - (b.order || 0));
}

// 지점 목록 (regionId 지정 시 해당 지역만) — firebaseAuthService.getBranches 와 동일 시그니처.
export async function getBranches(regionId?: string): Promise<Branch[]> {
  const { branches } = await loadBootstrap();
  const list = regionId ? branches.filter((b) => b.regionId === regionId) : branches;
  return [...list].sort((a, b) => a.name.localeCompare(b.name));
}

// 기기 등록 요청 — firebaseAuthService.requestDeviceRegistration 와 동일 시그니처.
// 서버가 배포코드·허용대수 검증 후 devices/{hwId} 기록 + 커스텀 토큰 발급.
export async function requestDeviceRegistration(
  hardwareId: string,
  branchId: string,
  adminName: string,
  contact: string,
  inputCode: string,
  appVersion?: string,
): Promise<{ success: boolean; status: 'active' | 'pending'; error?: string }> {
  try {
    const res = await apiPost<{ success: boolean; token?: string; status?: 'active'; error?: string }>(
      '/api/register',
      { hardwareId, branchId, adminName, contact, authCode: inputCode, appVersion, deviceType: 'pc' },
    );
    if (res.success && res.token) {
      // 발급받은 커스텀 토큰으로 즉시 로그인 + 앱 전역이 소비하는 currentDevice 캐시 기록.
      await signInWithCustomToken(auth, res.token);
      localStorage.setItem('currentDevice', JSON.stringify({
        id: hardwareId,
        branchId,
        status: 'active',
        appVersion: appVersion || 'unknown',
      }));
      return { success: true, status: 'active' };
    }
    return { success: false, status: 'pending', error: res.error || '인증에 실패했습니다.' };
  } catch (e: any) {
    // 서버가 400(배포코드 오류 등)을 주면 apiPost가 throw → err.body.error 로 사유 전달.
    const serverError = e?.body?.error;
    return { success: false, status: 'pending', error: serverError || e?.message || '등록 요청 중 오류가 발생했습니다.' };
  }
}
