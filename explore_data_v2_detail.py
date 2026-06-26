# report 내부 세부 구조 탐색 (userInfo, threeBodyAnalysis, sevenCodeAnalysis, postureMetrics 등)
import json

with open('cleaned_members_v2.json', 'r', encoding='utf-8') as f:
    members = json.load(f)

samples = [m for m in members if not m.get('id', '').startswith('pending-')][:5]

for idx, sample in enumerate(samples):
    report = sample.get('report', {})
    print(f"\n{'='*60}")
    print(f"SAMPLE #{idx+1}: id={sample.get('id','')[:20]}")
    
    # userInfo 상세
    ui = report.get('userInfo', {})
    print(f"\n  [userInfo]")
    for k, v in ui.items():
        print(f"    {k}: {v}")
    
    # threeBodyAnalysis 상세
    tba = report.get('threeBodyAnalysis', {})
    print(f"\n  [threeBodyAnalysis]")
    for k, v in tba.items():
        if isinstance(v, dict):
            print(f"    {k}: {json.dumps(v, ensure_ascii=False)[:100]}")
        else:
            print(f"    {k}: {v}")
    
    # sevenCodeAnalysis 상세
    sca = report.get('sevenCodeAnalysis', {})
    print(f"\n  [sevenCodeAnalysis]")
    for k, v in sca.items():
        if isinstance(v, dict):
            print(f"    {k}: {json.dumps(v, ensure_ascii=False)[:120]}")
        else:
            print(f"    {k}: {v}")
    
    # postureMetrics
    pm = report.get('postureMetrics', [])
    print(f"\n  [postureMetrics] (len={len(pm)})")
    for item in pm[:5]:
        print(f"    {json.dumps(item, ensure_ascii=False)[:120]}")
    
    # bodyAlignmentAnalysis
    baa = report.get('bodyAlignmentAnalysis', [])
    print(f"\n  [bodyAlignmentAnalysis] (len={len(baa)})")
    for item in baa[:3]:
        print(f"    {json.dumps(item, ensure_ascii=False)[:120]}")
    
    # strengthMetrics
    sm = report.get('strengthMetrics', [])
    print(f"\n  [strengthMetrics] (len={len(sm)})")
    for item in sm[:3]:
        print(f"    {json.dumps(item, ensure_ascii=False)[:120]}")
    
    # agingMetrics
    am = report.get('agingMetrics', [])
    print(f"\n  [agingMetrics] (len={len(am)})")
    for item in am[:3]:
        print(f"    {json.dumps(item, ensure_ascii=False)[:120]}")
    
    # kwangmyungChakra
    kc = report.get('kwangmyungChakra', {})
    print(f"\n  [kwangmyungChakra]")
    for k, v in kc.items():
        print(f"    {k}: {str(v)[:80]}")
    
    # 나이 관련 필드들
    print(f"\n  [나이 관련 필드]")
    for key in ['physicalAge', 'brainAge', 'mindAge', 'faceAgeEstimate', 'comprehensiveAge', 'overallScore', 'postureScore', 'flexibilityScore', 'armRaiseScore']:
        val = report.get(key)
        if val is not None:
            print(f"    {key}: {val}")
    
    if idx >= 2:
        break
