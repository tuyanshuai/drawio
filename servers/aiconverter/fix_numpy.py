#!/usr/bin/env python3
"""
专门修复 NumPy 版本问题的脚本
处理代理问题和版本兼容性
"""

import subprocess
import sys
import os

def run_command(cmd, check=True):
    """运行命令"""
    print(f"执行: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"错误: {result.stderr}")
        return False
    if result.stdout:
        print(result.stdout)
    return result.returncode == 0

def main():
    print("=" * 60)
    print("NumPy 版本修复脚本")
    print("=" * 60)
    print()
    
    # 尝试多种方法安装 NumPy 1.26.4
    methods = [
        # 方法 1: 直接安装（使用默认源）
        (f"{sys.executable} -m pip install numpy==1.26.4 --no-cache-dir", "方法1: 默认源"),
        # 方法 2: 使用清华镜像
        (f"{sys.executable} -m pip install numpy==1.26.4 -i https://pypi.tuna.tsinghua.edu.cn/simple --no-cache-dir", "方法2: 清华镜像"),
        # 方法 3: 使用阿里云镜像
        (f"{sys.executable} -m pip install numpy==1.26.4 -i https://mirrors.aliyun.com/pypi/simple/ --no-cache-dir", "方法3: 阿里云镜像"),
        # 方法 4: 使用豆瓣镜像
        (f"{sys.executable} -m pip install numpy==1.26.4 -i https://pypi.douban.com/simple/ --no-cache-dir", "方法4: 豆瓣镜像"),
        # 方法 5: 使用官方源并禁用代理
        (f"{sys.executable} -m pip install numpy==1.26.4 --index-url https://pypi.org/simple/ --no-cache-dir", "方法5: 官方源"),
    ]
    
    print("尝试安装 NumPy 1.26.4...")
    print("-" * 60)
    
    success = False
    for cmd, method_name in methods:
        print(f"\n{method_name}...")
        # 临时清除代理环境变量
        env = os.environ.copy()
        env.pop('HTTP_PROXY', None)
        env.pop('HTTPS_PROXY', None)
        env.pop('http_proxy', None)
        env.pop('https_proxy', None)
        
        result = subprocess.run(cmd, shell=True, env=env, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {method_name} 成功！")
            success = True
            break
        else:
            print(f"✗ {method_name} 失败")
            if result.stderr:
                # 只显示关键错误
                if "ProxyError" not in result.stderr and "timeout" not in result.stderr.lower():
                    print(f"  错误: {result.stderr[:200]}")
    
    if not success:
        print("\n" + "=" * 60)
        print("所有方法都失败了。")
        print("=" * 60)
        print("\n建议手动操作：")
        print("1. 检查网络连接")
        print("2. 清除代理设置：")
        print("   python -m pip config unset global.proxy")
        print("3. 手动下载并安装：")
        print("   - 访问 https://pypi.org/project/numpy/1.26.4/#files")
        print("   - 下载适合您系统的 wheel 文件")
        print("   - 运行: pip install 下载的文件.whl")
        print("\n或者尝试安装其他兼容版本：")
        print("   pip install 'numpy<2.0' --upgrade")
        return False
    
    # 验证安装
    print("\n验证安装...")
    print("-" * 60)
    try:
        import numpy as np
        print(f"✓ NumPy {np.__version__} 安装成功")
        
        # 测试 PyTorch 兼容性
        try:
            import torch
            test_array = np.array([1, 2, 3], dtype=np.uint8)
            test_tensor = torch.from_numpy(test_array)
            print(f"✓ NumPy -> PyTorch 转换测试通过")
            return True
        except Exception as e:
            print(f"⚠ NumPy -> PyTorch 转换测试失败: {e}")
            print("可能需要重新安装 PyTorch")
            return False
    except ImportError as e:
        print(f"✗ NumPy 导入失败: {e}")
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

