@echo off
REM ============================================================
REM 屏幕共享 origin 自定义  apexis.com.cn → 127.0.0.1
REM 需要管理员权限（右键 -> 以管理员身份运行）
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0.."

powershell -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-File','%CD%\tools\setup-host.ps1' -Verb RunAs -Wait"

echo.
pause