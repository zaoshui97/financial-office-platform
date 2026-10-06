$ErrorActionPreference = 'Continue'
$workDir = 'C:\Users\fjlyh\Desktop\数字马力\digital-horse'
$env:NODE_ENV = 'development'

$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = 'cmd.exe'
$pinfo.Arguments = '/c npm run dev'
$pinfo.WorkingDirectory = $workDir
$pinfo.UseShellExecute = $true
$pinfo.WindowStyle = 'Normal'
$pinfo.EnvironmentVariables['NODE_ENV'] = 'development'

$process = [System.Diagnostics.Process]::Start($pinfo)
Write-Host "Started vite with PID: $($process.Id)"
