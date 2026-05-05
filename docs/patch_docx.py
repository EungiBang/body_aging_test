import re

path = r'd:\antigravity_vibecoding\BT 3바디 ai테스트\docs\convert_to_docx.py'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace line 296
content = content.replace(
    "add_rich(doc, '**7코드(K차크라):** 선택한 키워드를 기반으로 현재 에너지 밸런스를 분석합니다.', bullet='*')",
    "add_rich(doc, '**7코드(K차크라):** 선택한 키워드를 기반으로, 7개 에너지 코드 중 **어느 코드의 에너지가 부족하거나 방전되어 있는지** 밸런스를 분석합니다.', bullet='*')\nadd_rich(doc, '**핵심 포인트:** 에너지가 부족하거나 방전된 코드를 발견하면, 해당 코드의 에너지를 **충전하고 충만하게 관리하는 것**이 핵심입니다. 뇌교육 수련과 일상 습관을 통해 약해진 에너지를 다시 채워 전체 밸런스를 회복합니다.', bullet='*')"
)

# Replace line 297
content = content.replace(
    "add_rich(doc, '**결과 도출:** AI가 가장 약한(에너지가 막힌) 코드를 자동 산출합니다.', bullet='*')",
    "add_rich(doc, '**결과 도출:** AI가 **에너지가 가장 부족한(방전된) 코드**를 자동 산출합니다.', bullet='*')"
)

# Replace line 298 (tip)
content = content.replace(
    '''add_rich(doc, '**설명 팁:** "회원님의 현재 에너지 파동과 무의식 상태가 어느 차크라 쪽으로 쏠려 있는지 보여주는 심리학적 웰니스 지표입니다"', bullet='*')''',
    '''add_rich(doc, '**설명 팁:** "7코드 결과는 점을 보거나 질환을 진단하는 것이 아닙니다. 회원님의 7개 에너지 코드 중 어느 부분이 방전되어 충전이 필요한지 보여주는 심리학적 웰니스 에너지 지표입니다. 부족한 코드를 충전하면 몸과 마음의 에너지가 다시 충만해집니다."', bullet='*')'''
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('[OK] convert_to_docx.py updated')
