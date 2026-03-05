import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl, getDatabaseBranch, isProduction, databaseInfo } from './db-url';

/**
 * DATABASE CONNECTION
 * 
 * Uses centralized database URL configuration from server/db-url.ts.
 * All database URL selection logic is in one place.
 */

const databaseUrl = getDatabaseUrl();
const dbBranch = getDatabaseBranch();

if (!databaseUrl) {
  throw new Error('Database URL not configured. Please set DEV_DATABASE_URL for development or DATABASE_URL for production in Replit Secrets.');
}

// Fix TypeScript union type issue by using a single concrete type
// This prevents "expression is not callable" errors when using db.select/insert/update/delete
type DB = NeonHttpDatabase<typeof schema>;

// Clear startup log showing environment AND database branch
logger.log(`🗄️ Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode, connected to ${dbBranch} database`);

// Re-export databaseInfo for backward compatibility
export { databaseInfo };

// Use HTTP connection instead of WebSocket for better stability
const sqlClient = neon(databaseUrl);
const db = drizzle(sqlClient, {
  schema,
  logger: false
}) as DB;

// Add execute method for raw SQL queries
(db as any).execute = async (query: any) => {
  return await sqlClient(query);
};

export { db };
