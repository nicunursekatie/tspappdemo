import { db } from '../db';
import { resources } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function removeDuplicates() {
  console.log('🔍 Checking for duplicate resources...\n');
  
  // Find duplicates
  const duplicates = await db.execute(sql`
    SELECT title, COUNT(*) as count 
    FROM resources 
    WHERE is_active = true
    GROUP BY title 
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  
  console.log(`Found ${duplicates.rows.length} duplicate titles:\n`);
  duplicates.rows.forEach((row: any) => {
    console.log(`  - ${row.title}: ${row.count} copies`);
  });
  
  // Keep only the oldest (lowest ID) of each duplicate and delete the rest
  console.log('\n🗑️  Removing duplicates (keeping oldest entry)...\n');
  
  const result = await db.execute(sql`
    DELETE FROM resources 
    WHERE id IN (
      SELECT id 
      FROM (
        SELECT id, 
               title,
               ROW_NUMBER() OVER (PARTITION BY title ORDER BY id ASC) as rn
        FROM resources
        WHERE is_active = true
      ) t
      WHERE rn > 1
    )
  `);
  
  console.log(`✅ Deleted ${result.rowCount || 0} duplicate resources!\n`);
  
  // Show final count
  const final = await db.execute(sql`
    SELECT COUNT(DISTINCT title) as unique_count,
           COUNT(*) as total_count
    FROM resources 
    WHERE is_active = true
  `);
  
  console.log(`📊 Final stats:`);
  console.log(`  - Unique resources: ${final.rows[0].unique_count}`);
  console.log(`  - Total resources: ${final.rows[0].total_count}`);
  
  process.exit(0);
}

removeDuplicates().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
