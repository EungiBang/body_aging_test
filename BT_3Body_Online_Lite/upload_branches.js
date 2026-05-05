import { readFileSync } from 'fs';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase.ts';

async function seedDatabase() {
  console.log('🚀 BTC 지역/지점 데이터 Firebase 일괄 등록을 시작합니다...');
  console.log('⚠️  기존 regions / branches 컬렉션을 초기화 후 다시 등록합니다.\n');

  try {
    // 1. JSON 파일 읽기
    const rawData = readFileSync('branch_seed_data.json', 'utf-8');
    const seedData = JSON.parse(rawData);

    // 2. 기존 데이터 삭제
    console.log('🗑️  기존 regions 삭제 중...');
    const oldRegions = await getDocs(collection(db, 'regions'));
    for (const d of oldRegions.docs) {
      await deleteDoc(doc(db, 'regions', d.id));
    }
    console.log(`   ${oldRegions.size}개 삭제 완료`);

    console.log('🗑️  기존 branches 삭제 중...');
    const oldBranches = await getDocs(collection(db, 'branches'));
    for (const d of oldBranches.docs) {
      await deleteDoc(doc(db, 'branches', d.id));
    }
    console.log(`   ${oldBranches.size}개 삭제 완료\n`);

    // 3. 새 데이터 등록
    let regionCount = 0;
    let branchCount = 0;

    for (const entry of seedData) {
      const regionName = entry.region;
      const branches = entry.branches;

      // 지역 ID 생성 및 저장
      const regionId = `region_${regionName.replace(/\s/g, '_')}`;
      await setDoc(doc(db, 'regions', regionId), {
        id: regionId,
        name: regionName,
        order: regionCount
      });
      regionCount++;
      console.log(`📍 [지역] ${regionName} (${branches.length}개 지점)`);

      // 지점 저장
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

    console.log(`\n✅ 등록 완료! 총 ${regionCount}개 지역, ${branchCount}개 지점`);
    process.exit(0);

  } catch (err) {
    console.error('❌ 오류 발생:', err);
    process.exit(1);
  }
}

seedDatabase();
