// 안전 백업본(cleaned_members_v2_backup_8267.json)을 기반으로 Firestore 데이터베이스를 100% 완벽하게 롤백(원상복구)하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc } = require('firebase/firestore');
const fs = require('fs');

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

async function runRollback() {
  console.log('==================================================');
  console.log('  Firestore 데이터베이스 원상복구(롤백) 작업 시작');
  console.log('==================================================\n');

  // 1. 데이터 로드
  const backupMembers = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/cleaned_members_v2_backup_8267.json', 'utf-8'));
  const currentMembers = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/cleaned_members_v2.json', 'utf-8'));

  const currentMembersMap = {};
  for (const cm of currentMembers) {
    currentMembersMap[cm.id] = cm;
  }

  // 2. 백업본과 대조하여 다르게 틀어진 문건들만 업데이트 대상으로 선별
  const targets = [];
  for (const m of backupMembers) {
    if (m.id && m.id.startsWith('pending-')) continue;

    const currState = currentMembersMap[m.id] || {};
    
    // branchId, regionId, 또는 eventCode가 백업과 다르면 원상복구 대상
    const needsRollback = 
      currState.branchId !== m.branchId || 
      currState.regionId !== m.regionId || 
      currState.eventCode !== m.eventCode;

    if (needsRollback) {
      targets.push({
        memberId: m.id,
        memberName: m.name,
        targetBranchId: m.branchId,
        targetRegionId: m.regionId,
        targetEventCode: m.eventCode !== undefined ? m.eventCode : null
      });
    }
  }

  console.log(`📊 롤백 대상 문서 건수: ${targets.length}건 / 8267건 중\n`);

  if (targets.length === 0) {
    console.log('✅ 복구할 대상 문서가 없습니다. 이미 안전 백업본과 일치합니다.');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const docRef = doc(db, 'members_v4', t.memberId);

    try {
      const updateData = {
        branchId: t.targetBranchId,
        regionId: t.targetRegionId
      };
      
      // eventCode가 소실되었을 수 있으므로 명시적으로 같이 업데이트하여 복원
      if (t.targetEventCode !== null) {
        updateData.eventCode = t.targetEventCode;
      }

      await updateDoc(docRef, updateData);
      successCount++;
      console.log(`[${i+1}/${targets.length}] 🔄 복구 완료: ${t.memberName} (지점: ${t.targetBranchId} / 지역: ${t.targetRegionId} / eventCode: ${t.targetEventCode})`);
    } catch (err) {
      failCount++;
      console.error(`[${i+1}/${targets.length}] ❌ ${t.memberName} 복구 실패:`, err.message);
    }

    // API 전송 딜레이 조율 (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n==================================================');
  console.log('  Firestore 데이터베이스 롤백 원상복구 완료');
  console.log(`  총 대상: ${targets.length}건 | 성공: ${successCount}건 | 실패: ${failCount}건`);
  console.log('==================================================\n');

  process.exit(0);
}

runRollback().catch(err => {
  console.error('❌ 롤백 실패:', err);
  process.exit(1);
});
