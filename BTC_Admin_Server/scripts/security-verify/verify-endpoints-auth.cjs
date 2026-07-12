// 엔드포인트 인증 매트릭스 검사 (dev 전용, 테섭). dev 서버(localhost:3001)가 떠 있어야 함.
// 목적: 모든 /api/* 가 의도한 인증 등급대로 동작하는지 한 번에 확인.
//   - 보호됨:  무토큰 → 401 (인증이 로직보다 먼저 → NOOP action이라 side-effect 없음)
//   - 공개:    무토큰이어도 401 아님 (errorlog: best-effort)
//   - 양성:    유효 admin 토큰이면 통과(401/403 아님)
// ※ 관리자 앱엔 기기 등록(/api/register)이 없어 device 토큰 계층은 검증 대상 아님(admin 토큰만 발급됨).
// 사용법: (dev 서버 실행 후) node scripts/security-verify/verify-endpoints-auth.cjs
const API_KEY = 'AIzaSyBRvTVNFzinhKuMp3wrWmCIe3t9cGiCHZw'; // 테섭 웹 apiKey(공개값)
const BASE = 'http://localhost:3001';
const ADMIN = { userId: 'testadmin', password: 'TESTADMIN123' };

// 무토큰 → 401 이어야 하는 보호 엔드포인트 전체(관리자 전용 + device·admin 공통).
const PROTECTED = [
  '/api/usage', '/api/stats', '/api/sync',
  '/api/devices', '/api/admin-config', '/api/admin-users',
  '/api/admin-errorlog', '/api/admin-members', '/api/admin-events', '/api/admin-feedbacks',
];
// 무토큰이어도 401 아님(의도적 공개, best-effort).
const PUBLIC_POST = ['/api/errorlog'];

const R = [];
const ok = (n, c, d) => R.push({ n, pass: !!c, d: d || '' });

async function post(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return r.status;
}
async function exchange(customToken) {
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API_KEY, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('토큰 교환 실패: ' + JSON.stringify(j));
  return j.idToken;
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('global fetch 없음 (node 18+ 필요)');

  // admin 토큰 준비(로그인 → 커스텀토큰 → ID토큰)
  const al = await fetch(BASE + '/api/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) }).then((r) => r.json());
  if (!al.token) throw new Error('admin-login 실패: ' + JSON.stringify(al));
  const adminTok = await exchange(al.token);

  const NOOP = { action: '__verify_noop__' }; // 인증 통과 후 400(unknown action)으로 떨어짐 → side-effect 없음

  // 보호: 무토큰 → 401
  for (const ep of PROTECTED) ok(`PROTECTED 무토큰 401  ${ep}`, (await post(ep, NOOP)) === 401);
  // 공개: 무토큰이어도 401 아님
  for (const ep of PUBLIC_POST) { const s = await post(ep, {}); ok(`PUBLIC 무토큰 !=401 ${ep}`, s !== 401, 'status=' + s); }

  // 양성: 유효 admin 토큰이면 통과(401/403 아님)
  const dv = await post('/api/devices', { action: 'list' }, adminTok); ok('POSITIVE admin 통과 /api/devices', dv !== 401 && dv !== 403, 'status=' + dv);
  const us = await post('/api/usage', { action: 'getStatus', branchId: 'test-branch-01', today: '2026-07-11' }, adminTok); ok('POSITIVE admin 통과 /api/usage', us !== 401 && us !== 403, 'status=' + us);
  const fb = await post('/api/admin-feedbacks', { action: 'list' }, adminTok); ok('POSITIVE admin 통과 /api/admin-feedbacks', fb !== 401 && fb !== 403, 'status=' + fb);

  let all = true;
  for (const r of R) { if (!r.pass) all = false; console.log((r.pass ? 'PASS' : 'FAIL') + ' - ' + r.n + (r.d ? '  [' + r.d + ']' : '')); }
  console.log(`\n=== ${all ? 'ALL PASS' : 'SOME FAILED'} (${R.filter((r) => r.pass).length}/${R.length}) ===`);
  process.exit(all ? 0 : 1);
}
main().catch((e) => { console.error('SCRIPT ERROR:', e.message); process.exit(2); });
