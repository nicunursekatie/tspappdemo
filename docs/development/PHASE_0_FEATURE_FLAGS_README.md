# Phase 0: Feature Flags Infrastructure ✅

**Status:** Complete
**Date:** 2025-10-26
**Risk Level:** Zero (additive only, no production changes)

---

## What Was Built

### 1. Database Schema
**File:** `/shared/schema.ts` (lines 2832-2857)

Added `feature_flags` table with:
- Global enable/disable toggle
- User-specific targeting
- Role-based targeting
- Percentage rollout (0-100%)
- Metadata for custom configuration

### 2. Backend Service Layer
**File:** `/server/services/feature-flags.ts`

`FeatureFlagService` class with methods:
- `isEnabled(flagName, userId, userRole)` - Check if flag is enabled for user
- `setFlag(flagName, options)` - Create or update flag
- `enableFlag(flagName)` - Global enable
- `disableFlag(flagName)` - Global disable
- `enableForUsers(flagName, userIds)` - Target specific users
- `enableForRoles(flagName, roles)` - Target specific roles
- `setPercentageRollout(flagName, percentage)` - Gradual rollout (0-100%)
- `initializeUnifiedActivityFlags()` - Initialize all migration flags

### 3. API Routes
**File:** `/server/routes/feature-flags.ts`

Endpoints:
- `GET /api/feature-flags/check/:flagName` - Check if enabled for current user
- `POST /api/feature-flags/check-multiple` - Check multiple flags at once
- `GET /api/feature-flags` - Get all flags (Admin only)
- `POST /api/feature-flags` - Create/update flag (Admin only)
- `POST /api/feature-flags/:flagName/enable` - Enable globally (Admin only)
- `POST /api/feature-flags/:flagName/disable` - Disable globally (Admin only)
- `POST /api/feature-flags/:flagName/enable-users` - Enable for specific users (Admin only)
- `POST /api/feature-flags/:flagName/percentage` - Set percentage rollout (Admin only)
- `POST /api/feature-flags/initialize-unified-activities` - Initialize all migration flags (Admin only)

### 4. Frontend React Hook
**File:** `/client/src/hooks/useFeatureFlag.ts`

Hooks:
- `useFeatureFlag(flagName)` - Check single flag
- `useFeatureFlags(flagNames[])` - Check multiple flags

Usage example:
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function MyComponent() {
  const { enabled, isLoading } = useFeatureFlag('unified-activities-ui');

  if (isLoading) return <Loading />;

  if (enabled) {
    return <NewThreadUI />;
  }

  return <OldUI />;
}
```

### 5. Route Registration
**File:** `/server/routes/index.ts` (lines 57, 324-331)

Feature flags routes registered at `/api/feature-flags`

### 6. SQL Migration File
**File:** `/migrations/0001_add_feature_flags.sql`

Manual migration file for review and execution.

---

## How to Apply Migration

### Option A: Using Drizzle Kit Push (Recommended for Dev)
```bash
npm run db:push
```
This will automatically apply the schema changes from `shared/schema.ts` to your database.

### Option B: Manual SQL Execution (Safer for Production)
1. Review the migration file:
   ```bash
   cat migrations/0001_add_feature_flags.sql
   ```

2. Connect to your database and run it:
   ```bash
   psql $DATABASE_URL -f migrations/0001_add_feature_flags.sql
   ```

### Option C: Through Database Client
Copy the contents of `migrations/0001_add_feature_flags.sql` and paste into your database client (pgAdmin, DBeaver, etc.)

---

## Verification Steps

After applying the migration:

### 1. Check Table Exists
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'feature_flags';
```
Should return 1 row.

### 2. Check Default Flags Created
```sql
SELECT flag_name, enabled
FROM feature_flags
ORDER BY id;
```
Should return 6 rows (all unified-activities-* flags).

### 3. Test API Endpoint
```bash
# Login to your app first, then:
curl http://localhost:5000/api/feature-flags/check/unified-activities \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE"
```
Should return: `{"enabled": false, "reason": "Globally disabled"}`

### 4. Test React Hook (in browser console)
```javascript
// In browser console after logging in:
fetch('/api/feature-flags/check/unified-activities')
  .then(r => r.json())
  .then(console.log)
```

---

## Using Feature Flags in Code

### Backend Example (Node/Express)
```typescript
import { featureFlagService } from '../services/feature-flags';

router.get('/api/activities', async (req, res) => {
  const enabled = await featureFlagService.isEnabled(
    'unified-activities-read',
    req.user?.id,
    req.user?.role
  );

  if (enabled) {
    // New unified activities system
    const activities = await activityService.getActivities();
    return res.json(activities);
  }

  // Old system
  const tasks = await db.select().from(tasks);
  return res.json(tasks);
});
```

### Frontend Example (React)
```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

function TaskList() {
  const { enabled } = useFeatureFlag('unified-activities-ui');

  return enabled ? <NewThreadUI /> : <OldTaskList />;
}
```

---

## Enabling Flags (Admin Only)

### Enable for Internal Testing (Specific Users)
```bash
# Via API
curl -X POST http://localhost:5000/api/feature-flags/unified-activities-ui/enable-users \
  -H "Content-Type: application/json" \
  -H "Cookie: tsp.session=YOUR_SESSION_COOKIE" \
  -d '{"userIds": ["katie-user-id", "lisa-user-id"]}'
```

Or via SQL:
```sql
UPDATE feature_flags
SET enabled_for_users = '["katie-user-id", "lisa-user-id"]'::jsonb
WHERE flag_name = 'unified-activities-ui';
```

### Enable for Beta Testing (Percentage Rollout)
```sql
-- Enable for 10% of users
UPDATE feature_flags
SET enabled_percentage = 10
WHERE flag_name = 'unified-activities-ui';
```

### Enable Globally
```sql
UPDATE feature_flags
SET enabled = true
WHERE flag_name = 'unified-activities';
```

---

## Default Flags Created

| Flag Name | Purpose | Default State |
|-----------|---------|---------------|
| `unified-activities-schema` | Phase 1: Activities table exists | Disabled |
| `unified-activities-read` | Phase 2: Read from activities table | Disabled |
| `unified-activities-write` | Phase 3: Write to activities table | Disabled |
| `unified-activities-migration` | Phase 4: Historical data migration | Disabled |
| `unified-activities-ui` | Phase 5-6: Frontend thread UI | Disabled |
| `unified-activities` | Phase 7: Master toggle (full system) | Disabled |

---

## Next Steps

Once this migration is applied:

1. ✅ **Phase 0 Complete** - Feature flag infrastructure ready
2. ⏳ **Phase 1 Next** - Create activities table schema (see UNIFIED_TASK_COMMUNICATION_MIGRATION_PLAN.md)

To proceed to Phase 1:
- Add activities, activity_participants, activity_reactions, activity_attachments tables to `shared/schema.ts`
- Generate migration
- Test on staging
- Apply to production

---

## Rollback Procedure

If you need to remove the feature flags table:

```sql
DROP TABLE IF EXISTS feature_flags CASCADE;
```

**Note:** This will delete all feature flag configuration. Only do this if you haven't started using the flags in production code.

---

## Files Created/Modified

### Created:
- `/server/services/feature-flags.ts` - Feature flag service
- `/server/routes/feature-flags.ts` - API routes
- `/client/src/hooks/useFeatureFlag.ts` - React hooks
- `/migrations/0001_add_feature_flags.sql` - SQL migration
- `/PHASE_0_FEATURE_FLAGS_README.md` - This file

### Modified:
- `/shared/schema.ts` - Added featureFlags table (lines 2832-2857)
- `/server/routes/index.ts` - Registered feature flags routes (lines 57, 324-331)

---

## Questions or Issues?

- **Can't connect to database?** Check your `DATABASE_URL` environment variable
- **Migration fails?** Make sure table doesn't already exist: `DROP TABLE feature_flags;`
- **API returns 403?** Make sure you're logged in as admin (ADMIN_ACCESS permission required)
- **React hook not working?** Check browser console for errors, ensure you're authenticated

For more details, see:
- **Main Migration Plan:** `UNIFIED_TASK_COMMUNICATION_MIGRATION_PLAN.md`
- **Quick Reference:** `MIGRATION_QUICK_REFERENCE.md`
