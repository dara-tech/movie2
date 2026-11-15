const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  tmdbId: {
    type: Number,
    required: false
  },
  imdbId: {
    type: String,
    required: false
  },
  title: {
    type: String,
    required: true
  },
  overview: {
    type: String,
    required: true
  },
  releaseDate: {
    type: Date,
    required: true
  },
  posterPath: {
    type: String,
    required: true
  },
  backdropPath: {
    type: String
  },
  genres: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Genre'
  }],
  runtime: {
    type: Number
  },
  voteAverage: {
    type: Number,
    default: 0
  },
  voteCount: {
    type: Number,
    default: 0
  },
  adult: {
    type: Boolean,
    default: false
  },
  originalLanguage: {
    type: String,
    default: 'en'
  },
  originCountry: {
    type: [String],
    default: []
  },
  productionCountries: {
    type: [{
      isoCode: String,
      name: String
    }],
    default: []
  },
  originalTitle: {
    type: String
  },
  popularity: {
    type: Number,
    default: 0
  },
  video: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  watchProviders: {
    flatrate: [{
      providerId: Number,
      providerName: String,
      logoPath: String
    }],
    buy: [{
      providerId: Number,
      providerName: String,
      logoPath: String
    }],
    rent: [{
      providerId: Number,
      providerName: String,
      logoPath: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  telegramPostedAt: {
    type: Date,
    default: null
  },
  blueskyPostedAt: {
    type: Date,
    default: null
  },
  tumblrPostedAt: {
    type: Date,
    default: null
  }
});

movieSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Database indexes for performance
movieSchema.index({ tmdbId: 1 }, { unique: true, sparse: true });
movieSchema.index({ imdbId: 1 }, { unique: true, sparse: true });
movieSchema.index({ title: 'text', overview: 'text' }); // Text search
movieSchema.index({ releaseDate: -1 }); // Sort by release date
movieSchema.index({ popularity: -1 }); // Sort by popularity
movieSchema.index({ voteAverage: -1 }); // Sort by rating
movieSchema.index({ createdAt: -1 }); // Sort by creation date
movieSchema.index({ isAvailable: 1 }); // Filter by availability
movieSchema.index({ telegramPostedAt: 1, createdAt: -1 }); // Index for Telegram auto-poster
movieSchema.index({ blueskyPostedAt: 1, createdAt: -1 }); // Index for Bluesky auto-poster
movieSchema.index({ tumblrPostedAt: 1, createdAt: -1 }); // Index for Tumblr auto-poster

module.exports = mongoose.model('Movie', movieSchema);
