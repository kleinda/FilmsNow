#!/usr/bin/env node
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { TextDecoder } = require('util');

const SERET  = 'https://www.seret.co.il';
const W1255  = new TextDecoder('windows-1255');
const UA     = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function get(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9', 'Referer': SERET + '/' }
    };
    const req = https.get(opts, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        res.resume();
        return get(loc.startsWith('http') ? loc : SERET + loc).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getHtml(urlPath) {
  const buf = await get(SERET + urlPath);
  return W1255.decode(buf);
}

function parseWeek(text) {
  if (!text) return 99;
  const n = text.match(/\d+/);
  if (n) return parseInt(n[0]);
  if (text.includes('ראשון')) return 1;
  if (text.includes('שני')) return 2;
  if (text.includes('שלישי')) return 3;
  return 99;
}

async function fetchMovieList() {
  const html = await getHtml('/movies/newmovies.asp');
  const movies = [];
  const seen = new Set();

  const re = /class="lwhite16 noticetxt">([\s\S]*?)<\/div>[\s\S]*?href="s_movies\.asp\?MID=(\d+)"[\s\S]*?data-src="\.\.\/images\/movies\/([^\/]+)\/[^"]*"[^>]+alt="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [, weekText, mid, folder, altName] = m;
    if (seen.has(mid)) continue;
    seen.add(mid);
    movies.push({
      mid, week: parseWeek(weekText.trim()), weekLabel: weekText.trim(), folder,
      englishName: altName,
      posterImg: `${SERET}/images/movies/${folder}/${folder}1.jpg`,
      coverImg:  `${SERET}/images/movies/${folder}/${folder}_coverBig.jpg`,
      hebrewTitle: '', genre: '', rating: null, duration: '',
      actors: '', director: '', plot: '', releaseDate: '', language: '', isIsraeli: false
    });
  }

  // DOM-pass fallback (no jsdom — regex for links)
  const linkRe = /href="s_movies\.asp\?MID=(\d+)"/gi;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const mid = lm[1];
    if (seen.has(mid)) continue;
    seen.add(mid);
    movies.push({
      mid, week: 99, weekLabel: '', folder: '', englishName: '',
      posterImg: '', coverImg: '',
      hebrewTitle: '', genre: '', rating: null, duration: '',
      actors: '', director: '', plot: '', releaseDate: '', language: '', isIsraeli: false
    });
  }

  return movies;
}

function extractInfo(html, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re  = new RegExp('>' + esc + '<\\/span>[\\s\\S]*?<span[^>]*73%[^>]*>([\\s\\S]*?)<\\/span>');
  const mm  = html.match(re);
  if (!mm) return '';
  return mm[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchMovieDetail(mid) {
  const html = await getHtml(`/movies/s_movies.asp?MID=${mid}`);

  const heTitle  = (html.match(/class="TitWhite22"[^>]*><span[^>]*>([^<]+)/) || [])[1]?.trim() || '';
  const enTitle  = (html.match(/class="TitWhite22"[^>]*><span[^>]*>[^<]*<\/span>[\s\S]*?class="TitWhite22"[^>]*><span[^>]*>([^<]+)/) || [])[1]?.trim() || '';
  const genre    = (html.match(/class="buttonGRYs"[^>]*>([^<]+)/) || [])[1]?.trim() || '';

  let rating = '';
  for (const m2 of html.matchAll(/DarkGreenStrong30[^>]*>[\s\S]*?<span[^>]*>(\d[\d.]*)<\/span>/g)) {
    rating = m2[1]; break;
  }

  const bgM    = html.match(/id="bg_cover"[^>]*style="[^"]*url\(['"]?([^'")\s]+)['"]?\)/);
  const coverImg = bgM ? bgM[1] : '';
  const plotM  = html.match(/class="subtitwhite"[^>]*>([^<]+)/);
  const plot   = plotM ? plotM[1].trim() : '';

  const actors      = extractInfo(html, 'שחקן / שחקנים')
                   || extractInfo(html, 'שחקנים')
                   || extractInfo(html, 'שחקן');
  const director    = extractInfo(html, 'במאי/ת')
                   || extractInfo(html, 'בימאי/ת');
  const duration    = extractInfo(html, 'אורך');
  const language    = extractInfo(html, 'שפה');
  const countryYear = extractInfo(html, 'מקום / שנה')
                   || extractInfo(html, 'מדינה / שנה')
                   || extractInfo(html, 'מדינה');
  const releaseDate = extractInfo(html, 'בכורה')
                   || extractInfo(html, 'יצא');
  const genreInfo   = extractInfo(html, "ז'אנרים")
                   || extractInfo(html, "ג'אנר")
                   || genre;

  const isIsraeli = language.includes('עברית')
                 || countryYear.includes('ישראל')
                 || genreInfo.includes('ישראלי');

  return { hebrewTitle: heTitle, englishTitle: enTitle, genre: genreInfo || genre,
           rating, coverImg, plot, actors, director, duration, language,
           countryYear, releaseDate, isIsraeli };
}

async function main() {
  console.log('Fetching movie list...');
  let movies;
  try {
    movies = await fetchMovieList();
  } catch(e) {
    console.error('Failed to fetch movie list:', e.message);
    process.exit(1);
  }
  console.log(`Found ${movies.length} movies. Loading details...`);

  for (let i = 0; i < movies.length; i++) {
    const m = movies[i];
    try {
      const d = await fetchMovieDetail(m.mid);
      m.hebrewTitle = d.hebrewTitle || m.englishName;
      m.genre       = d.genre || '';
      m.rating      = d.rating || null;
      m.duration    = d.duration || '';
      m.actors      = d.actors || '';
      m.director    = d.director || '';
      m.plot        = d.plot || '';
      m.releaseDate = d.releaseDate || '';
      m.language    = d.language || '';
      m.coverImg    = d.coverImg || m.coverImg;
      m.isIsraeli   = d.isIsraeli || false;
      process.stdout.write(`[${i+1}/${movies.length}] ${m.hebrewTitle || m.englishName}\n`);
    } catch(e) {
      process.stdout.write(`[${i+1}/${movies.length}] SKIP ${m.mid}: ${e.message}\n`);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  const out = path.join(__dirname, 'movies.json');
  fs.writeFileSync(out, JSON.stringify(movies, null, 2), 'utf8');
  console.log(`\nSaved ${movies.length} movies to movies.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
