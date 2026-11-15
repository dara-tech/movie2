const mongoose = require('mongoose');
const logger = require('../utils/logger');

const smartLinkSchema = new mongoose.Schema({
  // Content reference (optional - not needed for general ads)
  // Note: Removed contentId field - ads links don't need to reference specific content
  // They work based on contentType only (general, movie, or tvshow)
  contentType: {
    type: String,
    enum: ['movie', 'tvshow', 'general'],
    default: 'general',
    index: true
  },
  // TMDB ID for hybrid system support
  tmdbId: {
    type: Number,
    index: true,
    sparse: true
  },
  // Ad link details
  title: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP or HTTPS URL'
    }
  },
  imageUrl: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Optional
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Image URL must be a valid HTTP or HTTPS URL'
    }
  },
  // Priority/order for display
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  // Status flags
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Click tracking
  clickCount: {
    type: Number,
    default: 0
  },
  lastClicked: {
    type: Date
  },
  // Admin metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
smartLinkSchema.index({ contentType: 1, isActive: 1, priority: -1 });
smartLinkSchema.index({ tmdbId: 1, contentType: 1 });

// Instance method to increment click count
smartLinkSchema.methods.incrementClick = async function() {
  this.clickCount += 1;
  this.lastClicked = new Date();
  await this.save();
};

  // Static method to get ads links for content
smartLinkSchema.statics.getAdsForContent = async function(contentType, contentId, tmdbId = null) {
  const query = {
    isActive: true,
    contentType: { $in: [contentType, 'general'] }
  };

  // For ads links, we don't filter by contentId - they're general ads
  // This query just gets ads matching the content type or general

  return await this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .lean();
};

module.exports = mongoose.model('SmartLink', smartLinkSchema);
