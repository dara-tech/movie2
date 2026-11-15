const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware that attempts to authenticate the request but allows anonymous access.
 * If a valid Bearer token is provided, the decoded user document is attached to req.user.
 * If no token (or invalid token) is provided, the request continues as anonymous.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');

    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Swallow token errors silently so anonymous traffic is still allowed,
    // but log for observability.
  }

  next();
};

module.exports = optionalAuth;

