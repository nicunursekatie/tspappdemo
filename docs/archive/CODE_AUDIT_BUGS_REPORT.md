# Code Audit - Bugs & Issues Report
**Date:** 2025-11-05
**Auditor:** Claude Code Agent
**Scope:** Deep dive code audit for likely bugs and issues

---

## Executive Summary

This audit identified **23 bugs and issues** across the codebase, ranging from critical security vulnerabilities to code quality issues. The bugs are categorized by severity:

- 🔴 **CRITICAL** (6 bugs): Security vulnerabilities requiring immediate attention
- 🟠 **HIGH** (8 bugs): Bugs that could cause data loss or system failures
- 🟡 **MEDIUM** (5 bugs): Code quality issues that may lead to bugs
- 🟢 **LOW** (4 bugs): Minor issues and code smells

---

## 🔴 CRITICAL SEVERITY BUGS

### BUG-001: Numeric Permissions Security Vulnerability ⚠️ KNOWN ISSUE
**File:** `shared/auth-utils.ts:692-699, 739-746`
**Status:** Documented in `docs/SECURITY-NUMERIC-PERMISSIONS.md` but not fixed

**Description:**
Users with numeric (bitmask) permission format bypass ALL permission checks and gain unconditional access to the entire system.

**Code:**
```typescript
// Lines 692-699
if (typeof user.permissions === 'number') {
  console.warn(`⚠️ SECURITY: User has numeric permissions (${user.permissions}) - granting chat access without validation`);
  return true; // ⚠️ GRANTS ALL ACCESS
}

// Lines 739-746
if (typeof user.permissions === 'number') {
  console.warn(`⚠️ SECURITY: User has numeric permissions (${user.permissions}) - granting access without validation for "${permission}"`);
  return true; // ⚠️ GRANTS ALL ACCESS
}
```

**Impact:**
Any user with numeric permissions can access any resource, bypassing all authorization checks.

**Fix:**
1. Migrate all users to string array format using existing migration scripts
2. Remove backward compatibility code after migration
3. Reject numeric permissions as shown in `shared/unified-auth-utils.ts:78-88`

**References:**
- `docs/SECURITY-NUMERIC-PERMISSIONS.md`
- `docs/NUMERIC-PERMISSIONS-MIGRATION-GUIDE.md`
- `scripts/audit-numeric-permissions-neon.ts`

---

### BUG-002: Unauthenticated Debug Endpoints Expose User Data
**File:** `server/auth.ts:537-576`
**Severity:** CRITICAL

**Description:**
Two debug endpoints expose sensitive user information without authentication:

**Vulnerable Endpoints:**
```typescript
// Line 537 - No authentication middleware
app.get('/api/debug/user/:email', async (req: any, res) => {
  const user = await storage.getUserByEmail(email);
  if (user) {
    res.json({
      email: user.email,
      role: user.role,
      permissions: user.permissions,  // ⚠️ EXPOSED
      isActive: user.isActive,
    });
  }
});

// Line 558 - No authentication middleware
app.get('/api/auth/debug-user/:email', async (req: any, res) => {
  const user = await storage.getUserByEmail(email);
  res.json(user ? {
    email: user.email,
    role: user.role,
    permissions: user.permissions,  // ⚠️ EXPOSED
    exists: true,
  } : { exists: false });
});
```

**Impact:**
Anyone can query user roles and permissions by email, enabling reconnaissance for privilege escalation attacks.

**Fix:**
1. Add `isAuthenticated` middleware to both endpoints
2. Add role check to restrict to admin users only
3. Or remove these debug endpoints entirely in production

**Recommended:**
```typescript
app.get('/api/debug/user/:email', isAuthenticated, requirePermission('ADMIN_ACCESS'), async (req: any, res) => {
  // ... implementation
});
```

---

### BUG-003: Legacy Temp Login Bypass
**File:** `server/auth.ts:709-738`
**Severity:** CRITICAL

**Description:**
A "temporary" login endpoint exists that bypasses all authentication and automatically logs in as a specific user (Katie) for testing purposes.

**Code:**
```typescript
// Line 709
app.post('/api/temp-login', async (req: any, res) => {
  // Get Katie's actual user data for testing
  const katieUser = await storage.getUserByEmail('katielong2316@gmail.com');

  // Create session WITHOUT password verification
  const sessionUser = { ...katieUser };
  req.session.user = sessionUser;
  req.user = sessionUser;

  res.json({ success: true, user: sessionUser });
});
```

**Impact:**
If this endpoint reaches production, anyone can authenticate as an admin user without credentials.

**Fix:**
1. Remove endpoint entirely OR
2. Protect with environment check: `if (process.env.NODE_ENV === 'production') return res.status(404).send();`
3. Add security comment about development-only usage

---

### BUG-004: Admin Password Reset Leaks Plaintext Password
**File:** `server/auth.ts:976`
**Severity:** CRITICAL

**Description:**
The admin password reset endpoint returns the new plaintext password in the JSON response, which may be logged, cached, or intercepted.

**Code:**
```typescript
// Line 974-977
res.json({
  message: `Password reset successfully for ${userEmail}`,
  newPassword: newPassword, // ⚠️ PLAINTEXT PASSWORD IN RESPONSE
});
```

**Impact:**
- Passwords exposed in server logs
- Passwords cached by proxies/CDNs
- Passwords visible in browser dev tools
- Violates security best practices

**Fix:**
Remove `newPassword` from response:
```typescript
res.json({
  message: `Password reset successfully for ${userEmail}`,
  // Password should be communicated through secure channel (email)
});
```

---

### BUG-005: Default User Passwords Stored in Metadata (Unencrypted)
**File:** `server/auth.ts:1105, 1172, 1239`
**Severity:** CRITICAL

**Description:**
Default admin, committee, and driver users have passwords stored in the `metadata` field as plaintext instead of being hashed in the `password` field.

**Code:**
```typescript
// Line 1104-1106
metadata: {
  password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',  // ⚠️ PLAINTEXT
},

// Line 1171-1173
metadata: {
  password: process.env.DEFAULT_COMMITTEE_PASSWORD || 'committee123',  // ⚠️ PLAINTEXT
},

// Line 1238-1240
metadata: {
  password: process.env.DEFAULT_DRIVER_PASSWORD || 'driver123',  // ⚠️ PLAINTEXT
},
```

**Impact:**
- Passwords stored in plaintext in database
- Anyone with database access can see passwords
- Inconsistent with proper user creation flow (which uses bcrypt)

**Fix:**
Hash passwords before storing in user creation:
```typescript
const hashedPassword = await bcrypt.hash(
  process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
  10
);

await storage.createUser({
  id: adminId,
  password: hashedPassword,  // Store in password field
  // Don't store in metadata
  metadata: {},
});
```

---

### BUG-006: Hardcoded Email in Permission Logic
**File:** `server/auth.ts:590-600`
**Severity:** CRITICAL (Maintainability)

**Description:**
Special permission logic hardcoded for specific user email "katielong2316@gmail.com" in the permission fix endpoint.

**Code:**
```typescript
// Lines 589-600
// Special case: Give Katie projects access if requested by admin
if (user.email === 'katielong2316@gmail.com') {
  if (!correctPermissions.includes('view_projects')) {
    correctPermissions = [...correctPermissions, 'view_projects'];
    logger.log('Adding VIEW_PROJECTS permission to Katie');
  }
  // Force update Katie regardless to ensure she gets projects access
  logger.log(`Forcing Katie's permission update...`);
}
```

**Impact:**
- Violates separation of concerns
- Breaks when email changes
- Makes permission system unpredictable
- Creates maintenance burden

**Fix:**
Remove hardcoded logic. Use proper role-based permissions or database flags.

---

## 🟠 HIGH SEVERITY BUGS

### BUG-007: Empty Catch Blocks Silence Errors
**Files:**
- `server/routes/expenses.ts:269, 390, 424`
- `server/routes/event-requests.ts` (multiple instances)

**Description:**
Multiple empty catch blocks silently swallow errors, making debugging impossible.

**Code:**
```typescript
// expenses.ts:269
await fs.unlink(req.file.path).catch(() => {});  // ⚠️ Empty catch

// expenses.ts:390
await fs.unlink(req.file.path).catch(() => {});  // ⚠️ Empty catch

// expenses.ts:424
await fs.unlink(req.file.path).catch(() => {});  // ⚠️ Empty catch
```

**Impact:**
- File system errors are hidden
- Disk space leaks from orphaned temp files
- Impossible to diagnose issues

**Fix:**
Log errors even if not critical:
```typescript
await fs.unlink(req.file.path).catch(err => {
  logger.warn('Failed to delete temp file', { path: req.file.path, error: err });
});
```

---

### BUG-008: Unprotected JSON.parse() Could Crash Server
**Files:** Multiple files (see grep results)
**Examples:**
- `server/services/ai-scheduling/index.ts:113`
- `server/routes/event-requests.ts:1583, 3120, 3125`
- `server/routes/audit-logs.ts:47`

**Description:**
Many `JSON.parse()` calls lack try-catch protection, which will crash the server if malformed JSON is encountered.

**Code Examples:**
```typescript
// server/services/ai-scheduling/index.ts:113
const parsedResponse: OpenAiDateResponse = JSON.parse(aiResponse);  // ⚠️ Unprotected

// server/routes/event-requests.ts:1583
processedUpdates.sandwichTypes = JSON.parse(req.body.sandwichTypes);  // ⚠️ Unprotected

// server/routes/audit-logs.ts:47
oldData = JSON.parse(log.oldData);  // ⚠️ Unprotected
```

**Impact:**
- Server crashes on malformed data
- Denial of service vulnerability
- Poor user experience

**Fix:**
Wrap all JSON.parse calls:
```typescript
try {
  const data = JSON.parse(jsonString);
} catch (error) {
  logger.error('JSON parse error', { error, data: jsonString });
  // Handle error appropriately
}
```

---

### BUG-009: Race Condition in Session Save
**File:** `server/auth.ts:690-701, 1027-1029`
**Severity:** HIGH

**Description:**
Session save operations may have race conditions where the response is sent before session is persisted.

**Code:**
```typescript
// Lines 690-701
req.session.save((err: any) => {
  if (err) {
    logger.error('Session save error:', err);
    return res.status(500).json({ success: false, message: 'Session save failed' });
  }
  logger.log('Session saved successfully for user:', sessionUser.email);
  res.json({ success: true, user: sessionUser });
});

// Lines 1027-1029
req.session.save((err: unknown) => {
  if (err) logger.error('Session save error:', err);
  // ⚠️ No error response, execution continues
});
```

**Impact:**
- User appears logged in on client but session not saved on server
- Subsequent requests fail with "unauthorized"
- Poor user experience

**Fix:**
Ensure consistent error handling and consider using promises:
```typescript
try {
  await new Promise((resolve, reject) => {
    req.session.save((err) => err ? reject(err) : resolve(null));
  });
  res.json({ success: true, user: sessionUser });
} catch (err) {
  logger.error('Session save error:', err);
  return res.status(500).json({ success: false, message: 'Session save failed' });
}
```

---

### BUG-010: Missing Input Validation on Dynamic Property Access
**Files:**
- `server/routes/meetings/index.ts:530-531`
- `server/routes/meetings.ts:619-620`
- `server/routes/smart-search.ts:375`

**Description:**
Direct property access from `req.body[key]` without validation could allow prototype pollution.

**Code:**
```typescript
// server/routes/meetings/index.ts:530-531
if (req.body[key] !== undefined) {
  updates[key] = req.body[key];  // ⚠️ No validation
}

// server/routes/meetings.ts:619-620
if (req.body[key] !== undefined) {
  updates[key as keyof MeetingNote] = req.body[key];  // ⚠️ No validation
}
```

**Impact:**
- Potential prototype pollution attack
- Unexpected object properties modification
- Security vulnerability

**Fix:**
Validate keys against whitelist:
```typescript
const allowedKeys = ['title', 'description', 'status'];
if (allowedKeys.includes(key) && req.body[key] !== undefined) {
  updates[key] = req.body[key];
}
```

---

### BUG-011: Database Migration Numbering Conflicts
**Files:** `migrations/` directory
**Severity:** HIGH

**Description:**
Duplicate migration numbers detected:
- Two migrations numbered `0003`: `0003_add_expenses_table.sql` and `0003_add_promotion_graphics.sql`
- Two migrations numbered `0005`: `0005_add_notification_action_history.sql` and `0005_add_soft_delete_fields.sql`

**Impact:**
- Migration order undefined
- Potential data corruption
- Schema inconsistencies across environments

**Fix:**
Renumber migrations sequentially:
```
0003_add_expenses_table.sql
0004_add_promotion_graphics.sql  (renumber from 0003)
0005_add_notification_action_history.sql
0006_add_soft_delete_fields.sql  (renumber from 0005)
```

---

### BUG-012: Inconsistent NULL Checking Pattern
**Files:** 15 files use `=== null` or `!= undefined` (see grep results)

**Description:**
Codebase mixes explicit null checks (`=== null`) with loose equality, leading to bugs when checking for null vs undefined.

**Impact:**
- Undefined values treated differently than null
- Bugs in optional parameter handling
- Inconsistent behavior

**Fix:**
Standardize on one approach:
```typescript
// Prefer nullish coalescing
const value = data ?? defaultValue;

// Or explicit checks
if (data !== null && data !== undefined) { ... }
```

---

### BUG-013: Missing Error Handling in Promise.all Chains
**Files:** Multiple (20+ instances found)
**Examples:**
- `server/routes/promotion-graphics.ts:606`
- `server/weekly-monitoring.ts:1034`

**Description:**
Multiple `Promise.all()` calls without proper error handling. If any promise rejects, entire operation fails.

**Code:**
```typescript
// server/routes/promotion-graphics.ts:606
await Promise.all(emailPromises);  // ⚠️ No error handling

// server/weekly-monitoring.ts:1034
await Promise.all(emailPromises);  // ⚠️ No error handling
```

**Impact:**
- One failed email prevents all emails from sending
- Partial failures are not handled
- All-or-nothing behavior may not be desired

**Fix:**
Use `Promise.allSettled()` for independent operations:
```typescript
const results = await Promise.allSettled(emailPromises);
results.forEach((result, index) => {
  if (result.status === 'rejected') {
    logger.error(`Email ${index} failed:`, result.reason);
  }
});
```

---

### BUG-014: File Upload Cleanup Failures Are Silent
**File:** `server/routes/expenses.ts:247-249, 413-415`

**Description:**
File cleanup operations log warnings but don't escalate issues, potentially causing disk space leaks.

**Code:**
```typescript
// Line 247-249
await fs.unlink(req.file.path).catch(err =>
  logger.warn('Failed to delete temp file', { path: req.file!.path, error: err })
);
```

**Impact:**
- Orphaned files accumulate over time
- Disk space exhaustion
- No monitoring/alerting

**Fix:**
Add monitoring for file cleanup failures:
```typescript
await fs.unlink(req.file.path).catch(err => {
  logger.error('Failed to delete temp file - possible disk space leak', {
    path: req.file!.path,
    error: err
  });
  // Optionally: Track metric for monitoring
  metrics.tempFileCleanupFailures.inc();
});
```

---

## 🟡 MEDIUM SEVERITY BUGS

### BUG-015: Inconsistent Date Parsing Without Validation
**File:** `client/src/pages/google-calendar-availability.tsx:187-236`

**Description:**
Multiple `parseInt()` calls on date parts without NaN checks could cause invalid Date objects.

**Code:**
```typescript
const startYear = parseInt(startParts[0]);   // ⚠️ No NaN check
const startMonth = parseInt(startParts[1]) - 1;  // ⚠️ No NaN check
const startDay = parseInt(startParts[2]);    // ⚠️ No NaN check
```

**Impact:**
- Invalid dates created (NaN/NaN/NaN)
- Calendar rendering fails
- Poor user experience

**Fix:**
```typescript
const startYear = parseInt(startParts[0]);
const startMonth = parseInt(startParts[1]) - 1;
const startDay = parseInt(startParts[2]);

if (isNaN(startYear) || isNaN(startMonth) || isNaN(startDay)) {
  throw new Error('Invalid date format');
}
```

---

### BUG-016: Potential Memory Leak in Smart Search Index
**File:** `server/services/smart-search.service.ts:75, 446`

**Description:**
Search index and analytics loaded into memory from disk without size limits or cleanup.

**Code:**
```typescript
// Line 75
this.index = JSON.parse(data);  // ⚠️ Unbounded size

// Line 446
this.analytics = JSON.parse(data);  // ⚠️ Unbounded size
```

**Impact:**
- Large indexes could exhaust memory
- No pagination or streaming
- Server crashes on large datasets

**Fix:**
Add size limits and streaming:
```typescript
const stats = await fs.stat(indexFile);
if (stats.size > MAX_INDEX_SIZE) {
  throw new Error(`Index file too large: ${stats.size} bytes`);
}
this.index = JSON.parse(data);
```

---

### BUG-017: Request Context Extraction Uses Deprecated Properties
**File:** `server/routes/event-requests.ts:278`

**Description:**
Uses deprecated `req.connection.remoteAddress` which is removed in newer Express versions.

**Code:**
```typescript
const context = {
  ipAddress: req.ip || req.connection?.remoteAddress,  // ⚠️ Deprecated
  // ...
};
```

**Impact:**
- May break in future Express versions
- IP address logging may fail

**Fix:**
```typescript
const context = {
  ipAddress: req.ip || req.socket?.remoteAddress,  // Use req.socket
  // ...
};
```

---

### BUG-018: Password Approval Status Check Bypasses
**File:** `server/routes/expenses.ts:331, 454`

**Description:**
Role checks use hardcoded strings instead of constants, and only check specific roles.

**Code:**
```typescript
// Line 331
if (userRole !== 'admin' && userRole !== 'admin_coordinator') {
  return res.status(403).json({ error: 'Insufficient permissions' });
}

// Line 454
if (expense.uploadedBy !== req.user.id &&
    userRole !== 'admin' &&
    userRole !== 'admin_coordinator') {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

**Impact:**
- Bypasses permission system
- 'super_admin' role not included
- Inconsistent with permission-based auth
- Violates DRY principle

**Fix:**
Use permission system:
```typescript
const canApprove = checkPermission(req.user, PERMISSIONS.EXPENSES_APPROVE);
if (!canApprove.granted) {
  return res.status(403).json({ error: 'Insufficient permissions' });
}
```

---

### BUG-019: Massive Schema File Hard to Maintain
**File:** `shared/schema.ts` (3,364 lines)

**Description:**
Single file contains entire database schema, making it difficult to maintain and review.

**Impact:**
- Hard to find specific tables
- Merge conflicts on team changes
- Slow editor performance
- Difficult to review in PRs

**Fix:**
Split into logical modules:
```
shared/
  schema/
    users.ts
    events.ts
    collections.ts
    projects.ts
    index.ts  (exports all)
```

---

## 🟢 LOW SEVERITY ISSUES

### BUG-020: Commented Debug Code Left in Production
**File:** Multiple files with "debug" in name

**Description:**
Several files contain debug code that should be removed or feature-flagged.

**Files:**
- Debug logging in production
- Test endpoints not feature-flagged

**Fix:**
Remove or protect with `if (process.env.DEBUG) { ... }`

---

### BUG-021: Inconsistent Logger Usage
**Files:** Throughout codebase

**Description:**
Mix of `console.log`, `logger.log`, `logger.info`, `logger.warn` usage.

**Impact:**
- Inconsistent log format
- Some logs not captured by logging system
- Hard to filter/search logs

**Fix:**
Standardize on one logging system (Winston):
```typescript
// Replace all console.log with:
logger.info('message', { context });
```

---

### BUG-022: TypeScript `any` Types Reduce Type Safety
**File:** `server/auth.ts` and others (documented in `docs/typescript-any-removal-progress.md`)

**Description:**
Liberal use of `any` type reduces TypeScript's ability to catch bugs.

**Impact:**
- Runtime errors not caught at compile time
- Reduced IDE autocomplete
- Poor developer experience

**Fix:**
Replace `any` with proper types (already tracked in progress doc).

---

### BUG-023: Missing Database Connection Pool Configuration
**File:** `server/db.ts`

**Description:**
No explicit connection pool configuration for database connections.

**Impact:**
- May hit connection limits under load
- No control over connection lifecycle
- Potential connection leaks

**Fix:**
Configure connection pooling:
```typescript
const sql = neon(databaseUrl, {
  pooling: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 30000,
  }
});
```

---

## Summary Statistics

| Severity | Count | Percentage |
|----------|-------|------------|
| 🔴 Critical | 6 | 26% |
| 🟠 High | 8 | 35% |
| 🟡 Medium | 5 | 22% |
| 🟢 Low | 4 | 17% |
| **Total** | **23** | **100%** |

## Recommended Priority Order

1. **BUG-001**: Fix numeric permissions vulnerability (CRITICAL - KNOWN)
2. **BUG-002**: Secure debug endpoints (CRITICAL - DATA EXPOSURE)
3. **BUG-003**: Remove temp login bypass (CRITICAL - AUTH BYPASS)
4. **BUG-004**: Fix password leak in admin reset (CRITICAL - PASSWORD EXPOSURE)
5. **BUG-005**: Hash default user passwords (CRITICAL - PASSWORD STORAGE)
6. **BUG-006**: Remove hardcoded email logic (CRITICAL - MAINTAINABILITY)
7. **BUG-008**: Protect JSON.parse calls (HIGH - CRASHES)
8. **BUG-010**: Fix prototype pollution risk (HIGH - SECURITY)
9. **BUG-011**: Renumber migrations (HIGH - DATA INTEGRITY)
10. **BUG-007**: Fix empty catch blocks (HIGH - DEBUGGING)

## Testing Recommendations

After fixes are applied:

1. **Security Testing:**
   - Run `scripts/audit-numeric-permissions-neon.ts` to verify no numeric permissions remain
   - Test that debug endpoints require authentication
   - Verify temp login is disabled/removed
   - Test password reset doesn't leak passwords

2. **Integration Testing:**
   - Test JSON parsing with malformed data
   - Test file upload cleanup edge cases
   - Test session persistence across requests
   - Test migration order on fresh database

3. **Load Testing:**
   - Test Promise.all operations under load
   - Test database connection pooling
   - Monitor file system for orphaned temp files

---

## Notes

- This audit focused on likely bugs and security issues
- Performance optimizations and feature enhancements were not in scope
- Some issues may be by design and require product discussion before changing
- See individual files referenced for complete context

**Next Steps:**
1. Review this report with the team
2. Prioritize fixes based on risk and impact
3. Create GitHub issues/tickets for tracking
4. Implement fixes with tests
5. Deploy and monitor
