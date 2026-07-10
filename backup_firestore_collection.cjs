// Firestore members_v4 컬렉션을 members_v4_backup 컬렉션으로 복사하여 클라우드상에 백업을 생성하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createDatabaseBackup() {
  console.log('==================================================');
  console.log('  Firestore 원격 데이터베이스 실시간 백업 작업 시작');
  console.log('  대상 컬렉션: members_v4 -> members_v4_backup');
  console.log('==================================================\n');

  try {
    // 1. 원본 members_v4 컬렉션 데이터 스캔
    const sourceColRef = collection(db, 'members_v4');
    const querySnapshot = await getDocs(sourceColRef);
    const docsList = querySnapshot.docs;
    
    console.log(`📥 원본 데이터 로드 완료: 총 ${docsList.length}건\n`);

    let successCount = 0;
    let failCount = 0;

    // 2. 백업 members_v4_backup 컬렉션에 복사본 업로드
    for (let i = 0; i < docsList.length; i++) {
      const srcDoc = docsList[i];
      const data = srcDoc.data();
      
      // 대상 백업 컬렉션의 동일한 ID 문서 참조 생성
      const backupDocRef = doc(db, 'members_v4_backup', srcDoc.id);

      try {
        // 백업 컬렉션에 데이터 쓰기 (덮어쓰기 허용)
        await setDoc(backupDocRef, data);
        successCount++;
        
        // 100건마다 진행률 출력
        if (successCount % 100 === 0 || i === docsList.length - 1) {
          console.log(`[${i+1}/${docsList.length}] 📝 백업 저장 진행 중... (${srcDoc.id})`);
        }
      } catch (docErr) {
        failCount++;
        console.error(`❌ [${srcDoc.id}] 백업 문서 업로드 실패:`, docErr.message);
      }

      // API 전송 딜레이 조율 (30ms)
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log('\n==================================================');
    console.log('  Firestore 실시간 데이터베이스 백업 생성 완료');
    console.log(`  총 대상: ${docsList.length}건 | 성공: ${successCount}건 | 실패: ${failCount}건`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ 백업 프로세스 중 치명적 에러 발생:', err.message);
  }
  
  process.exit(0);
}

createDatabaseBackup();
