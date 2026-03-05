# IMPORTANT: Use FIXED Migration Files

## Issue Found

The original migrations (0032, 0034, 0035) were written assuming `users.id` is INTEGER, but in your schema it's actually VARCHAR/TEXT.

This caused errors like:
```
ERROR: operator does not exist: character varying = integer
```

## Use These Files Instead

**DO NOT USE:**
- ~~0032_add_assignment_junction_tables.sql~~ ❌
- ~~0034_add_tracking_columns.sql~~ ❌
- ~~0035_migrate_existing_assignments.sql~~ ❌

**USE THESE INSTEAD:**
- ✅ `0032_add_assignment_junction_tables_FIXED.sql`
- ✅ `0033_add_meeting_projects_junction.sql` (unchanged, still good)
- ✅ `0034_add_tracking_columns_FIXED.sql`
- ✅ `0035_migrate_existing_assignments_FIXED.sql`

## What Changed

### Changed `user_id` type from INTEGER to TEXT:
- `project_assignments.user_id`: INTEGER → TEXT
- `task_assignments.user_id`: INTEGER → TEXT
- `team_board_assignments.user_id`: INTEGER → TEXT
- `projects.owner_id`: INTEGER → TEXT

### Removed INTEGER casts in data migration:
- Changed `jsonb_array_elements_text(...)::INTEGER` → just `jsonb_array_elements_text(...)`
- Changed `unnest(...)::INTEGER` → just `unnest(...)`
- Removed type casts in JOINs since both sides are now TEXT

## Run These Commands

```bash
# Run migrations in order with FIXED versions
psql -h your-host -U your-user -d your-database -f db/migrations/0032_add_assignment_junction_tables_FIXED.sql
psql -h your-host -U your-user -d your-database -f db/migrations/0033_add_meeting_projects_junction.sql
psql -h your-host -U your-user -d your-database -f db/migrations/0034_add_tracking_columns_FIXED.sql
psql -h your-host -U your-user -d your-database -f db/migrations/0035_migrate_existing_assignments_FIXED.sql
```

## If You Already Ran the Old Ones

If you already ran the broken migrations and got errors:

1. Check if any tables were created:
   ```sql
   SELECT tablename FROM pg_tables WHERE tablename IN
   ('project_assignments', 'task_assignments', 'team_board_assignments', 'meeting_projects');
   ```

2. If they exist with wrong schema, drop and recreate:
   ```sql
   DROP TABLE IF EXISTS project_assignments CASCADE;
   DROP TABLE IF EXISTS task_assignments CASCADE;
   DROP TABLE IF EXISTS team_board_assignments CASCADE;
   -- meeting_projects is fine, don't drop it
   ```

3. Then run the FIXED migrations

## Validation

After running the FIXED migrations, verify:

```sql
-- Check column types are TEXT
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_assignments' AND column_name = 'user_id';
-- Should show: data_type = 'text'

-- Check data was migrated
SELECT COUNT(*) FROM project_assignments;
SELECT COUNT(*) FROM task_assignments;
SELECT COUNT(*) FROM team_board_assignments;
SELECT COUNT(*) FROM meeting_projects;
```

All counts should be > 0 if you have existing data.
