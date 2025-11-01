@echo off
chcp 65001 >nul
echo ========================================
echo AI Converter 环境修复脚本
echo ========================================
echo.

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python 3.8 或更高版本
    pause
    exit /b 1
)

echo 检测到 Python 版本:
python --version
echo.

echo 开始修复环境...
echo.

REM 升级 pip
echo [1/4] 升级 pip...
python -m pip install --upgrade pip
echo.

REM 卸载可能有问题的旧版本
echo [2/4] 卸载可能冲突的包...
python -m pip uninstall -y numpy torch torchvision 2>nul
echo.

REM 安装 requirements.txt 中的包（排除 SAM）
echo [3/4] 安装依赖包...
python -m pip install fastapi==0.104.1
python -m pip install uvicorn[standard]==0.24.0
python -m pip install python-multipart==0.0.6
python -m pip install pillow==10.1.0
python -m pip install numpy==1.26.4
python -m pip install opencv-python==4.8.1.78
python -m pip install torch==2.1.2 torchvision==0.16.2
echo.

REM 安装 SAM
echo [4/4] 安装 Segment Anything Model...
echo 尝试从 GitHub 安装...
python -m pip install git+https://github.com/facebookresearch/segment-anything.git
if errorlevel 1 (
    echo GitHub 安装失败，尝试从 PyPI 安装...
    python -m pip install segment-anything-py
)
echo.

echo ========================================
echo 修复完成！
echo ========================================
echo.
echo 运行环境检查脚本以验证安装:
echo python fix_environment.py
echo.
pause

