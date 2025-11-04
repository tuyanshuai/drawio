# 启动所有服务的统一脚本
# 端口配置：
# - 前端服务: 8080 (frontend/main/webapp/index.html)
# - AI Converter: 8081 (servers/aiconverter)
# - Icon Library: 8082 (servers/iconlibrary)
# - NanoBanana: 8083 (servers/nanobanana)

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  启动 Draw.io 开发服务" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 检查必要的依赖
Write-Host "[1/3] 检查依赖..." -ForegroundColor Yellow

# 检查 Python
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "错误: 未找到 Python，请先安装 Python" -ForegroundColor Red
    exit 1
}

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

Write-Host "✓ 依赖检查通过" -ForegroundColor Green
Write-Host ""

# 启动前端静态文件服务器 (8080端口)
Write-Host "[2/3] 启动前端服务 (端口 8080)..." -ForegroundColor Yellow
$frontendDir = Join-Path $scriptDir "frontend\main\webapp"
if (-not (Test-Path $frontendDir)) {
    Write-Host "错误: 前端目录不存在: $frontendDir" -ForegroundColor Red
    exit 1
}

# 使用 Python 的 http.server 启动前端服务
$frontendJob = Start-Job -ScriptBlock {
    param($dir, $port, $pythonCmd)
    Set-Location $dir
    & $pythonCmd -m http.server $port
} -ArgumentList $frontendDir, 8080, $pythonCmd

Write-Host "✓ 前端服务已启动: http://localhost:8080" -ForegroundColor Green
Write-Host ""

# 启动 AI Converter 服务 (8081端口)
Write-Host "[3/3] 启动 AI Converter 服务 (端口 8081)..." -ForegroundColor Yellow
$aiconverterDir = Join-Path $scriptDir "servers\aiconverter"
if (-not (Test-Path $aiconverterDir)) {
    Write-Host "错误: AI Converter 目录不存在: $aiconverterDir" -ForegroundColor Red
    Stop-Job $frontendJob
    Remove-Job $frontendJob
    exit 1
}

$aiconverterJob = Start-Job -ScriptBlock {
    param($dir, $pythonCmd)
    Set-Location $dir
    & $pythonCmd app.py
} -ArgumentList $aiconverterDir, $pythonCmd

Write-Host "✓ AI Converter 服务已启动: http://localhost:8081" -ForegroundColor Green
Write-Host ""

# 启动 Icon Library 服务 (8082端口)
Write-Host "[4/4] 启动 Icon Library 服务 (端口 8082)..." -ForegroundColor Yellow
$iconlibraryDir = Join-Path $scriptDir "servers\iconlibrary"
if (-not (Test-Path $iconlibraryDir)) {
    Write-Host "错误: Icon Library 目录不存在: $iconlibraryDir" -ForegroundColor Red
    Stop-Job $frontendJob, $aiconverterJob
    Remove-Job $frontendJob, $aiconverterJob
    exit 1
}

$iconlibraryJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    node server.js
} -ArgumentList $iconlibraryDir

Write-Host "✓ Icon Library 服务已启动: http://localhost:8082" -ForegroundColor Green
Write-Host ""

# 启动 NanoBanana 代理服务 (8083端口)
Write-Host "[5/5] 启动 NanoBanana 代理服务 (端口 8083)..." -ForegroundColor Yellow
$nanobananaDir = Join-Path $scriptDir "servers\nanobanana"
if (-not (Test-Path $nanobananaDir)) {
    Write-Host "错误: NanoBanana 目录不存在: $nanobananaDir" -ForegroundColor Red
    Stop-Job $frontendJob, $aiconverterJob, $iconlibraryJob
    Remove-Job $frontendJob, $aiconverterJob, $iconlibraryJob
    exit 1
}

$nanobananaJob = Start-Job -ScriptBlock {
    param($dir, $pythonCmd)
    Set-Location $dir
    & $pythonCmd app.py
} -ArgumentList $nanobananaDir, $pythonCmd

Write-Host "✓ NanoBanana 代理服务已启动: http://localhost:8083" -ForegroundColor Green
Write-Host ""

# 等待服务启动
Write-Host "等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 显示服务状态
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  所有服务已启动!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "服务地址:" -ForegroundColor White
Write-Host "  • 前端服务:        http://localhost:8080" -ForegroundColor Cyan
Write-Host "  • AI Converter:    http://localhost:8081" -ForegroundColor Cyan
Write-Host "  • Icon Library:    http://localhost:8082" -ForegroundColor Cyan
Write-Host "  • NanoBanana:       http://localhost:8083" -ForegroundColor Cyan
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow
Write-Host ""

# 等待用户中断
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # 检查服务是否还在运行
        $frontendState = Get-Job -Id $frontendJob.Id | Select-Object -ExpandProperty State
        $aiconverterState = Get-Job -Id $aiconverterJob.Id | Select-Object -ExpandProperty State
        $iconlibraryState = Get-Job -Id $iconlibraryJob.Id | Select-Object -ExpandProperty State
        $nanobananaState = Get-Job -Id $nanobananaJob.Id | Select-Object -ExpandProperty State
        
        if ($frontendState -eq "Failed" -or $aiconverterState -eq "Failed" -or $iconlibraryState -eq "Failed" -or $nanobananaState -eq "Failed") {
            Write-Host ""
            Write-Host "警告: 检测到服务异常退出" -ForegroundColor Red
            break
        }
    }
} catch {
    Write-Host ""
    Write-Host "正在停止所有服务..." -ForegroundColor Yellow
} finally {
    # 清理资源
    Stop-Job $frontendJob, $aiconverterJob, $iconlibraryJob, $nanobananaJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob, $aiconverterJob, $iconlibraryJob, $nanobananaJob -ErrorAction SilentlyContinue
    Write-Host "所有服务已停止" -ForegroundColor Green
}

