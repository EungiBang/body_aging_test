
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import prodConfig from './firebase-applet-config.json';

// 환경별 Firebase 웹 config 선택 (라이트 firebase.ts와 동일 패턴):
//  - VITE_FIREBASE_CONFIG(JSON 문자열)가 있으면 사용 → 로컬 개발 = 테스트 프로젝트(sejong-test-4e285)
//  - 없으면 커밋된 운영 config로 폴백 → 설치본/운영 빌드는 그대로(무영향)
const envCfg = (import.meta as any).env?.VITE_FIREBASE_CONFIG;
const firebaseConfig = envCfg ? JSON.parse(envCfg) : prodConfig;

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use the default database
export const db = getFirestore(app);
export const auth = getAuth(app);
