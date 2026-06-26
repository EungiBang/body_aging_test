# IBEL 사례보고서 개발 작업 목록

- [x] `BTC_Admin_Server/types.ts` 업데이트: `CaseReport` 관련 인터페이스 추가
- [x] `BTC_Admin_Server/components/HistoryManager.tsx` 수정: 사례보고서 버튼 추가 및 `CaseReportBuilder` 라우팅 연결
- [x] `BTC_Admin_Server/services/geminiService.ts` 수정: `generateCaseReportDraft` AI 프롬프트 및 통신 함수 구현
- [x] `BTC_Admin_Server/components/CaseReportBuilder.tsx` 구현:
  - [x] A4 양식 UI 디자인 (CSS Print `@media print` 최적화)
  - [x] 1번(프로파일), 2번(호소문) 수동 입력 폼
  - [x] AI 자동 생성 버튼 연동 (3, 4, 5번 초안 생성 및 에디팅 뷰)
  - [x] 6번(After 결과) 작성을 위한 After 데이터 불러오기 모달/기능
  - [x] 인쇄(Print) 버튼 기능 연동
