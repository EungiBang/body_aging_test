// 본사 전체 회원 조회(페이지네이션) 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-members.ts(배포)와 vite dev 프록시가 공유. 기존 cloudSyncService.fetchAllMembers(클라 직접 members_v4
// 전체 getDocs)를 서버(Admin SDK)로 옮긴 것. 대량이라 서버 응답 ~4.5MB 제한을 피하려 문서ID 커서로 페이지 단위 반환
// → 클라(fetchAllMembers)가 nextCursor로 순회해 전체를 이어붙인다. 최신순 정렬은 클라가 수행(기존 동작 보존).
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin';

export interface MembersPage { members: any[]; nextCursor: string | null; }

export async function listAllMembersPage(cursorId?: string, limit = 500): Promise<MembersPage> {
  getAdminApp();
  const db = getFirestore();
  const capped = Math.min(Math.max(Number(limit) || 500, 1), 1000);
  let q = db.collection('members_v4').orderBy(FieldPath.documentId());
  if (cursorId) q = q.startAfter(cursorId);
  q = q.limit(capped);
  const snap = await q.get();
  const members: any[] = [];
  snap.forEach((d) => members.push({ id: d.id, ...d.data() }));
  // 반환 개수가 limit과 같으면 다음 페이지가 있을 수 있음 → 마지막 문서ID를 다음 커서로. 미만이면 끝(null).
  const nextCursor = snap.size === capped && members.length > 0 ? members[members.length - 1].id : null;
  return { members, nextCursor };
}
