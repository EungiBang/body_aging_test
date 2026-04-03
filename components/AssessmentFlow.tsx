
import React, { useState, useEffect } from 'react';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord } from '../types';
import CameraModule from './CameraModule';
import { analyzeHealth } from '../services/geminiService';
import { speak, initAudio } from '../services/ttsService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';
import Modal from './Modal';
import Toast from './Toast';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, setDoc, getDocFromServer } from 'firebase/firestore';

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

const AssessmentFlow: React.FC = () => {
  const [step, setStep] = useState<AssessmentStep | 'HISTORY'>(AssessmentStep.INTRO);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [report, setReport] = useState<BodyReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean, message: string, showRetry?: boolean }>({ isOpen: false, message: '', showRetry: false });
  const [toast, setToast] = useState<{ isVisible: boolean, message: string, type: 'success' | 'error' | 'info' }>({ isVisible: false, message: '', type: 'success' });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [repInputModal, setRepInputModal] = useState<{ isOpen: boolean, step: AssessmentStep | null, dataUrl: string }>({ isOpen: false, step: null, dataUrl: '' });
  const [repCount, setRepCount] = useState<string>('');

  const getStepGuidance = (currentStep: AssessmentStep | 'HISTORY' | 'INTRO') => {
    switch (currentStep) {
      case AssessmentStep.INTRO:
        return "브레인 트레이닝 센터에 오신 것을 환영합니다. AI 신체 밸런스 및 뇌 건강 진단을 시작합니다.";
      case AssessmentStep.USER_INFO:
        return "측정 대상자의 정보를 입력해 주세요.";
      case AssessmentStep.POSTURE_FRONT:
        return "진단 1단계, 정면 신체 균형 측정입니다. 가이드라인에 맞춰 정면 전체 몸이 나오도록 서주세요.";
      case AssessmentStep.POSTURE_SIDE:
        return "진단 2단계, 측면 신체 균형 측정입니다. 수직선에 몸의 중심을 맞추고 옆으로 서주세요.";
      case AssessmentStep.BALANCE_TEST:
        return "노화 테스트 1단계, 눈 감고 한발 서기입니다. 눈을 감고 한 발로 서서 균형을 유지하세요.";
      case AssessmentStep.ARM_RAISE_TEST:
        return "노화 테스트 2단계, 팔 들어 올리기입니다. 팔을 최대한 높이 들어 올려 주세요.";
      case AssessmentStep.FLEXIBILITY_TEST:
        return "노화 테스트 3단계, 유연성 테스트입니다. 무릎을 펴고 상체를 숙여 주세요.";
      case AssessmentStep.STRENGTH_SQUAT:
        return "근력 테스트 1단계, 15초 스쿼트입니다. 15초 동안 스쿼트를 반복하세요.";
      case AssessmentStep.STRENGTH_PUSHUP:
        return "근력 테스트 2단계, 15초 푸시업입니다. 15초 동안 푸시업을 반복하세요.";
      case AssessmentStep.FACE_ANALYSIS:
        return "마지막 단계, 안면 노화도 측정입니다. 얼굴을 원 안에 맞추고 정면을 응시하세요.";
      case AssessmentStep.ANALYZING:
        return "모든 측정이 완료되었습니다. 통합 AI 리포트를 생성 중입니다. 잠시만 기다려 주세요.";
      case AssessmentStep.REPORT:
        return "진단 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.";
      default:
        return "";
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    if (hasStarted && step === AssessmentStep.INTRO) {
      speak("브레인 트레이닝 센터에 오신 것을 환영합니다. AI 신체 밸런스 및 뇌 건강 진단 시스템입니다.");
    }
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  }, [step, hasStarted]);

  const saveRecord = async (rep: BodyReport, imgs: CapturedImage[]) => {
    if (!currentUser) return;
    try {
      // Resize images for storage to stay under the 1MB document limit
      const resizedImages = await Promise.all(imgs.map(async (img) => {
        const resized = {
          step: img.step,
          dataUrl: await resizeImage(img.dataUrl, 200) // Smaller thumbnails for Firestore
        } as CapturedImage;
        
        if (img.reps !== undefined) resized.reps = img.reps;
        if (img.duration !== undefined) resized.duration = img.duration;
        
        return resized;
      }));

      const newRecord: MemberRecord = {
        id: rep.id,
        name: rep.userInfo.name,
        lastTestDate: rep.date,
        report: rep,
        images: resizedImages,
        ownerUid: currentUser.uid
      };
      
      await setDoc(doc(db, 'members', newRecord.id), newRecord);
      setToast({ isVisible: true, message: "진단 결과가 클라우드에 저장되었습니다.", type: 'success' });
      console.log("Record saved successfully to Firestore");
    } catch (error) {
      console.error("Firestore Save Error:", error);
      setToast({ isVisible: true, message: "클라우드 저장에 실패했습니다.", type: 'error' });
    }
  };

  const handleUserSubmit = (info: UserInfo) => {
    setUserInfo(info);
    setStep(AssessmentStep.POSTURE_FRONT);
  };

  const handleCapture = (dataUrl: string, autoReps?: number) => {
    if (step === AssessmentStep.STRENGTH_SQUAT || step === AssessmentStep.STRENGTH_PUSHUP) {
      setRepCount(autoReps !== undefined ? autoReps.toString() : '');
      setRepInputModal({ isOpen: true, step: step as AssessmentStep, dataUrl });
      speak("수고하셨습니다. 방금 하신 운동의 개수를 확인해 주세요.");
      return;
    }
    
    proceedToNextStep(step as AssessmentStep, dataUrl);
  };

  const proceedToNextStep = (currentStep: AssessmentStep, dataUrl: string, reps?: number) => {
    const newImages = [...capturedImages, { step: currentStep, dataUrl, reps }];
    setCapturedImages(newImages);

    const steps = Object.values(AssessmentStep);
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
    }
  };

  const handleRepSubmit = () => {
    if (!repInputModal.step) return;
    const reps = parseInt(repCount, 10) || 0;
    setRepInputModal({ isOpen: false, step: null, dataUrl: '' });
    setRepCount('');
    proceedToNextStep(repInputModal.step, repInputModal.dataUrl, reps);
  };

  const runAnalysis = async (images: CapturedImage[]) => {
    if (!userInfo) return;
    setStep(AssessmentStep.ANALYZING);
    speak("모든 측정이 완료되었습니다. 통합 AI 리포트를 생성 중입니다. 잠시만 기다려 주세요.");
    setIsAnalyzing(true);
    try {
      // For AI analysis, we send slightly larger images than storage but still resized for speed
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 800)
      })));

      const result = await analyzeHealth(userInfo, aiOptimizedImages);
      setReport(result);
      speak("진단 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.");
      
      // Attempt to save to history, but don't crash if it fails
      await saveRecord(result, images);
      
      setStep(AssessmentStep.REPORT);
    } catch (error) {
      console.error("Analysis Error:", error);
      const isQuotaError = error instanceof Error && (error.message.includes('quota') || error.message.includes('429'));
      
      setErrorModal({ 
        isOpen: true, 
        message: isQuotaError 
          ? "현재 AI 분석 요청이 많아 일시적으로 처리가 지연되고 있습니다. 잠시 후 '다시 시도' 버튼을 눌러주세요. 촬영한 사진은 유지됩니다."
          : "분석 중 오류가 발생했습니다. 카메라 조명이 충분한지 확인하시고 다시 시도해 주세요.",
        showRetry: true
      });
      // Stay on ANALYZING step or show a state where they can retry
    } finally {
      setIsAnalyzing(false);
    }
  };

  const retryAnalysis = () => {
    setErrorModal({ isOpen: false, message: '', showRetry: false });
    runAnalysis(capturedImages);
  };

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setToast({ isVisible: true, message: "로그인되었습니다.", type: 'success' });
    } catch (error) {
      console.error("Sign-in Error:", error);
      setToast({ isVisible: true, message: "로그인에 실패했습니다.", type: 'error' });
    }
  };

  const repeatGuidance = () => {
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  };

  const renderContent = () => {
    if (!isAuthReady) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div className="max-w-xl mx-auto text-center py-24 px-6">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-8 text-indigo-600 text-4xl shadow-inner">
            <i className="fas fa-brain"></i>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">브레인 트레이닝 센터</h2>
          <p className="text-slate-500 mb-10 leading-relaxed text-lg italic">
            AI 신체 밸런스 & 뇌 건강 진단 시스템
          </p>
          <button 
            onClick={handleSignIn}
            className="w-full bg-white border border-slate-200 text-slate-600 font-bold py-5 rounded-3xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-xl"
          >
            <i className="fab fa-google text-rose-500"></i>
            구글 계정으로 시작하기
          </button>
        </div>
      );
    }

    if (!hasStarted) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl text-center border border-slate-100">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 text-3xl shadow-lg shadow-indigo-200">
              <i className="fas fa-volume-up"></i>
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-4">음성 안내 활성화</h2>
            <p className="text-slate-500 mb-10 leading-relaxed">
              본 서비스는 원활한 진단을 위해 음성 안내를 제공합니다.<br/>
              아래 버튼을 눌러 진단을 시작해 주세요.
            </p>
            <button 
              onClick={() => {
                setHasStarted(true);
                // Unlock audio context
                initAudio().catch(() => {});
              }}
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all text-xl"
            >
              진단 센터 입장하기
            </button>
          </div>
        </div>
      );
    }

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
          <div className="max-w-xl mx-auto text-center py-16 px-6">
            <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-8 text-indigo-600 text-4xl shadow-inner">
              <i className="fas fa-brain"></i>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">브레인 트레이닝 센터</h2>
            <p className="text-slate-500 mb-10 leading-relaxed text-lg italic">
              AI 신체 밸런스 & 뇌 건강 진단 시스템
            </p>
            <div className="grid grid-cols-1 gap-3 mb-10 text-left">
              <button 
                onClick={() => setStep(AssessmentStep.USER_INFO)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 rounded-3xl shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3"
              >
                신규 진단 시작하기
                <i className="fas fa-chevron-right"></i>
              </button>
              <button 
                onClick={() => setStep('HISTORY')}
                className="w-full bg-white border border-slate-200 text-slate-600 font-bold py-5 rounded-3xl hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <i className="fas fa-users"></i>
                회원 데이터 관리
              </button>
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Powered by Gemini AI Vision
            </div>
          </div>
        );

      case AssessmentStep.USER_INFO:
        return <UserInfoForm onSubmit={handleUserSubmit} />;

      case AssessmentStep.POSTURE_FRONT:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-end">
                <div>
                  <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">진단 1단계</span>
                  <h3 className="text-2xl font-bold text-slate-800">정면 신체 균형</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="front" onCapture={handleCapture} guidelineType="front" autoCapture />
          </div>
        );

      case AssessmentStep.POSTURE_SIDE:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">진단 2단계</span>
                  <h3 className="text-2xl font-bold text-slate-800">측면 신체 균형</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="side" onCapture={handleCapture} guidelineType="side" autoCapture />
          </div>
        );

      case AssessmentStep.BALANCE_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 01</span>
                  <h3 className="text-2xl font-bold text-slate-800">눈 감고 한발 서기</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="balance" onCapture={handleCapture} guidelineType="balance" timerDuration={15} />
          </div>
        );

      case AssessmentStep.ARM_RAISE_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 02</span>
                  <h3 className="text-2xl font-bold text-slate-800">팔 들어 올리기</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="arm" onCapture={handleCapture} guidelineType="arm_raise" />
          </div>
        );

      case AssessmentStep.FLEXIBILITY_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 03</span>
                  <h3 className="text-2xl font-bold text-slate-800">유연성 테스트 (전굴)</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="flex" onCapture={handleCapture} guidelineType="flexibility" />
          </div>
        );

      case AssessmentStep.STRENGTH_SQUAT:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">근력 테스트 01</span>
                  <h3 className="text-2xl font-bold text-slate-800">15초 스쿼트</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="squat" onCapture={handleCapture} guidelineType="squat" timerDuration={15} />
          </div>
        );

      case AssessmentStep.STRENGTH_PUSHUP:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">근력 테스트 02</span>
                  <h3 className="text-2xl font-bold text-slate-800">15초 푸시업</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="pushup" onCapture={handleCapture} guidelineType="pushup" timerDuration={15} />
          </div>
        );

      case AssessmentStep.FACE_ANALYSIS:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                  <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">바이오 스캔</span>
                  <h3 className="text-2xl font-bold text-slate-800">안면 노화도 측정</h3>
                </div>
                <button 
                  onClick={repeatGuidance}
                  className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center hover:bg-indigo-100 transition-all"
                  title="안내 다시 듣기"
                >
                  <i className="fas fa-volume-up"></i>
                </button>
            </div>
            <CameraModule key="face" onCapture={handleCapture} guidelineType="face" />
          </div>
        );

      case AssessmentStep.ANALYZING:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="relative">
              <div className="w-32 h-32 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                <i className="fas fa-fingerprint text-3xl animate-pulse"></i>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mt-8 mb-2">통합 AI 리포트 생성 중</h3>
            <p className="text-slate-400 max-w-xs mx-auto text-sm">데이터를 분석하여 신뢰도 높은 리포트를 구축하고 있습니다. 잠시만 기다려 주세요.</p>
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
                          }} 
                        /> : null;

      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Modal 
        isOpen={errorModal.isOpen}
        title="분석 오류"
        message={errorModal.message}
        onClose={() => {
          setErrorModal({ isOpen: false, message: '', showRetry: false });
          if (!errorModal.showRetry) setStep(AssessmentStep.INTRO);
        }}
      >
        {errorModal.showRetry && (
          <div className="mt-6 flex gap-3">
            <button 
              onClick={() => {
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setStep(AssessmentStep.INTRO);
                setCapturedImages([]);
              }}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
            >
              처음으로
            </button>
            <button 
              onClick={retryAnalysis}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              다시 시도
            </button>
          </div>
        )}
      </Modal>
      <Modal 
        isOpen={repInputModal.isOpen}
        title="운동 횟수 확인"
        message="AI가 측정한 횟수입니다. 정확한 횟수로 수정 후 입력 완료를 눌러주세요."
        onClose={() => {}} // Prevent closing without input
      >
        <div className="mt-4 mb-6">
          <input 
            type="number" 
            value={repCount}
            onChange={(e) => setRepCount(e.target.value)}
            placeholder="예: 12"
            className="w-full text-center text-3xl font-black text-slate-800 py-4 bg-slate-50 border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors"
            autoFocus
          />
        </div>
        <button 
          onClick={handleRepSubmit}
          disabled={!repCount}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          입력 완료
        </button>
      </Modal>
      {renderContent()}
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
};

export default AssessmentFlow;
