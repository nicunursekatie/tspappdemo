#!/usr/bin/env tsx

/**
 * Audit Script: Check for users with numeric permissions (Neon/Postgres version)
 *
 * This script scans the Neon database for users with numeric (bitmask) permissions
 * which is a known security vulnerability documented in docs/SECURITY-NUMERIC-PERMISSIONS.md
 */

import { storage } from '../server/storage.js';

interface UserAuditResult {
  id: string;
  email: string;
  role: string;
  permissions: any;
  permissionType: 'numeric' | 'array' | 'null' | 'undefined' | 'other';
}

async function auditNumericPermissions() {
  console.log('🔍 Starting numeric permissions audit (Neon database)...\n');

  try {
    // Use storage instance (connects to Neon)

    // Get all users
    const users = await storage.getAllUsers();

    console.log(`📊 Total users in database: ${users.length}\n`);

    // Analyze permissions by type
    const auditResults: UserAuditResult[] = users.map(user => {
      let permissionType: UserAuditResult['permissionType'];

      if (user.permissions === null) {
        permissionType = 'null';
      } else if (user.permissions === undefined) {
        permissionType = 'undefined';
      } else if (typeof user.permissions === 'number') {
        permissionType = 'numeric';
      } else if (Array.isArray(user.permissions)) {
        permissionType = 'array';
      } else {
        permissionType = 'other';
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        permissionType
      };
    });

    // Group by permission type
    const byType = {
      numeric: auditResults.filter(u => u.permissionType === 'numeric'),
      array: auditResults.filter(u => u.permissionType === 'array'),
      null: auditResults.filter(u => u.permissionType === 'null'),
      undefined: auditResults.filter(u => u.permissionType === 'undefined'),
      other: auditResults.filter(u => u.permissionType === 'other'),
    };

    // Print summary
    console.log('📈 Permission Type Summary:');
    console.log(`  ✅ Array (string[]):  ${byType.array.length} users`);
    console.log(`  🚨 Numeric (bitmask): ${byType.numeric.length} users`);
    console.log(`  ⚪ Null:              ${byType.null.length} users`);
    console.log(`  ⚪ Undefined:         ${byType.undefined.length} users`);
    console.log(`  ⚠️  Other:            ${byType.other.length} users\n`);

    // CRITICAL: Report numeric permissions
    if (byType.numeric.length > 0) {
      console.log('🚨 SECURITY ALERT: Found users with numeric permissions!\n');
      console.log('These users bypass all permission checks and get full access:');
      console.log('─'.repeat(80));

      byType.numeric.forEach(user => {
        console.log(`  User: ${user.email}`);
        console.log(`  ID:   ${user.id}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Permissions (numeric): ${user.permissions}`);
        console.log('─'.repeat(80));
      });

      console.log('\n⚠️  ACTION REQUIRED: Migrate these users to string[] format\n');
      console.log('📖 See: docs/NUMERIC-PERMISSIONS-MIGRATION-GUIDE.md\n');
    } else {
      console.log('✅ Good news! No users with numeric permissions found.\n');
    }

    // Sample array permissions for reference
    if (byType.array.length > 0) {
      console.log('📋 Sample array permissions (first 3 users):');
      byType.array.slice(0, 3).forEach(user => {
        console.log(`  ${user.email} (${user.role}):`);
        if (Array.isArray(user.permissions)) {
          console.log(`    Permissions: ${user.permissions.slice(0, 5).join(', ')}${user.permissions.length > 5 ? '...' : ''}`);
          console.log(`    Total: ${user.permissions.length} permissions`);
        }
      });
      console.log('');
    }

    // Report users with null/undefined permissions
    if (byType.null.length + byType.undefined.length > 0) {
      console.log(`ℹ️  ${byType.null.length + byType.undefined.length} users have no permissions set (null/undefined)`);
      console.log('   This is normal for volunteers and new users.\n');
    }

    // Show "other" type users for debugging
    if (byType.other.length > 0) {
      console.log(`⚠️  ${byType.other.length} users have unexpected permission format:`);
      byType.other.slice(0, 3).forEach(user => {
        console.log(`    ${user.email}: ${typeof user.permissions} - ${JSON.stringify(user.permissions)}`);
      });
      console.log('');
    }

    // Completion message
    console.log('✅ Audit complete!');

    // Return results for programmatic use
    return {
      total: users.length,
      byType,
      hasNumericPermissions: byType.numeric.length > 0,
      numericUsers: byType.numeric
    };

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  auditNumericPermissions()
    .then(results => {
      process.exit(results.hasNumericPermissions ? 1 : 0);
    })
    .catch(() => {
      process.exit(2);
    });
}

export { auditNumericPermissions };
