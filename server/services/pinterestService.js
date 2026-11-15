/**
 * Pinterest Service
 * Handles auto-pinning new movies and TV shows to Pinterest boards
 */

const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const SiteSettings = require('../models/SiteSettings');

class PinterestService {
  constructor() {
    this.accessToken = process.env.PINTEREST_ACCESS_TOKEN || null;
    this.boardId = process.env.PINTEREST_BOARD_ID || null;
    this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
    this.enabled = false;
    this.notifyNewMovies = true;
    this.notifyNewTvShows = true;

    this.loadSettings().catch(err => {
      logger.error('Failed to load Pinterest settings on init:', err);
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

      if (settings && settings.pinterest) {
        this.accessToken = settings.pinterest.accessToken || process.env.PINTEREST_ACCESS_TOKEN || null;
        this.boardId = settings.pinterest.boardId || process.env.PINTEREST_BOARD_ID || null;
        this.siteUrl = settings.pinterest.siteUrl || process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = settings.pinterest.notifyNewMovies !== false;
        this.notifyNewTvShows = settings.pinterest.notifyNewTvShows !== false;
        this.enabled = Boolean(settings.pinterest.enabled && this.accessToken && this.boardId);
      } else {
        this.accessToken = process.env.PINTEREST_ACCESS_TOKEN || null;
        this.boardId = process.env.PINTEREST_BOARD_ID || null;
        this.siteUrl = process.env.CLIENT_URL || process.env.SITE_URL || 'https://moviestream.cc';
        this.notifyNewMovies = true;
        this.notifyNewTvShows = true;
        this.enabled = Boolean(this.accessToken && this.boardId);
      }

      if (this.enabled) {
        logger.info(`Pinterest service enabled (Board: ${this.boardId})`);
      }
    } catch (error) {
      logger.error('Error loading Pinterest settings from database:', error);
    }
  }

  /**
   * Fetch user boards from Pinterest
   */
  async getBoards() {
    if (!this.accessToken) {
      throw new Error('Pinterest access token is missing');
    }

    try {
      const response = await axios.get('https://api.pinterest.com/v5/boards', {
        headers: {
          'Authorization': `Bearer ${this.accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const boards = response.data?.items || [];
      return {
        success: true,
        boards: boards.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description,
          privacy: b.privacy
        }))
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Failed to fetch Pinterest boards:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Test connection to Pinterest
   */
  async testConnection() {
    try {
      await this.loadSettings();

      if (!this.accessToken) {
        return {
          success: false,
          error: 'Missing Pinterest Access Token.'
        };
      }

      // Try fetching user account or boards
      const userRes = await axios.get('https://api.pinterest.com/v5/user_account', {
        headers: {
          'Authorization': `Bearer ${this.accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const username = userRes.data?.username || 'Pinterest User';

      // Fetch boards to check access
      let boardsList = [];
      try {
        const boardsRes = await this.getBoards();
        if (boardsRes.success) {
          boardsList = boardsRes.boards;
        }
      } catch (bErr) {
        logger.warn('Could not list Pinterest boards during test:', bErr.message);
      }

      return {
        success: true,
        message: `Successfully connected to Pinterest as @${username}!`,
        username,
        boards: boardsList
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Pinterest test connection failed:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Create a Pin on Pinterest
   */
  async createPin({ title, description, link, imageUrl, boardId = null }) {
    try {
      const targetBoard = boardId || this.boardId;
      if (!targetBoard) {
        return { success: false, error: 'Pinterest Board ID is required' };
      }
      if (!this.accessToken) {
        return { success: false, error: 'Pinterest Access Token is missing' };
      }
      if (!imageUrl) {
        return { success: false, error: 'Poster image URL is required for Pinterest pins' };
      }

      const payload = {
        board_id: targetBoard.trim(),
        title: title ? title.slice(0, 100) : 'Watch on MovieStream',
        description: description ? description.slice(0, 500) : '',
        link: link || this.siteUrl,
        media_source: {
          source_type: 'image_url',
          url: imageUrl
        }
      };

      const response = await axios.post('https://api.pinterest.com/v5/pins', payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      const pinData = response.data;
      const pinUrl = `https://www.pinterest.com/pin/${pinData?.id}`;

      logger.info(`Successfully created Pinterest Pin: ${title} (${pinUrl})`);
      return {
        success: true,
        pinId: pinData?.id,
        pinUrl
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      logger.error('Failed to create Pinterest pin:', errorMsg);
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Auto-pin a new movie
   */
  async notifyNewMovie(movie, siteUrl = null) {
    if (!movie) return { success: false, error: 'No movie data' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewMovies) {
      logger.debug(`Pinterest auto-pinning disabled or unconfigured - skipping: ${movie.title}`);
      return { success: false, error: 'Pinterest auto-pinning disabled' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const movieUrl = `${cleanUrl}/movie/${movie._id || movie.tmdbId}`;

      const releaseYear = movie.releaseDate
        ? new Date(movie.releaseDate).getFullYear()
        : (movie.year || 'N/A');

      const rating = movie.voteAverage && movie.voteAverage > 0
        ? `⭐ ${movie.voteAverage.toFixed(1)}/10`
        : '';

      let genres = '';
      if (movie.genres && Array.isArray(movie.genres)) {
        genres = movie.genres
          .slice(0, 3)
          .map(g => (typeof g === 'string' ? g : (g.name || '')))
          .filter(Boolean)
          .join(', ');
      }

      const posterUrl = movie.posterPath
        ? (movie.posterPath.startsWith('http') ? movie.posterPath : `https://image.tmdb.org/t/p/w500${movie.posterPath}`)
        : null;

      if (!posterUrl) {
        return { success: false, error: 'Movie has no poster image to pin on Pinterest' };
      }

      const pinTitle = `${movie.title} (${releaseYear})`;
      let description = `Watch ${movie.title} (${releaseYear}) in HD on MovieStream.`;
      if (rating) description += ` ${rating}`;
      if (genres) description += ` | ${genres}`;
      if (movie.overview) {
        description += `\n\n${movie.overview.slice(0, 300)}...`;
      }
      description += `\n\nClick to stream free!`;

      return await this.createPin({
        title: pinTitle,
        description,
        link: movieUrl,
        imageUrl: posterUrl
      });
    } catch (error) {
      logger.error(`Exception in Pinterest notifyNewMovie for ${movie.title}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-pin a new TV show
   */
  async notifyNewTvShow(tvShow, siteUrl = null) {
    if (!tvShow) return { success: false, error: 'No TV show data' };

    await this.loadSettings();

    if (!this.enabled || !this.notifyNewTvShows) {
      logger.debug(`Pinterest auto-pinning disabled or unconfigured - skipping: ${tvShow.name}`);
      return { success: false, error: 'Pinterest auto-pinning disabled' };
    }

    try {
      const baseUrl = siteUrl || this.siteUrl || 'https://moviestream.cc';
      const cleanUrl = baseUrl.replace(/\/$/, '');
      const tvUrl = `${cleanUrl}/tv/${tvShow._id || tvShow.tmdbId}`;

      const releaseYear = tvShow.firstAirDate
        ? new Date(tvShow.firstAirDate).getFullYear()
        : 'N/A';

      const rating = tvShow.voteAverage && tvShow.voteAverage > 0
        ? `⭐ ${tvShow.voteAverage.toFixed(1)}/10`
        : '';

      const posterUrl = tvShow.posterPath
        ? (tvShow.posterPath.startsWith('http') ? tvShow.posterPath : `https://image.tmdb.org/t/p/w500${tvShow.posterPath}`)
        : null;

      if (!posterUrl) {
        return { success: false, error: 'TV show has no poster image to pin on Pinterest' };
      }

      const pinTitle = `${tvShow.name} (${releaseYear}) - TV Series`;
      let description = `Watch ${tvShow.name} all episodes in HD on MovieStream.`;
      if (rating) description += ` ${rating}`;
      if (tvShow.overview) {
        description += `\n\n${tvShow.overview.slice(0, 300)}...`;
      }
      description += `\n\nClick to stream free!`;

      return await this.createPin({
        title: pinTitle,
        description,
        link: tvUrl,
        imageUrl: posterUrl
      });
    } catch (error) {
      logger.error(`Exception in Pinterest notifyNewTvShow for ${tvShow.name}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PinterestService();
