# 회원 데이터의 전화번호 유효성 및 분포를 탐색하는 스크립트
import json
import re

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

print(f"Total raw: {len(members)}")

phone_counts = {}
for m in members:
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '') if isinstance(ui, dict) else ''
    phone_counts[phone] = phone_counts.get(phone, 0) + 1

# Sort by count descending
sorted_phones = sorted(phone_counts.items(), key=lambda x: x[1], reverse=True)
print("\nTop 30 most frequent phone numbers:")
for ph, cnt in sorted_phones[:30]:
    print(f"  '{ph}': {cnt} occurrences")

# Find out patterns of invalid phones
empty_count = phone_counts.get('', 0)
print(f"\nEmpty/missing phones: {empty_count}")

# Let's see if we filter out members whose phone is empty or '010-0000-0000' or starts with '010-0000'
def is_valid_phone(ph):
    ph_clean = ph.replace('-', '').replace(' ', '').strip()
    if not ph_clean:
        return False
    if ph_clean in ['0000', '01000000000', '01012345678', '010-0000-0000', '0100000000']:
        return False
    # Check if it has at least 9 digits and consists only of digits
    if not ph_clean.isdigit():
        return False
    if len(ph_clean) < 9:
        return False
    return True

valid_phones_count = sum(1 for m in members if is_valid_phone(
    (m.get('report', {}).get('userInfo', {}) if isinstance(m.get('report', {}), dict) else {}).get('phone', '')
))
print(f"Valid phones count (by custom logic): {valid_phones_count}")

# What if we deduplicate by (name, phone) for valid phones, and what about invalid phones?
# Deduplicate (name, phone) on valid phones:
np_set_valid = set()
invalid_phone_members = []
for m in members:
    name = m.get('name', '').strip()
    r = m.get('report', {})
    ui = r.get('userInfo', {}) if isinstance(r, dict) else {}
    phone = ui.get('phone', '') if isinstance(ui, dict) else ''
    if is_valid_phone(phone):
        np_set_valid.add((name, phone.replace('-', '').replace(' ', '').strip()))
    else:
        invalid_phone_members.append(m)

print(f"Unique (name, phone) for valid phones: {len(np_set_valid)}")
print(f"Invalid phone members count: {len(invalid_phone_members)}")

# What if we deduplicate invalid phone members by name?
invalid_names_set = set(m.get('name', '').strip() for m in invalid_phone_members)
print(f"Unique names for invalid phone members: {len(invalid_names_set)}")
print(f"Valid np_set_valid + Unique names of invalid phone: {len(np_set_valid) + len(invalid_names_set)}")

# What if we deduplicate invalid phone members by (name, branchId)?
invalid_name_branch = set((m.get('name', '').strip(), m.get('branchId', '')) for m in invalid_phone_members)
print(f"Unique (name, branchId) for invalid phone members: {len(invalid_name_branch)}")
print(f"Valid np_set_valid + Unique (name, branchId) of invalid phone: {len(np_set_valid) + len(invalid_name_branch)}")
