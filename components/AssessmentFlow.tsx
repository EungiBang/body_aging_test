
import React, { useState } from 'react';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord } from '../types';
import CameraModule from './CameraModule';
import { analyzeHealth } from '../services/geminiService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';

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

  const saveRecord = async (rep: BodyReport, imgs: CapturedImage[]) => {
    try {
      const saved = localStorage.getItem('bt_records');
      const records: MemberRecord[] = saved ? JSON.parse(saved) : [];
      
      // Resize images for storage to stay under the 5MB limit
      const resizedImages = await Promise.all(imgs.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 300) // Small thumbnails for storage
      })));

      const newRecord: MemberRecord = {
        id: rep.id,
        name: rep.userInfo.name,
        lastTestDate: rep.date,
        report: rep,
        images: resizedImages
      };
      
      records.unshift(newRecord); // Add to beginning of list
      // Keep only last 20 records to manage space
      const limitedRecords = records.slice(0, 20);
      localStorage.setItem('bt_records', JSON.stringify(limitedRecords));
      console.log("Record saved successfully");
    } catch (error) {
      console.warn("Storage failed (likely quota limit):", error);
      // Even if storage fails, we don't block the user from seeing the current report
    }
  };

  const handleUserSubmit = (info: UserInfo) => {
    setUserInfo(info);
    setStep(AssessmentStep.POSTURE_FRONT);
  };

  const handleCapture = (dataUrl: string) => {
    const newImages = [...capturedImages, { step: step as AssessmentStep, dataUrl }];
    setCapturedImages(newImages);

    const steps = Object.values(AssessmentStep);
    const currentIndex = steps.indexOf(step as AssessmentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
    }
  };

  const runAnalysis = async (images: CapturedImage[]) => {
    if (!userInfo) return;
    setStep(AssessmentStep.ANALYZING);
    setIsAnalyzing(true);
    try {
      // For AI analysis, we send slightly larger images than storage but still resized for speed
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 800)
      })));

      const result = await analyzeHealth(userInfo, aiOptimizedImages);
      setReport(result);
      
      // Attempt to save to history, but don't crash if it fails
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
            </div>
            <CameraModule key="front" onCapture={handleCapture} guidelineType="front" autoCapture />
          </div>
        );

      case AssessmentStep.POSTURE_SIDE:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">진단 2단계</span>
                <h3 className="text-2xl font-bold text-slate-800">측면 신체 균형</h3>
            </div>
            <CameraModule key="side" onCapture={handleCapture} guidelineType="side" autoCapture />
          </div>
        );

      case AssessmentStep.BALANCE_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 01</span>
                <h3 className="text-2xl font-bold text-slate-800">눈 감고 한발 서기</h3>
            </div>
            <CameraModule key="balance" onCapture={handleCapture} guidelineType="balance" timerDuration={30} />
          </div>
        );

      case AssessmentStep.ARM_RAISE_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 02</span>
                <h3 className="text-2xl font-bold text-slate-800">팔 들어 올리기</h3>
            </div>
            <CameraModule key="arm" onCapture={handleCapture} guidelineType="flexibility" />
          </div>
        );

      case AssessmentStep.FLEXIBILITY_TEST:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-rose-600 font-bold text-xs uppercase tracking-widest">노화 테스트 03</span>
                <h3 className="text-2xl font-bold text-slate-800">유연성 테스트 (전굴)</h3>
            </div>
            <CameraModule key="flex" onCapture={handleCapture} guidelineType="flexibility" />
          </div>
        );

      case AssessmentStep.STRENGTH_SQUAT:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">근력 테스트 01</span>
                <h3 className="text-2xl font-bold text-slate-800">30초 스쿼트</h3>
            </div>
            <CameraModule key="squat" onCapture={handleCapture} guidelineType="squat" timerDuration={30} />
          </div>
        );

      case AssessmentStep.STRENGTH_PUSHUP:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-emerald-600 font-bold text-xs uppercase tracking-widest">근력 테스트 02</span>
                <h3 className="text-2xl font-bold text-slate-800">30초 푸시업</h3>
            </div>
            <CameraModule key="pushup" onCapture={handleCapture} guidelineType="pushup" timerDuration={30} />
          </div>
        );

      case AssessmentStep.FACE_ANALYSIS:
        return (
          <div className="flex-1 flex flex-col p-6 overflow-auto">
            <div className="mb-6">
                <span className="text-indigo-600 font-bold text-xs uppercase tracking-widest">바이오 스캔</span>
                <h3 className="text-2xl font-bold text-slate-800">안면 노화도 측정</h3>
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

  return <div className="flex-1 flex flex-col">{renderContent()}</div>;
};

export default AssessmentFlow;
