const VIDSRC_BASE_URL = 'https://vidsrc-embed.ru';
const VIDPLUS_BASE_URL = 'https://player.vidplus.to';

class VidsrcService {
  constructor() {
    // Default to VidPlus
    this.baseURL = VIDPLUS_BASE_URL;
    this.vidsrcURL = VIDSRC_BASE_URL;
    this.defaultProvider = 'vidplus'; // 'vidplus' or 'vidsrc'
  }

  /**
   * Generate VidPlus embed URL for a movie
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred for VidPlus)
   * @param {Object} options - Additional options
   * @param {string} options.primaryColor - Player primary color (hex)
   * @param {string} options.subtitleColor - Subtitle color (hex)
   * @param {number} options.autoplay - Enable/disable autoplay (1 or 0)
   * @returns {string} VidPlus embed URL
   * 
   * Note: VidPlus does not provide a parameter to disable ads.
   * Ads are controlled by VidPlus and cannot be disabled via API.
   * Users can use browser ad blockers to remove ads.
   */
  getVidPlusMovieEmbedUrl(imdbId = null, tmdbId = null, options = {}) {
    if (!tmdbId && !imdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    // VidPlus prefers TMDB ID, uses it in URL path
    const id = tmdbId || imdbId;
    if (!id) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    const params = new URLSearchParams();
    
    // Optional parameters
    if (options.primaryColor) {
      params.append('primaryColor', options.primaryColor);
    }
    if (options.subtitleColor) {
      params.append('subtitleColor', options.subtitleColor);
    }
    if (options.autoplay !== undefined) {
      params.append('autoplay', options.autoplay);
    }

    const queryString = params.toString();
    return `${VIDPLUS_BASE_URL}/embed/movie/${id}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Generate Vidsrc embed URL for a movie (fallback)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (alternative to IMDB)
   * @param {Object} options - Additional options
   * @param {string} options.subUrl - Subtitle URL (URL encoded)
   * @param {string} options.dsLang - Default subtitle language (ISO639 code)
   * @param {number} options.autoplay - Enable/disable autoplay (1 or 0)
   * @returns {string} Vidsrc embed URL
   */
  getVidsrcMovieEmbedUrl(imdbId = null, tmdbId = null, options = {}) {
    if (!imdbId && !tmdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    const params = new URLSearchParams();
    
    if (imdbId) {
      // Ensure IMDB ID has 'tt' prefix
      const cleanImdbId = imdbId.toString().startsWith('tt') ? imdbId : `tt${imdbId}`;
      params.append('imdb', cleanImdbId);
    }
    
    if (tmdbId) {
      params.append('tmdb', tmdbId);
    }

    // Add optional parameters
    if (options.subUrl) {
      params.append('sub_url', options.subUrl);
    }
    if (options.dsLang) {
      params.append('ds_lang', options.dsLang);
    }
    if (options.autoplay !== undefined) {
      params.append('autoplay', options.autoplay);
    }

    return `${this.vidsrcURL}/embed/movie?${params.toString()}`;
  }

  /**
   * Generate movie embed URL (defaults to VidPlus)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred)
   * @param {Object} options - Additional options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @returns {string} Embed URL
   */
  getMovieEmbedUrl(imdbId = null, tmdbId = null, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    if (provider === 'vidplus') {
      return this.getVidPlusMovieEmbedUrl(imdbId, tmdbId, options);
    } else {
      return this.getVidsrcMovieEmbedUrl(imdbId, tmdbId, options);
    }
  }

  /**
   * Generate VidPlus embed URL for a TV show episode
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred for VidPlus)
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Additional options
   * @param {string} options.primaryColor - Player primary color (hex)
   * @param {string} options.subtitleColor - Subtitle color (hex)
   * @param {number} options.autoplay - Enable/disable autoplay (1 or 0)
   * @returns {string} VidPlus embed URL
   */
  getVidPlusTvShowEmbedUrl(imdbId = null, tmdbId = null, season = null, episode = null, options = {}) {
    if (!tmdbId && !imdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    const id = tmdbId || imdbId;
    if (!id) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    // VidPlus requires season and episode for TV shows
    if (season !== null && episode !== null) {
      const params = new URLSearchParams();
      
      if (options.primaryColor) {
        params.append('primaryColor', options.primaryColor);
      }
      if (options.subtitleColor) {
        params.append('subtitleColor', options.subtitleColor);
      }
      if (options.autoplay !== undefined) {
        params.append('autoplay', options.autoplay);
      }

      const queryString = params.toString();
      return `${VIDPLUS_BASE_URL}/embed/tv/${id}/${season}/${episode}${queryString ? '?' + queryString : ''}`;
    }

    // Fallback to first episode if season/episode not provided
    return `${VIDPLUS_BASE_URL}/embed/tv/${id}/1/1`;
  }

  /**
   * Generate Vidsrc embed URL for a TV show (fallback)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (alternative to IMDB)
   * @param {Object} options - Additional options
   * @param {string} options.dsLang - Default subtitle language (ISO639 code)
   * @returns {string} Vidsrc embed URL
   */
  getVidsrcTvShowEmbedUrl(imdbId = null, tmdbId = null, options = {}) {
    if (!imdbId && !tmdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    const params = new URLSearchParams();
    
    if (imdbId) {
      const cleanImdbId = imdbId.toString().startsWith('tt') ? imdbId : `tt${imdbId}`;
      params.append('imdb', cleanImdbId);
    }
    
    if (tmdbId) {
      params.append('tmdb', tmdbId);
    }

    if (options.dsLang) {
      params.append('ds_lang', options.dsLang);
    }

    return `${this.vidsrcURL}/embed/tv?${params.toString()}`;
  }

  /**
   * Generate TV show embed URL (defaults to VidPlus)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred)
   * @param {Object} options - Additional options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @returns {string} Embed URL
   */
  getTvShowEmbedUrl(imdbId = null, tmdbId = null, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    if (provider === 'vidplus') {
      return this.getVidPlusTvShowEmbedUrl(imdbId, tmdbId, null, null, options);
    } else {
      return this.getVidsrcTvShowEmbedUrl(imdbId, tmdbId, options);
    }
  }

  /**
   * Generate VidPlus embed URL for a specific TV episode
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred for VidPlus)
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Additional options
   * @param {string} options.primaryColor - Player primary color (hex)
   * @param {string} options.subtitleColor - Subtitle color (hex)
   * @param {number} options.autoplay - Enable/disable autoplay (1 or 0)
   * @returns {string} VidPlus embed URL
   */
  getVidPlusEpisodeEmbedUrl(imdbId = null, tmdbId = null, season, episode, options = {}) {
    if (!tmdbId && !imdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }
    if (season === undefined || episode === undefined || season === null || episode === null) {
      throw new Error('Season and episode numbers are required');
    }

    const id = tmdbId || imdbId;
    if (!id) {
      throw new Error('Either imdbId or tmdbId is required');
    }

    const params = new URLSearchParams();
    
    if (options.primaryColor) {
      params.append('primaryColor', options.primaryColor);
    }
    if (options.subtitleColor) {
      params.append('subtitleColor', options.subtitleColor);
    }
    if (options.autoplay !== undefined) {
      params.append('autoplay', options.autoplay);
    }

    const queryString = params.toString();
    
    return `${VIDPLUS_BASE_URL}/embed/tv/${id}/${season}/${episode}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Generate Vidsrc embed URL for a specific TV episode (fallback)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (alternative to IMDB)
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Additional options
   * @param {string} options.subUrl - Subtitle URL (URL encoded)
   * @param {string} options.dsLang - Default subtitle language (ISO639 code)
   * @param {number} options.autoplay - Enable/disable autoplay (1 or 0)
   * @param {number} options.autonext - Enable/disable autonext episode (1 or 0)
   * @returns {string} Vidsrc embed URL
   */
  getVidsrcEpisodeEmbedUrl(imdbId = null, tmdbId = null, season, episode, options = {}) {
    if (!imdbId && !tmdbId) {
      throw new Error('Either imdbId or tmdbId is required');
    }
    if (season === undefined || episode === undefined || season === null || episode === null) {
      throw new Error('Season and episode numbers are required');
    }

    const params = new URLSearchParams();
    
    if (imdbId) {
      const cleanImdbId = imdbId.toString().startsWith('tt') ? imdbId : `tt${imdbId}`;
      params.append('imdb', cleanImdbId);
    }
    
    if (tmdbId) {
      params.append('tmdb', tmdbId);
    }

    params.append('season', season);
    params.append('episode', episode);
    

    // Add optional parameters
    if (options.subUrl) {
      params.append('sub_url', options.subUrl);
    }
    if (options.dsLang) {
      params.append('ds_lang', options.dsLang);
    }
    if (options.autoplay !== undefined) {
      params.append('autoplay', options.autoplay);
    }
    if (options.autonext !== undefined) {
      params.append('autonext', options.autonext);
    }

    return `${this.vidsrcURL}/embed/tv?${params.toString()}`;
  }

  /**
   * Generate episode embed URL (defaults to VidPlus)
   * @param {string|number} imdbId - IMDB ID (with or without 'tt' prefix)
   * @param {string|number} tmdbId - TMDB ID (preferred)
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Additional options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @returns {string} Embed URL
   */
  getEpisodeEmbedUrl(imdbId = null, tmdbId = null, season, episode, options = {}) {
    const provider = options.provider || this.defaultProvider;
    
    if (provider === 'vidplus') {
      return this.getVidPlusEpisodeEmbedUrl(imdbId, tmdbId, season, episode, options);
    } else {
      return this.getVidsrcEpisodeEmbedUrl(imdbId, tmdbId, season, episode, options);
    }
  }


  /**
   * Generate streaming URL for a movie with fallback options (defaults to VidPlus)
   * @param {Object} movie - Movie object with tmdbId and/or imdbId
   * @param {Object} options - Streaming options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @param {number} options.autoplay - Enable/disable autoplay (default: 1)
   * @returns {string} Generated streaming URL
   */
  generateMovieStreamingUrl(movie, options = {}) {
    const { tmdbId, imdbId } = movie;
    
    // Default options - VidPlus prefers autoplay, primaryColor
    const defaultOptions = {
      autoplay: 1,
      primaryColor: '#dc2626', // Red color matching your theme
      ...options
    };

    try {
      // Try VidPlus first (default)
      if (!options.provider || options.provider === 'vidplus') {
        return this.getMovieEmbedUrl(imdbId, tmdbId, defaultOptions);
      }
      // Fallback to Vidsrc
      return this.getMovieEmbedUrl(imdbId, tmdbId, { ...defaultOptions, provider: 'vidsrc' });
    } catch (error) {
      // Try fallback provider if primary fails
      try {
        return this.getMovieEmbedUrl(imdbId, tmdbId, { ...defaultOptions, provider: 'vidsrc' });
      } catch (fallbackError) {
        return null;
      }
    }
  }

  /**
   * Generate streaming URL for a TV show with fallback options (defaults to VidPlus)
   * @param {Object} tvShow - TV show object with tmdbId and/or imdbId
   * @param {Object} options - Streaming options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @param {number} season - Season number (optional, defaults to 1)
   * @param {number} episode - Episode number (optional, defaults to 1)
   * @returns {string} Generated streaming URL
   */
  generateTvShowStreamingUrl(tvShow, options = {}) {
    const { tmdbId, imdbId } = tvShow;
    const { season = 1, episode = 1, ...restOptions } = options;
    
    const defaultOptions = {
      primaryColor: '#dc2626', // Red color matching your theme
      autoplay: 1,
      ...restOptions
    };

    try {
      // Try VidPlus first (default)
      if (!options.provider || options.provider === 'vidplus') {
        return this.getEpisodeEmbedUrl(imdbId, tmdbId, season, episode, defaultOptions);
      }
      // Fallback to Vidsrc
      return this.getTvShowEmbedUrl(imdbId, tmdbId, { ...defaultOptions, provider: 'vidsrc' });
    } catch (error) {
      // Try fallback provider if primary fails
      try {
        return this.getTvShowEmbedUrl(imdbId, tmdbId, { ...defaultOptions, provider: 'vidsrc' });
      } catch (fallbackError) {
        return null;
      }
    }
  }

  /**
   * Generate streaming URL for a specific TV episode (defaults to VidPlus)
   * @param {Object} tvShow - TV show object with tmdbId and/or imdbId
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @param {Object} options - Streaming options
   * @param {string} options.provider - 'vidplus' or 'vidsrc' (default: 'vidplus')
   * @param {number} options.autoplay - Enable/disable autoplay (default: 1)
   * @returns {string} Generated streaming URL
   */
  generateEpisodeStreamingUrl(tvShow, season, episode, options = {}) {
    const { tmdbId, imdbId } = tvShow;
    
    const defaultOptions = {
      autoplay: 1,
      primaryColor: '#dc2626', // Red color matching your theme
      ...options
    };

    try {
      // Try VidPlus first (default)
      if (!options.provider || options.provider === 'vidplus') {
        return this.getEpisodeEmbedUrl(imdbId, tmdbId, season, episode, defaultOptions);
      }
      // Fallback to Vidsrc
      return this.getEpisodeEmbedUrl(imdbId, tmdbId, season, episode, { ...defaultOptions, provider: 'vidsrc' });
    } catch (error) {
      // Try fallback provider if primary fails
      try {
        return this.getEpisodeEmbedUrl(imdbId, tmdbId, season, episode, { ...defaultOptions, provider: 'vidsrc' });
      } catch (fallbackError) {
        return null;
      }
    }
  }
}

module.exports = new VidsrcService();
