import json
import os

with open('d:/antigravity_vibecoding/BT 3바디 ai테스트/sevenCode_temp.json', encoding='utf-8') as f:
    data = json.load(f)

keywords = []
seen = set()

for row in data:
    for i in range(1, 8):
        key = f'{i}차크라'
        if key in row and isinstance(row[key], str):
            val = row[key].strip()
            if val and val not in seen:
                seen.add(val)
                keywords.append({
                    'id': f'code{i}_{len(keywords)}',
                    'label': val,
                    'code': i
                })

os.makedirs('d:/antigravity_vibecoding/BT 3바디 ai테스트/constants', exist_ok=True)
with open('d:/antigravity_vibecoding/BT 3바디 ai테스트/constants/sevenCodeKeywords.ts', 'w', encoding='utf-8') as f:
    f.write('export const SEVEN_CODE_KEYWORDS = ')
    json.dump(keywords, f, ensure_ascii=False, indent=2)
    f.write(';\n')
