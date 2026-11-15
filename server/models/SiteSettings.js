const mongoose = require('mongoose');

const SiteSettingsSchema = new mongoose.Schema(
  {
    logo: {
      url: { type: String, default: null },
      type: { type: String, enum: ['url', 'upload', 'text'], default: 'text' },
      text: { type: String, default: 'MOVIESTREAM' }, // Text logo if no image (for backward compatibility)
      textFirst: { type: String, default: 'MOVIE' }, // First part of text logo (white)
      textSecond: { type: String, default: 'STREAM' }, // Second part of text logo (red)
      addSpace: { type: Boolean, default: false }, // Whether to add space between parts
      updatedAt: { type: Date, default: Date.now }
    },
    siteName: { type: String, default: 'MovieStream' },
    siteDescription: { type: String, default: 'Your Gateway to Entertainment' },
    primaryColor: { type: String, default: '#dc2626' }, // red-600
    telegram: {
      botToken: { type: String, default: null },
      chatId: { type: String, default: null },
      siteUrl: { type: String, default: null }, // Site URL for links in notifications
      enabled: { type: Boolean, default: false },
      notifyNewMovies: { type: Boolean, default: true },
      notifyNewTvShows: { type: Boolean, default: true },
      autoPostEveryMinute: { type: Boolean, default: true },
      groupLink: { type: String, default: 'https://t.me/moviestreamhdfree' },
      updatedAt: { type: Date, default: Date.now }
    },
    twitter: {
      apiKey: { type: String, default: null },
      apiSecret: { type: String, default: null },
      bearerToken: { type: String, default: null },
      accessToken: { type: String, default: null },
      accessTokenSecret: { type: String, default: null },
      siteUrl: { type: String, default: null }, // Site URL for links in posts
      enabled: { type: Boolean, default: false },
      postDailyTopMovies: { type: Boolean, default: false },
      notifyNewMovies: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now }
    },
    reddit: {
      clientId: { type: String, default: null },
      clientSecret: { type: String, default: null },
      username: { type: String, default: null },
      password: { type: String, default: null },
      subreddit: { type: String, default: null }, // e.g. "moviestream" or "movies"
      siteUrl: { type: String, default: null }, // Site URL for links in posts
      postType: { type: String, enum: ['link', 'self'], default: 'link' }, // 'link' or 'self' (markdown text)
      enabled: { type: Boolean, default: false },
      notifyNewMovies: { type: Boolean, default: true },
      notifyNewTvShows: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now }
    },
    pinterest: {
      accessToken: { type: String, default: null },
      boardId: { type: String, default: null },
      siteUrl: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      notifyNewMovies: { type: Boolean, default: true },
      notifyNewTvShows: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now }
    },
    bluesky: {
      handle: { type: String, default: null }, // e.g. moviestream.bsky.social
      appPassword: { type: String, default: null }, // e.g. xxxx-xxxx-xxxx-xxxx
      siteUrl: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      notifyNewMovies: { type: Boolean, default: true },
      notifyNewTvShows: { type: Boolean, default: true },
      autoPostEveryMinute: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now }
    },
    tumblr: {
      consumerKey: { type: String, default: null },
      consumerSecret: { type: String, default: null },
      accessToken: { type: String, default: null },
      accessTokenSecret: { type: String, default: null },
      blogIdentifier: { type: String, default: 'freemoviestreamhd' },
      siteUrl: { type: String, default: null },
      enabled: { type: Boolean, default: false },
      autoPostEveryMinute: { type: Boolean, default: true },
      postIntervalMinutes: { type: Number, default: 10 },
      onlyGreatContent: { type: Boolean, default: true },
      notifyNewMovies: { type: Boolean, default: true },
      notifyNewTvShows: { type: Boolean, default: true },
      updatedAt: { type: Date, default: Date.now }
    },
    streaming: {
      defaultServerId: { type: String, default: 'vidsrcme.ru' },
      disabledServerIds: { type: [String], default: [] },
      updatedAt: { type: Date, default: Date.now }
    },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastModifiedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

// Ensure only one settings document exists
SiteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('SiteSettings', SiteSettingsSchema);

