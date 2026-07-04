// 3바디 7코드 분석 데이터로부터 에너지 MBTI 코드를 도출하고 관련 상세 유형 정보를 제공하는 모듈

import { BodyReport } from '../../types/core';

export interface EnergyMbtiDetail {
  code: string;
  name: string;
  englishName: string;
  summary: string;
  description: string;
  primaryColors: string[];
  imageKey: string;
  threeBodyAnalysis: string;
  energyFortune: string;
  luckyPrescription: string;
}

export const ENERGY_MBTI_DATA: Record<string, EnergyMbtiDetail> = {
  PEAG: {
    code: 'PEAG',
    name: '퀀텀 에너자이저',
    englishName: 'All-in-One Aura Master',
    summary: '모든 에너지 코드가 완벽하게 순환하는 이상적인 골드 밸런스',
    description: '활력, 지적 통찰, 감정 소통, 그리고 정신적 안정이 정교한 만점 균형을 이루는 이상적인 상태입니다. 주변에 압도적인 긍정 아우라를 전파합니다.',
    primaryColors: ['#E74C3C', '#E67E22', '#F1C40F', '#2ECC71', '#3498DB', '#9B59B6', '#E8D5F5'],
    imageKey: 'peag_aura_monarch',
    threeBodyAnalysis: '1코드(기초)부터 7코드(연결)까지 기혈 흐름에 정체가 없어 신체, 뇌파, 심신이 황금비를 이룹니다. 에너지 저항력이 강하고 면역과 활력이 최상입니다.',
    energyFortune: '만물에 햇살이 가득 내리쬐는 비옥한 운기이자, 타로의 "The Sun(태양)" 카드에 비유됩니다. 의식의 조율 상태가 완벽하니 오늘 계획한 모든 행동이 매끄럽게 진행될 행운의 타이밍입니다.',
    luckyPrescription: '미온수 텀블러 소지, 시그니처 7코드 순환 체조, 골드 톤 액세서리',
  },
  PEAF: {
    code: 'PEAF',
    name: '풀악셀 질주러',
    englishName: 'Low-Battery Bulldozer',
    summary: '신체 활력은 폭발적이나 가슴의 여유가 고갈된 과부하 상태',
    description: '목표 지향적이고 강한 신체 행동력을 보여주지만 가슴의 감정과 마음의 여유가 심하게 정체되어 있습니다. 에너지는 넘치나 내면의 급성 번아웃을 경계해야 합니다.',
    primaryColors: ['#E74C3C', '#E67E22'],
    imageKey: 'peaf_exhausted_bulldozer',
    threeBodyAnalysis: '1코드(회음)와 3코드(중완) 등 하체 및 코어 추진력은 최상이지만, 감정 완충을 담당하는 4코드(단중 - 가슴)가 40점 미만으로 낮아 가슴 내압이 크게 누적된 신체 중심 쏠림 상태입니다.',
    energyFortune: '과열된 상태로 질주하는 전차나 타로의 "The Chariot(전차)" 역방향에 가깝습니다. 질주를 잠시 멈추고 창문을 열어 환기해야 할 때이니, 오늘 하루는 깊은 호흡으로 들뜬 열기를 가라앉히는 데 집중하세요.',
    luckyPrescription: '페퍼민트 아로마 쿨링 테라피, 4코드 가슴 개방 명상, 초록색 힐링 아이템',
  },
  PECG: {
    code: 'PECG',
    name: '신나는 댕댕이',
    englishName: 'Energetic Chemist',
    summary: '풍부한 체력과 친근함으로 사람들과 에너지를 연결하는 소통가',
    description: '우수한 피지컬과 높은 소통 코드로 어디서나 자연스러운 관계 조율 능력을 보여줍니다. 명랑하고 활기찬 주파수로 주변 사람들의 굳은 에너지 흐름을 깨웁니다.',
    primaryColors: ['#E67E22', '#F1C40F'],
    imageKey: 'pecg_playful_alchemist',
    threeBodyAnalysis: '2코드(창조)와 5(소통)의 파동 결합이 활발하여, 신체 표현력이 뛰어나고 뇌파가 긍정적이고 명랑한 주파수 대역에 안착해 있습니다.',
    energyFortune: '주변을 풍성하고 따뜻하게 살찌우는 대지의 온기이자, 타로의 "The Empress(여황제)" 카드와 닮았습니다. 타인과 협력하고 의견을 나눌 때 나의 기혈 순환이 배로 빨라지고 활력이 차오르는 맑은 운세입니다.',
    luckyPrescription: '상큼한 귤피차, 5코드 활성화를 위한 목소리 낭독 명상, 오렌지색 소품',
  },
  PECF: {
    code: 'PECF',
    name: '고독한 인싸',
    englishName: 'Lonely Spotlighter',
    summary: '밝은 활동성 뒤에 내면의 고립감과 가슴의 공허함이 잠재된 상태',
    description: '외부 소통 & 피지컬 활동은 활발하나 내면의 깊은 정서 안정이 억눌려 가슴 부근이 비어 있습니다. 겉은 화려하지만 내면의 밀착 정화 훈련이 요구됩니다.',
    primaryColors: ['#E67E22', '#9B59B6'],
    imageKey: 'pecf_wandering_dancer',
    threeBodyAnalysis: '2코드(창조)와 6코드(통찰)의 고차원 연결은 작동하지만, 감정 중심부인 4코드(단중)의 기혈 순환이 원활하지 않아 겉돌고 있는 불균형 상태입니다.',
    energyFortune: '축제가 끝난 뒤 화려한 조명 아래 혼자 남은 예술가나 타로의 "The Fool(광대)" 카드와 닮았습니다. 타인의 시선에 에너지를 쓰기보다는, 오늘 하루는 오직 나만의 고요한 내적 기쁨에 기운을 집중해야 안정됩니다.',
    luckyPrescription: '허브 오일 반신욕, 4코드 자비 확언 명상, 레몬 옐로우 컬러 소품',
  },
  PSAG: {
    code: 'PSAG',
    name: '갓생 실행러',
    englishName: 'Grounding Architect',
    summary: '단단한 뿌리와 굳건한 실행력으로 시스템을 지탱하는 기둥',
    description: '현실적인 에너지 정렬도가 매우 높고 뚝심 있는 의지력으로 한결같은 안정감을 뿜어냅니다. 요동치지 않고 자신의 과업을 차분하게 완수해 냅니다.',
    primaryColors: ['#E74C3C', '#F1C40F'],
    imageKey: 'psag_silent_sentinel',
    threeBodyAnalysis: '1코드(기초)와 3코드(중완)가 바위처럼 단단하게 중심을 잡고 있으며, 7코드(연결)의 뇌파가 차분하게 진정되어 있습니다. 상체와 하체의 기운 분배가 매우 조화롭습니다.',
    energyFortune: '거대한 바위 산맥이나 타로의 "The Emperor(황제)" 카드와 흡사합니다. 흔들리지 않는 굳건한 땅의 에너지가 충만하니, 미뤄두었던 현실적인 일처리나 집중력이 필요한 계획을 집행하기에 최상의 날입니다.',
    luckyPrescription: '우디 향 룸 스프레이, 1코드 뿌리 강화를 위한 스쿼트 운동, 다크 브라운 소품',
  },
  PSAF: {
    code: 'PSAF',
    name: '초긴장 워리어',
    englishName: 'Lonely Warrior',
    summary: '막중한 책임감을 하체 힘으로 버티고 있으나 가슴 울화가 누적된 상태',
    description: '강한 의지로 묵묵히 압박을 감당하고 있지만 가슴 중앙에 화의 에너지가 단단히 뭉쳐 있습니다. 스트레스 수치가 과부하되어 근육과 신경계가 팽팽히 조여져 있습니다.',
    primaryColors: ['#E74C3C', '#3498DB'],
    imageKey: 'psaf_lonely_guardian',
    threeBodyAnalysis: '1코드(회음)의 힘으로 피로를 억지로 지탱하고 있으나, 4코드(단중 - 가슴)에 긴장성 응어리가 쌓여 호흡이 가쁘고 뇌파가 예민한 방어적 주파수를 뿜는 상태입니다.',
    energyFortune: '폭풍우 속에서 혼자 방패를 든 채 성문을 막고 선 병사나 타로의 "Ten of Wands(압박감)" 카드와 닮았습니다. 책임감이라는 덫에 갇혀 있으니, 오늘은 무조건 10분 이상 몸의 힘을 풀고 가슴 댐을 열어야 탈이 없습니다.',
    luckyPrescription: '따뜻한 대추계피차, 4코드 가슴 두드리기 및 뇌파 이완 수련, 레드 톤 소품',
  },
  PSCG: {
    code: 'PSCG',
    name: '차분한 과몰입러',
    englishName: 'Silent Maker',
    summary: '깊은 자기 정렬과 고요한 몰입으로 가치를 창조해 내는 장인',
    description: '물리적인 기초 체력이 뛰어나면서도 내면의 의식을 맑게 가라앉히는 힘을 가졌습니다. 소란스러운 외부 자극에 흔들리지 않고 본질에 깊이 파고듭니다.',
    primaryColors: ['#F1C40F', '#E8D5F5'],
    imageKey: 'pscg_master_artisan',
    threeBodyAnalysis: '3코드(중완)와 7코드(백회)의 통로가 조화를 이룹니다. 위장의 편안한 이완과 뇌파의 깊은 안정 알파파가 교차 작동하여, 체력적 안정과 고도의 고요한 집중력을 보여줍니다.',
    energyFortune: '깊은 숲속 한적한 암자나 타로의 "The Hermit(은둔자)" 카드에 가깝습니다. 외부의 참견을 차단하고 나만의 공간에서 조용히 사색하고 수련할 때 잠재된 내면의 혜안이 가장 눈부시게 밝아질 행운의 날입니다.',
    luckyPrescription: '따뜻한 솔잎차 한 잔, 7코드 백회 브레인 호흡 명상, 숲을 닮은 딥그린 소품',
  },
  PSCF: {
    code: 'PSCF',
    name: '철벽친 수호자',
    englishName: 'Concrete Silo',
    summary: '소통을 굳게 닫고 고집과 완고함으로 스스로를 가두어 둔 상태',
    description: '외부와의 감정 교류나 소통 창구를 단절한 채 자신만의 단단한 성벽 안에 갇힌 고립 상태입니다. 가슴과 목 주변의 굳은 기혈 순환을 유연하게 풀어야 행운이 유입됩니다.',
    primaryColors: ['#F1C40F'],
    imageKey: 'pscf_blocked_stoic',
    threeBodyAnalysis: '5코드(소통)와 4코드(가슴)의 통로가 막혀 의사 표현이 정체되고, 기운이 오직 머리와 하체에만 고착되어 있습니다. 뇌파 또한 강한 아집 주파수를 방출하는 상태입니다.',
    energyFortune: '굳게 잠긴 성문이나 타로의 "Four of Pentacles(소유와 완고함)" 카드와 닮았습니다. 낡은 생각이나 정체된 루틴에 갇혀 몸의 순환이 상했으니, 오늘은 온몸을 거칠게 털어내며 굳은 몸의 긴장부터 깨뜨려야 기운이 정화됩니다.',
    luckyPrescription: '알싸한 생강황칠차, 전신 진동 임파선 털기 수련 15분, 에메랄드 블루 소품',
  },
  MEAG: {
    code: 'MEAG',
    name: '브레인 전략가',
    englishName: 'Deep-Brain Strategist',
    summary: '고도의 두뇌 통찰과 냉철한 판단력으로 방향을 설계하는 지략가',
    description: '명확한 분석력과 맑은 상체 주파수를 활용해 문제의 핵심을 관통하는 전략가 상태입니다. 사사로운 감정에 기운이 요동치지 않으며 지적으로 우수한 균형을 이룹니다.',
    primaryColors: ['#9B59B6', '#F1C40F'],
    imageKey: 'meag_wise_strategist',
    threeBodyAnalysis: '6코드(인당 - 통찰)의 뇌파 정렬이 최상의 안정을 유지하며, 3코드(중완)의 내장계 지표가 단단히 이완되어 있습니다. 뇌의 집중 연산과 체력의 분배가 최적화되어 있습니다.',
    energyFortune: '구름 위에서 사냥감을 정밀 조준하는 매의 눈이나 타로의 "Queen of Swords(이성의 여왕)" 카드와 같습니다. 머리가 극도로 명징하여 막혔던 기획이나 지적 과업을 해치우기에 가장 영롱한 에너지를 내뿜는 날입니다.',
    luckyPrescription: '시원한 국화차 한 잔, 6코드 인당 부근 지압 및 브레인 힐링, 퍼플 컬러 소지품',
  },
  MEAF: {
    code: 'MEAF',
    name: '생각 풀가동러',
    englishName: 'Overclocked Thinker',
    summary: '뇌 연산은 한계치로 돌아가지만 하체 베이스가 완전히 방전된 상태',
    description: '끊임없는 사색과 과도한 잡념으로 뇌파가 과열 주파수를 내뿜고 있으나, 이를 지탱할 신체 하체 기운이 고갈되어 상열하한의 불균형이 극도로 심해진 상태입니다.',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'meaf_overheated_thinker',
    threeBodyAnalysis: '6코드(통찰)와 7코드(백회)의 뇌 에너지는 높게 사용되어 머리끝이 뜨거우나, 지지대인 1코드(회음)가 바닥나 기운이 공중에 떠도는 과열 상태입니다.',
    energyFortune: '냉각 장치 없이 한계 속도로 회전하는 엔진이나 타로의 "The Tower(과부하/붕괴)" 카드에 가깝습니다. 과한 잡념으로 뇌 세포가 비명을 지르고 있으니, 즉각 전자기기를 끄고 흙을 밟거나 하체로 기운을 내려 보내야 안전합니다.',
    luckyPrescription: '따뜻한 황칠차, 1코드 회음 강화를 위한 단전 그라운딩 명상, 대지 색상의 소품',
  },
  MECG: {
    code: 'MECG',
    name: '상상만렙 아티스트',
    englishName: 'Cosmic Creative Muse',
    summary: '풍부한 예술적 영감과 언어 주파수로 세상을 매료시키는 창조자',
    description: '우주적 안테나처럼 맑은 통찰력을 수신하고 이를 매끄러운 소통 코드로 전달하는 창작자 상태입니다. 기발한 언어와 아이디어 기운이 온몸에서 밝게 샘솟습니다.',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'mecg_cosmic_muse',
    threeBodyAnalysis: '6코드(통찰)와 5(소통)의 주파수 연동이 유연하며, 7코드(백회)의 뇌파가 맑게 열려 있습니다. 언어 소통 통로와 뇌 인지 에너지가 최상의 창의적 시너지를 보입니다.',
    energyFortune: '밤하늘을 수놓는 오로라나 타로의 "The Star(별)" 카드와 같습니다. 기발한 예술적 직관과 아이디어가 마르지 않는 샘물처럼 차오르니, 오늘 하루는 영감을 나누고 표현하는 일에서 놀라운 결실을 볼 것입니다.',
    luckyPrescription: '향긋한 아쌈 홍차, 7코드 백회 순환 명상 10분, 실버 계열 액세서리',
  },
  MECF: {
    code: 'MECF',
    name: '초민감 크리에이터',
    englishName: 'Sensitive Hurricane',
    summary: '두뇌 회전은 최고조이나 가슴 정체로 기복의 파도가 덮친 초민감 상태',
    description: '기발한 영감과 높은 인지 기능을 보유하고 있지만, 가슴의 정서적 안정로가 막혀 사소한 풍파에도 감정이 폭풍우를 타며 출렁이는 예민한 상태입니다.',
    primaryColors: ['#3498DB', '#E74C3C', '#9B59B6'],
    imageKey: 'mecf_tempest_wizard',
    threeBodyAnalysis: '6코드(통찰)와 7(백회)의 뇌 에너지는 높은 상태나, 심장 안정을 담당하는 4코드(단중 - 가슴)와 하단전 2코드의 에너지가 낮아 가슴의 울화가 심박수를 교란시키는 초민감 상태입니다.',
    energyFortune: '폭풍우가 치는 태풍 한가운데 놓인 바다나 타로의 "Three of Swords(심신의 요동)" 카드와 같습니다. 지성은 예리하지만 가슴의 댐이 꽉 찬 화를 분출하려 하니, 오늘 하루는 자극을 피하고 머리의 열을 가슴 밑으로 내려주어야 평온을 지킵니다.',
    luckyPrescription: '가슴을 고요히 풀어주는 황칠나무차, 4코드(단중) 집중 가슴 호흡 명상, 럭키 오렌지 아로마 향',
  },
  MSAG: {
    code: 'MSAG',
    name: '팩트정리러',
    englishName: 'Algorithm Analyst',
    summary: '감정을 철저히 배제하고 명료한 데이터로 문제를 파헤치는 분석가',
    description: '감정적인 노이즈를 철저히 여과하고 차가운 이성과 높은 실행력으로 정확한 해법을 수립합니다. 질서 정연하고 흔들림이 없는 논리적인 기운 상태입니다.',
    primaryColors: ['#3498DB', '#9B59B6'],
    imageKey: 'msag_stoic_analyst',
    threeBodyAnalysis: '6코드(인당)의 뇌파가 고요한 알파파 상태를 정밀 정렬하고 있으며, 3코드(중완)가 묵직하게 소화계 안정을 유도해 뇌와 오장육부의 정적 피드백이 이상적인 상태입니다.',
    energyFortune: '안개 한 점 없는 이른 아침의 얼어붙은 숲이나 타로의 "Justice(정의)" 카드와 같습니다. 머릿속 잡념과 오해가 완전히 걷히고 면도날 같은 선명함만 가득하니, 분석, 정리, 의사결정에 더없이 좋은 날입니다.',
    luckyPrescription: '시원한 녹차 한 잔, 3코드 오장육부 순환을 위한 단전 치기 200회, 네이비 톤 필기구',
  },
  MSAF: {
    code: 'MSAF',
    name: '방전된 사색가',
    englishName: 'Dilemma Scholar',
    summary: '지적 통찰력은 우주 끝까지 뻗어나가나 하체 힘이 빠져 예민한 상태',
    description: '생각과 뇌파의 심연은 깊으나, 몸을 든든하게 받쳐줄 뿌리(하체 기운)가 바짝 말라 있어 뇌의 자율신경계가 과민하게 불안을 조장하는 에너지 상태입니다.',
    primaryColors: ['#9B59B6', '#E74C3C'],
    imageKey: 'msaf_anxious_scholar',
    threeBodyAnalysis: '6코드(통찰)의 에너지 소모율은 우수하지만, 1코드(회음 - 기초)의 접지 에너지가 결핍 수준입니다. 기운이 머리로 쏠려 땅에 발을 붙이지 못하고 불안 신호를 생성하고 있습니다.',
    energyFortune: '구름 위에 매달려 흔들리는 나뭇가지나 타로의 "Nine of Swords(걱정과 긴장)" 카드와 닮았습니다. 머리로 가상의 걱정을 소환하느라 몸이 긴장해 있으니, 오늘만큼은 생각을 멈추고 몸을 쓰는 단순 활동에 몰두해야 길합니다.',
    luckyPrescription: '구수한 둥굴레차, 1코드 접지를 돕는 런지 및 스쿼트 훈련 10분, 묵직한 가죽 소품',
  },
  MSCG: {
    code: 'MSCG',
    name: '평온 마스터',
    englishName: 'K-Meditation Guru',
    summary: '통찰력과 평온함이 깊이 융합된 궁극의 명상적 에너지 정렬 상태',
    description: '지혜와 성찰, 가슴의 거대한 사랑이 원활히 융합되어 온전한 평온에 안착한 상태입니다. 외부의 소란에 주파수가 전염되지 않는 완전무결한 에너지 방어막을 이룩했습니다.',
    primaryColors: ['#2ECC71', '#E8D5F5'],
    imageKey: 'mscg_zen_master',
    threeBodyAnalysis: '6코드(통찰), 4(가슴), 7(백회)의 고차원 조절 능력이 부드러운 구형 오라 공명을 유도합니다. 심박수 변이도(HRV)가 최적의 안정을 나타내고 있으며, 뇌파도 깊은 명상 알파파 상태입니다.',
    energyFortune: '티 없이 맑고 투명한 유리 호수나 타로의 "The Temperance(절제/조화)" 카드와 닮았습니다. 온 심신이 고요에 정렬된 행운의 시기이니, 내적 치유를 시도하거나 큰 통찰을 길어내기에 가장 아름다운 날입니다.',
    luckyPrescription: '카모마일 릴렉싱 티, 4-6코드 조율 호흡 수련 15분, 에메랄드 그린 컬러 소품',
  },
  MSCF: {
    code: 'MSCF',
    name: '구름 위 드리머',
    englishName: 'Cloud Walker',
    summary: '의식과 영성은 맑게 깨어있으나 지상의 현실 기운이 말라 붕 뜬 상태',
    description: '사색과 정신적 고결함은 빼어나지만, 현실 세계를 살아가고 물리적으로 실행할 하체의 기운결합이 차단되어 있습니다. 기운이 하늘로만 증발하여 공중부양하듯 붕 떠 있습니다.',
    primaryColors: ['#3498DB', '#E8D5F5'],
    imageKey: 'mscf_ethereal_mystic',
    threeBodyAnalysis: '7코드(백회)의 영적 조율도는 활짝 개방되어 있으나, 1코드(회음)와 2코드(하단전)의 물리적 기운 밀도가 약해져 있습니다. 기운이 하부에 모이지 않아 실행력이 지연되는 상태입니다.',
    energyFortune: '허공에 발이 묶인 채 하늘을 응시하는 도인이나 타로의 "The Hanged Man(매달린 사람)" 카드와 유사합니다. 사색은 깊으나 지상의 활력이 말라 있으니, 오늘만큼은 공상을 멈추고 흙을 밟거나 현실 노동을 병행해야 운기가 조율됩니다.',
    luckyPrescription: '따뜻한 우롱차, 맨발로 땅을 디디는 그라운딩 수련 20분, 묵직한 무게감의 식기류 사용',
  },
};

export const getEnergyMbtiCode = (report: BodyReport | null): string => {
  if (!report || !report.sevenCodeAnalysis) return 'MSCG';
  const analysis = report.sevenCodeAnalysis;

  const scores = [
    analysis.code1.score,
    analysis.code2.score,
    analysis.code3.score,
    analysis.code4.score,
    analysis.code5.score,
    analysis.code6.score,
    analysis.code7.score,
  ];

  const allAvg = scores.reduce((sum, s) => sum + s, 0) / 7;
  const lowScoresCount = scores.filter((s) => s < 40).length;
  const minScore = Math.min(...scores);

  // 1차원: M(지성) vs P(신체)
  const mindAvg = (analysis.code6.score + analysis.code7.score) / 2;
  const physAvg = (analysis.code1.score + analysis.code2.score) / 2;
  const dim1 = mindAvg >= physAvg ? 'M' : 'P';

  // 2차원: S(성찰/성실) vs E(표현/사교)
  const stoicAvg = (analysis.code3.score + analysis.code7.score) / 2;
  const exprAvg = (analysis.code2.score + analysis.code5.score) / 2;
  const dim2 = stoicAvg >= exprAvg ? 'S' : 'E';

  // 3차원: A(추진/주체) vs C(창조/협력)
  const actAvg = (analysis.code1.score + analysis.code3.score) / 2;
  const crtAvg = (analysis.code2.score + analysis.code6.score) / 2;
  const dim3 = actAvg >= crtAvg ? 'A' : 'C';

  // 4차원: G(안정/순환) vs F(정체/기복)
  let dim4 = 'G';
  if (analysis.code4.score < 50 || allAvg < 55 || lowScoresCount >= 3) {
    dim4 = 'F';
  }

  const tempCode = `${dim1}${dim2}${dim3}${dim4}`;

  // 최상위 안정형 코드에 대한 최소 기준 조건 검증 및 Fallback 처리
  if (tempCode === 'PEAG') {
    if (allAvg < 75 || minScore < 60) {
      dim4 = 'F';
    }
  } else if (tempCode === 'MSCG') {
    if (allAvg < 70) {
      dim4 = 'F';
    }
  } else if (tempCode === 'PSAG') {
    if (allAvg < 65) {
      dim4 = 'F';
    }
  }

  return `${dim1}${dim2}${dim3}${dim4}`;
};
