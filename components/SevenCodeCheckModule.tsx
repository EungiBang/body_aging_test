// 7코드 건강 점검 모듈 — V5.0.8 원본 키워드 56개 전체 사용, 5페이지(11-11-11-11-12) 균등 분할
import React, { useState, useEffect } from 'react';
import { speak } from '../services/ttsService';
import { useTranslation } from 'react-i18next';

interface KeywordItem {
  keyword: string;
  keywordEn: string;
  codes: number[];
}

// V5.0.8 원본 56개 키워드 + 8개 긍정 키워드 영문 매핑
const ALL_KEYWORDS: KeywordItem[] = [
  // --- 1페이지 분량 (13개) ---
  { keyword: "공포", keywordEn: "Fear", codes: [1] },
  { keyword: "배변 어려움", keywordEn: "Bowel Discomfort", codes: [1] },
  { keyword: "하체 무거움", keywordEn: "Heavy Lower Body", codes: [1] },
  { keyword: "안정", keywordEn: "Stability", codes: [1] }, // [긍정 1]
  { keyword: "통제", keywordEn: "Control Issues", codes: [1, 3] },
  { keyword: "분노", keywordEn: "Anger", codes: [1, 3] },
  { keyword: "식탐", keywordEn: "Food Cravings", codes: [1, 2] },
  { keyword: "활력 저하", keywordEn: "Low Vitality", codes: [1, 2] },
  { keyword: "기쁨", keywordEn: "Joy", codes: [2] }, // [긍정 2]
  { keyword: "방어적 자세", keywordEn: "Defensive Posture", codes: [1, 2, 3] },
  { keyword: "골반 불편감", keywordEn: "Pelvic Discomfort", codes: [1, 2, 3] },
  { keyword: "불안", keywordEn: "Anxiety", codes: [1, 2, 3] },
  { keyword: "미움", keywordEn: "Resentment", codes: [1, 3, 5] },
  
  // --- 2페이지 분량 (13개) ---
  { keyword: "지속적 피로", keywordEn: "Chronic Fatigue", codes: [1, 3, 5] },
  { keyword: "충만", keywordEn: "Fulfillment", codes: [3] }, // [긍정 3]
  { keyword: "책임감", keywordEn: "Heavy Responsibility", codes: [1, 3, 5] },
  { keyword: "외로움", keywordEn: "Loneliness", codes: [1, 2, 4] },
  { keyword: "관계 집착", keywordEn: "Relationship Clinging", codes: [1, 2, 4] },
  { keyword: "하복부 차가움", keywordEn: "Cold Lower Abdomen", codes: [1, 2, 4] },
  { keyword: "경제 문제", keywordEn: "Financial Stress", codes: [2] },
  { keyword: "긍정", keywordEn: "Positivity", codes: [5] }, // [긍정 4]
  { keyword: "수치심", keywordEn: "Shame / Guilt", codes: [2] },
  { keyword: "아랫배 순환 저하", keywordEn: "Poor Abdominal Circulation", codes: [2] },
  { keyword: "감정적 피로", keywordEn: "Emotional Exhaustion", codes: [2, 4] },
  { keyword: "질투", keywordEn: "Jealousy", codes: [2, 4] },
  { keyword: "답답함", keywordEn: "Frustration", codes: [2, 4, 6] },
  
  // --- 3페이지 분량 (13개) ---
  { keyword: "과도한 공감", keywordEn: "Excessive Empathy", codes: [2, 4, 6] },
  { keyword: "사랑", keywordEn: "Love", codes: [4] }, // [긍정 5]
  { keyword: "원망", keywordEn: "Grudge / Blaming", codes: [2, 4, 6] },
  { keyword: "소화 더부룩함", keywordEn: "Bloating / Indigestion", codes: [3] },
  { keyword: "경쟁", keywordEn: "Competitiveness", codes: [3] },
  { keyword: "의욕저하", keywordEn: "Lack of Motivation", codes: [3] },
  { keyword: "권위적", keywordEn: "Authoritative Attitude", codes: [3, 5] },
  { keyword: "행복", keywordEn: "Happiness", codes: [4] }, // [긍정 6]
  { keyword: "억압", keywordEn: "Suppression", codes: [3, 5] },
  { keyword: "무기력", keywordEn: "Lethargy / Helplessness", codes: [3, 5, 7] },
  { keyword: "열등감", keywordEn: "Inferiority Complex", codes: [3, 5, 7] },
  { keyword: "표현 어려움", keywordEn: "Difficulty Expressing", codes: [3, 5, 7] },
  { keyword: "가슴 답답함", keywordEn: "Chest Tightness", codes: [4] },
  
  // --- 4페이지 분량 (13개) ---
  { keyword: "가슴 뭉침", keywordEn: "Chest Discomfort", codes: [4] },
  { keyword: "평온", keywordEn: "Serenity", codes: [6] }, // [긍정 7]
  { keyword: "상처", keywordEn: "Emotional Hurt", codes: [4] },
  { keyword: "냉소", keywordEn: "Cynicism", codes: [4, 6] },
  { keyword: "오해", keywordEn: "Misunderstandings", codes: [4, 6] },
  { keyword: "수면 불편", keywordEn: "Sleep Disturbances", codes: [4, 6, 7] },
  { keyword: "비 현실감", keywordEn: "Derealization", codes: [4, 6, 7] },
  { keyword: "기분 저하", keywordEn: "Low Mood / Gloom", codes: [4, 6, 7] },
  { keyword: "수줍음", keywordEn: "Shyness", codes: [5] },
  { keyword: "목소리 불편감", keywordEn: "Voice Strain", codes: [5] },
  { keyword: "목 뻣뻣함", keywordEn: "Stiff Neck / Throat", codes: [5] },
  { keyword: "혼란", keywordEn: "Confusion", codes: [5, 7] },
  { keyword: "무지", keywordEn: "Ignorance / Unawareness", codes: [5, 7] },
  
  // --- 5페이지 분량 (12개) ---
  { keyword: "머리 무거움", keywordEn: "Heavy Head", codes: [5, 6, 7] },
  { keyword: "정보 과부하", keywordEn: "Information Overload", codes: [5, 6, 7] },
  { keyword: "감사", keywordEn: "Gratitude", codes: [7] }, // [긍정 8]
  { keyword: "긴장", keywordEn: "Tension / Tightness", codes: [5, 6, 7] },
  { keyword: "시각 피로", keywordEn: "Eye Strain", codes: [6] },
  { keyword: "예민함", keywordEn: "Hypersensitivity", codes: [6] },
  { keyword: "집중력 부족", keywordEn: "Lack of Focus", codes: [6] },
  { keyword: "창의성 부재", keywordEn: "Block in Creativity", codes: [6, 7] },
  { keyword: "혼돈", keywordEn: "Disorientation", codes: [6, 7] },
  { keyword: "단절감", keywordEn: "Sense of Isolation", codes: [7] },
  { keyword: "존재감 상실", keywordEn: "Loss of Presence", codes: [7] },
  { keyword: "기력 약화", keywordEn: "Weakened Vital Energy", codes: [7] },
];

const PAGE_COLORS = [
  'from-red-500 to-rose-500',
  'from-orange-500 to-amber-500',
  'from-yellow-500 to-lime-500',
  'from-emerald-500 to-teal-500',
  'from-indigo-500 to-purple-500'
];

// 64개를 13개씩, 마지막은 12개로 분할 (13 * 4 + 12 = 64)
const PAGES = [
  { color: PAGE_COLORS[0], keywords: ALL_KEYWORDS.slice(0, 13) },
  { color: PAGE_COLORS[1], keywords: ALL_KEYWORDS.slice(13, 26) },
  { color: PAGE_COLORS[2], keywords: ALL_KEYWORDS.slice(26, 39) },
  { color: PAGE_COLORS[3], keywords: ALL_KEYWORDS.slice(39, 52) },
  { color: PAGE_COLORS[4], keywords: ALL_KEYWORDS.slice(52, 64) },
];

interface SevenCodeCheckModuleProps {
  onComplete: (keywords: string[], weakestCode: number) => void;
}

const SevenCodeCheckModule: React.FC<SevenCodeCheckModuleProps> = ({ onComplete }) => {
  const { t, i18n } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  useEffect(() => {
    speak(t('speech.startSevenCodeTest', '7코드 건강 점검입니다. 해당되는 항목을 선택해 주세요.'));
  }, []);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev =>
      prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]
    );
  };

  const calculateWeakestCode = () => {
    // 각 코드별 penalty 누적
    const penaltyScores = [0, 0, 0, 0, 0, 0, 0];
    selectedKeywords.forEach(kwStr => {
      const found = ALL_KEYWORDS.find(k => k.keyword === kwStr);
      if (found) {
        found.codes.forEach(code => {
          if (code >= 1 && code <= 7) penaltyScores[code - 1] += 1;
        });
      }
    });

    // 코드별 총 매핑 키워드 수로 정규화하여 분포 편향 제거
    const codeWeights = [0, 0, 0, 0, 0, 0, 0];
    ALL_KEYWORDS.forEach(k => {
      k.codes.forEach(code => {
        if (code >= 1 && code <= 7) codeWeights[code - 1] += 1;
      });
    });

    const normalizedScores = penaltyScores.map((score, idx) =>
      codeWeights[idx] > 0 ? score / codeWeights[idx] : 0
    );

    // 정규화된 점수가 가장 높은 코드가 weakest. 동점 시 중간 코드(4) 부터 탐색
    let maxScore = -1;
    let weakestIndex = 3; // 기본값: 4코드(가슴, 중간 코드)
    const searchOrder = [3, 2, 4, 1, 5, 0, 6]; // 4→3→5→2→6→1→7 순서 (중앙 우선)
    searchOrder.forEach(idx => {
      if (normalizedScores[idx] > maxScore) {
        maxScore = normalizedScores[idx];
        weakestIndex = idx;
      }
    });

    return weakestIndex + 1;
  };

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      const weakestCode = calculateWeakestCode();
      const finalKeywords = selectedKeywords.length > 0 ? selectedKeywords : [t('common.noSpecialSymptoms')];
      onComplete(finalKeywords, weakestCode);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  };

  const page = PAGES[currentPage];
  const isLastPage = currentPage === PAGES.length - 1;
  const pageSelectedCount = page.keywords.filter(k => selectedKeywords.includes(k.keyword)).length;

  return (
    <div className="flex flex-col items-center h-[calc(100vh-80px)] p-4 mx-auto max-w-5xl transition-all">
      {/* 헤더 영역 */}
      <div className="text-center mb-3 shrink-0">
        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t('sevenCode.title')}</h2>
        <p className="text-gray-300 text-base sm:text-lg font-bold">
          {t('sevenCode.subtitle')}
        </p>
        <p className="text-gray-400 text-sm sm:text-base font-medium mt-1">
          {t('sevenCode.subNotice')} ({currentPage + 1} / {PAGES.length} {i18n.language?.startsWith('en') ? 'Pages' : '페이지'})
        </p>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-3 bg-gray-800 rounded-full mb-4 shrink-0">
        <div 
          className={`h-full bg-gradient-to-r ${PAGES[currentPage].color} rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.6)]`}
          style={{ width: `${((currentPage + 1) / PAGES.length) * 100}%` }}
        />
      </div>

      {/* 키워드 그리드 - 3열 고정, 남는 공간 활용 */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full flex-1 min-h-0 content-center overflow-y-auto">
        {page.keywords.map(item => {
          const isSelected = selectedKeywords.includes(item.keyword);
          return (
            <button
              key={item.keyword}
              onClick={() => toggleKeyword(item.keyword)}
              className={`p-4 md:p-5 rounded-2xl text-xl md:text-2xl font-black transition-all duration-200 transform hover:scale-[1.02] active:scale-95 leading-snug break-keep ${
                isSelected 
                  ? `bg-gradient-to-r ${page.color} text-white shadow-[0_0_30px_rgba(59,130,246,0.4)] border-2 border-white/30` 
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-500 shadow-lg'
              }`}
            >
              {i18n.language?.startsWith('en') ? item.keywordEn : item.keyword}
            </button>
          );
        })}
      </div>

      {/* 네비게이션 버튼 - 항상 하단에 고정 */}
      <div className="flex justify-between w-full max-w-2xl mt-4 pb-2 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm font-medium">
            {t('sevenCode.thisPage')}: <span className="text-white font-black text-base">{t('sevenCode.pageSelectedCount', { count: pageSelectedCount })}</span>
          </span>
          <span className="text-slate-500 text-sm font-medium">
            {t('sevenCode.totalSelected')}: <span className="text-amber-400 font-black text-base">{t('sevenCode.totalSelectedCount', { count: selectedKeywords.length })}</span>
          </span>
        </div>
      </div>
      <div className="flex justify-between w-full max-w-2xl gap-3 pb-2 shrink-0">
        {currentPage > 0 && (
          <button onClick={handlePrev} className="flex-1 px-6 py-4 rounded-2xl text-xl font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-lg">
            <i className="fas fa-arrow-left mr-2" /> {t('common.prev')}
          </button>
        )}
        <button
          onClick={handleNext}
          className={`flex-1 px-10 py-4 rounded-2xl text-xl font-black transition-all shadow-xl hover:shadow-blue-500/40 active:scale-95 ${
            isLastPage
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
              : `bg-gradient-to-r ${page.color} text-white`
          }`}
        >
          {isLastPage ? <><i className="fas fa-check-circle mr-2" /> {t('sevenCode.complete')}</> : <>{t('common.next')} <i className="fas fa-arrow-right ml-2" /></>}
        </button>
      </div>
    </div>
  );
};

export default SevenCodeCheckModule;
