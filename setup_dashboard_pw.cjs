// 본사 통합 대시보드의 비밀번호를 암호화된 해시값으로 업데이트하는 데이터베이스 유틸리티 스크립트
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");
const crypto = require('crypto');

// 대시보드가 사용하는 구 Firebase 프로젝트 설정
const firebaseConfig = {
  projectId: "gen-lang-client-0150517299",
  appId: "1:956526317530:web:bec8dceedfce29e52dfae3",
  apiKey: "AIzaSyCDJ-1MaCTlduQPqowwXRo7PBW0gBYasLs",
  authDomain: "gen-lang-client-0150517299.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-7438736e-bdac-4efd-8b91-800d4e373fe1");

const main = async () => {
  const newPassword = "BTC_Dashboard_2026!";
  const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
  
  await setDoc(doc(db, 'system_settings', 'dashboard_auth'), {
    passwordHash: hash
  });
  console.log("SUCCESS: 본사 대시보드 비밀번호가 안전하게 변경 및 업데이트되었습니다.");
  console.log("새 비밀번호: " + newPassword);
  console.log("암호화 해시: " + hash);
  process.exit(0);
};

main().catch((err) => {
  console.error("FAIL: 비밀번호 업데이트 중 에러 발생", err);
  process.exit(1);
});
