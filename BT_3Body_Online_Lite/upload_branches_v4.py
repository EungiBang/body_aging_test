# -*- coding: utf-8 -*-
"""
BTC 지역/지점 데이터를 Firebase Firestore에 일괄 등록하는 스크립트.
BTC_지점_등록_데이터_v4.xlsx 파일을 읽어 regions / branches 컬렉션에 저장합니다.

사용법:
  python upload_branches_v4.py
"""
import openpyxl
import json

# === 1. 엑셀에서 지역-지점 매핑 읽기 ===
wb = openpyxl.load_workbook('BTC_지점_등록_데이터_v4.xlsx', data_only=True)
ws = wb.active

region_branch_map = {}  # { 지역명: [지점명, ...] }
current_region = None

for row in ws.iter_rows(min_row=2, values_only=True):
    region_val = row[0]
    branch_val = row[1]
    allowed   = row[2] if len(row) > 2 else 2

    if region_val:
        current_region = str(region_val).strip()
        if current_region not in region_branch_map:
            region_branch_map[current_region] = []

    if branch_val and current_region:
        region_branch_map[current_region].append({
            'name': str(branch_val).strip(),
            'allowedLicenses': int(allowed) if allowed else 2
        })

# === 2. JSON으로 내보내기 (upload_branches.js가 읽을 수 있도록) ===
output = []
for region, branches in region_branch_map.items():
    output.append({
        'region': region,
        'branches': branches
    })

with open('branch_seed_data.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print("✅ branch_seed_data.json 생성 완료!")
print(f"   총 {len(region_branch_map)}개 지역, {sum(len(b) for b in region_branch_map.values())}개 지점")

# === 3. 통계 ===
for region, branches in region_branch_map.items():
    names = [b['name'] for b in branches]
    print(f"   📍 {region} ({len(branches)}개): {', '.join(names)}")
