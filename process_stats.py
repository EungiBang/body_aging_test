import json

with open('firebase_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

regions = data['regions']
branches = data['branches']
devices = data['devices']

# First mapping from branchId to region name
branch_to_region = {}
for branch_id, branch_info in branches.items():
    region_id = branch_info.get('regionId')
    region_name = regions.get(region_id, {}).get('name', 'Unknown')
    branch_to_region[branch_id] = region_name

# Now mapping from branchId to branch name
branch_names = {}
for branch_id, branch_info in branches.items():
    branch_names[branch_id] = branch_info.get('name', 'Unknown')

# Now count devices per branch
branch_device_counts = {}
for device in devices:
    branch_id = device.get('branchId')
    if branch_id:
        branch_device_counts[branch_id] = branch_device_counts.get(branch_id, 0) + 1

# Aggregate by region
region_stats = {}
total_branches_installed = 0
total_devices = 0

for branch_id, count in branch_device_counts.items():
    region_name = branch_to_region.get(branch_id, 'Unknown')
    if region_name not in region_stats:
        region_stats[region_name] = {'branches': [], 'total_devices': 0}
    
    region_stats[region_name]['branches'].append({
        'name': branch_names.get(branch_id, 'Unknown'),
        'count': count
    })
    region_stats[region_name]['total_devices'] += count
    total_branches_installed += 1
    total_devices += count

# Sort and output
output_lines = []
output_lines.append(f"총 설치 지점 수: {total_branches_installed}개 지점")
output_lines.append(f"총 등록 기기 수: {total_devices}대")
output_lines.append("-" * 40)

# Create a summary table for markdown
md_table = []
md_table.append("| 지역 | 설치 지점 수 | 등록 기기 수 |")
md_table.append("|---|---|---|")

for region in sorted(region_stats.keys()):
    stats = region_stats[region]
    b_count = len(stats['branches'])
    d_count = stats['total_devices']
    
    md_table.append(f"| {region} | {b_count}개 | {d_count}대 |")
    
    output_lines.append(f"📍 {region}: {b_count}개 지점 (기기 {d_count}대)")
    
    # Sort branches by name
    sorted_branches = sorted(stats['branches'], key=lambda x: x['name'])
    for b in sorted_branches:
        output_lines.append(f"   - {b['name']}: {b['count']}대")
    output_lines.append("")

with open('device_install_stats.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(output_lines))

with open('device_install_table.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(md_table))

print("Stats written to device_install_stats.txt and device_install_table.md")
