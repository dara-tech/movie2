const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { requireAdmin } = require('../middleware/adminAuth');
const SmartLink = require('../models/SmartLink');
const logger = require('../utils/logger');

// Get TMDB data for an ad link (public endpoint)
router.get('/tmdb/:tmdbId/:contentType', async (req, res) => {
  try {
    const { tmdbId, contentType } = req.params;
    const axios = require('axios');
    const tmdbApiKey = process.env.TMDB_API_KEY;

    if (!tmdbApiKey) {
      return res.status(500).json({
        success: false,
        message: 'TMDB API key not configured'
      });
    }

    const mediaType = contentType === 'tvshow' ? 'tv' : 'movie';
    const response = await axios.get(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`,
      {
        params: {
          api_key: tmdbApiKey,
          language: 'en-US'
        }
      }
    );

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    logger.error('Error fetching TMDB data for ad:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch TMDB data'
    });
  }
});

// Get latest trending content from TMDB for ads without images
router.get('/latest-trending', async (req, res) => {
  try {
    const { contentType = 'movie', limit = 5 } = req.query;
    const tmdbService = require('../services/tmdbService');
    
    let tmdbData;
    if (contentType === 'movie') {
      const result = await tmdbService.getTrendingMovies(1);
      tmdbData = result.results.slice(0, parseInt(limit));
    } else if (contentType === 'tvshow') {
      const result = await tmdbService.getTrendingTvShows(1);
      tmdbData = result.results.slice(0, parseInt(limit));
    } else {
      // Get mix of movies and TV shows
      const movies = await tmdbService.getTrendingMovies(1);
      const tvShows = await tmdbService.getTrendingTvShows(1);
      tmdbData = [...movies.results.slice(0, Math.ceil(limit / 2)), ...tvShows.results.slice(0, Math.floor(limit / 2))];
    }

    res.json({
      success: true,
      data: tmdbData
    });
  } catch (error) {
    logger.error('Error fetching latest trending content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending content'
    });
  }
});

// Get general ads (for all pages) - public endpoint - MUST be before /content route
router.get('/general', async (req, res) => {
  try {
    const links = await SmartLink.find({
      contentType: 'general',
      isActive: true
    })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    logger.error('Error fetching general ads links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads links'
    });
  }
});

// Get ads links for specific content (public endpoint)
router.get('/content/:contentType/:contentId', async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const { tmdbId } = req.query;

    if (!['movie', 'tvshow', 'general'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contentType. Must be "movie", "tvshow", or "general"'
      });
    }

    const links = await SmartLink.getAdsForContent(
      contentType,
      contentId === 'none' ? null : contentId,
      tmdbId ? parseInt(tmdbId) : null
    );

    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    logger.error('Error fetching ads links for content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads links'
    });
  }
});

// Track ad click (public endpoint - no auth required)
// MUST be before requireAdmin middleware
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ads link ID'
      });
    }

    const smartlink = await SmartLink.findById(id);
    
    if (!smartlink) {
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }

    // Increment click count
    await smartlink.incrementClick();

    res.json({
      success: true,
      message: 'Click tracked successfully',
      data: {
        clickCount: smartlink.clickCount
      }
    });
  } catch (error) {
    logger.error('Error tracking ad click:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
});

// Track ad view/impression (public endpoint - no auth required)
// MUST be before requireAdmin middleware
// Use in-memory cache to prevent duplicate view tracking within short time window
const viewTrackingCache = new Map();
const VIEW_TRACKING_TTL = 60000; // 1 minute - prevent duplicate views within 1 minute

router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ads link ID'
      });
    }

    // Check cache to prevent duplicate views
    const cacheKey = `view-${id}`;
    const cached = viewTrackingCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached) < VIEW_TRACKING_TTL) {
      // Already tracked recently, return success without logging
      return res.json({
        success: true,
        message: 'View tracked successfully'
      });
    }

    // Update cache
    viewTrackingCache.set(cacheKey, now);
    
    // Clean up old cache entries periodically
    if (viewTrackingCache.size > 1000) {
      for (const [key, timestamp] of viewTrackingCache.entries()) {
        if (now - timestamp > VIEW_TRACKING_TTL) {
          viewTrackingCache.delete(key);
        }
      }
    }

    const smartlink = await SmartLink.findById(id);
    
    if (!smartlink) {
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }

    // Track view (you can add viewCount field to schema if needed)
    // For now, just return success - views are tracked client-side
    // Don't log to reduce server log noise

    res.json({
      success: true,
      message: 'View tracked successfully'
    });
  } catch (error) {
    // Don't log view tracking errors to reduce log noise
    res.status(500).json({
      success: false,
      message: 'Failed to track view'
    });
  }
});

// Apply admin middleware to all routes below
router.use(requireAdmin);

// Get all ads links (admin only)
router.get('/', async (req, res) => {
  try {
    const smartlinks = await SmartLink.find()
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: smartlinks
    });
  } catch (error) {
    logger.error('Error fetching ads links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads links'
    });
  }
});

// Get single ads link (validate that id is a valid ObjectId)
// IMPORTANT: This route must be after all specific routes like /general, /content/*, /latest-trending, /tmdb/*
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // CRITICAL: Reject known public route strings FIRST to prevent matching
    // This prevents /general, /latest-trending, /tmdb, /content from being treated as an ID
    const publicRoutes = ['general', 'content', 'latest-trending', 'tmdb'];
    if (publicRoutes.includes(id)) {
      // This should never happen if route order is correct, but safety check
      logger.warn(`Attempted to access /:id route with public route string: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }
    
    // Validate ObjectId format to prevent matching non-ObjectId strings
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ads link ID'
      });
    }

    const smartlink = await SmartLink.findById(id);

    if (!smartlink) {
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }

    res.json({
      success: true,
      data: smartlink
    });
  } catch (error) {
    logger.error('Error fetching ads link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ads link'
    });
  }
});

// Create new ads link
router.post('/', async (req, res) => {
  try {
    const {
      contentType,
      title,
      url,
      imageUrl,
      tmdbId,
      priority,
      isActive,
      autoSync
    } = req.body;

    if (!contentType || !['movie', 'tvshow', 'general'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Content type is required and must be "movie", "tvshow", or "general"'
      });
    }

    if (!title || !url) {
      return res.status(400).json({
        success: false,
        message: 'Title and URL are required'
      });
    }

    let finalTmdbId = tmdbId ? parseInt(tmdbId) : undefined;

    // Auto-sync: If no tmdbId provided, get latest trending content
    // For general ads, use trending movies; for movie/tvshow, use respective content type
    if (!finalTmdbId && autoSync !== false) {
      try {
        const tmdbService = require('../services/tmdbService');
        
        // Fetch multiple pages for better randomness
        const pagesToFetch = [1, 2, 3]; // Fetch 3 pages for more variety
        let allAvailableItems = [];
        
        for (const page of pagesToFetch) {
          try {
            let trendingResponse;
            if (contentType === 'tvshow') {
              trendingResponse = await tmdbService.getTrendingTvShows(page);
            } else {
              trendingResponse = await tmdbService.getTrendingMovies(page);
            }

            if (trendingResponse.results && trendingResponse.results.length > 0) {
              // Get ALL existing active ads (across all contentTypes) to avoid duplicates globally
              const existingAds = await SmartLink.find({
                isActive: true,
                tmdbId: { $exists: true, $ne: null }
              }).select('tmdbId contentType').lean();

              const existingTmdbIds = new Set(existingAds.map(ad => ad.tmdbId));
              
              // Filter out already used TMDB IDs from trending results
              const pageAvailableItems = trendingResponse.results.filter(item => !existingTmdbIds.has(item.id));
              allAvailableItems = allAvailableItems.concat(pageAvailableItems);
              
              // If we have enough items, break early
              if (allAvailableItems.length >= 20) {
                break;
              }
            }
          } catch (pageError) {
            logger.warn(`Failed to fetch page ${page}:`, pageError.message);
            // Continue to next page
          }
        }
        
        if (allAvailableItems.length > 0) {
          // Randomly select from all available items across multiple pages for better randomness
          const randomIndex = Math.floor(Math.random() * allAvailableItems.length);
          finalTmdbId = allAvailableItems[randomIndex].id;
          logger.info(`Auto-assigned unique TMDB ID ${finalTmdbId} (randomly selected from ${allAvailableItems.length} available items across ${pagesToFetch.length} pages)`);
        } else {
          logger.warn('No available items found for auto-sync');
        }
      } catch (error) {
        logger.warn('Failed to auto-sync TMDB ID, continuing without it:', error.message);
        // Continue without tmdbId - it's optional
      }
    }

    // Build smartlink data - contentId is optional and should not be included for general ads
    const smartlinkData = {
      contentType: contentType || 'general',
      title,
      url,
      imageUrl: imageUrl || undefined,
      tmdbId: finalTmdbId,
      priority: priority ? parseInt(priority) : 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user.id
    };

    // Only set contentId if contentType is not 'general' (but for now, we don't link to specific content)
    // contentId remains undefined/null for all ads links

    const smartlink = new SmartLink(smartlinkData);
    
    // Explicitly unset contentId if it's undefined to avoid validation issues
    if (smartlink.contentId === undefined) {
      smartlink.contentId = undefined;
    }

    await smartlink.save();

    logger.info(`Ads link created: ${smartlink._id} by ${req.user.username}${finalTmdbId ? ` with TMDB ID ${finalTmdbId}` : ''}`);
    
    res.status(201).json({
      success: true,
      message: 'Ads link created successfully',
      data: smartlink
    });
  } catch (error) {
    logger.error('Error creating ads link:', error);
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors || {}).map((e) => e.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Validation error: ${errorMessages || error.message}`,
        errors: error.errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create ads link',
      error: error.message
    });
  }
});

// Update ads link
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ads link ID'
      });
    }

    const smartlink = await SmartLink.findById(id);

    if (!smartlink) {
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }

    const {
      contentType,
      title,
      url,
      imageUrl,
      tmdbId,
      priority,
      isActive,
      autoSync
    } = req.body;

    if (contentType !== undefined) {
      if (!['movie', 'tvshow', 'general'].includes(contentType)) {
        return res.status(400).json({
          success: false,
          message: 'Content type must be "movie", "tvshow", or "general"'
        });
      }
      smartlink.contentType = contentType;
    }

    // Check if tmdbId was explicitly provided in the request (including empty string/null)
    const tmdbIdProvided = tmdbId !== undefined;
    // If provided, parse it (empty string/null becomes undefined)
    let finalTmdbId = tmdbIdProvided ? (tmdbId ? parseInt(tmdbId) : undefined) : smartlink.tmdbId;

    // Auto-sync: Only if tmdbId was NOT provided AND autoSync is enabled
    // If user explicitly sets tmdbId to empty, respect that and don't auto-assign
    const currentContentType = contentType !== undefined ? contentType : smartlink.contentType;
    if (!tmdbIdProvided && !finalTmdbId && autoSync !== false) {
      try {
        const tmdbService = require('../services/tmdbService');
        
        // Fetch multiple pages for better randomness
        const pagesToFetch = [1, 2, 3]; // Fetch 3 pages for more variety
        let allAvailableItems = [];
        
        for (const page of pagesToFetch) {
          try {
            let trendingResponse;
            if (currentContentType === 'tvshow') {
              trendingResponse = await tmdbService.getTrendingTvShows(page);
            } else {
              trendingResponse = await tmdbService.getTrendingMovies(page);
            }

            if (trendingResponse.results && trendingResponse.results.length > 0) {
              // Get ALL existing active ads (across all contentTypes) to avoid duplicates globally
              // Exclude the current ad being updated
              const existingAds = await SmartLink.find({
                isActive: true,
                tmdbId: { $exists: true, $ne: null },
                _id: { $ne: smartlink._id } // Exclude current ad
              }).select('tmdbId contentType').lean();

              const existingTmdbIds = new Set(existingAds.map(ad => ad.tmdbId));
              
              // Filter out already used TMDB IDs from trending results
              const pageAvailableItems = trendingResponse.results.filter(item => !existingTmdbIds.has(item.id));
              allAvailableItems = allAvailableItems.concat(pageAvailableItems);
              
              // If we have enough items, break early
              if (allAvailableItems.length >= 20) {
                break;
              }
            }
          } catch (pageError) {
            logger.warn(`Failed to fetch page ${page} for update:`, pageError.message);
            // Continue to next page
          }
        }
        
        if (allAvailableItems.length > 0) {
          // Randomly select from all available items across multiple pages for better randomness
          const randomIndex = Math.floor(Math.random() * allAvailableItems.length);
          finalTmdbId = allAvailableItems[randomIndex].id;
          logger.info(`Auto-assigned unique TMDB ID ${finalTmdbId} for update (randomly selected from ${allAvailableItems.length} available items across ${pagesToFetch.length} pages)`);
        } else {
          logger.warn('No available items found for auto-sync on update');
        }
      } catch (error) {
        logger.warn('Failed to auto-sync TMDB ID on update, continuing without it:', error.message);
        // Continue without tmdbId - it's optional
      }
    }

    if (title !== undefined) smartlink.title = title;
    if (url !== undefined) smartlink.url = url;
    if (imageUrl !== undefined) smartlink.imageUrl = imageUrl || undefined;
    // Only update tmdbId if it was explicitly provided in the request
    if (tmdbIdProvided) {
      smartlink.tmdbId = finalTmdbId;
    }
    if (priority !== undefined) smartlink.priority = parseInt(priority);
    if (isActive !== undefined) smartlink.isActive = isActive;
    
    smartlink.updatedBy = req.user.id;

    await smartlink.save();

    logger.info(`Ads link updated: ${smartlink._id} by ${req.user.username}${finalTmdbId ? ` with TMDB ID ${finalTmdbId}` : ''}`);

    res.json({
      success: true,
      message: 'Ads link updated successfully',
      data: smartlink
    });
  } catch (error) {
    logger.error('Error updating ads link:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update ads link'
    });
  }
});

// Delete ads link
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ads link ID'
      });
    }

    const smartlink = await SmartLink.findById(id);

    if (!smartlink) {
      return res.status(404).json({
        success: false,
        message: 'Ads link not found'
      });
    }

    await smartlink.deleteOne();

    logger.info(`Ads link deleted: ${smartlink._id} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Ads link deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting ads link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ads link'
    });
  }
});

module.exports = router;
