/**
 * 잘못 삭제된 3개 지역 복구 스크립트
 * - 본사 (신입경영홍보실)
 * - 경기남부3 (동탄, 영통, 오산, 천천동, 평택)
 * - 제주 (노형, 서귀포, 일도)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, getDoc } = require('firebase/firestore');

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

// 복구해야 할 지점 이름과 지역 매핑
const missingRegions = {
  '본사': ['신입경영홍보실'],
  '경기남부3': ['동탄', '영통', '오산', '천천동', '평택'],
  '제주': ['노형', '서귀포', '일도']
};

async function fix() {
  console.log('=== 삭제된 지역 복구 시작 ===\n');

  // 1. 전체 지점 가져오기
  const branchesSnap = await getDocs(collection(db, 'branches'));
  const allBranches = [];
  branchesSnap.forEach(d => {
    allBranches.push({ id: d.id, ...d.data() });
  });

  // 2. 전체 지역 가져오기
  const regionsSnap = await getDocs(collection(db, 'regions'));
  const existingRegions = {};
  let maxOrder = 0;
  regionsSnap.forEach(d => {
    const data = d.data();
    existingRegions[d.id] = data;
    if (data.order > maxOrder) maxOrder = data.order;
  });
  console.log(`📊 현재 지역: ${Object.keys(existingRegions).length}개, 최대 order: ${maxOrder}`);

  // 3. 각 누락 지역에 대해 처리
  for (const [regionName, branchNames] of Object.entries(missingRegions)) {
    console.log(`\n--- ${regionName} 처리 ---`);
    
    // 해당 지점들 찾기
    const targetBranches = allBranches.filter(b => branchNames.includes(b.name));
    console.log(`  찾은 지점: ${targetBranches.map(b => b.name).join(', ')}`);
    
    if (targetBranches.length === 0) {
      console.log(`  ⚠️ 지점을 찾을 수 없음!`);
      continue;
    }

    // regionId 확인
    const regionIds = [...new Set(targetBranches.map(b => b.regionId))];
    console.log(`  참조하는 regionId: ${regionIds.join(', ')}`);

    for (const regionId of regionIds) {
      // 해당 regionId가 이미 존재하는지 확인
      const exists = existingRegions[regionId];
      if (exists) {
        console.log(`  ✅ 지역 ${regionId} 이미 존재: ${exists.name}`);
      } else {
        // 지역 복구
        maxOrder++;
        const regionData = {
          id: regionId,
          name: regionName,
          order: maxOrder
        };
        await setDoc(doc(db, 'regions', regionId), regionData);
        console.log(`  ✅ 지역 복구: ${regionName} (${regionId}, order: ${maxOrder})`);
      }
    }
  }

  // 4. 최종 확인
  console.log('\n=== 복구 완료 ===');
  const finalRegions = await getDocs(collection(db, 'regions'));
  console.log(`📊 최종 지역 수: ${finalRegions.size}개`);
  finalRegions.forEach(d => {
    const data = d.data();
    console.log(`  ${data.order || '-'}. ${data.name} (${d.id})`);
  });

  // 5. 고아 지점 확인 (regionId가 존재하지 않는 지점)
  const finalRegionIds = new Set();
  finalRegions.forEach(d => finalRegionIds.add(d.id));
  
  const orphanBranches = allBranches.filter(b => b.regionId && !finalRegionIds.has(b.regionId));
  if (orphanBranches.length > 0) {
    console.log(`\n⚠️ 고아 지점 (지역 없음): ${orphanBranches.length}개`);
    orphanBranches.forEach(b => {
      console.log(`  - ${b.name} (regionId: ${b.regionId})`);
    });
  } else {
    console.log(`\n✅ 모든 지점이 정상적인 지역에 연결됨`);
  }

  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 복구 실패:', err);
  process.exit(1);
});
