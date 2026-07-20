// 본사 전체 회원 조회(페이지네이션) 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-members.ts(배포)와 vite dev 프록시가 공유. 기존 cloudSyncService.fetchAllMembers(클라 직접 members_v4
// 전체 getDocs)를 서버(Admin SDK)로 옮긴 것. 대량이라 서버 응답 ~4.5MB 제한을 피하려 문서ID 커서로 페이지 단위 반환
// → 클라(fetchAllMembers)가 nextCursor로 순회해 전체를 이어붙인다. 최신순 정렬은 클라가 수행(기존 동작 보존).
// list는 기본 slim 프로젝션(.select)으로 목록/overview가 실제 쓰는 가벼운 필드만 실어 전송량을 줄인다.
// 무거운 report(요약·체형·뇌테스트·sevenCode·측정원시데이터·이미지)는 상세 모달(getMemberById 전체)과
// 엑셀(projection:'excel')에서만 당긴다.
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin.js';

export interface MembersPage { members: any[]; nextCursor: string | null; }

export type MembersProjection = 'slim' | 'excel' | 'full';

// 목록 테이블 + overview 카운터/랭킹 + events 인원수가 실제로 읽는 필드만.
const SLIM_FIELDS = [
  'name', 'phone', 'phoneNumber', 'sourceType', 'branchId', 'regionId', 'eventCode', 'lastTestDate',
  'report.date',
  'report.userInfo.name', 'report.userInfo.phone', 'report.userInfo.age', 'report.userInfo.gender',
  'report.physicalAge', 'report.brainAge', 'report.mindAge', 'report.overallScore',
];

// 엑셀 시트에만 추가로 필요한 필드. slim + 아래. sevenCode·측정데이터·이미지는 여전히 제외.
const EXCEL_FIELDS = [
  ...SLIM_FIELDS,
  'report.faceAgeEstimate', 'report.comprehensiveAge',
  'report.summary', 'report.bodyTypeAnalysis', 'report.brainTestEvaluation',
];

export async function listAllMembersPage(cursorId?: string, limit = 500, projection: MembersProjection = 'slim'): Promise<MembersPage> {
  getAdminApp();
  const db = getFirestore();
  const capped = Math.min(Math.max(Number(limit) || 500, 1), 1000);
  let q = db.collection('members_v4').orderBy(FieldPath.documentId());
  if (cursorId) q = q.startAfter(cursorId);
  q = q.limit(capped);
  if (projection === 'slim') q = q.select(...SLIM_FIELDS);
  else if (projection === 'excel') q = q.select(...EXCEL_FIELDS);
  // projection === 'full' → select 미적용(전체 문서)
  const snap = await q.get();
  const members: any[] = [];
  snap.forEach((d) => members.push({ id: d.id, ...d.data() }));
  // 반환 개수가 limit과 같으면 다음 페이지가 있을 수 있음 → 마지막 문서ID를 다음 커서로. 미만이면 끝(null).
  const nextCursor = snap.size === capped && members.length > 0 ? members[members.length - 1].id : null;
  return { members, nextCursor };
}

// 단건 전체 조회(상세 모달용). 목록이 slim이라 report 무거운 필드가 없으므로, 행 클릭 시 이걸로 전체를 당긴다.
export async function getMemberById(id: string): Promise<any | null> {
  if (!id) return null;
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('members_v4').doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}
