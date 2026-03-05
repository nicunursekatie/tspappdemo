# Security Advisory: Numeric Permissions Vulnerability

**Status:** MITIGATED
**Severity:** CRITICAL (P0)
**Date Discovered:** 2025-10-24
**Fixed In Commit:** `97a9349`

## Summary

A critical security vulnerability was discovered and fixed where users with numeric (bitmask) permission format would be granted unconditional access to ALL permissions, allowing unauthorized access to any resource in the system.

## Timeline

### 1. Initial Issue (Pre-existing)
**File:** `shared/auth-utils.ts`
**Status:** PRE-EXISTING VULNERABILITY

The codebase already had insecure handling of numeric permissions:

```typescript
// auth-utils.ts - hasAccessToChat() and hasPermission()
if (typeof user.permissions === 'number') {
  // For numeric permissions (bitmask), return true to avoid filtering issues
  return true;  // ❌ GRANTS ALL ACCESS
}
```

**Impact:** Any user with numeric permissions gets all chat and permission access.

### 2. Type Mismatch (dc84ed8)
**Problem:** `UserForPermissions` interface was too restrictive
**Solution:** Widened type to include `number` to prevent TypeScript errors

```typescript
// BEFORE
permissions: string[] | null

// AFTER
permissions: string[] | number | null | undefined
```

### 3. Critical Vulnerability Introduced (dc84ed8)
**Problem:** Made `unified-auth-utils.ts` grant unconditional access

```typescript
// VULNERABLE CODE (dc84ed8)
else if (typeof user.permissions === 'number') {
  return {
    granted: true,  // ❌ GRANTS ALL PERMISSIONS!
    reason: 'Legacy numeric permission format (backward compatibility)',
  };
}
```

**Impact:** ANY user with numeric permissions could access ANY resource.

### 4. Vulnerability Fixed (97a9349) ✅
**Solution:** Reverted to rejecting numeric permissions

```typescript
// SECURE CODE (97a9349)
else if (typeof user.permissions === 'number') {
  console.error(`🚨 SECURITY: User ${user.id} has unsupported numeric format`);
  return {
    granted: false,  // ✅ DENY ACCESS
    reason: 'Numeric permission format not supported - must migrate',
  };
}
```

## Current Status

### ✅ SECURE: unified-auth-utils.ts
- **Rejects** numeric permissions
- **Forces** migration to string[] format
- **Logs** security errors when encountered
- This is the **recommended** permission checking function

### ⚠️ INSECURE: auth-utils.ts (Pre-existing Issue)
- **Accepts** numeric permissions
- **Grants ALL access** without validation
- Now has **security warning** comments
- Marked as **DEPRECATED** - use unified-auth-utils.ts instead

## Impact Assessment

### Fixed Vulnerability (97a9349)
- ✅ No unauthorized access through unified-auth-utils.ts
- ✅ Numeric permissions properly rejected
- ✅ Security errors logged for visibility

### Pre-existing Issue (auth-utils.ts)
- ⚠️ Still grants all access to users with numeric permissions
- ⚠️ Backward compatibility maintained
- 📝 Now documented with security warnings
- 🔍 Console warnings help identify affected users

## Affected Systems

### Permission Checking Functions

#### SECURE (Use These)
- `checkPermission()` in unified-auth-utils.ts ✅
- `hasPermission()` in unified-auth-utils.ts (wrapper) ✅

#### INSECURE (Avoid / Migrate Away)
- `hasPermission()` in auth-utils.ts ⚠️
- `hasAccessToChat()` in auth-utils.ts ⚠️

## Remediation Steps

### Immediate Actions (Completed)
- ✅ Fixed unconditional access grant in unified-auth-utils.ts
- ✅ Added security warnings to auth-utils.ts
- ✅ Documented the issue in code comments
- ✅ Updated type definitions with security notes

### Short-term Actions (Recommended)
1. **Audit Database for Numeric Permissions**
   ```sql
   SELECT id, email, role, permissions
   FROM users
   WHERE typeof(permissions) = 'number';
   ```

2. **Identify Affected Users**
   - Check application logs for security warnings
   - Users will see: `⚠️ SECURITY: User has numeric permissions`

3. **Migrate Users to String Array Format**
   ```typescript
   // Migration script
   const usersWithNumericPerms = await getUsersWithNumericPermissions();
   for (const user of usersWithNumericPerms) {
     const newPermissions = migrateNumericToArrayFormat(user.permissions);
     await storage.updateUser(user.id, { permissions: newPermissions });
   }
   ```

### Long-term Actions (Required)
1. **Remove Numeric Permission Support**
   - Remove `typeof user.permissions === 'number'` checks
   - Update `UserForPermissions` interface to only allow `string[]`
   - Add database constraint to prevent numeric permissions

2. **Add Permission Validation**
   - Validate permission format on user creation/update
   - Reject numeric permissions at API level
   - Add Zod schema validation

3. **Deprecate auth-utils.ts Permission Functions**
   - Migrate all code to use unified-auth-utils.ts
   - Remove deprecated functions
   - Update all imports

## Testing

### Verify Security Fix

```typescript
// Test 1: Numeric permissions should be REJECTED in unified-auth-utils
const userWithNumericPerms = {
  id: 'test-user',
  role: 'volunteer',
  permissions: 12345, // numeric bitmask
};

const result = checkPermission(userWithNumericPerms, 'ADMIN_ACCESS');
// Expected: result.granted === false
// Expected: result.reason includes "not supported"

// Test 2: String array permissions should work
const userWithArrayPerms = {
  id: 'test-user',
  role: 'volunteer',
  permissions: ['COLLECTIONS_VIEW', 'MESSAGES_VIEW'],
};

const result2 = checkPermission(userWithArrayPerms, 'COLLECTIONS_VIEW');
// Expected: result2.granted === true
```

### Monitor for Numeric Permissions

Check logs for security warnings:
```bash
# Search logs for security warnings
grep "SECURITY: User has numeric permissions" /var/log/app.log

# Identify affected users
grep -o "User [a-z0-9-]* has numeric permissions" /var/log/app.log | sort -u
```

## Related Files

### Modified in Security Fix
- `shared/unified-auth-utils.ts` - Reverted to rejecting numeric permissions
- `shared/auth-utils.ts` - Added security warnings to existing code
- `shared/types.ts` - Added security documentation to type definitions

### Related Documentation
- `/docs/typescript-any-removal-progress.md` - Main project documentation
- `/docs/SECURITY-NUMERIC-PERMISSIONS.md` - This file

## Prevention

### Code Review Checklist
- [ ] Never grant unconditional access based on permission format
- [ ] Always validate permission strings against required permission
- [ ] Reject unknown or legacy permission formats (don't silently grant access)
- [ ] Add security warnings for backward compatibility code
- [ ] Document security implications in type definitions

### ESLint Rules
Consider adding custom ESLint rule:
```javascript
// .eslintrc.js
rules: {
  'no-numeric-permissions': 'error', // Prevent numeric permission checks
  '@typescript-eslint/no-unsafe-return': 'error',
}
```

## References

### Commits
- `97a9349` - CRITICAL SECURITY FIX: Revert unconditional access grant
- `dc84ed8` - P1: Align permission type (introduced vulnerability)
- `3a43265` - Phase 1: Remove TypeScript any types (initial work)

### Pull Request
- https://github.com/nicunursekatie/Sandwich-Project-Platform-Final/pull/new/claude/remove-typescript-any-types-011CURUPBqRdKrY2NBNcd75f

## Contact

For questions about this security issue:
- Review code comments in affected files
- Check commit messages for detailed explanations
- Consult this documentation for remediation steps

---

**Last Updated:** 2025-10-24
**Next Review:** After numeric permission migration is complete
