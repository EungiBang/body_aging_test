// R2 공용 클라이언트 헬퍼: 인증된 서버 api 호출.
// Firebase 로그인(signInWithCustomToken) 상태면 ID 토큰을 Authorization 헤더에 붙인다.
// ※ P1에서는 adminLogin(liteAdmin)만 서버로 옮기며, 이 헬퍼는 P2(관리자 데이터 서버화)에서 사용한다.
import { getAuth } from 'firebase/auth';

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const user = getAuth().currentUser;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) {
    const idToken = await user.getIdToken();
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const err: any = new Error(`API ${path} 실패: ${res.status}`);
    err.status = res.status;
    try { err.body = await res.json(); } catch { /* ignore */ }
    throw err;
  }
  return res.json();
}
