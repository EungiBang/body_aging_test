// Firebase Firestore의 회원 데이터를 eventCode 기반으로 원래 지점에 역매핑하여 수정하는 스크립트
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

async function runUpdate() {
  console.log('==================================================');
  console.log('  Firestore 회원 지점 복원(역매핑) 수정 작업 시작');
  console.log('==================================================\n');

  // 1. 로컬 백업본 및 덤프 데이터 로드
  const members = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/cleaned_members_v2_backup_8267.json', 'utf-8'));
  const dump = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/firebase_dump_v2.json', 'utf-8'));
  
  const branches = dump.branches || {};
  
  // 지점 이름 기준 매핑 테이블 생성
  const branchByName = {};
  for (const [bId, b] of Object.entries(branches)) {
    const bName = b.name ? b.name.trim() : '';
    if (bName) {
      branchByName[bName] = { id: bId, ...b };
    }
  }
  // 본사 신입경영홍보실 예외 매핑 등록
  branchByName['신입경영홍보실'] = { id: 'shinip_PR', name: '신입경영홍보실', regionId: 'region_본사' };

  // eventCode 파싱 헬퍼 함수
  function parseBranchFromEvent(eventCode) {
    if (!eventCode || typeof eventCode !== 'string') return null;
    const match = eventCode.match(/^EVT_(.+?)_\d{6}_[A-Z0-9]+$/);
    if (match) {
      return match[1].trim();
    }
    return null;
  }

  // 2. 수정 대상 문서 선별
  const targets = [];
  for (const m of members) {
    // pending 문서는 제외 (분석 완료 회원만)
    if (m.id && m.id.startsWith('pending-')) continue;

    const originalBranchId = m.branchId;
    const originalBranchName = branches[originalBranchId] ? branches[originalBranchId].name : '미지정';

    // 둔촌 지점 또는 본사(신입경영홍보실 등)로 할당되어 있는 데이터 중, eventCode가 다른 지점인 것만 추출
    const isDunchon = originalBranchName === '둔촌' || originalBranchId === 'jPQocxaIDR8PXoEdsRJ2';
    const isHQ = originalBranchName === '신입경영홍보실' || originalBranchId === 'shinip_PR' || originalBranchName === '본사' || (branches[originalBranchId] && branches[originalBranchId].regionId === 'region_본사');

    if (isDunchon || isHQ) {
      const evCode = m.eventCode || (m.report && m.report.userInfo && m.report.userInfo.eventCode);
      const eventBranchName = parseBranchFromEvent(evCode);
      
      if (eventBranchName && eventBranchName !== originalBranchName) {
        const targetBranch = branchByName[eventBranchName];
        if (targetBranch) {
          if (originalBranchId !== targetBranch.id || m.regionId !== targetBranch.regionId) {
            targets.push({
              memberId: m.id,
              memberName: m.name,
              originalBranchId,
              originalBranchName,
              newBranchId: targetBranch.id,
              newBranchName: eventBranchName,
              newRegionId: targetBranch.regionId
            });
          }
        }
      }
    }
  }

  console.log(`📊 전체 회원 레코드 중 복원 대상 회원: ${targets.length}명\n`);
  
  if (targets.length === 0) {
    console.log('✅ 업데이트할 대상 문서가 없습니다.');
    process.exit(0);
  }

  // 3. 순차 업데이트 진행 (Firebase API 제한에 따른 딜레이 적용)
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const docRef = doc(db, 'members_v4', t.memberId);
    
    try {
      const updateData = {
        branchId: t.newBranchId,
        regionId: t.newRegionId
      };
      
      await updateDoc(docRef, updateData);
      successCount++;
      console.log(`[${i+1}/${targets.length}] ✅ ${t.memberName} (${t.memberId}): 기기지점(${t.originalBranchName}) -> 행사지점(${t.newBranchName}) 소속지역(업데이트 성공)`);
    } catch (err) {
      failCount++;
      console.error(`[${i+1}/${targets.length}] ❌ ${t.memberName} (${t.memberId}) 업데이트 실패:`, err.message);
    }

    // 100ms 대기 (초당 약 10건)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n==================================================');
  console.log('  Firestore 데이터 복원 작업 완료');
  console.log(`  총 대상: ${targets.length}건 | 성공: ${successCount}건 | 실패: ${failCount}건`);
  console.log('==================================================\n');

  process.exit(0);
}

runUpdate().catch(err => {
  console.error('❌ 작업 실패:', err);
  process.exit(1);
});
