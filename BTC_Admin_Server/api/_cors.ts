// CORS 공용 헬퍼 (서버 전용). 파일명 '_' 접두사 → Vercel이 엔드포인트로 만들지 않음.
// 허용 오리진 목록을 한 곳에서 관리 — 개발팀 Vercel URL 등 추가 시 이 파일만 고치면 됨.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const allowedOrigins = [
  // TODO: 배포 시 관리자 운영 도메인 추가 (현재 미상 — Vercel 대시보드 확인 필요).
  //       배포 전까지는 로컬만 사용.
  'http://localhost:3001',
  'http://localhost:3000',
];

// 허용 오리진이면 CORS 헤더를 세팅한다.
// 반환값: OPTIONS 프리플라이트 요청이면 true → 호출부에서 즉시 200 종료할 것.
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return req.method === 'OPTIONS';
}
