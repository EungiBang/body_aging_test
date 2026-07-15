import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { listAdminUsers, saveAdminUser, changeAdminPassword, deleteAdminUser } from './_admin-users-core.js';

/**
 * Vercel Serverless Function — 관리자 계정 CRUD (관리자 전용, R2)
 *
 * POST /api/admin-users
 * Body: { action: 'list'|'save'|'changePassword'|'delete', user?, userId?, currentPassword?, newPassword? }
 * 인증: 관문 통과 + role==='admin' 필수. (실제 로그인은 api/admin-login.ts)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let identity;
  try {
    identity = await authenticateRequest(req as any);
  } catch (e: any) {
    return res.status(e.status || 401).json({ error: e.message || '인증 실패', code: e.code });
  }
  if (identity.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.', code: 'forbidden' });

  try {
    const b = req.body || {};
    if (b.action === 'list') return res.status(200).json({ admins: await listAdminUsers() });
    if (b.action === 'save') {
      if (!b.user?.id || !b.user?.password) return res.status(400).json({ error: 'id/password 필요' });
      await saveAdminUser(b.user);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'changePassword') {
      const result = await changeAdminPassword(b.userId, b.currentPassword, b.newPassword);
      return res.status(result.success ? 200 : 400).json(result);
    }
    if (b.action === 'delete') {
      await deleteAdminUser(b.userId);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[admin-users] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
