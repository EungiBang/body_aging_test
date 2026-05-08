import subprocess
import sys

# openpyxl 내부에서 shared strings를 직접 추출
import zipfile
import xml.etree.ElementTree as ET

xlsx_path = '3바디 설치현황0419.xlsx'

# xlsx는 사실 zip 파일
with zipfile.ZipFile(xlsx_path, 'r') as z:
    # shared strings 읽기
    if 'xl/sharedStrings.xml' in z.namelist():
        with z.open('xl/sharedStrings.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            strings = []
            for si in root.findall('.//s:si', ns):
                texts = si.findall('.//s:t', ns)
                val = ''.join(t.text or '' for t in texts)
                strings.append(val)
            print("=== Shared Strings (총 {}개) ===".format(len(strings)))
            for i, s in enumerate(strings):
                print(f"  [{i}] {s}")
    
    # 시트 목록 확인
    print("\n=== 시트 파일 목록 ===")
    for name in z.namelist():
        if 'sheet' in name.lower():
            print(f"  {name}")
