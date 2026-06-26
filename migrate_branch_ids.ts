import { readFileSync } from 'fs';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase'; // 주의: 확장자 생략, ts-node 환경 고려

async function migrate() {
  console.log('🚀 데이터 마이그레이션 시작: 구 지점 ID를 신규 지점 ID로 업데이트합니다.');

  try {
    // 1. firebase_dump.json 읽어서 과거 지점 목록 파싱
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

    console.log(`✅ ${newBranches.length}개의 새 지점 목록 로드 완료.`);

    // 3. 이름(name)을 기준으로 구 ID -> 신규 ID 매핑 테이블 생성
    const oldToNewMap: Record<string, { newBranchId: string, newRegionId: string }> = {};
    let mappedCount = 0;

    for (const oldId of Object.keys(oldBranches)) {
      const oldBranch = oldBranches[oldId];
      // 동일한 이름을 가진 새 지점 찾기
      const matchingNew = newBranches.find(b => b.name === oldBranch.name);
      if (matchingNew) {
        oldToNewMap[oldId] = {
          newBranchId: matchingNew.id,
          newRegionId: matchingNew.regionId
        };
        mappedCount++;
      }
    }
    
    console.log(`✅ ${Object.keys(oldBranches).length}개의 구 지점 중 ${mappedCount}개가 신규 지점명과 매칭되었습니다.`);

    // 4. 각 컬렉션별로 업데이트 수행하는 헬퍼 함수
    const updateCollection = async (collectionName: string) => {
      console.log(`\n🔍 [${collectionName}] 컬렉션 스캔 시작...`);
      const snap = await getDocs(collection(db, collectionName));
      let updateCount = 0;

      for (const d of snap.docs) {
        const data = d.data();
        const branchId = data.branchId;
        
        // branchId가 예전 ID 목록에 있으면 업데이트
        if (branchId && oldToNewMap[branchId]) {
          const mapping = oldToNewMap[branchId];
          const updateData: any = { branchId: mapping.newBranchId };
          
          // 만약 regionId도 가지고 있는 문서라면 같이 업데이트
          if (data.regionId) {
            updateData.regionId = mapping.newRegionId;
          }

          // 피드백 컬렉션처럼 branchId 대신 branchName만 있을 경우도 고려할 수 있지만,
          // 우선 기존에 branchId를 썼으므로 업데이트 대상이 됨.
          await updateDoc(doc(db, collectionName, d.id), updateData);
          updateCount++;
        }
      }
      console.log(`   👉 ${updateCount}개 문서 업데이트 완료.`);
    };

    // 5. 마이그레이션 대상 컬렉션 업데이트
    await updateCollection('devices');
    await updateCollection('lite_devices');
    await updateCollection('members_v4');
    await updateCollection('ai_feedbacks_v1');

    console.log('\n🎉 모든 마이그레이션 작업이 성공적으로 완료되었습니다.');
    process.exit(0);

  } catch (err) {
    console.error('❌ 마이그레이션 실패:', err);
    process.exit(1);
  }
}

migrate();
