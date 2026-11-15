/**
 * Reddit Service
 * Handles auto-posting new movies and TV shows to a specified Subreddit or user profile.
 */

const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');

class RedditService {
  constructor() {
    this.clientId = process.env.REDDIT_CLIENT_ID || null;
    this.clientSecret = process.env.REDDIT_CLIENT_SECRET || null;
    this.username = process.env.REDDIT_USERNAME || null;
    this.password = process.env.REDDIT_PASSWORD || null;
    this.subreddit = process.env.REDDIT_SUBREDDIT || null;
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.postType = 'link'; // 'link' or 'self'
    this.notifyNewMovies = true;
    this.notifyNewTvShows = true;
    this.enabled = false;

    // Token caching
    this.accessToken = null;
    this.tokenExpiresAt = 0;

    // Load settings from database on init
    this.loadSettings().catch(err => {
      logger.error('Failed to load Reddit settings on init:', err);
    });
  }

  get userAgent() {
    const user = this.username ? this.username.replace(/^u\//, '') : 'moviestreambot';
    return `web:MovieStream:v1.0.0 (by /u/${user})`;
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

      if (settings && settings.reddit) {
        this.clientId = settings.reddit.clientId || process.env.REDDIT_CLIENT_ID || null;
        this.clientSecret = settings.reddit.clientSecret || process.env.REDDIT_CLIENT_SECRET || null;
        this.username = settings.reddit.username || process.env.REDDIT_USERNAME || null;
        this.password = settings.reddit.password || process.env.REDDIT_PASSWORD || null;
        this.subreddit = settings.reddit.subreddit || process.env.REDDIT_SUBREDDIT || null;
        this.siteUrl = settings.reddit.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.postType = settings.reddit.postType || 'link';
        this.notifyNewMovies = settings.reddit.notifyNewMovies !== false;
        this.notifyNewTvShows = settings.reddit.notifyNewTvShows !== false;
        
        const hasCredentials = !!(this.clientId && this.clientSecret && this.username && this.password && this.subreddit);
        this.enabled = Boolean(settings.reddit.enabled && hasCredentials);
      } else {
        this.clientId = process.env.REDDIT_CLIENT_ID || null;
        this.clientSecret = process.env.REDDIT_CLIENT_SECRET || null;
        this.username = process.env.REDDIT_USERNAME || null;
        this.password = process.env.REDDIT_PASSWORD || null;
        this.subreddit = process.env.REDDIT_SUBREDDIT || null;
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.postType = 'link';
        this.notifyNewMovies = true;
        this.notifyNewTvShows = true;

        const hasCredentials = !!(this.clientId && this.clientSecret && this.username && this.password && this.subreddit);
        this.enabled = hasCredentials;
      }

      if (this.enabled) {
        logger.info(`Reddit service enabled for r/${this.cleanSubreddit(this.subreddit)} (type: ${this.postType})`);
      } else if (this.clientId && this.username) {
        logger.debug('Reddit credentials configured but service is disabled in settings');
      }
    } catch (error) {
      logger.error('Error loading Reddit settings from database:', error);
    }
  }

  cleanSubreddit(sr) {
    if (!sr) return '';
    return sr.replace(/^r\//i, '').replace(/^\/r\//i, '').trim();
  }

  /**
   * Acquire or reuse valid OAuth access token
   */
  async getAccessToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
      throw new Error('Reddit credentials missing: clientId, clientSecret, username, and password are required');
    }

    const authHeader = Buffer.from(`${this.clientId.trim()}:${this.clientSecret.trim()}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'password',
      username: this.username.trim(),
      password: this.password.trim()
    });

    const response = await axios.post('https://www.reddit.com/api/v1/access_token', params.toString(), {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': this.userAgent
      },
      timeout: 10000
    });

    if (response.data && response.data.error) {
      throw new Error(`Reddit auth error: ${response.data.error}`);
    }

    if (!response.data || !response.data.access_token) {
      throw new Error('Reddit auth failed: No access_token returned');
    }

    this.accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    this.tokenExpiresAt = Date.now() + expiresIn * 1000;

    return this.accessToken;
  }

  /**
   * Test Reddit connection by verifying credentials with /api/v1/me and subreddit check
   */
  async testConnection() {
    try {
      await this.loadSettings();

      if (!this.clientId || !this.clientSecret || !this.username || !this.password) {
        return {
          success: false,
          error: 'Missing Reddit credentials. Please provide Client ID, Client Secret, Username, and Password.'
        };
      }

      if (!this.subreddit) {
        return {
          success: false,
          error: 'Subreddit is required (e.g. r/yourcommunity or your own subreddit).'
        };
      }

      // 1. Authenticate
      const token = await this.getAccessToken(true);

      // 2. Fetch authenticated user profile
      const meResponse = await axios.get('https://oauth.reddit.com/api/v1/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': this.userAgent
        },
        timeout: 10000
      });

      const redditUser = meResponse.data?.name || this.username;

      // 3. Check target subreddit
      const targetSr = this.cleanSubreddit(this.subreddit);
      let subredditInfo = null;
      try {
        const srResponse = await axios.get(`https://oauth.reddit.com/r/${targetSr}/about`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': this.userAgent
          },
          timeout: 10000
        });
        subredditInfo = srResponse.data?.data?.display_name_prefixed || `r/${targetSr}`;
      } catch (srErr) {
        logger.warn(`Could not fetch info for r/${targetSr}:`, srErr.response?.data?.message || srErr.message);
      }

      return {
        success: true,
        message: `Successfully connected to Reddit as /u/${redditUser}! Target subreddit: ${subredditInfo || `r/${targetSr}`}`,
        user: redditUser,
        subreddit: targetSr
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Reddit test connection failed:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Submit post to Reddit
   */
  async submitPost({ title, url = null, text = null, kind = 'link', subreddit = null }) {
    try {
      const targetSubreddit = this.cleanSubreddit(subreddit || this.subreddit);
      if (!targetSubreddit) {
        return { success: false, error: 'Target subreddit not specified' };
      }

      const token = await this.getAccessToken();

      const postKind = kind === 'self' ? 'self' : 'link';
      const postParams = {
        api_type: 'json',
        sr: targetSubreddit,
        kind: postKind,
        title: title.slice(0, 300), // Reddit title max length is 300
        resubmit: 'true',
        sendreplies: 'false'
      };

      if (postKind === 'link') {
        if (!url) {
          return { success: false, error: 'URL is required for link submissions' };
        }
        postParams.url = url;
      } else {
        postParams.text = text || '';
      }

      const response = await axios.post(
        'https://oauth.reddit.com/api/submit',
        new URLSearchParams(postParams).toString(),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': this.userAgent
          },
          timeout: 15000
        }
      );

      const json = response.data?.json;
      if (json?.errors && json.errors.length > 0) {
        const errorString = json.errors.map(err => err.join(': ')).join('; ');
        logger.error(`Reddit submit error: ${errorString}`);
        return { success: false, error: errorString };
      }

      const postData = json?.data;
      const permalink = postData?.url || (postData?.id ? `https://reddit.com/r/${targetSubreddit}/comments/${postData.id}` : null);

      logger.info(`Successfully posted to Reddit r/${targetSubreddit}: ${title}`);
      return {
        success: true,
        postId: postData?.id || postData?.name,
        postUrl: permalink
      };
    } catch (error) {
      // If token expired, clear cache so next retry gets a new token
      if (error.response?.status === 401) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
      }
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Failed to submit post to Reddit:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Post a new movie notification to Reddit
   */
  async notifyNewMovie(movie, siteUrl = null) {
    if (!movie) {
      return { success: false, error: 'No movie data provided' };
    }

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewMovies) {
      logger.debug(`Reddit auto-posting disabled or unconfigured - skipping: ${movie.title}`);
      return { success: false, error: 'Reddit auto-posting is disabled or unconfigured' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const movieUrl = `${cleanUrl}/movie/${movie._id || movie.tmdbId}`;

      const releaseYear = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : (movie.year || 'N/A');

      const rating = movie.voteAverage && movie.voteAverage > 0
        ? `⭐ ${movie.voteAverage.toFixed(1)}/10`
        : null;

      let genres = '';
      if (movie.genres && Array.isArray(movie.genres)) {
        genres = movie.genres
          .slice(0, 3)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      const titleMeta = [rating, genres ? `${genres}` : null].filter(Boolean).join(' • ');
      const postTitle = `🎬 ${movie.title} (${releaseYear})${titleMeta ? ` [${titleMeta}]` : ''} - Watch Free in HD`;

      if (this.postType === 'link') {
        return await this.submitPost({
          title: postTitle,
          url: movieUrl,
          kind: 'link'
        });
      }

      // Rich self/text post
      const posterUrl = movie.posterPath
        ? (movie.posterPath.startsWith('http') ? movie.posterPath : `https://image.tmdb.org/t/p/w500${movie.posterPath}`)
        : null;

      let markdown = `## 🎬 [${movie.title} (${releaseYear})](${movieUrl})\n\n`;
      if (posterUrl) {
        markdown += `[![Poster](${posterUrl})](${movieUrl})\n\n`;
      }
      markdown += `**Release Year:** ${releaseYear}  \n`;
      if (rating) markdown += `**Rating:** ${rating}  \n`;
      if (genres) markdown += `**Genres:** ${genres}  \n`;
      if (movie.overview) {
        markdown += `\n### 📖 Synopsis\n${movie.overview.trim()}\n\n`;
      }
      markdown += `---\n\n### [▶️ Click Here to Watch ${movie.title} Free in HD](${movieUrl})\n\n`;
      markdown += `*Stream movies and TV shows in full HD for free on MovieStream.*`;

      return await this.submitPost({
        title: postTitle,
        text: markdown,
        kind: 'self'
      });
    } catch (error) {
      logger.error(`Exception in notifyNewMovie for ${movie.title}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post a new TV show notification to Reddit
   */
  async notifyNewTvShow(tvShow, siteUrl = null) {
    if (!tvShow) {
      return { success: false, error: 'No TV show data provided' };
    }

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewTvShows) {
      logger.debug(`Reddit auto-posting disabled or unconfigured - skipping TV show: ${tvShow.name}`);
      return { success: false, error: 'Reddit auto-posting is disabled or unconfigured' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const tvUrl = `${cleanUrl}/tv/${tvShow._id || tvShow.tmdbId}`;

      const releaseYear = tvShow.firstAirDate
        ? new Date(tvShow.firstAirDate).getFullYear()
        : 'N/A';

      const rating = tvShow.voteAverage && tvShow.voteAverage > 0
        ? `⭐ ${tvShow.voteAverage.toFixed(1)}/10`
        : null;

      let genres = '';
      if (tvShow.genres && Array.isArray(tvShow.genres)) {
        genres = tvShow.genres
          .slice(0, 3)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      const titleMeta = [rating, genres ? `${genres}` : null].filter(Boolean).join(' • ');
      const postTitle = `📺 ${tvShow.name} (${releaseYear})${titleMeta ? ` [${titleMeta}]` : ''} - Watch All Episodes in HD`;

      if (this.postType === 'link') {
        return await this.submitPost({
          title: postTitle,
          url: tvUrl,
          kind: 'link'
        });
      }

      // Rich self/text post
      const posterUrl = tvShow.posterPath
        ? (tvShow.posterPath.startsWith('http') ? tvShow.posterPath : `https://image.tmdb.org/t/p/w500${tvShow.posterPath}`)
        : null;

      let markdown = `## 📺 [${tvShow.name} (${releaseYear})](${tvUrl})\n\n`;
      if (posterUrl) {
        markdown += `[![Poster](${posterUrl})](${tvUrl})\n\n`;
      }
      markdown += `**First Air Date:** ${releaseYear}  \n`;
      if (rating) markdown += `**Rating:** ${rating}  \n`;
      if (genres) markdown += `**Genres:** ${genres}  \n`;
      if (tvShow.overview) {
        markdown += `\n### 📖 Synopsis\n${tvShow.overview.trim()}\n\n`;
      }
      markdown += `---\n\n### [▶️ Click Here to Watch ${tvShow.name} All Episodes Free in HD](${tvUrl})\n\n`;
      markdown += `*Stream TV shows and movies in full HD for free on MovieStream.*`;

      return await this.submitPost({
        title: postTitle,
        text: markdown,
        kind: 'self'
      });
    } catch (error) {
      logger.error(`Exception in notifyNewTvShow for ${tvShow.name}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new RedditService();
