const logger = require('../utils/logger');

/**
 * Centralized error handler middleware
 * Provides consistent error response format across all routes
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    error: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Determine status code
  const status = err.status || err.statusCode || 500;

  // Build error response
  const errorResponse = {
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err,
    }),
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    errorResponse.message = 'Validation error';
    errorResponse.errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json(errorResponse);
  }

  if (err.name === 'CastError') {
    errorResponse.message = 'Invalid ID format';
    return res.status(400).json(errorResponse);
  }

  if (err.name === 'JsonWebTokenError') {
    errorResponse.message = 'Invalid token';
    return res.status(401).json(errorResponse);
  }

  if (err.name === 'TokenExpiredError') {
    errorResponse.message = 'Token expired';
    return res.status(401).json(errorResponse);
  }

  // Default error response
  res.status(status).json(errorResponse);
};

module.exports = errorHandler;

