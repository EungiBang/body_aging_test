---
name: btc-group-health-report
description: >-
  BTC 코드맵AI 단체 건강 점검 결과 보고서를 자동 생성합니다. 엑셀 명단에서 대상자를
  식별하고, Firebase에서 전체 데이터(3Body, 7Code, 마음나이 포함)를 추출하여 통계
  분석 후, 전국 평균 비교가 포함된 프리미엄 PPT 보고서를 생성합니다. 교육청, 기업,
  학교 등 모든 단체에 대해 사용할 수 있습니다.
---

# BTC 단체 건강 점검 결과 보고서 생성기

## Overview

코드맵AI 3Body 7Code 단체 점검 후, 엑셀 명단 기반으로 Firebase에서 전체 데이터를
추출하고, 통계 분석 및 PPT 보고서를 자동 생성하는 End-to-End 워크플로우입니다.

## 필수 입력

1. **엑셀 파일**: 점검 대상자 명단 (이름, 나이, 성별, 합동코드 포함)
2. **기관명**: 보고서에 표시할 단체/기관 이름 (예: "춘천교육청")
3. **점검일**: 점검 실시 날짜 (예: "2026-06-24")
4. **합동코드**: Firebase 조회용 이벤트 코드 (예: "EVT_춘천_260605_7UNA")

## 출력물

1. `{기관명}_Firebase_raw.json` - Firebase에서 추출한 원본 데이터
2. `{기관명}_분석결과.json` - 통계 분석 결과 JSON
3. `{기관명}_코드맵AI_결과보고서.pptx` - 최종 PPT 보고서 (7슬라이드)

## 워크플로우

### 단계 1: Firebase 데이터 추출

프로젝트 루트의 `scripts/fetch_group_firebase.js` 스크립트를 실행합니다.

```bash
node scripts/fetch_group_firebase.js --excel "{엑셀파일}" --event-code "{합동코드}" --output "{기관명}_Firebase_raw.json"
```

이 스크립트가 수행하는 작업.
- 엑셀에서 대상자 이름 목록 추출
- Firebase `members_v4` 컬렉션에서 `eventCode`로 조회
- 이름 매칭으로 대상자 필터링
- 결과를 JSON 파일로 저장

> **주의**: Firebase 설정은 프로젝트의 `firebase-applet-config.json`을 사용합니다.
> projectId는 `btc-3body-server`이며, 컬렉션명은 `members_v4`입니다.

### 단계 2: 통계 분석

`scripts/analyze_group.py` 스크립트를 실행합니다.

```bash
python -X utf8 scripts/analyze_group.py --input "{기관명}_Firebase_raw.json" --institution "{기관명}" --date "{점검일}" --output "{기관명}_분석결과.json"
```

분석 항목.
- **인구통계**: 인원, 성별, 연령대 분포
- **3Body 점수**: 신체/뇌/마음 (전체, 성별별, 연령대별)
- **건강나이**: 실제/신체/뇌/마음/얼굴/종합 나이 + 갭 분석
- **7Code 에너지**: 코드1~7 점수 + 최취약 코드 분포
- **자세 분석**: 5개 지표별 Good/Fair/Poor 비율
- **전국 비교**: 전국 3,267명 평균 데이터와 비교

### 단계 3: PPT 보고서 생성

`scripts/generate_group_ppt.py` 스크립트를 실행합니다.

```bash
python -X utf8 scripts/generate_group_ppt.py --input "{기관명}_분석결과.json" --output "{기관명}_코드맵AI_결과보고서.pptx"
```

PPT 구조 (7슬라이드).
1. **표지** - 기관명, 점검일, 인원, 합동코드
2. **점검 개요** - 인구통계 + 시스템 소개
3. **3Body 분석** - 신체/뇌/마음 점수 (성별/연령대/전국 비교)
4. **건강나이** - 마음나이 포함 웰니스 에이지 (성별 비교)
5. **7Code 에너지** - 코드별 점수 + 최취약 코드 TOP 3
6. **자세 분석** - 5개 지표 (전국 Poor 비율 비교)
7. **종합 인사이트** - 5개 핵심 발견 + 건강 관리 제언

디자인 테마.
- Dark Navy(#0F172A) + 화이트(#F8FAFC) 기반
- 와이드스크린(13.333" x 7.5")
- Malgun Gothic 폰트
- 카드 레이아웃 + KPI 박스

## 전국 평균 기준 데이터

전국 3,267명 기준 데이터는 `scripts/analyze_group.py` 내에 하드코딩되어 있습니다.
데이터 업데이트가 필요한 경우 `NATIONAL_AVG` 딕셔너리를 수정하세요.

주요 전국 평균값.
- 3Body: 신체 70.5 / 뇌 77.3 / 마음 58.6
- 7Code: C1 55.1 / C2 61.1 / C3 61.0 / C4 65.0 / C5 63.0 / C6 62.7 / C7 68.6
- 코드1 최취약 비율: 41.1%

## 사용 예시

사용자가 아래와 같이 요청할 때 이 스킬을 사용하세요.

- "XX교육청 코드맵AI 점검 결과 보고서 만들어줘"
- "이 엑셀 파일의 단체 보고서 작성해줘"
- "합동코드 EVT_XXX_XXXXXX_XXXX에 대한 결과 보고서"
- "XX기업 건강 점검 PPT 보고서 생성"

## Common Mistakes

1. **엑셀 이름과 Firebase 이름 불일치**: 엑셀과 Firebase의 이름이 동일한지 확인하세요.
   cleaned_members_v2.json 같은 로컬 JSON 덤프 대신 반드시 Firebase에서 직접 조회해야 합니다.
2. **마음나이 누락**: 엑셀에는 마음나이 컬럼이 없을 수 있습니다. 반드시 Firebase에서
   전체 report 데이터를 가져와야 마음나이, 3Body, 7Code가 포함됩니다.
3. **중복 데이터**: 한 사람이 여러 번 측정한 경우 중복이 발생합니다. 이름 기준으로
   중복 제거하되, report가 있는 최신 데이터를 우선합니다.
4. **인코딩 문제**: Windows에서 한국어 출력 시 `python -X utf8` 옵션을 반드시
   사용하세요. Node.js는 기본적으로 UTF-8을 사용합니다.
