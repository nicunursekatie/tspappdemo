import { db } from '../db';
import { organizations, eventRequests } from '../../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Populate organizations table from existing event requests
 * This creates organization records for all unique organization names found in event requests
 * Run this with: npx tsx server/scripts/populate-organizations-from-events.ts
 */

// Simple console logger for scripts (avoids Winston initialization issues)
const logger = {
  info: (...args: any[]) => console.log(...args),
  error: (...args: any[]) => console.error(...args),
};

async function populateOrganizations() {
  try {
    logger.info('Starting organization population from event requests...');

    // Get all unique organization names from event requests
    const uniqueOrgs = await db
      .selectDistinct({ organizationName: eventRequests.organizationName })
      .from(eventRequests)
      .where(sql`${eventRequests.organizationName} IS NOT NULL AND ${eventRequests.organizationName} != ''`);

    logger.info(`Found ${uniqueOrgs.length} unique organizations in event requests`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const org of uniqueOrgs) {
      if (!org.organizationName) {
        skippedCount++;
        continue;
      }

      // Check if organization already exists
      const existing = await db
        .select()
        .from(organizations)
        .where(sql`LOWER(${organizations.name}) = LOWER(${org.organizationName})`)
        .limit(1);

      if (existing.length > 0) {
        logger.info(`⏭️  Skipped "${org.organizationName}" - already exists`);
        skippedCount++;
        continue;
      }

      // Get event statistics for this organization
      const stats = await db
        .select({
          totalEvents: sql<number>`COUNT(*)::int`,
          lastEventDate: sql<Date | null>`MAX(COALESCE(${eventRequests.scheduledEventDate}, ${eventRequests.desiredEventDate}))::timestamp`,
        })
        .from(eventRequests)
        .where(sql`LOWER(${eventRequests.organizationName}) = LOWER(${org.organizationName})`)
        .then((rows) => rows[0]);

      // Create the organization
      await db.insert(organizations).values({
        name: org.organizationName,
        totalEvents: stats?.totalEvents || 0,
        lastEventDate: stats?.lastEventDate || null,
      });

      logger.info(
        `✅ Created "${org.organizationName}" (${stats?.totalEvents || 0} events)`
      );
      createdCount++;
    }

    logger.info('\n📊 Summary:');
    logger.info(`   Unique organizations found: ${uniqueOrgs.length}`);
    logger.info(`   ✅ Created: ${createdCount}`);
    logger.info(`   ⏭️  Skipped (already exist): ${skippedCount}`);
    logger.info('\n✨ Organization population complete!');
    logger.info(
      '\n💡 Next step: Run auto-categorization with: npx tsx server/scripts/auto-categorize-organizations.ts'
    );

    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to populate organizations', error);
    process.exit(1);
  }
}

populateOrganizations();
