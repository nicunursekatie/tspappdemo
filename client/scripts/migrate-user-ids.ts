/**
 * Migration Script: Update User IDs to Name-Based Format
 *
 * This script updates all user IDs from meaningless timestamps (like user_1756853839752)
 * to meaningful name-based IDs (like katie-long, christine-cooper).
 *
 * IMPORTANT: This will update ALL foreign key references to these user IDs
 * throughout the database.
 *
 * Usage:
 *   DRY RUN (preview changes):  npx tsx scripts/migrate-user-ids.ts
 *   EXECUTE CHANGES:            npx tsx scripts/migrate-user-ids.ts --execute
 */

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema.js';
import { eq } from 'drizzle-orm';

// Map of email -> new ID based on your actual users
const USER_ID_MAPPING: Record<string, string> = {
  // Katie's accounts
  'admin@sandwich.project': 'katie-long-admin',
  'katielong2316@gmail.com': 'katie-long',
  'kenig.ka@gmail.com': 'katie-test-account',

  // Exec Director
  'christine@thesandwichproject.org': 'christine-cooper',

  // Administrators
  'mdlouza@gmail.com': 'marcy-louza',
  'marcy@thesandwichproject.org': 'marcy-louza-backup',
  'brendabonilla55@gmail.com': 'brenda-bonilla',

  // Core Team
  'vickib@aol.com': 'vicki-tropauer',
  'ross.kimberly.a@gmail.com': 'kim-ross',
  'karenacohen@gmail.com': 'karen-cohen',
  'jordanglick@gmail.com': 'jordan-horne',
  'lisahiles@me.com': 'lisa-hiles',
  'kledfo200@comcast.net': 'kathy-ledford',
  'juliet@thesandwichproject.org': 'juliet-eden',
  'laura@thesandwichproject.org': 'laura-baldwin',

  // Board Members
  'silke.shilling@gmail.com': 'silke-shilling',
  'mfalaki@savantwealth.com': 'miriam-falaki',
  'aesmith88@hotmail.com': 'alison-smith',
  'treasurer@thesandwichproject.org': 'noel-clark',

  // Host Locations
  'jenmcohen@gmail.com': 'jen-cohen-host',
  'lzauderer@yahoo.com': 'laura-baldwin-host',
  'atlantamillers@comcast.net': 'nancy-miller',
  'carreyhugoo@gmail.com': 'carrey-hugoo',
  'vpennington924@gmail.com': 'veronica-pennington',
  'marnibekerman@gmail.com': 'marni-bekerman',
  'kristinamday@yahoo.com': 'kristina-mccarthney',
  'jen@thesandwichproject.org': 'jen-cohen',

  // UGA Chapter
  'annabaylin@gmail.com': 'anna-baylin',
  'jameshsatterfield5@gmail.com': 'james-satterfield',

  // Event Team
  'brigith@thesandwichproject.org': 'brigith-gonzalez',

  // Legacy/Retired
  'stephanie@thesandwichproject.org': 'stephanie-luis',
  'Paula.ro@att.net': 'paula-rothman',
};

interface UserRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

async function migrateUserIds(execute: boolean) {
  console.log('\n========================================');
  console.log(execute ? '🚀 EXECUTING USER ID MIGRATION' : '👀 DRY RUN - USER ID MIGRATION PREVIEW');
  console.log('========================================\n');

  try {
    // Get all users
    const users = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
    }).from(schema.users);

    console.log(`Found ${users.length} users in database\n`);

    const changes: Array<{ oldId: string; newId: string; email: string; name: string }> = [];
    const unmapped: Array<{ id: string; email: string; name: string }> = [];

    for (const user of users) {
      const email = user.email?.toLowerCase();
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();

      // Check if we have a mapping for this email
      let newId = USER_ID_MAPPING[user.email || ''];

      // Also check lowercase version
      if (!newId && email) {
        for (const [mappedEmail, mappedId] of Object.entries(USER_ID_MAPPING)) {
          if (mappedEmail.toLowerCase() === email) {
            newId = mappedId;
            break;
          }
        }
      }

      if (newId && newId !== user.id) {
        changes.push({ oldId: user.id, newId, email: user.email || 'N/A', name });
      } else if (!newId) {
        // Generate an ID from name if no mapping exists
        const generatedId = generateIdFromName(user.firstName, user.lastName, user.email);
        if (generatedId !== user.id) {
          unmapped.push({ id: user.id, email: user.email || 'N/A', name });
        }
      }
    }

    // Show planned changes
    console.log('📋 PLANNED ID CHANGES:\n');
    console.log('─'.repeat(80));

    for (const change of changes) {
      console.log(`${change.name} (${change.email})`);
      console.log(`  OLD: ${change.oldId}`);
      console.log(`  NEW: ${change.newId}`);
      console.log('');
    }

    if (unmapped.length > 0) {
      console.log('\n⚠️  USERS WITHOUT MAPPING (will not be changed):');
      console.log('─'.repeat(80));
      for (const user of unmapped) {
        console.log(`  ${user.name} (${user.email}) - ID: ${user.id}`);
      }
      console.log('\nAdd these users to USER_ID_MAPPING in the script if you want to rename them.\n');
    }

    console.log(`\nTotal changes planned: ${changes.length}`);
    console.log(`Users without mapping: ${unmapped.length}`);

    if (!execute) {
      console.log('\n⚠️  DRY RUN COMPLETE - No changes made');
      console.log('To execute changes, run: npx tsx scripts/migrate-user-ids.ts --execute\n');
      return;
    }

    // Execute the changes
    console.log('\n🔄 Executing changes...\n');

    for (const change of changes) {
      console.log(`Updating ${change.email}: ${change.oldId} → ${change.newId}`);

      try {
        // Update the user's ID
        // We need to use raw SQL because changing primary keys is tricky
        await db.execute(sql`
          UPDATE users SET id = ${change.newId} WHERE id = ${change.oldId}
        `);

        // Update all foreign key references
        // Projects
        await db.execute(sql`
          UPDATE projects SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);

        // Sandwich distributions
        await db.execute(sql`
          UPDATE sandwich_distributions SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);

        // Chat messages
        await db.execute(sql`
          UPDATE chat_messages SET user_id = ${change.newId} WHERE user_id = ${change.oldId}
        `);

        // Team board items
        await db.execute(sql`
          UPDATE team_board_items SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);

        // Holding zone categories
        await db.execute(sql`
          UPDATE holding_zone_categories SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);

        // Activity logs
        await db.execute(sql`
          UPDATE activity_logs SET user_id = ${change.newId} WHERE user_id = ${change.oldId}
        `);

        // Notifications
        await db.execute(sql`
          UPDATE notifications SET user_id = ${change.newId} WHERE user_id = ${change.oldId}
        `);

        // Event requests
        await db.execute(sql`
          UPDATE event_requests SET requested_by = ${change.newId} WHERE requested_by = ${change.oldId}
        `);

        // Meeting notes
        await db.execute(sql`
          UPDATE meeting_notes SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);

        // Tasks
        await db.execute(sql`
          UPDATE tasks SET created_by = ${change.newId} WHERE created_by = ${change.oldId}
        `);
        await db.execute(sql`
          UPDATE tasks SET assigned_to = ${change.newId} WHERE assigned_to = ${change.oldId}
        `);

        // Work logs
        await db.execute(sql`
          UPDATE work_logs SET user_id = ${change.newId} WHERE user_id = ${change.oldId}
        `);

        console.log(`  ✅ Updated successfully`);
      } catch (error) {
        console.error(`  ❌ Error updating ${change.email}:`, error);
      }
    }

    console.log('\n✨ Migration complete!\n');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

function generateIdFromName(firstName: string | null, lastName: string | null, email: string | null): string {
  if (firstName && lastName) {
    return `${firstName.toLowerCase()}-${lastName.toLowerCase()}`.replace(/[^a-z-]/g, '');
  }
  if (email) {
    const localPart = email.split('@')[0];
    return localPart.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
  return `user-${Date.now()}`;
}

// Check command line args
const execute = process.argv.includes('--execute');
migrateUserIds(execute);
