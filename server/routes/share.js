const express = require('express');
const hybridService = require('../services/hybridService');

const router = express.Router();

const SITE_NAME = process.env.SITE_NAME || 'MovieStream';
/** Public SPA origin for og:url, redirects, and fallback images */
const CLIENT_PUBLIC_URL = (
  process.env.CLIENT_PUBLIC_URL ||
  process.env.CLIENT_URL ||
  process.env.REACT_APP_SITE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const TWITTER_SITE = (
  process.env.TWITTER_SITE ||
  process.env.REACT_APP_TWITTER_SITE ||
  '@MovieStream'
).trim();

const TWITTER_CREATOR = (process.env.TWITTER_CREATOR || process.env.REACT_APP_TWITTER_CREATOR || '')
  .trim();

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

function movieAppPath(movie) {
  return `/movie/${slugify(movie.title)}-${movie._id}`;
}

function tvAppPath(tv) {
  return `/tvshow/${slugify(tv.name)}-${tv._id}`;
}

function ogImageMimeType(imageUrl) {
  const base = String(imageUrl).split('?')[0].toLowerCase();
  if (base.endsWith('.png')) return 'image/png';
  if (base.endsWith('.webp')) return 'image/webp';
  if (base.endsWith('.gif')) return 'image/gif';
  if (base.endsWith('.svg')) return 'image/svg+xml';
  return 'image/jpeg';
}

function genreTagList(entity) {
  const raw = entity.genres || [];
  return raw
    .map((g) => (typeof g === 'string' ? g : g && g.name))
    .filter(Boolean)
    .slice(0, 32);
}

function buildOgHtml({
  title,
  description,
  image,
  canonicalUrl,
  redirectUrl,
  ogType,
  imageAlt,
  videoReleaseDate,
  videoTags,
  videoDurationSeconds
}) {
  const t = escapeHtml(title);
  const d = escapeHtml(description.slice(0, 500));
  const img = escapeHtml(image);
  const canon = escapeHtml(canonicalUrl);
  const go = escapeHtml(redirectUrl);
  const alt = escapeHtml(imageAlt || title);
  const mime = ogImageMimeType(image);
  const secureImg = image.startsWith('https://')
    ? `<meta property="og:image:secure_url" content="${escapeHtml(image)}" />`
    : '';
  const tags = Array.isArray(videoTags) ? videoTags.filter(Boolean).slice(0, 32) : [];
  const tagBlock = tags
    .map((tag) => `<meta property="video:tag" content="${escapeHtml(String(tag))}" />`)
    .join('\n');
  const releaseLine = videoReleaseDate
    ? `<meta property="video:release_date" content="${escapeHtml(String(videoReleaseDate))}" />`
    : '';
  const durLine =
    videoDurationSeconds != null && Number.isFinite(Number(videoDurationSeconds))
      ? `<meta property="video:duration" content="${escapeHtml(String(Math.round(Number(videoDurationSeconds))))}" />`
      : '';
  const twSite = escapeHtml(TWITTER_SITE.startsWith('@') ? TWITTER_SITE : `@${TWITTER_SITE}`);
  const creatorNorm = TWITTER_CREATOR
    ? TWITTER_CREATOR.startsWith('@')
      ? TWITTER_CREATOR
      : `@${TWITTER_CREATOR}`
    : '';
  const creatorLine = creatorNorm
    ? `<meta name="twitter:creator" content="${escapeHtml(creatorNorm)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${t} | ${escapeHtml(SITE_NAME)}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${canon}" />
<meta property="og:type" content="${escapeHtml(ogType)}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
${secureImg}
<meta property="og:image:type" content="${escapeHtml(mime)}" />
<meta property="og:image:width" content="1280" />
<meta property="og:image:height" content="720" />
<meta property="og:image:alt" content="${alt}" />
<meta property="og:url" content="${canon}" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:locale" content="en_US" />
${releaseLine}
${durLine}
${tagBlock}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="${twSite}" />
${creatorLine}
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta name="twitter:image:alt" content="${alt}" />
<meta http-equiv="refresh" content="0;url=${go}" />
</head>
<body style="margin:0;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center;">
  <div>
    <p style="margin:0 0 12px;font-size:15px;">Opening…</p>
    <p style="margin:0;font-size:14px;opacity:.85"><a href="${go}" style="color:#93c5fd">${t}</a></p>
  </div>
</body>
</html>`;
}

router.get('/movie/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const movie = await hybridService.getMovieById(rawId);
    if (!movie) {
      return res.status(404).type('html').send('<!DOCTYPE html><html><body>Not found</body></html>');
    }

    const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : '';
    const title = year ? `${movie.title} (${year})` : movie.title;
    const description =
      movie.overview ||
      `Watch ${movie.title} on ${SITE_NAME}.`;
    const image = movie.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${movie.backdropPath}`
      : movie.posterPath
      ? `https://image.tmdb.org/t/p/w780${movie.posterPath}`
      : `${CLIENT_PUBLIC_URL}/placeholder-movie.jpg`;

    const appPath = movieAppPath(movie);
    const canonicalUrl = `${CLIENT_PUBLIC_URL}${appPath}`;
    const redirectUrl = canonicalUrl;

    const genreNames = genreTagList(movie);
    const durationSec =
      movie.runtime != null && Number.isFinite(Number(movie.runtime))
        ? Number(movie.runtime) * 60
        : null;

    res.type('html').send(
      buildOgHtml({
        title,
        description,
        image,
        canonicalUrl,
        redirectUrl,
        ogType: 'video.movie',
        imageAlt: `${title} — poster`,
        videoReleaseDate: movie.releaseDate || null,
        videoTags: genreNames,
        videoDurationSeconds: durationSec
      })
    );
  } catch (e) {
    res.status(500).type('html').send('<!DOCTYPE html><html><body>Error</body></html>');
  }
});

router.get('/tv/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const tv = await hybridService.getTvShowById(rawId);
    if (!tv) {
      return res.status(404).type('html').send('<!DOCTYPE html><html><body>Not found</body></html>');
    }

    const year = tv.firstAirDate ? new Date(tv.firstAirDate).getFullYear() : '';
    const title = year ? `${tv.name} (${year})` : tv.name;
    const description =
      tv.overview ||
      `Watch ${tv.name} on ${SITE_NAME}.`;
    const image = tv.backdropPath
      ? `https://image.tmdb.org/t/p/w1280${tv.backdropPath}`
      : tv.posterPath
      ? `https://image.tmdb.org/t/p/w780${tv.posterPath}`
      : `${CLIENT_PUBLIC_URL}/placeholder-movie.jpg`;

    const appPath = tvAppPath(tv);
    const canonicalUrl = `${CLIENT_PUBLIC_URL}${appPath}`;
    const redirectUrl = canonicalUrl;

    const genreNames = genreTagList(tv);

    res.type('html').send(
      buildOgHtml({
        title,
        description,
        image,
        canonicalUrl,
        redirectUrl,
        ogType: 'video.tv_show',
        imageAlt: `${title} — poster`,
        videoReleaseDate: tv.firstAirDate || null,
        videoTags: genreNames,
        videoDurationSeconds: null
      })
    );
  } catch (e) {
    res.status(500).type('html').send('<!DOCTYPE html><html><body>Error</body></html>');
  }
});

module.exports = router;
