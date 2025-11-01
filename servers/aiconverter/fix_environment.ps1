# AI Converter 环境修复脚本 (PowerShell)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Converter 环境修复脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Python 是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "检测到 Python 版本: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.8 或更高版本" -ForegroundColor Red
    Read-Host "按 Enter 键退出"
    exit 1
}

Write-Host ""
Write-Host "开始修复环境..." -ForegroundColor Yellow
Write-Host ""

# 升级 pip
Write-Host "[1/4] 升级 pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip
Write-Host ""

# 卸载可能有问题的旧版本
Write-Host "[2/4] 卸载可能冲突的包..." -ForegroundColor Cyan
python -m pip uninstall -y numpy torch torchvision 2>$null
Write-Host ""

# 安装 requirements.txt 中的包
Write-Host "[3/4] 安装依赖包..." -ForegroundColor Cyan
python -m pip install fastapi==0.104.1
python -m pip install uvicorn[standard]==0.24.0
python -m pip install python-multipart==0.0.6
python -m pip install pillow==10.1.0
python -m pip install numpy==1.26.4
python -m pip install opencv-python==4.8.1.78
python -m pip install torch==2.1.2 torchvision==0.16.2
Write-Host ""

# 安装 SAM
Write-Host "[4/4] 安装 Segment Anything Model..." -ForegroundColor Cyan
Write-Host "尝试从 GitHub 安装..." -ForegroundColor Yellow
$result = python -m pip install git+https://github.com/facebookresearch/segment-anything.git 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub 安装失败，尝试从 PyPI 安装..." -ForegroundColor Yellow
    python -m pip install segment-anything-py
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "修复完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "运行环境检查脚本以验证安装:" -ForegroundColor Yellow
Write-Host "python fix_environment.py" -ForegroundColor White
Write-Host ""
Read-Host "按 Enter 键退出"

