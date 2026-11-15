const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie'
  },
  tvShow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TvShow'
  },
  // Support for hybrid system: Store TMDB ID if content not in database
  tmdbId: {
    type: Number,
    index: true
  },
  type: {
    type: String,
    enum: ['movie', 'tvshow'],
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['plan_to_watch', 'watching', 'completed', 'dropped'],
    default: 'plan_to_watch'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String
  },
  watchedAt: {
    type: Date
  },
  progress: {
    currentEpisode: {
      type: Number,
      default: 0
    },
    currentSeason: {
      type: Number,
      default: 1
    }
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  favoritedAt: {
    type: Date
  }
});

// Ensure one item per user in watchlist (either movie or tvshow)
// Support both database references and TMDB IDs
watchlistSchema.index({ user: 1, movie: 1 }, { unique: true, partialFilterExpression: { movie: { $exists: true, $type: 'objectId' } } });
watchlistSchema.index({ user: 1, tvShow: 1 }, { unique: true, partialFilterExpression: { tvShow: { $exists: true, $type: 'objectId' } } });
watchlistSchema.index({ user: 1, tmdbId: 1, type: 1 }, { unique: true, partialFilterExpression: { tmdbId: { $exists: true } } });
watchlistSchema.index({ user: 1, isFavorite: 1 }); // For favorites queries
watchlistSchema.index({ user: 1, addedAt: -1 }); // For sorting by date added

module.exports = mongoose.model('Watchlist', watchlistSchema);
