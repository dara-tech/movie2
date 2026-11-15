const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const SiteSettings = require('../models/SiteSettings');
const logger = require('../utils/logger');
const { getBaseUrl, escapeXml, slugify } = require('../utils/sitemapHelpers');

// Cache object with 10-minute TTL
const feedCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Format RFC 822 Date for RSS 2.0 (e.g. "Wed, 14 Oct 2026 15:30:00 GMT")
 */
function toRfc822Date(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

/**
 * Build rich RSS 2.0 XML
 */
function buildRssXml({ channelTitle, channelDescription, channelLink, feedUrl, items }) {
  const lastBuildDate = toRfc822Date(new Date());

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title><![CDATA[${channelTitle}]]></title>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <link>${escapeXml(channelLink)}</link>
    <description><![CDATA[${channelDescription}]]></description>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <language>en-US</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <generator>MovieStream RSS Generator v1.0</generator>
    <image>
      <url>${escapeXml(channelLink)}/android-chrome-144x144.png</url>
      <title><![CDATA[${channelTitle}]]></title>
      <link>${escapeXml(channelLink)}</link>
    </image>
`;

  items.forEach(item => {
    const pubDate = toRfc822Date(item.pubDate);
    const posterUrl = item.posterPath
      ? (item.posterPath.startsWith('http') ? item.posterPath : `https://image.tmdb.org/t/p/w780${item.posterPath}`)
      : null;
    const thumbUrl = item.posterPath
      ? (item.posterPath.startsWith('http') ? item.posterPath : `https://image.tmdb.org/t/p/w342${item.posterPath}`)
      : null;

    const ratingBadge = item.voteAverage && item.voteAverage > 0
      ? `⭐ ${item.voteAverage.toFixed(1)}/10`
      : '⭐ 8.0/10';

    const genresText = Array.isArray(item.genres)
      ? item.genres.map(g => (typeof g === 'string' ? g : g.name)).filter(Boolean).join(', ')
      : '';

    const summaryHtml = `
      <div style="font-family:sans-serif;max-width:600px;color:#222;">
        ${posterUrl ? `<p><img src="${escapeXml(posterUrl)}" alt="${escapeXml(item.title)}" style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" /></p>` : ''}
        <p style="font-size:14px;color:#555;"><b>Rating:</b> ${ratingBadge} | <b>Type:</b> ${item.type === 'movie' ? 'Cinema Movie' : 'TV Series'} ${genresText ? `| <b>Genres:</b> ${escapeXml(genresText)}` : ''}</p>
        <p style="font-size:15px;line-height:1.5;">${item.overview ? escapeXml(item.overview) : ''}</p>
        <p style="margin-top:16px;">
          <a href="${escapeXml(item.url)}" style="display:inline-block;padding:10px 20px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
            🍿 Stream Free on MovieStream
          </a>
        </p>
      </div>
    `.trim();

    xml += `    <item>
      <title><![CDATA[${item.title} (${item.year}) ${ratingBadge}]]></title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[MovieStream]]></dc:creator>
`;

    if (genresText) {
      item.genres.forEach(g => {
        const name = typeof g === 'string' ? g : g.name;
        if (name) {
          xml += `      <category><![CDATA[${name}]]></category>\n`;
        }
      });
    }

    if (posterUrl) {
      xml += `      <enclosure url="${escapeXml(posterUrl)}" length="0" type="image/jpeg" />\n`;
      xml += `      <media:content url="${escapeXml(posterUrl)}" medium="image" type="image/jpeg" />\n`;
      if (thumbUrl) {
        xml += `      <media:thumbnail url="${escapeXml(thumbUrl)}" />\n`;
      }
    }

    xml += `      <description><![CDATA[${summaryHtml}]]></description>\n`;
    xml += `      <content:encoded><![CDATA[${summaryHtml}]]></content:encoded>\n`;
    xml += `    </item>\n`;
  });

  xml += `  </channel>\n</rss>`;
  return xml;
}

/**
 * Master Feed (Latest Movies & Series)
 */
async function renderMasterRss(req, res) {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.set('X-Content-Type-Options', 'nosniff');

  const cacheKey = 'master';
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.send(cached.xml);
  }

  try {
    const baseUrl = getBaseUrl(req);
    const settings = await SiteSettings.getSettings().catch(() => null);
    const siteName = settings?.siteName || 'MovieStream';

    // Fetch latest 30 movies & 20 TV shows
    const [movies, tvShows] = await Promise.all([
      Movie.find({ posterPath: { $ne: null, $ne: '' } })
        .populate('genres', 'name')
        .sort({ createdAt: -1, releaseDate: -1 })
        .limit(30)
        .lean(),
      TvShow.find({ posterPath: { $ne: null, $ne: '' } })
        .populate('genres', 'name')
        .sort({ createdAt: -1, firstAirDate: -1 })
        .limit(20)
        .lean()
    ]);

    const items = [];

    movies.forEach(m => {
      const year = m.releaseDate ? new Date(m.releaseDate).getFullYear() : (m.year || '');
      const slug = slugify(m.title);
      items.push({
        id: m._id,
        type: 'movie',
        title: m.title,
        year,
        url: `${baseUrl}/movie/${slug}-${m._id}`,
        posterPath: m.posterPath,
        overview: m.overview,
        voteAverage: m.voteAverage,
        genres: m.genres || [],
        pubDate: m.createdAt || m.releaseDate || new Date()
      });
    });

    tvShows.forEach(t => {
      const year = t.firstAirDate ? new Date(t.firstAirDate).getFullYear() : '';
      const slug = slugify(t.name);
      items.push({
        id: t._id,
        type: 'tv',
        title: t.name,
        year,
        url: `${baseUrl}/tvshow/${slug}-${t._id}`,
        posterPath: t.posterPath,
        overview: t.overview,
        voteAverage: t.voteAverage,
        genres: t.genres || [],
        pubDate: t.createdAt || t.firstAirDate || new Date()
      });
    });

    // Sort combined items by pubDate descending
    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const xml = buildRssXml({
      channelTitle: `${siteName} - Latest Movies & TV Shows HD`,
      channelDescription: `Stream the latest movies and TV series in 1080p Full HD online free on ${siteName}. Updated continuously with official trailers, posters, and ratings.`,
      channelLink: baseUrl,
      feedUrl: `${baseUrl}/rss.xml`,
      items: items.slice(0, 50)
    });

    feedCache.set(cacheKey, { timestamp: Date.now(), xml });
    res.send(xml);
  } catch (error) {
    logger.error('Error generating master RSS feed:', error);
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
  }
}

/**
 * Movies Only Feed
 */
async function renderMoviesRss(req, res) {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.set('X-Content-Type-Options', 'nosniff');

  const cacheKey = 'movies';
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.send(cached.xml);
  }

  try {
    const baseUrl = getBaseUrl(req);
    const settings = await SiteSettings.getSettings().catch(() => null);
    const siteName = settings?.siteName || 'MovieStream';

    const movies = await Movie.find({ posterPath: { $ne: null, $ne: '' } })
      .populate('genres', 'name')
      .sort({ createdAt: -1, releaseDate: -1 })
      .limit(50)
      .lean();

    const items = movies.map(m => {
      const year = m.releaseDate ? new Date(m.releaseDate).getFullYear() : (m.year || '');
      const slug = slugify(m.title);
      return {
        id: m._id,
        type: 'movie',
        title: m.title,
        year,
        url: `${baseUrl}/movie/${slug}-${m._id}`,
        posterPath: m.posterPath,
        overview: m.overview,
        voteAverage: m.voteAverage,
        genres: m.genres || [],
        pubDate: m.createdAt || m.releaseDate || new Date()
      };
    });

    const xml = buildRssXml({
      channelTitle: `${siteName} - Latest Movies Feed`,
      channelDescription: `Stream newly released cinema movies in 1080p HD free online on ${siteName}.`,
      channelLink: `${baseUrl}/movies`,
      feedUrl: `${baseUrl}/rss/movies.xml`,
      items
    });

    feedCache.set(cacheKey, { timestamp: Date.now(), xml });
    res.send(xml);
  } catch (error) {
    logger.error('Error generating movies RSS feed:', error);
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
  }
}

/**
 * TV Shows Only Feed
 */
async function renderTvRss(req, res) {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.set('X-Content-Type-Options', 'nosniff');

  const cacheKey = 'tv';
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.send(cached.xml);
  }

  try {
    const baseUrl = getBaseUrl(req);
    const settings = await SiteSettings.getSettings().catch(() => null);
    const siteName = settings?.siteName || 'MovieStream';

    const tvShows = await TvShow.find({ posterPath: { $ne: null, $ne: '' } })
      .populate('genres', 'name')
      .sort({ createdAt: -1, firstAirDate: -1 })
      .limit(50)
      .lean();

    const items = tvShows.map(t => {
      const year = t.firstAirDate ? new Date(t.firstAirDate).getFullYear() : '';
      const slug = slugify(t.name);
      return {
        id: t._id,
        type: 'tv',
        title: t.name,
        year,
        url: `${baseUrl}/tvshow/${slug}-${t._id}`,
        posterPath: t.posterPath,
        overview: t.overview,
        voteAverage: t.voteAverage,
        genres: t.genres || [],
        pubDate: t.createdAt || t.firstAirDate || new Date()
      };
    });

    const xml = buildRssXml({
      channelTitle: `${siteName} - Latest TV Series Feed`,
      channelDescription: `Watch new TV series, drama, and anime episodes free online in HD on ${siteName}.`,
      channelLink: `${baseUrl}/tvshows`,
      feedUrl: `${baseUrl}/rss/tv.xml`,
      items
    });

    feedCache.set(cacheKey, { timestamp: Date.now(), xml });
    res.send(xml);
  } catch (error) {
    logger.error('Error generating TV shows RSS feed:', error);
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
  }
}

/**
 * Top Rated / Trending Feed
 */
async function renderTopRss(req, res) {
  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=600, s-maxage=600');
  res.set('X-Content-Type-Options', 'nosniff');

  const cacheKey = 'trending';
  const cached = feedCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.send(cached.xml);
  }

  try {
    const baseUrl = getBaseUrl(req);
    const settings = await SiteSettings.getSettings().catch(() => null);
    const siteName = settings?.siteName || 'MovieStream';

    const [movies, tvShows] = await Promise.all([
      Movie.find({ posterPath: { $ne: null, $ne: '' }, voteAverage: { $gte: 7.0 }, voteCount: { $gte: 40 } })
        .populate('genres', 'name')
        .sort({ popularity: -1, voteAverage: -1 })
        .limit(30)
        .lean(),
      TvShow.find({ posterPath: { $ne: null, $ne: '' }, voteAverage: { $gte: 7.2 }, voteCount: { $gte: 20 } })
        .populate('genres', 'name')
        .sort({ popularity: -1, voteAverage: -1 })
        .limit(20)
        .lean()
    ]);

    const items = [];

    movies.forEach(m => {
      const year = m.releaseDate ? new Date(m.releaseDate).getFullYear() : (m.year || '');
      const slug = slugify(m.title);
      items.push({
        id: m._id,
        type: 'movie',
        title: m.title,
        year,
        url: `${baseUrl}/movie/${slug}-${m._id}`,
        posterPath: m.posterPath,
        overview: m.overview,
        voteAverage: m.voteAverage,
        genres: m.genres || [],
        pubDate: m.createdAt || m.releaseDate || new Date()
      });
    });

    tvShows.forEach(t => {
      const year = t.firstAirDate ? new Date(t.firstAirDate).getFullYear() : '';
      const slug = slugify(t.name);
      items.push({
        id: t._id,
        type: 'tv',
        title: t.name,
        year,
        url: `${baseUrl}/tvshow/${slug}-${t._id}`,
        posterPath: t.posterPath,
        overview: t.overview,
        voteAverage: t.voteAverage,
        genres: t.genres || [],
        pubDate: t.createdAt || t.firstAirDate || new Date()
      });
    });

    items.sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));

    const xml = buildRssXml({
      channelTitle: `${siteName} - Top Rated & Trending Movies & Series`,
      channelDescription: `The highest rated movies and top trending TV shows available to stream on ${siteName}.`,
      channelLink: baseUrl,
      feedUrl: `${baseUrl}/rss/top.xml`,
      items: items.slice(0, 50)
    });

    feedCache.set(cacheKey, { timestamp: Date.now(), xml });
    res.send(xml);
  } catch (error) {
    logger.error('Error generating top RSS feed:', error);
    res.status(500).send('<?xml version="1.0"?><rss version="2.0"><channel><title>Error</title></channel></rss>');
  }
}

// Master feed endpoints
router.get('/rss.xml', renderMasterRss);
router.get('/feed.xml', renderMasterRss);
router.get('/rss', renderMasterRss);
router.get('/feed', renderMasterRss);

// Categorized feeds
router.get('/rss/movies.xml', renderMoviesRss);
router.get('/feed/movies.xml', renderMoviesRss);

router.get('/rss/tv.xml', renderTvRss);
router.get('/rss/series.xml', renderTvRss);
router.get('/feed/tv.xml', renderTvRss);

router.get('/rss/top.xml', renderTopRss);
router.get('/rss/trending.xml', renderTopRss);
router.get('/feed/top.xml', renderTopRss);

module.exports = router;
