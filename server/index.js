const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

// Utilities and middleware
const logger = require('./utils/logger');
const validateEnv = require('./middleware/validateEnv');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');

// Database connection
const connectDB = require('./config/database');

const movieRoutes = require('./routes/movies');
const genreRoutes = require('./routes/genres');
const watchlistRoutes = require('./routes/watchlist');
const historyRoutes = require('./routes/history');
const authRoutes = require('./routes/auth');
const syncRoutes = require('./routes/sync');
const vidsrcRoutes = require('./routes/vidsrc');
const autoSyncRoutes = require('./routes/autoSync');
const adminRoutes = require('./routes/admin');
const streamingRoutes = require('./routes/streaming');
const superembedPlayerRoutes = require('./routes/superembedPlayer');
const syncManagementRoutes = require('./routes/syncManagement');
const castRoutes = require('./routes/cast');
const aiRoutes = require('./routes/ai');
const activityRoutes = require('./routes/activity');
const roadmapRoutes = require('./routes/roadmaps');
const siteSettingsRoutes = require('./routes/siteSettings');
const sitemapRoutes = require('./routes/sitemap');
const sitemapSimpleRoutes = require('./routes/sitemap-simple');
const sitemapIndexRoutes = require('./routes/sitemap-index');
const sitemapMoviesRoutes = require('./routes/sitemap-movies');
const sitemapTvShowsRoutes = require('./routes/sitemap-tvshows');
const rssRoutes = require('./routes/rss');
const telegramRoutes = require('./routes/telegram');
// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// CORS configuration
// - In development: allow all origins (useful for Safari / mobile / tools)
// - In production: restrict to known domains
const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:3001", // Next.js / React app - development
  "https://streammoviehdfree.vercel.app",
  "http://moviestream.cc",
  "https://moviestream.cc",
  "https://freemovie.online",
  "http://freemovie.online",
  /^https:\/\/.*\.vercel\.app$/ // Allow all Vercel deployments (preview + prod)
].filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // Allow requests with no origin (curl, server-to-server)

  if (isDev) {
    // In dev, allow everything to avoid local browser quirks (Safari, mobile, etc.)
    return true;
  }

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin instanceof RegExp) return allowedOrigin.test(origin);
    return allowedOrigin === origin;
  });
}

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const cron = require('node-cron');
const WatchHistory = require('./models/WatchHistory');
const AiConversation = require('./models/AiConversation');

// Validate environment variables on startup
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation failed:', error.message);
  process.exit(1);
}

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware for better performance
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all text-based responses
    return compression.filter(req, res);
  },
  level: 6, // Compression level (1-9, 6 is a good balance)
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Request ID middleware for tracing
const { v4: uuidv4 } = require('uuid');
app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// CRITICAL: Block static file requests in development mode
// These should be served by React dev server (port 3000), not backend (port 5001)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    // Block static file requests immediately
    if (req.path.startsWith('/static/') || 
        req.path.includes('bundle') || 
        (req.path.endsWith('.js') && req.path.includes('chunk')) ||
        (req.path.endsWith('.css') && req.path.startsWith('/static/'))) {
      logger.warn(`⚠️  Static file request blocked in development: ${req.path} - Should be served by React dev server on port 3000`);
      return res.status(404).json({
        error: 'Static file not available on backend',
        message: 'In development, access the site through http://localhost:3000 (React dev server), not http://localhost:5001 (backend)',
        path: req.path,
        hint: 'The React dev server handles static files. Make sure you are accessing http://localhost:3000'
      });
    }
    next();
  });
}

// Open Graph / share landing HTML (no JS) — before API rate limit so crawlers are not throttled
app.use('/api/share', require('./routes/share'));

// Rate limiting - apply to all API routes
app.use('/api/', apiLimiter);

// Health check endpoint for keep-alive
app.get('/api/health', async (req, res) => {
  const mongoose = require('mongoose');
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes with rate limiting
app.use('/api/movies', movieRoutes);
app.use('/api/tvshows', require('./routes/tvshows'));
app.use('/api/genres', genreRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/auth', authLimiter, authRoutes); // Stricter rate limiting for auth
app.use('/api/sync', syncRoutes);
app.use('/api/vidsrc', vidsrcRoutes);
app.use('/api/auto-sync', autoSyncRoutes);
app.use('/api/admin/seo', require('./routes/adminSeo'));
app.use('/api/admin', adminRoutes);
app.use('/api/admin/streaming', streamingRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/superembed-player', superembedPlayerRoutes);
app.use('/api/admin/sync', syncManagementRoutes);
app.use('/api/cast', castRoutes);
app.use('/api/search', require('./routes/search'));
app.use('/api/ai', aiLimiter, aiRoutes); // Stricter rate limiting for AI
app.use('/api/activity', activityRoutes);
app.use('/api/roadmaps', roadmapRoutes);
app.use('/api/collections', require('./routes/collections'));
app.use('/api/site-settings', siteSettingsRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/smartlinks', require('./routes/smartlinks'));

// Sitemap routes (before static files to ensure they're served)
app.use('/', sitemapRoutes);
app.use('/', sitemapSimpleRoutes);
app.use('/', sitemapIndexRoutes);
app.use('/', sitemapMoviesRoutes);
app.use('/', sitemapTvShowsRoutes);
app.use('/', rssRoutes);

// Serve uploaded files (logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CRITICAL: In development, reject static file requests immediately
// These should be served by React dev server (port 3000), not backend (port 5001)
if (process.env.NODE_ENV !== 'production') {
  app.get('/static/*', (req, res) => {
    logger.warn(`Static file request reached backend in development: ${req.path} - This should be served by React dev server on port 3000`);
    res.status(404).json({
      error: 'Static file not found',
      message: 'In development, static files are served by React dev server (http://localhost:3000), not the backend.',
      hint: 'Make sure you are accessing the site through http://localhost:3000, not http://localhost:5001'
    });
  });
  
  // Also reject bundle.js and other JS/CSS files
  app.get('*.js', (req, res, next) => {
    if (req.path.includes('bundle') || req.path.includes('chunk') || req.path.startsWith('/static/')) {
      logger.warn(`JavaScript file request reached backend in development: ${req.path}`);
      return res.status(404).json({
        error: 'JavaScript file not found',
        message: 'In development, JS files are served by React dev server (http://localhost:3000)',
        hint: 'Access the site through http://localhost:3000'
      });
    }
    next();
  });
  
  app.get('*.css', (req, res, next) => {
    if (req.path.startsWith('/static/')) {
      logger.warn(`CSS file request reached backend in development: ${req.path}`);
      return res.status(404).json({
        error: 'CSS file not found',
        message: 'In development, CSS files are served by React dev server (http://localhost:3000)',
        hint: 'Access the site through http://localhost:3000'
      });
    }
    next();
  });
}

// Error handler middleware (must be last)
app.use(errorHandler);

// Serve static files from React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Catch-all route for React app (but exclude sitemap files and static assets)
  app.get('*', (req, res, next) => {
    // Don't serve index.html for sitemap or RSS feed files - let dedicated routes handle them
    if (req.path.match(/^\/(sitemap.*\.xml|rss(\.xml|\/.*)?|feed(\.xml|\/.*)?)$/)) {
      return next();
    }
    // CRITICAL: In development, static files should NEVER reach the backend
    // They should be served by React dev server (port 3000)
    // Return 404 immediately for static files to prevent confusion
    if (req.path.startsWith('/static/') || 
        req.path.includes('bundle') || 
        req.path.endsWith('.js') || 
        req.path.endsWith('.css') ||
        req.path.endsWith('.json')) {
      logger.warn(`Static file request reached backend (should be served by React dev server): ${req.path}`);
      return res.status(404).json({ 
        error: 'Static file not found',
        message: 'This file should be served by the React dev server, not the backend. Check your proxy configuration.'
      });
    }
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Socket.io for real-time communication
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
  });
});

// Auto-reload function to prevent server sleep (only in production)
const autoReload = () => {
  if (!process.env.AUTO_RELOAD_URL) {
    logger.debug('Auto-reload disabled - AUTO_RELOAD_URL not set');
    return;
  }
  
  const https = require('https');
  const http = require('http');
  const url = require('url');
  
  const reloadUrl = process.env.AUTO_RELOAD_URL;
  const parsedUrl = url.parse(reloadUrl);
  
  if (!parsedUrl.hostname) {
    logger.error('Invalid AUTO_RELOAD_URL:', reloadUrl);
    return;
  }
  
  // Detect if HTTP or HTTPS
  const isHttps = parsedUrl.protocol === 'https:';
  const client = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;
  
  const startTime = Date.now();
  logger.info(`🔄 Starting auto-reload ping to ${reloadUrl}`);
  
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || defaultPort,
    path: parsedUrl.path || '/',
    method: 'GET',
    timeout: 10000,
    headers: {
      'User-Agent': 'Auto-Reload-KeepAlive/1.0',
      'Connection': 'close'
    }
  };
  
  const req = client.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      const duration = Date.now() - startTime;
      if (res.statusCode >= 200 && res.statusCode < 400) {
        logger.info(`✅ Auto-reload ping successful (${res.statusCode}) - ${duration}ms`);
      } else {
        logger.warn(`⚠️  Auto-reload ping returned status ${res.statusCode} - ${duration}ms`);
      }
    });
  });
  
  req.on('error', (err) => {
    const duration = Date.now() - startTime;
    const errorMsg = err.message || err.code || String(err);
    logger.error(`❌ Auto-reload ping failed after ${duration}ms:`, errorMsg);
    logger.debug('Error details:', {
      code: err.code,
      message: err.message,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || defaultPort,
      protocol: parsedUrl.protocol
    });
  });
  
  req.on('timeout', () => {
    req.destroy();
    const duration = Date.now() - startTime;
    logger.warn(`⏱️  Auto-reload ping timed out after ${duration}ms`);
  });
  
  // Set timeout on the request
  req.setTimeout(10000);
  
  // End the request (send it)
  req.end();
};

const PORT = process.env.PORT || 5001;

// Schedule watch history cleanup - runs daily at 4 AM
// Retention period configurable via WATCH_HISTORY_RETENTION_DAYS (default: 30 days)
cron.schedule('0 4 * * *', async () => {
  try {
    const retentionDays = parseInt(process.env.WATCH_HISTORY_RETENTION_DAYS) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await WatchHistory.deleteMany({
      watchedAt: { $lt: cutoffDate }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} watch history entries older than ${retentionDays} days`);
  } catch (error) {
    logger.error('Error cleaning up watch history:', error);
  }
});

// Schedule AI conversation cleanup - runs hourly to remove scheduled deletions
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const result = await AiConversation.deleteMany({
      scheduledForDeletionAt: { $ne: null, $lte: now },
    });

    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} expired AI conversations`);
    }
  } catch (error) {
    logger.error('Error cleaning up AI conversations:', error);
  }
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  
  // Start auto-reload pings (only in production with AUTO_RELOAD_URL set)
  if (process.env.AUTO_RELOAD_URL) {
    // Production: Run every 14 minutes to prevent server sleep
    const intervalMs = 14 * 60 * 1000; // 14 minutes
    
    // Run immediately on startup, then every intervalMs
    autoReload();
    setInterval(autoReload, intervalMs);
    logger.info(`Auto-reload pings enabled - pinging ${process.env.AUTO_RELOAD_URL} every ${intervalMs / 60000} minutes`);
  } else {
    logger.debug('Auto-reload disabled - AUTO_RELOAD_URL not set');
  }

  // Initialize Telegram every-minute poster
  try {
    const autoSyncService = require('./services/autoSyncService');
    const SiteSettings = require('./models/SiteSettings');
    
    SiteSettings.getSettings().then(settings => {
      const isTelegramEnabled = settings?.telegram?.enabled || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
      const isAutoPostEnabled = settings?.telegram?.autoPostEveryMinute !== false;
      if (isTelegramEnabled && isAutoPostEnabled) {
        autoSyncService.startTelegramMinutePoster();
      }

      // Initialize Bluesky every-minute poster
      const isBlueskyEnabled = settings?.bluesky?.enabled || (process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
      const isBlueskyAutoPost = settings?.bluesky?.autoPostEveryMinute !== false;
      if (isBlueskyEnabled && isBlueskyAutoPost) {
        autoSyncService.startBlueskyMinutePoster();
      }

      // Initialize Tumblr every-minute poster
      const isTumblrEnabled = settings?.tumblr?.enabled || (process.env.TUMBLR_CONSUMER_KEY && process.env.TUMBLR_ACCESS_TOKEN);
      const isTumblrAutoPost = settings?.tumblr?.autoPostEveryMinute !== false;
      if (isTumblrEnabled && isTumblrAutoPost) {
        autoSyncService.startTumblrMinutePoster();
      }
    }).catch(err => {
      logger.error('Failed to initialize minute posters on boot:', err);
    });
  } catch (err) {
    logger.error('Error starting minute posters on boot:', err);
  }
});
