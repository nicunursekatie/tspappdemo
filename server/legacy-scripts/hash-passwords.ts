/**
 * Bcrypt Password Hashing Migration Script
 *
 * Converts all plaintext passwords in the password column to bcrypt hashes
 *
 * CRITICAL: This script must be run BEFORE deploying the bcrypt authentication changes
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

interface HashMigrationResult {
  email: string;
  success: boolean;
  wasAlreadyHashed: boolean;
  error?: string;
}

async function hashAllPasswords(): Promise<HashMigrationResult[]> {
  logger.log('🔐 Starting bcrypt password hashing migration...\n');

  const results: HashMigrationResult[] = [];

  // Get all active users with passwords
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.isActive, true));

  logger.log(`Found ${allUsers.length} active users to process\n`);

  for (const user of allUsers) {
    const email = user.email || 'unknown';
    logger.log(`\n📧 Processing: ${email}`);

    try {
      const currentPassword = user.password;

      if (!currentPassword) {
        logger.log(`  ⚠️  No password found - skipping`);
        results.push({
          email,
          success: true,
          wasAlreadyHashed: false,
        });
        continue;
      }

      // Check if password is already a bcrypt hash
      // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
      const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(currentPassword) && currentPassword.length === 60;

      if (isBcryptHash) {
        logger.log(`  ✓ Password already hashed - skipping`);
        results.push({
          email,
          success: true,
          wasAlreadyHashed: true,
        });
        continue;
      }

      // Hash the plaintext password - CRITICAL: trim to match registration behavior
      logger.log(`  🔒 Hashing plaintext password...`);
      const hashedPassword = await bcrypt.hash(currentPassword.trim(), SALT_ROUNDS);

      // Update the user with hashed password
      await db
        .update(users)
        .set({
          password: hashedPassword,
        })
        .where(eq(users.id, user.id));

      logger.log(`  ✅ Password hashed successfully`);

      results.push({
        email,
        success: true,
        wasAlreadyHashed: false,
      });

    } catch (error) {
      logger.error(`  ❌ Hashing failed:`, error);
      results.push({
        email,
        success: false,
        wasAlreadyHashed: false,
        error: String(error),
      });
    }
  }

  return results;
}

async function generateHashReport(results: HashMigrationResult[]) {
  logger.log('\n\n═══════════════════════════════════════════════');
  logger.log('📊 BCRYPT HASHING MIGRATION REPORT');
  logger.log('═══════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const newlyHashed = successful.filter(r => !r.wasAlreadyHashed);
  const alreadyHashed = successful.filter(r => r.wasAlreadyHashed);

  logger.log(`✅ Successfully processed: ${successful.length}/${results.length}`);
  logger.log(`   - Newly hashed: ${newlyHashed.length}`);
  logger.log(`   - Already hashed: ${alreadyHashed.length}`);

  if (failed.length > 0) {
    logger.log(`\n❌ Failed to hash: ${failed.length}`);
    failed.forEach(r => {
      logger.log(`   - ${r.email}: ${r.error}`);
    });
  }

  logger.log('\n═══════════════════════════════════════════════');
  logger.log('✅ Hashing migration complete!');
  logger.log('Next step: Deploy authentication code changes');
  logger.log('═══════════════════════════════════════════════\n');
}

// Run migration if called directly
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  hashAllPasswords()
    .then(generateHashReport)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { hashAllPasswords, generateHashReport };
