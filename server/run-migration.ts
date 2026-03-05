import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl, getDatabaseBranch, isProduction } from './db-url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from centralized configuration
const DATABASE_URL = getDatabaseUrl();

if (!DATABASE_URL) {
  logger.error('ERROR: Database URL not configured. Set DATABASE_URL_DEV for development or DATABASE_URL for production.');
  process.exit(1);
}

logger.log(`🗄️ Running migration on ${getDatabaseBranch()} database (${isProduction ? 'production' : 'development'} mode)`);

async function runMigration() {
  logger.log('🔄 Running sandwich range fields migration...');

  // Connect to database using Neon HTTP
  const sql = neon(DATABASE_URL);

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_sandwich_range_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    logger.log('📝 Executing SQL:\n', migrationSQL);

    // Execute the migration
    await sql(migrationSQL);

    logger.log('✅ Migration completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
