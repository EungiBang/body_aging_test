
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { speak, stopSpeaking } from '../services/ttsService';
import { usePoseEstimation } from '../hooks/usePoseEstimation';
import { useBackgroundBlur } from '../hooks/useBackgroundBlur';

interface CameraModuleProps {
  onCapture: (dataUrl: string, autoReps?: number, metadata?: { reps?: number, footDrops?: number, swayScore?: number, formScore?: number, kneeAssisted?: boolean, postureData?: any }) => void;
  guidelineType: 'front' | 'side' | 'squat' | 'pushup' | 'balance' | 'flexibility' | 'face' | 'arm_raise';
  autoCapture?: boolean;
  timerDuration?: number; // For strength tests
  preferredDeviceId?: string; // Persist camera selection across steps
  onDeviceChange?: (deviceId: string) => void; // Notify parent of camera change
  perfInfo?: any; // 성능 티어 정보
}

const toKoreanNumber = (n: number): string => {
  const nums = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십'];
  return n <= 10 ? nums[n] : n.toString();
};

const CameraModule: React.FC<CameraModuleProps> = ({ onCapture, guidelineType, autoCapture, timerDuration, preferredDeviceId, onDeviceChange, perfInfo }) => {
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
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(preferredDeviceId || localStorage.getItem('selectedCameraId') || '');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number, max: number, step: number } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');

  // perfInfo가 전달되지 않았을 때 기본값 생성 (포즈 감지 루프가 항상 동작하도록)
  const defaultPerfInfo = { poseInterval: 500, poseInputSize: 256, drawSkeleton: true, videoWidth: 640, videoHeight: 480 };
  const activePerfInfo = perfInfo || defaultPerfInfo;

  const { reps: autoReps, feedback: poseFeedback, isModelLoaded: isPoseLoaded, footDrops, swayScore, formScore, postureData, validation } = usePoseEstimation(
    videoRef, 
    skeletonCanvasRef, 
    testTimer !== null && (guidelineType === 'squat' || guidelineType === 'pushup') || ['front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType), 
    ['squat', 'pushup', 'front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType) ? (guidelineType as any) : 'none',
    activePerfInfo
  );

  // Background blur DISABLED - root cause of main thread blocking & timer freezes
  // segmentPeople() blocks main thread 100-300ms per frame, making UI unresponsive
  const { isReady: isBlurReady } = useBackgroundBlur(videoRef, blurCanvasRef, false);

  const needsPoseModel = ['squat', 'pushup', 'front', 'side', 'arm_raise', 'flexibility'].includes(guidelineType);
  // Only wait for pose model on necessary steps
  const isAILoading = needsPoseModel && !isPoseLoaded;

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
      case 'face': return '조명을 밝게 세팅한 후, 얼굴을 원 안에 맞추고 정면을 응시하세요.';
      default: return '';
    }
  };

  // 가상 카메라 필터 (OBS, ManyCam, XSplit, Snap Camera 등 제외)
  const VIRTUAL_CAM_KEYWORDS = [
    'obs', 'virtual', 'manycam', 'xsplit', 'snap camera', 'droidcam',
    'iriun', 'epoccam', 'newtek', 'ndi', 'camtwist', 'mmhmm',
    'logi capture', 'streamlabs', 'prism', 'e2esoft', 'vcam',
    'splitcam', 'sparkocam', 'youcam', 'cyberlink', 'fake',
  ];

  const isVirtualCamera = (device: MediaDeviceInfo): boolean => {
    const label = (device.label || '').toLowerCase();
    if (!label) return false; // 라벨 없으면 판단 불가 → 실제 카메라로 취급
    return VIRTUAL_CAM_KEYWORDS.some(keyword => label.includes(keyword));
  };

  // Get available video devices (가상 카메라 제외)
  const refreshDeviceList = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      const physicalDevices = videoDevices.filter(d => !isVirtualCamera(d));
      const filteredCount = videoDevices.length - physicalDevices.length;
      setDevices(physicalDevices);
      console.log(`[Camera] Found ${videoDevices.length} video devices (가상 ${filteredCount}대 제외):`, physicalDevices.map(d => d.label || d.deviceId));
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  };

  useEffect(() => {
    refreshDeviceList();
  }, []);

  // 설정 모달에서 카메라 변경 시 실시간 반영
  useEffect(() => {
    const handleCameraSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.deviceId) {
        setSelectedDeviceId(detail.deviceId);
        onDeviceChange?.(detail.deviceId);
      }
    };
    window.addEventListener('camera:change', handleCameraSwitch);
    return () => window.removeEventListener('camera:change', handleCameraSwitch);
  }, [onDeviceChange]);

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
            width: { ideal: perfInfo?.videoWidth || 854 },
            height: { ideal: perfInfo?.videoHeight || 480 }
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

          // Auto-detect and persist the actual camera device being used
          const activeTrack = stream.getVideoTracks()[0];
          const activeSettings = activeTrack.getSettings();
          if (activeSettings.deviceId) {
            setActiveDeviceId(activeSettings.deviceId);
            if (!selectedDeviceId) {
              onDeviceChange?.(activeSettings.deviceId);
            }
          }

          // Re-enumerate devices after permission granted (labels become available)
          refreshDeviceList();

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
        console.error("Error accessing camera with constraints:", err);
        // Fallback: Try with simple { video: true } if exact device or facingMode failed
        try {
          console.log("[Camera] Retrying with basic constraints { video: true }...");
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          
          if (!isMounted) {
            fallbackStream.getTracks().forEach(track => track.stop());
            return;
          }

          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play().catch(e => console.error("Video play error:", e));
            setIsCameraReady(true);
            setIsLoading(false);
            setCameraError(null);

            const activeTrack = fallbackStream.getVideoTracks()[0];
            const activeSettings = activeTrack.getSettings();
            if (activeSettings.deviceId) {
              setActiveDeviceId(activeSettings.deviceId);
            }
            refreshDeviceList();
          }
        } catch (fallbackErr) {
          console.error("Fallback camera access also failed:", fallbackErr);
          if (isMounted) {
            setIsCameraReady(false);
            setIsLoading(false);
            setCameraError("카메라에 접근할 수 없습니다. 권한 설정을 확인해 주세요.");
          }
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
    onDeviceChange?.(deviceId);
  };

  // Use ref for handleCapture to avoid stale closures in timers
  const handleCaptureRef = useRef<() => void>(() => {});
  
  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      
      // Crop to match the 9:16 portrait view the user sees on screen
      const targetRatio = 9 / 16;
      const videoRatio = videoW / videoH;
      
      let srcX = 0, srcY = 0, srcW = videoW, srcH = videoH;
      
      if (videoRatio > targetRatio) {
        srcW = Math.round(videoH * targetRatio);
        srcX = Math.round((videoW - srcW) / 2);
      } else if (videoRatio < targetRatio) {
        srcH = Math.round(videoW / targetRatio);
        srcY = Math.round((videoH - srcH) / 2);
      }
      
      canvas.width = srcW;
      canvas.height = srcH;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        
        // --- AI 뼈대(Skeleton) 오버레이 합성 ---
        if (skeletonCanvasRef.current) {
          ctx.drawImage(skeletonCanvasRef.current, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        }

        // --- 얼굴 안색/밝기 측정 (FACE_ANALYSIS용) ---
        let finalPostureData = postureData ? { ...postureData } : {};
        if (guidelineType === 'face') {
          try {
            // 얼굴이 들어가는 중앙 30% 영역(ROI) 지정
            const roiW = Math.floor(canvas.width * 0.3);
            const roiH = Math.floor(canvas.height * 0.3);
            const rx = Math.floor(canvas.width / 2) - Math.floor(roiW / 2);
            const ry = Math.floor(canvas.height / 2) - Math.floor(roiH / 2);
            
            // 캔버스 크기를 벗어나지 않도록 보정
            const safeRx = Math.max(0, rx);
            const safeRy = Math.max(0, ry);
            const safeRw = Math.min(roiW, canvas.width - safeRx);
            const safeRh = Math.min(roiH, canvas.height - safeRy);
            
            const imageData = ctx.getImageData(safeRx, safeRy, safeRw, safeRh);
            const data = imageData.data;
            let totalLuma = 0;
            let pixelCount = 0;
            
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              // Luma(휘도) 공식: L = 0.213R + 0.715G + 0.072B
              totalLuma += (0.213 * r + 0.715 * g + 0.072 * b);
              pixelCount++;
            }
            
            if (pixelCount > 0) {
              const avgLuma = totalLuma / pixelCount;
              finalPostureData.faceBrightness = Number(avgLuma.toFixed(1));
              console.log('[Face Analysis] 평균 휘도(Luma):', finalPostureData.faceBrightness);
            }
          } catch (err) {
            console.error('Face brightness calculation failed:', err);
          }
        }
        
        onCapture(canvas.toDataURL('image/jpeg', 0.8), autoReps, {
          footDrops,
          swayScore,
          formScore,
          postureData: finalPostureData
        });
      }
    }
  }, [isMirrored, onCapture, autoReps, footDrops, swayScore, formScore, postureData, guidelineType]);

  // Keep ref in sync
  useEffect(() => {
    handleCaptureRef.current = handleCapture;
  }, [handleCapture]);

  // Auto-capture countdown (for posture front/side etc.)
  useEffect(() => {
    if (autoCapture && isCameraReady && isStarted) {
      stopSpeaking();
      if (guidelineType === 'face') {
        speak("조명을 밝게 셋팅해 주세요. 5초 뒤에 촬영합니다. 준비해 주세요.");
      } else {
        speak("5초 뒤에 촬영합니다. 준비해 주세요.");
      }
      const COUNTDOWN_DURATION = 5;
      setCountdown(COUNTDOWN_DURATION);
      const countdownStart = Date.now();
      let lastSpoken = COUNTDOWN_DURATION + 1;

      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - countdownStart) / 1000);
        const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);

        if (remaining <= 0) {
          clearInterval(interval);
          setCountdown(null);
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
            setIsStarted(false);
          }, 0);
        } else {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toKoreanNumber(remaining));
          }
        }
      }, 200);

      return () => clearInterval(interval);
    }
  }, [autoCapture, isCameraReady, isStarted]);

  const testTimerIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerWorkerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Web Worker for Timer 초기화
    if (window.Worker) {
      // Vite 환경에서는 public이나 별도 빌드된 worker 파일 경로 필요
      // 하지만 가장 간단하고 의존성 없는 Blob 방식 사용
      const workerCode = `
        let intervalId = null;
        let startTime = 0;
        let duration = 0;
        let mode = null;

        const clearTimer = () => {
          if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
          }
          mode = null;
        };

        const tick = () => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, duration - elapsed);

          if (mode === 'countdown') {
            self.postMessage({ type: 'countdown', remaining });
            if (remaining <= 0) {
              clearTimer();
              self.postMessage({ type: 'countdownComplete' });
            }
          } else if (mode === 'test') {
            self.postMessage({ type: 'testTick', remaining });
            if (remaining <= 0) {
              clearTimer();
              self.postMessage({ type: 'testComplete' });
            }
          }
        };

        self.onmessage = (e) => {
          const { type } = e.data;
          if (type === 'startCountdown') {
            clearTimer();
            mode = 'countdown';
            duration = e.data.duration;
            startTime = Date.now();
            intervalId = setInterval(tick, 100);
            tick();
          } else if (type === 'startTest') {
            clearTimer();
            mode = 'test';
            duration = e.data.duration;
            startTime = Date.now();
            intervalId = setInterval(tick, 100);
            tick();
          } else if (type === 'stop') {
            clearTimer();
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      timerWorkerRef.current = new Worker(URL.createObjectURL(blob));
    }

    return () => {
      if (testTimerIntervalRef.current) {
        clearTimeout(testTimerIntervalRef.current);
      }
      if (timerWorkerRef.current) {
        timerWorkerRef.current.postMessage({ type: 'stop' });
        timerWorkerRef.current.terminate();
      }
    };
  }, []);

  const startTestTimer = () => {
    if (!timerDuration) return;
    stopSpeaking();

    // Appropriate narration per test type
    const narration = guidelineType === 'balance'
      ? `5초 뒤에 테스트를 시작합니다. ${timerDuration}초 동안 균형을 유지해 주세요. 준비해 주세요.`
      : `5초 뒤에 테스트를 시작합니다. ${timerDuration}초 동안 동작을 반복해 주세요. 준비해 주세요.`;
    speak(narration);

    // 5-second preparation countdown first
    const PREP_DURATION = 5;
    setCountdown(PREP_DURATION);
    let lastPrepSpoken = PREP_DURATION + 1;

    if (timerWorkerRef.current) {
      timerWorkerRef.current.onmessage = (e) => {
        const { type, remaining } = e.data;
        if (type === 'countdown') {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastPrepSpoken) {
            lastPrepSpoken = remaining;
            speak(toKoreanNumber(remaining));
          }
        } else if (type === 'countdownComplete') {
          setCountdown(null);
          beginTestTimer();
        }
      };
      timerWorkerRef.current.postMessage({ type: 'startCountdown', duration: PREP_DURATION });
    } else {
      // Fallback
      const prepStart = Date.now();
      const prepInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - prepStart) / 1000);
        const remaining = Math.max(0, PREP_DURATION - elapsed);

        if (remaining <= 0) {
          clearInterval(prepInterval);
          setCountdown(null);
          beginTestTimer();
        } else {
          setCountdown(remaining);
          if (remaining <= 3 && remaining < lastPrepSpoken) {
            lastPrepSpoken = remaining;
            speak(toKoreanNumber(remaining));
          }
        }
      }, 200);
    }
  };

  const beginTestTimer = () => {
    if (!timerDuration) return;

    speak("시작!");

    const startTime = Date.now();
    setTestTimer(timerDuration);

    // Clear any existing timeout
    if (testTimerIntervalRef.current) {
      clearTimeout(testTimerIntervalRef.current);
    }

    let lastSpoken = timerDuration + 1;

    if (timerWorkerRef.current) {
      timerWorkerRef.current.onmessage = (e) => {
        const { type, remaining } = e.data;
        if (type === 'testTick') {
          setTestTimer(remaining);
          if (remaining <= 5 && remaining > 0 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toKoreanNumber(remaining));
          }
        } else if (type === 'testComplete') {
          setTestTimer(null);
          speak("측정이 완료되었습니다.");
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
          }, 300);
        }
      };
      timerWorkerRef.current.postMessage({ type: 'startTest', duration: timerDuration });
    } else {
      // Fallback
      const tick = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, timerDuration - elapsed);

        if (remaining <= 0) {
          testTimerIntervalRef.current = null;
          setTestTimer(null);
          speak("측정이 완료되었습니다.");
          setTimeout(() => {
            if(handleCaptureRef.current) handleCaptureRef.current();
          }, 300);
        } else {
          setTestTimer(remaining);
          if (remaining <= 5 && remaining < lastSpoken) {
            lastSpoken = remaining;
            speak(toKoreanNumber(remaining));
          }
          testTimerIntervalRef.current = setTimeout(tick, 100);
        }
      };
      testTimerIntervalRef.current = setTimeout(tick, 100);
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
      
      {/* Visual Instruction Overlay REMOVED */}





      {/* Overlay Guidelines */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {(guidelineType === 'front' || guidelineType === 'side') && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
            {/* Sci-Fi Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] bg-[size:30px_30px] opacity-80"
                 style={{ backgroundPosition: 'center' }}></div>
                 
            {/* Dynamic 3D Scanning Grid & Planes */}
            <div className="absolute inset-0 perspective-1000 overflow-hidden pointer-events-none flex items-center justify-center">
              <div className="absolute left-[10%] right-[10%] h-[90%] border-x border-cyan-500/20 transform-style-3d">
                {/* Vertical 3D Plane Scanner */}
                <div className="absolute left-0 right-0 h-[150px] bg-gradient-to-b from-transparent via-cyan-400/20 to-cyan-400/40 border-b-2 border-cyan-400 shadow-[0_10px_40px_rgba(34,211,238,0.7)]"
                     style={{ animation: 'scanPlane3D 3.5s linear infinite' }}>
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.3)_1px,transparent_1px)] bg-[size:15px_15px]" style={{ animation: 'dataStream 1s linear infinite' }}></div>
                </div>
              </div>
              
              {/* Horizontal Radar/Lidar sweep */}
              <div className="absolute top-[15%] bottom-[15%] w-[2px] bg-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,1)]"
                   style={{ animation: 'scanPlaneHorizontal 4s ease-in-out infinite' }}>
                 <div className="absolute top-1/2 left-1/2 w-8 h-8 border border-emerald-400 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(16,185,129,0.5)]" style={{ animation: 'pulseRing 1.5s infinite' }}></div>
              </div>
            </div>

            {/* Targeting/Corner brackets for AI feel - Pushed to the edges */}
            <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-cyan-400/80 rounded-tl-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
            <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-cyan-400/80 rounded-tr-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
            <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-cyan-400/80 rounded-bl-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
            <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-cyan-400/80 rounded-br-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
            
            {/* Floating analysis dots */}
            <div className="absolute w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)] top-1/3 left-1/4 animate-ping" style={{ animationDuration: '3s' }}></div>
            <div className="absolute w-2 h-2 bg-purple-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,1)] bottom-1/3 right-1/4 animate-ping" style={{ animationDuration: '2s' }}></div>
          </div>
        )}
        
        {guidelineType === 'face' && (
          <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
            {/* Large Face Scanning Oval */}
            <div className="w-[85%] aspect-[3/4] max-h-[70%] relative">
              {/* Outer ring - thick glow */}
              <div className="absolute inset-0 border-[3px] border-cyan-400/50 rounded-[50%] shadow-[0_0_40px_rgba(34,211,238,0.3),inset_0_0_40px_rgba(34,211,238,0.1)]"></div>
              
              {/* Second ring */}
              <div className="absolute inset-3 border border-cyan-400/25 rounded-[50%]"></div>

              {/* Inner Grid/Mesh */}
              <div className="absolute inset-5 border border-cyan-400/15 rounded-[50%] overflow-hidden">
                <div className="w-full h-full bg-[linear-gradient(rgba(34,211,238,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.07)_1px,transparent_1px)] bg-[size:15px_15px]"></div>
              </div>

              {/* Scanning Line - sweeps top to bottom */}
              <div className="absolute left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_15px_rgba(103,232,249,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>

              {/* Key Feature Points - Eyes */}
              <div className="absolute top-[38%] left-[28%] w-3 h-3 border-2 border-cyan-300 rounded-full shadow-[0_0_10px_rgba(103,232,249,1)] animate-pulse"></div>
              <div className="absolute top-[38%] right-[28%] w-3 h-3 border-2 border-cyan-300 rounded-full shadow-[0_0_10px_rgba(103,232,249,1)] animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              
              {/* Nose */}
              <div className="absolute top-[52%] left-1/2 w-2.5 h-2.5 border-2 border-cyan-300 rounded-full -translate-x-1/2 shadow-[0_0_8px_rgba(103,232,249,0.8)] animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              
              {/* Mouth area */}
              <div className="absolute top-[65%] left-[38%] w-2 h-2 bg-cyan-300/60 rounded-full shadow-[0_0_6px_rgba(103,232,249,0.6)] animate-pulse" style={{ animationDelay: '0.6s' }}></div>
              <div className="absolute top-[65%] right-[38%] w-2 h-2 bg-cyan-300/60 rounded-full shadow-[0_0_6px_rgba(103,232,249,0.6)] animate-pulse" style={{ animationDelay: '0.8s' }}></div>

              {/* Jaw points */}
              <div className="absolute top-[78%] left-[22%] w-1.5 h-1.5 bg-cyan-400/40 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-[78%] right-[22%] w-1.5 h-1.5 bg-cyan-400/40 rounded-full animate-pulse" style={{ animationDelay: '1.2s' }}></div>
              <div className="absolute top-[85%] left-1/2 w-1.5 h-1.5 bg-cyan-400/40 rounded-full -translate-x-1/2 animate-pulse" style={{ animationDelay: '1.4s' }}></div>

              {/* Crosshair */}
              <div className="absolute top-1/2 left-[5%] right-[5%] h-px bg-cyan-400/20 -translate-y-1/2"></div>
              <div className="absolute left-1/2 top-[5%] bottom-[5%] w-px bg-cyan-400/20 -translate-x-1/2"></div>

              {/* Corner data labels */}
              <div className="absolute -top-6 left-0 text-[10px] text-cyan-400/70 font-mono">SCAN ACTIVE</div>
              <div className="absolute -top-6 right-0 text-[10px] text-cyan-400/70 font-mono animate-pulse">● REC</div>
              <div className="absolute -bottom-6 left-0 text-[10px] text-cyan-400/50 font-mono">피부 탄력 분석</div>
              <div className="absolute -bottom-6 right-0 text-[10px] text-cyan-400/50 font-mono">주름 분석</div>
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
        <div className="absolute top-6 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="bg-rose-600 text-white font-black px-5 py-2 rounded-2xl shadow-xl text-xl flex items-center gap-2 border-2 border-rose-400">
              <i className="fas fa-stopwatch animate-pulse"></i>
              {testTimer}초
            </div>
            {(guidelineType === 'squat' || guidelineType === 'pushup') && (
              <div className="bg-indigo-600 text-white font-black px-5 py-2 rounded-2xl shadow-xl text-xl flex items-center gap-2 border-2 border-indigo-400">
                <i className="fas fa-dumbbell"></i>
                {autoReps}회
              </div>
            )}
          </div>
        </div>
      )}

      {/* Large center rep count for squat/pushup */}
      {testTimer !== null && (guidelineType === 'squat' || guidelineType === 'pushup') && (
        <div className="absolute inset-0 flex items-center justify-center z-15 pointer-events-none">
          <div className="text-[8rem] font-black text-white/30 leading-none select-none">
            {autoReps}
          </div>
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
            className={`w-full py-4 font-black text-xl rounded-2xl transition-all flex items-center justify-center gap-2 border ${isAILoading ? 'bg-black/30 backdrop-blur-sm border-white/10 text-white/50 cursor-not-allowed' : 'bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/50 active:scale-95'}`}
          >
            <i className="fas fa-play"></i> {isAILoading ? '로딩 중...' : `${timerDuration}초 시작`}
          </button>
        ) : autoCapture && !isStarted && countdown === null ? (
          <button 
            onClick={() => setIsStarted(true)}
            disabled={isAILoading}
            className={`w-full py-4 font-bold text-xl rounded-2xl transition-all flex justify-center items-center gap-2 border ${isAILoading ? 'bg-black/30 backdrop-blur-sm border-white/10 text-white/50 cursor-not-allowed' : 'bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/50 active:scale-95'}`}
          >
            <span>{isAILoading ? '로딩 중...' : '5초 뒤 촬영'}</span>
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
