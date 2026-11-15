/**
 * Auto Sync Routes
 * API endpoints for managing automatic TMDB synchronization
 */

const express = require('express');
const router = express.Router();
const autoSyncService = require('../services/autoSyncService');
const logger = require('../utils/logger');

// Middleware to check if user is admin (you can implement this based on your auth system)
const requireAdmin = (req, res, next) => {
  // For now, allow all requests. In production, implement proper admin authentication
  next();
};

/**
 * GET /api/auto-sync/status
 * Get current sync status and statistics
 */
router.get('/status', (req, res) => {
  try {
    const status = autoSyncService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/start
 * Start auto-sync with custom schedule
 */
router.post('/start', requireAdmin, (req, res) => {
  try {
    const {
      schedule = '0 2 * * *', // Default: daily at 2 AM
      pages = 5,
      includeTrending = true,
      includePopular = true,
      includeTopRated = false,
      includeUpcoming = false
    } = req.body;

    autoSyncService.startAutoSync({
      schedule,
      pages,
      includeTrending,
      includePopular,
      includeTopRated,
      includeUpcoming
    });

    res.json({
      success: true,
      message: 'Auto-sync started successfully',
      data: {
        schedule,
        pages,
        includeTrending,
        includePopular,
        includeTopRated,
        includeUpcoming
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start auto-sync',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/stop
 * Stop auto-sync service
 */
router.post('/stop', requireAdmin, (req, res) => {
  try {
    autoSyncService.stopAutoSync();
    res.json({
      success: true,
      message: 'Auto-sync stopped successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to stop auto-sync',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/sync-now
 * Perform immediate sync
 */
router.post('/sync-now', requireAdmin, async (req, res) => {
  try {
    const {
      pages = 5,
      includeTrending = true,
      includePopular = true,
      includeTopRated = false,
      includeUpcoming = false
    } = req.body;

    // Return response immediately to prevent timeout
    res.json({
      success: true,
      message: 'Sync started in background',
      data: {
        pages,
        includeTrending,
        includePopular,
        includeTopRated,
        includeUpcoming
      }
    });

    // Run sync in background
    autoSyncService.performSync({
      pages,
      includeTrending,
      includePopular,
      includeTopRated,
      includeUpcoming
    }).then(result => {
    }).catch(error => {
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to perform sync',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/sync-last-100-movies
 * Sync the last 100 movies from TMDB and send Telegram notifications
 */
router.post('/sync-last-100-movies', requireAdmin, async (req, res) => {
  try {
    // Return response immediately to prevent timeout
    res.json({
      success: true,
      message: 'Syncing last 100 movies started in background. Telegram notifications will be sent for new movies.',
      data: {
        status: 'started'
      }
    });

    // Run sync in background
    autoSyncService.syncLast100Movies().then(result => {
      if (result.success) {
        logger.info('Last 100 movies sync completed:', result.stats);
      } else {
        logger.error('Last 100 movies sync failed:', result.error);
      }
    }).catch(error => {
      logger.error('Exception during last 100 movies sync:', error);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start sync',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/sync-last-100-tvshows
 * Sync the last 100 TV shows from TMDB and send Telegram notifications
 */
router.post('/sync-last-100-tvshows', requireAdmin, async (req, res) => {
  try {
    // Return response immediately to prevent timeout
    res.json({
      success: true,
      message: 'Syncing last 100 TV shows started in background. Telegram notifications will be sent for new TV shows.',
      data: {
        status: 'started'
      }
    });

    // Run sync in background
    autoSyncService.syncLast100TvShows().then(result => {
      if (result.success) {
        logger.info('Last 100 TV shows sync completed:', result.stats);
      } else {
        logger.error('Last 100 TV shows sync failed:', result.error);
      }
    }).catch(error => {
      logger.error('Exception during last 100 TV shows sync:', error);
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start sync',
      error: error.message
    });
  }
});

/**
 * GET /api/auto-sync/schedules
 * Get available sync schedules
 */
router.get('/schedules', (req, res) => {
  try {
    const schedules = autoSyncService.getSchedules();
    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get schedules',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/schedule/daily
 * Set daily sync schedule
 */
router.post('/schedule/daily', requireAdmin, (req, res) => {
  try {
    const { hour = 2, pages = 5 } = req.body;
    const schedule = `0 ${hour} * * *`;
    
    autoSyncService.startAutoSync({
      schedule,
      pages,
      includeTrending: true,
      includePopular: true,
      includeTopRated: false,
      includeUpcoming: false
    });

    res.json({
      success: true,
      message: `Daily sync scheduled for ${hour}:00 UTC`,
      data: { schedule, pages }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to set daily schedule',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/schedule/hourly
 * Set hourly sync schedule
 */
router.post('/schedule/hourly', requireAdmin, (req, res) => {
  try {
    const { pages = 2 } = req.body;
    const schedule = '0 * * * *';
    
    autoSyncService.startAutoSync({
      schedule,
      pages,
      includeTrending: true,
      includePopular: true,
      includeTopRated: false,
      includeUpcoming: false
    });

    res.json({
      success: true,
      message: 'Hourly sync scheduled',
      data: { schedule, pages }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to set hourly schedule',
      error: error.message
    });
  }
});

/**
 * POST /api/auto-sync/schedule/custom
 * Set custom sync schedule
 */
router.post('/schedule/custom', requireAdmin, (req, res) => {
  try {
    const { 
      cronExpression, 
      pages = 5,
      includeTrending = true,
      includePopular = true,
      includeTopRated = false,
      includeUpcoming = false
    } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        message: 'Cron expression is required'
      });
    }

    autoSyncService.startAutoSync({
      schedule: cronExpression,
      pages,
      includeTrending,
      includePopular,
      includeTopRated,
      includeUpcoming
    });

    res.json({
      success: true,
      message: 'Custom sync schedule set',
      data: { 
        schedule: cronExpression, 
        pages,
        includeTrending,
        includePopular,
        includeTopRated,
        includeUpcoming
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to set custom schedule',
      error: error.message
    });
  }
});

module.exports = router;
