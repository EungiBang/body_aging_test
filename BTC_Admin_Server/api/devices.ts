import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth';
import { applyCors } from './_cors';
import { listDevices, setDeviceStatus, removeDevice } from './_devices-core';

/**
 * Vercel Serverless Function — 기기 라이센스 관리 (관리자 전용, R2: 브라우저 직접 Firestore 접근 대체)
 *
 * POST /api/devices
 * Body: { action: 'list'|'updateStatus'|'delete', hardwareId?, status?, deviceType? }
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
    const { action, hardwareId, status, deviceType } = req.body || {};
    const dt = deviceType === 'pc' ? 'pc' : 'lite';

    if (action === 'list') return res.status(200).json({ devices: await listDevices() });
    if (action === 'updateStatus') {
      if (status !== 'active' && status !== 'pending' && status !== 'revoked') return res.status(400).json({ error: 'invalid status' });
      await setDeviceStatus(hardwareId, status, dt);
      return res.status(200).json({ ok: true });
    }
    if (action === 'delete') {
      await removeDevice(hardwareId, dt);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[devices] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
