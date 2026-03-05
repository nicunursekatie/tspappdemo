import { db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * Migration script to convert focus_areas from text to jsonb array
 * This handles the case where focus_areas already exists as a text column
 */
async function migrateFocusAreas() {
  console.log('Starting focus_areas migration...');

  try {
    // Step 1: Check if old focus_areas column exists and is not jsonb
    const checkColumn = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipients'
      AND column_name IN ('focus_areas', 'focus_area')
    `);

    console.log('Current columns:', checkColumn.rows);

    // Step 2: Rename old focus_areas if it's not jsonb
    const hasFocusAreas = checkColumn.rows.some(
      (row: any) => row.column_name === 'focus_areas'
    );
    const isJsonb = checkColumn.rows.some(
      (row: any) => row.column_name === 'focus_areas' && row.data_type === 'jsonb'
    );

    if (hasFocusAreas && !isJsonb) {
      console.log('Renaming old focus_areas column to focus_areas_old...');
      await db.execute(sql`
        ALTER TABLE recipients RENAME COLUMN focus_areas TO focus_areas_old
      `);
    }

    // Step 3: Add new focus_areas as jsonb
    console.log('Adding new focus_areas column as jsonb...');
    await db.execute(sql`
      ALTER TABLE recipients
      ADD COLUMN IF NOT EXISTS focus_areas jsonb DEFAULT '[]'::jsonb
    `);

    // Step 4: Migrate data from old column if it exists
    const hasOldColumn = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'recipients'
      AND column_name = 'focus_areas_old'
    `);

    if (hasOldColumn.rows.length > 0) {
      console.log('Migrating data from focus_areas_old...');
      await db.execute(sql`
        UPDATE recipients
        SET focus_areas =
          CASE
            WHEN focus_areas_old IS NOT NULL AND focus_areas_old != ''
            THEN jsonb_build_array(focus_areas_old)
            ELSE '[]'::jsonb
          END
        WHERE focus_areas = '[]'::jsonb
      `);

      console.log('Dropping old focus_areas_old column...');
      await db.execute(sql`
        ALTER TABLE recipients DROP COLUMN focus_areas_old
      `);
    }

    // Step 5: Also migrate from focus_area (singular) if it exists
    const hasFocusArea = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'recipients'
      AND column_name = 'focus_area'
    `);

    if (hasFocusArea.rows.length > 0) {
      console.log('Migrating data from focus_area (singular)...');
      const result = await db.execute(sql`
        UPDATE recipients
        SET focus_areas = jsonb_build_array(focus_area)
        WHERE focus_area IS NOT NULL
          AND focus_area != ''
          AND (focus_areas = '[]'::jsonb OR focus_areas IS NULL)
      `);

      console.log(`Migrated ${result.rowCount || 0} records from focus_area to focus_areas`);
    } else {
      console.log('No focus_area column found, skipping migration from singular field');
    }

    // Step 6: Verify the migration
    console.log('\nVerifying migration...');
    const verification = await db.execute(sql`
      SELECT
        id,
        name,
        focus_areas as new_focus_array
      FROM recipients
      WHERE focus_areas != '[]'::jsonb
      LIMIT 10
    `);

    console.log('Sample migrated records:');
    console.table(verification.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log('You can now run: npm run db:push');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateFocusAreas()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
