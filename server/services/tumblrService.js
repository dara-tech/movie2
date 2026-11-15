/**
 * Tumblr Service
 * Handles auto-posting movies and TV shows to Tumblr with OAuth 1.0a signing,
 * playable YouTube trailers, rich posters, and direct streaming links.
 */

const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');

class TumblrService {
  constructor() {
    this.consumerKey = process.env.TUMBLR_CONSUMER_KEY || null;
    this.consumerSecret = process.env.TUMBLR_CONSUMER_SECRET || null;
    this.accessToken = process.env.TUMBLR_ACCESS_TOKEN || null;
    this.accessTokenSecret = process.env.TUMBLR_ACCESS_TOKEN_SECRET || null;
    this.blogIdentifier = process.env.TUMBLR_BLOG_IDENTIFIER || 'freemoviestreamhd';
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.enabled = false;
    this.notifyNewMovies = true;
    this.notifyNewTvShows = true;

    this.loadSettings().catch(err => {
      logger.error('Failed to load Tumblr settings on init:', err);
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

      if (settings && settings.tumblr) {
        this.consumerKey = settings.tumblr.consumerKey || process.env.TUMBLR_CONSUMER_KEY || null;
        this.consumerSecret = settings.tumblr.consumerSecret || process.env.TUMBLR_CONSUMER_SECRET || null;
        this.accessToken = settings.tumblr.accessToken || process.env.TUMBLR_ACCESS_TOKEN || null;
        this.accessTokenSecret = settings.tumblr.accessTokenSecret || process.env.TUMBLR_ACCESS_TOKEN_SECRET || null;
        this.blogIdentifier = settings.tumblr.blogIdentifier || process.env.TUMBLR_BLOG_IDENTIFIER || 'freemoviestreamhd';
        this.siteUrl = settings.tumblr.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = settings.tumblr.notifyNewMovies !== false;
        this.notifyNewTvShows = settings.tumblr.notifyNewTvShows !== false;
        this.enabled = Boolean(settings.tumblr.enabled && this.consumerKey && this.consumerSecret && this.accessToken && this.accessTokenSecret);
      } else {
        this.consumerKey = process.env.TUMBLR_CONSUMER_KEY || null;
        this.consumerSecret = process.env.TUMBLR_CONSUMER_SECRET || null;
        this.accessToken = process.env.TUMBLR_ACCESS_TOKEN || null;
        this.accessTokenSecret = process.env.TUMBLR_ACCESS_TOKEN_SECRET || null;
        this.blogIdentifier = process.env.TUMBLR_BLOG_IDENTIFIER || 'freemoviestreamhd';
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = true;
        this.notifyNewTvShows = true;
        this.enabled = Boolean(this.consumerKey && this.consumerSecret && this.accessToken && this.accessTokenSecret);
      }

      if (this.enabled) {
        logger.info(`Tumblr service enabled for blog: ${this.blogIdentifier}`);
      }
    } catch (error) {
      logger.error('Error loading Tumblr settings from database:', error);
    }
  }

  percentEncode(str) {
    return encodeURIComponent(String(str)).replace(/[!*\'()]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);
  }

  /**
   * Make signed OAuth 1.0a request to Tumblr API
   */
  requestOAuth(method, endpointUrl, params = {}, tokenSecret = null) {
    return new Promise((resolve, reject) => {
      const oauthParams = {
        oauth_consumer_key: this.consumerKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: '1.0'
      };

      if (this.accessToken) {
        oauthParams.oauth_token = this.accessToken;
      }

      // Combine params for signing
      const allParams = { ...oauthParams, ...params };
      const sortedKeys = Object.keys(allParams).sort();
      const paramString = sortedKeys.map(k => `${this.percentEncode(k)}=${this.percentEncode(allParams[k])}`).join('&');
      const baseString = `${method.toUpperCase()}&${this.percentEncode(endpointUrl)}&${this.percentEncode(paramString)}`;
      const signingKey = `${this.percentEncode(this.consumerSecret)}&${this.percentEncode(tokenSecret || this.accessTokenSecret || '')}`;

      const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
      oauthParams.oauth_signature = signature;

      const authHeader = 'OAuth ' + Object.keys(oauthParams).sort().map(k => `${this.percentEncode(k)}="${this.percentEncode(oauthParams[k])}"`).join(', ');

      const postData = querystring.stringify(params);

      const parsedUrl = new URL(endpointUrl);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method.toUpperCase(),
        headers: {
          'Authorization': authHeader,
          'User-Agent': 'MovieStream/1.0.0'
        }
      };

      if (method.toUpperCase() === 'POST') {
        reqOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = https.request(reqOptions, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              const errMsg = json.meta?.msg || json.errors?.[0]?.message || `HTTP ${res.statusCode}`;
              reject(new Error(errMsg));
            }
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(querystring.parse(body));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
            }
          }
        });
      });

      req.on('error', reject);
      if (method.toUpperCase() === 'POST' && postData) {
        req.write(postData);
      }
      req.end();
    });
  }

  /**
   * Test connection to Tumblr
   */
  async testConnection() {
    try {
      await this.loadSettings();

      if (!this.consumerKey || !this.consumerSecret || !this.accessToken || !this.accessTokenSecret) {
        return {
          success: false,
          error: 'Tumblr Consumer Key, Secret, Access Token, and Token Secret are all required.'
        };
      }

      const res = await this.requestOAuth('POST', 'https://api.tumblr.com/v2/user/info');
      const user = res.response?.user;
      const blogs = user?.blogs?.map(b => b.name) || [];

      return {
        success: true,
        message: `Successfully connected to Tumblr as @${user?.name}! Available blogs: ${blogs.join(', ')}`,
        user: user?.name,
        blogs
      };
    } catch (error) {
      logger.error('Tumblr testConnection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build tags string for SEO
   */
  buildTags(title, genres = [], type = 'movie') {
    const tags = ['movies', 'cinema', 'film', 'trailer', type === 'movie' ? 'movie recommendation' : 'tv series'];

    if (title) {
      const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim().toLowerCase();
      if (cleanTitle && !tags.includes(cleanTitle)) {
        tags.push(cleanTitle);
      }
    }

    if (Array.isArray(genres)) {
      genres.slice(0, 3).forEach(g => {
        const name = typeof g === 'string' ? g : g?.name;
        if (name) {
          const clean = name.replace(/[^a-zA-Z0-9 ]/g, '').trim().toLowerCase();
          if (clean && !tags.includes(clean)) {
            tags.push(clean);
          }
        }
      });
    }

    return tags.join(',');
  }

  /**
   * Post new movie to Tumblr
   */
  async notifyNewMovie(movie, siteUrl = null) {
    if (!movie) return { success: false, error: 'No movie data provided' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewMovies) {
      logger.debug(`Tumblr auto-posting disabled or unconfigured - skipping movie: ${movie.title}`);
      return { success: false, error: 'Tumblr auto-posting disabled' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
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
            .slice(0, 40)
        : 'movie';

      const movieUrl = idStr ? `${cleanUrl}/movie/${idStr}-${slug}` : `${cleanUrl}/movies`;

      const releaseYear = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : (movie.year || 'N/A');

      const rating = movie.voteAverage && movie.voteAverage > 0
        ? `⭐ ${movie.voteAverage.toFixed(1)}/10`
        : '⭐ 8.0/10';

      const genres = Array.isArray(movie.genres)
        ? movie.genres.slice(0, 2).map(g => (typeof g === 'string' ? g : (g.name || ''))).filter(Boolean).join(', ')
        : '';

      // Check for YouTube trailer
      let trailerKey = null;
      const tmdbIdNum = movie.tmdbId || (idStr && /^\d+$/.test(idStr) ? parseInt(idStr, 10) : null);
      if (tmdbIdNum) {
        try {
          const tmdbService = require('./tmdbService');
          trailerKey = await tmdbService.getMovieTrailer(tmdbIdNum);
        } catch {}
      }

      const posterUrl = movie.posterPath
        ? (movie.posterPath.startsWith('http') ? movie.posterPath : `https://image.tmdb.org/t/p/w780${movie.posterPath}`)
        : null;

      const tags = this.buildTags(movie.title, movie.genres, 'movie');

      let postParams = {};
      const endpoint = `https://api.tumblr.com/v2/blog/${this.blogIdentifier}/post`;

      const captionHtml = `
        <h2>🎬 ${movie.title} (${releaseYear})</h2>
        <p><b>Rating:</b> ${rating} | <b>Genres:</b> ${genres || 'Drama'} | <b>Quality:</b> 1080p HD</p>
        <p>${movie.overview ? movie.overview.slice(0, 250) + '...' : ''}</p>
        <p>🍿 <b><a href="${movieUrl}" target="_blank">Watch on MovieStream</a></b></p>
      `.trim();

      if (trailerKey) {
        // Post as playable video with YouTube embed
        postParams = {
          type: 'video',
          embed: `https://www.youtube.com/watch?v=${trailerKey}`,
          caption: captionHtml,
          tags
        };
      } else if (posterUrl) {
        // Post as photo with poster
        postParams = {
          type: 'photo',
          source: posterUrl,
          caption: captionHtml,
          link_url: movieUrl,
          tags
        };
      } else {
        // Fallback text post
        postParams = {
          type: 'text',
          title: `🎬 ${movie.title} (${releaseYear}) HD`,
          body: captionHtml,
          tags
        };
      }

      const res = await this.requestOAuth('POST', endpoint, postParams);
      const postId = res.response?.id_string || res.response?.id;
      const postUrl = `https://${this.blogIdentifier}.tumblr.com/post/${postId}`;

      logger.info(`✅ Successfully posted Movie "${movie.title}" to Tumblr (${postUrl})`);
      return {
        success: true,
        postId,
        postUrl
      };
    } catch (error) {
      logger.error(`Exception in Tumblr notifyNewMovie for ${movie.title}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post new TV show to Tumblr
   */
  async notifyNewTvShow(tvShow, siteUrl = null) {
    if (!tvShow) return { success: false, error: 'No TV show data provided' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewTvShows) {
      logger.debug(`Tumblr auto-posting disabled or unconfigured - skipping TV show: ${tvShow.name}`);
      return { success: false, error: 'Tumblr auto-posting disabled' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
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
            .slice(0, 40)
        : 'series';

      const tvUrl = idStr ? `${cleanUrl}/tvshow/${idStr}-${slug}` : `${cleanUrl}/tvshows`;

      const releaseYear = tvShow.firstAirDate
        ? new Date(tvShow.firstAirDate).getFullYear()
        : 'N/A';

      const rating = tvShow.voteAverage && tvShow.voteAverage > 0
        ? `⭐ ${tvShow.voteAverage.toFixed(1)}/10`
        : '⭐ 8.0/10';

      const genres = Array.isArray(tvShow.genres)
        ? tvShow.genres.slice(0, 2).map(g => (typeof g === 'string' ? g : (g.name || ''))).filter(Boolean).join(', ')
        : '';

      let trailerKey = null;
      const tmdbIdNum = tvShow.tmdbId || (idStr && /^\d+$/.test(idStr) ? parseInt(idStr, 10) : null);
      if (tmdbIdNum) {
        try {
          const tmdbService = require('./tmdbService');
          trailerKey = await tmdbService.getTvTrailer(tmdbIdNum);
        } catch {}
      }

      const posterUrl = tvShow.posterPath
        ? (tvShow.posterPath.startsWith('http') ? tvShow.posterPath : `https://image.tmdb.org/t/p/w780${tvShow.posterPath}`)
        : null;

      const tags = this.buildTags(tvShow.name, tvShow.genres, 'tv');

      let postParams = {};
      const endpoint = `https://api.tumblr.com/v2/blog/${this.blogIdentifier}/post`;

      const captionHtml = `
        <h2>📺 ${tvShow.name} (${releaseYear})</h2>
        <p><b>Rating:</b> ${rating} | <b>Genres:</b> ${genres || 'Series'} | <b>Quality:</b> 1080p HD</p>
        <p>${tvShow.overview ? tvShow.overview.slice(0, 250) + '...' : ''}</p>
        <p>🍿 <b><a href="${tvUrl}" target="_blank">Watch on MovieStream</a></b></p>
      `.trim();

      if (trailerKey) {
        postParams = {
          type: 'video',
          embed: `https://www.youtube.com/watch?v=${trailerKey}`,
          caption: captionHtml,
          tags
        };
      } else if (posterUrl) {
        postParams = {
          type: 'photo',
          source: posterUrl,
          caption: captionHtml,
          link_url: tvUrl,
          tags
        };
      } else {
        postParams = {
          type: 'text',
          title: `📺 ${tvShow.name} (${releaseYear}) HD`,
          body: captionHtml,
          tags
        };
      }

      const res = await this.requestOAuth('POST', endpoint, postParams);
      const postId = res.response?.id_string || res.response?.id;
      const postUrl = `https://${this.blogIdentifier}.tumblr.com/post/${postId}`;

      logger.info(`✅ Successfully posted TV Show "${tvShow.name}" to Tumblr (${postUrl})`);
      return {
        success: true,
        postId,
        postUrl
      };
    } catch (error) {
      logger.error(`Exception in Tumblr notifyNewTvShow for ${tvShow.name}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new TumblrService();
