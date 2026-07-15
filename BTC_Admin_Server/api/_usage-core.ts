// 사용량/한도 도메인 로직 (서버 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// api/usage.ts(배포)와 vite dev 프록시가 이 로직을 공유한다(중복 방지).
// 기존 services/usageLimitService.ts의 클라 직접 접속 로직을 그대로 서버(Admin SDK)로 옮긴 것.
// 관리자 표면에서 쓰는 건 getStatus(할당량 탭 사용량 표시) + updateLimit(일일 한도 변경)뿐.
// increment(측정 클라 전용)는 관리자 앱에선 죽은 코드라 이식하지 않는다.
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin.js';
import type { Identity } from './_auth.js';

export interface UsageStatus {
  kfaceLimit: number;
  kfaceUsed: number;
  ktarotLimit: number;
  ktarotUsed: number;
}

// 소유권: 기기는 자기 지점만, 관리자는 요청한 지점을 허용.
function resolveBranch(identity: Identity, requestedBranchId?: string): string {
  return identity.role === 'admin' ? (requestedBranchId || '') : identity.branchId;
}

// 날짜(today)는 클라(브라우저 로컬시간)에서 계산해 전달받는다 — 기존 동작(로컬시간 기준) 보존.
export async function getStatus(identity: Identity, requestedBranchId: string, today: string): Promise<UsageStatus> {
  getAdminApp();
  const db = getFirestore();
  const branchId = resolveBranch(identity, requestedBranchId);

  let kfaceLimit = 30;
  let ktarotLimit = 30;
  if (branchId) {
    const br = await db.doc(`branches/${branchId}`).get();
    if (br.exists) {
      const d = br.data()!;
      if (typeof d.kfaceDailyLimit === 'number') kfaceLimit = d.kfaceDailyLimit;
      if (typeof d.ktarotDailyLimit === 'number') ktarotLimit = d.ktarotDailyLimit;
    }
  }

  let kfaceUsed = 0;
  let ktarotUsed = 0;
  if (branchId && today) {
    const u = await db.doc(`daily_usages/${branchId}_${today}`).get();
    if (u.exists) {
      const d = u.data()!;
      kfaceUsed = d.kfaceCount || 0;
      ktarotUsed = d.ktarotCount || 0;
    }
  }

  return { kfaceLimit, kfaceUsed, ktarotLimit, ktarotUsed };
}

// 관리자 전용 — 호출 전에 엔드포인트에서 role==='admin'을 확인할 것.
export async function updateLimit(branchId: string, kfaceLimit: number, ktarotLimit: number): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  if (!branchId) return;
  await db.doc(`branches/${branchId}`).set(
    { kfaceDailyLimit: kfaceLimit, ktarotDailyLimit: ktarotLimit },
    { merge: true }
  );
}
