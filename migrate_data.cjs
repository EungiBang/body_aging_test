/**
 * 기존 Firebase 서버 → 새 Firebase 서버 데이터 마이그레이션 스크립트
 * 
 * 복사 대상 컬렉션:
 * - devices (기기 라이센스)
 * - members_v4 (회원 데이터)
 * - stats (통계)
 * - daily_usages (일별 사용량)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

// ===== 기존 서버 (Old) =====
const oldConfig = {
  projectId: "gen-lang-client-0150517299",
  appId: "1:956526317530:web:bec8dceedfce29e52dfae3",
  apiKey: "AIzaSyCDJ-1MaCTlduQPqowwXRo7PBW0gBYasLs",
  authDomain: "gen-lang-client-0150517299.firebaseapp.com",
  storageBucket: "gen-lang-client-0150517299.firebasestorage.app",
  messagingSenderId: "956526317530"
};

// ===== 새 서버 (New) =====
const newConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007",
  measurementId: "G-MXNRB45TC4"
};

// 두 개의 Firebase 앱 초기화
const oldApp = initializeApp(oldConfig, 'old-server');
const newApp = initializeApp(newConfig, 'new-server');

// 기존 서버는 커스텀 데이터베이스 ID 사용
const oldDb = getFirestore(oldApp, 'ai-studio-7438736e-bdac-4efd-8b91-800d4e373fe1');
// 새 서버는 기본(default) 데이터베이스
const newDb = getFirestore(newApp);

/**
 * 컬렉션 전체를 복사하는 함수
 */
async function migrateCollection(collectionName) {
  console.log(`\n📦 [${collectionName}] 마이그레이션 시작...`);
  
  try {
    const snapshot = await getDocs(collection(oldDb, collectionName));
    
    if (snapshot.empty) {
      console.log(`   ⚠️ [${collectionName}] 비어있음 (0개 문서)`);
      return 0;
    }
    
    let count = 0;
    let errors = 0;
    
    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        await setDoc(doc(newDb, collectionName, docSnap.id), data);
        count++;
        
        // 진행 상황 표시 (10개마다)
        if (count % 10 === 0) {
          process.stdout.write(`   ✅ ${count}개 완료...\r`);
        }
        
        // Firebase 쓰기 속도 제한 방지
        await new Promise(r => setTimeout(r, 30));
      } catch (writeErr) {
        errors++;
        console.error(`   ❌ 문서 쓰기 실패 [${docSnap.id}]:`, writeErr.message);
      }
    }
    
    console.log(`   ✅ [${collectionName}] 완료: ${count}개 복사 / ${errors}개 오류`);
    return count;
  } catch (readErr) {
    console.error(`   ❌ [${collectionName}] 읽기 실패:`, readErr.message);
    return -1;
  }
}

async function main() {
  console.log('========================================');
  console.log('  기존 서버 → 새 서버 데이터 마이그레이션');
  console.log('========================================\n');
  console.log('기존 서버: gen-lang-client-0150517299');
  console.log('  DB ID: ai-studio-7438736e-bdac-4efd-8b91-800d4e373fe1');
  console.log('새 서버:   btc-3body-server (default)\n');

  const collections = [
    'devices',         // 기기 라이센스
    'members_v4',      // 회원 데이터
    'stats',           // 통계
    'daily_usages',    // 일별 사용량
  ];

  const results = {};

  for (const col of collections) {
    results[col] = await migrateCollection(col);
  }

  console.log('\n========================================');
  console.log('  마이그레이션 결과 요약');
  console.log('========================================');
  
  for (const [col, count] of Object.entries(results)) {
    const status = count < 0 ? '❌ 실패' : count === 0 ? '⚠️ 비어있음' : `✅ ${count}개`;
    console.log(`  ${col}: ${status}`);
  }

  console.log('\n========================================');
  console.log('  마이그레이션 완료!');
  console.log('========================================');
  
  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
