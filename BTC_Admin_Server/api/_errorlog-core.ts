// 에러 로그 도메인 로직 (서버 전용). 파일명 '_' 접두사 → Vercel 엔드포인트 아님.
// 읽기/상태변경: api/admin-errorlog.ts(관리자 전용) — 기존 AdminErrorMonitor의 클라 onSnapshot/updateDoc 대체.
// 쓰기: api/errorlog.ts(best-effort 인증) — 기존 ErrorLogger.logError의 클라 addDoc 대체.
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAdminApp } from './_firebase-admin';
import type { Identity } from './_auth';

// 관리자 오류 모니터용 — 최근 에러 로그 조회(timestamp 내림차순, 기본 100건).
export async function listErrorLogs(max = 100): Promise<any[]> {
  getAdminApp();
  const db = getFirestore();
  const snap = await db.collection('error_logs').orderBy('timestamp', 'desc').limit(max).get();
  const logs: any[] = [];
  snap.forEach((d) => logs.push({ id: d.id, ...d.data() }));
  return logs;
}

// 에러 로그 상태 변경(new/viewed/resolved).
export async function setErrorLogStatus(id: string, status: 'new' | 'viewed' | 'resolved'): Promise<void> {
  getAdminApp();
  const db = getFirestore();
  await db.doc(`error_logs/${id}`).update({ status });
}

// 클라(브라우저)가 보내는 에러 로그 페이로드. 서버가 status/timestamp/신원을 덧붙인다.
export interface ErrorLogInput {
  message: string;
  stackTrace?: string;
  type: 'api' | 'crash' | 'unknown';
  severity: 'high' | 'medium' | 'low';
  source: string; // 예: 'window.onerror', 'unhandledrejection'
  deviceInfo?: any;
  appVersion?: string;
}

// 에러 로그 1건을 error_logs 컬렉션에 기록한다(기존 ErrorLogger.logError의 addDoc 대체).
// identity가 있으면 branchId/uid를 첨부, 없으면 익명(anonymous) — 에러 로깅은 미인증 상황에서도 동작해야 함.
export async function writeErrorLog(input: ErrorLogInput, identity?: Identity | null): Promise<void> {
  getAdminApp();
  const db = getFirestore();

  const payload: Record<string, any> = {
    message: input.message,
    stackTrace: input.stackTrace,
    type: input.type,
    severity: input.severity,
    source: input.source,
    deviceInfo: input.deviceInfo,
    appVersion: input.appVersion,
    status: 'new',
    timestamp: FieldValue.serverTimestamp(),
    branchId: identity ? identity.branchId : null,
    uid: identity ? identity.uid : null,
    reporter: identity ? identity.role : 'anonymous',
  };

  // Admin SDK의 add()는 undefined 값을 거부한다 → 선택 필드가 없을 때 500이 나지 않도록 undefined 키 제거.
  Object.keys(payload).forEach((k) => { if (payload[k] === undefined) delete payload[k]; });

  await db.collection('error_logs').add(payload);
}
