import pandas as pd

# 사용자가 요청한 기본 데이터 (지역, 지점)
data = [
    {"지역": "본사", "지점": "신입경영홍보실"},
    {"지역": "단무도", "지점": "단무도 지점(예시)"},
    {"지역": "서울1", "지점": "강남센터"},
    {"지역": "경기남부", "지점": "수원센터"}
]

df = pd.DataFrame(data)

# 엑셀 파일로 저장
file_name = "지점_일괄등록_양식.xlsx"
df.to_excel(file_name, index=False)

print(f"'{file_name}' 파일 생성 완료!")
