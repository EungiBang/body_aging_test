
import React, { useRef, useEffect, useState } from 'react';
import { playStartSound, playEndSound, playTickSound, playCaptureSound } from '../hooks/useSoundEffects';

interface CameraModuleProps {
  onCapture: (dataUrl: string) => void;
  guidelineType: 'front' | 'side' | 'squat' | 'pushup' | 'balance' | 'flexibility' | 'face';
  autoCapture?: boolean;
  timerDuration?: number;
  voiceCommand?: string | null;
}

// ─── Guideline Overlay Components ───────────────────────────────

/** Corner bracket marker */
const Corner = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const size = 30;
  const styles: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    ...(position.includes('t') ? { top: 0 } : { bottom: 0 }),
    ...(position.includes('l') ? { left: 0 } : { right: 0 }),
    borderColor: '#6366f1',
    borderStyle: 'solid',
    borderWidth: 0,
    ...(position.includes('t') ? { borderTopWidth: 3 } : { borderBottomWidth: 3 }),
    ...(position.includes('l') ? { borderLeftWidth: 3 } : { borderRightWidth: 3 }),
    filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.8))',
  };
  return <div style={styles} />;
};

/** Labeled horizontal zone line */
const ZoneLine = ({ top, label, side = 'left' }: { top: string; label: string; side?: 'left' | 'right' }) => (
  <div className="absolute w-full flex items-center" style={{ top }}>
    <div className="flex-1 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.6) 30%, rgba(99,102,241,0.6) 70%, transparent 95%)' }} />
    <span className={`absolute ${side === 'left' ? 'left-2' : 'right-2'} px-2 py-[2px] rounded-md text-[9px] font-black tracking-wider uppercase`}
          style={{ background: 'rgba(99,102,241,0.85)', color: '#fff', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  </div>
);

/** Position feedback banner */
const PositionHint = ({ messages, type = 'info' }: { messages: string[]; type?: 'info' | 'warning' }) => {
  if (messages.length === 0) return null;
  return (
    <div className="absolute left-4 right-4 bottom-36 z-20 flex flex-col gap-1">
      {messages.map((msg, i) => (
        <div key={i}
             className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold animate-pulse"
             style={{
               background: type === 'warning' ? 'rgba(245,158,11,0.9)' : 'rgba(99,102,241,0.85)',
               color: '#fff',
               backdropFilter: 'blur(8px)',
               boxShadow: type === 'warning' ? '0 0 20px rgba(245,158,11,0.4)' : '0 0 15px rgba(99,102,241,0.3)',
             }}>
          <i className={`fas ${type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`} />
          {msg}
        </div>
      ))}
    </div>
  );
};

// ─── Front Guideline ──────────────────────────────────────────

const FrontGuideline = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Full body frame with corners */}
    <div className="absolute left-[15%] right-[15%] top-[3%] bottom-[3%]">
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />
      {/* Center vertical line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2"
           style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.8) 0%, rgba(99,102,241,0.3) 50%, rgba(99,102,241,0.8) 100%)', filter: 'drop-shadow(0 0 4px rgba(99,102,241,0.6))' }} />
    </div>
    {/* Body zone lines with labels */}
    <div className="absolute left-[15%] right-[15%] top-[3%] bottom-[3%]">
      <ZoneLine top="12%" label="머리 HEAD" />
      <ZoneLine top="28%" label="어깨 SHOULDER" side="right" />
      <ZoneLine top="50%" label="허리·골반 WAIST" />
      <ZoneLine top="72%" label="무릎 KNEE" side="right" />
      <ZoneLine top="90%" label="발 FEET" />
    </div>
    {/* Shoulder symmetry arrows */}
    <div className="absolute top-[26%] left-[18%] right-[18%] flex justify-between items-center">
      <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'rgba(99,102,241,0.9)' }}>
        <i className="fas fa-arrows-alt-h" /> 좌
      </div>
      <div className="text-[10px] font-bold flex items-center gap-1" style={{ color: 'rgba(99,102,241,0.9)' }}>
        우 <i className="fas fa-arrows-alt-h" />
      </div>
    </div>
    {/* Silhouette hint */}
    <div className="absolute left-1/2 top-[5%] -translate-x-1/2 w-[30%] h-[88%] rounded-[40%] opacity-[0.06]"
         style={{ border: '2px solid #6366f1', background: 'radial-gradient(ellipse, rgba(99,102,241,0.05), transparent 70%)' }} />

    {/* Position tips (always shown) */}
    <div className="absolute top-[7%] left-1/2 -translate-x-1/2 text-center">
      <span className="px-3 py-1 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#a5b4fc', backdropFilter: 'blur(4px)' }}>
        <i className="fas fa-crosshairs mr-1" />중앙선에 몸을 정렬하세요
      </span>
    </div>
  </div>
);

// ─── Side Guideline ───────────────────────────────────────────

const SideGuideline = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Frame with corners */}
    <div className="absolute left-[20%] right-[20%] top-[3%] bottom-[3%]">
      <Corner position="tl" />
      <Corner position="tr" />
      <Corner position="bl" />
      <Corner position="br" />
    </div>
    {/* Vertical plumb line */}
    <div className="absolute left-1/2 top-[2%] bottom-[2%] w-[3px] -translate-x-1/2"
         style={{
           background: 'linear-gradient(180deg, rgba(99,102,241,0.9) 0%, rgba(6,182,212,0.8) 100%)',
           filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.7))',
           animation: 'pulse-glow 2s ease-in-out infinite',
         }} />
    {/* Reference points on plumb line */}
    {['8%', '25%', '48%', '70%', '90%'].map((top, i) => (
      <div key={i} className="absolute left-1/2 -translate-x-1/2" style={{ top }}>
        <div className="w-3 h-3 rounded-full border-2"
             style={{ borderColor: '#6366f1', background: 'rgba(99,102,241,0.3)', filter: 'drop-shadow(0 0 4px rgba(99,102,241,0.6))' }} />
      </div>
    ))}
    {/* Labels */}
    <div className="absolute left-[22%] top-[8%]">
      <span className="px-2 py-[2px] rounded text-[9px] font-black" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff' }}>이(귀)</span>
    </div>
    <div className="absolute right-[22%] top-[25%]">
      <span className="px-2 py-[2px] rounded text-[9px] font-black" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff' }}>어깨</span>
    </div>
    <div className="absolute left-[22%] top-[48%]">
      <span className="px-2 py-[2px] rounded text-[9px] font-black" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff' }}>고관절</span>
    </div>
    <div className="absolute right-[22%] top-[70%]">
      <span className="px-2 py-[2px] rounded text-[9px] font-black" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff' }}>무릎</span>
    </div>
    <div className="absolute left-[22%] top-[90%]">
      <span className="px-2 py-[2px] rounded text-[9px] font-black" style={{ background: 'rgba(99,102,241,0.85)', color: '#fff' }}>발목</span>
    </div>
    {/* Alignment tip */}
    <div className="absolute top-[7%] left-1/2 -translate-x-1/2 text-center">
      <span className="px-3 py-1 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#a5b4fc', backdropFilter: 'blur(4px)' }}>
        <i className="fas fa-ruler-vertical mr-1" />수직선에 귀-어깨-골반-무릎-발목 정렬
      </span>
    </div>
  </div>
);

// ─── Face Guideline ───────────────────────────────────────────

const FaceGuideline = () => (
  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
    {/* Outer oval */}
    <div className="w-[60%] h-[42%] rounded-[50%]"
         style={{
           border: '3px solid rgba(168,85,247,0.7)',
           boxShadow: '0 0 40px rgba(168,85,247,0.3), inset 0 0 40px rgba(168,85,247,0.05)',
           animation: 'pulse-glow 2.5s ease-in-out infinite',
         }}>
      {/* Eyes reference line */}
      <div className="absolute top-[40%] left-[25%] right-[25%] h-[1px]"
           style={{ background: 'rgba(168,85,247,0.4)' }}>
        <span className="absolute -top-3 left-0 text-[8px] font-bold" style={{ color: 'rgba(168,85,247,0.8)' }}>눈 위치</span>
      </div>
    </div>
    {/* Crosshair center */}
    <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <div className="w-6 h-6 rounded-full border" style={{ borderColor: 'rgba(168,85,247,0.5)' }}>
        <div className="w-1 h-1 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ background: 'rgba(168,85,247,0.8)' }} />
      </div>
    </div>
    {/* Instruction */}
    <div className="absolute" style={{ top: '25%', left: '50%', transform: 'translateX(-50%)' }}>
      <span className="px-3 py-1 rounded-full text-[9px] font-bold"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#c4b5fd', backdropFilter: 'blur(4px)' }}>
        <i className="fas fa-crosshairs mr-1" />얼굴을 타원 안에 맞추세요
      </span>
    </div>
  </div>
);

// ─── Action Step Guideline (balance, flexibility, squat, pushup) ─

const ActionGuideline = ({ type }: { type: string }) => {
  const configs: Record<string, { label: string; icon: string; tips: string[] }> = {
    balance: {
      label: '밸런스 테스트',
      icon: 'fa-shoe-prints',
      tips: ['전신이 화면에 보이게 서세요', '한 발로 선 자세가 화면에 나와야 합니다'],
    },
    flexibility: {
      label: '유연성 테스트',
      icon: 'fa-child',
      tips: ['전신이 화면에 보이게 서세요', '동작의 전체 범위가 보여야 합니다'],
    },
    squat: {
      label: '스쿼트 테스트',
      icon: 'fa-dumbbell',
      tips: ['전신이 화면에 보이게 서세요', '스쿼트 동작이 명확히 보여야 합니다'],
    },
    pushup: {
      label: '푸시업 테스트',
      icon: 'fa-dumbbell',
      tips: ['전신이 화면에 보이게 서세요', '푸시업 동작이 명확히 보여야 합니다'],
    },
  };

  const config = configs[type] || configs.balance;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Full body frame */}
      <div className="absolute left-[5%] right-[5%] top-[3%] bottom-[3%]">
        <Corner position="tl" />
        <Corner position="tr" />
        <Corner position="bl" />
        <Corner position="br" />
        {/* Dashed border */}
        <div className="absolute inset-[2px] rounded-[1.5rem]"
             style={{ border: '2px dashed rgba(16,185,129,0.4)', boxShadow: '0 0 15px rgba(16,185,129,0.1)' }} />
      </div>
      {/* Center crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-0 h-12 border-l border-dashed" style={{ borderColor: 'rgba(16,185,129,0.5)' }} />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-12 h-0 border-t border-dashed" style={{ borderColor: 'rgba(16,185,129,0.5)' }} />
      </div>
      {/* Label badge */}
      <div className="absolute top-[6%] left-1/2 -translate-x-1/2">
        <span className="px-3 py-1 rounded-full text-[9px] font-bold flex items-center gap-1"
              style={{ background: 'rgba(16,185,129,0.85)', color: '#fff' }}>
          <i className={`fas ${config.icon}`} /> {config.label}
        </span>
      </div>
      {/* Tips */}
      <div className="absolute bottom-[22%] left-4 right-4 flex flex-col gap-1">
        {config.tips.map((tip, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold"
               style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(16,185,129,0.9)', backdropFilter: 'blur(4px)' }}>
            <i className="fas fa-check-circle text-[8px]" /> {tip}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main CameraModule ──────────────────────────────────────

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, guidelineType, autoCapture, timerDuration, voiceCommand }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [testTimer, setTestTimer] = useState<number | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    guidelineType === 'face' ? 'user' : 'environment'
  );

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number, max: number, step: number } | null>(null);

  // Position feedback messages
  const getPositionHints = (): string[] => {
    const hints: string[] = [];
    switch (guidelineType) {
      case 'front':
        hints.push('머리부터 발끝까지 전체가 프레임 안에 보여야 합니다');
        hints.push('좌우 대칭이 되도록 중앙에 서 주세요');
        break;
      case 'side':
        hints.push('수직 기준선에 귀·어깨·골반·발목을 정렬하세요');
        hints.push('카메라에 정확히 옆모습만 보여 주세요');
        break;
      case 'face':
        hints.push('보라색 타원 안에 얼굴 전체가 들어오게 하세요');
        break;
    }
    return hints;
  };

  const getGuideMessage = () => {
    switch (guidelineType) {
      case 'front': return '프레임 안에 정면 전신이 보이도록 서 주세요';
      case 'side': return '수직선에 귀-어깨-골반-발목을 맞추고 옆으로 서 주세요';
      case 'balance': return '전신이 보이는 위치에서 한 발로 서세요';
      case 'flexibility': return '전신이 보이게 서서 동작 후 "촬영"이라고 말하세요';
      case 'squat': return '전신이 보이는 위치에서 테스트를 시작하세요';
      case 'pushup': return '전신이 보이는 위치에서 테스트를 시작하세요';
      case 'face': return '타원 안에 얼굴을 맞추고 "촬영"이라고 말하세요';
      default: return '';
    }
  };

  useEffect(() => {
    const getDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };
    getDevices();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (videoRef.current?.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            facingMode: selectedDeviceId ? undefined : facingMode,
            width: { ideal: 720 },
            height: { ideal: 1280 }
          }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);

          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities() as any;
          if (capabilities.zoom) {
            setZoomCapabilities({
              min: capabilities.zoom.min,
              max: capabilities.zoom.max,
              step: capabilities.zoom.step || 0.1
            });
            setZoomLevel(capabilities.zoom.min);
          } else {
            setZoomCapabilities(null);
          }
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setIsCameraReady(false);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, selectedDeviceId]);

  useEffect(() => {
    if (isCameraReady && videoRef.current?.srcObject) {
      const track = (videoRef.current.srcObject as MediaStream).getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.zoom) {
        track.applyConstraints({
          advanced: [{ zoom: zoomLevel } as any]
        }).catch(err => console.error("Error applying zoom:", err));
      }
    }
  }, [zoomLevel, isCameraReady]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setSelectedDeviceId('');
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user' && !selectedDeviceId) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0);
        playCaptureSound();
        onCapture(canvas.toDataURL('image/jpeg', 0.8));
      }
    }
  };

  useEffect(() => {
    if (autoCapture && isCameraReady && isStarted) {
      setCountdown(7);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === 1) {
            clearInterval(interval);
            handleCapture();
            setIsStarted(false);
            return null;
          }
          if (prev && prev <= 4) {
            playTickSound();
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoCapture, isCameraReady, isStarted, guidelineType]);

  const startTestTimer = () => {
    if (timerDuration) {
      playStartSound();
      setTestTimer(timerDuration);
      const interval = setInterval(() => {
        setTestTimer(prev => {
          if (prev === 1) {
            clearInterval(interval);
            playEndSound();
            setTimeout(() => handleCapture(), 600);
            return 0;
          }
          if (prev && prev <= 6 && prev > 1) {
            playTickSound();
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
    }
  };

  // Handle voice commands from parent (format: "command_counter")
  useEffect(() => {
    if (!voiceCommand || !isCameraReady) return;

    const cmd = voiceCommand.split('_')[0];

    if (cmd === 'start') {
      if (timerDuration && testTimer === null) {
        startTestTimer();
      } else if (autoCapture && !isStarted && countdown === null) {
        setIsStarted(true);
      }
    } else if (cmd === 'capture') {
      if (!autoCapture && testTimer === null && countdown === null) {
        handleCapture();
      }
    }
  }, [voiceCommand]);

  // Render the appropriate guideline overlay
  const renderGuideline = () => {
    switch (guidelineType) {
      case 'front': return <FrontGuideline />;
      case 'side': return <SideGuideline />;
      case 'face': return <FaceGuideline />;
      case 'balance':
      case 'flexibility':
      case 'squat':
      case 'pushup':
        return <ActionGuideline type={guidelineType} />;
      default: return null;
    }
  };

  const positionHints = getPositionHints();

  return (
    <div className="relative w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl aspect-[9/16]" 
         style={{ background: '#000', boxShadow: '0 0 60px rgba(99, 102, 241, 0.15)' }}>
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${facingMode === 'user' && !selectedDeviceId ? 'scale-x-[-1]' : ''}`}
      />
      
      {/* Top instruction bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/50 to-transparent px-6 pt-6 pb-10 text-center z-10">
        <p className="text-white font-bold text-base drop-shadow-lg leading-snug mb-1">
          {getGuideMessage()}
        </p>
        <p className="text-white/40 text-[10px]">
          🎙️ 음성 명령: "시작" / "촬영" 사용 가능
        </p>
      </div>

      {/* ═══ GUIDELINE OVERLAY ═══ */}
      {renderGuideline()}

      {/* Position hints (for front/side/face only, shown as persistent bottom alerts) */}
      {positionHints.length > 0 && countdown === null && testTimer === null && (
        <PositionHint messages={positionHints} type="warning" />
      )}

      {/* Top Left Controls */}
      <div className="absolute top-20 left-4 flex flex-col gap-2 z-20">
        <button 
          onClick={toggleCamera}
          className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all glass text-sm"
          title="전면/후면 전환"
        >
          <i className="fas fa-sync-alt"></i>
        </button>
        
        {devices.length > 1 && facingMode === 'environment' && (
          <div className="flex flex-col gap-1">
            {devices.map((device, idx) => (
              <button
                key={device.deviceId}
                onClick={() => handleDeviceChange(device.deviceId)}
                className="px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all"
                style={{
                  background: selectedDeviceId === device.deviceId ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${selectedDeviceId === device.deviceId ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.15)'}`,
                  color: selectedDeviceId === device.deviceId ? 'white' : 'rgba(255,255,255,0.6)',
                }}
              >
                렌즈 {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom Slider */}
      {zoomCapabilities && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 h-40 w-9 glass rounded-full flex flex-col items-center py-3 z-20">
          <span className="text-[9px] text-white font-bold mb-1">배율</span>
          <input 
            type="range"
            min={zoomCapabilities.min}
            max={zoomCapabilities.max}
            step={zoomCapabilities.step}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="h-24 w-1 appearance-none rounded-lg cursor-pointer accent-white"
            style={{ writingMode: 'bt-lr', appearance: 'slider-vertical', background: 'rgba(255,255,255,0.3)' } as any}
          />
          <span className="text-[9px] text-white font-bold mt-1">{zoomLevel.toFixed(1)}x</span>
        </div>
      )}

      {/* Countdown UI */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
          <div className="text-center">
             <div className="text-[10rem] font-black text-white leading-none" style={{ animation: 'countPulse 1s ease-in-out infinite' }}>{countdown}</div>
             <p className="text-white font-black text-xl mt-6 tracking-widest uppercase animate-bounce">가이드라인에 맞춰 서세요!</p>
          </div>
        </div>
      )}

      {/* Test Timer UI */}
      {testTimer !== null && (
        <div className="absolute top-20 right-4 font-black px-5 py-3 rounded-2xl shadow-xl z-20 text-xl flex items-center gap-2"
             style={{ 
               background: testTimer <= 5 ? 'var(--accent-rose)' : 'rgba(0,0,0,0.7)',
               color: 'white', 
               boxShadow: testTimer <= 5 ? 'var(--glow-rose)' : 'none',
               border: '2px solid rgba(255,255,255,0.15)',
               backdropFilter: 'blur(8px)',
               transition: 'all 0.3s ease',
             }}>
          <i className={`fas fa-stopwatch ${testTimer <= 5 ? 'animate-pulse' : ''}`}></i>
          {testTimer}s
        </div>
      )}

      {/* Controls Area */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center px-6 z-20 gap-2">
        {timerDuration && testTimer === null ? (
          <button 
            onClick={startTestTimer}
            className="w-full py-5 text-white font-black text-lg rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
            style={{ background: 'var(--gradient-warm)', boxShadow: 'var(--glow-rose)' }}
          >
            <i className="fas fa-play"></i> {timerDuration}초 테스트 시작
          </button>
        ) : autoCapture && !isStarted && countdown === null ? (
          <button 
            onClick={() => setIsStarted(true)}
            className="w-full py-6 text-white font-black text-xl rounded-[2rem] active:scale-95 transition-all flex flex-col items-center gap-1"
            style={{ background: 'var(--gradient-primary)', boxShadow: '0 15px 40px rgba(99, 102, 241, 0.3)' }}
          >
            <span>준비 완료</span>
            <span className="text-[10px] font-medium opacity-70">버튼 또는 "시작"이라고 말하세요</span>
          </button>
        ) : !autoCapture && testTimer === null && countdown === null && (
          <button 
            onClick={handleCapture}
            disabled={!isCameraReady}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50"
            style={{ background: 'white', border: '4px solid rgba(255,255,255,0.3)' }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '4px solid var(--accent-indigo)' }}>
               <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-indigo)' }}></div>
            </div>
          </button>
        )}

        {testTimer === null && countdown === null && (
          <p className="text-white/30 text-[9px] text-center">
            🎙️ {timerDuration ? '"시작"이라고 말하면 타이머가 시작됩니다' : autoCapture && !isStarted ? '"시작" → 카운트다운 시작' : '"촬영" → 사진 촬영'}
          </p>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraModule;
