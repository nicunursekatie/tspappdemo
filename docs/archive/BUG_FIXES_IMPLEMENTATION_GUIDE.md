# Bug Fixes Implementation Guide
**Date:** 2025-11-06
**Reference:** CODE_AUDIT_BUGS_REPORT.md

This guide provides step-by-step instructions to fix all high-severity bugs identified in the code audit.

---

## Table of Contents
1. [BUG-010: Prototype Pollution](#bug-010-prototype-pollution) ⚡ **DO THIS FIRST**
2. [BUG-008: Unprotected JSON.parse()](#bug-008-unprotected-jsonparse) ⚡ **DO THIS SECOND**
3. [BUG-011: Database Migration Conflicts](#bug-011-database-migration-conflicts)
4. [BUG-009: Session Race Conditions](#bug-009-session-race-conditions)
5. [BUG-013: Promise.all Failures](#bug-013-promiseall-failures)
6. [BUG-007: Empty Catch Blocks](#bug-007-empty-catch-blocks)
7. [Testing Checklist](#testing-checklist)

---

## BUG-010: Prototype Pollution
**Priority:** ⚡ CRITICAL - Fix First
**Files:** `server/routes/meetings/index.ts`, `server/routes/meetings.ts`, `server/routes/smart-search.ts`

### The Problem
```typescript
// VULNERABLE CODE
const allowedFields = ['title', 'description', 'status'];
for (const key of allowedFields) {
  if (req.body[key] !== undefined) {
    updates[key] = req.body[key];  // ❌ Attacker can send __proto__
  }
}
```

### The Fix

#### Step 1: Create a utility function
Create `server/utils/object-utils.ts`:

```typescript
/**
 * Safely copy properties from source to target, preventing prototype pollution
 */
export function safeAssign<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
  allowedKeys: string[]
): T {
  // Blacklist dangerous properties
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  for (const key of allowedKeys) {
    // Skip dangerous keys
    if (dangerousKeys.includes(key)) {
      continue;
    }

    // Only copy own properties (not inherited)
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      target[key] = source[key];
    }
  }

  return target;
}

/**
 * Validate that an object doesn't contain prototype pollution attempts
 */
export function validateNoPrototypePollution(obj: any): void {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  function checkObject(o: any, path: string = ''): void {
    if (typeof o !== 'object' || o === null) return;

    for (const key of Object.keys(o)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (dangerousKeys.includes(key)) {
        throw new Error(`Prototype pollution attempt detected: ${fullPath}`);
      }

      // Recursively check nested objects
      if (typeof o[key] === 'object' && o[key] !== null) {
        checkObject(o[key], fullPath);
      }
    }
  }

  checkObject(obj);
}
```

#### Step 2: Fix `server/routes/meetings/index.ts`

**Before (lines 530-531):**
```typescript
if (req.body[key] !== undefined) {
  updates[key] = req.body[key];
}
```

**After:**
```typescript
import { safeAssign, validateNoPrototypePollution } from '../utils/object-utils';

// At the top of the PATCH endpoint (around line 520)
try {
  // Validate incoming request body
  validateNoPrototypePollution(req.body);
} catch (error) {
  logger.error('Prototype pollution attempt detected', {
    userId: req.user?.id,
    body: req.body,
    error
  });
  return res.status(400).json({
    error: 'Invalid request: prohibited property names detected'
  });
}

// Define allowed fields
const allowedFields = [
  'title',
  'description',
  'date',
  'startTime',
  'endTime',
  'location',
  'agenda',
  'notes',
  'status',
  'attendees'
];

// Safe assignment
const updates: Partial<Meeting> = {};
safeAssign(updates, req.body, allowedFields);

// Add metadata
updates.updatedAt = new Date();

// Update database
const [updatedMeeting] = await db
  .update(meetings)
  .set(updates)
  .where(eq(meetings.id, meetingId))
  .returning();
```

#### Step 3: Fix `server/routes/meetings.ts` (line 619-620)

Same pattern as above. Replace:
```typescript
if (req.body[key] !== undefined) {
  updates[key as keyof MeetingNote] = req.body[key];
}
```

With:
```typescript
import { safeAssign, validateNoPrototypePollution } from '../utils/object-utils';

validateNoPrototypePollution(req.body);

const allowedFields = ['content', 'category', 'priority', 'assignedTo'];
const updates: Partial<MeetingNote> = {};
safeAssign(updates, req.body, allowedFields);
updates.updatedAt = new Date();
```

#### Step 4: Fix `server/routes/smart-search.ts` (line 375)

Replace:
```typescript
updatePayload[key] = req.body[key];
```

With:
```typescript
import { safeAssign, validateNoPrototypePollution } from '../utils/object-utils';

validateNoPrototypePollution(req.body);

const allowedFields = ['title', 'content', 'tags', 'category'];
const updatePayload: Record<string, any> = {};
safeAssign(updatePayload, req.body, allowedFields);
```

#### Step 5: Add middleware protection (optional but recommended)

Create `server/middleware/prototype-pollution-guard.ts`:

```typescript
import { RequestHandler } from 'express';
import { validateNoPrototypePollution } from '../utils/object-utils';
import { logger } from '../utils/production-safe-logger';

/**
 * Middleware to detect and block prototype pollution attempts
 */
export const prototypePollutionGuard: RequestHandler = (req, res, next) => {
  try {
    // Check request body
    if (req.body && typeof req.body === 'object') {
      validateNoPrototypePollution(req.body);
    }

    // Check query parameters
    if (req.query && typeof req.query === 'object') {
      validateNoPrototypePollution(req.query);
    }

    next();
  } catch (error) {
    logger.error('Prototype pollution attempt blocked', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: (req as any).user?.id,
      error
    });

    res.status(400).json({
      error: 'Invalid request: prohibited property names detected'
    });
  }
};
```

Add to `server/index.ts` after body parser:
```typescript
import { prototypePollutionGuard } from './middleware/prototype-pollution-guard';

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(prototypePollutionGuard); // Add this line
```

---

## BUG-008: Unprotected JSON.parse()
**Priority:** ⚡ CRITICAL - Fix Second
**Files:** Multiple files throughout codebase

### The Problem
```typescript
// CRASHES SERVER if malformed JSON
const data = JSON.parse(jsonString);
```

### The Fix

#### Step 1: Create safe JSON parser utility

Create `server/utils/safe-json.ts`:

```typescript
import { logger } from './production-safe-logger';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T = any>(
  jsonString: string | null | undefined,
  defaultValue?: T,
  context?: string
): ParseResult<T> {
  // Handle null/undefined
  if (jsonString === null || jsonString === undefined) {
    return {
      success: false,
      error: 'JSON string is null or undefined',
      data: defaultValue
    };
  }

  // Handle empty string
  if (typeof jsonString === 'string' && jsonString.trim() === '') {
    return {
      success: false,
      error: 'JSON string is empty',
      data: defaultValue
    };
  }

  // Attempt parse
  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('JSON parse error', {
      context,
      error: errorMessage,
      preview: typeof jsonString === 'string' ? jsonString.substring(0, 100) : 'not a string'
    });

    return {
      success: false,
      error: errorMessage,
      data: defaultValue
    };
  }
}

/**
 * Parse JSON or throw with descriptive error
 * Use when JSON is required and failure should abort operation
 */
export function parseJsonStrict<T = any>(
  jsonString: string,
  context?: string
): T {
  const result = safeJsonParse<T>(jsonString, undefined, context);

  if (!result.success) {
    throw new Error(
      `Failed to parse JSON${context ? ` (${context})` : ''}: ${result.error}`
    );
  }

  return result.data as T;
}
```

#### Step 2: Fix `server/routes/event-requests.ts` (line 1583)

**Before:**
```typescript
processedUpdates.sandwichTypes = JSON.parse(req.body.sandwichTypes);
```

**After:**
```typescript
import { safeJsonParse } from '../utils/safe-json';

// Option 1: Handle error gracefully
const parseResult = safeJsonParse(
  req.body.sandwichTypes,
  [],  // default to empty array
  'sandwichTypes field'
);

if (!parseResult.success) {
  return res.status(400).json({
    error: 'Invalid sandwichTypes format',
    details: parseResult.error
  });
}

processedUpdates.sandwichTypes = parseResult.data;

// Option 2: Use default on error
const { data: sandwichTypes } = safeJsonParse(
  req.body.sandwichTypes,
  [],
  'sandwichTypes field'
);
processedUpdates.sandwichTypes = sandwichTypes;
```

#### Step 3: Fix `server/services/ai-scheduling/index.ts` (line 113)

**Before:**
```typescript
const parsedResponse: OpenAiDateResponse = JSON.parse(aiResponse);
```

**After:**
```typescript
import { parseJsonStrict } from '../../utils/safe-json';

try {
  const parsedResponse: OpenAiDateResponse = parseJsonStrict(
    aiResponse,
    'OpenAI API response'
  );

  // Continue with parsed response...
} catch (error) {
  logger.error('Failed to parse OpenAI response', {
    error,
    responsePreview: aiResponse?.substring(0, 200)
  });

  throw new Error('AI scheduling service returned invalid response');
}
```

#### Step 4: Fix `server/routes/audit-logs.ts` (line 47)

**Before:**
```typescript
oldData = JSON.parse(log.oldData);
```

**After:**
```typescript
import { safeJsonParse } from '../utils/safe-json';

const { data: oldData } = safeJsonParse(
  log.oldData,
  {},  // default to empty object if parse fails
  'audit log oldData'
);

const { data: newData } = safeJsonParse(
  log.newData,
  {},
  'audit log newData'
);
```

#### Step 5: Fix all remaining instances

Run this command to find all JSON.parse calls:
```bash
grep -rn "JSON.parse" server/ --include="*.ts" --include="*.js"
```

For each instance, apply the appropriate pattern:
- Use `safeJsonParse()` when you can provide a default value
- Use `parseJsonStrict()` when JSON is required and operation should fail
- Always add context string for better error messages

#### Step 6: Add JSON validation middleware for API requests

Create `server/middleware/json-validator.ts`:

```typescript
import { RequestHandler } from 'express';
import { logger } from '../utils/production-safe-logger';

/**
 * Middleware to catch malformed JSON in request body
 * Must be added AFTER express.json() middleware
 */
export const jsonErrorHandler: RequestHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    logger.error('Malformed JSON in request', {
      path: req.path,
      method: req.method,
      error: err.message,
      ip: req.ip
    });

    return res.status(400).json({
      error: 'Invalid JSON in request body',
      details: 'Request body contains malformed JSON'
    });
  }

  next(err);
};
```

Add to `server/index.ts`:
```typescript
import { jsonErrorHandler } from './middleware/json-validator';

app.use(express.json());
app.use(jsonErrorHandler);  // Add this line right after express.json()
```

---

## BUG-011: Database Migration Conflicts
**Priority:** HIGH
**Files:** `migrations/0003_*.sql`, `migrations/0005_*.sql`

### The Problem
Two migrations have the same number (0003 and 0005), causing undefined execution order.

### The Fix

#### Step 1: Audit current migration state

```bash
# Check which migrations have run in each environment
npm run db:migrations:check

# Or manually check the database
psql $DATABASE_URL -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;"
```

#### Step 2: Rename conflicting migrations

**Renaming strategy:**
```
Current:
├── 0003_add_expenses_table.sql
├── 0003_add_promotion_graphics.sql  → Rename to 0004
├── 0004_add_resources_system.sql    → Rename to 0006
├── 0005_add_notification_action_history.sql
├── 0005_add_soft_delete_fields.sql  → Rename to 0007

New:
├── 0003_add_expenses_table.sql
├── 0004_add_promotion_graphics.sql  ← Renamed
├── 0005_add_notification_action_history.sql
├── 0006_add_resources_system.sql    ← Renamed
├── 0007_add_soft_delete_fields.sql  ← Renamed
```

**Commands:**
```bash
cd migrations

# Rename promotion graphics migration
mv 0003_add_promotion_graphics.sql 0004_add_promotion_graphics.sql

# Rename resources system migration
mv 0004_add_resources_system.sql 0006_add_resources_system.sql

# Rename soft delete fields migration
mv 0005_add_soft_delete_fields.sql 0007_add_soft_delete_fields.sql
```

#### Step 3: Update migration metadata

If using Drizzle meta files:
```bash
cd migrations/meta

# Update meta files to reflect new numbering
# This may require manual editing of JSON files
```

#### Step 4: Create migration verification script

Create `scripts/verify-migrations.ts`:

```typescript
import { readdirSync } from 'fs';
import { join } from 'path';

const migrationsDir = join(__dirname, '../migrations');

function verifyMigrationNumbers() {
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const numbers = new Map<string, string[]>();

  // Extract migration numbers
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (match) {
      const num = match[1];
      if (!numbers.has(num)) {
        numbers.set(num, []);
      }
      numbers.get(num)!.push(file);
    }
  }

  // Check for duplicates
  let hasDuplicates = false;
  for (const [num, files] of numbers.entries()) {
    if (files.length > 1) {
      console.error(`❌ Duplicate migration number ${num}:`);
      files.forEach(f => console.error(`   - ${f}`));
      hasDuplicates = true;
    }
  }

  if (hasDuplicates) {
    console.error('\n❌ Migration verification FAILED');
    process.exit(1);
  }

  console.log('✅ All migration numbers are unique');
  console.log(`✅ Found ${files.length} migrations`);
}

verifyMigrationNumbers();
```

Add to `package.json`:
```json
{
  "scripts": {
    "verify:migrations": "tsx scripts/verify-migrations.ts"
  }
}
```

#### Step 5: Add pre-migration check

Update your deployment script to verify migrations first:
```bash
#!/bin/bash
set -e

echo "Verifying migration integrity..."
npm run verify:migrations

echo "Running database migrations..."
npm run db:migrate

echo "Migrations complete!"
```

---

## BUG-009: Session Race Conditions
**Priority:** HIGH
**Files:** `server/auth.ts:690-701`, `server/auth.ts:1027-1029`

### The Problem
Session save callbacks don't properly await completion, leading to race conditions.

### The Fix

#### Step 1: Create promisified session utilities

Create `server/utils/session-utils.ts`:

```typescript
import { Request } from 'express';
import { logger } from './production-safe-logger';

/**
 * Promisified session save
 */
export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      return reject(new Error('Session not initialized'));
    }

    req.session.save((err) => {
      if (err) {
        logger.error('Session save error', {
          error: err,
          sessionID: req.sessionID
        });
        reject(err);
      } else {
        logger.debug('Session saved successfully', {
          sessionID: req.sessionID
        });
        resolve();
      }
    });
  });
}

/**
 * Promisified session destroy
 */
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      return resolve(); // No session to destroy
    }

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destroy error', {
          error: err,
          sessionID: req.sessionID
        });
        reject(err);
      } else {
        logger.debug('Session destroyed successfully', {
          sessionID: req.sessionID
        });
        resolve();
      }
    });
  });
}

/**
 * Promisified session regeneration
 */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      return reject(new Error('Session not initialized'));
    }

    req.session.regenerate((err) => {
      if (err) {
        logger.error('Session regenerate error', { error: err });
        reject(err);
      } else {
        logger.debug('Session regenerated successfully');
        resolve();
      }
    });
  });
}
```

#### Step 2: Fix login endpoint (server/auth.ts:690-701)

**Before:**
```typescript
req.session.user = sessionUser;
req.user = sessionUser;

req.session.save((err: any) => {
  if (err) {
    logger.error('Session save error:', err);
    return res.status(500).json({ success: false, message: 'Session save failed' });
  }
  logger.log('Session saved successfully for user:', sessionUser.email);
  res.json({ success: true, user: sessionUser });
});
```

**After:**
```typescript
import { saveSession } from './utils/session-utils';

// Set session data
req.session.user = sessionUser;
req.user = sessionUser;

// Await session save before responding
try {
  await saveSession(req);

  logger.log('Session saved successfully for user:', sessionUser.email);
  logger.log('Session ID:', req.sessionID);

  res.json({ success: true, user: sessionUser });
} catch (err) {
  logger.error('Session save error:', err);
  return res.status(500).json({
    success: false,
    message: 'Session save failed. Please try again.'
  });
}
```

#### Step 3: Fix isAuthenticated middleware (server/auth.ts:1027-1029)

**Before:**
```typescript
req.session.save((err: unknown) => {
  if (err) logger.error('Session save error:', err);
});
```

**After:**
```typescript
import { saveSession } from './utils/session-utils';

// After updating session with fresh user data
try {
  await saveSession(req);
} catch (err) {
  logger.error('Failed to save updated session:', err);
  // Continue anyway - session update is not critical for this request
}
```

#### Step 4: Fix logout endpoint

**Before:**
```typescript
req.session.destroy((err: any) => {
  if (err) {
    logger.error('Session destroy error:', err);
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
  res.clearCookie('tsp.session');
  res.json({ success: true, message: 'Logged out successfully' });
});
```

**After:**
```typescript
import { destroySession } from './utils/session-utils';

try {
  await destroySession(req);
  res.clearCookie('tsp.session');
  res.json({ success: true, message: 'Logged out successfully' });
} catch (err) {
  logger.error('Session destroy error:', err);
  // Still clear cookie and return success - user intent was to log out
  res.clearCookie('tsp.session');
  res.json({ success: true, message: 'Logged out successfully' });
}
```

---

## BUG-013: Promise.all Failures
**Priority:** HIGH
**Files:** Multiple files with Promise.all usage

### The Problem
`Promise.all()` fails completely if any single promise rejects, causing all-or-nothing behavior.

### The Fix

#### Step 1: Understand when to use each Promise method

```typescript
// ❌ Promise.all - All or nothing (rarely what you want)
await Promise.all([...])

// ✅ Promise.allSettled - All attempts made, handle each result
const results = await Promise.allSettled([...])

// ✅ Promise.race - First to complete wins
const winner = await Promise.race([...])

// ✅ Promise.any - First to succeed wins
const first = await Promise.any([...])
```

#### Step 2: Create batch processing utilities

Create `server/utils/batch-operations.ts`:

```typescript
import { logger } from './production-safe-logger';

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ error: any; index: number }>;
  total: number;
  successCount: number;
  failureCount: number;
}

/**
 * Process array of promises, continuing even if some fail
 */
export async function batchProcess<T>(
  promises: Promise<T>[],
  context?: string
): Promise<BatchResult<T>> {
  const results = await Promise.allSettled(promises);

  const successful: T[] = [];
  const failed: Array<{ error: any; index: number }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({ error: result.reason, index });
      logger.error(`Batch operation failed at index ${index}`, {
        context,
        error: result.reason
      });
    }
  });

  const summary = {
    successful,
    failed,
    total: promises.length,
    successCount: successful.length,
    failureCount: failed.length
  };

  if (context) {
    logger.info(`Batch operation complete: ${context}`, {
      total: summary.total,
      successful: summary.successCount,
      failed: summary.failureCount
    });
  }

  return summary;
}

/**
 * Send emails with individual error handling
 */
export async function batchSendEmails(
  emailPromises: Promise<any>[],
  context: string
): Promise<BatchResult<any>> {
  const result = await batchProcess(emailPromises, context);

  // Log detailed failure information
  if (result.failureCount > 0) {
    logger.warn(`${result.failureCount} emails failed to send`, {
      context,
      failures: result.failed
    });
  }

  return result;
}
```

#### Step 3: Fix `server/routes/promotion-graphics.ts` (line 606)

**Before:**
```typescript
await Promise.all(emailPromises);
```

**After:**
```typescript
import { batchSendEmails } from '../utils/batch-operations';

const emailResult = await batchSendEmails(
  emailPromises,
  'Promotion graphic notifications'
);

// Log results
logger.info('Email batch complete', {
  total: emailResult.total,
  sent: emailResult.successCount,
  failed: emailResult.failureCount
});

// Optionally return summary to client
if (emailResult.failureCount > 0) {
  logger.warn('Some notification emails failed', {
    failedIndices: emailResult.failed.map(f => f.index)
  });
}

// Continue with response - don't fail entire operation
res.json({
  success: true,
  message: 'Promotion graphic processed',
  emailsSent: emailResult.successCount,
  emailsFailed: emailResult.failureCount
});
```

#### Step 4: Fix `server/weekly-monitoring.ts` (line 1034)

**Before:**
```typescript
await Promise.all(emailPromises);
```

**After:**
```typescript
import { batchSendEmails } from './utils/batch-operations';

const emailResult = await batchSendEmails(
  emailPromises,
  'Weekly monitoring summaries'
);

logger.info('Weekly monitoring emails sent', {
  total: emailResult.total,
  successful: emailResult.successCount,
  failed: emailResult.failureCount
});

// Store failed recipients for retry
if (emailResult.failureCount > 0) {
  // Could implement retry logic here
  await storeFailedEmailsForRetry(emailResult.failed);
}
```

#### Step 5: Fix parallel operations that should complete

For operations where you need to wait for all to complete (database updates, etc.):

**Before:**
```typescript
await Promise.all([
  updateDatabase(),
  sendNotification(),
  logActivity()
]);
```

**After:**
```typescript
const results = await Promise.allSettled([
  updateDatabase(),
  sendNotification(),
  logActivity()
]);

// Check critical operations
const dbUpdateResult = results[0];
if (dbUpdateResult.status === 'rejected') {
  // Database update is critical - throw error
  throw new Error('Critical: Database update failed');
}

// Non-critical operations - just log
const notificationResult = results[1];
if (notificationResult.status === 'rejected') {
  logger.warn('Notification failed', { error: notificationResult.reason });
}

const logResult = results[2];
if (logResult.status === 'rejected') {
  logger.warn('Activity logging failed', { error: logResult.reason });
}
```

#### Step 6: Add retry logic for important operations

```typescript
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }

      logger.warn(`Operation failed, retrying (${attempt}/${maxRetries})`, { error });
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw new Error('Should never reach here');
}

// Usage:
const results = await Promise.allSettled(
  emailAddresses.map(email =>
    retryOperation(() => sendEmail(email), 3, 2000)
  )
);
```

---

## BUG-007: Empty Catch Blocks
**Priority:** MEDIUM (but easy to fix)
**Files:** `server/routes/expenses.ts`, others

### The Problem
Errors are silently swallowed, preventing debugging and causing resource leaks.

### The Fix

#### Step 1: Fix file cleanup in `server/routes/expenses.ts`

**Find all instances:**
```typescript
await fs.unlink(req.file.path).catch(() => {});
```

**Replace with:**
```typescript
await fs.unlink(req.file.path).catch(err => {
  logger.warn('Failed to delete temporary file', {
    path: req.file!.path,
    error: err,
    userId: req.user?.id,
    operation: 'expense creation cleanup'
  });

  // Track metric for monitoring
  if (typeof metrics !== 'undefined') {
    metrics.tempFileCleanupFailures.inc();
  }
});
```

#### Step 2: Specific fixes for each location

**Line 269 (POST /api/expenses - error handler):**
```typescript
if (error instanceof z.ZodError) {
  return res.status(400).json({ error: 'Invalid input', details: error.errors });
}

// Clean up uploaded file if it exists
if (req.file?.path) {
  await fs.unlink(req.file.path).catch(err => {
    logger.warn('Failed to cleanup file after validation error', {
      path: req.file!.path,
      error: err
    });
  });
}

res.status(500).json({ error: 'Failed to create expense' });
```

**Line 390 (POST /:id/receipt - expense not found):**
```typescript
if (!existingExpense) {
  await fs.unlink(req.file.path).catch(err => {
    logger.error('Failed to cleanup file after expense not found', {
      path: req.file.path,
      error: err,
      expenseId
    });
  });
  return res.status(404).json({ error: 'Expense not found' });
}
```

**Line 424 (POST /:id/receipt - error handler):**
```typescript
} catch (error) {
  logger.error('Error uploading receipt', {
    error,
    userId: req.user?.id,
    expenseId: req.params.id
  });

  // Clean up uploaded file if it exists
  if (req.file?.path) {
    await fs.unlink(req.file.path).catch(err => {
      logger.error('Critical: Failed to cleanup file after upload error', {
        path: req.file!.path,
        cleanupError: err,
        originalError: error
      });

      // This could indicate disk issues or permission problems
      // Consider alerting operations team
    });
  }

  res.status(500).json({ error: 'Failed to upload receipt' });
}
```

#### Step 3: Add file cleanup monitoring

Create `server/utils/file-cleanup.ts`:

```typescript
import { promises as fs } from 'fs';
import { logger } from './production-safe-logger';

export interface CleanupResult {
  success: boolean;
  path: string;
  error?: any;
}

/**
 * Safely delete a file with proper error handling and logging
 */
export async function safeDeleteFile(
  path: string,
  context?: string
): Promise<CleanupResult> {
  try {
    await fs.unlink(path);
    logger.debug('File deleted successfully', { path, context });
    return { success: true, path };
  } catch (error) {
    const errorCode = (error as any)?.code;

    // ENOENT = file doesn't exist (not really an error)
    if (errorCode === 'ENOENT') {
      logger.debug('File already deleted or does not exist', { path, context });
      return { success: true, path };
    }

    // Other errors are concerning
    logger.error('Failed to delete file', {
      path,
      context,
      error,
      errorCode
    });

    return { success: false, path, error };
  }
}

/**
 * Clean up multiple files
 */
export async function cleanupFiles(
  paths: string[],
  context?: string
): Promise<CleanupResult[]> {
  const results = await Promise.allSettled(
    paths.map(path => safeDeleteFile(path, context))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        success: false,
        path: paths[index],
        error: result.reason
      };
    }
  });
}
```

Update expenses route to use it:
```typescript
import { safeDeleteFile } from '../utils/file-cleanup';

// Instead of:
await fs.unlink(req.file.path).catch(() => {});

// Use:
await safeDeleteFile(req.file.path, 'expense receipt upload');
```

---

## Testing Checklist

### After Fixing Prototype Pollution (BUG-010)

```bash
# Test 1: Normal update should work
curl -X PATCH http://localhost:5000/api/meetings/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -d '{"title": "Updated Meeting Title"}'
# Expected: 200 OK

# Test 2: Prototype pollution attempt should be blocked
curl -X PATCH http://localhost:5000/api/meetings/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -d '{"__proto__": {"isAdmin": true}, "title": "Hacked"}'
# Expected: 400 Bad Request

# Test 3: Constructor pollution should be blocked
curl -X PATCH http://localhost:5000/api/meetings/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -d '{"constructor": {"prototype": {"isAdmin": true}}}'
# Expected: 400 Bad Request
```

### After Fixing JSON.parse (BUG-008)

```bash
# Test 1: Valid JSON should work
curl -X PATCH http://localhost:5000/api/event-requests/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -d '{"sandwichTypes": "[\"turkey\", \"ham\"]"}'
# Expected: 200 OK

# Test 2: Invalid JSON should return error (not crash)
curl -X PATCH http://localhost:5000/api/event-requests/1 \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -d '{"sandwichTypes": "}{invalid json"}'
# Expected: 400 Bad Request with error message
# Server should NOT crash

# Test 3: Check server logs
# Should see: "JSON parse error" in logs, not server crash
```

### After Fixing Session Race Conditions (BUG-009)

```javascript
// Test with this script: tests/session-race-test.js
async function testSessionRace() {
  // Login
  const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    credentials: 'include'
  });

  const cookies = loginResponse.headers.get('set-cookie');

  // Immediately make next request
  const dashboardResponse = await fetch('http://localhost:5000/api/dashboard', {
    headers: { Cookie: cookies },
    credentials: 'include'
  });

  console.log('Dashboard status:', dashboardResponse.status);
  // Expected: 200 OK (not 401)
}

// Run 10 times to catch race condition
for (let i = 0; i < 10; i++) {
  await testSessionRace();
}
```

### After Fixing Promise.all (BUG-013)

```typescript
// Create test: tests/batch-email-test.ts
import { batchSendEmails } from '../server/utils/batch-operations';

async function testBatchEmails() {
  const emails = [
    sendEmail('valid@example.com'),
    sendEmail('valid2@example.com'),
    sendEmail('invalid-email'),  // This will fail
    sendEmail('valid3@example.com'),
  ];

  const result = await batchSendEmails(emails, 'Test batch');

  console.log('Total:', result.total);  // Expected: 4
  console.log('Success:', result.successCount);  // Expected: 3
  console.log('Failed:', result.failureCount);  // Expected: 1

  // All valid emails should have sent despite one failure
  assert(result.successCount === 3);
}
```

### After Fixing Empty Catch Blocks (BUG-007)

```bash
# Test file cleanup logging
# 1. Upload a receipt
curl -X POST http://localhost:5000/api/expenses \
  -H "Cookie: tsp.session=YOUR_SESSION" \
  -F "receipt=@test-receipt.pdf" \
  -F "description=Test expense"

# 2. Check logs for cleanup messages
grep "File deleted successfully" logs/combined.log
# Should see successful cleanup logs

# 3. Simulate permission error (make temp directory read-only)
chmod 444 uploads/temp

# 4. Upload another receipt
# Check logs - should see:
# "Failed to delete file" with error details
grep "Failed to delete file" logs/error.log
```

### Migration Testing (BUG-011)

```bash
# 1. Verify migration numbering
npm run verify:migrations
# Expected: "✅ All migration numbers are unique"

# 2. Test on fresh database
dropdb sandwich_test && createdb sandwich_test
DATABASE_URL="postgresql://localhost/sandwich_test" npm run db:migrate
# Expected: All migrations run in order without errors

# 3. Check migration order
psql sandwich_test -c "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id;"
# Expected: Migrations in correct sequential order (0003, 0004, 0005, 0006, 0007)
```

---

## Implementation Order

**Week 1: Critical Security**
1. ✅ BUG-010: Prototype Pollution (1-2 days)
2. ✅ BUG-008: Unprotected JSON.parse (1-2 days)

**Week 2: Data Integrity**
3. ✅ BUG-011: Migration Conflicts (1 day)
4. ✅ BUG-009: Session Race Conditions (1-2 days)

**Week 3: Reliability**
5. ✅ BUG-013: Promise.all Failures (2-3 days)
6. ✅ BUG-007: Empty Catch Blocks (1 day)

**Total Estimated Time:** 2-3 weeks for all fixes including testing

---

## Deployment Strategy

### Phase 1: Utilities & Infrastructure
1. Deploy utility functions (safe-json, session-utils, object-utils, batch-operations)
2. Deploy middleware (prototype-pollution-guard, json-error-handler)
3. No breaking changes yet

### Phase 2: Core Fixes
1. Deploy session fixes (requires testing login flow)
2. Deploy JSON.parse fixes (low risk)
3. Deploy prototype pollution fixes (test thoroughly)

### Phase 3: Operations
1. Rename migrations (coordinate with team)
2. Deploy Promise.allSettled changes
3. Deploy catch block improvements

### Rollback Plan
Each phase should be deployable independently. If issues arise:
- Phase 1: Simple rollback (utility functions have defaults)
- Phase 2: May need to roll back session changes if login breaks
- Phase 3: Can roll back individual fixes without affecting others

---

## Monitoring After Deployment

### Metrics to Watch
1. **Error rates**: Should decrease after fixes
2. **Session failures**: Should drop to near zero
3. **File cleanup failures**: Now visible in logs
4. **Email delivery rates**: Should improve with Promise.allSettled

### Log Queries
```bash
# Check for prototype pollution attempts
grep "Prototype pollution attempt" logs/error.log

# Check for JSON parse errors
grep "JSON parse error" logs/error.log

# Check session save success rate
grep "Session saved successfully" logs/combined.log | wc -l

# Check file cleanup issues
grep "Failed to delete file" logs/error.log
```

### Alerts to Configure
1. Alert if prototype pollution attempts > 5/hour
2. Alert if JSON parse errors spike
3. Alert if file cleanup failures > 10/hour
4. Alert if session save errors > 1% of logins

---

## Questions?

If you encounter issues during implementation:
1. Check the test cases in this guide
2. Review error logs for specific error messages
3. Consult the original bug report (CODE_AUDIT_BUGS_REPORT.md)
4. Test each fix in isolation before combining

Good luck! 🚀
