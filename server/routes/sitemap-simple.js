const express = require('express');
const router = express.Router();
const { getBaseUrl, escapeXml } = require('../utils/sitemapHelpers');

// Simple sitemap - just basic pages
// CRITICAL: ALWAYS returns the same XML format for EVERY request
// NO conditional logic, NO User-Agent detection, NO reload tricks
router.get('/sitemap-simple.xml', (req, res) => {
  // Set headers FIRST - before any processing
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('X-Content-Type-Options', 'nosniff');
  
  const baseUrl = getBaseUrl(req);

  const currentDate = new Date().toISOString().split('T')[0];
  const url = (path) => escapeXml((baseUrl + path).replace(/([^:]\/)\/+/g, '$1'));

  // Simple XML sitemap with just main pages
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url('/')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${url('/movies')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${url('/tvshows')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${url('/search')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

module.exports = router;

