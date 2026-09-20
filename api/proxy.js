async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('https://www.seret.co.il')) {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  const options = { method: req.method, redirect: 'follow' };

  if (req.method === 'POST') {
    options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    options.body = Buffer.concat(chunks);
  }

  const response = await fetch(targetUrl, options);
  const buffer = await response.arrayBuffer();

  res.setHeader('X-Final-Url', response.url);
  res.status(200).send(Buffer.from(buffer));
}

handler.config = { api: { bodyParser: false } };

module.exports = handler;
