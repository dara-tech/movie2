const express = require('express');
const axios = require('axios');
const { requireAdmin } = require('../middleware/adminAuth');
const logger = require('../utils/logger');

const router = express.Router();
router.use(requireAdmin);

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function normalizeOrigin(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  try {
    const u = new URL(urlString.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

function getAllowedProbeOrigins() {
  const origins = new Set();
  [process.env.SITE_URL, process.env.CLIENT_URL].forEach((raw) => {
    const o = normalizeOrigin(raw);
    if (o) origins.add(o);
  });
  return origins;
}

function isProbeUrlAllowed(urlString) {
  try {
    const u = new URL(urlString);
    if (u.username || u.password) return false;
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const allowed = getAllowedProbeOrigins();
    if (allowed.size === 0) return false;
    return allowed.has(u.origin);
  } catch {
    return false;
  }
}

router.get('/search-console', (req, res) => {
  const siteUrl = (process.env.SITE_URL || '').trim() || null;
  const clientUrl = (process.env.CLIENT_URL || '').trim() || null;

  let sitemapUrl = null;
  let robotsUrl = null;
  const base = siteUrl ? (siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`) : null;
  if (base) {
    try {
      sitemapUrl = new URL('sitemaps.xml', base).href;
      robotsUrl = new URL('robots.txt', base).href;
    } catch {
      sitemapUrl = null;
      robotsUrl = null;
    }
  }

  res.json({
    success: true,
    data: {
      siteUrl,
      clientUrl,
      sitemapUrl,
      robotsUrl,
      searchConsolePropertyHint: siteUrl || clientUrl
    }
  });
});

/** Open Graph / social preview: URLs admins use in external validators */
router.get('/open-graph', (req, res) => {
  const trim = (s) => (typeof s === 'string' ? s.trim().replace(/\/$/, '') : '');
  const siteUrl = trim(process.env.SITE_URL) || null;
  const clientUrl = trim(process.env.CLIENT_URL) || null;
  const clientPublic =
    trim(process.env.CLIENT_PUBLIC_URL) || clientUrl || siteUrl || null;

  const spaRoot = clientPublic ? `${clientPublic}/` : null;
  const defaultOgImageUrl = clientPublic ? `${clientPublic}/placeholder-movie.jpg` : null;

  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  const apiBase = host ? `${proto}://${host}` : null;

  res.json({
    success: true,
    data: {
      siteUrl,
      clientUrl,
      clientPublicUrl: clientPublic,
      spaRoot,
      defaultOgImageUrl,
      shareMoviePrefix: apiBase ? `${apiBase}/api/share/movie/` : null,
      shareTvPrefix: apiBase ? `${apiBase}/api/share/tv/` : null,
      validators: {
        facebook: 'https://developers.facebook.com/tools/debug/',
        twitter: 'https://cards-dev.twitter.com/validator',
        linkedin: 'https://www.linkedin.com/post-inspector/',
        opengraphXyz: 'https://www.opengraph.xyz/'
      }
    }
  });
});

router.post('/search-console/probe', async (req, res) => {
  const bodyUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  const siteBase = normalizeOrigin(process.env.SITE_URL);
  const defaultUrl = siteBase ? `${siteBase}/` : null;
  const target = bodyUrl || defaultUrl;

  if (!target) {
    return res.status(400).json({
      success: false,
      message:
        'Set SITE_URL on the server, or send JSON body { "url": "https://your-public-site/" } using the same origin as SITE_URL or CLIENT_URL.'
    });
  }

  if (!isProbeUrlAllowed(target)) {
    return res.status(400).json({
      success: false,
      message: 'URL origin must match SITE_URL or CLIENT_URL.'
    });
  }

  const started = Date.now();
  try {
    const response = await axios.get(target, {
      timeout: 25000,
      maxRedirects: 5,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(data) => data],
      headers: {
        'User-Agent': GOOGLEBOT_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxContentLength: 12 * 1024 * 1024,
      maxBodyLength: 12 * 1024 * 1024
    });

    const elapsedMs = Date.now() - started;
    const rawCt = response.headers['content-type'] || '';
    const contentType = rawCt.split(';')[0].trim().toLowerCase();
    const rawData = response.data;
    let body = '';
    if (typeof rawData === 'string') {
      body = rawData;
    } else if (Buffer.isBuffer(rawData)) {
      body = rawData.toString('utf8');
    } else if (rawData != null) {
      body = String(rawData);
    }
    const head = body.slice(0, 4000);
    const looksLikeXml =
      /^\s*<\?xml/i.test(head) ||
      /<urlset[\s/>]/i.test(head) ||
      /<sitemapindex[\s/>]/i.test(head);
    const looksLikeHtml = /<!doctype|<html[\s>]/i.test(head.slice(0, 2000));
    const isXmlContentType =
      /^application\/xml$/i.test(contentType) ||
      /^text\/xml$/i.test(contentType) ||
      contentType.endsWith('+xml');

    let bodySummary = null;
    if (body.length > 0) {
      if (looksLikeXml || isXmlContentType) {
        bodySummary = 'XML (sitemap or feed) - expected for .xml URLs';
      } else if (looksLikeHtml) {
        bodySummary = 'HTML document';
      } else {
        bodySummary = 'Body is not HTML or obvious XML — check Content-Type';
      }
    }

    return res.json({
      success: true,
      data: {
        url: target,
        status: response.status,
        contentType,
        elapsedMs,
        ok: response.status >= 200 && response.status < 400,
        bodyHint:
          body.length > 0
            ? {
                length: body.length,
                looksLikeHtml,
                looksLikeXml,
                isXmlContentType,
                summary: bodySummary
              }
            : null
      }
    });
  } catch (err) {
    const elapsedMs = Date.now() - started;
    logger.warn('Admin SEO probe failed', { message: err.message, target });
    return res.json({
      success: true,
      data: {
        url: target,
        ok: false,
        elapsedMs,
        error: err.code || err.message || 'Request failed'
      }
    });
  }
});

module.exports = router;
