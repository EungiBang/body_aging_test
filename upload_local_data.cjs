/**
 * 로컬 Electron 앱의 회원 DB를 새 Firebase 서버로 업로드하는 스크립트
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const newConfig = {
  apiKey: "AIzaSyAqxJeIxtz8Ta36llqp47VZuSpFo0JX4Y4",
  authDomain: "btc-3body-server.firebaseapp.com",
  projectId: "btc-3body-server",
  storageBucket: "btc-3body-server.firebasestorage.app",
  messagingSenderId: "671751957894",
  appId: "1:671751957894:web:1e0ae3e3291197dc3c5007"
};

const app = initializeApp(newConfig);
const db = getFirestore(app);

async function main() {
  // 로컬 회원 데이터 읽기
  const appDataPath = path.join(process.env.APPDATA, 'btc-3body-ai-analyzer');
  const membersPath = path.join(appDataPath, 'members-db-v4.json');
  const authPath = path.join(appDataPath, 'auth.json');

  console.log('========================================');
  console.log('  로컬 DB → 새 서버 업로드');
  console.log('========================================\n');

  // 1. 회원 데이터 업로드
  if (fs.existsSync(membersPath)) {
    const rawData = fs.readFileSync(membersPath, 'utf-8');
    const members = JSON.parse(rawData);
    console.log(`📋 회원 데이터: ${members.length}명 발견\n`);

    let count = 0;
    let errors = 0;
    
    for (const member of members) {
      try {
        // 회원 ID가 있으면 그것을 사용, 없으면 생성
        const memberId = member.id || `member_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Firestore에 저장
        await setDoc(doc(db, 'members_v4', memberId), {
          ...member,
          id: memberId
        });
        
        count++;
        if (count % 10 === 0) {
          process.stdout.write(`   ✅ ${count}/${members.length} 업로드 중...\r`);
        }
        
        // Firebase 쓰기 제한 방지
        await new Promise(r => setTimeout(r, 30));
      } catch (err) {
        errors++;
        if (errors <= 3) console.error(`   ❌ 오류:`, err.message);
      }
    }
    
    console.log(`\n✅ 회원 데이터 업로드 완료: ${count}명 성공, ${errors}명 실패`);
  } else {
    console.log('⚠️ members-db-v4.json 파일을 찾을 수 없습니다.');
  }

  // 2. 기기 인증 정보 업로드
  if (fs.existsSync(authPath)) {
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    console.log(`\n📱 기기 인증 데이터 발견:`, JSON.stringify(authData, null, 2));
    
    if (authData.hardwareId) {
      await setDoc(doc(db, 'devices', authData.hardwareId), {
        branchId: authData.branchId || '',
        adminName: authData.adminName || '',
        contact: authData.contact || '',
        status: 'active',
        appVersion: authData.appVersion || '5.0.4',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
      });
      console.log(`   ✅ 기기 등록 완료: ${authData.hardwareId}`);
    }
  }

  console.log('\n========================================');
  console.log('  업로드 완료!');
  console.log('========================================');
  
  process.exit(0);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
