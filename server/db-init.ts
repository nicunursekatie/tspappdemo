import { db } from './db';
import {
  hosts,
  sandwichCollections,
  projects,
  messages,
  weeklyReports,
  meetingMinutes,
  driveLinks,
  agendaItems,
  meetings,
  driverAgreements,
  recipients,
} from '@shared/schema';
import { eq, count, sql } from 'drizzle-orm';
import { ensureSessionsTable } from './session-migrate';
import { runMigrationsAutomatically } from './migrate';
import { checkSchemaDrift } from './schema-drift-check';
import { createServiceLogger } from './utils/logger.js';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl, getDatabaseBranch, isProduction } from './db-url';

const dbLogger = createServiceLogger('database');

export async function initializeDatabase() {
  try {
    dbLogger.info('Checking database initialization...');
    // Use centralized database URL configuration
    const dbUrl = getDatabaseUrl();
    const branch = getDatabaseBranch();

    dbLogger.debug('DATABASE_URL exists', {
      exists: !!dbUrl,
    });
    dbLogger.debug('DATABASE_URL preview', {
      preview: dbUrl
        ? dbUrl.substring(0, 20) + '...'
        : 'not set',
    });
    dbLogger.info(`Database branch: ${branch} (${isProduction ? 'production' : 'development'} mode)`);

    // Run any pending database migrations
    await runMigrationsAutomatically();

    // Verify schema matches database after migrations
    await checkSchemaDrift();

    // Ensure sessions table exists for PostgreSQL session storage
    // This resolves the "MemoryStore is not designed for a production environment" warning
    // by using persistent PostgreSQL storage for sessions instead of memory
    await ensureSessionsTable();

    // Check each table independently and seed if empty
    const [hostsCount] = await db.select({ count: count() }).from(hosts);
    const [projectsCount] = await db.select({ count: count() }).from(projects);
    const [messagesCount] = await db.select({ count: count() }).from(messages);
    const [collectionsCount] = await db
      .select({ count: count() })
      .from(sandwichCollections);
    const [recipientsCount] = await db
      .select({ count: count() })
      .from(recipients);

    logger.log(
      'Table counts - Hosts:',
      hostsCount.count,
      'Projects:',
      projectsCount.count,
      'Messages:',
      messagesCount.count,
      'Collections:',
      collectionsCount.count,
      'Recipients:',
      recipientsCount.count
    );

    // No seeding - all data should be added manually or via import
    logger.log('Database ready - no sample data seeded');

    logger.log('Database initialization complete');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    // Don't throw - allow app to continue with fallback storage
  }
}
