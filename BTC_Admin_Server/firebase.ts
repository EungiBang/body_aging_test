
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import prodConfig from './firebase-applet-config.json';

// 환경별 Firebase 웹 config 선택 (Outdoor Lite와 동일 패턴):
//  - VITE_FIREBASE_CONFIG(JSON 문자열)가 있으면 그 env에 설정된 프로젝트 사용 (개발팀 로컬 = 각자 .env 값)
//  - 없으면 커밋된 운영 config로 폴백 → 비개발자 운영 빌드는 그대로(btc-3body-server, 무영향)
const envCfg = import.meta.env.VITE_FIREBASE_CONFIG;
const firebaseConfig = envCfg ? JSON.parse(envCfg) : prodConfig;

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use the default database
export const db = getFirestore(app);
export const auth = getAuth(app);
