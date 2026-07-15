import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { listAllEvents } from './_admin-events-core.js';

/**
 * Vercel Serverless Function — 연합 행사 전체 조회 (관리자 전용, R2)
 *
 * POST /api/admin-events
 * Body: { action: 'list' }
 * 인증: 관문 통과 + role==='admin' 필수.
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
    const { action } = req.body || {};
    if (action === 'list') return res.status(200).json({ events: await listAllEvents() });
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[admin-events] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
