// Vercel Serverless 환경에서 Gemini API 호출을 대행하는 Proxy API 핸들러 (미국 서비스 전용)
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // CORS 처리 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST 메서드만 허용됩니다.' });
  }

  // Vercel 환경 변수에서 미국 전용 API Key 획득 (GEMINI_API_KEY_US 또는 GEMINI_API_KEY)
  const apiKey = process.env.GEMINI_API_KEY_US || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '서버 환경 변수에 GEMINI_API_KEY_US 또는 GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'model 및 contents 파라미터가 누락되었습니다.' });
    }

    // Google GenAI 인스턴스 생성
    const ai = new GoogleGenAI({ apiKey });

    // Gemini API 호출 수행
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    // 결과를 클라이언트로 전송
    return res.status(200).json({
      text: response.text,
    });
  } catch (error: any) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({ error: error.message || 'Gemini API 호출 중 내부 오류가 발생했습니다.' });
  }
}
