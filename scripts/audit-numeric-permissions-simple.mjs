#!/usr/bin/env node

/**
 * Simple Audit Script: Check for users with numeric permissions
 *
 * This script directly queries the database without loading the full app
 * to check for users with numeric (bitmask) permissions
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🔍 Starting numeric permissions audit...\n');

try {
  // Open database
  const dbPath = join(projectRoot, 'database.db');
  console.log(`📂 Database path: ${dbPath}\n`);

  const db = new Database(dbPath, { readonly: true });

  // Get all users
  const users = db.prepare('SELECT id, email, role, permissions FROM users').all();

  console.log(`📊 Total users in database: ${users.length}\n`);

  // Analyze permissions by type
  const auditResults = users.map(user => {
    let permissionType;
    let permissionsValue = user.permissions;

    if (permissionsValue === null) {
      permissionType = 'null';
    } else if (permissionsValue === undefined) {
      permissionType = 'undefined';
    } else if (typeof permissionsValue === 'number') {
      permissionType = 'numeric';
    } else if (typeof permissionsValue === 'string') {
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(permissionsValue);
        if (Array.isArray(parsed)) {
          permissionType = 'array';
          permissionsValue = parsed;
        } else if (typeof parsed === 'number') {
          permissionType = 'numeric';
          permissionsValue = parsed;
        } else {
          permissionType = 'other';
        }
      } catch (e) {
        permissionType = 'string-unparseable';
      }
    } else {
      permissionType = 'other';
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: permissionsValue,
      permissionType
    };
  });

  // Group by permission type
  const byType = {
    numeric: auditResults.filter(u => u.permissionType === 'numeric'),
    array: auditResults.filter(u => u.permissionType === 'array'),
    null: auditResults.filter(u => u.permissionType === 'null'),
    undefined: auditResults.filter(u => u.permissionType === 'undefined'),
    other: auditResults.filter(u => u.permissionType === 'other' || u.permissionType === 'string-unparseable'),
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
      console.log(`    ${user.email}: ${JSON.stringify(user.permissions)}`);
    });
    console.log('');
  }

  // Completion message
  console.log('✅ Audit complete!');

  db.close();

  // Exit with error code if numeric permissions found
  process.exit(byType.numeric.length > 0 ? 1 : 0);

} catch (error) {
  console.error('❌ Audit failed:', error);
  process.exit(2);
}
