# FilmsNow — מדריך מלא

## ארכיטקטורה

```
generate.bat (ידני / אוטומטי כל יום שלישי 19:00)
    └─► generate.js  ← שואב נתונים מ-seret.co.il (עברית Windows-1255)
            └─► movies.json  ← קובץ סטטי מלא (כל פרטי הסרטים + ביקורות)
                    └─► Vercel (דרך git push)
                            └─► index.html טוען /movies.json → עובד על כל מכשיר, ללא CORS
```

**למה movies.json ולא fetch ישיר?**
seret.co.il מוגן ב-Cloudflare שחוסם:
- IPs של Vercel (US) — מחזיר "Just a moment..." במקום HTML
- סלולר / IPs לא-ישראליים — לעיתים נחסם גם כן
- פתרון: שאיבה פעם בשבוע ממחשב ביתי (IP ישראלי, רגיל) → שמירה ב-JSON → הגשה סטטית

---

## קבצים

### `index.html`
הסרטייה כולה — SPA מלא, ללא dependencies חיצוניות (מלבד Google Fonts).

**זרימת טעינה:**
1. `init()` מנסה `fetch('/movies.json')` — אם קיים ותקין, טוען הכל (אפס קריאות CORS)
2. pre-population של `detailCache` מהנתונים ב-JSON → לחיצה על כרטיס מציגה תיאור/שחקנים/ביקורות מיד
3. fallback: שאיבה חיה מ-seret.co.il (עובד רק בדפדפן Desktop עם IP ישראלי)

**אלגוריתם הדירוג — `ratingClass(rating, duration)`:**
| תנאי | מחלקה | צבע |
|------|--------|-----|
| משך > 125 דקות | `bad` | אדום |
| ציון ≥ 7 | `good` | ירוק |
| ציון ≥ 5 | `mid` | כתום |
| ציון < 5 | `bad` | אדום |
| אין ציון | `''` | ללא תג |

**`parseDurationMins(str)`** — מפענח `"90 דקות"` → 90, `"1:30"` → 90

---

### `generate.js`
סקריפט Node.js לשאיבת נתונים. רץ על Windows עם Node 20+.

**מה הוא שואב לכל סרט:**
- `hebrewTitle`, `englishTitle`, `genre`, `rating`
- `plot` (תיאור עלילה), `actors`, `director`
- `duration`, `language`, `countryYear`, `releaseDate`
- `coverImg` (תמונת רקע), `posterImg` (פוסטר)
- `isIsraeli` (בודק שפה/מדינה/ז'אנר)
- `reviews` — עד 4 ביקורות מ-`<p class="...text-truncate-2..." style="...width:85%...">`

**הגדרות:**
- User-Agent: Chrome 124 (כדי לעבור Cloudflare)
- Encoding: `TextDecoder('windows-1255')` — seret.co.il עדיין ב-Windows Hebrew
- Delay בין סרטים: 250ms (למניעת rate-limiting)
- Timeout: 20 שניות לבקשה

**פלט:** `movies.json` בתיקיית הפרויקט

---

### `generate.bat`
הרצה מלאה: שאיבה + deploy.

```bat
node generate.js          ← יוצר movies.json
git add movies.json index.html
git commit -m "update movies data"
git push                  ← Vercel מתעדכן תוך ~30 שניות
```

---

### `deploy.bat`
deploy ידני לשינויי קוד בלבד (ללא שאיבה מחדש).

```bat
set /p MSG="Commit message: "
git add -A
git commit -m "%MSG%"
git push
```

---

### `api/proxy.js`
פרוקסי Vercel Serverless — **לא בשימוש כרגע** (Cloudflare חוסם IPs של Vercel).
נשמר לעתיד למקרה שseret יסיר את ההגנה.

---

## משימה אוטומטית — כל יום שלישי 19:00

**שם המשימה:** `FilmsNow Weekly Update`

**יצירה מחדש** (אם נמחקה):
```powershell
$action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument '/c "C:\CHAT_GPT_PROJECTS\FilmsNow\generate.bat"' -WorkingDirectory "C:\CHAT_GPT_PROJECTS\FilmsNow"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At 19:00
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable $true
Register-ScheduledTask -TaskName "FilmsNow Weekly Update" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force
```

**`-StartWhenAvailable $true`** = אם המחשב היה כבוי/נעול ב-19:00, ירוץ מיד בהפעלה הבאה.

**בדיקת סטטוס:**
```powershell
Get-ScheduledTask -TaskName "FilmsNow Weekly Update" | Get-ScheduledTaskInfo
```

**הרצה ידנית מיידית:**
```powershell
Start-ScheduledTask -TaskName "FilmsNow Weekly Update"
```

---

## Deploy ל-Vercel

### ראשוני (פעם אחת)
```bash
git init
git remote add origin https://github.com/<user>/filmsnow.git
git add -A && git commit -m "init"
git push -u origin main
# ב-Vercel: New Project → Import from GitHub → Deploy
```

### עדכון שבועי (אוטומטי דרך generate.bat)
`generate.bat` → שואב → commit → push → Vercel בונה אוטומטית (~30 שניות)

### עדכון קוד בלבד
```bat
deploy.bat
```

---

## טיפול בבעיות נפוצות

| בעיה | סיבה | פתרון |
|------|------|--------|
| "Just a moment..." ב-generate.js | Cloudflare → רץ מ-IP לא מוכר | הרץ מהמחשב הביתי בלבד |
| ביקורות ריקות בסרט | movies.json ישן (לפני תיקון) | הרץ generate.bat מחדש |
| גלילה לצדדים במובייל | overflow-x | כבר תוקן ב-`html { overflow-x:hidden }` |
| עלילה/שחקנים ריק במובייל | detailCache לא אוכלס | כבר תוקן — pre-populate מ-movies.json |
| No movies error | CORS נכשל + movies.json לא קיים | הרץ generate.bat לפחות פעם אחת |

---

## מבנה movies.json — שדות לכל סרט

```json
{
  "mid": "8585",
  "week": 1,
  "weekLabel": "מציג שבוע ראשון",
  "folder": "ResidentEvil2026",
  "englishName": "Resident Evil 2026",
  "englishTitle": "Resident Evil 2026",
  "hebrewTitle": "האויב שבפנים",
  "posterImg": "https://www.seret.co.il/images/movies/...",
  "coverImg":  "https://www.seret.co.il/images/movies/...",
  "genre": "אימה",
  "rating": "5.3",
  "duration": "90 דקות",
  "actors": "רוברט קולצר",
  "director": "זאק קרגר",
  "plot": "...",
  "releaseDate": "17/9/2026",
  "language": "",
  "countryYear": "ארה\"ב / 2026",
  "isIsraeli": false,
  "reviews": ["ביקורת ראשונה...", "ביקורת שנייה..."]
}
```
