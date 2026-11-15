// Vercel serverless function: proxy sitemap XML from backend so response is always application/xml
const https = require('https');
const http = require('http');

const BACKEND = (process.env.REACT_APP_API_URL || 'https://movie-7zq4.onrender.com').replace(/\/$/, '');

/** Public origin of this deployment (browser host), for backend sitemap <loc> rewriting. */
function canonicalSiteFromIncoming(req) {
  const xfHost = (req.headers['x-forwarded-host'] || req.headers['X-Forwarded-Host'] || '')
    .split(',')[0]
    .trim()
    .split(':')[0];
  const host = xfHost || (req.headers.host || '').split(':')[0];
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) return null;
  const proto = (req.headers['x-forwarded-proto'] || req.headers['X-Forwarded-Proto'] || 'https')
    .split(',')[0]
    .trim() || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}

// In-memory cache to ensure instant XML responses even during backend cold starts
const sitemapMemoryCache = new Map();

function fetchXml(sitemapUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(sitemapUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.get(sitemapUrl, {
      headers: {
        'User-Agent': 'Vercel-Sitemap-Proxy/1.0',
        Accept: 'application/xml, text/xml, */*',
        ...extraHeaders
      },
      timeout: 7000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        reject(new Error(`REDIRECT:${res.headers.location.startsWith('http') ? res.headers.location : BACKEND + res.headers.location}`));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Backend returned status ${res.statusCode}`));
        return;
      }
      const ct = (res.headers['content-type'] || '').toLowerCase();
      if (ct.includes('text/html') || ct.includes('text/plain')) {
        reject(new Error(`Backend returned text, not XML: ${ct}`));
        return;
      }
      if (!ct.includes('xml') && !ct.includes('text')) {
        reject(new Error(`Invalid content type: ${ct}`));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const t = data.trim();
        if (t.startsWith('<!') || t.startsWith('<html') || t.includes('<!DOCTYPE')) {
          reject(new Error('Backend returned HTML, not XML'));
          return;
        }
        if (!t.startsWith('<?xml') && !t.startsWith('<urlset') && !t.startsWith('<sitemapindex')) {
          reject(new Error('Response is not valid XML'));
          return;
        }
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function fallbackXml(res, errorMessage, base) {
  const root = (base || process.env.REACT_APP_SITE_URL || 'https://www.moviestream.cc').replace(/\/$/, '');
  const currentDate = new Date().toISOString().split('T')[0];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${root}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${root}/movies</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${root}/tvshows</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${root}/search</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=180');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(body);
}

module.exports = async function handler(req, res) {
  // Set XML headers first so first byte is never text/html
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const path = (req.query && req.query.path) || '/sitemaps.xml';
  const sitemapPath = path.startsWith('/') ? path : `/${path}`;
  const sitemapUrl = `${BACKEND}${sitemapPath}`;
  const canonical = canonicalSiteFromIncoming(req);
  const forwardHeaders = canonical ? { 'X-Canonical-Site-Url': canonical } : {};

  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const xml = await fetchXml(sitemapUrl, forwardHeaders);
      sitemapMemoryCache.set(sitemapPath, { xml, timestamp: Date.now() });
      res.status(200).send(xml);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < 2 && (e.message.startsWith('REDIRECT:') || e.message.includes('timeout') || e.message.includes('ECONNREFUSED'))) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      break;
    }
  }

  // If live fetch fails, check memory cache first before fallback
  const cached = sitemapMemoryCache.get(sitemapPath);
  if (cached && cached.xml) {
    res.setHeader('X-Sitemap-Cache', 'MEMORY');
    res.status(200).send(cached.xml);
    return;
  }

  console.error('Sitemap proxy error:', lastError);
  if (!res.headersSent) {
    fallbackXml(res, lastError && lastError.message ? lastError.message : 'Unknown error', canonical);
  }
}
