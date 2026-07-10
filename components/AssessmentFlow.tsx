/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { AssessmentStep, CapturedImage, BodyReport, UserInfo, MemberRecord, BrainTestData } from '../types';
import pkg from '../package.json';
import CameraModule from './CameraModule';
import { analyzeHealth, getActiveApiKey, setCustomApiKey, isUsingCustomKey } from '../services/geminiService';
import { speak, initAudio } from '../services/ttsService';
import ReportDashboard from './ReportDashboard';
import UserInfoForm from './UserInfoForm';
import HistoryManager from './HistoryManager';
import Modal from './Modal';
import Toast from './Toast';
import { logUsage } from '../services/statsService';
import { SystemCheckOverlay } from './SystemCheckOverlay';
import { saveRecordLocally, deleteRecordLocally } from '../services/localDb';
import BrainTestModule from './BrainTestModule';
import SevenCodeCheckModule from './SevenCodeCheckModule';
import KFaceApp from './KFaceApp';
import KTarotApp from './KTarotApp';
import { addToWaitingList, updateWaitingStatus, subscribeWaitingList, deleteWaitingMember, updateWaitingStarred } from '../services/eventService';
import { BRAND_NAME, SUB_NAME } from '@shared/constants/brand';
import { WaitingMember } from '../types';

const CHAKRA_MAP: Record<number, string> = {
  1: '1코드',
  2: '2코드',
  3: '3코드',
  4: '4코드',
  5: '5코드',
  6: '6코드',
  7: '7코드'
};

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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    if (errorModal.isOpen) {
      setApiKeyInput(getActiveApiKey() || '');
      if (errorModal.message.includes('Failed to fetch') || errorModal.message.includes('인터넷') || errorModal.message.includes('통신')) {
        setShowKeyInput(true);
      } else {
        setShowKeyInput(false);
      }
    }
  }, [errorModal.isOpen]);
  const [hasStarted, setHasStarted] = useState(false);
  const [showSysCheck, setShowSysCheck] = useState(false);
  const [repInputModal, setRepInputModal] = useState<{ isOpen: boolean, step: AssessmentStep | null, dataUrl: string, formScore?: number, kneeAssisted?: boolean, postureData?: any }>({ isOpen: false, step: null, dataUrl: '' });
  const [repCount, setRepCount] = useState<string>('');
  const [manualRepPosture, setManualRepPosture] = useState<string>('보통');
  // 균형 테스트 수동 입력 모달
  const [balanceInputModal, setBalanceInputModal] = useState<{ isOpen: boolean, dataUrl: string, aiFootDrops: number, aiSwayScore: number }>({ isOpen: false, dataUrl: '', aiFootDrops: 0, aiSwayScore: 0 });
  const [manualFootDrops, setManualFootDrops] = useState<string>('0');
  const [manualSwayLevel, setManualSwayLevel] = useState<string>('3'); // 1~5 scale

  // 야외 행사 및 대기열 연동을 위한 상태 신설
  const [activeEventCode, setActiveEventCode] = useState<string>(localStorage.getItem('activeEventCode') || '');
  const [currentBranchId, setCurrentBranchId] = useState<string>('');
  const [currentBranchName, setCurrentBranchName] = useState<string>('');
  const [isReceptionOnly, setIsReceptionOnly] = useState(false);
  const [isWaitingMemberActive, setIsWaitingMemberActive] = useState(false);
  const [activeWaitingId, setActiveWaitingId] = useState<string | null>(null);
  const [waitingList, setWaitingList] = useState<WaitingMember[]>([]);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [selectedKeywordsToShow, setSelectedKeywordsToShow] = useState<{ name: string, keywords: string[], weakestCode: number } | null>(null);

  // 건강 니즈 파악 단계 상태
  const [showHealthNeeds, setShowHealthNeeds] = useState(false);
  const [selectedHealthNeeds, setSelectedHealthNeeds] = useState<string[]>([]);
  const [customHealthNeed, setCustomHealthNeed] = useState('');
  const [pendingSevenCodeData, setPendingSevenCodeData] = useState<{ keywords: string[], weakestCode: number } | null>(null);

  // 지점 정보 로드 및 이벤트 리스너 이펙트
  useEffect(() => {
    const currentDeviceJson = localStorage.getItem('currentDevice');
    if (currentDeviceJson) {
      try {
        const device = JSON.parse(currentDeviceJson);
        setCurrentBranchId(device.branchId || 'unknown');
        
        import('../services/firebaseAuthService').then(({ getBranches }) => {
          getBranches().then(branches => {
            const matched = branches.find(b => b.id === device.branchId);
            if (matched) setCurrentBranchName(matched.name);
          });
        });
      } catch (e) {
        console.error('Failed to parse currentDevice info', e);
      }
    }

    const handleEventCodeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const code = customEvent.detail?.eventCode || '';
      setActiveEventCode(code);
    };

    window.addEventListener('eventCode:change', handleEventCodeChange);
    return () => {
      window.removeEventListener('eventCode:change', handleEventCodeChange);
    };
  }, []);

  // 실시간 대기열 구독 이펙트
  useEffect(() => {
    if (!currentBranchId) return;
    
    const unsubscribe = subscribeWaitingList(
      currentBranchId,
      activeEventCode || null,
      (list) => {
        setWaitingList(list);
      }
    );
    
    return () => unsubscribe();
  }, [currentBranchId, activeEventCode]);

  // 실시간 대기열에서 중복(이름, 연락처, 나이, 성별 일치) 제거한 리스트
  const uniqueWaitingList = waitingList.filter((member, index, self) =>
    self.findIndex(m => 
      m.name === member.name && 
      m.phone === member.phone && 
      m.age === member.age && 
      m.gender === member.gender
    ) === index
  );

  // 대기자 삭제 처리 (동일 정보를 가진 중복 대기자 일괄 삭제)
  const handleDeleteWaiting = async (e: React.MouseEvent, member: WaitingMember) => {
    e.stopPropagation(); // 카드 클릭 시의 측정 개시 이벤트 전파 방지
    
    if (!window.confirm(`${member.name} 님의 대기 정보를 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      const duplicates = waitingList.filter(m => 
        m.name === member.name && 
        m.phone === member.phone && 
        m.age === member.age && 
        m.gender === member.gender
      );
      
      const deletePromises = duplicates.map(m => deleteWaitingMember(m.id));
      const results = await Promise.all(deletePromises);
      
      if (results.every(res => res)) {
        setToast({ isVisible: true, message: '대기 정보가 성공적으로 삭제되었습니다.', type: 'success' });
      } else {
        setToast({ isVisible: true, message: '일부 대기 정보 삭제에 실패했습니다.', type: 'error' });
      }
    } catch (err) {
      console.error('대기 삭제 오류:', err);
      setToast({ isVisible: true, message: '대기 정보 삭제 중 오류가 발생했습니다.', type: 'error' });
    }
  };

  // 팔 올리기 수동 확인 모달
  const [armRaiseInputModal, setArmRaiseInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualArmRaiseGrade, setManualArmRaiseGrade] = useState<string>('');

  // 유연성 수동 확인 모달
  const [flexInputModal, setFlexInputModal] = useState<{ isOpen: boolean, dataUrl: string, postureData: any }>({ isOpen: false, dataUrl: '', postureData: null });
  const [manualFlexGrade, setManualFlexGrade] = useState<string>('');

  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [showDeviceSelect, setShowDeviceSelect] = useState(false);
  const [eyesClosed, setEyesClosed] = useState(true); // 균형 테스트 눈 상태 (기본: 눈 감음)
  // 사진 확인(미리보기) 상태 (originalDataUrl: Gemini 분석용 원본, dataUrl: 화면 표시용/합성 가능)
  const [previewData, setPreviewData] = useState<{ dataUrl: string; originalDataUrl: string; metadata?: any; validationResult?: { passed: boolean; message: string } | null } | null>(null);
  const [targetStepAfterUserInfo, setTargetStepAfterUserInfo] = useState<AssessmentStep | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => {});
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    };
    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
  }, []);

  const getStepGuidance = (currentStep: AssessmentStep | 'HISTORY' | 'INTRO') => {
    switch (currentStep) {
      case AssessmentStep.INTRO:
        return `${BRAND_NAME} ${SUB_NAME} 시스템입니다.`;
      case AssessmentStep.USER_INFO:
        return "측정 대상자의 정보를 입력해 주세요.";
      case AssessmentStep.POSTURE_FRONT:
        return "정면 전체 몸이 나오도록 서주세요.";
      case AssessmentStep.POSTURE_SIDE:
        return "옆으로 서서 몸의 중심을 맞춰주세요.";
      case AssessmentStep.BALANCE_TEST:
        return "눈을 감고 한 발로 서서 균형을 유지하세요.";
      case AssessmentStep.BRAIN_MEMORY:
        return "10초 동안 장볼 물건들을 기억하고, 손으로 골라 담아주세요.";
      case AssessmentStep.FACE_ANALYSIS:
        return "얼굴을 화면 중앙에 맞추고 밝은 표정을 지어주세요.";
      case AssessmentStep.SEVEN_CODE_CHECK:
        return "최근 자주 느끼는 증상과 감정을 선택해 주세요.";
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
      setStep(AssessmentStep.INTRO);
    };
    const handleNavHistory = () => {
      setTargetStepAfterUserInfo(null);
      setStep('HISTORY');
    };
    const handleNavFaceAnalysis = () => {
      if (!userInfo) {
        setTargetStepAfterUserInfo(AssessmentStep.FACE_ANALYSIS);
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(AssessmentStep.FACE_ANALYSIS);
    };
    const handleNavKFace = () => {
      if (!userInfo) {
        setTargetStepAfterUserInfo(AssessmentStep.KFACE);
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(AssessmentStep.KFACE);
    };
    const handleNavKTarot = () => {
      if (!userInfo) {
        setTargetStepAfterUserInfo(('KTAROT' as any));
        setStep(AssessmentStep.USER_INFO);
        return;
      }
      setStep(('KTAROT' as any));
    };

    window.addEventListener('nav:home', handleNavHome);
    window.addEventListener('nav:history', handleNavHistory);
    window.addEventListener('nav:face_analysis', handleNavFaceAnalysis);
    window.addEventListener('nav:kface', handleNavKFace);
    window.addEventListener('nav:ktarot', handleNavKTarot);

    return () => {
      window.removeEventListener('nav:home', handleNavHome);
      window.removeEventListener('nav:history', handleNavHistory);
      window.removeEventListener('nav:face_analysis', handleNavFaceAnalysis);
      window.removeEventListener('nav:kface', handleNavKFace);
      window.removeEventListener('nav:ktarot', handleNavKTarot);
    };
  }, [userInfo]);

  useEffect(() => {
    // Only handle other startup tasks here, the TTS for intro is handled by getStepGuidance in the other useEffect
  }, [hasStarted]);

  const testSteps = [
    AssessmentStep.SEVEN_CODE_CHECK,
    AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE,
    AssessmentStep.BALANCE_TEST, AssessmentStep.BRAIN_MEMORY,
    AssessmentStep.FACE_ANALYSIS, AssessmentStep.ANALYZING
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
          // 0~30초: 0→80%, 30~60초: 80→95%, 60~90초: 95→99%
          if (elapsed < 30) return Math.min(prev + 2.5, 80);
          if (elapsed < 60) return Math.min(prev + 0.5, 95);
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

  const handleUserSubmit = (info: UserInfo) => {
    setUserInfo(info);
    // 새 측정 시작 시 이전 데이터 초기화 (이력 열람 후 재측정 시 중복 방지)
    setCapturedImages([]);
    setReport(null);
    // 사전접수든 원스톱이든 무조건 개인 정보 입력 직후에 7코드 설문 점검을 먼저 수행합니다.
    setStep(AssessmentStep.SEVEN_CODE_CHECK);
  };

  const handleCapture = (dataUrl: string, autoReps?: number, metadata?: any) => {
    // autoReps(number)와 metadata(object)를 하나의 객체로 병합하여 저장
    const mergedMetadata = { ...metadata, reps: autoReps };
    // 촬영 후 미리보기 화면으로 전환 (originalDataUrl은 Gemini 분석용 원본 보존)
    setPreviewData({ dataUrl, originalDataUrl: dataUrl, metadata: mergedMetadata, validationResult: null });
    speak("촬영이 완료되었습니다.");

    // 사후 검증: 1, 2, 4, 5단계(정지 촬영)에서만 전신 체크
    const requiresValidation = [
      AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE
    ].includes(step as AssessmentStep);

    if (requiresValidation) {
      // 캡처된 이미지를 캔버스에 그려서 MoveNet으로 검증
      const img = new Image();
      img.onload = async () => {
        try {
          await import('@tensorflow/tfjs-core');
          await import('@tensorflow/tfjs-backend-webgl');
          const poseDetection = await import('@tensorflow-models/pose-detection');
          
          // 모델 생성
          let detector: any;
          try {
            detector = await poseDetection.createDetector(
              poseDetection.SupportedModels.MoveNet,
              { modelType: (poseDetection as any).movenet.modelType.SINGLEPOSE_THUNDER } // 정확도를 위해 Thunder 모델 사용
            );
          } catch {
            // 모델 로드 실패 시 검증 생략하고 통과
            setPreviewData(prev => prev ? { ...prev, validationResult: { passed: true, message: '' } } : null);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          
          const poses = await detector.estimatePoses(canvas);
          detector.dispose();
          
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
              if (currentStep !== ('FLEXIBILITY_TEST' as any)) {
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
                  if (torsoHeight < imgH * 0.08 && currentStep !== ('ARM_RAISE_TEST' as any)) {
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
              const isFrontView = currentStep === AssessmentStep.POSTURE_FRONT;

              // ── ① 배경 블러 (인체만 선명하게) ──
              const visKps = kps.filter(kp => (kp.score || 0) > 0.2);
              if (visKps.length > 2) {
                const xs = visKps.map(kp => kp.x);
                const ys = visKps.map(kp => kp.y);
                const padX = w * 0.1, padTop = h * 0.08, padBot = h * 0.05;
                const bL = Math.max(0, Math.min(...xs) - padX);
                const bT = Math.max(0, Math.min(...ys) - padTop);
                const bR = Math.min(w, Math.max(...xs) + padX);
                const bB = Math.min(h, Math.max(...ys) + padBot);
                const bCx = (bL + bR) / 2, bCy = (bT + bB) / 2;
                const bRx = (bR - bL) / 2 * 1.15, bRy = (bB - bT) / 2 * 1.1;

                const blurC = document.createElement('canvas');
                blurC.width = w; blurC.height = h;
                const bCtx = blurC.getContext('2d')!;
                bCtx.filter = 'blur(14px) brightness(0.4)';
                bCtx.drawImage(canvas, 0, 0);
                bCtx.filter = 'none';
                // 인체 영역 잘라내기 (페더링)
                bCtx.globalCompositeOperation = 'destination-out';
                const fg = bCtx.createRadialGradient(bCx, bCy, Math.min(bRx, bRy) * 0.5, bCx, bCy, Math.max(bRx, bRy));
                fg.addColorStop(0, 'rgba(0,0,0,1)');
                fg.addColorStop(0.65, 'rgba(0,0,0,0.95)');
                fg.addColorStop(1, 'rgba(0,0,0,0)');
                bCtx.fillStyle = fg;
                bCtx.beginPath();
                bCtx.ellipse(bCx, bCy, bRx, bRy, 0, 0, Math.PI * 2);
                bCtx.fill();
                bCtx.globalCompositeOperation = 'source-over';
                ctx.drawImage(blurC, 0, 0);
              }

              // ── ② 그리드 패턴 ──
              ctx.strokeStyle = 'rgba(100,200,255,0.06)';
              ctx.lineWidth = 0.5;
              for (let gx = 0; gx < w; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
              for (let gy = 0; gy < h; gy += 30) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
              ctx.strokeStyle = 'rgba(100,200,255,0.12)';
              ctx.lineWidth = 1;
              for (let gx = 0; gx < w; gx += 120) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
              for (let gy = 0; gy < h; gy += 120) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

              // ── ③ 스켈레톤 연결선 ──
              const connections = [
                ['left_shoulder', 'right_shoulder'],
                ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
                ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
                ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
                ['left_hip', 'right_hip'],
                ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
                ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
              ];
              connections.forEach(([a, b]) => {
                const kpA = getKp(a); const kpB = getKp(b);
                if (kpA && kpB && (kpA.score || 0) > 0.15 && (kpB.score || 0) > 0.15) {
                  ctx.save();
                  ctx.shadowColor = 'rgba(0,255,170,0.8)'; ctx.shadowBlur = 14;
                  ctx.strokeStyle = 'rgba(0,255,170,0.7)'; ctx.lineWidth = 3;
                  ctx.beginPath(); ctx.moveTo(kpA.x, kpA.y); ctx.lineTo(kpB.x, kpB.y); ctx.stroke();
                  ctx.restore();
                  ctx.strokeStyle = 'rgba(180,255,230,0.9)'; ctx.lineWidth = 1.5;
                  ctx.beginPath(); ctx.moveTo(kpA.x, kpA.y); ctx.lineTo(kpB.x, kpB.y); ctx.stroke();
                }
              });

              // ── ④ 관절 포인트 ──
              kps.forEach(kp => {
                if ((kp.score || 0) > 0.15) {
                  ctx.save();
                  ctx.shadowColor = 'rgba(0,200,255,0.9)'; ctx.shadowBlur = 15;
                  ctx.fillStyle = 'rgba(0,200,255,0.8)';
                  ctx.beginPath(); ctx.arc(kp.x, kp.y, 7, 0, Math.PI * 2); ctx.fill();
                  ctx.restore();
                  ctx.fillStyle = 'rgba(255,255,255,0.95)';
                  ctx.beginPath(); ctx.arc(kp.x, kp.y, 3.5, 0, Math.PI * 2); ctx.fill();
                }
              });

              // 라벨 배지 헬퍼
              const drawLabel = (text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
                ctx.save();
                ctx.font = 'bold 11px monospace'; ctx.textAlign = align;
                const tw = ctx.measureText(text).width + 14;
                const lx = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
                ctx.fillStyle = 'rgba(0,10,30,0.8)';
                ctx.beginPath();
                const r = 4; const ly = y - 10; const lh = 20;
                ctx.moveTo(lx + r, ly); ctx.lineTo(lx + tw - r, ly);
                ctx.arcTo(lx + tw, ly, lx + tw, ly + r, r); ctx.arcTo(lx + tw, ly + lh, lx + tw - r, ly + lh, r);
                ctx.arcTo(lx, ly + lh, lx, ly + lh - r, r); ctx.arcTo(lx, ly, lx + r, ly, r);
                ctx.fill();
                ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
                ctx.fillStyle = color;
                ctx.fillText(text, lx + 7, y + 4);
                ctx.restore();
              };

              // ── ⑤ 정면(FRONT) 측정 어노테이션 ──
              if (isFrontView) {
                const ls = getKp('left_shoulder'), rs = getKp('right_shoulder');
                const lh2 = getKp('left_hip'), rh2 = getKp('right_hip');
                // 어깨 수평선 + 기울기
                if (ls && rs && (ls.score || 0) > 0.2 && (rs.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([8, 6]);
                  ctx.strokeStyle = 'rgba(255,200,50,0.8)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(Math.max(0, ls.x - 40), ls.y); ctx.lineTo(Math.min(w, rs.x + 40), rs.y); ctx.stroke();
                  ctx.restore();
                  const sAngle = Math.abs(Math.atan2(rs.y - ls.y, rs.x - ls.x) * (180 / Math.PI));
                  const sColor = sAngle < 2 ? 'rgba(52,211,153,0.95)' : sAngle < 5 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  const sMx = (ls.x + rs.x) / 2, sMy = Math.min(ls.y, rs.y) - 20;
                  drawLabel(`어깨 기울기 ${sAngle.toFixed(1)}°`, sMx, sMy, sColor, 'center');
                  const hDiff = Math.abs(ls.y - rs.y);
                  if (hDiff > 5) {
                    const side = ls.y < rs.y ? '좌' : '우';
                    drawLabel(`${side}측 어깨 높음`, sMx, sMy - 22, sColor, 'center');
                  }
                }
                // 골반 수평선 + 기울기
                if (lh2 && rh2 && (lh2.score || 0) > 0.2 && (rh2.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([8, 6]);
                  ctx.strokeStyle = 'rgba(255,100,100,0.8)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(Math.max(0, lh2.x - 40), lh2.y); ctx.lineTo(Math.min(w, rh2.x + 40), rh2.y); ctx.stroke();
                  ctx.restore();
                  const hAngle = Math.abs(Math.atan2(rh2.y - lh2.y, rh2.x - lh2.x) * (180 / Math.PI));
                  const hColor = hAngle < 2 ? 'rgba(52,211,153,0.95)' : hAngle < 5 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  drawLabel(`골반 기울기 ${hAngle.toFixed(1)}°`, (lh2.x + rh2.x) / 2, Math.max(lh2.y, rh2.y) + 25, hColor, 'center');
                }
                // 중심축
                const nose = getKp('nose');
                if (nose && (nose.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([12, 8]);
                  ctx.strokeStyle = 'rgba(100,150,255,0.4)'; ctx.lineWidth = 1.5;
                  ctx.beginPath(); ctx.moveTo(nose.x, Math.max(0, nose.y - 40));
                  ctx.lineTo(nose.x, Math.min(h, (lh2?.y || h * 0.7) + 80));
                  ctx.stroke(); ctx.restore();
                }
              }

              // ── ⑥ 측면(SIDE) 측정 어노테이션 ──
              if (!isFrontView) {
                // 가장 잘 보이는 귀와 어깨 찾기
                const lEar = getKp('left_ear'), rEar = getKp('right_ear');
                const ear = (lEar && rEar) ? ((lEar.score || 0) > (rEar.score || 0) ? lEar : rEar) : (lEar || rEar);
                const lS = getKp('left_shoulder'), rS = getKp('right_shoulder');
                const shoulder = (lS && rS) ? ((lS.score || 0) > (rS.score || 0) ? lS : rS) : (lS || rS);
                const lH = getKp('left_hip'), rH = getKp('right_hip');
                const hip = (lH && rH) ? ((lH.score || 0) > (rH.score || 0) ? lH : rH) : (lH || rH);
                const lK = getKp('left_knee'), rK = getKp('right_knee');
                const knee = (lK && rK) ? ((lK.score || 0) > (rK.score || 0) ? lK : rK) : (lK || rK);
                const lA = getKp('left_ankle'), rA = getKp('right_ankle');
                const ankle = (lA && rA) ? ((lA.score || 0) > (rA.score || 0) ? lA : rA) : (lA || rA);

                // 이상적 중력선 (Plumb Line): 귀→발목 수직 기준선
                if (ear && ankle && (ear.score || 0) > 0.2 && (ankle.score || 0) > 0.2) {
                  ctx.save(); ctx.setLineDash([10, 6]);
                  ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 2;
                  ctx.beginPath(); ctx.moveTo(ankle.x, Math.max(0, ear.y - 30)); ctx.lineTo(ankle.x, ankle.y + 20);
                  ctx.stroke(); ctx.restore();
                  drawLabel('Plumb Line', ankle.x + 10, ankle.y - 30, 'rgba(100,200,255,0.9)');
                }
                // 전방 두부 각도 (Forward Head Angle) — 거북목 지표
                if (ear && shoulder && (ear.score || 0) > 0.2 && (shoulder.score || 0) > 0.2) {
                  const fha = Math.abs(Math.atan2(ear.x - shoulder.x, shoulder.y - ear.y) * (180 / Math.PI));
                  const fhaColor = fha < 5 ? 'rgba(52,211,153,0.95)' : fha < 15 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  const fhaLabel = fha < 5 ? '정상' : fha < 15 ? '경미한 전방두부' : '거북목 주의';
                  // 귀-어깨 연결선
                  ctx.save();
                  ctx.strokeStyle = fhaColor; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
                  ctx.beginPath(); ctx.moveTo(ear.x, ear.y); ctx.lineTo(shoulder.x, shoulder.y); ctx.stroke();
                  ctx.restore();
                  drawLabel(`FHA ${fha.toFixed(1)}° ${fhaLabel}`, Math.min(ear.x, shoulder.x) - 10, (ear.y + shoulder.y) / 2, fhaColor, 'right');
                }
                // 상체 전경 각도 (어깨-골반)
                if (shoulder && hip && (shoulder.score || 0) > 0.2 && (hip.score || 0) > 0.2) {
                  const trunkAngle = Math.abs(Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * (180 / Math.PI));
                  const tColor = trunkAngle < 3 ? 'rgba(52,211,153,0.95)' : trunkAngle < 8 ? 'rgba(251,191,36,0.95)' : 'rgba(239,68,68,0.95)';
                  drawLabel(`흉추 ${trunkAngle.toFixed(1)}°`, Math.max(shoulder.x, hip.x) + 15, (shoulder.y + hip.y) / 2, tColor);
                }
              }

              // ── ⑦ 하단 정보 바 ──
              const barH = 36;
              ctx.fillStyle = 'rgba(0,10,30,0.85)';
              ctx.fillRect(0, h - barH, w, barH);
              ctx.strokeStyle = 'rgba(0,255,170,0.5)'; ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(0, h - barH); ctx.lineTo(w, h - barH); ctx.stroke();
              ctx.font = 'bold 12px monospace';
              ctx.fillStyle = 'rgba(0,255,170,0.9)'; ctx.textAlign = 'left';
              ctx.fillText(`AI BODY SCAN · ${visibleCount}/17 joints`, 10, h - 12);
              ctx.fillStyle = 'rgba(100,200,255,0.9)'; ctx.textAlign = 'right';
              ctx.fillText('BTC 3-BODY AI ANALYZER', w - 10, h - 12);

              // 합성된 이미지로 교체
              const analyzedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
              setPreviewData(prev => prev ? { ...prev, dataUrl: analyzedDataUrl, validationResult: { passed: true, message: `AI가 ${visibleCount}개 관절을 인식했습니다. 분석에 적합합니다.` } } : null);
            } else {
              setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: '전신이 충분히 나오지 않았습니다. 뒤로 물러나서 재촬영해 주세요.' } } : null);
              speak("전신이 충분히 나오지 않았습니다. 재촬영해 주세요.");
            }
          } else {
            // Thunder 모델도 감지하지 못할 경우, 강제로 수동 패스할 수 있도록 안내 (차단하지 않음)
            setPreviewData(prev => prev ? { ...prev, validationResult: { passed: false, message: 'AI가 사람을 명확히 인식하지 못했습니다. 사진이 정상이면 수동으로 다음 단계로 넘어가세요.' } } : null);
            speak("사람이 명확히 감지되지 않았습니다. 사진을 확인하고 수동으로 넘어가거나 재촬영해 주세요.");
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

    // 팔 올리기 단계 (수동 확인 모달)
    if (step === ('ARM_RAISE_TEST' as any)) {
      const defaultGrade = postureData?.armRaiseGrade || '보통 (135도)';
      setManualArmRaiseGrade(defaultGrade);
      setArmRaiseInputModal({ isOpen: true, dataUrl: originalDataUrl, postureData });
      return;
    }

    // 유연성 단계 (수동 확인 모달)
    if (step === ('FLEXIBILITY_TEST' as any)) {
      const defaultGrade = postureData?.flexGrade || '보통 (정강이 중간)';
      setManualFlexGrade(defaultGrade);
      setFlexInputModal({ isOpen: true, dataUrl: originalDataUrl, postureData });
      return;
    }
    // 자세 단계(FRONT/SIDE)는 합성 이미지를 리포트용으로, 원본을 Gemini용으로 분리
    const isPostureStep = [AssessmentStep.POSTURE_FRONT, AssessmentStep.POSTURE_SIDE].includes(step as AssessmentStep);
    const displayDataUrl = isPostureStep ? (previewData.dataUrl || originalDataUrl) : originalDataUrl;
    
    proceedToNextStep(step as AssessmentStep, displayDataUrl, reps, footDrops, swayScore, formScore, eyesClosedVal, kneeAssisted, postureData, undefined, isPostureStep ? originalDataUrl : undefined);
  };

  // 미리보기에서 '재촬영' → 미리보기 닫고 현재 단계 유지
  const retakeCapture = () => {
    setPreviewData(null);
    speak("다시 촬영합니다. 준비해 주세요.");
  };

  const proceedToNextStep = (currentStep: AssessmentStep, dataUrl: string, reps?: number, footDrops?: number, swayScore?: number, formScore?: number, eyesClosedVal?: boolean, kneeAssisted?: boolean, postureData?: any, brainTestData?: BrainTestData, originalDataUrl?: string) => {
    const newImage: CapturedImage = { step: currentStep, dataUrl, reps, formScore, postureData };
    if (originalDataUrl) {
      newImage.originalDataUrl = originalDataUrl;
    }
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

    const steps = Object.values(AssessmentStep);
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];

    if (nextStep === AssessmentStep.READY_FOR_ANALYSIS) {
      setStep(nextStep as AssessmentStep);
      speak("모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.");
    } else if (nextStep === AssessmentStep.ANALYZING) {
      runAnalysis(newImages);
    } else {
      setStep(nextStep as AssessmentStep);
    }
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
    proceedToNextStep(('ARM_RAISE_TEST' as any), dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  // 유연성 수동 검증 완료
  const handleFlexSubmit = () => {
    const { dataUrl, postureData } = flexInputModal;
    // 사용자가 수정한 등급을 postureData에 덮어씀
    const updatedPostureData = { ...postureData, flexGrade: manualFlexGrade };
    setFlexInputModal({ isOpen: false, dataUrl: '', postureData: null });
    proceedToNextStep(('FLEXIBILITY_TEST' as any), dataUrl, undefined, undefined, undefined, undefined, undefined, undefined, updatedPostureData);
  };

  const runAnalysis = async (images: CapturedImage[]) => {
    if (!userInfo) return;
    setStep(AssessmentStep.ANALYZING);
    speak("이 분석은 브레인트레이닝센터와 연구원, 대학교 등 전문가들이 연구, 개발하였고, 최신 AI 기술을 접목하여 개발한 프로그램입니다. 본 시스템은 건강 관리에 도움을 주고자 자세, 동작, 기억력 등을 측정하는 웰니스 프로그램으로서, 의료적 진단과는 무관합니다. 데이터 분석에 약 1분 정도 소요됩니다.");
    setIsAnalyzing(true);
    try {
      // For AI analysis, use original (un-overlaid) images for accuracy
      const aiOptimizedImages = await Promise.all(images.map(async (img) => ({
        ...img,
        dataUrl: await resizeImage(img.originalDataUrl || img.dataUrl, 800)
      })));

      const result = await analyzeHealth(userInfo, aiOptimizedImages);
      setReport(result);
      speak("분석 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.");
      
      // Attempt to save to history, but don't crash if it fails
      // pending 레코드 삭제 후 최종 report로 저장
      if (pendingRecordId) {
        try { await deleteRecordLocally(pendingRecordId); } catch (e) { console.warn('[DB] pending 삭제 실패:', e); }
        setPendingRecordId(null);
      }
      await saveRecord(result, images);
      
      // 대기열 측정 진행 완료 시 Firestore 상태를 completed로 갱신
      if (activeWaitingId) {
        try {
          await updateWaitingStatus(activeWaitingId, 'completed');
        } catch (e) {
          console.warn('[EventService] 대기자 상태 완료 처리 실패', e);
        }
        // 대기자 관련 상태 리셋
        setActiveWaitingId(null);
        setIsWaitingMemberActive(false);
      }
      
      setStep(AssessmentStep.REPORT);
    } catch (error) {
      console.error("Analysis Error:", error);
      const isQuotaError = error instanceof Error && (error.message.includes('quota') || error.message.includes('429') || error.message.includes('depleted') || error.message.includes('prepayment'));
      
      setErrorModal({ 
        isOpen: true, 
        message: isQuotaError 
          ? "현재 AI 분석 요청이 너무 많아 일시적으로 처리가 지연되고 있습니다. 잠시 후 '분석 재시작' 버튼을 누르시면 안전하게 저장된 사진들로 다시 분석을 진행합니다."
          : `AI 분석 서버와 통신 중 일시적인 오류가 발생했습니다.\n(상세 에러: ${error instanceof Error ? error.message : JSON.stringify(error)})\n\n촬영하신 5단계 사진과 데이터는 기기에 안전하게 저장되어 있습니다. 아래 '분석 재시작' 버튼을 눌러주시면 처음부터 다시 촬영할 필요 없이 즉시 분석을 재개합니다.`,
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
              {userInfo && (
                <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span>👤</span>
                  <span>{userInfo.name}</span>
                  <span className="text-amber-400/60">|</span>
                  <span>{userInfo.gender === 'male' ? '남' : '여'}</span>
                  <span className="text-amber-400/60">|</span>
                  <span>{userInfo.age}세</span>
                </div>
              )}
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
                  setCapturedImages(rec.images);
                  setStep(AssessmentStep.REPORT);
                }}
                onResumeAnalysis={(rec) => {
                  if (rec.report?.userInfo) {
                    setUserInfo(rec.report.userInfo);
                  }
                  setCapturedImages(rec.images || []);
                  setPendingRecordId(rec.id);
                  setStep(AssessmentStep.ANALYZING);
                  runAnalysis(rec.images || []);
                }}
                onClose={() => setStep(AssessmentStep.INTRO)} 
             />;
    }



    // ───── 건강 니즈 파악 페이지 (7코드 완료 후 표시) ─────
    const HEALTH_NEEDS_OPTIONS = [
      '잠을 잘 자고 싶다', '스트레스를 해소하고 싶다', '감정을 관리하고 싶다',
      '멘탈을 관리하고 싶다', '집중력을 높이고 싶다', '인간관계를 개선하고 싶다',
      '체력을 키우고 싶다', '통증을 완화하고 싶다', '다이어트를 하고 싶다',
      '화를 다스리고 싶다', '젊어지고 싶다', '행복해지고 싶다'
    ];

    if (showHealthNeeds) {
      const handleHealthNeedsComplete = async () => {
        const finalNeeds = [...selectedHealthNeeds];
        if (customHealthNeed.trim()) {
          finalNeeds.push(customHealthNeed.trim());
        }
        // userInfo에 healthNeeds 저장
        if (userInfo) {
          setUserInfo({ ...userInfo, healthNeeds: finalNeeds });
        }
        setShowHealthNeeds(false);

        if (isReceptionOnly && pendingSevenCodeData) {
          // 사전접수 모드: 대기열 등록
          try {
            if (userInfo) {
              await addToWaitingList({
                name: userInfo.name,
                phone: userInfo.phone || '',
                age: userInfo.age,
                gender: userInfo.gender,
                memberType: userInfo.memberType,
                birthDate: userInfo.birthDate,
                sevenCodeKeywords: pendingSevenCodeData.keywords,
                weakestCode: pendingSevenCodeData.weakestCode,
                branchId: currentBranchId,
                eventCode: activeEventCode || undefined,
                isStarred: false,
                healthNeeds: finalNeeds
              });
              setToast({ isVisible: true, message: '대기 등록이 완료되었습니다. 순서대로 점검을 진행해 드립니다.', type: 'success' });
            }
          } catch (err) {
            console.error('대기열 등록 중 오류가 발생했습니다.', err);
            setToast({ isVisible: true, message: '대기 등록에 실패했습니다. 관리자에게 문의해 주세요.', type: 'error' });
          }
          setStep(AssessmentStep.INTRO);
          setCapturedImages([]);
          setReport(null);
          setUserInfo(null);
          setIsReceptionOnly(false);
        } else if (pendingSevenCodeData) {
          // 원스톱 모드: 다음 측정 단계로 진행
          proceedToNextStep(AssessmentStep.SEVEN_CODE_CHECK, '', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
          setCapturedImages(prev => {
            const newArr = [...prev];
            const idx = newArr.findIndex(i => i.step === AssessmentStep.SEVEN_CODE_CHECK);
            if (idx >= 0) {
              newArr[idx].sevenCodeKeywords = pendingSevenCodeData.keywords;
              newArr[idx].weakestCode = pendingSevenCodeData.weakestCode;
            }
            return newArr;
          });
        }
        setPendingSevenCodeData(null);
      };

      const toggleHealthNeed = (need: string) => {
        setSelectedHealthNeeds(prev =>
          prev.includes(need) ? prev.filter(n => n !== need) : [...prev, need]
        );
      };

      return (
        <div className="flex-1 flex flex-col items-center h-[calc(100vh-80px)] p-4 mx-auto max-w-5xl transition-all bg-slate-900">
          <div className="text-center mb-4 shrink-0">
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">현재 내가 바라는 건강에 대한 주요 관심</h2>
            <p className="text-gray-300 text-base sm:text-lg font-bold">
              몸과 마음, 뇌 건강에 대해 원하시는 것이 있다면 선택해 주세요.
            </p>
            <p className="text-gray-400 text-sm sm:text-base font-medium mt-1">
              복수 선택 가능하며, 목록에 없는 경우 직접 입력할 수 있습니다.
            </p>
          </div>

          {/* 진행 바 */}
          <div className="w-full h-3 bg-gray-800 rounded-full mb-4 shrink-0">
            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-full shadow-[0_0_15px_rgba(245,158,11,0.6)]" />
          </div>

          {/* 니즈 선택 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full flex-1 min-h-0 content-center overflow-y-auto">
            {HEALTH_NEEDS_OPTIONS.map(need => {
              const isSelected = selectedHealthNeeds.includes(need);
              return (
                <button
                  key={need}
                  onClick={() => toggleHealthNeed(need)}
                  className={`p-5 md:p-6 rounded-2xl text-lg md:text-xl font-black transition-all duration-200 transform hover:scale-[1.02] active:scale-95 leading-snug break-keep ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 border-white/30'
                      : 'bg-gray-800 text-gray-200 hover:bg-gray-700 border-2 border-gray-700 hover:border-gray-500 shadow-lg'
                  }`}
                >
                  {need}
                </button>
              );
            })}
          </div>

          {/* 직접 입력 */}
          <div className="w-full max-w-2xl mt-4 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={customHealthNeed}
                onChange={(e) => setCustomHealthNeed(e.target.value)}
                placeholder="기타 원하시는 건강 목표를 입력하세요"
                className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-white border-2 border-gray-700 focus:border-amber-500 outline-none text-base font-bold placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* 선택 현황 및 완료 버튼 */}
          <div className="flex justify-between items-center w-full max-w-2xl mt-3 pb-2 shrink-0">
            <span className="text-slate-500 text-sm font-medium">
              선택: <span className="text-amber-400 font-black text-base">{selectedHealthNeeds.length + (customHealthNeed.trim() ? 1 : 0)}개</span>
            </span>
          </div>
          <div className="flex justify-between w-full max-w-2xl gap-3 pb-2 shrink-0">
            <button
              onClick={() => {
                setShowHealthNeeds(false);
                setStep(AssessmentStep.SEVEN_CODE_CHECK);
              }}
              className="flex-1 px-6 py-4 rounded-2xl text-xl font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors shadow-lg"
            >
              <i className="fas fa-arrow-left mr-2" /> 이전
            </button>
            <button
              onClick={handleHealthNeedsComplete}
              className="flex-1 px-10 py-4 rounded-2xl text-xl font-black transition-all shadow-xl hover:shadow-amber-500/40 active:scale-95 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
            >
              <i className="fas fa-check-circle mr-2" /> {isReceptionOnly ? '접수 완료' : '다음 단계로'}
            </button>
          </div>
        </div>
      );
    }

    switch (step) {
      case AssessmentStep.INTRO:
        return (
          <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900 w-full h-full">
            <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '3s' }}></div>

            <div className="relative z-10 max-w-lg w-full p-8 md:p-10 rounded-[2.5rem] text-center border border-white/10"
                style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(40px)',
                  boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                }}>
              
              {/* 연합 행사 진행 상태 배지 */}
              {activeEventCode && (
                <div className="mb-6 inline-flex flex-col sm:flex-row items-center gap-3 px-5 py-2.5 bg-slate-900/90 border-2 border-indigo-500/60 rounded-3xl text-sm font-black text-white shadow-xl shadow-indigo-950/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-indigo-300 font-bold">야외 연합 행사 진행 중</span>
                  </div>
                  <div className="hidden sm:block text-slate-700">|</div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-base text-yellow-400 tracking-wider font-extrabold">{activeEventCode}</span>
                    <span className="px-2.5 py-1 bg-indigo-950 border border-indigo-500/30 text-xs font-extrabold rounded-xl text-indigo-200">
                      👥 참가 대기: <strong className="text-white text-sm font-black">{uniqueWaitingList.length}</strong>명
                    </span>
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-video mx-auto mb-6 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <img src="/banner.png" alt="Hero" className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-fuchsia-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                  야외 부스 멀티 2.0
                </div>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight drop-shadow-sm">
                {BRAND_NAME}
              </h2>
              <p className="text-slate-400 mb-6 text-xs font-medium">
                {SUB_NAME}
              </p>

              {/* 4대 유연 동선 버튼 레이아웃 개편 */}
              <div className="flex flex-col gap-3 filter drop-shadow-xl">
                {/* 1. 즉석 통합 시작 (기존 All-in-One) */}
                <button 
                  onClick={() => {
                    initAudio().catch(() => {});
                    setIsReceptionOnly(false);
                    setIsWaitingMemberActive(false);
                    setActiveWaitingId(null);
                    setStep(AssessmentStep.USER_INFO);
                  }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all flex items-center justify-center gap-2.5 text-[15px] shadow-lg shadow-indigo-650/30 active:scale-[0.99]"
                >
                  <i className="fas fa-running text-sm"></i> 바로 측정 시작하기 (원스톱) <i className="fas fa-chevron-right text-xs"></i>
                </button>

                {/* 2. 사전 접수 등록 */}
                <button 
                  onClick={() => {
                    initAudio().catch(() => {});
                    setIsReceptionOnly(true);
                    setIsWaitingMemberActive(false);
                    setActiveWaitingId(null);
                    setStep(AssessmentStep.USER_INFO);
                  }}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all flex items-center justify-center gap-2.5 text-sm shadow-lg shadow-emerald-650/20 active:scale-[0.99]"
                >
                  <i className="fas fa-user-plus text-sm"></i> 사전 접수 등록 (7코드 선점검)
                </button>

                {/* 3. 대기 리스트 불러오기 */}
                <button 
                  onClick={() => {
                    initAudio().catch(() => {});
                    setShowWaitingModal(true);
                  }}
                  className="w-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-bold py-3.5 rounded-xl hover:bg-indigo-900/60 transition-all flex items-center justify-center gap-2.5 text-sm active:scale-[0.99] relative"
                >
                  <i className="fas fa-list-ol"></i> 대기 리스트 불러오기
                  {uniqueWaitingList.length > 0 ? (
                    <span className="absolute right-4 bg-indigo-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce">
                      {uniqueWaitingList.length}
                    </span>
                  ) : (
                    <span className="absolute right-4 text-[10px] text-slate-500 font-bold">비어있음</span>
                  )}
                </button>

                {/* 4. 완료 결과 상담 */}
                <button 
                  onClick={() => setStep('HISTORY')}
                  className="w-full bg-slate-800/80 border border-slate-700 text-slate-300 font-bold py-3.5 rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2.5 text-sm active:scale-[0.99]"
                >
                  <i className="fas fa-comments"></i> 완료 결과 조회 (전문 상담)
                </button>
                
                {/* K-관상 / K-타로 버튼 제거됨 */}
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



      case AssessmentStep.BRAIN_MEMORY:
        return <BrainTestModule key={AssessmentStep.BRAIN_MEMORY} testType={AssessmentStep.BRAIN_MEMORY} onComplete={(dataUrl, testData) => proceedToNextStep(AssessmentStep.BRAIN_MEMORY, dataUrl, testData.memorySpan, undefined, undefined, undefined, undefined, undefined, undefined, testData)} preferredCameraId={selectedDeviceId} userInfo={userInfo} />;

      case AssessmentStep.FACE_ANALYSIS:
        return renderCameraStep("측정 5단계", "안면 노화 분석", 5, <CameraModule key="face" onCapture={handleCapture} guidelineType="face" autoCapture={true} preferredDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} />);

      case AssessmentStep.KFACE:
        return <KFaceApp userInfo={userInfo} onClose={() => setStep(AssessmentStep.INTRO)} onBack={() => setStep(AssessmentStep.INTRO)} />;

      case AssessmentStep.KTAROT:
        return <KTarotApp userInfo={userInfo} onClose={() => setStep(AssessmentStep.INTRO)} onBack={() => setStep(AssessmentStep.INTRO)} />;

      case AssessmentStep.SEVEN_CODE_CHECK:
        return <SevenCodeCheckModule onComplete={async (keywords, weakestCode) => {
          // 7코드 완료 후 건강 니즈 파악 페이지로 이동 (양쪽 플로우 공통)
          setPendingSevenCodeData({ keywords, weakestCode });
          setSelectedHealthNeeds([]);
          setCustomHealthNeed('');
          setShowHealthNeeds(true);
        }} />;

      case AssessmentStep.READY_FOR_ANALYSIS:
        const stepChecklist = [
          { step: AssessmentStep.POSTURE_FRONT, icon: '📸', label: '1. 정면 자세', hasImage: true },
          { step: AssessmentStep.POSTURE_SIDE, icon: '📸', label: '2. 측면 자세', hasImage: true },
          { step: AssessmentStep.BALANCE_TEST, icon: '⚖️', label: '3. 균형 테스트', hasImage: true },
          { step: AssessmentStep.BRAIN_MEMORY, icon: '🛒', label: '4. 뇌 건강 (마트 장보기)', hasImage: false },
          { step: AssessmentStep.FACE_ANALYSIS, icon: '😊', label: '5. 얼굴 나이 분석', hasImage: true },
          { step: AssessmentStep.SEVEN_CODE_CHECK, icon: '🧩', label: '6. 7코드 건강 점검', hasImage: false },
        ];
        const isAllCompleted = stepChecklist.every(item => capturedImages.some(i => i.step === item.step));
        
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 animate-fade-in overflow-y-auto">
            <div className="w-full max-w-lg">
              <div className="text-center mb-5">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${isAllCompleted ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                  <i className={`fas ${isAllCompleted ? 'fa-check text-green-400' : 'fa-exclamation text-amber-400'} text-3xl`}></i>
                </div>
                <h3 className="text-2xl font-black text-white mb-1">
                  {isAllCompleted ? '모든 측정 완료!' : '아직 측정되지 않은 항목이 있습니다'}
                </h3>
                <p className="text-slate-400 text-xs">
                  {isAllCompleted ? '아래 측정 내역 확인 후 AI 분석을 시작하세요.' : '누락된 측정을 완료해야 AI 종합 분석이 가능합니다.'}
                </p>
              </div>

              <div className="bg-slate-800/50 rounded-2xl p-3 mb-4 border border-slate-700/50">
                <h4 className="text-white font-bold text-xs mb-2 flex items-center gap-2">
                  <i className="fas fa-clipboard-check text-emerald-400"></i> 측정 현황 내역
                </h4>
                <div className="space-y-1.5">
                  {stepChecklist.map(item => {
                    const img = capturedImages.find(i => i.step === item.step);
                    const done = !!img;
                    return (
                      <div key={item.step} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${
                        done ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/20'
                      }`} onClick={() => { if (!done) setStep(item.step); }}>
                        <span>{item.icon}</span>
                        <span className="text-white font-bold flex-1">{item.label}</span>
                        {item.hasImage && img?.dataUrl && (
                          <img src={img.dataUrl} alt="" className="w-8 h-8 rounded object-cover border border-white/20" />
                        )}
                        {!item.hasImage && img?.brainTestData?.reactionTimeMs && (
                          <span className="text-emerald-300 text-[10px] font-bold">{img.brainTestData.reactionTimeMs}ms</span>
                        )}
                        {!item.hasImage && img?.brainTestData?.memoryCorrect !== undefined && (
                          <span className="text-emerald-300 text-[10px] font-bold">{img.brainTestData.memoryCorrect}개정답</span>
                        )}
                        {item.step === ('SEVEN_CODE_CHECK' as any) && img?.sevenCodeKeywords && (
                          <span className="text-emerald-300 text-[10px] font-bold">{img.sevenCodeKeywords.length}항목</span>
                        )}
                        <span className="font-black">{done ? '✅' : '❌ 측정하기'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-indigo-900/30 border border-indigo-500/20 rounded-xl p-3 mb-5 text-center">
                <p className="text-indigo-200 text-[11px] font-bold leading-relaxed">
                  💾 분석 시작 시 측정 데이터가 자동 저장됩니다.<br/>
                  분석 오류 시에도 <strong className="text-amber-300">재측정 없이</strong> 저장된 데이터로 재분석이 가능합니다.
                </p>
              </div>

              <button 
                disabled={!isAllCompleted}
                onClick={async () => {
                  if (!isAllCompleted) return;
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
                className={`font-bold py-5 px-12 rounded-2xl transition-all active:scale-95 text-xl flex items-center gap-3 w-full justify-center ${
                  isAllCompleted
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_10px_30px_-5px_rgba(99,102,241,0.6)] cursor-pointer'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                }`}
              >
                <i className="fas fa-microchip"></i> AI 종합 분석 시작하기
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
            <p className="text-slate-400 max-w-md mx-auto text-base leading-relaxed font-medium mt-4">
              <span className="block text-indigo-200 mb-2 font-bold bg-indigo-900/40 p-3 rounded-lg border border-indigo-500/20">
                이 분석은 브레인트레이닝센터와 연구원, 대학교 등 전문가들이 연구, 개발하였고,<br/>
                최신 AI의 기술을 접목하여 개발한 프로그램입니다.<br/>
                <span className="text-[11px] text-indigo-300 mt-1 block">※ 본 시스템은 건강 관리에 도움을 주고자 자세, 동작, 기억력 등을 측정하는 웰니스 프로그램으로서, 의료적 진단과는 무관합니다.</span>
              </span>
              3바디 측정 모델이 수집된 체형과 동작 데이터를 다각도로 종합 분석하고 있습니다.<br/>
              <span className="text-indigo-400 mt-2 inline-block text-sm">약 1분 정도 소요됩니다</span>
            </p>
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
          <div className="mt-6 space-y-4">
            {/* API Key 직접 입력 UI (타임아웃 및 네트워크 차단 우회용) */}
            <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700 text-left">
              <button 
                type="button"
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="flex items-center justify-between w-full text-xs font-bold text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                <span>🔑 {isUsingCustomKey() ? '등록된 API Key 수정하기' : '개별 Gemini API Key 등록 (오프라인/우회)'}</span>
                <i className={`fas ${showKeyInput ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
              </button>
              
              {showKeyInput && (
                <div className="mt-3 space-y-2.5">
                  <p className="text-[10px] text-slate-400 leading-normal">
                    구글 Gemini API Key를 등록하면 서버 타임아웃이나 네트워크 오류를 우회하여 브라우저에서 직접 AI 분석을 수행합니다.
                  </p>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomApiKey(apiKeyInput.trim());
                        setToast({ isVisible: true, message: apiKeyInput.trim() ? "API Key가 저장되었습니다. 재분석을 시도합니다." : "API Key가 삭제되었습니다.", type: 'success' });
                        setShowKeyInput(false);
                        retryAnalysis();
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      저장 후 재분석 시도
                    </button>
                    {isUsingCustomKey() && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomApiKey('');
                          setApiKeyInput('');
                          setToast({ isVisible: true, message: "등록된 API Key가 삭제되었습니다.", type: 'info' });
                        }}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button 
                onClick={retryAnalysis}
                className="w-full px-4 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg text-sm cursor-pointer"
              >
                🔄 즉시 재분석 (기존 데이터 유지)
              </button>
              <button 
                onClick={() => {
                  setErrorModal({ isOpen: false, message: '', showRetry: false });
                  setStep(AssessmentStep.READY_FOR_ANALYSIS);
                }}
                className="w-full px-4 py-3 bg-slate-700 text-white font-bold rounded-2xl hover:bg-slate-600 transition-all text-sm cursor-pointer"
              >
                📋 측정 확인 화면으로 돌아가기
              </button>
              <button 
                onClick={() => {
                  setErrorModal({ isOpen: false, message: '', showRetry: false });
                  setStep(AssessmentStep.INTRO);
                  setCapturedImages([]);
                }}
                className="w-full px-4 py-2 bg-transparent text-slate-400 font-bold rounded-2xl hover:text-white transition-all text-xs cursor-pointer"
              >
                처음부터 다시 촬영
              </button>
            </div>
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
      {/* 실시간 대기 리스트 모달 */}
      {showWaitingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-3xl w-full p-8 relative max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowWaitingModal(false)}
              className="absolute right-6 top-6 w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all cursor-pointer border border-slate-700"
            >
              <i className="fas fa-times"></i>
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <i className="fas fa-users text-lg"></i>
              </div>
              <div className="text-left">
                <h3 className="text-2xl font-black text-white">야외 실시간 대기 리스트</h3>
                <p className="text-slate-500 text-sm mt-0.5 font-bold">
                  {activeEventCode ? `연합 행사 모드 활성화 중 (${activeEventCode})` : '지점 내부 대기열'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-[300px]">
              {uniqueWaitingList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 gap-3">
                  <i className="fas fa-user-clock text-4xl opacity-40"></i>
                  <span className="text-sm font-medium">현재 대기 중인 접수자가 없습니다.</span>
                  <span className="text-[10px] text-slate-600 font-bold">사전 접수 기기에서 [사전 접수 등록]을 먼저 완료해 주세요.</span>
                </div>
              ) : (
                [...uniqueWaitingList]
                  .sort((a, b) => {
                    if (a.isStarred && !b.isStarred) return -1;
                    if (!a.isStarred && b.isStarred) return 1;
                    return a.createdAt - b.createdAt;
                  })
                  .map((member, index) => (
                    <div 
                      key={member.id}
                      className={`group border rounded-2xl p-5 flex items-center justify-between transition-all shadow-sm ${
                        member.isStarred
                          ? 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-500/40 hover:border-rose-500/60 shadow-rose-950/20'
                          : 'bg-slate-800/40 hover:bg-indigo-950/10 border-slate-800 hover:border-indigo-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all border ${
                          member.isStarred
                            ? 'bg-rose-600/10 text-rose-400 border-rose-500/30'
                            : 'bg-slate-800 group-hover:bg-indigo-900/30 text-slate-400 group-hover:text-indigo-300 border-slate-700/50'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-black text-xl flex items-center">
                              {member.name}
                              {member.weakestCode !== undefined && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedKeywordsToShow({
                                      name: member.name,
                                      keywords: member.sevenCodeKeywords || [],
                                      weakestCode: member.weakestCode || 1
                                    });
                                  }}
                                  className="text-sm bg-amber-500/10 text-amber-400 border border-amber-500/30 font-black px-3 py-1.5 rounded-xl ml-2 hover:bg-amber-500 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                                  title="선택한 7코드 질문 항목 보기"
                                >
                                  <span>🚨 {CHAKRA_MAP[member.weakestCode] || `${member.weakestCode}번 코드`} 취약</span>
                                  <i className="fas fa-search text-[9px]"></i>
                                </button>
                              )}
                            </span>
                            <span className={`text-sm px-3 py-1 rounded-full font-bold ${
                              member.gender === 'male' ? 'bg-blue-500/10 text-blue-400' : 'bg-pink-500/10 text-pink-400'
                            }`}>
                              {member.age}세 · {member.gender === 'male' ? '남' : '여'}
                            </span>
                          </div>
                          {/* 건강 니즈 표시 */}
                          {member.healthNeeds && member.healthNeeds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {member.healthNeeds.map((need: string, ni: number) => (
                                <span key={ni} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold px-2.5 py-1 rounded-lg">
                                  💚 {need}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                            <span><i className="fas fa-phone-alt"></i> {member.phone ? member.phone.slice(-4) : '없음'}</span>
                            <span>•</span>
                            <span><i className="fas fa-clock"></i> {new Date(member.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* 집중 상담 별표 토글 버튼 */}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await updateWaitingStarred(member.id, !member.isStarred);
                            } catch (err) {
                              console.error('별표 상태 업데이트 실패', err);
                            }
                          }}
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border shadow-md cursor-pointer ${
                            member.isStarred
                              ? 'bg-rose-600/30 text-rose-400 border-rose-500/50 hover:bg-rose-600 hover:text-white'
                              : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                          }`}
                          title={member.isStarred ? '집중 상담 해제' : '집중 상담 대상자 설정'}
                        >
                          <i className={`fas fa-star text-[11px] ${member.isStarred ? 'text-rose-400 animate-pulse' : ''}`}></i>
                        </button>


                      
                      {/* 삭제 버튼 추가 */}
                      <button
                        onClick={(e) => handleDeleteWaiting(e, member)}
                        className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-all shadow-md border border-rose-500/20 cursor-pointer"
                        title="대기 삭제"
                      >
                        <i className="fas fa-trash-alt text-xs"></i>
                      </button>

                      {/* 직관적인 측정 시작 버튼 */}
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          setUserInfo({
                            name: member.name,
                            gender: member.gender,
                            age: member.age,
                            phone: member.phone,
                            memberType: member.memberType,
                            birthDate: member.birthDate,
                            healthNeeds: member.healthNeeds || []
                          });
                          
                          const mockSevenCodeImage: CapturedImage = {
                            step: AssessmentStep.SEVEN_CODE_CHECK,
                            dataUrl: '',
                            sevenCodeKeywords: member.sevenCodeKeywords || [],
                            weakestCode: member.weakestCode || 1
                          };
                          setCapturedImages([mockSevenCodeImage]);
                          setIsWaitingMemberActive(true);
                          setActiveWaitingId(member.id);
                          
                          await updateWaitingStatus(member.id, 'measuring');
                          setShowWaitingModal(false);
                          setStep(AssessmentStep.POSTURE_FRONT);
                          speak(`${member.name} 님의 측정을 개시합니다. 카메라 앞에 바르게 서주세요.`);
                        }}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-base font-black transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer border border-indigo-500/20"
                      >
                        <i className="fas fa-play text-[9px]"></i>
                        <span>측정 시작</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 text-center flex justify-between items-center text-sm text-slate-500 font-bold">
              <span>총 대기 인원: <strong className="text-indigo-400 text-lg">{uniqueWaitingList.length}</strong>명</span>
              <span>* 클릭 시 즉시 점검 화면으로 진입합니다.</span>
            </div>
          </div>
        </div>
      )}

      {/* 7코드 선택 항목 상세 모달 */}
      {selectedKeywordsToShow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedKeywordsToShow(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedKeywordsToShow(null)}
              className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all cursor-pointer border border-slate-700"
            >
              <i className="fas fa-times text-sm"></i>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <i className="fas fa-clipboard-list text-base"></i>
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-white">{selectedKeywordsToShow.name} 님의 7코드 체크 항목</h3>
                <p className="text-slate-500 text-[10px] mt-0.5 font-bold">
                  선택한 {selectedKeywordsToShow.keywords.length}개의 불편 증상 목록
                </p>
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 text-left mb-5">
              <div className="text-xs text-indigo-300 font-bold mb-3 flex items-center gap-1.5">
                <i className="fas fa-exclamation-circle"></i>
                가장 약한 영역: {selectedKeywordsToShow.weakestCode}번 코드
              </div>
              {selectedKeywordsToShow.keywords.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6">선택한 증상이나 감정 항목이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {selectedKeywordsToShow.keywords.map((kw, idx) => (
                    <span key={idx} className="bg-indigo-950/80 text-indigo-300 border border-indigo-900/50 px-2.5 py-1.5 rounded-xl text-xs font-semibold">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedKeywordsToShow(null)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
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
