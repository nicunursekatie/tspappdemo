/**
 * JSON Validation Middleware
 *
 * Catches malformed JSON in request bodies before they reach route handlers.
 * Prevents server crashes from SyntaxError exceptions.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-008
 */

import { ErrorRequestHandler } from 'express';
import { logger } from '../utils/production-safe-logger';

/**
 * Error handler middleware to catch malformed JSON in request body
 * Must be added AFTER express.json() middleware
 *
 * @example
 * app.use(express.json());
 * app.use(jsonErrorHandler);
 */
export const jsonErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Check if this is a JSON parsing error from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    logger.error('Malformed JSON in request body', {
      path: req.path,
      method: req.method,
      error: err.message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id
    });

    return res.status(400).json({
      error: 'Invalid JSON in request body',
      message: 'Request body contains malformed JSON. Please check your request format.',
      details: err.message
    });
  }

  // Not a JSON error - pass to next error handler
  next(err);
};
