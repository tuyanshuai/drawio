@echo off
chcp 65001 >nul
echo =========================================
echo   启动图像生成服务
echo =========================================
echo.

REM 获取脚本所在目录
cd /d %~dp0

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

REM 检查是否已安装依赖
if not exist "venv\" (
    echo 正在创建虚拟环境...
    python -m venv venv
    if errorlevel 1 (
        echo 错误: 创建虚拟环境失败
        pause
        exit /b 1
    )
)

REM 激活虚拟环境（如果存在）
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM 检查并安装依赖
echo 正在检查依赖...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo 错误: 安装依赖失败
        echo 请手动运行: pip install -r requirements.txt
        pause
        exit /b 1
    )
    echo ✓ 依赖安装完成
) else (
    echo ✓ 依赖已安装
)

echo.
echo 正在启动图像生成服务 (端口 8083)...
echo 服务地址: http://localhost:8083
echo 按 Ctrl+C 停止服务
echo.

REM 启动服务
python app.py

pause

