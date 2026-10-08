# ============================================================
# 屏幕共享 origin 自定义：apexis.com.cn → 127.0.0.1
# ============================================================
#
# 背景：
#   Chrome 在屏幕共享时，会在被共享标签页顶部固定显示一行蓝条：
#     "正在与 <origin> 共享此标签页"
#   origin 取自发起共享的页面 URL。
#   默认用 http://127.0.0.1:5173 时，蓝条里会显示这个开发地址，
#   参会人看到会以为我们项目还没部署。
#
#   本脚本把 apexis.com.cn 解析到 127.0.0.1，再用这个域名开会，
#   蓝条就显示成 "apexis.com.cn"，看起来像"已部署"。
#
# 用法（任选其一）：
#   1. 右键本文件 -> "使用 PowerShell 运行"（需要先点 UAC 提升）
#   2. 在管理员 PowerShell 里执行：
#        powershell -ExecutionPolicy Bypass -File .\setup-host.ps1
#
# 撤销：
#   管理员 PowerShell 执行  Remove-Item "$env:WINDIR\System32\drivers\etc\hosts" -Force
#   或重新跑此脚本选"卸载"
# ============================================================

$ErrorActionPreference = 'Stop'
$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
$marker    = '# apexis-meeting-screen-share'

if (-not (Test-Path $hostsPath)) {
    Write-Error "找不到 hosts 文件：$hostsPath"
}

$cur = Get-Content $hostsPath -Raw -Encoding ASCII
$present = $cur -match 'apexis\.com\.cn'

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  屏幕共享 origin 自定义  apexis.com.cn" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "当前 hosts 里 apexis.com.cn ：$($present  ? '已存在' : '未配置')"
Write-Host ""

if ($present) {
    $ans = Read-Host "已配置，是否要移除？(y/N)"
    if ($ans -eq 'y' -or $ans -eq 'Y') {
        $lines = Get-Content $hostsPath -Encoding ASCII
        $lines = $lines | Where-Object { $_ -notmatch 'apexis\.com\.cn' -and $_ -notmatch [regex]::Escape($marker) }
        Set-Content -Path $hostsPath -Value $lines -Encoding ASCII
        Write-Host "已移除。" -ForegroundColor Green
    } else {
        Write-Host "未改动。" -ForegroundColor Yellow
    }
    exit 0
}

# 没配过 → 加
$entry = "127.0.0.1   apexis.com.cn   $marker"
Add-Content -Path $hostsPath -Value $entry -Encoding ASCII

# 校验
$after = Get-Content $hostsPath -Raw -Encoding ASCII
if ($after -match 'apexis\.com\.cn') {
    Write-Host "已写入：" -ForegroundColor Green
    Write-Host "  $entry"
    Write-Host ""
    Write-Host "接下来：" -ForegroundColor Cyan
    Write-Host "  1. 重启 Vite（让它 reload allowedHosts）" -ForegroundColor White
    Write-Host "  2. 用浏览器打开  http://apexis.com.cn:5173" -ForegroundColor White
    Write-Host "  3. 在这个域名下点屏幕共享 → 蓝条显示 apexis.com.cn（无端口号）" -ForegroundColor White
    Write-Host ""
    Write-Host "提示：Windows 默认会忽略 hosts 里的端口，要让蓝条完全不显示 :5173，" -ForegroundColor DarkGray
    Write-Host "      需要把 Vite 端口改成 80（推荐方案见 README），或用 nginx 反代。" -ForegroundColor DarkGray
} else {
    Write-Error "写入失败，请检查权限"
}