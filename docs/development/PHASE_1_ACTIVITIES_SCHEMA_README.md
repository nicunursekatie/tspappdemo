# Phase 1: Unified Activities Schema ✅

**Status:** Complete
**Date:** 2025-10-26
**Risk Level:** Zero (additive only, tables exist but unused)
**Depends On:** Phase 0 (Feature Flags)

---

## What Was Built

### 1. Activities Table
**File:** `/shared/schema.ts` (lines 2867-2896)

The core unified table that stores **everything**:
- Tasks
- Events
- Projects
- Messages
- Kudos
- System logs

**Key Features:**
- ✅ **Threading support** via `parent_id` and `root_id`
- ✅ **Soft deletes** with `is_deleted` flag
- ✅ **Flexible metadata** via JSONB field
- ✅ **Performance optimized** with 9 indexes
- ✅ **Context linking** to existing tables (events, projects, etc.)

**Schema:**
```typescript
{
  id: string (UUID primary key)
  type: 'task' | 'event' | 'project' | 'message' | ...
  title: string (main description)
  content: text (detailed body)
  createdBy: string (user ID)
  assignedTo: string[] (array of user IDs)
  status: 'open' | 'in_progress' | 'done' | ...
  priority: 'low' | 'medium' | 'high' | 'urgent'
  parentId: string (for threading - replies point to parent)
  rootId: string (denormalized root of thread)
  contextType: 'event_request' | 'project' | ...
  contextId: string (links to existing records)
  metadata: object (flexible type-specific data)
  isDeleted: boolean (soft delete)
  threadCount: number (cached reply count)
  lastActivityAt: timestamp (for sorting by recent)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 2. Activity Participants Table
**File:** `/shared/schema.ts` (lines 2911-2924)

Tracks **who's involved** in each activity:
- Assignees (people doing the work)
- Followers (people watching)
- Mentioned users (@mentions)
- Creators (original author)

**Key Features:**
- ✅ **Unread tracking** via `lastReadAt`
- ✅ **Per-thread notifications** with `notificationsEnabled`
- ✅ **Prevents duplicates** with unique constraint
- ✅ **Optimized queries** with composite indexes

**Schema:**
```typescript
{
  id: number (auto-increment)
  activityId: string (FK to activities)
  userId: string (FK to users)
  role: 'assignee' | 'follower' | 'mentioned' | 'creator'
  lastReadAt: timestamp (for unread badges)
  notificationsEnabled: boolean (mute threads)
  createdAt: timestamp
}
```

### 3. Activity Reactions Table
**File:** `/shared/schema.ts` (lines 2938-2948)

Lightweight **reactions** on activities:
- 👍 Like
- 🎉 Celebrate
- ✅ Helpful
- ✓ Complete
- ❓ Question

**Key Features:**
- ✅ **One reaction type per user** (unique constraint)
- ✅ **Fast queries** with indexed lookups
- ✅ **Low overhead** (just user + type + timestamp)

**Schema:**
```typescript
{
  id: number (auto-increment)
  activityId: string (FK to activities)
  userId: string (FK to users)
  reactionType: 'like' | 'celebrate' | 'helpful' | 'complete' | 'question'
  createdAt: timestamp
}
```

### 4. Activity Attachments Table
**File:** `/shared/schema.ts` (lines 2962-2974)

**File uploads** on activity threads:
- Images
- PDFs
- Documents
- Any file type

**Key Features:**
- ✅ **Links to Google Cloud Storage**
- ✅ **Stores metadata** (file type, size, name)
- ✅ **Tracks uploader** for permissions
- ✅ **Indexed for performance**

**Schema:**
```typescript
{
  id: number (auto-increment)
  activityId: string (FK to activities)
  fileUrl: string (full URL to storage)
  fileType: string (MIME type)
  fileName: string (original filename)
  fileSize: number (bytes)
  uploadedBy: string (FK to users)
  uploadedAt: timestamp
}
```

---

## How to Apply Migration

### Option A: Using Drizzle Kit Push (Recommended for Dev)
```bash
npm run db:push
```
This will automatically detect the new schema and create the tables.

### Option B: Manual SQL Execution (Safer for Production)
1. Review the migration file:
   ```bash
   cat migrations/0002_add_unified_activities_schema.sql
   ```

2. Connect to your database and run it:
   ```bash
   psql $DATABASE_URL -f migrations/0002_add_unified_activities_schema.sql
   ```

### Option C: Through Database Client
Copy the contents of `migrations/0002_add_unified_activities_schema.sql` and paste into your database client (pgAdmin, DBeaver, etc.)

---

## Verification Steps

After applying the migration:

### 1. Check All Tables Exist
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_name IN ('activities', 'activity_participants', 'activity_reactions', 'activity_attachments')
ORDER BY table_name;
```
Should return 4 rows.

### 2. Check Indexes Created
```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE tablename LIKE 'activit%'
ORDER BY tablename, indexname;
```
Should return 19 indexes total:
- 9 indexes on `activities`
- 3 indexes on `activity_participants`
- 2 indexes on `activity_reactions`
- 2 indexes on `activity_attachments`
- 3 unique constraints

### 3. Verify Activities Table Structure
```sql
\d activities
```
Should show all columns with correct types.

### 4. Check Feature Flag Updated
```sql
SELECT flag_name, enabled, metadata->'schema_created_at'
FROM feature_flags
WHERE flag_name = 'unified-activities-schema';
```
Should show `schema_created_at` timestamp in metadata.

---

## Table Relationships

```
activities (root)
├── activities (self-referential for threading via parent_id)
├── activity_participants (who's involved)
├── activity_reactions (likes, celebrates, etc.)
└── activity_attachments (file uploads)

Links to existing tables:
├── users (created_by, assigned_to)
├── eventRequests (via context_type='event_request', context_id)
├── projects (via context_type='project', context_id)
└── sandwichCollections (via context_type='collection', context_id)
```

---

## Example Data Flow

### Creating a Task with Thread
```sql
-- 1. Create root activity (task)
INSERT INTO activities (id, type, title, created_by, assigned_to, status, priority)
VALUES ('uuid-1', 'task', 'Update driver database', 'katie-id', '["katie-id"]', 'open', 'high');

-- 2. Add participants
INSERT INTO activity_participants (activity_id, user_id, role)
VALUES
  ('uuid-1', 'katie-id', 'creator'),
  ('uuid-1', 'katie-id', 'assignee');

-- 3. Someone replies to the task
INSERT INTO activities (id, type, title, content, created_by, parent_id, root_id)
VALUES ('uuid-2', 'message', 'Question about task', 'Should I include retired drivers?', 'lisa-id', 'uuid-1', 'uuid-1');

-- 4. Update thread count and last activity on root
UPDATE activities
SET thread_count = thread_count + 1,
    last_activity_at = NOW()
WHERE id = 'uuid-1';

-- 5. Add Lisa as participant (she's now mentioned)
INSERT INTO activity_participants (activity_id, user_id, role)
VALUES ('uuid-1', 'lisa-id', 'mentioned');

-- 6. Someone reacts to the reply
INSERT INTO activity_reactions (activity_id, user_id, reaction_type)
VALUES ('uuid-2', 'katie-id', 'helpful');
```

---

## Performance Considerations

### Indexes Explained

**activities table (9 indexes):**
- `type` - Filter by task/event/message
- `created_by` - Find all activities by user
- `parent_id` - Get all replies to an activity
- `root_id` - Get full thread in one query
- `(context_type, context_id)` - Composite index for linking to other tables
- `last_activity_at` - Sort by recent activity
- `is_deleted` - Filter out soft-deleted items
- `status` - Filter by open/done/etc
- `created_at` - Sort by creation date

**activity_participants (3 indexes):**
- `activity_id` - Get all participants for an activity
- `user_id` - Get all activities a user is involved in
- `(activity_id, user_id)` - Composite for fast permission checks

**activity_reactions (2 indexes):**
- `activity_id` - Get all reactions for an activity
- `user_id` - Get all reactions by a user

**activity_attachments (2 indexes):**
- `activity_id` - Get all attachments for an activity
- `uploaded_by` - Get all uploads by a user

### Query Performance Estimates

| Query | Rows | Est. Time | Index Used |
|-------|------|-----------|------------|
| Get all tasks | 1,000 | <10ms | `idx_activities_type` |
| Get activity thread | 50 | <5ms | `idx_activities_root_id` |
| Get user's activities | 100 | <10ms | `idx_activities_created_by` |
| Check unread | 20 | <5ms | `idx_activity_participants_user` |
| Get reactions | 10 | <2ms | `idx_activity_reactions_activity` |

With **10,000+ activities**, queries should still be <50ms due to proper indexing.

---

## Foreign Key Constraints (Optional)

The migration file includes **commented-out foreign key constraints**. These are optional for Phase 1.

### Why They're Commented Out:
1. **Easier testing** - Can insert test data without strict FK checks
2. **Migration flexibility** - Easier to roll back during development
3. **Performance** - FK checks add overhead on writes

### When to Enable Them:
- After testing the schema works
- Before Phase 7 (production rollout)
- When data integrity is critical

### How to Enable:
Uncomment the FK constraint section in the migration file and run:
```sql
-- Run the commented ALTER TABLE statements
-- (Lines 122-137 in migration file)
```

---

## Data Size Estimates

Based on your current data volume:

| Table | Est. Rows (Year 1) | Storage | Notes |
|-------|-------------------|---------|-------|
| `activities` | ~10,000 | ~5 MB | Tasks, events, messages |
| `activity_participants` | ~30,000 | ~2 MB | 3 participants avg per activity |
| `activity_reactions` | ~5,000 | ~500 KB | ~50% of activities get reactions |
| `activity_attachments` | ~2,000 | ~200 KB | Metadata only, files in GCS |
| **Total** | **~47,000** | **~8 MB** | Very lightweight |

**Indexes:** Add ~2-3 MB for all indexes combined.

**Total storage (Phase 1):** ~10-12 MB

---

## What's NOT Included in Phase 1

Phase 1 is **schema only**. The following are NOT yet built:

❌ **No backend services** - No ActivityService yet
❌ **No API routes** - No endpoints to create/read activities
❌ **No frontend components** - No UI to display threads
❌ **No data migration** - Old tables (tasks, events) not migrated yet
❌ **No notification triggers** - No emails sent on activity updates
❌ **No real-time updates** - No Socket.IO integration yet

**These tables are completely inactive** until Phase 2.

---

## Rollback Procedure

If you need to remove these tables:

```sql
-- Drop in reverse order (children first)
DROP TABLE IF EXISTS activity_attachments CASCADE;
DROP TABLE IF EXISTS activity_reactions CASCADE;
DROP TABLE IF EXISTS activity_participants CASCADE;
DROP TABLE IF EXISTS activities CASCADE;

-- Reset feature flag
UPDATE feature_flags
SET enabled = false,
    metadata = metadata - 'schema_created_at'
WHERE flag_name = 'unified-activities-schema';
```

**Note:** This will delete all data in these tables. Only do this if you haven't started using them.

---

## Files Created/Modified

### Created:
- `/migrations/0002_add_unified_activities_schema.sql` - SQL migration
- `/PHASE_1_ACTIVITIES_SCHEMA_README.md` - This file

### Modified:
- `/shared/schema.ts` - Added 4 tables + types (lines 2859-2982)

---

## Next Steps

Once this migration is applied:

1. ✅ **Phase 1 Complete** - Schema exists but inactive
2. ⏳ **Phase 2 Next** - Build backend services (ActivityService)

### Phase 2 Preview:
- Create `ActivityService` class with CRUD operations
- Add API routes: `GET/POST /api/activities`
- Add thread operations: create reply, get thread, update thread
- Add participant management
- Add reaction endpoints
- Wire up Socket.IO for real-time updates
- Still feature-flagged (not visible to users yet)

**Estimated time for Phase 2:** 3-4 hours

---

## Testing Queries (Safe to Run)

These queries won't modify data, just verify the schema:

### Check table sizes
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'activit%'
ORDER BY tablename;
```

### Check all indexes
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS size
FROM pg_indexes
WHERE tablename LIKE 'activit%'
ORDER BY tablename, indexname;
```

### Verify unique constraints
```sql
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid::regclass::text LIKE 'activit%'
  AND contype = 'u';  -- 'u' = unique constraint
```

---

## Questions or Issues?

- **Migration fails?** Check if tables already exist: `\dt activit*`
- **Missing indexes?** Re-run the CREATE INDEX statements
- **Foreign key errors?** They're commented out by default, uncomment if needed
- **Performance concerns?** All indexes are in place, should be fast

For more details, see:
- **Main Migration Plan:** `UNIFIED_TASK_COMMUNICATION_MIGRATION_PLAN.md`
- **Quick Reference:** `MIGRATION_QUICK_REFERENCE.md`
- **Phase 0 README:** `PHASE_0_FEATURE_FLAGS_README.md`

---

## Summary

**Phase 1 adds 4 new tables that will power the unified Task + Communication system:**

1. **`activities`** - Everything in one place (tasks, events, messages, etc.)
2. **`activity_participants`** - Who's involved and unread tracking
3. **`activity_reactions`** - Lightweight engagement (likes, celebrates)
4. **`activity_attachments`** - File uploads on threads

**Status:** Schema ready, tables inactive until Phase 2.

**Next:** Build the backend services to actually use these tables!
