Set-Location "c:\CHAT_GPT_PROJECTS\FilmsNow"

node generate.js
if ($LASTEXITCODE -ne 0) { exit 1 }

git add movies.json meta.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    $date = Get-Date -Format "dd/MM/yyyy"
    git commit -m "chore: update movies data [$date]"
    git push
}
