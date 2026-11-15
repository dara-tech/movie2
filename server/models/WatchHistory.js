const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema({
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
    enum: ['movie', 'tvshow']
  },
  watchedAt: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in seconds
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  lastPosition: {
    type: Number, // in seconds
    default: 0
  },
  season: {
    type: Number,
    default: 1
  },
  episode: {
    type: Number,
    default: 1
  }
});

// Ensure either movie, tvShow, or tmdbId is provided
watchHistorySchema.pre('validate', function(next) {
  const hasReference = !!(this.movie || this.tvShow);
  const hasTmdbId = !!this.tmdbId;
  
  if (!hasReference && !hasTmdbId) {
    return next(new Error('Either movie/tvShow reference or tmdbId must be provided'));
  }
  if (this.movie && this.tvShow) {
    return next(new Error('Cannot have both movie and tvShow'));
  }
  next();
});

// Index for efficient queries
watchHistorySchema.index({ user: 1, watchedAt: -1 });
watchHistorySchema.index({ user: 1, movie: 1 });
watchHistorySchema.index({ user: 1, tvShow: 1, season: 1, episode: 1 });
watchHistorySchema.index({ user: 1, tmdbId: 1, type: 1 }); // For hybrid system

module.exports = mongoose.model('WatchHistory', watchHistorySchema);
