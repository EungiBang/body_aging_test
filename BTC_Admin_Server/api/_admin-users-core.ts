// 관리자 계정 CRUD 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-users.ts(배포)와 vite dev 프록시가 공유. 기존 services/firebaseAuthService.ts의
// getAdminUsers/saveAdminUser/changeAdminPassword/deleteAdminUser를 그대로 Admin SDK로 옮긴 것.
// (실제 로그인=adminLogin은 api/admin-login.ts가 담당. 여기는 로그인 이후의 계정 관리.)
// 주의: 비밀번호 해시는 기존과 동일하게 SHA-256 hex로 유지(저장된 해시 호환). SHA-256은 약하나 동작 보존 우선.
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { getAdminApp } from './_firebase-admin.js';

function hashPassword(password: string): string {
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

export async function listAdminUsers(): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('admin_users').get();
  const admins: any[] = [];
  // 보안: 비밀번호 해시는 클라로 내려보내지 않는다(원본 firebaseAuthService.getAdminUsers 동작 보존).
  snap.forEach((d) => {
    const { password, ...rest } = d.data() as any;
    admins.push({ id: d.id, ...rest });
  });
  return admins;
}

export async function saveAdminUser(user: { id: string; name: string; role: string; password: string }): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  await db.doc(`admin_users/${user.id}`).set({
    name: user.name,
    role: user.role,
    password: hashPassword(user.password),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function changeAdminPassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  getAdminApp();
  const db = getFirestore();
  const ref = db.doc(`admin_users/${userId}`);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, error: '존재하지 않는 계정입니다.' };

  const data = snap.data()!;
  const hashedCurrent = hashPassword(currentPassword);
  // 현재 비밀번호 검증 (해시 또는 평문 호환 — 기존 동작 보존)
  if (data.password !== hashedCurrent && data.password !== currentPassword) {
    return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
  }
  if (newPassword.length < 6) {
    return { success: false, error: '새 비밀번호는 6자 이상이어야 합니다.' };
  }
  await ref.update({ password: hashPassword(newPassword) });
  return { success: true };
}

export async function deleteAdminUser(userId: string): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  await db.doc(`admin_users/${userId}`).delete();
}
