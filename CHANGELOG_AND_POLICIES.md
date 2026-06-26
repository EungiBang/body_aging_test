# BTC 3Body AI - 시스템 정책 및 주요 변경 이력 (Changelog)

이 문서는 프로젝트의 핵심 아키텍처, 기술 스택, 인증 정책 등의 변경 이력을 영구적으로 기록하는 문서입니다. 
새로운 AI 세션이나 개발 작업을 시작할 때 반드시 이 문서를 먼저 확인하여 시스템의 현재 상태와 히스토리를 파악해야 합니다.

## 📌 주요 시스템 정책 (System Policies)

### 1. 인증 및 배포 코드 분리 정책 (2026-05-09 제정)
*   **원칙**: PC 버전(Admin 포함)과 온라인 LITE 버전은 완전히 분리된 배포 승인 코드를 사용한다.
*   **구현**: 
    *   PC/Admin: `system_settings/config`의 `autoApproveCode` 필드 사용
    *   LITE: `system_settings/config`의 `liteAutoApproveCode` 필드 사용
*   **이유**: PC 버전 인증 코드가 유출되더라도 LITE 버전이 뚫리지 않도록 격리하기 위함.

### 2. 멀티 프로젝트 동기화 정책
*   **원칙**: PC 프로젝트(`BT 3바디 ai테스트`)와 LITE 프로젝트(`BT_3Body_Outdoor_Lite`)가 공통으로 사용하는 Firebase DB 스키마나 로직(`firebaseAuthService.ts` 등)을 변경할 때는 반드시 양쪽 폴더의 코드를 동시에 크로스 체크하여 업데이트해야 한다.

---

## 🕒 주요 변경 이력 (Changelog)

### [Version 5.1.4] - 2026-06-11
*   **AI 연령 산출 일관성 보장**:
    *   Gemini AI가 종합 요약문(`parsed.summary`)에서 신체/마음/뇌 나이를 독립적으로 계산하여 발생하던 수치 불일치 문제를 방지하기 위해, API 응답 생성 직후 최종 확정 연령값으로 텍스트를 자동 치환하는 포스트 프로세싱 알고리즘 추가.
*   **UI 나이 카드 정렬 기준 통일**:
    *   결과지 상단 요약 카드의 정렬 순서를 비즈니스 설계 가이드에 맞춰 `생물학적` -> `신체` -> `마음` -> `뇌` -> `얼굴` -> `3바디 통합` -> `코어 점수` 순으로 일관되게 정렬 완료. PC, Lite, Admin 버전에 동시 반영.
*   **카카오톡 공유 메시지 개선**:
    *   카카오톡 공유용 텍스트(`shareText`)에 누락되어 있던 **마음 나이** 지표를 추가하고, 전체 정렬 순서를 바뀐 UI 카드 순서에 맞춤. PC, Lite, Admin 버전 결과지에 동시 반영.
*   **PC 결과지 신뢰도 보완**:
    *   최근 라이트 버전 2의 개선점을 이식하여, PC 결과지 하단 법적 고지란에 인지과학 및 생체역학(Kendall 자세 평가, Stroop Effect, Baddeley 작업기억 모델 등) 학술적 산출 근거를 상세하게 보완하여 센터 상담 신뢰감 대폭 증가.
*   **타입스크립트 컴파일 오류 해결**:
    *   `types.ts` 내 `BodyReport`에 누락되었던 `energy3Body7Code`와 `bodyAlignmentAnalysis` 타입을 추가 정의.
    *   `SystemCheckOverlay.tsx`에서 `CameraModule` 호출 시 잘못된 guidelineType `"intro"` 대신 `"front"`로 수정.
    *   `TmtBrainTestModule.tsx`의 `targetColor` 상태 타입을 `typeof COLORS[number]`로 보정하여 유니온 타입 미스매치로 인한 빌드 에러 차단.
    *   `Window` 인터페이스의 `electronAPI`에 자동 업데이트 및 IPC 메서드 타입 선언 추가.

### [Version 5.1.3] - 2026-06-11
*   **3바디 및 7코드 분석 및 광명차크라 추천 정교화**: 
    *   AI가 도출하는 7코드 에너지 분석과 광명차크라 특별수련 지표 및 세부 수련 프로그램(바디프리/클린호흡/마음프리) 추천 연계 로직 정교화.

### [Version 5.1.2] - 준비 중
*   **신뢰도 및 법적 고지 강화**: 
    *   서비스 시작(Intro) 화면에 건강관리 스크리닝 서비스임을 알리는 안내 문구 추가.
    *   AI 종합 분석(Analyzing) 화면 대기 시간을 활용하여 '서비스 산출 근거 및 이용 안내' 가이드라인 노출. Kendall 자세 평가, Stroop 인지 모델 등 학술적 기반 명시.

### [Version 5.1.1] - 2026-05-09
*   **UI/UX (세로형 키오스크 최적화)**: 
    *   뇌기능 1단계, 2단계 컨테이너의 제약을 해제하고 요소를 대폭 확대(1.5배 이상)하여 세로 모니터에서의 가시성 향상.
    *   7-CODE 건강 점검 UI 세로 중앙 정렬 처리(`min-h-screen`, `justify-center`) 및 여백 최소화(`mt-auto` 제거, `mt-12` 적용), 요소 전체 확대.
    *   완료되지 않은 미측정 단계를 클릭하면 해당 테스트로 바로 이동하도록 `AssessmentFlow` 네비게이션 기능 추가.
*   **사용자 경험 개선**: 뇌기능 2단계 결과 창에서 방해 자극 퀴즈(사칙연산)와 최종 가격 계산 점수를 분리하여 오해를 방지하도록 텍스트 개선 및 결과 항목 추가 표시.

### [Version 5.1.0] - 2026-05-09
*   **AI 고도화 (집단 지성)**: 관리자 대시보드의 'AI 피드백 현황'이 로컬 데이터만 보여주던 치명적 결함을 수정. 전 지점의 클라우드 피드백 데이터를 실시간으로 가져와 통계 및 목록을 표시하도록 업데이트(`fetchAllFeedbacksFromCloud` 적용). PC 클라이언트 역시 클라우드 피드백을 기반으로 퓨샷 러닝을 하도록 변경.
*   **보안(Security)**: PC용 승인 코드(`autoApproveCode`)와 LITE 전용 승인 코드(`liteAutoApproveCode`)를 별도로 관리할 수 있도록 `AdminDashboard.tsx` 및 `firebaseAuthService.ts` 분리 반영 완료.
*   **데이터 필터링**: 멤버 기록(`HistoryManager.tsx`)에 `sourceType` (PC / LITE) 필터 추가.

### [이전 이력 요약]
*   PC 프로젝트에서 LITE 프로젝트를 별도의 폴더(`BT_3Body_Outdoor_Lite`)로 완전 분리 완료.
