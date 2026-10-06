$ErrorActionPreference = 'SilentlyContinue'
$proc = Get-Process -Name 'node' -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Node processes found:"
    $proc | ForEach-Object { Write-Host "PID: $($_.Id) $($_.Path)" }
} else {
    Write-Host "No node process found"
}
