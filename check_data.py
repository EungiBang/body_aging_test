# 현재 데이터 구조와 규모를 파악하는 탐색 스크립트
import json

# 1. cleaned_members.json 확인
with open('cleaned_members.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

if isinstance(members, list):
    print(f"[cleaned_members.json] 리스트 형태, 총 {len(members)}건")
    if len(members) > 0:
        sample = members[0]
        print(f"  샘플 키: {list(sample.keys())[:20]}")
elif isinstance(members, dict):
    print(f"[cleaned_members.json] 딕셔너리 형태, 키 수: {len(members)}")
    first_key = list(members.keys())[0]
    print(f"  첫 번째 키: {first_key}")
    val = members[first_key]
    if isinstance(val, dict):
        print(f"  값의 키: {list(val.keys())[:20]}")

# 2. firebase_dump.json의 members 관련 데이터 확인
with open('firebase_dump.json', 'r', encoding='utf-8') as f:
    dump = json.load(f)

for key in dump.keys():
    val = dump[key]
    if isinstance(val, dict):
        print(f"\n[firebase_dump.json] '{key}': dict with {len(val)} entries")
    elif isinstance(val, list):
        print(f"\n[firebase_dump.json] '{key}': list with {len(val)} entries")
    else:
        print(f"\n[firebase_dump.json] '{key}': {type(val).__name__}")
