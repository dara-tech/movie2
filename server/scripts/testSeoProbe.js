/**
 * Verifies admin SEO probe behavior: text/Buffer body handling and XML detection.
 * Run: node server/scripts/testSeoProbe.js
 * Uses SITE_URL from .env or https://moviestream.cc
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const axios = require('axios');

const GOOGLEBOT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function normalizeBody(rawData) {
  if (typeof rawData === 'string') return rawData;
  if (Buffer.isBuffer(rawData)) return rawData.toString('utf8');
  if (rawData != null) return String(rawData);
  return '';
}

function analyzeProbeResponse(headers, rawData) {
  const rawCt = headers['content-type'] || '';
  const contentType = rawCt.split(';')[0].trim().toLowerCase();
  const body = normalizeBody(rawData);
  const head = body.slice(0, 4000);
  const looksLikeXml =
    /^\s*<\?xml/i.test(head) ||
    /<urlset[\s/>]/i.test(head) ||
    /<sitemapindex[\s/>]/i.test(head);
  const looksLikeHtml = /<!doctype|<html[\s>]/i.test(head.slice(0, 2000));
  const isXmlContentType =
    /^application\/xml$/i.test(contentType) ||
    /^text\/xml$/i.test(contentType) ||
    contentType.endsWith('+xml');

  let summary = null;
  if (body.length > 0) {
    if (looksLikeXml || isXmlContentType) {
      summary = 'XML (sitemap or feed) - expected for .xml URLs';
    } else if (looksLikeHtml) {
      summary = 'HTML document';
    } else {
      summary = 'Other body';
    }
  }

  return {
    contentType,
    bodyLength: body.length,
    looksLikeXml,
    looksLikeHtml,
    isXmlContentType,
    summary,
    dataType: Buffer.isBuffer(rawData) ? 'Buffer' : typeof rawData
  };
}

async function fetchProbe(target) {
  const response = await axios.get(target, {
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(data) => data],
    headers: {
      'User-Agent': GOOGLEBOT_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    maxContentLength: 12 * 1024 * 1024,
    maxBodyLength: 12 * 1024 * 1024
  });
  const analysis = analyzeProbeResponse(response.headers, response.data);
  return { status: response.status, ok: response.status >= 200 && response.status < 400, analysis };
}

async function main() {
  const base = (process.env.SITE_URL || 'https://moviestream.cc').replace(/\/$/, '');
  const targets = [
    { url: `${base}/`, label: 'homepage' },
    { url: `${base}/sitemaps.xml`, label: 'sitemap' },
    { url: `${base}/robots.txt`, label: 'robots' }
  ];

  let failed = false;
  for (const { url, label } of targets) {
    try {
      const { status, ok, analysis } = await fetchProbe(url);
      const line = `[${label}] ${url}\n  HTTP ${status} ok=${ok} bodyType=${analysis.dataType} len=${analysis.bodyLength}\n  content-type=${analysis.contentType}\n  xml=${analysis.looksLikeXml} html=${analysis.looksLikeHtml} summary=${analysis.summary}`;
      console.log(line);
      if (!ok) {
        console.error(`  FAIL: HTTP ${status}`);
        failed = true;
      }
      if (label === 'sitemap' && !(analysis.looksLikeXml || analysis.isXmlContentType)) {
        console.error('  FAIL: sitemap should look like XML or have XML content-type');
        failed = true;
      }
      if (label === 'homepage' && !analysis.looksLikeHtml) {
        console.warn('  WARN: homepage may not look like HTML in first 2k (SPA shell is ok)');
      }
    } catch (err) {
      console.error(`[${label}] ${url}`, err.message);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log('\nAll probe checks passed.');
}

main();
