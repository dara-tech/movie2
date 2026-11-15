const rateLimit = require('express-rate-limit');

// More lenient limits in development
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Robust Client IP Extractor for Reverse Proxies (Cloudflare, Render, Netlify, Nginx)
 * Ensures rate-limiting is keyed on the true visitor IP, not the shared edge proxy.
 */
const getClientIp = (req) => {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return Array.isArray(cfIp) ? cfIp[0] : cfIp;

  const realIp = req.headers['x-real-ip'];
  if (realIp) return Array.isArray(realIp) ? realIp[0] : realIp;

  const fwd = req.headers['x-forwarded-for'];
  if (fwd) {
    const ips = (Array.isArray(fwd) ? fwd.join(',') : fwd).split(',');
    return ips[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * General API rate limiter (Layer 7 protection)
 * Limits each IP to 120 requests per 15 minutes (production)
 * Limits each IP to 10000 requests per 15 minutes (development)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 120,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and in development
    return req.path === '/api/health' || isDevelopment;
  },
});

/**
 * Strict rate limiter for authentication endpoints (Credential brute-force protection)
 * Limits each IP to 6 requests per 15 minutes (production)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 6,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isDevelopment,
});

/**
 * Dedicated Search rate limiter (CPU & Database Exhaustion protection)
 * Limits each IP to 35 search queries per minute
 * Prevents attackers from flooding expensive regex & TMDB search queries.
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 1000 : 35,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many search requests. Please wait a moment before searching again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
});

/**
 * Rate limiter for AI endpoints (Expensive Gemini operations)
 * Limits each IP to 20 requests per 15 minutes (production)
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 20,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many AI requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment,
});

module.exports = {
  apiLimiter,
  authLimiter,
  searchLimiter,
  aiLimiter,
  getClientIp,
};
