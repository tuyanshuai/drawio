import requests
import json

files = {'file': ('test.png', open('test_curl.png', 'rb'), 'image/png')}
r = requests.post('http://127.0.0.1:8081/api/segment', files=files, params={'threshold': 0.5, 'min_area': 100})
result = r.json()

print("=" * 60)
print("检查颜色信息返回情况")
print("=" * 60)
print(f"总区域数: {result['segment_count']}")
print()

for seg in result['segments']:
    fill = seg.get('fill', {})
    print(f"区域 {seg['id']}:")
    print(f"  - fill 字段存在: {'fill' in seg}")
    if 'fill' in seg:
        print(f"  - color (RGB字符串): {fill.get('color', '缺失')}")
        print(f"  - rgb (数组): {fill.get('rgb', '缺失')}")
        print(f"  - hex (十六进制): {fill.get('hex', '缺失')}")
        print(f"  - rgba (数组+透明度): {fill.get('rgba', '缺失')}")
    else:
        print(f"  ✗ 缺少 fill 字段!")
    print()

