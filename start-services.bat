@echo off
chcp 65001 >nul
echo =========================================
echo   启动 Draw.io 开发服务
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

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [1/3] 启动前端服务 (端口 8080)...
start "前端服务-8080" cmd /k "cd /d frontend\main\webapp && python -m http.server 8080"

timeout /t 2 /nobreak >nul
echo ✓ 前端服务已启动: http://localhost:8080
echo.

echo [3/4] 启动 Icon Library 服务 (端口 8082)...
start "Icon Library-8082" cmd /k "cd /d servers\iconlibrary && node server.js"

timeout /t 2 /nobreak >nul
echo ✓ Icon Library 服务已启动: http://localhost:8082
echo.

echo [4/4] 启动图像生成服务 (端口 8083)...
echo 正在检查依赖...
cd /d servers\image-generator
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -q -r requirements.txt
    if errorlevel 1 (
        echo 警告: 依赖安装失败，服务可能无法启动
        echo 请手动运行: cd servers\image-generator && pip install -r requirements.txt
    )
)
cd /d %~dp0
start "图像生成服务-8083" cmd /k "cd /d servers\image-generator && python app.py"

timeout /t 3 /nobreak >nul
echo ✓ 图像生成服务已启动: http://localhost:8083
echo   提示: 如果服务无法访问，请检查服务窗口中的错误信息
echo.

echo =========================================
echo   所有服务已启动!
echo =========================================
echo.
echo 服务地址:
echo   • 前端服务:        http://localhost:8080
echo   • AI Converter:    http://localhost:8081
echo   • Icon Library:    http://localhost:8082
echo   • 图像生成服务:    http://localhost:8083
echo.
echo 关闭此窗口或按任意键关闭所有服务窗口...
pause >nul

REM 关闭所有服务窗口
taskkill /FI "WindowTitle eq 前端服务-8080*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Icon Library-8082*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq 图像生成服务-8083*" /T /F >nul 2>&1

echo 所有服务已停止

