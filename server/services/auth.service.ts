/**
 * Authentication Service
 *
 * Centralized authentication logic for The Sandwich Project
 * - Password verification with bcrypt only (no plaintext fallback)
 * - Session creation
 * - Password hashing
 * - Standardized error handling
 */

import bcrypt from 'bcrypt';
import { logger } from '../utils/production-safe-logger';
import type { Request } from 'express';

const SALT_ROUNDS = 10;

/**
 * User data structure for authentication
 */
export interface AuthUser {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  profileImageUrl?: string | null;
  role: string;
  isActive: boolean;
  permissions?: string[];
}

/**
 * Session user data (what gets stored in the session)
 */
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
}

/**
 * Authentication errors
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Verify a password against a stored hash
   * Only accepts bcrypt hashes - no plaintext fallback
   */
  async verifyPassword(plainPassword: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) {
      throw new AuthError(
        'No password hash found. Please reset your password.',
        'NO_PASSWORD_HASH',
        401
      );
    }

    // Check if hash looks like a bcrypt hash
    if (!storedHash.startsWith('$2b$') && !storedHash.startsWith('$2a$')) {
      logger.warn('Non-bcrypt password hash detected - forcing password reset');
      throw new AuthError(
        'Your password must be reset. Please use the password reset link.',
        'PASSWORD_RESET_REQUIRED',
        403
      );
    }

    try {
      // Trim the input password to match registration behavior
      const isValid = await bcrypt.compare(plainPassword.trim(), storedHash);
      return isValid;
    } catch (error) {
      logger.error('Error verifying password:', error);
      throw new AuthError(
        'Error verifying password',
        'VERIFICATION_ERROR',
        500
      );
    }
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(plainPassword: string): Promise<string> {
    try {
      // Trim password before hashing to match login behavior
      const hashedPassword = await bcrypt.hash(plainPassword.trim(), SALT_ROUNDS);
      return hashedPassword;
    } catch (error) {
      logger.error('Error hashing password:', error);
      throw new AuthError(
        'Error hashing password',
        'HASH_ERROR',
        500
      );
    }
  }

  /**
   * Create a session user object from a full user object
   */
  createSessionUser(user: AuthUser, permissions: string[]): SessionUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl || null,
      role: user.role,
      permissions,
      isActive: user.isActive,
    };
  }

  /**
   * Save user to session
   */
  async saveSession(req: Request, sessionUser: SessionUser): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.user = sessionUser;
      req.session.save((err) => {
        if (err) {
          logger.error('Session save error:', err);
          reject(new AuthError(
            'Error saving session',
            'SESSION_ERROR',
            500
          ));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Destroy session (logout)
   */
  async destroySession(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Session destroy error:', err);
          reject(new AuthError(
            'Error destroying session',
            'SESSION_ERROR',
            500
          ));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Validate that a user account is active
   */
  validateUserActive(user: AuthUser): void {
    if (!user.isActive) {
      throw new AuthError(
        'Your account is pending approval. You will be notified once an admin reviews your application.',
        'PENDING_APPROVAL',
        403
      );
    }
  }

  /**
   * Validate login credentials
   */
  validateLoginInput(email?: string, password?: string): void {
    if (!email || !password) {
      throw new AuthError(
        'Email and password are required',
        'MISSING_CREDENTIALS',
        400
      );
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
