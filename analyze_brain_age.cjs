// Firebase members_v4에서 뇌나이/마트장보기 데이터를 추출하여 연령별 분별력을 분석하는 스크립트
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function analyzeBrainAgeData() {
  console.log('=== 마트 장보기 & 뇌나이 분별력 분석 ===\n');

  const snapshot = await getDocs(collection(db, 'members_v4'));
  console.log(`전체 회원 수: ${snapshot.size}건\n`);

  const members = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.report && data.report.userInfo) {
      members.push(data);
    }
  });

  // 뇌나이 데이터가 있는 회원만 필터
  const withBrainAge = members.filter(m => 
    m.report?.brainAge != null && m.report?.userInfo?.age != null
  );
  console.log(`뇌나이 데이터 보유 회원: ${withBrainAge.length}건\n`);

  // 연령대별 그룹핑
  const ageGroups = {
    '20대': { min: 20, max: 29, data: [] },
    '30대': { min: 30, max: 39, data: [] },
    '40대': { min: 40, max: 49, data: [] },
    '50대': { min: 50, max: 59, data: [] },
    '60대': { min: 60, max: 69, data: [] },
    '70대': { min: 70, max: 79, data: [] },
    '80대+': { min: 80, max: 120, data: [] },
  };

  withBrainAge.forEach(m => {
    const age = m.report.userInfo.age;
    const brainAge = m.report.brainAge;
    const diff = brainAge - age; // 양수=노화, 음수=젊음
    const overallScore = m.report.overallScore;
    const gender = m.report.userInfo.gender;
    const sourceType = m.sourceType || 'unknown';

    // 마트 장보기 관련 데이터 추출 (images 배열에서)
    let memoryCorrect = null;
    let mathCorrect = null;
    let distractionCorrect = null;

    // report 내부에서 brainAge 관련 정보 추출
    const entry = {
      age, brainAge, diff, overallScore, gender, sourceType,
      name: m.report.userInfo.name || '익명',
    };

    for (const group of Object.values(ageGroups)) {
      if (age >= group.min && age <= group.max) {
        group.data.push(entry);
        break;
      }
    }
  });

  // ─── 연령대별 분석 ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    연령대별 뇌나이 분포 분석');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allDiffs = [];

  Object.entries(ageGroups).forEach(([label, group]) => {
    if (group.data.length === 0) return;

    const diffs = group.data.map(d => d.diff);
    const brainAges = group.data.map(d => d.brainAge);
    const ages = group.data.map(d => d.age);

    const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const avgBrainAge = brainAges.reduce((s, d) => s + d, 0) / brainAges.length;
    const avgAge = ages.reduce((s, d) => s + d, 0) / ages.length;
    const minDiff = Math.min(...diffs);
    const maxDiff = Math.max(...diffs);
    
    // 표준편차 계산
    const variance = diffs.reduce((s, d) => s + Math.pow(d - avgDiff, 2), 0) / diffs.length;
    const stdDev = Math.sqrt(variance);

    // 분별력 지표: 젊게/동일/노화 분포
    const younger = diffs.filter(d => d <= -5).length;
    const similar = diffs.filter(d => d > -5 && d < 5).length;
    const older = diffs.filter(d => d >= 5).length;

    console.log(`━━━ ${label} (${group.data.length}명) ━━━`);
    console.log(`  평균 실제나이: ${avgAge.toFixed(1)}세`);
    console.log(`  평균 뇌나이:   ${avgBrainAge.toFixed(1)}세`);
    console.log(`  평균 차이:     ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)}세`);
    console.log(`  차이 범위:     ${minDiff > 0 ? '+' : ''}${minDiff} ~ ${maxDiff > 0 ? '+' : ''}${maxDiff}세`);
    console.log(`  표준편차:      ${stdDev.toFixed(1)}`);
    console.log(`  분포: 젊게(−5세이상)=${younger}명(${(younger/group.data.length*100).toFixed(0)}%) | 유사(±5)=${similar}명(${(similar/group.data.length*100).toFixed(0)}%) | 노화(+5세이상)=${older}명(${(older/group.data.length*100).toFixed(0)}%)`);
    
    // 개별 데이터 (최대 표시)
    const sorted = [...group.data].sort((a, b) => a.diff - b.diff);
    
    // 가장 젊게 나온 3명
    console.log(`  🟢 가장 젊게: ${sorted.slice(0, 3).map(d => `${d.name}(${d.age}세→뇌${d.brainAge}세, ${d.diff > 0 ? '+' : ''}${d.diff})`).join(', ')}`);
    // 가장 늙게 나온 3명
    console.log(`  🔴 가장 노화: ${sorted.slice(-3).map(d => `${d.name}(${d.age}세→뇌${d.brainAge}세, ${d.diff > 0 ? '+' : ''}${d.diff})`).join(', ')}`);
    console.log('');

    allDiffs.push(...diffs);
  });

  // ─── 전체 분별력 평가 ───
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                      전체 분별력 평가');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalAvgDiff = allDiffs.reduce((s, d) => s + d, 0) / allDiffs.length;
  const totalVariance = allDiffs.reduce((s, d) => s + Math.pow(d - totalAvgDiff, 2), 0) / allDiffs.length;
  const totalStdDev = Math.sqrt(totalVariance);

  // 뇌나이 = 실제나이 ± 2세 이내인 비율 (분별력 부족 지표)
  const tooSimilar = allDiffs.filter(d => Math.abs(d) <= 2).length;
  const tooSimilarPct = (tooSimilar / allDiffs.length * 100).toFixed(1);

  console.log(`전체 평균 차이: ${totalAvgDiff > 0 ? '+' : ''}${totalAvgDiff.toFixed(1)}세`);
  console.log(`전체 표준편차: ${totalStdDev.toFixed(1)}`);
  console.log(`뇌나이 ≈ 실제나이 (±2세 이내): ${tooSimilar}명 / ${allDiffs.length}명 (${tooSimilarPct}%) ← 이 비율이 높으면 분별력 부족`);
  console.log(`뇌나이 ≈ 실제나이 (±5세 이내): ${allDiffs.filter(d => Math.abs(d) <= 5).length}명 (${(allDiffs.filter(d => Math.abs(d) <= 5).length / allDiffs.length * 100).toFixed(1)}%)`);

  // ─── 뇌나이 분포 히스토그램 (텍스트) ───
  console.log('\n--- 뇌나이 차이 분포 히스토그램 ---');
  const bins = {};
  for (let i = -20; i <= 20; i += 5) {
    const key = `${i >= 0 ? '+' : ''}${i} ~ ${i+4 >= 0 ? '+' : ''}${i+4}`;
    bins[key] = allDiffs.filter(d => d >= i && d < i + 5).length;
  }
  Object.entries(bins).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.round(count / allDiffs.length * 100));
    console.log(`  ${range.padStart(10)}: ${bar} ${count}명 (${(count/allDiffs.length*100).toFixed(1)}%)`);
  });

  // ─── PC vs Lite 소스별 비교 ───
  console.log('\n--- PC vs Lite 소스별 뇌나이 비교 ---');
  const pcData = withBrainAge.filter(m => m.sourceType === 'PC');
  const liteData = withBrainAge.filter(m => m.sourceType === 'LITE');
  const unknownData = withBrainAge.filter(m => !m.sourceType || (m.sourceType !== 'PC' && m.sourceType !== 'LITE'));

  const calcStats = (data) => {
    if (data.length === 0) return null;
    const diffs = data.map(m => m.report.brainAge - m.report.userInfo.age);
    const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const stdDev = Math.sqrt(diffs.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / diffs.length);
    return { count: data.length, avgDiff: avg.toFixed(1), stdDev: stdDev.toFixed(1) };
  };

  const pcStats = calcStats(pcData);
  const liteStats = calcStats(liteData);
  const unknownStats = calcStats(unknownData);

  if (pcStats) console.log(`  PC:   ${pcStats.count}명, 평균차이: ${pcStats.avgDiff}세, 표준편차: ${pcStats.stdDev}`);
  if (liteStats) console.log(`  LITE: ${liteStats.count}명, 평균차이: ${liteStats.avgDiff}세, 표준편차: ${liteStats.stdDev}`);
  if (unknownStats) console.log(`  기타: ${unknownStats.count}명, 평균차이: ${unknownStats.avgDiff}세, 표준편차: ${unknownStats.stdDev}`);

  // ─── 만점(뇌나이=20세) 비율 분석 ───
  console.log('\n--- 뇌나이 극단값 분석 ---');
  const brainAge20 = withBrainAge.filter(m => m.report.brainAge <= 25);
  const brainAge80plus = withBrainAge.filter(m => m.report.brainAge >= 80);
  console.log(`  뇌나이 ≤ 25세 (천장 효과): ${brainAge20.length}명 (${(brainAge20.length/withBrainAge.length*100).toFixed(1)}%)`);
  if (brainAge20.length > 0) {
    brainAge20.forEach(m => {
      console.log(`    - ${m.report.userInfo.name}(${m.report.userInfo.age}세) → 뇌${m.report.brainAge}세 [${m.sourceType || '?'}]`);
    });
  }
  console.log(`  뇌나이 ≥ 80세 (바닥 효과): ${brainAge80plus.length}명 (${(brainAge80plus.length/withBrainAge.length*100).toFixed(1)}%)`);
  if (brainAge80plus.length > 0) {
    brainAge80plus.slice(0, 10).forEach(m => {
      console.log(`    - ${m.report.userInfo.name}(${m.report.userInfo.age}세) → 뇌${m.report.brainAge}세 [${m.sourceType || '?'}]`);
    });
    if (brainAge80plus.length > 10) console.log(`    ... 외 ${brainAge80plus.length - 10}명`);
  }

  console.log('\n=== 분석 완료 ===');
  process.exit(0);
}

analyzeBrainAgeData().catch(e => { console.error(e); process.exit(1); });
