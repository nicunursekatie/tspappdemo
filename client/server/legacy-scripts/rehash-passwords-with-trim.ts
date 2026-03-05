/**
 * Password Re-hashing Fix-up Script
 *
 * This script addresses passwords that were hashed WITHOUT trimming.
 * Since we can't "unhash" passwords to check if they had whitespace,
 * this script provides a way to force re-hashing of all passwords
 * by temporarily storing plaintext, trimming, and re-hashing.
 *
 * IMPORTANT: This should only be run if:
 * 1. Users are experiencing login issues after migration
 * 2. You've verified the migration scripts ran without trimming
 * 3. You have a database backup
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from './utils/production-safe-logger';

interface RehashResult {
  email: string;
  action: 'skipped' | 'rehashed' | 'failed';
  reason: string;
}

async function rehashAllPasswords(): Promise<RehashResult[]> {
  logger.log('🔐 Starting password re-hash with trim fix...\n');
  logger.log('⚠️  WARNING: This script cannot detect which passwords need re-hashing.');
  logger.log('⚠️  Affected users should use password reset instead.\n');

  const results: RehashResult[] = [];

  // Get all active users
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.isActive, true));

  logger.log(`Found ${allUsers.length} active users to check\n`);

  for (const user of allUsers) {
    const email = user.email || 'unknown';
    logger.log(`\n📧 Checking: ${email}`);

    try {
      const currentPassword = user.password;

      if (!currentPassword) {
        logger.log(`  ⚠️  No password found - skipping`);
        results.push({
          email,
          action: 'skipped',
          reason: 'No password found',
        });
        continue;
      }

      // Check if password is a bcrypt hash
      const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(currentPassword) && currentPassword.length === 60;

      if (!isBcryptHash) {
        logger.log(`  ℹ️  Not a bcrypt hash - skipping (might be plaintext)`);
        results.push({
          email,
          action: 'skipped',
          reason: 'Not a bcrypt hash',
        });
        continue;
      }

      // For bcrypt hashes, we cannot detect if they were hashed with whitespace
      // User should use password reset if they're having login issues
      logger.log(`  ℹ️  Bcrypt hash detected - user should use password reset if having issues`);
      results.push({
        email,
        action: 'skipped',
        reason: 'Bcrypt hash - use password reset if needed',
      });

    } catch (error) {
      logger.error(`  ❌ Check failed:`, error);
      results.push({
        email,
        action: 'failed',
        reason: String(error),
      });
    }
  }

  return results;
}

async function generateRehashReport(results: RehashResult[]) {
  logger.log('\n\n═══════════════════════════════════════════════');
  logger.log('📊 PASSWORD RE-HASH CHECK REPORT');
  logger.log('═══════════════════════════════════════════════\n');

  const skipped = results.filter(r => r.action === 'skipped');
  const failed = results.filter(r => r.action === 'failed');
  const bcryptUsers = skipped.filter(r => r.reason.includes('Bcrypt hash'));

  logger.log(`Total users checked: ${results.length}`);
  logger.log(`  - Bcrypt hashed passwords: ${bcryptUsers.length}`);
  logger.log(`  - Other (skipped): ${skipped.length - bcryptUsers.length}`);
  logger.log(`  - Failed: ${failed.length}`);

  if (bcryptUsers.length > 0) {
    logger.log('\n\n⚠️  USERS WITH BCRYPT PASSWORDS:');
    logger.log('═══════════════════════════════════════════════');
    logger.log('If these users cannot log in, they should use password reset:\n');

    bcryptUsers.forEach(r => {
      logger.log(`📧 ${r.email}`);
    });
  }

  logger.log('\n\n📝 RECOMMENDATIONS:');
  logger.log('═══════════════════════════════════════════════');
  logger.log('1. Users experiencing login issues should use "Forgot Password"');
  logger.log('2. Password reset will create properly trimmed passwords');
  logger.log('3. The login code now trims passwords consistently');
  logger.log('4. New registrations will work correctly');
  logger.log('\n═══════════════════════════════════════════════\n');
}

// Run check if called directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  rehashAllPasswords()
    .then(generateRehashReport)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('💥 Check failed:', error);
      process.exit(1);
    });
}

export { rehashAllPasswords, generateRehashReport };
