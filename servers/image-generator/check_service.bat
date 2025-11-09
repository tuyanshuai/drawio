@echo off
chcp 65001 >nul
echo =========================================
echo   检查图像生成服务状态
echo =========================================
echo.

cd /d %~dp0

echo 正在测试服务...
python test_service.py

echo.
pause

