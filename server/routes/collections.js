const express = require('express');
const router = express.Router();
const tmdbService = require('../services/tmdbService');

// Daily cache - resets each day
const dailyCache = {
  data: null,
  date: null
};

const getTodayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
};

// Generate random collections from top movies
const generateCollections = async () => {
  try {
    // Fetch different categories of top movies
    const [popular, trending, topRated] = await Promise.all([
      tmdbService.getPopularMovies(1),
      tmdbService.getTrendingMovies(1),
      tmdbService.getTopRatedMovies(1)
    ]);

    // Combine and shuffle movies
    const allMovies = [
      ...(popular.results || []),
      ...(trending.results || []),
      ...(topRated.results || [])
    ];

    // Remove duplicates by ID
    const uniqueMovies = Array.from(
      new Map(allMovies.map(movie => [movie.id, movie])).values()
    );

    // Shuffle array for randomness
    const shuffled = uniqueMovies.sort(() => Math.random() - 0.5);

    // Create themed collections
    const collections = [];

    // Collection 1: Blockbuster Hits (high popularity)
    const blockbusters = shuffled
      .filter(m => m.popularity > 50 && m.vote_average > 7)
      .slice(0, 8);
    if (blockbusters.length >= 4) {
      collections.push({
        id: 'blockbusters',
        title: 'Blockbuster Hits',
        description: 'The biggest and most popular films',
        movies: blockbusters.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Collection 2: Critically Acclaimed (high rating)
    const acclaimed = shuffled
      .filter(m => m.vote_average >= 8 && m.vote_count > 1000)
      .slice(0, 8);
    if (acclaimed.length >= 4) {
      collections.push({
        id: 'acclaimed',
        title: 'Critically Acclaimed',
        description: 'Highest rated by audiences',
        movies: acclaimed.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Collection 3: Trending Now
    const trendingMovies = (trending.results || []).slice(0, 8);
    if (trendingMovies.length >= 4) {
      collections.push({
        id: 'trending',
        title: 'Trending Now',
        description: 'What everyone is watching',
        movies: trendingMovies.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Collection 4: Recent Releases (last 2 years)
    const currentYear = new Date().getFullYear();
    const recent = shuffled
      .filter(m => {
        if (!m.release_date) return false;
        const year = new Date(m.release_date).getFullYear();
        return year >= currentYear - 2;
      })
      .slice(0, 8);
    if (recent.length >= 4) {
      collections.push({
        id: 'recent',
        title: 'Recent Releases',
        description: 'Fresh from the theaters',
        movies: recent.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Collection 5: Hidden Gems (good rating but lower popularity)
    const hiddenGems = shuffled
      .filter(m => m.vote_average >= 7.5 && m.popularity < 30 && m.vote_count > 500)
      .slice(0, 8);
    if (hiddenGems.length >= 4) {
      collections.push({
        id: 'hidden-gems',
        title: 'Hidden Gems',
        description: 'Underrated treasures worth discovering',
        movies: hiddenGems.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Collection 6: Classic Favorites (older but highly rated)
    const classics = shuffled
      .filter(m => {
        if (!m.release_date) return false;
        const year = new Date(m.release_date).getFullYear();
        return year < currentYear - 10 && m.vote_average >= 8;
      })
      .slice(0, 8);
    if (classics.length >= 4) {
      collections.push({
        id: 'classics',
        title: 'Classic Favorites',
        description: 'Timeless masterpieces',
        movies: classics.map(m => ({
          tmdbId: m.id,
          title: m.title,
          posterPath: m.poster_path,
          backdropPath: m.backdrop_path,
          releaseDate: m.release_date,
          voteAverage: m.vote_average
        }))
      });
    }

    // Shuffle collections for variety
    return collections.sort(() => Math.random() - 0.5).slice(0, 6);
  } catch (error) {
    throw error;
  }
};

router.get('/', async (req, res) => {
  try {
    const todayKey = getTodayKey();

    // Check if we have cached data for today
    if (dailyCache.date === todayKey && dailyCache.data) {
      return res.json({
        collections: dailyCache.data,
        cached: true
      });
    }

    // Generate new collections for today
    const collections = await generateCollections();

    // Cache for today
    dailyCache.data = collections;
    dailyCache.date = todayKey;

    res.json({
      collections,
      cached: false
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching collections',
      error: error.message
    });
  }
});

module.exports = router;

