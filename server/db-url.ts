import { logger } from './utils/production-safe-logger';

/**
 * CENTRALIZED DATABASE URL RESOLUTION
 * 
 * This is the SINGLE source of truth for database connection string selection.
 * All files that need a database connection should import from here.
 * 
 * Environment-based database selection:
 * - Development (NODE_ENV=development or unset): Use DEV_DATABASE_URL (dev Neon branch)
 * - Production (NODE_ENV=production): Use DATABASE_URL (production Neon branch)
 * 
 * SECRET NAMES (as configured in Replit Secrets):
 * - DEV_DATABASE_URL: Development Neon branch connection string
 * - DATABASE_URL: Production Neon branch connection string  
 * - PRODUCTION_DATABASE_URL: Legacy alias for production (fallback)
 */

export const isProduction = process.env.NODE_ENV === 'production';

export function getDatabaseUrl(): string | undefined {
  if (isProduction) {
    // Production: DATABASE_URL or PRODUCTION_DATABASE_URL required - NO fallback to dev
    const prodUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    if (!prodUrl) {
      // SAFETY: Fail loudly in production if no production database configured
      logger.error('🚨 CRITICAL: Production mode requires DATABASE_URL or PRODUCTION_DATABASE_URL to be set!');
      logger.error('🚨 Refusing to fall back to DEV_DATABASE_URL in production.');
      throw new Error('Production database URL not configured. Set DATABASE_URL in production secrets.');
    }
    return prodUrl;
  }
  // Development: DEV_DATABASE_URL → DATABASE_URL (fallback for convenience)
  return process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
}

export function getDatabaseBranch(): 'dev' | 'production' {
  const dbUrl = getDatabaseUrl();
  // Check if we're using the dev database URL
  return dbUrl === process.env.DEV_DATABASE_URL ? 'dev' : 'production';
}

export const databaseInfo = {
  isProduction,
  get url() { return getDatabaseUrl(); },
  get branch() { return getDatabaseBranch(); }
};
