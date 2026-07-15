import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_auth.js';
import { applyCors } from './_cors.js';
import { syncMember, syncFeedback, fetchFeedbacks, deleteMember, listMembersByBranch, listMembersByEventCode } from './_sync-core.js';

/**
 * Vercel Serverless Function — 클라우드 동기화 (R2: 브라우저 직접 Firestore 접근 대체)
 *
 * POST /api/sync
 * Body: { action, ... }
 * 인증: F2 관문(authenticateRequest).
 *   - deleteMember:         memberId              (기기는 자기 지점 문서만, 관리자는 전체)
 *   - fetchMembersByBranch: branchId              (지점별 회원 조회)
 * (syncMember/syncFeedback/fetchFeedbacks/fetchMembersByEventCode는 측정·피드백 경로 — 관리자 표면 미사용, 템플릿 동일 이식.)
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
    const { action, record, eventCode, feedbackType, maxLimit, memberId, branchId } = req.body || {};

    if (action === 'syncMember') {
      await syncMember(identity, record, eventCode);
      return res.status(200).json({ ok: true });
    }
    if (action === 'syncFeedback') {
      await syncFeedback(identity, record);
      return res.status(200).json({ ok: true });
    }
    if (action === 'fetchFeedbacks') {
      if (feedbackType !== 'body' && feedbackType !== 'face' && feedbackType !== 'tarot') {
        return res.status(400).json({ error: 'invalid feedbackType' });
      }
      return res.status(200).json({ list: await fetchFeedbacks(feedbackType, maxLimit) });
    }
    if (action === 'deleteMember') {
      await deleteMember(identity, memberId);
      return res.status(200).json({ ok: true });
    }
    if (action === 'fetchMembersByBranch') {
      return res.status(200).json({ members: await listMembersByBranch(identity, branchId) });
    }
    if (action === 'fetchMembersByEventCode') {
      return res.status(200).json({ members: await listMembersByEventCode(identity, eventCode) });
    }
    return res.status(400).json({ error: 'unknown action' });
  } catch (e: any) {
    if (e.status === 403) return res.status(403).json({ error: e.message, code: e.code });
    console.error('[sync] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
