/**
 * Direct password hashing - extracts plaintext and hashes it
 */
import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcrypt';
import { logger } from './utils/production-safe-logger';

const SALT_ROUNDS = 10;

async function hashAllPasswords() {
  logger.log('🔐 Starting DIRECT password hash migration...\n');
  
  // Get all users
  const allUsers = await db.select().from(users);
  logger.log(`Found ${allUsers.length} total users\n`);
  
  let migrated = 0;
  let alreadyHashed = 0;
  let failed = 0;
  
  for (const user of allUsers) {
    const email = user.email || 'unknown';
    const storedPassword = user.password;
    
    if (!storedPassword) {
      logger.log(`⚠️  ${email}: No password - skipping`);
      continue;
    }
    
    // Skip if already bcrypt
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      alreadyHashed++;
      logger.log(`✅ ${email}: Already bcrypt - skipping`);
      continue;
    }
    
    try {
      let plaintextPassword: string;
      let format: string;
      
      // Try JSON first
      if (storedPassword.startsWith('{')) {
        try {
          const parsed = JSON.parse(storedPassword);
          if (parsed.password) {
            plaintextPassword = parsed.password.trim();
            format = 'JSON';
          } else {
            throw new Error('No password field in JSON');
          }
        } catch {
          // Fallback to treating as plaintext
          plaintextPassword = storedPassword.trim();
          format = 'plaintext';
        }
      } else {
        plaintextPassword = storedPassword.trim();
        format = 'plaintext';
      }
      
      logger.log(`🔓 ${email}: Extracting ${format} password: "${plaintextPassword}"`);
      
      // Hash it
      const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
      logger.log(`   🔒 Hashing...`);
      
      // Update directly
      await db.update(users)
        .set({ password: hashedPassword })
        .where(db.sql`${users.id} = ${user.id}`);
      
      logger.log(`   ✅ SUCCESS - Updated to bcrypt hash\n`);
      migrated++;
      
    } catch (error) {
      logger.error(`   ❌ FAILED for ${email}:`, error);
      failed++;
    }
  }
  
  logger.log('\n═══════════════════════════════════════════════');
  logger.log('📊 MIGRATION COMPLETE');
  logger.log('═══════════════════════════════════════════════');
  logger.log(`✅ Already hashed: ${alreadyHashed}`);
  logger.log(`🔐 Migrated to bcrypt: ${migrated}`);
  logger.log(`❌ Failed: ${failed}`);
  logger.log(`📦 Total: ${allUsers.length}`);
  logger.log('═══════════════════════════════════════════════\n');
}

hashAllPasswords()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('💥 Migration failed:', err);
    process.exit(1);
  });
