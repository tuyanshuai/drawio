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

echo [2/3] 启动 AI Converter 服务 (端口 8081)...
start "AI Converter-8081" cmd /k "cd /d servers\aiconverter && python app.py"

timeout /t 2 /nobreak >nul
echo ✓ AI Converter 服务已启动: http://localhost:8081
echo.

echo [3/4] 启动 Icon Library 服务 (端口 8082)...
start "Icon Library-8082" cmd /k "cd /d servers\iconlibrary && node server.js"

timeout /t 2 /nobreak >nul
echo ✓ Icon Library 服务已启动: http://localhost:8082
echo.

echo [4/4] 启动 NanoBanana 代理服务 (端口 8083)...
start "NanoBanana-8083" cmd /k "cd /d servers\nanobanana && python app.py"

timeout /t 2 /nobreak >nul
echo ✓ NanoBanana 代理服务已启动: http://localhost:8083
echo.

echo =========================================
echo   所有服务已启动!
echo =========================================
echo.
echo 服务地址:
echo   • 前端服务:        http://localhost:8080
echo   • AI Converter:    http://localhost:8081
echo   • Icon Library:    http://localhost:8082
echo   • NanoBanana:      http://localhost:8083
echo.
echo 关闭此窗口或按任意键关闭所有服务窗口...
pause >nul

REM 关闭所有服务窗口
taskkill /FI "WindowTitle eq 前端服务-8080*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq AI Converter-8081*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Icon Library-8082*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq NanoBanana-8083*" /T /F >nul 2>&1

echo 所有服务已停止

