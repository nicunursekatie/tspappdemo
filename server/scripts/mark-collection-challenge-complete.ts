#!/usr/bin/env tsx

/**
 * Script to mark the "submit_collection_log" challenge as completed for specific users
 * who have already been submitting collection logs before this challenge was added.
 *
 * Users to update:
 * - Jen Cohen
 * - Kristina McCarthney
 * - Laura Baldwin
 * - Marcy Louza
 * - Nancy Miller
 * - Veronica Pennington
 * - Vicki Tropauer
 */

import { db } from '../db';
import { users, onboardingChallenges, onboardingProgress } from '@shared/schema';
import { eq, and, or, like, sql } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

const TARGET_USERS = [
  { name: 'jen cohen', email: 'jenmcohen@gmail.com' },
  { name: 'kristina mccarthney', email: 'kristinamday@yahoo.com' },
  { name: 'laura baldwin', email: 'lzauderer@yahoo.com' },
  { name: 'marcy louza', email: 'mdlouza@gmail.com' },
  { name: 'nancy miller', email: 'atlantamillers@comcast.net' },
  { name: 'veronica pennington', email: null }, // Will search by name only
  { name: 'vicki tropauer', email: 'vickib@aol.com' },
];

async function markChallengeComplete() {
  try {
    logger.log('Starting to mark collection log challenge as complete for specified users...');

    // Find the submit_collection_log challenge
    const challenge = await db
      .select()
      .from(onboardingChallenges)
      .where(eq(onboardingChallenges.actionKey, 'submit_collection_log'))
      .limit(1);

    if (challenge.length === 0) {
      logger.error('Challenge "submit_collection_log" not found. Make sure to run initializeDefaultChallenges first.');
      process.exit(1);
    }

    const challengeId = challenge[0].id;
    logger.log(`Found challenge: ${challenge[0].title} (ID: ${challengeId})`);

    let completedCount = 0;
    let alreadyCompletedCount = 0;
    let notFoundCount = 0;

    // Find and update each user
    for (const targetUser of TARGET_USERS) {
      logger.log(`\nProcessing: ${targetUser.name}...`);

      // Build search conditions - search by name parts and email
      const nameParts = targetUser.name.toLowerCase().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');

      let userRecords;
      if (targetUser.email) {
        // Search by email first, then by name
        userRecords = await db
          .select()
          .from(users)
          .where(
            or(
              eq(sql`LOWER(${users.email})`, targetUser.email.toLowerCase()),
              and(
                like(sql`LOWER(${users.firstName})`, `%${firstName}%`),
                like(sql`LOWER(${users.lastName})`, `%${lastName}%`)
              )
            )
          )
          .limit(1);
      } else {
        // Search by name only
        userRecords = await db
          .select()
          .from(users)
          .where(
            and(
              like(sql`LOWER(${users.firstName})`, `%${firstName}%`),
              like(sql`LOWER(${users.lastName})`, `%${lastName}%`)
            )
          )
          .limit(1);
      }

      if (userRecords.length === 0) {
        logger.warn(`  User not found: ${targetUser.name} (${targetUser.email || 'no email'})`);
        notFoundCount++;
        continue;
      }

      const user = userRecords[0];
      logger.log(`  Found user: ${user.firstName} ${user.lastName} (${user.email}) - ID: ${user.id}`);

      // Check if already completed
      const existing = await db
        .select()
        .from(onboardingProgress)
        .where(
          and(
            eq(onboardingProgress.userId, user.id),
            eq(onboardingProgress.challengeId, challengeId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        logger.log(`  Already completed this challenge`);
        alreadyCompletedCount++;
        continue;
      }

      // Mark as completed
      await db.insert(onboardingProgress).values({
        userId: user.id,
        challengeId: challengeId,
        metadata: {
          source: 'manual_migration',
          reason: 'User already submitted collection logs before challenge was added',
          markedAt: new Date().toISOString(),
        },
      });

      logger.log(`  ✅ Marked as completed`);
      completedCount++;
    }

    logger.log('\n=================================');
    logger.log('Summary:');
    logger.log(`  Total users processed: ${TARGET_USERS.length}`);
    logger.log(`  Newly completed: ${completedCount}`);
    logger.log(`  Already completed: ${alreadyCompletedCount}`);
    logger.log(`  Not found: ${notFoundCount}`);
    logger.log('=================================\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error marking challenges as complete:', error);
    process.exit(1);
  }
}

markChallengeComplete();
