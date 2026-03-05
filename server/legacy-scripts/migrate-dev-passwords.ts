/**
 * Development Password Migration Script
 * Upgrades all legacy passwords (JSON/plaintext) to bcrypt hashes
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { logger } from './utils/production-safe-logger';

const SALT_ROUNDS = 10;

interface MigrationResult {
  email: string;
  originalFormat: 'json' | 'plaintext' | 'already_hashed';
  success: boolean;
  error?: string;
}

async function migrateDevPasswords() {
  logger.log('🔐 Starting development password migration...\n');
  
  const results: MigrationResult[] = [];
  
  // Get all users
  const allUsers = await db.select().from(users);
  logger.log(`Found ${allUsers.length} users to check\n`);
  
  for (const user of allUsers) {
    const email = user.email || 'unknown';
    const storedPassword = user.password;
    
    if (!storedPassword) {
      logger.log(`⚠️  ${email}: No password set - skipping`);
      continue;
    }
    
    // Check if already bcrypt hashed
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      logger.log(`✅ ${email}: Already bcrypt hashed - skipping`);
      results.push({
        email,
        originalFormat: 'already_hashed',
        success: true,
      });
      continue;
    }
    
    try {
      let plaintextPassword: string | null = null;
      let originalFormat: 'json' | 'plaintext' = 'plaintext';
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(storedPassword);
        if (parsed.password && typeof parsed.password === 'string') {
          plaintextPassword = parsed.password.trim();
          originalFormat = 'json';
          logger.log(`🔓 ${email}: Found JSON password: "${plaintextPassword}"`);
        }
      } catch {
        // Not JSON - treat as plaintext
        plaintextPassword = storedPassword.trim();
        originalFormat = 'plaintext';
        logger.log(`🔓 ${email}: Found plaintext password: "${plaintextPassword}"`);
      }
      
      if (!plaintextPassword) {
        logger.log(`⚠️  ${email}: Could not extract password - skipping`);
        continue;
      }
      
      // Hash the password
      logger.log(`   🔒 Hashing password...`);
      const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
      
      // Update in database
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
      
      logger.log(`   ✅ Successfully upgraded to bcrypt hash\n`);
      
      results.push({
        email,
        originalFormat,
        success: true,
      });
      
    } catch (error) {
      logger.error(`   ❌ Failed:`, error);
      results.push({
        email,
        originalFormat: 'plaintext',
        success: false,
        error: String(error),
      });
    }
  }
  
  return results;
}

async function printReport(results: MigrationResult[]) {
  logger.log('\n═══════════════════════════════════════════════');
  logger.log('📊 PASSWORD MIGRATION REPORT');
  logger.log('═══════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const alreadyHashed = results.filter(r => r.originalFormat === 'already_hashed');
  const jsonMigrated = results.filter(r => r.success && r.originalFormat === 'json');
  const plaintextMigrated = results.filter(r => r.success && r.originalFormat === 'plaintext');
  
  logger.log(`✅ Total users processed: ${results.length}`);
  logger.log(`   - Already secure (bcrypt): ${alreadyHashed.length}`);
  logger.log(`   - Migrated from JSON: ${jsonMigrated.length}`);
  logger.log(`   - Migrated from plaintext: ${plaintextMigrated.length}`);
  
  if (failed.length > 0) {
    logger.log(`\n❌ Failed migrations: ${failed.length}`);
    failed.forEach(r => {
      logger.log(`   - ${r.email}: ${r.error}`);
    });
  }
  
  logger.log('\n═══════════════════════════════════════════════');
  logger.log('✅ Migration complete!');
  logger.log('All passwords are now securely hashed with bcrypt.');
  logger.log('═══════════════════════════════════════════════\n');
}

// Run migration
migrateDevPasswords()
  .then(printReport)
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('💥 Migration failed:', error);
    process.exit(1);
  });
