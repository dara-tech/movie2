const express = require('express');
const router = express.Router();
const axios = require('axios');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const WatchHistory = require('../models/WatchHistory');
const auth = require('../middleware/auth');
const tmdbService = require('../services/tmdbService');
const hybridService = require('../services/hybridService');

const tmdbApiKey = process.env.TMDB_API_KEY;

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

/**
 * Resolve TMDB series id from a route :id (Mongo id, tmdb_*, or numeric TMDB id).
 * DB lookup only — no TMDB HTTP — so routes like /videos and /episodes do not repeat
 * getTvShowDetails when the client already called GET /api/tvshows/:id.
 */
async function resolveTvShowTmdbId(id) {
  const s = String(id);
  if (/^[0-9a-fA-F]{24}$/.test(s)) {
    const doc = await TvShow.findById(s).select('tmdbId').lean();
    const tid = doc?.tmdbId;
    return tid != null && Number.isFinite(Number(tid)) ? Number(tid) : null;
  }
  if (s.toLowerCase().startsWith('tmdb_')) {
    const n = parseInt(s.replace(/^tmdb_/i, ''), 10);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  const doc = await TvShow.findOne({ tmdbId: n }).select('tmdbId').lean();
  if (doc?.tmdbId != null) return Number(doc.tmdbId);
  return n;
}

// Cache helper functions
const getCacheKey = (req) => {
  const { page, limit, genre, year, sortBy, order, search, minRating, status, type, provider, country } = req.query;
  return `tvshows:${JSON.stringify({ page, limit, genre, year, sortBy, order, search, minRating, status, type, provider, country })}`;
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

const mapTmdbTvShowResult = (show) => ({
  _id: show.id ? show.id.toString() : undefined,
  tmdbId: show.id,
  name: show.name,
  originalName: show.original_name,
  overview: show.overview,
  posterPath: show.poster_path,
  backdropPath: show.backdrop_path,
  firstAirDate: show.first_air_date,
  voteAverage: show.vote_average,
  popularity: show.popularity,
  numberOfSeasons: show.number_of_seasons,
  genres: (show.genre_ids || []).map((id) => ({ _id: id })),
  productionCountries: (show.origin_country || []).map((code) => ({ isoCode: code }))
});

// Get all TV shows with pagination and filtering
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
      status,
      type,
      provider, // Streaming service provider ID
      country
    } = req.query;

    const countries = Array.isArray(country) ? country : (country ? [country] : []);
    const normalizedCountries = countries
      .map((code) => (typeof code === 'string' ? code.trim().toUpperCase() : null))
      .filter(Boolean);

    if (normalizedCountries.length > 0) {
      const originCountry = normalizedCountries[0];
      const tmdbOrder = order === 'asc' ? 'asc' : 'desc';
      const discoverResponse = await tmdbService.discoverTvShows({
        page: parseInt(page, 10) || 1,
        originCountry,
        sortBy,
        order: tmdbOrder
      });

      const tvShows = (discoverResponse.results || []).map(mapTmdbTvShowResult);
      const response = {
        tvShows,
        total: discoverResponse.total_results,
        page: discoverResponse.page,
        totalPages: discoverResponse.total_pages,
        hasMore: discoverResponse.page < discoverResponse.total_pages
      };

      setCachedData(cacheKey, response);
      return res.json(response);
    }

    // Handle multiple genre parameters
    const genreParams = Array.isArray(genre) ? genre : (genre ? [genre] : []);

    const query = { isAvailable: true };

    if (genreParams.length > 0) {
      // Find genre by name or ID
      const mongoose = require('mongoose');
      const genreIds = [];
      
      for (const genreParam of genreParams) {
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

    if (year && year !== 'all') {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      query.firstAirDate = { $gte: startDate, $lte: endDate };
    }
    
    // Add rating filter
    if (minRating) {
      query.voteAverage = { $gte: parseFloat(minRating) };
    }

    // Add status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add type filter
    if (type && type !== 'all') {
      query.type = type;
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

    // Add search filter
    const searchFilter = [];
    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      searchFilter.push(
        { name: searchRegex },
        { originalName: searchRegex },
        { overview: searchRegex },
        { 'genres.name': searchRegex }
      );
    }

    // Combine filters correctly
    if (providerFilter.length > 0 && searchFilter.length > 0) {
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

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tvShows, total] = await Promise.all([
      TvShow.find(query)
        .populate('genres', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TvShow.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    const response = {
      tvShows,
      total,
      page: parseInt(page),
      totalPages,
      hasMore: parseInt(page) < totalPages
    };

    // Cache the response
    setCachedData(cacheKey, response);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching TV shows' });
  }
});

// Get popular TV shows - Hybrid: Fetch from TMDB
router.get('/popular', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getPopularTvShows(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching popular TV shows' });
  }
});

// Get top-rated TV shows - Hybrid: Fetch from TMDB
router.get('/top-rated', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getTopRatedTvShows(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching top-rated TV shows' });
  }
});

// Get trending TV shows - Hybrid: Fetch from TMDB
router.get('/trending', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const result = await hybridService.getTrendingTvShows(parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching trending TV shows' });
  }
});

// Get TV shows by genre
router.get('/genre/:genreId', async (req, res) => {
  try {
    const { genreId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tvShows, total] = await Promise.all([
      TvShow.find({ 
        isAvailable: true, 
        genres: genreId 
      })
        .populate('genres', 'name')
        .sort({ popularity: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TvShow.countDocuments({ 
        isAvailable: true, 
        genres: genreId 
      })
    ]);

    res.json({
      tvShows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching TV shows by genre' });
  }
});

// Get watch providers list (must be before /:id route)
router.get('/watch-providers', async (req, res) => {
  try {
    const region = (req.query.region || 'US').toString().toUpperCase();
    const providers = await tmdbService.getWatchProviders('tv', region);
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

// Get cast and crew for a TV show
router.get('/:id/cast', async (req, res) => {
  try {
    const tmdbId = await resolveTvShowTmdbId(req.params.id);

    if (!tmdbId) {
      return res.status(404).json({ message: 'TV show not found or missing TMDB ID' });
    }

    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}/credits`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US'
        }
      }
    );

    const { cast = [], crew = [] } = response.data;

    const topCast = cast.slice(0, 20).map((actor) => ({
      id: actor.id,
      name: actor.name,
      character: actor.character,
      profilePath: actor.profile_path,
      order: actor.order
    }));

    const keyCrew = crew
      .filter((person) =>
        ['Creator', 'Executive Producer', 'Producer', 'Director', 'Writer', 'Screenplay'].includes(person.job)
      )
      .map((person) => ({
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

// Get similar TV shows
router.get('/:id/similar', async (req, res) => {
  try {
    const tmdbId = await resolveTvShowTmdbId(req.params.id);

    if (!tmdbId) {
      return res.status(404).json({ message: 'TV show not found or missing TMDB ID' });
    }

    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}/similar`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US',
          page: 1
        }
      }
    );

    const tmdbShows = response.data.results.slice(0, 10);
    const similarShows = [];

    for (const similar of tmdbShows) {
      const existingShow = await TvShow.findOne({ tmdbId: similar.id }).select('_id');
      similarShows.push({
        _id: existingShow ? existingShow._id : `tmdb_${similar.id}`,
        tmdbId: similar.id,
        name: similar.name,
        posterPath: similar.poster_path,
        firstAirDate: similar.first_air_date,
        voteAverage: similar.vote_average || 0
      });
    }

    res.json({ tvShows: similarShows });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching similar TV shows', error: error.message });
  }
});

// Get images for a TV show
router.get('/:id/images', async (req, res) => {
  try {
    const tmdbId = await resolveTvShowTmdbId(req.params.id);

    if (!tmdbId) {
      return res.status(404).json({ message: 'TV show not found or missing TMDB ID' });
    }

    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}/images`,
      {
        params: {
          api_key: tmdbApiKey
        }
      }
    );

    const images = response.data || {};

    const backdrops = (images.backdrops || []).map((img) => ({
      filePath: img.file_path,
      aspectRatio: img.aspect_ratio,
      height: img.height,
      width: img.width,
      voteAverage: img.vote_average,
      voteCount: img.vote_count
    }));

    const posters = (images.posters || []).map((img) => ({
      filePath: img.file_path,
      aspectRatio: img.aspect_ratio,
      height: img.height,
      width: img.width,
      voteAverage: img.vote_average,
      voteCount: img.vote_count
    }));

    res.json({ backdrops, posters });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching images', error: error.message });
  }
});

// Get videos for a TV show
router.get('/:id/videos', async (req, res) => {
  try {
    const tmdbId = await resolveTvShowTmdbId(req.params.id);

    if (!tmdbId) {
      return res.status(404).json({ message: 'TV show not found or missing TMDB ID' });
    }

    const response = await axios.get(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US'
        }
      }
    );

    const videos = response.data.results || [];

    res.json({
      trailers: videos.filter((v) => v.type === 'Trailer' && v.site === 'YouTube'),
      teasers: videos.filter((v) => v.type === 'Teaser' && v.site === 'YouTube'),
      clips: videos.filter((v) => v.type === 'Clip' && v.site === 'YouTube'),
      behindTheScenes: videos.filter((v) => v.type === 'Behind the Scenes' && v.site === 'YouTube'),
      featurettes: videos.filter((v) => v.type === 'Featurette' && v.site === 'YouTube')
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching videos', error: error.message });
  }
});

// Get single TV show by ID
// Get single TV show by ID - Hybrid: Try database first, then TMDB
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const tvShow = await hybridService.getTvShowById(id);

    if (!tvShow) {
      return res.status(404).json({ message: 'TV show not found' });
    }

    // Always fetch fresh seasons from TMDB to ensure we have the latest data (including new seasons)
    if (tvShow.tmdbId) {
      try {
        const tmdbDetails = await tmdbService.getTvShowDetails(tvShow.tmdbId);
        if (tmdbDetails.seasons && tmdbDetails.seasons.length > 0) {
          // Map TMDB seasons format to our database format
          tvShow.seasons = tmdbDetails.seasons.map(season => {
            // Handle case where season_number is 0 but name suggests it's actually season 1
            let seasonNumber = season.season_number;
            if (seasonNumber === 0 && (
              season.name && (
                season.name.toLowerCase().includes('season 1') || 
                season.name.toLowerCase().includes('season one') ||
                season.name.match(/^season\s*1$/i)
              )
            )) {
              seasonNumber = 1;
            }
            
            return {
              airDate: season.air_date ? (typeof season.air_date === 'string' ? new Date(season.air_date) : season.air_date) : null,
              episodeCount: season.episode_count || 0,
              id: season.id,
              name: season.name || `Season ${seasonNumber}`,
              overview: season.overview || '',
              posterPath: season.poster_path || null,
              seasonNumber: seasonNumber,
              voteAverage: season.vote_average || 0
            };
          });
          
          // Update the TV show in database with seasons
          tvShow.numberOfSeasons = tmdbDetails.number_of_seasons || tvShow.seasons.length;
          tvShow.numberOfEpisodes = tmdbDetails.number_of_episodes || 0;
          
          // Save to database for future use
          await TvShow.findByIdAndUpdate(tvShow._id, {
            seasons: tvShow.seasons,
            numberOfSeasons: tvShow.numberOfSeasons,
            numberOfEpisodes: tvShow.numberOfEpisodes
          });
          
        }
      } catch (error) {
        // If TMDB fetch fails, use database seasons as fallback
        if (!tvShow.seasons || tvShow.seasons.length === 0) {
          // Only log error if we have no seasons at all
          console.error('Failed to fetch seasons from TMDB:', error.message);
        }
      }
    }

    // Fix seasons and fetch episode data if needed
    if (tvShow.seasons && tvShow.seasons.length > 0) {
      // Fix season numbers if they're incorrectly set to 0 when they should be 1
      let needsUpdate = false;
      tvShow.seasons = tvShow.seasons.map((season, index) => {
        let seasonNumber = (season.seasonNumber != null && season.seasonNumber !== undefined) 
          ? season.seasonNumber 
          : index;
        
        // Fix season 0 that should be season 1
        if (seasonNumber === 0 && season.name && (
          season.name.toLowerCase().includes('season 1') || 
          season.name.toLowerCase().includes('season one') ||
          season.name.match(/^season\s*1$/i)
        )) {
          seasonNumber = 1;
          needsUpdate = true;
        }
        
        return {
          ...season,
          seasonNumber: seasonNumber
        };
      });
      
      // Update database if we fixed season numbers
      if (needsUpdate) {
        await TvShow.findByIdAndUpdate(tvShow._id, { seasons: tvShow.seasons });
      }
      
      // Fetch season details from TMDB to get real episode counts
      const seasonsWithEpisodes = await Promise.all(
        tvShow.seasons.map(async (season, index) => {
          const seasonNumber = season.seasonNumber;
          
          let episodeCount = season.episodeCount || 0;
          
          // If episodeCount is 0 or undefined, try to fetch from TMDB
          // For Season 0, try fetching from season 1 if the name suggests it's actually season 1
          if ((!episodeCount || episodeCount === 0) && tvShow.tmdbId) {
            let tmdbSeasonToFetch = seasonNumber;
            
            // If season is 0 but name is "Season 1", try fetching from season 1
            if (seasonNumber === 0 && (
              season.name.toLowerCase().includes('season 1') || 
              season.name.toLowerCase().includes('season one')
            )) {
              tmdbSeasonToFetch = 1;
            }
            
            if (seasonNumber > 0 || tmdbSeasonToFetch === 1) {
              try {
                const tmdbSeasonData = await tmdbService.getTvShowEpisodes(tvShow.tmdbId, tmdbSeasonToFetch);
                episodeCount = tmdbSeasonData.episodes ? tmdbSeasonData.episodes.length : 0;
              } catch (error) {
                // Silently fail if TMDB doesn't have the season data
              }
            }
          }
          
          return {
            airDate: season.airDate,
            episodeCount: episodeCount,
            id: season.id,
            name: season.name,
            overview: season.overview,
            posterPath: season.posterPath,
            seasonNumber: seasonNumber,
            voteAverage: season.voteAverage
          };
        })
      );
      
      tvShow.seasons = seasonsWithEpisodes;
    }

    res.json(tvShow);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching TV show' });
  }
});

// Get TV show seasons
router.get('/:id/seasons', async (req, res) => {
  try {
    const { id } = req.params;

    const tvShow = await hybridService.getTvShowById(id);

    if (!tvShow) {
      return res.status(404).json({ message: 'TV show not found' });
    }

    res.json({
      seasons: tvShow.seasons,
      numberOfSeasons: tvShow.numberOfSeasons,
      numberOfEpisodes: tvShow.numberOfEpisodes
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching TV show seasons' });
  }
});

// Get detailed episodes for a specific season (includes still images from TMDB)
router.get('/:id/season/:seasonNumber/episodes', async (req, res) => {
  try {
    const { id, seasonNumber } = req.params;

    const tmdbId = await resolveTvShowTmdbId(id);

    if (!tmdbId) {
      return res.status(404).json({ message: 'TV show not found' });
    }

    const tmdbSeasonData = await tmdbService.getTvShowEpisodes(
      tmdbId,
      parseInt(seasonNumber, 10)
    );

    const episodes =
      tmdbSeasonData?.episodes?.map((ep) => ({
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        stillPath: ep.still_path,
        runtime: ep.runtime,
        airDate: ep.air_date,
      })) || [];

    res.json({
      seasonNumber: parseInt(seasonNumber, 10),
      episodes,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching TV show episodes' });
  }
});

// Get TV show status options
router.get('/meta/statuses', (req, res) => {
  res.json([
    { value: 'all', label: 'All Status' },
    { value: 'Returning Series', label: 'Returning Series' },
    { value: 'Planned', label: 'Planned' },
    { value: 'In Production', label: 'In Production' },
    { value: 'Ended', label: 'Ended' },
    { value: 'Canceled', label: 'Canceled' },
    { value: 'Pilot', label: 'Pilot' }
  ]);
});

// Get TV show type options
router.get('/meta/types', (req, res) => {
  res.json([
    { value: 'all', label: 'All Types' },
    { value: 'Scripted', label: 'Scripted' },
    { value: 'Reality', label: 'Reality' },
    { value: 'Documentary', label: 'Documentary' },
    { value: 'News', label: 'News' },
    { value: 'Talk Show', label: 'Talk Show' },
    { value: 'Miniseries', label: 'Miniseries' }
  ]);
});

// Record TV show watch history
router.post('/:id/watch', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, completed, lastPosition, season, episode } = req.body;

    // Find or create watch history entry
    let watchHistory = await WatchHistory.findOne({ 
      user: req.user.id, 
      tvShow: id,
      season: season || 1,
      episode: episode || 1
    });

    if (watchHistory) {
      // Update existing entry
      watchHistory.duration = duration;
      watchHistory.completed = completed;
      watchHistory.lastPosition = lastPosition;
      watchHistory.watchedAt = new Date();
      await watchHistory.save();
    } else {
      // Create new entry
      watchHistory = new WatchHistory({
        user: req.user.id,
        tvShow: id,
        duration,
        completed,
        lastPosition,
        season: season || 1,
        episode: episode || 1
      });
      await watchHistory.save();
    }

    res.json(watchHistory);
  } catch (error) {
    res.status(500).json({ message: 'Error recording TV show watch history' });
  }
});

module.exports = router;
