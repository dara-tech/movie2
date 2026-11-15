const mongoose = require('mongoose');

const userActivitySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    userType: {
      type: String,
      enum: ['anonymous', 'authenticated'],
      default: 'anonymous'
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'page_view',
        'search',
        'movie_play',
        'tv_play',
        'watch_completion',
        'watchlist_add',
        'watchlist_remove',
        'favorite_add',
        'favorite_remove',
        'watch_history',
        'filter',
        'navigation',
        'interaction',
        'error',
        'custom'
      ],
      default: 'custom'
    },
    path: {
      type: String
    },
    query: {
      type: Object,
      default: {}
    },
    referrer: {
      type: String
    },
    searchTerm: {
      type: String
    },
    contentType: {
      type: String,
      enum: ['movie', 'tvshow', 'cast', 'collection', null],
      default: null
    },
    contentId: {
      type: String,
      default: null
    },
    season: {
      type: Number
    },
    episode: {
      type: Number
    },
    watchPosition: {
      type: Number
    },
    duration: {
      type: Number
    },
    device: {
      type: String
    },
    browser: {
      type: String
    },
    locale: {
      type: String
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

userActivitySchema.index({ createdAt: -1 });
userActivitySchema.index({ sessionId: 1, createdAt: -1 });
userActivitySchema.index({ user: 1, createdAt: -1 });
userActivitySchema.index({ eventType: 1, createdAt: -1 });

module.exports = mongoose.model('UserActivity', userActivitySchema);

