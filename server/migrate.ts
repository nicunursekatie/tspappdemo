import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl, getDatabaseBranch } from './db-url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrationsAutomatically() {
  const DATABASE_URL = getDatabaseUrl();

  if (!DATABASE_URL) {
    logger.log('⚠️  No database URL set, skipping migrations');
    return;
  }

  logger.log('🔄 Checking for pending database migrations...');

  // Connect to database using Neon HTTP
  const sql = neon(DATABASE_URL);

  try {
    // Create migrations tracking table if it doesn't exist
    await sql(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files from the migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      logger.log('⚠️  No migrations directory found, skipping migrations');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    let executedCount = 0;

    for (const file of files) {
      // Check if migration has already been executed
      const result = await sql`
        SELECT * FROM "_migrations" WHERE name = ${file}
      `;

      if (result.length > 0) {
        continue; // Skip already executed migrations
      }

      // Read and execute the migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      logger.log(`📝 Executing migration: ${file}...`);

      // Split by statement-breakpoint if it exists, otherwise execute as one statement
      const statements = migrationSQL.split('--> statement-breakpoint');

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) {
          await sql(trimmed);
        }
      }

      // Mark migration as executed
      await sql`
        INSERT INTO "_migrations" (name) VALUES (${file})
      `;

      logger.log(`✅ Migration ${file} completed`);
      executedCount++;
    }

    if (executedCount > 0) {
      logger.log(`✅ Applied ${executedCount} database migration(s)`);
    } else {
      logger.log('✅ All migrations already applied');
    }
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    // Don't throw - allow app to continue (migrations might fail in dev environments)
  }
}
