import type { Express, RequestHandler } from 'express';
import { storage } from './storage-wrapper';
import { getDefaultPermissionsForRole as getSharedPermissions } from '../shared/auth-utils';
import bcrypt from 'bcrypt';
import { logger } from './utils/production-safe-logger';
import { saveSession } from './utils/session-utils';

// Using shared permissions from auth-utils

function getDefaultPermissionsForRole(role: string): string[] {
  return getSharedPermissions(role);
}

// Committee-specific permission checking
export const requireCommitteeAccess = (
  committeeId?: string
): RequestHandler => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = req.user;

    // Admins have access to all committees
    if (
      user.role === 'admin' ||
      user.role === 'admin_coordinator' ||
      user.role === 'admin_viewer'
    ) {
      return next();
    }

    // For committee members, check specific committee access
    if (user.role === 'committee_member' && committeeId) {
      try {
        const isMember = await storage.isUserCommitteeMember(
          user.id,
          committeeId
        );
        if (!isMember) {
          return res
            .status(403)
            .json({ message: 'Access denied: Not a member of this committee' });
        }
      } catch (error) {
        logger.error('Error checking committee membership:', error);
        return res
          .status(500)
          .json({ message: 'Error verifying committee access' });
      }
    }

    next();
  };
};

// Extend session and request types
declare module 'express-session' {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
      role: string;
      permissions: string[];
      isActive: boolean;
    };
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        profileImageUrl: string | null;
        role: string;
        permissions: string[];
        isActive: boolean;
      };
    }
  }
}

/**
 * DEPRECATED: setupAuth() function has been replaced by the consolidated auth router
 * See server/routes/auth/index.ts for the new authentication system
 *
 * This function has been removed as part of the authentication consolidation.
 * All auth endpoints are now handled by the modular routing system.
 *
 * Migration path:
 * - Login: POST /api/auth/login (server/routes/auth/index.ts)
 * - Logout: POST /api/auth/logout (server/routes/auth/index.ts)
 * - Get user: GET /api/auth/me or GET /api/auth/user (server/routes/auth/index.ts)
 */

/**
 * Check if we're truly in development mode
 * Requires: APP_ENV=development AND NOT production NODE_ENV AND NOT in deployment
 */
function isDevMode(): boolean {
  const appEnv = process.env.APP_ENV;
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  // DEMO MODE: APP_ENV=development enables auto-login regardless of NODE_ENV
  return appEnv === 'development' && !isDeployment;
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  logger.log('=== AUTHENTICATION MIDDLEWARE ===');
  logger.log('URL:', req.method, req.url);
  logger.log('req.session exists:', !!req.session);
  logger.log('req.session.user exists:', !!req.session?.user);
  logger.log('Session ID:', req.sessionID);
  logger.log('User email in session:', req.session?.user?.email);

  // In development mode, inject a dev admin user if no session exists OR if dev user is already in session
  if (isDevMode()) {
    const isDevUser = req.session?.user?.email === 'demo-admin@thesandwichproject.org' || req.session?.user?.email === 'dev@thesandwichproject.org';
    if (!req.session || !req.session.user || isDevUser) {
      logger.log('🔧 DEMO MODE: Using demo admin user');
      const devUser = {
        id: '1',
        email: 'demo-admin@thesandwichproject.org',
        firstName: 'Demo',
        lastName: 'Admin',
        displayName: 'Demo Admin',
        role: 'admin',
        isActive: true,
        permissions: ['*'],
        profileImageUrl: null,
      };
      req.user = devUser;
      if (req.session) {
        req.session.user = devUser;
      }
      return next();
    }
  }

  // AUTHENTICATION REQUIRED - no auto-login
  if (!req.session || !req.session.user) {
    logger.log('❌ No session user found - authentication required');
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Always fetch fresh user data from database to ensure permissions are current
  try {
    const freshUser = await storage.getUserByEmail(req.session.user.email);
    if (freshUser && freshUser.isActive) {
      // Update session with fresh user data if permissions are missing or changed
      if (
        !req.session.user.permissions ||
        req.session.user.permissions.length === 0 ||
        JSON.stringify(req.session.user.permissions) !==
          JSON.stringify(freshUser.permissions)
      ) {
        logger.log(
          `🔄 Updating session for ${freshUser.email} with fresh permissions`
        );
        req.session.user = {
          id: freshUser.id,
          email: freshUser.email,
          firstName: freshUser.firstName,
          lastName: freshUser.lastName,
          profileImageUrl: freshUser.profileImageUrl,
          role: freshUser.role,
          permissions: freshUser.permissions,
          isActive: freshUser.isActive,
        };

        // Attempt to save updated session (non-critical, don't fail request)
        try {
          await saveSession(req);
        } catch (err) {
          logger.error('Failed to save updated session (non-critical):', err);
          // Continue anyway - session update is not critical for this request
        }
      }

      // CRITICAL: Always set req.user to the fresh database user data
      req.user = {
        id: freshUser.id,
        email: freshUser.email,
        firstName: freshUser.firstName,
        lastName: freshUser.lastName,
        profileImageUrl: freshUser.profileImageUrl,
        role: freshUser.role,
        permissions: freshUser.permissions,
        isActive: freshUser.isActive,
      };

      // Update lastLoginAt if it's been more than 1 hour since last update
      // This ensures active users with persistent sessions have accurate lastLoginAt
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      if (!freshUser.lastLoginAt || new Date(freshUser.lastLoginAt) < hourAgo) {
        storage.updateUser(freshUser.id, { lastLoginAt: now }).catch((err) => {
          logger.error('Failed to update lastLoginAt:', err);
        });
      }

      // Authentication successful - logging only errors and warnings
      // Debug: logger.log(`✅ Authentication successful for ${freshUser.email} (${freshUser.role})`)
    } else {
      logger.log(`❌ User not found or inactive: ${req.session.user.email}`);
      // User not found in database or inactive, clear invalid session
      req.session.destroy((err: unknown) => {
        if (err) logger.error('Session destroy error:', err);
      });
      return res.status(401).json({ message: 'Unauthorized' });
    }
  } catch (error) {
    logger.error(
      '❌ Error fetching fresh user data in isAuthenticated:',
      error
    );
    // Fallback to session user if database fetch fails but still set req.user
    req.user = req.session.user;
    logger.log(
      `⚠️ Fallback: Using session user for ${req.session.user.email}`
    );
  }

  next();
};

// Initialize authentication system with default admin user and committees
export async function initializeAuth() {
  logger.log('Authentication system initialized');

  // Create default admin user if it doesn't exist
  try {
    const adminEmail = 'admin@sandwich.project';
    const existingAdmin = await storage.getUserByEmail(adminEmail);

    if (!existingAdmin) {
      const adminId = 'admin_' + Date.now();
      await storage.createUser({
        id: adminId,
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        permissions: getDefaultPermissionsForRole('admin'),
        isActive: true,
        profileImageUrl: null,
        metadata: {
          password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
        }, // Use env var or fallback
      });
      logger.log(
        '✅ Default admin user created: admin@sandwich.project / [password set from env or default]'
      );
    } else {
      logger.log(
        '✅ Default admin user already exists: admin@sandwich.project'
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.log(
        '❌ Could not create default admin user (using fallback):',
        error.message
      );
    } else {
      logger.log(
        '❌ Could not create default admin user (using fallback):',
        error
      );
    }
  }

  // Setup default committees and committee member user
  try {
    // Create default committees if they don't exist
    try {
      const committees = await storage.getAllCommittees();
      if (committees.length === 0) {
        await storage.createCommittee({
          name: 'Finance',
          description: 'Financial oversight and budgeting',
        });
        await storage.createCommittee({
          name: 'Operations',
          description: 'Day-to-day operations management',
        });
        await storage.createCommittee({
          name: 'Outreach',
          description: 'Community outreach and partnerships',
        });
        logger.log('✅ Default committees created');
      }
    } catch (error) {
      logger.warn('Committee creation failed:', error.message);
    }

    // Create committee member user and assign to specific committee
    const committeeEmail = 'katielong2316@gmail.com';
    const existingCommitteeMember =
      await storage.getUserByEmail(committeeEmail);

    let committeeMemberId;
    if (!existingCommitteeMember) {
      committeeMemberId = 'committee_' + Date.now();
      await storage.createUser({
        id: committeeMemberId,
        email: committeeEmail,
        firstName: 'Katie',
        lastName: 'Long',
        role: 'committee_member',
        permissions: getDefaultPermissionsForRole('committee_member'),
        isActive: true,
        profileImageUrl: null,
        metadata: {
          password: process.env.DEFAULT_COMMITTEE_PASSWORD || 'committee123',
        },
      });
      logger.log(
        '✅ Committee member user created: katielong2316@gmail.com / [password set from env or default]'
      );
    } else {
      // Use existing user without updating role (preserve current role and permissions)
      committeeMemberId = existingCommitteeMember.id;
      logger.log(
        '✅ Found existing user: katielong2316@gmail.com (preserving current role and permissions)'
      );
    }

    // Assign committee member to finance committee only
    try {
      const katie = await storage.getUserByEmail('katielong2316@gmail.com');

      if (katie) {
        // Get Finance committee ID
        const committees = await storage.getAllCommittees();
        const financeCommittee = committees.find(
          (c) => c.name.toLowerCase() === 'finance'
        );

        if (financeCommittee) {
          // Check if Katie is already in Finance committee
          const isFinanceMember = await storage.isUserCommitteeMember(
            katie.id,
            financeCommittee.id
          );
          if (!isFinanceMember) {
            await storage.addUserToCommittee({
              userId: katie.id,
              committeeId: financeCommittee.id,
              role: 'member',
            });
          }
          logger.log(
            '✅ Assigned katielong2316@gmail.com to Finance Committee only'
          );
        }
      }
    } catch (error) {
      logger.warn('Assigning committee member failed:', error.message);
    }
  } catch (error) {
    logger.log('❌ Could not setup committees:', error.message);
  }

  // Setup driver user - kenig.ka@gmail.com with restricted permissions
  try {
    const driverEmail = 'kenig.ka@gmail.com';
    const existingDriver = await storage.getUserByEmail(driverEmail);

    if (!existingDriver) {
      const driverId = `driver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await storage.createUser({
        id: driverId,
        email: driverEmail,
        firstName: 'Ken',
        lastName: 'Ig',
        role: 'driver',
        permissions: getDefaultPermissionsForRole('driver'),
        isActive: true,
        profileImageUrl: null,
        metadata: {
          password: process.env.DEFAULT_DRIVER_PASSWORD || 'driver123',
        },
      });
      logger.log(
        '✅ Driver user created: kenig.ka@gmail.com / [password set from env or default]'
      );
    } else {
      // Preserve existing user permissions - do not reset them
      logger.log(
        '✅ Found existing user: kenig.ka@gmail.com (preserving current role and permissions)'
      );
    }
  } catch (error) {
    logger.log('❌ Could not setup driver user:', error.message);
  }
}
