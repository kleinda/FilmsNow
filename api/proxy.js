async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('https://www.seret.co.il')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const fetchOpts = {
    method: req.method || 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
      'Referer': 'https://www.seret.co.il/'
    }
  };

  if (req.method === 'POST') {
    fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    fetchOpts.body = Buffer.concat(chunks).toString('utf8');
  }

  try {
    const upstream = await fetch(targetUrl, fetchOpts);
    const buffer = await upstream.arrayBuffer();
    res.setHeader('X-Final-Url', upstream.url || targetUrl);
    res.setHeader('X-Status', String(upstream.status));
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
