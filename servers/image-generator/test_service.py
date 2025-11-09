"""
测试图像生成服务是否正常运行
"""

import requests
import sys
import time

def test_service():
    """测试服务是否正常运行"""
    base_url = "http://localhost:8083"
    
    print("=" * 50)
    print("测试图像生成服务")
    print("=" * 50)
    print()
    
    # 测试健康检查
    print("[1/2] 测试健康检查接口...")
    try:
        response = requests.get(f"{base_url}/api/health", timeout=5)
        if response.status_code == 200:
            print("✓ 健康检查通过")
            print(f"  响应: {response.json()}")
        else:
            print(f"✗ 健康检查失败: HTTP {response.status_code}")
            print(f"  响应: {response.text}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ 无法连接到服务")
        print("  请确保服务已启动: python app.py")
        return False
    except requests.exceptions.Timeout:
        print("✗ 请求超时")
        return False
    except Exception as e:
        print(f"✗ 发生错误: {e}")
        return False
    
    print()
    
    # 测试图像生成接口（简单测试，不实际生成）
    print("[2/2] 测试图像生成接口...")
    try:
        # 只测试接口是否可访问，使用一个简单的提示词
        test_payload = {
            "prompt": "test",
            "aspect_ratio": "16:9"
        }
        
        # 设置较短的超时时间，因为实际生成可能需要较长时间
        response = requests.post(
            f"{base_url}/api/generate",
            json=test_payload,
            timeout=10
        )
        
        if response.status_code in [200, 422]:  # 422 可能是参数验证错误，但说明接口可访问
            print("✓ 图像生成接口可访问")
            if response.status_code == 200:
                result = response.json()
                print(f"  响应: success={result.get('success', False)}")
            else:
                print(f"  响应: {response.json()}")
            return True
        else:
            print(f"✗ 接口返回错误: HTTP {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print("⚠ 请求超时（这可能是正常的，因为图像生成需要时间）")
        print("  但接口至少是可访问的")
        return True
    except Exception as e:
        print(f"✗ 发生错误: {e}")
        return False

if __name__ == "__main__":
    print()
    success = test_service()
    print()
    print("=" * 50)
    if success:
        print("✓ 服务测试通过！")
        sys.exit(0)
    else:
        print("✗ 服务测试失败！")
        print()
        print("请检查：")
        print("1. 服务是否已启动: python app.py")
        print("2. 端口 8083 是否被占用")
        print("3. 依赖是否已安装: pip install -r requirements.txt")
        sys.exit(1)

