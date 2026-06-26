import json
with open('health_report_v2_data.json','r',encoding='utf-8') as f:
    d = json.load(f)
print('=== ENERGY ===')
print(json.dumps(d.get('energy_distribution',{}), ensure_ascii=False))
print()
print('=== WEAK CODES ===')
print(json.dumps(d.get('weak_codes',{}), ensure_ascii=False))
print()
print('=== FITNESS by AGE ===')
for ag in ['10대이하','20대','30대','40대','50대','60대','70대','80대이상']:
    fit = d.get('age_fitness',{}).get(ag,{})
    if fit:
        print(ag, json.dumps(fit, ensure_ascii=False))
print()
print('=== AGING by AGE ===')
for ag in ['10대이하','20대','30대','40대','50대','60대','70대','80대이상']:
    aging = d.get('age_aging',{}).get(ag,{})
    if aging:
        print(ag, json.dumps(aging, ensure_ascii=False))
print()
print('=== POSTURE GRADES ===')
for k, v in d.get('posture_grades',{}).items():
    print(k, json.dumps(v, ensure_ascii=False))
