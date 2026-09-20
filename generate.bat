@echo off
cd /d "%~dp0"
echo === Fetching movies from seret.co.il ===
node generate.js
if errorlevel 1 (
  echo FAILED - check internet connection
  pause
  exit /b 1
)
echo.
echo === Deploying to Vercel ===
git add movies.json index.html GUIDE.md
git commit -m "update movies data"
git push
echo.
echo Done. Vercel updates in about 30 seconds.
pause
