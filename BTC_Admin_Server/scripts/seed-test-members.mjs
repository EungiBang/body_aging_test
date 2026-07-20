// [일회용] 테섭(sejong-test-4e285) members_v4에 성능테스트용 더미 회원 시딩.
// 실제 회원 문서 모양(~8–9KB, report 키 세트)을 재현해 slim 프로젝션 vs 전체 문서 전송량 차이를 측정 가능하게 한다.
//
// 안전장치: 모든 더미에 __seed:true 마커 + 문서ID 'seed_######' 접두.
//   - 시딩(기본 10000):  node scripts/seed-test-members.mjs
//   - 시딩(N건만):       node scripts/seed-test-members.mjs 1
//   - 정리:              node scripts/seed-test-members.mjs cleanup   (→ __seed==true 만 삭제, 기존 실데이터는 무손상)
//
// .env의 FIREBASE_SERVICE_ACCOUNT_PATH(테섭 키)만 사용 → 테섭에만 쓴다. 실섭 자격증명은 로컬에 없음.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvVar(key) {
  const env = readFileSync(resolve(adminDir, '.env'), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[1] === key) return m[2].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const saPath = readEnvVar('FIREBASE_SERVICE_ACCOUNT_PATH');
if (!saPath) { console.error('FIREBASE_SERVICE_ACCOUNT_PATH not found in .env'); process.exit(1); }
const sa = JSON.parse(readFileSync(resolve(adminDir, saPath), 'utf8'));
if (sa.project_id !== 'sejong-test-4e285') {
  console.error(`[안전중단] 예상과 다른 프로젝트: ${sa.project_id} (테섭 sejong-test-4e285 아님). 중단.`);
  process.exit(1);
}
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── 설정 ──────────────────────────────────────────────
const COUNT = 10000;
const BATCH = 500;
const SEED_MARKER = '__seed';

// 테섭 실제 지점/지역 (inspect-test-db.mjs로 확인). 광화문(서울) 가중.
const BRANCHES = [
  { id: 'h91su4p8vqzhEzwWGmo7', regionId: 'hwspCqwPw5xhjGWJN1BA', w: 4 }, // 광화문 / 서울
  { id: 'test-branch-01', regionId: 'test-region', w: 2 },
  { id: 'test-branch-02', regionId: 'test-region', w: 2 },
  { id: 'test-branch-pc-001', regionId: 'test-region', w: 2 },
];
const BRANCH_PICK = BRANCHES.flatMap((b) => Array(b.w).fill(b));
const EVENT_CODES = ['UNION-A', 'UNION-B', 'UNION-C'];

const SURNAMES = '김이박최정강조윤장임'.split('');
const GIVEN = '민준서연도윤하은지우예은시우주원하준지호수아'.split('');
const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];
const koName = () => pick(SURNAMES) + pick(GIVEN) + pick(GIVEN);
const phone = () => `010-${String(1000 + rand(9000))}-${String(1000 + rand(9000))}`;

// 긴 문단 생성 (실제 AI 리포트 텍스트 무게 재현)
const LOREM = '신체 정렬과 자세 균형을 종합적으로 평가한 결과 전반적인 컨디션은 양호하나 일부 영역에서 개선이 필요합니다. 코어 안정성과 하지 근력의 균형을 고려한 맞춤 프로그램을 권장하며 꾸준한 관리로 기능적 나이를 낮출 수 있습니다. ';
const para = (times) => LOREM.repeat(times);

// 측정일 분포: 5% 오늘, 5% 어제, 30% 이번달, 60% 이전
function makeTestDate() {
  const now = new Date();
  const r = Math.random();
  let d;
  if (r < 0.05) d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9 + rand(9), rand(60));
  else if (r < 0.10) d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 9 + rand(9), rand(60));
  else if (r < 0.40) d = new Date(now.getFullYear(), now.getMonth(), 1 + rand(Math.max(1, now.getDate() - 1)), 9 + rand(9), rand(60));
  else d = new Date(now.getTime() - (30 + rand(300)) * 86400000);
  return d.toISOString();
}

function makeReport(name, age, gender, dateISO) {
  const s = (base) => base + rand(20);
  return {
    id: 'rep_' + Math.random().toString(36).slice(2),
    date: dateISO,
    userInfo: { name, phone: phone(), age, gender },
    physicalAge: s(age - 5), brainAge: s(age - 3), mindAge: s(age - 4),
    faceAgeEstimate: s(age - 2), comprehensiveAge: s(age - 3),
    overallScore: 40 + rand(56), postureScore: 40 + rand(56),
    summary: para(3),
    bodyTypeAnalysis: para(3),
    brainTestEvaluation: para(3),
    brainHealthImplication: para(2),
    programRecommendation: para(2),
    threeBodyAnalysis: para(3),
    bodyAlignmentAnalysis: para(2),
    faceAnalysis: { description: para(2), symmetry: 60 + rand(40), skinAge: s(age) },
    agingMetrics: { cardio: rand(100), flexibility: rand(100), strength: rand(100), balance: rand(100) },
    postureMetrics: { shoulderTilt: rand(10), pelvicTilt: rand(10), headForward: rand(15) },
    kwangmyungChakra: { level: 1 + rand(7), balance: rand(100), note: para(1) },
    recommendations: Array.from({ length: 6 }, (_, i) => `권장사항 ${i + 1}: ` + para(1)),
    sevenCodeAnalysis: Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`code${i + 1}`, { score: rand(100), label: `코드${i + 1}`, description: para(1) }])
    ),
  };
}

function makeMember(idx) {
  const br = pick(BRANCH_PICK);
  const gender = Math.random() < 0.5 ? 'male' : 'female';
  const age = 20 + rand(51);
  const dateISO = makeTestDate();
  const isPending = Math.random() < 0.10;
  const isLite = Math.random() < 0.30;
  const baseName = koName();
  const name = isPending ? `(분석 대기) ${baseName}` : baseName;
  const report = makeReport(baseName, age, gender, dateISO);
  return {
    [SEED_MARKER]: true,
    name,
    phone: phone(),
    sourceType: isLite ? 'LITE' : 'PC',
    branchId: br.id,
    regionId: br.regionId,
    eventCode: Math.random() < 0.15 ? pick(EVENT_CODES) : null,
    lastTestDate: dateISO,
    hardwareId: 'seed-hw-' + (1000 + rand(9000)),
    ownerUid: 'seed-owner',
    syncedAt: Date.now(),
    report,
  };
}

async function seed(count = COUNT) {
  console.log(`[seed] target = ${count} docs into members_v4 (project ${sa.project_id})`);
  let written = 0;
  for (let start = 0; start < count; start += BATCH) {
    const batch = db.batch();
    const end = Math.min(start + BATCH, count);
    let firstBytes = 0;
    for (let i = start; i < end; i++) {
      const doc = makeMember(i);
      if (i === 0) firstBytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
      const id = 'seed_' + String(i + 1).padStart(6, '0');
      batch.set(db.collection('members_v4').doc(id), doc);
    }
    await batch.commit();
    written = end;
    if (start === 0) console.log(`[seed] approx doc size = ${(firstBytes / 1024).toFixed(1)} KB → est. total ${(firstBytes * count / 1024 / 1024).toFixed(1)} MB (full)`);
    console.log(`[seed] ${written}/${count}`);
  }
  console.log(`[seed] done. ${written} dummy members written (all marked ${SEED_MARKER}=true).`);
}

async function cleanup() {
  console.log(`[cleanup] deleting ${SEED_MARKER}==true docs from members_v4 (project ${sa.project_id})`);
  let total = 0;
  while (true) {
    const snap = await db.collection('members_v4').where(SEED_MARKER, '==', true).limit(BATCH).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    console.log(`[cleanup] deleted ${total}`);
  }
  console.log(`[cleanup] done. ${total} seed docs removed.`);
}

const mode = process.argv[2];
let action;
if (mode === 'cleanup') {
  action = cleanup();
} else {
  const n = Number.parseInt(mode, 10);
  action = seed(Number.isFinite(n) && n > 0 ? n : COUNT);
}
action.then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
