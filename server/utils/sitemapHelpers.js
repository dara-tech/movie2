const logger = require('./logger');

// Backend/API hostnames - sitemap <loc> must be the frontend site URL, not the API
// Note: host passed in has no port (we split ':').
const BACKEND_HOST_PATTERNS = /(\.|^)(onrender\.com|render\.com|localhost|127\.0\.0\.1)$/i;

function normalizeEnvUrl(raw) {
  if (!raw) return null;
  const candidates = String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const u = new URL(candidate);
      if (u.protocol === 'https:' || u.protocol === 'http:') {
        return `${u.protocol}//${u.host}`.replace(/\/$/, '');
      }
    } catch {
      // ignore invalid candidate
    }
  }
  return null;
}

/** Hostnames allowed for X-Canonical-Site-Url (edge proxy). Comma-separated; defaults cover known deploys. */
function getAllowedSitemapHosts() {
  const extra = (process.env.SITEMAP_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const defaults = [
    'streamhd.to',
    'www.streamhd.to',
    'streamhd.cc',
    'www.streamhd.cc',
    'moviestream.cc',
    'www.moviestream.cc',
    'freemovie.online',
    'www.freemovie.online'
  ];
  const fromEnv = [process.env.SITE_URL, process.env.CLIENT_URL]
    .filter(Boolean)
    .flatMap((s) => {
      try {
        return new URL(s.trim()).hostname.toLowerCase();
      } catch {
        return [];
      }
    });
  return new Set([...defaults, ...fromEnv, ...extra]);
}

function isAllowedCanonicalHost(hostname) {
  if (!hostname) return false;
  return getAllowedSitemapHosts().has(hostname.toLowerCase());
}

/**
 * Get base URL for sitemap <loc> values. Must be the public site (e.g. moviestream.cc),
 * not the API (e.g. *.onrender.com). Shared backends use SITE_URL; multi-frontend setups
 * should send X-Canonical-Site-Url from the CDN (see client/api/sitemap-proxy.js).
 */
function getBaseUrl(req) {
  const headerRaw =
    (req && req.headers && (req.headers['x-canonical-site-url'] || req.headers['X-Canonical-Site-Url'])) || '';
  const fromHeader = normalizeEnvUrl(headerRaw);
  if (fromHeader) {
    try {
      const h = new URL(fromHeader).hostname;
      if (isAllowedCanonicalHost(h)) {
        logger.debug(`Sitemap: Using X-Canonical-Site-Url: ${fromHeader}`);
        return fromHeader;
      }
      logger.warn(`Sitemap: Rejected X-Canonical-Site-Url (host not allowed): ${fromHeader}`);
    } catch {
      /* ignore */
    }
  }

  // Prefer explicit SITE_URL when set (single-brand API)
  if (process.env.SITE_URL && !process.env.SITE_URL.includes('localhost')) {
    const envUrl = normalizeEnvUrl(process.env.SITE_URL);
    if (envUrl) return envUrl;
  }

  if (process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost')) {
    const clientUrl = normalizeEnvUrl(process.env.CLIENT_URL);
    if (clientUrl && !BACKEND_HOST_PATTERNS.test(new URL(clientUrl).hostname)) {
      return clientUrl;
    }
  }

  // Direct browser hit to the frontend host (not via Render)
  if (req && req.headers && req.headers.host) {
    const host = (req.headers.host || '').split(':')[0];
    if (BACKEND_HOST_PATTERNS.test(host) || host.includes('onrender.com') || host.includes('render.com')) {
      // API host — fall through to default
    } else if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
      const protocol = (req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http'))
        .split(',')[0]
        .trim();
      const base = `${protocol}://${req.headers.host}`.replace(/\/$/, '');
      logger.debug(`Sitemap: Using base URL from request host: ${base}`);
      return base;
    }
  }

  return process.env.SITE_URL || 'https://www.streamhd.to';
}

function escapeXml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Robustly extracts a 4-digit release year from a string or Date.
 */
function extractYear(dateVal) {
  if (!dateVal) return '';
  const str = String(dateVal);
  const match = str.match(/\b(19\d\d|20\d\d)\b/);
  if (match) return match[1];
  const y = new Date(dateVal).getFullYear();
  if (!isNaN(y) && y > 1900 && y < 2100) return String(y);
  return '';
}

/**
 * Builds high-performing SEO slug:
 * {clean-title}-{year}-{id}
 * Prioritizes TMDB ID over 24-hex Mongo ID for concise and crawlable URLs.
 */
function buildContentSlug(title, dateVal, tmdbId, mongoId) {
  const basis = slugify(title) || 'content';
  const year = extractYear(dateVal);
  const yearPart = year ? `-${year}` : '';

  const rawId = tmdbId ? String(tmdbId) : (mongoId ? String(mongoId) : '');
  const cleanId = rawId.startsWith('tmdb_') ? rawId.replace('tmdb_', '') : rawId;

  return `${basis}${yearPart}-${cleanId}`;
}

module.exports = {
  getBaseUrl,
  escapeXml,
  slugify,
  extractYear,
  buildContentSlug
};
