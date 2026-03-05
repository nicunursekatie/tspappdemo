/**
 * Password Migration Script
 * 
 * This script consolidates password storage from multiple locations:
 * 1. metadata->password (currently used by auth)
 * 2. password column (contains JSON objects like {"password": "xxx"})
 * 3. Generates temporary passwords for users with none
 * 
 * After migration, all passwords will be in the password column as plain strings
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface PasswordMigrationResult {
  email: string;
  source: 'metadata' | 'password_column' | 'generated';
  success: boolean;
  newPassword?: string; // Only for generated passwords
  error?: string;
}

async function migratePasswords(): Promise<PasswordMigrationResult[]> {
  logger.log('🔐 Starting password migration...\n');
  
  const results: PasswordMigrationResult[] = [];
  
  // Get all active users
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.isActive, true));
  
  logger.log(`Found ${allUsers.length} active users to process\n`);
  
  for (const user of allUsers) {
    const email = user.email || 'unknown';
    logger.log(`\n📧 Processing: ${email}`);
    
    try {
      let finalPassword: string | null = null;
      let source: 'metadata' | 'password_column' | 'generated' = 'metadata';
      
      // 1. Check metadata->password (current auth system uses this)
      const metadataPassword = (user.metadata as any)?.password;
      if (metadataPassword && typeof metadataPassword === 'string') {
        finalPassword = metadataPassword.trim();
        source = 'metadata';
        logger.log(`  ✓ Found password in metadata: "${finalPassword}"`);
      }
      
      // 2. Check password column (might be JSON wrapped)
      if (!finalPassword && user.password) {
        const passwordValue = user.password;
        
        // Try to parse as JSON in case it's {"password": "xxx"}
        try {
          const parsed = JSON.parse(passwordValue);
          if (parsed.password && typeof parsed.password === 'string') {
            finalPassword = parsed.password.trim();
            source = 'password_column';
            logger.log(`  ✓ Extracted password from JSON in password column: "${finalPassword}"`);
          }
        } catch {
          // Not JSON, treat as plain password
          if (passwordValue.trim().length > 0) {
            finalPassword = passwordValue.trim();
            source = 'password_column';
            logger.log(`  ✓ Found plain password in password column: "${finalPassword}"`);
          }
        }
      }
      
      // 3. Generate temporary password if none found
      if (!finalPassword) {
        finalPassword = 'sandwich123'; // Standard temporary password
        source = 'generated';
        logger.log(`  ⚠️  No password found - generating temporary: "${finalPassword}"`);
      }
      
      // 4. Update the user with clean password
      const updatedMetadata = { ...(user.metadata as any) };
      delete updatedMetadata.password; // Remove password from metadata
      
      await db
        .update(users)
        .set({
          password: finalPassword, // Store as plain string
          metadata: updatedMetadata, // Clean metadata without password
        })
        .where(eq(users.id, user.id));
      
      logger.log(`  ✅ Migration successful - password now in password column`);
      
      results.push({
        email,
        source,
        success: true,
        newPassword: source === 'generated' ? finalPassword : undefined,
      });
      
    } catch (error) {
      logger.error(`  ❌ Migration failed:`, error);
      results.push({
        email,
        source: 'metadata',
        success: false,
        error: String(error),
      });
    }
  }
  
  return results;
}

async function generateMigrationReport(results: PasswordMigrationResult[]) {
  logger.log('\n\n═══════════════════════════════════════════════');
  logger.log('📊 PASSWORD MIGRATION REPORT');
  logger.log('═══════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const fromMetadata = successful.filter(r => r.source === 'metadata');
  const fromColumn = successful.filter(r => r.source === 'password_column');
  const generated = successful.filter(r => r.source === 'generated');
  
  logger.log(`✅ Successfully migrated: ${successful.length}/${results.length}`);
  logger.log(`   - From metadata: ${fromMetadata.length}`);
  logger.log(`   - From password column: ${fromColumn.length}`);
  logger.log(`   - Generated new: ${generated.length}`);
  
  if (failed.length > 0) {
    logger.log(`\n❌ Failed migrations: ${failed.length}`);
    failed.forEach(r => {
      logger.log(`   - ${r.email}: ${r.error}`);
    });
  }
  
  if (generated.length > 0) {
    logger.log('\n\n⚠️  USERS WITH GENERATED TEMPORARY PASSWORDS:');
    logger.log('═══════════════════════════════════════════════');
    logger.log('These users need to be notified to set new passwords:\n');
    
    generated.forEach(r => {
      logger.log(`📧 ${r.email}`);
      logger.log(`   Temporary password: ${r.newPassword}`);
      logger.log('');
    });
    
    logger.log('Action required: Use the "Set Password" feature in User Management');
    logger.log('to set proper passwords for these users.\n');
  }
  
  logger.log('\n═══════════════════════════════════════════════');
  logger.log('✅ Migration complete!');
  logger.log('Next step: Update authentication code to use password column');
  logger.log('═══════════════════════════════════════════════\n');
}

// Run migration if called directly
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  migratePasswords()
    .then(generateMigrationReport)
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { migratePasswords, generateMigrationReport };
