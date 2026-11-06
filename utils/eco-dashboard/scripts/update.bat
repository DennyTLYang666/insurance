@echo off
rem 每週更新：驗證 data\raw 並產出 data\weekly.json（同時保存歷史）
rem 用法：雙擊執行＝自動抓資料並更新（--fetch）；也可帶參數，例如  update.bat --fetch-only  或  update.bat --check-sources
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0.."
set ARGS=%*
set WM_ECON_DIR=D:\temp\claude\twlife\code\util\eco-dashboard\scripts\econ
if "%ARGS%"=="" set ARGS=--fetch

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 scripts\update_data.py %ARGS%
) else (
  python scripts\update_data.py %ARGS%
)

set RC=%errorlevel%
echo.
if "%RC%"=="0" (echo 更新完成。) else if "%RC%"=="2" (echo 網站已更新，但部分資料來源抓取失敗，請看上方訊息。) else (echo 更新失敗，請依上方錯誤訊息修正後重試。)
pause
