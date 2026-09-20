@echo off
cd /d "%~dp0"
echo === Generating movies.json from seret.co.il ===
node generate.js
if errorlevel 1 (
  echo FAILED - check your internet connection
  pause
  exit /b 1
)
echo.
echo === Deploying to Vercel ===
git add movies.json index.html
git commit -m "update movies data"
git push
echo.
echo Done! Vercel updates in ~30 sec
pause
