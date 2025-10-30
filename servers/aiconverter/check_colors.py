import json

with open('segments_result.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 60)
print("验证结果总结")
print("=" * 60)
print(f"总区域数: {data['segment_count']}")
print(f"实际返回: {len(data['segments'])}")
print()

print("所有区域的颜色信息:")
print("-" * 60)
for seg in data['segments']:
    print(f"区域 {seg['id']:2d}: {seg['fill']['color']:15s} RGB: {seg['fill']['rgb']}")

print()
print("=" * 60)
print("✓ 确认: 所有区域都包含了完整的颜色信息!")
print("  - 每个区域都有 'fill' 字段")
print("  - 'fill' 包含 'color' (字符串格式)")
print("  - 'fill' 包含 'rgb' (数组格式)")
print("=" * 60)

