// Firebase Admin SDK 초기화 (서버 전용 공용 모듈).
// 파일명 '_' 접두사 → Vercel이 엔드포인트로 만들지 않음. 공용 모듈로만 사용.
// 서비스 계정 키 하나로 Firestore/Auth에 전권 접근한다(잠긴 보안 규칙 무시).
// admin-login(_admin-core)과 인증 관문(_auth)이 이 초기화를 공유해 중복을 막는다.
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { readFileSync } from 'node:fs';

let cachedApp: App | undefined;

// 서비스 계정 자격증명 로딩:
//  - 배포(Vercel): FIREBASE_SERVICE_ACCOUNT_JSON 환경변수(JSON 문자열)
//  - 로컬(dev):   FIREBASE_SERVICE_ACCOUNT_PATH 환경변수(키 파일 경로, .env)
export function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let sa: any;
  if (json) sa = JSON.parse(json);
  else if (path) sa = JSON.parse(readFileSync(path, 'utf8'));
  else throw new Error('서비스 계정 자격증명 미설정 (FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_PATH)');
  cachedApp = initializeApp({ credential: cert(sa) });
  return cachedApp;
}
