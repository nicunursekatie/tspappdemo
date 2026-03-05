# Backend Refactor Database Migrations

**Related Document**: `/BACKEND_REFACTOR_RECOMMENDATIONS.md`
**Migration Range**: 0032-0036
**Status**: Ready to run
**Breaking Changes**: No (additive only, dual-write period)

---

## Overview

These migrations implement Phase 1 and 2 of the backend refactor:
- **Phase 1**: Add new junction tables for assignments and meeting-project relationships
- **Phase 2**: Add tracking columns to existing tables for lifecycle management

**Important**: These migrations are NON-BREAKING. Old columns are kept intact to support dual-write period and safe rollback.

---

## Migration Files

### 0032_add_assignment_junction_tables.sql
**Purpose**: Create junction tables for normalized assignment tracking
**Tables Created**:
- `project_assignments` - Tracks owners and support people for projects
- `task_assignments` - Tracks assignees for project tasks
- `team_board_assignments` - Tracks assignees for team board items

**Benefits**:
- Replaces 6 redundant assignment fields with clean normalized structure
- Supports role-based assignments (owner vs support)
- Consistent pattern across all features
- Audit trail of who was assigned when

---

### 0033_add_meeting_projects_junction.sql
**Purpose**: Create many-to-many relationship between meetings and projects
**Tables Created**:
- `meeting_projects` - Junction table with rich metadata

**Columns**:
- Pre-meeting: `discussion_points`, `questions_to_address`
- Post-meeting: `discussion_summary`, `decisions_reached`
- Status: `status`, `include_in_agenda`
- Ordering: `agenda_order`, `section`

**Benefits**:
- Can query "which projects in Meeting #5"
- Can query "which meetings discussed Project #12"
- Foundation for automated meeting minutes
- Supports "tabled for this meeting" vs permanent status

---

### 0034_add_tracking_columns.sql
**Purpose**: Add lifecycle tracking to existing tables
**Tables Modified**:
- `meeting_notes` - Add conversion tracking and agenda selection
- `project_tasks` - Add origin tracking and agenda selection
- `team_board_items` - Add project linking and promotion tracking
- `projects` - Add single owner field

**Key Changes**:
- `meeting_notes.converted_to_task_id` - Links to created task
- `project_tasks.origin_type` - Tracks how task was created
- `team_board_items.promoted_to_task_id` - Links to promoted task
- `projects.owner_id` - Single primary owner

**Benefits**:
- Full audit trail for task origins
- Prevents duplicate conversions
- Enables "show tasks created in Meeting #5"
- Clear ownership model

---

### 0035_migrate_existing_assignments.sql
**Purpose**: Populate new tables with existing data
**Operations**:
1. Migrate project owners from `assigneeId` → `owner_id` and `project_assignments`
2. Migrate multi-assignees from `assigneeIds` → `project_assignments`
3. Migrate support people from `supportPeopleIds` → `project_assignments` (role='support')
4. Migrate task assignees → `task_assignments`
5. Migrate team board assignees → `team_board_assignments`
6. Migrate projects with `reviewInNextMeeting=true` → `meeting_projects`

**Important**:
- Uses `ON CONFLICT DO NOTHING` to handle duplicates safely
- Looks up user names from `users` table where possible
- Falls back to 'Unknown User' if user not found
- Does NOT delete old columns (dual-write period)

---

### 0036_rollback_instructions.sql
**Purpose**: Emergency rollback if needed
**DO NOT RUN** unless you need to undo the migrations!

Contains SQL to:
- Drop new tables
- Drop new columns
- Revert constraints

Only use if migrations cause critical issues and you need to rollback.

---

## How to Run

### Prerequisites

1. **Backup your database first!**
   ```bash
   # For PostgreSQL
   pg_dump -h your-host -U your-user -d your-db > backup_before_refactor.sql
   ```

2. **Stop your application server** (optional but recommended for production)

3. **Have database credentials ready**

---

### Option 1: Run All Migrations at Once (Recommended)

```bash
# Connect to your database
psql -h your-host -U your-user -d your-database

# Run migrations in order
\i db/migrations/0032_add_assignment_junction_tables.sql
\i db/migrations/0033_add_meeting_projects_junction.sql
\i db/migrations/0034_add_tracking_columns.sql
\i db/migrations/0035_migrate_existing_assignments.sql

# Verify success (see validation section below)
```

---

### Option 2: Run One at a Time (Safer for Production)

Run each migration separately and verify before proceeding:

```bash
# Migration 1: Assignment tables
psql -h your-host -U your-user -d your-database -f db/migrations/0032_add_assignment_junction_tables.sql

# Verify: Check tables were created
# SELECT COUNT(*) FROM project_assignments;
# SELECT COUNT(*) FROM task_assignments;
# SELECT COUNT(*) FROM team_board_assignments;

# Migration 2: Meeting-project junction
psql -h your-host -U your-user -d your-database -f db/migrations/0033_add_meeting_projects_junction.sql

# Verify: Check table was created
# SELECT COUNT(*) FROM meeting_projects;

# Migration 3: Tracking columns
psql -h your-host -U your-user -d your-database -f db/migrations/0034_add_tracking_columns.sql

# Verify: Check columns were added
# \d meeting_notes
# \d project_tasks
# \d team_board_items
# \d projects

# Migration 4: Data migration
psql -h your-host -U your-user -d your-database -f db/migrations/0035_migrate_existing_assignments.sql

# Verify: Check data was migrated (see validation section)
```

---

## Validation Queries

After running migrations, verify data was migrated correctly:

### Check Assignment Tables Were Populated

```sql
-- How many project assignments?
SELECT COUNT(*) as project_assignments_count FROM project_assignments;

-- Breakdown by role
SELECT role, COUNT(*) FROM project_assignments GROUP BY role;

-- How many task assignments?
SELECT COUNT(*) as task_assignments_count FROM task_assignments;

-- How many team board assignments?
SELECT COUNT(*) as team_board_assignments_count FROM team_board_assignments;
```

### Check Meeting-Project Junction

```sql
-- How many meeting-project relationships?
SELECT COUNT(*) as meeting_projects_count FROM meeting_projects;

-- Projects flagged for review
SELECT
  m.title as meeting,
  p.title as project,
  mp.include_in_agenda
FROM meeting_projects mp
JOIN meetings m ON m.id = mp.meeting_id
JOIN projects p ON p.id = mp.project_id
ORDER BY m.date DESC, mp.agenda_order;
```

### Verify Data Integrity

```sql
-- Find projects with old assignment data but no new assignments
-- (Should be empty - if not, data migration may have failed)
SELECT
  p.id,
  p.title,
  p.assignee_id,
  p.assignee_ids,
  (SELECT COUNT(*) FROM project_assignments pa WHERE pa.project_id = p.id) as new_assignments
FROM projects p
WHERE (p.assignee_id IS NOT NULL OR p.assignee_ids IS NOT NULL OR p.support_people_ids IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM project_assignments WHERE project_id = p.id);

-- Find tasks with old assignment data but no new assignments
SELECT
  pt.id,
  pt.title,
  pt.assignee_id,
  pt.assignee_ids,
  (SELECT COUNT(*) FROM task_assignments ta WHERE ta.task_id = pt.id) as new_assignments
FROM project_tasks pt
WHERE (pt.assignee_id IS NOT NULL OR pt.assignee_ids IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = pt.id);
```

### Check New Columns

```sql
-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'meeting_notes'
  AND column_name IN ('converted_to_task_id', 'converted_at', 'selected_for_agenda');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'project_tasks'
  AND column_name IN ('origin_type', 'source_note_id', 'source_meeting_id', 'selected_for_agenda');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'team_board_items'
  AND column_name IN ('project_id', 'promoted_to_task_id', 'promoted_at');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('owner_id', 'owner_name');
```

---

## Expected Results

After successful migration:

### Tables Created: 4
- `project_assignments`
- `task_assignments`
- `team_board_assignments`
- `meeting_projects`

### Columns Added: ~13
- `meeting_notes`: +3 columns
- `project_tasks`: +5 columns
- `team_board_items`: +3 columns
- `projects`: +2 columns

### Data Migrated
- All existing project assignments → `project_assignments`
- All existing task assignments → `task_assignments`
- All existing team board assignments → `team_board_assignments`
- Projects with `reviewInNextMeeting=true` → `meeting_projects`

### Old Data Preserved
- ✅ Old assignment columns still intact (dual-write safety)
- ✅ Can rollback if needed
- ✅ Application can still read old columns during transition

---

## What Happens Next

After running these migrations:

1. **Update schema.ts** to include new tables
2. **Update backend services** to read/write new tables
3. **Update frontend components** to use new assignment model
4. **Dual-write period**: Application writes to both old and new fields
5. **Monitoring**: Watch for any issues, can rollback if needed
6. **Phase 4 (future)**: Remove old columns after confidence period

---

## Troubleshooting

### Migration fails with "relation already exists"
**Cause**: Migration was partially run before
**Solution**: Check which tables exist, comment out CREATE TABLE for existing ones

### Migration fails with "foreign key violation"
**Cause**: Referenced table doesn't exist
**Solution**: Ensure migrations run in order (0032 → 0033 → 0034 → 0035)

### Data migration inserts 0 rows
**Cause**: No existing data to migrate, or format unexpected
**Solution**: Check if projects actually have assignee data:
```sql
SELECT COUNT(*) FROM projects WHERE assignee_id IS NOT NULL;
SELECT COUNT(*) FROM projects WHERE assignee_ids IS NOT NULL;
```

### "Unknown User" appears in assignments
**Cause**: User IDs in old data don't match `users` table
**Solution**: This is expected for invalid/deleted users. Can manually update:
```sql
UPDATE project_assignments SET user_name = 'Actual Name' WHERE user_name = 'Unknown User';
```

### Need to rollback
**Solution**: Run `0036_rollback_instructions.sql` (but only as last resort!)

---

## Contact

Questions or issues? Check `/BACKEND_REFACTOR_RECOMMENDATIONS.md` for full context.

**Important**: Do NOT delete old assignment columns yet! Phase 4 (cleanup) comes after dual-write period and full testing.
