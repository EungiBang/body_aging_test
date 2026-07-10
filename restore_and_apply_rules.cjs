// 원래 백업본을 기반으로 Firestore branchId를 원상복구하고 regionId만 이벤트 권역으로 이원화 매핑하는 스크립트
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

async function runRestore() {
  console.log('==================================================');
  console.log('  Firestore 지점 원상복구 및 지역 이원화 업데이트 시작');
  console.log('==================================================\n');

  // 1. 데이터 로드
  // 수정 전 완벽 백업 파일 로드 (여기에는 둔촌/본사가 변경되지 않고 원본 그대로 보존되어 있음)
  const backupMembers = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/cleaned_members_v2_backup_8267.json', 'utf-8'));
  const currentMembers = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/cleaned_members_v2.json', 'utf-8'));
  const dump = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/firebase_dump_v2.json', 'utf-8'));
  
  const currentMembersMap = {};
  for (const cm of currentMembers) {
    currentMembersMap[cm.id] = cm;
  }

  const branches = dump.branches || {};
  
  // 지점 이름 기준 매핑 테이블 생성
  const branchByName = {};
  for (const [bId, b] of Object.entries(branches)) {
    const bName = b.name ? b.name.trim() : '';
    if (bName) {
      branchByName[bName] = { id: bId, ...b };
    }
  }
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

  // 2. 백업본과 비교하여 각 회원별 원상복구 및 이원화 설정 데이터 추출
  const targets = [];
  for (const m of backupMembers) {
    if (m.id && m.id.startsWith('pending-')) continue;

    const originalBranchId = m.branchId; // 원래 기기 소속 지점 ID (둔촌, 본사 등)
    const originalRegionId = m.regionId; // 원래 지역 ID
    const originalBranchName = branches[originalBranchId] ? branches[originalBranchId].name : (originalBranchId === 'shinip_PR' ? '신입경영홍보실' : '미지정');

    const evCode = m.eventCode || (m.report && m.report.userInfo && m.report.userInfo.eventCode);
    const eventBranchName = parseBranchFromEvent(evCode);

    let targetRegionId = originalRegionId;
    let isDecoupled = false;

    if (eventBranchName) {
      const targetBranch = branchByName[eventBranchName];
      if (targetBranch) {
        // 지역은 이벤트 점검지가 속한 지역 ID로 분리 매핑
        targetRegionId = targetBranch.regionId;
        if (targetRegionId !== originalRegionId) {
          isDecoupled = true;
        }
      }
    }

    // 이전 스크립트 실행으로 원격 DB의 branchId가 바뀌었을 수 있으므로,
    // (1) branchId는 무조건 원래 기기 지점(originalBranchId)으로 되돌려놓음
    // (2) regionId는 이원화 규칙에 의해 갱신된 targetRegionId로 셋팅함
    // 실질적으로 업데이트가 필요한 경우(현재 원격 상태와 변경하려는 상태가 다를 때)만 targets에 담음
    const currState = currentMembersMap[m.id] || {};
    const needsUpdate = currState.branchId !== originalBranchId || currState.regionId !== targetRegionId;

    if (needsUpdate) {
      targets.push({
        memberId: m.id,
        memberName: m.name,
        originalBranchId,
        originalBranchName,
        targetRegionId,
        eventBranchName: eventBranchName || '없음'
      });
    }
  }

  console.log(`📊 복구 및 이원화 설정 대상 회원 수: ${targets.length}명 -> 순차 진행 시작\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const docRef = doc(db, 'members_v4', t.memberId);

    try {
      // branchId는 원래 기기 지점으로 원상복구/보존하고, regionId는 이벤트 지역으로 분리 지정
      const updateData = {
        branchId: t.originalBranchId,
        regionId: t.targetRegionId
      };

      await updateDoc(docRef, updateData);
      successCount++;
      
      // 콘솔 출력 간소화 (50건마다 진행 상황 노출)
      if (successCount % 50 === 0 || i === targets.length - 1) {
        console.log(`[${i+1}/${targets.length}] 📝 진행 중... ${t.memberName} (${t.originalBranchName} 기기지점 보존 / 이벤트지역: ${t.eventBranchName} 매핑 완료)`);
      }
    } catch (err) {
      failCount++;
      console.error(`[${i+1}/${targets.length}] ❌ ${t.memberName} 업데이트 실패:`, err.message);
    }

    // Firebase 쓰기 API 속도 조율을 위한 짧은 대기 (50ms)
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n==================================================');
  console.log('  Firestore 지점 복구 및 지역 이원화 적용 완료');
  console.log(`  총 대상: ${targets.length}건 | 성공: ${successCount}건 | 실패: ${failCount}건`);
  console.log('==================================================\n');

  process.exit(0);
}

runRestore().catch(err => {
  console.error('❌ 작업 실패:', err);
  process.exit(1);
});
