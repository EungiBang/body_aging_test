# 데이터 필드 구조를 정밀하게 탐색하는 스크립트
import json

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

# pending이 아닌 첫 3개 레코드의 구조를 깊이 탐색
samples = [m for m in members if not m.get('id', '').startswith('pending-')][:5]

for idx, sample in enumerate(samples):
    print(f"\n{'='*60}")
    print(f"  SAMPLE #{idx+1}: {sample.get('name', 'N/A')}")
    print(f"{'='*60}")
    
    # 최상위 키
    print(f"\n  [최상위 키]")
    for k, v in sample.items():
        if k == 'report':
            continue
        val_str = str(v)[:80] if v else 'None'
        print(f"    {k}: {val_str}")
    
    # report 내부
    report = sample.get('report', {})
    if report:
        print(f"\n  [report 키]")
        for k in report.keys():
            val = report[k]
            if isinstance(val, dict):
                print(f"    {k}: dict({list(val.keys())[:10]})")
            elif isinstance(val, list):
                print(f"    {k}: list(len={len(val)})")
            else:
                val_str = str(val)[:80]
                print(f"    {k}: {val_str}")
        
        # personalInfo 상세
        pi = report.get('personalInfo', {})
        if pi:
            print(f"\n  [report.personalInfo]")
            for k, v in pi.items():
                print(f"    {k}: {v}")
        
        # scores 상세
        scores = report.get('scores', {})
        if scores:
            print(f"\n  [report.scores]")
            for k, v in scores.items():
                print(f"    {k}: {v}")
        
        # sevenCode 상세
        for code_key in ['sevenCode', 'sevenCodes', 'code', 'codes']:
            sc = report.get(code_key, {})
            if sc:
                print(f"\n  [report.{code_key}]")
                for k, v in sc.items():
                    print(f"    {k}: {v}")
                break
        
        # posture
        for pos_key in ['posture', 'postureAnalysis', 'bodyAlignment']:
            pos = report.get(pos_key, {})
            if pos:
                print(f"\n  [report.{pos_key}] (키만)")
                for k in list(pos.keys())[:15]:
                    val = pos[k]
                    if isinstance(val, dict):
                        print(f"    {k}: dict({list(val.keys())[:8]})")
                    else:
                        print(f"    {k}: {str(val)[:60]}")
                break
        
        # fitness/exercise
        for fit_key in ['fitness', 'exercise', 'physicalTest']:
            fit = report.get(fit_key, {})
            if fit:
                print(f"\n  [report.{fit_key}]")
                for k, v in fit.items():
                    print(f"    {k}: {v}")
                break
        
        # brain
        for br_key in ['brainTest', 'brain', 'cognition']:
            br = report.get(br_key, {})
            if br:
                print(f"\n  [report.{br_key}]")
                for k, v in br.items():
                    val_str = str(v)[:60]
                    print(f"    {k}: {val_str}")
                break
        
        # energy
        for en_key in ['energy', 'energyFlow', 'energyBalance']:
            en = report.get(en_key, {})
            if en:
                print(f"\n  [report.{en_key}]")
                for k, v in en.items():
                    val_str = str(v)[:60]
                    print(f"    {k}: {val_str}")
                break
    
    if idx >= 2:
        break
