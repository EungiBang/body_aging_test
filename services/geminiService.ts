
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { BodyReport, CapturedImage, UserInfo } from "../types";

export const analyzeHealth = async (userInfo: UserInfo, images: CapturedImage[]): Promise<BodyReport> => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const parts = images.map(img => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: img.dataUrl.split(',')[1]
    }
  }));

  const prompt = `
    대상자 정보: 이름 ${userInfo.name}, 성별 ${userInfo.gender === 'male' ? '남성' : '여성'}, 실제 나이 ${userInfo.age}세.
    이 사진들은 브레인 트레이닝 센터에서 실시한 신체 건강 평가 데이터입니다. 
    전문적인 시각에서 사진을 분석하고, 모든 진단 결과와 권장 사항을 반드시 **한국어**로 작성해 주세요.

    특히 종합 분석(summary)은 대상자의 건강 상태를 깊이 이해하고 공감하는 따뜻하고 전문적인 톤으로, 구체적이고 상세하게 작성해 주세요. 단순한 결과 나열이 아닌, 현재 상태가 의미하는 바와 앞으로의 긍정적인 변화 가능성을 포함해야 합니다.

    분석 항목:
    1. 자세 및 균형 (정면, 측면 사진 기반): 거북목, 어깨 불균형, 골반 틀어짐 등 척추와 관절의 균형 상태를 정밀하게 분석.
    2. 노화 징후 (한발 서기, 팔 들기, 유연성 사진 기반): 신체 기능적 나이 추정 및 가동 범위 평가.
    3. 근력 상태 (15초 스쿼트, 15초 푸시업): 
       - 사용자가 입력한 수행 횟수(스쿼트: ${images.find(i => i.step === 'STRENGTH_SQUAT')?.reps || 0}회, 푸시업: ${images.find(i => i.step === 'STRENGTH_PUSHUP')?.reps || 0}회)를 바탕으로 근력을 평가하세요.
       - 사진에 나타난 자세를 통해 동작의 정확도와 근육의 협응력을 분석하세요.
       - 횟수와 자세를 종합하여 실질적인 근력 수준을 평가하세요.
    4. 안면 분석: 피부 탄력도와 주름 깊이를 정밀하게 분석하여 생물학적 노화도를 추정하세요. 각 항목에 대한 상세한 피드백과 함께, 피부 상태 개선을 위한 구체적인 권장 사항(생활 습관, 마사지, 스킨케어 방향 등)을 반드시 포함하세요. (입체적이고 심층적인 분석 느낌으로 작성)

    브레인 트레이닝 추천 항목 (한국어로):
    - 명상 (Meditation): 신체적 긴장이나 자세 불균형을 완화할 수 있는 명상법.
    - 체조 (Gymnastics): 약화된 부위를 강화하거나 틀어진 자세를 바로잡는 신체 활동.
    - 뇌훈련 (Brain Training): 신체 제어 능력 향상을 돕는 인지적 훈련 과제.

    응답은 반드시 아래 구조의 JSON 형식이어야 하며, 모든 문자열 설명은 한국어여야 합니다:
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [...parts, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            physicalAge: { type: Type.NUMBER, description: "추정 신체 나이" },
            faceAgeEstimate: { type: Type.NUMBER, description: "추정 안면 노화 나이" },
            overallScore: { type: Type.NUMBER, description: "100점 만점 기준 종합 점수" },
            summary: { type: Type.STRING, description: "전체적인 건강 상태 요약 (한국어)" },
            brainHealthImplication: { type: Type.STRING, description: "신체 상태가 뇌 건강에 주는 의미 (한국어)" },
            postureMetrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "부위명 (예: 목, 어깨, 골반 등)" },
                  status: { type: Type.STRING, enum: ['Good', 'Fair', 'Poor'] },
                  description: { type: Type.STRING, description: "상세 분석 내용 (한국어)" },
                  score: { type: Type.NUMBER }
                }
              }
            },
            strengthMetrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  exercise: { type: Type.STRING, description: "운동 명칭 (한국어)" },
                  reps: { type: Type.NUMBER },
                  performance: { type: Type.STRING, description: "수행 능력 평가 (한국어)" },
                  formScore: { type: Type.NUMBER },
                  recommendation: { type: Type.STRING, description: "개선 권장 사항 (한국어)" }
                }
              }
            },
            agingMetrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  testName: { type: Type.STRING, description: "테스트 명칭 (한국어)" },
                  result: { type: Type.STRING, description: "테스트 결과 설명 (한국어)" },
                  score: { type: Type.NUMBER }
                }
              }
            },
            faceAnalysis: {
              type: Type.OBJECT,
              properties: {
                wrinkles: { type: Type.STRING, description: "주름 깊이 및 분포 상세 분석 (한국어)" },
                elasticity: { type: Type.STRING, description: "피부 탄력도 및 처짐 상세 분석 (한국어)" },
                summary: { type: Type.STRING, description: "안면 종합 평가 (한국어)" },
                recommendation: { type: Type.STRING, description: "피부 탄력 및 주름 개선을 위한 구체적인 권장 사항 (한국어)" }
              }
            },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                meditation: { type: Type.STRING, description: "명상 가이드 (한국어)" },
                gymnastics: { type: Type.STRING, description: "체조/운동 가이드 (한국어)" },
                brainTraining: { type: Type.STRING, description: "인지/뇌훈련 가이드 (한국어)" }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("AI response text is empty");
    }
    
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      userInfo
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
