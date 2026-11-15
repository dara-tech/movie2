const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // CRITICAL: Only proxy specific routes - never proxy static files
  // Static files must be served by React dev server, not backend
  
  // Proxy API routes to backend
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
    })
  );
  
  // Proxy specific sitemap XML files to backend (only in development)
  // Use explicit route matching to avoid catching other routes
  const proxyOptions = {
    target: 'http://localhost:5001',
    changeOrigin: true,
  };
  
  // Only proxy these specific sitemap routes
  app.use('/sitemap_index.xml', createProxyMiddleware(proxyOptions));
  app.use('/sitemap-static.xml', createProxyMiddleware(proxyOptions));
  app.use('/sitemaps.xml', createProxyMiddleware(proxyOptions));
  app.use('/sitemap.xml', createProxyMiddleware(proxyOptions));
  
  // Handle paginated sitemaps with regex pattern
  app.use(/^\/sitemap-movies-\d+\.xml$/, createProxyMiddleware(proxyOptions));
  app.use(/^\/sitemap-tvshows-\d+\.xml$/, createProxyMiddleware(proxyOptions));
};

