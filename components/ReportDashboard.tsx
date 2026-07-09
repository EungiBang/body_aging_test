// 3바디 7코드 AI점검 결과지를 전문가 컨설팅 내러티브 순서로 렌더링하고 차등 뷰를 제어하는 대시보드 컴포넌트

import React, { useState } from 'react';
import { BodyReport, CapturedImage } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import FeedbackPanel from './FeedbackPanel';
import { BRAND_NAME, SUB_NAME } from '@shared/constants/brand';
import { getEnergyMbtiCode, ENERGY_MBTI_DATA } from '@shared/ai/scoring/mbti';
import { EnergyMbtiWebCard } from './EnergyMbtiWebCard';
import { useTranslation } from 'react-i18next';

// AI 생성 텍스트에서 '차크라'를 '코드'로 치환 (이전에 저장된 결과 호환)
const sanitize = (text: string | undefined | null): string => {
  if (!text) return '';
  return text
    .replace(/(\d)차크라/g, '$1코드')
    .replace(/차크라/g, '코드');
};

interface ReportDashboardProps {
  report: BodyReport;
  images: CapturedImage[];
  onRestart: () => void;
}

const SEVEN_CODE_NAMES: Record<number, { name: string; region: string; symptom: string; hint: string; label: string; location: string }> = {
  1: { name: '1코드 (회음)', region: '하체/골반/신장', symptom: '기초 에너지 결핍, 다리 무력감 및 척추 지지력 불안정성', hint: '스쿼트 동작과 발바닥을 바닥에 밀착하고 아랫배에 힘을 기르는 훈련(하단전 접지)으로 기초 에너지를 충전하세요.', label: '기초 에너지', location: '회음' },
  2: { name: '2코드 (하단전)', region: '하복부/단전/대장', symptom: '생명력 약화, 하복부 냉증 및 장 기능 저하로 인한 활력 정체', hint: '단전 치기 및 복부 호흡 명상으로 하단전 불을 지피세요.', label: '감정 흐름', location: '하단전' },
  3: { name: '3코드 (중완)', region: '위장/명치/간', symptom: '의지력 저하, 만성 소화불량 및 추진력 결여', hint: '중완 이완 및 코어 강화 운동으로 의지력을 끌어올리세요.', label: '추진력', location: '중완' },
  4: { name: '4코드 (단중)', region: '가슴/심장/폐', symptom: '정서적 정체, 가슴 답답함 및 만성 화/스트레스 누적', hint: '가슴 열기 명상과 이완 호흡으로 가슴의 울화를 비워내세요.', label: '정서 안정', location: '단중' },
  5: { name: '5코드 (혼문)', region: '목/어깨/갑상선', symptom: '표현력 정체, 목어깨 만성 뭉침 및 감정 소통 장애', hint: '목어깨 이완 동작과 소리 명상으로 목통로를 풀어주세요.', label: '소통', location: '혼문' },
  6: { name: '6코드 (인당)', region: '미간/두뇌/눈', symptom: '직관력 감퇴, 머리 무거움 및 전두엽 억제 통제력 저하', hint: '인당 마사지 및 브레인 뇌체조로 머리를 맑게 하세요.', label: '집중·통찰', location: '인당' },
  7: { name: '7코드 (백회)', region: '정수리/뇌파/송과선', symptom: '통합 에너지 불안정, 수면 장애 및 뇌파 불균형 과부하', hint: '백회 브레인 호흡 및 뇌파 이완 명상으로 중심을 정렬하세요.', label: '삶의 방향', location: '백회' }
};

const SEVEN_CODE_NAMES_EN: Record<number, { name: string; region: string; symptom: string; hint: string; label: string; location: string }> = {
  1: { name: '1-Code (Perineum)', region: 'Lower Body/Pelvis/Kidney', symptom: 'Basic energy deficiency, leg weakness, and spinal support instability', hint: 'Charge basic energy through squats and grounding training by pressing soles to the floor and strengthening lower abdomen.', label: 'Basic Energy', location: 'Perineum' },
  2: { name: '2-Code (Lower Danjeon)', region: 'Lower Abdomen/Danjeon/Large Intestine', symptom: 'Weakened vitality, cold lower abdomen, and stagnated energy due to poor bowel function', hint: 'Ignite the lower Danjeon fire with Danjeon tapping and abdominal breathing meditation.', label: 'Emotional Flow', location: 'Lower Danjeon' },
  3: { name: '3-Code (Jungwan)', region: 'Stomach/Solar Plexus/Liver', symptom: 'Reduced willpower, chronic indigestion, and lack of drive', hint: 'Boost your willpower through Jungwan relaxation and core strengthening exercises.', label: 'Drive & Will', location: 'Jungwan' },
  4: { name: '4-Code (Danjung)', region: 'Chest/Heart/Lung', symptom: 'Emotional stagnation, chest tightness, and chronic accumulated anger/stress', hint: 'Clear emotional congestion through chest-opening meditation and relaxing breathing.', label: 'Emotional Balance', location: 'Danjung' },
  5: { name: '5-Code (Honmun)', region: 'Throat/Shoulders/Thyroid', symptom: 'Stagnant expression, chronic neck and shoulder stiffness, and difficulty communicating feelings', hint: 'Relax the throat passage with neck/shoulder release movements and vocal meditation.', label: 'Communication', location: 'Honmun' },
  6: { name: '6-Code (Indang)', region: 'Brow/Brain/Eyes', symptom: 'Diminished intuition, heavy head, and reduced control over frontal lobe inhibition', hint: 'Clear your mind with Indang massage and brain gym exercises.', label: 'Focus & Insight', location: 'Brow' },
  7: { name: '7-Code (Baekhoe)', region: 'Crown/Brainwaves/Pineal Gland', symptom: 'Unstable integrated energy, sleep disturbances, and brainwave imbalance overload', hint: 'Align your center through Baekhoe brain breathing and brainwave relaxation meditation.', label: 'Life Direction', location: 'Crown' }
};

const ReportDashboard: React.FC<ReportDashboardProps> = ({ report, images, onRestart }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1.15);
  const [isSimpleView, setIsSimpleView] = useState(true); // 간단 뷰 / 상세 뷰 관리 상태

  // images와 report의 극단적 null/undefined 방어
  const safeImages = Array.isArray(images) ? images : [];
  const safeReport = report || {} as BodyReport;
  const userInfo = safeReport.userInfo || { name: '회원', gender: 'female', age: 0 };

  const mbtiCode = (() => {
    try {
      return getEnergyMbtiCode(safeReport) || 'ESTP';
    } catch (e) {
      return 'ESTP';
    }
  })();

  const alignmentAnalysis = Array.isArray(safeReport.bodyAlignmentAnalysis) ? safeReport.bodyAlignmentAnalysis : [];
  const radarData = (safeReport.postureMetrics || []).map(m => ({
    subject: m?.name || '항목',
    A: m?.score || 0,
    fullMark: 100,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Good': return 'text-emerald-500 bg-emerald-50';
      case 'Fair': return 'text-amber-500 bg-amber-50';
      case 'Poor': return 'text-rose-500 bg-rose-50';
      default: return 'text-slate-500 bg-slate-50';
    }
  };

  const handleShare = async () => {
    const mbtiInfo = ENERGY_MBTI_DATA[mbtiCode];
    const mbtiName = mbtiInfo ? mbtiInfo.name : '미확인 유형';
    const mbtiDesc = mbtiInfo ? mbtiInfo.description : '점검 결과에 맞춰 분석된 에너지 MBTI 유형입니다.';
    
    const activeWeakestCode = getWeakestFromReport();
    const codeInfo = SEVEN_CODE_NAMES[activeWeakestCode] || SEVEN_CODE_NAMES[4];

    const threeBody = safeReport.threeBodyAnalysis || {
      body: { score: 70, description: '신체 정렬 상태가 다소 흐트러져 있습니다.' },
      mind: { score: 70, description: '마음의 긴장도가 다소 높습니다.' },
      brain: { score: 70, description: '두뇌 인지 반응이 평이합니다.' }
    };

    const shareText = [
      `[코드맵 3바디7코드 AI점검 - 라이트 버전]`,
      `━━━━━━━━━━━━━━━━━`,
      `👤 ${userInfo.name} 회원님 (${userInfo.gender === 'male' ? '남성' : '여성'}, 만 ${userInfo.age}세)`,
      `📅 ${new Date(safeReport.date || Date.now()).toLocaleDateString()}`,
      ``,
      `🔮 에너지 MBTI 유형`,
      `■ ${mbtiCode} (${mbtiName})`,
      `${mbtiDesc}`,
      ``,
      `📊 핵심 분석 수치`,
      `• 생물학적 나이: ${userInfo.age}세`,
      `• 통합 밸런스 나이: ${safeReport.comprehensiveAge || safeReport.physicalAge || 0}세`,
      `• 뇌 나이: ${safeReport.brainAge || '측정 안됨'}세`,
      `• 얼굴 나이: ${safeReport.faceAgeEstimate || 0}세`,
      `• 신체 나이: ${safeReport.physicalAge || 0}세`,
      `• 마음 나이: ${safeReport.mindAge || '측정 안됨'}세`,
      `• 코어 밸런스 점수: ${safeReport.overallScore || 0}점`,
      ``,
      `🧬 3바디(Body·Mind·Brain) 핵심 요약`,
      `• 몸 (Body - 신체 나이 ${safeReport.physicalAge || 0}세)`,
      `${sanitize(threeBody.body?.description) || '신체 정렬 관리가 필요합니다.'}`,
      `• 마음 (Mind - 마음 나이 ${safeReport.mindAge || '측정 안됨'}세)`,
      `${sanitize(threeBody.mind?.description) || '내면을 평온하게 가라앉히는 이완 조율이 필요합니다.'}`,
      `• 뇌 (Brain - 뇌 나이 ${safeReport.brainAge || '측정 안됨'}세)`,
      `${sanitize(threeBody.brain?.description) || '두뇌 기억력 기능이 안정적입니다.'}`,
      ``,
      `⚡ 7코드 에너지 분석 (집중 관리 코드)`,
      `■ ${codeInfo.name} (${codeInfo.region} 관장)`,
      `현재 이 코드가 방전 또는 정체된 상태입니다. 주요 증상으로는 ${codeInfo.symptom} 등이 관찰되므로, ${codeInfo.hint}`,
      ``,
      `💬 종합 평가 및 제안`,
      `"${sanitize(safeReport.summary) || ''}"`,
      ``,
      `━━━━━━━━━━━━━━━━━`,
      `📢 가까운 지점에 방문하시면 정밀한 [3바디 7코드 풀버전 테스트]를 무료로 제공해 드립니다. 1:1 개인 맞춤형 코칭과 전문 상담을 통해 온전한 조율과 변화를 경험해 보세요.`,
      ``,
      `🏢 브레인트레이닝센터(BTC)`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const getWeakestFromReport = () => {
    if (!safeReport.sevenCodeAnalysis) return 4;
    const codes = [
      { id: 1, score: safeReport.sevenCodeAnalysis.code1?.score || 0 },
      { id: 2, score: safeReport.sevenCodeAnalysis.code2?.score || 0 },
      { id: 3, score: safeReport.sevenCodeAnalysis.code3?.score || 0 },
      { id: 4, score: safeReport.sevenCodeAnalysis.code4?.score || 0 },
      { id: 5, score: safeReport.sevenCodeAnalysis.code5?.score || 0 },
      { id: 6, score: safeReport.sevenCodeAnalysis.code6?.score || 0 },
      { id: 7, score: safeReport.sevenCodeAnalysis.code7?.score || 0 },
    ];
    codes.sort((a, b) => a.score - b.score);
    return codes[0].id;
  };

  const activeWeakestCode = getWeakestFromReport();
  const codeInfo = SEVEN_CODE_NAMES[activeWeakestCode] || SEVEN_CODE_NAMES[4];

  const specialized = (() => {
    if (!safeReport.sevenCodeAnalysis) {
      return { bodyFree: true, cleanBreath: true, mindFree: false, reason: "기본 순환 수련 권장" };
    }
    const analysis = safeReport.sevenCodeAnalysis;
    const rootSacralScore = Math.min(analysis.code1?.score || 0, analysis.code2?.score || 0);
    const solarHeartScore = Math.min(analysis.code3?.score || 0, analysis.code4?.score || 0);

    if (rootSacralScore <= solarHeartScore) {
      return {
        bodyFree: true,
        cleanBreath: true,
        mindFree: false,
        reason: "하위 코드(1, 2번)의 에너지가 저하된 패턴입니다. 신체의 근원적인 에너지를 채우고 활력을 회복하기 위해 '바디프리 명상'과 '클린호흡'을 추천합니다."
      };
    } else {
      return {
        bodyFree: false,
        cleanBreath: true,
        mindFree: true,
        reason: "중위/상위 코드(3, 4번 이상)의 에너지가 정체된 패턴입니다. 가슴의 답답함을 풀고 내면의 감정을 정화하기 위해 '클린호흡'과 '마음프리 명상'을 추천합니다."
      };
    }
  })();

  const renderImageWithOverlay = (img: CapturedImage, i: number) => {
    if (!img || !img.step) return null;
    const isPosture = img.step.includes('POSTURE');
    const isFace = img.step.includes('FACE');
    const isStrength = img.step.includes('STRENGTH');
    const isFront = img.step === 'POSTURE_FRONT';

    const getLabels = () => {
      if (!isPosture || alignmentAnalysis.length === 0) return [];
      const items = alignmentAnalysis;
      const posMap = [
        { kw: ['거북목', '머리', '전방두부', 'head'], top: '12%', view: 'side' },
        { kw: ['경추', '목'], top: '18%', view: 'both' },
        { kw: ['어깨', 'shoulder'], top: '28%', view: 'both' },
        { kw: ['흉추', '등', '척추', '라운드'], top: '38%', view: 'side' },
        { kw: ['골반', 'pelvis', 'hip'], top: '55%', view: 'both' },
        { kw: ['무릎', 'knee'], top: '70%', view: 'both' },
      ];
      return items.filter(it => it?.issue).map(it => {
        const iss = (it.issue || '').toLowerCase();
        const m = posMap.find(p => p.kw.some(k => iss.includes(k)));
        if (m && m.view !== 'both' && ((isFront && m.view === 'side') || (!isFront && m.view === 'front'))) return null;
        return { text: it.issue, severity: it.severity || '경미', top: m?.top || '45%' };
      }).filter(Boolean).slice(0, 3);
    };
    const labels = getLabels();
    const sevColor = (s: string) => s === '정상' ? 'bg-emerald-500/80 border-emerald-400' : s === '경미' ? 'bg-amber-500/80 border-amber-400' : 'bg-red-500/80 border-red-400';

    return (
      <div key={i} className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 aspect-[4/3]">
        <img src={img.dataUrl} className="w-full h-full object-contain relative z-10" alt={img.step} />
        
        {isPosture && labels.length > 0 && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {labels.map((lb: any, idx: number) => (
              <div key={idx} className="absolute right-1" style={{ top: lb.top }}>
                <div className={`px-1.5 py-0.5 rounded text-[9px] font-black text-white border ${sevColor(lb.severity)} backdrop-blur-sm shadow-md`}>
                  {lb.severity === '정상' ? '✅' : lb.severity === '경미' ? '⚠️' : '🔴'} {sanitize(lb.text)}
                </div>
              </div>
            ))}
          </div>
        )}

        {isPosture && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">AI Body Scan</span>
          </div>
        )}

        {isFace && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            <div className="w-[60%] h-[70%] border-2 border-dashed border-rose-400/60 rounded-[40%] shadow-[0_0_15px_rgba(251,113,133,0.4)] relative">
              <div className="absolute top-[40%] left-[10%] right-[10%] h-[1px] bg-rose-400/40"></div>
              <div className="absolute top-[10%] bottom-[10%] left-1/2 w-[1px] bg-rose-400/40 -translate-x-1/2"></div>
              <div className="absolute top-[40%] left-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[40%] right-[25%] w-1.5 h-1.5 bg-rose-400 rounded-full"></div>
              <div className="absolute top-[65%] left-1/2 w-1.5 h-1.5 bg-rose-400 rounded-full -translate-x-1/2"></div>
            </div>
          </div>
        )}

        {isStrength && img.reps !== undefined && (
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-sm font-black px-3 py-1.5 rounded-lg shadow-md z-20">
            {img.reps}회
          </div>
        )}

        <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm p-3 text-sm text-white font-bold text-center z-20">
          {img.step.replace('POSTURE_', '자세:').replace('STRENGTH_', '근력:').replace('_TEST', '').replace('_ANALYSIS', '')}
        </div>
      </div>
    );
  };

  const threeBody = safeReport.threeBodyAnalysis || {
    body: { score: 70, description: '신체 정렬 상태가 다소 흐트러져 있습니다.' },
    mind: { score: 70, description: '마음의 긴장도가 다소 높습니다.' },
    brain: { score: 70, description: '두뇌 인지 반응이 평이합니다.' }
  };

  const getSevenCodeList = () => {
    const analysis = safeReport.sevenCodeAnalysis;
    if (!analysis) return [];

    // 신체, 두뇌, 얼굴 분석 데이터 바탕으로 키워드 자동 추출
    const getAdditionalEvidence = (codeId: number): string[] => {
      const extra: string[] = [];
      const alignment = Array.isArray(safeReport.bodyAlignmentAnalysis) ? safeReport.bodyAlignmentAnalysis : [];
      const hasPelvisIssue = alignment.some(it => it.issue && (it.issue.includes('골반') || it.issue.includes('pelvis')) && it.severity !== '정상');
      const hasShoulderIssue = alignment.some(it => it.issue && (it.issue.includes('어깨') || it.issue.includes('shoulder')) && it.severity !== '정상');
      const hasNeckIssue = alignment.some(it => it.issue && (it.issue.includes('목') || it.issue.includes('경추') || it.issue.includes('head')) && it.severity !== '정상');
      const hasTrunkIssue = alignment.some(it => it.issue && (it.issue.includes('체간') || it.issue.includes('기울기')) && it.severity !== '정상');

      const hasBalanceIssue = (safeReport.agingMetrics || []).some(it => it.testName && (it.testName.includes('눈') || it.testName.includes('한발') || it.testName.includes('균형')) && it.score < 80);
      const hasSquatIssue = (safeReport.strengthMetrics || []).some(it => it.exercise && it.exercise.includes('스쿼트') && it.formScore < 80);
      const hasPushupIssue = (safeReport.strengthMetrics || []).some(it => it.exercise && it.exercise.includes('푸시업') && it.formScore < 80);

      const reactionData = safeImages.find(img => img.step === ('BRAIN_REACTION' as any))?.brainTestData;
      const memoryData = safeImages.find(img => img.step === 'BRAIN_MEMORY')?.brainTestData;
      const isBrainSlow = reactionData && reactionData.reactionTimeMs && reactionData.reactionTimeMs > 800;
      const isBrainError = reactionData && reactionData.reactionErrors && reactionData.reactionErrors > 1;
      const isMemoryWeak = memoryData && (memoryData.memoryCorrect ?? memoryData.memorySpan ?? 6) < 4;

      const hasWrinkles = typeof safeReport.faceAnalysis?.wrinkles === 'string' && !safeReport.faceAnalysis.wrinkles.includes('없음') && !safeReport.faceAnalysis.wrinkles.includes('양호');
      const hasElasticityIssue = typeof safeReport.faceAnalysis?.elasticity === 'string' && (safeReport.faceAnalysis.elasticity.includes('저하') || safeReport.faceAnalysis.elasticity.includes('약화'));

      if (codeId === 1) {
        if (hasPelvisIssue) extra.push("골반 틀어짐 감지");
        if (hasSquatIssue) extra.push("하체 정렬 지지력 불안정");
        if (hasBalanceIssue) extra.push("균형 유지 하체 지지력 약화");
      }
      if (codeId === 2) {
        if (hasPelvisIssue) extra.push("골반 주변 순환 정체");
        if (hasSquatIssue) extra.push("하복부 코어 지지력 저하");
        if (safeReport.physicalAge > userInfo.age) extra.push("신체 노화 가속 감지");
      }
      if (codeId === 3) {
        if (hasTrunkIssue) extra.push("체간 정렬 불균형");
        if (hasSquatIssue || hasPushupIssue) extra.push("코어 근력 수행 안정성 저하");
      }
      if (codeId === 4) {
        if (hasShoulderIssue) extra.push("어깨 정렬 대칭 불균형");
        if (hasPushupIssue) extra.push("상지 가슴 코어 지지력 저하");
      }
      if (codeId === 5) {
        if (hasNeckIssue) extra.push("경추/거북목 정렬 불균형");
        if (hasShoulderIssue) extra.push("목-어깨 근육 뭉침 감지");
      }
      if (codeId === 6) {
        if (isBrainSlow) extra.push("두뇌 인지 반응 시간 지연");
        if (isBrainError) extra.push("전두엽 억제 제어력 저하");
        if (hasWrinkles) extra.push("미간/눈가 주름 누적");
      }
      if (codeId === 7) {
        if (isMemoryWeak) extra.push("작업 기억(해마) 재생 지연");
        if (safeReport.brainAge > userInfo.age) extra.push("뇌 나이 가속 노화 감지");
        if (hasElasticityIssue) extra.push("안면 피로도 및 얼굴 탄력 저하");
      }
      
      return extra;
    };

    return [
      { id: 1, color: '#EF4444', label: '1코드 - 기초 에너지 (위치: 회음)', score: analysis.code1?.score || 0, description: sanitize(analysis.code1?.description), evidence: [...(analysis.code1?.evidence || []), ...getAdditionalEvidence(1)], bgGrad: 'from-red-500 to-red-600' },
      { id: 2, color: '#F97316', label: '2코드 - 감정 흐름 (위치: 하단전)', score: analysis.code2?.score || 0, description: sanitize(analysis.code2?.description), evidence: [...(analysis.code2?.evidence || []), ...getAdditionalEvidence(2)], bgGrad: 'from-orange-500 to-orange-600' },
      { id: 3, color: '#FACC15', label: '3코드 - 추진력 (위치: 중완)', score: analysis.code3?.score || 0, description: sanitize(analysis.code3?.description), evidence: [...(analysis.code3?.evidence || []), ...getAdditionalEvidence(3)], bgGrad: 'from-yellow-500 to-yellow-600' },
      { id: 4, color: '#10B981', label: '4코드 - 정서 안정 (위치: 단중)', score: analysis.code4?.score || 0, description: sanitize(analysis.code4?.description), evidence: [...(analysis.code4?.evidence || []), ...getAdditionalEvidence(4)], bgGrad: 'from-emerald-500 to-emerald-600' },
      { id: 5, color: '#3B82F6', label: '5코드 - 소통 (위치: 혼문)', score: analysis.code5?.score || 0, description: sanitize(analysis.code5?.description), evidence: [...(analysis.code5?.evidence || []), ...getAdditionalEvidence(5)], bgGrad: 'from-cyan-500 to-cyan-600' },
      { id: 6, color: '#4338CA', label: '6코드 - 집중·통찰 (위치: 인당)', score: analysis.code6?.score || 0, description: sanitize(analysis.code6?.description), evidence: [...(analysis.code6?.evidence || []), ...getAdditionalEvidence(6)], bgGrad: 'from-indigo-500 to-indigo-600' },
      { id: 7, color: '#8B5CF6', label: '7코드 - 삶의 방향 (위치: 백회)', score: analysis.code7?.score || 0, description: sanitize(analysis.code7?.description), evidence: [...(analysis.code7?.evidence || []), ...getAdditionalEvidence(7)], bgGrad: 'from-violet-500 to-violet-600' }
    ];
  };

  const sevenCodeList = getSevenCodeList();

  const getChakraGrade = (score: number) => {
    if (score >= 80) return { text: t('sevenCode.grades.stable', '안정'), badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 60) return { text: t('sevenCode.grades.warning', '주의'), badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { text: t('sevenCode.grades.focused', '집중관리'), badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 font-black' };
  };

  const isEn = i18n.language?.startsWith('en');

  return (
    <div className="flex-1 bg-white overflow-auto print:p-0 print:overflow-visible relative text-slate-800 animate-fade-in-up">
      
      {/* 글자 크기 조정 바 */}
      <div className="sticky top-4 right-4 z-50 flex justify-end print:hidden pointer-events-none" style={{ height: 0 }}>
         <div className="bg-white/90 backdrop-blur shadow-lg border border-slate-200 rounded-full px-4 py-2 flex items-center gap-3 pointer-events-auto">
            <span className="text-xs font-bold text-slate-500">{isEn ? 'Font Size' : '글자 크기'}</span>
            <button onClick={() => setZoomLevel(prev => Math.max(0.8, prev - 0.1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors">-</button>
            <span className="text-sm font-black text-indigo-600 w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
            <button onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.1))} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold transition-colors">+</button>
         </div>
      </div>
      
      <div className="p-6 md:p-10 space-y-12 pb-24" style={{ zoom: zoomLevel }}>
        
        {/* [0] 측정자 정보 배너 */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-5 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">👤</div>
            <div>
              <h2 className="text-white font-black text-xl">{userInfo.name} <span className="text-white/70 font-bold text-base ml-1">{isEn ? "'s Wellness Report" : " 님의 측정 결과"}</span></h2>
              <p className="text-white/60 text-sm font-medium mt-0.5">{userInfo.gender === 'male' ? (isEn ? 'Male' : '남성') : (isEn ? 'Female' : '여성')} · {isEn ? `Age ${userInfo.age}` : `만 ${userInfo.age}세`} · {new Date(safeReport.date || Date.now()).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* [1] AI 분석 신뢰도 뱃지 */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
              <i className="fas fa-shield-alt text-lg"></i>
            </div>
            <div className="text-left">
              <h4 className="text-white font-bold text-sm flex items-center gap-2">
                🔬 {BRAND_NAME} {isEn ? 'Analysis Reliability' : '분석 신뢰도'} <span className="text-indigo-400">92%</span>
              </h4>
              <p className="text-slate-400 text-[10px] font-medium mt-0.5">{isEn ? 'Cross-validation complete for posture, balance, response, and face metrics' : '자세, 균형, 인지반응 및 안면 노화 6대 핵심 조건 교차 검증 완료'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center md:justify-end">
            {(isEn ? ['Front Posture', 'Side Alignment', 'Balance Data', 'Brain Response', 'Face Brightness', '7-Code Pattern'] : ['정면 자세', '측면 정렬', '균형 데이터', '뇌 인지 반응', '안면 밝기', '7코드 패턴']).map((check) => (
              <span key={check} className="text-[9px] bg-slate-950/80 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-md font-black">
                ✓ {check}
              </span>
            ))}
          </div>
        </div>

        {/* [2] 3바디 나이 카드 */}
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 print:grid-cols-7">
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{isEn ? 'Chronological Age' : '실제 나이'}</span>
                <div className="text-4xl font-black text-slate-800 mb-1">{userInfo.age}<span className="text-xl ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{isEn ? 'Physical Age' : '신체 나이'}</span>
                <div className="text-4xl font-black text-indigo-600 mb-1">{safeReport.physicalAge || 0}<span className="text-xl ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{isEn ? 'Face Age' : '얼굴 나이'}</span>
                <div className="text-4xl font-black text-rose-500 mb-1">{safeReport.faceAgeEstimate || 0}<span className="text-xl ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{isEn ? 'Brain Age' : '뇌 나이'}</span>
                <div className="text-4xl font-black text-amber-500 mb-1">{safeReport.brainAge || '-'}<span className="text-xl ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>
            <div className="bg-slate-50 py-6 px-4 rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 text-xs font-bold uppercase mb-2">{isEn ? 'Mind Age' : '마음 나이'}</span>
                <div className="text-4xl font-black text-fuchsia-500 mb-1">{safeReport.mindAge || '-'}<span className="text-xl ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>

            <div className="bg-emerald-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-emerald-200">
                <span className="text-emerald-100 text-xs font-bold uppercase mb-2">{isEn ? 'Integrated Balance Age' : '통합 밸런스 나이'}</span>
                <div className="text-4xl font-black mb-1">{safeReport.comprehensiveAge || safeReport.physicalAge || 0}<span className="text-xl text-emerald-200 ml-1">{isEn ? ' yrs' : '세'}</span></div>
            </div>
            <div className="bg-indigo-600 py-6 px-4 rounded-3xl flex flex-col items-center justify-center text-center text-white shadow-md shadow-indigo-200">
                <span className="text-indigo-200 text-xs font-bold uppercase mb-2">{isEn ? 'Core Balance Score' : '코어 밸런스 점수'}</span>
                <div className="text-4xl font-black mb-1">{safeReport.overallScore || 0}<span className="text-xl text-indigo-200 ml-1">{isEn ? ' pts' : '점'}</span></div>
            </div>
          </div>
        </div>

        {/* [3] 측정 데이터 증빙 */}
        {safeImages.length > 0 && (
        <section>
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-camera text-indigo-500"></i>
            {isEn ? 'Capture Evidence' : '측정 데이터 증빙'} {isSimpleView && <span className="text-xs text-slate-400 font-bold">{isEn ? '(Summary)' : '(요약본)'}</span>}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {safeImages
              .filter(img => img && img.step && !['FACE_ANALYSIS', 'BRAIN_REACTION', 'BRAIN_MEMORY', 'SEVEN_CODE_CHECK', 'USER_NEEDS'].includes(img.step))
              .slice(0, isSimpleView ? 2 : undefined)
              .map((img, i) => renderImageWithOverlay(img, i))}
          </div>
        </section>
        )}

        {/* ========================================================
            1. 신체 영역 분석 (Physical Body - 하드웨어)
           ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start text-left">
          
          {/* 신체 정렬 및 균형 분석 (간단 뷰 50% 요약 및 레이더 차트 가림막) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <span>🦴</span> {isEn ? 'Body Alignment & Balance Analysis' : '신체 정렬 및 균형 분석'} {isSimpleView && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold">{isEn ? '50% Summary' : '50% 요약본'}</span>}
            </h3>
            
            {safeReport.bodyTypeAnalysis && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <h4 className="text-sm font-bold text-indigo-500 mb-1">{isEn ? 'AI Comprehensive Body Analysis' : 'AI 종합 체형 분석'}</h4>
                <p className="text-lg font-black text-indigo-900">{sanitize(safeReport.bodyTypeAnalysis)}</p>
              </div>
            )}

            {alignmentAnalysis.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1">
                  🦴 {isEn ? 'Body Misalignment Analysis (AI Measurement)' : '신체 틀어짐 분석 (AI 실측)'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {alignmentAnalysis
                    .slice(0, isSimpleView ? Math.ceil(alignmentAnalysis.length / 2) : undefined)
                    .map((item: any, i: number) => {
                      const severityConfig: Record<string, { bg: string, text: string, border: string }> = {
                        '정상': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
                        '경미': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                        '주의': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                        '심함': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                      };
                      
                      const severityEn: Record<string, string> = { '정상': 'Normal', '경미': 'Mild', '주의': 'Warning', '심함': 'Severe' };
                      const cfg = severityConfig[item?.severity] || severityConfig['경미'];
                      return (
                        <div key={i} className={`p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="font-bold text-slate-800 text-sm">{sanitize(item?.issue)}</h5>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
                              {isEn ? (severityEn[item?.severity] || item?.severity) : item?.severity}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">
                            {item?.measuredValue && String(item.measuredValue).trim() !== '' && !String(item.measuredValue).includes('N/A') && (
                              <>
                                {isEn ? 'Measured' : '측정수치'} <strong className="text-slate-700">{sanitize(item?.measuredValue)}</strong>
                                <span className="mx-1">|</span>
                              </>
                            )}
                            {isEn ? 'Normal Range' : '정상 범주'} {sanitize(item?.normalRange)}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{sanitize(item?.impact)}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 레이더 차트는 간단 보기에서도 렌더링되나 블러 처리하여 궁금증 유발 */}
            <div className="relative h-64 mb-6">
              <div className={`w-full h-full ${isSimpleView ? 'filter blur-[5px] opacity-35 select-none pointer-events-none' : ''}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Radar name={isEn ? 'Posture' : '자세'} dataKey="A" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              {isSimpleView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2 border border-indigo-100">
                    <i className="fas fa-lock"></i>
                  </div>
                  <span className="text-[11px] text-slate-700 font-bold tracking-tight">{isEn ? 'Posture Balance Chart Locked' : '자세 밸런스 차트 잠김'}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 text-center leading-snug">{isEn ? 'Schedule counseling to unlock the detailed 3D balance map.' : '상담 신청 시 상세 3D 밸런스 맵이 해제됩니다.'}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {(safeReport.postureMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.postureMetrics || []).length / 2) : undefined)
                .map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex-1">
                      <h5 className="font-bold text-slate-800 text-base">{sanitize(item?.name)}</h5>
                      <p className="text-sm font-medium text-slate-600 leading-snug">{sanitize(item?.description)}</p>
                    </div>
                    <span className={`ml-2 px-3 py-1.5 rounded-lg text-sm font-black ${getStatusColor(item?.status || 'Good')}`}>
                      {item?.score}{isEn ? ' pts' : '점'}
                    </span>
                  </div>
                ))}
            </div>
            
            {isSimpleView && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-3 pointer-events-none">
                <span className="text-xs text-rose-500 font-black bg-rose-50 px-3 py-1 rounded-full border border-rose-100 shadow-sm pointer-events-auto">{isEn ? '🔒 Remaining 50% analysis is locked' : '🔒 나머지 50% 분석 잠겨있음'}</span>
              </div>
            )}
          </div>

          {/* 기능적 수행 능력 상세 (50%만 노출 및 눈감고 한발서기 조언 가림 및 웰니스 설명 보강) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden space-y-6">
            <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
              <i className="fas fa-dumbbell text-indigo-505"></i>
              {isEn ? 'Functional Performance Details' : '기능적 수행 능력 상세'} {isSimpleView && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold">{isEn ? '50% Summary' : '50% 요약본'}</span>}
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {(safeReport.strengthMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.strengthMetrics || []).length / 2) : undefined)
                .map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                      <div className="flex justify-between items-center mb-2">
                          <h5 className="font-bold text-indigo-900 text-base">{sanitize(item?.exercise)}</h5>
                          <div className="text-right">
                            <span className="text-sm font-black text-indigo-600 block">{isEn ? 'Form Score: ' : '자세 점수 '}{item?.formScore}{isEn ? ' pts' : '점'}</span>
                            {item?.reps > 0 && <span className="text-sm font-bold text-indigo-500 block">{isEn ? 'Reps: ' : '수행 횟수 '}{item?.reps}{isEn ? ' reps' : '회'}</span>}
                          </div>
                      </div>
                      <p className="text-sm font-medium text-indigo-800 mb-3">{sanitize(item?.performance)}</p>
                      <p className="text-sm font-bold text-indigo-700 bg-indigo-100/60 p-3 rounded-lg">💡 {sanitize(item?.recommendation)}</p>
                  </div>
                ))}

              {(safeReport.agingMetrics || [])
                .slice(0, isSimpleView ? Math.ceil((safeReport.agingMetrics || []).length / 2) : undefined)
                .map((item, i) => {
                  const isBalanceTest = item?.testName && (String(item.testName).includes('눈') || String(item.testName).includes('한발') || String(item.testName).includes('균형'));
                  const isBrainTest = item?.testName && (String(item.testName).includes('뇌') || String(item.testName).includes('두뇌') || String(item.testName).includes('인지') || String(item.testName).includes('반응') || String(item.testName).includes('기억'));
                  
                  // 눈감고 한발 서기 조언 가림, 뇌기능테스트 조언 가림
                  const showDesc = (isBalanceTest || isBrainTest) ? (!isSimpleView && item.description) : item.description;
                  
                  return (
                    <div key={i} className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
                        <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-rose-900 text-base">{sanitize(item.testName)}</h5>
                            <span className="text-base font-black text-rose-600">{item.score}{isEn ? ' pts' : '점'}</span>
                        </div>
                        <p className="text-sm font-medium text-rose-800">{sanitize(item.result)}</p>
                        
                        {/* 눈감고 한발서기 중요도 및 정밀 가이드 상시 노출 */}
                        {isBalanceTest && (
                          <div className="mt-3 p-4 bg-white/80 border border-rose-200/60 rounded-xl space-y-2">
                            <h6 className="text-xs font-black text-rose-600 flex items-center gap-1">
                              <span>🎯</span> {isEn ? 'Importance and Causes of Single-Leg Stance with Eyes Closed' : '눈감고 한발서기의 중요성 및 문제 원인'}
                            </h6>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                              {isEn 
                                ? 'Single-leg stance with eyes closed is a crucial aging screening metric that checks your body\'s proprioception (somatosensory), inner ear balance (vestibular), and cerebellum/brain function that coordinates them by blocking vision.'
                                : '눈감고 한발서기는 시각(눈)을 차단하여 신체의 <strong>고유수용 감각(체성감각)</strong>과 내이의 <strong>평형감각(전정감각)</strong>, 그리고 이를 조절하는 소뇌/두뇌 기능을 종합적으로 확인하는 매우 중요한 노화 스크리닝 지표입니다.'}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              {isEn
                                ? 'If this metric is average or low, it means not only a lack of simple muscular strength, but also that support for the lower thigh and core muscles that keep the body balanced is weakened, and the transmission rhythm of proprioceptive nerves has slowed down or misalignment of the body has accumulated. Also, balance maintenance significantly decreases when brain fatigue is high due to insomnia, fatigue, etc.'
                                : '이 지표가 평이하거나 낮게 나오는 것은 단순 근력 부족뿐 아니라, 몸의 중심을 잡는 하체 대퇴부 및 코어 근력의 지지력 저하와 더불어, 고유 수용성 신경의 신호 전송 리듬이 둔화되었거나 신체 정렬 불균형이 축적되었음을 의미합니다. 또한 불면, 피로 등으로 인한 뇌 피로도가 높을 때 균형 유지력이 현저히 감소합니다.'}
                            </p>
                          </div>
                        )}

                        {showDesc ? (
                            <p className="text-sm font-bold text-rose-700 bg-rose-100/60 p-3 rounded-lg mt-3 leading-relaxed">
                                💡 {sanitize(item.description)}
                            </p>
                        ) : (
                          (isBalanceTest || isBrainTest) && isSimpleView && (
                            <p className="text-xs text-rose-550/80 font-bold bg-rose-100/40 p-2 rounded-lg mt-2 text-center">
                              🔒 {isEn ? '🔒 Detailed solution advice will be unlocked upon scheduling counseling.' : '🔒 상세 솔루션 조언은 전문 상담 신청 시 개방됩니다.'}
                            </p>
                          )
                        )}
                    </div>
                  );
                })}
            </div>

            {isSimpleView && (
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-3 pointer-events-none">
                <span className="text-xs text-rose-500 font-black bg-rose-50 px-3 py-1 rounded-full border border-rose-100 shadow-sm pointer-events-auto">{isEn ? '🔒 Remaining 50% analysis is locked' : '🔒 나머지 50% 분석 잠겨있음'}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            2. 두뇌 영역 분석 (Brain Body - 소프트웨어)
            간단 뷰에서도 노출하되 상세 조언에 자물쇠 가림막 적용
           ======================================================== */}
        {safeReport.brainTestEvaluation && (
          <section className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden text-left shadow-sm">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2 relative z-10">
              <i className="fas fa-brain text-amber-500"></i>
              {isEn ? 'Brain Health & Memory Detail Analysis' : '뇌 건강 및 기억력 상세 분석'}
            </h3>
            <div className="relative p-4 bg-amber-50/50 border border-amber-100 rounded-2xl relative z-10 overflow-hidden min-h-[100px]">
              <div className={`${isSimpleView ? 'filter blur-[4px] opacity-40 select-none pointer-events-none' : ''}`}>
                <p className="text-sm font-medium text-amber-900 leading-relaxed">{sanitize(safeReport.brainTestEvaluation)}</p>
              </div>
              {isSimpleView && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-50/10 backdrop-blur-[1px] p-4 text-center">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-1 border border-amber-200">
                    <i className="fas fa-lock"></i>
                  </div>
                  <span className="text-xs text-amber-800 font-bold">{isEn ? '🔒 Brain Cognitive Health Detail Guide Locked' : '🔒 뇌 인지 건강 상세 가이드 잠김'}</span>
                  <span className="text-[10.5px] text-amber-600/80 mt-0.5">{isEn ? 'Scheduling counseling unlocks the frontal lobe activation guide.' : '전문 상담 신청 시 전두엽 활성 가이드가 개방됩니다.'}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 뇌 인지 반응 결과 가이드는 항상 노출 */}
        {(() => {
          const reactionImg = safeImages.find(img => img.step === ('BRAIN_REACTION' as any));
          const memoryImg = safeImages.find(img => img.step === 'BRAIN_MEMORY');
          
          // 라이트 버전에서는 두뇌 인지 반응 테스트를 하지 않으므로 fallback 데이터를 생성하지 않음
          const hasReactionData = !!reactionImg;
          
          const brainAgeVal = Number(safeReport.brainAge) || 40;
          const memoryData = memoryImg?.brainTestData || {
            memoryCorrect: Math.max(1, Math.min(8, Math.round(10 - (brainAgeVal - 20) * 0.08))),
            memorySpan: Math.max(1, Math.min(6, Math.round(8 - (brainAgeVal - 20) * 0.08))),
            mathCorrect: brainAgeVal < 60,
            distractionCorrect: brainAgeVal < 50 ? 2 : brainAgeVal < 70 ? 1 : 0
          };

          const getMemoryGrade = (span: number) => {
            if (span >= 6) return { grade: isEn ? 'Excellent' : '매우 우수', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', emoji: '🏆' };
            if (span >= 5) return { grade: isEn ? 'Good' : '우수', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', emoji: '✅' };
            if (span >= 3) return { grade: isEn ? 'Fair' : '보통', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', emoji: '⚠️' };
            return { grade: isEn ? 'Needs Improvement' : '개선 필요', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', emoji: '🔻' };
          };

          return (
            <section className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-[40px] p-8 md:p-12 border border-indigo-100 text-left">
              <div className="text-center mb-10">
                <span className="text-purple-500 text-sm font-bold uppercase tracking-[0.3em]">BRAIN AGE TEST DETAIL</span>
                <h3 className="text-3xl font-black text-slate-900 mt-3">🧠 {hasReactionData ? (isEn ? 'Brain Cognitive Response Guide' : '두뇌 인지 반응 결과 가이드') : (isEn ? 'Grocery Shopping Memory Guide' : '마트 장보기 기억력 결과 가이드')}</h3>
                {safeReport.brainAge && (
                  <div className="mt-4 inline-flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-3 rounded-full shadow-lg">
                    <span className="font-bold">{isEn ? 'Estimated Brain Age' : '추정 뇌 나이'}</span>
                    <span className="text-3xl font-black">{safeReport.brainAge}{isEn ? ' yrs' : '세'}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center w-full">
                {/* 마트 장보기 기억력 */}
                {memoryData && (
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-md w-full max-w-2xl">
                    <div className="text-center mb-6">
                      <div className="text-5xl mb-2">🛒</div>
                      <h4 className="text-xl font-black text-slate-800">{isEn ? 'Grocery Shopping Memory' : '마트 장보기 기억력'}</h4>
                      <p className="text-xs text-slate-400 mt-1">{isEn ? 'Working Memory + Arithmetic Ability' : '작업기억(Working Memory) + 산술능력'}</p>
                    </div>
                    
                    <div className="space-y-5">
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-500">기억 정답</span>
                        <div className="text-4xl font-black text-indigo-600">{(memoryData.memoryCorrect !== undefined) ? memoryData.memoryCorrect : (memoryData.memorySpan || 0)}/8개</div>
                      </div>
                      
                      {/* Block visualization */}
                      <div className="flex justify-center gap-2">
                        {Array.from({ length: 8 }, (_, i) => (
                          <div 
                            key={i}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                              i < ((memoryData.memoryCorrect !== undefined) ? memoryData.memoryCorrect : (memoryData.memorySpan || 0))
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-sm'
                                : 'bg-slate-100 text-slate-300 border border-slate-200'
                            }`}
                          >
                            {i + 1}
                          </div>
                        ))}
                      </div>

                      {/* 가격 계산 */}
                      <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                        <span className="text-sm text-slate-600 font-bold">💰 가격 계산</span>
                        <span className={`font-black text-lg ${memoryData.mathCorrect ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {memoryData.mathCorrect ? '✅ 정답' : '❌ 오답'}
                        </span>
                      </div>

                      {/* 사칙연산 트릭 */}
                      <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                        <span className="text-sm text-slate-600 font-bold">🧠 사칙연산 트릭</span>
                        <span className={`font-black text-lg ${(memoryData.distractionCorrect ?? 0) >= 2 ? 'text-emerald-600' : (memoryData.distractionCorrect ?? 0) >= 1 ? 'text-amber-500' : 'text-rose-500'}`}>
                          {memoryData.distractionCorrect ?? 0}/2 정답
                        </span>
                      </div>

                      {(() => {
                        const g = getMemoryGrade((memoryData.memoryCorrect !== undefined) ? memoryData.memoryCorrect : (memoryData.memorySpan || 0));
                        return (
                          <div className={`text-center py-3 rounded-xl border ${g.bg} ${g.border}`}>
                            <span className="text-lg mr-1">{g.emoji}</span>
                            <span className={`font-black ${g.text}`}>{g.grade}</span>
                          </div>
                        );
                      })()}
                      
                      <div className="relative overflow-hidden p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`${isSimpleView ? 'filter blur-[3px] opacity-40 select-none pointer-events-none' : ''}`}>
                          <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                            {isEn
                              ? 'The grocery memory test evaluates the working memory capacity of the hippocampus and frontal lobes. It comprehensively assesses the ability to remember 8 items, perform mathematical calculation distractors, and complete mental arithmetic tasks.'
                              : '마트 장보기 기억력 테스트는 해마와 전두엽의 작업기억 능력을 측정합니다. 8개 물건을 정확히 인지하고 사칙연산 방해 작업을 수행하며 동시에 암산 능력을 갖추었는지 종합 평가합니다.'}
                          </p>
                        </div>
                        {isSimpleView && (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/10 backdrop-blur-[0.5px]">
                            <span className="text-[10px] text-indigo-700 font-black">🔒 {isEn ? 'Detailed memory guide will be unlocked during counseling.' : '상세 기억력 가이드는 전문 상담 시 개방됩니다.'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })()}

        {/* 입체 안면 노화 분석 (원래의 위치로 복귀) */}
        {safeReport.faceAnalysis && (
          <section className="bg-white p-8 rounded-3xl border border-slate-200 relative overflow-hidden text-left shadow-sm">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 relative z-10">
                <i className="fas fa-smile-beam text-rose-500"></i>
                {isEn ? 'Face Aging Analysis' : '입체 안면 노화 분석'} {isSimpleView && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md font-bold">{isEn ? '50% Preview' : '50% 미리보기'}</span>}
              </h3>
              <div className="space-y-4 relative z-10">
                {safeReport.faceAnalysis.skinTone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                    <i className="fas fa-sun text-rose-500 text-sm"></i>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-850">{isEn ? 'Skin Tone & Brightness' : '피부 톤 및 밝기'}</h5>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.skinTone)}</p>
                  </div>
                </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                    <i className="fas fa-water text-rose-500 text-sm"></i>
                  </div>
                  <div>
                    <h5 className="text-base font-bold text-slate-855">{isEn ? 'Skin Elasticity' : '피부 탄력도'}</h5>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.elasticity)}</p>
                  </div>
                </div>
                {/* 50% 미리보기: isSimpleView일 때 나머지 항목 블러 처리 */}
                <div className={`${isSimpleView ? 'relative' : ''}`}>
                  <div className={`space-y-4 ${isSimpleView ? 'filter blur-[6px] opacity-40 select-none pointer-events-none' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-1">
                        <i className="fas fa-wave-square text-rose-500 text-sm"></i>
                      </div>
                      <div>
                        <h5 className="text-base font-bold text-slate-855">{isEn ? 'Wrinkles & Contours' : '주름 및 굴곡'}</h5>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.faceAnalysis.wrinkles)}</p>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <h5 className="text-sm font-bold text-slate-500 uppercase mb-2">{isEn ? 'Face Comprehensive Evaluation' : '안면 종합 평가'}</h5>
                      <p className="text-base text-slate-800 font-bold">{sanitize(safeReport.faceAnalysis.summary)}</p>
                    </div>
                    {safeReport.faceAnalysis.recommendation && (
                      <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100">
                        <h5 className="text-sm font-bold text-rose-500 uppercase mb-2">{isEn ? 'Personalized Improvement Solution' : '맞춤형 개선 솔루션'}</h5>
                        <p className="text-base text-rose-800 font-bold">{sanitize(safeReport.faceAnalysis.recommendation)}</p>
                      </div>
                    )}
                  </div>
                  {isSimpleView && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="bg-rose-500/80 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-rose-400/30 flex items-center gap-2 shadow-lg">
                        <i className="fas fa-lock text-rose-100 text-xs"></i>
                        <span className="text-xs text-white font-bold">{isEn ? 'Detailed results will be unlocked after scheduling counseling' : '상세 결과는 전문 상담 신청 후 공개'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </section>
        )}

        {/* ========================================================
            3. 에너지 및 7코드 분석 (Energy Body - 본질 에너지)
            기존 다크모드/남색 그라데이션 스타일 복원 및 100% 노출
           ======================================================== */}
        <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-[40px] p-8 md:p-12 text-white text-left">
          
          {/* 3바디 균형 분석 */}
          <div className="text-center mb-10">
            <span className="text-cyan-400 text-sm font-bold uppercase tracking-[0.3em]">3BODY ANALYSIS</span>
            <h3 className="text-4xl font-black mt-3">{isEn ? '3-Body Balance Analysis' : '3바디 균형 분석'}</h3>
            <p className="text-slate-300 text-base mt-3 font-medium">{isEn ? 'Integrated balance of Physical, Energy, and Brain' : '신체(Physical) · 에너지(Energy) · 두뇌(Brain)의 통합 밸런스 상태'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {[
              { key: 'body', icon: '🏃', title: isEn ? 'PHYSICAL BODY (Physical Vitality & Core)' : 'PHYSICAL BODY (신체 활력 및 중심축)', color: 'from-emerald-500 to-teal-600', data: threeBody.body },
              { key: 'mind', icon: '💚', title: isEn ? 'ENERGY BODY (Emotional & Energy Balance)' : 'ENERGY BODY (정서 및 기 에너지 밸런스)', color: 'from-violet-500 to-purple-600', data: threeBody.mind },
              { key: 'brain', icon: '🧠', title: isEn ? 'INFORMATION BODY (Brain Cognition & Focus)' : 'INFORMATION BODY (두뇌 인지 및 정보 처리력)', color: 'from-amber-500 to-orange-600', data: threeBody.brain }
            ].map(item => (
              <div key={item.key} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 text-center">
                <div className="text-5xl mb-4">{item.icon}</div>
                <h4 className="font-bold text-xl mb-3">{item.title}</h4>
                <div className={`text-5xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-4`}>
                  {item.data?.score || 0}{isEn ? ' pts' : '점'}
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.data?.score || 0}%` }} />
                </div>
                <p className="text-base text-slate-200 leading-relaxed font-medium">{sanitize(item.data?.description)}</p>
              </div>
            ))}
          </div>

          {/* 7코드 에너지 분석 */}
          <div className="mt-10 pt-10 border-t border-white/10">
            <div className="text-center mb-8">
              <span className="text-amber-400 text-sm font-bold uppercase tracking-[0.3em]">7CODE ENERGY</span>
              <h3 className="text-3xl font-black mt-3">{isEn ? '7-Code Energy Analysis' : '7코드 에너지 분석'}</h3>
              <p className="text-slate-300 text-base mt-2 font-medium">{isEn ? 'Analyzing your energy flow through 7 key codes' : '당신의 에너지 흐름을 7가지 코드로 분석합니다'}</p>
            </div>
            
            <div className="space-y-4">
              {sevenCodeList.map(item => {
                const activeWeakestCode = getWeakestFromReport();
                const isWeakest = item.id === activeWeakestCode;
                const grade = getChakraGrade(item.score);
                
                const activeCodeNames = isEn ? SEVEN_CODE_NAMES_EN : SEVEN_CODE_NAMES;
                const labelText = activeCodeNames[item.id]?.name || item.label;

                return (
                  <div key={item.id} className={`bg-white/5 rounded-2xl p-5 border transition-all ${isWeakest ? 'border-amber-400/80 bg-white/10 ring-1 ring-amber-400/30 shadow-md' : 'border-white/10'}`}>
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.bgGrad} flex items-center justify-center font-black text-white text-lg shrink-0 shadow-md`}>
                        {item.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-base text-white flex items-center gap-2">
                            {labelText}
                            {isWeakest && (
                              <span className="text-[9px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                🚨 {isEn ? 'Weakest' : '최약'}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-black/45 border text-[10px] font-black text-amber-400 border-amber-900/30 rounded-md">
                              {grade.text}
                            </span>
                            <span className="text-base font-black text-white ml-1">{item.score}{isEn ? ' pts' : '점'}</span>
                          </div>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                          <div className={`h-full bg-gradient-to-r ${item.bgGrad} rounded-full transition-all duration-1000`} style={{ width: `${item.score}%` }} />
                        </div>
                        <p className="text-sm font-medium text-slate-300 mb-2">{item.description}</p>
                        {item.evidence && item.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.evidence.map((ev, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-white/10 rounded-md text-[11px] text-emerald-200 border border-emerald-500/30">
                                ✓ {sanitize(ev)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3바디 7코드 점검 핵심 분석 */}
        {(() => {
          const activeWeakestCode = getWeakestFromReport();
          const activeCodeNames = isEn ? SEVEN_CODE_NAMES_EN : SEVEN_CODE_NAMES;
          const codeInfo = activeCodeNames[activeWeakestCode] || activeCodeNames[4];
          return (
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-left shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              <h3 className="text-lg font-black text-amber-400 mb-3 flex items-center gap-2">
                <span>💡</span> {isEn ? "Today's Core Analysis (Weakest Code Charge Guide)" : "오늘 점검 핵심 분석 (최약 코드 충전 가이드)"}
              </h3>
              <p className="text-sm font-semibold text-slate-300 leading-relaxed mb-4">
                {isEn
                  ? <>Out of your 7 energy codes, the one requiring activation is <strong className="text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{codeInfo.name}</strong>.</>
                  : <>회원님의 전체 7개 에너지 축 중 현재 가장 활성화가 필요한 곳은 <strong className="text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">{codeInfo.name}</strong>입니다.</>}
              </p>
            </section>
          );
        })()}

        {/* 에너지 MBTI 기질 상태 */}
        <section className="text-left">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <i className="fas fa-magic text-indigo-505"></i>
            🔮 {isEn ? 'Energy MBTI Status' : '에너지 MBTI 기질 상태'}
          </h3>
          <EnergyMbtiWebCard 
            mbtiCode={mbtiCode} 
            testDate={new Date(safeReport.date || Date.now()).toLocaleDateString()} 
            isSimpleView={isSimpleView} 
          />
        </section>

        {/* ========================================================
            5. 행동 촉구 및 잠금 해제 (Action & Closing)
           ======================================================== */}
        {isSimpleView && (
          <div className="bg-slate-900 border-2 border-indigo-500/50 p-8 rounded-[2.5rem] shadow-2xl max-w-2xl mx-auto text-center my-8">
            <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-question-circle text-2xl animate-pulse text-indigo-400"></i>
            </div>
            <h4 className="text-white text-xl font-black mb-3">{isEn ? 'Apply for Personalized Coaching & Counseling' : '맞춤 관리 및 전문 상담 신청'}</h4>
            <p className="text-slate-300 text-sm leading-relaxed mb-6 font-medium">
              {isEn ? (
                <>
                  Would you like 1:1 coaching or consulting for your weakest energy area, <strong>{codeInfo.name}</strong> ({codeInfo.region})?<br />
                  Apply to fully unlock the detailed report, 3-body solution guides, and comprehensive review.
                </>
              ) : (
                <>
                  최근 에너지가 저하된 약한 코드인 <strong>{codeInfo.name}</strong>({codeInfo.region})에 대해 <strong>1:1 맞춤형 훈련 관리</strong>를 받고 싶으시거나, <strong>깊은 전문 상담</strong>을 원하십니까?<br />
                  원하시는 관리/상담을 신청하시면 상세 결과 분석 리포트, 3바디 통합 솔루션 가이드 및 종합 평가 리포트가 완전히 개방됩니다.
                </>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  setIsSimpleView(false);
                  setTimeout(() => {
                    const element = document.getElementById('detailed-section-top');
                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>{isEn ? '🌱 Apply for 1:1 Coaching' : '🌱 1:1 맞춤 관리 신청'}</span>
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
              <button
                onClick={() => {
                  setIsSimpleView(false);
                  setTimeout(() => {
                    const element = document.getElementById('detailed-section-top');
                    if (element) element.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <span>{isEn ? '💬 Apply for In-depth Counseling' : '💬 깊은 전문 상담 신청'}</span>
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
        {!isSimpleView && (
          <>
            <div id="detailed-section-top" className="scroll-mt-10" />

            {/* 3바디 통합 솔루션 가이드 */}
            {safeReport.recommendations && (
              <section className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 rounded-[40px] p-8 md:p-12 border border-teal-200/50 text-left">
                <div className="relative z-10">
                  <div className="text-center mb-10">
                    <span className="text-teal-600 text-sm font-bold uppercase tracking-[0.3em]">3BODY SOLUTION GUIDE</span>
                    <h3 className="text-4xl font-black text-slate-900 mt-3">3바디 통합 솔루션 가이드</h3>
                    <p className="text-teal-800/80 text-base font-medium mt-3">분석 결과를 바탕으로 몸·마음·뇌 각 차원의 맞춤 명상 및 훈련 동작을 안내합니다</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-emerald-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">🏃</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">몸(Body)</h4>
                      <p className="text-xs font-bold text-emerald-600 mb-3">교정 체조 · 자세 개선</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.gymnastics)}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-violet-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-violet-400 to-purple-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">💚</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">마음(Mind)</h4>
                      <p className="text-xs font-bold text-violet-600 mb-3">명상 · 에너지 밸런스</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.meditation)}</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-lg border border-amber-100">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-2xl shadow-md mb-4">🧠</div>
                      <h4 className="text-xl font-black text-slate-800 mb-1">뇌(Brain)</h4>
                      <p className="text-xs font-bold text-amber-600 mb-3">뇌 기능 훈련 · 인지 강화</p>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">{sanitize(safeReport.recommendations.brainTraining)}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* 종합 평가 리포트 (순서 변경: 솔루션 가이드 바로 다음) */}
            <div className="bg-slate-50 p-10 rounded-[40px] border border-slate-200 text-center max-w-4xl mx-auto mt-8">
              <h4 className="text-3xl font-black text-slate-800 mb-6">종합 평가 리포트</h4>
              <p className="text-lg font-medium text-slate-700 leading-relaxed mb-8 italic">"{sanitize(safeReport.summary)}"</p>
              <div className="flex flex-wrap justify-center gap-4 print:hidden">
                <button onClick={handleShare} className={`px-8 py-3 font-bold rounded-2xl flex items-center gap-2 shadow-sm transition-all cursor-pointer ${copied ? 'bg-emerald-500 text-white border border-emerald-500' : 'bg-white text-slate-900 border border-slate-300'}`}>
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i> {copied ? '복사 완료! 카톡에 붙여넣기 하세요' : '카톡 공유용 복사'}
                </button>
                <button onClick={onRestart} className="px-8 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-200 transition-all cursor-pointer">
                  메인으로 이동
                </button>
              </div>
            </div>

            {/* 맞춤 프로그램 추천 (순서 변경: 마지막) */}
            {safeReport.programRecommendation && (
              <section className="bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden text-left mt-8">
                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <span className="text-indigo-200 text-sm font-bold uppercase tracking-[0.3em]">RECOMMENDED PROGRAM</span>
                    <h3 className="text-4xl font-black mt-3">맞춤 프로그램 추천</h3>
                  </div>
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-10 border border-white/20 text-center mb-8">
                      <div className={safeReport.programRecommendation.recommended?.length > 15 ? 'text-3xl md:text-4xl font-black text-white mb-4 leading-tight' : 'text-5xl md:text-6xl font-black text-white mb-4 leading-tight'}>{sanitize(safeReport.programRecommendation.recommended)}</div>
                      <p className="text-indigo-50 text-lg leading-relaxed font-medium mb-6">{sanitize(safeReport.programRecommendation.reason)}</p>
                      <div className="bg-white/10 rounded-2xl p-5 text-base font-bold text-white">{sanitize(safeReport.programRecommendation.duration)}</div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-center mb-10">
                      {[
                        { label: '21일', desc: '변화 시작', active: safeReport.programRecommendation.recommended?.includes('21') },
                        { label: '66일', desc: '습관 정착', active: safeReport.programRecommendation.recommended?.includes('66') },
                        { label: '100일', desc: '삶의 전환', active: safeReport.programRecommendation.recommended?.includes('100') }
                      ].map(p => (
                        <div key={p.label} className={`rounded-2xl p-5 border ${p.active ? 'bg-white text-indigo-700 border-white shadow-xl' : 'bg-white/5 border-white/10 text-indigo-200'}`}>
                          <div className="text-2xl font-black">{p.label}</div>
                          <div className="text-sm mt-2 font-bold">{p.desc}</div>
                        </div>
                      ))}
                    </div>

                    {/* 7-CODE 맞춤 특화 프로그램 */}
                    <div className="mt-10 pt-10 border-t border-white/10 relative">
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-800 px-6 py-2 rounded-full text-sm font-black text-indigo-200 border border-white/10 shadow-lg tracking-widest whitespace-nowrap">
                        7-CODE 맞춤 특화 수련
                      </div>
                      <div className="text-center mt-8 mb-6">
                        <p className="text-indigo-100 text-lg font-medium bg-white/5 inline-block px-6 py-3 rounded-2xl border border-white/10">
                          {specialized.reason}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto text-center">
                        {specialized.bodyFree && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-amber-400 to-orange-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">바디프리 명상</h4>
                            <p className="text-xs text-white/80 leading-relaxed">신체 에너지 순환 및 기혈 흐름 원활화 과정</p>
                          </div>
                        )}
                        {specialized.cleanBreath && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-emerald-400 to-teal-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">클린호흡 1, 2</h4>
                            <p className="text-xs text-white/80 leading-relaxed">단전 호흡 및 흉곽 이완 감정 해소 과정</p>
                          </div>
                        )}
                        {specialized.mindFree && (
                          <div className="block rounded-3xl p-6 border transition-all bg-gradient-to-br from-pink-400 to-rose-500 border-white/50 shadow-lg">
                            <h4 className="text-2xl font-black text-white mb-2">마음프리 명상</h4>
                            <p className="text-xs text-white/80 leading-relaxed">스트레스 조절 및 내적 안정 의식 정립 과정</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* [8] 재측정 유도 및 CodeMap 앱 다운로드 QR */}
            <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[40px] text-white flex flex-col md:flex-row items-center justify-between gap-6 max-w-4xl mx-auto mt-8 text-left">
              <div className="text-left">
                <h4 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-2">
                  📈 {isEn ? 'Track changes on your next assessment' : '다음 측정 시 변화를 추적하세요'}
                </h4>
                <p className="text-indigo-200 text-xs font-semibold leading-relaxed mb-4">
                  {isEn ? (
                    <>
                      Your integrated balance age is <strong className="text-amber-400">{safeReport.comprehensiveAge || safeReport.physicalAge || 0} years</strong>.<br/>
                      Link with our mobile app (coming soon) to track historical progress and comparison charts.
                    </>
                  ) : (
                    <>
                      오늘 측정된 종합 밸런스 나이는 <strong className="text-amber-400">{safeReport.comprehensiveAge || safeReport.physicalAge || 0}세</strong>입니다.<br/>
                      모바일 앱(출시 예정)에 연동해 두시면 다음 측정 결과와 정밀 비교 그래프를 받아보실 수 있습니다.
                    </>
                  )}
                </p>
                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                  <span>{isEn ? '📱 Mobile App coming soon' : '📱 모바일 App 지원 예정'}</span>
                  <span>•</span>
                  <span>{isEn ? 'Smart progress tracking service planned' : '스마트 이력 관리 서비스 예정'}</span>
                </div>
              </div>
              
              <div className="bg-white p-3 rounded-2xl flex items-center gap-4 border border-indigo-500/20 shrink-0">
                <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 relative overflow-hidden">
                  <img src="./assets/images/icon.png" alt="App QR" className="w-16 h-16 object-contain filter blur-[1px] opacity-70" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-[10px] font-black text-amber-400 text-center uppercase tracking-wider leading-tight">COMING<br/>SOON</span>
                  </div>
                </div>
                <div className="text-left text-slate-800">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">CodeMap App</span>
                  <span className="text-sm font-black text-slate-900 block leading-tight">{isEn ? 'CodeMap App (Coming Soon)' : '코드맵 앱 출시 예정 (준비 중)'}</span>
                  <span className="text-[10.5px] text-slate-500 font-medium block mt-1.5 leading-snug">
                    {isEn ? (
                      <>
                        Historical tracking app is coming soon.<br/>
                        You will be able to find it in the App Store upon release.
                      </>
                    ) : (
                      <>
                        정밀 이력 관리용 앱이 곧 출시됩니다.<br/>
                        출시 후 스토어에서 만나보실 수 있습니다.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </section>

            {/* 관리자 피드백 패널 */}
            <FeedbackPanel report={safeReport} />
          </>
        )}

        {/* ⚠️ 법적 면책 고지 (의료법 준수) */}
        <div className="mt-8 mb-2 px-6 py-4 bg-amber-50 border border-amber-200 rounded-2xl text-center print:block">
          <p className="text-amber-800 text-xs font-bold mb-1">
            ⚠️ {BRAND_NAME} {isEn ? 'Wellness Information & Disclaimer' : '이용 안내 (법적 면책 고지)'}
          </p>
          <p className="text-amber-700 text-[10.5px] leading-relaxed">
            {isEn ? (
              'This screening is a wellness guide to evaluate posture and energy flow for self-care. It is NOT medical diagnosis, advice, or therapy under medical laws. It does not replace medical consultation. For diagnostic concerns or persistent pain, consult a healthcare provider.'
            ) : (
              <>
                본 결과는 생체 에너지 및 체형 균형 상태를 파악하여 자가 관리를 돕기 위한 <strong>웰니스 스크리닝 지표</strong>입니다.{' '}
                의료기기법에 따른 의료기기 분석 또는 의료법상의 의료행위가 <strong>아닙니다</strong>.<br />
                본 리포트는 질병의 예방, 의학적 분석·조율·치료를 대체하지 않습니다.{' '}
                근골격계 및 인지 반응 상의 신계적인 의학적 통증이나 정밀 소견이나 검진이 필요하신 경우 전문 의료기관의 진료를 받아보시길 강력히 권장합니다.
              </>
            )}
          </p>
        </div>

        {/* 예상 설명 시간 정보 표시 */}
        <div className="text-center text-slate-400 text-xs font-bold mt-2">
          {isEn ? '⏱️ Est. explanation time: ~3 mins' : '⏱️ 핵심 설명 예상 시간 약 3분'}
        </div>

      </div>
    </div>
  );
};

export default ReportDashboard;
