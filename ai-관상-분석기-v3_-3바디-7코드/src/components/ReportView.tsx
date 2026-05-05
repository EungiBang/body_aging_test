import React from 'react';
import { PhysiognomyReport } from '../services/geminiService';
import { motion } from 'motion/react';
import { RefreshCcw, Sparkles, Brain, Briefcase, Heart, Share2, Printer, ScanFace, Zap, Activity, AlertCircle } from 'lucide-react';

interface ReportViewProps {
  report: PhysiognomyReport;
  imageSrc: string;
  onReset: () => void;
}

export default function ReportView({ report, imageSrc, onReset }: ReportViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const energyBlend = report.animalMorphology.animalMorphologyBlend?.map(b => `${b.type}(${b.matchPercentage}%)`).join(' + ') || report.animalMorphology.type;
    
    const shareText = `[AI 정밀 관상 분석 리포트]

📌 한줄 평: ${report.summary}
🏅 종합 운세 점수: ${report.score}점

🦁 물형(동물상) 에너지: ${report.animalMorphology.type}
🧬 에너지 밸런스: ${energyBlend}

💡 핵심 기질: ${report.animalMorphology.traits.map(t => `#${t}`).join(' ')}

🚀 성공 전략
- 커리어: ${report.lifeStrategy.career}
- 경제적 잠재력: ${report.lifeStrategy.wealth}

🌟 7-Code 에너지 패턴: 1코드(Root)부터 7코드(Crown)까지 정밀 진단 완료

지금 바로 당신의 숨겨진 잠재력을 확인해보세요!
${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '나의 AI 관상 분석 결과',
          text: shareText,
          url: window.location.href,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('공유 실패:', err);
          handleCopyToClipboard(shareText);
        }
      }
    } else {
      handleCopyToClipboard(shareText);
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('결과가 클립보드에 복사되었습니다! 카톡창에 붙여넣기(Paste) 해주세요.');
    } catch (err) {
      alert('복사에 실패했습니다. 수동으로 복사해주세요.');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Header Card */}
      <div className="bg-white shadow-xl border border-gray-100 rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" />
        
        <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
          {/* Captured Image with Analysis VFX */}
          <div className="relative w-48 h-48 shrink-0 rounded-2xl overflow-hidden border border-gray-200 shadow-inner bg-gray-100">
            <img src={imageSrc} alt="Analyzed Face" className="w-full h-full object-cover" />
            
            {/* Tech Overlays */}
            <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay" />
            <motion.div
              animate={{ y: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-transparent via-cyan-400/30 to-transparent"
            />
            <motion.div
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute top-0 left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            />
            
            {/* Corner Brackets */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-500" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-500" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-500" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-500" />
          </div>

          <div className="flex-1 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-sm font-semibold mb-3 border border-cyan-100">
              <ScanFace className="w-4 h-4" />
              <span>분석 완료</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">종합 관상 분석</h2>
            <p className="text-cyan-600 font-medium text-lg mb-4">"{report.summary}"</p>
            
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">종합 점수</span>
                <span className="text-4xl font-bold bg-gradient-to-br from-cyan-600 to-purple-600 bg-clip-text text-transparent">
                  {report.score}<span className="text-2xl text-gray-400 font-normal">/100</span>
                </span>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1.5">
                  분석 신뢰도
                  <div className="group relative">
                    <AlertCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      90프레임 이상의 얼굴 데이터를 평균화하여 도출한 데이터의 안정성 수치입니다. 조명과 각도에 따라 변동될 수 있습니다.
                    </div>
                  </div>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-700">
                    {report.confidenceScore || 85}<span className="text-sm text-gray-400 font-normal">%</span>
                  </span>
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${report.confidenceScore || 85}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className={`h-full bg-gradient-to-r ${
                        (report.confidenceScore || 85) > 90 ? 'from-emerald-500 to-teal-400' :
                        (report.confidenceScore || 85) > 70 ? 'from-cyan-500 to-blue-400' : 'from-amber-500 to-orange-400'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-2xl p-6 text-left border border-gray-100">
          <div className="flex items-start gap-4">
            <Sparkles className="w-6 h-6 text-yellow-500 shrink-0 mt-1" />
            <div>
              <h3 className="text-gray-900 font-semibold mb-2">AI 전문가의 조언</h3>
              <p className="text-gray-700 leading-relaxed">{report.advice}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Animal Morphology section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        <div className="relative z-10 space-y-8">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs font-bold mb-6 border border-cyan-500/30 uppercase tracking-widest">
              Animal Morphology Analysis
            </div>
            
            {/* Main Animal Image Card */}
            <div className="relative group mb-6">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl">
                <img 
                  src={`https://loremflickr.com/800/800/${report.animalMorphology.englishType?.toLowerCase().split(',')[0].trim() || 'animal'},portrait,face`} 
                  alt={report.animalMorphology.type}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                <div className="absolute bottom-0 left-0 w-full p-4">
                  <span className="text-cyan-400 font-serif italic text-lg md:text-xl drop-shadow-md">
                    Morphology: {report.animalMorphology.englishType}
                  </span>
                </div>
              </div>
            </div>

            <h3 className="text-3xl font-bold mb-4">
              {report.animalMorphology.type}
            </h3>

            {/* Visual Characteristics Description */}
            <div className="max-w-xl mx-auto px-6 py-4 bg-white/5 border border-white/10 rounded-2xl mb-8">
              <p className="text-cyan-100 text-sm md:text-base leading-relaxed italic">
                "{report.animalMorphology.visualCharacteristics}"
              </p>
            </div>
            
            {/* Morphology Blend Breakdown */}
            <div className="w-full max-w-xl mx-auto space-y-4 mb-10 bg-white/5 p-6 rounded-3xl border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-cyan-300 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Morphology Energy Blend
                </h4>
                <div className="text-[10px] text-gray-500 font-medium">TOP 3 MATCHES</div>
              </div>
              
              <div className="space-y-4">
                {report.animalMorphology.animalMorphologyBlend?.map((blend, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{blend.type}</span>
                        <span className="text-[10px] text-gray-400">· {blend.characteristic}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400">{blend.matchPercentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${blend.matchPercentage}%` }}
                        transition={{ duration: 1, delay: 0.2 + idx * 0.1 }}
                        className={`h-full bg-gradient-to-r ${
                          idx === 0 ? 'from-cyan-500 to-blue-500' : 
                          idx === 1 ? 'from-blue-500 to-indigo-500' : 'from-indigo-500 to-purple-500'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-4 leading-relaxed text-center">
                인간의 얼굴은 여러 동물의 정기가 복합적으로 작용합니다. <br />
                측정 당시의 미세 표정과 각도에 따라 상위권 요소들의 순위가 소폭 변동될 수 있습니다.
              </p>
            </div>

            {/* Geometric Basis Badge */}
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest">Classification Basis</span>
                <span className="w-1 h-1 rounded-full bg-cyan-400" />
                <span className="text-[11px] text-gray-300 font-medium">{report.animalMorphology.geometricBasis}</span>
              </div>
              
              <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-4 mt-2">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="text-left">
                    <h4 className="text-xs font-bold text-cyan-300 mb-1">분석 결과의 변동성에 관한 안내</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      AI 관상 분석은 478개의 3D 랜드마크와 미세한 안면 각도를 실시간으로 측정합니다. 
                      <span className="text-gray-300"> 조명 조건, 촬영 각도, 당시의 표정 및 감정 상태</span>에 따라 기하학적 수치가 미세하게 변동될 수 있으며, 
                      특히 수치가 분류 경계선상에 있을 경우 동물상이 다르게 나타날 수 있습니다. 
                      가장 일관된 결과를 위해 밝은 곳에서 정면을 응시하며 3회 이상 측정해 보시길 권장합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="max-w-2xl text-gray-400 text-sm leading-relaxed mb-8 italic text-center">
              "귀하의 골격과 기하학적 비율은 {report.animalMorphology.type}의 기질을 강하게 띠고 있습니다. 이는 단순한 외형적 유사성을 넘어 내면의 에너지 흐름과 운명적 궤적을 상징합니다."
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg mb-4">
                <Brain className="w-5 h-5" />
                물형 정밀 심층 분석 (Premium)
              </div>
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                {report.animalMorphology.detailedAnalysis}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-purple-400 font-bold text-lg border-b border-white/10 pb-2">
                  <ScanFace className="w-5 h-5" />
                  코드 및 기질 하이라이트
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.animalMorphology.traits.map((trait, idx) => (
                    <span key={idx} className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium transition-colors hover:bg-white/10 text-cyan-100">
                      #{trait}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg border-b border-white/10 pb-2">
                  <Briefcase className="w-5 h-5" />
                  경제 및 사회적 잠재력
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {report.wealthAndCareer}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Traditional Physiognomy Section */}
      <div className="bg-white shadow-xl border border-gray-100 rounded-3xl p-8 space-y-6">
        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          전통 관상학 및 부위별 정밀 진단
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard icon={<Brain className="w-5 h-5" />} title="안과(眼科): 눈 분석" content={report.traditionalAnalysis.eyes} delay={0.3} accentColor="blue" />
          <DetailCard icon={<ScanFace className="w-5 h-5" />} title="비과(鼻科): 코 분석" content={report.traditionalAnalysis.nose} delay={0.4} accentColor="amber" />
          <DetailCard icon={<Heart className="w-5 h-5" />} title="구과(口科): 입 분석" content={report.traditionalAnalysis.mouth} delay={0.5} accentColor="rose" />
          <DetailCard icon={<Sparkles className="w-5 h-5" />} title="기색(氣色): 피부 및 기운" content={report.traditionalAnalysis.skin} delay={0.6} accentColor="emerald" />
        </div>
      </div>

      {/* Life Strategy Section */}
      <div className="bg-gray-900 text-white shadow-2xl border border-white/5 rounded-3xl p-8 space-y-8">
        <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <Briefcase className="w-6 h-6" />
          운명 개척을 위한 인생 전략 로드맵
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-3">
             <h4 className="font-bold text-emerald-400 flex items-center gap-2">🚀 커리어 성공 전략</h4>
             <p className="text-gray-300 text-sm leading-relaxed">{report.lifeStrategy.career}</p>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-3">
             <h4 className="font-bold text-amber-400 flex items-center gap-2">💰 부의 축적 전략</h4>
             <p className="text-gray-300 text-sm leading-relaxed">{report.lifeStrategy.wealth}</p>
          </div>
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-3">
             <h4 className="font-bold text-rose-400 flex items-center gap-2">🤝 귀인을 부르는 처세술</h4>
             <p className="text-gray-300 text-sm leading-relaxed">{report.lifeStrategy.relationship}</p>
          </div>
        </div>
      </div>

      {/* Energy System section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          에너지 정밀 진단: 3-Body & 7-Code
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 3-Body Section */}
          <div className="lg:col-span-4 space-y-4">
             <div className="bg-gray-900 text-white rounded-3xl p-6 shadow-xl border border-white/5 h-full">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                    <Brain className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">3-Body 통합 에너지</h4>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Physical / Emotional / Mental</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed italic">
                  "{report.energy3Body7Code.threeBodyAnalysis}"
                </p>
                
                <div className="mt-8 space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-gray-400 flex items-center gap-2">
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                        Bright Energy Score
                      </span>
                      <span className="text-lg font-bold text-yellow-500">{report.brightEnergy.score}%</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-tight">{report.brightEnergy.description}</p>
                  </div>
                </div>
             </div>
          </div>

          {/* 7-Code Detailed Analysis Overlay */}
          <div className="lg:col-span-8">
            <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-xl relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Zap className="w-48 h-48" />
              </div>

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-600" />
                    7-Code 에너지 핵심 상태 분석
                  </h4>
                  <span className="text-[10px] text-gray-400 font-mono">ENERGY RESONANCE REPORT</span>
                </div>

                <div className="space-y-4">
                  {report.energy3Body7Code.sevenCodeDetailed.map((code, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="group bg-gray-50 rounded-2xl p-4 border border-gray-200/50 hover:border-cyan-200 transition-all hover:bg-cyan-50/30"
                    >
                      <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex items-center gap-4 w-48 shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ${
                            code.state === 'Positive' ? 'bg-emerald-500 shadow-emerald-200' :
                            code.state === 'Negative' ? 'bg-rose-500 shadow-rose-200' : 'bg-amber-500 shadow-amber-200'
                          }`}>
                            {code.score}%
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">Code {idx + 1}: {code.name}</div>
                            <div className="text-[10px] text-gray-500 font-medium uppercase">{code.region} · {code.bodyPart}</div>
                          </div>
                        </div>

                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              code.state === 'Positive' ? 'bg-emerald-100 text-emerald-700' :
                              code.state === 'Negative' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {code.state === 'Positive' ? '긍정 에너지' : code.state === 'Negative' ? '정체/부정' : '중립적 상태'}
                            </span>
                            <div className="w-1/2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${code.score}%` }}
                                transition={{ duration: 1, delay: 0.5 + idx * 0.1 }}
                                className={`h-full ${
                                  code.state === 'Positive' ? 'bg-emerald-500' :
                                  code.state === 'Negative' ? 'bg-rose-500' : 'bg-amber-500'
                                }`}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-relaxed">
                            <span className="font-bold text-gray-900">현대적 해석:</span> {code.interpretation}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legacy Details Grid (Updated) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard 
          icon={<Brain className="w-5 h-5" />}
          title="성향 및 기질"
          content={report.personality}
          delay={0.5}
          accentColor="purple"
        />
        <DetailCard 
          icon={<Briefcase className="w-5 h-5" />}
          title="재물 및 직업운"
          content={report.wealthAndCareer}
          delay={0.6}
          accentColor="emerald"
        />
        <DetailCard 
          icon={<Heart className="w-5 h-5" />}
          title="삼정(초/중/말년) 흐름"
          content={report.samjeongAnalysis}
          delay={0.7}
          accentColor="rose"
          className="md:col-span-2"
        />
      </div>

      <div className="flex flex-wrap justify-center gap-4 pt-6 print:hidden">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-6 py-3 bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] font-bold rounded-full transition-all shadow-sm active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span>카톡으로 결과 공유</span>
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-full transition-colors border border-gray-200 shadow-sm"
        >
          <Printer className="w-4 h-4" />
          <span>인쇄하기</span>
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-full transition-colors shadow-md"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>다시 분석하기</span>
        </button>
      </div>
    </motion.div>
  );
}

interface DetailCardProps {
  icon: React.ReactNode;
  title: string;
  content: string;
  delay: number;
  className?: string;
  dark?: boolean;
  accentColor?: string; // e.g., 'blue', 'emerald', 'purple', 'rose', 'cyan', 'amber'
}

function DetailCard({ icon, title, content, delay, className = '', dark = false, accentColor = 'gray' }: DetailCardProps) {
  const colorMap: Record<string, { bg: string, border: string, text: string, darkBg: string, darkBorder: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-600', darkBg: 'bg-blue-500/10', darkBorder: 'border-blue-500/30' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', darkBg: 'bg-emerald-500/10', darkBorder: 'border-emerald-500/30' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-600', darkBg: 'bg-purple-500/10', darkBorder: 'border-purple-500/30' },
    rose: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-600', darkBg: 'bg-rose-500/10', darkBorder: 'border-rose-500/30' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-100', text: 'text-cyan-600', darkBg: 'bg-cyan-500/10', darkBorder: 'border-cyan-500/30' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', darkBg: 'bg-amber-500/10', darkBorder: 'border-amber-500/30' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-100', text: 'text-gray-600', darkBg: 'bg-white/5', darkBorder: 'border-white/10' },
  };

  const colors = colorMap[accentColor] || colorMap.gray;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`shadow-lg border rounded-2xl p-6 transition-all hover:shadow-xl ${dark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'} ${className}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2.5 rounded-xl border transition-colors ${dark ? colors.darkBg + ' ' + colors.darkBorder : colors.bg + ' ' + colors.border}`}>
          <div className={dark ? 'text-white' : colors.text}>
            {icon}
          </div>
        </div>
        <h3 className={`font-bold tracking-tight ${dark ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      </div>
      <p className={`leading-relaxed text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{content}</p>
    </motion.div>
  );
}
