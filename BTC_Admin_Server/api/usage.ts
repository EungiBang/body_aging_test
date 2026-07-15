import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { getStatus, updateLimit } from './_usage-core.js';

/**
 * Vercel Serverless Function — 지점 사용량/일일 한도 (R2)
 *
 * POST /api/usage
 * Body: { action: 'getStatus'|'updateLimit', branchId?, today?, kfaceLimit?, ktarotLimit? }
 * 인증: 관문 통과 필수. getStatus 는 기기·관리자 공통, updateLimit 은 role==='admin' 전용.
 * (measurement 전용 increment 는 관리자 앱에선 죽은 코드라 미구현.)
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
    const b = req.body || {};
    if (b.action === 'getStatus') {
      return res.status(200).json(await getStatus(identity, b.branchId, b.today));
    }
    if (b.action === 'updateLimit') {
      if (identity.role !== 'admin') return res.status(403).json({ error: '관리자만 가능합니다.', code: 'forbidden' });
      await updateLimit(b.branchId, b.kfaceLimit, b.ktarotLimit);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[usage] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
