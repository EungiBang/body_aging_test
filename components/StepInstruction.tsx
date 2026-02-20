
import React from 'react';
import { AssessmentStep } from '../types';

interface StepInstructionProps {
  step: AssessmentStep;
  onStart: () => void;
  voiceSupported?: boolean;
}

interface StepInfo {
  label: string;
  labelColor: string;
  title: string;
  description: string;
  tips: string[];
  icon: string;
  iconBg: string;
}

const STEP_INFO: Partial<Record<AssessmentStep, StepInfo>> = {
  [AssessmentStep.POSTURE_FRONT]: {
    label: '진단 1단계',
    labelColor: '#6366f1',
    title: '정면 신체 균형 측정',
    description: '카메라 앞에 자연스럽게 정면으로 서주세요. 전신이 카메라에 잡히도록 적당한 거리에서 촬영합니다.',
    tips: [
      '양발을 어깨 너비로 벌리고 서세요',
      '자연스럽게 팔을 옆에 내려놓으세요',
      '카메라와 약 2m 거리를 유지하세요',
      '7초 후 자동으로 촬영됩니다',
    ],
    icon: 'fa-person',
    iconBg: 'linear-gradient(135deg, #6366f1, #818cf8)',
  },
  [AssessmentStep.POSTURE_SIDE]: {
    label: '진단 2단계',
    labelColor: '#6366f1',
    title: '측면 신체 균형 측정',
    description: '카메라를 향해 옆으로 서주세요. 어깨, 골반, 무릎, 발목이 일직선이 되는지 확인합니다.',
    tips: [
      '몸의 왼쪽 또는 오른쪽 측면이 카메라를 향하게 서세요',
      '자연스럽게 서있는 자세를 유지하세요',
      '다리가 겹치지 않도록 주의하세요',
      '7초 후 자동으로 촬영됩니다',
    ],
    icon: 'fa-person-walking',
    iconBg: 'linear-gradient(135deg, #6366f1, #06b6d4)',
  },
  [AssessmentStep.BALANCE_TEST]: {
    label: '노화 테스트 01',
    labelColor: '#f43f5e',
    title: '눈 감고 한발 서기',
    description: '눈을 감고 한 발로 서서 균형을 유지하세요. 균형 유지 시간으로 신체 노화도를 측정합니다.',
    tips: [
      '양팔을 자연스럽게 벌려 균형을 잡아도 됩니다',
      '눈을 감고 한 발을 들어올리세요',
      '30초 타이머가 자동으로 작동합니다',
      '넘어질 위험이 없는 안전한 장소에서 진행하세요',
    ],
    icon: 'fa-scale-balanced',
    iconBg: 'linear-gradient(135deg, #f43f5e, #fb923c)',
  },
  [AssessmentStep.ARM_RAISE_TEST]: {
    label: '노화 테스트 02',
    labelColor: '#f43f5e',
    title: '팔 들어 올리기',
    description: '양팔을 머리 위로 최대한 높이 들어올려 주세요. 팔의 가동 범위와 유연성을 측정합니다.',
    tips: [
      '양팔을 동시에 위로 올리세요',
      '최대한 높이 올려 귀 옆으로 붙여보세요',
      '통증이 있으면 무리하지 마세요',
      '촬영 버튼을 눌러 촬영합니다',
    ],
    icon: 'fa-hands-asl-interpreting',
    iconBg: 'linear-gradient(135deg, #f43f5e, #a855f7)',
  },
  [AssessmentStep.FLEXIBILITY_TEST]: {
    label: '노화 테스트 03',
    labelColor: '#f43f5e',
    title: '유연성 테스트 (전굴)',
    description: '서서 상체를 앞으로 숙여 발끝에 손이 닿는지 확인합니다. 하체 유연성을 측정합니다.',
    tips: [
      '무릎을 펴고 서 있는 상태에서 시작하세요',
      '상체를 천천히 앞으로 숙이세요',
      '손가락이 발끝에 닿을 수 있도록 노력하세요',
      '촬영 버튼을 눌러 촬영합니다',
    ],
    icon: 'fa-child-reaching',
    iconBg: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
  },
  [AssessmentStep.STRENGTH_SQUAT]: {
    label: '근력 테스트 01',
    labelColor: '#10b981',
    title: '30초 스쿼트',
    description: '30초 동안 올바른 자세로 스쿼트를 최대한 많이 반복하세요. 하체 근력을 측정합니다.',
    tips: [
      '발을 어깨 너비로 벌리고 시작하세요',
      '허벅지가 바닥과 수평이 될 때까지 앉으세요',
      '무릎이 발끝 앞으로 나가지 않도록 주의하세요',
      '시작 버튼을 누르면 30초 타이머가 작동합니다',
    ],
    icon: 'fa-dumbbell',
    iconBg: 'linear-gradient(135deg, #10b981, #06b6d4)',
  },
  [AssessmentStep.STRENGTH_PUSHUP]: {
    label: '근력 테스트 02',
    labelColor: '#10b981',
    title: '30초 푸시업',
    description: '30초 동안 올바른 자세로 푸시업을 최대한 많이 반복하세요. 상체 근력을 측정합니다.',
    tips: [
      '손을 어깨 너비보다 약간 넓게 짚으세요',
      '몸이 일직선이 되도록 유지하세요',
      '무릎 대고 하는 변형도 괜찮습니다',
      '시작 버튼을 누르면 30초 타이머가 작동합니다',
    ],
    icon: 'fa-heart-pulse',
    iconBg: 'linear-gradient(135deg, #10b981, #34d399)',
  },
  [AssessmentStep.FACE_ANALYSIS]: {
    label: '바이오 스캔',
    labelColor: '#a855f7',
    title: '안면 노화도 측정',
    description: '전면 카메라로 얼굴을 촬영합니다. 피부 탄력, 주름 상태를 AI가 분석하여 안면 노화도를 측정합니다.',
    tips: [
      '전면 카메라가 자동으로 활성화됩니다',
      '얼굴을 화면 가이드 원 안에 맞추세요',
      '정면을 바라보고 자연스러운 표정을 유지하세요',
      '충분한 조명이 있는 곳에서 촬영하세요',
    ],
    icon: 'fa-face-smile',
    iconBg: 'linear-gradient(135deg, #a855f7, #6366f1)',
  },
};

const StepInstruction: React.FC<StepInstructionProps> = ({ step, onStart, voiceSupported }) => {
  const info = STEP_INFO[step];
  if (!info) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="instruction-card">
        <div style={{ color: info.labelColor }} className="step-label">
          {info.label}
        </div>
        <h3>{info.title}</h3>
        
        <div 
          className="icon-circle"
          style={{ background: info.iconBg }}
        >
          <i className={`fas ${info.icon}`} style={{ color: 'white' }}></i>
        </div>

        <p className="description">{info.description}</p>

        <div className="tips">
          <h4>📋 준비 사항</h4>
          <ul style={{ margin: 0, padding: 0 }}>
            {info.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>

        <button onClick={onStart} className="start-btn">
          <i className="fas fa-camera"></i>
          카메라 시작하기
        </button>

        {voiceSupported && (
          <div className="voice-hint">
            <i className="fas fa-microphone"></i>
            "시작" 또는 "다음"이라고 말해도 됩니다
          </div>
        )}
      </div>
    </div>
  );
};

export default StepInstruction;
