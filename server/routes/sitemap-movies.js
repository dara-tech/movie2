const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const logger = require('../utils/logger');
const { getBaseUrl, escapeXml, slugify } = require('../utils/sitemapHelpers');

async function renderMoviesSitemap(req, res) {
  // Set headers FIRST
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  try {
    const baseUrl = getBaseUrl(req);
    const currentDate = new Date().toISOString().split('T')[0];
    const page = parseInt(req.query.page || req.params.page) || 1;
    const limit = 50000; // Max URLs per sitemap
    const skip = (page - 1) * limit;
    
    logger.info(`Generating movies sitemap page ${page} with base URL: ${baseUrl}`);
    
    // Get movies with pagination
    const movies = await Movie.find({ isAvailable: true })
      .select('_id title releaseDate posterPath overview updatedAt')
      .sort({ popularity: -1, releaseDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    // Start building XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    movies.forEach((movie, index) => {
      const movieId = movie._id.toString();
      const lastmod = movie.updatedAt 
        ? new Date(movie.updatedAt).toISOString().split('T')[0]
        : currentDate;
      
      const movieSlug = slugify(movie.title);
      const movieUrl = `${baseUrl}/movie/${movieSlug}-${movieId}`.replace(/([^:]\/)\/+/g, '$1');
      
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(movieUrl)}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      
      xml += '  </url>\n';
    });
    
    xml += '</urlset>';
    
    res.send(xml);
    logger.info(`Movies sitemap page ${page} generated with ${movies.length} movies`);
  } catch (error) {
    logger.error('Error generating movies sitemap:', error);
    const errorBaseUrl = getBaseUrl(req);
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${errorBaseUrl}/movies</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    res.status(200).send(errorXml);
  }
}

router.get('/sitemap-movies.xml', renderMoviesSitemap);
router.get('/sitemap-movies-:page.xml', renderMoviesSitemap);

module.exports = router;

