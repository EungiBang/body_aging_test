// 미국 센터 데이터를 Firebase Firestore에 업로드하는 스크립트 (CommonJS)
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, deleteDoc } = require('firebase/firestore');
const { readFileSync } = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyCbKyrfYc8DETYRP7g3ywCRUQEI4FQ6feE",
  authDomain: "btc-3body-usa-test.firebaseapp.com",
  projectId: "btc-3body-usa-test",
  storageBucket: "btc-3body-usa-test.firebasestorage.app",
  messagingSenderId: "879024036478",
  appId: "1:879024036478:web:60dff48884605b412b162f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadUSBranches() {
  console.log('🚀 US Region/Center data upload to Firebase starting...');
  console.log('⚠️  Clearing existing regions/branches and re-uploading with US data.\n');

  try {
    const rawData = readFileSync('./branch_seed_data.json', 'utf-8');
    const seedData = JSON.parse(rawData);

    // 1. 기존 데이터 삭제
    console.log('🗑️  Deleting existing regions...');
    const oldRegions = await getDocs(collection(db, 'regions'));
    for (const d of oldRegions.docs) {
      await deleteDoc(doc(db, 'regions', d.id));
    }
    console.log(`   ${oldRegions.size} regions deleted`);

    console.log('🗑️  Deleting existing branches...');
    const oldBranches = await getDocs(collection(db, 'branches'));
    for (const d of oldBranches.docs) {
      await deleteDoc(doc(db, 'branches', d.id));
    }
    console.log(`   ${oldBranches.size} branches deleted\n`);

    // 2. 미국 데이터 등록
    let regionCount = 0;
    let branchCount = 0;

    for (const entry of seedData) {
      const regionName = entry.region;
      const branches = entry.branches;

      // Region ID: 특수문자와 공백을 언더스코어로 변환
      const regionId = `region_${regionName.replace(/[\s,./]+/g, '_')}`;
      await setDoc(doc(db, 'regions', regionId), {
        id: regionId,
        name: regionName,
        order: regionCount
      });
      regionCount++;
      console.log(`📍 [Region] ${regionName} (${branches.length} centers)`);

      for (const branch of branches) {
        const branchDocRef = doc(collection(db, 'branches'));
        await setDoc(branchDocRef, {
          id: branchDocRef.id,
          regionId: regionId,
          name: branch.name,
          allowedLicenses: branch.allowedLicenses || 2
        });
        branchCount++;
      }
    }

    console.log(`\n✅ Upload complete! Total: ${regionCount} regions, ${branchCount} centers`);
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

uploadUSBranches();
