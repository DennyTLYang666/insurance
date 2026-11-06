@echo off
cd /d %~dp0
if /i "%1"=="offline" goto offline
if /i "%1"=="daily" goto daily
python -m pipeline.run --mode snapshot
goto done
:offline
python -m pipeline.run --offline
goto done
:daily
python -m pipeline.run --mode daily
:done
echo.
echo Done. Open index.html to view. Usage: run_local.bat [offline^|daily]  (daily also refreshes funds and news)
pause
