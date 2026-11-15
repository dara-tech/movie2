const rateLimit = require('express-rate-limit');

// More lenient limits in development
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * General API rate limiter
 * Limits each IP to 100 requests per 15 minutes (production)
 * Limits each IP to 10000 requests per 15 minutes (development) - effectively disabled
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 10000 : 100, // Very lenient in development
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
 * Strict rate limiter for authentication endpoints
 * Limits each IP to 5 requests per 15 minutes (production)
 * Limits each IP to 1000 requests per 15 minutes (development) - effectively disabled
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 5, // Very lenient in development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isDevelopment, // Skip entirely in development
});

/**
 * Rate limiter for AI endpoints (more expensive operations)
 * Limits each IP to 20 requests per 15 minutes (production)
 * Limits each IP to 1000 requests per 15 minutes (development) - effectively disabled
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 20, // Very lenient in development
  message: {
    success: false,
    message: 'Too many AI requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Skip entirely in development
});

module.exports = {
  apiLimiter,
  authLimiter,
  aiLimiter,
};

