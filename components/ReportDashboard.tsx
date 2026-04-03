
import React from 'react';
import { BodyReport, CapturedImage } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { speak } from '../services/ttsService';

interface ReportDashboardProps {
  report: BodyReport;
  images: CapturedImage[];
  onRestart: () => void;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ report, images, onRestart }) => {
  const radarData = report.postureMetrics.map(m => ({
    subject: m.name,
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
  
  const handleReadReport = () => {
    const text = `
      ${report.userInfo.name}님의 진단 결과입니다. 
      생물학적 나이는 ${report.userInfo.age}세이며, 측정된 신체 나이는 ${report.physicalAge}세, 얼굴 나이는 ${report.faceAgeEstimate}세입니다. 
      종합 건강 점수는 ${report.overallScore}점입니다. 
      종합 평가: ${report.summary}
      뇌 건강 함의: ${report.brainHealthImplication}
    `;
    speak(text);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${report.userInfo.name}님의 뇌-신체 건강 리포트`,
          text: `생물학적 나이 ${report.userInfo.age}세 | 신체 나이 ${report.physicalAge}세 | 얼굴 나이 ${report.faceAgeEstimate}세 | 종합 점수 ${report.overallScore}점`,
          url: window.location.href
        });
      } catch (err) {
        console.error("Error sharing", err);
      }
    } else {
      alert("브라우저가 공유 기능을 지원하지 않습니다.");
    }
  };

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
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-black px-2 py-1 rounded-lg shadow-md">
            {img.reps}회
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-2 text-[10px] text-white font-medium text-center">
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
          <h1 className="text-2xl font-black uppercase">Neuro-Physical Report</h1>
          <p className="text-sm text-slate-500">브레인 트레이닝 센터 | {new Date(report.date).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{report.userInfo.name} ({report.userInfo.gender === 'male' ? '남성' : '여성'})</p>
          <p className="text-sm">만 {report.userInfo.age}세</p>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">생물학적 나이</span>
            <div className="text-5xl font-black text-slate-800 mb-1">{report.userInfo.age}세</div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">신체 나이</span>
            <div className="text-5xl font-black text-indigo-600 mb-1">{report.physicalAge}세</div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">얼굴 나이</span>
            <div className="text-5xl font-black text-rose-500 mb-1">{report.faceAgeEstimate}세</div>
        </div>
        <div className="bg-indigo-600 p-6 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-indigo-200">
            <span className="text-indigo-200 text-xs font-bold uppercase mb-1">종합 건강 점수</span>
            <div className="text-5xl font-black mb-1">{report.overallScore}점</div>
        </div>
      </div>

      {/* Captured Evidence Section */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="fas fa-camera text-indigo-500"></i>
          측정 데이터 증빙 (Capture Evidence)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, i) => renderImageWithOverlay(img, i))}
        </div>
      </section>

      {/* Posture & Balance Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white p-8 rounded-3xl border border-slate-200">
          <h3 className="text-xl font-bold text-slate-800 mb-6">신체 정렬 및 균형 분석</h3>
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
            {report.postureMetrics.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex-1">
                  <h5 className="font-bold text-slate-800 text-sm">{item.name}</h5>
                  <p className="text-[10px] text-slate-500 leading-tight">{item.description}</p>
                </div>
                <span className={`ml-2 px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(item.status)}`}>
                  {item.score}
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
                    {report.strengthMetrics.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-bold text-indigo-900 text-sm">{item.exercise}</h5>
                                <div className="text-right">
                                  <span className="text-xs font-black text-indigo-600 block">자세 점수: {item.formScore}점</span>
                                  {item.reps > 0 && <span className="text-[10px] font-bold text-indigo-400 block">수행 횟수: {item.reps}회</span>}
                                </div>
                            </div>
                            <p className="text-xs text-indigo-700 mb-2">{item.performance}</p>
                            <p className="text-[10px] text-indigo-500 bg-indigo-100/50 p-2 rounded-lg">💡 {item.recommendation}</p>
                        </div>
                    ))}
                    {report.agingMetrics.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-bold text-rose-900 text-sm">{item.testName}</h5>
                                <span className="text-xs font-black text-rose-600">{item.score}점</span>
                            </div>
                            <p className="text-xs text-rose-700">{item.result}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Face Analysis Detail */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
                  <i className="fas fa-smile-beam text-rose-500"></i>
                  입체 안면 노화 분석
                </h3>
                <div className="space-y-4 relative z-10">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                      <i className="fas fa-water text-rose-500 text-xs"></i>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">피부 탄력도</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">{report.faceAnalysis.elasticity}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                      <i className="fas fa-wave-square text-rose-500 text-xs"></i>
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">주름 및 굴곡</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">{report.faceAnalysis.wrinkles}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h5 className="text-xs font-bold text-slate-400 uppercase mb-1">안면 종합 평가</h5>
                    <p className="text-sm text-slate-700 font-medium">{report.faceAnalysis.summary}</p>
                  </div>
                  {report.faceAnalysis.recommendation && (
                    <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                      <h5 className="text-xs font-bold text-rose-400 uppercase mb-1">맞춤형 개선 솔루션</h5>
                      <p className="text-sm text-rose-700 font-medium">{report.faceAnalysis.recommendation}</p>
                    </div>
                  )}
                </div>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-4">뇌 건강 함의 (Brain Health)</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{report.brainHealthImplication}</p>
            </div>
        </div>
      </div>

      {/* Brain Training Links Section */}
      <section className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white">
        <h3 className="text-3xl font-black mb-10 text-center">맞춤형 브레인 트레이닝 추천</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
                <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20">
                    <i className="fas fa-om"></i>
                </div>
                <h4 className="text-xl font-bold">맞춤 명상 (Meditation)</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{report.recommendations.meditation}</p>
                <button className="text-indigo-400 text-xs font-bold flex items-center gap-2 hover:text-indigo-300 transition-colors">
                    명상 가이드 보기 <i className="fas fa-external-link-alt"></i>
                </button>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
                    <i className="fas fa-walking"></i>
                </div>
                <h4 className="text-xl font-bold">교정 체조 (Gymnastics)</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{report.recommendations.gymnastics}</p>
                <button className="text-emerald-400 text-xs font-bold flex items-center gap-2 hover:text-emerald-300 transition-colors">
                    추천 운동법 보기 <i className="fas fa-external-link-alt"></i>
                </button>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20">
                    <i className="fas fa-puzzle-piece"></i>
                </div>
                <h4 className="text-xl font-bold">뇌 기능 훈련 (Brain Training)</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{report.recommendations.brainTraining}</p>
                <button className="text-amber-400 text-xs font-bold flex items-center gap-2 hover:text-amber-300 transition-colors">
                    트레이닝 시작하기 <i className="fas fa-external-link-alt"></i>
                </button>
            </div>
        </div>
      </section>

      {/* Overall Summary */}
      <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 text-center max-w-4xl mx-auto">
          <h4 className="text-2xl font-black text-slate-800 mb-4">종합 평가 리포트</h4>
          <p className="text-slate-600 leading-relaxed mb-6 italic">"{report.summary}"</p>
          <div className="flex flex-wrap justify-center gap-4 print:hidden">
              <button onClick={handleReadReport} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg">
                  <i className="fas fa-volume-up"></i> 결과 듣기
              </button>
              <button onClick={handlePrint} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg">
                  <i className="fas fa-print"></i> 인쇄하기
              </button>
              <button onClick={handleShare} className="px-8 py-3 bg-white text-slate-900 border border-slate-300 font-bold rounded-2xl flex items-center gap-2 shadow-sm">
                  <i className="fas fa-share-alt"></i> 공유하기
              </button>
              <button onClick={onRestart} className="px-8 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all">
                  메인으로 이동
              </button>
          </div>
      </div>
    </div>
  );
};

export default ReportDashboard;
