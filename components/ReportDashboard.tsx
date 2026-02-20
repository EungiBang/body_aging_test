
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
      case 'Good': return { color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
      case 'Fair': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      case 'Poor': return { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' };
      default: return { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)' };
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

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div className="flex-1 p-6 md:p-10 space-y-12 overflow-auto pb-24 print:p-0 print:overflow-visible animate-fadeIn">
      {/* Print Header */}
      <div className="hidden print:flex justify-between items-center border-b pb-4 mb-8">
        <div>
          <h1 className="text-2xl font-black uppercase">3Body 7Code Report</h1>
          <p className="text-sm text-slate-500">Brain Education 5-Step | {new Date(report.date).toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{report.userInfo.name} ({report.userInfo.gender === 'male' ? '남성' : '여성'})</p>
          <p className="text-sm">만 {report.userInfo.age}세</p>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="p-6 rounded-3xl flex flex-col items-center justify-center text-center" style={cardStyle}>
            <span className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>신체 추정 나이</span>
            <div className="text-5xl font-black mb-1 gradient-text">{report.physicalAge}세</div>
        </div>
        <div className="p-6 rounded-3xl flex flex-col items-center justify-center text-center" style={cardStyle}>
            <span className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>안면 노화 나이</span>
            <div className="text-5xl font-black mb-1" style={{ color: 'var(--accent-rose)' }}>{report.faceAgeEstimate}세</div>
        </div>
        <div className="p-6 rounded-3xl flex flex-col items-center justify-center text-center" style={cardStyle}>
            <span className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>종합 건강 점수</span>
            <div className="text-5xl font-black mb-1" style={{ color: 'var(--text-primary)' }}>{report.overallScore}</div>
        </div>
        <div className="p-6 rounded-3xl flex flex-col items-center justify-center text-center text-white"
             style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--glow-indigo)' }}>
            <span className="text-[10px] font-bold uppercase mb-1 opacity-70">진단 등급</span>
            <div className="text-2xl font-bold">Standard</div>
            <p className="text-[10px] opacity-60">BrainSync 등급</p>
        </div>
      </div>

      {/* Captured Evidence */}
      <section>
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fas fa-camera" style={{ color: 'var(--accent-indigo)' }}></i>
          측정 데이터 증빙
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, i) => (
            <div key={i} className="group relative rounded-2xl overflow-hidden aspect-square" style={{ ...cardStyle, background: 'var(--bg-secondary)' }}>
              <img src={img.dataUrl} className="w-full h-full object-cover" alt={img.step} />
              <div className="absolute bottom-0 inset-x-0 p-2 text-[10px] text-white font-medium text-center"
                   style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                {img.step.replace('POSTURE_', '자세:').replace('STRENGTH_', '근력:').replace('_TEST', '').replace('_ANALYSIS', '')}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Posture & Balance Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="p-8 rounded-3xl" style={cardStyle}>
          <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>신체 정렬 및 균형 분석</h3>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#a0a0c0' }} />
                <Radar name="자세" dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {report.postureMetrics.map((item, i) => {
              const statusColor = getStatusColor(item.status);
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex-1">
                    <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.name}</h5>
                    <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{item.description}</p>
                  </div>
                  <span className="ml-2 px-2 py-1 rounded text-[10px] font-bold"
                        style={{ color: statusColor.color, background: statusColor.bg }}>
                    {item.score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strength & Aging */}
        <div className="space-y-6">
            <div className="p-8 rounded-3xl" style={cardStyle}>
                <h3 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>기능적 수행 능력 상세</h3>
                <div className="grid grid-cols-1 gap-4">
                    {report.strengthMetrics.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl" style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.exercise}</h5>
                                <span className="text-xs font-black" style={{ color: 'var(--accent-indigo)' }}>자세 점수: {item.formScore}</span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.performance}</p>
                        </div>
                    ))}
                    {report.agingMetrics.map((item, i) => (
                        <div key={i} className="p-4 rounded-2xl" style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                            <div className="flex justify-between items-center mb-1">
                                <h5 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.testName}</h5>
                                <span className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>{item.score}점</span>
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.result}</p>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="p-8 rounded-3xl" style={cardStyle}>
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>뇌 건강 함의</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{report.brainHealthImplication}</p>
            </div>
        </div>
      </div>

      {/* Brain Training Recommendations */}
      <section className="rounded-[40px] p-8 md:p-12 text-white" style={{ background: 'linear-gradient(135deg, var(--bg-card), rgba(99,102,241,0.15))', border: '1px solid rgba(99,102,241,0.2)' }}>
        <h3 className="text-3xl font-black mb-10 text-center gradient-text">맞춤형 브레인 트레이닝 추천</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg text-white"
                     style={{ background: 'var(--accent-indigo)', boxShadow: 'var(--glow-indigo)' }}>
                    <i className="fas fa-om"></i>
                </div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>맞춤 명상</h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.recommendations.meditation}</p>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg text-white"
                     style={{ background: 'var(--accent-emerald)', boxShadow: 'var(--glow-cyan)' }}>
                    <i className="fas fa-walking"></i>
                </div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>교정 체조</h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.recommendations.gymnastics}</p>
            </div>
            <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-lg text-white"
                     style={{ background: 'var(--accent-amber)', boxShadow: '0 0 30px rgba(245, 158, 11, 0.3)' }}>
                    <i className="fas fa-puzzle-piece"></i>
                </div>
                <h4 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>뇌 기능 훈련</h4>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{report.recommendations.brainTraining}</p>
            </div>
        </div>
      </section>

      {/* Overall Summary */}
      <div className="p-10 rounded-[40px] text-center max-w-4xl mx-auto" style={{ ...cardStyle, borderWidth: '2px' }}>
          <h4 className="text-2xl font-black mb-4 gradient-text">종합 평가 리포트</h4>
          <p className="leading-relaxed mb-6 italic" style={{ color: 'var(--text-secondary)' }}>"{report.summary}"</p>
          <div className="flex flex-wrap justify-center gap-4 print:hidden">
              <button onClick={handlePrint} className="px-8 py-3 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg"
                      style={{ background: 'var(--gradient-primary)' }}>
                  <i className="fas fa-print"></i> 인쇄하기
              </button>
              <button onClick={handleShare} className="px-8 py-3 font-bold rounded-2xl flex items-center gap-2 glass"
                      style={{ color: 'var(--text-primary)' }}>
                  <i className="fas fa-share-alt"></i> 공유하기
              </button>
              <button onClick={onRestart} className="px-8 py-3 font-bold rounded-2xl transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                  메인으로 이동
              </button>
          </div>
      </div>
    </div>
  );
};

export default ReportDashboard;
