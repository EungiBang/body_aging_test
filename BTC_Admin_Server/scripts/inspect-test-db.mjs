// [일회용·읽기전용] 테섭(sejong-test-4e285) 현황 점검.
// .env의 FIREBASE_SERVICE_ACCOUNT_PATH(테섭 키)로 Admin SDK 초기화 후
// regions/branches 목록, members_v4 건수, 회원 문서 1건 샘플(모양+대략 크기)을 출력한다.
// 아무것도 쓰지 않는다. 실행: (BTC_Admin_Server 디렉터리에서) node scripts/inspect-test-db.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// .env 파싱 → FIREBASE_SERVICE_ACCOUNT_PATH 추출
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
const saAbs = resolve(adminDir, saPath);
const sa = JSON.parse(readFileSync(saAbs, 'utf8'));
console.log(`[init] project_id = ${sa.project_id}`);
console.log(`[init] SA key      = ${saAbs}`);

initializeApp({ credential: cert(sa) });
const db = getFirestore();

async function main() {
  // regions
  const regionsSnap = await db.collection('regions').get();
  console.log(`\n=== regions (${regionsSnap.size}) ===`);
  regionsSnap.forEach((d) => console.log(`  ${d.id}  |  ${d.data().name ?? '(no name)'}`));

  // branches
  const branchesSnap = await db.collection('branches').get();
  console.log(`\n=== branches (${branchesSnap.size}) ===`);
  branchesSnap.docs.slice(0, 40).forEach((d) => {
    const b = d.data();
    console.log(`  ${d.id}  |  region=${b.regionId ?? '?'}  |  ${b.name ?? '(no name)'}`);
  });
  if (branchesSnap.size > 40) console.log(`  ... (+${branchesSnap.size - 40} more)`);

  // members_v4 count
  const cnt = await db.collection('members_v4').count().get();
  console.log(`\n=== members_v4 count = ${cnt.data().count} ===`);

  // sample member doc (shape + size)
  const sample = await db.collection('members_v4').limit(1).get();
  if (sample.empty) {
    console.log('  (members_v4 is empty — 샘플 없음)');
  } else {
    const doc = sample.docs[0];
    const data = doc.data();
    const bytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
    console.log(`  sample id = ${doc.id}`);
    console.log(`  approx JSON size = ${(bytes / 1024).toFixed(1)} KB`);
    console.log(`  top-level keys = ${Object.keys(data).join(', ')}`);
    if (data.report && typeof data.report === 'object') {
      console.log(`  report keys    = ${Object.keys(data.report).join(', ')}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
