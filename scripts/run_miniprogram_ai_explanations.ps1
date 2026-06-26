$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "data\analysis"
$LogPath = Join-Path $LogDir "miniprogram_ai_generation.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

Write-Host "开始生成小程序题库 AI 解析，支持断点续跑。"
Write-Host "日志文件: $LogPath"
Write-Host "如需停止，按 Ctrl+C；再次运行本脚本会自动跳过已有解析。"

python (Join-Path $PSScriptRoot "generate_ai_explanations.py") --miniprogram --sleep 0.2 2>&1 | Tee-Object -FilePath $LogPath -Append

Write-Host "生成结束，开始同步小程序数据文件..."
python (Join-Path $PSScriptRoot "export_miniprogram_data.py")
Write-Host "完成。"
