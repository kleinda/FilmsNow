@echo off
cd /d "%~dp0"

echo === FilmsNow Deploy ===
echo.

set MSG=update
set /p MSG="Commit message (Enter to skip): "

git add -A
git commit -m "%MSG%"
git push

echo.
echo Deploy done - Vercel updates in ~30 sec
pause
