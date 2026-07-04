# 춘천교육청 Firebase raw 데이터를 정제하고 전체 통계 분석하는 스크립트
import json
from collections import defaultdict

NATIONAL_AVG = {
    "total_members": 3267,
    "three_body": {"body": 70.5, "brain": 77.3, "mind": 58.6},
    "seven_code": {"c1": 55.1, "c2": 61.1, "c3": 61.0, "c4": 65.0, "c5": 63.0, "c6": 62.7, "c7": 68.6},
    "weakest_code_ratio": {1: 41.1, 2: 11.4, 3: 8.8, 4: 6.4, 5: 15.0, 6: 12.7, 7: 4.2},
    "posture": {
        "거북목 (FHP) 및 경추 정렬": {"Good": 0.5, "Fair": 79.1, "Poor": 20.4},
        "어깨 / 골반 좌우 대칭": {"Good": 59.4, "Fair": 38.7, "Poor": 1.9},
        "측면 척추 정렬 (흉추/요추)": {"Good": 3.4, "Fair": 77.0, "Poor": 19.6},
        "하체 기저면 (무릎/다리/발목)": {"Good": 90.0, "Fair": 8.0, "Poor": 2.0},
        "귀-어깨-고관절-무릎 수직선 이탈": {"Good": 1.4, "Fair": 76.2, "Poor": 22.4},
    },
}

CODE_LABELS = {
    1: "기초 에너지 (힐링 라이프)", 2: "감정 흐름 (스트레스 관리)",
    3: "추진력 (감정 균형)", 4: "정서 안정 (활력 충전)",
    5: "소통 (집중 & 직관)", 6: "집중·통찰 (통찰 & 지혜)",
    7: "삶의 방향 (의식 & 영성)",
}

def sf(val):
    if val is None: return None
    try: return float(val)
    except: return None

def savg(vals):
    v = [x for x in vals if x is not None]
    return round(sum(v) / len(v), 1) if v else None

def age_group(age):
    if age is None: return None
    a = int(age)
    if a <= 19: return "10대이하"
    elif a <= 29: return "20대"
    elif a <= 39: return "30대"
    elif a <= 49: return "40대"
    elif a <= 59: return "50대"
    elif a <= 69: return "60대"
    elif a <= 79: return "70대"
    else: return "80대이상"

print("=" * 60)
print("  춘천교육청 Firebase 데이터 정제 및 분석")
print("=" * 60)

with open("춘천교육청_Firebase_raw.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

print(f"raw 데이터: {len(raw)}건")

# 중복 제거 (이름 기준, report 있는 것 우선, 최신 유지)
dedup = {}
for m in raw:
    report = m.get("report", {})
    ui = report.get("userInfo", {})
    name = (ui.get("name") or m.get("name") or "").strip()
    
    if not report or not report.get("threeBodyAnalysis"):
        continue
    
    if name in dedup:
        # 최신 데이터 유지
        old_date = dedup[name].get("lastTestDate", "")
        new_date = m.get("lastTestDate", "")
        if isinstance(old_date, dict): old_date = str(old_date.get("seconds", 0))
        if isinstance(new_date, dict): new_date = str(new_date.get("seconds", 0))
        if str(new_date) > str(old_date):
            dedup[name] = m
    else:
        dedup[name] = m

members = list(dedup.values())
print(f"중복 제거 후: {len(members)}명")

# === 파싱 ===
parsed = []
for m in members:
    report = m.get("report", {})
    ui = report.get("userInfo", {})
    tba = report.get("threeBodyAnalysis", {})
    sca = report.get("sevenCodeAnalysis", {})
    pm_list = report.get("postureMetrics", [])

    name = (ui.get("name") or m.get("name") or "").strip()
    gender = (ui.get("gender") or "").strip().lower()
    age = sf(ui.get("age"))
    ag = age_group(age)

    body_data = tba.get("body", {})
    brain_data = tba.get("brain", {})
    mind_data = tba.get("mind", {})
    body_score = sf(body_data.get("score") if isinstance(body_data, dict) else body_data)
    brain_score = sf(brain_data.get("score") if isinstance(brain_data, dict) else brain_data)
    mind_score = sf(mind_data.get("score") if isinstance(mind_data, dict) else mind_data)

    code_scores = {}
    for i in range(1, 8):
        cd = sca.get(f"code{i}", {})
        code_scores[i] = sf(cd.get("score") if isinstance(cd, dict) else cd)

    posture_metrics = []
    for pm in (pm_list or []):
        if isinstance(pm, dict):
            posture_metrics.append({
                "name": pm.get("name", ""), "status": pm.get("status", ""),
                "score": sf(pm.get("score"))
            })

    physical_age = sf(report.get("physicalAge"))
    brain_age = sf(report.get("brainAge"))
    mind_age = sf(report.get("mindAge"))
    face_age = sf(report.get("faceAgeEstimate"))
    comprehensive_age = sf(report.get("comprehensiveAge"))
    overall_score = sf(report.get("overallScore"))

    kc = report.get("kwangmyungChakra", {})
    energy_level = (kc.get("needLevel") or "") if isinstance(kc, dict) else ""

    valid_codes = {k: v for k, v in code_scores.items() if v is not None}
    weakest_code = min(valid_codes, key=valid_codes.get) if valid_codes else None

    parsed.append({
        "name": name, "gender": gender, "age": age, "age_group": ag,
        "body_score": body_score, "brain_score": brain_score, "mind_score": mind_score,
        "code_scores": code_scores, "posture_metrics": posture_metrics,
        "physical_age": physical_age, "brain_age": brain_age, "mind_age": mind_age,
        "face_age": face_age, "comprehensive_age": comprehensive_age,
        "overall_score": overall_score, "energy_level": energy_level,
        "weakest_code": weakest_code,
    })

total = len(parsed)
males = [p for p in parsed if p["gender"] == "male"]
females = [p for p in parsed if p["gender"] == "female"]

# === 통계 ===
age_groups_dist = defaultdict(int)
for p in parsed:
    if p["age_group"]: age_groups_dist[p["age_group"]] += 1

demographics = {
    "total": total, "male_count": len(males), "female_count": len(females),
    "avg_age": savg([p["age"] for p in parsed]),
    "age_groups": dict(sorted(age_groups_dist.items(),
        key=lambda x: ["10대이하","20대","30대","40대","50대","60대","70대","80대이상"].index(x[0])
        if x[0] in ["10대이하","20대","30대","40대","50대","60대","70대","80대이상"] else 99)),
}

three_body = {
    "overall": {"body": savg([p["body_score"] for p in parsed]), "brain": savg([p["brain_score"] for p in parsed]), "mind": savg([p["mind_score"] for p in parsed])},
    "male": {"body": savg([p["body_score"] for p in males]), "brain": savg([p["brain_score"] for p in males]), "mind": savg([p["mind_score"] for p in males])},
    "female": {"body": savg([p["body_score"] for p in females]), "brain": savg([p["brain_score"] for p in females]), "mind": savg([p["mind_score"] for p in females])},
}

three_body_by_age = {}
for ag_name in ["20대","30대","40대","50대","60대"]:
    grp = [p for p in parsed if p["age_group"] == ag_name]
    if grp:
        three_body_by_age[ag_name] = {
            "count": len(grp),
            "body": savg([p["body_score"] for p in grp]),
            "brain": savg([p["brain_score"] for p in grp]),
            "mind": savg([p["mind_score"] for p in grp]),
        }

health_age = {
    "overall": {
        "avg_real_age": savg([p["age"] for p in parsed]),
        "avg_physical_age": savg([p["physical_age"] for p in parsed]),
        "avg_brain_age": savg([p["brain_age"] for p in parsed]),
        "avg_mind_age": savg([p["mind_age"] for p in parsed]),
        "avg_face_age": savg([p["face_age"] for p in parsed]),
        "avg_comprehensive_age": savg([p["comprehensive_age"] for p in parsed]),
        "avg_overall_score": savg([p["overall_score"] for p in parsed]),
    },
    "male": {
        "avg_real_age": savg([p["age"] for p in males]),
        "avg_physical_age": savg([p["physical_age"] for p in males]),
        "avg_brain_age": savg([p["brain_age"] for p in males]),
        "avg_mind_age": savg([p["mind_age"] for p in males]),
        "avg_comprehensive_age": savg([p["comprehensive_age"] for p in males]),
        "avg_overall_score": savg([p["overall_score"] for p in males]),
    },
    "female": {
        "avg_real_age": savg([p["age"] for p in females]),
        "avg_physical_age": savg([p["physical_age"] for p in females]),
        "avg_brain_age": savg([p["brain_age"] for p in females]),
        "avg_mind_age": savg([p["mind_age"] for p in females]),
        "avg_comprehensive_age": savg([p["comprehensive_age"] for p in females]),
        "avg_overall_score": savg([p["overall_score"] for p in females]),
    },
}

seven_code = {"overall": {}, "male": {}, "female": {}}
for i in range(1, 8):
    k = f"c{i}"
    seven_code["overall"][k] = savg([p["code_scores"].get(i) for p in parsed])
    seven_code["male"][k] = savg([p["code_scores"].get(i) for p in males])
    seven_code["female"][k] = savg([p["code_scores"].get(i) for p in females])

weakest_dist = defaultdict(int)
for p in parsed:
    if p["weakest_code"]: weakest_dist[p["weakest_code"]] += 1
weakest_code_analysis = {}
for cn in sorted(weakest_dist.keys()):
    cnt = weakest_dist[cn]
    weakest_code_analysis[cn] = {"label": CODE_LABELS.get(cn, f"코드{cn}"), "count": cnt, "ratio": round(cnt/total*100, 1)}

posture_stats = {}
for p in parsed:
    for pm in p["posture_metrics"]:
        n = pm["name"]; st = pm["status"]
        if n not in posture_stats: posture_stats[n] = {"Good": 0, "Fair": 0, "Poor": 0, "total": 0}
        posture_stats[n]["total"] += 1
        if st in ["Good","Fair","Poor"]: posture_stats[n][st] += 1

posture_analysis = {}
for n, c in posture_stats.items():
    t = c["total"]
    if t: posture_analysis[n] = {"total": t, "Good": round(c["Good"]/t*100,1), "Fair": round(c["Fair"]/t*100,1), "Poor": round(c["Poor"]/t*100,1)}

result = {
    "event_code": "EVT_춘천_260605_7UNA", "institution": "춘천교육청", "test_date": "2026-06-24",
    "demographics": demographics,
    "three_body": three_body, "three_body_by_age": three_body_by_age,
    "health_age": health_age,
    "seven_code": seven_code, "weakest_code_analysis": weakest_code_analysis,
    "posture_analysis": posture_analysis,
    "national_avg": NATIONAL_AVG,
    "individual_summary": [
        {"name": p["name"], "age": p["age"], "gender": "남" if p["gender"]=="male" else "여",
         "body_score": p["body_score"], "brain_score": p["brain_score"], "mind_score": p["mind_score"],
         "physical_age": p["physical_age"], "brain_age": p["brain_age"], "mind_age": p["mind_age"],
         "overall_score": p["overall_score"], "weakest_code": p["weakest_code"]}
        for p in parsed
    ],
}

with open("춘천교육청_분석결과.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# === 콘솔 출력 ===
tb = three_body["overall"]
hao = health_age["overall"]
print(f"\n[인구통계] {total}명 (남 {len(males)}, 여 {len(females)}), 평균 {demographics['avg_age']}세")
print(f"  연령대: {dict(age_groups_dist)}")
print(f"\n[3Body] 신체={tb['body']} | 뇌={tb['brain']} | 마음={tb['mind']}")
na = NATIONAL_AVG["three_body"]
for k,l in [("body","신체"),("brain","뇌"),("mind","마음")]:
    d = round(tb[k]-na[k],1); s = "+" if d>0 else ""
    print(f"  {l}: 춘천 {tb[k]} vs 전국 {na[k]} ({s}{d})")
print(f"\n[건강나이] 실제={hao['avg_real_age']} | 신체={hao['avg_physical_age']} | 뇌={hao['avg_brain_age']} | 마음={hao['avg_mind_age']} | 종합={hao['avg_comprehensive_age']}")
print(f"  종합점수: {hao['avg_overall_score']}점")
print(f"\n[7Code]")
for i in range(1,8):
    k=f"c{i}"; v=seven_code["overall"][k]; n=NATIONAL_AVG["seven_code"][k]
    d=round(v-n,1) if v else 0; s="+" if d>0 else ""
    print(f"  코드{i}: {v}점 (전국 {n}, {s}{d})")
print(f"\n[최약코드]")
for cn,info in sorted(weakest_code_analysis.items()):
    print(f"  코드{cn}: {info['count']}명 ({info['ratio']}%) [전국 {NATIONAL_AVG['weakest_code_ratio'].get(cn,0)}%]")
print(f"\n분석 완료. 춘천교육청_분석결과.json 저장됨.")
