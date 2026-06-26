# 3Body 7Code 건강 보고서 V2 - 정제 및 종합 통계 분석 (필드 구조 반영 v2)
import json
import os
from collections import defaultdict, Counter
import re

print("=" * 60)
print("  CODEMAP AI 3Body 건강 보고서 V2 - 정밀 분석")
print("=" * 60)

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    raw_members = json.load(f)

with open('firebase_dump_v2.json', 'r', encoding='utf-8') as f:
    dump = json.load(f)

regions = dump['regions']
branches = dump['branches']

print(f"\n[1] 원시 데이터 로드: {len(raw_members)}건")

# ====================================================================
# 2. 데이터 정제
# ====================================================================
non_pending = [m for m in raw_members if not (m.get('id', '').startswith('pending-'))]
pending_count = len(raw_members) - len(non_pending)
print(f"[2.1] Pending 제외: -{pending_count}건 → {len(non_pending)}건")

has_report = [m for m in non_pending if m.get('report')]
print(f"[2.2] 리포트 없는 문서 제외: -{len(non_pending) - len(has_report)}건 → {len(has_report)}건")

test_patterns = ['테스트', 'test', '임시', 'ㅌㅅㅌ', '본사', '교육', 'admin', '샘플', 'sample']
def is_test_data(m):
    name = (m.get('name') or '').strip().lower()
    report = m.get('report', {})
    ui = report.get('userInfo', {})
    ui_name = (ui.get('name') or '').strip().lower()
    phone = (ui.get('phone') or '').strip().replace('-', '')
    for pat in test_patterns:
        if pat in name or pat in ui_name:
            return True
    if phone and re.match(r'^(0{4,}|1{4,}|123456)', phone):
        return True
    return False

cleaned = [m for m in has_report if not is_test_data(m)]
print(f"[2.3] 테스트/교육 제외: -{len(has_report) - len(cleaned)}건 → {len(cleaned)}건")

# 본사 지점 제외
hq_branch_ids = set()
for bid, binfo in branches.items():
    bname = (binfo.get('name') or '').strip()
    if '본사' in bname or 'HQ' in bname.upper():
        hq_branch_ids.add(bid)

non_hq = [m for m in cleaned if m.get('branchId') not in hq_branch_ids]
print(f"[2.4] 본사 지점 제외: -{len(cleaned) - len(non_hq)}건 → {len(non_hq)}건")

# 중복 제거 (이름+전화번호+나이 → 최신 유지)
def get_member_key(m):
    report = m.get('report', {})
    ui = report.get('userInfo', {})
    name = (ui.get('name') or m.get('name') or '').strip()
    phone = (ui.get('phone') or '').strip().replace('-', '')
    age = str(ui.get('age', ''))
    return f"{name}_{phone}_{age}" if phone else f"{name}_{age}_{m.get('id','')}"

member_map = {}
for m in non_hq:
    key = get_member_key(m)
    existing = member_map.get(key)
    if existing:
        existing_date = existing.get('lastTestDate') or existing.get('syncedAt', {})
        current_date = m.get('lastTestDate') or m.get('syncedAt', {})
        if isinstance(existing_date, dict):
            existing_date = existing_date.get('seconds', 0)
        if isinstance(current_date, dict):
            current_date = current_date.get('seconds', 0)
        if str(current_date) > str(existing_date):
            member_map[key] = m
    else:
        member_map[key] = m

unique_members = list(member_map.values())
print(f"[2.5] 중복 제거: -{len(non_hq) - len(unique_members)}건 → 고유 회원: {len(unique_members)}명")

# ====================================================================
# 3. 파싱 및 통계 분석
# ====================================================================
print(f"\n[3] {len(unique_members)}명 분석 시작...")

def safe_float(val):
    if val is None: return None
    try: return float(val)
    except: return None

def safe_avg(values):
    valid = [v for v in values if v is not None]
    return round(sum(valid) / len(valid), 1) if valid else None

def get_age_group(age):
    if age is None: return None
    age = int(age)
    if age <= 19: return '10대이하'
    elif age <= 29: return '20대'
    elif age <= 39: return '30대'
    elif age <= 49: return '40대'
    elif age <= 59: return '50대'
    elif age <= 69: return '60대'
    elif age <= 79: return '70대'
    else: return '80대이상'

parsed = []
for m in unique_members:
    report = m.get('report', {})
    ui = report.get('userInfo', {})
    tba = report.get('threeBodyAnalysis', {})
    sca = report.get('sevenCodeAnalysis', {})
    pm_list = report.get('postureMetrics', [])
    baa_list = report.get('bodyAlignmentAnalysis', [])
    sm_list = report.get('strengthMetrics', [])
    am_list = report.get('agingMetrics', [])
    kc = report.get('kwangmyungChakra', {})
    
    gender = (ui.get('gender') or '').strip().lower()
    age = safe_float(ui.get('age'))
    age_group = get_age_group(age)
    
    # 3Body 점수
    body_score = safe_float(tba.get('body', {}).get('score') if isinstance(tba.get('body'), dict) else tba.get('body'))
    brain_score = safe_float(tba.get('brain', {}).get('score') if isinstance(tba.get('brain'), dict) else tba.get('brain'))
    mind_score = safe_float(tba.get('mind', {}).get('score') if isinstance(tba.get('mind'), dict) else tba.get('mind'))
    
    # 7Code 점수
    code_scores = {}
    for i in range(1, 8):
        code_data = sca.get(f'code{i}', {})
        if isinstance(code_data, dict):
            code_scores[i] = safe_float(code_data.get('score'))
        else:
            code_scores[i] = safe_float(code_data)
    
    # 자세 지표
    posture_metrics = []
    for pm in pm_list:
        if isinstance(pm, dict):
            posture_metrics.append({
                'name': pm.get('name', ''),
                'status': pm.get('status', ''),
                'score': safe_float(pm.get('score'))
            })
    
    # 체형 불균형
    alignment_issues = []
    for baa in baa_list:
        if isinstance(baa, dict):
            issue = baa.get('issue', '')
            if issue:
                alignment_issues.append(issue)
    
    # bodyTypeAnalysis에서도 추출
    bta = report.get('bodyTypeAnalysis', '')
    if isinstance(bta, str):
        if '굽은' in bta or '라운드' in bta:
            if '굽은등/라운드숄더' not in alignment_issues:
                alignment_issues.append('굽은등/라운드숄더')
        if '측만' in bta or '비대칭' in bta:
            if '척추측만/비대칭' not in alignment_issues:
                alignment_issues.append('척추측만/비대칭')
    
    # 운동 능력 (strengthMetrics)
    squat_reps = None
    squat_form = None
    pushup_reps = None
    pushup_form = None
    for sm in sm_list:
        if isinstance(sm, dict):
            ex = (sm.get('exercise') or '').strip()
            if '스쿼트' in ex or 'squat' in ex.lower():
                squat_reps = safe_float(sm.get('reps'))
                squat_form = safe_float(sm.get('formScore'))
            elif '푸쉬업' in ex or '푸시업' in ex or 'pushup' in ex.lower() or 'push' in ex.lower():
                pushup_reps = safe_float(sm.get('reps'))
                pushup_form = safe_float(sm.get('formScore'))
    
    # 유연성
    flexibility = safe_float(report.get('flexibilityScore'))
    
    # 팔 올리기
    arm_raise = safe_float(report.get('armRaiseScore'))
    
    # 에너지 순환 (kwangmyungChakra.needLevel)
    energy_level = kc.get('needLevel', '')
    
    # 나이 관련 필드
    physical_age = safe_float(report.get('physicalAge'))
    brain_age = safe_float(report.get('brainAge'))
    mind_age = safe_float(report.get('mindAge'))
    face_age = safe_float(report.get('faceAgeEstimate'))
    comprehensive_age = safe_float(report.get('comprehensiveAge'))
    overall_score = safe_float(report.get('overallScore'))
    posture_score = safe_float(report.get('postureScore'))
    
    # sourceType
    source_type = (m.get('sourceType') or '').strip()
    
    parsed.append({
        'gender': gender,
        'age': age,
        'age_group': age_group,
        'body_score': body_score,
        'brain_score': brain_score,
        'mind_score': mind_score,
        'code_scores': code_scores,
        'posture_metrics': posture_metrics,
        'alignment_issues': alignment_issues,
        'squat_reps': squat_reps,
        'squat_form': squat_form,
        'pushup_reps': pushup_reps,
        'pushup_form': pushup_form,
        'flexibility': flexibility,
        'arm_raise': arm_raise,
        'energy_level': energy_level,
        'physical_age': physical_age,
        'brain_age': brain_age,
        'mind_age': mind_age,
        'face_age': face_age,
        'comprehensive_age': comprehensive_age,
        'overall_score': overall_score,
        'posture_score': posture_score,
        'source_type': source_type,
        'branch_id': m.get('branchId', ''),
        'region_id': m.get('regionId', ''),
    })

print(f"[3] 파싱 완료: {len(parsed)}명")

# ====================================================================
# 4. 종합 통계
# ====================================================================
result = {}
total = len(parsed)

# 4.1 인구통계
male = [p for p in parsed if p['gender'] in ['male', '남', '남성', 'm']]
female = [p for p in parsed if p['gender'] in ['female', '여', '여성', 'f']]
pc = [p for p in parsed if p['source_type'] in ['PC', 'pc', 'desktop']]
lite = [p for p in parsed if p['source_type'] in ['LITE', 'lite', 'online', 'Online']]

result['summary'] = {
    'total': total,
    'male': len(male),
    'female': len(female),
    'unknown_gender': total - len(male) - len(female),
    'pc_version': len(pc),
    'lite_version': len(lite),
    'other_version': total - len(pc) - len(lite),
    'analysis_date': '2026-06-17',
    'pending_excluded': pending_count,
    'test_excluded': len(has_report) - len(cleaned),
    'duplicates_removed': len(non_hq) - len(unique_members),
}

# 4.2 연령대별 성별 분포
age_order = ['10대이하', '20대', '30대', '40대', '50대', '60대', '70대', '80대이상']
age_gender = {}
for ag in age_order:
    m_count = sum(1 for p in male if p['age_group'] == ag)
    f_count = sum(1 for p in female if p['age_group'] == ag)
    t_count = sum(1 for p in parsed if p['age_group'] == ag)
    if t_count > 0:
        age_gender[ag] = {'male': m_count, 'female': f_count, 'total': t_count}
result['age_gender'] = age_gender

# 4.3 성별 3Body 평균
for label, subset in [('male', male), ('female', female)]:
    result[f'threebody_{label}'] = {
        'count': len(subset),
        'body': safe_avg([p['body_score'] for p in subset]),
        'brain': safe_avg([p['brain_score'] for p in subset]),
        'mind': safe_avg([p['mind_score'] for p in subset]),
    }

# 4.4 연령대별 3Body 평균
age_3body = {}
for ag in age_order:
    subset = [p for p in parsed if p['age_group'] == ag]
    if subset:
        age_3body[ag] = {
            'count': len(subset),
            'body': safe_avg([p['body_score'] for p in subset]),
            'brain': safe_avg([p['brain_score'] for p in subset]),
            'mind': safe_avg([p['mind_score'] for p in subset]),
        }
result['age_threebody'] = age_3body

# 4.5 성별 7Code 평균
for label, subset in [('male', male), ('female', female)]:
    codes = {}
    for i in range(1, 8):
        codes[f'C{i}'] = safe_avg([p['code_scores'].get(i) for p in subset])
    result[f'sevencode_{label}'] = codes

# 4.6 연령대별 7Code 평균
age_7code = {}
for ag in age_order:
    subset = [p for p in parsed if p['age_group'] == ag]
    if subset:
        codes = {}
        for i in range(1, 8):
            codes[f'C{i}'] = safe_avg([p['code_scores'].get(i) for p in subset])
        age_7code[ag] = codes
result['age_sevencode'] = age_7code

# 4.7 7Code 취약 코드 (개인별 최저 점수 코드)
weak_counter = Counter()
for p in parsed:
    valid_codes = {k: v for k, v in p['code_scores'].items() if v is not None}
    if valid_codes:
        min_code = min(valid_codes, key=valid_codes.get)
        weak_counter[min_code] += 1
result['weak_codes'] = dict(weak_counter)

# 4.8 자세 지표 통계
posture_stats = defaultdict(lambda: {'Good': 0, 'Fair': 0, 'Poor': 0, 'total': 0})
for p in parsed:
    for pm in p['posture_metrics']:
        name = pm['name']
        status = pm['status'].strip().capitalize()
        if status in ['Good', 'Fair', 'Poor']:
            posture_stats[name][status] += 1
            posture_stats[name]['total'] += 1

# 정규화된 5대 지표만 추출
main_posture = {}
for name, stats in posture_stats.items():
    if stats['total'] >= 100:  # 충분한 표본
        total_pm = stats['total']
        main_posture[name] = {
            'Good_pct': round(stats['Good'] / total_pm * 100, 1),
            'Fair_pct': round(stats['Fair'] / total_pm * 100, 1),
            'Poor_pct': round(stats['Poor'] / total_pm * 100, 1),
            'sample': total_pm
        }
result['posture_grades'] = main_posture

# 4.9 체형 불균형 통계
alignment_counter = Counter()
for p in parsed:
    for issue in p['alignment_issues']:
        # 정규화
        if '거북' in issue or 'FHP' in issue or '경추' in issue:
            alignment_counter['거북목(FHP)'] += 1
        elif '굽은' in issue or '라운드' in issue or '흉추' in issue:
            alignment_counter['굽은등/라운드숄더'] += 1
        elif '측만' in issue or '비대칭' in issue:
            alignment_counter['척추측만/비대칭'] += 1
        elif '골반' in issue:
            alignment_counter['골반비대칭/경사'] += 1
        elif '스웨이' in issue or 'sway' in issue.lower():
            alignment_counter['스웨이백'] += 1
        elif '전방' in issue or '전체' in issue:
            alignment_counter['전체정렬불량'] += 1
        else:
            alignment_counter[issue] += 1
result['alignment_issues'] = dict(alignment_counter)

# 4.10 에너지 순환 상태
energy_counter = Counter()
for p in parsed:
    el = p['energy_level']
    if el:
        energy_counter[el] += 1
    else:
        energy_counter['미측정'] += 1
result['energy_distribution'] = dict(energy_counter)

# 4.11 운동 능력 연령별
age_fitness = {}
for ag in age_order:
    subset = [p for p in parsed if p['age_group'] == ag]
    if subset:
        age_fitness[ag] = {
            'squat_avg_reps': safe_avg([p['squat_reps'] for p in subset]),
            'squat_avg_form': safe_avg([p['squat_form'] for p in subset]),
            'pushup_avg_reps': safe_avg([p['pushup_reps'] for p in subset]),
            'pushup_avg_form': safe_avg([p['pushup_form'] for p in subset]),
            'flexibility_avg': safe_avg([p['flexibility'] for p in subset]),
            'arm_raise_avg': safe_avg([p['arm_raise'] for p in subset]),
            'sample': len(subset)
        }
result['age_fitness'] = age_fitness

# 4.12 건강나이(연령 추정) 분석
age_aging = {}
for ag in age_order:
    subset = [p for p in parsed if p['age_group'] == ag]
    if subset:
        age_aging[ag] = {
            'physical_age_avg': safe_avg([p['physical_age'] for p in subset]),
            'brain_age_avg': safe_avg([p['brain_age'] for p in subset]),
            'mind_age_avg': safe_avg([p['mind_age'] for p in subset]),
            'face_age_avg': safe_avg([p['face_age'] for p in subset]),
            'comprehensive_age_avg': safe_avg([p['comprehensive_age'] for p in subset]),
            'overall_score_avg': safe_avg([p['overall_score'] for p in subset]),
            'actual_age_avg': safe_avg([p['age'] for p in subset]),
            'sample': len(subset)
        }
result['age_aging'] = age_aging

# 4.13 지역별/지점별 통계
region_branch = defaultdict(lambda: defaultdict(lambda: {'count': 0}))
for m in unique_members:
    bid = m.get('branchId', '')
    rid = m.get('regionId', '')
    branch_name = branches.get(bid, {}).get('name', bid or '미분류')
    region_name = regions.get(rid, {}).get('name', '')
    if not region_name and bid:
        branch_region_id = branches.get(bid, {}).get('regionId', '')
        region_name = regions.get(branch_region_id, {}).get('name', '미분류')
    if not region_name:
        region_name = '미분류'
    region_branch[region_name][branch_name]['count'] += 1

result['region_branch'] = {r: {b: dict(v) for b, v in bs.items()} for r, bs in region_branch.items()}

# 4.14 V1 대비 변화 (1955명 → 현재)
result['vs_v1'] = {
    'v1_total': 1955,
    'v2_total': total,
    'growth': total - 1955,
    'growth_pct': round((total - 1955) / 1955 * 100, 1),
}

# ====================================================================
# 5. 저장
# ====================================================================
output_path = 'health_report_v2_data.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"\n[5] 저장 완료: {output_path}")
print(f"\n{'=' * 60}")
print(f"  분석 완료 요약")
print(f"{'=' * 60}")
print(f"  고유 회원: {total}명 (V1 대비 +{total - 1955}명, {round((total-1955)/1955*100,1)}% 증가)")
print(f"  남성: {len(male)}명 ({len(male)/total*100:.1f}%)")
print(f"  여성: {len(female)}명 ({len(female)/total*100:.1f}%)")
print(f"  PC: {len(pc)}명 / LITE: {len(lite)}명 / 기타: {total-len(pc)-len(lite)}명")
print(f"  3Body 전체 평균 - 신체: {safe_avg([p['body_score'] for p in parsed])}점, 뇌: {safe_avg([p['brain_score'] for p in parsed])}점, 마음: {safe_avg([p['mind_score'] for p in parsed])}점")
print(f"{'=' * 60}")
