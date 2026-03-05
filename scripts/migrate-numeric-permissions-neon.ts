#!/usr/bin/env tsx

/**
 * Migration Script: Convert numeric permissions to string arrays (Neon/Postgres)
 *
 * This script migrates users from numeric (bitmask) permissions to modern string[] format
 * See: docs/NUMERIC-PERMISSIONS-MIGRATION-GUIDE.md
 *
 * IMPORTANT:
 * - Run audit-numeric-permissions-neon.ts first to see affected users
 * - BACKUP your database before running this migration
 * - Test on a database copy first
 */

import { storage } from '../server/storage.js';
import { PERMISSIONS } from '../shared/auth-utils.js';

// Define comprehensive admin permissions for legacy users with numeric format
const COMPREHENSIVE_ADMIN_PERMISSIONS = [
  // Core admin
  PERMISSIONS.ADMIN_ACCESS,
  PERMISSIONS.ADMIN_PANEL_ACCESS,

  // User management
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_ADD,
  PERMISSIONS.USERS_EDIT,
  PERMISSIONS.USERS_DELETE,

  // Navigation
  PERMISSIONS.NAV_DASHBOARD,
  PERMISSIONS.NAV_USER_MANAGEMENT,
  PERMISSIONS.NAV_HOSTS,
  PERMISSIONS.NAV_RECIPIENTS,
  PERMISSIONS.NAV_DRIVERS,
  PERMISSIONS.NAV_VOLUNTEERS,
  PERMISSIONS.NAV_COLLECTIONS_LOG,
  PERMISSIONS.NAV_TEAM_CHAT,
  PERMISSIONS.NAV_INBOX,
  PERMISSIONS.NAV_EVENT_PLANNING,
  PERMISSIONS.NAV_PROJECTS,
  PERMISSIONS.NAV_ANALYTICS,
  PERMISSIONS.NAV_DOCUMENT_MANAGEMENT,

  // Hosts
  PERMISSIONS.HOSTS_VIEW,
  PERMISSIONS.HOSTS_ADD,
  PERMISSIONS.HOSTS_EDIT,
  PERMISSIONS.HOSTS_DELETE,

  // Recipients
  PERMISSIONS.RECIPIENTS_VIEW,
  PERMISSIONS.RECIPIENTS_ADD,
  PERMISSIONS.RECIPIENTS_EDIT,
  PERMISSIONS.RECIPIENTS_DELETE,

  // Drivers
  PERMISSIONS.DRIVERS_VIEW,
  PERMISSIONS.DRIVERS_ADD,
  PERMISSIONS.DRIVERS_EDIT,
  PERMISSIONS.DRIVERS_DELETE,

  // Volunteers
  PERMISSIONS.VOLUNTEERS_VIEW,
  PERMISSIONS.VOLUNTEERS_ADD,
  PERMISSIONS.VOLUNTEERS_EDIT,
  PERMISSIONS.VOLUNTEERS_DELETE,

  // Collections
  PERMISSIONS.COLLECTIONS_VIEW,
  PERMISSIONS.COLLECTIONS_ADD,
  PERMISSIONS.COLLECTIONS_EDIT_OWN,
  PERMISSIONS.COLLECTIONS_EDIT_ALL,
  PERMISSIONS.COLLECTIONS_DELETE_OWN,
  PERMISSIONS.COLLECTIONS_DELETE_ALL,

  // Messages
  PERMISSIONS.MESSAGES_VIEW,
  PERMISSIONS.MESSAGES_SEND,
  PERMISSIONS.MESSAGES_EDIT,
  PERMISSIONS.MESSAGES_DELETE,
  PERMISSIONS.MESSAGES_MODERATE,

  // Event requests
  PERMISSIONS.EVENT_REQUESTS_VIEW,
  PERMISSIONS.EVENT_REQUESTS_ADD,
  PERMISSIONS.EVENT_REQUESTS_EDIT,
  PERMISSIONS.EVENT_REQUESTS_DELETE,
  PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS,

  // Projects
  PERMISSIONS.PROJECTS_VIEW,
  PERMISSIONS.PROJECTS_ADD,
  PERMISSIONS.PROJECTS_EDIT_OWN,
  PERMISSIONS.PROJECTS_EDIT_ALL,
  PERMISSIONS.PROJECTS_DELETE_OWN,
  PERMISSIONS.PROJECTS_DELETE_ALL,

  // Documents
  PERMISSIONS.DOCUMENTS_VIEW,
  PERMISSIONS.DOCUMENTS_UPLOAD,
  PERMISSIONS.DOCUMENTS_MANAGE,
  PERMISSIONS.DOCUMENTS_CONFIDENTIAL,
  PERMISSIONS.DOCUMENTS_DELETE_ALL,

  // Chat rooms
  PERMISSIONS.CHAT_GENERAL,
  PERMISSIONS.CHAT_BOARD,
  PERMISSIONS.CHAT_CORE_TEAM,
  PERMISSIONS.CHAT_DIRECT,
  PERMISSIONS.CHAT_GROUP,
];

const BASIC_VOLUNTEER_PERMISSIONS = [
  PERMISSIONS.NAV_DASHBOARD,
  PERMISSIONS.NAV_MY_AVAILABILITY,
  PERMISSIONS.VOLUNTEERS_VIEW,
  PERMISSIONS.CHAT_GENERAL,
];

interface MigrationOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

async function migrateNumericPermissions(options: MigrationOptions = {}) {
  const { dryRun = false, verbose = false } = options;

  console.log('🔄 Starting numeric permissions migration (Neon database)...\n');

  if (dryRun) {
    console.log('⚠️  DRY RUN MODE: No changes will be saved to database\n');
  }

  try {
    // Use storage instance (connects to Neon)

    // Get all users
    const users = await storage.getAllUsers();

    console.log(`📊 Total users in database: ${users.length}\n`);

    let migratedCount = 0;
    const migrations: Array<{
      user: any;
      oldPermissions: any;
      newPermissions: string[];
    }> = [];

    // Find and migrate users with numeric permissions
    for (const user of users) {
      if (typeof user.permissions === 'number') {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🔍 Found user with numeric permissions:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID:    ${user.id}`);
        console.log(`   Role:  ${user.role}`);
        console.log(`   Numeric permissions value: ${user.permissions}`);

        // Determine appropriate permissions based on role
        let newPermissions: string[];

        if (user.role === 'super_admin' || user.role === 'admin') {
          newPermissions = COMPREHENSIVE_ADMIN_PERMISSIONS;
          console.log(`   ✓ Assigning comprehensive admin permissions (${newPermissions.length} permissions)`);
        } else {
          newPermissions = BASIC_VOLUNTEER_PERMISSIONS;
          console.log(`   ✓ Assigning basic volunteer permissions (${newPermissions.length} permissions)`);
        }

        if (verbose) {
          console.log(`   New permissions: ${newPermissions.slice(0, 10).join(', ')}${newPermissions.length > 10 ? '...' : ''}`);
        }

        // Store migration info
        migrations.push({
          user,
          oldPermissions: user.permissions,
          newPermissions
        });

        // Update user (unless dry run)
        if (!dryRun) {
          await storage.updateUser(user.id, {
            permissions: newPermissions
          });
          console.log(`   ✅ User migrated successfully`);
        } else {
          console.log(`   📋 Would migrate (dry run mode)`);
        }

        migratedCount++;
      }
    }

    console.log(`\n${'═'.repeat(80)}`);

    if (migratedCount === 0) {
      console.log('✅ No users with numeric permissions found. Nothing to migrate!');
    } else {
      console.log(`\n📊 Migration Summary:`);
      console.log(`   Users migrated: ${migratedCount}`);
      console.log(`   Total users:    ${users.length}`);

      if (dryRun) {
        console.log(`\n⚠️  DRY RUN COMPLETE - No changes were saved`);
        console.log(`   Run without --dry-run flag to apply changes`);
      } else {
        console.log(`\n✅ MIGRATION COMPLETE!`);
        console.log(`\n📋 Next steps:`);
        console.log(`   1. Run audit script to verify: npx tsx scripts/audit-numeric-permissions-neon.ts`);
        console.log(`   2. Test that migrated users can still log in and have appropriate access`);
        console.log(`   3. Remove numeric permission support from code (see migration guide)`);
      }
    }

    return {
      success: true,
      migratedCount,
      totalUsers: users.length,
      migrations,
      dryRun
    };

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || args.includes('-v');

  console.log('Numeric Permissions Migration Tool');
  console.log('═'.repeat(80));

  migrateNumericPermissions({ dryRun, verbose })
    .then(results => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed with error:', error);
      process.exit(1);
    });
}

export { migrateNumericPermissions };
