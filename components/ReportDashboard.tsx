
import React, { useState } from 'react';
import { BodyReport, CapturedImage } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import FeedbackPanel from './FeedbackPanel';

interface ReportDashboardProps {
  report: BodyReport;
  images: CapturedImage[];
  onRestart: () => void;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ report, images, onRestart }) => {
  const [copied, setCopied] = useState(false);
  const radarData = (report?.postureMetrics || []).map(m => ({
    subject: m?.name || '항목',
    A: m.score,
    fullMark: 100,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'text-emerald-500 bg-emerald-50';
      case 'Fair': return 'text-amber-500 bg-amber-50';
      case 'Poor': return 'text-rose-500 bg-rose-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const threeBody = report.threeBodyAnalysis;
    const program = report.programRecommendation;
    const chakra = report.kwangmyungChakra;

    const shareText = [
      `🏋️ BTC 3바디 AI 체력 측정 결과`,
      `━━━━━━━━━━━━━━━━━`,
      `👤 ${report.userInfo.name}님 (${report.userInfo.gender === 'male' ? '남성' : '여성'}, 만 ${report.userInfo.age}세)`,
      `📅 ${new Date(report.date).toLocaleDateString()}`,
      ``,
      `📊 핵심 수치`,
      `  • 생물학적 나이: ${report.userInfo.age}세`,
      `  • 신체 나이: ${report.physicalAge}세`,
      `  • 뇌 나이: ${report.brainAge || '측정 안됨'}세`,
      `  • 얼굴 나이: ${report.faceAgeEstimate}세`,
      `  • 3바디 통합 밸런스 나이: ${report.comprehensiveAge || report.physicalAge}세`,
      `  • 3바디 코어 밸런스 점수: ${report.overallScore}점`,
      ``,
      ...(threeBody ? [
        `🔵 3BODY 균형 분석`,
        `  • PHYSICAL BODY (신체 활력 및 중심축): ${threeBody.body?.score || 0}점`,
        `  • ENERGY BODY (정서 및 기 에너지 밸런스): ${threeBody.mind?.score || 0}점`,
        `  • INFORMATION BODY (두뇌 인지 및 정보 처리력): ${threeBody.brain?.score || 0}점`,
        ``,
      ] : []),
      ...(chakra ? [
        `✨ 광명차크라 수련 필요도: ${chakra.needLevel}`,
        ``,
      ] : []),
      ...(program ? [
        `🎯 맞춤 추천: ${program.recommended}`,
        `   ${program.reason}`,
        ``,
      ] : []),
      `💬 종합 평가`,
      `"${report.summary}"`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `🏢 브레인트레이닝센터 BTC 3바디 AI 체력 측정 시스템`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  // Determine specialized programs for new members based on 7-CODE
  const getSpecializedPrograms = () => {
    if (!report.energy3Body7Code || !report.energy3Body7Code.sevenCodeDetailed) {
      return { 
        bodyFree: true, cleanBreath: true, mindFree: false, 
        reason: "신체 에너지 순환과 활력 충전을 위해 기본적으로 추천되는 프로그램입니다." 
      };
    }
    
    let rootSacralScore = 100;
    let solarHeartScore = 100;
    
    report.energy3Body7Code.sevenCodeDetailed.forEach(code => {
      // 1번(Root), 2번(Sacral)
      if (code.name.match(/1|2|root|sacral|회음|단전/i)) {
        if (code.score < rootSacralScore) rootSacralScore = code.score;
      }
      // 3번(Solar Plexus), 4번(Heart)
      if (code.name.match(/3|4|solar|heart|중완|단중/i)) {
        if (code.score < solarHeartScore) solarHeartScore = code.score;
      }
    });

    if (rootSacralScore <= solarHeartScore) {
      return {
        bodyFree: true,
        cleanBreath: true,
        mindFree: false,
        reason: "하위 차크라(1, 2번)의 에너지가 저하된 패턴입니다. 신체의 근원적인 에너지를 채우고 활력을 회복하기 위해 '바디프리 명상'과 '클린호흡'을 우선적으로 추천합니다."
      };
    } else {
      return {
        bodyFree: false,
        cleanBreath: true,
        mindFree: true,
        reason: "중위/상위 차크라(3, 4번 이상)의 에너지가 정체된 패턴입니다. 가슴의 답답함을 풀고 내면의 감정을 정화하기 위해 '클린호흡'과 '마음프리 명상'을 우선적으로 추천합니다."
      };
    }
  };

  const specialized = getSpecializedPrograms();

  const renderImageWithOverlay = (img: CapturedImage, i: number) => {
    const isPosture = img.step.includes('POSTURE');
    const isFace = img.step.includes('FACE');
    const isStrength = img.step.includes('STRENGTH');

    return (
      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-square">
        <img src={img.dataUrl} className="w-full h-full object-cover" alt={img.step} />
        
        {/* Posture Analysis Overlay */}
        {isPosture && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Spine Line */}
            <div className="absolute left-1/2 top-[20%] bottom-[20%] w-0.5 bg-emerald-400/80 -translate-x-1/2 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            {/* Shoulder Line */}
            <div className="absolute left-[20%] right-[20%] top-[30%] h-0.5 bg-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.8)]">
              <div className="absolute left-0 top-1/2 w-2 h-2 bg-indigo-400 rounded-full -translate-y-1/2 -translate-x-1/2"></div>
              <div className="absolute right-0 top-1/2 w-2 h-2 bg-indigo-400 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
            {/* Pelvis Line */}
            <div className="absolute left-[25%] right-[25%] top-[55%] h-0.5 bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.8)]">
              <div className="absolute left-0 top-1/2 w-2 h-2 bg-amber-400 rounded-full -translate-y-1/2 -translate-x-1/2"></div>
              <div className="absolute right-0 top-1/2 w-2 h-2 bg-amber-400 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            </div>
          </div>
        )}

        {/* Face Analysis Overlay */}
        {isFace && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[60%] h-[70%] border-2 border-dashed border-rose-400/60 rounded-[40%] shadow-[0_0_15px_rgba(251,113,133,0.4)] relative">
              {/* Eye line */}
              <div className="absolute top-[40%] left-[10%] right-[10%] h-[1px] bg-rose-400/40"></div>
              {/* Symmetry line */}
              <div className="absolute top-[10%] bottom-[10%] left-1/2 w-[1px] bg-rose-400/40 -translate-x-1/2"></div>
              {/* Analysis points */}
              <div className="absolute top-[40%] left-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[65%] left-1/2 w-1.5 h-1.5 bg-rose-400 rounded-full -translate-x-1/2"></div>
            </div>
          </div>
        )}

        {/* Strength Reps Overlay */}
        {isStrength && img.reps !== undefined && (
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-md">
            {img.reps}회
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-3 text-sm text-white font-bold text-center">
          {img.step.replace('POSTURE_', '자세:').replace('STRENGTH_', '근력:').replace('_TEST', '').replace('_ANALYSIS', '')}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-white p-6 md:p-10 space-y-12 overflow-auto pb-24 print:p-0 print:overflow-visible">
      {/* Header Info (Print only) */}
      <div className="hidden print:flex justify-between items-center border-b pb-4 mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase">Neuro-Physical Report</h1>
          <p className="text-base font-medium text-slate-500">브레인 트레이닝 센터 | {new Date(report.date).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{report.userInfo.name} ({report.userInfo.gender === 'male' ? '남성' : '여성'})</p>
          <p className="text-base font-medium">만 {report.userInfo.age}세</p>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 print:grid-cols-7">
        <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase mb-2">생물학적 나이</span>
            <div className="text-4xl font-black text-slate-800 mb-1">{report.userInfo.age}<span className="text-xl ml-1">세</span></div>
        </div>
        <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase mb-2">신체 나이</span>
            <div className="text-4xl font-black text-indigo-600 mb-1">{report.physicalAge}<span className="text-xl ml-1">세</span></div>
        </div>
        <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase mb-2">얼굴 나이</span>
            <div className="text-4xl font-black text-rose-500 mb-1">{report.faceAgeEstimate}<span className="text-xl ml-1">세</span></div>
        </div>
        <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase mb-2">뇌 나이</span>
            <div className="text-4xl font-black text-amber-500 mb-1">{report.brainAge || '-'}<span className="text-xl ml-1">세</span></div>
        </div>
        <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-500 text-xs font-bold uppercase mb-2">마음 나이</span>
            <div className="text-4xl font-black text-fuchsia-500 mb-1">{report.mindAge || '-'}<span className="text-xl ml-1">세</span></div>
        </div>

        <div className="bg-emerald-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-emerald-200">
            <span className="text-emerald-100 text-xs font-bold uppercase mb-2">3바디 통합 나이</span>
            <div className="text-4xl font-black mb-1">{report.comprehensiveAge || report.physicalAge}<span className="text-xl text-emerald-200 ml-1">세</span></div>
        </div>
        <div className="bg-indigo-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-indigo-200">
            <span className="text-indigo-200 text-xs font-bold uppercase mb-2">3바디 코어 점수</span>
            <div className="text-4xl font-black mb-1">{report.overallScore}<span className="text-xl text-indigo-200 ml-1">점</span></div>
        </div>
      </div>
      <div className="mt-3 text-right print:mt-2">
        <p className="text-[11px] md:text-xs text-slate-400 font-medium">
          * 3바디 통합 밸런스 나이는 신체나이, 얼굴나이, 뇌나이, 마음나이에 대한 가중치를 적용한 종합 나이입니다.
        </p>
      </div>

      {/* 이전 대비 비교 분석 (재측정 시에만 표시) */}
      {report.comparisonAnalysis && (
        <section className="bg-gradient-to-r from-amber-50 to-orange-50 p-8 rounded-3xl border-2 border-amber-200 shadow-md">
          <h3 className="text-xl font-bold text-amber-800 mb-4 flex items-center gap-2">
            <i className="fas fa-chart-line text-amber-500"></i>
            📊 이전 측정 대비 변화 분석
          </h3>
          
          {/* 종합 변화 요약 */}
          <div className={`mb-6 p-4 rounded-2xl border ${
            report.comparisonAnalysis.overallChange === '개선' 
              ? 'bg-emerald-50 border-emerald-200' 
              : report.comparisonAnalysis.overallChange === '악화'
              ? 'bg-rose-50 border-rose-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-3xl font-black ${
                report.comparisonAnalysis.overallChange === '개선' ? 'text-emerald-600' 
                : report.comparisonAnalysis.overallChange === '악화' ? 'text-rose-600' 
                : 'text-blue-600'
              }`}>
                {report.comparisonAnalysis.overallChange === '개선' ? '📈 개선' 
                : report.comparisonAnalysis.overallChange === '악화' ? '📉 악화' 
                : '➡️ 유지'}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-medium">{report.comparisonAnalysis.summary}</p>
          </div>

          {/* 세부 점수 변화 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {report.comparisonAnalysis.scoreChanges.map((sc, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm">
                <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">{sc.category}</div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-sm">{sc.previousScore}</span>
                  <span className="text-slate-300">→</span>
                  <span className="text-slate-800 font-black text-lg">{sc.currentScore}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    sc.change > 0 ? 'bg-emerald-100 text-emerald-600' 
                    : sc.change < 0 ? 'bg-rose-100 text-rose-600' 
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    {sc.change > 0 ? `+${sc.change}` : sc.change}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{sc.comment}</div>
              </div>
            ))}
          </div>

          {/* 프로그램 효과 */}
          <div className="bg-white rounded-2xl p-4 border border-amber-200">
            <div className="text-xs font-bold text-amber-600 mb-1 flex items-center gap-1">
              <i className="fas fa-star text-amber-400"></i> 프로그램 효과 평가
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{report.comparisonAnalysis.programEffect}</p>
          </div>
        </section>
      )}

      {/* Captured Evidence Section */}
      {images && images.length > 0 && (
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="fas fa-camera text-indigo-500"></i>
          측정 데이터 증빙 (Capture Evidence)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.filter(img => !['FACE_ANALYSIS', 'BRAIN_REACTION', 'BRAIN_MEMORY', 'SEVEN_CODE_CHECK'].includes(img.step)).map((img, i) => renderImageWithOverlay(img, i))}
        </div>
      </section>
      )}

      {/* Posture & Balance Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white p-8 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6">신체 정렬 및 균형 분석</h3>
          
          {report?.bodyTypeAnalysis && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
              <h4 className="text-sm font-bold text-indigo-500 mb-1">AI 종합 체형 분석</h4>
              <p className="text-lg font-black text-indigo-900">{report.bodyTypeAnalysis}</p>
            </div>
          )}

          {/* 신체 틀어짐 분석 */}
          {report?.bodyAlignmentAnalysis && report.bodyAlignmentAnalysis.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1">
                <span>🦴</span> 신체 틀어짐 분석 (AI 실측 기반)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.bodyAlignmentAnalysis.map((item: any, i: number) => {
                  const severityConfig: Record<string, { bg: string, text: string, border: string }> = {
                    '정상': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                    '경미': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                    '주의': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                    '심함': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                  };
                  const cfg = severityConfig[item?.severity] || severityConfig['경미'];
                  return (
                    <div key={i} className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                      <div className="flex items-center justify-between mb-1">
                        <h5 className="font-bold text-slate-800 text-sm">{item?.issue}</h5>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-black ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
                          {item?.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mb-1">
                        {item?.measuredValue && !item.measuredValue.includes('N/A') && (
                          <>
                            측정값: <strong className="text-slate-700">{item?.measuredValue}</strong>
                            <span className="mx-1">|</span>
                          </>
                        )}
                        정상: {item?.normalRange}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{item?.impact}</p>
                      {item?.recommendation && (
                        <p className="text-xs text-indigo-600 font-medium mt-1">💡 {item.recommendation}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Radar name="자세" dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {report?.postureMetrics?.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex-1">
                  <h5 className="font-bold text-slate-800 text-base">{item?.name}</h5>
                  <p className="text-sm font-medium text-slate-600 leading-snug">{item?.description}</p>
                </div>
                <span className={`ml-2 px-3 py-1.5 rounded-lg text-sm font-black ${getStatusColor(item?.status)}`}>
                  {item?.score}점
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Strength & Aging */}
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-6">기능적 수행 능력 상세</h3>
                <div className="grid grid-cols-1 gap-4">
                    {report?.strengthMetrics?.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="font-bold text-indigo-900 text-base">{item?.exercise}</h5>
                                <div className="text-right">
                                  <span className="text-sm font-black text-indigo-600 block">자세 점수: {item?.formScore}점</span>
                                  {item?.reps > 0 && <span className="text-sm font-bold text-indigo-500 block">수행 횟수: {item?.reps}회</span>}
                                </div>
                            </div>
                            <p className="text-sm font-medium text-indigo-800 mb-3">{item?.performance}</p>
                            <p className="text-sm font-bold text-indigo-700 bg-indigo-100/60 p-3 rounded-lg">💡 {item?.recommendation}</p>
                        </div>
                    ))}
                    {report?.agingMetrics?.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                            <div className="flex justify-between items-center mb-2">
                                <h5 className="font-bold text-rose-900 text-base">{item.testName}</h5>
                                <span className="text-base font-black text-rose-600">{item.score}점</span>
                            </div>
                            <p className="text-sm font-medium text-rose-800">{item.result}</p>
                            {item.description && (
                                <p className="text-sm font-bold text-rose-700 bg-rose-100/60 p-3 rounded-lg mt-3 leading-relaxed">
                                    💡 {item.description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* 뇌 건강 상세 평가 (신규) */}
            {report?.brainTestEvaluation && (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 mt-6 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                  <i className="fas fa-brain text-amber-500"></i>
                  뇌 건강 및 인지·반응 상세 분석
                </h3>
                <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl relative z-10">
                  <p className="text-sm font-medium text-amber-900 leading-relaxed">
                    {report.brainTestEvaluation}
                  </p>
                </div>
              </div>
            )}

            {/* Face Analysis Detail */}
            {report?.faceAnalysis && (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                  <i className="fas fa-smile-beam text-rose-500"></i>
                  입체 안면 노화 분석
                </h3>
                <div className="space-y-4 relative z-10">
                  {report.faceAnalysis.skinTone && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                      <i className="fas fa-sun text-rose-500 text-sm"></i>
                    </div>
                    <div>
                      <h5 className="text-base font-bold text-slate-800">피부 톤 및 밝기</h5>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{report.faceAnalysis.skinTone}</p>
                    </div>
                  </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                      <i className="fas fa-water text-rose-500 text-sm"></i>
                    </div>
                    <div>
                      <h5 className="text-base font-bold text-slate-800">피부 탄력도</h5>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{report.faceAnalysis.elasticity}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                      <i className="fas fa-wave-square text-rose-500 text-sm"></i>
                    </div>
                    <div>
                      <h5 className="text-base font-bold text-slate-800">주름 및 굴곡</h5>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{report.faceAnalysis.wrinkles}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h5 className="text-sm font-bold text-slate-500 uppercase mb-2">안면 종합 평가</h5>
                    <p className="text-base text-slate-800 font-bold">{report.faceAnalysis.summary}</p>
                  </div>
                  {report.faceAnalysis.recommendation && (
                    <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <h5 className="text-sm font-bold text-rose-500 uppercase mb-2">맞춤형 개선 솔루션</h5>
                      <p className="text-base text-rose-800 font-bold">{report.faceAnalysis.recommendation}</p>
                    </div>
                  )}
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Brain Test Detail Section */}
      {(() => {
        const reactionData = images.find(img => img.step === 'BRAIN_REACTION')?.brainTestData;
        const memoryData = images.find(img => img.step === 'BRAIN_MEMORY')?.brainTestData;
        const hasBrainData = reactionData || memoryData;
        
        if (!hasBrainData) return null;

        const getReactionGrade = (ms: number) => {
          if (ms <= 600) return { grade: '매우 우수', bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', emoji: '🏆' };
          if (ms <= 800) return { grade: '우수', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', emoji: '✅' };
          if (ms <= 1000) return { grade: '보통', bg: '#fffbeb', border: '#fde68a', text: '#d97706', emoji: '⚠️' };
          return { grade: '개선 필요', bg: '#fff1f2', border: '#fecdd3', text: '#e11d48', emoji: '🔻' };
        };


        const getMemoryGrade = (span: number) => {
          if (span >= 6) return { grade: '매우 우수', bg: '#ecfdf5', border: '#a7f3d0', text: '#059669', emoji: '🏆' };
          if (span >= 5) return { grade: '우수', bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', emoji: '✅' };
          if (span >= 3) return { grade: '보통', bg: '#fffbeb', border: '#fde68a', text: '#d97706', emoji: '⚠️' };
          return { grade: '개선 필요', bg: '#fff1f2', border: '#fecdd3', text: '#e11d48', emoji: '🔻' };
        };

        return (
          <section className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-[40px] p-8 md:p-12 border border-indigo-100">
            <div className="text-center mb-10">
              <span className="text-purple-500 text-sm font-bold uppercase tracking-[0.3em]">BRAIN AGE TEST DETAIL</span>
              <h3 className="text-4xl font-black text-slate-900 mt-3">🧠 두뇌 인지 반응 결과 가이드</h3>
              {report.brainAge && (
                <div className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-full shadow-lg">
                  <span className="font-bold">추정 뇌 나이</span>
                  <span className="text-3xl font-black">{report.brainAge}세</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 반응속도 */}
              {reactionData && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="text-center mb-5">
                    <div className="text-4xl mb-2">⚡</div>
                    <h4 className="text-lg font-black text-slate-800">두뇌 인지 반응 (속도 및 억제력)</h4>
                    <p className="text-xs text-slate-400 mt-1">스트룹 효과 극복 및 전두엽 억제 통제력</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <span className="text-sm font-bold text-slate-500">평균 반응시간</span>
                      <div className="text-4xl font-black text-indigo-600">{reactionData.reactionTimeMs}ms</div>
                    </div>
                    
                    {/* Gauge */}
                    <div className="relative h-3 bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-200 rounded-full overflow-hidden">
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white shadow-md"
                        style={{ left: `${Math.min(Math.max((reactionData.reactionTimeMs! - 400) / 800 * 100, 0), 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>빠름 (400ms)</span>
                      <span>느림 (1200ms)</span>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <span className="text-sm text-slate-600">억제 실패</span>
                      <span className={`font-black text-lg ${(reactionData.reactionErrors || 0) === 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {reactionData.reactionErrors || 0}회
                      </span>
                    </div>

                    {(() => {
                      const g = getReactionGrade(reactionData.reactionTimeMs || 999);
                      return (
                        <div className="text-center py-2 rounded-xl" style={{ backgroundColor: g.bg, border: `1px solid ${g.border}` }}>
                          <span className="text-lg mr-1">{g.emoji}</span>
                          <span className="font-black" style={{ color: g.text }}>{g.grade}</span>
                        </div>
                      );
                    })()}
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                      두뇌 인지 반응은 교란 자극(색상 불일치 등)을 이겨내고 올바른 판단을 내리는 능력을 뜻합니다. 빠른 속도도 중요하지만, 충동을 통제하고 오답(억제 실패)을 내지 않아야 전두엽의 기능이 우수하다고 평가됩니다.
                    </p>
                  </div>
                </div>
              )}



              {/* 마트 장보기 기억력 */}
              {memoryData && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                  <div className="text-center mb-5">
                    <div className="text-4xl mb-2">🛒</div>
                    <h4 className="text-lg font-black text-slate-800">마트 장보기 기억력</h4>
                    <p className="text-xs text-slate-400 mt-1">작업기억(Working Memory) + 산술능력</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="text-center">
                      <span className="text-sm font-bold text-slate-500">기억 정답</span>
                      <div className="text-4xl font-black text-indigo-600">{memoryData.memoryCorrect ?? memoryData.memorySpan}/6개</div>
                    </div>
                    
                    {/* Block visualization */}
                    <div className="flex justify-center gap-1.5">
                      {Array.from({ length: 6 }, (_, i) => (
                        <div 
                          key={i}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                            i < (memoryData.memoryCorrect ?? memoryData.memorySpan ?? 0)
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-300 border border-slate-200'
                          }`}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* 가격 계산 */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <span className="text-sm text-slate-600">💰 가격 계산</span>
                      <span className={`font-black text-lg ${memoryData.mathCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {memoryData.mathCorrect ? '✅ 정답' : '❌ 오답'}
                      </span>
                    </div>

                    {/* 사칙연산 트릭 */}
                    <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                      <span className="text-sm text-slate-600">🧠 사칙연산 트릭</span>
                      <span className={`font-black text-lg ${(memoryData.distractionCorrect ?? 0) >= 2 ? 'text-emerald-600' : (memoryData.distractionCorrect ?? 0) >= 1 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {memoryData.distractionCorrect ?? 0}/2 정답
                      </span>
                    </div>

                    {(() => {
                      const g = getMemoryGrade(memoryData.memoryCorrect ?? memoryData.memorySpan ?? 0);
                      return (
                        <div className="text-center py-2 rounded-xl" style={{ backgroundColor: g.bg, border: `1px solid ${g.border}` }}>
                          <span className="text-lg mr-1">{g.emoji}</span>
                          <span className="font-black" style={{ color: g.text }}>{g.grade}</span>
                        </div>
                      );
                    })()}
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                      마트 장보기 기억력 테스트는 해마와 전두엽의 작업기억 능력을 측정합니다.
                      6개 물건을 모두 정확하게 기억하면 매우 우수한 수준입니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* 3BODY Analysis Section */}
      {report.threeBodyAnalysis && (
        <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[40px] p-8 md:p-12 text-white">
          <div className="text-center mb-10">
            <span className="text-cyan-400 text-sm font-bold uppercase tracking-[0.3em]">3BODY ANALYSIS</span>
            <h3 className="text-4xl font-black mt-3">3바디 균형 분석</h3>
            <p className="text-slate-300 text-base mt-3 font-medium">신체(Physical) · 에너지(Energy) · 두뇌(Brain)의 통합 밸런스 상태</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { key: 'body', icon: '🏃', title: 'PHYSICAL BODY (신체 활력 및 중심축)', color: 'from-emerald-500 to-teal-600', data: report.threeBodyAnalysis.body },
              { key: 'mind', icon: '💚', title: 'ENERGY BODY (정서 및 기 에너지 밸런스)', color: 'from-violet-500 to-purple-600', data: report.threeBodyAnalysis.mind },
              { key: 'brain', icon: '🧠', title: 'INFORMATION BODY (두뇌 인지 및 정보 처리력)', color: 'from-amber-500 to-orange-600', data: report.threeBodyAnalysis.brain }
            ].map(item => (
              <div key={item.key} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 text-center">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h4 className="font-bold text-xl mb-3">{item.title}</h4>
                <div className={`text-5xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-4`}>
                  {item.data?.score || 0}점
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.data?.score || 0}%` }} />
                </div>
                <p className="text-base text-slate-200 leading-relaxed font-medium">{item.data?.description || ''}</p>
              </div>
            ))}
          </div>

          {/* 7CODE Energy */}
          {report.sevenCodeAnalysis && (
            <div className="mt-10">
              <div className="text-center mb-8">
                <span className="text-amber-400 text-sm font-bold uppercase tracking-[0.3em]">7CODE ENERGY</span>
                <h3 className="text-3xl font-black mt-3">7코드 에너지 분석</h3>
                <p className="text-slate-300 text-base mt-2 font-medium">당신의 에너지 흐름을 7가지 코드로 분석합니다</p>
              </div>
              <div className="space-y-4">
                {[
                  { code: report.sevenCodeAnalysis.code1, num: 1, defaultLabel: '기초 에너지', color: 'from-red-500 to-red-600' },
                  { code: report.sevenCodeAnalysis.code2, num: 2, defaultLabel: '감정 흐름', color: 'from-orange-500 to-orange-600' },
                  { code: report.sevenCodeAnalysis.code3, num: 3, defaultLabel: '추진력', color: 'from-yellow-500 to-yellow-600' },
                  { code: report.sevenCodeAnalysis.code4, num: 4, defaultLabel: '정서 안정', color: 'from-emerald-500 to-emerald-600' },
                  { code: report.sevenCodeAnalysis.code5, num: 5, defaultLabel: '소통', color: 'from-cyan-500 to-cyan-600' },
                  { code: report.sevenCodeAnalysis.code6, num: 6, defaultLabel: '집중·통찰', color: 'from-indigo-500 to-indigo-600' },
                  { code: report.sevenCodeAnalysis.code7, num: 7, defaultLabel: '삶의 방향', color: 'from-violet-500 to-violet-600' }
                ].map(item => (
                  <div key={item.num} className="bg-white/5 rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center font-black text-white text-lg shrink-0`}>
                        {item.num}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-base text-white">{item.code?.label || item.defaultLabel}</span>
                          <span className="text-base font-black text-white">{item.code?.score || 0}점</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                          <div className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.code?.score || 0}%` }} />
                        </div>
                        <p className="text-sm font-medium text-slate-300 mb-2">{item.code?.description || ''}</p>
                        {item.code?.evidence && item.code.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.code.evidence.map((ev, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/10 rounded-md text-[11px] text-emerald-200 border border-emerald-500/30">
                                🔍 {ev}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Kwangmyung Chakra Recommendation */}
      {report.kwangmyungChakra && (
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-[40px] p-8 md:p-12 border border-amber-200/50">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-200/50">
                <span className="text-3xl">✨</span>
              </div>
              <span className="text-amber-600 text-sm font-bold uppercase tracking-[0.3em]">special program</span>
              <h3 className="text-4xl font-black text-slate-900 mt-3">광명차크라 특별수련</h3>
              <p className="text-amber-800/80 text-base font-medium mt-3">7CODE 에너지의 균형 회복과 충전을 돕는 핵심 프로그램</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 md:p-10 shadow-lg border border-amber-100 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-base font-bold text-slate-600">필요 정도</span>
                <span className={`px-5 py-2 rounded-full font-black text-base ${
                  report.kwangmyungChakra.needLevel === '매우 높음' ? 'bg-rose-100 text-rose-600' :
                  report.kwangmyungChakra.needLevel === '높음' ? 'bg-amber-100 text-amber-600' :
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  ⚡ {report.kwangmyungChakra.needLevel}
                </span>
              </div>
              <div className="space-y-5">
                <div>
                  <h5 className="text-sm font-bold text-amber-700 uppercase mb-2">왜 광명차크라가 필요한가요?</h5>
                  <p className="text-base text-slate-800 leading-relaxed font-medium">{report.kwangmyungChakra.reason}</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100">
                  <h5 className="text-sm font-bold text-amber-700 uppercase mb-2">기대 효과</h5>
                  <p className="text-base text-amber-900 leading-relaxed font-bold">{report.kwangmyungChakra.expectedBenefit}</p>
                </div>
              </div>
              <div className="mt-8 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <span className="w-2 h-2 bg-amber-400 rounded-full" />
                  {report.userInfo?.memberType === 'existing' 
                    ? '다음 단계의 의식 성장과 에너지 정화를 위한 핵심 수련'
                    : '66일·100일 프로그램의 깊이를 만들어주는 에너지 핵심축'}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Program Recommendation */}
      {report.programRecommendation && (
        <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent_50%)]" />
          <div className="relative z-10">
            <div className="text-center mb-8">
              <span className="text-indigo-200 text-sm font-bold uppercase tracking-[0.3em]">맞춤 프로그램</span>
              <h3 className="text-4xl font-black mt-3">당신을 위한 추천</h3>
            </div>
            <div className="max-w-2xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-white/20 text-center mb-8">
                <div className={`${report.programRecommendation.recommended?.length > 15 ? 'text-3xl md:text-4xl' : 'text-5xl md:text-6xl'} font-black text-white mb-4 leading-tight`}>{report.programRecommendation.recommended}</div>
                <p className="text-indigo-50 text-lg leading-relaxed font-medium mb-6">{report.programRecommendation.reason}</p>
                <div className="bg-white/10 rounded-2xl p-5 text-base font-bold text-white">{report.programRecommendation.duration}</div>
              </div>
              {(!report.userInfo?.memberType || report.userInfo?.memberType === 'new') && (
                <>
                  <div className="grid grid-cols-3 gap-4 text-center mb-10">
                    {[
                      { label: '21일', desc: '변화 시작', active: report.programRecommendation.recommended?.includes('21') },
                      { label: '66일', desc: '습관 정착', active: report.programRecommendation.recommended?.includes('66') },
                      { label: '100일', desc: '삶의 전환', active: report.programRecommendation.recommended?.includes('100') }
                    ].map(p => (
                      <div key={p.label} className={`rounded-2xl p-5 border ${p.active ? 'bg-white text-indigo-700 border-white shadow-xl' : 'bg-white/5 border-white/10 text-indigo-200'}`}>
                        <div className="text-2xl font-black">{p.label}</div>
                        <div className="text-sm mt-2 font-bold">{p.desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* 7-CODE 맞춤 특화 프로그램 */}
                  <div className="mt-10 pt-10 border-t border-white/10 relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-800 px-6 py-2 rounded-full text-sm font-black text-indigo-200 border border-white/10 shadow-lg tracking-widest whitespace-nowrap">
                      7-CODE 맞춤 특화 수련
                    </div>
                    
                    <div className="text-center mt-8 mb-6">
                      <p className="text-indigo-100 text-lg font-medium bg-white/5 inline-block px-6 py-3 rounded-2xl border border-white/10">
                        {specialized.reason}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
                      {/* Body Free */}
                      {specialized.bodyFree && (
                        <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-amber-400 to-orange-500 border-white/50 shadow-2xl shadow-orange-500/50 transform -translate-y-2">
                          <div className="text-[10px] font-black bg-white text-orange-600 inline-block px-3 py-1.5 rounded-full mb-3 shadow-md uppercase tracking-wider">AI 강력 추천</div>
                          <h4 className="text-2xl font-black text-white mb-3">바디프리 명상</h4>
                          <div className="flex gap-2 mb-5">
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#에너지순환</span>
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#활력충전</span>
                          </div>
                          <div className="flex justify-between items-center text-sm text-white/90 font-bold border-t border-white/20 pt-4 mt-auto">
                            <span>신체 에너지 회복</span>
                            <span>근원적 생명력 강화</span>
                          </div>
                        </div>
                      )}

                      {/* Clean Breath */}
                      {specialized.cleanBreath && (
                        <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-emerald-400 to-teal-500 border-white/50 shadow-2xl shadow-teal-500/50 transform -translate-y-2">
                          <div className="text-[10px] font-black bg-white text-teal-600 inline-block px-3 py-1.5 rounded-full mb-3 shadow-md uppercase tracking-wider">AI 강력 추천</div>
                          <h4 className="text-2xl font-black text-white mb-3">클린호흡 1, 2</h4>
                          <div className="flex gap-2 mb-5">
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#감정정화</span>
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#체형밸런스</span>
                          </div>
                          <div className="flex justify-between items-center text-sm text-white/90 font-bold border-t border-white/20 pt-4 mt-auto">
                            <span>자연치유력 회복</span>
                            <span>단전호흡 기초</span>
                          </div>
                        </div>
                      )}

                      {/* Mind Free */}
                      {specialized.mindFree && (
                        <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-pink-400 to-rose-500 border-white/50 shadow-2xl shadow-rose-500/50 transform -translate-y-2">
                          <div className="text-[10px] font-black bg-white text-rose-600 inline-block px-3 py-1.5 rounded-full mb-3 shadow-md uppercase tracking-wider">AI 강력 추천</div>
                          <h4 className="text-2xl font-black text-white mb-3">마음프리 명상</h4>
                          <div className="flex flex-wrap gap-2 mb-5">
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#자아성찰</span>
                            <span className="text-xs font-bold bg-black/20 text-white px-2 py-1 rounded-md">#의식성장</span>
                          </div>
                          <div className="flex justify-between items-center text-sm text-white/90 font-bold border-t border-white/20 pt-4 mt-auto">
                            <span>내면의 평화</span>
                            <span>러브마이셀프</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Brain Training Links Section */}
      {report?.recommendations && (
      <section className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white">
        <h3 className="text-3xl font-black mb-10 text-center">맞춤형 브레인 트레이닝 추천</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
                <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
                    <i className="fas fa-om"></i>
                </div>
                <h4 className="text-2xl font-bold">맞춤 명상 (Meditation)</h4>
                <p className="text-base font-medium text-slate-300 leading-relaxed">{report.recommendations.meditation}</p>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
                    <i className="fas fa-walking"></i>
                </div>
                <h4 className="text-2xl font-bold">교정 체조 (Gymnastics)</h4>
                <p className="text-base font-medium text-slate-300 leading-relaxed">{report.recommendations.gymnastics}</p>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">
                    <i className="fas fa-puzzle-piece"></i>
                </div>
                <h4 className="text-2xl font-bold">뇌 기능 훈련 (Brain Training)</h4>
                <p className="text-base font-medium text-slate-300 leading-relaxed">{report.recommendations.brainTraining}</p>
            </div>
        </div>
      </section>
      )}

      {/* K-Tarot & K-Face Section */}
      <section className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-[40px] p-8 md:p-12 text-center border border-pink-100 print:hidden relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-pink-200 pointer-events-none">
            <i className="fas fa-sparkles text-6xl opacity-50"></i>
          </div>
          <h3 className="text-3xl font-black text-slate-800 mb-2 flex items-center justify-center gap-3">
              <i className="fas fa-magic text-pink-500"></i> AI K관상 & K타로
          </h3>
          <p className="text-xs font-bold text-rose-500 mb-4">(※ 이 서비스는 정식 등록 회원에게만 제공됩니다.)</p>
          <p className="text-slate-600 mb-8 font-medium">재미로 보는 맞춤형 운세! 건강 데이터와 연동된 특별한 해석을 확인해보세요.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
              <button onClick={() => window.dispatchEvent(new CustomEvent('nav:kface'))} className="px-8 py-6 bg-white text-pink-600 font-bold rounded-[30px] border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50 transition-all flex flex-col items-center gap-3 shadow-md">
                  <span className="text-5xl">🎭</span>
                  <span className="text-lg">K관상 보러가기</span>
              </button>
              <button onClick={() => window.dispatchEvent(new CustomEvent('nav:ktarot'))} className="px-8 py-6 bg-white text-purple-600 font-bold rounded-[30px] border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all flex flex-col items-center gap-3 shadow-md">
                  <span className="text-5xl">🔮</span>
                  <span className="text-lg">K타로 보러가기</span>
              </button>
          </div>
      </section>

      {/* Overall Summary */}
      <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 text-center max-w-4xl mx-auto">
          <h4 className="text-3xl font-black text-slate-800 mb-6">종합 평가 리포트</h4>
          <p className="text-lg font-medium text-slate-700 leading-relaxed mb-8 italic">"{report.summary}"</p>
          <div className="flex flex-wrap justify-center gap-4 print:hidden">
              <button onClick={handleShare} className={`px-8 py-3 font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all ${copied ? 'bg-emerald-500 text-white border border-emerald-500' : 'bg-white text-slate-900 border border-slate-300'}`}>
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i> {copied ? '복사 완료! 카톡에 붙여넣기 하세요' : '카톡 공유용 복사'}
              </button>
              <button onClick={onRestart} className="px-8 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">
                  메인으로 이동
              </button>
          </div>
      </div>

      {/* 관리자 피드백 패널 — Few-Shot 학습 데이터 누적 */}
      <FeedbackPanel report={report} />

      {/* ⚠️ 법적 면책 고지 (의료법 준수) */}
      <div className="mt-4 mb-2 px-6 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-center print:block">
        <p className="text-amber-800 text-xs font-bold mb-1">
          ⚠️ 서비스 이용 안내 (법적 고지)
        </p>
        <p className="text-amber-700 text-[11px] leading-relaxed">
          본 결과는 뇌파와 생체 에너지 균형을 파악하기 위한 <strong>웰니스 스크리닝 지표</strong>입니다.{' '}
          의료기기법에 따른 의료기기 또는 의료행위가 <strong>아닙니다</strong>.<br />
          본 리포트는 의학적 진단·처방·치료를 대체하지 않습니다.{' '}
          근골격계의 심각한 물리적 통증이나 의학적 이상이 지속될 경우 전문 의료기관의 진료를 권장합니다.
        </p>
      </div>
    </div>
  );
};

export default ReportDashboard;
