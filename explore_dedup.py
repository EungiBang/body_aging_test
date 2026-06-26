# 회원 데이터에서 4793명 조건에 매칭되는 중복 제거 기준을 찾기 위한 테스트 스크립트
import json

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

print(f"Total raw: {len(members)}")

# 1. Deduplicate by Name only
names = set(m.get('name', '').strip() for m in members)
print(f"Unique names: {len(names)}")

# 2. Deduplicate by Phone only (ignoring empty/invalid phone numbers?)
phones_raw = []
for m in members:
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    phones_raw.append(phone)

unique_phones_inc_empty = set(phones_raw)
print(f"Unique phones (including empty): {len(unique_phones_inc_empty)}")

# 3. Deduplicate by Name + Phone (raw name, normalized phone)
name_phone = set()
for m in members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    name_phone.add((name, phone))
print(f"Unique Name + Phone: {len(name_phone)}")

# 4. Deduplicate by Name + Phone, but if Phone is empty, treat as unique?
# Let's count: if phone is empty, we keep all of them. If phone exists, we deduplicate by (name, phone)
seen_name_phone = set()
unique_members_custom_1 = []
for m in members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    
    if not phone:
        # no phone, treat as unique
        unique_members_custom_1.append(m)
    else:
        key = (name, phone)
        if key not in seen_name_phone:
            seen_name_phone.add(key)
            unique_members_custom_1.append(m)
print(f"Deduplicate by (Name, Phone), keeping all empty phones: {len(unique_members_custom_1)}")

# 5. Deduplicate by Name + Phone, but if phone is empty, deduplicate by Name?
seen_name_phone_2 = set()
seen_name_only = set()
unique_members_custom_2 = []
for m in members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    
    if not phone:
        if name not in seen_name_only:
            seen_name_only.add(name)
            unique_members_custom_2.append(m)
    else:
        key = (name, phone)
        if key not in seen_name_phone_2:
            seen_name_phone_2.add(key)
            unique_members_custom_2.append(m)
print(f"Deduplicate by (Name, Phone) / Name if empty: {len(unique_members_custom_2)}")

# 6. Deduplicate by Name + Phone + Birth Year/Age?
name_phone_age = set()
for m in members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
    age = str(ui.get('age', '')) if isinstance(ui, dict) else ''
    name_phone_age.add((name, phone, age))
print(f"Unique Name + Phone + Age: {len(name_phone_age)}")

# 7. What if we filter by sourceType?
# e.g., SourceType is PC or LITE.
# If we filter sourceType in ['PC', 'LITE'] and do deduplication?
for source_filter in [['PC', 'LITE'], ['PC'], ['LITE']]:
    sub = [m for m in members if m.get('sourceType') in source_filter]
    # Unique by Name + Phone
    np_set = set()
    for m in sub:
        name = m.get('name', '').strip()
        r = m.get('report', {})
        ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
        phone = ui.get('phone', '').replace('-', '').replace(' ', '').strip() if isinstance(ui, dict) else ''
        np_set.add((name, phone))
    print(f"SourceType in {source_filter} -> Unique Name + Phone: {len(np_set)}")

# 8. Let's look at check_data.py or similar python files to see if there is any other files.
# Maybe cleaned_members.csv has 2110, cleaned_members_v2.json has 6272.
# Is there another json file?
# cleaned_members.json has 2110.
# Is there cleaned_members_v2.json where some other filter applies?
