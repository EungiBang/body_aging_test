import pandas as pd
import json

df = pd.read_excel('d:/antigravity_vibecoding/BT 3바디 ai테스트/7CODE 다이어그램 코드별 정리.xlsx')
data = df.to_dict(orient='records')
with open('d:/antigravity_vibecoding/BT 3바디 ai테스트/sevenCode_temp.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False)
