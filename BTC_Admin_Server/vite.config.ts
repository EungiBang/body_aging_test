import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3001,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        {
          // 로컬 dev에서 /api/admin-login 을 서버리스 함수 대신 처리 (Vercel 없이 관리자 로그인 테스트용).
          // 운영은 api/admin-login.ts(Vercel 함수)가 담당 — 둘 다 api/_admin-core.ts 동일 로직 공유.
          name: 'local-admin-api',
          configureServer(server) {
            // 코어 모듈(_firebase-admin)이 읽을 수 있도록 .env의 서비스 계정 자격을 process.env로 노출
            if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
              process.env.FIREBASE_SERVICE_ACCOUNT_PATH = env.FIREBASE_SERVICE_ACCOUNT_PATH;
            }
            if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
              process.env.FIREBASE_SERVICE_ACCOUNT_JSON = env.FIREBASE_SERVICE_ACCOUNT_JSON;
            }

            // /api/admin-login — 관리자 로그인 (운영 api/admin-login.ts와 동일 로직 공유)
            server.middlewares.use('/api/admin-login', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { adminLogin } = await import('./api/_admin-core');
                  const p = JSON.parse(body || '{}');
                  const result = await adminLogin({ userId: p.userId, password: p.password });
                  res.statusCode = result.ok ? 200 : 401;
                  res.end(JSON.stringify(
                    result.ok
                      ? { success: true, token: result.token, name: result.name, adminRole: result.adminRole }
                      : { success: false, error: result.error }
                  ));
                } catch (e: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, error: e.message }));
                }
              });
            });

            // /api/devices — 기기 관리 (관리자 전용, 운영 api/devices.ts와 동일 로직 공유)
            server.middlewares.use('/api/devices', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_devices-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  const dt = p.deviceType === 'pc' ? 'pc' : 'lite';
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify({ devices: await core.listDevices() })); }
                  if (p.action === 'updateStatus') {
                    if (p.status !== 'active' && p.status !== 'pending' && p.status !== 'revoked') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid status' })); }
                    await core.setDeviceStatus(p.hardwareId, p.status, dt); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                  }
                  if (p.action === 'delete') { await core.removeDevice(p.hardwareId, dt); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/admin-config — 지역/지점 CRUD + 시스템설정 (관리자 전용, 운영 api/admin-config.ts와 동일)
            server.middlewares.use('/api/admin-config', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_admin-config-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  switch (p.action) {
                    case 'listRegions': res.statusCode = 200; return res.end(JSON.stringify({ regions: await core.listRegions() }));
                    case 'listBranches': res.statusCode = 200; return res.end(JSON.stringify({ branches: await core.listBranches(p.regionId) }));
                    case 'saveRegion': res.statusCode = 200; return res.end(JSON.stringify({ id: await core.saveRegion(p.region) }));
                    case 'deleteRegion': await core.deleteRegion(p.regionId); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                    case 'saveBranch': res.statusCode = 200; return res.end(JSON.stringify({ id: await core.saveBranch(p.branch) }));
                    case 'deleteBranch': await core.deleteBranch(p.branchId); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                    case 'getSettings': res.statusCode = 200; return res.end(JSON.stringify(await core.getSystemSettings()));
                    case 'updateSettings': await core.updateSystemSettings(p.autoApproveCode, p.liteAutoApproveCode, p.tempLiteAutoApproveCode, p.tempLiteCodeExpiredAt); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                    default: res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                  }
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/admin-users — 관리자 계정 CRUD (관리자 전용, 운영 api/admin-users.ts와 동일)
            server.middlewares.use('/api/admin-users', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_admin-users-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify({ admins: await core.listAdminUsers() })); }
                  if (p.action === 'save') {
                    if (!p.user?.id || !p.user?.password) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'id/password 필요' })); }
                    await core.saveAdminUser(p.user); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                  }
                  if (p.action === 'changePassword') {
                    const result = await core.changeAdminPassword(p.userId, p.currentPassword, p.newPassword);
                    res.statusCode = result.success ? 200 : 400; return res.end(JSON.stringify(result));
                  }
                  if (p.action === 'delete') { await core.deleteAdminUser(p.userId); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/usage — 지점 사용량/일일 한도 (운영 api/usage.ts와 동일 로직 공유)
            server.middlewares.use('/api/usage', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_usage-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'getStatus') { res.statusCode = 200; return res.end(JSON.stringify(await core.getStatus(identity, p.branchId, p.today))); }
                  if (p.action === 'updateLimit') {
                    if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                    await core.updateLimit(p.branchId, p.kfaceLimit, p.ktarotLimit); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                  }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/stats — 사용량 통계 (관리자 overview, 운영 api/stats.ts와 동일 로직 공유)
            server.middlewares.use('/api/stats', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_stats-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'logUsage') { await core.logUsage(identity, p.branchId, p.hardwareId, p.dateStr); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  if (p.action === 'getDashboardStats') {
                    if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                    res.statusCode = 200; return res.end(JSON.stringify(await core.getDashboardStats()));
                  }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/admin-members — 본사 전체 회원 조회(페이지네이션, 관리자 전용, 운영 api/admin-members.ts와 동일)
            server.middlewares.use('/api/admin-members', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_admin-members-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify(await core.listAllMembersPage(p.cursor, p.limit))); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/sync — 클라우드 동기화(회원 삭제/지점별 조회 등, 운영 api/sync.ts와 동일 로직 공유)
            server.middlewares.use('/api/sync', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_sync-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'syncMember') { await core.syncMember(identity, p.record, p.eventCode); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  if (p.action === 'syncFeedback') { await core.syncFeedback(identity, p.record); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  if (p.action === 'fetchFeedbacks') {
                    if (p.feedbackType !== 'body' && p.feedbackType !== 'face' && p.feedbackType !== 'tarot') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid feedbackType' })); }
                    res.statusCode = 200; return res.end(JSON.stringify({ list: await core.fetchFeedbacks(p.feedbackType, p.maxLimit) }));
                  }
                  if (p.action === 'deleteMember') { await core.deleteMember(identity, p.memberId); res.statusCode = 200; return res.end(JSON.stringify({ ok: true })); }
                  if (p.action === 'fetchMembersByBranch') { res.statusCode = 200; return res.end(JSON.stringify({ members: await core.listMembersByBranch(identity, p.branchId) })); }
                  if (p.action === 'fetchMembersByEventCode') { res.statusCode = 200; return res.end(JSON.stringify({ members: await core.listMembersByEventCode(identity, p.eventCode) })); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) {
                  if (e.status === 403) { res.statusCode = 403; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  res.statusCode = 500; res.end(JSON.stringify({ error: e.message }));
                }
              });
            });

            // /api/admin-errorlog — 에러 로그 조회/상태변경 (관리자 전용, 운영 api/admin-errorlog.ts와 동일)
            server.middlewares.use('/api/admin-errorlog', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_errorlog-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify({ logs: await core.listErrorLogs() })); }
                  if (p.action === 'updateStatus') {
                    if (p.status !== 'new' && p.status !== 'viewed' && p.status !== 'resolved') { res.statusCode = 400; return res.end(JSON.stringify({ error: 'invalid status' })); }
                    if (!p.id) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'id 필요' })); }
                    await core.setErrorLogStatus(p.id, p.status); res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                  }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/admin-events — 연합 행사 전체 조회 (관리자 전용, 운영 api/admin-events.ts와 동일)
            server.middlewares.use('/api/admin-events', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_admin-events-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify({ events: await core.listAllEvents() })); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/admin-feedbacks — AI 피드백 전체 조회 (관리자 전용 G1, 운영 api/admin-feedbacks.ts와 동일)
            server.middlewares.use('/api/admin-feedbacks', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const core = await import('./api/_admin-feedbacks-core');
                  let identity;
                  try { identity = await authenticateRequest(req as any); }
                  catch (e: any) { res.statusCode = e.status || 401; return res.end(JSON.stringify({ error: e.message, code: e.code })); }
                  if (identity.role !== 'admin') { res.statusCode = 403; return res.end(JSON.stringify({ error: '관리자만 가능합니다.', code: 'forbidden' })); }
                  const p = JSON.parse(body || '{}');
                  if (p.action === 'list') { res.statusCode = 200; return res.end(JSON.stringify({ feedbacks: await core.listAllFeedbacks() })); }
                  res.statusCode = 400; return res.end(JSON.stringify({ error: 'unknown action' }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });

            // /api/errorlog — 에러 로그 쓰기 (best-effort 인증: 미인증도 수용, 운영 api/errorlog.ts와 동일)
            server.middlewares.use('/api/errorlog', (req, res, next) => {
              if (req.method !== 'POST') return next();
              let body = '';
              req.on('data', (chunk) => { body += chunk.toString(); });
              req.on('end', async () => {
                res.setHeader('Content-Type', 'application/json');
                try {
                  const { authenticateRequest } = await import('./api/_auth');
                  const { writeErrorLog } = await import('./api/_errorlog-core');
                  let identity = null;
                  try { identity = await authenticateRequest(req as any); } catch { identity = null; }
                  const p = JSON.parse(body || '{}');
                  await writeErrorLog(
                    { message: p.message, stackTrace: p.stackTrace, type: p.type, severity: p.severity, source: p.source, deviceInfo: p.deviceInfo, appVersion: p.appVersion },
                    identity
                  );
                  res.statusCode = 200; return res.end(JSON.stringify({ ok: true }));
                } catch (e: any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
              });
            });
          }
        }
      ],
      build: {
        sourcemap: false,
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
