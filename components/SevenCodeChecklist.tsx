import React, { useState, useEffect } from 'react';
import { SEVEN_CODE_KEYWORDS, KeywordMap } from '../constants/sevenCodeKeywords';

interface Props {
  onNext: (data: { sevenCodeKeywords: string[]; weakestCode: number }) => void;
  onPrev?: () => void;
}

// Fisher-Yates Shuffle
const shuffleArray = (array: KeywordMap[]) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const SevenCodeChecklist: React.FC<Props> = ({ onNext, onPrev }) => {
  const [shuffledKeywords, setShuffledKeywords] = useState<KeywordMap[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');

  const totalPages = 5; // 11, 11, 11, 11, 12 = 56 items

  useEffect(() => {
    setShuffledKeywords(shuffleArray(SEVEN_CODE_KEYWORDS));
  }, []);

  const toggleKeyword = (keyword: string) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  const calculateWeakestCode = () => {
    // 각 코드별 penalty 누적
    const codeCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    selectedKeywords.forEach(kw => {
      const keywordData = SEVEN_CODE_KEYWORDS.find(k => k.keyword === kw);
      if (keywordData) {
        keywordData.codes.forEach(code => {
          codeCounts[code] += 1;
        });
      }
    });

    // 코드별 총 매핑 키워드 수로 정규화하여 분포 편향 제거
    const codeWeights: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    SEVEN_CODE_KEYWORDS.forEach(k => {
      k.codes.forEach(code => {
        if (codeWeights[code] !== undefined) codeWeights[code] += 1;
      });
    });

    const normalizedScores: Record<number, number> = {};
    for (let i = 1; i <= 7; i++) {
      normalizedScores[i] = codeWeights[i] > 0 ? codeCounts[i] / codeWeights[i] : 0;
    }

    // 정규화된 점수가 가장 높은 코드가 weakest. 동점 시 중간 코드(4) 부터 탐색
    let maxScore = -1;
    let weakestCode = 4; // 기본값: 4코드(가슴, 중간 코드)
    const searchOrder = [4, 3, 5, 2, 6, 1, 7]; // 중앙 우선 탐색
    searchOrder.forEach(code => {
      if (normalizedScores[code] > maxScore) {
        maxScore = normalizedScores[code];
        weakestCode = code;
      }
    });

    return weakestCode;
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      const weakestCode = calculateWeakestCode();
      onNext({
        sevenCodeKeywords: Array.from(selectedKeywords),
        weakestCode
      });
    }
  };

  const getPageItems = (pageIndex: number) => {
    if (pageIndex === 4) {
      // 마지막 페이지는 12개
      return shuffledKeywords.slice(44, 56);
    }
    return shuffledKeywords.slice(pageIndex * 11, (pageIndex + 1) * 11);
  };

  const currentItems = getPageItems(currentPage);

  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] p-6 mx-auto transition-all ${layoutMode === 'horizontal' ? 'max-w-5xl' : 'max-w-2xl'}`}>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-4">7-CODE 건강 점검</h2>
        <p className="text-gray-300 text-lg">
          다음 중 현재 나에게 해당되거나 평소 자주 겪는 증상을 모두 선택해주세요.
        </p>
        <p className="text-gray-400 text-base mt-2">
          직관적으로 와닿는 단어를 편하게 고르시면 됩니다. (현재 {currentPage + 1} / {totalPages} 페이지)
        </p>
      </div>

      <div className="w-full h-3 bg-gray-800 rounded-full mb-6">
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
        />
      </div>

      {/* 모드 선택 토글 */}
      <div className="flex justify-end w-full mb-6">
         <div className="bg-gray-800/80 p-1 rounded-xl flex gap-1 border border-gray-700">
           <button 
             onClick={() => setLayoutMode('vertical')}
             className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center ${layoutMode === 'vertical' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
           >
             <i className="fas fa-mobile-alt mr-2 text-lg"></i>세로 모드
           </button>
           <button 
             onClick={() => setLayoutMode('horizontal')}
             className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center ${layoutMode === 'horizontal' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
           >
             <i className="fas fa-tablet-alt mr-2 text-lg"></i>가로 모드
           </button>
         </div>
      </div>

      <div className={`grid gap-4 w-full mb-10 ${layoutMode === 'vertical' ? 'grid-cols-2' : 'grid-cols-3 md:grid-cols-4'}`}>
        {currentItems.map((item) => {
          const isSelected = selectedKeywords.has(item.keyword);
          return (
            <button
              key={item.keyword}
              onClick={() => toggleKeyword(item.keyword)}
              className={`p-5 md:p-7 rounded-2xl text-xl md:text-2xl font-black transition-all duration-200 transform hover:scale-105 active:scale-95 leading-snug break-keep ${
                isSelected 
                  ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.6)] border-2 border-blue-300' 
                  : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-500'
              }`}
            >
              {item.keyword}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between w-full max-w-md mt-auto">
        <button
          onClick={currentPage === 0 ? onPrev : () => setCurrentPage(prev => prev - 1)}
          className="px-6 py-3 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
        >
          {currentPage === 0 ? '이전 단계' : '이전 페이지'}
        </button>
        <button
          onClick={handleNext}
          className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-blue-500/25"
        >
          {currentPage === totalPages - 1 ? '점검 완료' : '다음 페이지'}
        </button>
      </div>
    </div>
  );
};
