// 클라우드 동기화 도메인 로직 (서버 전용) — cloudSyncService 그룹1 + 지점별 회원 읽기.
// 파일명 '_' 접두사 → Vercel 엔드포인트 아님. api/sync.ts(배포)와 vite dev 프록시가 공유(중복 방지).
// 기존 services/cloudSyncService.ts의 클라 직접 접속(members_v4 / ai_feedbacks_v1)을 서버(Admin SDK)로 옮긴 것.
// 관리자 표면에서 쓰는 건 deleteMember(회원 삭제) + listMembersByBranch(지점별 조회)뿐.
// syncMember/syncFeedback/fetchFeedbacks/listMembersByEventCode(측정·피드백 경로)는 참고로 함께 이식(템플릿 동일).
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin';
import type { Identity } from './_auth';

// 소유권: 기기는 자기 지점만, 관리자는 (요청/레코드가 준) 지점. usage/stats-core와 동일 규약.
function resolveBranch(identity: Identity, requestedBranchId?: string): string {
  return identity.role === 'admin' ? (requestedBranchId || '') : identity.branchId;
}

async function lookupRegionId(db: FirebaseFirestore.Firestore, branchId: string): Promise<string | undefined> {
  if (!branchId) return undefined;
  const br = await db.doc(`branches/${branchId}`).get();
  return br.exists ? (br.data()!.regionId as string | undefined) : undefined;
}

function stripUndefined(obj: Record<string, any>): void {
  Object.keys(obj).forEach((k) => { if (obj[k] === undefined) delete obj[k]; });
}

export async function syncMember(identity: Identity, record: any, eventCode?: string): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  if (!record || !record.id) throw new Error('record.id가 필요합니다.');

  const branchId = resolveBranch(identity, record.branchId);
  const hardwareId = identity.uid;
  const regionId = await lookupRegionId(db, branchId);

  const docData: any = { ...record };
  delete docData.images;
  docData.branchId = branchId;
  docData.hardwareId = hardwareId;
  docData.syncedAt = FieldValue.serverTimestamp();
  if (regionId) docData.regionId = regionId;
  if (eventCode) docData.eventCode = eventCode;
  stripUndefined(docData);

  await db.doc(`members_v4/${record.id}`).set(docData, { merge: true });
}

export async function syncFeedback(identity: Identity, record: any): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  if (!record || !record.id) throw new Error('record.id가 필요합니다.');

  const branchId = resolveBranch(identity, record.branchId);
  const hardwareId = identity.uid;
  const regionId = (await lookupRegionId(db, branchId)) || 'unknown';

  const docData: any = { ...record, branchId, hardwareId, regionId, syncedAt: FieldValue.serverTimestamp() };
  stripUndefined(docData);

  await db.doc(`ai_feedbacks_v1/${record.id}`).set(docData, { merge: true });
}

export async function fetchFeedbacks(feedbackType: 'body' | 'face' | 'tarot', maxLimit = 100): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db
    .collection('ai_feedbacks_v1')
    .where('feedbackType', '==', feedbackType)
    .limit(maxLimit)
    .get();
  const list: any[] = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

// members_v4 회원 삭제. 기기는 자기 지점 문서만(읽어서 소유권 확인), 관리자는 전체.
// 문서가 없으면 조용히 성공(기존 deleteDoc 동작 보존).
export async function deleteMember(identity: Identity, memberId: string): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  const ref = db.doc(`members_v4/${memberId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  if (identity.role !== 'admin' && snap.data()!.branchId !== identity.branchId) {
    const e: any = new Error('다른 지점의 회원은 삭제할 수 없습니다.');
    e.code = 'forbidden';
    e.status = 403;
    throw e;
  }
  await ref.delete();
}

// 자기 지점 회원 전체 조회(cross-PC 동기화용). 기기는 토큰서 유도한 자기 지점만, 관리자는 요청 지점.
export async function listMembersByBranch(identity: Identity, requestedBranchId?: string): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const branchId = resolveBranch(identity, requestedBranchId);
  if (!branchId) return [];
  const snap = await db.collection('members_v4').where('branchId', '==', branchId).get();
  const members: any[] = [];
  snap.forEach((d) => members.push({ id: d.id, ...d.data() }));
  return members;
}

// 연합 행사(eventCode) 참여 회원 조회. 자기 지점은 제외(제외 기준 지점은 토큰서 유도).
export async function listMembersByEventCode(identity: Identity, eventCode: string): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  if (!eventCode) return [];
  const snap = await db.collection('members_v4').where('eventCode', '==', eventCode).get();
  const myBranchId = identity.role === 'admin' ? null : identity.branchId;
  const members: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (!myBranchId || data.branchId !== myBranchId) members.push({ id: d.id, ...data });
  });
  return members;
}
