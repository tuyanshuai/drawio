"""
验证所有区域和颜色是否正确返回
"""

import requests
import json
from PIL import Image
import numpy as np
import io

def create_test_image():
    """创建一个包含多个彩色区域的测试图片"""
    img = Image.new('RGB', (200, 200), color='white')
    pixels = np.array(img)
    
    # 添加多个彩色矩形
    pixels[20:80, 20:80] = [255, 0, 0]      # 红色
    pixels[20:80, 120:180] = [0, 255, 0]    # 绿色
    pixels[120:180, 20:80] = [0, 0, 255]    # 蓝色
    pixels[120:180, 120:180] = [255, 255, 0] # 黄色
    
    img = Image.fromarray(pixels)
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes

def verify_segments():
    """验证所有区域和颜色"""
    print("=" * 60)
    print("验证所有区域和颜色是否正确返回")
    print("=" * 60)
    
    # 创建测试图片
    test_image = create_test_image()
    
    # 发送请求
    print("\n1. 发送分割请求...")
    files = {'file': ('test.png', test_image, 'image/png')}
    params = {'threshold': 0.3, 'min_area': 50}  # 降低阈值以获取更多区域
    
    try:
        response = requests.post(
            'http://127.0.0.1:8081/api/segment',
            files=files,
            params=params
        )
        
        if response.status_code != 200:
            print(f"✗ 请求失败: {response.status_code}")
            print(response.text)
            return
        
        result = response.json()
        
        print(f"✓ 请求成功")
        print(f"\n2. 检查返回的数据结构...")
        print(f"   - success: {result.get('success')}")
        print(f"   - segment_count: {result.get('segment_count')}")
        print(f"   - 实际 segments 数量: {len(result.get('segments', []))}")
        
        segments = result.get('segments', [])
        
        if len(segments) == 0:
            print("\n⚠ 警告: 没有返回任何区域!")
            return
        
        print(f"\n3. 验证所有区域的完整性...")
        print(f"   总共找到 {len(segments)} 个区域\n")
        
        # 检查每个区域
        all_complete = True
        required_fields = ['id', 'points', 'fill', 'area', 'confidence', 'bbox']
        fill_required_fields = ['color', 'rgb']
        
        for i, segment in enumerate(segments):
            print(f"区域 {i} (ID: {segment.get('id', 'N/A')}):")
            
            # 检查必需字段
            missing_fields = []
            for field in required_fields:
                if field not in segment:
                    missing_fields.append(field)
                    all_complete = False
            
            if missing_fields:
                print(f"  ✗ 缺少字段: {missing_fields}")
            else:
                print(f"  ✓ 所有必需字段存在")
            
            # 检查 fill 字段
            if 'fill' in segment:
                fill = segment['fill']
                missing_fill_fields = []
                for field in fill_required_fields:
                    if field not in fill:
                        missing_fill_fields.append(field)
                        all_complete = False
                
                if missing_fill_fields:
                    print(f"  ✗ fill 缺少字段: {missing_fill_fields}")
                else:
                    print(f"  ✓ fill 字段完整")
                    print(f"    - color: {fill['color']}")
                    print(f"    - rgb: {fill['rgb']}")
            
            # 显示详细信息
            print(f"  - 点数: {len(segment.get('points', []))}")
            print(f"  - 面积: {segment.get('area', 'N/A')}")
            print(f"  - 置信度: {segment.get('confidence', 'N/A'):.2f}")
            print(f"  - 边界框: {segment.get('bbox', 'N/A')}")
            
            # 验证颜色格式
            if 'fill' in segment and 'rgb' in segment['fill']:
                rgb = segment['fill']['rgb']
                if len(rgb) != 3:
                    print(f"  ✗ RGB 格式错误: 应该有3个值，实际有{len(rgb)}个")
                    all_complete = False
                elif not all(0 <= c <= 255 for c in rgb):
                    print(f"  ✗ RGB 值超出范围: {rgb}")
                    all_complete = False
                else:
                    print(f"  ✓ RGB 值有效: {rgb}")
            
            print()
        
        # 验证区域数量一致性
        if result.get('segment_count') != len(segments):
            print(f"⚠ 警告: segment_count ({result.get('segment_count')}) 与 segments 长度 ({len(segments)}) 不一致!")
            all_complete = False
        else:
            print(f"✓ segment_count 与 segments 数量一致")
        
        # 总结
        print("\n" + "=" * 60)
        if all_complete:
            print("✓ 所有区域和颜色信息完整返回!")
        else:
            print("✗ 部分区域或颜色信息缺失!")
        print("=" * 60)
        
        # 保存完整结果到文件
        with open('segments_result.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n完整结果已保存到: segments_result.json")
        
    except Exception as e:
        print(f"✗ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_segments()

