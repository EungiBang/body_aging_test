// 관리자 로그인 핵심 로직 (서버 전용) = 인증(F1)의 관리자 버전.
// 파일명 '_' 접두사 → Vercel이 엔드포인트로 만들지 않음. 공용 모듈로만 사용.
// 기존 클라 adminLogin(services/firebaseAuthService.ts)의 검증을 서버로 옮긴 것:
// admin_users/{userId}의 SHA-256 비번 해시를 서버(Admin SDK)가 검증 → role=admin 커스텀 토큰 발급.
// 비개발자가 고칠 firebaseAuthService.ts는 건드리지 않는다(신 파일에 새로 구현, §인증 방침).
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './_firebase-admin';
import { createHash } from 'node:crypto';

// 클라의 hashPassword(Web Crypto SHA-256 hex)와 동일 결과 — 기존 저장 해시가 그대로 검증됨.
function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export interface AdminLoginInput {
  userId: string;
  password: string;
}
export type AdminLoginResult =
  | { ok: true; token: string; name: string; adminRole: string }
  | { ok: false; error: string };

export async function adminLogin(input: AdminLoginInput): Promise<AdminLoginResult> {
  const { userId, password } = input;
  if (!userId || !password) return { ok: false, error: '아이디와 비밀번호를 입력하세요.' };

  getAdminApp();
  const db = getFirestore();
  const auth = getAuth();

  const ref = db.doc(`admin_users/${userId}`);
  const snap = await ref.get();
  // 존재/비번 실패를 구분하지 않음(정보 노출 방지, 기존 클라도 둘 다 null 반환).
  if (!snap.exists) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };
  const data = snap.data()!;

  const hashedInput = sha256Hex(password);
  // 기존 클라 로직 보존: 해시 일치 또는 레거시 평문 일치 허용.
  const matches = data.password === hashedInput || data.password === password;
  if (!matches) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };

  // 레거시 평문 저장분은 해시로 자동 마이그레이션(기존 클라 동작 보존).
  if (data.password === password && data.password !== hashedInput) {
    await ref.update({ password: hashedInput });
  }

  const adminRole: string = data.role || 'manager';
  // 기기 uid(hardwareId)와 충돌 방지 위해 'admin:' 접두. role=admin으로 F2가 기기 검사를 건너뜀.
  const token = await auth.createCustomToken(`admin:${userId}`, {
    role: 'admin',
    adminRole,
    name: data.name || userId,
  });
  return { ok: true, token, name: data.name || userId, adminRole };
}
