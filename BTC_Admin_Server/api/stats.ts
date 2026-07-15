import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { logUsage, getDashboardStats } from './_stats-core.js';

/**
 * Vercel Serverless Function — 사용량 통계 (R2: 브라우저 직접 Firestore 접근 대체)
 *
 * POST /api/stats
 * Body: { action: 'logUsage'|'getDashboardStats', branchId?, hardwareId?, dateStr? }
 * 인증: F2 관문. getDashboardStats는 관리자(role=admin) 전용(전 지점 집계).
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

  try {
    const { action, branchId, hardwareId, dateStr } = req.body || {};

    if (action === 'logUsage') {
      await logUsage(identity, branchId, hardwareId, dateStr);
      return res.status(200).json({ ok: true });
    }
    if (action === 'getDashboardStats') {
      if (identity.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.', code: 'forbidden' });
      return res.status(200).json(await getDashboardStats());
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[stats] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
