// 한국 Firebase branches/regions 원본 복원 스크립트
// firebase_dump_v2.json의 원래 document ID로 복원

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } = require('firebase/firestore');
const fs = require('fs');

const app = initializeApp({
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007"
});
const db = getFirestore(app);

const dump = JSON.parse(fs.readFileSync('d:/antigravity_vibecoding/BT 3바디 ai테스트/firebase_dump_v2.json', 'utf8'));

async function restore() {
  // ========== STEP 1: 현재 데이터 백업 ==========
  console.log('=== STEP 1: 현재 데이터 백업 ===');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const curRegions = await getDocs(collection(db, 'regions'));
  const regBackup = [];
  curRegions.forEach(d => regBackup.push({ docId: d.id, ...d.data() }));
  fs.writeFileSync(`backup_regions_${timestamp}.json`, JSON.stringify(regBackup, null, 2));
  console.log(`regions 백업: ${regBackup.length}개 → backup_regions_${timestamp}.json`);

  const curBranches = await getDocs(collection(db, 'branches'));
  const brBackup = [];
  curBranches.forEach(d => brBackup.push({ docId: d.id, ...d.data() }));
  fs.writeFileSync(`backup_branches_${timestamp}.json`, JSON.stringify(brBackup, null, 2));
  console.log(`branches 백업: ${brBackup.length}개 → backup_branches_${timestamp}.json`);

  // ========== STEP 2: 현재 잘못된 branches 삭제 ==========
  console.log('\n=== STEP 2: 현재 branches 삭제 ===');
  let delCount = 0;
  for (const d of curBranches.docs) {
    await deleteDoc(doc(db, 'branches', d.id));
    delCount++;
  }
  console.log(`${delCount}개 branches 삭제 완료`);

  // 현재 regions도 삭제 (원래 데이터로 교체)
  let regDelCount = 0;
  for (const d of curRegions.docs) {
    await deleteDoc(doc(db, 'regions', d.id));
    regDelCount++;
  }
  console.log(`${regDelCount}개 regions 삭제 완료`);

  // ========== STEP 3: 원래 regions 복원 ==========
  console.log('\n=== STEP 3: 원래 regions 복원 ===');
  const regionKeys = Object.keys(dump.regions);
  for (const rId of regionKeys) {
    const rData = dump.regions[rId];
    await setDoc(doc(db, 'regions', rId), rData);
  }
  console.log(`${regionKeys.length}개 regions 복원 완료`);

  // ========== STEP 4: 원래 branches 복원 (원래 document ID) ==========
  console.log('\n=== STEP 4: 원래 branches 복원 ===');
  const branchKeys = Object.keys(dump.branches);
  for (const bId of branchKeys) {
    const bData = dump.branches[bId];
    await setDoc(doc(db, 'branches', bId), bData);
  }
  console.log(`${branchKeys.length}개 branches 복원 완료 (원래 ID 유지)`);

  // ========== STEP 5: 검증 ==========
  console.log('\n=== STEP 5: 검증 ===');
  const verRegions = await getDocs(collection(db, 'regions'));
  const verBranches = await getDocs(collection(db, 'branches'));
  console.log(`regions: ${verRegions.size}개`);
  console.log(`branches: ${verBranches.size}개`);

  // 깨진 branchId 확인
  const branchIds = new Set();
  verBranches.forEach(d => branchIds.add(d.id));

  const devSnap = await getDocs(collection(db, 'devices'));
  let devOk = 0, devBroken = 0;
  devSnap.forEach(d => {
    if (branchIds.has(d.data().branchId)) devOk++;
    else devBroken++;
  });

  const liteSnap = await getDocs(collection(db, 'lite_devices'));
  let liteOk = 0, liteBroken = 0;
  liteSnap.forEach(d => {
    if (branchIds.has(d.data().branchId)) liteOk++;
    else liteBroken++;
  });

  console.log(`\ndevices: 정상 ${devOk} / 깨진 ${devBroken}`);
  console.log(`lite_devices: 정상 ${liteOk} / 깨진 ${liteBroken}`);
  console.log('\n=== 복원 완료 ===');
  process.exit(0);
}

restore().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
