import { db } from '../db';
import { sql } from 'drizzle-orm';

async function verify() {
  const result = await db.execute(sql`
    SELECT year, COUNT(*)::int as records, SUM(sandwiches)::int as total
    FROM authoritative_weekly_collections 
    GROUP BY year 
    ORDER BY year
  `);
  
  console.log('Result type:', typeof result);
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

verify();
