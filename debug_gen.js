const https = require('https');
const { TextDecoder } = require('util');
const W1255 = new TextDecoder('windows-1255');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search,
        headers: { 'User-Agent': UA, 'Accept-Language': 'he-IL,he;q=0.9', 'Referer': 'https://www.seret.co.il/' } },
      res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location; res.resume();
          return get(loc.startsWith('http') ? loc : 'https://www.seret.co.il' + loc).then(resolve).catch(reject);
        }
        const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve(Buffer.concat(c))); res.on('error', reject);
      }
    );
    req.on('error', reject); req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const html = W1255.decode(await get('https://www.seret.co.il/movies/newmovies.asp'));

  // primary regex (same as generate.js)
  const re = /class="lwhite16 noticetxt">([\s\S]*?)<\/div>[\s\S]*?href="s_movies\.asp\?MID=(\d+)"[\s\S]*?data-src="\.\.\/images\/movies\/([^\/]+)\/[^"]*"[^>]+alt="([^"]+)"/g;
  const primaryMids = new Set();
  let m;
  while ((m = re.exec(html)) !== null) primaryMids.add(m[2]);
  console.log('Primary regex found:', primaryMids.size, [...primaryMids].join(', '));

  // fallback regex (same as generate.js)
  const linkRe = /href="s_movies\.asp\?MID=(\d+)"/gi;
  const allHrefMids = new Set();
  let lm;
  while ((lm = linkRe.exec(html)) !== null) allHrefMids.add(lm[1]);
  console.log('All href MIDs found:', allHrefMids.size, [...allHrefMids].join(', '));

  // any MID= mention at all (includes JS vars, etc.)
  const anyMids = new Set([...html.matchAll(/MID=(\d+)/gi)].map(x => x[1]));
  console.log('Any MID= mention:', anyMids.size);
  const extraInJs = [...anyMids].filter(id => !allHrefMids.has(id));
  console.log('MIDs in JS/data only (not in href):', extraInJs.join(', '));

  // look at what HTML surrounds a missing MID (e.g. 8628)
  const testMid = [...anyMids].find(id => !allHrefMids.has(id));
  if (testMid) {
    const idx = html.indexOf('MID=' + testMid);
    console.log('\nExample missing MID', testMid, 'context:');
    console.log(html.slice(Math.max(0, idx - 150), idx + 150).replace(/\s+/g, ' '));
  }
})().catch(e => console.error(e.message));
