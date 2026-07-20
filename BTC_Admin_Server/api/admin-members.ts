import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { listAllMembersPage, getMemberById, getMemberCount } from './_admin-members-core.js';

/**
 * Vercel Serverless Function — 본사 전체 회원 조회(페이지네이션, 관리자 전용, R2)
 *
 * POST /api/admin-members
 * Body: { action: 'list', cursor?, limit?, projection? } | { action: 'get', id }
 *   - list: 기본 slim 프로젝션(목록/overview용). projection:'excel'이면 엑셀 필드까지.
 *   - get: 단건 전체 문서(상세 모달용).
 * 인증: 관문 통과 + role==='admin' 필수.
 * 응답 크기 제한 회피 위해 페이지 단위 반환 → 클라(fetchAllMembers)가 nextCursor로 순회해 전체를 구성한다.
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
    const { action, cursor, limit, projection, id } = req.body || {};
    if (action === 'list') return res.status(200).json(await listAllMembersPage(cursor, limit, projection));
    if (action === 'count') return res.status(200).json({ count: await getMemberCount() });
    if (action === 'get') {
      const member = await getMemberById(id);
      if (!member) return res.status(404).json({ error: '회원을 찾을 수 없습니다.', code: 'not_found' });
      return res.status(200).json({ member });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    console.error('[admin-members] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
