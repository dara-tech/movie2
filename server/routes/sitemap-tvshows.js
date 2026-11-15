const express = require('express');
const router = express.Router();
const TvShow = require('../models/TvShow');
const logger = require('../utils/logger');
const { getBaseUrl, escapeXml, slugify } = require('../utils/sitemapHelpers');

// Generate TV shows sitemap XML
router.get('/sitemap-tvshows.xml', async (req, res) => {
  // Set headers FIRST
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  try {
    const baseUrl = getBaseUrl(req);
    const currentDate = new Date().toISOString().split('T')[0];
    const page = parseInt(req.query.page) || 1;
    const limit = 50000; // Max URLs per sitemap
    const skip = (page - 1) * limit;
    
    logger.info(`Generating TV shows sitemap page ${page} with base URL: ${baseUrl}`);
    
    // Get TV shows with pagination
    const tvShows = await TvShow.find({ isAvailable: true })
      .select('_id name firstAirDate posterPath overview updatedAt')
      .sort({ popularity: -1, firstAirDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Start building XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    tvShows.forEach((tvShow, index) => {
      const tvShowId = tvShow._id.toString();
      const lastmod = tvShow.updatedAt 
        ? new Date(tvShow.updatedAt).toISOString().split('T')[0]
        : currentDate;
      
      let yearStr = '';
      if (tvShow.firstAirDate) {
        const y = new Date(tvShow.firstAirDate).getFullYear();
        if (!isNaN(y) && y > 1900 && y < 2100) yearStr = `-${y}`;
      }
      const tvSlug = slugify(tvShow.name);
      const tvShowUrl = `${baseUrl}/tvshow/${tvSlug}${yearStr}-${tvShowId}`.replace(/([^:]\/)\/+/g, '$1');
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(tvShowUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    res.send(xml);
    logger.info(`TV shows sitemap page ${page} generated with ${tvShows.length} TV shows`);
  } catch (error) {
    logger.error('Error generating TV shows sitemap:', error);
    const errorBaseUrl = getBaseUrl(req);
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${errorBaseUrl}/tvshows</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    res.status(200).send(errorXml);
  }
});

// Support paginated sitemaps (sitemap-tvshows-1.xml, sitemap-tvshows-2.xml, etc.)
router.get('/sitemap-tvshows-:page.xml', async (req, res) => {
  // Set headers FIRST
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  try {
    const baseUrl = getBaseUrl(req);
    const currentDate = new Date().toISOString().split('T')[0];
    const page = parseInt(req.params.page) || 1;
    const limit = 50000;
    const skip = (page - 1) * limit;
    
    const tvShows = await TvShow.find({ isAvailable: true })
      .select('_id name firstAirDate posterPath overview updatedAt')
      .sort({ popularity: -1, firstAirDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    tvShows.forEach((tvShow, index) => {
      const tvShowId = tvShow._id.toString();
      const lastmod = tvShow.updatedAt 
        ? new Date(tvShow.updatedAt).toISOString().split('T')[0]
        : currentDate;
      let yearStr = '';
      if (tvShow.firstAirDate) {
        const y = new Date(tvShow.firstAirDate).getFullYear();
        if (!isNaN(y) && y > 1900 && y < 2100) yearStr = `-${y}`;
      }
      const tvSlug = slugify(tvShow.name);
      const tvShowUrl = `${baseUrl}/tvshow/${tvSlug}${yearStr}-${tvShowId}`.replace(/([^:]\/)\/+/g, '$1');
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(tvShowUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    res.send(xml);
  } catch (error) {
    logger.error('Error generating paginated TV shows sitemap:', error);
    const errorBaseUrl = getBaseUrl(req);
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${errorBaseUrl}/tvshows</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    res.status(200).send(errorXml);
  }
});

module.exports = router;

