const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const logger = require('../utils/logger');
const { getBaseUrl } = require('../utils/sitemapHelpers');

// Generate sitemap index XML
// This lists all the individual sitemaps
router.get('/sitemap_index.xml', async (req, res) => {
  // Set headers FIRST - before any processing
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  try {
    const baseUrl = getBaseUrl(req);
    const currentDate = new Date().toISOString().split('T')[0];
    
    logger.info(`Generating sitemap index with base URL: ${baseUrl}`);

    // Count items to determine if we need multiple sitemaps
    const movieCount = await Movie.countDocuments({ isAvailable: true });
    const tvShowCount = await TvShow.countDocuments({ isAvailable: true });
    
    // Sitemap index XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Static pages sitemap
    xml += '  <sitemap>\n';
    xml += `    <loc>${baseUrl}/sitemap-static.xml</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += '  </sitemap>\n';
    
    // Movies sitemap (split into multiple if > 50,000 URLs)
    const moviesPerSitemap = 50000;
    const movieSitemapCount = Math.ceil(movieCount / moviesPerSitemap) || 1;
    
    for (let i = 0; i < movieSitemapCount; i++) {
      xml += '  <sitemap>\n';
      if (movieSitemapCount === 1) {
        xml += `    <loc>${baseUrl}/sitemap-movies.xml</loc>\n`;
      } else {
        xml += `    <loc>${baseUrl}/sitemap-movies-${i + 1}.xml</loc>\n`;
      }
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += '  </sitemap>\n';
    }
    
    // TV Shows sitemap (split into multiple if > 50,000 URLs)
    const tvShowsPerSitemap = 50000;
    const tvShowSitemapCount = Math.ceil(tvShowCount / tvShowsPerSitemap) || 1;
    
    for (let i = 0; i < tvShowSitemapCount; i++) {
      xml += '  <sitemap>\n';
      if (tvShowSitemapCount === 1) {
        xml += `    <loc>${baseUrl}/sitemap-tvshows.xml</loc>\n`;
      } else {
        xml += `    <loc>${baseUrl}/sitemap-tvshows-${i + 1}.xml</loc>\n`;
      }
      xml += `    <lastmod>${currentDate}</lastmod>\n`;
      xml += '  </sitemap>\n';
    }
    
    xml += '</sitemapindex>';
    
    res.send(xml);
    logger.info(`Sitemap index generated with ${movieSitemapCount} movie sitemap(s) and ${tvShowSitemapCount} TV show sitemap(s)`);
  } catch (error) {
    logger.error('Error generating sitemap index:', error);
    // Return minimal valid sitemap index even on error
    const errorBaseUrl = getBaseUrl(req);
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${errorBaseUrl}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
</sitemapindex>`;
    res.status(200).send(errorXml);
  }
});

module.exports = router;

