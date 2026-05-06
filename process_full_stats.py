import json

with open('firebase_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

regions = data['regions']
branches = data['branches']
devices = data['devices']

# Initialize region stats based on all regions and branches
region_stats = {}

for branch_id, branch_info in branches.items():
    region_id = branch_info.get('regionId')
    region_name = regions.get(region_id, {}).get('name', 'Unknown')
    branch_name = branch_info.get('name', 'Unknown')
    
    if region_name not in region_stats:
        region_stats[region_name] = {
            'total_branches_count': 0,
            'installed_branches_count': 0,
            'not_installed_branches_count': 0,
            'total_devices': 0,
            'installed_branches': [],
            'not_installed_branches': []
        }
    
    region_stats[region_name]['total_branches_count'] += 1
    # Store temporary branch structure to be updated with device counts
    region_stats[region_name]['installed_branches'].append({
        'id': branch_id,
        'name': branch_name,
        'count': 0
    })

# Count devices
for device in devices:
    branch_id = device.get('branchId')
    if not branch_id: continue
    
    # Find the branch and update counts
    for r_name, r_stat in region_stats.items():
        for b in r_stat['installed_branches']:
            if b['id'] == branch_id:
                b['count'] += 1
                r_stat['total_devices'] += 1

# Separate installed and not installed
for r_name, r_stat in region_stats.items():
    all_branches = r_stat['installed_branches']
    installed = [b for b in all_branches if b['count'] > 0]
    not_installed = [b for b in all_branches if b['count'] == 0]
    
    # Sort alphabetically
    installed.sort(key=lambda x: x['name'])
    not_installed.sort(key=lambda x: x['name'])
    
    r_stat['installed_branches'] = installed
    r_stat['not_installed_branches'] = not_installed
    r_stat['installed_branches_count'] = len(installed)
    r_stat['not_installed_branches_count'] = len(not_installed)

# Summary
total_b = len(branches)
installed_b = sum(r['installed_branches_count'] for r in region_stats.values())
not_installed_b = total_b - installed_b
total_d = sum(r['total_devices'] for r in region_stats.values())

# Generate MD table
md_table = []
md_table.append(f"### 전체 130개 지점 설치 현황 요약")
md_table.append(f"- **전체 지점**: {total_b}개")
md_table.append(f"- **설치 완료 지점**: {installed_b}개 (설치율: {installed_b/total_b*100:.1f}%)")
md_table.append(f"- **미설치 지점**: {not_installed_b}개")
md_table.append(f"- **총 등록 기기**: {total_d}대")
md_table.append("")
md_table.append("| 지역명 | 전체 지점 | 설치 완료 | 미설치 | 설치율 | 등록 기기 수 | 미설치 지점명 |")
md_table.append("|---|:---:|:---:|:---:|:---:|:---:|---|")

for r_name in sorted(region_stats.keys()):
    r = region_stats[r_name]
    total = r['total_branches_count']
    inst = r['installed_branches_count']
    not_inst = r['not_installed_branches_count']
    devs = r['total_devices']
    ratio = (inst / total * 100) if total > 0 else 0
    
    not_inst_names = ", ".join([b['name'] for b in r['not_installed_branches']])
    if not not_inst_names:
        not_inst_names = "-"
        
    md_table.append(f"| **{r_name}** | {total} | {inst} | {not_inst} | {ratio:.1f}% | {devs} | <span style='font-size:0.85em; color:gray'>{not_inst_names}</span> |")

with open('device_install_full_table.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(md_table))

print("Done. Saved to device_install_full_table.md")
