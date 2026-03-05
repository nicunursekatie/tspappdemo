import { db } from './server/db';
import { eventRequests } from './shared/schema';
import { sql } from 'drizzle-orm';

async function checkBadImports() {
  // Check for events with NULL dates
  const nullDates = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM event_requests
    WHERE external_id LIKE 'historical-%' AND desired_event_date IS NULL
  `);
  
  console.log('Events with NULL dates:', nullDates.rows[0].count);
  
  // Check for events with missing organization names
  const sample = await db.execute(sql`
    SELECT id, organization_name, first_name, last_name, email, desired_event_date, external_id
    FROM event_requests
    WHERE external_id LIKE 'historical-%'
    LIMIT 10
  `);
  
  console.log('\nSample of imported events:');
  console.table(sample.rows);
  
  process.exit(0);
}

checkBadImports();
