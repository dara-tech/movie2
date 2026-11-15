const tmdbService = require('./tmdbService');
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');

/**
 * Hybrid Service - Fetches from TMDB on-demand, only stores user-specific data
 */
class HybridService {
  constructor() {
    // In-memory cache for frequently accessed items
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    this.maxCacheSize = 120;
  }

  /**
   * Get cache key
   */
  getCacheKey(type, params) {
    return `${type}:${JSON.stringify(params)}`;
  }

  /**
   * Get from cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  /**
   * Set cache
   */
  setCache(key, data) {
    const now = Date.now();
    for (const [k, v] of this.cache) {
      if (now - v.timestamp >= this.cacheTTL) {
        this.cache.delete(k);
      }
    }
    this.cache.set(key, {
      data,
      timestamp: now
    });
    while (this.cache.size > this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  /**
   * Map TMDB movie to our format
   */
  mapMovieFromTMDB(tmdbMovie, genreMap = {}) {
    return {
      _id: `tmdb_${tmdbMovie.id}`,
      tmdbId: tmdbMovie.id,
      title: tmdbMovie.title,
      originalTitle: tmdbMovie.original_title || tmdbMovie.title,
      overview: tmdbMovie.overview || '',
      releaseDate: tmdbMovie.release_date || null,
      posterPath: tmdbMovie.poster_path,
      backdropPath: tmdbMovie.backdrop_path,
      voteAverage: tmdbMovie.vote_average || 0,
      voteCount: tmdbMovie.vote_count || 0,
      popularity: tmdbMovie.popularity || 0,
      genres: (tmdbMovie.genre_ids || []).map(id => ({
        _id: `genre_${id}`,
        name: genreMap[id] || 'Unknown',
        tmdbId: id
      })),
      adult: tmdbMovie.adult || false,
      originalLanguage: tmdbMovie.original_language || 'en',
      runtime: null, // Will be fetched from detail if needed
      isAvailable: true,
      streamingUrl: null,
      vidsrcUrl: null
    };
  }

  /**
   * Map TMDB TV show to our format
   */
  mapTvShowFromTMDB(tmdbTvShow, genreMap = {}) {
    return {
      _id: `tmdb_${tmdbTvShow.id}`,
      tmdbId: tmdbTvShow.id,
      name: tmdbTvShow.name,
      originalName: tmdbTvShow.original_name || tmdbTvShow.name,
      overview: tmdbTvShow.overview || '',
      firstAirDate: tmdbTvShow.first_air_date || null,
      lastAirDate: tmdbTvShow.last_air_date || null,
      posterPath: tmdbTvShow.poster_path,
      backdropPath: tmdbTvShow.backdrop_path,
      voteAverage: tmdbTvShow.vote_average || 0,
      voteCount: tmdbTvShow.vote_count || 0,
      popularity: tmdbTvShow.popularity || 0,
      genres: (tmdbTvShow.genre_ids || []).map(id => ({
        _id: `genre_${id}`,
        name: genreMap[id] || 'Unknown',
        tmdbId: id
      })),
      status: tmdbTvShow.status || 'Returning Series',
      type: tmdbTvShow.type || 'Scripted',
      numberOfSeasons: tmdbTvShow.number_of_seasons || 0,
      numberOfEpisodes: tmdbTvShow.number_of_episodes || 0,
      averageRuntime: tmdbTvShow.episode_run_time?.[0] || null,
      isAvailable: true,
      streamingUrl: null,
      vidsrcUrl: null,
      seasons: null // Will be fetched from detail if needed
    };
  }

  /**
   * Get genre map from database
   */
  async getGenreMap() {
    try {
      const genres = await Genre.find({});
      const genreMap = {};
      genres.forEach(genre => {
        if (genre.tmdbId) {
          genreMap[genre.tmdbId] = genre.name;
        }
      });
      return genreMap;
    } catch (error) {
      return {};
    }
  }

  /**
   * Fetch popular movies from TMDB
   */
  async getPopularMovies(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('popular_movies', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getPopularMovies(page);
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch trending movies from TMDB
   */
  async getTrendingMovies(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('trending_movies', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getTrendingMovies(page);
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch top rated movies from TMDB
   */
  async getTopRatedMovies(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('top_rated_movies', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getTopRatedMovies(page);
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch movies by release date range from TMDB
   * @param {string} releaseDateGte - Release date greater than or equal (YYYY-MM-DD)
   * @param {string} releaseDateLte - Release date less than or equal (YYYY-MM-DD)
   * @param {number} page - Page number
   * @param {number} limit - Results per page
   * @param {string} sortBy - Sort field (popularity, voteAverage, releaseDate)
   * @param {string} order - Sort order (asc, desc)
   */
  async getMoviesByDateRange({ releaseDateGte, releaseDateLte, page = 1, limit = 20, sortBy = 'popularity', order = 'desc' }) {
    const cacheKey = this.getCacheKey('movies_by_date_range', { releaseDateGte, releaseDateLte, page, limit, sortBy, order });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.discoverMovies({
        page,
        sortBy,
        order,
        releaseDateGte,
        releaseDateLte
      });
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch popular TV shows from TMDB
   */
  async getPopularTvShows(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('popular_tvshows', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getPopularTvShows(page);
      
      const tvShows = tmdbResponse.results.map(tvShow => 
        this.mapTvShowFromTMDB(tvShow, genreMap)
      );

      const result = {
        tvShows,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch trending TV shows from TMDB
   */
  async getTrendingTvShows(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('trending_tvshows', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getTrendingTvShows(page);
      
      const tvShows = tmdbResponse.results.map(tvShow => 
        this.mapTvShowFromTMDB(tvShow, genreMap)
      );

      const result = {
        tvShows,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch top rated TV shows from TMDB
   */
  async getTopRatedTvShows(page = 1, limit = 20) {
    const cacheKey = this.getCacheKey('top_rated_tvshows', { page, limit });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getTopRatedTvShows(page);
      
      const tvShows = tmdbResponse.results.map(tvShow => 
        this.mapTvShowFromTMDB(tvShow, genreMap)
      );

      const result = {
        tvShows,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search movies from TMDB
   */
  async searchMovies(query, page = 1) {
    const cacheKey = this.getCacheKey('search_movies', { query, page });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.searchMovies(query, page);
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search TV shows from TMDB
   */
  async searchTvShows(query, page = 1) {
    const cacheKey = this.getCacheKey('search_tvshows', { query, page });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.searchTvShows(query, page);
      
      const tvShows = tmdbResponse.results.map(tvShow => 
        this.mapTvShowFromTMDB(tvShow, genreMap)
      );

      const result = {
        tvShows,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get movie by ID - try database first, then TMDB
   */
  async getMovieById(id) {
    // Check if it's a TMDB ID or MongoDB ID
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const isTmdbId = id.toString().startsWith('tmdb_');
    
    let movie;
    
    if (isObjectId) {
      // Try database first
      movie = await Movie.findById(id).populate('genres', 'name');
    } else if (isTmdbId) {
      // Extract TMDB ID
      const tmdbId = parseInt(id.replace('tmdb_', ''));
      movie = await Movie.findOne({ tmdbId }).populate('genres', 'name');
    } else {
      // Try as TMDB ID
      const tmdbId = parseInt(id);
      if (!isNaN(tmdbId)) {
        movie = await Movie.findOne({ tmdbId }).populate('genres', 'name');
      }
    }

    // If not in database, fetch from TMDB
    if (!movie) {
      const tmdbId = isTmdbId ? parseInt(id.replace('tmdb_', '')) : 
                     (!isObjectId && !isNaN(parseInt(id))) ? parseInt(id) : null;
      
      if (tmdbId) {
        try {
          const tmdbMovie = await tmdbService.getMovieDetails(tmdbId);
          const genreMap = await this.getGenreMap();
          
          // Map TMDB genres properly
          const genres = (tmdbMovie.genres || []).map(genre => ({
            _id: `genre_${genre.id}`,
            name: genre.name,
            tmdbId: genre.id
          }));
          
          movie = {
            _id: `tmdb_${tmdbMovie.id}`,
            tmdbId: tmdbMovie.id,
            title: tmdbMovie.title,
            originalTitle: tmdbMovie.original_title || tmdbMovie.title,
            overview: tmdbMovie.overview || '',
            releaseDate: tmdbMovie.release_date || null,
            posterPath: tmdbMovie.poster_path,
            backdropPath: tmdbMovie.backdrop_path,
            voteAverage: tmdbMovie.vote_average || 0,
            voteCount: tmdbMovie.vote_count || 0,
            popularity: tmdbMovie.popularity || 0,
            genres: genres,
            adult: tmdbMovie.adult || false,
            originalLanguage: tmdbMovie.original_language || 'en',
            runtime: tmdbMovie.runtime,
            imdbId: tmdbMovie.imdb_id || tmdbMovie.external_ids?.imdb_id,
            budget: tmdbMovie.budget,
            revenue: tmdbMovie.revenue,
            tagline: tmdbMovie.tagline,
            status: tmdbMovie.status,
            isAvailable: true,
            streamingUrl: null,
            vidsrcUrl: null
          };
        } catch (error) {
          throw error;
        }
      }
    }

    return movie;
  }

  /**
   * Get TV show by ID - try database first, then TMDB
   */
  async getTvShowById(id) {
    // Check if it's a TMDB ID or MongoDB ID
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const isTmdbId = id.toString().startsWith('tmdb_');
    
    let tvShow;
    
    if (isObjectId) {
      // Try database first
      tvShow = await TvShow.findById(id).populate('genres', 'name');
    } else if (isTmdbId) {
      // Extract TMDB ID
      const tmdbId = parseInt(id.replace('tmdb_', ''));
      tvShow = await TvShow.findOne({ tmdbId }).populate('genres', 'name');
    } else {
      // Try as TMDB ID
      const tmdbId = parseInt(id);
      if (!isNaN(tmdbId)) {
        tvShow = await TvShow.findOne({ tmdbId }).populate('genres', 'name');
      }
    }

    // If not in database, fetch from TMDB
    if (!tvShow) {
      const tmdbId = isTmdbId ? parseInt(id.replace('tmdb_', '')) : 
                     (!isObjectId && !isNaN(parseInt(id))) ? parseInt(id) : null;
      
      if (tmdbId) {
        try {
          const tmdbTvShow = await tmdbService.getTvShowDetails(tmdbId);
          const genreMap = await this.getGenreMap();
          tvShow = this.mapTvShowFromTMDB(tmdbTvShow, genreMap);
          
          // Add seasons from TMDB
          if (tmdbTvShow.seasons) {
            tvShow.seasons = tmdbTvShow.seasons.map(season => ({
              airDate: season.air_date ? new Date(season.air_date) : null,
              episodeCount: season.episode_count || 0,
              id: season.id,
              name: season.name || `Season ${season.season_number}`,
              overview: season.overview || '',
              posterPath: season.poster_path || null,
              seasonNumber: season.season_number,
              voteAverage: season.vote_average || 0
            }));
          }
          
          // Add additional details
          tvShow.lastAirDate = tmdbTvShow.last_air_date;
          tvShow.imdbId = tmdbTvShow.external_ids?.imdb_id;
        } catch (error) {
          throw error;
        }
      }
    }

    return tvShow;
  }

  /**
   * Get movies by genre from TMDB
   */
  async getMoviesByGenre(genreId, page = 1) {
    const cacheKey = this.getCacheKey('movies_by_genre', { genreId, page });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getMoviesByGenre(genreId, page);
      
      const movies = tmdbResponse.results.map(movie => 
        this.mapMovieFromTMDB(movie, genreMap)
      );

      const result = {
        movies,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get TV shows by genre from TMDB
   */
  async getTvShowsByGenre(genreId, page = 1) {
    const cacheKey = this.getCacheKey('tvshows_by_genre', { genreId, page });
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const genreMap = await this.getGenreMap();
      const tmdbResponse = await tmdbService.getTvShowsByGenre(genreId, page);
      
      const tvShows = tmdbResponse.results.map(tvShow => 
        this.mapTvShowFromTMDB(tvShow, genreMap)
      );

      const result = {
        tvShows,
        total: tmdbResponse.total_results,
        page: tmdbResponse.page,
        totalPages: tmdbResponse.total_pages,
        hasMore: page < tmdbResponse.total_pages
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new HybridService();

