import requests
import json

files = {'file': ('test.png', open('test_curl.png', 'rb'), 'image/png')}
r = requests.post('http://127.0.0.1:8081/api/segment', files=files, params={'threshold': 0.3, 'min_area': 50})
result = r.json()

print("=" * 60)
print("验证区域排序（按面积从大到小）")
print("=" * 60)
print(f"总区域数: {result['segment_count']}\n")

print("区域排序情况:")
print("-" * 60)
for i, seg in enumerate(result['segments']):
    print(f"排序位置 {i}: 区域ID={seg['id']}, 面积={seg['area']}, 颜色={seg['fill']['color']}")

print("\n" + "=" * 60)
# 验证是否按面积从大到小排序
areas = [seg['area'] for seg in result['segments']]
is_sorted = all(areas[i] >= areas[i+1] for i in range(len(areas)-1))
if is_sorted:
    print("✓ 验证通过: 区域已按面积从大到小排序")
else:
    print("✗ 验证失败: 区域未正确排序")
print("=" * 60)


