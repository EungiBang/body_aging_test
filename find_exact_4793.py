# 정확히 4793명이 매칭되는 데이터 필터링 및 중복 제거 조건을 찾는 탐색 스크립트
import json

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

print(f"Total raw: {len(members)}")

# Let's check unique names when we exclude invalid/test names:
def is_valid_name_strict(n):
    n_str = str(n).strip()
    if not n_str:
        return False
    if n_str == '':
        return False
    if '테스트' in n_str or 'test' in n_str.lower() or '임시' in n_str:
        return False
    # If name consists of digits or special chars
    if not any(c.isalpha() for c in n_str) and not any(ord(c) >= 0xac00 and ord(c) <= 0xd7a3 for c in n_str):
        return False
    return True

unique_names_raw = set(m.get('name', '').strip() for m in members)
print(f"Raw unique names: {len(unique_names_raw)}")

unique_names_valid = set(m.get('name', '').strip() for m in members if is_valid_name_strict(m.get('name')))
print(f"Valid unique names: {len(unique_names_valid)}")

# Let's look at unique (name, phone) where we exclude invalid names/phones
def get_phone_clean(m):
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    ph = ui.get('phone', '') if isinstance(ui, dict) else ''
    return ph.replace('-', '').replace(' ', '').strip()

# What if we deduplicate by (name, phone) but if phone is empty/invalid, we exclude it?
# Or if we deduplicate by name + phone and then filter out some items?
# What if we filter by regionId? Are there any regions that should be excluded?
# Let's count unique names per sourceType:
for st in ['PC', 'LITE', 'None']:
    sub = [m for m in members if m.get('sourceType') == st]
    un = set(m.get('name', '').strip() for m in sub)
    print(f"sourceType={st} -> Unique names: {len(un)}")

# Unique names in (PC + LITE):
pc_lite_members = [m for m in members if m.get('sourceType') in ['PC', 'LITE']]
unique_names_pc_lite = set(m.get('name', '').strip() for m in pc_lite_members)
print(f"PC + LITE -> Unique names: {len(unique_names_pc_lite)}")

# Let's search for exact count 4793 by trying combinations of:
# - sourceType filter (all, PC+LITE, PC+None, etc.)
# - pending filter (all, non-pending)
# - name validity filter
# - phone validity filter
# - deduplication key (name, phone, name+phone, name+branch, etc.)

print("\n--- Running Combinatorial Search for Deduplicated Count = 4793 ---")

source_options = [
    ("all", members),
    ("PC+LITE", pc_lite_members),
    ("PC", [m for m in members if m.get('sourceType') == 'PC']),
    ("LITE", [m for m in members if m.get('sourceType') == 'LITE']),
    ("PC+LITE+None", [m for m in members if m.get('sourceType') in ['PC', 'LITE', 'None']])
]

pending_options = [
    ("all_pending", lambda m: True),
    ("non_pending_only", lambda m: not m.get('id', '').startswith('pending-'))
]

name_filters = [
    ("no_name_filter", lambda m: True),
    ("valid_name_only", lambda m: is_valid_name_strict(m.get('name')))
]

phone_filters = [
    ("no_phone_filter", lambda m: True),
    ("has_phone_only", lambda m: get_phone_clean(m) != ''),
    ("valid_phone_only", lambda m: get_phone_clean(m) not in ['', '01000000000', '00000000000', '01012345678', '000', '010'])
]

dedup_keys = [
    ("name", lambda m: m.get('name', '').strip()),
    ("name_phone", lambda m: (m.get('name', '').strip(), get_phone_clean(m))),
    ("phone", lambda m: get_phone_clean(m)),
    ("name_branch", lambda m: (m.get('name', '').strip(), m.get('branchId', ''))),
    ("name_region", lambda m: (m.get('name', '').strip(), m.get('regionId', '')))
]

found = False
for s_name, s_data in source_options:
    for p_name, p_filter in pending_options:
        for n_name, n_filter in name_filters:
            for ph_name, ph_filter in phone_filters:
                for dk_name, dk_key in dedup_keys:
                    
                    # Apply filters
                    filtered_list = []
                    for m in s_data:
                        if p_filter(m) and n_filter(m) and ph_filter(m):
                            filtered_list.append(m)
                    
                    # Deduplicate
                    seen = set()
                    deduped = []
                    for m in filtered_list:
                        k = dk_key(m)
                        if k not in seen:
                            seen.add(k)
                            deduped.append(m)
                    
                    cnt = len(deduped)
                    if cnt == 4793 or abs(cnt - 4793) < 10:
                        print(f"MATCH CLOSE TO 4793: {cnt} (diff={cnt-4793})")
                        print(f"  Source: {s_name}")
                        print(f"  Pending: {p_name}")
                        print(f"  Name Filter: {n_name}")
                        print(f"  Phone Filter: {ph_name}")
                        print(f"  Dedup Key: {dk_name}")
                        print(f"  Filtered count before dedup: {len(filtered_list)}")
                        if cnt == 4793:
                            found = True
                            print("!!! EXACT MATCH !!!")

if not found:
    print("No exact match of 4793 found with these combinations.")
