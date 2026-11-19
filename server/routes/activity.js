const express = require('express');
const { v4: uuidv4 } = require('uuid');
const optionalAuth = require('../middleware/optionalAuth');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const UserActivity = require('../models/UserActivity');

const router = express.Router();
/**
 * Normalize a raw event payload and enrich it with metadata from the request.
 */
const normalizeEvent = (event = {}, req) => {
  const sessionId =
    event.sessionId ||
    req.header('x-session-id') ||
    req.cookies?.sessionId ||
    uuidv4();

  const referrer = event.referrer || req.get('referer') || null;
  const path = event.path || req.body.path || req.originalUrl;
  const query = event.query || req.body.query || {};
  const userAgent = req.get('user-agent');

  const metadata = typeof event.metadata === 'object' && event.metadata !== null
    ? event.metadata
    : {};

  const baseEvent = {
    sessionId,
    user: req.user?._id || null,
    userType: req.user ? 'authenticated' : 'anonymous',
    eventType: event.eventType || 'custom',
    path,
    query,
    referrer,
    searchTerm: event.searchTerm,
    contentType: event.contentType,
    contentId: event.contentId,
    season: event.season,
    episode: event.episode,
    watchPosition: event.watchPosition,
    duration: event.duration,
    device: event.device,
    browser: event.browser,
    locale: event.locale || req.get('accept-language'),
    ipAddress: req.ip || req.connection?.remoteAddress,
    userAgent,
    metadata
  };

  return baseEvent;
};

/**
 * POST /api/activity/events
 * Accepts a single event or an array of events and stores them for analytics.
 * Anonymous traffic is allowed; authenticated users get their userId attached automatically.
 */
router.post('/events', optionalAuth, async (req, res) => {
  try {
    const rawEvents = Array.isArray(req.body?.events)
      ? req.body.events
      : Array.isArray(req.body)
      ? req.body
      : [req.body];

    // Guard against empty payloads
    const filtered = rawEvents
      .filter(Boolean)
      .filter(event => typeof event === 'object');

    if (filtered.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No events provided'
      });
    }

    if (filtered.length > 50) {
      return res.status(413).json({
        success: false,
        message: 'Too many events in a single request (max 50)'
      });
    }

    const documents = filtered.map(event => normalizeEvent(event, req));
    await UserActivity.insertMany(documents, { ordered: false });

    res.json({
      success: true,
      count: documents.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to record user activity'
    });
  }
});

/**
 * GET /api/activity/session/:sessionId
 * Fetch recent activity for a given session (admin use / debugging).
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      userType,
      eventType,
      contentType,
      userId,
      sessionId,
      search,
      from,
      to,
      sort = 'recent'
    } = req.query;

    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100);
    const query = {};

    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    if (eventType && eventType !== 'all') {
      query.eventType = eventType;
    }
    if (contentType && contentType !== 'all') {
      query.contentType = contentType;
    }
    if (userId) {
      query.user = userId;
    }
    if (sessionId) {
      query.sessionId = sessionId;
    }
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to);
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { path: searchRegex },
        { referrer: searchRegex },
        { searchTerm: searchRegex },
        { sessionId: searchRegex },
        { 'metadata.title': searchRegex },
        { 'metadata.action': searchRegex },
      ];
    }

    const sortOptions = (() => {
      switch (sort) {
        case 'oldest':
          return { createdAt: 1 };
        case 'duration_desc':
          return { duration: -1, createdAt: -1 };
        case 'duration_asc':
          return { duration: 1, createdAt: -1 };
        default:
          return { createdAt: -1 };
      }
    })();

    const skip = (numericPage - 1) * numericLimit;

    const matchStage = Object.keys(query).length ? [{ $match: query }] : [];

    const [events, total, byEventType, byUserType] = await Promise.all([
      UserActivity.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(numericLimit)
        .populate('user', 'username email role')
        .lean(),
      UserActivity.countDocuments(query),
      UserActivity.aggregate([
        ...matchStage,
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      UserActivity.aggregate([
        ...matchStage,
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: numericPage,
          limit: numericLimit,
          total,
          totalPages: Math.max(1, Math.ceil(total / numericLimit))
        },
        breakdown: {
          byEventType,
          byUserType
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user activities' });
  }
});

router.get('/session/:sessionId', requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Session ID is required' });
    }

    const activities = await UserActivity.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit || 100, 10));

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch session activity' });
  }
});

/**
 * GET /api/activity/user/:userId
 * Fetch recent activity for a specific authenticated user.
 */
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const activities = await UserActivity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit || 100, 10));

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user activity' });
  }
});

module.exports = router;

