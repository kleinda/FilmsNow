# FilmsNow — מדריך מלא

## ארכיטקטורה

```
Windows Task Scheduler (כל יום שלישי 07:00)
    └─► update-movies.ps1
            └─► generate.js  ← שואב נתונים מ-seret.co.il (עברית Windows-1255)
                    └─► movies.json  ← קובץ סטטי מלא (כל פרטי הסרטים + ביקורות)
                            └─► git push → GitHub → Vercel (deploy אוטומטי ~30 שניות)
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

### `update-movies.ps1`
הסקריפט האוטומטי — מופעל על-ידי Task Scheduler כל יום שלישי.

```powershell
node generate.js          ← יוצר movies.json חדש
git add movies.json meta.json
git diff --cached --quiet || git commit + git push   ← רק אם היה שינוי
```
Vercel מזהה את ה-push ומתפרס אוטומטית תוך ~30 שניות.

---

### `generate.bat`
הרצה ידנית: שאיבה + deploy (לשימוש מחוץ לאוטומציה).

```bat
node generate.js          ← יוצר movies.json
git add movies.json meta.json index.html GUIDE.md
git commit -m "update movies data"
git push                  ← Vercel מתעדכן תוך ~30 שניות
```

---

### `deploy.bat`
deploy ידני לשינויי קוד בלבד (ללא שאיבה מחדש).

```bat
set /p COMMITMSG="Commit message: "
git add -A
git commit -m "%COMMITMSG%"
git push
```

---

### `api/proxy.js`
פרוקסי Vercel Serverless — **לא בשימוש כרגע** (Cloudflare חוסם IPs של Vercel).
נשמר לעתיד למקרה שseret יסיר את ההגנה.

---

## משימה אוטומטית — כל יום שלישי 07:00

**שם המשימה:** `FilmsNow - Update Movies`

**מה היא עושה:**
1. מריצה `update-movies.ps1`
2. `generate.js` שואב נתונים טריים מ-seret.co.il
3. אם movies.json השתנה — commit + push ל-GitHub
4. Vercel מזהה את ה-push ומתפרס אוטומטית

**הערה:** אם המחשב כבוי ב-07:00 — המשימה תרוץ מיד בהפעלה הבאה (`StartWhenAvailable`).

**יצירה מחדש** (אם נמחקה):
```powershell
$action   = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"c:\CHAT_GPT_PROJECTS\FilmsNow\update-movies.ps1`""
$trigger  = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Tuesday -At "07:00"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName "FilmsNow - Update Movies" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
```

**בדיקת סטטוס:**
```powershell
Get-ScheduledTask -TaskName "FilmsNow - Update Movies" | Get-ScheduledTaskInfo
```

**הרצה ידנית מיידית:**
```powershell
Start-ScheduledTask -TaskName "FilmsNow - Update Movies"
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

### עדכון שבועי (אוטומטי — Task Scheduler)
כל יום שלישי 07:00: `update-movies.ps1` → שואב → commit → push → Vercel בונה אוטומטית (~30 שניות)

### עדכון ידני (generate.bat)
להרצה מיידית מחוץ ללוח הזמנים — כפול-קליק על `generate.bat`

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
