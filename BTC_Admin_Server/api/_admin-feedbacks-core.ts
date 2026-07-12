// AI 피드백(ai_feedbacks_v1) 전체 조회 도메인 로직 (서버 전용, 관리자 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/admin-feedbacks.ts(배포)와 vite dev 프록시가 공유. 기존 firebaseAuthService.getAllFeedbacks(클라 직접
// ai_feedbacks_v1 전체 getDocs)를 서버(Admin SDK)로 옮긴 것.
// ※ G1(갭): Outdoor는 few-shot 읽기(_analyze-fewshot)와 타입별 조회(_sync-core.fetchFeedbacks)만 있고
//    "관리자 전체 조회"는 없었음 → admin 전용으로 신설. AI 훈련 센터 탭 + overview의 훈련현황 요약이 이 데이터로 렌더.
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin';

// 전체 피드백. 최신순(createdAt || syncedAt) 정렬 — 기존 getAllFeedbacks 동작 보존.
// createdAt/syncedAt은 문자열(ISO) 또는 Timestamp일 수 있어 String() 코어션 후 비교(원본 localeCompare 보존).
export async function listAllFeedbacks(): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('ai_feedbacks_v1').get();
  const feedbacks: any[] = [];
  snap.forEach((d) => feedbacks.push({ id: d.id, ...d.data() }));
  feedbacks.sort((a, b) => {
    const da = String(a.createdAt || a.syncedAt || '');
    const db2 = String(b.createdAt || b.syncedAt || '');
    return db2.localeCompare(da);
  });
  return feedbacks;
}
