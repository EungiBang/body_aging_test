# 4793명 기준에 부합하는 중복 제거 조건 및 필터를 찾는 탐색 스크립트
import json

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

print(f"Total raw members: {len(members)}")

# 1. name + phone (if phone empty, treat as unique) -> 5858
# 2. name + phone (if phone empty, deduplicate by name) -> 5635
# 3. What if we filter out members with invalid/placeholder names?
# Let's count how many have valid names (excluding empty, "테스트", "test", "")
def is_valid_name(n):
    n_str = str(n).strip()
    if not n_str:
        return False
    if n_str == '':
        return False
    if '테스트' in n_str or 'test' in n_str.lower():
        return False
    return True

valid_name_members = [m for m in members if is_valid_name(m.get('name'))]
print(f"Valid name members: {len(valid_name_members)}")

# deduplicate valid name members by name + phone
np_set_valid = set()
for m in valid_name_members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    np_set_valid.add((name, phone))
print(f"Valid name -> Unique Name + Phone: {len(np_set_valid)}")

# Let's try deduplicating by:
# A. name + phone
# B. name + phone + regionId
# C. name + phone + branchId
# D. name + phone + age
# E. phone only (excluding empty/invalid) + name for empty phone
# F. What if we do a hierarchy:
#    - If phone exists and is valid: key = phone (or name + phone)
#    - If phone doesn't exist/invalid: key = (name, branchId) (or treat as unique)

print("\n--- Testing various combinations of deduplication keys ---")

# Let's write a function to calculate count for a key function
def test_key(key_fn, filter_fn=None):
    filtered = [m for m in members if filter_fn(m)] if filter_fn else members
    seen = set()
    deduped = []
    for m in filtered:
        k = key_fn(m)
        if k not in seen:
            seen.add(k)
            deduped.append(m)
    return len(deduped)

# Various key functions
# K1: (name, phone)
def get_phone(m):
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    return ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''

# K2: (name, phone_last4)
def get_phone_last4(m):
    ph = get_phone(m)
    return ph[-4:] if len(ph) >= 4 else ph

# K3: (name, phone) if phone else (name, branchId)
# K4: (name, phone) if phone else unique (uuid/id)

# Test cases
cases = [
    ("name, phone", lambda m: (m.get('name', '').strip(), get_phone(m)), None),
    ("name, phone (valid name only)", lambda m: (m.get('name', '').strip(), get_phone(m)), lambda m: is_valid_name(m.get('name'))),
    ("name, phone_last4", lambda m: (m.get('name', '').strip(), get_phone_last4(m)), None),
    ("name, phone_last4 (valid name only)", lambda m: (m.get('name', '').strip(), get_phone_last4(m)), lambda m: is_valid_name(m.get('name'))),
    ("phone only (non-empty)", lambda m: get_phone(m), lambda m: get_phone(m) != ''),
    ("name, branchId", lambda m: (m.get('name', '').strip(), m.get('branchId', '')), None),
    ("name, branchId (valid name only)", lambda m: (m.get('name', '').strip(), m.get('branchId', '')), lambda m: is_valid_name(m.get('name'))),
    ("name, regionId", lambda m: (m.get('name', '').strip(), m.get('regionId', '')), None),
    ("name, phone, branchId", lambda m: (m.get('name', '').strip(), get_phone(m), m.get('branchId', '')), None),
    ("name, phone, branchId (valid name only)", lambda m: (m.get('name', '').strip(), get_phone(m), m.get('branchId', '')), lambda m: is_valid_name(m.get('name'))),
    ("name, phone, regionId", lambda m: (m.get('name', '').strip(), get_phone(m), m.get('regionId', '')), None),
]

for name, key_fn, filter_fn in cases:
    cnt = test_key(key_fn, filter_fn)
    print(f"{name} -> Deduplicated Count: {cnt}")

# What if we just deduplicate by (name, phone) but we also filter out "pending-" ids?
# Non-pending count was 3452.
# What if we deduplicate by (name, phone) on the whole dataset and it is not 4793?
# Wait! Let's check how many members are there in cleaned_members.json or if there are other files.
# What if the user meant: "지역별, 지점별 코드맵 점검을 몇명 했는지, 중복카운트를 제외하고 작성하려고 하는데, 지금 4793명의 데이타를 엑셀로 받아줘."
# Could "4793명" be the exact number of rows of some other dataset or did the user get this number from somewhere else?
# Let's check if there are 4793 records when we deduplicate by:
# Let's print out the exact deduplication counts.
