const express = require('express');
const router = express.Router();
const { requireAdmin, requireSuperAdmin, requirePermission } = require('../middleware/adminAuth');
const { createActivityLogger } = require('../middleware/activityLogger');
const mongoose = require('mongoose');
const User = require('../models/User');
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');
const Genre = require('../models/Genre');
const Watchlist = require('../models/Watchlist');
const WatchHistory = require('../models/WatchHistory');
const AdminActivity = require('../models/AdminActivity');
const AiConfig = require('../models/AiConfig');
const AiAuditLog = require('../models/AiAuditLog');
const AiFeedback = require('../models/AiFeedback');
const AiConversation = require('../models/AiConversation');
const { invalidateConfigCache } = require('../services/geminiService');
const tmdbService = require('../services/tmdbService');
const logger = require('../utils/logger');

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const mergeSubdocument = (current, incoming) => {
  const currentPlain =
    current && typeof current.toObject === 'function'
      ? current.toObject()
      : current || {};
  return { ...currentPlain, ...incoming };
};

const ensureAiConfig = async () => {
  let config = await AiConfig.findOne();
  if (!config) {
    config = await AiConfig.create({});
  }
  return config;
};

// Apply admin middleware to all routes
router.use(requireAdmin);

// ==================== DASHBOARD & ANALYTICS ====================

// Get admin dashboard statistics - Updated for Hybrid System
router.get('/dashboard/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      cachedMovies,
      cachedTvShows,
      totalWatchlists,
      totalWatchHistory,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Movie.countDocuments(),
      TvShow.countDocuments(),
      Watchlist.countDocuments(),
      WatchHistory.countDocuments(),
      User.find({ isActive: true })
        .sort({ lastLogin: -1 })
        .limit(5)
        .select('username email lastLogin createdAt')
    ]);

    // TMDB catalog totals (not MongoDB sync counts)
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth();
    const releaseStart = `${y}-${pad(mo + 1)}-01`;
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const releaseEnd = `${y}-${pad(mo + 1)}-${pad(lastDay)}`;

    let moviesTotal = cachedMovies;
    let tvShowsTotal = cachedTvShows;
    let newMoviesThisMonth = 0;
    try {
      const [tmdbMovies, tmdbTv, tmdbNewMonth] = await Promise.all([
        tmdbService.getDiscoverTotalResults('movie'),
        tmdbService.getDiscoverTotalResults('tv'),
        tmdbService.getDiscoverMovieCountByReleaseRange(releaseStart, releaseEnd)
      ]);
      moviesTotal = tmdbMovies;
      tvShowsTotal = tmdbTv;
      newMoviesThisMonth = tmdbNewMonth;
    } catch (err) {
      logger.warn('Admin dashboard: TMDB totals failed, falling back to DB counts', err.message || err);
      newMoviesThisMonth = await Movie.countDocuments({
        createdAt: { $gte: new Date(y, mo, 1) }
      });
    }

    // Calculate growth metrics
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: lastMonth }
    });

    // Top titles by watchlist saves (real platform demand — not TMDB popularity scores)
    const [popularWatchlistItems, popularTvWatchlistItems] = await Promise.all([
      Watchlist.aggregate([
        { $match: { type: 'movie' } },
        {
          $group: {
            _id: {
              movie: '$movie',
              tmdbId: '$tmdbId',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'movies',
            localField: '_id.movie',
            foreignField: '_id',
            as: 'movie',
          },
        },
        { $unwind: { path: '$movie', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            title: '$movie.title',
            posterPath: '$movie.posterPath',
            tmdbId: {
              $ifNull: ['$movie.tmdbId', '$_id.tmdbId'],
            },
            count: 1,
          },
        },
      ]),
      Watchlist.aggregate([
        { $match: { type: 'tvshow' } },
        {
          $group: {
            _id: {
              tvShow: '$tvShow',
              tmdbId: '$tmdbId',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'tvshows',
            localField: '_id.tvShow',
            foreignField: '_id',
            as: 'tvShow',
          },
        },
        { $unwind: { path: '$tvShow', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            title: '$tvShow.name',
            posterPath: '$tvShow.posterPath',
            tmdbId: {
              $ifNull: ['$tvShow.tmdbId', '$_id.tmdbId'],
            },
            count: 1,
          },
        },
      ]),
    ]);

    const mapLeader = (item, kind) => ({
      title:
        item.title ||
        (item.tmdbId
          ? `${kind === 'tv' ? 'TMDB TV' : 'TMDB'} #${item.tmdbId}`
          : kind === 'tv'
            ? 'Unknown series'
            : 'Uncached movie'),
      posterPath: item.posterPath || null,
      tmdbId: item.tmdbId || null,
      saves: item.count,
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          newThisMonth: newUsersThisMonth
        },
        content: {
          movies: moviesTotal,
          tvShows: tvShowsTotal,
          newMoviesThisMonth,
          cachedMovies,
          cachedTvShows,
          source: 'TMDB',
          note:
            'Movies/TV totals are TMDB discover catalog sizes. "+ this month" is TMDB theatrical releases in the current calendar month. cachedMovies/cachedTvShows = documents in your database.'
        },
        engagement: {
          watchlists: totalWatchlists,
          watchHistory: totalWatchHistory
        },
        recentUsers,
        watchlistLeaders: {
          movies: popularWatchlistItems.map((item) => mapLeader(item, 'movie')),
          tvShows: popularTvWatchlistItems.map((item) => mapLeader(item, 'tv')),
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
  }
});

// ==================== USER MANAGEMENT ====================

// Get all users with pagination and filtering
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's watchlist and history
    const [watchlist, watchHistory] = await Promise.all([
      Watchlist.find({ user: req.params.id }).populate('movie', 'title posterPath'),
      WatchHistory.find({ user: req.params.id }).populate('movie', 'title posterPath')
    ]);

    res.json({
      success: true,
      data: {
        user,
        watchlist,
        watchHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

// Update user
router.put('/users/:id', createActivityLogger.userUpdate(), async (req, res) => {
  try {
    const { username, email, role, isActive, profile, preferences } = req.body;
    
    // Get the current user first
    const currentUser = await User.findById(req.params.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Merge nested objects instead of replacing
    if (profile !== undefined) {
      updateData.profile = {
        ...(currentUser.profile || {}),
        ...profile
      };
    }
    
    if (preferences !== undefined) {
      updateData.preferences = {
        ...(currentUser.preferences || {}),
        ...preferences
      };
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false, 
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
      });
    }
    res.status(500).json({ success: false, message: 'Failed to update user', error: error.message });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', createActivityLogger.userDelete(), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// ==================== CONTENT MANAGEMENT ====================

// Get all movies with admin controls
router.get('/movies', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      genre,
      year,
      isAvailable,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { originalTitle: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre) {
      // Convert genre string to ObjectId if needed
      const mongoose = require('mongoose');
      const genreParams = Array.isArray(genre) ? genre : [genre];
      const genreIds = [];
      
      for (const genreParam of genreParams) {
        if (mongoose.Types.ObjectId.isValid(genreParam)) {
          genreIds.push(new mongoose.Types.ObjectId(genreParam));
        } else {
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
      query.releaseDate = { $gte: startDate, $lte: endDate };
    }
    
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const movies = await Movie.find(query)
      .populate('genres', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Movie.countDocuments(query);

    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch movies' });
  }
});

// Update movie availability
router.put('/movies/:id/availability', createActivityLogger.movieAvailability(), async (req, res) => {
  try {
    const { isAvailable } = req.body;
    
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { isAvailable },
      { new: true }
    ).populate('genres', 'name');

    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    res.json({ success: true, data: movie });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update movie' });
  }
});

// Delete movie
router.delete('/movies/:id', createActivityLogger.movieDelete(), async (req, res) => {
  try {
    const movie = await Movie.findByIdAndDelete(req.params.id);
    
    if (!movie) {
      return res.status(404).json({ success: false, message: 'Movie not found' });
    }

    // Remove from all watchlists
    await Watchlist.deleteMany({ movie: req.params.id });
    
    // Remove from watch history
    await WatchHistory.deleteMany({ movie: req.params.id });

    res.json({ success: true, message: 'Movie deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete movie' });
  }
});

// ==================== TV SHOW MANAGEMENT ====================

// Get all TV shows with admin controls
router.get('/tvshows', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      genre,
      year,
      status,
      type,
      isAvailable,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { originalName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre) {
      // Convert genre string to ObjectId if needed
      const mongoose = require('mongoose');
      const genreParams = Array.isArray(genre) ? genre : [genre];
      const genreIds = [];
      
      for (const genreParam of genreParams) {
        if (mongoose.Types.ObjectId.isValid(genreParam)) {
          genreIds.push(new mongoose.Types.ObjectId(genreParam));
        } else {
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

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (isAvailable !== undefined) {
      query.isAvailable = isAvailable === 'true';
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const tvShows = await TvShow.find(query)
      .populate('genres', 'name')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TvShow.countDocuments(query);

    res.json({
      success: true,
      data: {
        tvShows,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch TV shows' });
  }
});

// Update TV show availability
router.put('/tvshows/:id/availability', createActivityLogger.tvshowAvailability(), async (req, res) => {
  try {
    const { isAvailable } = req.body;
    
    const tvShow = await TvShow.findByIdAndUpdate(
      req.params.id,
      { isAvailable },
      { new: true }
    ).populate('genres', 'name');

    if (!tvShow) {
      return res.status(404).json({ success: false, message: 'TV show not found' });
    }

    res.json({ success: true, data: tvShow });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update TV show' });
  }
});

// Delete TV show
router.delete('/tvshows/:id', createActivityLogger.tvshowDelete(), async (req, res) => {
  try {
    const tvShow = await TvShow.findByIdAndDelete(req.params.id);
    
    if (!tvShow) {
      return res.status(404).json({ success: false, message: 'TV show not found' });
    }

    // Remove from all watchlists (if TV shows are in watchlists)
    await Watchlist.deleteMany({ tvShow: req.params.id });
    
    // Remove from watch history (if TV shows are tracked in history)
    await WatchHistory.deleteMany({ tvShow: req.params.id });

    res.json({ success: true, message: 'TV show deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete TV show' });
  }
});

// ==================== GENRE MANAGEMENT ====================

// Delete genre
router.delete('/genres/:id', createActivityLogger.genreDelete(), async (req, res) => {
  try {
    const Genre = require('../models/Genre');
    const TvShow = require('../models/TvShow');
    const Movie = require('../models/Movie');
    
    const genre = await Genre.findById(req.params.id);
    
    if (!genre) {
      return res.status(404).json({ success: false, message: 'Genre not found' });
    }

    // Check if genre is used by any TV shows or movies
    const tvShowCount = await TvShow.countDocuments({ genres: req.params.id });
    const movieCount = await Movie.countDocuments({ genres: req.params.id });
    
    if (tvShowCount > 0 || movieCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete genre. It is used by ${tvShowCount} TV show(s) and ${movieCount} movie(s).` 
      });
    }

    await Genre.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Genre deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete genre' });
  }
});

// ==================== SYSTEM MANAGEMENT ====================

// Get system health
router.get('/system/health', async (req, res) => {
  try {
    const dbStats = await Movie.db.db.stats();
    
    const systemInfo = {
      database: {
        collections: dbStats.collections,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    };

    res.json({ success: true, data: systemInfo });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get system health' });
  }
});

// Get logs (placeholder - you can implement actual logging)
router.get('/system/logs', async (req, res) => {
  try {
    // This is a placeholder - implement actual log retrieval
    res.json({ 
      success: true, 
      data: { 
        logs: [],
        message: 'Log system not implemented yet' 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get logs' });
  }
});

// ==================== ANALYTICS ====================

// Get user analytics
router.get('/analytics/users', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [
      totalUsers,
      newUsers,
      activeUsers,
      userGrowth
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      User.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        newUsers,
        activeUsers,
        userGrowth
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get user analytics' });
  }
});

// Get content analytics
router.get('/analytics/content', async (req, res) => {
  try {
    const now = new Date();
    let regionNames;

    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch (intlError) {
    }

    const [
      totalMovies,
      totalTvShows,
      totalGenres,
      popularGenres,
      movieYearAgg,
      tvYearAgg,
      upcomingMoviesAgg,
      upcomingTvAgg,
      movieCountryAgg,
      tvCountryAgg
    ] = await Promise.all([
      Movie.countDocuments(),
      TvShow.countDocuments(),
      Genre.countDocuments(),
      Movie.aggregate([
        { $unwind: '$genres' },
        { $group: { _id: '$genres', count: { $sum: 1 } } },
        { $lookup: { from: 'genres', localField: '_id', foreignField: '_id', as: 'genre' } },
        { $unwind: '$genre' },
        { $project: { name: '$genre.name', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Movie.aggregate([
        { $match: { releaseDate: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: { $year: '$releaseDate' },
            movies: { $sum: 1 }
          }
        }
      ]),
      TvShow.aggregate([
        { $match: { firstAirDate: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: { $year: '$firstAirDate' },
            tvShows: { $sum: 1 }
          }
        }
      ]),
      Movie.aggregate([
        { $match: { releaseDate: { $gte: now } } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            items: [
              { $sort: { releaseDate: 1 } },
              {
                $project: {
                  title: 1,
                  releaseDate: 1,
                  posterPath: 1,
                  voteAverage: 1,
                  tmdbId: 1
                }
              },
              { $limit: 8 }
            ]
          }
        }
      ]),
      TvShow.aggregate([
        { $match: { firstAirDate: { $gte: now } } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            items: [
              { $sort: { firstAirDate: 1 } },
              {
                $project: {
                  name: 1,
                  firstAirDate: 1,
                  posterPath: 1,
                  voteAverage: 1,
                  tmdbId: 1
                }
              },
              { $limit: 8 }
            ]
          }
        }
      ]),
      Movie.aggregate([
        {
          $match: {
            $or: [
              { productionCountries: { $exists: true, $ne: [] } },
              { originCountry: { $exists: true, $ne: [] } }
            ]
          }
        },
        {
          $set: {
            primaryCountry: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$productionCountries', []] } }, 0] },
                {
                  isoCode: { $arrayElemAt: ['$productionCountries.isoCode', 0] },
                  name: { $arrayElemAt: ['$productionCountries.name', 0] }
                },
                {
                  isoCode: { $arrayElemAt: [{ $ifNull: ['$originCountry', []] }, 0] },
                  name: { $arrayElemAt: [{ $ifNull: ['$originCountry', []] }, 0] }
                }
              ]
            }
          }
        },
        {
          $match: {
            'primaryCountry.isoCode': { $ne: null },
            'primaryCountry.isoCode': { $ne: '' }
          }
        },
        {
          $group: {
            _id: {
              isoCode: '$primaryCountry.isoCode',
              name: '$primaryCountry.name'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ]),
      TvShow.aggregate([
        { $match: { originCountry: { $exists: true, $ne: [] } } },
        {
          $project: {
            primaryCountry: { $arrayElemAt: ['$originCountry', 0] }
          }
        },
        {
          $match: {
            primaryCountry: { $ne: null },
            primaryCountry: { $ne: '' }
          }
        },
        {
          $group: {
            _id: '$primaryCountry',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 8 }
      ])
    ]);

    const buildRegionName = (code, fallbackName) => {
      if (fallbackName && fallbackName !== code) {
        return fallbackName;
      }
      if (!code) return 'Unknown';
      try {
        return regionNames?.of(String(code).toUpperCase()) || String(code).toUpperCase();
      } catch {
        return String(code).toUpperCase();
      }
    };

    const upcomingMoviesFacet = upcomingMoviesAgg[0] || { total: [], items: [] };
    const upcomingTvFacet = upcomingTvAgg[0] || { total: [], items: [] };

    const upcomingMovies = {
      count: upcomingMoviesFacet.total[0]?.count ?? 0,
      items: (upcomingMoviesFacet.items || []).map((item) => ({
        id: item._id ? item._id.toString() : null,
        tmdbId: item.tmdbId ?? null,
        title: item.title || 'Untitled',
        releaseDate: item.releaseDate || null,
        posterPath: item.posterPath || null,
        voteAverage: item.voteAverage ?? null
      }))
    };

    const upcomingTv = {
      count: upcomingTvFacet.total[0]?.count ?? 0,
      items: (upcomingTvFacet.items || []).map((item) => ({
        id: item._id ? item._id.toString() : null,
        tmdbId: item.tmdbId ?? null,
        title: item.name || 'Untitled',
        releaseDate: item.firstAirDate || null,
        posterPath: item.posterPath || null,
        voteAverage: item.voteAverage ?? null
      }))
    };

    const yearsMap = new Map();
    movieYearAgg.forEach((entry) => {
      if (entry?._id) {
        const year = entry._id;
        if (!yearsMap.has(year)) {
          yearsMap.set(year, { year, movies: 0, tvShows: 0 });
        }
        yearsMap.get(year).movies = entry.movies ?? 0;
      }
    });
    tvYearAgg.forEach((entry) => {
      if (entry?._id) {
        const year = entry._id;
        if (!yearsMap.has(year)) {
          yearsMap.set(year, { year, movies: 0, tvShows: 0 });
        }
        yearsMap.get(year).tvShows = entry.tvShows ?? 0;
      }
    });

    const contentByYear = Array.from(yearsMap.values())
      .map((item) => ({
        ...item,
        total: (item.movies ?? 0) + (item.tvShows ?? 0)
      }))
      .filter((item) => item.year !== null && !Number.isNaN(item.year))
      .sort((a, b) => b.year - a.year)
      .slice(0, 10)
      .sort((a, b) => a.year - b.year);

    const movieCountries = movieCountryAgg.map((entry) => ({
      code: entry._id?.isoCode || entry._id?.name || 'UNKNOWN',
      name: buildRegionName(entry._id?.isoCode || entry._id?.name, entry._id?.name),
      count: entry.count ?? 0
    }));

    const tvCountries = tvCountryAgg.map((entry) => ({
      code: entry._id || 'UNKNOWN',
      name: buildRegionName(entry._id, entry._id),
      count: entry.count ?? 0
    }));

    res.json({
      success: true,
      data: {
        totalMovies,
        totalTvShows,
        totalGenres,
        popularGenres,
        contentByYear,
        upcoming: {
          movies: upcomingMovies,
          tv: upcomingTv
        },
        countryBreakdown: {
          movies: movieCountries,
          tv: tvCountries
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get content analytics' });
  }
});

// ==================== ADMIN ACTIVITY LOGS ====================

// Get admin activity logs
router.get('/activity', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      adminId,
      action,
      resource,
      success,
      startDate,
      endDate
    } = req.query;

    const query = {};
    
    if (adminId) {
      query.admin = adminId;
    }
    
    if (action) {
      query.action = action;
    }
    
    if (resource) {
      query.resource = resource;
    }
    
    if (success !== undefined) {
      query.success = success === 'true';
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const activities = await AdminActivity.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AdminActivity.countDocuments(query);

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
});

// ==================== AI CONTROL PANEL ====================

// Get AI configuration
router.get('/ai/config', async (req, res) => {
  try {
    const config = await ensureAiConfig();
    await config.populate('lastModifiedBy', 'username email');
    const configData = config.toObject();
    res.json({
      success: true,
      data: {
        toggles: configData.toggles,
        prompts: configData.prompts,
        guardrails: configData.guardrails,
        lastModifiedAt: configData.lastModifiedAt,
        lastModifiedBy: configData.lastModifiedBy
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load AI configuration' });
  }
});

// Update AI configuration
router.put('/ai/config', async (req, res) => {
  try {
    const { toggles, prompts, guardrails } = req.body || {};
    const config = await ensureAiConfig();

    if (isPlainObject(toggles)) {
      config.toggles = mergeSubdocument(config.toggles, toggles);
    }

    if (isPlainObject(prompts)) {
      config.prompts = mergeSubdocument(config.prompts, prompts);
    }

    if (isPlainObject(guardrails)) {
      if (Array.isArray(guardrails.blockedGenres)) {
        guardrails.blockedGenres = guardrails.blockedGenres.filter(
          (genre) => typeof genre === 'string' && genre.trim() !== ''
        );
      }
      config.guardrails = mergeSubdocument(config.guardrails, guardrails);
    }

    config.lastModifiedBy = req.user.id;
    config.lastModifiedAt = new Date();
    await config.save();
    invalidateConfigCache();
    await config.populate('lastModifiedBy', 'username email');

    await AiAuditLog.create({
      admin: req.user.id,
      action: 'update_config',
      details: 'Updated AI configuration',
      metadata: {
        toggles: isPlainObject(toggles) ? toggles : undefined,
        guardrails: isPlainObject(guardrails) ? guardrails : undefined,
        promptsUpdated: isPlainObject(prompts) ? Object.keys(prompts) : []
      },
      success: true
    });

    res.json({
      success: true,
      message: 'AI configuration updated successfully',
      data: {
        toggles: config.toggles,
        prompts: config.prompts,
        guardrails: config.guardrails,
        lastModifiedAt: config.lastModifiedAt,
        lastModifiedBy: config.lastModifiedBy
      }
    });
  } catch (error) {
    await AiAuditLog.create({
      admin: req.user.id,
      action: 'update_config',
      details: 'Failed to update AI configuration',
      metadata: { error: error.message },
      success: false
    });
    res.status(500).json({ success: false, message: 'Failed to update AI configuration' });
  }
});

// Get AI feedback summary
router.get('/ai/feedback', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const [total, helpful, notHelpful, ratingAgg, recentFeedback] = await Promise.all([
      AiFeedback.countDocuments(),
      AiFeedback.countDocuments({ helpful: true }),
      AiFeedback.countDocuments({ helpful: false }),
      AiFeedback.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' }
          }
        }
      ]),
      AiFeedback.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'username email')
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          total,
          helpful,
          notHelpful,
          averageRating: ratingAgg[0]?.averageRating || 0
        },
        items: recentFeedback
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load AI feedback' });
  }
});

// Get AI audit logs
router.get('/ai/audit', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const [logs, total] = await Promise.all([
      AiAuditLog.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('admin', 'username email'),
      AiAuditLog.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          pageSize: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load AI audit logs' });
  }
});

// List AI assistant conversations
router.get('/ai/conversations', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const search = req.query.search ? req.query.search.trim() : '';
    const userId = req.query.userId;

    const query = {};

    if (userId) {
      query.user = userId;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchedUsers = await User.find({
        $or: [
          { username: { $regex: searchRegex } },
          { email: { $regex: searchRegex } },
        ],
      })
        .select('_id')
        .lean();

      const userIds = matchedUsers.map((item) => item._id);

      query.$or = [
        { title: { $regex: searchRegex } },
      ];

      if (userIds.length > 0) {
        query.$or.push({ user: { $in: userIds } });
      }
    }

    const conversations = await AiConversation.find(query)
      .populate('user', 'username email')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await AiConversation.countDocuments(query);

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          pageSize: limit,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load AI conversations' });
  }
});

// Bulk delete or schedule deletion for AI conversations
router.post('/ai/conversations/bulk-delete', async (req, res) => {
  try {
    const { conversationIds, scheduleAutoDelete } = req.body || {};

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'conversationIds array is required',
      });
    }

    const uniqueIds = [...new Set(conversationIds.filter((id) => typeof id === 'string'))];
    const validIds = uniqueIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid conversation IDs provided',
      });
    }

    if (scheduleAutoDelete) {
      const autoDeleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const updateResult = await AiConversation.updateMany(
        { _id: { $in: validIds } },
        { $set: { scheduledForDeletionAt: autoDeleteAt } },
      );

      return res.json({
        success: true,
        data: {
          mode: 'scheduled',
          scheduledFor: autoDeleteAt.toISOString(),
          matchedCount: updateResult.matchedCount || updateResult.n,
          modifiedCount: updateResult.modifiedCount || updateResult.nModified,
        },
        message: `Scheduled ${updateResult.modifiedCount || updateResult.nModified || 0} conversations for auto-deletion in 24 hours.`,
      });
    }

    const deleteResult = await AiConversation.deleteMany({ _id: { $in: validIds } });

    return res.json({
      success: true,
      data: {
        mode: 'immediate',
        deletedCount: deleteResult.deletedCount,
      },
      message: `Deleted ${deleteResult.deletedCount} conversations.`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk delete request',
    });
  }
});

// Get real-time TMDB sync snapshot (not stored in database)
router.get('/analytics/sync/live', async (req, res) => {
  try {
    const [
      popularMovies,
      trendingMovies,
      topRatedMovies,
      upcomingMovies,
      popularTv,
      trendingTv,
      topRatedTv,
      onTheAirTv
    ] = await Promise.all([
      tmdbService.getPopularMovies(1),
      tmdbService.getTrendingMovies(1),
      tmdbService.getTopRatedMovies(1),
      tmdbService.getUpcomingMovies(1),
      tmdbService.getPopularTvShows(1),
      tmdbService.getTrendingTvShows(1),
      tmdbService.getTopRatedTvShows(1),
      tmdbService.getOnTheAirTvShows(1)
    ]);

    const buildSummary = (payload, mapper) => {
      const results = Array.isArray(payload?.results) ? payload.results : [];
      return {
        totalResults: payload?.total_results ?? results.length ?? 0,
        totalPages: payload?.total_pages ?? 1,
        sample: results.slice(0, 5).map(mapper)
      };
    };

    const mapMovie = (item) => ({
      id: item.id,
      title: item.title || item.original_title || 'Untitled',
      subtitle: item.release_date || null,
      posterPath: item.poster_path || null,
      popularity: item.popularity ?? null,
      voteAverage: item.vote_average ?? null
    });

    const mapTv = (item) => ({
      id: item.id,
      title: item.name || item.original_name || 'Untitled',
      subtitle: item.first_air_date || null,
      posterPath: item.poster_path || null,
      popularity: item.popularity ?? null,
      voteAverage: item.vote_average ?? null
    });

    res.json({
      success: true,
      data: {
        fetchedAt: new Date().toISOString(),
        movies: {
          popular: buildSummary(popularMovies, mapMovie),
          trending: buildSummary(trendingMovies, mapMovie),
          topRated: buildSummary(topRatedMovies, mapMovie),
          upcoming: buildSummary(upcomingMovies, mapMovie)
        },
        tv: {
          popular: buildSummary(popularTv, mapTv),
          trending: buildSummary(trendingTv, mapTv),
          topRated: buildSummary(topRatedTv, mapTv),
          onTheAir: buildSummary(onTheAirTv, mapTv)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live TMDB analytics'
    });
  }
});

// Get a specific conversation
router.get('/ai/conversations/:id', async (req, res) => {
  try {
    const conversation = await AiConversation.findById(req.params.id)
      .populate('user', 'username email');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load conversation' });
  }
});

// Get activity statistics
router.get('/activity/stats', async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [
      totalActivities,
      successActivities,
      failedActivities,
      activitiesByAction,
      activitiesByAdmin,
      recentActivities
    ] = await Promise.all([
      AdminActivity.countDocuments({ createdAt: { $gte: startDate } }),
      AdminActivity.countDocuments({ createdAt: { $gte: startDate }, success: true }),
      AdminActivity.countDocuments({ createdAt: { $gte: startDate }, success: false }),
      AdminActivity.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AdminActivity.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $group: { _id: '$admin', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'admin' } },
        { $unwind: '$admin' },
        { $project: { 'admin.username': 1, 'admin.email': 1, count: 1 } }
      ]),
      AdminActivity.find({ createdAt: { $gte: startDate } })
        .limit(10)
        .sort({ createdAt: -1 })
    ]);

    res.json({
      success: true,
      data: {
        total: totalActivities,
        success: successActivities,
        failed: failedActivities,
        successRate: totalActivities > 0 ? ((successActivities / totalActivities) * 100).toFixed(2) : 0,
        byAction: activitiesByAction,
        byAdmin: activitiesByAdmin,
        recent: recentActivities
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get activity statistics' });
  }
});

// Get activity by ID
router.get('/activity/:id', async (req, res) => {
  try {
    const activity = await AdminActivity.findById(req.params.id);
    
    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity' });
  }
});

// Get all watch history (admin only)
router.get('/watchhistory', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      contentType,
      sortBy = 'watchedAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    if (contentType === 'movies') {
      query.movie = { $exists: true };
    } else if (contentType === 'tvshows') {
      query.tvShow = { $exists: true };
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const history = await WatchHistory.find(query)
      .populate('user', 'username email')
      .populate('movie', 'title posterPath')
      .populate('tvShow', 'name posterPath')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WatchHistory.countDocuments(query);

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          totalPages: Math.ceil(total / limit),
          currentPage: parseInt(page),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch watch history', error: error.message });
  }
});

// Bulk delete watch history
router.post('/watchhistory/bulk-delete', async (req, res) => {
  try {
    const { historyIds } = req.body;
    
    if (!historyIds || !Array.isArray(historyIds) || historyIds.length === 0) {
      return res.status(400).json({ success: false, message: 'History IDs array is required' });
    }


    const result = await WatchHistory.deleteMany({ _id: { $in: historyIds } });

    // Log activity
    try {
      await AdminActivity.create({
        admin: req.user.id,
        action: 'delete',
        resource: 'watchhistory',
        description: `Bulk deleted ${result.deletedCount} watch history entries`,
        details: {
          deletedCount: result.deletedCount,
          historyIds: historyIds
        },
        success: true
      });
    } catch (activityError) {
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} watch history entries`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk delete watch history',
      error: error.message 
    });
  }
});

// Delete watch history older than 1 day (manual cleanup)
router.delete('/watchhistory/cleanup', async (req, res) => {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const result = await WatchHistory.deleteMany({
      watchedAt: { $lt: oneDayAgo }
    });
    

    // Log activity
    try {
      await AdminActivity.create({
        admin: req.user.id,
        action: 'delete',
        resource: 'watchhistory',
        description: `Cleaned up ${result.deletedCount} old watch history entries`,
        details: {
          deletedCount: result.deletedCount,
          cleanupType: 'manual_1day',
          cutoffDate: oneDayAgo.toISOString()
        },
        success: true
      });
    } catch (activityError) {
      // Don't fail the cleanup if activity logging fails
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} old watch history entries`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cleanup watch history',
      error: error.message 
    });
  }
});

module.exports = router;
