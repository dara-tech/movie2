const axios = require('axios');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');
const geminiService = require('./geminiService');

/**
 * Telegram Bot Service
 * Sends notifications to Telegram when new movies/TV shows are added
 * Uses settings from database (admin panel) or environment variables as fallback
 */
class TelegramService {
  constructor() {
    // Initialize with environment variables first
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.enabled = !!(this.botToken && this.chatId);
    this.baseUrl = this.botToken ? `https://api.telegram.org/bot${this.botToken}` : null;
    this.notifyNewMovies = true;
    this.notifyNewTvShows = true;
    
    // Load settings from database (will override env vars if set)
    this.loadSettings().catch(err => {
      logger.error('Failed to load Telegram settings on init:', err);
    });
  }

  /**
   * Load settings from database or environment variables
   */
  async loadSettings() {
    try {
      const settings = await SiteSettings.getSettings();
      
      // Prefer database settings, fallback to environment variables
      if (settings.telegram) {
        this.botToken = settings.telegram.botToken || process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = settings.telegram.chatId || process.env.TELEGRAM_CHAT_ID || null;
        this.siteUrl = settings.telegram.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.enabled = settings.telegram.enabled && !!(this.botToken && this.chatId);
        this.notifyNewMovies = settings.telegram.notifyNewMovies !== false;
        this.notifyNewTvShows = settings.telegram.notifyNewTvShows !== false;
      } else {
        // No database settings, use environment variables
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = process.env.TELEGRAM_CHAT_ID || null;
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.enabled = !!(this.botToken && this.chatId);
        this.notifyNewMovies = true; // Default to enabled if using env vars
        this.notifyNewTvShows = true;
      }
      
      if (this.botToken) {
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
      }
      
      if (!this.enabled) {
        if (this.botToken && this.chatId) {
          logger.warn('Telegram bot token and chat ID are set but notifications are disabled in admin panel');
        } else {
          logger.debug('Telegram bot not configured - botToken:', !!this.botToken, 'chatId:', !!this.chatId);
        }
      } else if (this.enabled) {
        logger.info('Telegram bot enabled - notifyMovies:', this.notifyNewMovies, 'notifyTvShows:', this.notifyNewTvShows);
      }
    } catch (error) {
      logger.error('Error loading Telegram settings from database:', error);
      // Fallback to environment variables
      this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
      this.chatId = process.env.TELEGRAM_CHAT_ID || null;
      this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      this.enabled = !!(this.botToken && this.chatId);
      this.notifyNewMovies = true;
      this.notifyNewTvShows = true;
      if (this.botToken) {
        this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
      }
    }
  }

  /**
   * Send a text message to Telegram
   * @param {string} text - Message text
   * @param {object} options - Options including chat_id (if not provided, uses configured channel chatId)
   */
  async sendMessage(text, options = {}) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    // Use chat_id from options (for user messages) or fall back to configured chatId (for notifications)
    const chatId = options.chat_id || this.chatId;
    
    if (!this.botToken || !chatId) {
      const reason = !this.botToken 
        ? 'Telegram bot token is missing'
        : !chatId 
        ? 'Telegram chat ID is missing'
        : 'Telegram bot not configured';
      logger.warn(`Cannot send Telegram message: ${reason}`);
      return { success: false, error: reason };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: options.disablePreview || false,
        ...options
      });

      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      const errorMessage = error.response?.data?.description || error.response?.data?.error_code 
        ? `${error.response.data.error_code}: ${error.response.data.description || error.message}`
        : error.message || JSON.stringify(errorDetails);
      
      logger.error('Failed to send Telegram message:', {
        error: errorMessage,
        chatId: chatId,
        hasToken: !!this.botToken,
        fullError: error.response?.data || error.message,
        statusCode: error.response?.status,
        errorCode: error.response?.data?.error_code,
        description: error.response?.data?.description
      });
      
      // Also log the full error for debugging
      if (error.response?.data) {
        logger.error('Telegram API error details:', JSON.stringify(error.response.data, null, 2));
      }
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a photo with caption to Telegram
   */
  async sendPhoto(photoUrl, caption, options = {}) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    // Use chat_id from options (for user messages) or fall back to configured chatId (for notifications)
    const targetChatId = options.chat_id || this.chatId;
    
    if (!this.botToken || !targetChatId) {
      const reason = !this.botToken 
        ? 'Telegram bot token is missing'
        : !targetChatId 
        ? 'Telegram chat ID is missing'
        : 'Telegram bot not configured';
      logger.warn(`Cannot send Telegram photo: ${reason}`);
      return { success: false, error: reason };
    }

    try {
      const response = await axios.post(`${this.baseUrl}/sendPhoto`, {
        chat_id: targetChatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
        ...options
      });

      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      logger.error('Failed to send Telegram photo:', {
        error: errorDetails,
        chatId: this.chatId,
        hasToken: !!this.botToken,
        photoUrl: photoUrl
      });
      return { success: false, error: errorDetails };
    }
  }

  /**
   * Send notification for a new movie
   */
  async notifyNewMovie(movie, siteUrl = null) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!this.enabled) {
      logger.warn(`Telegram notifications disabled - cannot send notification for movie: ${movie.title}`);
      return { success: false, error: 'Telegram notifications disabled or not configured' };
    }
    
    if (!this.notifyNewMovies) {
      logger.debug(`Telegram notifications for movies are disabled - skipping: ${movie.title}`);
      return { success: false, error: 'Telegram notifications for movies are disabled' };
    }
    
    if (!this.botToken || !this.chatId) {
      logger.warn(`Telegram bot not fully configured - botToken: ${!!this.botToken}, chatId: ${!!this.chatId} - cannot send notification for: ${movie.title}`);
      return { success: false, error: 'Telegram bot token or chat ID missing' };
    }

    try {
      const posterUrl = movie.posterPath 
        ? `https://image.tmdb.org/t/p/w780${movie.posterPath}`
        : null;

      // Use provided siteUrl, or from settings, or fallback to env vars
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      // Remove trailing slash if present
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const rawMovieId = movie._id ? String(movie._id) : (movie.tmdbId ? String(movie.tmdbId) : '');
      const idStr = rawMovieId.startsWith('tmdb_') ? rawMovieId.replace('tmdb_', '') : rawMovieId;
      const slug = movie.title 
        ? movie.title
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : 'movie';
      const movieUrl = idStr ? `${cleanUrl}/movie/${idStr}-${slug}` : `${cleanUrl}/movies`;
function escapeTelegramHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

      const cleanTitle = escapeTelegramHtml(movie.title || 'Movie');
      const releaseYear = movie.releaseDate 
        ? new Date(movie.releaseDate).getFullYear() 
        : 'N/A';
      
      const rawGenres = movie.genres && movie.genres.length > 0
        ? movie.genres.map(g => (typeof g === 'string' ? g : (g.name || ''))).filter(Boolean).join(', ')
        : 'Action, Drama';
      const genres = escapeTelegramHtml(rawGenres);

      const rating = movie.voteAverage && movie.voteAverage > 0 
        ? `${movie.voteAverage.toFixed(1)}/10` 
        : 'N/A';

      const rawOverview = movie.overview ? movie.overview.substring(0, 220) + '...' : 'Available to stream now on MovieStream.';
      const overview = escapeTelegramHtml(rawOverview);

      const caption = `🎬 <b>NEW MOVIE STREAM</b>\n\n` +
        `📽️ <b>${cleanTitle}</b> (${releaseYear})\n\n` +
        `⭐ <b>Rating:</b> ${rating}\n` +
        `🎭 <b>Genres:</b> ${genres}\n` +
        `📺 <b>Quality:</b> 1080p Full HD\n` +
        `🔊 <b>Audio:</b> Multi-Audio / Subtitles\n\n` +
        `📝 <i>${overview}</i>\n\n` +
        `🍿 <b>Player:</b> <a href="${movieUrl}">Watch Online</a>`;

      // Interactive Inline Button
      const buttons = [
        [
          { text: '▶️ Watch Movie Now', url: movieUrl }
        ]
      ];

      const options = {
        reply_markup: {
          inline_keyboard: buttons
        }
      };

      logger.info(`Sending Telegram notification with interactive player buttons for: ${movie.title}`);
      
      let result;
      if (posterUrl) {
        result = await this.sendPhoto(posterUrl, caption, options);
        // If sendPhoto failed (e.g. image fetch timeout by Telegram), fallback to text message
        if (!result.success) {
          logger.warn(`Telegram photo send failed (${result.error}), falling back to text message with buttons`);
          result = await this.sendMessage(caption, options);
        }
      } else {
        result = await this.sendMessage(caption, options);
      }

      if (result.success) {
        logger.info(`Successfully sent Telegram notification with player buttons for: ${movie.title}`);
      } else {
        logger.error(`Failed to send Telegram notification for ${movie.title}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Failed to send new movie notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification for a new TV show
   */
  async notifyNewTVShow(tvShow, siteUrl = null) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!this.enabled) {
      logger.warn(`Telegram notifications disabled - cannot send notification for TV show: ${tvShow.name}`);
      return { success: false, error: 'Telegram notifications disabled or not configured' };
    }
    
    if (!this.notifyNewTvShows) {
      logger.debug(`Telegram notifications for TV shows are disabled - skipping: ${tvShow.name}`);
      return { success: false, error: 'Telegram notifications for TV shows are disabled' };
    }
    
    if (!this.botToken || !this.chatId) {
      logger.warn(`Telegram bot not fully configured - botToken: ${!!this.botToken}, chatId: ${!!this.chatId} - cannot send notification for: ${tvShow.name}`);
      return { success: false, error: 'Telegram bot token or chat ID missing' };
    }

    try {
      const posterUrl = tvShow.posterPath 
        ? `https://image.tmdb.org/t/p/w780${tvShow.posterPath}`
        : null;

      // Use provided siteUrl, or from settings, or fallback to env vars
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      // Remove trailing slash if present
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const rawTvId = tvShow._id ? String(tvShow._id) : (tvShow.tmdbId ? String(tvShow.tmdbId) : '');
      const idStr = rawTvId.startsWith('tmdb_') ? rawTvId.replace('tmdb_', '') : rawTvId;
      const slug = tvShow.name 
        ? tvShow.name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : 'series';
      const tvShowUrl = idStr ? `${cleanUrl}/tvshow/${idStr}-${slug}` : `${cleanUrl}/tvshows`;
      const firstAirYear = tvShow.firstAirDate 
        ? new Date(tvShow.firstAirDate).getFullYear() 
        : 'N/A';
      
      function escapeTelegramHtml(text) {
        if (!text) return '';
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      const cleanName = escapeTelegramHtml(tvShow.name || 'TV Series');
      const rawGenres = tvShow.genres && tvShow.genres.length > 0
        ? tvShow.genres.map(g => (typeof g === 'string' ? g : (g.name || ''))).filter(Boolean).join(', ')
        : 'Drama, Action';
      const genres = escapeTelegramHtml(rawGenres);

      const rating = tvShow.voteAverage && tvShow.voteAverage > 0 
        ? `${tvShow.voteAverage.toFixed(1)}/10` 
        : 'N/A';

      const seasonsText = tvShow.numberOfSeasons ? `${tvShow.numberOfSeasons} Seasons` : '1 Season';
      const statusText = tvShow.status || 'Airing';
      const rawOverview = tvShow.overview ? tvShow.overview.substring(0, 220) + '...' : 'Available to stream now on MovieStream.';
      const overview = escapeTelegramHtml(rawOverview);

      const caption = `📺 <b>POPULAR TV SERIES</b>\n\n` +
        `🎭 <b>${cleanName}</b> (${firstAirYear})\n\n` +
        `⭐ <b>Rating:</b> ${rating}\n` +
        `🎭 <b>Genres:</b> ${genres}\n` +
        `📊 <b>Seasons:</b> ${seasonsText}\n` +
        `📡 <b>Status:</b> ${statusText}\n` +
        `📺 <b>Quality:</b> 1080p Full HD\n` +
        `🔊 <b>Audio:</b> Multi-Audio / Subtitles\n\n` +
        `📝 <i>${overview}</i>\n\n` +
        `🍿 <b>Player:</b> <a href="${tvShowUrl}">Stream Series Online</a>`;

      // Interactive Inline Button
      const buttons = [
        [
          { text: '▶️ Watch Series Now', url: tvShowUrl }
        ]
      ];

      const options = {
        reply_markup: {
          inline_keyboard: buttons
        }
      };

      logger.info(`Sending Telegram notification with interactive player buttons for TV: ${tvShow.name}`);
      
      let result;
      if (posterUrl) {
        result = await this.sendPhoto(posterUrl, caption, options);
        if (!result.success) {
          logger.warn(`Telegram photo send failed (${result.error}), falling back to text message with buttons`);
          result = await this.sendMessage(caption, options);
        }
      } else {
        result = await this.sendMessage(caption, options);
      }

      if (result.success) {
        logger.info(`Successfully sent Telegram notification with player buttons for TV: ${tvShow.name}`);
      } else {
        logger.error(`Failed to send Telegram notification for TV ${tvShow.name}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error('Failed to send new TV show notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a batch notification for multiple new items
   */
  async notifyBatch(items, type = 'movies', siteUrl = null) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!items || items.length === 0) {
      logger.warn('Cannot send batch notification: no items provided');
      return { success: false, error: 'No items to notify' };
    }
    
    if (!this.enabled) {
      logger.warn(`Telegram notifications disabled - cannot send batch notification for ${items.length} ${type}`);
      return { success: false, error: 'Telegram notifications disabled or not configured' };
    }
    
    if (!this.botToken || !this.chatId) {
      logger.warn(`Telegram bot not fully configured - botToken: ${!!this.botToken}, chatId: ${!!this.chatId} - cannot send batch notification for ${items.length} ${type}`);
      return { success: false, error: 'Telegram bot token or chat ID missing' };
    }

    try {
      // Use provided siteUrl, or from settings, or fallback to env vars
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      // Remove trailing slash if present
      const cleanUrl = baseUrl.replace(/\/$/, '');
      
      const emoji = type === 'movies' ? '🎬' : '📺';
      const title = type === 'movies' ? 'Movies' : 'TV Shows';
      
      let message = `${emoji} <b>New ${title} Added!</b>\n\n`;
      
      items.slice(0, 10).forEach((item, index) => {
        const year = item.releaseDate 
          ? new Date(item.releaseDate).getFullYear()
          : item.firstAirDate
          ? new Date(item.firstAirDate).getFullYear()
          : 'N/A';
        
        const name = item.title || item.name;
        const rawItemId = item._id ? String(item._id) : (item.tmdbId ? String(item.tmdbId) : '');
        const idStr = rawItemId.startsWith('tmdb_') ? rawItemId.replace('tmdb_', '') : rawItemId;
        const slug = (name || (type === 'movies' ? 'movie' : 'series'))
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const itemUrl = type === 'movies'
          ? (idStr ? `${cleanUrl}/movie/${idStr}-${slug}` : `${cleanUrl}/movies`)
          : (idStr ? `${cleanUrl}/tvshow/${idStr}-${slug}` : `${cleanUrl}/tvshows`);
        
        message += `${index + 1}. <b>${name}</b> (${year})\n`;
        message += `   🔗 <a href="${itemUrl}">Watch →</a>\n\n`;
      });

      if (items.length > 10) {
        message += `\n...and ${items.length - 10} more!`;
      }

      return await this.sendMessage(message);
    } catch (error) {
      logger.error('Failed to send batch notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming Telegram messages for AI chat
   */
  async handleMessage(update) {
    try {
      const message = update.message;
      if (!message || !message.text) {
        return { success: false, error: 'No text message' };
      }

      const chatId = message.chat.id;
      const userId = message.from.id;
      const username = message.from.username || message.from.first_name || 'User';
      const text = message.text.trim();

      // Initialize conversation storage if not exists
      if (!this.conversations) {
        this.conversations = new Map();
      }

      // Get or create conversation for this user
      let conversation = this.conversations.get(userId);
      if (!conversation) {
        conversation = {
          userId,
          username,
          messages: [],
          createdAt: new Date(),
          lastActivity: new Date()
        };
        this.conversations.set(userId, conversation);
      }

      // Handle commands
      if (text.startsWith('/')) {
        return await this.handleCommand(chatId, text, userId);
      }

      // Add user message to conversation
      conversation.messages.push({
        role: 'user',
        content: text,
        timestamp: new Date()
      });

      // Keep only last 20 messages to avoid token limits
      if (conversation.messages.length > 20) {
        conversation.messages = conversation.messages.slice(-20);
      }

      conversation.lastActivity = new Date();

      // Show typing indicator
      await this.sendTyping(chatId);

      // Get AI response
      const aiResponse = await geminiService.generateAssistantResponse({
        messages: conversation.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        userProfile: null // No user profile for Telegram users
      });

      if (!aiResponse.enabled) {
        const errorMsg = aiResponse.reason === 'conversations_disabled'
          ? 'AI conversations are currently disabled. Please try again later.'
          : 'The AI assistant is unavailable at the moment. Please try again later.';
        
        await this.sendMessage(errorMsg, { chat_id: chatId });
        return { success: false, error: aiResponse.reason };
      }

      // Add AI response to conversation
      conversation.messages.push({
        role: 'model',
        content: aiResponse.response,
        timestamp: new Date()
      });

      // Send AI response
      const result = await this.sendMessage(aiResponse.response, { chat_id: chatId });
      
      return { success: true, response: aiResponse.response };
    } catch (error) {
      logger.error('Error handling Telegram message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle Telegram bot commands
   */
  async handleCommand(chatId, command, userId) {
    const cmd = command.split(' ')[0].toLowerCase();

    switch (cmd) {
      case '/start':
        const welcomeMsg = `🎬 <b>Welcome to MovieStream AI Assistant!</b>\n\n` +
          `I can help you:\n` +
          `• Find and recommend movies & TV shows\n` +
          `• Answer questions about movies\n` +
          `• Get movie summaries and reviews\n\n` +
          `Just send me a message and I'll help you!\n\n` +
          `Commands:\n` +
          `/start - Show this welcome message\n` +
          `/help - Show help information\n` +
          `/clear - Clear conversation history`;
        return await this.sendMessage(welcomeMsg, { chat_id: chatId });

      case '/help':
        const helpMsg = `📖 <b>MovieStream AI Assistant Help</b>\n\n` +
          `I'm your AI movie assistant powered by Gemini AI.\n\n` +
          `You can ask me:\n` +
          `• "Recommend a good action movie"\n` +
          `• "What's the best sci-fi TV show?"\n` +
          `• "Tell me about The Matrix"\n` +
          `• "What movies are similar to Inception?"\n\n` +
          `Commands:\n` +
          `/start - Welcome message\n` +
          `/help - Show this help\n` +
          `/clear - Clear chat history`;
        return await this.sendMessage(helpMsg, { chat_id: chatId });

      case '/clear':
        if (this.conversations) {
          this.conversations.delete(userId);
        }
        return await this.sendMessage('✅ Conversation history cleared!', { chat_id: chatId });

      default:
        return await this.sendMessage('Unknown command. Use /help to see available commands.', { chat_id: chatId });
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId) {
    try {
      if (!this.botToken || !chatId) return;
      
      await axios.post(`${this.baseUrl}/sendChatAction`, {
        chat_id: chatId,
        action: 'typing'
      });
    } catch (error) {
      // Log typing indicator errors for debugging
      const errorMsg = error.response?.data?.description || error.message;
      logger.debug(`Error sending typing indicator to chat ${chatId}:`, errorMsg);
    }
  }

  /**
   * Process webhook update from Telegram
   */
  async processWebhookUpdate(update) {
    try {
      // Handle messages
      if (update.message) {
        return await this.handleMessage(update);
      }

      // Handle callback queries (button presses)
      if (update.callback_query) {
        // Can be extended for interactive buttons
        return { success: true, message: 'Callback query received' };
      }

      return { success: false, error: 'Unsupported update type' };
    } catch (error) {
      logger.error('Error processing Telegram webhook update:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TelegramService();

