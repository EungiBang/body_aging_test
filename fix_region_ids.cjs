/**
 * 지역 ID 통합 스크립트
 * - Import된 지점들이 참조하는 regionId(region_서울강북1 등)에 맞춰
 *   지역 문서를 재생성하고, 시드 형식의 중복 지역을 삭제
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } = require('firebase/firestore');

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

async function fix() {
  console.log('=== 지역 ID 통합 시작 ===\n');

  // 1. 전체 지점에서 참조하는 regionId 수집
  const branchesSnap = await getDocs(collection(db, 'branches'));
  const regionIdToBranches = {};
  branchesSnap.forEach(d => {
    const data = d.data();
    const rid = data.regionId;
    if (rid) {
      if (!regionIdToBranches[rid]) regionIdToBranches[rid] = [];
      regionIdToBranches[rid].push(data.name);
    }
  });
  
  console.log(`📊 지점이 참조하는 고유 regionId: ${Object.keys(regionIdToBranches).length}개\n`);

  // 2. 현재 지역 문서 가져오기
  const regionsSnap = await getDocs(collection(db, 'regions'));
  const existingRegions = {};
  regionsSnap.forEach(d => {
    existingRegions[d.id] = d.data();
  });
  console.log(`📊 현재 지역 문서: ${Object.keys(existingRegions).length}개\n`);

  // 3. 지점이 참조하지만 지역 문서가 없는 regionId 찾기
  const missingRegionIds = Object.keys(regionIdToBranches).filter(rid => !existingRegions[rid]);
  console.log(`⚠️ 누락된 지역 ID: ${missingRegionIds.length}개`);

  // 4. 기존 지역에서 이름 매핑 (시드 지역 이름 → order)
  const nameToRegionData = {};
  for (const [id, data] of Object.entries(existingRegions)) {
    nameToRegionData[data.name] = { id, ...data };
  }

  // 5. 누락된 지역 생성 (regionId에서 이름 추출)
  for (const rid of missingRegionIds) {
    // region_서울강북1 → 서울강북1
    const regionName = rid.replace('region_', '');
    
    // 기존 시드 지역에서 order 가져오기
    const existing = nameToRegionData[regionName];
    const order = existing ? existing.order : 99;

    await setDoc(doc(db, 'regions', rid), {
      id: rid,
      name: regionName,
      order: order
    });
    console.log(`  ✅ 생성: ${regionName} (${rid}, order: ${order}) → 지점 ${regionIdToBranches[rid].length}개`);
  }

  // 6. 시드 형식의 지역 삭제 (더 이상 지점이 참조하지 않는 것)
  console.log('\n--- 미참조 시드 지역 삭제 ---');
  const seedRegions = Object.entries(existingRegions).filter(([id]) => 
    id.startsWith('region_1777') // 시드 스크립트가 생성한 ID 패턴
  );
  
  for (const [id, data] of seedRegions) {
    if (!regionIdToBranches[id]) {
      await deleteDoc(doc(db, 'regions', id));
      console.log(`  🗑️ 삭제: ${data.name} (${id})`);
    } else {
      console.log(`  ⏭️ 유지: ${data.name} (${id}) - 지점 ${regionIdToBranches[id].length}개 참조 중`);
    }
  }

  // 7. 최종 확인
  console.log('\n=== 최종 결과 ===');
  const finalRegions = await getDocs(collection(db, 'regions'));
  const finalBranches = await getDocs(collection(db, 'branches'));
  
  // 고아 지점 확인
  const finalRegionIds = new Set();
  finalRegions.forEach(d => finalRegionIds.add(d.id));
  
  let orphanCount = 0;
  finalBranches.forEach(d => {
    const data = d.data();
    if (data.regionId && !finalRegionIds.has(data.regionId)) {
      orphanCount++;
    }
  });

  console.log(`📊 지역: ${finalRegions.size}개`);
  console.log(`📊 지점: ${finalBranches.size}개`);
  console.log(`📊 고아 지점: ${orphanCount}개`);
  
  finalRegions.forEach(d => {
    const data = d.data();
    const branchCount = regionIdToBranches[d.id]?.length || 0;
    console.log(`  ${String(data.order).padStart(2)}. ${data.name} (${branchCount}개 지점)`);
  });

  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 실패:', err);
  process.exit(1);
});
