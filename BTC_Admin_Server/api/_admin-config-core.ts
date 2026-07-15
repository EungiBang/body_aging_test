// 지역/지점 CRUD + 시스템 설정 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-config.ts(배포)와 vite dev 프록시가 공유. 기존 services/firebaseAuthService.ts의
// getRegions/getBranches/saveRegion/deleteRegion/saveBranch/deleteBranch/get·updateSystemSettings를
// 그대로 Admin SDK로 옮긴 것.
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin.js';

export async function listRegions(): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('regions').get();
  const regions: any[] = [];
  snap.forEach((d) => regions.push({ id: d.id, ...d.data() }));
  return regions.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export async function listBranches(regionId?: string): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const q = regionId ? db.collection('branches').where('regionId', '==', regionId) : db.collection('branches');
  const snap = await q.get();
  const branches: any[] = [];
  snap.forEach((d) => branches.push({ id: d.id, ...d.data() }));
  return branches.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// id 있으면 갱신, 없으면 새 문서(자동 id를 doc에 심어 저장). (기존 saveRegion 동작 보존)
export async function saveRegion(region: any): Promise<string> {
  getAdminApp();
  const db = getFirestore();
  if (region?.id) {
    await db.doc(`regions/${region.id}`).set(region);
    return region.id;
  }
  const ref = db.collection('regions').doc();
  await ref.set({ ...region, id: ref.id });
  return ref.id;
}

export async function deleteRegion(regionId: string): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  await db.doc(`regions/${regionId}`).delete();
}

export async function saveBranch(branch: any): Promise<string> {
  getAdminApp();
  const db = getFirestore();
  if (branch?.id) {
    await db.doc(`branches/${branch.id}`).set(branch);
    return branch.id;
  }
  const ref = db.collection('branches').doc();
  await ref.set({ ...branch, id: ref.id });
  return ref.id;
}

export async function deleteBranch(branchId: string): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  await db.doc(`branches/${branchId}`).delete();
}

export interface SystemSettings {
  autoApproveCode?: string;
  liteAutoApproveCode?: string;
  // 라이트 임시 교육용 배포 코드 + 만료 일시(ISO datetime-local 문자열). 라이트 서버가 등록·만료 강제에 소비.
  tempLiteAutoApproveCode?: string;
  tempLiteCodeExpiredAt?: string;
}

export async function getSystemSettings(): Promise<SystemSettings> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.doc('system_settings/config').get();
  if (snap.exists) return snap.data() as SystemSettings;
  return { autoApproveCode: '', liteAutoApproveCode: '', tempLiteAutoApproveCode: '', tempLiteCodeExpiredAt: '' };
}

export async function updateSystemSettings(
  autoApproveCode: string,
  liteAutoApproveCode?: string,
  tempLiteAutoApproveCode?: string,
  tempLiteCodeExpiredAt?: string,
): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  const updateData: any = { autoApproveCode: autoApproveCode || '' };
  if (liteAutoApproveCode !== undefined) updateData.liteAutoApproveCode = liteAutoApproveCode || '';
  if (tempLiteAutoApproveCode !== undefined) updateData.tempLiteAutoApproveCode = tempLiteAutoApproveCode || '';
  if (tempLiteCodeExpiredAt !== undefined) updateData.tempLiteCodeExpiredAt = tempLiteCodeExpiredAt || '';
  await db.doc('system_settings/config').set(updateData, { merge: true });
}
