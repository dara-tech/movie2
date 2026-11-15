// Netlify serverless function to proxy sitemap XML from backend
// Ensures response is always application/xml (Netlify proxy can return HTML on backend errors)
const https = require('https');
const http = require('http');

function headerValue(headers, name) {
  if (!headers) return '';
  const lower = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lower);
  return key ? String(headers[key] || '') : '';
}

/** Public origin of this deployment, for backend sitemap <loc> rewriting. */
function canonicalSiteFromEvent(event) {
  const h = event.headers || {};
  const xfHost = headerValue(h, 'x-forwarded-host')
    .split(',')[0]
    .trim()
    .split(':')[0];
  const host = xfHost || headerValue(h, 'host').split(':')[0];
  if (!host || host.includes('localhost') || host.includes('127.0.0.1')) return null;
  const proto = headerValue(h, 'x-forwarded-proto').split(',')[0].trim() || 'https';
  return `${proto}://${host}`.replace(/\/$/, '');
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const backendUrl = (process.env.REACT_APP_API_URL || 'https://movie-7zq4.onrender.com').replace(/\/$/, '');
  const path = (event.queryStringParameters && event.queryStringParameters.path) || event.path?.replace(/^\/\.netlify\/functions\/[^/]+/, '') || '/sitemaps.xml';
  const sitemapPath = path.startsWith('/') ? path : `/${path}`;
  const sitemapUrl = `${backendUrl}${sitemapPath}`;
  const canonical = canonicalSiteFromEvent(event);
  const forwardHeaders = canonical ? { 'X-Canonical-Site-Url': canonical } : {};

  // CRITICAL: NO conditional logic based on event/headers
  // ALWAYS return the same XML format for EVERY request (browser, Googlebot, curl)
  
  try {
    // Use Node.js http/https instead of fetch for better compatibility
    const urlObj = new URL(sitemapUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    // Try up to 3 times if backend is sleeping (Render.com wake-up delay)
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const xml = await new Promise((resolve, reject) => {
          const req = client.get(sitemapUrl, {
            headers: {
              // CRITICAL: Use consistent headers - NO User-Agent detection
              'User-Agent': 'Netlify-Sitemap-Proxy/1.0',
              'Accept': 'application/xml, text/xml, */*',
              ...forwardHeaders,
              // Don't send any conditional headers that might change response
            },
            timeout: 25000, // 25 second timeout (leave buffer for function timeout)
          }, (res) => {
            // Handle redirects (301, 302) - follow them
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              req.destroy();
              // Follow redirect instead of rejecting
              const redirectUrl = res.headers.location.startsWith('http') 
                ? res.headers.location 
                : `${backendUrl}${res.headers.location}`;
              // Retry with redirect URL
              reject(new Error(`REDIRECT:${redirectUrl}`));
              return;
            }
            
            if (res.statusCode !== 200) {
              reject(new Error(`Backend returned status ${res.statusCode}`));
              return;
            }
            
            const contentType = (res.headers['content-type'] || '').toLowerCase();
            if (contentType.includes('text/html') || contentType.includes('text/plain')) {
              reject(new Error(`Backend returned text, not XML: ${contentType}`));
              return;
            }
            if (!contentType.includes('xml') && !contentType.includes('text')) {
              reject(new Error(`Invalid content type: ${contentType}`));
              return;
            }
            
            let data = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              const trimmed = data.trim();
              if (trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.includes('<!DOCTYPE')) {
                reject(new Error('Backend returned HTML, not XML'));
                return;
              }
              if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<urlset') && !trimmed.startsWith('<sitemapindex')) {
                reject(new Error('Response is not valid XML'));
                return;
              }
              resolve(data);
            });
          });
          
          req.on('error', (err) => {
            reject(err);
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
        });
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Content-Length': Buffer.byteLength(xml, 'utf8').toString(),
            'Cache-Control': 'public, max-age=3600',
            'X-Content-Type-Options': 'nosniff',
          },
          body: xml,
        };
      } catch (error) {
        lastError = error;
        // Handle redirects
        if (error.message.startsWith('REDIRECT:')) {
          const redirectUrl = error.message.replace('REDIRECT:', '');
          // For now, just retry with original URL (redirect should be handled by backend)
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        // If it's a timeout or connection error and we have retries left, wait and retry
        if (attempt < 3 && (error.message.includes('timeout') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT'))) {
          // Wait 2 seconds before retry (backend might be waking up)
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        throw error;
      }
    }
    
    throw lastError;
  } catch (error) {
    console.error('Error fetching sitemap:', error);
    const root = (canonical || process.env.REACT_APP_SITE_URL || 'https://moviestream.cc').replace(/\/$/, '');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${root}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
<!-- Error: ${String(error.message).replace(/--/g, ' ')} -->`,
    };
  }
};

