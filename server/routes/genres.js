const express = require('express');
const router = express.Router();
const Genre = require('../models/Genre');
const TvShow = require('../models/TvShow');
const Movie = require('../models/Movie');
const logger = require('../utils/logger');

// Get genres with movie counts
router.get('/movies/with-counts', async (req, res) => {
  try {
    const allGenres = await Genre.find().lean();
    
    // Count movies for each genre
    const genresWithCounts = await Promise.all(
      allGenres.map(async (genre) => {
        const count = await Movie.countDocuments({ 
          genres: genre._id, 
          isAvailable: true 
        });
        return {
          ...genre,
          movieCount: count
        };
      })
    );
    
    // Filter out genres with 0 movies and sort by count descending
    const genresWithMovies = genresWithCounts
      .filter(genre => genre.movieCount > 0)
      .sort((a, b) => b.movieCount - a.movieCount);
    
    res.json({
      success: true,
      genres: genresWithMovies
    });
  } catch (error) {
    logger.error('Error fetching genres with movie counts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching genres with movie counts' 
    });
  }
});

// Get genres with TV show counts
router.get('/with-counts', async (req, res) => {
  try {
    const allGenres = await Genre.find().lean();
    
    // Count TV shows for each genre
    const genresWithCounts = await Promise.all(
      allGenres.map(async (genre) => {
        const count = await TvShow.countDocuments({ 
          genres: genre._id, 
          isAvailable: true 
        });
        return {
          ...genre,
          tvShowCount: count
        };
      })
    );
    
    // Filter out genres with 0 shows and sort by count descending
    const genresWithShows = genresWithCounts
      .filter(genre => genre.tvShowCount > 0)
      .sort((a, b) => b.tvShowCount - a.tvShowCount);
    
    res.json({
      success: true,
      genres: genresWithShows
    });
  } catch (error) {
    logger.error('Error fetching genres with TV show counts:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching genres with counts' 
    });
  }
});

// Get all genres
router.get('/', async (req, res) => {
  try {
    const genres = await Genre.find().sort({ name: 1 });
    res.json({
      success: true,
      genres: Array.isArray(genres) ? genres : []
    });
  } catch (error) {
    logger.error('Error fetching genres:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching genres' 
    });
  }
});

// Get genre by ID
router.get('/:id', async (req, res) => {
  try {
    const genre = await Genre.findById(req.params.id);
    
    if (!genre) {
      return res.status(404).json({ message: 'Genre not found' });
    }

    res.json(genre);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching genre' });
  }
});

module.exports = router;
