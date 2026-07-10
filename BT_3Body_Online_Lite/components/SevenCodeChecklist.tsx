import React, { useState, useEffect } from 'react';
import { t } from '../i18n';
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

  const itemsPerPage = 8;
  const totalPages = Math.ceil(SEVEN_CODE_KEYWORDS.length / itemsPerPage);

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
    const codeCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    
    // Count occurrences for each code
    selectedKeywords.forEach(kw => {
      const keywordData = SEVEN_CODE_KEYWORDS.find(k => k.keyword === kw);
      if (keywordData) {
        keywordData.codes.forEach(code => {
          codeCounts[code] += 1;
        });
      }
    });

    // Find the code with max count
    let maxCount = -1;
    let weakestCode = 1;

    Object.entries(codeCounts).forEach(([codeStr, count]) => {
      const code = parseInt(codeStr);
      if (count > maxCount) {
        maxCount = count;
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

  const currentItems = shuffledKeywords.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">{t("7-CODE 건강 점검")}</h2>
        <p className="text-gray-300">
          다음 중 현재 나에게 해당되거나 평소 자주 겪는 증상을 모두 선택해주세요.
        </p>
        <p className="text-gray-400 text-sm mt-2">
          직관적으로 와닿는 단어를 편하게 고르시면 됩니다. (현재 {currentPage + 1} / {totalPages} 페이지)
        </p>
      </div>

      <div className="w-full h-2 bg-gray-800 rounded-full mb-8">
        <div 
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full mb-10">
        {currentItems.map((item) => {
          const isSelected = selectedKeywords.has(item.keyword);
          return (
            <button
              key={item.keyword}
              onClick={() => toggleKeyword(item.keyword)}
              className={`p-4 rounded-xl text-lg font-medium transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                isSelected 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-2 border-blue-400' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border-2 border-transparent'
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
