import pandas as pd
import json

df = pd.read_excel('3바디 설치현황0419.xlsx', header=None) # 헤더 없이 일단 5줄만 읽어봄
data = df.head(10).fillna('').to_dict(orient='records')
print(json.dumps(data, ensure_ascii=False, indent=2))
