// Firebase에서 members_v4 컬렉션의 전체 회원 데이터를 내려받아 로컬 JSON으로 저장하는 스크립트

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fetchAllMembers() {
  console.log('========================================');
  console.log('  Firebase members_v4 전체 다운로드');
  console.log('========================================\n');

  try {
    // 1. members_v4 전체 Fetch
    console.log('📥 members_v4 컬렉션 다운로드 중...');
    const membersSnap = await getDocs(collection(db, 'members_v4'));
    const members = [];
    membersSnap.forEach((doc) => {
      members.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ members_v4: ${members.length}건 다운로드 완료`);

    // 2. regions 다운로드
    console.log('📥 regions 컬렉션 다운로드 중...');
    const regionsSnap = await getDocs(collection(db, 'regions'));
    const regions = {};
    regionsSnap.forEach((doc) => {
      regions[doc.id] = doc.data();
    });
    console.log(`✅ regions: ${Object.keys(regions).length}건`);

    // 3. branches 다운로드
    console.log('📥 branches 컬렉션 다운로드 중...');
    const branchesSnap = await getDocs(collection(db, 'branches'));
    const branches = {};
    branchesSnap.forEach((doc) => {
      branches[doc.id] = doc.data();
    });
    console.log(`✅ branches: ${Object.keys(branches).length}건`);

    // 4. devices 다운로드
    console.log('📥 devices 컬렉션 다운로드 중...');
    const devicesSnap = await getDocs(collection(db, 'devices'));
    const devices = [];
    devicesSnap.forEach((doc) => {
      devices.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ devices: ${devices.length}건`);

    // 5. liteDevices 다운로드
    console.log('📥 liteDevices 컬렉션 다운로드 중...');
    const liteSnap = await getDocs(collection(db, 'liteDevices'));
    const liteDevices = [];
    liteSnap.forEach((doc) => {
      liteDevices.push({ id: doc.id, ...doc.data() });
    });
    console.log(`✅ liteDevices: ${liteDevices.length}건`);

    // 저장 - members
    const membersPath = 'cleaned_members_v2.json';
    fs.writeFileSync(membersPath, JSON.stringify(members, null, 2), 'utf-8');
    console.log(`\n💾 회원 데이터 저장: ${membersPath} (${members.length}건)`);

    // 저장 - 통합 dump
    const dumpPath = 'firebase_dump_v2.json';
    const dump = { regions, branches, devices, liteDevices };
    fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2), 'utf-8');
    console.log(`💾 통합 덤프 저장: ${dumpPath}`);

    // 기본 통계 출력
    console.log('\n========================================');
    console.log('  기본 통계');
    console.log('========================================');

    // 분석 완료 vs pending 구분
    let analyzed = 0;
    let pending = 0;
    let noReport = 0;
    members.forEach(m => {
      if (!m.report) {
        noReport++;
      } else if (m.id && m.id.startsWith('pending-')) {
        pending++;
      } else {
        analyzed++;
      }
    });
    console.log(`  전체 문서: ${members.length}건`);
    console.log(`  분석 완료: ${analyzed}건`);
    console.log(`  Pending:   ${pending}건`);
    console.log(`  리포트없음: ${noReport}건`);
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ 오류:', err.message);
  }

  process.exit(0);
}

fetchAllMembers();
