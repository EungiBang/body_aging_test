// 사용량 통계 도메인 로직 (서버 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/stats.ts(배포)와 vite dev 프록시가 이 로직을 공유한다(중복 방지).
// 기존 services/statsService.ts의 클라 직접 접속 로직을 그대로 서버(Admin SDK)로 옮긴 것.
// 관리자 표면에서 쓰는 건 getDashboardStats(overview)뿐. logUsage(측정 클라 경로)는 참고로 함께 이식.
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin.js';
import type { Identity } from './_auth.js';

export interface DashboardStats {
  dailyStats: any[];
  branchStats: any[];
}

// 소유권: 기기는 자기 지점만, 관리자는 요청한 지점을 허용.
function resolveBranch(identity: Identity, requestedBranchId?: string): string {
  return identity.role === 'admin' ? (requestedBranchId || '') : identity.branchId;
}

// 리포트 생성 시 통계 증가 (기기 경로). 날짜(dateStr, YYYYMMDD)는 클라(로컬시간)에서 전달받음 — 기존 동작 보존.
export async function logUsage(
  identity: Identity,
  requestedBranchId: string,
  requestedHardwareId: string,
  dateStr: string
): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  const branchId = resolveBranch(identity, requestedBranchId);
  const hardwareId = identity.role === 'admin' ? requestedHardwareId : identity.uid;

  await db.doc(`stats/daily_${dateStr}`).set(
    { date: dateStr, count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await db.doc(`stats/branch_${branchId}`).set(
    { branchId, totalCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  await db.doc(`devices/${hardwareId}`).set(
    { totalUsages: FieldValue.increment(1), lastUsage: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// 대시보드 표시용 전체 통계 수집 (관리자 전용 — 전 지점 집계, 엔드포인트에서 role==='admin' 확인).
// dailyStats: 최근 14일 일별 측정량, branchStats: 지점별 누적 사용량 (전체)
export async function getDashboardStats(): Promise<DashboardStats> {
  getAdminApp();
  const db = getFirestore();

  const snapshot = await db.collection('stats').get();

  const dailyStats: any[] = [];
  const branchStats: any[] = [];

  snapshot.forEach((doc) => {
    const id = doc.id;
    const data = doc.data();
    if (id.startsWith('daily_')) {
      const d = data.date;
      const formatted = `${d.substring(4, 6)}/${d.substring(6, 8)}`;
      dailyStats.push({ name: formatted, count: data.count, raw: data.date });
    } else if (id.startsWith('branch_')) {
      branchStats.push({ branchId: data.branchId, count: data.totalCount || 0 });
    }
  });

  dailyStats.sort((a, b) => a.raw.localeCompare(b.raw));
  const recent14 = dailyStats.slice(-14);
  branchStats.sort((a, b) => b.count - a.count);

  return { dailyStats: recent14, branchStats };
}
