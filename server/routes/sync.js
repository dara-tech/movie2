const express = require('express');
const router = express.Router();
const tmdbService = require('../services/tmdbService');
const vidsrcService = require('../services/vidsrcService');
const Movie = require('../models/Movie');
const TvShow = require('../models/TvShow');

// Sync movies from TMDB to database
router.post('/movies', async (req, res) => {
  try {
    await tmdbService.syncMoviesToDatabase();
    res.json({ message: 'Movies synced successfully from TMDB' });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing movies from TMDB' });
  }
});

// Sync genres from TMDB to database
router.post('/genres', async (req, res) => {
  try {
    const Genre = require('../models/Genre');
    const genresResponse = await tmdbService.getGenres();
    
    for (const genre of genresResponse.genres) {
      await Genre.findOneAndUpdate(
        { tmdbId: genre.id },
        { name: genre.name },
        { upsert: true, new: true }
      );
    }
    
    res.json({ message: 'Genres synced successfully from TMDB' });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing genres from TMDB' });
  }
});

// Sync TV shows from TMDB to database
router.post('/tvshows', async (req, res) => {
  try {
    const { 
      maxPages = 5, 
      categories = 'popular,trending,top_rated,on_the_air',
      includeGenres = true 
    } = req.query;
    
    
    // Parse categories
    const categoryList = categories.split(',').map(cat => cat.trim());
    
    // Use the comprehensive sync method
    const result = await tmdbService.syncTvShowsToDatabase({
      maxPages: parseInt(maxPages),
      categories: categoryList,
      includeGenres: includeGenres === 'true'
    });
    
    res.json({ 
      message: 'TV shows synced successfully from TMDB',
      synced: result.synced,
      errors: result.errors,
      categories: categoryList,
      maxPages: parseInt(maxPages)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error syncing TV shows from TMDB' });
  }
});

// Bulk sync TV shows from TMDB (comprehensive sync)
router.post('/tvshows/bulk', async (req, res) => {
  try {
    const { 
      maxPages = 10, 
      categories = 'popular,trending,top_rated,on_the_air,airing_today',
      includeGenres = true,
      skipExisting = true
    } = req.body;
    
    
    // Parse categories
    const categoryList = Array.isArray(categories) ? categories : categories.split(',').map(cat => cat.trim());
    
    // Use the comprehensive sync method
    const result = await tmdbService.syncTvShowsToDatabase({
      maxPages: parseInt(maxPages),
      categories: categoryList,
      includeGenres: includeGenres === true || includeGenres === 'true'
    });
    
    res.json({ 
      message: 'Bulk TV show sync completed successfully',
      synced: result.synced,
      errors: result.errors,
      categories: categoryList,
      maxPages: parseInt(maxPages),
      includeGenres: includeGenres === true || includeGenres === 'true'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error during bulk TV show sync from TMDB' });
  }
});

// Note: Streaming URLs are now generated on-the-fly from tmdbId/imdbId
// No need to store them in the database

module.exports = router;
