// 평택 체육대회 참석자 전체 데이터를 Firebase에서 합동코드로 직접 추출하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EVENT_CODE = "EVT_평택_260626_P0G8";
const OUTPUT_FILE = "평택체육대회_Firebase_raw.json";

async function main() {
  console.log(`=== BTC 평택 체육대회 Firebase 데이터 추출 ===`);
  console.log(`합동코드: ${EVENT_CODE}`);

  // Firebase에서 eventCode로 직접 조회 (엑셀 없이)
  console.log(`Firebase members_v4에서 조회 중...`);
  const q = query(collection(db, "members_v4"), where("eventCode", "==", EVENT_CODE));
  const snapshot = await getDocs(q);
  console.log(`Firebase 조회 결과: ${snapshot.size}건`);

  const results = [];
  snapshot.forEach(doc => {
    results.push({ id: doc.id, ...doc.data() });
  });

  // 데이터 커버리지 확인
  let hasMind = 0, has3B = 0, has7C = 0, hasReport = 0;
  for (const m of results) {
    const r = m.report || {};
    if (Object.keys(r).length > 0) hasReport++;
    if (r.mindAge != null) hasMind++;
    if (r.threeBodyAnalysis) has3B++;
    if (r.sevenCodeAnalysis) has7C++;
  }
  console.log(`\n[데이터 커버리지]`);
  console.log(`  report 있음: ${hasReport}/${results.length}`);
  console.log(`  마음나이: ${hasMind}/${results.length}`);
  console.log(`  3Body: ${has3B}/${results.length}`);
  console.log(`  7Code: ${has7C}/${results.length}`);

  // 이름 목록 출력
  console.log(`\n[참여자 명단]`);
  for (const m of results) {
    const ui = (m.report || {}).userInfo || {};
    const name = (ui.name || m.name || "").trim();
    const gender = ui.gender || "";
    const age = ui.age || "";
    console.log(`  ${name} (${gender}, ${age}세)`);
  }

  // 저장
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nSuccess! Data written to: ${OUTPUT_FILE} (${results.length}건)`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
