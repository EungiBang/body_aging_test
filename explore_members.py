# JSON 덤프 파일들 내 데이터 건수와 4793명 조건 탐색 스크립트
import json

def analyze_v2():
    with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
        m2 = json.load(f)
    print(f"cleaned_members_v2.json len: {len(m2)}")
    
    # various filters
    # 1. Has valid lastTestDate
    has_test_date = [m for m in m2 if m.get('lastTestDate')]
    print(f"Has lastTestDate: {len(has_test_date)}")
    
    # 2. Has branchId
    has_branch = [m for m in m2 if m.get('branchId')]
    print(f"Has branchId: {len(has_branch)}")
    
    # 3. Has regionId
    has_region = [m for m in m2 if m.get('regionId')]
    print(f"Has regionId: {len(has_region)}")
    
    # 4. Filter by ownerUid
    has_owner = [m for m in m2 if m.get('ownerUid')]
    print(f"Has ownerUid: {len(has_owner)}")
    
    # 5. Filter by sourceType
    source_types = {}
    for m in m2:
        st = m.get('sourceType', 'None')
        source_types[st] = source_types.get(st, 0) + 1
    print(f"Source types: {source_types}")
    
    # 6. Count non-pending
    non_pending = [m for m in m2 if not m.get('id', '').startswith('pending-')]
    print(f"Non pending: {len(non_pending)}")

def analyze_dump_v2():
    try:
        with open('firebase_dump_v2.json', 'r', encoding='utf-8') as f:
            dump2 = json.load(f)
        print("\n===== firebase_dump_v2.json keys =====")
        for k, v in dump2.items():
            if isinstance(v, dict):
                print(f"  {k}: dict (len={len(v)})")
            elif isinstance(v, list):
                print(f"  {k}: list (len={len(v)})")
            else:
                print(f"  {k}: {type(v).__name__}")
    except Exception as e:
        print(f"Error reading firebase_dump_v2.json: {e}")

try:
    analyze_v2()
except Exception as e:
    print(f"Error: {e}")

try:
    analyze_dump_v2()
except Exception as e:
    print(f"Error: {e}")
