# 작업 이력

## [2026-07-10] 온라인 라이트 버전 사양 분리 및 복구 완료
- **변경 사항**: 온라인 라이트 버전을 6단계(정면, 측면, 균형, 마트 장보기, 얼굴 분석, 7코드 점검)로 전면 정비하고 PC 풀 버전 전용 운동 단계(스쿼트, 푸시업), 팔 올리기, 유연성, 반응속도 단계를 제거하여 빌드를 정상화함. 또한 분석 오류 팝업 문구 및 메인 인트로, 사용자 등록 폼, 시스템 환경 체크(PC/카메라) 텍스트 전반을 다국어 처리(`t()`)하고 `ttsService.ts`에서 미국 버전 시 영어가 강제 출력 및 재생되도록 음성 재생 로직을 격리하여 한글 노출을 원천 차단함.
- **변경 파일**: 
  - `BT_3Body_Online_Lite/types.ts`
  - `BT_3Body_Online_Lite/components/AssessmentFlow.tsx`
  - `BT_3Body_Online_Lite/components/SystemCheckOverlay.tsx`
  - `BT_3Body_Online_Lite/components/UserInfoForm.tsx`
  - `BT_3Body_Online_Lite/components/CameraModule.tsx`
  - `BT_3Body_Online_Lite/services/ttsService.ts`
  - `BT_3Body_Online_Lite/services/geminiService.ts`
  - `BT_3Body_Online_Lite/i18n.ts`
- **사유**: PC 풀 버전과 라이트 버전의 코드 혼선 복구 및 미국(US) 지점용 온라인 서비스 전반의 영문화 및 영문 음성 재생 보장.
- **미완료/다음 작업**: 없음
