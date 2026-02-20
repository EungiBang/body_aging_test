
import React, { useRef, useEffect, useState } from 'react';

interface CameraModuleProps {
  onCapture: (dataUrl: string) => void;
  guidelineType: 'front' | 'side' | 'squat' | 'pushup' | 'balance' | 'flexibility' | 'face';
  autoCapture?: boolean;
  timerDuration?: number; // For strength tests
}

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, guidelineType, autoCapture, timerDuration }) => {
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

  const getGuideMessage = () => {
    switch (guidelineType) {
      case 'front': return '가이드라인에 맞춰 정면 전체 몸이 나오도록 서주세요.';
      case 'side': return '수직선에 몸의 중심을 맞추고 옆으로 서주세요.';
      case 'balance': return '눈을 감고 한 발로 서서 균형을 유지하세요.';
      case 'flexibility': return '동작을 크게 취하고 촬영 버튼을 누르세요.';
      case 'squat': return '30초 동안 스쿼트를 반복하세요.';
      case 'pushup': return '30초 동안 푸시업을 반복하세요.';
      case 'face': return '얼굴을 원 안에 맞추고 정면을 응시하세요.';
      default: return '';
    }
  };

  // Get available video devices
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

          // Check zoom capabilities
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

  // Apply zoom level to the track
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
    setSelectedDeviceId(''); // Reset specific device when switching mode
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
          return prev ? prev - 1 : null;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoCapture, isCameraReady, isStarted, guidelineType]);

  const startTestTimer = () => {
    if (timerDuration) {
      setTestTimer(timerDuration);
      const interval = setInterval(() => {
        setTestTimer(prev => {
          if (prev === 1) {
            clearInterval(interval);
            handleCapture();
            return 0;
          }
          return prev ? prev - 1 : null;
        });
      }, 1000);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden bg-black shadow-2xl aspect-[9/16]">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${facingMode === 'user' && !selectedDeviceId ? 'scale-x-[-1]' : ''}`}
      />
      
      {/* Visual Instruction Overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-8 text-center z-10">
        <p className="text-white font-bold text-lg drop-shadow-lg leading-snug">
          {getGuideMessage()}
        </p>
        <p className="text-white/60 text-[10px] mt-2">몸이 다 안 나올 경우 카메라 전환 버튼으로 광각 렌즈를 선택하거나 거리를 조절하세요.</p>
      </div>

      {/* Top Left Controls: Switch Mode & Device Selector */}
      <div className="absolute top-8 left-8 flex flex-col gap-3 z-20">
        <button 
          onClick={toggleCamera}
          className="w-12 h-12 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border border-white/30"
          title="전면/후면 전환"
        >
          <i className="fas fa-sync-alt"></i>
        </button>
        
        {devices.length > 1 && facingMode === 'environment' && (
          <div className="flex flex-col gap-2">
            {devices.map((device, idx) => (
              <button
                key={device.deviceId}
                onClick={() => handleDeviceChange(device.deviceId)}
                className={`px-3 py-2 rounded-xl text-[10px] font-bold backdrop-blur-md border transition-all ${selectedDeviceId === device.deviceId ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/10 border-white/20 text-white/70'}`}
              >
                렌즈 {idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom Slider (Right Side) */}
      {zoomCapabilities && (
        <div className="absolute right-6 top-1/2 -translate-y-1/2 h-48 w-10 bg-black/30 backdrop-blur-md rounded-full flex flex-col items-center py-4 z-20 border border-white/10">
          <span className="text-[10px] text-white font-bold mb-2">배율</span>
          <input 
            type="range"
            min={zoomCapabilities.min}
            max={zoomCapabilities.max}
            step={zoomCapabilities.step}
            value={zoomLevel}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            className="h-28 w-1 appearance-none bg-white/30 rounded-lg cursor-pointer accent-white"
            style={{ writingMode: 'bt-lr', appearance: 'slider-vertical' } as any}
          />
          <span className="text-[10px] text-white font-bold mt-2">{zoomLevel.toFixed(1)}x</span>
        </div>
      )}

      {/* Overlay Guidelines */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {guidelineType === 'front' && (
          <div className="w-[65%] h-[90%] border-2 border-dashed border-indigo-400/40 rounded-full flex flex-col items-center">
            <div className="w-full h-px bg-white/20 mt-[20%]"></div>
            <div className="w-full h-px bg-white/20 mt-[30%]"></div>
            <div className="w-full h-px bg-white/20 mt-[30%]"></div>
          </div>
        )}
        {guidelineType === 'side' && (
          <div className="relative w-full h-full flex justify-center">
             <div className="h-full w-px bg-indigo-400/60 shadow-[0_0_15px_rgba(129,140,248,0.5)]"></div>
             <div className="absolute top-[10%] w-[45%] h-[85%] border-x border-white/20"></div>
          </div>
        )}
        {guidelineType === 'face' && <div className="w-[55%] h-[38%] border-2 border-dashed border-indigo-400/60 rounded-[50%]" />}
        {(guidelineType === 'flexibility' || guidelineType === 'balance' || guidelineType === 'squat' || guidelineType === 'pushup') && (
          <div className="w-[90%] h-[90%] border border-white/10 rounded-[2rem]"></div>
        )}
      </div>

      {/* Countdown UI */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-30">
          <div className="text-center">
             <div className="text-[12rem] font-black text-white animate-pulse leading-none">{countdown}</div>
             <p className="text-white font-black text-2xl mt-8 tracking-widest uppercase animate-bounce">준비하세요!</p>
          </div>
        </div>
      )}

      {/* Test Timer UI */}
      {testTimer !== null && (
        <div className="absolute top-8 right-8 bg-rose-600 text-white font-black px-6 py-3 rounded-2xl shadow-xl z-20 text-2xl flex items-center gap-3 border-2 border-rose-400">
          <i className="fas fa-stopwatch animate-pulse"></i>
          {testTimer}s
        </div>
      )}

      {/* Controls Area */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8 z-20">
        {timerDuration && testTimer === null ? (
          <button 
            onClick={startTestTimer}
            className="w-full py-6 bg-rose-600 text-white font-black text-xl rounded-3xl shadow-2xl hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-3 border-b-4 border-rose-800"
          >
            <i className="fas fa-play"></i> {timerDuration}초 테스트 시작
          </button>
        ) : autoCapture && !isStarted && countdown === null ? (
          <button 
            onClick={() => setIsStarted(true)}
            className="w-full py-7 bg-indigo-600 text-white font-black text-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:bg-indigo-700 active:scale-95 transition-all flex flex-col items-center gap-1 border-b-4 border-indigo-800"
          >
            <span>준비 완료</span>
            <span className="text-xs font-medium text-indigo-100 opacity-80">클릭 후 7초 뒤 자동으로 촬영됩니다</span>
          </button>
        ) : !autoCapture && testTimer === null && countdown === null && (
          <button 
            onClick={handleCapture}
            disabled={!isCameraReady}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all disabled:opacity-50 border-4 border-slate-200"
          >
            <div className="w-14 h-14 rounded-full border-4 border-indigo-600 flex items-center justify-center">
               <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
            </div>
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraModule;
