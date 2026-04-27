// api/proxy.js — Vercel serverless CORS proxy for HLS streams
// Fetches any URL server-side and returns it to the browser
// Usage: /api/proxy?url=https://example.com/video.m3u8

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  // Basic safety: only allow http/https URLs
  let targetUrl;
  try {
    targetUrl = new URL(url);
    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs allowed' });
    }
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        // Pass a realistic browser User-Agent so CDNs don't block
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': targetUrl.origin + '/',
        'Origin': targetUrl.origin,
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status} ${upstream.statusText}`,
      });
    }

    // Determine content type
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    // Set CORS headers so browser can read the response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');

    // Stream the response body back
    const buffer = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    res.status(502).json({ error: 'Proxy fetch failed: ' + err.message });
  }
}
