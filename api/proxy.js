async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('https://www.seret.co.il')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const fetchOpts = { method: req.method || 'GET', redirect: 'follow' };

  if (req.method === 'POST') {
    fetchOpts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    // read raw body (ASCII percent-encoded, safe to stringify as utf8)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    fetchOpts.body = Buffer.concat(chunks).toString('utf8');
  }

  try {
    const upstream = await fetch(targetUrl, fetchOpts);
    const buffer = await upstream.arrayBuffer();
    res.setHeader('X-Final-Url', upstream.url || targetUrl);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

handler.config = { api: { bodyParser: false } };
module.exports = handler;
