
import React, { useRef, useEffect, useState } from 'react';
import { speak } from '../services/ttsService';
import { usePoseEstimation } from '../hooks/usePoseEstimation';
import { useBackgroundBlur } from '../hooks/useBackgroundBlur';

interface CameraModuleProps {
  onCapture: (dataUrl: string, autoReps?: number) => void;
  guidelineType: 'front' | 'side' | 'squat' | 'pushup' | 'balance' | 'flexibility' | 'face' | 'arm_raise';
  autoCapture?: boolean;
  timerDuration?: number; // For strength tests
}

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, guidelineType, autoCapture, timerDuration }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);

  const { reps: autoReps, feedback: poseFeedback, isModelLoaded: isPoseLoaded } = usePoseEstimation(
    videoRef, 
    skeletonCanvasRef, 
    testTimer !== null && (guidelineType === 'squat' || guidelineType === 'pushup'), 
    guidelineType === 'squat' ? 'squat' : guidelineType === 'pushup' ? 'pushup' : 'none'
  );

  const { isReady: isBlurReady } = useBackgroundBlur(videoRef, blurCanvasRef, !isLoading && !cameraError);

  const needsPoseModel = guidelineType === 'squat' || guidelineType === 'pushup';
  const isAILoading = !isBlurReady || (needsPoseModel && !isPoseLoaded);

  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (isAILoading) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          // Simulate progress up to 95%
          if (prev >= 95) return 95;
          // Slower progress as it gets higher
          const increment = prev < 50 ? 5 : prev < 80 ? 2 : 0.5;
          return prev + increment;
        });
      }, 100);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
    }
  }, [isAILoading]);

  const getGuideMessage = () => {
    switch (guidelineType) {
      case 'front': return '가이드라인에 맞춰 정면 전체 몸이 나오도록 서주세요.';
      case 'side': return '수직선에 몸의 중심을 맞추고 옆으로 서주세요.';
      case 'balance': return '눈을 감고 한 발로 서서 균형을 유지하세요.';
      case 'arm_raise': return '팔을 최대한 높이 들어 올려 주세요.';
      case 'flexibility': return '동작을 크게 취하고 촬영 버튼을 누르세요.';
      case 'squat': return '15초 동안 스쿼트를 반복하세요.';
      case 'pushup': return '15초 동안 푸시업을 반복하세요.';
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
    let isMounted = true;
    setIsLoading(true);

    async function startCamera() {
      try {
        // Stop existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
            facingMode: selectedDeviceId ? undefined : facingMode,
            width: { ideal: 1080 },
            height: { ideal: 1920 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play error:", e));
          setIsCameraReady(true);
          setIsLoading(false);
          setCameraError(null);

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
        if (isMounted) {
          setIsCameraReady(false);
          setIsLoading(false);
          setCameraError("카메라에 접근할 수 없습니다. 권한 설정을 확인해 주세요.");
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
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
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        // Capture from the blurred canvas if it's ready, otherwise fallback to video
        if (isBlurReady && blurCanvasRef.current) {
          ctx.drawImage(blurCanvasRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        speak("찰칵");
        onCapture(canvas.toDataURL('image/jpeg', 0.8), autoReps);
      }
    }
  };

  useEffect(() => {
    if (autoCapture && isCameraReady && isStarted) {
      speak("5초 뒤에 촬영합니다. 준비해 주세요.");
      setCountdown(5);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === 1) {
            clearInterval(interval);
            // Use setTimeout to move handleCapture out of the state update cycle
            setTimeout(() => {
              handleCapture();
              setIsStarted(false);
            }, 0);
            return null;
          }
          const next = prev ? prev - 1 : null;
          if (next !== null && next <= 3) {
            speak(next.toString());
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [autoCapture, isCameraReady, isStarted, guidelineType]);

  const testTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (testTimerIntervalRef.current) {
        clearInterval(testTimerIntervalRef.current);
      }
    };
  }, []);

  const startTestTimer = () => {
    if (timerDuration) {
      speak(`테스트를 시작합니다. ${timerDuration}초 동안 동작을 반복해 주세요.`);
      setTestTimer(timerDuration);
      testTimerIntervalRef.current = setInterval(() => {
        setTestTimer(prev => {
          if (prev === 1) {
            if (testTimerIntervalRef.current) clearInterval(testTimerIntervalRef.current);
            speak("측정이 완료되었습니다.");
            // Use setTimeout to move handleCapture out of the state update cycle
            setTimeout(() => {
              handleCapture();
            }, 0);
            return 0;
          }
          const next = prev ? prev - 1 : null;
          if (next !== null && next <= 5 && next > 0) {
            speak(next.toString());
          }
          return next;
        });
      }, 1000);
    }
  };

  return (
    <div className="flex-1 min-h-0 w-full flex justify-center items-center">
      <div className="relative w-full max-w-[calc((100vh-280px)*9/16)] aspect-[9/16] rounded-[2.5rem] overflow-hidden bg-black shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className={`absolute inset-0 w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
        />
        <canvas
          ref={blurCanvasRef}
          className={`absolute inset-0 w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
        />
      
      {/* Vignette effect to focus on the person */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] z-0"></div>
      
      {isLoading && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-40">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
          <p className="text-white/60 text-sm font-medium">카메라를 연결 중입니다...</p>
        </div>
      )}

      {isAILoading && !isLoading && !cameraError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md z-40 px-8">
          <div className="w-16 h-16 relative mb-6">
            <div className="absolute inset-0 border-4 border-cyan-400/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-cyan-400 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-cyan-400 font-bold text-sm">
              {Math.round(loadingProgress)}%
            </div>
          </div>
          <p className="text-white font-bold text-lg tracking-wide">Loading model...</p>
          <p className="text-white/60 text-sm mt-2 text-center">AI 모델을 초기화하고 있습니다.<br/>잠시만 기다려 주세요.</p>
          
          {/* Progress Bar */}
          <div className="w-full max-w-xs h-2 bg-white/10 rounded-full mt-6 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {cameraError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-6 text-center">
          <div className="bg-white p-6 rounded-3xl shadow-2xl">
            <i className="fas fa-exclamation-triangle text-rose-500 text-4xl mb-4"></i>
            <p className="text-slate-800 font-bold mb-4">{cameraError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
            >
              새로고침
            </button>
          </div>
        </div>
      )}
      
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
        <button 
          onClick={() => setIsMirrored(!isMirrored)}
          className={`w-12 h-12 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all border ${isMirrored ? 'bg-indigo-600/80 border-indigo-400' : 'bg-white/20 hover:bg-white/40 border-white/30'}`}
          title="거울 모드 켜기/끄기"
        >
          <i className="fas fa-arrows-alt-h"></i>
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
          <div className="relative w-full max-w-sm h-full flex items-center justify-center pointer-events-none mx-auto">
            {/* Center Spine Line */}
            <div className="absolute h-[85%] w-px bg-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
            
            {/* Shoulder Line */}
            <div className="absolute top-[25%] w-[60%] h-px bg-indigo-400/60 border-t border-dashed border-indigo-300">
               <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
               <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
            </div>
            
            {/* Pelvis Line */}
            <div className="absolute top-[50%] w-[50%] h-px bg-indigo-400/60 border-t border-dashed border-indigo-300">
               <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
               <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
            </div>
            
            {/* Knee Line */}
            <div className="absolute top-[75%] w-[40%] h-px bg-indigo-400/60 border-t border-dashed border-indigo-300">
               <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
               <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)] animate-pulse"></div>
            </div>
            
            {/* Head Circle */}
            <div className="absolute top-[8%] w-[25%] aspect-square border-2 border-cyan-400/50 rounded-full shadow-[inset_0_0_15px_rgba(34,211,238,0.2)]"></div>
          </div>
        )}
        
        {guidelineType === 'side' && (
          <div className="relative w-full max-w-sm h-full flex justify-center pointer-events-none mx-auto">
             {/* Plumb Line */}
             <div className="h-[90%] mt-[5%] w-0.5 bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.8)] relative">
                {/* Alignment points: Ear, Shoulder, Hip, Knee, Ankle */}
                <div className="absolute top-[10%] -left-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse"></div>
                <div className="absolute top-[25%] -left-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse" style={{ animationDelay: '200ms' }}></div>
                <div className="absolute top-[50%] -left-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse" style={{ animationDelay: '400ms' }}></div>
                <div className="absolute top-[75%] -left-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse" style={{ animationDelay: '600ms' }}></div>
                <div className="absolute top-[90%] -left-1.5 w-3.5 h-3.5 rounded-full bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse" style={{ animationDelay: '800ms' }}></div>
             </div>
             {/* Silhouette/Bounding box hint */}
             <div className="absolute top-[10%] w-[45%] h-[85%] border-x border-dashed border-white/20"></div>
          </div>
        )}
        
        {guidelineType === 'face' && (
          <div className="relative w-full max-w-sm h-full flex items-center justify-center pointer-events-none mx-auto">
            {/* 3D-like Face Scanning Mesh */}
            <div className="w-[65%] h-[45%] relative">
              {/* Outer Glow */}
              <div className="absolute inset-0 border-4 border-cyan-400/30 rounded-[45%] shadow-[0_0_30px_rgba(34,211,238,0.4)]"></div>
              
              {/* Inner Grid/Mesh */}
              <div className="absolute inset-2 border border-cyan-400/20 rounded-[45%] overflow-hidden">
                <div className="w-full h-full bg-[linear-gradient(rgba(34,211,238,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.1)_1px,transparent_1px)] bg-[size:10px_10px] rounded-[45%]"></div>
              </div>

              {/* Scanning Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,1)] animate-[scan_3s_ease-in-out_infinite]"></div>

              {/* Key Feature Points */}
              <div className="absolute top-[35%] left-[25%] w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,1)] animate-pulse"></div>
              <div className="absolute top-[35%] right-[25%] w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,1)] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="absolute top-[55%] left-1/2 w-2 h-2 bg-cyan-300 rounded-full -translate-x-1/2 shadow-[0_0_8px_rgba(103,232,249,1)] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              <div className="absolute top-[75%] left-[35%] w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,1)] animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              <div className="absolute top-[75%] right-[35%] w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_rgba(103,232,249,1)] animate-pulse" style={{ animationDelay: '0.8s' }}></div>

              {/* Crosshair */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-cyan-400/40 -translate-y-1/2"></div>
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-cyan-400/40 -translate-x-1/2"></div>
            </div>
          </div>
        )}
        
        {(guidelineType === 'flexibility' || guidelineType === 'arm_raise' || guidelineType === 'balance' || guidelineType === 'squat' || guidelineType === 'pushup') && (
          <div className="relative w-[90%] max-w-2xl h-[90%] border-2 border-cyan-500/30 rounded-[2rem] overflow-hidden pointer-events-none">
            {/* Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            
            {/* Scanning line animation */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400/60 shadow-[0_0_15px_rgba(34,211,238,1)] animate-[pulse_2s_ease-in-out_infinite] top-1/2 -translate-y-1/2"></div>
            
            {/* Corner brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-400/60"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-400/60"></div>
          </div>
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
        <div className="absolute top-8 right-8 flex flex-col items-end gap-2 z-20">
          <div className="bg-rose-600 text-white font-black px-6 py-3 rounded-2xl shadow-xl text-2xl flex items-center gap-3 border-2 border-rose-400">
            <i className="fas fa-stopwatch animate-pulse"></i>
            {testTimer}s
          </div>
          {(guidelineType === 'squat' || guidelineType === 'pushup') && (
            <div className="bg-indigo-600 text-white font-black px-6 py-3 rounded-2xl shadow-xl text-2xl flex items-center gap-3 border-2 border-indigo-400">
              <i className="fas fa-dumbbell"></i>
              {autoReps}회
            </div>
          )}
        </div>
      )}

      {/* Real-time Pose Feedback */}
      {poseFeedback && testTimer !== null && (
        <div className="absolute top-32 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-md text-cyan-300 font-bold px-6 py-3 rounded-full shadow-lg border border-cyan-500/30 animate-in fade-in slide-in-from-bottom-4">
            {poseFeedback}
          </div>
        </div>
      )}

      {/* Controls Area */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8 z-20">
        {timerDuration && testTimer === null ? (
          <button 
            onClick={startTestTimer}
            disabled={isAILoading}
            className={`w-full py-6 font-black text-xl rounded-3xl shadow-2xl transition-all flex items-center justify-center gap-3 border-b-4 ${isAILoading ? 'bg-rose-600/50 text-white/50 border-rose-800/50 cursor-not-allowed' : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95 border-rose-800'}`}
          >
            <i className="fas fa-play"></i> {isAILoading ? 'AI 모델 로딩 중...' : `${timerDuration}초 테스트 시작`}
          </button>
        ) : autoCapture && !isStarted && countdown === null ? (
          <button 
            onClick={() => setIsStarted(true)}
            disabled={isAILoading}
            className={`w-full py-7 font-black text-2xl rounded-[2rem] shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all flex flex-col items-center gap-1 border-b-4 ${isAILoading ? 'bg-indigo-600/50 text-white/50 border-indigo-800/50 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 border-indigo-800'}`}
          >
            <span>{isAILoading ? 'AI 모델 로딩 중...' : '준비 완료'}</span>
            <span className={`text-xs font-medium opacity-80 ${isAILoading ? 'text-indigo-100/50' : 'text-indigo-100'}`}>클릭 후 5초 뒤 자동으로 촬영됩니다</span>
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

      <canvas ref={skeletonCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
      <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default CameraModule;
