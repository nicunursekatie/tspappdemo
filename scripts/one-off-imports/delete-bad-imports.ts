import { db } from './server/db';
import { eventRequests } from './shared/schema';
import { sql } from 'drizzle-orm';

async function deleteBadImports() {
  console.log('🗑️ Deleting all historical imports...');
  
  const result = await db.execute(sql`
    DELETE FROM event_requests
    WHERE external_id LIKE 'historical-%'
  `);
  
  console.log('✅ Deleted all historical imports');
  console.log('Rows affected:', result.rowCount);
  
  process.exit(0);
}

deleteBadImports();
