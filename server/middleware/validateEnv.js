const logger = require('../utils/logger');

/**
 * Validates that all required environment variables are set
 * Should be called at application startup
 */
const validateEnv = () => {
  const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
  ];

  const missingVars = [];

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  // Validate JWT_SECRET is not default
  if (process.env.JWT_SECRET === 'your-secret-key' || process.env.JWT_SECRET === 'your_jwt_secret_here') {
    logger.warn('JWT_SECRET is using default value. Please set a secure secret in production.');
  }

  logger.info('Environment variables validated successfully');
};

module.exports = validateEnv;

