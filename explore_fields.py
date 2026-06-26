# 회원 데이터에서 지역 및 지점 필드를 탐색하고 회원 수와 중복 현황을 점검하는 스크립트
import json

def check_file(filename):
    print(f"\n===== Checking {filename} =====")
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Type: {type(data)}")
    if isinstance(data, list):
        print(f"Total count: {len(data)}")
        if len(data) > 0:
            sample = data[0]
            print("Sample keys at top level:", list(sample.keys()))
            
            # userInfo check
            report = sample.get('report', {})
            if isinstance(report, dict):
                print("Sample keys in 'report':", list(report.keys()))
                user_info = report.get('userInfo', {})
                if isinstance(user_info, dict):
                    print("Sample keys in 'report.userInfo':", list(user_info.keys()))
                    print("Sample report.userInfo content:")
                    for k, v in user_info.items():
                        print(f"  {k}: {v}")
                
                personal_info = report.get('personalInfo', {})
                if isinstance(personal_info, dict):
                    print("Sample keys in 'report.personalInfo':", list(personal_info.keys()))
                    print("Sample report.personalInfo content:")
                    for k, v in personal_info.items():
                        print(f"  {k}: {v}")
            
            # Check for region and branch in other top level keys
            region_keys = [k for k in sample.keys() if 'region' in k.lower()]
            branch_keys = [k for k in sample.keys() if 'branch' in k.lower()]
            print(f"Top level region keys: {region_keys}")
            print(f"Top level branch keys: {branch_keys}")

try:
    check_file('cleaned_members.json')
except Exception as e:
    print(f"Error checking cleaned_members.json: {e}")

try:
    check_file('cleaned_members_v2.json')
except Exception as e:
    print(f"Error checking cleaned_members_v2.json: {e}")
