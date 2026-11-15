const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const Genre = require('../models/Genre');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 80;

// Clear cache on startup
cache.clear();

function pruneRouteCache() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (now - v.timestamp >= CACHE_TTL) {
      cache.delete(k);
    }
  }
  while (cache.size > MAX_CACHE_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

// Cache helper functions
const getCacheKey = (req) => {
  const { page, limit, genre, year, sortBy, order, search, minRating, provider, country } = req.query;
  return `movies:${JSON.stringify({ page, limit, genre, year, sortBy, order, search, minRating, provider, country })}`;
};

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  pruneRouteCache();
};
const Watchlist = require('../models/Watchlist');
const WatchHistory = require('../models/WatchHistory');
const auth = require('../middleware/auth');
const tmdbService = require('../services/tmdbService');
const hybridService = require('../services/hybridService');
const geminiService = require('../services/geminiService');

const mapTmdbMovieResult = (movie) => ({
  _id: movie.id ? movie.id.toString() : undefined,
  tmdbId: movie.id,
  title: movie.title,
  originalTitle: movie.original_title,
  overview: movie.overview,
  posterPath: movie.poster_path,
  backdropPath: movie.backdrop_path,
  releaseDate: movie.release_date,
  voteAverage: movie.vote_average,
  popularity: movie.popularity,
  runtime: movie.runtime,
  genres: (movie.genre_ids || []).map((id) => ({ _id: id })),
  productionCountries: (movie.origin_country || []).map((code) => ({ isoCode: code }))
});

// Create a new movie (admin only)
router.post('/', async (req, res) => {
  try {
    const movieData = req.body;
    
    // Check if movie already exists
    const existingMovie = await Movie.findOne({ title: movieData.title });
    if (existingMovie) {
      return res.status(409).json({ message: 'Movie already exists' });
    }

    const movie = new Movie({
      ...movieData,
      isAvailable: true,
      popularity: movieData.voteAverage || 0,
      voteCount: 0
    });

    await movie.save();
    await movie.populate('genres', 'name');
    
    // Auto-post to Twitter/X if enabled (background, non-blocking)
    try {
      const twitterService = require('../services/twitterService');
      if (twitterService.enabled && twitterService.notifyNewMovies) {
        twitterService.notifyNewMovie(movie).then(result => {
          if (result && result.success) {
            console.log(`✅ Auto-posted manually added movie to Twitter/X: ${movie.title}`);
          }
        }).catch(err => {
          console.error(`Error auto-posting manually added movie to Twitter/X:`, err.message);
        });
      }
    } catch (twitterErr) {
      // Ignore background notification error
    }

    res.status(201).json(movie);
  } catch (error) {
    res.status(500).json({ message: 'Error creating movie' });
  }
});

// Get all movies with pagination and filtering
router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = getCacheKey(req);
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const {
      page = 1,
      limit = 20,
      genre,
      year,
      sortBy = 'popularity',
      order = 'desc',
      search,
      minRating,
      provider, // Streaming service provider ID (e.g., 8 for Netflix, 390 for Disney+)
      country
    } = req.query;

    const countries = Array.isArray(country) ? country : (country ? [country] : []);
    const normalizedCountries = countries
      .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : null))
      .filter(Boolean);

    if (normalizedCountries.length > 0) {
      const originCountry = normalizedCountries[0];
      const tmdbOrder = order === 'asc' ? 'asc' : 'desc';
      const discoverResponse = await tmdbService.discoverMovies({
        page: parseInt(page, 10) || 1,
        originCountry,
        sortBy,
        order: tmdbOrder,
      });

      const movies = (discoverResponse.results || []).map(mapTmdbMovieResult);
      const response = {
        movies,
        totalPages: discoverResponse.total_pages,
        currentPage: discoverResponse.page,
        total: discoverResponse.total_results
      };

      setCachedData(cacheKey, response);
      return res.json(response);
    }

    // Handle multiple genre parameters
    const genres = Array.isArray(genre) ? genre : (genre ? [genre] : []);

    const query = { isAvailable: true };
    
    // Add genre filter
    if (genres.length > 0) {
      // Find genre by name or ID
      const genreIds = [];
      
      for (const genreParam of genres) {
        if (mongoose.Types.ObjectId.isValid(genreParam)) {
          // It's a valid ObjectId
          genreIds.push(new mongoose.Types.ObjectId(genreParam));
        } else {
          // It's a genre name, find the genre
          // Case-insensitive search
          const foundGenre = await Genre.findOne({ 
            name: { $regex: new RegExp(`^${genreParam}$`, 'i') }
          });
          if (foundGenre) {
            genreIds.push(foundGenre._id);
          }
        }
      }
      
      if (genreIds.length > 0) {
        query.genres = { $in: genreIds };
      }
    }
    
    // Add year filter
    if (year && year !== 'all') {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.releaseDate = { $gte: startDate, $lte: endDate };
    }
    
    // Add rating filter
    if (minRating) {
      query.voteAverage = { $gte: parseFloat(minRating) };
    }

    // Add streaming provider filter
    const providerFilter = [];
    if (provider) {
      const providerId = parseInt(provider);
      if (!isNaN(providerId)) {
        providerFilter.push(
          { 'watchProviders.flatrate.providerId': providerId },
          { 'watchProviders.buy.providerId': providerId },
          { 'watchProviders.rent.providerId': providerId }
        );
      }
    }

    // Add search filter with improved performance
    const searchFilter = [];
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      searchFilter.push(
        { title: searchRegex },
        { originalTitle: searchRegex },
        { overview: searchRegex },
        { 'genres.name': searchRegex }
      );
    }

    // Add country filter
    if (country) {
      const countryParams = Array.isArray(country) ? country : [country];
      const normalizedCountryCodes = countryParams
        .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : null))
        .filter(Boolean);

      if (normalizedCountryCodes.length > 0) {
        query['productionCountries.isoCode'] = { $in: normalizedCountryCodes };
      }
    }

    // Combine filters correctly
    if (providerFilter.length > 0 && searchFilter.length > 0) {
      // Both provider and search - need to match both conditions
      query.$and = [
        { $or: providerFilter },
        { $or: searchFilter }
      ];
    } else if (providerFilter.length > 0) {
      query.$or = providerFilter;
    } else if (searchFilter.length > 0) {
      query.$or = searchFilter;
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;


    const movies = await Movie.find(query)
      .populate('genres', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Movie.countDocuments(query);

    const response = {
      movies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    };

    // Cache the response
    setCachedData(cacheKey, response);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movies' });
  }
});

// Get popular movies - Hybrid: Fetch from TMDB
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getPopularMovies(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching popular movies' });
  }
});

// Get list of production countries with movie counts
router.get('/countries', async (req, res) => {
  try {
    const limit = Math.max(parseInt(req.query.limit, 10) || 12, 1);
    const minMovies = parseInt(req.query.minMovies, 10) || 0;

    const pipeline = [
      {
        $match: {
          isAvailable: true,
          productionCountries: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$productionCountries' },
      {
        $group: {
          _id: {
            isoCode: '$productionCountries.isoCode',
            name: '$productionCountries.name'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          '_id.isoCode': { $nin: [null, '', undefined] },
          '_id.name': { $nin: [null, '', undefined] }
        }
      }
    ];

    if (minMovies > 0) {
      pipeline.push({
        $match: { count: { $gte: minMovies } }
      });
    }

    pipeline.push({ $sort: { count: -1, '_id.name': 1 } });
    pipeline.push({ $limit: limit });

    const results = await Movie.aggregate(pipeline);

    const countries = results.map((item) => ({
      isoCode: item._id.isoCode,
      name: item._id.name,
      movieCount: item.count
    }));

    res.json(countries);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movie countries' });
  }
});

// Get recommended movies based on user preferences
router.get('/recommendations', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;
    const limitNum = parseInt(limit);
    
    // Get user's watched movie IDs and preferred genres using aggregation
    const watchHistoryDocs = await WatchHistory.find({ user: userId })
      .select('movie watchedAt')
      .populate('movie', 'title overview genres releaseDate voteAverage runtime adult')
      .sort({ watchedAt: -1 })
      .limit(50)
      .lean();

    const watchlistDocs = await Watchlist.find({ user: userId })
      .select('movie')
      .populate('movie', 'title overview genres releaseDate voteAverage runtime adult')
      .lean();

    // Extract genres and movie IDs
    const genreFrequency = {};
    const movieIds = new Set();
    
    [...watchHistoryDocs, ...watchlistDocs].forEach(entry => {
      if (entry.movie && entry.movie.genres) {
        entry.movie.genres.forEach(genre => {
          const genreId = genre._id || genre;
          genreFrequency[genreId] = (genreFrequency[genreId] || 0) + 1;
        });
        movieIds.add(entry.movie._id.toString());
      }
    });

    // Get top preferred genres
    const topGenreEntries = Object.entries(genreFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topGenres = topGenreEntries.map(
      ([genreId]) => new mongoose.Types.ObjectId(genreId)
    );

    let topGenreNames = [];
    if (topGenres.length > 0) {
      const genreDocs = await Genre.find({ _id: { $in: topGenres } })
        .select('name')
        .lean();
      const genreNameMap = new Map(
        genreDocs.map((genre) => [genre._id.toString(), genre.name])
      );
      topGenreNames = topGenreEntries
        .map(([genreId]) => genreNameMap.get(genreId) || null)
        .filter(Boolean);
    }

    const movieIdsArray = Array.from(movieIds);
    
    // Find movies with similar genres that user hasn't seen
    let recommendations = [];
    
    if (topGenres.length > 0) {
      recommendations = await Movie.find({
        isAvailable: true,
        genres: { $in: topGenres },
        _id: { $nin: movieIdsArray }
      })
        .select('title posterPath releaseDate voteAverage genres runtime overview streamingUrl vidsrcUrl tmdbId imdbId')
        .populate('genres', 'name')
        .sort({ voteAverage: -1, popularity: -1 })
        .limit(limitNum)
        .lean();
    }

    // If not enough recommendations, add popular movies
    if (recommendations.length < limitNum) {
      const excludeIds = [...movieIdsArray, ...recommendations.map(m => m._id)];
      const popularMovies = await Movie.find({
        isAvailable: true,
        _id: { $nin: excludeIds }
      })
        .select('title posterPath releaseDate voteAverage genres runtime overview streamingUrl vidsrcUrl tmdbId imdbId')
        .populate('genres', 'name')
        .sort({ popularity: -1, voteAverage: -1 })
        .limit(limitNum - recommendations.length)
        .lean();
      
      recommendations.push(...popularMovies);
    }

    let aiMetadata = {
      used: false,
    };

    if (recommendations.length > 0) {
      try {
        const watchHistorySummary = watchHistoryDocs
          .filter((entry) => entry.movie)
          .slice(0, 10)
          .map((entry) => ({
            title: entry.movie.title,
            watchedAt: entry.watchedAt,
            genres: (entry.movie.genres || []).map((genre) =>
              typeof genre === 'string' ? genre : genre?.name || ''
            ),
          }));

        const watchlistSummary = watchlistDocs
          .filter((entry) => entry.movie)
          .slice(0, 10)
          .map((entry) => ({
            title: entry.movie.title,
            genres: (entry.movie.genres || []).map((genre) =>
              typeof genre === 'string' ? genre : genre?.name || ''
            ),
          }));

        const aiResult = await geminiService.generateRecommendations({
          userContext: {
            topGenres: topGenreNames,
            recentHistory: watchHistorySummary,
            watchlist: watchlistSummary,
          },
          candidates: recommendations,
          limit: limitNum,
        });

        if (aiResult.enabled && aiResult.success && Array.isArray(aiResult.recommendations)) {
          const candidateById = new Map();
          const candidateByTmdb = new Map();
          const candidateByTitle = new Map();

          recommendations.forEach((movie) => {
            const id = movie._id?.toString();
            if (id) {
              candidateById.set(id, movie);
            }
            if (movie.tmdbId) {
              candidateByTmdb.set(String(movie.tmdbId), movie);
            }
            if (movie.title) {
              candidateByTitle.set(movie.title.toLowerCase(), movie);
            }
          });

          const ordered = [];
          const usedIds = new Set();

          aiResult.recommendations.forEach((item) => {
            if (!item?.id) return;
            const normalizedId = item.id.toString();
            const normalizedTitle = normalizedId.toLowerCase();
            let movie =
              candidateById.get(normalizedId) ||
              candidateByTmdb.get(normalizedId) ||
              candidateByTitle.get(normalizedTitle);

            if (movie) {
              const movieId = movie._id?.toString();
              if (movieId && usedIds.has(movieId)) {
                return;
              }
              const aiDetails = {
                reason: item.reason || '',
                confidence: item.confidence,
                model: aiResult.model,
                generatedAt: new Date().toISOString(),
                fallback: Boolean(aiResult.fallback),
              };
              movie.aiMetadata = aiDetails;
              ordered.push(movie);
              if (movieId) {
                usedIds.add(movieId);
              }
            }
          });

          const remaining = recommendations.filter((movie) => {
            const movieId = movie._id?.toString();
            return movieId ? !usedIds.has(movieId) : true;
          });

          recommendations = [...ordered, ...remaining].slice(0, limitNum);

          aiMetadata = {
            used: true,
            fallback: Boolean(aiResult.fallback),
            model: aiResult.model,
            timingMs: aiResult.timingMs,
          };
        } else if (aiResult.enabled && !aiResult.success) {
          aiMetadata = {
            used: true,
            fallback: true,
            reason: aiResult.reason || 'unknown_error',
          };
        }
      } catch (aiError) {
        if (aiError.message === 'GEMINI_API_KEY is not configured') {
          aiMetadata = {
            used: false,
            reason: 'missing_api_key',
          };
        } else {
          aiMetadata = {
            used: false,
            reason: 'gemini_error',
          };
        }
      }
    }

    res.json({ movies: recommendations, ai: aiMetadata });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recommendations' });
  }
});

// Get trending movies
// Get trending movies - Hybrid: Fetch from TMDB
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getTrendingMovies(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trending movies' });
  }
});

// Get top-rated movies - Hybrid: Fetch from TMDB
router.get('/top-rated', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getTopRatedMovies(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top-rated movies' });
  }
});

// Get movies by release date range - Uses TMDB release dates
router.get('/by-date-range', async (req, res) => {
  try {
    const { releaseDateGte, releaseDateLte, page = 1, limit = 20, sortBy = 'popularity', order = 'desc' } = req.query;
    
    if (!releaseDateGte && !releaseDateLte) {
      return res.status(400).json({ message: 'At least one date parameter (releaseDateGte or releaseDateLte) is required' });
    }

    const result = await hybridService.getMoviesByDateRange({
      releaseDateGte,
      releaseDateLte,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      order
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movies by date range' });
  }
});

// Get upcoming movies - Hybrid: Fetch from TMDB
router.get('/upcoming', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const cacheKey = hybridService.getCacheKey('upcoming_movies', { page, limit });
    const cached = hybridService.getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const genreMap = await hybridService.getGenreMap();
    const tmdbResponse = await tmdbService.getUpcomingMovies(parseInt(page));
    
    const movies = tmdbResponse.results.map(movie => 
      hybridService.mapMovieFromTMDB(movie, genreMap)
    );

    const result = {
      movies,
      total: tmdbResponse.total_results,
      page: tmdbResponse.page,
      totalPages: tmdbResponse.total_pages,
      hasMore: parseInt(page) < tmdbResponse.total_pages
    };

    hybridService.setCache(cacheKey, result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching upcoming movies' });
  }
});

// Get movies by genre
router.get('/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const movies = await Movie.find({ 
      genres: genreId, 
      isAvailable: true 
    })
      .populate('genres', 'name')
      .sort({ popularity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Movie.countDocuments({ 
      genres: genreId, 
      isAvailable: true 
    });

    res.json({
      movies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movies by genre' });
  }
});

// Search movies
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const movies = await Movie.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { originalTitle: { $regex: query, $options: 'i' } },
        { overview: { $regex: query, $options: 'i' } }
      ],
      isAvailable: true
    })
      .populate('genres', 'name')
      .sort({ popularity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Movie.countDocuments({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { originalTitle: { $regex: query, $options: 'i' } },
        { overview: { $regex: query, $options: 'i' } }
      ],
      isAvailable: true
    });

    res.json({
      movies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Error searching movies' });
  }
});

// Add movie to watchlist - Supports both MongoDB ID and TMDB ID
router.post('/:id/watchlist', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 'plan_to_watch' } = req.body;

    // Check if it's a MongoDB ObjectId or TMDB ID
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let movieId = null;
    let tmdbId = null;

    if (isObjectId) {
      // MongoDB ID - check if movie exists
      const movie = await Movie.findById(id);
      if (!movie) {
        return res.status(404).json({ message: 'Movie not found' });
      }
      movieId = id;
      tmdbId = movie.tmdbId;
    } else {
      // TMDB ID - try to find in database first
      const tmdbIdNum = parseInt(id);
      if (!isNaN(tmdbIdNum)) {
        const movie = await Movie.findOne({ tmdbId: tmdbIdNum });
        if (movie) {
          movieId = movie._id;
        }
        tmdbId = tmdbIdNum;
      } else {
        return res.status(400).json({ message: 'Invalid movie ID' });
      }
    }

    // Check if already in watchlist (by movie reference or tmdbId)
    const existingItem = await Watchlist.findOne({
      user: req.user.id,
      $or: [
        ...(movieId ? [{ movie: movieId }] : []),
        ...(tmdbId ? [{ tmdbId: tmdbId, type: 'movie' }] : [])
      ]
    });

    if (existingItem) {
      return res.status(400).json({ message: 'Movie already in watchlist' });
    }

    const watchlistItem = new Watchlist({
      user: req.user.id,
      ...(movieId ? { movie: movieId } : {}),
      ...(tmdbId ? { tmdbId: tmdbId } : {}),
      type: 'movie',
      status
    });

    await watchlistItem.save();
    if (movieId) {
      await watchlistItem.populate('movie', 'title posterPath releaseDate');
    }

    res.json(watchlistItem);
  } catch (error) {
    
    // Handle duplicate key error (movie already in watchlist)
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Movie already in watchlist' });
    }
    
    res.status(500).json({ message: 'Error adding to watchlist' });
  }
});

// Remove movie from watchlist - Supports both MongoDB ID and TMDB ID
router.delete('/:id/watchlist', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's a MongoDB ObjectId or TMDB ID
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let movieId = null;
    let tmdbId = null;

    if (isObjectId) {
      movieId = id;
    } else {
      const tmdbIdNum = parseInt(id);
      if (!isNaN(tmdbIdNum)) {
        tmdbId = tmdbIdNum;
        // Try to find movie in database
        const movie = await Movie.findOne({ tmdbId: tmdbIdNum });
        if (movie) {
          movieId = movie._id;
        }
      }
    }

    const watchlistItem = await Watchlist.findOneAndDelete({
      user: req.user.id,
      $or: [
        ...(movieId ? [{ movie: movieId }] : []),
        ...(tmdbId ? [{ tmdbId: tmdbId, type: 'movie' }] : [])
      ]
    });

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Movie not in watchlist' });
    }

    res.json({ message: 'Movie removed from watchlist' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from watchlist' });
  }
});

// Update watchlist item
router.put('/:id/watchlist', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rating, review } = req.body;

    const watchlistItem = await Watchlist.findOneAndUpdate(
      { user: req.user.id, movie: id },
      { status, rating, review, watchedAt: status === 'watched' ? new Date() : null },
      { new: true }
    ).populate('movie', 'title posterPath releaseDate');

    if (!watchlistItem) {
      return res.status(404).json({ message: 'Movie not in watchlist' });
    }

    res.json(watchlistItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating watchlist' });
  }
});

// Record watch history
router.post('/:id/watch', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, completed, lastPosition } = req.body;

    const watchHistory = new WatchHistory({
      user: req.user.id,
      movie: id,
      duration,
      completed,
      lastPosition
    });

    await watchHistory.save();
    res.json(watchHistory);
  } catch (error) {
    res.status(500).json({ message: 'Error recording watch history' });
  }
});

// Get similar movies
router.get('/:id/similar', async (req, res) => {
  try {
    // Use hybrid service to get movie (handles both DB and TMDB)
    const movie = await hybridService.getMovieById(req.params.id);
    
    if (!movie || !movie.tmdbId) {
      return res.status(404).json({ message: 'Movie not found or missing TMDB ID' });
    }

    // Fetch similar movies from TMDB
    const axios = require('axios');
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}/similar`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US',
          page: 1
        }
      }
    );

    // Get the first 10 similar movies and find them in our database
    const tmdbMovies = response.data.results.slice(0, 10);
    const similarMovies = [];

    for (const tmdbMovie of tmdbMovies) {
      const dbMovie = await Movie.findOne({ tmdbId: tmdbMovie.id }).populate('genres', 'name');
      if (dbMovie) {
        similarMovies.push({
          _id: dbMovie._id,
          title: dbMovie.title,
          posterPath: dbMovie.posterPath,
          releaseDate: dbMovie.releaseDate,
          voteAverage: dbMovie.voteAverage
        });
      }
    }

    res.json({ movies: similarMovies });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching similar movies', error: error.message });
  }
});

// Get cast and crew for a movie
router.get('/:id/cast', async (req, res) => {
  try {
    // Use hybrid service to get movie (handles both DB and TMDB)
    const movie = await hybridService.getMovieById(req.params.id);
    
    if (!movie || !movie.tmdbId) {
      return res.status(404).json({ message: 'Movie not found or missing TMDB ID' });
    }

    // Fetch cast from TMDB
    const axios = require('axios');
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}/credits`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US'
        }
      }
    );

    const { cast = [], crew = [] } = response.data;

    // Get top cast (first 20) and key crew
    const topCast = cast.slice(0, 20).map(actor => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
      profilePath: actor.profile_path,
      order: actor.order
    }));

    // Get key crew members (director, writer, producer, etc.)
    const keyCrew = crew
      .filter(person => 
        ['Director', 'Writer', 'Producer', 'Executive Producer', 'Screenplay'].includes(person.job)
      )
      .map(person => ({
        id: person.id,
        name: person.name,
        job: person.job,
        profilePath: person.profile_path
      }));

    res.json({ cast: topCast, crew: keyCrew });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cast', error: error.message });
  }
});

// Get images for a movie
router.get('/:id/images', async (req, res) => {
  try {
    // Use hybrid service to get movie (handles both DB and TMDB)
    const movie = await hybridService.getMovieById(req.params.id);
    
    if (!movie || !movie.tmdbId) {
      return res.status(404).json({ message: 'Movie not found or missing TMDB ID' });
    }

    // Fetch images from TMDB
    const axios = require('axios');
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}/images`,
      {
        params: {
          api_key: tmdbApiKey
        }
      }
    );

    const images = response.data;
    
    // Extract and categorize images
    const backdrops = (images.backdrops || []).map(img => ({
      filePath: img.file_path,
      aspectRatio: img.aspect_ratio,
      height: img.height,
      width: img.width,
      voteAverage: img.vote_average,
      voteCount: img.vote_count
    }));

    const posters = (images.posters || []).map(img => ({
      filePath: img.file_path,
      aspectRatio: img.aspect_ratio,
      height: img.height,
      width: img.width,
      voteAverage: img.vote_average,
      voteCount: img.vote_count
    }));

    res.json({
      backdrops,
      posters
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching images', error: error.message });
  }
});

// Get trailers/videos for a movie
router.get('/:id/videos', async (req, res) => {
  try {
    // Use hybrid service to get movie (handles both DB and TMDB)
    const movie = await hybridService.getMovieById(req.params.id);
    
    if (!movie || !movie.tmdbId) {
      return res.status(404).json({ message: 'Movie not found or missing TMDB ID' });
    }

    // Fetch videos from TMDB
    const axios = require('axios');
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const response = await axios.get(
      `https://api.themoviedb.org/3/movie/${movie.tmdbId}/videos`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US'
        }
      }
    );

    const videos = response.data.results || [];
    
    // Filter and categorize videos
    const trailers = videos.filter(v => v.type === 'Trailer' && v.site === 'YouTube');
    const teasers = videos.filter(v => v.type === 'Teaser' && v.site === 'YouTube');
    const clips = videos.filter(v => v.type === 'Clip' && v.site === 'YouTube');
    const featurettes = videos.filter(v => v.type === 'Featurette' && v.site === 'YouTube');
    const behindTheScenes = videos.filter(v => v.type === 'Behind the Scenes' && v.site === 'YouTube');

    res.json({
      trailers,
      teasers,
      clips,
      featurettes,
      behindTheScenes
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching videos', error: error.message });
  }
});

// Get reviews for a movie
router.get('/:id/reviews', async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'recent' } = req.query;
    const skip = (page - 1) * limit;

    // Use hybrid service to get movie (handles both DB and TMDB)
    const movie = await hybridService.getMovieById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }
    
    // Get movieId - use _id if it exists, otherwise try to find in DB by tmdbId
    let movieId = movie._id;
    if (!movieId && movie.tmdbId) {
      const dbMovie = await Movie.findOne({ tmdbId: movie.tmdbId });
      if (dbMovie) {
        movieId = dbMovie._id;
      } else {
        // Movie not in DB, return empty reviews
        return res.json({
          reviews: [],
          stats: {
            totalReviews: 0,
            averageRating: null,
            totalRatings: 0
          }
        });
      }
    }
    
    if (!movieId) {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }

    // Get all watchlist items with reviews for this movie
    let reviews = await Watchlist.find({
      movie: movieId,
      review: { $exists: true, $ne: '' }
    })
      .populate('user', 'username email createdAt')
      .sort(sortBy === 'recent' ? { addedAt: -1 } : { rating: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    const total = await Watchlist.countDocuments({
      movie: movieId,
      review: { $exists: true, $ne: '' }
    });

    // Get aggregated stats
    const stats = await Watchlist.aggregate([
      {
        $match: {
          movie: new mongoose.Types.ObjectId(movieId),
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (stats[0] && stats[0].ratingDistribution) {
      stats[0].ratingDistribution.forEach(rating => {
        if (rating >= 5) ratingDistribution[5]++;
        else if (rating >= 4) ratingDistribution[4]++;
        else if (rating >= 3) ratingDistribution[3]++;
        else if (rating >= 2) ratingDistribution[2]++;
        else ratingDistribution[1]++;
      });
    }

    res.json({
      reviews: reviews.map(item => ({
        _id: item._id,
        user: {
          username: item.user.username,
          createdAt: item.user.createdAt
        },
        rating: item.rating,
        review: item.review,
        addedAt: item.addedAt
      })),
      stats: {
        totalReviews: total,
        averageRating: stats[0]?.averageRating || 0,
        ratingDistribution,
        totalRatings: stats[0]?.totalRatings || 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews', error: error.message });
  }
});

// Get watch providers list (must be before /:id route)
router.get('/watch-providers', async (req, res) => {
  try {
    const region = (req.query.region || 'US').toString().toUpperCase();
    const providers = await tmdbService.getWatchProviders('movie', region);
    // Filter to only show popular streaming services
    const popularProviders = [
      8,    // Netflix
      9,    // Amazon Prime Video
      337,  // Disney+
      350,  // Apple TV+
      531,  // Paramount+
      283,  // Crunchyroll
      384,  // HBO Max
      521,  // Showtime
      386,  // Starz
      68,   // Microsoft Store
      15,   // Hulu
      1899  // Max
    ];
    
    const filteredProviders = (providers.results || []).filter(p => popularProviders.includes(p.provider_id));
    res.json({ providers: filteredProviders, region });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching watch providers' });
  }
});

router.get('/watch-providers/regions', async (req, res) => {
  try {
    const regionsResponse = await tmdbService.getWatchProviderRegions();
    const regions = (regionsResponse?.results || []).sort((a, b) =>
      a.english_name.localeCompare(b.english_name)
    );
    res.json({ regions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching watch provider regions' });
  }
});

// Get movie by ID (must be last to avoid conflicts with specific routes)
// Get movie by ID - Hybrid: Try database first, then TMDB
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || id === 'undefined') {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }

    const movie = await hybridService.getMovieById(id);
    
    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json(movie);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching movie' });
  }
});

module.exports = router;
