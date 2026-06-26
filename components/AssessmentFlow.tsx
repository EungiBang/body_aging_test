/// <reference types="vite/client" />
import React, { useState, useEffect, useCallback } from 'react';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord, BrainTestData, PendingAssessment } from '../types';
import pkg from '../package.json';
import CameraModule from './CameraModule';
import { analyzeHealth } from '../services/geminiService';
import { speak, initAudio, stopSpeaking } from '../services/ttsService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';
import Modal from './Modal';
import Toast from './Toast';
import { logUsage } from '../services/statsService';
import { SystemCheckOverlay } from './SystemCheckOverlay';
import { saveRecordLocally, deleteRecordLocally, savePendingAssessment, getLatestPendingAssessment, deletePendingAssessment } from '../services/localDb';
import BrainTestModule from './BrainTestModule';
import { TmtBrainTestModule } from './TmtBrainTestModule';
import { SevenCodeChecklist } from './SevenCodeChecklist';
import KFaceApp from './KFaceApp';
import KTarotApp from './KTarotApp';
import logger from '../utils/logger';

const resizeImage = (dataUrl: string, maxWidth = 400): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve('');
      return;
    }
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
    img.onerror = () => {
      console.warn('Image loading failed in resizeImage');
      resolve(dataUrl); // Resolve with original dataUrl on error to prevent hang
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
  const [hasStarted, setHasStarted] = useState(false);
  const [showSysCheck, setShowSysCheck] = useState(false);
  const [repInputModal, setRepInputModal] = useState<{ isOpen: boolean, step: AssessmentStep | null, dataUrl: string, formScore?: number, kneeAssisted?: boolean, postureData?: any }>({ isOpen: false, step: null, dataUrl: '' });
  const [repCount, setRepCount] = useState<string>('');
  const [manualRepPosture, setManualRepPosture] = useState<string>('보통');
  // 균형 테스트 수동 입력 모달
  const [balanceInputModal, setBalanceInputModal] = useState<{ isOpen: boolean, dataUrl: string, aiFootDrops: number, aiSwayScore: number }>({ isOpen: false, dataUrl: '', aiFootDrops: 0, aiSwayScore: 0 });
  const [manualFootDrops, setManualFootDrops] = useState<string>('0');
  const [manualSwayLevel, setManualSwayLevel] = useState<string>('3'); // 1~5 scale

  // 팔 올리기 수동 확인 모달
  const [armRaiseInputModal, setArmRaiseInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualArmRaiseGrade, setManualArmRaiseGrade] = useState<string>('');

  // 유연성 수동 확인 모달
  const [flexInputModal, setFlexInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualFlexGrade, setManualFlexGrade] = useState<string>('');

  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [resumePendingData, setResumePendingData] = useState<PendingAssessment | null>(null); // 이어하기 데이터
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSelect, setShowDeviceSelect] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(true); // 균형 테스트 눈 상태 (기본: 눈 감음)
  // 사진 확인(미리보기) 상태 (originalDataUrl: Gemini 분석용 원본, dataUrl: 화면 표시용/합성 가능)
  const [previewData, setPreviewData] = useState<{ dataUrl: string; originalDataUrl: string; metadata?: any; validationResult?: { passed: boolean; message: string } | null } | null>(null);
  const [targetStepAfterUserInfo, setTargetStepAfterUserInfo] = useState<AssessmentStep | null>(null);

  // logger Toast 이벤트 수신 — 에러/상태를 화면에 표시
  useEffect(() => {
    const handleLoggerToast = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail;
      setToast({ isVisible: true, message, type });
    };
    window.addEventListener('logger:toast', handleLoggerToast);
    return () => window.removeEventListener('logger:toast', handleLoggerToast);
  }, []);

  // 가상 카메라 필터 키워드 (CameraModule과 동일)
  const VIRTUAL_CAM_KEYWORDS = [
    'obs', 'virtual', 'manycam', 'xsplit', 'snap camera', 'droidcam',
    'iriun', 'epoccam', 'newtek', 'ndi', 'camtwist', 'mmhmm',
    'logi capture', 'streamlabs', 'prism', 'e2esoft', 'vcam',
    'splitcam', 'sparkocam', 'youcam', 'cyberlink', 'fake',
  ];

  useEffect(() => {
    const getDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        // 가상 카메라 제외
        const physicalDevices = videoDevices.filter(d => {
          const label = (d.label || '').toLowerCase();
          if (!label) return true;
          return !VIRTUAL_CAM_KEYWORDS.some(keyword => label.includes(keyword));
        });
        setDevices(physicalDevices);
        logger.info('Flow', `카메라 감지: ${physicalDevices.length}대 (가상 ${videoDevices.length - physicalDevices.length}대 제외)`);
      } catch (err) {
        logger.error('Flow', '카메라 열거 실패', err);
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  // ★ v4.2.6: 앱 시작 시 미완료 측정(pending) 데이터 확인 → 이어하기 제안
  useEffect(() => {
    const checkPending = async () => {
      try {
        const pending = await getLatestPendingAssessment();
        if (pending && pending.capturedImages.length > 0) {
          logger.info('Flow', `이어하기 가능: ${pending.userName} ${pending.completedStepCount}단계 완료, ${pending.currentStep}`);
          setResumePendingData(pending);
        }
      } catch (e) {
        logger.warn('Flow', 'pending 확인 실패', e);
      }
    };
    checkPending();
  }, []);

  const getStepGuidance = (currentStep: AssessmentStep | 'HISTORY' | 'INTRO') => {
    switch (currentStep) {
      case AssessmentStep.INTRO:
        return "AI 신체 균형 및 건강 상태 측정 시스템입니다.";
      case AssessmentStep.USER_INFO:
        return "측정 대상자의 정보를 입력해 주세요.";
      case AssessmentStep.POSTURE_FRONT:
        return "정면 전체 몸이 나오도록 서주세요.";
      case AssessmentStep.POSTURE_SIDE:
        return "옆으로 서서 몸의 중심을 맞춰주세요.";
      case AssessmentStep.BALANCE_TEST:
        return "눈을 감고 한 발로 서서 균형을 유지하세요.";
      case AssessmentStep.ARM_RAISE_TEST:
        return "팔을 최대한 높이 들어 올려 주세요.";
      case AssessmentStep.FLEXIBILITY_TEST:
        return "무릎을 펴고 상체를 숙여 주세요.";
      case AssessmentStep.STRENGTH_SQUAT:
        return "측면으로 서주세요. 15초 동안 스쿼트를 반복하세요.";
      case AssessmentStep.STRENGTH_PUSHUP:
        return "대각선으로 서주세요. 15초 동안 푸시업을 반복하세요.";
      case AssessmentStep.BRAIN_REACTION:
        return ""; // TmtBrainTestModule 내부에서 직접 재생하도록 비워둠
      case AssessmentStep.BRAIN_MEMORY:
        return "10초 동안 장볼 물건들을 기억하고, 손으로 골라 담아주세요.";
      case AssessmentStep.FACE_ANALYSIS:
        return "안경과 마스크는 벗어주세요. 조명을 더 밝게 해도 좋습니다. 얼굴을 카메라에 가까이 대고 정면을 응시하세요.";
      case AssessmentStep.SEVEN_CODE_CHECK:
        return "해당하는 문항을 선택해 주세요.";
      case AssessmentStep.ANALYZING:
        return "통합 AI 리포트를 생성 중입니다.";
      case AssessmentStep.REPORT:
        return "측정 결과를 확인해 보세요.";
      default:
        return "";
    }
  };

  useEffect(() => {
    const handleNavHome = () => {
      setTargetStepAfterUserInfo(null);
      setCapturedImages([]);
      setUserInfo(null);
      setReport(null);
      setStep(AssessmentStep.INTRO);
    };
    const handleNavHistory = () => {
      setTargetStepAfterUserInfo(null);
      setCapturedImages([]);
      setUserInfo(null);
      setReport(null);
      setStep('HISTORY');
    };
    const handleNavKFace = () => {
      setCapturedImages([]);
      setReport(null);
      if (!userInfo) {
        setTargetStepAfterUserInfo(AssessmentStep.KFACE);
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(AssessmentStep.KFACE);
    };
    const handleNavKTarot = () => {
      setCapturedImages([]);
      setReport(null);
      if (!userInfo) {
        setTargetStepAfterUserInfo(AssessmentStep.KTAROT);
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(AssessmentStep.KTAROT);
    };

    window.addEventListener('nav:home', handleNavHome);
    window.addEventListener('nav:history', handleNavHistory);
    window.addEventListener('nav:kface', handleNavKFace);
    window.addEventListener('nav:ktarot', handleNavKTarot);

    return () => {
      window.removeEventListener('nav:home', handleNavHome);
      window.removeEventListener('nav:history', handleNavHistory);
      window.removeEventListener('nav:kface', handleNavKFace);
      window.removeEventListener('nav:ktarot', handleNavKTarot);
    };
  }, [userInfo]);

  useEffect(() => {
    // Only handle other startup tasks here, the TTS for intro is handled by getStepGuidance in the other useEffect
  }, [hasStarted]);

  // 테스트 진행 중에는 Layout 헤더/푸터를 숨김
  const testSteps = [
    AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE,
    AssessmentStep.BALANCE_TEST, AssessmentStep.ARM_RAISE_TEST, AssessmentStep.FLEXIBILITY_TEST,
    AssessmentStep.STRENGTH_SQUAT, AssessmentStep.STRENGTH_PUSHUP,
    AssessmentStep.BRAIN_REACTION, AssessmentStep.BRAIN_MEMORY,
    AssessmentStep.FACE_ANALYSIS, AssessmentStep.SEVEN_CODE_CHECK, AssessmentStep.ANALYZING
  ];
  useEffect(() => {
    const isTest = testSteps.includes(step as AssessmentStep);
    window.dispatchEvent(new CustomEvent('test:mode', { detail: { active: isTest } }));
  }, [step]);

  useEffect(() => {
    if (!hasStarted) return;
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  }, [step, hasStarted]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === AssessmentStep.ANALYZING) {
      setAnalyzeProgress(0);
      const startTime = Date.now();
      interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setAnalyzeProgress(prev => {
          // 0~30초: 0→70%, 30~60초: 70→90%, 60~90초: 90→96%, 90~120초: 96→99%
          if (elapsed < 30) return Math.min(prev + 2.0, 70);
          if (elapsed < 60) return Math.min(prev + 0.6, 90);
          if (elapsed < 90) return Math.min(prev + 0.2, 96);
          return Math.min(prev + 0.1, 99);
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [step]);

  const saveRecord = async (rep: BodyReport, imgs: CapturedImage[]) => {
    try {
      // Resize images for storage to stay under the 1MB document limit
      const resizedImages = await Promise.all(imgs.map(async (img) => {
        const resized = {
          step: img.step,
          dataUrl: await resizeImage(img.dataUrl, 200) // Smaller thumbnails
        } as CapturedImage;
        
        if (img.reps !== undefined)         resized.reps = img.reps;
        if (img.duration !== undefined)      resized.duration = img.duration;
        if (img.formScore !== undefined)     resized.formScore = img.formScore;
        if (img.kneeAssisted !== undefined)  resized.kneeAssisted = img.kneeAssisted;
        if (img.balanceData !== undefined)   resized.balanceData = img.balanceData;
        if (img.brainTestData !== undefined) resized.brainTestData = img.brainTestData;
        if (img.postureData !== undefined)   resized.postureData = img.postureData;
        if (img.sevenCodeKeywords !== undefined) resized.sevenCodeKeywords = img.sevenCodeKeywords;
        if (img.weakestCode !== undefined)   resized.weakestCode = img.weakestCode;
        
        return resized;
      }));

      const newRecord: MemberRecord = {
        id: rep.id,
        name: rep.userInfo.name,
        lastTestDate: rep.date,
        report: rep,
        images: resizedImages,
        ownerUid: 'local-branch'
      };
      
      const success = await saveRecordLocally(newRecord);
      if (success) {
        setToast({ isVisible: true, message: "분석 결과가 기기에 안전하게 저장되었습니다.", type: 'success' });
        
        // 사용량 통계 로깅
        try {
          const deviceStr = localStorage.getItem('currentDevice');
          if (deviceStr) {
            const device = JSON.parse(deviceStr);
            if (device.branchId && device.id) {
              logUsage(device.branchId, device.id).catch(console.error);
            }
          }
        } catch (e) {
          console.error('Failed to log usage:', e);
        }

      } else {
        setToast({ isVisible: true, message: "분석 결과 저장에 실패했습니다.", type: 'error' });
      }
    } catch (error) {
      console.error("Local DB Save Error:", error);
      setToast({ isVisible: true, message: "결과 저장 중 오류가 발생했습니다.", type: 'error' });
    }
  };

  const handleUserSubmit = async (info: UserInfo) => {
    setUserInfo(info);

    // ★ v4.2.6: 측정 시작 시 pending 레코드 생성 (단계별 DB 저장의 시작점)
    const newPendingId = 'pending-' + Date.now().toString(36);
    setPendingRecordId(newPendingId);
    try {
      await savePendingAssessment({
        id: newPendingId,
        userName: info.name,
        userInfo: info,
        currentStep: AssessmentStep.POSTURE_FRONT,
        capturedImages: [],
        completedStepCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      logger.info('Flow', `pending 생성: ${newPendingId} (${info.name})`);
    } catch (e) {
      logger.warn('Flow', 'pending 생성 실패 (측정은 계속 진행)', e);
    }

    if (targetStepAfterUserInfo) {
      setStep(targetStepAfterUserInfo);
      setTargetStepAfterUserInfo(null);
    } else {
      setStep(AssessmentStep.POSTURE_FRONT);
    }
  };

  const handleCapture = (dataUrl: string, autoReps?: number, metadata?: any) => {
    // autoReps(number)와 metadata(object)를 하나의 객체로 병합하여 저장
    const mergedMetadata = { ...metadata, reps: autoReps };
    // 촬영 후 미리보기 화면으로 전환 (originalDataUrl은 Gemini 분석용 원본 보존)
    setPreviewData({ dataUrl, originalDataUrl: dataUrl, metadata: mergedMetadata, validationResult: null });
    speak("촬영이 완료되었습니다.");

    // 사후 검증: 1, 2, 4, 5단계(정지 촬영)에서만 전신 체크
    const requiresValidation = [
      AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE,
      AssessmentStep.ARM_RAISE_TEST, AssessmentStep.FLEXIBILITY_TEST
    ].includes(step as AssessmentStep);

    if (requiresValidation) {
      // 캡처된 이미지를 캔버스에 그려서 MoveNet으로 검증
      const img = new Image();
      img.onload = async () => {
        try {
          // v4.2.6: iGPU 호환성 강화 — 다운스케일 + CPU fallback 적용
          const { estimatePosesFromImage } = await import('../hooks/usePoseEstimation');
          
          // ★ v4.2.6: img를 직접 전달 — estimatePosesFromImage 내부에서 다운스케일+fallback 처리
          // (기존: 원본 해상도 canvas를 만들어 전달 → iGPU 과부하로 score=0)
          const poses = await estimatePosesFromImage(img);
          
          // 오버레이 합성용 원본 캔버스
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          
          if (poses.length > 0) {
            const kps = poses[0].keypoints;
            const visibleCount = kps.filter(kp => (kp.score || 0) > 0.25).length;
            
            // 몸통 관절 필수 확인 (얼굴만으로는 통과 불가)
            const bodyPartNames = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle'];
            const visibleBodyParts = kps.filter(kp => bodyPartNames.includes(kp.name || '') && (kp.score || 0) > 0.3);
            const hasShoulder = kps.some(kp => (kp.name === 'left_shoulder' || kp.name === 'right_shoulder') && (kp.score || 0) > 0.3);
            const hasHip = kps.some(kp => (kp.name === 'left_hip' || kp.name === 'right_hip') && (kp.score || 0) > 0.3);
            
            // 어깨+엉덩이 필수 (단, 팔올리기 및 유연성은 엉덩이가 안 보여도 허용)
            const needsHip = step === AssessmentStep.POSTURE_FRONT || step === AssessmentStep.POSTURE_SIDE;
            const hasRequiredParts = hasShoulder && (!needsHip || hasHip);
            
            if (hasRequiredParts) {
              
              // ★ 자세 검증: 관절 위치로 "올바른 자세"인지 확인 (관절 수만으로는 부족)
              const getKpCheck = (name: string) => kps.find(kp => kp.name === name);
              const lSh = getKpCheck('left_shoulder'), rSh = getKpCheck('right_shoulder');
              const lHp = getKpCheck('left_hip'), rHp = getKpCheck('right_hip');
              const lKn = getKpCheck('left_knee'), rKn = getKpCheck('right_knee');
              const lAn = getKpCheck('left_ankle'), rAn = getKpCheck('right_ankle');
              
              // 현재 단계에 따른 자세 검증
              const currentStep = step;
              let postureError = '';
              
              // === 직립 확인: 유연성(숙임) 제외 ===
              if (currentStep !== AssessmentStep.FLEXIBILITY_TEST) {
                const shoulderY = ((lSh?.y || 0) + (rSh?.y || 0)) / (lSh && rSh ? 2 : 1);
                const hipY = ((lHp?.y || 0) + (rHp?.y || 0)) / (lHp && rHp ? 2 : 1);
                
                if (shoulderY > 0 && hipY > 0) {
                  // 어깨가 엉덩이보다 아래에 있으면 → 앉거나 누워있음
                  if (shoulderY > hipY) {
                    postureError = '바르게 서 있지 않습니다. 일어서서 촬영해 주세요.';
                  }
                  // 어깨~엉덩이 거리가 너무 작으면 → 상체만 보이거나 너무 구부림 (팔 올리기는 상체만 보여도 허용)
                  const torsoHeight = Math.abs(hipY - shoulderY);
                  const imgH = canvas.height;
                  if (torsoHeight < imgH * 0.08 && currentStep !== AssessmentStep.ARM_RAISE_TEST) {
                    postureError = '상체가 너무 구부러져 있습니다. 바르게 서 주세요.';
                  }
                }
              }
              
              // === 정면 촬영 시: 양쪽 어깨/엉덩이 모두 보여야 함 ===
              if (!postureError && currentStep === AssessmentStep.POSTURE_FRONT) {
                const hasLeftSh = lSh && (lSh.score || 0) > 0.3;
                const hasRightSh = rSh && (rSh.score || 0) > 0.3;
                const hasLeftHp = lHp && (lHp.score || 0) > 0.3;
                const hasRightHp = rHp && (rHp.score || 0) > 0.3;
                
                if (!hasLeftSh || !hasRightSh || !hasLeftHp || !hasRightHp) {
                  postureError = '정면이 아닙니다. 카메라를 정면으로 바라보고 서 주세요.';
                } else {
                  // 양쪽 어깨 너비가 좌우 대칭인지 (한쪽으로 돌아서면 너비차 큼)
                  const shoulderWidth = Math.abs((lSh?.x || 0) - (rSh?.x || 0));
                  const hipWidth = Math.abs((lHp?.x || 0) - (rHp?.x || 0));
                  if (shoulderWidth > 0 && hipWidth > 0) {
                    // 어깨 너비가 엉덩이의 20% 미만이면 측면일 가능성
                    if (shoulderWidth < hipWidth * 0.4) {
                      postureError = '정면이 아닌 것 같습니다. 카메라를 정면으로 바라봐 주세요.';
                    }
                  }
                }
              }
              
              // === 측면 촬영: 사용자 요청에 따라 검증 완전 삭제 (무조건 통과) ===
              if (!postureError && currentStep === AssessmentStep.POSTURE_SIDE) {
                // 측면 판정 로직을 없애서 어떤 각도든 사용자가 찍으면 넘어가도록 허용
              }
              
              if (postureError) {
                setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: postureError } } : null);
                speak(postureError);
                return;
              }

              // === 자세 검증 통과 → AI 분석 오버레이 합성 ===
              const w = canvas.width;
              const h = canvas.height;
              const getKp = (name: string) => kps.find(kp => kp.name === name);
              
              // 반투명 어두운 오버레이
              ctx.fillStyle = 'rgba(0, 10, 30, 0.25)';
              ctx.fillRect(0, 0, w, h);
              
              // 스캔라인 효과 (수평 줄무늬)
              ctx.strokeStyle = 'rgba(0, 255, 200, 0.04)';
              ctx.lineWidth = 1;
              for (let y = 0; y < h; y += 4) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
              }
              
              // 뼈대 연결선 정의 (MoveNet 17 keypoints)
              const connections = [
                ['left_shoulder', 'right_shoulder'],
                ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
                ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
                ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
                ['left_hip', 'right_hip'],
                ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
                ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
                ['nose', 'left_eye'], ['nose', 'right_eye'],
                ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
              ];
              
              // 뼈대 연결선 그리기 (네온 그린 글로우)
              connections.forEach(([a, b]) => {
                const kpA = getKp(a);
                const kpB = getKp(b);
                if (kpA && kpB && (kpA.score || 0) > 0.15 && (kpB.score || 0) > 0.15) {
                  // 글로우 효과
                  ctx.save();
                  ctx.shadowColor = 'rgba(0, 255, 170, 0.8)';
                  ctx.shadowBlur = 12;
                  ctx.strokeStyle = 'rgba(0, 255, 170, 0.7)';
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.moveTo(kpA.x, kpA.y);
                  ctx.lineTo(kpB.x, kpB.y);
                  ctx.stroke();
                  ctx.restore();
                  
                  // 안쪽 밝은 선
                  ctx.strokeStyle = 'rgba(180, 255, 230, 0.9)';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(kpA.x, kpA.y);
                  ctx.lineTo(kpB.x, kpB.y);
                  ctx.stroke();
                }
              });
              
              // 관절 포인트 그리기
              kps.forEach(kp => {
                if ((kp.score || 0) > 0.15) {
                  // 외곽 글로우
                  ctx.save();
                  ctx.shadowColor = 'rgba(0, 200, 255, 0.9)';
                  ctx.shadowBlur = 15;
                  ctx.fillStyle = 'rgba(0, 200, 255, 0.8)';
                  ctx.beginPath();
                  ctx.arc(kp.x, kp.y, 6, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.restore();
                  
                  // 내부 밝은 점
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                  ctx.beginPath();
                  ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
                  ctx.fill();
                }
              });
              
              // --- 어깨 수평선 ---
              const lShoulder = getKp('left_shoulder');
              const rShoulder = getKp('right_shoulder');
              if (lShoulder && rShoulder && (lShoulder.score || 0) > 0.2 && (rShoulder.score || 0) > 0.2) {
                ctx.save();
                ctx.setLineDash([8, 6]);
                ctx.strokeStyle = 'rgba(255, 200, 50, 0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(lShoulder.x - 30, lShoulder.y);
                ctx.lineTo(rShoulder.x + 30, rShoulder.y);
                ctx.stroke();
                ctx.restore();
                
                // 어깨 기울기 각도 계산
                const shoulderAngle = Math.abs(Math.atan2(rShoulder.y - lShoulder.y, rShoulder.x - lShoulder.x) * (180 / Math.PI));
                const midX = (lShoulder.x + rShoulder.x) / 2;
                const midY = Math.min(lShoulder.y, rShoulder.y) - 25;
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
                ctx.textAlign = 'center';
                ctx.fillText(`${shoulderAngle.toFixed(1)}°`, midX, midY);
              }
              
              // --- 골반 수평선 ---
              const lHip = getKp('left_hip');
              const rHip = getKp('right_hip');
              if (lHip && rHip && (lHip.score || 0) > 0.2 && (rHip.score || 0) > 0.2) {
                ctx.save();
                ctx.setLineDash([8, 6]);
                ctx.strokeStyle = 'rgba(255, 100, 100, 0.7)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(lHip.x - 30, lHip.y);
                ctx.lineTo(rHip.x + 30, rHip.y);
                ctx.stroke();
                ctx.restore();
                
                const hipAngle = Math.abs(Math.atan2(rHip.y - lHip.y, rHip.x - lHip.x) * (180 / Math.PI));
                const hipMidX = (lHip.x + rHip.x) / 2;
                const hipMidY = Math.max(lHip.y, rHip.y) + 20;
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = 'rgba(255, 100, 100, 0.9)';
                ctx.textAlign = 'center';
                ctx.fillText(`${hipAngle.toFixed(1)}°`, hipMidX, hipMidY);
              }
              
              // --- 중심 대칭축 (세로선) ---
              const nose = getKp('nose');
              if (nose && (nose.score || 0) > 0.2) {
                const centerX = nose.x;
                const topY = Math.max(0, nose.y - 40);
                const bottomY = Math.min(h, (lHip?.y || h * 0.7) + 100);
                
                ctx.save();
                ctx.setLineDash([12, 8]);
                ctx.strokeStyle = 'rgba(100, 150, 255, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(centerX, topY);
                ctx.lineTo(centerX, bottomY);
                ctx.stroke();
                ctx.restore();
              }
              
              // --- 하단 분석 정보 바 ---
              const barH = 40;
              ctx.fillStyle = 'rgba(0, 10, 30, 0.85)';
              ctx.fillRect(0, h - barH, w, barH);
              
              // 구분선
              ctx.strokeStyle = 'rgba(0, 255, 170, 0.5)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, h - barH);
              ctx.lineTo(w, h - barH);
              ctx.stroke();
              
              ctx.font = 'bold 13px monospace';
              ctx.fillStyle = 'rgba(0, 255, 170, 0.9)';
              ctx.textAlign = 'left';
              ctx.fillText(`BODY SCAN · ${visibleCount}/17 joints`, 12, h - 14);
              
              ctx.textAlign = 'right';
              ctx.fillStyle = 'rgba(100, 200, 255, 0.9)';
              ctx.fillText('BTC 3-BODY AI ANALYZER', w - 12, h - 14);

              // 합성된 이미지로 교체
              const analyzedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              setPreviewData(prev => prev ? { ...prev, dataUrl: analyzedDataUrl, validationResult: { passed: true, message: `AI가 ${visibleCount}개 관절을 인식했습니다. 분석에 적합합니다.` } } : null);
            } else {
              setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '내장 그래픽 환경으로 인해 뼈대 일부가 누락되었을 수 있습니다. 화면에 전신이 잘 나왔다면 수동으로 다음 단계를 진행하세요. (최종 분석 정상 진행)' } } : null);
              // speak("뼈대 인식이 일부 누락되었습니다. 화면에 전신이 잘 나왔다면 수동으로 다음 단계를 진행해주세요.");
            }
          } else {
            // Thunder 모델도 감지하지 못할 경우, 강제로 수동 패스할 수 있도록 안내 (차단하지 않음)
            setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: 'AI가 뼈대를 그리지 못했으나 (내장 그래픽 환경), 화면에 전신이 잘 나왔다면 다음 단계를 눌러주세요. 최종 정밀 분석은 100% 정상 작동합니다.' } } : null);
            // speak("내장 그래픽 환경입니다. 화면에 전신이 잘 나왔다면 다음 단계를 눌러주세요.");
          }
        } catch (err) {
          console.error('Post-capture validation error:', err);
          // 검증 실패 시 그냥 통과시킴
          setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
        }
      };
      img.src = dataUrl;
    } else {
      // 검증이 필요 없는 단계는 바로 통과
      setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
    }
  };

  // 미리보기에서 '확인' → 다음 단계로 진행
  const confirmCapture = () => {
    if (!previewData) return;
    // Gemini 분석에는 원본 이미지(originalDataUrl), 화면 표시에는 합성 이미지(dataUrl) 사용
    const { originalDataUrl, metadata: mergedMeta } = previewData;
    setPreviewData(null);

    let reps: number | undefined;
    let footDrops: number | undefined;
    let swayScore: number | undefined;
    let formScore: number | undefined;
    let kneeAssisted: boolean | undefined;
    let eyesClosedVal: boolean | undefined;
    let postureData: any;
    
    if (mergedMeta && typeof mergedMeta === 'object') {
      reps = mergedMeta.reps;
      footDrops = mergedMeta.footDrops;
      swayScore = mergedMeta.swayScore;
      formScore = mergedMeta.formScore;
      kneeAssisted = mergedMeta.kneeAssisted;
      postureData = mergedMeta.postureData;
      if (step === AssessmentStep.BALANCE_TEST) {
        eyesClosedVal = eyesClosed;
      }
    }
    
    // 균형 테스트 단계에서는 수동 입력 모달 표시
    if (step === AssessmentStep.BALANCE_TEST) {
      setManualFootDrops(String(footDrops || 0));
      setManualSwayLevel(String(Math.min(5, Math.max(1, Math.round((swayScore || 0) / 20) + 1))));
      setBalanceInputModal({ isOpen: true, dataUrl: originalDataUrl, aiFootDrops: footDrops || 0, aiSwayScore: swayScore || 0 });
      return;
    }

    // 스쿼트/푸시업 단계에서는 수동 횟수 입력 모달 표시 (formScore, kneeAssisted, postureData 보존)
    if (step === AssessmentStep.STRENGTH_SQUAT || step === AssessmentStep.STRENGTH_PUSHUP) {
      setRepCount(String(reps || 0));
      setRepInputModal({ isOpen: true, step: step as AssessmentStep, dataUrl: originalDataUrl, formScore, kneeAssisted, postureData });
      return;
    }

    // 팔 올리기 단계 (수동 확인 모달)
    if (step === AssessmentStep.ARM_RAISE_TEST) {
      const defaultGrade = postureData?.armRaiseGrade || '보통 (135도)';
      setManualArmRaiseGrade(defaultGrade);
      setArmRaiseInputModal({ isOpen: true, dataUrl: originalDataUrl, postureData });
      return;
    }

    // 유연성 단계 (수동 확인 모달)
    if (step === AssessmentStep.FLEXIBILITY_TEST) {
      const defaultGrade = postureData?.flexGrade || '보통 (정강이 중간)';
      setManualFlexGrade(defaultGrade);
      setFlexInputModal({ isOpen: true, dataUrl: originalDataUrl, postureData });
      return;
    }
    
    proceedToNextStep(step as AssessmentStep, originalDataUrl, reps, footDrops, swayScore, formScore, eyesClosedVal, kneeAssisted, postureData);
  };

  // 미리보기에서 '재촬영' → 미리보기 닫고 현재 단계 유지
  const retakeCapture = () => {
    setPreviewData(null);
    speak("다시 촬영합니다. 준비해 주세요.");
  };

  const proceedToNextStep = (currentStep: AssessmentStep, dataUrl: string, reps?: number, footDrops?: number, swayScore?: number, formScore?: number, eyesClosedVal?: boolean, kneeAssisted?: boolean, postureData?: any, brainTestData?: BrainTestData) => {
    const newImage: CapturedImage = { step: currentStep, dataUrl, reps, formScore, postureData };
    if (brainTestData) {
      newImage.brainTestData = brainTestData;
    }
    if (footDrops !== undefined && swayScore !== undefined) {
      newImage.balanceData = { footDrops, swayScore, eyesClosed: eyesClosedVal ?? true };
    }
    if (kneeAssisted !== undefined) {
      newImage.kneeAssisted = kneeAssisted;
    }
    const newImages = [...capturedImages, newImage];
    setCapturedImages(newImages);

    // ★ v4.2.6: 매 단계 완료 시 IndexedDB에 임시 저장 (크래시 복구용)
    if (pendingRecordId && userInfo) {
      const saveToDb = async () => {
        try {
          // 400px 중간 해상도로 리사이즈 (AI 분석 가능 + 용량 절약)
          const resizedImages = await Promise.all(newImages.map(async (img) => ({
            ...img,
            dataUrl: img.dataUrl ? await resizeImage(img.dataUrl, 400) : ''
          })));
          await savePendingAssessment({
            id: pendingRecordId,
            userName: userInfo.name,
            userInfo,
            currentStep,
            capturedImages: resizedImages,
            completedStepCount: newImages.length,
            createdAt: '', // 기존 값 유지 (put으로 업데이트)
            updatedAt: new Date().toISOString(),
          });
          logger.debug('Flow', `단계별 DB 저장: ${currentStep} (${newImages.length}단계 완료)`);
        } catch (e) {
          logger.warn('Flow', '단계별 DB 저장 실패 (측정은 계속 진행)', e);
        }
      };
      saveToDb(); // 비동기 실행, 다음 단계 진행을 블록하지 않음
    }

    const steps = Object.values(AssessmentStep);
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep === AssessmentStep.SEVEN_CODE_CHECK) {
      setStep(AssessmentStep.SEVEN_CODE_CHECK);
      speak("마지막 측정 11단계, 7코드 건강 점검입니다. 화면에 나타나는 문항 중 본인에게 해당하는 것을 선택해 주세요.");
    } else if (nextStep === AssessmentStep.READY_FOR_ANALYSIS) {
      setStep(nextStep as AssessmentStep);
      speak("모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.");
    } else if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
    }
  };

  const handleSevenCodeComplete = (data: { sevenCodeKeywords: string[]; weakestCode: number }) => {
    // Save 7code results to the last captured image or just create a dummy one for step 11
    const newImage: CapturedImage = {
      step: AssessmentStep.SEVEN_CODE_CHECK,
      dataUrl: '', // No actual image needed for this step
      sevenCodeKeywords: data.sevenCodeKeywords,
      weakestCode: data.weakestCode
    };
    const newImages = [...capturedImages, newImage];
    setCapturedImages(newImages);

    // ★ v4.2.6: 7코드 결과도 DB에 저장
    if (pendingRecordId && userInfo) {
      savePendingAssessment({
        id: pendingRecordId,
        userName: userInfo.name,
        userInfo,
        currentStep: AssessmentStep.SEVEN_CODE_CHECK,
        capturedImages: newImages, // 7코드는 이미지 없으므로 리사이즈 불필요
        completedStepCount: newImages.length,
        createdAt: '',
        updatedAt: new Date().toISOString(),
      }).catch(e => logger.warn('Flow', '7코드 DB 저장 실패', e));
    }
    
    setStep(AssessmentStep.READY_FOR_ANALYSIS);
    speak("모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.");
  };

  const handleRepSubmit = () => {
    if (!repInputModal.step) return;
    const reps = parseInt(repCount, 10) || 0;
    const { step: modalStep, dataUrl, formScore: fs, kneeAssisted: ka, postureData: pd } = repInputModal;
    setRepInputModal({ isOpen: false, step: null, dataUrl: '' });
    setRepCount('');

    let manualFormScore = fs || 80;
    if (manualRepPosture === '완벽') manualFormScore = 100;
    else if (manualRepPosture === '우수') manualFormScore = 85;
    else if (manualRepPosture === '보통') manualFormScore = 60;
    else if (manualRepPosture === '보완필요') manualFormScore = 40;

    const pdWithManual = { ...pd, manualPosture: manualRepPosture };

    // formScore, kneeAssisted, postureData를 함께 전달하여 유실 방지
    proceedToNextStep(modalStep!, dataUrl, reps, undefined, undefined, manualFormScore, undefined, ka, pdWithManual);
    setManualRepPosture('보통');
  };

  // 균형 테스트 수동 입력 완료
  const handleBalanceSubmit = () => {
    const fd = parseInt(manualFootDrops, 10) || 0;
    // swayLevel(1~5) → swayScore(0~100) 변환: 1=아주안정(0), 2=안정(20), 3=보통(40), 4=불안정(60), 5=매우불안정(80+)
    const sl = parseInt(manualSwayLevel, 10) || 3;
    const convertedSwayScore = Math.max(0, (sl - 1) * 20);
    setBalanceInputModal({ isOpen: false, dataUrl: '', aiFootDrops: 0, aiSwayScore: 0 });
    proceedToNextStep(AssessmentStep.BALANCE_TEST, balanceInputModal.dataUrl, undefined, fd, convertedSwayScore, undefined, eyesClosed);
  };

  // 팔 올리기 수동 검증 완료
  const handleArmRaiseSubmit = () => {
    const { dataUrl, postureData } = armRaiseInputModal;
    // 사용자가 모달에서 수정한 등급을 postureData에 덮어씀
    const updatedPostureData = { ...postureData, armRaiseGrade: manualArmRaiseGrade };
    setArmRaiseInputModal({ isOpen: false, dataUrl: '', postureData: null });
    proceedToNextStep(AssessmentStep.ARM_RAISE_TEST, dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  // 유연성 수동 검증 완료
  const handleFlexSubmit = () => {
    const { dataUrl, postureData } = flexInputModal;
    // 사용자가 수정한 등급을 postureData에 덮어씀
    const updatedPostureData = { ...postureData, flexGrade: manualFlexGrade };
    setFlexInputModal({ isOpen: false, dataUrl: '', postureData: null });
    proceedToNextStep(AssessmentStep.FLEXIBILITY_TEST, dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  const runAnalysis = async (images: CapturedImage[], overrideUserInfo?: UserInfo) => {
    const effectiveUserInfo = overrideUserInfo || userInfo;
    if (!effectiveUserInfo) {
      logger.warn('Flow', 'runAnalysis 중단: userInfo 없음');
      setErrorModal({
        isOpen: true,
        message: '사용자 정보가 없어 분석을 시작할 수 없습니다. 새로운 측정을 시작해 주세요.',
        showRetry: false
      });
      return;
    }
    logger.info('Flow', `runAnalysis 시작`, { name: effectiveUserInfo.name, imageCount: images.length, steps: images.map(i => i.step) });
    logger.stateChange('Flow', 'step', step, 'ANALYZING');
    setStep(AssessmentStep.ANALYZING);
    stopSpeaking(); // ★ 이전 나레이션 강제 중지 후 분석 안내 시작
    speak("이 분석은 브레인트레이닝센터와 연구원, 대학교 등 전문가들이 연구, 개발하였고, 최신 AI 기술을 접목하여 개발한 프로그램입니다. 본 시스템은 건강 관리에 도움을 주고자 자세, 동작, 기억력 등을 측정하는 웰니스 프로그램으로서, 의료적 진단과는 무관합니다. 데이터 분석에 약 1분 정도 소요됩니다.");
    setIsAnalyzing(true);
    const analysisStartTime = Date.now();
    try {
      // For AI analysis, we send slightly larger images than storage but still resized for speed
      logger.debug('Flow', '이미지 리사이즈 시작 (800px)');
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.dataUrl, 800)
      })));
      logger.debug('Flow', `이미지 리사이즈 완료, analyzeHealth 호출`);

      const result = await analyzeHealth(effectiveUserInfo, aiOptimizedImages);
      logger.info('Flow', `analyzeHealth 결과 수신`, { overallScore: result.overallScore, physicalAge: result.physicalAge });
      
      setReport(result);
      logger.stateChange('Flow', 'report', null, `score=${result.overallScore}`);
      speak("분석 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.");
      
      // Attempt to save to history, but don't crash if it fails
      // pending 레코드 삭제 후 최종 report로 저장
      if (pendingRecordId) {
        try { 
          await deleteRecordLocally(pendingRecordId);
          logger.debug('Flow', `pending 레코드 삭제 완료: ${pendingRecordId}`);
        } catch (e) { 
          logger.warn('Flow', `pending 삭제 실패: ${pendingRecordId}`, e);
        }
        // ★ v4.2.6: pending assessment DB도 삭제
        try {
          await deletePendingAssessment(pendingRecordId);
          logger.debug('Flow', `pending assessment 삭제 완료: ${pendingRecordId}`);
        } catch (e) {
          logger.warn('Flow', 'pending assessment 삭제 실패', e);
        }
        setPendingRecordId(null);
      }
      
      logger.debug('Flow', '레코드 저장 시작');
      await saveRecord(result, images);
      logger.info('Flow', '레코드 저장 완료');
      
      const totalElapsed = Date.now() - analysisStartTime;
      logger.info('Flow', `전체 분석 완료 (${totalElapsed}ms = ${(totalElapsed/1000).toFixed(1)}초)`);
      logger.stateChange('Flow', 'step', 'ANALYZING', 'REPORT');
      setStep(AssessmentStep.REPORT);
    } catch (error) {
      const totalElapsed = Date.now() - analysisStartTime;
      logger.error('Flow', `runAnalysis 실패 (${totalElapsed}ms)`, error, true);
      
      const isQuotaError = error instanceof Error && (error.message.includes('quota') || error.message.includes('429'));
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      setErrorModal({ 
        isOpen: true, 
        message: isQuotaError 
          ? "현재 AI 분석 요청이 너무 많아 일시적으로 처리가 지연되고 있습니다. 잠시 후 '분석 재시작' 버튼을 누르시면 안전하게 저장된 사진들로 다시 분석을 진행합니다."
          : `AI 분석 서버와 통신 중 오류가 발생했습니다.\n\n[에러 상세] ${errorMsg.substring(0, 200)}\n\n(촬영하신 8단계 사진과 데이터는 기기에 안전하게 저장되어 있습니다.) 아래 '분석 재시작' 버튼을 눌러주시면 처음부터 다시 촬영할 필요 없이 즉시 분석을 재개합니다.`,
        showRetry: true
      });
      // Stay on ANALYZING step or show a state where they can retry
    } finally {
      setIsAnalyzing(false);
    }
  };

  const retryAnalysis = () => {
    setErrorModal({ isOpen: false, message: '', showRetry: false });
    stopSpeaking(); // ★ 이전 나레이션 강제 중지
    runAnalysis(capturedImages);
  };

  const repeatGuidance = () => {
    const guidance = getStepGuidance(step);
    if (guidance) {
      speak(guidance);
    }
  };

  const renderCameraStep = (stepBadge: string, stepTitle: string, stepNum: number, camModule: React.ReactNode) => {
    return (
      <div className="flex-1 flex flex-col p-3 overflow-auto bg-slate-900 rounded-2xl border border-slate-800 m-2 shadow-2xl relative">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="mb-2 flex justify-between items-center relative z-50">
            <div className="flex items-center gap-3">
              <span className="bg-indigo-600/80 text-white font-black text-xs px-3 py-1 rounded-full">
                {stepNum}/11
              </span>
              <h3 className="text-xl font-black text-white drop-shadow-sm">{stepTitle}</h3>
              <span className="text-slate-400 text-xs font-medium">{getStepGuidance(step)}</span>
            </div>
            <div className="flex items-center gap-3">
              {devices.length > 0 && (
                <div className="relative">
                  <button 
                    onClick={() => setShowDeviceSelect(!showDeviceSelect)}
                    className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg cursor-pointer relative"
                    title="카메라 설정"
                  >
                    <i className="fas fa-video text-lg"></i>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold border-2 border-slate-900">{devices.length}</div>
                  </button>
                  
                  {showDeviceSelect && (
                    <div className="absolute right-0 top-14 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 w-64 animate-fade-in">
                      <div className="text-xs text-slate-400 font-bold mb-2 px-2 pt-1"><i className="fas fa-camera mr-1"></i> 카메라 선택</div>
                      <div className="flex flex-col gap-1">
                        {devices.map((device, idx) => (
                          <button
                            key={device.deviceId}
                            onClick={() => {
                              setSelectedDeviceId(device.deviceId);
                              localStorage.setItem('selectedCameraId', device.deviceId);
                              window.dispatchEvent(new CustomEvent('camera:change', { detail: { deviceId: device.deviceId } }));
                              setShowDeviceSelect(false);
                            }}
                            className={`text-left px-3 py-2 text-sm rounded-lg transition-all ${
                              selectedDeviceId === device.deviceId 
                                ? 'bg-indigo-600 font-bold text-white shadow-md' 
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            <i className={`fas fa-check mr-2 ${selectedDeviceId === device.deviceId ? 'opacity-100' : 'opacity-0'}`}></i>
                            {device.label || `Camera ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={repeatGuidance}
                className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-indigo-400 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-indigo-300 transition-all shadow-lg hover:rotate-12 cursor-pointer"
                title="안내 다시 듣기"
              >
                <i className="fas fa-volume-up text-lg"></i>
              </button>
              
              <button 
                onClick={() => {
                  if (window.confirm("테스트를 중단하고 홈으로 이동하시겠습니까? 진행 중인 데이터는 저장되지 않을 수 있습니다.")) {
                    setStep(AssessmentStep.INTRO);
                  }
                }}
                className="w-12 h-12 bg-slate-800 border border-slate-700/80 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-lg hover:rotate-12 cursor-pointer"
                title="홈으로 가기"
              >
                <i className="fas fa-home text-lg"></i>
              </button>
            </div>
        </div>
        
        <div className="flex-1 relative z-10 rounded-2xl overflow-hidden border border-slate-700/80 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-black">
            {/* 사진 확인(미리보기) 화면 - V3.1.0 프로세스 복원 */}
            {previewData ? (() => {
              const vr = previewData.validationResult;
              const isValidating = vr === null || vr === undefined;
              const passed = vr?.passed ?? false;
              return (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900 p-4">
                {/* 상단 배지 */}
                <div className={`backdrop-blur-sm text-white font-black px-5 py-1.5 rounded-full text-xs shadow-lg flex items-center gap-2 ${
                  isValidating ? 'bg-amber-500/90' : passed ? 'bg-emerald-500/90' : 'bg-rose-500/90'
                }`}>
                  <i className={`fas ${isValidating ? 'fa-spinner fa-spin' : passed ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                  {isValidating ? 'AI 분석 중...' : passed ? '촬영 성공' : '재촬영 필요'}
                </div>
                
                {/* 촬영된 사진 */}
                <img 
                  src={previewData.dataUrl} 
                  alt="촬영 미리보기" 
                  className={`max-h-[50%] w-auto object-contain rounded-2xl border-2 shadow-2xl ${
                    isValidating ? 'border-amber-500/50' : passed ? 'border-emerald-500/50' : 'border-rose-500/50'
                  }`}
                />

                {/* 검증 결과 메시지 */}
                {vr && vr.message && (
                  <div className={`text-sm font-bold px-4 py-2 rounded-xl ${
                    passed ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                  }`}>
                    <i className={`fas ${passed ? 'fa-check mr-1' : 'fa-exclamation-circle mr-1'}`}></i>
                    {vr.message}
                  </div>
                )}
                
                {/* 버튼 영역 */}
                <div className="flex justify-center gap-6 mt-1">
                  <button
                    onClick={retakeCapture}
                    className="w-14 h-14 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-all flex items-center justify-center border-2 border-slate-500 shadow-lg"
                    title="재촬영"
                  >
                    <i className="fas fa-redo-alt text-xl"></i>
                  </button>
                  <button
                    onClick={confirmCapture}
                    disabled={isValidating} // passed 여부와 상관없이 수동으로 넘어갈 수 있도록 허용
                    className={`w-14 h-14 rounded-full transition-all flex items-center justify-center shadow-lg border-2 ${
                      isValidating 
                        ? 'bg-slate-600 border-slate-500 text-slate-400 cursor-not-allowed opacity-50'
                        : !passed
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/30 active:scale-[0.98] border-amber-400'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 active:scale-[0.98] border-indigo-400'
                    }`}
                    title={isValidating ? '분석 중...' : !passed ? 'AI 인식 실패 (강제 수동 진행)' : '확인 후 다음 단계로'}
                  >
                    <i className={`fas ${!passed && !isValidating ? 'fa-forward' : 'fa-check'} text-2xl font-black`}></i>
                  </button>
                </div>
              </div>
              );
            })() : camModule}
        </div>
      </div>
    );
  };

  const renderContent = () => {

    if (!hasStarted) {
      return (
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
          {/* Animated Background Orbs */}
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse"></div>
          
          <div className="relative z-10 max-w-lg w-full p-12 rounded-[2.5rem] text-center border border-white/10"
               style={{
                 background: 'rgba(15, 23, 42, 0.65)',
                 backdropFilter: 'blur(40px)',
                 boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
               }}>
            
            {/* 3-Body Scanner Motion Graphic */}
            <div className="relative w-36 h-36 mx-auto mb-10 flex items-center justify-center">
              <div className="absolute inset-0 border-t-2 border-l-2 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '6s' }}></div>
              <div className="absolute inset-2 border-b-2 border-r-2 border-emerald-400/70 rounded-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>
              <div className="absolute inset-4 border-t-2 border-dashed border-purple-500/50 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
              <div className="absolute inset-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center z-10 shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-pulse">
                <i className="fas fa-brain text-4xl text-white opacity-95 drop-shadow-md"></i>
              </div>
              <div className="absolute inset-0 w-full h-full animate-spin z-20 pointer-events-none" style={{ animationDuration: '10s' }}>
                 <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-running text-white text-[16px]"></i></div>
                 </div>
                 <div className="absolute bottom-3 right-1 w-9 h-9 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-heart text-white text-[14px]"></i></div>
                 </div>
                 <div className="absolute bottom-3 left-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.8)] border-2 border-slate-900">
                   <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-bolt text-white text-[10px]"></i></div>
                 </div>
              </div>
            </div>

            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-4 tracking-tight drop-shadow-sm">
              BTC 3바디 7코드 AI건강센터
            </h2>
            <div className="w-12 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 mx-auto rounded-full mb-6"></div>
            
            <p className="text-slate-300 mb-10 leading-relaxed text-sm font-medium">
              본 서비스는 원활한 측정을 위해 <span className="text-indigo-300 font-bold">음성 안내</span>를 제공합니다.<br/>
              주변 환경을 정리하시고 아래 버튼을 눌러주세요.
            </p>

            <button 
              onClick={() => {
                // 분석 시스템 활성화 클릭 시 시스템 점검 먼저 실행
                setShowSysCheck(true);
                initAudio().catch(() => {});
              }}
              className="relative overflow-hidden w-full group bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition-all duration-300"
              style={{ boxShadow: '0 10px 25px -5px rgba(99,102,241,0.5)' }}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-[150%] skew-x-[-20deg] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out"></div>
              <span className="relative z-10 flex items-center justify-center gap-2 text-lg tracking-wide">
                측정 시스템 활성화 <i className="fas fa-play text-xs ml-1 relative top-[1px]"></i>
              </span>
            </button>
            <div className="mt-8 flex flex-col items-center justify-center gap-1 text-slate-500 text-[10px] font-semibold tracking-widest uppercase">
              <div className="flex gap-2">
                <span><i className="fas fa-microchip text-indigo-400"></i> AI Vision Processor</span>
                <span>•</span>
                <span><i className="fas fa-check-circle text-emerald-400"></i> System Ready</span>
              </div>
              <div className="mt-2 text-slate-600">v{pkg.version} Premium Edition</div>
            </div>
          </div>
        </div>
      );
    }

    if (step === 'HISTORY') {
      return <HistoryManager 
                onViewReport={(rec) => {
                  setReport(rec.report);
                  setCapturedImages(Array.isArray(rec.images) ? rec.images : []);
                  setStep(AssessmentStep.REPORT);
                }}
                onResumeAnalysis={(rec) => {
                  const resumeUserInfo = rec.report?.userInfo;
                  if (resumeUserInfo) {
                    setUserInfo(resumeUserInfo);
                  }
                  setCapturedImages(rec.images || []);
                  setPendingRecordId(rec.id);
                  setStep(AssessmentStep.ANALYZING);
                  // userInfo를 직접 전달 (setState는 비동기라 아직 반영 안 됨)
                  runAnalysis(rec.images || [], resumeUserInfo || undefined);
                }}
                onClose={() => setStep(AssessmentStep.INTRO)} 
             />;
    }

    if (step === AssessmentStep.KFACE) {
      return <KFaceApp userInfo={userInfo} onClose={() => setStep(AssessmentStep.INTRO)} />;
    }

    if (step === AssessmentStep.KTAROT) {
      return <KTarotApp userInfo={userInfo} onClose={() => setStep(AssessmentStep.INTRO)} />;
    }

    switch (step) {
      case AssessmentStep.INTRO:
        return (
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '3s' }}></div>

            <div className="relative z-10 max-w-lg w-full p-12 rounded-[2.5rem] text-center border border-white/10"
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(40px)',
                  boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}>
              
              {/* 3-Body Scanner Motion Graphic (Smaller variation) */}
              <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                <div className="absolute inset-0 border-t-2 border-l-2 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '6s' }}></div>
                <div className="absolute inset-2 border-b-2 border-r-2 border-blue-400/60 rounded-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }}></div>
                <div className="absolute inset-4 border-t-2 border-dashed border-purple-500/50 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>

                <div className="absolute inset-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center z-10 shadow-[0_0_25px_rgba(99,102,241,0.4)] animate-pulse">
                  <i className="fas fa-brain text-3xl text-white opacity-90 drop-shadow-md"></i>
                </div>
                
                <div className="absolute inset-0 w-full h-full animate-spin z-20 pointer-events-none" style={{ animationDuration: '10s' }}>
                   <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.8)] border border-slate-900">
                     <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-running text-white text-[12px]"></i></div>
                   </div>
                   <div className="absolute bottom-2 right-0 w-7 h-7 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(244,63,94,0.8)] border border-slate-900">
                     <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-heart text-white text-[11px]"></i></div>
                   </div>
                   <div className="absolute bottom-2 left-0 w-5 h-5 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.8)] border border-slate-900">
                     <div className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }}><i className="fas fa-bolt text-white text-[8px]"></i></div>
                   </div>
                </div>
              </div>

              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-2 tracking-tight drop-shadow-sm">
                BTC 3바디 AI 측정 센터
              </h2>
              <p className="text-indigo-300/80 mb-6 text-sm font-medium italic">
                AI 신체 균형 &amp; 건강 상태 측정 시스템
              </p>

              {/* 법적 고지 한 줄 안내 */}
              <div className="mb-8 p-3 rounded-xl bg-indigo-900/40 border border-indigo-500/20 backdrop-blur-md shadow-inner">
                <p className="text-slate-300 text-xs leading-relaxed font-semibold">
                  <i className="fas fa-info-circle text-indigo-400 mr-1"></i> 본 테스트는 질병 진단 등의 의료행위가 아니며, 평소 건강 관리를 돕기 위한 <strong>건강 상태 점검(체크) 서비스</strong>입니다.
                </p>
              </div>

              {/* ★ v4.2.6: 이어하기 배너 */}
              {resumePendingData && (
                <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <i className="fas fa-exclamation-triangle text-amber-400"></i>
                    <span className="text-amber-300 font-bold text-sm">이전 측정이 중단되었습니다</span>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">
                    <span className="text-white font-bold">{resumePendingData.userName}</span>님의 측정이
                    <span className="text-amber-400 font-bold"> {resumePendingData.completedStepCount}/11단계</span>까지 진행되어 있습니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // 이어하기: pending 데이터로 상태 복원
                        setUserInfo(resumePendingData.userInfo);
                        setCapturedImages(resumePendingData.capturedImages);
                        setPendingRecordId(resumePendingData.id);
                        initAudio().catch(() => {});
                        // 다음 단계로 이동
                        const steps = Object.values(AssessmentStep);
                        const currentIdx = steps.indexOf(resumePendingData.currentStep);
                        const nextStep = steps[currentIdx + 1];
                        if (nextStep) {
                          setStep(nextStep as AssessmentStep);
                        } else {
                          setStep(AssessmentStep.READY_FOR_ANALYSIS);
                        }
                        setResumePendingData(null);
                        logger.info('Flow', `이어하기 시작: ${resumePendingData.currentStep} 이후부터`);
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold py-3 rounded-xl transition-all text-sm"
                    >
                      <i className="fas fa-play mr-1"></i> 이어서 측정하기
                    </button>
                    <button
                      onClick={async () => {
                        // 이어하기 거부: pending 삭제
                        try { await deletePendingAssessment(resumePendingData.id); } catch {}
                        setResumePendingData(null);
                      }}
                      className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 rounded-xl transition-all text-sm"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4 mb-2 filter drop-shadow-xl">
                <button 
                  onClick={() => {
                    setCapturedImages([]);
                    setReport(null);
                    setUserInfo(null);
                    setResumePendingData(null); // 이어하기 데이터 무효화
                    initAudio().catch(() => {});
                    setStep(AssessmentStep.USER_INFO);
                  }}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
                >
                  신규 측정 시작하기 <i className="fas fa-chevron-right text-xs"></i>
                </button>
                <button 
                  onClick={() => setStep('HISTORY')}
                  className="w-full bg-slate-800/80 border border-slate-700 text-slate-300 font-bold py-4 rounded-2xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fas fa-users"></i> 회원 데이터 관리
                </button>
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-[9px] font-semibold tracking-widest uppercase">
                <i className="fas fa-satellite-dish text-indigo-900 animate-pulse"></i> POWERED BY GEMINI AI VISION
              </div>
            </div>
          </div>
        );

      case AssessmentStep.USER_INFO:
        return <UserInfoForm onSubmit={handleUserSubmit} />;

      case AssessmentStep.POSTURE_FRONT:
        return renderCameraStep("측정 1단계", "정면 신체 균형", 1, <CameraModule key="front" onCapture={handleCapture} guidelineType="front" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.POSTURE_SIDE:
        return renderCameraStep("측정 2단계", "측면 신체 균형", 2, <CameraModule key="side" onCapture={handleCapture} guidelineType="side" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.BALANCE_TEST:
        return (
          <div className="flex-1 flex flex-col">
            {/* 눈 상태 토글 버튼 */}
            <div className="flex items-center justify-center gap-3 px-6 pt-4 pb-2">
              <span className="text-slate-400 text-sm font-medium">균형 테스트 조건:</span>
              <button
                onClick={() => setEyesClosed(true)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  eyesClosed
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <i className="fas fa-eye-slash mr-2"></i>눈 감고 (정규)
              </button>
              <button
                onClick={() => setEyesClosed(false)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  !eyesClosed
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <i className="fas fa-eye mr-2"></i>눈 뜨고 (보정적용)
              </button>
              {!eyesClosed && (
                <span className="text-amber-400 text-xs font-medium animate-pulse">
                  <i className="fas fa-exclamation-triangle mr-1"></i>+2회 패널티 자동 반영
                </span>
              )}
            </div>
            {renderCameraStep("노화 테스트 01", "눈 감고 한발 서기", 3, <CameraModule key="balance" onCapture={handleCapture} guidelineType="balance" timerDuration={15} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />)}
          </div>
        );

      case AssessmentStep.ARM_RAISE_TEST:
        return renderCameraStep("노화 테스트 02", "팔 들어 올리기", 4, <CameraModule key="arm" onCapture={handleCapture} guidelineType="arm_raise" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.FLEXIBILITY_TEST:
        return renderCameraStep("노화 테스트 03", "유연성 테스트", 5, <CameraModule key="flexibility" onCapture={handleCapture} guidelineType="flexibility" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.STRENGTH_SQUAT:
        return renderCameraStep("근력 테스트 01", "15초 스쿼트", 6, <CameraModule key="squat" onCapture={handleCapture} guidelineType="squat" timerDuration={15} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.STRENGTH_PUSHUP:
        return renderCameraStep("근력 테스트 02", "15초 푸시업", 7, <CameraModule key="pushup" onCapture={handleCapture} guidelineType="pushup" timerDuration={15} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.BRAIN_REACTION:
        return <TmtBrainTestModule key={AssessmentStep.BRAIN_REACTION} onComplete={(dataUrl, testData) => proceedToNextStep(AssessmentStep.BRAIN_REACTION, dataUrl, testData.reactionTimeMs, testData.reactionErrors, undefined, undefined, undefined, undefined, undefined, testData)} />;

      case AssessmentStep.BRAIN_MEMORY:
        return <BrainTestModule key={AssessmentStep.BRAIN_MEMORY} testType={AssessmentStep.BRAIN_MEMORY} onComplete={(dataUrl, testData) => proceedToNextStep(AssessmentStep.BRAIN_MEMORY, dataUrl, testData.memorySpan, undefined, undefined, undefined, undefined, undefined, undefined, testData)} preferredCameraId={selectedDeviceId} />;

      case AssessmentStep.FACE_ANALYSIS:
        return renderCameraStep("측정 10단계", "안면 피부 노화 측정", 10, <CameraModule key="face" onCapture={handleCapture} guidelineType="face" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.SEVEN_CODE_CHECK:
        return <SevenCodeChecklist onNext={handleSevenCodeComplete} onPrev={() => setStep(AssessmentStep.FACE_ANALYSIS)} />;

      case AssessmentStep.READY_FOR_ANALYSIS:
        const stepChecklist = [
          { step: AssessmentStep.POSTURE_FRONT, icon: '📸', label: '1. 정면 자세', hasImage: true },
          { step: AssessmentStep.POSTURE_SIDE, icon: '📸', label: '2. 측면 자세', hasImage: true },
          { step: AssessmentStep.BALANCE_TEST, icon: '⚖️', label: '3. 균형 테스트', hasImage: true },
          { step: AssessmentStep.ARM_RAISE_TEST, icon: '🙌', label: '4. 팔 올리기', hasImage: true },
          { step: AssessmentStep.FLEXIBILITY_TEST, icon: '🤸', label: '5. 유연성', hasImage: true },
          { step: AssessmentStep.STRENGTH_SQUAT, icon: '🦵', label: '6. 스쿼트', hasImage: true },
          { step: AssessmentStep.STRENGTH_PUSHUP, icon: '💪', label: '7. 팔굽혀펴기', hasImage: true },
          { step: AssessmentStep.BRAIN_REACTION, icon: '⚡', label: '8. 뇌 반응속도', hasImage: false },
          { step: AssessmentStep.BRAIN_MEMORY, icon: '🛒', label: '9. 마트 장보기', hasImage: false },
          { step: AssessmentStep.FACE_ANALYSIS, icon: '😊', label: '10. 얼굴 분석', hasImage: true },
          { step: AssessmentStep.SEVEN_CODE_CHECK, icon: '🔢', label: '11. 7코드 점검', hasImage: false },
        ];
        const allStepsCompleted = stepChecklist.every(item => !!capturedImages.find(i => i.step === item.step));

        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900 animate-fade-in overflow-y-auto w-full">
            <div className="w-full max-w-3xl">
              <div className="text-center mb-8">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${allStepsCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  <i className={`fas ${allStepsCompleted ? 'fa-check' : 'fa-times'} text-5xl`}></i>
                </div>
                <h3 className="text-3xl font-black text-white mb-2">{allStepsCompleted ? '모든 측정 완료!' : '측정 미완료 안내'}</h3>
                <p className="text-slate-400 text-sm">
                  {allStepsCompleted ? '아래 측정 내역 확인 후 AI 분석을 시작하세요.' : '아직 진행하지 않은 측정 항목(❌)이 있습니다. 모든 항목을 완료해야 분석이 가능합니다.'}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-3xl p-6 mb-6 border border-slate-700/50 shadow-xl">
                <h4 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <i className="fas fa-clipboard-list text-emerald-400"></i> 측정 현황 내역
                </h4>
                <div className="space-y-3">
                  {stepChecklist.map(item => {
                    const img = capturedImages.find(i => i.step === item.step);
                    const done = !!img;
                    return (
                      <div 
                        key={item.step} 
                        onClick={() => !done && setStep(item.step)}
                        className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-base transition-all ${
                          done 
                            ? 'bg-emerald-500/10 border border-emerald-500/20' 
                            : 'bg-rose-500/10 border border-rose-500/20 cursor-pointer hover:bg-rose-500/20 hover:border-rose-400 active:scale-[0.98] group shadow-sm hover:shadow-rose-500/10'
                        }`}
                      >
                        <span className="text-2xl">{item.icon}</span>
                        <span className={`font-bold flex-1 ${done ? 'text-white' : 'text-rose-200 group-hover:text-white transition-colors'}`}>{item.label}</span>
                        {item.hasImage && img?.dataUrl && (
                          <img src={img.dataUrl} alt="" className="w-12 h-12 rounded-lg object-cover border-2 border-white/20 shadow-md" />
                        )}
                        {!item.hasImage && img?.brainTestData?.reactionTimeMs && (
                          <span className="text-emerald-300 text-sm font-black bg-emerald-900/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">{img.brainTestData.reactionTimeMs}ms</span>
                        )}
                        {!item.hasImage && img?.brainTestData?.memoryCorrect !== undefined && (
                          <span className="text-emerald-300 text-sm font-black bg-emerald-900/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">{img.brainTestData.memoryCorrect}개 정답</span>
                        )}
                        {item.step === AssessmentStep.SEVEN_CODE_CHECK && img?.sevenCodeKeywords && (
                          <span className="text-emerald-300 text-sm font-black bg-emerald-900/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">{img.sevenCodeKeywords.length}개 항목</span>
                        )}
                        
                        <div className={`flex items-center gap-2 ${done ? '' : 'text-rose-300'}`}>
                          {!done && <span className="text-xs font-bold bg-rose-500/20 px-2.5 py-1.5 rounded-lg group-hover:bg-rose-500 group-hover:text-white transition-colors"><i className="fas fa-play mr-1 text-[10px]"></i>측정 시작</span>}
                          <div className={`w-8 h-8 flex items-center justify-center rounded-full ml-1 transition-colors ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400 group-hover:bg-rose-500 group-hover:text-white'}`}>
                            <i className={`fas font-black text-lg ${done ? 'fa-check' : 'fa-times'}`}></i>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-indigo-900/30 border border-indigo-500/20 rounded-2xl p-5 mb-8 text-center shadow-lg">
                <p className="text-indigo-200 text-sm font-bold leading-relaxed">
                  <i className="fas fa-save mr-1"></i> 분석 시작 시 측정 데이터가 자동 저장됩니다.<br/>
                  분석 오류 시에도 <strong className="text-amber-300">재측정 없이</strong> 저장된 데이터로 재분석이 가능합니다.
                </p>
              </div>

              <button 
                disabled={!allStepsCompleted}
                onClick={async () => {
                  if (!allStepsCompleted) return;
                  try {
                    const resizedForDb = await Promise.all(capturedImages.map(async (img) => ({
                      ...img,
                      dataUrl: img.dataUrl ? await resizeImage(img.dataUrl, 200) : ''
                    })));
                    const pendingId = 'pending-' + Date.now().toString(36);
                    setPendingRecordId(pendingId);
                    const pendingRecord: MemberRecord = {
                      id: pendingId,
                      name: '(분석 대기) ' + (userInfo?.name || '미정'),
                      lastTestDate: new Date().toISOString(),
                      report: { userInfo } as BodyReport,
                      images: resizedForDb,
                      ownerUid: 'local-branch'
                    };
                    await saveRecordLocally(pendingRecord);
                    setToast({ isVisible: true, message: "측정 데이터가 안전하게 저장되었습니다.", type: 'success' });
                  } catch (e) {
                    console.warn('[DB] 사전 저장 실패:', e);
                  }
                  runAnalysis(capturedImages);
                }}
                className={`w-full py-6 rounded-2xl transition-all text-2xl font-black flex items-center gap-3 justify-center shadow-xl ${
                  allStepsCompleted 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.6)] cursor-pointer' 
                    : 'bg-slate-800 border-2 border-slate-700 text-slate-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <i className={allStepsCompleted ? 'fas fa-microchip' : 'fas fa-lock'}></i> 
                {allStepsCompleted ? 'AI 종합 분석 시작하기' : '모든 단계를 측정해야 분석 가능합니다'}
              </button>
            </div>
          </div>
        );

      case AssessmentStep.ANALYZING:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-900">
            <div className="relative mb-12">
              <div className="absolute inset-0 border-2 border-indigo-500/10 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
              <div className="w-48 h-48 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <i className="fas fa-fingerprint text-5xl text-indigo-400/80 animate-pulse mb-2"></i>
                <span className="text-2xl font-black text-white tabular-nums tracking-tighter">
                  {Math.floor(analyzeProgress)}%
                </span>
              </div>
            </div>
            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">AI 데이터 분석 중</h3>
            <div className="text-slate-300 max-w-2xl mx-auto text-base leading-relaxed mt-8 bg-indigo-900/40 p-6 rounded-2xl border border-indigo-500/20 backdrop-blur-sm text-left shadow-2xl">
              <h4 className="text-indigo-200 font-black text-lg mb-3 flex items-center gap-2">
                <i className="fas fa-book-medical"></i> 서비스 산출 근거 및 이용 안내
              </h4>
              <div className="space-y-4 text-sm">
                <div>
                  <strong className="text-indigo-300 block mb-1">📌 학술적 측정 기반</strong>
                  <p className="text-slate-400">Kendall의 자세 평가(Posture Analysis), J.R. Stroop의 인지 간섭 현상, A. Baddeley의 작업기억 모델, 그리고 최신 안면 랜드마크 기술 등 검증된 인지과학 및 생체역학 방법론을 기초로 AI 알고리즘화 되었습니다.</p>
                </div>
                <div>
                  <strong className="text-indigo-300 block mb-1">📌 연령 지표 산출 원리</strong>
                  <p className="text-slate-400">제공되는 건강나이(신체/뇌/얼굴/마음)는 측정 데이터를 종합하여 통계적 알고리즘으로 산출한 맞춤형 참고 지표입니다.</p>
                </div>
                <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                  <strong className="text-amber-400/90 block mb-1 text-xs">⚠️ 비의료 건강관리서비스 안내</strong>
                  <p className="text-slate-500 text-xs">본 테스트는 보건복지부의 가이드라인을 준수합니다. 본 결과는 질병 진단이나 의료행위를 대체할 수 없으며, 질환이 의심될 경우 전문 의료기관을 방문하시기 바랍니다.</p>
                </div>
              </div>
            </div>
            <p className="text-indigo-400 mt-6 font-bold animate-pulse">약 10~15초 정도 소요됩니다</p>
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
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-900 text-white flex-col">
            <h2 className="text-2xl font-bold mb-4 text-red-400">🚧 아직 구현되지 않은 테스트 화면입니다 🚧</h2>
            <p className="text-slate-400 mb-6">선택하신 테스트({step})는 현재 준비 중이거나 내부적으로 처리되는 단계입니다.</p>
            <button 
              onClick={() => setStep(AssessmentStep.INTRO)}
              className="bg-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(79,70,229,0.5)]"
            >
              <i className="fas fa-home mr-2"></i>처음으로 돌아가기
            </button>
          </div>
        );
    }
  };

  const renderDevMenu = () => {
    if (!import.meta.env.DEV) return null;
    return (
      <div className="fixed bottom-4 left-4 z-[9999] bg-black/80 backdrop-blur-md p-3 rounded-2xl shadow-2xl border border-white/20 flex flex-col gap-2 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <div className="text-white/50 text-[10px] font-black uppercase tracking-widest text-center border-b border-white/10 pb-1 mb-1">
          <i className="fas fa-bug text-emerald-400 mr-1"></i> Dev Navigation
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(AssessmentStep).filter(s => ![AssessmentStep.READY_FOR_ANALYSIS].includes(s)).map(s => (
            <button
              key={s}
              onClick={() => {
                setStep(s);
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setRepInputModal({ isOpen: false, step: null, dataUrl: '' });
              }}
              className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all text-left ${
                step === s 
                  ? 'bg-indigo-600 text-white shadow-inner' 
                  : 'bg-white/5 text-white/70 hover:bg-white/15'
              }`}
            >
              {s.replace('_TEST', '').replace('POSTURE_', '')}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 relative">
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
          <div className="mt-6 space-y-2">
            <button 
              onClick={retryAnalysis}
              className="w-full px-4 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg text-sm"
            >
              🔄 즉시 재분석 (기존 데이터 유지)
            </button>
            <button 
              onClick={() => {
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setStep(AssessmentStep.READY_FOR_ANALYSIS);
              }}
              className="w-full px-4 py-3 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-all text-sm"
            >
              📋 측정 확인 화면으로 돌아가기
            </button>
            <button 
              onClick={() => {
                setErrorModal({ isOpen: false, message: '', showRetry: false });
                setStep(AssessmentStep.INTRO);
                setCapturedImages([]);
              }}
              className="w-full px-4 py-2 bg-transparent text-slate-400 font-bold rounded-2xl hover:text-white transition-all text-xs"
            >
              처음부터 다시 촬영
            </button>
          </div>
        )}
      </Modal>
      <Modal 
        isOpen={repInputModal.isOpen}
        title="운동 결과 확인 및 피드백"
        message="AI가 측정한 결과입니다. 정확한 횟수 및 자세 피드백을 수동으로 입력해 주세요."
        onClose={() => {}} // Prevent closing without input
      >
        <div className="mt-4 mb-4">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            <i className="fas fa-redo mr-1 text-indigo-500"></i> 운동 횟수
          </label>
          <input 
            type="number" 
            value={repCount}
            onChange={(e) => setRepCount(e.target.value)}
            placeholder="예: 12"
            className="w-full text-center text-3xl font-black text-slate-800 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-2">
            <i className="fas fa-check-circle mr-1 text-indigo-500"></i> 자세 평가 (AI 감점 반영)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['완벽', '우수', '보통', '보완필요'].map(posture => (
              <button
                key={posture}
                onClick={() => setManualRepPosture(posture)}
                className={`py-2 px-1 rounded-xl border-2 text-xs font-bold transition-all ${
                  manualRepPosture === posture 
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                }`}
              >
                {posture}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 text-center">선택한 자세에 따라 AI 신체나이 계산 시 패널티가 부여됩니다.</p>
        </div>

        <button 
          onClick={handleRepSubmit}
          disabled={!repCount}
          className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          입력 완료
        </button>
      </Modal>

      {/* 균형 테스트 수동 입력 모달 */}
      <Modal 
        isOpen={balanceInputModal.isOpen}
        title="균형 테스트 결과 입력"
        message="AI 측정 참고값이 표시됩니다. 실제 관찰한 결과로 수정해 주세요."
        onClose={() => {}}
      >
        <div className="mt-4 space-y-5">
          {/* AI 측정 참고값 */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 mb-1">📊 AI 측정 참고값</div>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>발 닿은 횟수: <strong className="text-indigo-600">{balanceInputModal.aiFootDrops}회</strong></span>
              <span>흔들림 지수: <strong className="text-indigo-600">{balanceInputModal.aiSwayScore}</strong></span>
            </div>
          </div>

          {/* 발 닿은 횟수 입력 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-shoe-prints mr-1 text-indigo-500"></i> 땅에 발 닿은 횟수
            </label>
            <input 
              type="number" 
              value={manualFootDrops}
              onChange={(e) => setManualFootDrops(e.target.value)}
              min="0"
              max="30"
              placeholder="예: 3"
              className="w-full text-center text-3xl font-black text-slate-800 py-3 bg-white border-2 border-indigo-100 rounded-2xl focus:outline-none focus:border-indigo-500 transition-colors"
              autoFocus
            />
            <p className="text-[11px] text-slate-400 mt-1 text-center">15초 동안 발이 바닥에 닿은 총 횟수</p>
          </div>

          {/* 흔들림 정도 입력 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-balance-scale mr-1 text-amber-500"></i> 흔들림 정도
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: '1', label: '매우\n안정', color: 'bg-emerald-100 border-emerald-400 text-emerald-700' },
                { value: '2', label: '안정', color: 'bg-green-50 border-green-400 text-green-700' },
                { value: '3', label: '보통', color: 'bg-amber-50 border-amber-400 text-amber-700' },
                { value: '4', label: '불안정', color: 'bg-orange-50 border-orange-400 text-orange-700' },
                { value: '5', label: '매우\n불안정', color: 'bg-red-50 border-red-400 text-red-700' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setManualSwayLevel(opt.value)}
                  className={`py-3 px-1 rounded-xl border-2 text-xs font-bold transition-all whitespace-pre-line leading-tight ${
                    manualSwayLevel === opt.value 
                      ? `${opt.color} shadow-md scale-[1.05]` 
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button 
          onClick={handleBalanceSubmit}
          className="w-full mt-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
        >
          입력 완료
        </button>
      </Modal>

      {/* 팔 올리기 수동 검증 모달 */}
      <Modal 
        isOpen={armRaiseInputModal.isOpen}
        title="팔 들어올리기 결과 확인"
        message="AI가 측정한 결과입니다. 실제 관찰한 결과로 수정해 주세요."
        onClose={() => {}}
      >
        <div className="mt-4 space-y-5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 mb-1">📊 AI 실시간 측정값</div>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>평균 각도: <strong className="text-indigo-600">{armRaiseInputModal.postureData?.armAvgAngle}도</strong></span>
              <span>귀 밀착: <strong className="text-indigo-600">{armRaiseInputModal.postureData?.earProximity}</strong></span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              팔꿈치: {armRaiseInputModal.postureData?.elbowStraight ? '정상(펴짐)' : '굽어짐 감점'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-child mr-1 text-indigo-500"></i> 최종 종합 등급 선택
            </label>
            <div className="flex flex-col gap-2">
              {['우수 (180도 완벽)', '양호 (160도)', '보통 (135도)', '미흡 (90도)', '불량 (90도 미만)'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setManualArmRaiseGrade(grade)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                    manualArmRaiseGrade.startsWith(grade.split(' ')[0]) 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button 
          onClick={handleArmRaiseSubmit}
          className="w-full mt-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
        >
          입력 완료
        </button>
      </Modal>

      {/* 유연성 수동 검증 모달 */}
      <Modal 
        isOpen={flexInputModal.isOpen}
        title="유연성(전굴) 결과 확인"
        message="AI가 측정한 결과입니다. 실제 관찰한 결과로 수정해 주세요."
        onClose={() => {}}
      >
        <div className="mt-4 space-y-5">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <div className="text-[11px] font-bold text-slate-400 mb-1">📊 AI 실시간 측정값</div>
            <div className="flex gap-4 text-sm text-slate-600">
              <span>손 닿는 곳: <strong className="text-indigo-600">{flexInputModal.postureData?.handPosition}</strong></span>
              <span>허리 각도: <strong className="text-indigo-600">{flexInputModal.postureData?.waistBendAngle}도</strong></span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              무릎: {flexInputModal.postureData?.kneeStraight ? '정상(펴짐)' : '굽어짐 감점'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              <i className="fas fa-running mr-1 text-indigo-500"></i> 최종 종합 등급 선택
            </label>
            <div className="flex flex-col gap-2">
              {['최우수 (손바닥 완전 닿음)', '우수 (손끝 닿음)', '보통 (정강이 중간)', '미흡 (정강이 위)', '불량 (무릎 이상)'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setManualFlexGrade(grade)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all text-left ${
                    manualFlexGrade.startsWith(grade.split(' ')[0]) 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <i className="fas fa-info-circle text-indigo-400 mr-1"></i>
              무릎 굽힘 정도, 허리 굽힘 정도에 따라 AI 자동 감점이 반영될 수 있습니다.
            </p>
          </div>
        </div>
        <button 
          onClick={handleFlexSubmit}
          className="w-full mt-5 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
        >
          입력 완료
        </button>
      </Modal>

      {renderContent()}
      {showSysCheck && (
        <SystemCheckOverlay onComplete={() => {
          setShowSysCheck(false);
          if (!hasStarted) {
            setHasStarted(true);
          }
        }} />
      )}
      <Toast 
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
      {renderDevMenu()}
    </div>
  );
};

export default AssessmentFlow;
