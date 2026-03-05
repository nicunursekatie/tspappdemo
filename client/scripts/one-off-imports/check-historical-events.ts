import { db } from './server/db';
import { eventRequests } from './shared/schema';
import { count, sql } from 'drizzle-orm';

async function checkEvents() {
  const result = await db.select({ count: count() }).from(eventRequests).where(sql`external_id LIKE 'historical-%'`);
  console.log('Historical events in production DB:', result[0].count);
  
  const withDates = await db.select({ count: count() }).from(eventRequests).where(sql`external_id LIKE 'historical-%' AND desired_event_date IS NOT NULL`);
  console.log('Historical events WITH dates:', withDates[0].count);
  
  const withoutDates = await db.select({ count: count() }).from(eventRequests).where(sql`external_id LIKE 'historical-%' AND desired_event_date IS NULL`);
  console.log('Historical events WITHOUT dates:', withoutDates[0].count);
  
  process.exit(0);
}

checkEvents();
