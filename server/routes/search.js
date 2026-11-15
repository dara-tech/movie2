const express = require('express');
const router = express.Router();
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const tmdbService = require('../services/tmdbService');
const hybridService = require('../services/hybridService');
const logger = require('../utils/logger');

// Lightweight in-memory caches
const suggestionCache = new Map();
const SUGGESTION_TTL = 10 * 60 * 1000; // 10 minutes

let trendingCache = null;
let trendingCacheTime = 0;
const TRENDING_TTL = 30 * 60 * 1000; // 30 minutes

// Helper to manage cache size
const setSuggestionCache = (key, data) => {
  if (suggestionCache.size > 300) {
    const oldestKey = suggestionCache.keys().next().value;
    if (oldestKey) suggestionCache.delete(oldestKey);
  }
  suggestionCache.set(key, { data, time: Date.now() });
};

// Get search suggestions - Hybrid: Local MongoDB + Global TMDB Multi-Search
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json({ suggestions: [] });
    }

    const trimmed = q.trim();
    const cacheKey = trimmed.toLowerCase();

    // Check suggestion cache
    const cached = suggestionCache.get(cacheKey);
    if (cached && Date.now() - cached.time < SUGGESTION_TTL) {
      return res.json({ suggestions: cached.data });
    }

    const searchRegex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Run local and TMDB queries in parallel
    const [localMovies, localTvShows, localGenres, tmdbMulti] = await Promise.all([
      // Local movies
      Movie.find({
        $or: [{ title: searchRegex }, { originalTitle: searchRegex }],
        isAvailable: true
      })
        .select('title originalTitle posterPath tmdbId')
        .limit(3)
        .lean()
        .exec()
        .catch(() => []),

      // Local TV shows
      TvShow.find({
        $or: [{ name: searchRegex }, { originalName: searchRegex }],
        isAvailable: true
      })
        .select('name originalName posterPath tmdbId')
        .limit(3)
        .lean()
        .exec()
        .catch(() => []),

      // Local genres
      Genre.find({ name: searchRegex })
        .select('name')
        .limit(2)
        .lean()
        .exec()
        .catch(() => []),

      // Global TMDB multi search (movies + tv shows)
      tmdbService.searchMulti(trimmed, 1).catch((err) => {
        logger.warn(`TMDB multi search fallback: ${err.message}`);
        return null;
      })
    ]);

    const suggestions = [];
    const seenTitles = new Set();

    // 1. Add local movies
    localMovies.forEach(movie => {
      const lower = movie.title.toLowerCase();
      if (!seenTitles.has(lower)) {
        seenTitles.add(lower);
        suggestions.push({
          type: 'movie',
          text: movie.title,
          value: movie.title,
          posterPath: movie.posterPath || null
        });
      }
    });

    // 2. Add local TV shows
    localTvShows.forEach(tvShow => {
      const lower = tvShow.name.toLowerCase();
      if (!seenTitles.has(lower)) {
        seenTitles.add(lower);
        suggestions.push({
          type: 'tvshow',
          text: tvShow.name,
          value: tvShow.name,
          posterPath: tvShow.posterPath || null
        });
      }
    });

    // 3. Add global TMDB results
    if (tmdbMulti && Array.isArray(tmdbMulti.results)) {
      for (const item of tmdbMulti.results) {
        if (suggestions.length >= 8) break;

        if (item.media_type === 'movie' && item.title) {
          const lower = item.title.toLowerCase();
          if (!seenTitles.has(lower)) {
            seenTitles.add(lower);
            suggestions.push({
              type: 'movie',
              text: item.title,
              value: item.title,
              posterPath: item.poster_path || null
            });
          }
        } else if (item.media_type === 'tv' && item.name) {
          const lower = item.name.toLowerCase();
          if (!seenTitles.has(lower)) {
            seenTitles.add(lower);
            suggestions.push({
              type: 'tvshow',
              text: item.name,
              value: item.name,
              posterPath: item.poster_path || null
            });
          }
        }
      }
    }

    // 4. Add genre suggestions if room
    localGenres.forEach(genre => {
      if (suggestions.length < 8) {
        suggestions.push({
          type: 'genre',
          text: genre.name,
          value: genre.name
        });
      }
    });

    const finalSuggestions = suggestions.slice(0, 8);
    setSuggestionCache(cacheKey, finalSuggestions);

    res.json({ suggestions: finalSuggestions });
  } catch (error) {
    logger.error('Error fetching suggestions:', error);
    res.status(500).json({ message: 'Error fetching suggestions' });
  }
});

// Get trending search terms - Global TMDB Trending + Popular genres
router.get('/trending', async (req, res) => {
  try {
    if (trendingCache && Date.now() - trendingCacheTime < TRENDING_TTL) {
      return res.json({ trending: trendingCache });
    }

    const [popularGenres, trendingMovies, trendingTvShows] = await Promise.all([
      Genre.find({}).select('name').limit(4).lean().exec().catch(() => []),
      tmdbService.getTrendingMovies(1).catch(() => ({ results: [] })),
      tmdbService.getTrendingTvShows(1).catch(() => ({ results: [] }))
    ]);

    const trending = [];

    // Add popular genres
    popularGenres.forEach(genre => {
      trending.push({
        type: 'genre',
        text: genre.name,
        value: genre.name
      });
    });

    // Add top trending movies
    const topMovies = (trendingMovies?.results || []).slice(0, 4);
    topMovies.forEach(movie => {
      if (movie.title) {
        trending.push({
          type: 'movie',
          text: movie.title,
          value: movie.title,
          posterPath: movie.poster_path || null
        });
      }
    });

    // Add top trending TV shows
    const topTvShows = (trendingTvShows?.results || []).slice(0, 4);
    topTvShows.forEach(tvShow => {
      if (tvShow.name) {
        trending.push({
          type: 'tvshow',
          text: tvShow.name,
          value: tvShow.name,
          posterPath: tvShow.poster_path || null
        });
      }
    });

    trendingCache = trending;
    trendingCacheTime = Date.now();

    res.json({ trending });
  } catch (error) {
    logger.error('Error fetching trending searches:', error);
    res.status(500).json({ message: 'Error fetching trending searches' });
  }
});

// Main search endpoint - Hybrid: Local MongoDB matches + Global TMDB Catalog
router.get('/', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    
    if (!q || q.trim().length < 1) {
      return res.json({
        movies: [],
        tvShows: [],
        totalPages: 0,
        currentPage: 1,
        total: 0
      });
    }

    const trimmedQuery = q.trim();

    // Query local DB and TMDB simultaneously
    const searchRegex = new RegExp(trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [localMovies, localTvShows, movieResults, tvShowResults] = await Promise.all([
      pageNum === 1
        ? Movie.find({
            $or: [{ title: searchRegex }, { originalTitle: searchRegex }],
            isAvailable: true
          })
            .populate('genres', 'name')
            .limit(10)
            .lean()
            .exec()
            .catch(() => [])
        : Promise.resolve([]),

      pageNum === 1
        ? TvShow.find({
            $or: [{ name: searchRegex }, { originalName: searchRegex }],
            isAvailable: true
          })
            .populate('genres', 'name')
            .limit(10)
            .lean()
            .exec()
            .catch(() => [])
        : Promise.resolve([]),

      hybridService.searchMovies(trimmedQuery, pageNum).catch((err) => {
        logger.error(`Error searching movies in TMDB: ${err.message}`);
        return { movies: [], total: 0, totalPages: 0 };
      }),

      hybridService.searchTvShows(trimmedQuery, pageNum).catch((err) => {
        logger.error(`Error searching TV shows in TMDB: ${err.message}`);
        return { tvShows: [], total: 0, totalPages: 0 };
      })
    ]);

    // Merge movies: Prioritize local if present, deduplicate against TMDB
    const seenMovieTmdbIds = new Set();
    const seenMovieTitles = new Set();
    const mergedMovies = [];

    localMovies.forEach(movie => {
      if (movie.tmdbId) seenMovieTmdbIds.add(movie.tmdbId);
      seenMovieTitles.add(movie.title.toLowerCase());
      mergedMovies.push(movie);
    });

    (movieResults.movies || []).forEach(movie => {
      const isDuplicate = 
        (movie.tmdbId && seenMovieTmdbIds.has(movie.tmdbId)) ||
        (movie.title && seenMovieTitles.has(movie.title.toLowerCase()));

      if (!isDuplicate) {
        if (movie.tmdbId) seenMovieTmdbIds.add(movie.tmdbId);
        if (movie.title) seenMovieTitles.add(movie.title.toLowerCase());
        mergedMovies.push(movie);
      }
    });

    // Merge TV shows: Prioritize local if present, deduplicate against TMDB
    const seenTvTmdbIds = new Set();
    const seenTvNames = new Set();
    const mergedTvShows = [];

    localTvShows.forEach(tvShow => {
      if (tvShow.tmdbId) seenTvTmdbIds.add(tvShow.tmdbId);
      seenTvNames.add(tvShow.name.toLowerCase());
      mergedTvShows.push(tvShow);
    });

    (tvShowResults.tvShows || []).forEach(tvShow => {
      const isDuplicate = 
        (tvShow.tmdbId && seenTvTmdbIds.has(tvShow.tmdbId)) ||
        (tvShow.name && seenTvNames.has(tvShow.name.toLowerCase()));

      if (!isDuplicate) {
        if (tvShow.tmdbId) seenTvTmdbIds.add(tvShow.tmdbId);
        if (tvShow.name) seenTvNames.add(tvShow.name.toLowerCase());
        mergedTvShows.push(tvShow);
      }
    });

    const total = (movieResults.total || 0) + (tvShowResults.total || 0) + localMovies.length + localTvShows.length;
    const totalPages = Math.max(movieResults.totalPages || 0, tvShowResults.totalPages || 0, 1);

    res.json({
      movies: mergedMovies,
      tvShows: mergedTvShows,
      totalPages,
      currentPage: pageNum,
      total
    });
  } catch (error) {
    logger.error('Error in main search route:', error);
    res.status(500).json({ message: 'Error searching movies' });
  }
});

module.exports = router;
