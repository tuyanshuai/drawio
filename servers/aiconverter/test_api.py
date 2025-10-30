"""
测试 AI Converter API
"""

import requests
import numpy as np
from PIL import Image
import io
import base64

def create_test_image():
    """创建一个简单的测试图片"""
    # 创建一个 200x200 的彩色图片
    img = Image.new('RGB', (200, 200), color='white')
    pixels = np.array(img)
    
    # 添加一些彩色矩形
    # 红色矩形
    pixels[20:80, 20:80] = [255, 0, 0]
    # 绿色矩形
    pixels[20:80, 120:180] = [0, 255, 0]
    # 蓝色矩形
    pixels[120:180, 20:80] = [0, 0, 255]
    # 黄色矩形
    pixels[120:180, 120:180] = [255, 255, 0]
    
    img = Image.fromarray(pixels)
    
    # 保存到内存
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes

def test_api():
    """测试 API 接口"""
    url = "http://127.0.0.1:8081/api/segment"
    
    print("=" * 50)
    print("测试 AI Converter API")
    print("=" * 50)
    
    # 1. 测试健康检查
    print("\n1. 测试健康检查接口...")
    try:
        response = requests.get("http://127.0.0.1:8081/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
    except Exception as e:
        print(f"错误: {e}")
        return
    
    # 2. 创建测试图片
    print("\n2. 创建测试图片...")
    test_image = create_test_image()
    print("✓ 测试图片已创建 (200x200 PNG)")
    
    # 3. 测试分割接口（不带可视化）
    print("\n3. 测试图像分割接口（不带可视化）...")
    try:
        files = {'file': ('test.png', test_image, 'image/png')}
        params = {'threshold': 0.5, 'min_area': 100}
        
        print(f"发送请求到: {url}")
        print(f"参数: {params}")
        
        response = requests.post(url, files=files, params=params)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 成功!")
            print(f"图片尺寸: {result['image_size']['width']}x{result['image_size']['height']}")
            print(f"分割区域数量: {result['segment_count']}")
            print(f"参数: {result['parameters']}")
            
            if result['segments']:
                print(f"\n前3个分割区域:")
                for i, segment in enumerate(result['segments'][:3]):
                    print(f"  区域 {i}:")
                    print(f"    - ID: {segment['id']}")
                    print(f"    - 点数: {len(segment['points'])}")
                    print(f"    - 面积: {segment['area']}")
                    print(f"    - 置信度: {segment['confidence']:.2f}")
                    print(f"    - 填充颜色: {segment['fill']['color']}")
                    print(f"    - 边界框: {segment['bbox']}")
        else:
            print(f"✗ 错误!")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        import traceback
        traceback.print_exc()
    
    # 4. 测试分割接口（带可视化）
    print("\n4. 测试图像分割接口（带可视化）...")
    try:
        test_image.seek(0)  # 重置文件指针
        files = {'file': ('test.png', test_image, 'image/png')}
        params = {'threshold': 0.5, 'min_area': 100, 'return_image': True}
        
        print(f"发送请求到: {url}")
        print(f"参数: {params}")
        
        response = requests.post(url, files=files, params=params)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 成功!")
            print(f"图片尺寸: {result['image_size']['width']}x{result['image_size']['height']}")
            print(f"分割区域数量: {result['segment_count']}")
            print(f"参数: {result['parameters']}")
            
            # 检查是否有可视化图片
            if 'visualization' in result:
                print(f"\n✓ 已返回可视化图片 (base64 编码)")
                vis_data = result['visualization']
                print(f"  数据长度: {len(vis_data)} 字符")
                print(f"  数据前缀: {vis_data[:50]}...")
                
                # 保存可视化图片
                try:
                    img_data = base64.b64decode(vis_data.split(',')[1])
                    vis_img = Image.open(io.BytesIO(img_data))
                    vis_img.save('test_visualization.png')
                    print(f"  ✓ 可视化图片已保存到: test_visualization.png")
                    print(f"  图片尺寸: {vis_img.size[0]}x{vis_img.size[1]}")
                except Exception as e:
                    print(f"  ⚠ 保存可视化图片失败: {e}")
            else:
                print(f"\n⚠ 未返回可视化图片（检查 return_image 参数）")
            
            if result['segments']:
                print(f"\n前3个分割区域:")
                for i, segment in enumerate(result['segments'][:3]):
                    print(f"  区域 {i}:")
                    print(f"    - ID: {segment['id']}")
                    print(f"    - 点数: {len(segment['points'])}")
                    print(f"    - 面积: {segment['area']}")
                    print(f"    - 置信度: {segment['confidence']:.2f}")
                    print(f"    - 填充颜色: {segment['fill']['color']}")
                    print(f"    - 边界框: {segment['bbox']}")
        else:
            print(f"✗ 错误!")
            print(f"响应内容: {response.text}")
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_api()
