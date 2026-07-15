import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest, type Identity } from './_auth.js';
import { applyCors } from './_cors.js';
import { writeErrorLog } from './_errorlog-core.js';

/**
 * Vercel Serverless Function — 에러 로그 쓰기 (R2: 브라우저 직접 addDoc 대체)
 *
 * POST /api/errorlog
 * Body: { message, stackTrace?, type, severity, source, deviceInfo?, appVersion? }
 *
 * 인증: best-effort. 에러 로깅은 미인증 상황(로그인 전 window.onerror 등)에서도 실행되므로
 *       토큰이 없거나 유효하지 않아도 401로 거절하지 않는다. 유효한 토큰이 있으면 신원을 첨부.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // best-effort 인증: 토큰이 있으면 신원 첨부, 없거나 실패해도 로그는 그대로 받아들인다.
  let identity: Identity | null = null;
  try {
    identity = await authenticateRequest(req as any);
  } catch {
    identity = null; // 미인증(익명) 로그로 계속 진행 — hard-401 하지 않음
  }

  try {
    const { message, stackTrace, type, severity, source, deviceInfo, appVersion } = req.body || {};
    await writeErrorLog(
      { message, stackTrace, type, severity, source, deviceInfo, appVersion },
      identity
    );
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error('[errorlog] Server Error:', e);
    return res.status(500).json({ error: e.message || 'Internal error' });
  }
}
