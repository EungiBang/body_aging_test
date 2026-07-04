// 춘천교육청 34명의 전체 데이터를 Firebase에서 직접 추출하는 Node.js 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const fs = require('fs');
const XLSX = require('xlsx');

// 보안: Firebase 설정은 환경 변수에서 로드 (dotenv 또는 직접 export)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "btc-3body-server.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "btc-3body-server",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "btc-3body-server.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "671751957894",
  appId: process.env.FIREBASE_APP_ID || "",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("=== 춘천교육청 34명 Firebase 데이터 추출 ===\n");
  
  // 1. 엑셀에서 34명 이름 목록 추출
  const wb = XLSX.readFile("춘천교육청회원데이터_분석완료_2026-06-24.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws);
  
  const excelNames = new Set();
  const excelMembers = [];
  for (const row of rows) {
    const name = (row["이름"] || "").toString().trim();
    if (name) {
      excelNames.add(name);
      excelMembers.push({
        name,
        age: row["나이"],
        gender: row["성별"],
        branchId: (row["지점"] || "").toString().trim(),
      });
    }
  }
  console.log(`엑셀 34명 이름: ${excelNames.size}명`);
  
  // 2. Firebase에서 합동코드로 조회
  const eventCode = "EVT_춘천_260605_7UNA";
  console.log(`Firebase members_v4에서 eventCode='${eventCode}' 조회 중...`);
  
  const q = query(collection(db, "members_v4"), where("eventCode", "==", eventCode));
  const snapshot = await getDocs(q);
  
  console.log(`Firebase 조회 결과: ${snapshot.size}건`);
  
  // 3. 이름으로 34명 매칭
  const matched = [];
  const allFirebaseNames = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const report = data.report || {};
    const ui = report.userInfo || {};
    const name = (ui.name || data.name || "").trim();
    allFirebaseNames.push(name);
    
    if (excelNames.has(name)) {
      matched.push({ id: doc.id, ...data });
    }
  });
  
  console.log(`이름 매칭: ${matched.length}명 / ${excelNames.size}명`);
  
  // 미매칭 확인
  const matchedNames = new Set(matched.map(m => {
    const ui = (m.report || {}).userInfo || {};
    return (ui.name || m.name || "").trim();
  }));
  const unmatched = [...excelNames].filter(n => !matchedNames.has(n));
  if (unmatched.length > 0) {
    console.log(`미매칭: ${unmatched.join(", ")}`);
    console.log(`\nFirebase 이름 목록: ${allFirebaseNames.join(", ")}`);
  }
  
  // 4. 매칭된 데이터에서 핵심 필드 확인
  let hasMindAge = 0, has3Body = 0, has7Code = 0;
  for (const m of matched) {
    const r = m.report || {};
    if (r.mindAge != null) hasMindAge++;
    if (r.threeBodyAnalysis) has3Body++;
    if (r.sevenCodeAnalysis) has7Code++;
  }
  
  console.log(`\n[데이터 커버리지]`);
  console.log(`  마음나이: ${hasMindAge}/${matched.length}`);
  console.log(`  3Body:    ${has3Body}/${matched.length}`);
  console.log(`  7Code:    ${has7Code}/${matched.length}`);
  
  // 5. JSON으로 저장
  fs.writeFileSync(
    "춘천교육청_Firebase_raw.json",
    JSON.stringify(matched, null, 2),
    "utf-8"
  );
  console.log(`\n저장 완료: 춘천교육청_Firebase_raw.json (${matched.length}건)`);
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
