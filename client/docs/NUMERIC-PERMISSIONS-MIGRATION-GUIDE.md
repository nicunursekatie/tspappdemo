# Numeric Permissions Migration Guide

## Quick Start (For Neon Database)

```bash
# 1. Install dependencies
npm install

# 2. Set your DATABASE_URL environment variable (if not already set)
export DATABASE_URL="your-neon-connection-string"

# 3. Audit your database
npx tsx scripts/audit-numeric-permissions-neon.ts

# 4. If numeric permissions found, run dry-run first
npx tsx scripts/migrate-numeric-permissions-neon.ts --dry-run

# 5. If dry-run looks good, run actual migration
npx tsx scripts/migrate-numeric-permissions-neon.ts

# 6. Verify migration succeeded
npx tsx scripts/audit-numeric-permissions-neon.ts
```

---

## Overview

This guide explains how to safely migrate users with numeric (bitmask) permissions to the modern string array format, eliminating a critical security vulnerability.

## Current Status

**Database:** This project uses **Neon (Postgres)** as its primary database.

**Note:** The local `database.db` file is a fallback for development only. Your production data is in Neon.

Migration steps below are for the Neon database.

## Background

See `docs/SECURITY-NUMERIC-PERMISSIONS.md` for full security details.

**The Problem:**
- Users with `permissions` field as `number` bypass all permission checks
- They get unconditional access to ALL resources
- This is a CRITICAL security vulnerability

**The Solution:**
- Migrate all users to `string[]` permission format
- Remove numeric permission support from codebase
- Add database constraints to prevent future numeric permissions

---

## Migration Steps

### Step 1: Audit Current Database

First, identify if you have any users with numeric permissions:

```bash
# Audit your Neon database
npm install
npx tsx scripts/audit-numeric-permissions-neon.ts
```

This script will:
- Connect to your Neon database via DATABASE_URL env variable
- Scan all users for numeric permissions
- Show you which users need migration
- Display a summary of permission types

**Expected Output:**
- If empty: ✅ No migration needed for this database
- If results: 🚨 Continue with migration steps below

### Step 2: Understand Permission Mapping

Numeric permissions use bitmasks. You need to map the numeric value to permission strings.

**Permission String Examples:**
```typescript
[
  'ADMIN_ACCESS',
  'USERS_VIEW',
  'USERS_EDIT',
  'HOSTS_VIEW',
  'COLLECTIONS_VIEW',
  'NAV_DASHBOARD',
  // ... etc
]
```

**If you have numeric permissions:**
1. Identify which bits were set in the original bitmask system
2. Map those bits to the corresponding permission strings
3. Contact the original developer for the bitmask mapping

**Most Common Scenario:**
- Users with numeric permissions are legacy admin accounts
- Safe approach: Give them all admin permissions

### Step 3: Create Backup

**CRITICAL: Always backup before migration!**

For **Neon databases**, create a backup using their UI or pg_dump:

```bash
# Option 1: Use Neon dashboard
# Go to https://console.neon.tech → Your Project → Backups → Create backup

# Option 2: Use pg_dump (if you have postgres tools installed)
# Get your DATABASE_URL from environment or Neon dashboard
export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"

# Create backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
ls -lh backup_*.sql
```

**Note:** Neon provides automatic backups, but it's still good practice to create a manual backup before major migrations.

### Step 4: Run Migration Script (Dry Run First!)

**ALWAYS test with dry run first:**

```bash
# Dry run - see what would change without actually changing it
npx tsx scripts/migrate-numeric-permissions-neon.ts --dry-run

# Review the output carefully
# If everything looks good, run the actual migration:
npx tsx scripts/migrate-numeric-permissions-neon.ts

# For verbose output:
npx tsx scripts/migrate-numeric-permissions-neon.ts --verbose
```

The migration script will:
- Find all users with numeric permissions
- Assign comprehensive admin permissions to admin/super_admin roles
- Assign basic volunteer permissions to other roles
- Update each user in the Neon database

### Step 5: Verify Migration

After migration, verify all users have proper permissions:

```bash
# Run the audit script again
npx tsx scripts/audit-numeric-permissions-neon.ts

# Should show:
# "✅ Good news! No users with numeric permissions found."
# And all users should be in the "Array (string[])" category
```

### Step 6: Remove Numeric Permission Support

Now that all users are migrated, remove the dangerous code:

#### A. Update `shared/auth-utils.ts`

Remove or replace the numeric permission handling:

```typescript
// REMOVE THIS:
if (typeof user.permissions === 'number') {
  console.warn(`⚠️ SECURITY: User has numeric permissions`);
  return true;
}

// REPLACE WITH:
if (typeof user.permissions === 'number') {
  console.error(`🚨 CRITICAL: Numeric permissions no longer supported!`);
  console.error(`User ${user.id} must be migrated to string[] format`);
  return false; // Deny access
}
```

#### B. Update Type Definitions in `shared/types.ts`

```typescript
// BEFORE:
permissions: string[] | number | null | undefined

// AFTER:
permissions: string[] | null | undefined
```

#### C. Remove TODOs

Delete the TODO comments at:
- `shared/auth-utils.ts:658`
- `shared/auth-utils.ts:705`

Replace with:
```typescript
// ✅ MIGRATION COMPLETE: All users migrated to string[] format (YYYY-MM-DD)
```

### Step 7: Add Database Constraint (Optional)

Prevent future numeric permissions at the database level:

```sql
-- SQLite doesn't support CHECK constraints on existing columns easily
-- Instead, add validation in the application layer

-- In server/storage.ts, add validation:
async updateUser(id: string, updates: Partial<UpsertUser>) {
  if (updates.permissions && typeof updates.permissions === 'number') {
    throw new Error('Numeric permissions are not allowed. Use string[] format.');
  }
  // ... rest of update logic
}
```

### Step 8: Deploy and Monitor

After deploying the changes:

1. **Monitor logs** for any security warnings
2. **Check for errors** related to permission checks
3. **Verify** that no users are locked out
4. **Test** that admin users still have appropriate access

```bash
# Monitor logs for permission issues
tail -f /var/log/app.log | grep -i permission
```

---

## Testing Checklist

Before deploying to production:

- [ ] Backup created and verified
- [ ] Audit script run successfully
- [ ] Migration script tested on copy of production data
- [ ] All users have appropriate permissions
- [ ] No numeric permissions remain in database
- [ ] Type definitions updated
- [ ] Security vulnerability tests pass
- [ ] Admin users can still access admin panel
- [ ] Regular users have appropriate restricted access

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Stop the application
systemctl stop your-app

# 2. Restore from backup
cp database.db database.db.failed
cp database.db.backup.TIMESTAMP database.db

# 3. Revert code changes
git revert <commit-hash>

# 4. Restart application
systemctl start your-app
```

---

## For Production Environments

**When running in production:**

1. **Schedule maintenance window**
2. **Notify all users** of brief downtime
3. **Run audit first** to understand scope
4. **Test migration on database copy**
5. **Execute during low-traffic period**
6. **Keep backup accessible for 30 days**
7. **Monitor closely for 24-48 hours**

---

## Summary for Current Codebase

Since your `database.db` is empty (development environment):

1. ✅ **No immediate action needed** - no users to migrate
2. ⚠️ **Do before production:** Remove numeric permission support from code
3. 🔒 **Add validation** to prevent numeric permissions in `updateUser()` and `createUser()`
4. 📝 **Update type definitions** to only allow `string[]`

The migration guide above is provided for when you deploy to production or import production data.

---

## Questions?

- Review `docs/SECURITY-NUMERIC-PERMISSIONS.md` for security details
- Check `shared/permission-config.ts` for all available permissions
- See `shared/auth-utils.ts` for current permission checking logic

**Need help?** Contact the development team or open an issue in the repository.
