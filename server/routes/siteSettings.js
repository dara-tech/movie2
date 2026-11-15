const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAdmin } = require('../middleware/adminAuth');
const SiteSettings = require('../models/SiteSettings');
const logger = require('../utils/logger');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Get site settings
router.get('/', async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching site settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch site settings'
    });
  }
});

// Get logo URL (public endpoint)
router.get('/logo', async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();
    let logoUrl = null;

    if (settings.logo.type === 'upload' && settings.logo.url) {
      // Return the uploaded logo URL
      logoUrl = `/uploads/logos/${path.basename(settings.logo.url)}`;
    } else if (settings.logo.type === 'url' && settings.logo.url) {
      // Return the external URL
      logoUrl = settings.logo.url;
    }

    // Combine text parts for display
    let displayText = settings.logo.text || 'MOVIESTREAM';
    if (settings.logo.textFirst || settings.logo.textSecond) {
      const separator = settings.logo.addSpace ? ' ' : '';
      displayText = [settings.logo.textFirst || 'MOVIE', settings.logo.textSecond || ''].filter(Boolean).join(separator);
    }

    res.json({
      success: true,
      data: {
        logoUrl,
        type: settings.logo.type,
        text: displayText,
        textFirst: settings.logo.textFirst || 'MOVIE',
        textSecond: settings.logo.textSecond || '',
        addSpace: settings.logo.addSpace || false
      }
    });
  } catch (error) {
    logger.error('Error fetching logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logo'
    });
  }
});

// Upload logo (admin only)
router.post('/logo/upload', requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const settings = await SiteSettings.getSettings();
    
    // Delete old logo file if it exists
    if (settings.logo.type === 'upload' && settings.logo.url) {
      const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(settings.logo.url));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    // Update settings with new logo
    settings.logo = {
      url: req.file.filename,
      type: 'upload',
      text: settings.logo.text || 'MOVIESTREAM',
      updatedAt: new Date()
    };
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl,
        type: 'upload'
      }
    });
  } catch (error) {
    logger.error('Error uploading logo:', error);
    
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(uploadsDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload logo'
    });
  }
});

// Set logo from URL (admin only)
router.post('/logo/url', requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Valid URL is required'
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL format'
      });
    }

    const settings = await SiteSettings.getSettings();

    // Delete old uploaded logo file if it exists
    if (settings.logo.type === 'upload' && settings.logo.url) {
      const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(settings.logo.url));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    settings.logo = {
      url: url,
      type: 'url',
      text: settings.logo.text || 'MOVIESTREAM',
      updatedAt: new Date()
    };
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Logo URL set successfully',
      data: {
        logoUrl: url,
        type: 'url'
      }
    });
  } catch (error) {
    logger.error('Error setting logo URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set logo URL'
    });
  }
});

// Set text logo (admin only)
router.post('/logo/text', requireAdmin, async (req, res) => {
  try {
    const { text, textFirst, textSecond, addSpace } = req.body;

    // Support both old format (text) and new format (textFirst, textSecond)
    let firstPart = '';
    let secondPart = '';
    let useSpace = false;
    let combinedText = '';

    if (textFirst !== undefined || textSecond !== undefined) {
      // New format: separate parts
      firstPart = (textFirst || '').trim();
      secondPart = (textSecond || '').trim();
      useSpace = addSpace === true;
      
      if (!firstPart && !secondPart) {
        return res.status(400).json({
          success: false,
          message: 'At least one part of the logo text is required'
        });
      }

      const separator = useSpace ? ' ' : '';
      combinedText = [firstPart, secondPart].filter(Boolean).join(separator);
    } else if (text) {
      // Old format: combined text (backward compatibility)
      combinedText = text.trim();
      if (combinedText.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Text is required'
        });
      }
      // Try to parse it
      const parts = combinedText.split(' ');
      firstPart = parts[0] || '';
      secondPart = parts.slice(1).join(' ') || '';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Text is required'
      });
    }

    const settings = await SiteSettings.getSettings();

    // Delete old logo file if it exists
    if (settings.logo.type === 'upload' && settings.logo.url) {
      const oldLogoPath = path.join(__dirname, '../uploads/logos', path.basename(settings.logo.url));
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }

    settings.logo = {
      url: null,
      type: 'text',
      text: combinedText, // For backward compatibility
      textFirst: firstPart || 'MOVIE',
      textSecond: secondPart || '',
      addSpace: useSpace,
      updatedAt: new Date()
    };
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Text logo set successfully',
      data: {
        type: 'text',
        text: combinedText,
        textFirst: firstPart,
        textSecond: secondPart,
        addSpace: useSpace
      }
    });
  } catch (error) {
    logger.error('Error setting text logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set text logo'
    });
  }
});

// Delete/Remove logo (admin only)
router.delete('/logo', requireAdmin, async (req, res) => {
  try {
    const settings = await SiteSettings.getSettings();

    // Delete logo file if it exists
    if (settings.logo.type === 'upload' && settings.logo.url) {
      const logoPath = path.join(__dirname, '../uploads/logos', path.basename(settings.logo.url));
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    // Reset to default text logo
    settings.logo = {
      url: null,
      type: 'text',
      text: 'MOVIESTREAM',
      textFirst: 'MOVIE',
      textSecond: 'STREAM',
      addSpace: false,
      updatedAt: new Date()
    };
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Logo removed successfully',
      data: {
        type: 'text',
        text: 'MOVIESTREAM'
      }
    });
  } catch (error) {
    logger.error('Error removing logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove logo'
    });
  }
});

// Update site settings (admin only)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { siteName, siteDescription, primaryColor } = req.body;

    const settings = await SiteSettings.getSettings();

    if (siteName !== undefined) {
      settings.siteName = siteName;
    }
    if (siteDescription !== undefined) {
      settings.siteDescription = siteDescription;
    }
    if (primaryColor !== undefined) {
      settings.primaryColor = primaryColor;
    }

    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    res.json({
      success: true,
      message: 'Site settings updated successfully',
      data: settings
    });
  } catch (error) {
    logger.error('Error updating site settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update site settings'
    });
  }
});

// Update Telegram settings (admin only)
router.put('/telegram', requireAdmin, async (req, res) => {
  try {
    const { botToken, chatId, siteUrl, enabled, notifyNewMovies, notifyNewTvShows, autoPostEveryMinute, groupLink } = req.body;

    // Validate and log the incoming data
    logger.debug('Telegram settings update request:', {
      hasBotToken: !!botToken,
      hasChatId: !!chatId,
      enabled: enabled,
      enabledType: typeof enabled,
      notifyNewMovies: notifyNewMovies,
      notifyNewTvShows: notifyNewTvShows,
      autoPostEveryMinute: autoPostEveryMinute,
      hasGroupLink: !!groupLink
    });

    // Validate input types
    if (enabled !== undefined && typeof enabled !== 'boolean' && enabled !== 'true' && enabled !== 'false' && enabled !== 1 && enabled !== 0) {
      logger.warn('Invalid enabled value received:', enabled, typeof enabled);
    }

    const settings = await SiteSettings.getSettings();

    if (!settings.telegram) {
      settings.telegram = {};
    }

    if (botToken !== undefined) {
      settings.telegram.botToken = botToken || null;
    }
    if (chatId !== undefined) {
      settings.telegram.chatId = chatId || null;
    }
    if (siteUrl !== undefined) {
      // Remove trailing slash and validate URL format
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.telegram.siteUrl = cleanUrl || null;
    }
    if (groupLink !== undefined) {
      settings.telegram.groupLink = groupLink ? groupLink.trim() : 'https://t.me/moviestreamhdfree';
    }
    if (enabled !== undefined) {
      // Ensure enabled is a boolean
      settings.telegram.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (notifyNewMovies !== undefined) {
      // Ensure notifyNewMovies is a boolean
      settings.telegram.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }
    if (notifyNewTvShows !== undefined) {
      // Ensure notifyNewTvShows is a boolean
      settings.telegram.notifyNewTvShows = Boolean(notifyNewTvShows === true || notifyNewTvShows === 'true' || notifyNewTvShows === 1);
    }
    if (autoPostEveryMinute !== undefined) {
      settings.telegram.autoPostEveryMinute = Boolean(autoPostEveryMinute === true || autoPostEveryMinute === 'true' || autoPostEveryMinute === 1);
    }

    settings.telegram.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    // Update environment variables for telegramService
    if (botToken) {
      process.env.TELEGRAM_BOT_TOKEN = botToken;
    }
    if (chatId) {
      process.env.TELEGRAM_CHAT_ID = chatId;
    }

    // Reload telegramService settings
    const telegramService = require('../services/telegramService');
    await telegramService.loadSettings();

    // Start/stop minute poster according to settings
    const autoSyncService = require('../services/autoSyncService');
    if (settings.telegram.enabled && settings.telegram.autoPostEveryMinute) {
      autoSyncService.startTelegramMinutePoster();
    } else {
      autoSyncService.stopTelegramMinutePoster();
    }

    res.json({
      success: true,
      message: 'Telegram settings updated successfully',
      data: settings.telegram
    });
  } catch (error) {
    logger.error('Error updating Telegram settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Telegram settings'
    });
  }
});

// Trigger post next movie to Telegram immediately (admin only)
router.post('/telegram/post-next', requireAdmin, async (req, res) => {
  try {
    const autoSyncService = require('../services/autoSyncService');
    const result = await autoSyncService.postNextMovieToTelegram();
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${result.title}" to Telegram!`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || result.message || 'Failed to post movie to Telegram'
      });
    }
  } catch (error) {
    logger.error('Error in post-next Telegram endpoint:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while posting to Telegram'
    });
  }
});

// Test Telegram connection (admin only)
router.post('/telegram/test', requireAdmin, async (req, res) => {
  try {
    const { botToken, chatId } = req.body;

    if (!botToken || !chatId) {
      return res.status(400).json({
        success: false,
        message: 'Bot token and chat ID are required'
      });
    }

    const axios = require('axios');
    const testUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const testMessage = `✅ <b>Telegram Bot Test</b>\n\n` +
      `This is a test message from MovieStream!\n\n` +
      `If you received this, your bot is configured correctly. 🎉\n\n` +
      `Bot will now send notifications for:\n` +
      `🎬 New movies\n` +
      `📺 New TV shows`;

    try {
      const response = await axios.post(testUrl, {
        chat_id: chatId,
        text: testMessage,
        parse_mode: 'HTML'
      }, {
        timeout: 10000 // 10 second timeout
      });

      if (response.data.ok) {
        res.json({
          success: true,
          message: 'Test message sent successfully! Check your Telegram channel/chat.'
        });
      } else {
        const errorMsg = response.data.description || 'Unknown error from Telegram API';
        logger.error('Telegram test failed:', response.data);
        res.status(400).json({
          success: false,
          message: `Telegram API error: ${errorMsg}`
        });
      }
    } catch (telegramError) {
      let errorMsg = 'Unknown error';
      
      if (telegramError.response?.data) {
        const errorData = telegramError.response.data;
        errorMsg = errorData.description || errorData.error_code 
          ? `Error ${errorData.error_code}: ${errorData.description || 'Unknown error'}`
          : JSON.stringify(errorData);
        
        logger.error('Telegram API error response:', errorData);
      } else if (telegramError.message) {
        errorMsg = telegramError.message;
        logger.error('Telegram API request error:', telegramError.message);
      }
      
      // Common error messages with helpful hints
      if (errorMsg.includes('chat not found') || errorMsg.includes('Chat not found')) {
        errorMsg = 'Chat not found. Make sure your bot is added to the channel/group and is an administrator.';
      } else if (errorMsg.includes('Unauthorized') || errorMsg.includes('invalid token')) {
        errorMsg = 'Invalid bot token. Please check your token from @BotFather.';
      } else if (errorMsg.includes('bot was blocked')) {
        errorMsg = 'Bot was blocked. Unblock the bot and try again.';
      } else if (errorMsg.includes('not enough rights')) {
        errorMsg = 'Bot does not have permission to post messages. Make sure the bot is an administrator in the channel.';
      }
      
      res.status(400).json({
        success: false,
        message: `Telegram API error: ${errorMsg}`
      });
    }
  } catch (error) {
    logger.error('Error testing Telegram connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Telegram connection'
    });
  }
});

// Update Twitter/X settings (admin only)
router.put('/twitter', requireAdmin, async (req, res) => {
  try {
    const { 
      apiKey, 
      apiSecret, 
      bearerToken, 
      accessToken, 
      accessTokenSecret, 
      siteUrl, 
      enabled, 
      postDailyTopMovies,
      notifyNewMovies
    } = req.body;

    const settings = await SiteSettings.getSettings();

    if (!settings.twitter) {
      settings.twitter = {};
    }

    if (apiKey !== undefined) {
      settings.twitter.apiKey = apiKey || null;
    }
    if (apiSecret !== undefined) {
      settings.twitter.apiSecret = apiSecret || null;
    }
    if (bearerToken !== undefined) {
      settings.twitter.bearerToken = bearerToken || null;
    }
    if (accessToken !== undefined) {
      settings.twitter.accessToken = accessToken || null;
    }
    if (accessTokenSecret !== undefined) {
      settings.twitter.accessTokenSecret = accessTokenSecret || null;
    }
    if (siteUrl !== undefined) {
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.twitter.siteUrl = cleanUrl || null;
    }
    if (enabled !== undefined) {
      settings.twitter.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (postDailyTopMovies !== undefined) {
      settings.twitter.postDailyTopMovies = Boolean(postDailyTopMovies === true || postDailyTopMovies === 'true' || postDailyTopMovies === 1);
    }
    if (notifyNewMovies !== undefined) {
      settings.twitter.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }

    settings.twitter.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    // Reload Twitter service settings
    const twitterService = require('../services/twitterService');
    await twitterService.loadSettings();

    // Start/stop daily posting based on settings
    const autoSyncService = require('../services/autoSyncService');
    if (settings.twitter.enabled && settings.twitter.postDailyTopMovies) {
      autoSyncService.startDailyTopMoviesPost({ schedule: '0 10 * * *' }); // Daily at 10 AM
    } else {
      autoSyncService.stopDailyTopMoviesPost();
    }

    res.json({
      success: true,
      message: 'Twitter/X settings updated successfully',
      data: settings.twitter
    });
  } catch (error) {
    logger.error('Error updating Twitter/X settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Twitter/X settings'
    });
  }
});

// Test Twitter/X connection (admin only)
router.post('/twitter/test', requireAdmin, async (req, res) => {
  try {
    const twitterService = require('../services/twitterService');
    
    // Reload settings
    await twitterService.loadSettings();
    
    if (!twitterService.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Twitter/X is not enabled or credentials are missing'
      });
    }

    const testMessage = `✅ Twitter/X Bot Test\n\n` +
      `This is a test message from MovieStream!\n\n` +
      `If you see this, your Twitter/X API is configured correctly. 🎉\n\n` +
      `Daily top movie posts will be sent automatically if enabled.`;

    const result = await twitterService.postTweet(testMessage);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test tweet sent successfully! Check your Twitter/X account.',
        tweetId: result.tweetId
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Twitter/X API error: ${result.error}`
      });
    }
  } catch (error) {
    logger.error('Error testing Twitter/X connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Twitter/X connection'
    });
  }
});

// Manually trigger daily top movies post (admin only)
router.post('/twitter/post-daily-top', requireAdmin, async (req, res) => {
  try {
    const autoSyncService = require('../services/autoSyncService');
    const result = await autoSyncService.postDailyTopMovies();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Daily top movies posted successfully',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to post daily top movies',
        data: result
      });
    }
  } catch (error) {
    logger.error('Error posting daily top movies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post daily top movies'
    });
  }
});

// Update Reddit settings (admin only)
router.put('/reddit', requireAdmin, async (req, res) => {
  try {
    const {
      clientId,
      clientSecret,
      username,
      password,
      subreddit,
      siteUrl,
      postType,
      enabled,
      notifyNewMovies,
      notifyNewTvShows
    } = req.body;

    const settings = await SiteSettings.getSettings();

    if (!settings.reddit) {
      settings.reddit = {};
    }

    if (clientId !== undefined) {
      settings.reddit.clientId = clientId ? clientId.trim() : null;
    }
    if (clientSecret !== undefined) {
      settings.reddit.clientSecret = clientSecret ? clientSecret.trim() : null;
    }
    if (username !== undefined) {
      settings.reddit.username = username ? username.trim() : null;
    }
    if (password !== undefined) {
      settings.reddit.password = password ? password.trim() : null;
    }
    if (subreddit !== undefined) {
      const cleanSr = subreddit ? subreddit.trim().replace(/^r\//i, '').replace(/^\/r\//i, '') : null;
      settings.reddit.subreddit = cleanSr || null;
    }
    if (siteUrl !== undefined) {
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.reddit.siteUrl = cleanUrl || null;
    }
    if (postType !== undefined) {
      settings.reddit.postType = postType === 'self' ? 'self' : 'link';
    }
    if (enabled !== undefined) {
      settings.reddit.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (notifyNewMovies !== undefined) {
      settings.reddit.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }
    if (notifyNewTvShows !== undefined) {
      settings.reddit.notifyNewTvShows = Boolean(notifyNewTvShows === true || notifyNewTvShows === 'true' || notifyNewTvShows === 1);
    }

    settings.reddit.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    // Reload Reddit service settings
    const redditService = require('../services/redditService');
    await redditService.loadSettings();

    res.json({
      success: true,
      message: 'Reddit settings updated successfully',
      data: settings.reddit
    });
  } catch (error) {
    logger.error('Error updating Reddit settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Reddit settings'
    });
  }
});

// Test Reddit connection (admin only)
router.post('/reddit/test', requireAdmin, async (req, res) => {
  try {
    const redditService = require('../services/redditService');
    await redditService.loadSettings();

    const result = await redditService.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Reddit connection successful!',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to connect to Reddit'
      });
    }
  } catch (error) {
    logger.error('Error testing Reddit connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Reddit connection'
    });
  }
});

// Manually post latest movie to Reddit (admin only)
router.post('/reddit/post-latest', requireAdmin, async (req, res) => {
  try {
    const Movie = require('../models/Movie');
    const redditService = require('../services/redditService');
    await redditService.loadSettings();

    const latestMovie = await Movie.findOne().sort({ createdAt: -1 });
    if (!latestMovie) {
      return res.status(404).json({
        success: false,
        message: 'No movies found in the database to post'
      });
    }

    const result = await redditService.notifyNewMovie(latestMovie);

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${latestMovie.title}" to Reddit!`,
        postUrl: result.postUrl,
        postId: result.postId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to post movie to Reddit'
      });
    }
  } catch (error) {
    logger.error('Error posting latest movie to Reddit:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post movie to Reddit'
    });
  }
});

// Update Pinterest settings (admin only)
router.put('/pinterest', requireAdmin, async (req, res) => {
  try {
    const { accessToken, boardId, siteUrl, enabled, notifyNewMovies, notifyNewTvShows } = req.body;
    const settings = await SiteSettings.getSettings();

    if (!settings.pinterest) {
      settings.pinterest = {};
    }

    if (accessToken !== undefined) {
      settings.pinterest.accessToken = accessToken ? accessToken.trim() : null;
    }
    if (boardId !== undefined) {
      settings.pinterest.boardId = boardId ? boardId.trim() : null;
    }
    if (siteUrl !== undefined) {
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.pinterest.siteUrl = cleanUrl || null;
    }
    if (enabled !== undefined) {
      settings.pinterest.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (notifyNewMovies !== undefined) {
      settings.pinterest.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }
    if (notifyNewTvShows !== undefined) {
      settings.pinterest.notifyNewTvShows = Boolean(notifyNewTvShows === true || notifyNewTvShows === 'true' || notifyNewTvShows === 1);
    }

    settings.pinterest.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    const pinterestService = require('../services/pinterestService');
    await pinterestService.loadSettings();

    res.json({
      success: true,
      message: 'Pinterest settings updated successfully',
      data: settings.pinterest
    });
  } catch (error) {
    logger.error('Error updating Pinterest settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Pinterest settings'
    });
  }
});

// Test Pinterest connection (admin only)
router.post('/pinterest/test', requireAdmin, async (req, res) => {
  try {
    const pinterestService = require('../services/pinterestService');
    await pinterestService.loadSettings();

    const result = await pinterestService.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Connected to Pinterest successfully!',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to connect to Pinterest'
      });
    }
  } catch (error) {
    logger.error('Error testing Pinterest connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Pinterest connection'
    });
  }
});

// Fetch user Pinterest boards (admin only)
router.get('/pinterest/boards', requireAdmin, async (req, res) => {
  try {
    const pinterestService = require('../services/pinterestService');
    await pinterestService.loadSettings();

    const result = await pinterestService.getBoards();

    if (result.success) {
      res.json({
        success: true,
        boards: result.boards
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to fetch Pinterest boards'
      });
    }
  } catch (error) {
    logger.error('Error fetching Pinterest boards:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Pinterest boards'
    });
  }
});

// Manually pin latest movie to Pinterest (admin only)
router.post('/pinterest/post-latest', requireAdmin, async (req, res) => {
  try {
    const Movie = require('../models/Movie');
    const pinterestService = require('../services/pinterestService');
    await pinterestService.loadSettings();

    const latestMovie = await Movie.findOne().sort({ createdAt: -1 });
    if (!latestMovie) {
      return res.status(404).json({
        success: false,
        message: 'No movies found in the database to pin'
      });
    }

    const result = await pinterestService.notifyNewMovie(latestMovie);

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully pinned "${latestMovie.title}" to Pinterest!`,
        pinUrl: result.pinUrl,
        pinId: result.pinId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to pin movie to Pinterest'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to pin movie to Pinterest'
    });
  }
});

// Update Bluesky settings (admin only)
router.put('/bluesky', requireAdmin, async (req, res) => {
  try {
    const { handle, appPassword, siteUrl, enabled, notifyNewMovies, notifyNewTvShows, autoPostEveryMinute } = req.body;
    const settings = await SiteSettings.getSettings();

    if (!settings.bluesky) {
      settings.bluesky = {};
    }

    if (handle !== undefined) {
      settings.bluesky.handle = handle ? handle.trim().replace(/^@/, '') : null;
    }
    if (appPassword !== undefined) {
      settings.bluesky.appPassword = appPassword ? appPassword.trim() : null;
    }
    if (siteUrl !== undefined) {
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.bluesky.siteUrl = cleanUrl || null;
    }
    if (enabled !== undefined) {
      settings.bluesky.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (notifyNewMovies !== undefined) {
      settings.bluesky.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }
    if (notifyNewTvShows !== undefined) {
      settings.bluesky.notifyNewTvShows = Boolean(notifyNewTvShows === true || notifyNewTvShows === 'true' || notifyNewTvShows === 1);
    }
    if (autoPostEveryMinute !== undefined) {
      settings.bluesky.autoPostEveryMinute = Boolean(autoPostEveryMinute === true || autoPostEveryMinute === 'true' || autoPostEveryMinute === 1);
    }

    settings.bluesky.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    const blueskyService = require('../services/blueskyService');
    await blueskyService.loadSettings();

    // Start/stop minute poster according to saved preference
    const autoSyncService = require('../services/autoSyncService');
    if (settings.bluesky.enabled && settings.bluesky.autoPostEveryMinute) {
      autoSyncService.startBlueskyMinutePoster();
    } else {
      autoSyncService.stopBlueskyMinutePoster();
    }

    res.json({
      success: true,
      message: 'Bluesky settings updated successfully',
      data: settings.bluesky
    });
  } catch (error) {
    logger.error('Error updating Bluesky settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Bluesky settings'
    });
  }
});

// Trigger post next movie/show to Bluesky immediately (admin only)
router.post('/bluesky/post-next', requireAdmin, async (req, res) => {
  try {
    const autoSyncService = require('../services/autoSyncService');
    const result = await autoSyncService.postNextMovieToBluesky(true);

    if (result && result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${result.title}" to Bluesky!`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || result.message || 'Failed to post movie/show to Bluesky'
      });
    }
  } catch (error) {
    logger.error('Error in post-next Bluesky endpoint:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while posting to Bluesky'
    });
  }
});

// Test Bluesky connection (admin only)
router.post('/bluesky/test', requireAdmin, async (req, res) => {
  try {
    const blueskyService = require('../services/blueskyService');
    await blueskyService.loadSettings();

    const result = await blueskyService.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Connected to Bluesky successfully!',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to connect to Bluesky'
      });
    }
  } catch (error) {
    logger.error('Error testing Bluesky connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Bluesky connection'
    });
  }
});

// Manually post latest movie to Bluesky (admin only)
router.post('/bluesky/post-latest', requireAdmin, async (req, res) => {
  try {
    const Movie = require('../models/Movie');
    const blueskyService = require('../services/blueskyService');
    await blueskyService.loadSettings();

    const latestMovie = await Movie.findOne().sort({ createdAt: -1 });
    if (!latestMovie) {
      return res.status(404).json({
        success: false,
        message: 'No movies found in the database to post'
      });
    }

    const result = await blueskyService.notifyNewMovie(latestMovie, null, true);

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${latestMovie.title}" to Bluesky!`,
        postUrl: result.postUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to post movie to Bluesky'
      });
    }
  } catch (error) {
    logger.error('Error posting latest movie to Bluesky:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post movie to Bluesky'
    });
  }
});

// Update Tumblr settings (admin only)
router.put('/tumblr', requireAdmin, async (req, res) => {
  try {
    const {
      consumerKey,
      consumerSecret,
      accessToken,
      accessTokenSecret,
      blogIdentifier,
      siteUrl,
      enabled,
      notifyNewMovies,
      notifyNewTvShows,
      autoPostEveryMinute,
      postIntervalMinutes,
      onlyGreatContent
    } = req.body;
    const settings = await SiteSettings.getSettings();

    if (!settings.tumblr) {
      settings.tumblr = {};
    }

    if (consumerKey !== undefined) settings.tumblr.consumerKey = consumerKey ? consumerKey.trim() : null;
    if (consumerSecret !== undefined) settings.tumblr.consumerSecret = consumerSecret ? consumerSecret.trim() : null;
    if (accessToken !== undefined) settings.tumblr.accessToken = accessToken ? accessToken.trim() : null;
    if (accessTokenSecret !== undefined) settings.tumblr.accessTokenSecret = accessTokenSecret ? accessTokenSecret.trim() : null;
    if (blogIdentifier !== undefined) settings.tumblr.blogIdentifier = blogIdentifier ? blogIdentifier.trim().replace(/^@/, '') : 'freemoviestreamhd';
    if (siteUrl !== undefined) {
      const cleanUrl = siteUrl ? siteUrl.trim().replace(/\/$/, '') : null;
      settings.tumblr.siteUrl = cleanUrl || null;
    }
    if (enabled !== undefined) {
      settings.tumblr.enabled = Boolean(enabled === true || enabled === 'true' || enabled === 1);
    }
    if (notifyNewMovies !== undefined) {
      settings.tumblr.notifyNewMovies = Boolean(notifyNewMovies === true || notifyNewMovies === 'true' || notifyNewMovies === 1);
    }
    if (notifyNewTvShows !== undefined) {
      settings.tumblr.notifyNewTvShows = Boolean(notifyNewTvShows === true || notifyNewTvShows === 'true' || notifyNewTvShows === 1);
    }
    if (autoPostEveryMinute !== undefined) {
      settings.tumblr.autoPostEveryMinute = Boolean(autoPostEveryMinute === true || autoPostEveryMinute === 'true' || autoPostEveryMinute === 1);
    }
    if (postIntervalMinutes !== undefined) {
      const parsedInterval = parseInt(postIntervalMinutes, 10);
      settings.tumblr.postIntervalMinutes = (!isNaN(parsedInterval) && parsedInterval >= 1) ? parsedInterval : 10;
    }
    if (onlyGreatContent !== undefined) {
      settings.tumblr.onlyGreatContent = Boolean(onlyGreatContent === true || onlyGreatContent === 'true' || onlyGreatContent === 1);
    }

    settings.tumblr.updatedAt = new Date();
    settings.lastModifiedBy = req.user.id;
    settings.lastModifiedAt = new Date();

    await settings.save();

    const tumblrService = require('../services/tumblrService');
    await tumblrService.loadSettings();

    // Start/stop minute poster according to saved preference
    const autoSyncService = require('../services/autoSyncService');
    if (settings.tumblr.enabled && settings.tumblr.autoPostEveryMinute) {
      autoSyncService.startTumblrMinutePoster();
    } else {
      autoSyncService.stopTumblrMinutePoster();
    }

    res.json({
      success: true,
      message: 'Tumblr settings updated successfully',
      data: settings.tumblr
    });
  } catch (error) {
    logger.error('Error updating Tumblr settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Tumblr settings'
    });
  }
});

// Trigger post next movie/show to Tumblr immediately (admin only)
router.post('/tumblr/post-next', requireAdmin, async (req, res) => {
  try {
    const autoSyncService = require('../services/autoSyncService');
    const result = await autoSyncService.postNextMovieToTumblr();

    if (result && result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${result.title}" to Tumblr!`,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || result.message || 'Failed to post movie/show to Tumblr'
      });
    }
  } catch (error) {
    logger.error('Error in post-next Tumblr endpoint:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while posting to Tumblr'
    });
  }
});

// Test Tumblr connection (admin only)
router.post('/tumblr/test', requireAdmin, async (req, res) => {
  try {
    const tumblrService = require('../services/tumblrService');
    await tumblrService.loadSettings();

    const result = await tumblrService.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message || 'Connected to Tumblr successfully!',
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to connect to Tumblr'
      });
    }
  } catch (error) {
    logger.error('Error testing Tumblr connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Tumblr connection'
    });
  }
});

// Manually post latest movie to Tumblr (admin only)
router.post('/tumblr/post-latest', requireAdmin, async (req, res) => {
  try {
    const Movie = require('../models/Movie');
    const tumblrService = require('../services/tumblrService');
    await tumblrService.loadSettings();

    const latestMovie = await Movie.findOne().sort({ createdAt: -1 });
    if (!latestMovie) {
      return res.status(404).json({
        success: false,
        message: 'No movies found in the database to post'
      });
    }

    const result = await tumblrService.notifyNewMovie(latestMovie);

    if (result.success) {
      res.json({
        success: true,
        message: `Successfully posted "${latestMovie.title}" to Tumblr!`,
        postUrl: result.postUrl
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to post movie to Tumblr'
      });
    }
  } catch (error) {
    logger.error('Error posting latest movie to Tumblr:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to post movie to Tumblr'
    });
  }
});

module.exports = router;


