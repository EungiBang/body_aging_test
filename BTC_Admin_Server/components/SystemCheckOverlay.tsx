import React, { useState, useEffect } from 'react';
import CameraModule from './CameraModule';

interface SystemCheckOverlayProps {
  onComplete: () => void;
}

export const SystemCheckOverlay: React.FC<SystemCheckOverlayProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'pc' | 'camera' | 'done'>('pc');
  const [pcStatus, setPcStatus] = useState<'최상' | '보통' | '구동 어려움'>('보통');
  const [cpuCores, setCpuCores] = useState<number>(0);
  const [ramSize, setRamSize] = useState<number>(0);
  const [isCheckingPc, setIsCheckingPc] = useState(true);

  useEffect(() => {
    if (phase === 'pc') {
      const cores = navigator.hardwareConcurrency || 4;
      // @ts-ignore - deviceMemory is not standard in all target environments (like iOS), but widely supported in Chromium
      const ram = (navigator as any).deviceMemory || 4;
      
      setCpuCores(cores);
      setRamSize(ram);

      setTimeout(() => {
        if (cores >= 8 && ram >= 8) {
          setPcStatus('최상');
        } else if (cores >= 4 && ram >= 4) {
          setPcStatus('보통');
        } else {
          setPcStatus('구동 어려움');
        }
        setIsCheckingPc(false);
      }, 1500); // 심미적인 점검 시간 (진단 이펙트)
    }
  }, [phase]);

  const handleCameraCapture = (dataUrl: string) => {
    // 사진이 정상적으로 촬영되면 카메라와 조명 테스트 통과!
    setPhase('done');
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6">
      {phase === 'pc' && (
        <div className="bg-slate-800 p-10 rounded-[2.5rem] border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-md w-full text-center animate-fade-in">
          <div className="w-24 h-24 mx-auto bg-indigo-900/30 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
            <i className={`fas fa-microchip text-4xl ${isCheckingPc ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}`}></i>
          </div>
          <h3 className="text-2xl font-black text-white mb-8 tracking-tight">PC 사양 점검</h3>
          
          <div className="space-y-4 text-left mb-10">
            <div className="flex justify-between items-center bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
              <span className="text-slate-400 font-medium">CPU 코어 수</span>
              <span className="text-white font-bold">{isCheckingPc ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : `${cpuCores} Core`}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/50 p-5 rounded-2xl border border-slate-700/50">
              <span className="text-slate-400 font-medium">메모리 (RAM)</span>
              <span className="text-white font-bold">{isCheckingPc ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : `${ramSize} GB 이상`}</span>
            </div>
            
            {!isCheckingPc && (
              <div className={`p-5 rounded-2xl border-2 font-black text-center text-lg mt-6 shadow-inner ${
                pcStatus === '최상' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' :
                pcStatus === '보통' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' :
                'bg-rose-500/10 border-rose-500/50 text-rose-400'
              }`}>
                시스템 스코어: {pcStatus}
              </div>
            )}
          </div>

          <button 
            onClick={() => setPhase('camera')}
            disabled={isCheckingPc}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_-5px_rgba(99,102,241,0.4)]"
          >
            다음 단계 (카메라 및 조명 체크) <i className="fas fa-arrow-right ml-2 text-xs"></i>
          </button>
        </div>
      )}

      {phase === 'camera' && (
        <div className="w-full max-w-3xl bg-slate-800 p-8 rounded-[2.5rem] border border-slate-700 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center animate-fade-in relative overflow-hidden">
          <div className="text-center mb-6 z-10">
            <span className="text-indigo-400 font-bold text-xs tracking-widest mb-2 block">환경 체크 2단계</span>
            <h3 className="text-3xl font-black text-white tracking-tight">전신 카메라 점검</h3>
            <p className="text-slate-400 mt-3 text-sm leading-relaxed max-w-lg mx-auto">
              화면에 <span className="text-emerald-400 font-bold">머리부터 발끝까지 전신</span>이 들어오는지 확인합니다.<br/>
              혼자 계실 경우 중앙의 <span className="font-bold text-white bg-slate-700 px-2 py-1 rounded">5초 후 자동 촬영 버튼</span>을 눌러<br/>
              시간 내에 전신이 나오는 위치로 이동하여 테스트를 마쳐주세요.
            </p>
          </div>
          
          <div className="w-full flex justify-center z-10" style={{ transform: 'scale(0.85)', transformOrigin: 'top center', marginBottom: '-10%' }}>
             <CameraModule 
               onCapture={handleCameraCapture} 
               guidelineType={"intro" as any} 
               autoCapture={true} 
             />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="bg-slate-800 p-12 rounded-[2.5rem] border border-emerald-500/40 shadow-[0_20px_50px_rgba(16,185,129,0.2)] max-w-md w-full text-center animate-fade-in relative overflow-hidden">
          <div className="absolute inset-0 bg-emerald-500/5 animate-pulse"></div>
          <div className="w-28 h-28 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(16,185,129,0.3)] border-4 border-emerald-500/30">
            <i className="fas fa-check text-6xl text-emerald-400"></i>
          </div>
          <h3 className="text-3xl font-black text-white mb-3">점검 완료!</h3>
          <p className="text-emerald-400 font-medium">모든 진단 환경이 준비되었습니다.<br/>메인 시스템으로 이동합니다.</p>
        </div>
      )}
    </div>
  );
};
