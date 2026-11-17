@echo off
cd /d "%~dp0"
echo === FilmsNow Deploy ===
echo.
set COMMITMSG=update
set /p COMMITMSG=Commit message (press Enter for default):
git add -A
git commit -m "%COMMITMSG%"
git push
if errorlevel 1 (
  echo.
  echo PUSH FAILED - nothing was deployed. See the error above.
  pause
  exit /b 1
)
echo.
echo Done. Vercel updates in about 30 seconds.
pause
