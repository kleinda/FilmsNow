@echo off
cd /d "%~dp0"
echo === FilmsNow Deploy ===
echo.
set COMMITMSG=update
set /p COMMITMSG=Commit message (press Enter for default):
git add -A
git commit -m "%COMMITMSG%"
git push
echo.
echo Done. Vercel updates in about 30 seconds.
pause
