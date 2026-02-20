
import React, { useState, useCallback } from 'react';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord } from '../types';
import CameraModule from './CameraModule';
import { analyzeHealth } from '../services/geminiService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';
import StepInstruction from './StepInstruction';
import useVoiceCommand from '../hooks/useVoiceCommand';

// Utility to resize images to prevent LocalStorage quota issues (approx 5MB limit)
const resizeImage = (dataUrl: string, maxWidth = 400): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality
      } else {
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
};

// Steps that show camera (not INTRO, USER_INFO, ANALYZING, REPORT)
const CAMERA_STEPS = [
  AssessmentStep.POSTURE_FRONT,
  AssessmentStep.POSTURE_SIDE,
  AssessmentStep.BALANCE_TEST,
  AssessmentStep.ARM_RAISE_TEST,
  AssessmentStep.FLEXIBILITY_TEST,
  AssessmentStep.STRENGTH_SQUAT,
  AssessmentStep.STRENGTH_PUSHUP,
  AssessmentStep.FACE_ANALYSIS,
];

const STEP_ORDER = Object.values(AssessmentStep);

const AssessmentFlow: React.FC = () => {
  const [step, setStep] = useState<AssessmentStep | 'HISTORY'>(AssessmentStep.INTRO);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [report, setReport] = useState<BodyReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  // Voice command forwarded to CameraModule — uses counter to trigger even if same command
  const [cameraVoiceCommand, setCameraVoiceCommand] = useState<string | null>(null);
  const [voiceCommandId, setVoiceCommandId] = useState(0);

  // Voice command handler
  const handleVoiceCommand = useCallback((command: string) => {
    if (command === 'next' || command === 'start') {
      if (step === AssessmentStep.INTRO) {
        setStep(AssessmentStep.USER_INFO);
      } else if (showInstruction && CAMERA_STEPS.includes(step as AssessmentStep)) {
        setShowInstruction(false);
      } else if (!showInstruction && CAMERA_STEPS.includes(step as AssessmentStep)) {
        // Forward 'start' to camera module
        setCameraVoiceCommand('start');
        setVoiceCommandId(prev => prev + 1);
      }
    } else if (command === 'capture') {
      if (!showInstruction && CAMERA_STEPS.includes(step as AssessmentStep)) {
        setCameraVoiceCommand('capture');
        setVoiceCommandId(prev => prev + 1);
      }
    }
  }, [step, showInstruction]);

  const { isListening, isSupported, toggleListening, startListening } = useVoiceCommand({
    onCommand: handleVoiceCommand,
    enabled: true,
  });

  // Auto-start voice recognition when entering camera steps
  React.useEffect(() => {
    if (!showInstruction && CAMERA_STEPS.includes(step as AssessmentStep) && isSupported && !isListening) {
      startListening();
    }
  }, [step, showInstruction, isSupported]);

  const saveRecord = async (rep: BodyReport, imgs: CapturedImage[]) => {
    try {
      const saved = localStorage.getItem('bt_records');
      const records: MemberRecord[] = saved ? JSON.parse(saved) : [];
      
      const resizedImages = await Promise.all(imgs.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 300)
      })));

      const newRecord: MemberRecord = {
        id: rep.id,
        name: rep.userInfo.name,
        lastTestDate: rep.date,
        report: rep,
        images: resizedImages
      };
      
      records.unshift(newRecord);
      const limitedRecords = records.slice(0, 20);
      localStorage.setItem('bt_records', JSON.stringify(limitedRecords));
    } catch (error) {
      console.warn("Storage failed:", error);
    }
  };

  const handleUserSubmit = (info: UserInfo) => {
    setUserInfo(info);
    setStep(AssessmentStep.POSTURE_FRONT);
    setShowInstruction(true);
  };

  const handleCapture = (dataUrl: string) => {
    const newImages = [...capturedImages, { step: step as AssessmentStep, dataUrl }];
    setCapturedImages(newImages);

    const currentIndex = STEP_ORDER.indexOf(step as AssessmentStep);
    const nextStep = STEP_ORDER[currentIndex + 1];

    if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
      setShowInstruction(true);
    }
  };

  const runAnalysis = async (images: CapturedImage[]) => {
    if (!userInfo) return;
    setStep(AssessmentStep.ANALYZING);
    setIsAnalyzing(true);
    try {
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 800)
      })));

      const result = await analyzeHealth(userInfo, aiOptimizedImages);
      setReport(result);
      await saveRecord(result, images);
      setStep(AssessmentStep.REPORT);
    } catch (error) {
      console.error("Analysis Error:", error);
      alert("분석 중 오류가 발생했습니다. 카메라 조명이 충분한지 확인하시고 다시 시도해 주세요.");
      setStep(AssessmentStep.INTRO);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step progress indicator
  const renderStepProgress = () => {
    if (step === AssessmentStep.INTRO || step === 'HISTORY' || step === AssessmentStep.REPORT) return null;
    
    const currentIndex = STEP_ORDER.indexOf(step as AssessmentStep);

    return (
      <div className="step-progress">
        {STEP_ORDER.filter(s => s !== AssessmentStep.INTRO && s !== AssessmentStep.REPORT && s !== AssessmentStep.ANALYZING).map((s, i) => {
          const sIndex = STEP_ORDER.indexOf(s);
          const isActive = s === step;
          const isCompleted = sIndex < currentIndex;
          return (
            <React.Fragment key={s}>
              <div className={`step-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`} />
              {i < 8 && <div className="step-connector" />}
            </React.Fragment>
          );
        })}
        
        {/* Voice toggle button */}
        {isSupported && (
          <button
            onClick={toggleListening}
            className={`voice-btn ml-3 ${isListening ? 'active' : 'inactive'}`}
            title={isListening ? '음성 인식 끄기' : '음성 인식 켜기'}
          >
            <i className={`fas ${isListening ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
            {isListening && <div className="voice-ripple" />}
          </button>
        )}
      </div>
    );
  };

  const renderCameraStep = (assessmentStep: AssessmentStep) => {
    const stepConfig: Record<string, { label: string; labelColor: string; title: string; guidelineType: string; autoCapture?: boolean; timerDuration?: number }> = {
      [AssessmentStep.POSTURE_FRONT]: { label: '진단 1단계', labelColor: 'text-indigo-400', title: '정면 신체 균형', guidelineType: 'front', autoCapture: true },
      [AssessmentStep.POSTURE_SIDE]: { label: '진단 2단계', labelColor: 'text-indigo-400', title: '측면 신체 균형', guidelineType: 'side', autoCapture: true },
      [AssessmentStep.BALANCE_TEST]: { label: '노화 테스트 01', labelColor: 'text-rose-400', title: '눈 감고 한발 서기', guidelineType: 'balance', timerDuration: 30 },
      [AssessmentStep.ARM_RAISE_TEST]: { label: '노화 테스트 02', labelColor: 'text-rose-400', title: '팔 들어 올리기', guidelineType: 'flexibility' },
      [AssessmentStep.FLEXIBILITY_TEST]: { label: '노화 테스트 03', labelColor: 'text-rose-400', title: '유연성 테스트 (전굴)', guidelineType: 'flexibility' },
      [AssessmentStep.STRENGTH_SQUAT]: { label: '근력 테스트 01', labelColor: 'text-emerald-400', title: '30초 스쿼트', guidelineType: 'squat', timerDuration: 30 },
      [AssessmentStep.STRENGTH_PUSHUP]: { label: '근력 테스트 02', labelColor: 'text-emerald-400', title: '30초 푸시업', guidelineType: 'pushup', timerDuration: 30 },
      [AssessmentStep.FACE_ANALYSIS]: { label: '바이오 스캔', labelColor: 'text-purple-400', title: '안면 노화도 측정', guidelineType: 'face' },
    };

    const config = stepConfig[assessmentStep];
    if (!config) return null;

    return (
      <div className="flex-1 flex flex-col p-6 overflow-auto animate-fadeIn">
        <div className="mb-4">
          <span className={`${config.labelColor} font-bold text-xs uppercase tracking-widest`}>{config.label}</span>
          <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{config.title}</h3>
        </div>
        <CameraModule
          key={config.guidelineType + assessmentStep}
          onCapture={handleCapture}
          guidelineType={config.guidelineType as any}
          autoCapture={config.autoCapture}
          timerDuration={config.timerDuration}
          voiceCommand={cameraVoiceCommand ? `${cameraVoiceCommand}_${voiceCommandId}` : null}
        />
      </div>
    );
  };

  const renderContent = () => {
    if (step === 'HISTORY') {
      return <HistoryManager 
                onViewReport={(rec) => {
                  setReport(rec.report);
                  setCapturedImages(rec.images);
                  setStep(AssessmentStep.REPORT);
                }} 
                onClose={() => setStep(AssessmentStep.INTRO)} 
             />;
    }

    switch (step) {
      case AssessmentStep.INTRO:
        return (
          <div className="max-w-xl mx-auto text-center py-16 px-6 animate-fadeIn">
            <div className="mx-auto mb-8 animate-float rounded-2xl overflow-hidden px-4 py-3 inline-block" 
                 style={{ background: 'rgba(255,255,255,0.95)', boxShadow: 'var(--glow-indigo)' }}>
              <img src="/logo.jpg" alt="BrainTraining Center" className="h-16 object-contain" />
            </div>
            <p className="text-lg mb-1 font-bold" style={{ color: 'var(--text-secondary)' }}>
              AI 신체 밸런스 &amp; 뇌 건강 진단
            </p>
            <p className="mb-10 leading-relaxed text-sm italic" style={{ color: 'var(--text-muted)' }}>
              Brain Education 5-Step 기반 종합 체력 평가 시스템
            </p>
            <div className="grid grid-cols-1 gap-3 mb-10 text-left">
              <button 
                onClick={() => setStep(AssessmentStep.USER_INFO)}
                className="w-full font-bold py-5 rounded-3xl shadow-xl transition-all flex items-center justify-center gap-3 text-white text-lg animate-slideUp"
                style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--glow-indigo)' }}
              >
                <i className="fas fa-play"></i>
                신규 진단 시작하기
                <i className="fas fa-chevron-right"></i>
              </button>
              <button 
                onClick={() => setStep('HISTORY')}
                className="w-full glass font-bold py-5 rounded-3xl transition-all flex items-center justify-center gap-3 animate-slideUp delay-100"
                style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'var(--bg-glass-light)' }}
              >
                <i className="fas fa-users"></i>
                회원 데이터 관리
              </button>
            </div>
            <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>
              Powered by Gemini AI Vision
            </div>
          </div>
        );

      case AssessmentStep.USER_INFO:
        return <UserInfoForm onSubmit={handleUserSubmit} />;

      // Camera steps with instruction screens
      case AssessmentStep.POSTURE_FRONT:
      case AssessmentStep.POSTURE_SIDE:
      case AssessmentStep.BALANCE_TEST:
      case AssessmentStep.ARM_RAISE_TEST:
      case AssessmentStep.FLEXIBILITY_TEST:
      case AssessmentStep.STRENGTH_SQUAT:
      case AssessmentStep.STRENGTH_PUSHUP:
      case AssessmentStep.FACE_ANALYSIS:
        if (showInstruction) {
          return (
            <StepInstruction
              step={step}
              onStart={() => setShowInstruction(false)}
              voiceSupported={isSupported}
            />
          );
        }
        return renderCameraStep(step);

      case AssessmentStep.ANALYZING:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-fadeIn">
            <div className="relative">
              <div className="w-32 h-32 rounded-full animate-spin" 
                   style={{ border: '4px solid rgba(99, 102, 241, 0.1)', borderTopColor: 'var(--accent-indigo)' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-fingerprint text-3xl animate-pulse" style={{ color: 'var(--accent-indigo)' }}></i>
              </div>
            </div>
            <h3 className="text-2xl font-bold mt-8 mb-2 gradient-text">통합 AI 리포트 생성 중</h3>
            <p className="max-w-xs mx-auto text-sm" style={{ color: 'var(--text-muted)' }}>
              데이터를 분석하여 신뢰도 높은 리포트를 구축하고 있습니다. 잠시만 기다려 주세요.
            </p>
            <div className="mt-8 flex gap-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-2 h-2 rounded-full animate-pulse"
                     style={{ background: 'var(--accent-indigo)', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        );

      case AssessmentStep.REPORT:
        return report ? <ReportDashboard 
                          report={report} 
                          images={capturedImages}
                          onRestart={() => {
                            setStep(AssessmentStep.INTRO);
                            setCapturedImages([]);
                            setReport(null);
                            setUserInfo(null);
                            setShowInstruction(true);
                          }} 
                        /> : null;

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {renderStepProgress()}
      {renderContent()}
    </div>
  );
};

export default AssessmentFlow;
