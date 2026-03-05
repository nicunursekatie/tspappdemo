/**
 * Session Utilities - Promisified Session Operations
 *
 * Provides promisified wrappers for express-session operations to prevent
 * race conditions and ensure sessions are persisted before responses are sent.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-009
 */

import { Request } from 'express';
import { logger } from './production-safe-logger';

/**
 * Promisified session save operation
 * Ensures session is persisted to store before continuing
 *
 * @param req - Express request object with session
 * @returns Promise that resolves when session is saved
 * @throws Error if session is not initialized or save fails
 *
 * @example
 * // Before (race condition):
 * req.session.user = user;
 * req.session.save((err) => {
 *   if (err) return res.status(500).json({ error: 'Failed' });
 *   res.json({ success: true });  // May respond before save completes!
 * });
 *
 * // After (fixed):
 * req.session.user = user;
 * await saveSession(req);
 * res.json({ success: true });  // Session guaranteed to be saved
 */
export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      const error = new Error('Session not initialized');
      logger.error('Session save failed - session not initialized', {
        path: req.path,
        method: req.method
      });
      return reject(error);
    }

    req.session.save((err) => {
      if (err) {
        logger.error('Session save error', {
          error: err,
          sessionID: req.sessionID,
          path: req.path,
          method: req.method
        });
        reject(err);
      } else {
        logger.debug('Session saved successfully', {
          sessionID: req.sessionID,
          path: req.path
        });
        resolve();
      }
    });
  });
}

/**
 * Promisified session destroy operation
 * Ensures session is removed from store
 *
 * @param req - Express request object with session
 * @returns Promise that resolves when session is destroyed
 *
 * @example
 * // Logout endpoint
 * await destroySession(req);
 * res.clearCookie('tsp.session');
 * res.json({ success: true, message: 'Logged out' });
 */
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      // No session to destroy - resolve immediately
      logger.debug('No session to destroy', { path: req.path });
      return resolve();
    }

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error', {
          error: err,
          sessionID: req.sessionID,
          path: req.path
        });
        reject(err);
      } else {
        logger.debug('Session destroyed successfully', {
          sessionID: req.sessionID,
          path: req.path
        });
        resolve();
      }
    });
  });
}

/**
 * Promisified session regeneration
 * Creates a new session ID (useful after login for security)
 *
 * @param req - Express request object with session
 * @returns Promise that resolves when new session is created
 *
 * @example
 * // After successful login
 * await regenerateSession(req);
 * req.session.user = validatedUser;
 * await saveSession(req);
 * res.json({ success: true });
 */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      const error = new Error('Session not initialized');
      logger.error('Session regenerate failed - session not initialized', {
        path: req.path
      });
      return reject(error);
    }

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regenerate error', {
          error: err,
          path: req.path
        });
        reject(err);
      } else {
        logger.debug('Session regenerated successfully', {
          newSessionID: req.sessionID,
          path: req.path
        });
        resolve();
      }
    });
  });
}

/**
 * Promisified session reload
 * Reloads session data from the store
 *
 * @param req - Express request object with session
 * @returns Promise that resolves when session is reloaded
 *
 * @example
 * // Refresh session data from store
 * await reloadSession(req);
 * const currentUser = req.session.user;
 */
export function reloadSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      const error = new Error('Session not initialized');
      logger.error('Session reload failed - session not initialized', {
        path: req.path
      });
      return reject(error);
    }

    req.session.reload((err) => {
      if (err) {
        logger.error('Session reload error', {
          error: err,
          sessionID: req.sessionID,
          path: req.path
        });
        reject(err);
      } else {
        logger.debug('Session reloaded successfully', {
          sessionID: req.sessionID,
          path: req.path
        });
        resolve();
      }
    });
  });
}

/**
 * Safely save session with error handling
 * Logs error but doesn't throw (useful for non-critical session updates)
 *
 * @param req - Express request object with session
 * @returns Promise that resolves even if save fails
 *
 * @example
 * // Update session but don't fail request if save fails
 * req.session.lastActive = new Date();
 * await safeSaveSession(req);  // Continues even if save fails
 */
export async function safeSaveSession(req: Request): Promise<boolean> {
  try {
    await saveSession(req);
    return true;
  } catch (error) {
    logger.error('Safe session save failed (non-critical)', {
      error,
      sessionID: req.sessionID,
      path: req.path
    });
    return false;
  }
}
