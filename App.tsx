
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import AssessmentFlow from './components/AssessmentFlow';
import BranchAuthScreen from './components/BranchAuthScreen';
import { checkDeviceAndSignIn, signOutDevice } from './services/liteDevice';

type DeviceState = 'loading' | 'active' | 'pending' | 'revoked' | 'unregistered';

// Firebase 호출 무한 대기 방지용 타임아웃 헬퍼
const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`[Timeout] ${label}: ${ms}ms 초과`)), ms)
    )
  ]);
};

const App: React.FC = () => {
  const [deviceState, setDeviceState] = useState<DeviceState>('loading');
  useEffect(() => {

    const checkAuth = async () => {
      try {
        let hardwareId = 'unknown';
        let appVersion = 'unknown';
        if (window.electronAPI && window.electronAPI.getHardwareId) {
          hardwareId = await window.electronAPI.getHardwareId();
        }
        if (window.electronAPI && window.electronAPI.getAppVersion) {
          appVersion = await window.electronAPI.getAppVersion();
        }

        // 개발 편의: dev 빌드에서 VITE_DEV_HARDWARE_ID 가 지정돼 있으면 그 값으로 덮어쓴다.
        // (브라우저·electron:dev 공통으로, 시드된 테스트 기기로 로그인) — import.meta.env.DEV 게이트라
        // 설치본/운영 빌드에는 절대 포함되지 않는다.
        if ((import.meta as any).env?.DEV && (import.meta as any).env?.VITE_DEV_HARDWARE_ID) {
          hardwareId = (import.meta as any).env.VITE_DEV_HARDWARE_ID;
        }

        // 업그레이드 시 로컬 스토리지에 버전만 갱신 (재인증 요구 안함)
        const lastAppVersion = localStorage.getItem('lastAppVersion');
        if (appVersion !== 'unknown' && lastAppVersion !== appVersion) {
          console.log(`[Auth] App version upgraded from ${lastAppVersion} to ${appVersion}. Automatically syncing version.`);
          localStorage.setItem('lastAppVersion', appVersion);
        }

        if (hardwareId === 'unknown') {
          console.warn('Hardware ID could not be determined. Using fallback.');
        }

        console.log(`[Auth] checkDeviceStatus 호출 시작: hardwareId=${hardwareId.substring(0, 8)}...`);
        const { status } = await withTimeout(checkDeviceAndSignIn(hardwareId, appVersion), 10000, 'checkDeviceAndSignIn');
        
        setDeviceState(status);
        // status==='active'면 어댑터가 signInWithCustomToken + currentDevice 캐시를 이미 처리했다.
        // 그 외(pending/revoked/unregistered)면 캐시를 비운다.
        if (status !== 'active') localStorage.removeItem('currentDevice');
      } catch (e: any) {
        console.error("[Auth] 인증 확인 실패:", e?.message || e);
        // 타임아웃인 경우 캐시 사용하지 않고 바로 인증 화면 표시
        if (e?.message?.includes('[Timeout]')) {
          console.warn('[Auth] Firebase 응답 시간 초과. 인증 화면으로 전환합니다.');
          setDeviceState('unregistered');
          return;
        }
        // 네트워크 오류 시, 이전에 인증 성공한 기록이 있으면 오프라인 허용
        const cached = localStorage.getItem('currentDevice');
        if (cached) {
          try {
            const cachedDevice = JSON.parse(cached);
            if (cachedDevice.status === 'active') {
              console.log('[Auth] 오프라인 fallback: 이전 인증 기록으로 진입');
              setDeviceState('active');
              return;
            }
          } catch {}
        }
        setDeviceState('unregistered');
      }
    };
    
    checkAuth();
  }, []);

  // 서버 403(기기 해지/삭제/만료) 감지 시 즉시 로그아웃. apiClient가 쏘는 CustomEvent를 받는다.
  // (원본은 subscribeAuth 상시구독이 없어 라이트와 달리 락이 필요 없다. 재시작 시엔 device-login이 revoked 반환.)
  useEffect(() => {
    const onDeauth = (e: Event) => {
      const code = (e as CustomEvent).detail?.code;
      const target: DeviceState = code === 'session_expired' ? 'unregistered' : 'revoked';
      localStorage.removeItem('currentDevice');
      setDeviceState(target);
      void signOutDevice();
    };
    window.addEventListener('device-deauthorized', onDeauth);
    return () => window.removeEventListener('device-deauthorized', onDeauth);
  }, []);

  if (deviceState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      {deviceState === 'active' && (
        <Layout>
          <AssessmentFlow />
        </Layout>
      )}

      {deviceState === 'pending' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900">
          <div className="bg-white max-w-md rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
              <i className="fas fa-hourglass-half text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">승인 대기 중</h2>
            <p className="text-slate-500 mb-6">중앙 관리자의 기기 승인을 기다리고 있습니다.<br/>승인이 완료되면 앱을 다시 실행해주세요.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">
              새로고침
            </button>
          </div>
        </div>
      )}

      {deviceState === 'revoked' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-rose-900">
          <div className="bg-white max-w-md rounded-3xl p-8 text-center shadow-2xl border-4 border-rose-500">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-600">
              <i className="fas fa-ban text-4xl"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">사용 중지됨</h2>
            <p className="text-slate-600 font-medium leading-relaxed">
              관리자에 의해 이 기기의 라이센스가 해지되었습니다.<br/>
              프로그램을 더 이상 사용할 수 없습니다.
            </p>
          </div>
        </div>
      )}

      {deviceState === 'unregistered' && (
        <BranchAuthScreen onVerified={() => setDeviceState('active')} />
      )}
    </>
  );
};

export default App;
