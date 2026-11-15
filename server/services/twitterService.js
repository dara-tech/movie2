/**
 * Twitter/X Service
 * Handles posting to Twitter/X for daily top movie posts
 */

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');

class TwitterService {
  constructor() {
    // Initialize with environment variables first
    this.apiKey = process.env.X_API_KEY || null;
    this.apiSecret = process.env.X_API_SECRET || null;
    this.bearerToken = process.env.X_BEARER_TOKEN || null;
    this.accessToken = process.env.X_ACCESS_TOKEN || null;
    this.accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || null;
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.enabled = !!(this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret);
    this.postDailyTopMovies = false;
    this.notifyNewMovies = true;
    
    // Load settings from database (will override env vars if set)
    this.loadSettings().catch(err => {
      logger.error('Failed to load Twitter/X settings on init:', err);
    });
  }

  /**
   * Load settings from database or environment variables
   */
  async loadSettings() {
    try {
      let settings = null;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        settings = await SiteSettings.getSettings();
      }
      
      // Prefer database settings, fallback to environment variables
      if (settings && settings.twitter) {
        this.apiKey = settings.twitter.apiKey || process.env.X_API_KEY || null;
        this.apiSecret = settings.twitter.apiSecret || process.env.X_API_SECRET || null;
        this.bearerToken = settings.twitter.bearerToken || process.env.X_BEARER_TOKEN || null;
        this.accessToken = settings.twitter.accessToken || process.env.X_ACCESS_TOKEN || null;
        this.accessTokenSecret = settings.twitter.accessTokenSecret || process.env.X_ACCESS_TOKEN_SECRET || null;
        this.siteUrl = settings.twitter.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.enabled = settings.twitter.enabled && !!(this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret);
        this.postDailyTopMovies = settings.twitter.postDailyTopMovies !== false;
        this.notifyNewMovies = settings.twitter.notifyNewMovies !== false;
      } else {
        // No database settings, use environment variables
        this.apiKey = process.env.X_API_KEY || null;
        this.apiSecret = process.env.X_API_SECRET || null;
        this.bearerToken = process.env.X_BEARER_TOKEN || null;
        this.accessToken = process.env.X_ACCESS_TOKEN || null;
        this.accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || null;
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.enabled = !!(this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret);
        this.postDailyTopMovies = false; // Default to disabled if using env vars
        this.notifyNewMovies = true;
      }
      
      if (!this.enabled) {
        if (this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret) {
          logger.warn('Twitter/X API credentials are set but posting is disabled in admin panel');
        } else {
          logger.debug('Twitter/X not configured - missing credentials');
        }
      } else if (this.enabled) {
        logger.info(`Twitter/X service enabled - postDailyTopMovies: ${this.postDailyTopMovies}, notifyNewMovies: ${this.notifyNewMovies}`);
      }
    } catch (error) {
      logger.error('Error loading Twitter/X settings from database:', error);
      // Fallback to environment variables
      this.apiKey = process.env.X_API_KEY || null;
      this.apiSecret = process.env.X_API_SECRET || null;
      this.bearerToken = process.env.X_BEARER_TOKEN || null;
      this.accessToken = process.env.X_ACCESS_TOKEN || null;
      this.accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || null;
      this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      this.enabled = !!(this.apiKey && this.apiSecret && this.accessToken && this.accessTokenSecret);
      this.postDailyTopMovies = false;
      this.notifyNewMovies = true;
    }
  }

  /**
   * Generate OAuth 1.0a signature for Twitter API
   */
  generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
    // Sort parameters and encode them
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => {
        const value = params[key];
        // Handle arrays and objects
        const encodedValue = typeof value === 'object' && value !== null 
          ? encodeURIComponent(JSON.stringify(value))
          : encodeURIComponent(String(value));
        return `${encodeURIComponent(key)}=${encodedValue}`;
      })
      .join('&');
    
    const signatureBaseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;
    
    return crypto
      .createHmac('sha1', signingKey)
      .update(signatureBaseString)
      .digest('base64');
  }

  /**
   * Generate OAuth 1.0a header
   */
  generateOAuthHeader(method, url, params = {}) {
    const oauthParams = {
      oauth_consumer_key: this.apiKey,
      oauth_token: this.accessToken,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0'
    };

    // Combine OAuth params with request params for signature
    const allParams = { ...oauthParams, ...params };

    // Generate signature
    oauthParams.oauth_signature = this.generateOAuthSignature(method, url, allParams, this.apiSecret, this.accessTokenSecret);

    // Build OAuth header
    const oauthHeader = Object.keys(oauthParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    return `OAuth ${oauthHeader}`;
  }

  /**
   * Upload media to Twitter/X (v1.1 API)
   */
  async uploadMedia(imageUrl) {
    if (!this.enabled || !this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      return { success: false, error: 'Twitter/X not configured' };
    }

    try {
      // Download image from URL
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const imageBuffer = Buffer.from(imageResponse.data);
      const base64Image = imageBuffer.toString('base64');

      // Upload media using v1.1 API
      const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
      const method = 'POST';

      // For media upload, we need to include media_data in OAuth signature
      const oauthHeader = this.generateOAuthHeader(method, uploadUrl, {
        media_data: base64Image
      });

      // Use URL-encoded form data for media upload
      const formData = new URLSearchParams();
      formData.append('media_data', base64Image);

      const uploadResponse = await axios.post(uploadUrl, formData.toString(), {
        headers: {
          'Authorization': oauthHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (uploadResponse.data && uploadResponse.data.media_id_string) {
        return { success: true, mediaId: uploadResponse.data.media_id_string };
      } else {
        return { success: false, error: 'Failed to upload media' };
      }
    } catch (error) {
      logger.error('Failed to upload media to Twitter/X:', {
        error: error.message,
        statusCode: error.response?.status,
        fullError: error.response?.data || error.message
      });
      return { success: false, error: error.message || 'Failed to upload media' };
    }
  }

  /**
   * Post a tweet using Twitter API v2 (/2/tweets)
   * Essential fallback for Free/Basic tiers where v1.1 status updates are disabled
   */
  async postTweetV2(text, mediaIds = []) {
    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    const oauthHeader = this.generateOAuthHeader(method, url, {});

    const payload = {
      text: text.substring(0, 280)
    };

    if (mediaIds && mediaIds.length > 0) {
      payload.media = {
        media_ids: mediaIds
      };
    }

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': oauthHeader,
        'Content-Type': 'application/json'
      }
    });

    const tweetId = response.data?.data?.id || response.data?.id;
    logger.info('Successfully posted to Twitter/X via v2 API:', tweetId);
    return { success: true, tweetId };
  }

  /**
   * Post a tweet to Twitter/X (tries v1.1, falls back to v2 if restricted)
   */
  async postTweet(text, mediaIds = []) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!this.enabled || !this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      const reason = !this.enabled 
        ? 'Twitter/X posting is disabled in settings'
        : !this.apiKey 
        ? 'Twitter/X API key is missing'
        : !this.apiSecret
        ? 'Twitter/X API secret is missing'
        : !this.accessToken
        ? 'Twitter/X access token is missing'
        : !this.accessTokenSecret
        ? 'Twitter/X access token secret is missing'
        : 'Twitter/X not configured';
      logger.warn(`Cannot post to Twitter/X: ${reason}`);
      return { success: false, error: reason };
    }

    // Try Twitter API v2 first (v1.1 statuses/update was retired by X)
    try {
      return await this.postTweetV2(text, mediaIds);
    } catch (v2Error) {
      const statusCode = v2Error.response?.status;
      const v2Data = v2Error.response?.data;
      
      // If client is not enrolled in a Project (standalone app)
      if (v2Data?.reason === 'client-not-enrolled' || (v2Data?.detail && v2Data.detail.includes('attached to a Project'))) {
        const errorMsg = 'Your X/Twitter App is not attached to a Project. In Twitter Developer Portal (developer.x.com), create a Project and attach your App to it.';
        logger.error(errorMsg, v2Data);
        return { success: false, error: errorMsg };
      }

      // Try legacy v1.1 as fallback if v2 fails with non-auth error
      try {
        const url = 'https://api.twitter.com/1.1/statuses/update.json';
        const method = 'POST';
        const params = { status: text.substring(0, 280) };
        if (mediaIds && mediaIds.length > 0) {
          params.media_ids = mediaIds.join(',');
        }
        const oauthHeader = this.generateOAuthHeader(method, url, params);
        const formData = new URLSearchParams();
        Object.keys(params).forEach(key => formData.append(key, params[key]));

        const response = await axios.post(url, formData.toString(), {
          headers: {
            'Authorization': oauthHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        logger.info('Successfully posted to Twitter/X via v1.1:', response.data.id_str || response.data.id);
        return { success: true, tweetId: response.data.id_str || response.data.id };
      } catch (v1Error) {
        // Return original v2 error as it is the current standard
        const v2ErrorMessage = v2Data?.detail 
          || v2Data?.title 
          || v2Data?.errors?.[0]?.message 
          || v2Error.message;
        logger.error('Failed to post to Twitter/X:', {
          error: v2ErrorMessage,
          statusCode: statusCode,
          fullError: v2Data || v2Error.message
        });
        return { success: false, error: v2ErrorMessage };
      }
    }
  }

  /**
   * Post a new movie notification to Twitter/X
   */
  async notifyNewMovie(movie, siteUrl = null) {
    if (!movie) {
      return { success: false, error: 'No movie data provided' };
    }

    // Reload settings to get latest from database
    await this.loadSettings();

    if (!this.enabled || !this.notifyNewMovies) {
      logger.debug(`Twitter/X auto-posting disabled or unconfigured - skipping: ${movie.title}`);
      return { success: false, error: 'Twitter/X posting disabled or not configured' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const movieUrl = `${cleanUrl}/movie/${movie._id || movie.tmdbId}`;

      const releaseYear = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : 'N/A';

      const rating = movie.voteAverage && movie.voteAverage > 0
        ? `⭐ ${movie.voteAverage.toFixed(1)}/10`
        : '';

      let genres = '';
      if (movie.genres && Array.isArray(movie.genres)) {
        genres = movie.genres
          .slice(0, 2)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      // Keep focused, aesthetic hashtags for new movie posts
      const movieTags = ['#MovieStream'];
      if (movie.genres && Array.isArray(movie.genres) && movie.genres.length > 0) {
        const firstGenre = typeof movie.genres[0] === 'string' ? movie.genres[0] : (movie.genres[0].name || '');
        if (firstGenre) {
          movieTags.push(`#${firstGenre.replace(/\s+/g, '')}`);
        }
      }
      movieTags.push('#WatchNow');
      const hashtags = movieTags.join(' ');

      const header = `🎬 New Movie Added!\n\n🍿 ${movie.title} (${releaseYear})\n`;
      const meta = [rating, genres ? `🎭 ${genres}` : ''].filter(Boolean).join(' | ');
      const linkLine = `🔗 Watch Now: ${movieUrl}`;

      // Calculate fixed character length to determine remaining space for overview
      const fixedText = [header.trim(), meta, linkLine, hashtags].filter(Boolean).join('\n\n');
      const remainingBudget = 260 - fixedText.length;

      let overviewText = '';
      if (remainingBudget > 40 && movie.overview) {
        const cleanOverview = movie.overview.replace(/\s+/g, ' ').trim();
        overviewText = cleanOverview.length > remainingBudget
          ? cleanOverview.substring(0, remainingBudget - 3) + '...'
          : cleanOverview;
      }

      let tweetText = [
        header.trim(),
        meta,
        overviewText,
        linkLine,
        hashtags
      ].filter(Boolean).join('\n\n');

      // Final safety fallback: guarantee under 275 chars
      if (tweetText.length > 275) {
        tweetText = [
          header.trim(),
          meta,
          linkLine,
          '#MovieStream #WatchNow'
        ].filter(Boolean).join('\n\n');
      }

      // Upload poster if available
      let mediaIds = [];
      const posterUrl = this.getPosterUrl(movie);

      if (posterUrl) {
        try {
          logger.info(`Uploading poster to Twitter/X for ${movie.title}: ${posterUrl}`);
          const mediaResult = await this.uploadMedia(posterUrl);
          if (mediaResult.success && mediaResult.mediaId) {
            mediaIds.push(mediaResult.mediaId);
            logger.info(`✅ Poster uploaded to Twitter/X: ${mediaResult.mediaId}`);
          } else {
            logger.warn(`⚠️ Could not upload poster to Twitter/X for ${movie.title}, tweeting text-only: ${mediaResult.error}`);
          }
        } catch (mediaErr) {
          logger.warn(`⚠️ Exception uploading poster to Twitter/X: ${mediaErr.message}`);
        }
      }

      logger.info(`Posting new movie to Twitter/X: ${movie.title}`);
      const result = await this.postTweet(tweetText, mediaIds);

      if (result.success) {
        logger.info(`✅ Successfully posted new movie to Twitter/X: ${movie.title} (Tweet ID: ${result.tweetId})`);
      } else {
        logger.error(`❌ Failed to post new movie to Twitter/X for ${movie.title}:`, result.error);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to post new movie to Twitter/X for ${movie.title}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post top movie of the day to Twitter/X
   */
  async postTopMovie(movie, siteUrl = null) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!this.enabled || !this.postDailyTopMovies) {
      logger.debug('Twitter/X posting disabled - cannot post top movie:', movie.title);
      return { success: false, error: 'Twitter/X posting disabled or not configured' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const movieUrl = `${cleanUrl}/movie/${movie._id || movie.tmdbId}`;
      const releaseYear = movie.releaseDate 
        ? new Date(movie.releaseDate).getFullYear() 
        : 'N/A';
      
      const rating = movie.voteAverage ? `⭐ ${movie.voteAverage.toFixed(1)}/10` : '';
      
      const tweetText = `🎬 Top Movie of the Day!\n\n` +
        `${movie.title} (${releaseYear})\n\n` +
        `${rating}\n\n` +
        `${movie.overview ? movie.overview.substring(0, 150) + '...' : 'Check it out!'}\n\n` +
        `🔗 ${movieUrl}\n\n` +
        `#Movies #MovieStream #TopMovie`;

      logger.info(`Posting top movie to Twitter/X: ${movie.title}`);
      const result = await this.postTweet(tweetText);
      
      if (result.success) {
        logger.info(`✅ Successfully posted to Twitter/X: ${movie.title}`);
      } else {
        logger.error(`❌ Failed to post to Twitter/X for ${movie.title}:`, result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to post top movie to Twitter/X:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate engaging hashtags based on movie data
   */
  generateHashtags(movie) {
    const hashtags = ['#Movies', '#MovieStream', '#TopMovie', '#WatchNow', '#FreeMovies'];
    
    // Add genre-based hashtags if available
    if (movie.genres && Array.isArray(movie.genres)) {
      const genreHashtags = movie.genres.slice(0, 2).map(g => {
        const genreName = typeof g === 'string' ? g : (g.name || '');
        return `#${genreName.replace(/\s+/g, '')}`;
      }).filter(Boolean);
      hashtags.push(...genreHashtags);
    }
    
    // Add year-based hashtag
    if (movie.releaseDate) {
      const year = new Date(movie.releaseDate).getFullYear();
      hashtags.push(`#${year}Movies`);
    }
    
    // Add rating-based hashtag
    if (movie.voteAverage && movie.voteAverage >= 8) {
      hashtags.push('#MustWatch', '#TopRated');
    }
    
    return hashtags.slice(0, 8).join(' '); // Limit to 8 hashtags
  }

  /**
   * Get movie poster URL from TMDB
   */
  getPosterUrl(movie) {
    if (movie.posterPath) {
      return `https://image.tmdb.org/t/p/w780${movie.posterPath}`;
    }
    if (movie.backdropPath) {
      return `https://image.tmdb.org/t/p/w1280${movie.backdropPath}`;
    }
    return null;
  }

  /**
   * Post daily top movies batch to Twitter/X with posters
   */
  async postDailyTopMoviesBatch(movies, siteUrl = null) {
    // Reload settings to get latest from database
    await this.loadSettings();
    
    if (!this.enabled || !this.postDailyTopMovies || !movies || movies.length === 0) {
      return { success: false, error: 'Twitter/X posting disabled or no movies' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      
      // Post top movie with poster (better engagement)
      const topMovie = movies[0];
      
      if (!topMovie) {
        return { success: false, error: 'No movies to post' };
      }

      const year = topMovie.releaseDate 
        ? new Date(topMovie.releaseDate).getFullYear() 
        : 'N/A';
      const movieUrl = `${cleanUrl}/movie/${topMovie._id || topMovie.tmdbId}`;
      const rating = topMovie.voteAverage ? `⭐ ${topMovie.voteAverage.toFixed(1)}/10` : '';
      const overview = topMovie.overview ? topMovie.overview.substring(0, 120) + '...' : 'Check it out!';
      
      // Generate engaging hashtags
      const hashtags = this.generateHashtags(topMovie);
      
      const tweetText = `🎬 Top Movie of the Day!\n\n` +
        `🎥 ${topMovie.title} (${year})\n\n` +
        `${rating}\n\n` +
        `${overview}\n\n` +
        `🔗 Watch Now: ${movieUrl}\n\n` +
        `${hashtags}`;

      // Upload poster image
      let mediaIds = [];
      const posterUrl = this.getPosterUrl(topMovie);
      
      if (posterUrl) {
        logger.info(`Uploading poster for ${topMovie.title}: ${posterUrl}`);
        const mediaResult = await this.uploadMedia(posterUrl);
        if (mediaResult.success) {
          mediaIds.push(mediaResult.mediaId);
          logger.info(`✅ Poster uploaded successfully: ${mediaResult.mediaId}`);
        } else {
          logger.warn(`⚠️ Failed to upload poster, posting without image: ${mediaResult.error}`);
        }
      }

      logger.info(`Posting top movie to Twitter/X: ${topMovie.title}`);
      const result = await this.postTweet(tweetText, mediaIds);
      
      if (result.success) {
        logger.info(`✅ Successfully posted top movie to Twitter/X: ${topMovie.title}`);
      } else {
        logger.error(`❌ Failed to post top movie to Twitter/X:`, result.error);
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to post daily top movies to Twitter/X:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TwitterService();

