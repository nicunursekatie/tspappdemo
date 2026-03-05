/**
 * Prototype Pollution Guard Middleware
 *
 * Global middleware to detect and block prototype pollution attempts
 * in request bodies and query parameters.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-010
 */

import { RequestHandler } from 'express';
import { validateNoPrototypePollution } from '../utils/object-utils';
import { logger } from '../utils/production-safe-logger';

/**
 * Middleware to detect and block prototype pollution attempts
 * Should be added after body parser middleware
 *
 * @example
 * app.use(express.json());
 * app.use(prototypePollutionGuard);
 */
export const prototypePollutionGuard: RequestHandler = (req, res, next) => {
  try {
    // Check request body for pollution attempts
    if (req.body && typeof req.body === 'object') {
      validateNoPrototypePollution(req.body);
    }

    // Check query parameters for pollution attempts
    if (req.query && typeof req.query === 'object') {
      validateNoPrototypePollution(req.query);
    }

    // All checks passed
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Prototype pollution attempt blocked by middleware', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
      userAgent: req.get('User-Agent'),
      error: errorMessage
    });

    // Return 400 Bad Request with generic error message
    // Don't reveal specific security details to potential attackers
    res.status(400).json({
      error: 'Invalid request: prohibited property names detected',
      message: 'The request contains invalid property names and has been rejected for security reasons.'
    });
  }
};
