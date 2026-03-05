import { db } from './server/db';
import { eventRequests } from './shared/schema';
import { sql } from 'drizzle-orm';

async function checkYears() {
  const years = await db.execute(sql`
    SELECT 
      EXTRACT(YEAR FROM desired_event_date) as year,
      COUNT(*) as count,
      MIN(desired_event_date) as earliest,
      MAX(desired_event_date) as latest
    FROM event_requests
    WHERE external_id LIKE 'historical-%' AND desired_event_date IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM desired_event_date)
    ORDER BY year
  `);
  
  console.log('\nHistorical events by year:');
  console.log(years.rows);
  
  process.exit(0);
}

checkYears();
