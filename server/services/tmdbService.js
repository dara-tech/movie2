const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || 'your-tmdb-api-key';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class TMDBService {
  constructor() {
    this.apiKey = TMDB_API_KEY;
    this.baseURL = TMDB_BASE_URL;
  }

  async getPopularMovies(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/popular`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTrendingMovies(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/trending/movie/week`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTopRatedMovies(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/top_rated`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getUpcomingMovies(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/upcoming`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getNowPlayingMovies(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/now_playing`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getMovieDetails(movieId) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/${movieId}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
          append_to_response: 'credits,videos,images,external_ids'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchMovies(query, page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/search/movie`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getGenres() {
    try {
      const response = await axios.get(`${this.baseURL}/genre/movie/list`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getMoviesByGenre(genreId, page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/discover/movie`, {
        params: {
          api_key: this.apiKey,
          with_genres: genreId,
          page,
          language: 'en-US',
          sort_by: 'popularity.desc'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // TV Show methods
  async getPopularTvShows(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/popular`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTvShowDetails(tvShowId) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/${tvShowId}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
          append_to_response: 'credits,videos,images,external_ids'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTvShowEpisodes(tvShowId, seasonNumber) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/${tvShowId}/season/${seasonNumber}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchTvShows(query, page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/search/tv`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async searchMulti(query, page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/search/multi`, {
        params: {
          api_key: this.apiKey,
          query,
          page,
          language: 'en-US',
          include_adult: false
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getMovieTrailer(movieId) {
    try {
      const response = await axios.get(`${this.baseURL}/movie/${movieId}/videos`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        },
        timeout: 8000
      });
      const videos = response.data?.results || [];
      const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
                      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                      videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');
      return trailer ? trailer.key : null;
    } catch (error) {
      return null;
    }
  }

  async getTvTrailer(tvId) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/${tvId}/videos`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        },
        timeout: 8000
      });
      const videos = response.data?.results || [];
      const trailer = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
                      videos.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                      videos.find(v => v.site === 'YouTube' && v.type === 'Teaser');
      return trailer ? trailer.key : null;
    } catch (error) {
      return null;
    }
  }

  async getTrendingTvShows(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/trending/tv/week`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTopRatedTvShows(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/top_rated`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getOnTheAirTvShows(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/on_the_air`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getAiringTodayTvShows(page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/tv/airing_today`, {
        params: {
          api_key: this.apiKey,
          page,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTvShowGenres() {
    try {
      const response = await axios.get(`${this.baseURL}/genre/tv/list`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getTvShowsByGenre(genreId, page = 1) {
    try {
      const response = await axios.get(`${this.baseURL}/discover/tv`, {
        params: {
          api_key: this.apiKey,
          with_genres: genreId,
          page,
          language: 'en-US',
          sort_by: 'popularity.desc'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Get watch providers for movies or TV shows
  async getWatchProviders(type = 'movie', region = 'US') {
    try {
      const endpoint = type === 'movie' ? '/watch/providers/movie' : '/watch/providers/tv';
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US',
          watch_region: region
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async discoverMovies({ page = 1, originCountry, sortBy = 'popularity', order = 'desc', language = 'en-US', releaseDateGte, releaseDateLte }) {
    try {
      const sortFieldMap = {
        popularity: 'popularity',
        voteAverage: 'vote_average',
        releaseDate: 'primary_release_date'
      };
      const sortField = sortFieldMap[sortBy] || 'popularity';
      const sortDirection = order === 'asc' ? 'asc' : 'desc';

      const params = {
        api_key: this.apiKey,
        page,
        language,
        sort_by: `${sortField}.${sortDirection}`,
        include_adult: false
      };

      if (originCountry) {
        params.with_origin_country = originCountry;
      }

      // Add date range filters if provided (format: YYYY-MM-DD)
      if (releaseDateGte) {
        params['primary_release_date.gte'] = releaseDateGte;
      }
      if (releaseDateLte) {
        params['primary_release_date.lte'] = releaseDateLte;
      }

      const response = await axios.get(`${this.baseURL}/discover/movie`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async discoverTvShows({ page = 1, originCountry, sortBy = 'popularity', order = 'desc', language = 'en-US' }) {
    try {
      const sortFieldMap = {
        popularity: 'popularity',
        voteAverage: 'vote_average',
        firstAirDate: 'first_air_date'
      };
      const sortField = sortFieldMap[sortBy] || 'popularity';
      const sortDirection = order === 'asc' ? 'asc' : 'desc';

      const response = await axios.get(`${this.baseURL}/discover/tv`, {
        params: {
          api_key: this.apiKey,
          page,
          language,
          sort_by: `${sortField}.${sortDirection}`,
          with_origin_country: originCountry,
          include_adult: false
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getWatchProviderRegions() {
    try {
      const response = await axios.get(`${this.baseURL}/watch/providers/regions`, {
        params: {
          api_key: this.apiKey,
          language: 'en-US'
        }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Helper method to sync TV shows from TMDB to our database
  async syncTvShowsToDatabase(options = {}) {
    try {
      const TvShow = require('../models/TvShow');
      const Genre = require('../models/Genre');
      const vidsrcService = require('./vidsrcService');
      
      const {
        maxPages = 5,
        categories = ['popular', 'trending', 'top_rated', 'on_the_air', 'airing_today'],
        includeGenres = true
      } = options;
      
      // Starting TV show sync
      
      // First, sync TV show genres if requested
      if (includeGenres) {
        const tvGenresResponse = await this.getTvShowGenres();
        for (const genre of tvGenresResponse.genres) {
          await Genre.findOneAndUpdate(
            { tmdbId: genre.id },
            { name: genre.name, type: 'tv' },
            { upsert: true, new: true }
          );
        }
      }
      
      let totalSynced = 0;
      let totalErrors = 0;
      const syncedIds = new Set();
      
      // Sync from different categories
      for (const category of categories) {
        
        for (let page = 1; page <= maxPages; page++) {
          try {
            let tvShowsResponse;
            
            switch (category) {
              case 'popular':
                tvShowsResponse = await this.getPopularTvShows(page);
                break;
              case 'trending':
                tvShowsResponse = await this.getTrendingTvShows(page);
                break;
              case 'top_rated':
                tvShowsResponse = await this.getTopRatedTvShows(page);
                break;
              case 'on_the_air':
                tvShowsResponse = await this.getOnTheAirTvShows(page);
                break;
              case 'airing_today':
                tvShowsResponse = await this.getAiringTodayTvShows(page);
                break;
              default:
                continue;
            }
            
            if (!tvShowsResponse || !tvShowsResponse.results) {
              break;
            }
            
            for (const tvShowData of tvShowsResponse.results) {
              // Skip if already synced
              if (syncedIds.has(tvShowData.id)) {
                continue;
              }
              
              try {
                // Get detailed TV show information
                const tvShowDetails = await this.getTvShowDetails(tvShowData.id);
                
                if (tvShowDetails) {
                  // Prepare TV show data for database
                  const tvShowDoc = {
                    tmdbId: tvShowDetails.id,
                    imdbId: tvShowDetails.external_ids?.imdb_id || null,
                    name: tvShowDetails.name,
                    originalName: tvShowDetails.original_name,
                    overview: tvShowDetails.overview,
                    firstAirDate: tvShowDetails.first_air_date ? new Date(tvShowDetails.first_air_date) : null,
                    lastAirDate: tvShowDetails.last_air_date ? new Date(tvShowDetails.last_air_date) : null,
                    status: tvShowDetails.status,
                    type: tvShowDetails.type,
                    numberOfSeasons: tvShowDetails.number_of_seasons,
                    numberOfEpisodes: tvShowDetails.number_of_episodes,
                    episodeRunTime: tvShowDetails.episode_run_time,
                    averageRuntime: tvShowDetails.episode_run_time && tvShowDetails.episode_run_time.length > 0 ? 
                      Math.round(tvShowDetails.episode_run_time.reduce((a, b) => a + b, 0) / tvShowDetails.episode_run_time.length) : null,
                    posterPath: tvShowDetails.poster_path,
                    backdropPath: tvShowDetails.backdrop_path,
                    voteAverage: tvShowDetails.vote_average,
                    voteCount: tvShowDetails.vote_count,
                    popularity: tvShowDetails.popularity,
                    originalLanguage: tvShowDetails.original_language,
                    originCountry: tvShowDetails.origin_country,
                    networks: tvShowDetails.networks || [],
                    productionCompanies: tvShowDetails.production_companies || [],
                    createdBy: tvShowDetails.created_by || [],
                    seasons: (tvShowDetails.seasons || []).map(season => ({
                      airDate: season.air_date ? new Date(season.air_date) : null,
                      episodeCount: season.episode_count || 0,
                      id: season.id,
                      name: season.name,
                      overview: season.overview,
                      posterPath: season.poster_path,
                      seasonNumber: season.season_number,
                      voteAverage: season.vote_average || 0
                    })),
                    externalIds: tvShowDetails.external_ids || {},
                    isAvailable: true,
                    lastUpdated: new Date()
                  };
                  
                  // Find genre IDs for this TV show
                  const genreIds = [];
                  for (const genre of tvShowData.genre_ids || []) {
                    const genreDoc = await Genre.findOne({ tmdbId: genre });
                    if (genreDoc) {
                      genreIds.push(genreDoc._id);
                    }
                  }
                  
                  // Save or update TV show in database
                  await TvShow.findOneAndUpdate(
                    { tmdbId: tvShowDetails.id },
                    { ...tvShowDoc, genres: genreIds },
                    { upsert: true, new: true }
                  );
                  
                  syncedIds.add(tvShowData.id);
                  totalSynced++;
                  
                  if (totalSynced % 10 === 0) {
                  }
                }
              } catch (error) {
                totalErrors++;
              }
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (error) {
            totalErrors++;
          }
        }
      }
      
      return { synced: totalSynced, errors: totalErrors };
      
    } catch (error) {
      throw error;
    }
  }

  // Helper method to sync movies from TMDB to our database
  async syncMoviesToDatabase(options = {}) {
    try {
      const Movie = require('../models/Movie');
      const Genre = require('../models/Genre');
      const vidsrcService = require('./vidsrcService');
      
      const {
        maxPages = 500,
        startFromLastId = true,
        minTmdbId = null
      } = options;
      
      
      // Get the last TMDB ID from the database
      let startTmdbId = 0;
      if (startFromLastId) {
        const lastMovie = await Movie.findOne().sort({ tmdbId: -1 });
        if (lastMovie && lastMovie.tmdbId) {
          startTmdbId = lastMovie.tmdbId;
        }
      } else if (minTmdbId) {
        startTmdbId = minTmdbId;
      }
      
      // First, sync genres
      const genresResponse = await this.getGenres();
      for (const genre of genresResponse.genres) {
        await Genre.findOneAndUpdate(
          { tmdbId: genre.id },
          { name: genre.name },
          { upsert: true, new: true }
        );
      }
      
      let totalSynced = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const maxTmdbId = 1000000; // Reasonable upper limit for TMDB IDs
      
      // Sync movies from multiple categories
      const categories = [
        { name: 'popular', fetchFn: (page) => this.getPopularMovies(page) },
        { name: 'trending', fetchFn: (page) => this.getTrendingMovies(page) },
        { name: 'top_rated', fetchFn: (page) => this.getTopRatedMovies(page) },
        { name: 'upcoming', fetchFn: (page) => this.getUpcomingMovies(page) }
      ];
      
      for (const category of categories) {
        
        for (let page = 1; page <= maxPages; page++) {
          try {
            const moviesResponse = await category.fetchFn(page);
            
            if (!moviesResponse || !moviesResponse.results || moviesResponse.results.length === 0) {
              break;
            }
            
            let pageSynced = 0;
            
            for (const movieData of moviesResponse.results) {
              try {
                // Skip movies that exceed reasonable TMDB ID limits
                if (movieData.id > maxTmdbId) {
                  continue;
                }
                
                // Check if movie already exists (this is the primary check)
                const existingMovie = await Movie.findOne({ tmdbId: movieData.id });
                if (existingMovie) {
                  totalSkipped++;
                  continue;
                }
                
                // Get detailed movie info
                const movieDetails = await this.getMovieDetails(movieData.id);
                
                // Find genre IDs for this movie
                const genreIds = [];
                for (const genreId of movieData.genre_ids || []) {
                  const genreDoc = await Genre.findOne({ tmdbId: genreId });
                  if (genreDoc) {
                    genreIds.push(genreDoc._id);
                  }
                }
                
                const movie = {
                  tmdbId: movieData.id,
                  imdbId: movieDetails.external_ids?.imdb_id || null,
                  title: movieData.title,
                  overview: movieData.overview || 'No overview available',
                  releaseDate: movieData.release_date ? new Date(movieData.release_date) : new Date(),
                  posterPath: movieData.poster_path,
                  backdropPath: movieData.backdrop_path,
                  runtime: movieDetails.runtime,
                  voteAverage: movieData.vote_average || 0,
                  voteCount: movieData.vote_count || 0,
                  adult: movieData.adult || false,
                  originalLanguage: movieData.original_language || 'en',
                  originalTitle: movieData.original_title || movieData.title,
                  popularity: movieData.popularity || 0,
                  video: movieData.video || false,
                  genres: genreIds,
                  isAvailable: true,
                  lastUpdated: new Date()
                };

                await Movie.findOneAndUpdate(
                  { tmdbId: movieData.id },
                  movie,
                  { upsert: true, new: true }
                );
                
                totalSynced++;
                pageSynced++;
                
                // Progress tracking
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (error) {
                totalErrors++;
              }
            }
            
            
            // Add delay between pages
            await new Promise(resolve => setTimeout(resolve, 300));
            
          } catch (error) {
            totalErrors++;
          }
        }
      }
      
      // Skipped already existing movies
      
      return { 
        synced: totalSynced, 
        skipped: totalSkipped, 
        errors: totalErrors,
        startTmdbId: startTmdbId
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * TMDB discover total_results (page 1) — catalog size for movies or TV, not local DB.
   */
  async getDiscoverTotalResults(mediaType = 'movie') {
    const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv';
    const response = await axios.get(`${this.baseURL}${endpoint}`, {
      params: {
        api_key: this.apiKey,
        page: 1,
        language: 'en-US',
        sort_by: 'popularity.desc'
      }
    });
    return typeof response.data.total_results === 'number' ? response.data.total_results : 0;
  }

  /**
   * Count of movies with primary_release_date in [dateGte, dateLte] (YYYY-MM-DD).
   */
  async getDiscoverMovieCountByReleaseRange(dateGte, dateLte) {
    const response = await axios.get(`${this.baseURL}/discover/movie`, {
      params: {
        api_key: this.apiKey,
        page: 1,
        language: 'en-US',
        'primary_release_date.gte': dateGte,
        'primary_release_date.lte': dateLte,
        sort_by: 'primary_release_date.desc'
      }
    });
    return typeof response.data.total_results === 'number' ? response.data.total_results : 0;
  }
}

module.exports = new TMDBService();
