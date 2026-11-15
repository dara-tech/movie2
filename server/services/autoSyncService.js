/**
 * Auto Sync Service
 * Handles automatic synchronization from TMDB with scheduling and monitoring
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const tmdbService = require('./tmdbService');
const vidsrcService = require('./vidsrcService');
const telegramService = require('./telegramService');
const twitterService = require('./twitterService');
const redditService = require('./redditService');
const pinterestService = require('./pinterestService');
const blueskyService = require('./blueskyService');
const tumblrService = require('./tumblrService');
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const logger = require('../utils/logger');

class AutoSyncService {
  constructor() {
    this.isRunning = false;
    this.lastSync = null;
    this.syncStats = {
      totalMovies: 0,
      newMovies: 0,
      updatedMovies: 0,
      totalTvShows: 0,
      newTvShows: 0,
      updatedTvShows: 0,
      errors: 0
    };
    this.scheduledJobs = new Map();
    // Queue for new movies/TV shows to notify after sync
    this.newMoviesQueue = [];
    this.newTvShowsQueue = [];
    this.isTelegramMinutePosting = false;
    this.lastTelegramContentType = 'tv';
    this.isBlueskyMinutePosting = false;
    this.lastBlueskyContentType = 'tv';
    this.isTumblrMinutePosting = false;
    this.lastTumblrContentType = 'tv';
  }

  /**
   * Start auto-sync with different scheduling options
   */
  startAutoSync(options = {}) {
    const {
      schedule = '0 2 * * *', // Default: daily at 2 AM
      pages = 5, // Number of pages to sync
      includeTrending = true,
      includePopular = true,
      includeTopRated = false,
      includeUpcoming = false
    } = options;


    // Clear existing jobs
    this.stopAutoSync();

    // Schedule the sync job
    const job = cron.schedule(schedule, async () => {
      await this.performSync({
        pages,
        includeTrending,
        includePopular,
        includeTopRated,
        includeUpcoming
      });
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.scheduledJobs.set('main', job);
  }

  /**
   * Stop auto-sync service
   */
  stopAutoSync() {
    this.scheduledJobs.forEach((job, name) => {
      job.destroy();
    });
    this.scheduledJobs.clear();
  }

  /**
   * Perform manual sync
   * Syncs from TMDB (The Movie Database) and saves to database
   * Streaming links are available via TMDB/IMDB IDs
   */
  async performSync(options = {}) {
    if (this.isRunning) {
      return { success: false, message: 'Sync already running' };
    }

    this.isRunning = true;
    this.syncStats = {
      totalMovies: 0,
      newMovies: 0,
      updatedMovies: 0,
      totalTvShows: 0,
      newTvShows: 0,
      updatedTvShows: 0,
      errors: 0
    };
    // Clear notification queues
    this.newMoviesQueue = [];
    this.newTvShowsQueue = [];
    // Clear seen items tracking (in-memory, not DB)
    this.seenMovies = new Set();
    this.seenTvShows = new Set();

    const startTime = new Date();
      logger.info('🔄 Starting sync from TMDB (The Movie Database)...');
      logger.info('ℹ️  Movies/TV shows are NOT stored in DB - streamed on-demand from TMDB');

    try {
      // Test TMDB API connection
      const testMovies = await tmdbService.getPopularMovies(1);

      // Sync movies based on options
      const syncPromises = [];

      if (options.includePopular) {
        syncPromises.push(this.syncMoviesByType('popular', options.pages || 5));
        syncPromises.push(this.syncTvShowsByType('popular', options.pages || 5));
      }
      if (options.includeTrending) {
        syncPromises.push(this.syncMoviesByType('trending', options.pages || 3));
        syncPromises.push(this.syncTvShowsByType('trending', options.pages || 3));
      }
      if (options.includeTopRated) {
        syncPromises.push(this.syncMoviesByType('top_rated', options.pages || 3));
        syncPromises.push(this.syncTvShowsByType('top_rated', options.pages || 3));
      }
      if (options.includeUpcoming) {
        syncPromises.push(this.syncMoviesByType('upcoming', options.pages || 2));
        syncPromises.push(this.syncTvShowsByType('on_the_air', options.pages || 2));
      }

      // Run all sync operations in parallel
      await Promise.all(syncPromises);

      this.lastSync = new Date();
      const duration = Math.round((this.lastSync - startTime) / 1000);
      
      logger.info(`✅ TMDB sync completed in ${duration}s - ${this.syncStats.newMovies} new movies, ${this.syncStats.newTvShows} new TV shows`);
      logger.info('📺 Streaming links are available for all synced content (generated via TMDB/IMDB IDs)');

      // Send smart Telegram notifications after sync (async, don't block)
      // Notifications are sent for new items synced from TMDB
      this.sendSmartNotifications().catch(err => {
        logger.error('Error sending smart notifications:', err);
      });

      return {
        success: true,
        message: 'Sync completed successfully',
        stats: this.syncStats,
        duration,
        lastSync: this.lastSync
      };

    } catch (error) {
      this.syncStats.errors++;
      
      return {
        success: false,
        message: error.message,
        stats: this.syncStats
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Sync genres from TMDB
   */
  async syncGenres() {
    const genresResponse = await tmdbService.getGenres();
    
    for (const genre of genresResponse.genres) {
      await Genre.findOneAndUpdate(
        { tmdbId: genre.id },
        { name: genre.name, tmdbId: genre.id },
        { upsert: true, new: true }
      );
    }
    
  }

  /**
   * Sync movies by type (popular, trending, etc.)
   */
  async syncMoviesByType(type, pages) {
    
    for (let page = 1; page <= pages; page++) {
      try {
        let moviesResponse;
        
        switch (type) {
          case 'popular':
            moviesResponse = await tmdbService.getPopularMovies(page);
            break;
          case 'trending':
            moviesResponse = await tmdbService.getTrendingMovies(page);
            break;
          case 'top_rated':
            moviesResponse = await tmdbService.getTopRatedMovies(page);
            break;
          case 'upcoming':
            moviesResponse = await tmdbService.getUpcomingMovies(page);
            break;
          default:
            throw new Error(`Unknown movie type: ${type}`);
        }

        const movies = moviesResponse.results;

        for (const movieData of movies) {
          await this.syncMovie(movieData);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.syncStats.errors++;
      }
    }
  }

  /**
   * Sync individual movie from TMDB (NOT stored in DB - streamed on-demand)
   * Only fetches data from TMDB and queues for notification
   */
  async syncMovie(movieData) {
    try {
      // Get detailed movie info including external IDs from TMDB
      const movieDetails = await tmdbService.getMovieDetails(movieData.id);
      
      // Get genre names (not stored in DB, just for notification)
      const genreNames = [];
      if (movieData.genre_ids && movieData.genre_ids.length > 0) {
        const genresResponse = await tmdbService.getGenres();
        const genreMap = {};
        genresResponse.genres.forEach(genre => {
          genreMap[genre.id] = genre.name;
        });
        movieData.genre_ids.forEach(genreId => {
          if (genreMap[genreId]) {
            genreNames.push(genreMap[genreId]);
        }
        });
      }

      // Create movie object for notification (NOT saved to DB)
      const movieForNotification = {
        _id: `tmdb_${movieData.id}`, // Temporary ID for notification
        tmdbId: movieData.id,
        imdbId: movieDetails.external_ids?.imdb_id || null,
        title: movieData.title,
        overview: movieData.overview,
        releaseDate: movieData.release_date ? new Date(movieData.release_date) : null,
        posterPath: movieData.poster_path,
        backdropPath: movieData.backdrop_path,
        runtime: movieDetails.runtime,
        voteAverage: movieData.vote_average,
        voteCount: movieData.vote_count,
        adult: movieData.adult,
        originalLanguage: movieData.original_language,
        originalTitle: movieData.original_title,
        genres: genreNames.map(name => ({ name })), // Format for notification
        popularity: movieData.popularity,
        video: movieData.video
      };

      this.syncStats.totalMovies++;
      
      // Check if we've seen this movie before (track in memory, not DB)
      const movieKey = `movie_${movieData.id}`;
      if (!this.seenMovies) {
        this.seenMovies = new Set();
      }
      
      if (this.seenMovies.has(movieKey)) {
        this.syncStats.updatedMovies++;
      } else {
        this.syncStats.newMovies++;
        this.seenMovies.add(movieKey);
        
        // Queue movie for notification (NOT saved to DB - streamed from TMDB)
        this.newMoviesQueue.push(movieForNotification);
        }

    } catch (error) {
      this.syncStats.errors++;
      logger.error(`Error syncing movie ${movieData.id} from TMDB:`, error.message);
    }
  }

  /**
   * Sync TV shows by type (popular, trending, etc.)
   */
  async syncTvShowsByType(type, pages) {
    
    for (let page = 1; page <= pages; page++) {
      try {
        let tvShowsResponse;
        
        switch (type) {
          case 'popular':
            tvShowsResponse = await tmdbService.getPopularTvShows(page);
            break;
          case 'trending':
            tvShowsResponse = await tmdbService.getTrendingTvShows(page);
            break;
          case 'top_rated':
            tvShowsResponse = await tmdbService.getTopRatedTvShows(page);
            break;
          case 'on_the_air':
            tvShowsResponse = await tmdbService.getOnTheAirTvShows(page);
            break;
          default:
            throw new Error(`Unknown TV show type: ${type}`);
        }

        const tvShows = tvShowsResponse.results;

        for (const tvShowData of tvShows) {
          await this.syncTvShow(tvShowData);
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.syncStats.errors++;
      }
    }
  }

  /**
   * Sync individual TV show from TMDB (NOT stored in DB - streamed on-demand)
   * Only fetches data from TMDB and queues for notification
   */
  async syncTvShow(tvShowData) {
    try {
      // Get detailed TV show info including external IDs from TMDB
      const tvShowDetails = await tmdbService.getTvShowDetails(tvShowData.id);
      
      // Get genre names (not stored in DB, just for notification)
      const genreNames = [];
      if (tvShowData.genre_ids && tvShowData.genre_ids.length > 0) {
        try {
          // Get genres from TMDB (use movie genres as fallback - genre IDs are often shared)
          const genresResponse = await tmdbService.getGenres();
          const genreMap = {};
          if (genresResponse && genresResponse.genres) {
            genresResponse.genres.forEach(genre => {
              genreMap[genre.id] = genre.name;
            });
          }
          tvShowData.genre_ids.forEach(genreId => {
            if (genreMap[genreId]) {
              genreNames.push(genreMap[genreId]);
            }
          });
        } catch (error) {
          // If genre fetch fails, continue without genres
          logger.debug(`Could not fetch genres for TV show ${tvShowData.id}:`, error.message);
          }
        }

      // Create TV show object for notification (NOT saved to DB)
      const tvShowForNotification = {
        _id: `tmdb_${tvShowData.id}`, // Temporary ID for notification
        tmdbId: tvShowData.id,
        name: tvShowData.name,
        originalName: tvShowData.original_name,
        overview: tvShowData.overview,
        firstAirDate: tvShowData.first_air_date ? new Date(tvShowData.first_air_date) : null,
        posterPath: tvShowData.poster_path,
        backdropPath: tvShowData.backdrop_path,
        voteAverage: tvShowData.vote_average,
        voteCount: tvShowData.vote_count,
        popularity: tvShowData.popularity,
        originalLanguage: tvShowData.original_language,
        originCountry: tvShowData.origin_country || [],
        genres: genreNames.map(name => ({ name })), // Format for notification
        status: tvShowDetails.status || 'Returning Series',
        type: tvShowDetails.type || 'Scripted',
        numberOfSeasons: tvShowDetails.number_of_seasons || 1,
        numberOfEpisodes: tvShowDetails.number_of_episodes || 0,
        imdbId: tvShowDetails.external_ids?.imdb_id
      };

      this.syncStats.totalTvShows++;
      
      // Check if we've seen this TV show before (track in memory, not DB)
      const tvShowKey = `tvshow_${tvShowData.id}`;
      if (!this.seenTvShows) {
        this.seenTvShows = new Set();
      }
      
      if (this.seenTvShows.has(tvShowKey)) {
        this.syncStats.updatedTvShows++;
      } else {
        this.syncStats.newTvShows++;
        this.seenTvShows.add(tvShowKey);
        
        // Queue TV show for notification (NOT saved to DB - streamed from TMDB)
        this.newTvShowsQueue.push(tvShowForNotification);
        }

    } catch (error) {
      this.syncStats.errors++;
      logger.error(`Error syncing TV show ${tvShowData.id} from TMDB:`, error.message);
    }
  }

  /**
   * Sync the last 100 movies from TMDB (now playing + latest releases)
   * Movies are NOT stored in DB - streamed on-demand from TMDB
   * This will send Telegram notifications for new movies
   */
  async syncLast100Movies() {
    try {
      logger.info('Starting sync of last 100 movies from TMDB (NOT stored in DB - streamed on-demand)...');
      this.syncStats = {
        totalMovies: 0,
        newMovies: 0,
        updatedMovies: 0,
        totalTvShows: 0,
        newTvShows: 0,
        updatedTvShows: 0,
        errors: 0
      };
      // Clear notification queue
      this.newMoviesQueue = [];
      // Clear seen items tracking (in-memory, not DB)
      this.seenMovies = new Set();

      // Get now playing movies (usually 20 per page, so we need ~5 pages for 100 movies)
      const moviesToSync = [];
      const pagesNeeded = Math.ceil(100 / 20); // 20 movies per page
      
      // Fetch from now_playing endpoint
      for (let page = 1; page <= pagesNeeded && moviesToSync.length < 100; page++) {
        try {
          const response = await tmdbService.getNowPlayingMovies(page);
          if (response.results && response.results.length > 0) {
            moviesToSync.push(...response.results.slice(0, 100 - moviesToSync.length));
          }
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error fetching now playing movies page ${page}:`, error.message);
          this.syncStats.errors++;
        }
      }

      // If we don't have 100 yet, fetch from popular
      if (moviesToSync.length < 100) {
        for (let page = 1; page <= pagesNeeded && moviesToSync.length < 100; page++) {
          try {
            const response = await tmdbService.getPopularMovies(page);
            if (response.results && response.results.length > 0) {
              // Filter out duplicates
              const existingIds = new Set(moviesToSync.map(m => m.id));
              const newMovies = response.results.filter(m => !existingIds.has(m.id));
              moviesToSync.push(...newMovies.slice(0, 100 - moviesToSync.length));
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            logger.error(`Error fetching popular movies page ${page}:`, error.message);
            this.syncStats.errors++;
          }
        }
      }

      logger.info(`Found ${moviesToSync.length} movies to sync`);

      // Sync each movie
      for (const movieData of moviesToSync) {
        try {
          await this.syncMovie(movieData);
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        } catch (error) {
          logger.error(`Error syncing movie ${movieData.id}:`, error.message);
          this.syncStats.errors++;
        }
      }

      logger.info(`Sync completed: ${this.syncStats.newMovies} new movies, ${this.syncStats.updatedMovies} updated, ${this.syncStats.errors} errors`);
      
      // Send smart Telegram notifications after sync (async, don't block)
      this.sendSmartNotifications().catch(err => {
        logger.error('Error sending smart notifications:', err);
      });
      
      return {
        success: true,
        stats: this.syncStats,
        message: `Synced ${moviesToSync.length} movies. ${this.syncStats.newMovies} new movies added.`
      };
    } catch (error) {
      logger.error('Error syncing last 100 movies:', error);
      return {
        success: false,
        error: error.message,
        stats: this.syncStats
      };
    }
  }

  /**
   * Sync the last 100 TV shows from TMDB (on the air + popular)
   * TV shows are NOT stored in DB - streamed on-demand from TMDB
   * This will send Telegram notifications for new TV shows
   */
  async syncLast100TvShows() {
    try {
      logger.info('Starting sync of last 100 TV shows from TMDB (NOT stored in DB - streamed on-demand)...');
      this.syncStats = {
        totalMovies: 0,
        newMovies: 0,
        updatedMovies: 0,
        totalTvShows: 0,
        newTvShows: 0,
        updatedTvShows: 0,
        errors: 0
      };
      // Clear notification queue
      this.newTvShowsQueue = [];
      // Clear seen items tracking (in-memory, not DB)
      this.seenTvShows = new Set();

      // Get on the air TV shows (usually 20 per page, so we need ~5 pages for 100 shows)
      const tvShowsToSync = [];
      const pagesNeeded = Math.ceil(100 / 20); // 20 shows per page
      
      // Fetch from on_the_air endpoint
      for (let page = 1; page <= pagesNeeded && tvShowsToSync.length < 100; page++) {
        try {
          const response = await tmdbService.getOnTheAirTvShows(page);
          if (response.results && response.results.length > 0) {
            tvShowsToSync.push(...response.results.slice(0, 100 - tvShowsToSync.length));
          }
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error fetching on the air TV shows page ${page}:`, error.message);
          this.syncStats.errors++;
        }
      }

      // If we don't have 100 yet, fetch from popular
      if (tvShowsToSync.length < 100) {
        for (let page = 1; page <= pagesNeeded && tvShowsToSync.length < 100; page++) {
          try {
            const response = await tmdbService.getPopularTvShows(page);
            if (response.results && response.results.length > 0) {
              // Filter out duplicates
              const existingIds = new Set(tvShowsToSync.map(t => t.id));
              const newShows = response.results.filter(t => !existingIds.has(t.id));
              tvShowsToSync.push(...newShows.slice(0, 100 - tvShowsToSync.length));
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            logger.error(`Error fetching popular TV shows page ${page}:`, error.message);
            this.syncStats.errors++;
          }
        }
      }

      logger.info(`Found ${tvShowsToSync.length} TV shows to sync`);
      logger.info(`Starting to sync ${tvShowsToSync.length} TV shows (this may take a few minutes)...`);

      // Sync each TV show
      let syncedCount = 0;
      for (const tvShowData of tvShowsToSync) {
        try {
          await this.syncTvShow(tvShowData);
          syncedCount++;
          // Log progress every 10 items
          if (syncedCount % 10 === 0) {
            logger.info(`Sync progress: ${syncedCount}/${tvShowsToSync.length} TV shows synced (${this.syncStats.newTvShows} new, ${this.syncStats.updatedTvShows} updated)`);
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
        } catch (error) {
          logger.error(`Error syncing TV show ${tvShowData.id}:`, error.message);
          this.syncStats.errors++;
        }
      }

      logger.info(`✅ Sync completed: ${this.syncStats.newTvShows} new TV shows, ${this.syncStats.updatedTvShows} updated, ${this.syncStats.errors} errors`);
      logger.info(`📊 Total processed: ${this.syncStats.totalTvShows} TV shows`);
      
      // Check if there are items to notify
      if (this.newTvShowsQueue.length > 0) {
        logger.info(`📢 Queue contains ${this.newTvShowsQueue.length} new TV shows for notification`);
        logger.info(`📢 Sending Telegram notifications at ${new Date().toISOString()}...`);
      // Send smart Telegram notifications after sync (async, don't block)
      this.sendSmartNotifications().catch(err => {
        logger.error('Error sending smart notifications:', err);
      });
      } else {
        logger.info('ℹ️  No new TV shows to notify (all were updates to existing shows)');
      }
      
      return {
        success: true,
        stats: this.syncStats,
        message: `Synced ${tvShowsToSync.length} TV shows. ${this.syncStats.newTvShows} new TV shows added.`
      };
    } catch (error) {
      logger.error('Error syncing last 100 TV shows:', error);
      return {
        success: false,
        error: error.message,
        stats: this.syncStats
      };
    }
  }

  /**
   * Send smart Telegram notifications based on queue size
   * - 1-3 items: Individual notifications with posters
   * - 4-10 items: Batch notification
   * - 10+ items: Summary batch notification
   */
  async sendSmartNotifications() {
    try {
      const notificationStartTime = new Date();
      logger.info(`🔔 [${notificationStartTime.toISOString()}] Starting notification checks for new content...`);
      
      // Reload Telegram, Twitter, Reddit, Pinterest, Bluesky and Tumblr settings
      await telegramService.loadSettings();
      await twitterService.loadSettings();
      await redditService.loadSettings();
      await pinterestService.loadSettings();
      await blueskyService.loadSettings();
      await tumblrService.loadSettings();
      
      const telegramReady = telegramService.enabled && !!(telegramService.botToken && telegramService.chatId);
      const twitterReady = twitterService.enabled && twitterService.notifyNewMovies;
      const redditMovieReady = redditService.enabled && redditService.notifyNewMovies;
      const redditTvReady = redditService.enabled && redditService.notifyNewTvShows;
      const pinterestMovieReady = pinterestService.enabled && pinterestService.notifyNewMovies;
      const pinterestTvReady = pinterestService.enabled && pinterestService.notifyNewTvShows;
      const blueskyMovieReady = blueskyService.enabled && blueskyService.notifyNewMovies;
      const blueskyTvReady = blueskyService.enabled && blueskyService.notifyNewTvShows;
      const tumblrMovieReady = tumblrService.enabled && tumblrService.notifyNewMovies;
      const tumblrTvReady = tumblrService.enabled && tumblrService.notifyNewTvShows;

      if (!telegramReady && !twitterReady && !redditMovieReady && !redditTvReady && !pinterestMovieReady && !pinterestTvReady && !blueskyMovieReady && !blueskyTvReady && !tumblrMovieReady && !tumblrTvReady) {
        logger.info('ℹ️  Social notifications (Telegram, X, Reddit, Pinterest, Bluesky, Tumblr) are disabled or not configured. Skipping.');
        this.newMoviesQueue = [];
        this.newTvShowsQueue = [];
        return;
      }
      
      logger.info(`Notification channels: Telegram: ${telegramReady ? '✅' : '❌'} | Twitter/X: ${twitterReady ? '✅' : '❌'} | Reddit: ${(redditMovieReady || redditTvReady) ? '✅' : '❌'} | Pinterest: ${(pinterestMovieReady || pinterestTvReady) ? '✅' : '❌'} | Bluesky: ${(blueskyMovieReady || blueskyTvReady) ? '✅' : '❌'} | Tumblr: ${(tumblrMovieReady || tumblrTvReady) ? '✅' : '❌'}`);
      
      let movieSuccessCount = 0;
      let movieFailureCount = 0;
      let tvShowSuccessCount = 0;
      let tvShowFailureCount = 0;

      // Send movie notifications
      if (this.newMoviesQueue.length > 0) {
        const movieCount = this.newMoviesQueue.length;
        
        // 1. Telegram Notifications
        if (telegramReady) {
          logger.info(`Attempting to send Telegram notifications for ${movieCount} new movies`);
          if (movieCount <= 3) {
            // Send individual notifications with posters for small batches
            for (const movie of this.newMoviesQueue) {
              try {
                const result = await telegramService.notifyNewMovie(movie);
                if (result && result.success) {
                  movieSuccessCount++;
                  logger.debug(`Successfully sent Telegram notification for movie: ${movie.title}`);
                } else {
                  movieFailureCount++;
                  const errorMsg = result?.error || 'Unknown error';
                  logger.error(`Failed to send Telegram notification for movie ${movie.title}: ${errorMsg}`);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error) {
                movieFailureCount++;
                logger.error(`Exception sending Telegram notification for ${movie.title}:`, error.message || error);
              }
            }
          } else {
            // Send batch notification for larger batches
            try {
              const result = await telegramService.notifyBatch(this.newMoviesQueue, 'movies');
              if (result && result.success) {
                movieSuccessCount = movieCount;
                logger.info(`Successfully sent Telegram batch notification for ${movieCount} movies`);
              } else {
                movieFailureCount = movieCount;
                const errorMsg = result?.error || 'Unknown error';
                logger.error(`Failed to send Telegram batch notification for ${movieCount} movies: ${errorMsg}`);
              }
            } catch (error) {
              movieFailureCount = movieCount;
              logger.error(`Exception sending Telegram batch notification for movies:`, error.message || error);
            }
          }
          
          if (movieSuccessCount > 0) {
            logger.info(`✅ Successfully sent Telegram notifications for ${movieSuccessCount}/${movieCount} new movies`);
          }
          if (movieFailureCount > 0) {
            logger.error(`❌ Failed to send Telegram notifications for ${movieFailureCount}/${movieCount} new movies`);
          }
        }

        // 2. Twitter/X Auto-Posting
        if (twitterReady) {
          const moviesToTweet = this.newMoviesQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${moviesToTweet.length} new movies to Twitter/X (total in queue: ${movieCount})`);
          for (const movie of moviesToTweet) {
            try {
              const xResult = await twitterService.notifyNewMovie(movie);
              if (xResult && xResult.success) {
                logger.info(`✅ Auto-posted new movie to Twitter/X: ${movie.title}`);
              } else {
                logger.warn(`⚠️ Failed to auto-post movie ${movie.title} to Twitter/X: ${xResult?.error || 'Unknown error'}`);
              }
              // Respect API pacing between tweets
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (xErr) {
              logger.error(`Exception auto-posting ${movie.title} to Twitter/X:`, xErr.message || xErr);
            }
          }
        }

        // 3. Reddit Auto-Posting
        if (redditMovieReady) {
          const moviesToPost = this.newMoviesQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${moviesToPost.length} new movies to Reddit (r/${redditService.subreddit})`);
          for (const movie of moviesToPost) {
            try {
              const rResult = await redditService.notifyNewMovie(movie);
              if (rResult && rResult.success) {
                logger.info(`✅ Auto-posted new movie to Reddit: ${movie.title} (${rResult.postUrl || ''})`);
              } else {
                logger.warn(`⚠️ Failed to auto-post movie ${movie.title} to Reddit: ${rResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (rErr) {
              logger.error(`Exception auto-posting ${movie.title} to Reddit:`, rErr.message || rErr);
            }
          }
        }

        // 4. Pinterest Auto-Pinning
        if (pinterestMovieReady) {
          const moviesToPin = this.newMoviesQueue.slice(0, 5);
          logger.info(`Attempting to auto-pin up to ${moviesToPin.length} new movies to Pinterest (Board: ${pinterestService.boardId})`);
          for (const movie of moviesToPin) {
            try {
              const pResult = await pinterestService.notifyNewMovie(movie);
              if (pResult && pResult.success) {
                logger.info(`✅ Auto-pinned new movie to Pinterest: ${movie.title} (${pResult.pinUrl || ''})`);
              } else {
                logger.warn(`⚠️ Failed to auto-pin movie ${movie.title} to Pinterest: ${pResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (pErr) {
              logger.error(`Exception auto-pinning ${movie.title} to Pinterest:`, pErr.message || pErr);
            }
          }
        }

        // 5. Bluesky Auto-Posting
        if (blueskyMovieReady) {
          const moviesToPost = this.newMoviesQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${moviesToPost.length} new movies to Bluesky (@${blueskyService.handle})`);
          for (const movie of moviesToPost) {
            try {
              const bResult = await blueskyService.notifyNewMovie(movie);
              if (bResult && bResult.success) {
                logger.info(`✅ Auto-posted new movie to Bluesky: ${movie.title} (${bResult.postUrl || ''})`);
              } else {
                logger.warn(`⚠️ Failed to auto-post movie ${movie.title} to Bluesky: ${bResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (bErr) {
              logger.error(`Exception auto-posting ${movie.title} to Bluesky:`, bErr.message || bErr);
            }
          }
        }

        // 6. Tumblr Auto-Posting
        if (tumblrMovieReady) {
          const moviesToPost = this.newMoviesQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${moviesToPost.length} new movies to Tumblr (@${tumblrService.blogIdentifier})`);
          for (const movie of moviesToPost) {
            try {
              const tResult = await tumblrService.notifyNewMovie(movie);
              if (tResult && tResult.success) {
                logger.info(`✅ Auto-posted new movie to Tumblr: ${movie.title} (${tResult.postUrl || ''})`);
              } else {
                logger.warn(`⚠️ Failed to auto-post movie ${movie.title} to Tumblr: ${tResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (tErr) {
              logger.error(`Exception auto-posting ${movie.title} to Tumblr:`, tErr.message || tErr);
            }
          }
        }
      }

      // Send TV show notifications
      if (this.newTvShowsQueue.length > 0) {
        const tvShowCount = this.newTvShowsQueue.length;
        logger.info(`Attempting to send Telegram notifications for ${tvShowCount} new TV shows`);
        
        if (tvShowCount <= 3) {
          // Send individual notifications with posters for small batches
          for (const tvShow of this.newTvShowsQueue) {
            try {
              const result = await telegramService.notifyNewTVShow(tvShow);
              if (result && result.success) {
                tvShowSuccessCount++;
                logger.debug(`Successfully sent notification for TV show: ${tvShow.name}`);
              } else {
                tvShowFailureCount++;
                const errorMsg = result?.error || 'Unknown error';
                logger.error(`Failed to send notification for TV show ${tvShow.name}: ${errorMsg}`);
              }
              // Rate limiting
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              tvShowFailureCount++;
              logger.error(`Exception sending notification for ${tvShow.name}:`, error.message || error);
            }
          }
        } else {
          // Send batch notification for larger batches
          try {
            const result = await telegramService.notifyBatch(this.newTvShowsQueue, 'tvshows');
            if (result && result.success) {
              tvShowSuccessCount = tvShowCount;
              logger.info(`Successfully sent batch notification for ${tvShowCount} TV shows`);
            } else {
              tvShowFailureCount = tvShowCount;
              const errorMsg = result?.error || 'Unknown error';
              logger.error(`Failed to send batch notification for ${tvShowCount} TV shows: ${errorMsg}`);
            }
          } catch (error) {
            tvShowFailureCount = tvShowCount;
            logger.error(`Exception sending batch notification for TV shows:`, error.message || error);
          }
        }
        
        if (tvShowSuccessCount > 0) {
          logger.info(`✅ Successfully sent Telegram notifications for ${tvShowSuccessCount}/${tvShowCount} new TV shows`);
        }
        if (tvShowFailureCount > 0) {
          logger.error(`❌ Failed to send Telegram notifications for ${tvShowFailureCount}/${tvShowCount} new TV shows`);
        }

        // Reddit TV Show Posting
        if (redditTvReady) {
          const tvShowsToPost = this.newTvShowsQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${tvShowsToPost.length} new TV shows to Reddit`);
          for (const tvShow of tvShowsToPost) {
            try {
              const rResult = await redditService.notifyNewTvShow(tvShow);
              if (rResult && rResult.success) {
                logger.info(`✅ Auto-posted new TV show to Reddit: ${tvShow.name}`);
              } else {
                logger.warn(`⚠️ Failed to auto-post TV show ${tvShow.name} to Reddit: ${rResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (rErr) {
              logger.error(`Exception auto-posting TV show ${tvShow.name} to Reddit:`, rErr.message || rErr);
            }
          }
        }

        // Pinterest TV Show Pinning
        if (pinterestTvReady) {
          const tvShowsToPin = this.newTvShowsQueue.slice(0, 5);
          logger.info(`Attempting to auto-pin up to ${tvShowsToPin.length} new TV shows to Pinterest`);
          for (const tvShow of tvShowsToPin) {
            try {
              const pResult = await pinterestService.notifyNewTvShow(tvShow);
              if (pResult && pResult.success) {
                logger.info(`✅ Auto-pinned new TV show to Pinterest: ${tvShow.name}`);
              } else {
                logger.warn(`⚠️ Failed to auto-pin TV show ${tvShow.name} to Pinterest: ${pResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (pErr) {
              logger.error(`Exception auto-pinning TV show ${tvShow.name} to Pinterest:`, pErr.message || pErr);
            }
          }
        }

        // Bluesky TV Show Posting
        if (blueskyTvReady) {
          const tvShowsToPost = this.newTvShowsQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${tvShowsToPost.length} new TV shows to Bluesky`);
          for (const tvShow of tvShowsToPost) {
            try {
              const bResult = await blueskyService.notifyNewTvShow(tvShow);
              if (bResult && bResult.success) {
                logger.info(`✅ Auto-posted new TV show to Bluesky: ${tvShow.name}`);
              } else {
                logger.warn(`⚠️ Failed to auto-post TV show ${tvShow.name} to Bluesky: ${bResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (bErr) {
              logger.error(`Exception auto-posting TV show ${tvShow.name} to Bluesky:`, bErr.message || bErr);
            }
          }
        }

        // Tumblr TV Show Posting
        if (tumblrTvReady) {
          const tvShowsToPost = this.newTvShowsQueue.slice(0, 5);
          logger.info(`Attempting to auto-post up to ${tvShowsToPost.length} new TV shows to Tumblr (@${tumblrService.blogIdentifier})`);
          for (const tvShow of tvShowsToPost) {
            try {
              const tResult = await tumblrService.notifyNewTvShow(tvShow);
              if (tResult && tResult.success) {
                logger.info(`✅ Auto-posted new TV show to Tumblr: ${tvShow.name}`);
              } else {
                logger.warn(`⚠️ Failed to auto-post TV show ${tvShow.name} to Tumblr: ${tResult?.error || 'Unknown error'}`);
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (tErr) {
              logger.error(`Exception auto-posting TV show ${tvShow.name} to Tumblr:`, tErr.message || tErr);
            }
          }
        }
      }

      // Clear queues after sending
      this.newMoviesQueue = [];
      this.newTvShowsQueue = [];
      
      // Summary log
      const totalSuccess = movieSuccessCount + tvShowSuccessCount;
      const totalFailure = movieFailureCount + tvShowFailureCount;
      const notificationEndTime = new Date();
      const duration = Math.round((notificationEndTime - notificationStartTime) / 1000);
      
      if (totalSuccess > 0 || totalFailure > 0) {
        logger.info(`📬 [${notificationEndTime.toISOString()}] Notification summary: ${totalSuccess} sent successfully, ${totalFailure} failed (took ${duration}s)`);
      } else {
        logger.info(`📬 [${notificationEndTime.toISOString()}] No notifications to send`);
      }
    } catch (error) {
      logger.error('Critical error in sendSmartNotifications:', error);
      // Don't clear queues on critical error so they can be retried
    }
  }

  /**
   * Get sync status and statistics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      stats: this.syncStats,
      scheduledJobs: Array.from(this.scheduledJobs.keys())
    };
  }

  /**
   * Get sync schedules
   */
  getSchedules() {
    return {
      daily: '0 2 * * *', // 2 AM daily
      hourly: '0 * * * *', // Every hour
      twiceDaily: '0 2,14 * * *', // 2 AM and 2 PM
      weekly: '0 2 * * 0', // 2 AM every Sunday
      custom: 'Custom cron expression'
    };
  }

  /**
   * Post daily top movies to Telegram and Twitter/X
   * Fetches top rated/trending movies from TMDB and posts them
   */
  async postDailyTopMovies() {
    try {
      logger.info('🎬 Starting daily top movies post...');
      
      // Get top rated movies from TMDB (first page, top 3)
      const topRatedResponse = await tmdbService.getTopRatedMovies(1);
      const trendingResponse = await tmdbService.getTrendingMovies(1);
      
      // Combine and get top 3 unique movies
      const allMovies = [...topRatedResponse.results, ...trendingResponse.results];
      const uniqueMovies = [];
      const seenIds = new Set();
      
      for (const movie of allMovies) {
        if (!seenIds.has(movie.id) && uniqueMovies.length < 3) {
          seenIds.add(movie.id);
          // Get detailed movie info
          try {
            const movieDetails = await tmdbService.getMovieDetails(movie.id);
            const movieForPost = {
              _id: `tmdb_${movie.id}`,
              tmdbId: movie.id,
              title: movie.title,
              overview: movie.overview,
              releaseDate: movie.release_date ? new Date(movie.release_date) : null,
              posterPath: movie.poster_path || movieDetails.poster_path,
              backdropPath: movie.backdrop_path || movieDetails.backdrop_path,
              voteAverage: movie.vote_average || movieDetails.vote_average,
              genres: movieDetails.genres || [],
              imdbId: movieDetails.external_ids?.imdb_id
            };
            uniqueMovies.push(movieForPost);
          } catch (error) {
            logger.warn(`Error getting details for movie ${movie.id}:`, error.message);
          }
        }
      }

      if (uniqueMovies.length === 0) {
        logger.warn('No movies found to post');
        return { success: false, error: 'No movies found' };
      }

      logger.info(`Found ${uniqueMovies.length} top movies to post`);

      // Post to Telegram
      let telegramSuccess = false;
      try {
        const telegramResult = await telegramService.notifyBatch(uniqueMovies, 'movies');
        telegramSuccess = telegramResult && telegramResult.success;
        if (telegramSuccess) {
          logger.info('✅ Posted top movies to Telegram');
        } else {
          logger.error('❌ Failed to post to Telegram:', telegramResult?.error);
        }
      } catch (error) {
        logger.error('❌ Error posting to Telegram:', error.message);
      }

      // Post to Twitter/X
      let twitterSuccess = false;
      try {
        const twitterResult = await twitterService.postDailyTopMoviesBatch(uniqueMovies);
        twitterSuccess = twitterResult && twitterResult.success;
        if (twitterSuccess) {
          logger.info('✅ Posted top movies to Twitter/X');
        } else {
          logger.error('❌ Failed to post to Twitter/X:', twitterResult?.error);
        }
      } catch (error) {
        logger.error('❌ Error posting to Twitter/X:', error.message);
      }

      logger.info(`📊 Daily post completed - Telegram: ${telegramSuccess ? '✅' : '❌'}, Twitter: ${twitterSuccess ? '✅' : '❌'}`);

      return {
        success: telegramSuccess || twitterSuccess,
        telegram: telegramSuccess,
        twitter: twitterSuccess,
        moviesPosted: uniqueMovies.length
      };
    } catch (error) {
      logger.error('Error posting daily top movies:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start daily top movies posting schedule
   */
  startDailyTopMoviesPost(options = {}) {
    const {
      schedule = '0 10 * * *', // Default: daily at 10 AM
      timezone = 'UTC'
    } = options;

    // Clear existing job if any
    if (this.scheduledJobs.has('dailyTopMovies')) {
      this.scheduledJobs.get('dailyTopMovies').destroy();
    }

    // Schedule the daily post job
    const job = cron.schedule(schedule, async () => {
      await this.postDailyTopMovies();
    }, {
      scheduled: true,
      timezone: timezone
    });

    this.scheduledJobs.set('dailyTopMovies', job);
    logger.info(`📅 Daily top movies post scheduled: ${schedule} (${timezone})`);
  }

  /**
   * Stop daily top movies posting
   */
  stopDailyTopMoviesPost() {
    if (this.scheduledJobs.has('dailyTopMovies')) {
      this.scheduledJobs.get('dailyTopMovies').destroy();
      this.scheduledJobs.delete('dailyTopMovies');
      logger.info('📅 Daily top movies post stopped');
    }
  }

  /**
   * Post next high-quality cinema movie or popular TV series to Telegram channel
   * with interactive player embed buttons
   */
  async postNextMovieToTelegram() {
    try {
      const SiteSettings = require('../models/SiteSettings');
      const settings = await SiteSettings.getSettings();

      // Check if telegram auto-post is enabled
      const isAutoPostEnabled = settings?.telegram?.autoPostEveryMinute !== false;
      const isTelegramEnabled = settings?.telegram?.enabled || (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

      if (!isTelegramEnabled) {
        logger.debug('Telegram not enabled or configured, skipping minute post');
        return { success: false, message: 'Telegram is not enabled or credentials are missing' };
      }

      if (!isAutoPostEnabled) {
        logger.debug('Telegram every-minute auto-post is disabled in settings');
        return { success: false, message: 'Auto-post every minute is disabled in settings' };
      }

      // Check preferences from settings
      const canPostMovies = settings?.telegram?.notifyNewMovies !== false;
      const canPostTvShows = settings?.telegram?.notifyNewTvShows !== false;

      // Smart alternating: If last was tv, post cinema movie; if last was movie, post TV series
      let targetType = 'movie';
      if (canPostMovies && canPostTvShows) {
        targetType = this.lastTelegramContentType === 'movie' ? 'tv' : 'movie';
      } else if (!canPostMovies && canPostTvShows) {
        targetType = 'tv';
      } else {
        targetType = 'movie';
      }

      const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
      const twoMonthsFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      // Search helper for Cinema / Popular Movies
      const findMovieCandidate = async () => {
        const movieFilter = {
          posterPath: { $ne: null, $ne: '' },
          popularity: { $gte: 15 },
          $or: [
            { releaseDate: { $gte: fourYearsAgo, $lte: twoMonthsFuture } },
            { popularity: { $gte: 80 } }
          ]
        };

        // Priority 1: Unposted high-popularity cinema movie
        let item = await Movie.findOne({
          ...movieFilter,
          $or: [
            { telegramPostedAt: null },
            { telegramPostedAt: { $exists: false } }
          ]
        }).sort({ popularity: -1 });

        // Priority 2: Recycle top cinema movies with oldest posted date
        if (!item) {
          item = await Movie.findOne(movieFilter).sort({ telegramPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      // Search helper for Airing / Popular TV Shows
      const findTvCandidate = async () => {
        const tvFilter = {
          posterPath: { $ne: null, $ne: '' },
          popularity: { $gte: 15 },
          status: { $in: ['Returning Series', 'In Production', 'Ended'] }
        };

        // Priority 1: Unposted popular TV show
        let item = await TvShow.findOne({
          ...tvFilter,
          $or: [
            { telegramPostedAt: null },
            { telegramPostedAt: { $exists: false } }
          ]
        }).sort({ popularity: -1 });

        // Priority 2: Recycle top TV shows with oldest posted date
        if (!item) {
          item = await TvShow.findOne(tvFilter).sort({ telegramPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      let selectedItem = null;
      let actualType = targetType;

      if (targetType === 'tv') {
        selectedItem = await findTvCandidate();
        if (!selectedItem && canPostMovies) {
          selectedItem = await findMovieCandidate();
          actualType = 'movie';
        }
      } else {
        selectedItem = await findMovieCandidate();
        if (!selectedItem && canPostTvShows) {
          selectedItem = await findTvCandidate();
          actualType = 'tv';
        }
      }

      if (!selectedItem) {
        logger.warn('No cinema movies or popular TV shows found in database matching criteria');
        return { success: false, message: 'No eligible popular movies or TV shows found' };
      }

      let postResult = null;
      if (actualType === 'movie') {
        logger.info(`🎬 Auto-posting Cinema/Hit Movie to Telegram: "${selectedItem.title}" (Popularity: ${selectedItem.popularity}, ID: ${selectedItem._id})`);
        postResult = await telegramService.notifyNewMovie(selectedItem);
        if (postResult && postResult.success) {
          await Movie.updateOne({ _id: selectedItem._id }, { $set: { telegramPostedAt: new Date() } });
          this.lastTelegramContentType = 'movie';
          logger.info(`✅ Successfully posted Cinema Movie "${selectedItem.title}" to Telegram (messageId: ${postResult.messageId})`);
          return {
            success: true,
            type: 'movie',
            id: selectedItem._id,
            title: selectedItem.title,
            popularity: selectedItem.popularity,
            messageId: postResult.messageId
          };
        }
      } else {
        logger.info(`📺 Auto-posting Airing/Hit TV Show to Telegram: "${selectedItem.name}" (Popularity: ${selectedItem.popularity}, ID: ${selectedItem._id})`);
        postResult = await telegramService.notifyNewTVShow(selectedItem);
        if (postResult && postResult.success) {
          await TvShow.updateOne({ _id: selectedItem._id }, { $set: { telegramPostedAt: new Date() } });
          this.lastTelegramContentType = 'tv';
          logger.info(`✅ Successfully posted TV Show "${selectedItem.name}" to Telegram (messageId: ${postResult.messageId})`);
          return {
            success: true,
            type: 'tv',
            id: selectedItem._id,
            title: selectedItem.name,
            popularity: selectedItem.popularity,
            messageId: postResult.messageId
          };
        }
      }

      logger.error(`❌ Failed to post ${actualType} to Telegram:`, postResult?.error);
      return {
        success: false,
        type: actualType,
        error: postResult?.error || 'Failed to post'
      };
    } catch (error) {
      logger.error('Error posting next popular content to Telegram:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start every-minute Telegram poster (* * * * *)
   */
  startTelegramMinutePoster() {
    if (this.scheduledJobs.has('telegramMinutePoster')) {
      logger.info('Telegram minute poster is already scheduled and running');
      return;
    }

    // Schedule every minute
    const job = cron.schedule('* * * * *', async () => {
      if (this.isTelegramMinutePosting) {
        logger.debug('Telegram minute post already in progress, skipping tick');
        return;
      }
      this.isTelegramMinutePosting = true;
      try {
        await this.postNextMovieToTelegram();
      } catch (err) {
        logger.error('Error during Telegram minute post tick:', err);
      } finally {
        this.isTelegramMinutePosting = false;
      }
    }, {
      scheduled: true
    });

    this.scheduledJobs.set('telegramMinutePoster', job);
    logger.info('🚀 Telegram every-minute movie poster started (* * * * *)');
  }

  /**
   * Stop every-minute Telegram poster
   */
  stopTelegramMinutePoster() {
    if (this.scheduledJobs.has('telegramMinutePoster')) {
      this.scheduledJobs.get('telegramMinutePoster').destroy();
      this.scheduledJobs.delete('telegramMinutePoster');
      logger.info('🛑 Telegram every-minute movie poster stopped');
    }
  }

  /**
   * Post next high-quality cinema movie or popular TV series to Bluesky
   * with dynamic SEO tags, rich link preview, and poster embed
   */
  async postNextMovieToBluesky(isManual = false) {
    try {
      const SiteSettings = require('../models/SiteSettings');
      const settings = await SiteSettings.getSettings();

      const isBlueskyEnabled = settings?.bluesky?.enabled || (process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
      const isAutoPostEnabled = settings?.bluesky?.autoPostEveryMinute !== false;

      if (!isBlueskyEnabled) {
        logger.debug('Bluesky not enabled or configured, skipping minute post');
        return { success: false, message: 'Bluesky is not enabled or credentials are missing' };
      }

      if (!isManual && !isAutoPostEnabled) {
        logger.debug('Bluesky scheduled auto-post is disabled in settings');
        return { success: false, message: 'Auto-post schedule is disabled in settings' };
      }

      const canPostMovies = settings?.bluesky?.notifyNewMovies !== false;
      const canPostTvShows = settings?.bluesky?.notifyNewTvShows !== false;

      let targetType = 'movie';
      if (canPostMovies && canPostTvShows) {
        targetType = this.lastBlueskyContentType === 'movie' ? 'tv' : 'movie';
      } else if (!canPostMovies && canPostTvShows) {
        targetType = 'tv';
      } else {
        targetType = 'movie';
      }

      const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
      const twoMonthsFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const findMovieCandidate = async () => {
        const movieFilter = {
          posterPath: { $ne: null, $ne: '' },
          popularity: { $gte: 15 },
          $or: [
            { releaseDate: { $gte: fourYearsAgo, $lte: twoMonthsFuture } },
            { popularity: { $gte: 80 } }
          ]
        };

        let item = await Movie.findOne({
          ...movieFilter,
          $or: [
            { blueskyPostedAt: null },
            { blueskyPostedAt: { $exists: false } }
          ]
        }).populate('genres', 'name').sort({ popularity: -1 });

        if (!item) {
          item = await Movie.findOne(movieFilter).populate('genres', 'name').sort({ blueskyPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      const findTvCandidate = async () => {
        const tvFilter = {
          posterPath: { $ne: null, $ne: '' },
          popularity: { $gte: 15 },
          status: { $in: ['Returning Series', 'In Production', 'Ended'] }
        };

        let item = await TvShow.findOne({
          ...tvFilter,
          $or: [
            { blueskyPostedAt: null },
            { blueskyPostedAt: { $exists: false } }
          ]
        }).populate('genres', 'name').sort({ popularity: -1 });

        if (!item) {
          item = await TvShow.findOne(tvFilter).populate('genres', 'name').sort({ blueskyPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      let selectedItem = null;
      let actualType = targetType;

      if (targetType === 'tv') {
        selectedItem = await findTvCandidate();
        if (!selectedItem && canPostMovies) {
          selectedItem = await findMovieCandidate();
          actualType = 'movie';
        }
      } else {
        selectedItem = await findMovieCandidate();
        if (!selectedItem && canPostTvShows) {
          selectedItem = await findTvCandidate();
          actualType = 'tv';
        }
      }

      if (!selectedItem) {
        logger.warn('No cinema movies or popular TV shows found in database for Bluesky');
        return { success: false, message: 'No eligible popular movies or TV shows found' };
      }

      let postResult = null;
      if (actualType === 'movie') {
        logger.info(`🎬 Auto-posting Cinema Movie to Bluesky: "${selectedItem.title}" (Popularity: ${selectedItem.popularity})`);
        postResult = await blueskyService.notifyNewMovie(selectedItem, null, isManual);
        if (postResult && postResult.success) {
          await Movie.updateOne({ _id: selectedItem._id }, { $set: { blueskyPostedAt: new Date() } });
          this.lastBlueskyContentType = 'movie';
          logger.info(`✅ Successfully posted Movie "${selectedItem.title}" to Bluesky (${postResult.postUrl})`);
          return {
            success: true,
            type: 'movie',
            id: selectedItem._id,
            title: selectedItem.title,
            postUrl: postResult.postUrl
          };
        } else {
          // Mark with timestamp and error so this item does not block the queue forever
          await Movie.updateOne({ _id: selectedItem._id }, { $set: { blueskyPostedAt: new Date() } });
          this.lastBlueskyContentType = 'movie';
        }
      } else {
        logger.info(`📺 Auto-posting Hit TV Show to Bluesky: "${selectedItem.name}" (Popularity: ${selectedItem.popularity})`);
        postResult = await blueskyService.notifyNewTvShow(selectedItem, null, isManual);
        if (postResult && postResult.success) {
          await TvShow.updateOne({ _id: selectedItem._id }, { $set: { blueskyPostedAt: new Date() } });
          this.lastBlueskyContentType = 'tv';
          logger.info(`✅ Successfully posted TV Show "${selectedItem.name}" to Bluesky (${postResult.postUrl})`);
          return {
            success: true,
            type: 'tv',
            id: selectedItem._id,
            title: selectedItem.name,
            postUrl: postResult.postUrl
          };
        } else {
          // Mark with timestamp and error so this item does not block the queue forever
          await TvShow.updateOne({ _id: selectedItem._id }, { $set: { blueskyPostedAt: new Date() } });
          this.lastBlueskyContentType = 'tv';
        }
      }

      logger.error(`❌ Failed to post ${actualType} to Bluesky:`, postResult?.error);
      return {
        success: false,
        type: actualType,
        error: postResult?.error || 'Failed to post'
      };
    } catch (error) {
      logger.error('Error posting next popular content to Bluesky:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start scheduled Bluesky poster (every 20 minutes to prevent spam suspensions)
   */
  startBlueskyMinutePoster() {
    if (this.scheduledJobs.has('blueskyMinutePoster')) {
      logger.info('Bluesky scheduled poster is already running');
      return;
    }

    // Runs every 20 minutes (*/20 * * * *) to maintain a safe, organic posting pace
    const job = cron.schedule('*/20 * * * *', async () => {
      if (this.isBlueskyMinutePosting) {
        logger.debug('Bluesky scheduled post already in progress, skipping tick');
        return;
      }
      this.isBlueskyMinutePosting = true;
      try {
        await this.postNextMovieToBluesky();
      } catch (err) {
        logger.error('Error during Bluesky scheduled post tick:', err);
      } finally {
        this.isBlueskyMinutePosting = false;
      }
    }, {
      scheduled: true
    });

    this.scheduledJobs.set('blueskyMinutePoster', job);
    logger.info('🚀 Bluesky scheduled movie poster started (every 20 minutes: */20 * * * *)');
  }

  /**
   * Stop every-minute Bluesky poster
   */
  stopBlueskyMinutePoster() {
    if (this.scheduledJobs.has('blueskyMinutePoster')) {
      this.scheduledJobs.get('blueskyMinutePoster').destroy();
      this.scheduledJobs.delete('blueskyMinutePoster');
      logger.info('🛑 Bluesky every-minute movie poster stopped');
    }
  }

  /**
   * Post next popular movie or TV show to Tumblr
   * Alternates between movies and TV shows
   */
  async postNextMovieToTumblr() {
    try {
      const SiteSettings = require('../models/SiteSettings');
      const settings = await SiteSettings.getSettings();

      const isTumblrEnabled = settings?.tumblr?.enabled || (process.env.TUMBLR_CONSUMER_KEY && process.env.TUMBLR_ACCESS_TOKEN);
      const isAutoPostEnabled = settings?.tumblr?.autoPostEveryMinute !== false;

      if (!isTumblrEnabled) {
        logger.debug('Tumblr not enabled or configured, skipping minute post');
        return { success: false, message: 'Tumblr is not enabled or credentials are missing' };
      }

      if (!isAutoPostEnabled) {
        logger.debug('Tumblr every-minute auto-post is disabled in settings');
        return { success: false, message: 'Auto-post every minute is disabled in settings' };
      }

      const canPostMovies = settings?.tumblr?.notifyNewMovies !== false;
      const canPostTvShows = settings?.tumblr?.notifyNewTvShows !== false;
      const isGreatOnly = settings?.tumblr?.onlyGreatContent !== false;

      let targetType = 'movie';
      if (canPostMovies && canPostTvShows) {
        targetType = this.lastTumblrContentType === 'movie' ? 'tv' : 'movie';
      } else if (!canPostMovies && canPostTvShows) {
        targetType = 'tv';
      } else {
        targetType = 'movie';
      }

      const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
      const twoMonthsFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const findMovieCandidate = async () => {
        const movieFilter = {
          posterPath: { $ne: null, $ne: '' },
          ...(isGreatOnly ? {
            $or: [
              { voteAverage: { $gte: 7.2 }, voteCount: { $gte: 50 } },
              { popularity: { $gte: 40 } }
            ]
          } : {
            popularity: { $gte: 15 },
            $or: [
              { releaseDate: { $gte: fourYearsAgo, $lte: twoMonthsFuture } },
              { popularity: { $gte: 80 } }
            ]
          })
        };

        let item = await Movie.findOne({
          ...movieFilter,
          $or: [
            { tumblrPostedAt: null },
            { tumblrPostedAt: { $exists: false } }
          ]
        }).populate('genres', 'name').sort({ popularity: -1, voteAverage: -1 });

        if (!item) {
          item = await Movie.findOne(movieFilter).populate('genres', 'name').sort({ tumblrPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      const findTvCandidate = async () => {
        const tvFilter = {
          posterPath: { $ne: null, $ne: '' },
          status: { $in: ['Returning Series', 'In Production', 'Ended'] },
          ...(isGreatOnly ? {
            $or: [
              { voteAverage: { $gte: 7.2 }, voteCount: { $gte: 20 } },
              { popularity: { $gte: 30 } }
            ]
          } : {
            popularity: { $gte: 15 }
          })
        };

        let item = await TvShow.findOne({
          ...tvFilter,
          $or: [
            { tumblrPostedAt: null },
            { tumblrPostedAt: { $exists: false } }
          ]
        }).populate('genres', 'name').sort({ popularity: -1, voteAverage: -1 });

        if (!item) {
          item = await TvShow.findOne(tvFilter).populate('genres', 'name').sort({ tumblrPostedAt: 1, popularity: -1 });
        }
        return item;
      };

      let selectedItem = null;
      let actualType = targetType;

      if (targetType === 'tv') {
        selectedItem = await findTvCandidate();
        if (!selectedItem && canPostMovies) {
          selectedItem = await findMovieCandidate();
          actualType = 'movie';
        }
      } else {
        selectedItem = await findMovieCandidate();
        if (!selectedItem && canPostTvShows) {
          selectedItem = await findTvCandidate();
          actualType = 'tv';
        }
      }

      if (!selectedItem) {
        logger.warn('No cinema movies or popular TV shows found in database for Tumblr');
        return { success: false, message: 'No eligible popular movies or TV shows found' };
      }

      let postResult = null;
      if (actualType === 'movie') {
        logger.info(`🎬 Auto-posting Great Movie to Tumblr: "${selectedItem.title}" (⭐${selectedItem.voteAverage?.toFixed(1) || 'N/A'}, Pop: ${selectedItem.popularity})`);
        postResult = await tumblrService.notifyNewMovie(selectedItem);
        if (postResult && postResult.success) {
          await Movie.updateOne({ _id: selectedItem._id }, { $set: { tumblrPostedAt: new Date() } });
          this.lastTumblrContentType = 'movie';
          logger.info(`✅ Successfully posted Movie "${selectedItem.title}" to Tumblr (${postResult.postUrl})`);
          return {
            success: true,
            type: 'movie',
            id: selectedItem._id,
            title: selectedItem.title,
            postUrl: postResult.postUrl
          };
        } else {
          await Movie.updateOne({ _id: selectedItem._id }, { $set: { tumblrPostedAt: new Date() } });
          this.lastTumblrContentType = 'movie';
        }
      } else {
        logger.info(`📺 Auto-posting Great TV Show to Tumblr: "${selectedItem.name}" (⭐${selectedItem.voteAverage?.toFixed(1) || 'N/A'}, Pop: ${selectedItem.popularity})`);
        postResult = await tumblrService.notifyNewTvShow(selectedItem);
        if (postResult && postResult.success) {
          await TvShow.updateOne({ _id: selectedItem._id }, { $set: { tumblrPostedAt: new Date() } });
          this.lastTumblrContentType = 'tv';
          logger.info(`✅ Successfully posted TV Show "${selectedItem.name}" to Tumblr (${postResult.postUrl})`);
          return {
            success: true,
            type: 'tv',
            id: selectedItem._id,
            title: selectedItem.name,
            postUrl: postResult.postUrl
          };
        } else {
          await TvShow.updateOne({ _id: selectedItem._id }, { $set: { tumblrPostedAt: new Date() } });
          this.lastTumblrContentType = 'tv';
        }
      }

      logger.error(`❌ Failed to post ${actualType} to Tumblr:`, postResult?.error);
      return {
        success: false,
        type: actualType,
        error: postResult?.error || 'Failed to post'
      };
    } catch (error) {
      logger.error('Error posting next popular content to Tumblr:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start Tumblr poster with customizable delay interval (default: 10 minutes)
   */
  async startTumblrMinutePoster() {
    if (this.scheduledJobs.has('tumblrMinutePoster')) {
      this.scheduledJobs.get('tumblrMinutePoster').destroy();
      this.scheduledJobs.delete('tumblrMinutePoster');
    }

    const SiteSettings = require('../models/SiteSettings');
    const settings = await SiteSettings.getSettings();
    const intervalMinutes = settings?.tumblr?.postIntervalMinutes || 10;

    let cronExpr = `*/${intervalMinutes} * * * *`;
    if (intervalMinutes <= 1) {
      cronExpr = '* * * * *';
    } else if (intervalMinutes >= 60) {
      cronExpr = '0 * * * *';
    }

    const job = cron.schedule(cronExpr, async () => {
      if (this.isTumblrMinutePosting) {
        logger.debug('Tumblr post already in progress, skipping tick');
        return;
      }
      this.isTumblrMinutePosting = true;
      try {
        await this.postNextMovieToTumblr();
      } catch (err) {
        logger.error('Error during Tumblr post tick:', err);
      } finally {
        this.isTumblrMinutePosting = false;
      }
    }, {
      scheduled: true
    });

    this.scheduledJobs.set('tumblrMinutePoster', job);
    logger.info(`🚀 Tumblr auto-poster started (Interval: every ${intervalMinutes} min, schedule: "${cronExpr}")`);
  }

  /**
   * Stop Tumblr poster
   */
  stopTumblrMinutePoster() {
    if (this.scheduledJobs.has('tumblrMinutePoster')) {
      this.scheduledJobs.get('tumblrMinutePoster').destroy();
      this.scheduledJobs.delete('tumblrMinutePoster');
      logger.info('🛑 Tumblr auto-poster stopped');
    }
  }
}

module.exports = new AutoSyncService();
