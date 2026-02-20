
import React from 'react';
import { BodyReport, CapturedImage } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

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
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${report.userInfo.name}님의 뇌-신체 건강 리포트`,
          text: `신체 나이 ${report.physicalAge}세, 종합 점수 ${report.overallScore}점입니다.`,
          url: window.location.href
        });
      } catch (err) {
        console.error("Error sharing", err);
      }
    } else {
      alert("브라우저가 공유 기능을 지원하지 않습니다.");
    }
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
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">신체 추정 나이</span>
            <div className="text-5xl font-black text-indigo-600 mb-1">{report.physicalAge}세</div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">안면 노화 나이</span>
            <div className="text-5xl font-black text-rose-500 mb-1">{report.faceAgeEstimate}세</div>
        </div>
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
            <span className="text-slate-400 text-xs font-bold uppercase mb-1">종합 건강 점수</span>
            <div className="text-5xl font-black text-slate-800 mb-1">{report.overallScore}</div>
        </div>
        <div className="bg-indigo-600 p-6 rounded-3xl flex flex-col items-center justify-center text-center text-white">
            <span className="text-indigo-200 text-[10px] font-bold uppercase mb-1">진단 등급</span>
            <div className="text-2xl font-bold">Standard</div>
            <p className="text-[10px] text-indigo-300">BrainSync 등급</p>
        </div>
      </div>

      {/* Captured Evidence Section */}
      <section>
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="fas fa-camera text-indigo-500"></i>
          측정 데이터 증빙 (Capture Evidence)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 aspect-square">
              <img src={img.dataUrl} className="w-full h-full object-cover" alt={img.step} />
              <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-2 text-[10px] text-white font-medium text-center">
                {img.step.replace('POSTURE_', '자세:').replace('STRENGTH_', '근력:').replace('_TEST', '').replace('_ANALYSIS', '')}
              </div>
            </div>
          ))}
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
                                <span className="text-xs font-black text-indigo-600">자세 점수: {item.formScore}</span>
                            </div>
                            <p className="text-xs text-indigo-700">{item.performance}</p>
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
