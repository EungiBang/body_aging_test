// F2 — 공통 인증 관문 (서버 전용).
// 파일명 '_' 접두사 → Vercel이 엔드포인트로 만들지 않음. 공용 모듈로만 사용.
// 보호 대상 api/ 엔드포인트가 요청 앞단에서 authenticateRequest(req)를 호출한다.
// 흐름: Authorization Bearer 토큰 추출 → verifyIdToken → 기기 status 확인
//       → 유휴 만료 확인 → lastActive 슬라이딩 갱신 → 신원객체 반환. 실패 시 AuthError.
// (관리자 앱: role==='admin' 경로만 실제 사용. lite-device 경로는 P2에서 필요 시 활성.)
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './_firebase-admin';

// 세션 유휴 만료 기간. [비개발자 합의 미정 — 잠정 2주] 상수라 숫자만 바꾸면 조정됨.
const IDLE_EXPIRY_DAYS = 14;
// lastActive 슬라이딩 갱신 최소 간격 — 매 요청 쓰기를 피해 Firestore 쓰기를 절감.
const LAST_ACTIVE_THROTTLE_MS = 60 * 60 * 1000; // 1시간

// 신원 해석 봉합선: 인증 방식이 바뀌어도(기기/개인) 이 객체 형태 뒤는 유지된다.
export interface Identity {
  uid: string; // 기기ID (hardwareId) 또는 'admin:{userId}'
  branchId: string;
  role: string; // 'lite-device' | 'admin'
  adminRole?: string; // role==='admin'일 때 'master' | 'manager'
}

export class AuthError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

// Authorization: Bearer <idToken> 헤더에서 토큰 추출
function extractBearer(headers: Record<string, any>): string {
  const h = headers['authorization'] || headers['Authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  if (!m) throw new AuthError('no_token', '인증 토큰이 없습니다.');
  return m[1].trim();
}

// 모든 보호 대상 엔드포인트가 요청 앞단에서 호출. 성공 시 신원객체, 실패 시 AuthError를 던진다.
export async function authenticateRequest(req: { headers: Record<string, any> }): Promise<Identity> {
  getAdminApp();
  const auth = getAuth();
  const db = getFirestore();

  // 1) ID 토큰 검증 (위조·만료 확인). revoke는 아래 status 필드로 강제하므로 checkRevoked는 미사용.
  const token = extractBearer(req.headers);
  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new AuthError('invalid_token', '유효하지 않은 인증 토큰입니다.');
  }
  const uid = decoded.uid;
  const role = (decoded.role as string) || 'lite-device';

  // 관리자 토큰: 기기가 아니므로 lite_devices status/만료 검사를 건너뛰고 통과.
  if (role === 'admin') {
    return { uid, branchId: '', role: 'admin', adminRole: (decoded.adminRole as string) || undefined };
  }

  // 2) 기기 문서 조회 (기기 토큰 경로)
  const ref = db.doc(`lite_devices/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new AuthError('device_not_found', '등록되지 않은 기기입니다.', 403);
  const device = snap.data()!;

  // 3) status 확인 (관리자 revoke가 실효를 갖는 지점)
  if (device.status !== 'active') {
    throw new AuthError('device_inactive', '비활성화된 기기입니다.', 403);
  }

  // 4) 유휴 만료 확인 (lastActive 기준, 슬라이딩)
  const now = Date.now();
  const last = device.lastActive instanceof Timestamp ? device.lastActive.toMillis() : 0;
  if (last > 0 && now - last > IDLE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
    throw new AuthError('session_expired', '세션이 만료되었습니다. 재등록이 필요합니다.', 403);
  }

  // 5) lastActive 슬라이딩 갱신 (throttle로 쓰기 절감)
  if (last === 0 || now - last > LAST_ACTIVE_THROTTLE_MS) {
    await ref.update({ lastActive: FieldValue.serverTimestamp() });
  }

  // 6) 신원객체 반환
  return {
    uid,
    branchId: (decoded.branchId as string) || device.branchId || '',
    role: (decoded.role as string) || 'lite-device',
  };
}
