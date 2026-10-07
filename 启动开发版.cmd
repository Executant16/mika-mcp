@echo off
chcp 936 >nul
title Mika MCP 开发版
cd /d "%~dp0"

set "LOG=%~dp0启动日志.txt"
set "EXE=%~dp0node_modules\electron\dist\electron.exe"

echo ===== Mika MCP 开发版启动日志 ===== > "%LOG%"
echo 时间: %DATE% %TIME% >> "%LOG%"
echo 当前目录: %CD% >> "%LOG%"
echo electron.exe 存在: >> "%LOG%"
if exist "%EXE%" (echo   是 >> "%LOG%") else (echo   否 ^<-- 需要先 npm install >> "%LOG%")
echo ELECTRON_RUN_AS_NODE = [%ELECTRON_RUN_AS_NODE%] >> "%LOG%"
echo NODE_OPTIONS = [%NODE_OPTIONS%] >> "%LOG%"

set "INAI=是"
echo %PATH% | findstr /i /c:"WorkBuddy" /c:"CodeBuddy" /c:"shim" >nul 2>&1
if errorlevel 1 set "INAI=否"
echo ★ 是否在 AI 助手的终端里启动: %INAI% >> "%LOG%"
echo   （"是" = 这个黑窗口是 AI 助手开的，图形程序起不来，请改在资源管理器里双击本文件） >> "%LOG%"
echo. >> "%LOG%"

rem ── 清掉可能干扰 Electron 的注入变量 ──
set "ELECTRON_RUN_AS_NODE="
set "NODE_OPTIONS="

echo.
echo   正在启动 Mika MCP 开发版...
echo   首次启动要几秒，请稍候。
echo.
echo   【关掉这个黑窗口 = 关掉应用】
echo.

"%EXE%" "%~dp0." --no-sandbox --disable-gpu --enable-logging >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
echo 退出码 = %RC% >> "%LOG%"

if "%RC%"=="0" goto normal

rem ── 第一次失败：记下目录权限，再试一次官方应急参数 ──
echo. >> "%LOG%"
echo ----- 失败诊断 A：目录权限 ----- >> "%LOG%"
icacls "%EXE%" >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo ----- 失败诊断 B：改用 --disable-gpu-sandbox 再试一次 ----- >> "%LOG%"
"%EXE%" "%~dp0." --disable-gpu-sandbox --enable-logging >> "%LOG%" 2>&1
set "RC2=%ERRORLEVEL%"
echo 第二次退出码 = %RC2% >> "%LOG%"

if "%RC2%"=="0" goto worked2
if "%RC%"=="4294930435" goto blocked
if "%RC%"=="-36861" goto blocked

echo.
echo   应用没起来，退出码 = %RC%（重试 = %RC2%）
echo   请把仓库里的「启动日志.txt」发给 AI。
echo.
pause
exit /b

:worked2
echo.
echo   ==========================================
echo     注意：第一次失败、第二次成功了！
echo     说明是 GPU 沙箱的问题，请把「启动日志.txt」发给 AI。
echo   ==========================================
echo.
echo 结果: 第二次(--disable-gpu-sandbox)成功 >> "%LOG%"
pause
exit /b

:blocked
echo.
echo   ==========================================
echo     图形窗口起不来，退出码 = %RC%
echo   ==========================================
echo.
echo   上面那行「是否在 AI 助手的终端里启动」如果是「是」，
echo   说明这个黑窗口是 AI 助手开的 —— 请关掉它，
echo   改到「文件资源管理器」里双击本文件。
echo.
echo   如果写的是「否」，请把仓库里的「启动日志.txt」发给 AI。
echo.
pause
exit /b

:normal
echo.
echo   正常退出（你自己关的窗口）。
timeout /t 2 >nul
exit /b
