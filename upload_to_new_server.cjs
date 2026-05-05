/**
 * 새 Firebase 프로젝트에 초기 데이터를 업로드하는 스크립트
 * - 전국 지역/지점 데이터 (branch_seed_data.json)
 * - 관리자 계정
 * - 시스템 설정
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection, serverTimestamp } = require('firebase/firestore');

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

const seedData = require('./branch_seed_data.json');

async function uploadData() {
  console.log('=== 새 Firebase 서버 초기 데이터 업로드 시작 ===\n');

  // 1. 지역(Regions) 및 지점(Branches) 업로드
  let regionOrder = 0;
  let branchCount = 0;

  for (const group of seedData) {
    const regionId = `region_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // 지역 저장
    await setDoc(doc(db, 'regions', regionId), {
      id: regionId,
      name: group.region,
      order: regionOrder++
    });
    console.log(`✅ 지역: ${group.region} (${regionId})`);

    // 해당 지역의 지점들 저장
    for (const branch of group.branches) {
      const branchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await setDoc(doc(db, 'branches', branchId), {
        id: branchId,
        regionId: regionId,
        name: branch.name,
        allowedLicenses: branch.allowedLicenses || 2,
        kfaceDailyLimit: 0,
        ktarotDailyLimit: 0
      });
      branchCount++;
      console.log(`   └─ 지점: ${branch.name}`);
      
      // Firebase 쓰기 속도 제한 방지 (50ms 딜레이)
      await new Promise(r => setTimeout(r, 50));
    }
  }

  console.log(`\n📊 총 ${regionOrder}개 지역, ${branchCount}개 지점 업로드 완료\n`);

  // 2. 관리자 계정 생성
  await setDoc(doc(db, 'admin_users', 'admin'), {
    name: 'Master',
    role: 'master',
    password: 'BTCADMIN2026',
    createdAt: serverTimestamp()
  });
  console.log('✅ 관리자 계정 생성 완료 (admin / BTCADMIN2026)\n');

  // 3. 시스템 설정 (배포 코드)
  await setDoc(doc(db, 'system_settings', 'config'), {
    autoApproveCode: 'BTC2026'
  });
  console.log('✅ 시스템 설정 완료 (배포코드: BTC2026)\n');

  console.log('=== 모든 초기 데이터 업로드 완료! ===');
  process.exit(0);
}

uploadData().catch(err => {
  console.error('❌ 업로드 실패:', err);
  process.exit(1);
});
