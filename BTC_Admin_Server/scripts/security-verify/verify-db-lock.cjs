// DB 직접잠금 프로브 (dev 전용, 테섭). 앱을 거치지 않고 Firestore REST에 직접 접근을 시도해
// F3 규칙(클라 직접 접근 차단)이 실제로 적용됐는지 검증한다. dev 서버는 admin ID 토큰 발급용으로만 사용.
//
// [중요] "최종 규칙"(클라 read/write = if false) 기준으로 판정. 테섭에 과도기 규칙(request.auth != null)이
//   걸려 있으면 admin 토큰 read가 200으로 통과해 FAIL이 뜨는 게 정상 — "최종 규칙 미적용" 신호다.
// 사용법: (dev 서버 실행 후) node scripts/security-verify/verify-db-lock.cjs
const API_KEY = 'AIzaSyBRvTVNFzinhKuMp3wrWmCIe3t9cGiCHZw'; // 테섭 웹 apiKey(공개값)
const PROJECT = 'sejong-test-4e285';
const BASE = 'http://localhost:3001';
const ADMIN = { userId: 'testadmin', password: 'TESTADMIN123' };
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const R = [];
const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });

async function exchange(customToken) {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('토큰 교환 실패: ' + JSON.stringify(j));
  return j.idToken;
}
async function readCol(collection, idToken) {
  const h = {};
  if (idToken) h.Authorization = 'Bearer ' + idToken;
  const r = await fetch(`${FS}/${collection}?pageSize=1&key=${API_KEY}`, { headers: h });
  return r.status; // 200=허용, 403=거부(PERMISSION_DENIED)
}
async function writeDoc(collection, idToken) {
  const h = { 'Content-Type': 'application/json' };
  if (idToken) h.Authorization = 'Bearer ' + idToken;
  const r = await fetch(`${FS}/${collection}?documentId=dblockprobe-deleteme&key=${API_KEY}`, {
    method: 'POST', headers: h, body: JSON.stringify({ fields: { probe: { booleanValue: true } } }),
  });
  return r.status; // 200=허용(문제!), 403=거부
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('global fetch 없음 (node 18+ 필요)');
  // admin ID 토큰 = "클라이언트가 쥔 유효한 로그인 토큰". 최종 규칙이면 이 토큰으로도 클라 직접 접근은 거부돼야 한다.
  const al = await fetch(BASE + '/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) }).then((r) => r.json());
  if (!al.token) throw new Error('admin-login 실패: ' + JSON.stringify(al));
  const adminTok = await exchange(al.token);

  // 최종 규칙 기준 기대값 — 클라 직접 접근은 무인증이든 admin 토큰이든 전부 거부(403).
  ok('무인증 read members_v4 → 거부(403)', (await readCol('members_v4')) === 403);
  ok('무인증 read admin_users → 거부(403)', (await readCol('admin_users')) === 403);
  ok('admin토큰(클라) read admin_users → 거부(403, 비번해시 보호)', (await readCol('admin_users', adminTok)) === 403);
  ok('admin토큰(클라) read members_v4 → 거부(403, if false)', (await readCol('members_v4', adminTok)) === 403);
  ok('admin토큰(클라) read ai_feedbacks_v1 → 거부(403)', (await readCol('ai_feedbacks_v1', adminTok)) === 403);
  ok('admin토큰(클라) write members_v4 직접 → 거부(403)', (await writeDoc('members_v4', adminTok)) === 403);

  let all = true;
  for (const r of R) { if (!r.pass) all = false; console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.n + (r.d ? '  [' + r.d + ']' : '')); }
  console.log(`\n=== ${all ? 'ALL PASS (최종 규칙 적용됨)' : 'SOME FAILED (최종 규칙 미적용이거나 규칙 오류 — 위 항목 확인)'} (${R.filter((r) => r.pass).length}/${R.length}) ===`);
  process.exit(all ? 0 : 1);
}
main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
