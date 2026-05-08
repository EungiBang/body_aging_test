# BTC 3바디 AI분석기 의료법 검토 보고서 Word 문서 생성
$outputPath = "d:\antigravity_vibecoding\BT 3바디 ai테스트\docs\BTC_AI분석기_의료법_검토보고서.docx"

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

# ── 헬퍼 함수 ──
function Add-Heading($text, $level) {
    $sel.Style = $doc.Styles("제목 $level")
    $sel.TypeText($text)
    $sel.TypeParagraph()
}
function Add-Body($text) {
    $sel.Style = $doc.Styles("표준")
    $sel.TypeText($text)
    $sel.TypeParagraph()
}
function Add-Blank() { $sel.TypeParagraph() }

# ── 제목 ──
$sel.Style = $doc.Styles("제목 1")
$sel.Font.Size = 18
$sel.TypeText("BTC 3바디 AI분석기 v1.8.4")
$sel.TypeParagraph()
$sel.Style = $doc.Styles("제목 1")
$sel.TypeText("의료법 저촉 사항 검토 보고서")
$sel.TypeParagraph()
Add-Blank

$sel.Style = $doc.Styles("표준")
$sel.TypeText("작성일: " + (Get-Date -Format "yyyy년 MM월 dd일"))
$sel.TypeParagraph()
$sel.TypeText("검토 버전: v1.8.4")
$sel.TypeParagraph()
$sel.TypeText("목적: 서비스 상용화 전 의료법·소비자보호법 저촉 여부 사전 점검")
$sel.TypeParagraph()
Add-Blank

# ── 1. 검토 근거 법령 ──
Add-Heading "1. 검토 근거 법령" 2
Add-Body "· 의료법 제2조 (의료인·의료행위 정의): 진찰·검안·처방 등은 면허 의료인만 수행 가능"
Add-Body "· 의료법 제27조 (무면허 의료행위 금지): 의료인이 아닌 자는 의료행위 불가"
Add-Body "· 의료법 제56조 (의료광고 금지): 치료 효과를 보장하거나 의료기관이 아닌 자의 과장 광고 금지"
Add-Body "· 소비자보호법 제21조: 허위·과장 표시 광고 금지"
Add-Body "· 대법원 판례 2010도1573 (2012): '진단'이라는 명칭이 일반인에게 의료행위로 오인될 소지가 있으면 위법 소지"
Add-Blank

# ── 2. 고위험 요소 ──
Add-Heading "2. 고위험 요소 (즉시 수정 권장)" 2

Add-Heading "2-1. 앱 전반의 '진단' 용어 사용" 3
Add-Body "현재 사용 중인 위험 표현:"
Add-Body "  · 'AI 신체 밸런스 & 뇌 건강 진단 시스템'"
Add-Body "  · 'BTC 3바디 AI 진단 센터'"
Add-Body "  · '통합 AI 리포트', '정밀 분석'"
Add-Blank
Add-Body "위험 이유:"
Add-Body "'진단'은 의료법 제2조가 명시하는 의료행위 핵심 용어입니다. 무면허로 '진단'을 수행하는 것처럼 보이면 의료법 제27조 위반으로 3년 이하 징역 또는 3천만 원 이하 벌금이 부과될 수 있습니다."
Add-Blank
Add-Body "수정 방향:"
Add-Body "  · '진단' → '측정', '평가', '체력 스크리닝', '웰니스 체크'로 전환"
Add-Body "  · 예: 'BTC 3바디 AI 체력 측정 센터', 'AI 신체 균형 평가 시스템'"
Add-Blank

Add-Heading "2-2. '뇌 건강 진단' 표현 (가장 위험)" 3
Add-Body "현재 상태: BrainTestModule 컴포넌트와 AI 프롬프트에 brainHealthImplication 항목 존재"
Add-Blank
Add-Body "위험 이유:"
Add-Body "뇌 기능 평가는 신경과·정신건강의학과의 전속 의료행위 영역입니다. '뇌 건강 진단'이라는 표현은 의료인 면허 없이 신경학적 진단을 수행하는 것으로 오인될 수 있어, 고위험 표현에 해당합니다."
Add-Blank
Add-Body "수정 방향:"
Add-Body "  · '뇌 건강 진단' → '인지 반응 측정', '집중력 체크', '두뇌 활성도 참고 지표'"
Add-Blank

Add-Heading "2-3. AI 프롬프트 내 과장 효과 주장 (라인 366)" 3
Add-Body "[현재 프롬프트 원문]"
Add-Body """신체의 불균형과 노화를 뇌 신경망 및 3바디 7코드의 막힘 현상으로 연결하고,"
Add-Body "'광명차크라 수련'이 모든 것의 근본 해결책임을 강력하게 어필하세요."""
Add-Blank
Add-Body "위험 이유:"
Add-Body "  · 의료법 제56조: 질병·신체 상태와 특정 치료법의 인과관계를 단정하는 표현 금지"
Add-Body "  · 소비자보호법: '근본 해결책'은 효능·효과를 보장하는 허위 과장 광고에 해당"
Add-Body "  · 특히 신체 검사 데이터를 근거로 특정 프로그램 구매를 유도하는 구조는 민법상 불법행위(기망) 성립 가능"
Add-Blank
Add-Body "수정 방향:"
Add-Body "  · '근본 해결책임을 강력하게 어필' → '개선에 도움이 될 수 있는 활동으로 안내'"
Add-Body "  · '막힘 현상' 등 의료적 단정 표현 삭제"
Add-Blank

Add-Heading "2-4. 비만 진단 및 처방성 표현 (라인 365)" 3
Add-Body "[현재 프롬프트 원문]"
Add-Body "'과체중' 또는 '비만'으로 파악되면 '체지방 감량, 심혈관 대사 관리, 관절 부하 솔루션' 포함"
Add-Blank
Add-Body "위험 이유:"
Add-Body "비만 진단 및 심혈관·대사 질환 관리 처방은 의료행위입니다. AI가 체형 분석 결과를 토대로 처방성 솔루션을 제시하면 의료법 위반 소지가 있습니다."
Add-Blank
Add-Body "수정 방향:"
Add-Body "  · '심혈관 대사 관리' 등 처방성 표현 삭제"
Add-Body "  · '전문 의료기관 상담을 권장합니다' 형태의 리퍼럴 표현으로 대체"
Add-Blank

# ── 3. 주의 요소 ──
Add-Heading "3. 주의 요소 (표현 조정 권장)" 2

$tableData = @(
    @("항목", "현재 표현", "위험도", "권장 수정"),
    @("안면 분석", "피부 노화·주름 탄력 분석", "중간", "피부 상태 참고 지표 (면책 명시)"),
    @("자세 분석", "심한 거북목 — 노화 신호", "중간", "거북목 패턴 관찰 (관찰형으로 전환)"),
    @("점수 감점", "경각심을 갖도록 가차없이 감점", "중간", "삭제 (의도적 과소평가는 허위정보)"),
    @("리포트 언어", "AI 생성 질환·위험 표현", "낮음", "현재 프롬프트 금지어 목록 있음 ✅")
)

$table = $doc.Tables.Add($sel.Range, $tableData.Count, 4)
$table.Style = "표 눈금 (밝게) - 강조 1"
$table.Borders.Enable = $true

for ($r = 0; $r -lt $tableData.Count; $r++) {
    for ($c = 0; $c -lt 4; $c++) {
        $table.Cell($r+1, $c+1).Range.Text = $tableData[$r][$c]
    }
}
# 헤더 행 굵게
for ($c = 1; $c -le 4; $c++) {
    $table.Cell(1,$c).Range.Bold = $true
    $table.Cell(1,$c).Shading.BackgroundPatternColor = 0x003366  # 남색
    $table.Cell(1,$c).Range.Font.Color = 0xFFFFFF
}

$sel.MoveDown(5, $tableData.Count + 1) | Out-Null
Add-Blank

# ── 4. 현재 잘 되어 있는 부분 ──
Add-Heading "4. 현재 준수 사항 (유지)" 2
Add-Body "· AI 프롬프트 내 면책 고지 존재:"
Add-Body "  '본 시스템은 의료용 진단기기가 아닌 체력 및 건강 증진용 웰니스 스크리닝 도구입니다.'"
Add-Blank
Add-Body "· AI 금지어 목록 운영: '스트레스가 높습니다', '불안정합니다', '질환' 등 금지"
Add-Body "· 안면 분석에 '임상적 피부과 진단이 아닌 상담 보조용 참고 지표' 명시"
Add-Body "· 국민체력100 기반 체력 검사 항목(균형, 유연성, 스쿼트, 푸시업)은 비의료 영역으로 허용"
Add-Blank

# ── 5. 우선순위별 수정 계획 ──
Add-Heading "5. 우선순위별 수정 계획" 2

Add-Heading "[즉시 조치] 법적 위험 항목" 3
Add-Body "1. 앱 내 UI 전체: '진단' → '측정/평가/스크리닝'으로 일괄 교체"
Add-Body "2. AI 프롬프트: '광명차크라가 모든 것의 근본 해결책' 문구 삭제 또는 완화"
Add-Body "3. '뇌 건강 진단' → '인지 반응 측정'으로 명칭 변경"
Add-Body "4. 비만 처방성 표현(심혈관 대사 관리 등) → 전문의 상담 권장 문구로 대체"
Add-Blank

Add-Heading "[권장 조치] 신뢰도 향상 항목" 3
Add-Body "5. 리포트 화면 하단에 법적 면책 문구 UI 표시 (현재 프롬프트에만 있음)"
Add-Body "6. 프로그램 추천 섹션에 '본 추천은 체력 측정 결과 참고 제안이며 의료적 처방이 아닙니다' 추가"
Add-Body "7. '정밀 분석' → '참고 분석'으로 표현 완화"
Add-Blank

# ── 6. 면책 문구 예시 ──
Add-Heading "6. 법적 면책 문구 권장 예시 (화면 표시용)" 2
Add-Body "────────────────────────────────────────────"
Add-Body "⚠️ 본 서비스 이용 안내"
Add-Blank
Add-Body "본 측정 결과는 체력 및 건강 증진 목적의 참고 지표이며,"
Add-Body "의료기기법에 따른 의료기기 또는 의료행위가 아닙니다."
Add-Body "건강 이상이 의심될 경우 반드시 의료기관을 방문하시기 바랍니다."
Add-Body "────────────────────────────────────────────"
Add-Blank

# ── 7. 결론 ──
Add-Heading "7. 결론 및 권고" 2
Add-Body "현재 BTC 3바디 AI분석기 v1.8.4는 체력 측정 기능 자체는 국민체력100 등 공인 비의료 서비스와 유사한 구조를 가지고 있어 위법 소지가 낮습니다."
Add-Blank
Add-Body "그러나 다음 3가지 요소가 의료법·소비자보호법 위반 위험을 높이고 있습니다:"
Add-Body "  1. '진단'이라는 용어의 광범위한 사용"
Add-Body "  2. 특정 프로그램을 '근본 해결책'으로 단정하는 AI 생성 문구"
Add-Body "  3. '뇌 건강 진단'이라는 의료 영역 직접 침범 표현"
Add-Blank
Add-Body "위 3가지를 상용 배포 전 수정하면 법적 리스크를 크게 낮출 수 있습니다."
Add-Body "최종 배포 전 법무 전문가(의료법 전문 변호사)의 검토를 받을 것을 권고합니다."
Add-Blank

# ── 페이지 번호 및 머리글 ──
$doc.Sections(1).Headers(1).Range.Text = "BTC 3바디 AI분석기 의료법 검토보고서 | 대외비"

# ── 저장 ──
$doc.SaveAs([ref]$outputPath, [ref]16)  # 16 = wdFormatDocumentDefault (.docx)
$doc.Close()
$word.Quit()

Write-Host "✅ Word 문서 생성 완료: $outputPath"
