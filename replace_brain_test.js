// BrainTestModule.tsx 파일의 하드코딩된 한글 텍스트들을 다국어 및 영어 대응 코드로 안전하게 치환하는 스크립트
const fs = require('fs');
const path = require('path');

const targetFilePath = path.join(__dirname, 'components', 'BrainTestModule.tsx');
let code = fs.readFileSync(targetFilePath, 'utf8');

// 1. timer "초" 변환
code = code.replace(`<span>{martTimeLeft}초</span>`, `<span>{martTimeLeft}{t('common.seconds', '초')}</span>`);
code = code.replace(`⏱️ {martShowingCountdown}초`, `⏱️ {martShowingCountdown}{t('common.seconds', '초')}`);
code = code.replace(`⏱️ {distractionCountdown}초`, `⏱️ {distractionCountdown}{t('common.seconds', '초')}`);
code = code.replace(`⏱️ {mathTimeLeft}초`, `⏱️ {mathTimeLeft}{t('common.seconds', '초')}`);

// 2. "🛒 물건 8개와 표시된 가격을 기억하세요" 번역
code = code.replace(
  `<span className="text-white font-bold text-sm sm:text-xl">🛒 물건 8개와 표시된 가격을 기억하세요</span>`,
  `<span className="text-white font-bold text-sm sm:text-xl">{t('brainTest.memorizeItemsAndPrices', '🛒 물건 8개와 표시된 가격을 기억하세요')}</span>`
);

// 3. 8개 아이템 그리드 내의 "원" / "$" 환산 처리
const originalGridItem = `                      {martItemsToRemember.map((item, i) => {
                        const showPrice = martPriceVisibleIds.includes(item.id);
                        return (
                          <div key={item.id}
                            className={\`flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border \${showPrice ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-700/30 border-white/20'} \${isPortraitMode ? 'px-3 py-4' : 'px-3 sm:px-5 py-3 sm:py-5'}\`}>
                            <span className={\`\${isPortraitMode ? 'text-5xl' : 'text-4xl sm:text-6xl'}\`}>{item.emoji}</span>
                            {showPrice ? (
                              <span className={\`text-amber-300 font-black mt-2 \${isPortraitMode ? 'text-base' : 'text-sm sm:text-lg'}\`}>{item.price.toLocaleString()}원</span>
                            ) : (
                              <span className={\`text-white/30 font-bold mt-2 \${isPortraitMode ? 'text-sm' : 'text-xs sm:text-sm'}\`}>???</span>
                            )}
                          </div>
                        );
                      })}`;

const newGridItem = `                      {martItemsToRemember.map((item, i) => {
                        const showPrice = martPriceVisibleIds.includes(item.id);
                        const isEnglish = i18n.language ? i18n.language.startsWith('en') : true;
                        return (
                          <div key={item.id}
                            className={\`flex flex-col items-center justify-center rounded-2xl sm:rounded-3xl border \${showPrice ? 'bg-amber-500/20 border-amber-500/50' : 'bg-slate-700/30 border-white/20'} \${isPortraitMode ? 'px-3 py-4' : 'px-3 sm:px-5 py-3 sm:py-5'}\`}>
                            <span className={\`\${isPortraitMode ? 'text-5xl' : 'text-4xl sm:text-6xl'}\`}>{item.emoji}</span>
                            {showPrice ? (
                              <span className={\`text-amber-300 font-black mt-2 \${isPortraitMode ? 'text-base' : 'text-sm sm:text-lg'}\`}>
                                {isEnglish ? \`$\${(item.price / 1000).toLocaleString()}\` : \`\${item.price.toLocaleString()}\${t('common.currencyWon', '원')}\`}
                              </span>
                            ) : (
                              <span className={\`text-white/30 font-bold mt-2 \${isPortraitMode ? 'text-sm' : 'text-xs sm:text-sm'}\`}>???</span>
                            )}
                          </div>
                        );
                      })}`;

code = code.replace(originalGridItem, newGridItem);

// 4. "장바구니", "기억한 물건을 터치해서 담아주세요" 번역
code = code.replace(`<span className="text-white font-black flex-1 text-base sm:text-lg">장바구니</span>`, `<span className="text-white font-black flex-1 text-base sm:text-lg">{t('brainTest.cart', '장바구니')}</span>`);
code = code.replace(
  `<span className="text-white font-bold text-center text-xs sm:text-sm">기억한 물건을 터치해서 담아주세요</span>`,
  `<span className="text-white font-bold text-center text-xs sm:text-sm">{t('brainTest.touchToCart', '기억한 물건을 터치해서 담아주세요')}</span>`
);

// 5. "가격이 보였던 물건의 총 금액은?" 및 "???원" 번역
code = code.replace(
  `<h3 className="text-white font-black text-xl sm:text-2xl mb-5">가격이 보였던 물건의 총 금액은?</h3>`,
  `<h3 className="text-white font-black text-xl sm:text-2xl mb-5">{t('brainTest.totalPriceQuestion', '가격이 보였던 물건의 총 금액은?')}</h3>`
);

const originalMathItems = `                      {mathPriceItems.map(item => (
                        <div key={item.id} className="bg-amber-500/20 rounded-2xl px-4 py-3 flex flex-col items-center border border-amber-500/30">
                          <span className="text-5xl sm:text-6xl">{item.emoji}</span>
                          <span className="text-amber-300/50 font-black text-sm mt-2">???원</span>
                        </div>
                      ))}`;

const newMathItems = `                      {mathPriceItems.map(item => {
                        const isEnglish = i18n.language ? i18n.language.startsWith('en') : true;
                        return (
                          <div key={item.id} className="bg-amber-500/20 rounded-2xl px-4 py-3 flex flex-col items-center border border-amber-500/30">
                            <span className="text-5xl sm:text-6xl">{item.emoji}</span>
                            <span className="text-amber-300/50 font-black text-sm mt-2">
                              {isEnglish ? '???' : \`???\${t('common.currencyWon', '원')}\`}
                            </span>
                          </div>
                        );
                      })}`;

code = code.replace(originalMathItems, newMathItems);

// 6. 플레이스홀더 및 "확인" 버튼
const originalInputSec = `                        <input
                          type="number"
                          inputMode="numeric"
                          value={mathInputValue}
                          onChange={e => setMathInputValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleMathSubmit()}
                          placeholder="금액 입력 (예: 12300)"
                          className="w-48 text-center text-xl font-black bg-white/10 border-2 border-amber-400/50 rounded-2xl py-4 text-white placeholder-white/30 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition-all"
                          autoFocus
                        />`;

const newInputSec = `                        {(() => {
                          const isEnglish = i18n.language ? i18n.language.startsWith('en') : true;
                          return (
                            <input
                              type="number"
                              inputMode="numeric"
                              value={mathInputValue}
                              onChange={e => setMathInputValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleMathSubmit()}
                              placeholder={isEnglish ? t('brainTest.pricePlaceholderEn', 'Enter price (e.g. 15)') : t('brainTest.pricePlaceholder', '금액 입력 (예: 15000)')}
                              className="w-48 text-center text-xl font-black bg-white/10 border-2 border-amber-400/50 rounded-2xl py-4 text-white placeholder-white/30 focus:outline-none focus:border-amber-400 focus:bg-white/15 transition-all"
                              autoFocus
                            />
                          );
                        })()}`;

code = code.replace(originalInputSec, newInputSec);
code = code.replace(`>확인</button>`, `>{t('common.confirm', '확인')}</button>`);

// 7. 정답/오답 및 오차 범위 피드백 번역
const originalAnswerSec = `                    {mathQuizPhase === 'answered' && (
                      <div className="mt-3">
                        <p className={\`text-xl font-black \${mathIsCorrect ? 'text-emerald-400' : 'text-red-400'}\`}>
                          {mathIsCorrect ? '🎉 정답!' : \`❌ 정답: \${mathCorrectAnswer.toLocaleString()}원\`}
                        </p>
                        {!mathIsCorrect && mathInputValue && (
                          <p className="text-white/50 text-sm mt-1">입력값: {parseInt(mathInputValue).toLocaleString()}원 (오차: {Math.abs(parseInt(mathInputValue) - mathCorrectAnswer).toLocaleString()}원)</p>
                        )}
                      </div>
                    )}`;

const newAnswerSec = `                    {mathQuizPhase === 'answered' && (
                      <div className="mt-3">
                        {(() => {
                          const isEnglish = i18n.language ? i18n.language.startsWith('en') : true;
                          return (
                            <>
                              <p className={\`text-xl font-black \${mathIsCorrect ? 'text-emerald-400' : 'text-red-400'}\`}>
                                {mathIsCorrect 
                                  ? t('brainTest.correctAnswerMessage', '🎉 정답!') 
                                  : \`\${t('brainTest.incorrectAnswerMessage', '❌ 오답. 정답')}: \${isEnglish ? \`$\${(mathCorrectAnswer / 1000).toLocaleString()}\` : \`\${mathCorrectAnswer.toLocaleString()}\${t('common.currencyWon', '원')}\`}\`
                                }
                              </p>
                              {!mathIsCorrect && mathInputValue && (
                                <p className="text-white/50 text-sm mt-1">
                                  {isEnglish 
                                    ? \`Input: $\${parseInt(mathInputValue).toLocaleString()} (Error: $\${Math.abs(parseInt(mathInputValue) - (mathCorrectAnswer / 1000)).toLocaleString()})\`
                                    : \`입력값: \${parseInt(mathInputValue).toLocaleString()}원 (오차: \${Math.abs(parseInt(mathInputValue) - mathCorrectAnswer).toLocaleString()}원)\`
                                  }
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}`;

code = code.replace(originalAnswerSec, newAnswerSec);

// 8. 결과 대시보드 내 한글 텍스트 번역
code = code.replace(`<h2 className="text-2xl sm:text-3xl font-black text-white">테스트 완료!</h2>`, `<h2 className="text-2xl sm:text-3xl font-black text-white">{t('brainTest.testCompleted', '테스트 완료!')}</h2>`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">평균 반응시간</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.avgReactionTime', '평균 반응시간')}</span>`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">AI 측정 오답</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.aiErrors', 'AI 측정 오답')}</span>`);
code = code.replace(`{resultData.reactionErrors}회`, `{resultData.reactionErrors}{t('common.times', '회')}`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">기억력 정답</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.memoryCorrect', '기억력 정답')}</span>`);
code = code.replace(`{resultData.memoryCorrect}/{MART_ITEMS_TO_REMEMBER}개`, `{resultData.memoryCorrect}/{MART_ITEMS_TO_REMEMBER}{t('common.itemsCount', '개')}`);
code = code.replace(`틀린 개수: {MART_ITEMS_TO_REMEMBER - (resultData.memoryCorrect || 0)}개`, `{t('brainTest.errorsCount', '틀린 개수')}: {MART_ITEMS_TO_REMEMBER - (resultData.memoryCorrect || 0)}{t('common.itemsCount', '개')}`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">종합 평가</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.overallEvaluation', '종합 평가')}</span>`);
code = code.replace(
  `{(resultData as any).finalScore >= 80 ? '🌟 우수' : (resultData as any).finalScore >= 50 ? '👍 보통' : '💪 노력 필요'}`,
  `{(resultData as any).finalScore >= 80 ? t('common.excellent', '🌟 우수') : (resultData as any).finalScore >= 50 ? t('common.normal', '👍 보통') : t('common.needsImprovement', '💪 노력 필요')}`
);
code = code.replace(`종합 인지 능력: {(resultData as any).finalScore || 0}점`, `{t('brainTest.overallScore', '종합 인지 능력')}: {(resultData as any).finalScore || 0}{t('common.scoreUnit', '점')}`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">3자리 연산 (방해 자극)</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.distractionTitle', '3자리 연산 (방해 자극)')}</span>`);
code = code.replace(`{(resultData as any).distractionCorrect}/2개 정답`, `{(resultData as any).distractionCorrect}/2{t('common.correctCount', '개 정답')}`);
code = code.replace(`<span className="text-white/60 text-xs font-bold">가격 계산 (주관식)</span>`, `<span className="text-white/60 text-xs font-bold">{t('brainTest.priceCalculationTitle', '가격 계산 (주관식)')}</span>`);
code = code.replace(`{resultData.mathCorrect ? '✅ 정답' : '❌ 오답'}`, `{resultData.mathCorrect ? t('common.correct', '✅ 정답') : t('common.incorrect', '❌ 오답')}`);
code = code.replace(`다음 단계로 →`, `{t('common.nextStepArrow', '다음 단계로 →')}`);

fs.writeFileSync(targetFilePath, code, 'utf8');
console.log("Successfully replaced and translated BrainTestModule.tsx text!");
