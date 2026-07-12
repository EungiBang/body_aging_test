import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth';
import { applyCors } from './_cors';
import {
  listRegions, listBranches, saveRegion, deleteRegion, saveBranch, deleteBranch,
  getSystemSettings, updateSystemSettings,
} from './_admin-config-core';

/**
 * Vercel Serverless Function — 지역/지점 CRUD + 시스템 설정 (관리자 전용, R2)
 *
 * POST /api/admin-config
 * Body: { action: 'listRegions'|'listBranches'|'saveRegion'|'deleteRegion'|'saveBranch'|'deleteBranch'|'getSettings'|'updateSettings',
 *         region?, branch?, regionId?, branchId?, autoApproveCode?, liteAutoApproveCode? }
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
    const b = req.body || {};
    switch (b.action) {
      case 'listRegions': return res.status(200).json({ regions: await listRegions() });
      case 'listBranches': return res.status(200).json({ branches: await listBranches(b.regionId) });
      case 'saveRegion': return res.status(200).json({ id: await saveRegion(b.region) });
      case 'deleteRegion': await deleteRegion(b.regionId); return res.status(200).json({ ok: true });
      case 'saveBranch': return res.status(200).json({ id: await saveBranch(b.branch) });
      case 'deleteBranch': await deleteBranch(b.branchId); return res.status(200).json({ ok: true });
      case 'getSettings': return res.status(200).json(await getSystemSettings());
      case 'updateSettings': await updateSystemSettings(b.autoApproveCode, b.liteAutoApproveCode); return res.status(200).json({ ok: true });
      default: return res.status(400).json({ error: 'unknown action' });
    }
  } catch (e: any) {
    console.error('[admin-config] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
