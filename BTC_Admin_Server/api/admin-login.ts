import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminLogin } from './_admin-core.js';
import { applyCors } from './_cors.js';

/**
 * Vercel Serverless Function — 관리자 로그인 (인증의 관리자 버전)
 *
 * 기존에는 브라우저가 admin_users의 비번 해시를 직접 조회·비교했다(인증 세션도 없이 클라 검증).
 * 이 엔드포인트가 그 검증을 서버로 옮긴다: 통과 시에만 role=admin 커스텀 토큰(출입증)을 발급한다.
 *
 * POST /api/admin-login
 * Body: { userId, password }
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { userId, password } = req.body || {};
    const result = await adminLogin({ userId, password });
    if (result.ok) {
      return res.status(200).json({ success: true, token: result.token, name: result.name, adminRole: result.adminRole });
    }
    // BTC tsconfig가 non-strict라 union의 false 분기 내로잉이 안 됨 → 국소 캐스트로 error 접근.
    const failed = result as { ok: false; error: string };
    return res.status(401).json({ success: false, error: failed.error });
  } catch (error: any) {
    console.error('[admin-login] Server Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
