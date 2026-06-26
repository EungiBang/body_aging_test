import { readFileSync } from 'fs';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';

async function restoreLimits() {
  console.log('🚀 관상/타로 한도 복구 작업을 시작합니다...');

  try {
    // 1. firebase_dump.json에서 과거 지점 목록 파싱
    const rawData = readFileSync('firebase_dump.json', 'utf-8');
    const dump = JSON.parse(rawData);
    const oldBranches = dump.branches || {};
    
    // 2. 현재 활성화된 새 지점 목록 가져오기
    console.log('📦 현재 DB에서 새 지점 목록 불러오는 중...');
    const branchesSnap = await getDocs(collection(db, 'branches'));
    const newBranches: any[] = [];
    branchesSnap.forEach(d => {
      newBranches.push({ id: d.id, ...d.data() });
    });

    console.log(`✅ ${newBranches.length}개의 지점 목록 로드 완료.`);

    let updateCount = 0;

    // 3. 각 새 지점에 대해 구 지점 데이터를 찾아 한도 업데이트
    for (const newBranch of newBranches) {
      // 동일한 이름을 가진 구 지점 데이터 찾기
      const oldId = Object.keys(oldBranches).find(id => oldBranches[id].name === newBranch.name);
      
      if (oldId) {
        const oldBranch = oldBranches[oldId];
        const updateData: any = {};
        
        // 과거 데이터에 kfaceDailyLimit, ktarotDailyLimit 값이 있으면 가져오고, 없으면 무시
        if (oldBranch.kfaceDailyLimit !== undefined) {
          updateData.kfaceDailyLimit = oldBranch.kfaceDailyLimit;
        }
        if (oldBranch.ktarotDailyLimit !== undefined) {
          updateData.ktarotDailyLimit = oldBranch.ktarotDailyLimit;
        }
        
        // 업데이트할 데이터가 있으면 실행
        if (Object.keys(updateData).length > 0) {
          await updateDoc(doc(db, 'branches', newBranch.id), updateData);
          updateCount++;
        }
      }
    }
    
    console.log(`\n🎉 총 ${updateCount}개 지점의 한도 데이터가 과거 기록으로 복원되었습니다.`);
    process.exit(0);

  } catch (err) {
    console.error('❌ 복원 작업 실패:', err);
    process.exit(1);
  }
}

restoreLimits();
