// Firebase Firestore 실서버(한국) 데이터를 안전하게 로컬 JSON 파일로 백업하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

async function runBackup() {
  console.log('=== Firebase 실서버(한국) 데이터 백업 시작 ===');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupData = {};
  
  const collectionsToBackup = ['regions', 'branches', 'devices', 'lite_devices', 'system_settings'];
  
  try {
    for (const colName of collectionsToBackup) {
      console.log(`[Backup] '${colName}' 컬렉션 데이터 추출 중...`);
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      
      backupData[colName] = {};
      snapshot.forEach(doc => {
        backupData[colName][doc.id] = doc.data();
      });
      console.log(`   └─ 추출 완료: ${Object.keys(backupData[colName]).length}개 문서`);
    }
    
    const fileName = `firebase_live_backup_${timestamp}.json`;
    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');
    
    console.log(`\n✅ 백업 성공! 파일 경로: ${filePath}`);
    console.log('이 백업 파일은 문제가 발생했을 때 복원 스크립트를 사용하여 원래대로 돌리는 데 사용됩니다.');
  } catch (error) {
    console.error('❌ 백업 중 에러 발생:', error);
    process.exit(1);
  }
  process.exit(0);
}

runBackup();
