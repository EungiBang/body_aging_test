import json, os

data = json.load(open('7code_raw.json', encoding='utf-8'))
mapping = {}
for k, v in data.items():
    if not k.endswith('차크라'): continue
    code = int(k[0])
    for kw in v:
        kw = kw.strip()
        if kw == '원장': kw = '원망'
        if kw not in mapping: mapping[kw] = []
        if code not in mapping[kw]: mapping[kw].append(code)

out = 'export interface KeywordMap {\n  keyword: string;\n  codes: number[];\n}\n\nexport const SEVEN_CODE_KEYWORDS: KeywordMap[] = [\n'
for kw, codes in mapping.items():
    out += f'  {{ keyword: "{kw}", codes: {codes} }},\n'
out += '];\n'

os.makedirs('src/constants', exist_ok=True)
with open('src/constants/sevenCodeKeywords.ts', 'w', encoding='utf-8') as f:
    f.write(out)
