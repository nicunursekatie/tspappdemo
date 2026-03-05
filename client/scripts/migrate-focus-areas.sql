-- Migration script to convert focus_areas from text to jsonb array
-- Run this in your production database before running db:push

-- Step 1: Rename the old focus_areas column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipients'
    AND column_name = 'focus_areas'
  ) THEN
    -- Check the current data type
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'recipients'
      AND column_name = 'focus_areas'
      AND data_type != 'jsonb'
    ) THEN
      -- Rename old column to preserve data
      ALTER TABLE recipients RENAME COLUMN focus_areas TO focus_areas_old;
    END IF;
  END IF;
END $$;

-- Step 2: Add new focus_areas as jsonb with default
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS focus_areas jsonb DEFAULT '[]'::jsonb;

-- Step 3: Migrate data from old column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipients'
    AND column_name = 'focus_areas_old'
  ) THEN
    -- Convert old text values to jsonb arrays
    UPDATE recipients
    SET focus_areas =
      CASE
        WHEN focus_areas_old IS NOT NULL AND focus_areas_old != ''
        THEN jsonb_build_array(focus_areas_old)
        ELSE '[]'::jsonb
      END
    WHERE focus_areas = '[]'::jsonb;

    -- Drop the old column
    ALTER TABLE recipients DROP COLUMN focus_areas_old;
  END IF;
END $$;

-- Step 4: Also migrate data from focus_area (singular) if it exists and no focus_areas data exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipients'
    AND column_name = 'focus_area'
  ) THEN
    UPDATE recipients
    SET focus_areas = jsonb_build_array(focus_area)
    WHERE focus_area IS NOT NULL
      AND focus_area != ''
      AND (focus_areas = '[]'::jsonb OR focus_areas IS NULL);

    RAISE NOTICE 'Migrated focus_area to focus_areas';
  ELSE
    RAISE NOTICE 'No focus_area column found, skipping migration from singular field';
  END IF;
END $$;

-- Verify the migration - show sample records
SELECT
  id,
  name,
  focus_areas as new_focus_array
FROM recipients
WHERE focus_areas != '[]'::jsonb
LIMIT 10;
