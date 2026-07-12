// 연합 행사(active_events) 조회 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-events.ts(배포)와 vite dev 프록시가 공유. 기존 cloudSyncService.fetchAllEvents(클라 직접
// active_events 전체 getDocs)를 서버(Admin SDK)로 옮긴 것.
// ※ Outdoor 측정 앱의 /api/event(createEvent/대기열 등)와 달리, 관리자 표면은 "전체 행사 목록"만 필요 →
//    admin 전용 목록 조회 엔드포인트를 신설한다(Outdoor _event-core엔 목록 조회가 없었음).
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin';

// 전체 연합 행사 목록. createdAt(숫자) 내림차순 — 기존 fetchAllEvents 동작 보존.
export async function listAllEvents(): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('active_events').get();
  const events: any[] = [];
  snap.forEach((d) => events.push({ id: d.id, ...d.data() }));
  events.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return events;
}
