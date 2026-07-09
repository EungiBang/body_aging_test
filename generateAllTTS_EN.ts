// 사용자 영어 가이드 음성(TTS)을 edge-tts를 통해 정적 오디오 파일(base64)로 일괄 프리빌드하는 스크립트
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const VOICE = 'en-US-EmmaNeural';
const EDGE_TTS_PATH = 'C:\\Users\\bange\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\edge-tts.exe';

const EN_DICT: Record<string, string> = {
  "측정을 시작합니다. 화면의 안내선에 맞춰 전신이 보이도록 서주세요.": "Starting measurement. Please align your body within the guide lines.",
  "측정 시작": "Start Scan",
  "측정 완료": "Scan Completed",
  "다시 촬영": "Retake",
  "다음 단계": "Next Step",
  "완료": "Done",
  "오답": "Incorrect",
  "장바구니": "Cart",
  "대기": "Wait",
  "시작!": "Start!",
  "기다리세요...": "Please wait...",
  "장바구니에 담았습니다.": "added to cart.",
  "취소": "Cancel",
  "가격 계산": "Price Calculation",
  "종합 평가": "General Review",
  "🌟 우수": "🌟 Excellent",
  "👍 보통": "👍 Normal",
  "💪 노력 필요": "💪 Needs Improvement",
  "66일": "66 Days",
  "습관 정착": "Habit Habituation",
  "100일": "100 Days",
  "삶의 전환": "Life Transformation",
  "AI 강력 추천": "AI Recommended",
  "바디프리 명상": "Body-Free Meditation",
  "#에너지순환": "#EnergyCirculation",
  "#활력충전": "#VitalityCharge",
  "신체 에너지 회복": "Restore Physical Energy",
  "근원적 생명력 강화": "Strengthen Core Vitality",
  "클린호흡 1, 2": "Clean Breathing 1, 2",
  "#감정정화": "#EmotionalPurification",
  "#체형밸런스": "#BodyBalance",
  "자연치유력 회복": "Restore Natural Healing",
  "호흡 기초": "Breathing Basics",
  "마음프리 명상": "Mind-Free Meditation",
  "#자아성찰": "#SelfReflection",
  "#의식성장": "#ConsciousnessGrowth",
  "내면의 평화": "Inner Peace",
  "종합 평가 리포트": "General Evaluation Report",
  "복사 완료! 카톡에 붙여넣기 하세요": "Copied! Please paste into KakaoTalk.",
  "카톡 공유용 복사": "Copy for Sharing",
  "📌 학술적 측정 기반 (Academic Basis):": "📌 Academic Measurement Basis:",
  "신체 분석:": "Physical Analysis:",
  "두뇌 분석:": "Brain Analysis:",
  "안면 분석:": "Facial Analysis:",
  "📌 연령 지표 산출 근거:": "📌 Basis for Estimating Age Index:",
  "위 학술적 기반과 Vision AI(자세 정렬, 안면 근육, 인지 반응 속도 등) 측정 데이터를 종합하여, 당사 고유의": "Combined with academic bases and Vision AI measurements, our proprietary",
  "통계적·휴리스틱 알고리즘": "statistical and heuristic algorithm",
  "을 통해 산출된": "was used to estimate the",
  "건강관리 및 동기부여 목적의 참고 지표": "reference index for health management and motivation.",
  "⚠️ 비의료 건강관리서비스 안내:": "⚠️ Non-medical health management service guide:",
  "이름을 입력해 주세요.": "Please enter a name.",
  "생년월일을 입력해 주세요.": "Please enter date of birth.",
  "개인정보 수집·이용에 동의해 주세요.": "Please consent to the collection and use of personal information.",
  "측정 대상자 등록": "Register Participant",
  "이름으로 검색...": "Search by name...",
  "저장된 회원 기록이 없습니다.": "No member records saved.",
  "검색 결과가 없습니다.": "No search results found.",
  "📋 이전 측정 기록 불러옴": "📋 Previous Scan Record Loaded",
  "신체나이": "Physical Age",
  "뇌나이": "Brain Age",
  "종합점수": "Overall Score",
  "이름 NAME": "NAME",
  "이름": "Name",
  "홍길동": "John Doe",
  "성별 GENDER": "GENDER",
  "출생연월 및 나이 BIRTH & AGE": "BIRTH & AGE",
  "생년월일": "Birth Date",
  "태어난 해 (예: 1980)": "Birth Year (e.g., 1980)",
  "년": "Year",
  "월": "Month",
  "나이 AGE": "AGE",
  "(선택)": "(Optional)",
  "카카오톡": "Messenger",
  "미수신": "Do Not Receive",
  "개인정보": "Personal Info",
  "[필수]": "[Required]",
  "📋 개인정보 수집·이용 동의서": "📋 Agreement on Collection & Use of Personal Information",
  "수집 항목": "Collected Items",
  "성명, 성별, 생년월, 연락처(선택), 전신·얼굴 사진, 두뇌 인지 반응 데이터, 7코드 선택 결과": "Name, Gender, Birthdate, Contact Info, Fullbody & Face Photos, Cognitive Test Data, 7-Code choices",
  "수집 목적": "Purpose",
  "3바디 통합 밸런스 측정 및 웰니스 상태 분석, 이전 측정 기록과의 비교 분석": "3-Body integrated balance scanning, wellness status analysis, historical comparison",
  "보관 기간": "Retention Period",
  "제3자 제공": "Third Party Sharing",
  "AI 분석을 위해 Google LLC 서버(미국)에 사진이 일시적으로 전송되며, 분석 완료 즉시 삭제됩니다. 그 외 제3자 제공은 없습니다.": "Photos are temporarily sent to Google LLC servers (US) for AI analysis and deleted immediately after. No other sharing.",
  "거부 권리": "Rights to Refuse",
  "동의를 거부하실 수 있으나, 거부 시 3바디 웰니스 측정 서비스를 이용하실 수 없습니다.": "You may decline consent, but doing so prevents use of the 3-Body scanning service.",
  "재측정 시작 준비 완료": "Ready to Scan Again",
  "위에서 기존 회원을 선택해 주세요": "Please select an existing member above",
  "진단 대상자 스캔 준비 완료": "Ready to Scan Participant",
  "7-CODE 건강 점검": "7-CODE Wellness Check",
  "이전 단계": "Prev Step",
  "이전 페이지": "Prev Page",
  "점검 완료": "Done",
  "다음 페이지": "Next Page",
  "오른손 → 왼쪽 어깨": "Right hand → Left shoulder",
  "오른손, 왼쪽 어깨": "Right hand, Left shoulder",
  "왼손 → 오른쪽 어깨": "Left hand → Right shoulder",
  "왼손, 오른쪽 어깨": "Left hand, Right shoulder",
  "오른손 → 왼쪽 무릎": "Right hand → Left knee",
  "오른손, 왼쪽 무릎": "Right hand, Left knee",
  "왼손 → 오른쪽 무릎": "Left hand → Right knee",
  "왼손, 오른쪽 무릎": "Left hand, Right knee",
  "오른손 → 왼쪽 허리": "Right hand → Left waist",
  "오른손, 왼쪽 허리": "Right hand, Left waist",
  "왼손 → 오른쪽 허리": "Left hand → Right waist",
  "왼손, 오른쪽 허리": "Left hand, Right waist",
  "오른손 → 머리 위": "Right hand → Above head",
  "오른손, 머리 위": "Right hand, Above head",
  "왼손 → 머리 위": "Left hand → Above head",
  "왼손, 머리 위": "Left hand, Above head",
  "사과": "Apple",
  "바나나": "Banana",
  "우유": "Milk",
  "식빵": "Bread",
  "계란": "Egg",
  "당근": "Carrot",
  "생선": "Fish",
  "치즈": "Cheese",
  "토마토": "Tomato",
  "치킨": "Chicken",
  "포도": "Grape",
  "수박": "Watermelon",
  "양파": "Onion",
  "옥수수": "Corn",
  "새우": "Shrimp",
  "[BrainTest] 연속된 WebGL 인식 실패 감지. WASM 백엔드로 영구 전환합니다.": "[BrainTest] Consecutive WebGL failures detected. Switching to WASM backend.",
  "얼굴": "Face",
  "왼쪽 어깨": "Left Shoulder",
  "오른쪽 어깨": "Right Shoulder",
  "왼손": "Left Hand",
  "오른손": "Right Hand",
  "왼쪽 허리": "Left Waist",
  "오른쪽 허리": "Right Waist",
  "왼쪽 무릎": "Left Knee",
  "오른쪽 무릎": "Right Knee",
  "포즈 인식 완료. 이제 손 인식을 확인합니다. 오른손을 들어보세요.": "Pose detected. Checking hand detection. Raise your right hand.",
  "포즈 인식 완료. 3초 후 시작합니다.": "Pose detected. Starting in 3s.",
  "오른손 인식 완료! 이제 왼손을 들어보세요.": "Right hand detected! Now raise your left hand.",
  "양손 인식 완료! 3초 후 시작합니다.": "Both hands detected! Starting in 3s.",
  "초록색! 오른손을 들어올리세요! 🟢": "Green! Raise your Right Hand! 🟢",
  "파란색! 왼손을 들어올리세요! 🔵": "Blue! Raise your Left Hand! 🔵",
  "흰색! 양손을 모두 들어올리세요! ⚪": "White! Raise Both Hands! ⚪",
  "빨간색! 움직이지 마세요! 🔴": "Red! Don't move! 🔴",
  "잘했습니다! ✅": "Well done! ✅",
  "오른손 정확! 👍": "Right hand correct! 👍",
  "❌ 오답! 초록불 = 오른손입니다!": "❌ Incorrect! Green = Right hand!",
  "왼손 정확! 👍": "Left hand correct! 👍",
  "❌ 오답! 파란불 = 왼손입니다!": "❌ Incorrect! Blue = Left hand!",
  "양손 정확! 🙌": "Both hands correct! 🙌",
  "❌ 오답! 흰색불 = 양손 동시!": "❌ Incorrect! White = Both hands!",
  "❌ 오답! 빨간불에 움직이면 안 돼요!": "❌ Incorrect! Do not move on Red!",
  "준비하세요...": "Get ready...",
  "지시대로 동작하세요!": "Follow instructions!",
  "시간 초과! ⏰": "Timeout! ⏰",
  "정확!": "Correct!",
  "정확합니다!": "Excellent!",
  "🛒 20초 동안 물건 6개의 총 금액을 계산하고 기억하세요!": "🛒 Calculate & remember the total price of 6 items in 20s!",
  "지금부터 20초 동안 살 물건 6개를 확인하세요. 물건의 이름과 총 가격을 기억해 주세요.": "Review the 6 items for 20s. Remember their names and the total price.",
  "🧠 10초 동안 2문제를 풀어보세요!": "🧠 Solve 2 math problems in 10s!",
  "이제 10초 동안 수학 문제 2개를 풀어보세요.": "Solve the 2 math questions within 10s.",
  "이제 아까 본 물건 6개를 찾아서 클릭해 주세요.": "Now click and select the 6 items you saw earlier.",
  "👆 아까 기억한 물건 6개를 클릭해서 골라주세요": "👆 Click the 6 items you memorized",
  "다음 문제입니다.": "Next question.",
  "시간 초과입니다.": "Timeout.",
  "정답입니다!": "Correct!",
  "아쉽습니다.": "Incorrect.",
  "마트 장보기 테스트를 시작합니다.": "Starting shopping memory test.",
  "인지 능력 테스트를 시작합니다. 화면에 초록불이 들어오면 오른손을, 파란불이 들어오면 왼손을, 흰색불이 들어오면 양손을 드세요. 빨간불이 들어오면 충동을 억제하고 움직이지 마세요. 카메라에 상반신이 보이도록 서주세요.": "Starting cognitive test. Raise right hand on green, left on blue, both on white. Hold still on red. Stand so your upper body is visible to the camera.",
  "인지 능력 테스트": "Cognitive Response Test",
  "색상 규칙에 따라 충동을 통제하세요": "Control impulses based on color rules",
  "마트 장보기": "Shopping Memory Test",
  "물건을 기억하고 클릭으로 골라주세요": "Memorize items and tap to select them",
  "뇌 테스트": "Brain Test",
  "뇌 기능 1단계": "Brain Function Phase 1",
  "🧠 인지 능력 테스트": "🧠 Cognitive Response Test",
  "뇌 기능 2단계": "Brain Function Phase 2",
  "🛒 마트 장보기 기억력": "🛒 Shopping Memory Test",
  "세로 모드": "Portrait Mode",
  "가로 모드": "Landscape Mode",
  "초록불": "Green light",
  "→ 오른손을 빠르게 들어올리세요": "→ Raise your right hand quickly",
  "파란불": "Blue light",
  "→ 왼손을 빠르게 들어올리세요": "→ Raise your left hand quickly",
  "흰색불": "White light",
  "→ 양손을 모두 들어올리세요!": "→ Raise both hands quickly!",
  "빨간불": "Red light",
  "→ 움직이지 마세요!": "→ Freeze and do not move!",
  "⚠️ 주의: 나중에는 화살표 방향이 무작위로 나옵니다. 방향에 속지 말고 색상에만 반응하세요!": "⚠️ Notice: Arrows will point randomly later. Focus ONLY on the colors!",
  "📊 총 10회 진행": "📊 Total 10 rounds",
  "🛒 마트에서 살 물건": "🛒 Shop items",
  "6개": "6 items",
  "를 기억하세요": "to memorize",
  "💰 6개 물건의": "💰 6 items'",
  "값을 계산": "calculate total price",
  "해주세요": "",
  "📷 포즈 확인 중": "📷 Check posture alignment",
  "카메라에 상반신이 보이도록 서주세요": "Stand so your upper body is visible",
  "추가 감지 (안보여도 OK)": "Extra sensors",
  "✋ 손 인식 확인": "✋ Hand detection",
  "오른손을 머리 위로 들어보세요": "Raise your right hand above your head",
  "왼손을 머리 위로 들어보세요": "Raise your left hand above your head",
  "양손 인식 완료! 곧 시작합니다": "Both hands detected! Starting soon",
  "확인!": "Checked!",
  "들어보세요": "Raise it up",
  "🟢 오른손을 어깨 위로 1초간 올려주세요": "🟢 Raise your right hand above shoulder for 1s",
  "🔵 왼손을 어깨 위로 1초간 올려주세요": "🔵 Raise your left hand above shoulder for 1s",
  "👈 왼손 (파란색)": "👈 Left Hand (Blue)",
  "(초록색) 오른손 👉": "Right Hand (Green) 👉",
  "🛒 물건 6개와 총 금액을 기억하세요": "🛒 Memorize the 6 items and total price",
  "천원": "k-Won",
  "🧠 사칙연산": "🧠 Math calculations",
  "물건을 터치해서 담아주세요": "Tap items to put in cart",
  "살 물건의 총 금액은?": "What is the total price?",
  "테스트 완료!": "Test completed!",
  "AI 측정 오답": "Cognitive Errors",
  "기억력 정답": "Memory score",
  "틀린 개수:": "Errors count:",
  "개인정보 동의가 필요합니다.": "Consent is required to proceed.",
  "BTC 3바디 7코드 AI건강센터": "BNB 3BODY7CODE AI Wellness Center",
  "본 서비스는 원활한 측정을 위해 음성 안내를 제공합니다.": "This service provides voice guidance for smooth scanning.",
  "주변 환경을 정리하시고 아래 버튼을 눌러주세요.": "Please tidy up your surroundings and press the button below.",
  "측정 시스템 활성화": "Activate Scanning System",
  "메인": "Main",
  "회원관리": "Members",
  "K관상": "K-Face",
  "K타로": "K-Tarot",
  "정면 신체 균형": "Front Body Balance",
  "측면 신체 균형": "Side Body Balance",
  "눈 감고 한발 서기": "One-legged Standing with Eyes Closed",
  "안면 노화 분석": "Facial Aging Analysis",
  "AI 데이터 분석 중": "Analyzing data via AI",
  "AI 종합 분석 시작하기": "Start AI Comprehensive Analysis",
  "정면 전체 몸이 나오도록 서주세요.": "Please stand so that your entire body is visible from the front.",
  "옆으로 서서 몸의 중심을 맞춰주세요.": "Please stand sideways and align your center of gravity.",
  "눈을 감고 한 발로 서서 균형을 유지하세요.": "Please close your eyes, stand on one foot, and maintain your balance.",
  "얼굴을 화면 중앙에 맞추고 밝은 표정을 지어주세요.": "Align your face with the center of the screen and make a bright expression.",
  "최근 자주 느끼는 증상과 감정을 선택해 주세요.": "Please select the symptoms and emotions you have frequently felt recently.",
  "통합 AI 리포트를 생성 중입니다.": "Generating integrated AI reports.",
  "측정 결과를 확인해 보세요.": "Please review the measurement results.",
  "재촬영 필요": "Retake Required",
  "전신이 충분히 나오지 않았습니다. 뒤로 물러나서 재촬영해 주세요.": "The entire body is not fully visible. Please step back and retake the photo.",
  "전신이 충분히 나오지 않았습니다. 재촬영해 주세요.": "The entire body is not fully visible. Please step back and retake.",
  "사람이 명확히 감지되지 않았습니다. 사진을 확인하고 수동으로 넘어가거나 재촬영해 주세요.": "No person was clearly detected. Please check the photo and proceed manually or retake.",
  "촬영이 완료되었습니다.": "Photo captured successfully.",
  "다시 촬영합니다. 준비해 주세요.": "Retaking the photo. Please get ready.",
  "모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.": "All measurements are completed. Please click the analysis button on the screen.",
  "5초 뒤 촬영": "Capture in 5s",
  "로딩 중...": "Loading...",
  "카메라를 연결 중입니다...": "Connecting to camera...",
  "카메라 방향 전환": "Switch Camera Direction",
  "피부 탄력 분석": "Skin Elasticity Analysis",
  "주름 분석": "Wrinkle Analysis",
  "준비하세요!": "Get Ready!",
  "조명을 밝게 셋팅해 주세요. 5초 뒤에 촬영합니다. 준비해 주세요.": "Please set the lighting bright. Capture will start in 5 seconds. Get ready.",
  "5초 뒤에 촬영합니다. 준비해 주세요.": "Capture will start in 5 seconds. Get ready.",
  "일": "one",
  "이": "two",
  "삼": "three",
  "사": "four",
  "오": "five",
  "측정 대상자 등록": "Register Participant",
  "🆕 신규 측정": "🆕 New Scan",
  "🔄 재측정": "🔄 Retest",
  "기존 회원 검색": "Search Existing Member",
  "이름으로 검색...": "Search by name...",
  "저장된 회원 기록이 없습니다.": "No saved member history.",
  "검색 결과가 없습니다.": "No search results found.",
  "📋 이전 측정 기록 불러옴": "📋 Loaded Previous Test Record",
  "✕ 다시 선택": "✕ Select Again",
  "이전 측정:": "Prev Test:",
  "신체나이": "Physical Age",
  "뇌나이": "Brain Age",
  "종합점수": "Overall Score",
  "AI 리포트 수신 방식": "AI Report Delivery Method",
  "카카오톡": "Messenger",
  "미수신": "Do Not Receive",
  "이름을 입력해 주세요.": "Please enter a name.",
  "생년월일을 입력해 주세요.": "Please enter date of birth.",
  "개인정보 수집·이용에 동의해 주세요.": "Please consent to the collection and use of personal information."
};

const MART_ITEMS = [
  { id: 'apple', name: '사과' },
  { id: 'banana', name: '바나나' },
  { id: 'milk', name: '우유' },
  { id: 'bread', name: '식빵' },
  { id: 'egg', name: '계란' },
  { id: 'carrot', name: '당근' },
  { id: 'fish', name: '생선' },
  { id: 'cheese', name: '치즈' },
  { id: 'tomato', name: '토마토' },
  { id: 'chicken', name: '치킨' },
  { id: 'grape', name: '포도' },
  { id: 'watermelon', name: '수박' },
  { id: 'onion', name: '양파' },
  { id: 'corn', name: '옥수수' },
  { id: 'shrimp', name: '새우' },
];

const TMT_COLORS = ['빨간색', '파란색', '노란색'];

const baseStrings = [
  "AI 신체 균형 및 건강 상태 측정 시스템입니다.",
  "측정 대상자의 정보를 입력해 주세요.",
  "정면 전체 몸이 나오도록 서주세요.",
  "옆으로 서서 몸의 중심을 맞춰주세요.",
  "눈을 감고 한 발로 서서 균형을 유지하세요.",
  "팔을 최대한 높이 들어 올려 주세요.",
  "무릎을 펴고 상체를 숙여 주세요.",
  "측면으로 서주세요. 15초 동안 스쿼트를 반복하세요.",
  "대각선으로 서주세요. 15초 동안 푸시업을 반복하세요.",
  "10초 동안 장볼 물건들을 기억하고, 손으로 골라 담아주세요.",
  "안경과 마스크는 벗어주세요. 조명을 더 밝게 해도 좋습니다. 얼굴을 카메라에 가까이 대고 정면을 응시하세요.",
  "해당하는 문항을 선택해 주세요.",
  "통합 AI 리포트를 생성 중입니다.",
  "측정 결과를 확인해 보세요.",
  "촬영이 완료되었습니다.",
  "뼈대 인식이 일부 누락되었습니다. 화면에 전신이 잘 나왔다면 수동으로 다음 단계를 진행해주세요.",
  "내장 그래픽 환경입니다. 화면에 전신이 잘 나왔다면 다음 단계를 눌러주세요.",
  "다시 촬영합니다. 준비해 주세요.",
  "마지막 측정 11단계, 7코드 건강 점검입니다. 화면에 나타나는 문항 중 본인에게 해당하는 것을 선택해 주세요.",
  "모든 측정이 완료되었습니다. 화면의 분석 시작 버튼을 눌러주세요.",
  "이 분석은 브레인트레이닝센터와 연구원, 대학교 등 전문가들이 연구, 개발하였고, 최신 AI 기술을 접목하여 개발한 프로그램입니다. 본 시스템은 건강 관리에 도움을 주고자 자세, 동작, 기억력 등을 측정하는 웰니스 프로그램으로서, 의료적 진단과는 무관합니다. 데이터 분석에 약 1분 정도 소요됩니다.",
  "분석 결과 리포트가 생성되었습니다. 결과를 확인해 보세요.",
  "포즈 인식 완료. 이제 손 인식을 확인합니다. 오른손을 들어보세요.",
  "포즈 인식 완료. 3초 후 시작합니다.",
  "오른손 인식 완료! 이제 왼손을 들어보세요.",
  "양손 인식 완료! 3초 후 시작합니다.",
  "오답",
  "정확합니다!",
  "지금부터 20초 동안 살 물건 6개를 확인하세요. 물건의 이름과 총 가격을 기억해 주세요.",
  "이제 10초 동안 수학 문제 2개를 풀어보세요.",
  "이제 아까 본 물건 6개를 찾아서 클릭해 주세요.",
  "다음 문제입니다.",
  "시간 초과입니다.",
  "정답입니다!",
  "아쉽습니다.",
  "마트 장보기 테스트를 시작합니다.",
  "인지 능력 테스트를 시작합니다. 화면에 초록불이 들어오면 오른손을, 파란불이 들어오면 왼손을, 흰색불이 들어오면 양손을 드세요. 빨간불이 들어오면 충동을 억제하고 움직이지 마세요. 카메라에 상반신이 보이도록 서주세요.",
  "뇌 인지 및 반응 테스트입니다. 15초 동안 지시한 색상과 숫자를 순서대로 클릭하세요. 텍스트를 모두 확인하신 후 시작하기 버튼을 눌러주세요.",
  "시간이 초과되었습니다.",
  "성공!",
  "모든 테스트가 완료되었습니다.",
  "조명을 밝게 셋팅해 주세요. 5초 뒤에 촬영합니다. 준비해 주세요.",
  "5초 뒤에 촬영합니다. 준비해 주세요.",
  "시작!",
  "측정이 완료되었습니다.",
  "일", "이", "삼", "사", "오", "육", "칠", "팔", "구", "십", "십일", "십이", "십삼", "십사", "십오", "준비하세요!"
];

const dynamicStrings: string[] = [];

MART_ITEMS.forEach(item => {
  dynamicStrings.push(`${item.name} 장바구니에 담았습니다.`);
  dynamicStrings.push(`${item.name} 취소`);
  dynamicStrings.push(`${item.name}`);
});

for (let i = 1; i <= 6; i++) {
  dynamicStrings.push(`6개 중 ${i}개를 골랐습니다. 이제 살 물건의 총 금액을 맞춰주세요!`);
  dynamicStrings.push(`시간 초과! ${i}개를 골랐습니다. 총 금액을 맞춰주세요.`);
}

TMT_COLORS.forEach(color => {
  dynamicStrings.push(`${color} 1번부터 10번까지 순서대로 클릭하세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.`);
  dynamicStrings.push(`두 번째 테스트. 이번엔 ${color} 10번부터 1번까지 거꾸로 누르세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.`);
});

const ALL_STRINGS = Array.from(new Set([...baseStrings, ...dynamicStrings]));

function getEnglishTranslation(text: string): string {
  // 1. 사전 매칭 확인
  if (EN_DICT[text]) return EN_DICT[text];

  // 2. 동적 템플릿 번역 매칭
  // 2-1. 장바구니 담기
  if (text.endsWith(' 장바구니에 담았습니다.')) {
    const itemName = text.replace(' 장바구니에 담았습니다.', '');
    const enName = EN_DICT[itemName] || itemName;
    return `${enName} added to cart.`;
  }
  // 2-2. 취소
  if (text.endsWith(' 취소')) {
    const itemName = text.replace(' 취소', '');
    const enName = EN_DICT[itemName] || itemName;
    return `${enName} Cancelled`;
  }
  // 2-3. 개수 고르기
  if (text.includes('개를 골랐습니다. 이제 살 물건의 총 금액을 맞춰주세요!')) {
    const count = text.match(/\d+/)?.[0] || '0';
    return `Selected ${count} of 6 items. Now calculate the total price!`;
  }
  if (text.includes('시간 초과! ') && text.includes('개를 골랐습니다. 총 금액을 맞춰주세요.')) {
    const count = text.match(/\d+/)?.[0] || '0';
    return `Timeout! Selected ${count} items. Calculate the total price.`;
  }
  // 2-4. TMT 가이드
  if (text.endsWith(' 1번부터 10번까지 순서대로 클릭하세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.')) {
    const color = text.split(' ')[0];
    const enColor = color === '빨간색' ? 'Red' : color === '파란색' ? 'Blue' : 'Yellow';
    return `Click numbers 1 to 10 in order of ${enColor}. Check the screen and click Start when ready.`;
  }
  if (text.endsWith(' 10번부터 1번까지 거꾸로 누르세요. 화면을 확인하고 준비가 되면 시작하기 버튼을 누르세요.')) {
    const color = text.split(' ')[0];
    const enColor = color === '빨간색' ? 'Red' : color === '파란색' ? 'Blue' : 'Yellow';
    return `Click numbers 10 to 1 in reverse order of ${enColor}. Check the screen and click Start when ready.`;
  }

  return text;
}

function generateAllTtsEn() {
  const outputDir = path.join('./assets/audio');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let outputTs = `// Auto-generated preloaded English TTS audio (Edge TTS: en-US-EmmaNeural)\n`;
  outputTs += `export const preloadedAudioEn: Record<string, string> = {\n`;

  for (let i = 0; i < ALL_STRINGS.length; i++) {
    const koText = ALL_STRINGS[i];
    const enText = getEnglishTranslation(koText);
    
    console.log(`Generating English TTS [${i + 1}/${ALL_STRINGS.length}]: ${enText.substring(0, 30)}...`);
    const tempFile = path.join(`./temp_tts_en_${i}.mp3`);
    
    try {
      // edge-tts command call with the absolute path
      execSync(`"${EDGE_TTS_PATH}" --voice ${VOICE} --text "${enText}" --write-media "${tempFile}"`, { stdio: 'ignore' });
      
      if (fs.existsSync(tempFile)) {
        const buffer = fs.readFileSync(tempFile);
        const base64Audio = buffer.toString('base64');
        outputTs += `  "${enText}": "data:audio/mp3;base64,${base64Audio}",\n`;
        fs.unlinkSync(tempFile);
      } else {
        console.warn(`Warning: temp file not created for: ${enText}`);
      }
    } catch (err) {
      console.error(`Failed to generate English TTS for: ${enText}`);
    }
  }

  outputTs += `};\n`;
  
  const targetFile = path.join(outputDir, 'preloadedTTS_en.ts');
  fs.writeFileSync(targetFile, outputTs);
  console.log(`\nSuccessfully generated ${ALL_STRINGS.length} English TTS files and saved to ${targetFile}`);

  // Also copy to Lite version
  const liteTargetFile = path.join('./BT_3Body_Online_Lite', 'assets', 'audio', 'preloadedTTS_en.ts');
  if (fs.existsSync(path.dirname(liteTargetFile))) {
    fs.writeFileSync(liteTargetFile, outputTs);
    console.log(`Successfully copied to Lite version: ${liteTargetFile}`);
  }
}

generateAllTtsEn();
