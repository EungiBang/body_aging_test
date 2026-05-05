import { GoogleGenAI, Modality } from "@google/genai";
import type { CheonbugyeongCharacter } from '../types';
import { MASTERS } from '../data/masters';

const getGeminiService = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not set in environment variables");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const getInterpretation = async (
  concern: string,
  name: string,
  age: string,
  gender: string,
  past: CheonbugyeongCharacter,
  present: CheonbugyeongCharacter,
  future: CheonbugyeongCharacter,
  masterId: string,
): Promise<string> => {
  const ai = getGeminiService();
  
  const selectedMaster = MASTERS.find(m => m.id === masterId);
  const masterPersonaPrompt = selectedMaster 
    ? selectedMaster.prompt
    : "You are a wise and insightful Cheonbugyeong master. Your tone is mystical and supportive.";


  const prompt = `
    ${masterPersonaPrompt}
    Your role is to provide insightful and empathetic guidance, similar to a Tarot reading, based on its 81 mystical characters.

    A user is seeking clarity on a personal matter. They have provided their details, their concern, and have drawn three characters from the Cheonbugyeong, representing their Past, Present, and Future.

    **User's Details:**
    - Name: ${name}
    - Age: ${age}
    - Gender: ${gender}

    **User's Concern:** "${concern}"

    **Drawn Characters:**
    1.  **Past:** The character is '${past.char}' ('${past.reading}'), which symbolizes '${past.meaning}'.
    2.  **Present:** The character is '${present.char}' ('${present.reading}'), which symbolizes '${present.meaning}'.
    3.  **Future:** The character is '${future.char}' ('${future.reading}'), which symbolizes '${future.meaning}'.

    **Your Task:**
    Provide a holistic interpretation in **KOREAN** based on the user's details, their concern, and the sequence of these three characters. Structure your response clearly using Markdown H3 headers (###) for each of the following sections:

    ### 총운 (Overall Reading)
    Start with a brief, insightful summary of the overall energy of this reading, subtly acknowledging the user's context (${name}, ${age}).

    ### 과거 (Past)
    Explain how the Past character ('${past.char}') and its meaning relate to the origins and background of the user's concern.

    ### 현재 (Present)
    Analyze the Present character ('${present.char}') and its symbolism in the context of the user's current situation and challenges.

    ### 미래 (Future)
    Interpret the Future character ('${future.char}') as a potential outcome or a guiding energy for resolving the concern.

    ### 조언 (Advice)
    Conclude with a piece of compassionate, actionable advice. This advice MUST follow a specific structure:
    a. Begin by affirming that the user is in a good and positive state right now.
    b. Then, suggest that to further enhance their energy, it is important to focus on charging one of the 7 healing chakras.
    c. You must choose ONE specific chakra that you feel is most relevant to the user's situation (based on their concern and the drawn characters).
    d. Finally, recommend that they incorporate the color associated with that chosen chakra into their daily life through accessories (like bracelets, necklaces) or clothing to help attract and charge that energy.

    ### 힐링 차크라 상세 정보 (Detailed Healing Chakra Information)
    This is a reference for creating the Lifestyle Advice.
    - **1번 차크라 (회음, Root Chakra)**
      - **주관:** 안정감, 생존 본능, 신체적 활력
      - **관련 기관:** 다리, 발, 척추, 직장, 면역계
      - **불균형 시:** 자기중심적, 불안, 분노, 척추 긴장, 배변 어려움, 지속적 피로, 하체 무거움, 면역 저하
    - **2번 차크라 (하단전, Sacral Chakra)**
      - **주관:** 창의력, 성적에너지, 감정적 균형
      - **관련 기관:** 생식기, 방광, 신장, 골반
      - **불균형 시:** 음식과 성의 탐욕, 중독, 목적의식 상실, 질투, 자궁·방광 순환 저하, 생리통, 소화불량
    - **3번 차크라 (중완, Solar Plexus Chakra)**
      - **주관:** 자존감, 의지력, 소화력
      - **관련 기관:** 위장, 간, 췌장, 비장, 소장
      - **불균형 시:** 의욕상실, 울화, 공포, 미움, 소화 불균형, 대사 및 에너지 저하
    - **4번 차크라 (단중, Heart Chakra)**
      - **주관:** 사랑, 연민, 용서, 이해, 평온, 성실, 책임감
      - **관련 기관:** 심장, 폐, 순환계, 팔, 어깨
      - **불균형 시:** 사랑의 억압, 정서적 불안, 심혈관 순환 주의, 혈행 흐름 저하, 호흡기 기능 저하, 긴장
    - **5번 차크라 (혼문, Throat Chakra)**
      - **주관:** 언변력, 진실한 대화, 신뢰, 부드러움, 평화, 균형과 조화
      - **관련 기관:** 목, 갑상선, 성대, 기관지, 턱, 치아
      - **불균형 시:** 대화 부족, 무분별, 지식 오용, 목 뻣뻣함, 목 주변 긴장, 말더듬
    - **6번 차크라 (인당, Third Eye Chakra)**
      - **주관:** 영적 깨달음, 직관, 통찰력, 상상력, 창작, 집중, 마음의 평화
      - **관련 기관:** 뇌, 눈, 귀, 신경계
      - **불균형 시:** 집중력 부족, 냉소적 사고방식, 긴장, 두통, 시력 저하, 악몽
    - **7번 차크라 (백회, Crown Chakra)**
      - **주관:** 지혜와 영감, 영적 연결, 시공을 초월한 의식확장
      - **관련 기관:** 뇌, 신경계, 몸 전체
      - **불균형 시:** 혼돈, 기력 약화, 영감부족, 머리 무거움, 기분 저하, 분리감

    ### 라이프스타일 조언 (Lifestyle Advice)
    **IMPORTANT:** The following five pieces of advice must be specifically tailored to help balance and heal the ONE chakra you selected in the '조언 (Advice)' section. Use the '힐링 차크라 상세 정보' section above for reference when creating this advice.
    Provide practical, concise advice tailored to the reading, covering the following five areas:
    - **긍정 에너지 (Positive Energy):** A simple mindset or affirmation.
    - **운동 (Exercise):** A light and suitable physical activity suggestion.
    - **식사 (Diet):** A small, helpful dietary tip.
    - **습관 (Habits):** One constructive daily habit to adopt.
    - **명상 (Meditation):** A brief mindfulness or meditation technique.
    Keep this lifestyle advice supportive and easy to integrate into daily life.

    **Reference for 7 Chakras and Colors:**
    - 1st Chakra (Root Chakra - 1번 차크라, 회음): Red (빨간색) - Stability, Grounding
    - 2nd Chakra (Sacral Chakra - 2번 차크라, 하단전): Orange (주황색) - Creativity, Emotions
    - 3rd Chakra (Solar Plexus Chakra - 3번 차크라, 중완): Yellow (노란색) - Confidence, Personal Power
    - 4th Chakra (Heart Chakra - 4번 차크라, 단중): Green (초록색) - Love, Compassion
    - 5th Chakra (Throat Chakra - 5번 차크라, 혼문): Blue (파란색) - Communication, Self-Expression
    - 6th Chakra (Third Eye Chakra - 6번 차크라, 인당): Indigo (남색) - Intuition, Wisdom
    - 7th Chakra (Crown Chakra - 7번 차크라, 백회): Violet/White (보라색/흰색) - Spirituality, Connection to the Divine

    Maintain your assigned persona's tone throughout your response. Ensure the language is clear, profound, and easy to understand for someone seeking guidance.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get interpretation from the oracle. Please try again.");
  }
};

export const getSpeech = async (text: string): Promise<string | null> => {
    const ai = getGeminiService();
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Say with a calm and wise tone: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio || null;
    } catch (error) {
        console.error("Error calling Gemini TTS API:", error);
        throw new Error("Failed to generate speech from the oracle.");
    }
};

export const generateMusic = async (prompt: string): Promise<{ audioUrl: string; lyrics: string } | null> => {
    const ai = getGeminiService();
    try {
        const response = await ai.models.generateContentStream({
            model: "lyria-3-clip-preview",
            contents: prompt,
            config: {
                responseModalities: [Modality.AUDIO],
            }
        });

        let audioBase64 = "";
        let lyrics = "";
        let mimeType = "audio/wav";

        for await (const chunk of response) {
            const parts = chunk.candidates?.[0]?.content?.parts;
            if (!parts) continue;
            for (const part of parts) {
                if (part.inlineData?.data) {
                    if (!audioBase64 && part.inlineData.mimeType) {
                        mimeType = part.inlineData.mimeType;
                    }
                    audioBase64 += part.inlineData.data;
                }
                if (part.text && !lyrics) {
                    lyrics = part.text;
                }
            }
        }

        if (!audioBase64) return null;

        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const audioUrl = URL.createObjectURL(blob);

        return { audioUrl, lyrics };
    } catch (error) {
        console.error("Error generating music:", error);
        return null;
    }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
    const ai = getGeminiService();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [{ text: prompt }],
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4",
                    imageSize: "1K"
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating image:", error);
        return null;
    }
};

export const generateCharacterImage = async (character: CheonbugyeongCharacter): Promise<string | null> => {
    const prompt = `A mystical and artistic tarot card illustration for the Cheonbugyeong character '${character.char}' ('${character.reading}'), which means '${character.meaning}'. The style should be ethereal, traditional Korean ink wash painting mixed with modern digital art, gold and deep blue tones, symbolic and spiritual. High quality, detailed, spiritual atmosphere.`;
    return generateImage(prompt);
};
