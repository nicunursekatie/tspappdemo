import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import type { Store } from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage-wrapper';
import { createActivityLogger } from './middleware/activity-logger';
import createMainRoutes from './routes/index';
import { requirePermission, blockInactiveUsers } from './middleware/auth';
import { createCorsMiddleware, logCorsConfig } from './config/cors';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl } from './db-url';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';

/**
 * Route Registration
 *
 * All routes are now handled by the modular routing system in server/routes/index.ts.
 * This file configures middleware and delegates to the modular router.
 *
 * To add new routes, see server/routes/index.ts
 */

export async function registerRoutes(app: Express): Promise<Store> {
  // ==========================================================================
  // SESSION & COOKIE CONFIGURATION
  // ==========================================================================
  // If login causes a page refresh instead of succeeding, check:
  // 1. trust proxy is set (required behind reverse proxy like Replit)
  // 2. REPLIT_DEPLOYMENT=1 is set in Secrets (for production deployments)
  // 3. SESSION_SECRET is set in Secrets
  // 4. CORS is not setting Access-Control-Allow-Origin to 'null'
  // ==========================================================================

  const isProduction = process.env.NODE_ENV === 'production';
  const isReplitDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  const isOnReplit = !!process.env.REPL_ID;

  // Validate SESSION_SECRET in production to prevent security vulnerabilities
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error(
      'CRITICAL: SESSION_SECRET environment variable must be set in production. ' +
      'Without this, session tokens can be forged, leading to authentication bypass.'
    );
  }

  // Warn if REPLIT_DEPLOYMENT is not set correctly
  if (isProduction && isOnReplit && !isReplitDeployment) {
    logger.warn('⚠️ [Session] REPLIT_DEPLOYMENT is not set to "1" in Secrets!');
    logger.warn('⚠️ [Session] This may cause login to fail. Add REPLIT_DEPLOYMENT=1 to your Secrets.');
  }

  // Use database-backed session store for deployment persistence
  const databaseUrl = getDatabaseUrl();

  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: databaseUrl,
    createTableIfMissing: true,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: 'sessions',
  });

  // CRITICAL: Trust Replit's HTTPS proxy so Express sets secure cookies correctly
  // Without this, Express thinks the connection is insecure and won't set secure cookies
  // SYMPTOM if missing: Login causes page refresh, cookies rejected silently
  app.set('trust proxy', 1);
  logger.info('🔒 [Proxy] trust proxy enabled for secure cookies behind reverse proxy');

  // Add secure CORS middleware before session middleware
  logCorsConfig(); // Log configuration for debugging
  app.use(createCorsMiddleware());

  // Use secure cookies in production OR in Replit deployments (which use HTTPS)
  const useSecureCookies = isProduction || isReplitDeployment;

  // Log complete session configuration for debugging login issues
  logger.info('🔐 [Session Config]', {
    isProduction,
    isReplitDeployment,
    isOnReplit,
    trustProxy: true,
    useSecureCookies,
    cookieSettings: {
      secure: useSecureCookies,
      httpOnly: true,
      sameSite: useSecureCookies ? 'none' : 'lax',
    },
  });

  // Extra validation: warn if configuration looks wrong
  if (useSecureCookies) {
    logger.info('🔐 [Session] Secure cookies ENABLED - requires HTTPS');
  } else {
    logger.info('🔓 [Session] Secure cookies DISABLED - development mode');
  }

  // Add session middleware with enhanced security and mobile compatibility
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'temp-secret-key-for-development',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: useSecureCookies,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: useSecureCookies ? 'none' : 'lax',
        domain: undefined,
      },
      name: 'tsp.session',
      rolling: true,
    })
  );

  // Import authentication middleware
  const { isAuthenticated } = await import('./auth');

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

  // Block inactive (pending approval) users from accessing protected routes
  app.use(blockInactiveUsers);
  logger.log('✅ Inactive user blocking middleware enabled');

  // Disable caching for all API routes to prevent development issues
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  registerObjectStorageRoutes(app);

  // CRITICAL: Signup routes MUST be registered BEFORE mainRoutes
  // These are public endpoints that don't require authentication
  // and need to match before authRouter can intercept them
  const { signupRoutes } = await import('./routes/signup');
  app.use('/api', signupRoutes);

  // Main modular routes (handles all API endpoints)
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage,
  });
  app.use(mainRoutes);

  // Catch-all handler for unknown API routes
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/api/') && !res.headersSent) {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
      });
    } else {
      next();
    }
  });

  return sessionStore;
}
