# 5월 27일 야외용 라이트 점검 데이터를 Firestore에서 추출하여 엑셀 파일로 생성하는 스크립트
import requests
import json
import pandas as pd
from datetime import datetime, timedelta

project_id = "btc-3body-server"

# Firestore JSON 데이터를 파이썬 일반 딕셔너리로 변환하는 헬퍼 함수
def decode_firestore_value(val):
    if not isinstance(val, dict):
        return val
    if "stringValue" in val:
        return val["stringValue"]
    if "integerValue" in val:
        return int(val["integerValue"])
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "booleanValue" in val:
        return val["booleanValue"]
    if "timestampValue" in val:
        return val["timestampValue"]
    if "nullValue" in val:
        return None
    if "mapValue" in val:
        fields = val["mapValue"].get("fields", {})
        return {k: decode_firestore_value(v) for k, v in fields.items()}
    if "arrayValue" in val:
        values = val["arrayValue"].get("values", [])
        return [decode_firestore_value(v) for v in values]
    return {k: decode_firestore_value(v) for k, v in val.items()}

# 모든 문서를 페이지네이션을 통해 수집하는 함수
def fetch_all_documents(collection_id):
    url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{collection_id}"
    documents = []
    page_token = None
    
    print(f"[{collection_id}] 컬렉션에서 데이터 수집을 시작합니다.")
    
    while True:
        params = {"pageSize": 100}
        if page_token:
            params["pageToken"] = page_token
            
        response = requests.get(url, params=params)
        if response.status_code != 200:
            print(f"데이터 조회 실패. 컬렉션: {collection_id}, 상태코드: {response.status_code}")
            print(response.text)
            break
            
        data = response.json()
        batch_docs = data.get("documents", [])
        documents.extend(batch_docs)
        
        page_token = data.get("nextPageToken")
        if not page_token:
            break
            
    print(f"[{collection_id}] 수집 완료. 총 문서 개수: {len(documents)}개")
    return documents

def main():
    # 1. 지점 정보 조회 및 매핑 테이블 구축
    raw_branches = fetch_all_documents("branches")
    branch_map = {}
    for doc in raw_branches:
        fields = doc.get("fields", {})
        decoded_branch = decode_firestore_value(fields)
        b_id = decoded_branch.get("id")
        b_name = decoded_branch.get("name")
        if b_id and b_name:
            branch_map[b_id] = b_name
            
    print(f"지점 매핑 데이터 수 구축 완료. 총 {len(branch_map)}개 지점 매핑 정보 등록됨.")
    
    # 2. 회원 점검 데이터 조회
    raw_members = fetch_all_documents("members_v4")
    
    # 3. 5월 27일 및 LITE 데이터 필터링 및 가공
    target_date_str = "2026-05-27"
    extracted_records = []
    
    # 시차 보정을 위한 한국 시간 판별용 함수
    def is_kst_today(date_str):
        if not date_str:
            return False
        # 단순 매칭: '2026-05-27' 텍스트 포함 확인
        if target_date_str in date_str:
            return True
        # ISO 형식 파싱 후 KST 기준 판별
        try:
            # 2026-05-27T12:08:50Z 또는 2026-05-27T03:29:12.973Z 등 처리
            clean_date = date_str.replace("Z", "+00:00")
            dt_utc = datetime.fromisoformat(clean_date)
            # 한국 시간은 UTC+9
            dt_kst = dt_utc + timedelta(hours=9)
            return dt_kst.strftime("%Y-%m-%d") == target_date_str
        except Exception:
            return False

    lite_today_count = 0
    pc_today_count = 0
    total_today_count = 0

    for doc in raw_members:
        fields = doc.get("fields", {})
        record = decode_firestore_value(fields)
        
        # 분석 대기 임시 찌꺼기 레코드 제외
        doc_id = record.get("id", "") or ""
        name = record.get("name") or ""
        if doc_id.startswith("pending-") or "(분석 대기)" in name:
            continue
            
        # 날짜 판별
        last_test_date = record.get("lastTestDate")
        report = record.get("report") or {}
        report_date = report.get("date")
        
        is_today = is_kst_today(last_test_date) or is_kst_today(report_date)
        if not is_today:
            continue
            
        total_today_count += 1
        
        # LITE 또는 PC 판별
        source_type = record.get("sourceType", "PC")
        if source_type == "LITE":
            lite_today_count += 1
        else:
            pc_today_count += 1
            
        # 유저가 '야외용 라이트용 점검 받으신 분들'을 원하셨으므로 LITE 필터링 적용
        # 단, 만약 LITE 데이터가 한 건도 없을 경우 누락 방지를 위해 모든 오늘 데이터를 수집해서 보여주도록 함
        # 여기서는 일단 LITE를 최우선으로 수집하되 리포트에 두 데이터를 다 모아둘 수 있도록 source_type을 칼럼에 명시함
        
        user_info = report.get("userInfo") or {}
        
        # 필수 필드 추출
        name = record.get("name") or user_info.get("name") or "이름 없음"
        phone = user_info.get("phone") or "연락처 없음"
        branch_id = record.get("branchId") or "지점 미지정"
        branch_name = branch_map.get(branch_id, branch_id)
        age = user_info.get("age", "-")
        
        gender_raw = user_info.get("gender")
        gender = "남성" if gender_raw == "male" else "여성" if gender_raw == "female" else "기타" if gender_raw else "-"
        
        physical_age = report.get("physicalAge", "-")
        brain_age = report.get("brainAge", "-")
        overall_score = report.get("overallScore", "-")
        
        # KST 날짜 변환 포맷
        test_time_formatted = "-"
        if last_test_date:
            try:
                clean_date = last_test_date.replace("Z", "+00:00")
                dt_kst = datetime.fromisoformat(clean_date) + timedelta(hours=9)
                test_time_formatted = dt_kst.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                test_time_formatted = last_test_date

        extracted_records.append({
            "성함": name,
            "연락처": phone,
            "지점": branch_name,
            "나이": age,
            "성별": gender,
            "신체나이": physical_age,
            "뇌나이": brain_age,
            "종합점수": overall_score,
            "점검시간(KST)": test_time_formatted,
            "기기종류": source_type
        })

    print(f"\n[오늘({target_date_str})의 점검 건수 통계]")
    print(f"  - 총 점검 건수: {total_today_count}개")
    print(f"  - 야외용 라이트(LITE) 건수: {lite_today_count}개")
    print(f"  - PC 버전 건수: {pc_today_count}개")

    if not extracted_records:
        print("오늘 점검을 진행한 회원이 존재하지 않습니다.")
        return

    # DataFrame 생성
    df = pd.DataFrame(extracted_records)
    
    # 기기종류 필터를 사용해 유저가 요청한 야외용 라이트(LITE) 데이터만 분리
    df_lite = df[df["기기종류"] == "LITE"].copy()
    
    # 만약 오늘 LITE 데이터가 한 건도 없을 경우, 사용자가 혼란스럽지 않도록 전체 데이터를 엑셀로 저장함
    excel_filename = "5월27일_야외용_라이트_점검현황.xlsx"
    if df_lite.empty:
        print("경고: 오늘 야외용 라이트(LITE) 버전으로 진행된 점검 데이터가 전혀 없습니다.")
        print("대신 오늘 진행된 전체 PC 버전 점검 데이터를 엑셀로 저장합니다.")
        df_target = df
        excel_filename = "5월27일_전체_점검현황(라이트데이터없음).xlsx"
    else:
        df_target = df_lite.drop(columns=["기기종류"]) # 유저 요구 칼럼으로만 정리

    # 성함 및 시간순으로 정렬
    df_target = df_target.sort_values(by=["점검시간(KST)", "성함"])
    
    # 엑셀 파일로 저장
    df_target.to_excel(excel_filename, index=False)
    print(f"\n성공적으로 엑셀 파일이 생성되었습니다. 파일명: {excel_filename}")
    print(f"엑셀에 기록된 점검 건수: {len(df_target)}개")
    
    # 콘솔 창에 목록 일부 미리보기 출력 (한글 깨짐 방지를 위해 출력 포맷 정리)
    print("\n--- 엑셀 데이터 추출 목록 미리보기 ---")
    for idx, row in df_target.iterrows():
        print(f"성함: {row['성함']} | 연락처: {row['연락처']} | 지점: {row['지점']} | 나이: {row['나이']} | 신체나이: {row['신체나이']} | 뇌나이: {row['뇌나이']} | 종합점수: {row['종합점수']}")

if __name__ == "__main__":
    main()
