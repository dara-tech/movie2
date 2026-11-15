// Vercel Serverless Function: Pre-renders rich HTML and meta tags for search engines & social crawlers
const https = require('https');
const http = require('http');

const BACKEND = (process.env.REACT_APP_API_URL || 'https://movie-7zq4.onrender.com').replace(/\/$/, '');
const SITE_URL = 'https://www.moviestream.cc';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractId(slug) {
  if (!slug) return null;
  const raw = String(slug).trim();
  if (/^[0-9a-fA-F]{24}$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return raw;
  if (/^tmdb_\d+$/.test(raw)) return raw;

  // <id>-<slug> format
  const m1 = raw.match(/^(tmdb_\d+|\d+|[0-9a-fA-F]{24})-(.+)$/);
  if (m1) return m1[1];

  // <slug>-<id> format
  const m2 = raw.match(/-(tmdb_\d+|\d+|[0-9a-fA-F]{24})$/);
  if (m2) return m2[1];

  return raw;
}

function fetchJson(url, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'MovieStream-Bot-Prerender/1.0',
          Accept: 'application/json',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          req.destroy();
          return reject(new Error(`Status ${res.statusCode}`));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

module.exports = async function handler(req, res) {
  const type = (req.query?.type || 'movie').toLowerCase();
  const rawSlug = req.query?.slug || '';
  const itemId = extractId(rawSlug);

  const endpoint = type === 'tvshow'
    ? `${BACKEND}/api/tvshows/${encodeURIComponent(itemId)}`
    : `${BACKEND}/api/movies/${encodeURIComponent(itemId)}`;

  let item = null;
  if (itemId) {
    try {
      const response = await fetchJson(endpoint, 4000);
      item = response?.data || response?.movie || response?.tvshow || response;
    } catch (err) {
      // Backend asleep or item not found - will render fallback HTML
    }
  }

  const isTv = type === 'tvshow';
  const title = (isTv ? item?.name : item?.title) || (isTv ? 'TV Show' : 'Movie');
  const releaseDate = (isTv ? item?.firstAirDate : item?.releaseDate) || '';
  const year = releaseDate ? new Date(releaseDate).getFullYear() : '';
  const yearSuffix = year && !isNaN(year) ? ` (${year})` : '';
  const pageTitle = `${title}${yearSuffix} - Watch Free Online in Full HD | MovieStream`;
  const overview = item?.overview || `Watch ${title}${yearSuffix} in Full HD on MovieStream. Free high-speed streaming without subscription.`;
  
  const posterPath = item?.posterPath || item?.backdropPath;
  const imageUrl = posterPath
    ? (posterPath.startsWith('http') ? posterPath : `https://image.tmdb.org/t/p/w780${posterPath}`)
    : `${SITE_URL}/placeholder-movie.jpg`;

  const canonicalUrl = `${SITE_URL}/${isTv ? 'tvshow' : 'movie'}/${encodeURIComponent(rawSlug)}`;
  const genres = Array.isArray(item?.genres)
    ? item.genres.map((g) => (typeof g === 'string' ? g : g.name)).filter(Boolean)
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': isTv ? 'TVSeries' : 'Movie',
    name: title,
    description: overview,
    image: imageUrl,
    url: canonicalUrl,
    ...(releaseDate ? { datePublished: releaseDate } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(item?.voteAverage
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(item.voteAverage).toFixed(1),
            bestRating: '10',
            worstRating: '1',
            ratingCount: item.voteCount || 50,
          },
        }
      : {}),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(overview)}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="${isTv ? 'video.tv_show' : 'video.movie'}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(overview)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="780" />
  <meta property="og:image:height" content="1170" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="MovieStream" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@MovieStream" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(overview)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body style="background-color: #0b0f19; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 2rem;">
  <div id="root">
    <main style="max-width: 800px; margin: 0 auto;">
      <h1 style="font-size: 2.25rem; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem;">${escapeHtml(title)}${escapeHtml(yearSuffix)}</h1>
      ${releaseDate ? `<p style="color: #9ca3af; font-size: 0.95rem; margin-bottom: 1rem;">Released: ${escapeHtml(releaseDate)}${genres.length ? ` • Genres: ${escapeHtml(genres.join(', '))}` : ''}</p>` : ''}
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" style="max-width: 320px; border-radius: 8px; margin-bottom: 1.5rem; display: block;" />
      <h2 style="font-size: 1.25rem; font-weight: 600; color: #e5e7eb; margin-bottom: 0.5rem;">Synopsis</h2>
      <p style="color: #d1d5db; line-height: 1.7; font-size: 1.05rem;">${escapeHtml(overview)}</p>
      <div style="margin-top: 2rem;">
        <a href="${escapeHtml(canonicalUrl)}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 600;">Watch ${escapeHtml(title)} Online Free</a>
      </div>
    </main>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).send(html);
};
