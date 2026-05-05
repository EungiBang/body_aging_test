/**
 * 중복 지점 정리 스크립트
 * - 같은 이름의 지점이 2개씩 존재 (seed + import)
 * - 기기(devices)가 연결된 지점 = import 데이터 → 유지
 * - 기기가 없는 지점 = seed 데이터 → 삭제
 * - 지역(regions)도 같은 방식으로 중복 제거
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');

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

async function cleanup() {
  console.log('=== 중복 지점/지역 정리 시작 ===\n');

  // 1. 모든 기기의 branchId 수집 (Import된 진짜 데이터)
  const devicesSnap = await getDocs(collection(db, 'devices'));
  const usedBranchIds = new Set();
  devicesSnap.forEach(d => {
    const data = d.data();
    if (data.branchId) usedBranchIds.add(data.branchId);
  });
  console.log(`📱 기기에서 참조하는 지점 ID: ${usedBranchIds.size}개\n`);

  // 2. 모든 지점 가져오기
  const branchesSnap = await getDocs(collection(db, 'branches'));
  const allBranches = [];
  branchesSnap.forEach(d => {
    allBranches.push({ id: d.id, ...d.data() });
  });
  console.log(`📊 전체 지점: ${allBranches.length}개`);

  // 3. 이름별로 그룹화
  const nameGroups = {};
  allBranches.forEach(b => {
    const name = b.name;
    if (!nameGroups[name]) nameGroups[name] = [];
    nameGroups[name].push(b);
  });

  // 4. 중복 분석 및 삭제 대상 결정
  const toDelete = [];
  const toKeep = [];
  let duplicateNames = 0;

  for (const [name, branches] of Object.entries(nameGroups)) {
    if (branches.length === 1) {
      toKeep.push(branches[0]);
      continue;
    }

    duplicateNames++;
    
    // 기기가 연결된 지점을 우선 유지
    const linked = branches.filter(b => usedBranchIds.has(b.id));
    const unlinked = branches.filter(b => !usedBranchIds.has(b.id));

    if (linked.length > 0) {
      // 기기 연결된 것 유지, 나머지 삭제
      toKeep.push(linked[0]);
      toDelete.push(...unlinked);
      if (linked.length > 1) {
        // 기기가 연결된 것이 여러개면 첫번째만 유지
        toDelete.push(...linked.slice(1));
      }
    } else {
      // 둘 다 기기가 없으면 첫번째 유지
      toKeep.push(branches[0]);
      toDelete.push(...branches.slice(1));
    }
  }

  console.log(`🔍 중복 지점명: ${duplicateNames}개`);
  console.log(`✅ 유지: ${toKeep.length}개`);
  console.log(`🗑️  삭제 대상: ${toDelete.length}개\n`);

  // 5. 삭제 실행
  if (toDelete.length > 0) {
    console.log('--- 삭제 시작 ---');
    for (const b of toDelete) {
      await deleteDoc(doc(db, 'branches', b.id));
      console.log(`  🗑️  삭제: ${b.name} (${b.id})`);
      await new Promise(r => setTimeout(r, 30));
    }
    console.log(`\n✅ ${toDelete.length}개 중복 지점 삭제 완료`);
  }

  // 6. 중복 지역(Regions) 정리
  console.log('\n--- 중복 지역 정리 ---');
  const regionsSnap = await getDocs(collection(db, 'regions'));
  const allRegions = [];
  regionsSnap.forEach(d => {
    allRegions.push({ id: d.id, ...d.data() });
  });
  console.log(`📊 전체 지역: ${allRegions.length}개`);

  // 남은 지점들의 regionId 수집
  const remainingBranches = await getDocs(collection(db, 'branches'));
  const usedRegionIds = new Set();
  remainingBranches.forEach(d => {
    const data = d.data();
    if (data.regionId) usedRegionIds.add(data.regionId);
  });

  const regionsToDelete = allRegions.filter(r => !usedRegionIds.has(r.id));
  console.log(`✅ 사용 중인 지역: ${usedRegionIds.size}개`);
  console.log(`🗑️  미사용 지역: ${regionsToDelete.length}개\n`);

  for (const r of regionsToDelete) {
    await deleteDoc(doc(db, 'regions', r.id));
    console.log(`  🗑️  삭제: ${r.name} (${r.id})`);
    await new Promise(r => setTimeout(r, 30));
  }

  console.log(`\n=== 정리 완료 ===`);
  
  // 최종 확인
  const finalBranches = await getDocs(collection(db, 'branches'));
  const finalRegions = await getDocs(collection(db, 'regions'));
  console.log(`\n📊 최종 결과:`);
  console.log(`   지점: ${finalBranches.size}개`);
  console.log(`   지역: ${finalRegions.size}개`);
  console.log(`   기기: ${devicesSnap.size}개`);

  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ 정리 실패:', err);
  process.exit(1);
});
