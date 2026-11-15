/**
 * Bluesky (AT Protocol) Service
 * Handles auto-posting movies and TV shows to Bluesky (bsky.app)
 */

const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');

class BlueskyService {
  constructor() {
    this.handle = process.env.BLUESKY_HANDLE || null;
    this.appPassword = process.env.BLUESKY_APP_PASSWORD || null;
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.enabled = false;
    this.notifyNewMovies = true;
    this.notifyNewTvShows = true;

    // Session caching
    this.accessJwt = null;
    this.did = null;
    this.sessionExpiresAt = 0;

    // Anti-spam rate limiting protection
    this.lastPostTime = 0;
    this.minPostIntervalMs = 15 * 60 * 1000; // 15 minutes between automated posts

    this.loadSettings().catch(err => {
      logger.error('Failed to load Bluesky settings on init:', err);
    });
  }

  /**
   * Load settings from database or environment
   */
  async loadSettings() {
    try {
      let settings = null;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        settings = await SiteSettings.getSettings();
      }

      if (settings && settings.bluesky) {
        this.handle = settings.bluesky.handle || process.env.BLUESKY_HANDLE || null;
        this.appPassword = settings.bluesky.appPassword || process.env.BLUESKY_APP_PASSWORD || null;
        this.siteUrl = settings.bluesky.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = settings.bluesky.notifyNewMovies !== false;
        this.notifyNewTvShows = settings.bluesky.notifyNewTvShows !== false;
        this.enabled = Boolean(settings.bluesky.enabled && this.handle && this.appPassword);
      } else {
        this.handle = process.env.BLUESKY_HANDLE || null;
        this.appPassword = process.env.BLUESKY_APP_PASSWORD || null;
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = true;
        this.notifyNewTvShows = true;
        this.enabled = Boolean(this.handle && this.appPassword);
      }

      if (this.enabled) {
        logger.info(`Bluesky service enabled for @${this.cleanHandle(this.handle)}`);
      }
    } catch (error) {
      logger.error('Error loading Bluesky settings from database:', error);
    }
  }

  cleanHandle(h) {
    if (!h) return '';
    return h.replace(/^@/, '').trim();
  }

  /**
   * Create or reuse an authenticated AT Protocol session
   */
  async getSession(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.accessJwt && this.did && this.sessionExpiresAt > now + 60000) {
      return { accessJwt: this.accessJwt, did: this.did };
    }

    if (!this.handle || !this.appPassword) {
      throw new Error('Bluesky handle and App Password are required');
    }

    const cleanHandle = this.cleanHandle(this.handle);
    const cleanPassword = this.appPassword.trim();

    const response = await axios.post(
      'https://bsky.social/xrpc/com.atproto.server.createSession',
      {
        identifier: cleanHandle,
        password: cleanPassword
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (!response.data?.accessJwt || !response.data?.did) {
      throw new Error('Bluesky session creation failed: Invalid response from bsky.social');
    }

    this.accessJwt = response.data.accessJwt;
    this.did = response.data.did;
    // Sessions last ~2 hours, refresh every 90 minutes
    this.sessionExpiresAt = Date.now() + 90 * 60 * 1000;

    return { accessJwt: this.accessJwt, did: this.did };
  }

  /**
   * Test Bluesky credentials
   */
  async testConnection() {
    try {
      await this.loadSettings();

      if (!this.handle || !this.appPassword) {
        return {
          success: false,
          error: 'Please enter your Bluesky Handle and App Password first.'
        };
      }

      const { accessJwt, did } = await this.getSession(true);

      // Verify session and get profile info
      const profileRes = await axios.get('https://bsky.social/xrpc/app.bsky.actor.getProfile', {
        params: { actor: did },
        headers: {
          'Authorization': `Bearer ${accessJwt}`
        },
        timeout: 10000
      });

      const displayName = profileRes.data?.displayName || profileRes.data?.handle || this.handle;
      const handle = profileRes.data?.handle || this.handle;

      return {
        success: true,
        message: `Successfully connected to Bluesky as @${handle} (${displayName})! 🎉`,
        handle,
        did
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Bluesky test connection failed:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Parse rich text facets (URLs and hashtags) with UTF-8 byte offsets
   */
  extractFacets(text) {
    const facets = [];
    if (!text) return facets;

    const encoder = new TextEncoder();

    // 1. Extract URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];
      const byteStart = encoder.encode(text.slice(0, match.index)).length;
      const byteEnd = byteStart + encoder.encode(url).length;
      facets.push({
        index: { byteStart, byteEnd },
        features: [{
          $type: 'app.bsky.richtext.facet#link',
          uri: url
        }]
      });
    }

    // 2. Extract Hashtags
    const tagRegex = /(?:^|\s)(#[a-zA-Z0-9_]+)/g;
    while ((match = tagRegex.exec(text)) !== null) {
      const fullTag = match[1];
      const tagClean = fullTag.replace(/^#/, '');
      const tagIndex = match.index + match[0].indexOf('#');
      const byteStart = encoder.encode(text.slice(0, tagIndex)).length;
      const byteEnd = byteStart + encoder.encode(fullTag).length;
      facets.push({
        index: { byteStart, byteEnd },
        features: [{
          $type: 'app.bsky.richtext.facet#tag',
          tag: tagClean
        }]
      });
    }

    return facets;
  }

  /**
   * Upload an image buffer to Bluesky blob storage
   */
  async uploadBlob(imageUrl) {
    if (!imageUrl) return null;

    try {
      const imgRes = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000
      });

      const buffer = Buffer.from(imgRes.data);
      if (buffer.length > 950000) {
        // Blob must be under 1MB
        logger.debug('Poster image buffer exceeds 950KB for Bluesky embed, skipping blob');
        return null;
      }

      const { accessJwt } = await this.getSession();

      const blobRes = await axios.post(
        'https://bsky.social/xrpc/com.atproto.repo.uploadBlob',
        buffer,
        {
          headers: {
            'Authorization': `Bearer ${accessJwt}`,
            'Content-Type': 'image/jpeg'
          },
          timeout: 15000
        }
      );

      return blobRes.data?.blob || null;
    } catch (err) {
      logger.warn('Failed to upload blob to Bluesky (falling back to facet post):', err.message);
      return null;
    }
  }

  /**
   * Post a record to Bluesky feed
   */
  async postPost({ text, embed = null }) {
    try {
      const { accessJwt, did } = await this.getSession();

      const facets = this.extractFacets(text);
      const record = {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString()
      };

      if (facets.length > 0) {
        record.facets = facets;
      }

      if (embed) {
        record.embed = embed;
      }

      const response = await axios.post(
        'https://bsky.social/xrpc/com.atproto.repo.createRecord',
        {
          repo: did,
          collection: 'app.bsky.feed.post',
          record
        },
        {
          headers: {
            'Authorization': `Bearer ${accessJwt}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const rkey = response.data?.uri ? response.data.uri.split('/').pop() : null;
      const cleanHandle = this.cleanHandle(this.handle);
      const postUrl = rkey ? `https://bsky.app/profile/${cleanHandle}/post/${rkey}` : null;

      logger.info(`Successfully posted to Bluesky: ${postUrl || response.data?.uri}`);
      return {
        success: true,
        uri: response.data?.uri,
        cid: response.data?.cid,
        postUrl
      };
    } catch (error) {
      if (error.response?.status === 401) {
        this.accessJwt = null;
        this.sessionExpiresAt = 0;
      }
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Failed to post to Bluesky:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  buildMovieSeoHashtags(movie) {
    const tags = ['#Cinema', '#MovieLovers'];

    // 1. Dynamic Title tag (e.g. #Transformers)
    if (movie.title) {
      const titleTag = movie.title
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 24);
      if (titleTag && titleTag.length >= 3) {
        tags.push(`#${titleTag}`);
      }
    }

    // 2. Dynamic Genre tags (e.g. #Action, #SciFi)
    if (movie.genres && Array.isArray(movie.genres)) {
      movie.genres.slice(0, 2).forEach(g => {
        const name = typeof g === 'string' ? g : g?.name;
        if (name) {
          const cleanG = name.replace(/[^a-zA-Z0-9]/g, '');
          if (cleanG && !tags.includes(`#${cleanG}`)) {
            tags.push(`#${cleanG}`);
          }
        }
      });
    }

    // 3. Dynamic Year tag (e.g. #2024)
    if (movie.releaseDate) {
      const year = new Date(movie.releaseDate).getFullYear();
      if (year && !isNaN(year)) {
        tags.push(`#${year}`);
      }
    }

    // 4. Safe Editorial & Community tags (NO piracy or free stream trigger keywords)
    const searchKeywords = ['#FilmCommunity', '#MovieNews', '#NowWatching', '#FilmSky'];
    for (const kw of searchKeywords) {
      if (!tags.includes(kw)) {
        tags.push(kw);
      }
    }

    return tags;
  }

  buildTvSeoHashtags(tvShow) {
    const tags = ['#TVSeries', '#BingeWatch'];

    if (tvShow.name) {
      const nameTag = tvShow.name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 24);
      if (nameTag && nameTag.length >= 3) {
        tags.push(`#${nameTag}`);
      }
    }

    if (tvShow.genres && Array.isArray(tvShow.genres)) {
      tvShow.genres.slice(0, 2).forEach(g => {
        const name = typeof g === 'string' ? g : g?.name;
        if (name) {
          const cleanG = name.replace(/[^a-zA-Z0-9]/g, '');
          if (cleanG && !tags.includes(`#${cleanG}`)) {
            tags.push(`#${cleanG}`);
          }
        }
      });
    }

    // Safe TV discussion tags (NO piracy trigger keywords)
    const searchKeywords = ['#Television', '#TVGuide', '#TVCommunity', '#Series'];
    for (const kw of searchKeywords) {
      if (!tags.includes(kw)) {
        tags.push(kw);
      }
    }

    return tags;
  }

  /**
   * Post new movie notification to Bluesky with dynamic SEO tags
   * @param {Object} movie 
   * @param {string|null} siteUrl 
   * @param {boolean} isManual - Bypass rate-limit cooldown for admin test/manual triggers
   */
  async notifyNewMovie(movie, siteUrl = null, isManual = false) {
    if (!movie) return { success: false, error: 'No movie data provided' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewMovies) {
      logger.debug(`Bluesky auto-posting disabled or unconfigured - skipping: ${movie.title}`);
      return { success: false, error: 'Bluesky auto-posting disabled' };
    }

    // Anti-spam cooldown check (prevents sync bursts from getting the account suspended)
    const now = Date.now();
    if (!isManual && (now - this.lastPostTime < this.minPostIntervalMs)) {
      const remainingMins = Math.ceil((this.minPostIntervalMs - (now - this.lastPostTime)) / 60000);
      logger.info(`Bluesky anti-spam safety: Skipping post for "${movie.title}" (cooldown active: ${remainingMins}m remaining)`);
      return { success: false, skipped: true, error: `Anti-spam cooldown active (${remainingMins}m remaining)` };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');

      // Dynamic SEO slug URL
      const rawMovieId = movie._id ? String(movie._id) : (movie.tmdbId ? String(movie.tmdbId) : '');
      const idStr = rawMovieId.startsWith('tmdb_') ? rawMovieId.replace('tmdb_', '') : rawMovieId;
      const slugRaw = movie.title
        ? movie.title
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : 'movie';
      const slug = slugRaw.slice(0, 40).replace(/-+$/, '');
      const movieUrl = idStr ? `${cleanUrl}/movie/${idStr}-${slug}` : `${cleanUrl}/movies`;

      const releaseYear = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : (movie.year || 'N/A');

      const rating = movie.voteAverage && movie.voteAverage > 0
        ? `⭐ ${movie.voteAverage.toFixed(1)}/10`
        : '⭐ 8.0/10';

      let genres = '';
      if (movie.genres && Array.isArray(movie.genres)) {
        genres = movie.genres
          .slice(0, 2)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      const allTags = this.buildMovieSeoHashtags(movie);

      // Truncate title if excessively long to guarantee post length budget
      const displayTitle = movie.title && movie.title.length > 55
        ? `${movie.title.slice(0, 52)}...`
        : (movie.title || 'Movie');

      const header = `🎬 ${displayTitle} (${releaseYear})`;
      const meta = [rating, genres ? `🎭 ${genres}` : '', '🎬 Overview & Details'].filter(Boolean).join(' | ');
      const linkLine = `📖 Read synopsis & reviews:\n${movieUrl}`;

      // Assemble text under strict 285 grapheme budget
      let selectedTags = [];
      let currentLen = `${header}\n\n${meta}\n\n${linkLine}\n\n`.length;
      for (const tag of allTags) {
        if (currentLen + tag.length + 1 <= 285) {
          selectedTags.push(tag);
          currentLen += tag.length + 1;
        }
      }

      let text = selectedTags.length > 0
        ? `${header}\n\n${meta}\n\n${linkLine}\n\n${selectedTags.join(' ')}`.trim()
        : `${header}\n\n${meta}\n\n${linkLine}`.trim();

      // Strict safety guards against Bluesky 300-grapheme hard limit
      if (text.length > 290) {
        text = `${header}\n\n${meta}\n\n${linkLine}`.trim();
      }
      if (text.length > 290) {
        text = `${header}\n\n${linkLine}`.trim();
      }
      if (text.length > 290) {
        const maxH = Math.max(20, 280 - linkLine.length);
        text = `${header.slice(0, maxH)}...\n\n${linkLine}`.trim();
      }

      // Check for official YouTube trailer from TMDB
      let trailerKey = null;
      const tmdbIdNum = movie.tmdbId || (idStr && /^\d+$/.test(idStr) ? parseInt(idStr, 10) : null);
      if (tmdbIdNum) {
        try {
          const tmdbService = require('./tmdbService');
          trailerKey = await tmdbService.getMovieTrailer(tmdbIdNum);
        } catch (tErr) {
          logger.debug(`Could not fetch movie trailer for ${movie.title}:`, tErr.message);
        }
      }

      // Upload poster or trailer thumbnail blob for rich card preview
      const posterUrl = movie.posterPath
        ? (movie.posterPath.startsWith('http') ? movie.posterPath : `https://image.tmdb.org/t/p/w500${movie.posterPath}`)
        : null;

      let embed = null;
      if (trailerKey) {
        // Embed official playable YouTube trailer in Bluesky feed
        const youtubeThumbUrl = `https://img.youtube.com/vi/${trailerKey}/hqdefault.jpg`;
        const blob = (await this.uploadBlob(youtubeThumbUrl)) || (posterUrl ? await this.uploadBlob(posterUrl) : null);
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: `https://www.youtube.com/watch?v=${trailerKey}`,
            title: `▶️ ${displayTitle} (${releaseYear}) - Official Trailer`,
            description: movie.overview ? movie.overview.slice(0, 180) : `Watch the official trailer and preview for ${displayTitle} (${releaseYear}).`,
            ...(blob ? { thumb: blob } : {})
          }
        };
      } else if (posterUrl) {
        const blob = await this.uploadBlob(posterUrl);
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: movieUrl,
            title: `${displayTitle} (${releaseYear}) - Overview & Cast`,
            description: movie.overview ? movie.overview.slice(0, 200) : `Movie overview, ratings, and release details for ${displayTitle}.`,
            ...(blob ? { thumb: blob } : {})
          }
        };
      }

      const postResult = await this.postPost({ text, embed });
      if (postResult && postResult.success) {
        this.lastPostTime = Date.now();
      }
      return postResult;
    } catch (error) {
      logger.error(`Exception in Bluesky notifyNewMovie for ${movie.title}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Post new TV show notification to Bluesky with dynamic SEO tags
   * @param {Object} tvShow 
   * @param {string|null} siteUrl 
   * @param {boolean} isManual - Bypass rate-limit cooldown for admin test/manual triggers
   */
  async notifyNewTvShow(tvShow, siteUrl = null, isManual = false) {
    if (!tvShow) return { success: false, error: 'No TV show data provided' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewTvShows) {
      logger.debug(`Bluesky auto-posting disabled or unconfigured - skipping TV show: ${tvShow.name}`);
      return { success: false, error: 'Bluesky auto-posting disabled' };
    }

    // Anti-spam cooldown check (prevents sync bursts from getting the account suspended)
    const now = Date.now();
    if (!isManual && (now - this.lastPostTime < this.minPostIntervalMs)) {
      const remainingMins = Math.ceil((this.minPostIntervalMs - (now - this.lastPostTime)) / 60000);
      logger.info(`Bluesky anti-spam safety: Skipping post for "${tvShow.name}" (cooldown active: ${remainingMins}m remaining)`);
      return { success: false, skipped: true, error: `Anti-spam cooldown active (${remainingMins}m remaining)` };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');

      // Dynamic SEO slug URL
      const rawTvId = tvShow._id ? String(tvShow._id) : (tvShow.tmdbId ? String(tvShow.tmdbId) : '');
      const idStr = rawTvId.startsWith('tmdb_') ? rawTvId.replace('tmdb_', '') : rawTvId;
      const slugRaw = tvShow.name
        ? tvShow.name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        : 'series';
      const slug = slugRaw.slice(0, 40).replace(/-+$/, '');
      const tvUrl = idStr ? `${cleanUrl}/tvshow/${idStr}-${slug}` : `${cleanUrl}/tvshows`;

      const releaseYear = tvShow.firstAirDate
        ? new Date(tvShow.firstAirDate).getFullYear()
        : 'N/A';

      const rating = tvShow.voteAverage && tvShow.voteAverage > 0
        ? `⭐ ${tvShow.voteAverage.toFixed(1)}/10`
        : '⭐ 8.0/10';

      let genres = '';
      if (tvShow.genres && Array.isArray(tvShow.genres)) {
        genres = tvShow.genres
          .slice(0, 2)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      const allTags = this.buildTvSeoHashtags(tvShow);

      // Truncate title if excessively long
      const displayTitle = tvShow.name && tvShow.name.length > 55
        ? `${tvShow.name.slice(0, 52)}...`
        : (tvShow.name || 'Series');

      const header = `📺 ${displayTitle} (${releaseYear})`;
      const meta = [rating, genres ? `🎭 ${genres}` : '', '📺 Series Overview'].filter(Boolean).join(' | ');
      const linkLine = `📖 Explore series & episode guide:\n${tvUrl}`;

      let selectedTags = [];
      let currentLen = `${header}\n\n${meta}\n\n${linkLine}\n\n`.length;
      for (const tag of allTags) {
        if (currentLen + tag.length + 1 <= 285) {
          selectedTags.push(tag);
          currentLen += tag.length + 1;
        }
      }

      let text = selectedTags.length > 0
        ? `${header}\n\n${meta}\n\n${linkLine}\n\n${selectedTags.join(' ')}`.trim()
        : `${header}\n\n${meta}\n\n${linkLine}`.trim();

      // Strict safety guards against Bluesky 300-grapheme hard limit
      if (text.length > 290) {
        text = `${header}\n\n${meta}\n\n${linkLine}`.trim();
      }
      if (text.length > 290) {
        text = `${header}\n\n${linkLine}`.trim();
      }
      if (text.length > 290) {
        const maxH = Math.max(20, 280 - linkLine.length);
        text = `${header.slice(0, maxH)}...\n\n${linkLine}`.trim();
      }

      // Check for official YouTube trailer from TMDB
      let trailerKey = null;
      const tmdbIdNum = tvShow.tmdbId || (idStr && /^\d+$/.test(idStr) ? parseInt(idStr, 10) : null);
      if (tmdbIdNum) {
        try {
          const tmdbService = require('./tmdbService');
          trailerKey = await tmdbService.getTvTrailer(tmdbIdNum);
        } catch (tErr) {
          logger.debug(`Could not fetch TV trailer for ${tvShow.name}:`, tErr.message);
        }
      }

      const posterUrl = tvShow.posterPath
        ? (tvShow.posterPath.startsWith('http') ? tvShow.posterPath : `https://image.tmdb.org/t/p/w500${tvShow.posterPath}`)
        : null;

      let embed = null;
      if (trailerKey) {
        // Embed official playable YouTube trailer in Bluesky feed
        const youtubeThumbUrl = `https://img.youtube.com/vi/${trailerKey}/hqdefault.jpg`;
        const blob = (await this.uploadBlob(youtubeThumbUrl)) || (posterUrl ? await this.uploadBlob(posterUrl) : null);
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: `https://www.youtube.com/watch?v=${trailerKey}`,
            title: `▶️ ${displayTitle} (${releaseYear}) - Official Trailer`,
            description: tvShow.overview ? tvShow.overview.slice(0, 180) : `Watch the official trailer and series preview for ${displayTitle}.`,
            ...(blob ? { thumb: blob } : {})
          }
        };
      } else if (posterUrl) {
        const blob = await this.uploadBlob(posterUrl);
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: tvUrl,
            title: `${displayTitle} (${releaseYear}) - Series Overview`,
            description: tvShow.overview ? tvShow.overview.slice(0, 200) : `Episode guide, synopsis, and details for ${displayTitle}.`,
            ...(blob ? { thumb: blob } : {})
          }
        };
      }

      const postResult = await this.postPost({ text, embed });
      if (postResult && postResult.success) {
        this.lastPostTime = Date.now();
      }
      return postResult;
    } catch (error) {
      logger.error(`Exception in Bluesky notifyNewTvShow for ${tvShow.name}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new BlueskyService();

