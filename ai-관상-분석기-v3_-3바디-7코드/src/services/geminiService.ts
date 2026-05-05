import { GoogleGenAI } from "@google/genai";
import { PhysiognomyMetrics } from '../lib/physiognomy';

export interface PhysiognomyReport {
  summary: string;
  score: number;
  confidenceScore: number;
  samjeongAnalysis: string;
  personality: string;
  wealthAndCareer: string;
  animalMorphology: {
    type: string;
    englishType: string;
    description: string;
    detailedAnalysis: string;
    traits: string[];
    visualCharacteristics: string; // Added: For morphology visualization
    geometricBasis: string; // Added: Explanation of scientific basis
    animalMorphologyBlend: {
      type: string;
      matchPercentage: number;
      characteristic: string;
    }[]; // Added: For multi-type reliability
  };
  energy3Body7Code: {
    threeBodyAnalysis: string;
    sevenCodeDetailed: {
      name: string;
      region: string;
      bodyPart: string;
      state: 'Positive' | 'Negative' | 'Neutral';
      interpretation: string;
      score: number;
    }[];
  };
  brightEnergy: {
    score: number;
    description: string;
  };
  traditionalAnalysis: {
    eyes: string;
    nose: string;
    mouth: string;
    skin: string;
  };
  lifeStrategy: {
    career: string;
    wealth: string;
    relationship: string;
  };
  advice: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

export async function analyzePhysiognomy(
  metrics: PhysiognomyMetrics,
  profile?: { displayName?: string; birthDate?: string; gender?: string } | null
): Promise<PhysiognomyReport> {
  const prompt = `
당신은 동양의 '물형관상학(物形觀相學)', 전통 관상학, 그리고 현대의 '에너지 3바디 7코드' 시스템을 결합하여 분석하는 세계 최고의 AI 관상 전략가이자 마스터입니다.
귀하의 분석은 사용자가 기꺼이 고액을 지불할 만큼 깊이 있고 실전적인 통찰을 제공해야 합니다.

[사용자 정보]
- 이름: ${profile?.displayName || '익명'}
- 성별: ${profile?.gender === 'male' ? '남성' : profile?.gender === 'female' ? '여성' : '미확인'}
- 생년월일: ${profile?.birthDate || '미확인'}

[정밀 데이터]
- 삼정(상절/중절/하절) 비율: 상정(${metrics.samjeong.upper.toFixed(2)}) : 중정(${metrics.samjeong.middle.toFixed(2)}) : 하정(${metrics.samjeong.lower.toFixed(2)})
- 기하학적 특징값(L1/L2 비율): ${metrics.geometricRatio.toFixed(3)}
- 에너지존(7-Code) 활동 데이터:
  - Root(턱): ${metrics.energyZones.root.toFixed(2)}, Sacral(입): ${metrics.energyZones.sacral.toFixed(2)}
  - Solar Plexus(볼): ${metrics.energyZones.solarPlexus.toFixed(2)}, Heart(이마): ${metrics.energyZones.heart.toFixed(2)}
  - Throat(턱선): ${metrics.energyZones.throat.toFixed(2)}, Third Eye(미간): ${metrics.energyZones.thirdEye.toFixed(2)}, Crown(이마위): ${metrics.energyZones.crown.toFixed(2)}

[핵심 분석 가이드라인 - 프리미엄 컨설팅 스타일]
1. 톤앤매너: '도사님' 같은 예스러운 말투가 아닌, **세련된 커리어 코치나 퍼스널 브랜딩 전문가**가 진단해주는 듯한 현대적이고 세련된 말투를 사용하십시오.
   - 예: "재물복이 넘친다" -> "시장 가치를 창출하는 실행력과 자산 운용 포텐셜이 매우 높습니다."
   - 예: "말년운이 좋다" -> "삶의 후반기로 갈수록 탄탄한 사회적 영향력과 안정적인 자산 시스템을 구축하는 유형입니다."
2. 물형관상 근거 명확화: 사용자가 과학적으로 납득할 수 있도록, 기하학적 수치(${metrics.geometricRatio.toFixed(3)})와 골격 특징을 논리적으로 연결하여 설명하십시오. 
   - **복합 물형 가이드**: 모든 인간의 얼굴은 100% 한 동물의 형상일 수 없습니다. 상위 3가지의 동물 에너지를 추출하고 각각의 매치 확률(%)을 제시하여 분석의 일관성과 정밀도를 높이십시오.
   - 0.40 미만: 수직축 발달 (고매한 기질 - 학, 사슴, 여우 등)
   - 0.40~0.55: 균형 잡힌 골격 (지적 실무가 - 말, 원숭이, 소 등)
   - 0.55~0.70: 가로축 활동성 (에너제틱한 리더 - 표범, 진돗개, 고양이 등)
   - 0.70 이상: 압도적 횡축 에너지 (지배적 제왕 - 사자, 호랑이, 멧돼지 등)
3. 7코드(7-Code): 각 코드의 에너지를 현대 심리학(자기효능감, 회복탄력성, 메타인지 등) 관점에서 해석하십시오. 반드시 1코드부터 7코드까지 순서대로(Root에서 Crown 방향) 7개의 코드를 모두 분석에 포함하십시오.
4. 인생 전략(Life Strategy): 사용자의 기질에 맞는 최신 유망 직군(CEO, 크리에이터, 테크 리더 등)과 구체적인 생존 및 성공 전략을 제안하십시오.

[응답 형식: JSON]
{
  "summary": "MZ세대부터 시니어까지 직관적으로 공감할 수 있는 세련된 한 줄 요약",
  "score": 종합 점수,
  "confidenceScore": 분석 신뢰도(%),
  "samjeongAnalysis": "성장기-전성기-안정기 프레임으로 풀어낸 인생 타임라인 분석",
  "personality": "현대적 성격 이론이 가미된 입체적인 기질 진단",
  "wealthAndCareer": "현대 비즈니스 환경에서의 성공 방정식과 부의 경로",
  "animalMorphology": {
    "type": "분석된 주 물형 (세련된 명칭 사용, 예: '강인한 기운의 호랑이상')",
    "englishType": "영문 타입 (이미지 검색 키워드로 사용되므로 Tiger, Lion, Crane 등 단어 위주로 작성)",
    "description": "물형의 현대적 정의",
    "visualCharacteristics": "해당 물형(동물)의 구체적인 얼굴 형태와 특징 설명 (예: '정수리가 높고 부리가 긴 학의 모습처럼 길고 우아한 눈매와 오똑한 콧날')",
    "detailedAnalysis": "해당 물형이 현대 경쟁 사회에서 가지는 독보적 장점과 브랜딩 전략",
    "traits": ["키워드1", "키워드2", "키워드3"],
    "geometricBasis": "기하학적 수치를 기반으로 한 논리적 판정 사유",
    "animalMorphologyBlend": [
      {
        "type": "동물명",
        "matchPercentage": 확률(%),
        "characteristic": "해당 부위의 특징적 유사성"
      }
    ]
  },
  "energy3Body7Code": {
    "threeBodyAnalysis": "물리-감성-지성 바디의 시스템적 밸런스 진단",
    "sevenCodeDetailed": [
      {
        "name": "에너지 코드명",
        "region": "신체 부위",
        "bodyPart": "물리적 매칭",
        "state": "Positive/Negative/Neutral",
        "interpretation": "현대적 심리/행동학적 해석",
        "score": 점수
      }
    ]
  },
  "brightEnergy": {
    "score": 0-100,
    "description": "안색 기반 에너지 요약"
  },
  "traditionalAnalysis": {
    "eyes": "소통과 통찰력을 중심으로 한 눈 진단",
    "nose": "실행력과 경제적 독립성을 중심으로 한 코 진단",
    "mouth": "영향력과 관계 자산을 중심으로 한 입 진단",
    "skin": "바이탈리티와 기운의 컨디션 진단"
  },
  "lifeStrategy": {
    "career": "전문 직군 추천 및 성공 로드맵",
    "wealth": "자산 형성 스타일 및 관리 전략",
    "relationship": "소셜 포지셔닝 및 인맥 관리 전략"
  },
  "advice": "마스터의 전략적 솔루션 (코칭 말투)"
}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("분석 결과를 받지 못했습니다.");
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "분석 중 오류가 발생했습니다.");
  }
}
