const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const logger = require('../utils/logger');
const { getBaseUrl, escapeXml, slugify, extractYear, buildContentSlug } = require('../utils/sitemapHelpers');

// Generate sitemap XML
// Support both sitemap.xml (redirect) and sitemaps.xml
// CRITICAL: Use 301 permanent redirect - Google prefers this
router.get('/sitemap.xml', (req, res) => {
  res.redirect(301, '/sitemaps.xml');
});

router.get('/sitemaps.xml', async (req, res) => {
  // CRITICAL: Set headers FIRST, before any processing
  // This ensures Googlebot always gets proper XML headers
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  // NO conditional logic based on User-Agent, headers, or anything else
  // ALWAYS return the same XML format for EVERY request
  
  try {
    const baseUrl = getBaseUrl(req);
    const currentDate = new Date().toISOString().split('T')[0];

    // Enhanced logging for debugging domain detection
    logger.info(`Generating sitemap with base URL: ${baseUrl}`, {
      host: req.headers.host,
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'x-forwarded-host': req.headers['x-forwarded-host'],
      referer: req.headers.referer,
      origin: req.headers.origin,
      secure: req.secure
    });

    // Start building XML - ALWAYS the same format
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages with high priority - expanded for better SEO
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/movies', priority: '0.9', changefreq: 'daily' },
      { url: '/tvshows', priority: '0.9', changefreq: 'daily' },
      { url: '/search', priority: '0.8', changefreq: 'daily' },
      { url: '/movies?sort=trending', priority: '0.9', changefreq: 'daily' },
      { url: '/movies?sort=popular', priority: '0.9', changefreq: 'daily' },
      { url: '/movies?sort=top-rated', priority: '0.9', changefreq: 'weekly' },
      { url: '/movies?sort=upcoming', priority: '0.8', changefreq: 'daily' },
      { url: '/tvshows?sort=trending', priority: '0.9', changefreq: 'daily' },
      { url: '/tvshows?sort=popular', priority: '0.9', changefreq: 'daily' },
      { url: '/tvshows?sort=top-rated', priority: '0.9', changefreq: 'weekly' },
      { url: '/roadmaps', priority: '0.7', changefreq: 'weekly' },
    ];

    staticPages.forEach(page => {
      // Ensure URL is properly formatted (no double slashes)
      const cleanUrl = (baseUrl + page.url).replace(/([^:]\/)\/+/g, '$1');
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(cleanUrl)}</loc>\n`;
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    });

    // Top movies only in main sitemap (full list in sitemap-movies.xml via sitemap_index)
    const movies = await Movie.find({ isAvailable: true })
      .select('_id tmdbId title releaseDate posterPath overview updatedAt popularity voteAverage runtime genres')
      .sort({ popularity: -1, releaseDate: -1 })
      .limit(500)
      .lean();

    movies.forEach((movie, index) => {
      const lastmod = movie.updatedAt 
        ? new Date(movie.updatedAt).toISOString().split('T')[0]
        : currentDate;
      
      // Dynamic priority based on popularity (0.5 to 0.9)
      const popularityScore = movie.popularity || 0;
      const priority = Math.min(0.9, Math.max(0.5, 0.5 + (popularityScore / 1000) * 0.4)).toFixed(1);
      
      // Dynamic changefreq - recent movies change more often
      const year = extractYear(movie.releaseDate);
      const releaseYear = year ? parseInt(year) : 0;
      const currentYear = new Date().getFullYear();
      const changefreq = (currentYear - releaseYear) <= 1 ? 'daily' : (currentYear - releaseYear) <= 3 ? 'weekly' : 'monthly';
      
      const slug = buildContentSlug(movie.title, movie.releaseDate, movie.tmdbId, movie._id);
      const movieUrl = `${baseUrl}/movie/${slug}`.replace(/([^:]\/)\/+/g, '$1');
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(movieUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      
      xml += '  </url>\n';
    });

    // Top TV shows only in main sitemap (full list in sitemap-tvshows.xml via sitemap_index)
    const tvShows = await TvShow.find({ isAvailable: true })
      .select('_id tmdbId name firstAirDate posterPath overview updatedAt popularity voteAverage genres')
      .sort({ popularity: -1, firstAirDate: -1 })
      .limit(500)
      .lean();

    tvShows.forEach((tvShow, index) => {
      const lastmod = tvShow.updatedAt 
        ? new Date(tvShow.updatedAt).toISOString().split('T')[0]
        : currentDate;
      
      // Dynamic priority based on popularity
      const popularityScore = tvShow.popularity || 0;
      const priority = Math.min(0.9, Math.max(0.5, 0.5 + (popularityScore / 1000) * 0.4)).toFixed(1);
      
      // Dynamic changefreq - recent shows change more often
      const year = extractYear(tvShow.firstAirDate);
      const releaseYear = year ? parseInt(year) : 0;
      const currentYear = new Date().getFullYear();
      const changefreq = (currentYear - releaseYear) <= 1 ? 'daily' : (currentYear - releaseYear) <= 3 ? 'weekly' : 'monthly';
      
      const slug = buildContentSlug(tvShow.name, tvShow.firstAirDate, tvShow.tmdbId, tvShow._id);
      const tvShowUrl = `${baseUrl}/tvshow/${slug}`.replace(/([^:]\/)\/+/g, '$1');
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(tvShowUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      xml += `    <priority>${priority}</priority>\n`;
      
      xml += '  </url>\n';
    });

    // Get genres for genre pages
    const genres = await Genre.find()
      .select('name slug')
      .lean();

    genres.forEach(genre => {
      if (genre.slug) {
        // Movies by genre
        const genreUrl = `${baseUrl}/movies?genre=${encodeURIComponent(genre.slug)}`.replace(/([^:]\/)\/+/g, '$1');
        xml += '  <url>\n';
        xml += `    <loc>${escapeXml(genreUrl)}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
        
        // TV shows by genre
        const tvGenreUrl = `${baseUrl}/tvshows?genre=${encodeURIComponent(genre.slug)}`.replace(/([^:]\/)\/+/g, '$1');
        xml += '  <url>\n';
        xml += `    <loc>${escapeXml(tvGenreUrl)}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }
    });
    
    // Add year-based pages for better SEO (last 5 years)
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= currentYear - 5; year--) {
      const yearUrl = `${baseUrl}/movies?year=${year}`.replace(/([^:]\/)\/+/g, '$1');
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(yearUrl)}</loc>\n`;
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.6</priority>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    // Send XML - headers already set above
    // This ensures consistent response for ALL clients (browser, Googlebot, curl)
    res.send(xml);
    
    logger.info(`Sitemap generated successfully with ${staticPages.length} static pages, ${movies.length} movies, ${tvShows.length} TV shows, ${genres.length} genres, and year-based pages`);
  } catch (error) {
    logger.error('Error generating sitemap:', error);
    // Return a minimal valid sitemap even on error
    // Headers already set above - ALWAYS return valid XML
    const errorBaseUrl = getBaseUrl(req);
    const errorXml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>' + errorBaseUrl + '/</loc>\n    <lastmod>' + new Date().toISOString().split('T')[0] + '</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>';
    // Headers already set - just send the XML
    res.status(200).send(errorXml); // Return 200, not 500, so Google doesn't reject it
  }
});

module.exports = router;

