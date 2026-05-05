/**
 * 지역 중복 최종 정리
 * - 같은 이름의 지역이 2개(시드 + import)
 * - 모든 지점의 regionId를 import 형식(region_서울강북1)으로 통일
 * - 시드 형식(region_1777...) 지역 삭제
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } = require('firebase/firestore');

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
  console.log('=== 지역 중복 최종 정리 ===\n');

  // 1. 전체 지역 가져오기
  const regionsSnap = await getDocs(collection(db, 'regions'));
  const allRegions = [];
  regionsSnap.forEach(d => {
    allRegions.push({ id: d.id, ...d.data() });
  });

  // 2. 시드 지역 (region_1777...)과 import 지역 (region_이름) 분류
  const seedRegions = allRegions.filter(r => r.id.startsWith('region_1777'));
  const importRegions = allRegions.filter(r => !r.id.startsWith('region_1777'));

  console.log(`시드 지역: ${seedRegions.length}개`);
  console.log(`Import 지역: ${importRegions.length}개\n`);

  // 3. 시드 → import 매핑 (이름으로)
  const importRegionByName = {};
  importRegions.forEach(r => {
    importRegionByName[r.name] = r;
  });

  const seedToImportMap = {}; // seedId → importId
  for (const seed of seedRegions) {
    const target = importRegionByName[seed.name];
    if (target) {
      seedToImportMap[seed.id] = target.id;
    }
  }

  console.log(`매핑 가능: ${Object.keys(seedToImportMap).length}개\n`);

  // 4. 시드 regionId를 참조하는 지점들의 regionId를 import ID로 변경
  const branchesSnap = await getDocs(collection(db, 'branches'));
  let updatedCount = 0;

  for (const d of branchesSnap.docs) {
    const data = d.data();
    const currentRegionId = data.regionId;
    
    if (seedToImportMap[currentRegionId]) {
      const newRegionId = seedToImportMap[currentRegionId];
      await updateDoc(doc(db, 'branches', d.id), { regionId: newRegionId });
      updatedCount++;
      console.log(`  📝 ${data.name}: ${currentRegionId} → ${newRegionId}`);
      await new Promise(r => setTimeout(r, 30));
    }
  }
  console.log(`\n✅ ${updatedCount}개 지점 regionId 업데이트 완료`);

  // 5. 시드 지역 삭제 (매핑된 것만)
  console.log('\n--- 시드 지역 삭제 ---');
  let deletedCount = 0;
  for (const seed of seedRegions) {
    if (seedToImportMap[seed.id]) {
      await deleteDoc(doc(db, 'regions', seed.id));
      console.log(`  🗑️ ${seed.name} (${seed.id})`);
      deletedCount++;
    } else {
      // 매핑 안 되는 시드 지역 (import에 없는 지역)도 확인
      console.log(`  ⚠️ 매핑 불가: ${seed.name} (${seed.id}) - import에 해당 지역 없음`);
    }
  }
  console.log(`\n✅ ${deletedCount}개 시드 지역 삭제 완료`);

  // 6. 최종 확인
  console.log('\n=== 최종 결과 ===');
  const finalRegions = await getDocs(collection(db, 'regions'));
  const finalBranches = await getDocs(collection(db, 'branches'));

  // 고아 확인
  const finalRegionIds = new Set();
  finalRegions.forEach(d => finalRegionIds.add(d.id));
  
  let orphanCount = 0;
  finalBranches.forEach(d => {
    if (d.data().regionId && !finalRegionIds.has(d.data().regionId)) orphanCount++;
  });

  // 지역별 지점 수 집계
  const regionBranchCount = {};
  finalBranches.forEach(d => {
    const rid = d.data().regionId;
    regionBranchCount[rid] = (regionBranchCount[rid] || 0) + 1;
  });

  console.log(`📊 지역: ${finalRegions.size}개`);
  console.log(`📊 지점: ${finalBranches.size}개`);
  console.log(`📊 고아 지점: ${orphanCount}개\n`);

  // 정렬된 출력
  const sortedRegions = [];
  finalRegions.forEach(d => sortedRegions.push({ id: d.id, ...d.data() }));
  sortedRegions.sort((a, b) => (a.order || 99) - (b.order || 99));
  
  for (const r of sortedRegions) {
    const count = regionBranchCount[r.id] || 0;
    console.log(`  ${String(r.order).padStart(2)}. ${r.name} — ${count}개 지점`);
  }

  process.exit(0);
}

fix().catch(err => {
  console.error('❌ 실패:', err);
  process.exit(1);
});
