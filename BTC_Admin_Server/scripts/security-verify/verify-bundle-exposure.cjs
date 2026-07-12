// 번들 시크릿 노출 검사 (dev 전용, 테섭). `npm run build` 후 dist/assets/*.js 를 검사한다.
// 목적: 서버 전용 자격(서비스계정 개인키)이 클라 번들에 없고, M2에서 지운 죽은 Gemini 코드가 실제로 빠졌는지 확인.
// 사용법: npm run build && node scripts/security-verify/verify-bundle-exposure.cjs
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '../../dist/assets');

// [HARD 금지] 번들에 있으면 FAIL — 서버 전용 자격이 클라로 샌 것.
const FORBIDDEN = [
  { label: '서비스계정 개인키(private_key)', pat: 'private_key' },
  { label: '개인키 PEM 헤더', pat: 'BEGIN PRIVATE KEY' },
  { label: '서비스계정 client_email(firebase-adminsdk)', pat: 'firebase-adminsdk' },
];

// [M2 회귀 확인] 죽은 측정/Gemini 코드가 번들에 남아있으면 삭제가 불완전 → 노출.
const REGRESSION = [
  { label: '죽은 geminiService 프록시 URL', pat: 'outdoor-lite.vercel.app/api/analyze' },
  { label: 'Gemini 직접 호출 엔드포인트', pat: 'generativelanguage.googleapis.com' },
];

// [정상] 있어도 되는 것(검사 안 함): Firebase 웹 apiKey(AIza...)는 설계상 공개값 — 보안은 Firestore 규칙이 담당.

function bundleText() {
  if (!fs.existsSync(DIST)) throw new Error('dist/assets 없음 — 먼저 `npm run build` 를 실행하세요.');
  return fs.readdirSync(DIST)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(DIST, f), 'utf8'))
    .join('\n');
}

const txt = bundleText();
let fail = 0;
console.log('=== 번들 노출 검사 (dist/assets) ===');
console.log('\n[HARD 금지 — 없어야 정상]');
for (const { label, pat } of FORBIDDEN) {
  const found = txt.includes(pat);
  if (found) fail++;
  console.log(`${found ? 'FAIL 발견됨' : 'PASS 없음  '} - ${label}  [${pat}]`);
}
console.log('\n[M2 회귀 — 죽은 코드 잔재, 없어야 정상]');
for (const { label, pat } of REGRESSION) {
  const found = txt.includes(pat);
  if (found) fail++;
  console.log(`${found ? 'FAIL 잔재있음' : 'PASS 없음  '} - ${label}  [${pat}]`);
}
console.log(`\n=== ${fail === 0 ? 'ALL PASS' : 'FAIL(' + fail + ')'} ===`);
process.exit(fail === 0 ? 0 : 1);
