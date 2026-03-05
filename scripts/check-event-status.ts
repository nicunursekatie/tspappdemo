#!/usr/bin/env ts-node

/**
 * Script to check the status of a specific event request
 * Usage: ts-node scripts/check-event-status.ts <eventId>
 */

import { db } from '../server/db';
import { eventRequests } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function checkEventStatus(eventId: number) {
  try {
    const [event] = await db
      .select({
        id: eventRequests.id,
        organizationName: eventRequests.organizationName,
        status: eventRequests.status,
        scheduledEventDate: eventRequests.scheduledEventDate,
        desiredEventDate: eventRequests.desiredEventDate,
        deletedAt: eventRequests.deletedAt,
        createdAt: eventRequests.createdAt,
      })
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId));

    if (!event) {
      console.log(`❌ Event ${eventId} not found in database`);
      return;
    }

    console.log(`\n📋 Event ${eventId} Details:`);
    console.log(`   Organization: ${event.organizationName}`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Scheduled Date: ${event.scheduledEventDate}`);
    console.log(`   Desired Date: ${event.desiredEventDate}`);
    console.log(`   Deleted At: ${event.deletedAt || 'NOT DELETED'}`);
    console.log(`   Created At: ${event.createdAt}`);

    // Check if it would be excluded by our duplicate check
    const isDeleted = !!event.deletedAt;
    const isInactiveStatus = ['cancelled', 'declined', 'postponed'].includes(event.status);
    const wouldBeExcluded = isDeleted || isInactiveStatus;

    console.log(`\n🔍 Duplicate Check Analysis:`);
    console.log(`   Is Deleted: ${isDeleted ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   Is Inactive Status: ${isInactiveStatus ? 'YES ❌' : 'NO ✅'}`);
    console.log(`   Would Be Excluded: ${wouldBeExcluded ? 'YES ✅' : 'NO ❌'}`);

    if (!wouldBeExcluded) {
      console.log(`\n⚠️  This event WOULD block duplicate creation!`);
    } else {
      console.log(`\n✅ This event would NOT block duplicate creation (excluded by filters)`);
    }
  } catch (error) {
    console.error('Error checking event status:', error);
    process.exit(1);
  }
}

const eventId = parseInt(process.argv[2]);
if (isNaN(eventId)) {
  console.error('Usage: ts-node scripts/check-event-status.ts <eventId>');
  process.exit(1);
}

checkEventStatus(eventId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
