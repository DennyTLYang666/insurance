@echo off
rem 本機即時更新：啟動伺服器並開啟網頁，頁面右上角會出現「立即更新」
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0.."
set WM_ECON_DIR=D:\temp\claude\twlife\code\util\econ\
start "" http://127.0.0.1:8000/
where py >nul 2>nul
if %errorlevel%==0 (py -3 scripts\serve.py) else (python scripts\serve.py)
