// BTC 단체 건강 점검 대상자의 전체 데이터를 Firebase에서 추출하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

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

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--excel') args.excel = process.argv[++i];
    else if (process.argv[i] === '--event-code') args.eventCode = process.argv[++i];
    else if (process.argv[i] === '--output') args.output = process.argv[++i];
  }
  if (!args.excel || !args.eventCode || !args.output) {
    console.error("사용법: node fetch_group_firebase.js --excel <엑셀파일> --event-code <합동코드> --output <출력파일>");
    process.exit(1);
  }
  return args;
}

async function main() {
  const args = parseArgs();
  console.log(`=== BTC 단체 Firebase 데이터 추출 ===`);
  console.log(`엑셀: ${args.excel}`);
  console.log(`합동코드: ${args.eventCode}`);

  // 1. 엑셀에서 이름 목록 추출
  const wb = XLSX.readFile(args.excel);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  const excelNames = new Set();
  for (const row of rows) {
    const name = (row["이름"] || "").toString().trim();
    if (name) excelNames.add(name);
  }
  console.log(`엑셀 대상자: ${excelNames.size}명`);

  // 2. Firebase 조회
  console.log(`Firebase members_v4에서 조회 중...`);
  const q = query(collection(db, "members_v4"), where("eventCode", "==", args.eventCode));
  const snapshot = await getDocs(q);
  console.log(`Firebase 조회 결과: ${snapshot.size}건`);

  // 3. 이름 매칭
  const matched = [];
  const allFirebaseNames = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const report = data.report || {};
    const ui = report.userInfo || {};
    const name = (ui.name || data.name || "").trim();
    allFirebaseNames.push(name);
    if (excelNames.has(name)) matched.push({ id: doc.id, ...data });
  });
  console.log(`이름 매칭: ${matched.length}건 / ${excelNames.size}명`);

  // 미매칭 확인
  const matchedNames = new Set(matched.map(m => {
    const ui = (m.report || {}).userInfo || {};
    return (ui.name || m.name || "").trim();
  }));
  const unmatched = [...excelNames].filter(n => !matchedNames.has(n));
  if (unmatched.length > 0) console.log(`미매칭: ${unmatched.join(", ")}`);

  // 4. 커버리지 확인
  let hasMind = 0, has3B = 0, has7C = 0;
  for (const m of matched) {
    const r = m.report || {};
    if (r.mindAge != null) hasMind++;
    if (r.threeBodyAnalysis) has3B++;
    if (r.sevenCodeAnalysis) has7C++;
  }
  console.log(`\n[데이터 커버리지]`);
  console.log(`  마음나이: ${hasMind}/${matched.length}`);
  console.log(`  3Body: ${has3B}/${matched.length}`);
  console.log(`  7Code: ${has7C}/${matched.length}`);

  // 5. 저장
  fs.writeFileSync(args.output, JSON.stringify(matched, null, 2), "utf-8");
  console.log(`\nSuccess! Data written to: ${args.output} (${matched.length}건)`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
