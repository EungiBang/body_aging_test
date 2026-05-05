/**
 * 지역 정렬 순서 업데이트 스크립트
 * 사용자가 요청한 특정 순서대로 regions 콜렉션의 order 필드를 업데이트합니다.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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

// 요청하신 정렬 순서
const desiredOrder = [
  '본사',
  '서울강북1',
  '서울강북2',
  '서울강북3',
  '서울강남1',
  '서울강남2',
  '경기북부',
  '경기남부1',
  '경기남부2',
  '경기남부3',
  '인천',
  '강원',
  '대전',
  '충남',
  '충북',
  '대구',
  '경북',
  '부산',
  '울산',
  '경남',
  '전북',
  '광주전남',
  '제주',
  '단무도'
];

async function updateOrder() {
  console.log('=== 지역 정렬 순서 업데이트 시작 ===\n');

  // 1. 전체 지역 문서 가져오기
  const regionsSnap = await getDocs(collection(db, 'regions'));
  const regionsByName = {};
  
  regionsSnap.forEach(d => {
    const data = d.data();
    regionsByName[data.name] = { id: d.id, ...data };
  });

  // 2. 순서에 맞춰 업데이트
  let updatedCount = 0;
  for (let i = 0; i < desiredOrder.length; i++) {
    const regionName = desiredOrder[i];
    const orderValue = i + 1; // 1부터 시작
    
    const region = regionsByName[regionName];
    if (region) {
      if (region.order !== orderValue) {
        await updateDoc(doc(db, 'regions', region.id), { order: orderValue });
        console.log(`✅ [${orderValue}] ${regionName} (업데이트됨)`);
        updatedCount++;
        await new Promise(r => setTimeout(r, 30));
      } else {
        console.log(`⏭️ [${orderValue}] ${regionName} (이미 올바른 순서)`);
      }
    } else {
      console.log(`⚠️ 지역을 찾을 수 없음: ${regionName}`);
    }
  }

  // 3. 목록에 없는 기타 지역 확인 (있는 경우 마지막으로 정렬)
  let extraOrder = desiredOrder.length + 1;
  for (const [name, region] of Object.entries(regionsByName)) {
    if (!desiredOrder.includes(name)) {
      await updateDoc(doc(db, 'regions', region.id), { order: extraOrder });
      console.log(`✅ [${extraOrder}] ${name} (기타 지역으로 맨 뒤로 이동)`);
      extraOrder++;
      updatedCount++;
    }
  }

  console.log(`\n=== 업데이트 완료 (총 ${updatedCount}개 항목 수정됨) ===`);
  process.exit(0);
}

updateOrder().catch(err => {
  console.error('❌ 업데이트 실패:', err);
  process.exit(1);
});
