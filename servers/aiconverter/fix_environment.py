#!/usr/bin/env python3
"""
环境修复脚本
用于检查和修复 aiconverter 的运行环境
"""

import subprocess
import sys
import os
import importlib

def check_package(package_name, import_name=None):
    """检查包是否已安装"""
    if import_name is None:
        import_name = package_name
    try:
        importlib.import_module(import_name)
        return True
    except ImportError:
        return False

def get_package_version(package_name):
    """获取包版本"""
    try:
        module = importlib.import_module(package_name)
        return getattr(module, '__version__', 'unknown')
    except:
        return None

def run_command(cmd, check=True):
    """运行命令"""
    print(f"执行: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"错误: {result.stderr}")
        return False
    if result.stdout:
        print(result.stdout)
    return True

def main():
    print("=" * 60)
    print("AI Converter 环境修复脚本")
    print("=" * 60)
    print()
    
    # 检查 Python 版本
    python_version = sys.version_info
    print(f"Python 版本: {python_version.major}.{python_version.minor}.{python_version.micro}")
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("警告: 建议使用 Python 3.8 或更高版本")
    print()
    
    # 检查关键包
    packages_to_check = {
        'numpy': 'numpy',
        'torch': 'torch',
        'PIL': 'PIL',
        'cv2': 'cv2',
        'fastapi': 'fastapi',
        'uvicorn': 'uvicorn',
        'segment_anything': 'segment_anything',
    }
    
    print("检查已安装的包...")
    print("-" * 60)
    missing_packages = []
    for package_name, import_name in packages_to_check.items():
        installed = check_package(package_name, import_name)
        if installed:
            version = get_package_version(import_name)
            print(f"✓ {package_name}: {version if version else '已安装'}")
        else:
            print(f"✗ {package_name}: 未安装")
            missing_packages.append(package_name)
    print()
    
    # 检查 NumPy 和 PyTorch 版本兼容性
    print("检查版本兼容性...")
    print("-" * 60)
    numpy_version = get_package_version('numpy')
    torch_version = get_package_version('torch')
    
    if numpy_version and torch_version:
        print(f"NumPy 版本: {numpy_version}")
        print(f"PyTorch 版本: {torch_version}")
        
        # 检查 NumPy 版本
        if numpy_version.startswith('2.'):
            print("警告: NumPy 2.x 可能与 PyTorch 存在兼容性问题")
            print("建议降级到 NumPy 1.26.4")
        elif '1.26' in numpy_version:
            print("✓ NumPy 版本兼容")
        elif '1.24' in numpy_version or '1.25' in numpy_version:
            print("⚠ NumPy 版本可能存在问题，建议升级到 1.26.4")
        print()
    
    # 如果缺少包或版本不兼容，询问是否安装/修复
    if missing_packages or (numpy_version and '1.26' not in numpy_version and not numpy_version.startswith('2.')):
        print("=" * 60)
        response = input("检测到问题，是否自动修复？(y/n): ").strip().lower()
        if response == 'y':
            print()
            print("开始修复环境...")
            print("-" * 60)
            
            # 先升级 pip
            print("升级 pip...")
            run_command(f"{sys.executable} -m pip install --upgrade pip", check=False)
            
            # 安装/更新 requirements.txt 中的包
            requirements_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
            if os.path.exists(requirements_file):
                print("\n安装依赖包...")
                # 先卸载可能有问题的 numpy 和 torch
                if numpy_version and '1.26' not in numpy_version:
                    print("卸载旧版本 NumPy...")
                    run_command(f"{sys.executable} -m pip uninstall -y numpy", check=False)
                
                # 安装 requirements.txt
                print("从 requirements.txt 安装...")
                # 跳过 SAM，因为它需要从 GitHub 安装
                with open(requirements_file, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            # 跳过 SAM 相关注释
                            if 'segment-anything' in line.lower() or 'SAM' in line:
                                continue
                            print(f"安装: {line}")
                            run_command(f"{sys.executable} -m pip install {line}", check=False)
                
                # 安装 SAM（如果未安装）
                if not check_package('segment_anything', 'segment_anything'):
                    print("\n安装 Segment Anything Model...")
                    print("尝试从 GitHub 安装...")
                    if not run_command(f"{sys.executable} -m pip install git+https://github.com/facebookresearch/segment-anything.git", check=False):
                        print("GitHub 安装失败，尝试从 PyPI 安装...")
                        run_command(f"{sys.executable} -m pip install segment-anything-py", check=False)
            
            print()
            print("=" * 60)
            print("修复完成！请重新运行此脚本检查结果。")
            print("=" * 60)
        else:
            print("跳过自动修复。")
    else:
        print()
        print("=" * 60)
        print("✓ 环境检查通过！所有依赖已正确安装。")
        print("=" * 60)
    
    # 测试关键功能
    print()
    print("测试关键功能...")
    print("-" * 60)
    
    # 测试 NumPy -> PyTorch 转换
    try:
        import numpy as np
        import torch
        test_array = np.array([1, 2, 3], dtype=np.uint8)
        test_tensor = torch.from_numpy(test_array)
        print(f"✓ NumPy -> PyTorch 转换测试通过")
        print(f"  测试数组: {test_array}, dtype={test_array.dtype}")
        print(f"  转换后 tensor: {test_tensor}, dtype={test_tensor.dtype}")
    except Exception as e:
        print(f"✗ NumPy -> PyTorch 转换测试失败: {e}")
        print("  这可能是版本兼容性问题，请检查 NumPy 和 PyTorch 版本")
    
    # 测试 SAM 导入
    try:
        from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
        print("✓ SAM 模块导入成功")
    except Exception as e:
        print(f"✗ SAM 模块导入失败: {e}")
        print("  请确保已安装 segment-anything")

if __name__ == '__main__':
    main()

