import { Request, Response, NextFunction, RequestHandler } from 'express';
import { storage } from '../storage';
import { logger } from '../utils/production-safe-logger';
import { checkOwnershipPermission } from '../../shared/unified-auth-utils';

// Extend Express Request to include session with user
interface AuthenticatedRequest extends Request {
  user?: any;
  session?: {
    user?: any;
    destroy?: (callback: (err?: any) => void) => void;
  };
}

/**
 * Check if we're truly in development mode
 * Requires: APP_ENV=development AND NOT production NODE_ENV AND NOT in deployment
 */
function isDevMode(): boolean {
  const appEnv = process.env.APP_ENV;
  const nodeEnv = process.env.NODE_ENV;
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  return appEnv === 'development' && nodeEnv !== 'production' && !isDeployment;
}

/**
 * Development-only bypass middleware
 * Allows all requests in development when truly in dev mode
 */
export function devBypass(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (isDevMode()) {
    return next();
  }
  next();
}

/**
 * Session-based authentication middleware
 * Checks if user is logged in via session
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // In development mode, inject a dev admin user
  if (isDevMode()) {
    // Try to get a real super_admin user from the database, or create a fake one
    try {
      const devUser = await storage.getUserByEmail('katie@thesandwichproject.org');
      if (devUser) {
        req.user = devUser;
      } else {
        // Fallback to fake dev admin if no real user exists
        req.user = {
          id: 1,
          email: 'dev@thesandwichproject.org',
          firstName: 'Dev',
          lastName: 'Admin',
          displayName: 'Dev Admin',
          role: 'super_admin',
          isActive: true,
          permissions: ['*'],
        };
      }
    } catch (error) {
      // If database lookup fails, use fake user
      req.user = {
        id: 1,
        email: 'dev@thesandwichproject.org',
        firstName: 'Dev',
        lastName: 'Admin',
        displayName: 'Dev Admin',
        role: 'super_admin',
        isActive: true,
        permissions: ['*'],
      };
    }
    return next();
  }

  try {
    // Check for user in request (set by earlier middleware) or session
    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Ensure user still exists and is active
    const dbUser = await storage.getUser(user.id);
    if (!dbUser) {
      // Clear invalid session
      if (req.session?.destroy) {
        req.session.destroy(() => {});
      }
      return res.status(401).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Don't block inactive users from basic routes (they need to see pending status)
    // The blockInactiveUsers middleware handles route-specific blocking

    // Attach fresh user data to request
    req.user = dbUser;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if authenticated, but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user || req.session?.user;
    if (user) {
      const dbUser = await storage.getUser(user.id);
      if (dbUser) {
        req.user = dbUser;
      }
    }
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
}

/**
 * Middleware to block inactive users from most routes
 * Inactive users can only access authentication-related endpoints
 */
export async function blockInactiveUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Skip in development mode
  if (isDevMode()) {
    return next();
  }

  try {
    // Allow unauthenticated requests to proceed (they'll be caught by other auth checks)
    if (!req.user && !req.session?.user) {
      return next();
    }

    const user = req.user || req.session?.user;

    // Define exact path+method combinations that pending users CAN access
    // Using exact matching to prevent bypassing mutation endpoints
    const allowedRoutes = [
      { method: 'GET', path: '/api/auth/user' },      // Get current user info
      { method: 'POST', path: '/api/auth/login' },    // Login
      { method: 'POST', path: '/api/auth/logout' },   // Logout
      { method: 'POST', path: '/api/auth/signup' },   // Signup
      { method: 'GET', path: '/api/user/me' },        // Get own profile (read-only)
      { method: 'GET', path: '/healthz' },            // Health check
      { method: 'GET', path: '/api/login' },          // Login page
      { method: 'GET', path: '/api/logout' },         // Logout page
      // Password reset routes (public - users need these to recover access)
      { method: 'POST', path: '/api/forgot-password' },           // Request password reset
      { method: 'POST', path: '/api/reset-password' },            // Execute password reset
      { method: 'POST', path: '/api/auth/request-initial-password' }, // Request initial password setup
      { method: 'POST', path: '/api/auth/set-initial-password' },     // Set initial password
    ];

    // Path prefixes that should be allowed (for routes with parameters)
    const allowedPathPrefixes = [
      { method: 'GET', prefix: '/api/verify-reset-token/' },           // Verify reset token
      { method: 'GET', prefix: '/api/auth/verify-initial-password-token/' }, // Verify initial password token
    ];

    // Check if the request method+path combination is allowed for inactive users
    const isAllowedRoute = allowedRoutes.some(
      route => route.method === req.method && req.path === route.path
    );

    // Check if the request matches an allowed prefix pattern
    const isAllowedPrefix = allowedPathPrefixes.some(
      route => route.method === req.method && req.path.startsWith(route.prefix)
    );

    // If user is inactive and trying to access a protected route, block them
    if (user && !user.isActive && !isAllowedRoute && !isAllowedPrefix) {
      logger.log(`❌ INACTIVE USER BLOCKED: ${user.email} attempted to access ${req.path}`);
      return res.status(403).json({
        message: 'Account pending approval',
        code: 'PENDING_APPROVAL',
        details: 'Your account is awaiting admin approval. You will be notified once approved.',
        status: user.metadata?.status || 'pending_approval',
      });
    }

    next();
  } catch (error) {
    logger.error('Error in blockInactiveUsers middleware:', error);
    next(); // Allow request to proceed on error to avoid breaking the app
  }
}

/**
 * Permission-based authorization middleware factory
 * Creates middleware that checks if user has a specific permission
 */
export function requirePermission(permission: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Skip permission check in development mode
    if (isDevMode()) {
      return next();
    }

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Super admins have all permissions
    if (user.role === 'super_admin') {
      return next();
    }

    // Check if user has the required permission
    const userPermissions = user.permissions || [];
    if (
      Array.isArray(userPermissions) &&
      userPermissions.includes(permission)
    ) {
      return next();
    }

    // Check role-based permissions (legacy support)
    if (user.role === 'admin') {
      // Admins have most permissions by default
      return next();
    }

    logger.log(
      `❌ PERMISSION DENIED: ${user.email} lacks permission ${permission}`
    );
    return res.status(403).json({
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
      required: permission,
    });
  };
}

/**
 * Permission-based authorization middleware factory that accepts multiple permissions
 * Creates middleware that checks if user has at least one of the specified permissions
 */
export function requireAnyPermission(...permissions: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Skip permission check in development mode
    if (isDevMode()) {
      return next();
    }

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Super admins have all permissions
    if (user.role === 'super_admin') {
      return next();
    }

    // Check if user has any of the required permissions
    const userPermissions = user.permissions || [];
    if (
      Array.isArray(userPermissions) &&
      permissions.some(perm => userPermissions.includes(perm))
    ) {
      return next();
    }

    // Check role-based permissions (legacy support)
    if (user.role === 'admin') {
      // Admins have most permissions by default
      return next();
    }

    logger.log(
      `❌ PERMISSION DENIED: ${user.email} lacks any of permissions ${permissions.join(', ')}`
    );
    return res.status(403).json({
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
      required: permissions,
    });
  };
}

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has one of the specified roles
 */
export function requireRole(...roles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Skip role check in development mode
    if (isDevMode()) {
      return next();
    }

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(user.role)) {
      logger.log(
        `❌ ROLE DENIED: ${user.email} has role ${user.role}, requires one of: ${roles.join(', ')}`
      );
      return res.status(403).json({
        message: 'Insufficient role',
        code: 'ROLE_DENIED',
        required: roles,
        current: user.role,
      });
    }

    next();
  };
}

/**
 * Alias for requireAuth - maintains backward compatibility
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  return requireAuth(req as AuthenticatedRequest, res, next);
};

/**
 * Ownership-based permission middleware factory
 * Checks if user owns the resource OR has the "all" permission
 */
export const requireOwnershipPermission = (
  ownPermission: string,
  allPermission: string,
  getResourceUserId: (req: any) => Promise<string | null>
): RequestHandler => {
  return async (req: any, res, next) => {
    // Skip in development mode
    if (isDevMode()) {
      return next();
    }

    try {
      // STEP 1: Ensure user is authenticated
      const user = req.user || req.session?.user;
      if (!user) {
        logger.log(`❌ AUTH: No user context for ownership check - DENIED`);
        return res.status(401).json({ message: 'Authentication required' });
      }

      // STEP 2: Fetch fresh user data
      let currentUser = user;
      if (user.id) {
        try {
          const freshUser = await storage.getUser(user.id);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser;
          } else {
            return res
              .status(401)
              .json({ message: 'User account not found or inactive' });
          }
        } catch (dbError) {
          logger.error('Database error in ownership check:', dbError);
          return res
            .status(500)
            .json({ message: 'Unable to verify user permissions' });
        }
      }

      // STEP 3: Get resource owner ID for ownership check
      const resourceUserId = await getResourceUserId(req);

      // STEP 4: Use unified ownership permission checking
      const permissionResult = checkOwnershipPermission(
        currentUser,
        ownPermission,
        allPermission,
        resourceUserId || undefined
      );

      if (permissionResult.granted) {
        logger.log(
          `✅ AUTH: ${permissionResult.reason} for ${allPermission}/${ownPermission} to ${currentUser.email}`
        );
        return next();
      }

      // DEFAULT: DENY ACCESS
      logger.log(
        `❌ AUTH: Ownership permission DENIED for ${currentUser.email}`
      );
      logger.log(`   Reason: ${permissionResult.reason}`);

      return res.status(403).json({
        message: 'Insufficient permissions',
        required: `${allPermission} OR ${ownPermission}`,
        reason: permissionResult.reason,
        userRole: permissionResult.userRole,
        userPermissions: permissionResult.userPermissions || [],
      });
    } catch (error) {
      logger.error('❌ AUTH: Ownership check failed:', error);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};
