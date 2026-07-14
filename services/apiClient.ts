// R2 공용 클라이언트 헬퍼: 원본(Electron) → 라이트 api 단일 호출 통로.
// 라이트의 services/apiClient.ts를 copy-adapt하되, 원본은 라이트 api와 다른 오리진을 부르므로
// base URL을 env로 분기한다.
//   로컬 개발 = 빈 값(상대경로 /api/*) → 원본 vite dev 프록시가 라이트(3002)로 전달(same-origin, CORS 회피).
//   운영 배포 = VITE_API_BASE에 배포된 라이트 api 주소를 지정.
// Firebase 로그인(signInWithCustomToken) 상태면 ID 토큰을 Authorization 헤더에 붙인다.
// ※ 기기 인증(PC device) 배선 전에는 currentUser가 null이라 토큰이 안 붙는다. 무인증/best-effort
//   엔드포인트(errorlog 등)는 그대로 동작하고, 보호된 엔드포인트는 서버 관문에서 401로 거절된다.
import { getAuth } from 'firebase/auth';

const API_BASE: string = (import.meta as any).env?.VITE_API_BASE || '';

// 운영자가 SettingsModal에서 넣은 커스텀 Gemini 키(localStorage 'bt_custom_api_key_lite', 영구저장)가 있으면
// X-Gemini-Key 헤더로 첨부한다. 서버는 이 키가 오면 그걸로 Gemini를 호출하고, 없으면 중앙 키를 쓴다(옵셔널).
// 키가 없으면 빈 객체 → 헤더 미첨부 → 기존 동작(중앙 키)과 100% 동일.
export function geminiKeyHeaders(): Record<string, string> {
  try {
    const k = (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_custom_api_key_lite') : '') || '';
    return k.trim() ? { 'X-Gemini-Key': k.trim() } : {};
  } catch {
    return {};
  }
}

// 서버 관문(_auth.ts)이 "이 기기는 더는 못 씀"을 통지하는 403 코드들. 이걸 받으면 App이 즉시 로그아웃한다.
// device_inactive=관리자 revoke, device_not_found=기기 삭제, session_expired=유휴 만료.
// (401 no_token/invalid_token=토큰 일시 문제, forbidden=관리자 전용 action 은 제외 — 오탈 방지.)
const DEAUTH_CODES = new Set(['device_inactive', 'device_not_found', 'session_expired']);

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const user = getAuth().currentUser;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...geminiKeyHeaders() };
  if (user) {
    const idToken = await user.getIdToken();
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: any = new Error(`API ${path} 실패: ${res.status}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch { /* ignore */ }
    // 기기 해지·삭제·만료면 App에 통지 → 즉시 로그아웃(throw 동작은 그대로 유지, 기존 호출부 불변).
    if (res.status === 403 && err.body?.code && DEAUTH_CODES.has(err.body.code) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('device-deauthorized', { detail: { code: err.body.code } }));
    }
    throw err;
  }
  return res.json();
}

// GET 통로 — 무인증 공개 조회(예: /api/bootstrap 등록폼 지역·지점)에 사용.
// apiPost와 같은 API_BASE 분기를 공유(로컬 dev = 프록시, 운영 = VITE_API_BASE).
export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'GET' });
  if (!res.ok) {
    const err: any = new Error(`API ${path} 실패: ${res.status}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch { /* ignore */ }
    throw err;
  }
  return res.json();
}
