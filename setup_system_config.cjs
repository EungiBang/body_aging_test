// 지점용 PC Client 및 Outdoor Lite의 자동 개통 승인 코드를 안전하게 업데이트하는 데이터베이스 유틸리티 스크립트
const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

// btc-3body-server 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007",
  measurementId: "G-MXNRB45TC4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const main = async () => {
  await setDoc(doc(db, 'system_settings', 'config'), {
    autoApproveCode: "BTC_Core_Install_2026!",
    liteAutoApproveCode: "BTC_Lite_Install_2026!"
  }, { merge: true });
  console.log("SUCCESS: 지점 자동 개통 승인 코드가 변경 및 업데이트되었습니다.");
  console.log("PC Client 승인코드: BTC_Core_Install_2026!");
  console.log("Outdoor Lite 승인코드: BTC_Lite_Install_2026!");
  process.exit(0);
};

main().catch((err) => {
  console.error("FAIL: 시스템 설정 업데이트 중 에러 발생", err);
  process.exit(1);
});
