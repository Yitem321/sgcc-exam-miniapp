$ErrorActionPreference = "Stop"

Set-Location 'E:\BaiduSyncdisk\AI\sgcc-exam-miniapp'

$LogPath = 'E:\BaiduSyncdisk\AI\sgcc-exam-miniapp\data\analysis\run_all_ai_generation.log'
$PidPath = 'E:\BaiduSyncdisk\AI\sgcc-exam-miniapp\data\analysis\run_all_ai_generation.pid'

"started_at=$(Get-Date -Format o)" | Out-File -FilePath $LogPath -Encoding utf8 -Append
"pid=$PID" | Out-File -FilePath $PidPath -Encoding ascii -Force

python scripts\generate_ai_explanations.py --resume --sleep 0.3 --max-retries 20 --retry-sleep 45 --fallback-cooldown 300 --flush-every 20 --skip-frontend-mirror *>> $LogPath
python scripts\export_miniprogram_data.py *>> $LogPath

"finished_at=$(Get-Date -Format o)" | Out-File -FilePath $LogPath -Encoding utf8 -Append
