import { db } from '../server/db';
import { trackedCalendarItems } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface SchoolCalendarEntry {
  id: string;
  type: string;
  label: string;
  startDate: string;
  endDate: string;
  districts?: string[];
  academicYear?: string;
  notes?: string;
}

async function importSchoolCalendar() {
  const filePath = path.join(__dirname, '..', 'schoolcalendardates.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const entries: SchoolCalendarEntry[] = JSON.parse(rawData);

  console.log(`Found ${entries.length} entries to import...`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const externalId = `school_break_${entry.id}`;

      // Check if item exists
      const existing = await db
        .select()
        .from(trackedCalendarItems)
        .where(eq(trackedCalendarItems.externalId, externalId))
        .limit(1);

      const itemData = {
        externalId,
        category: entry.type === 'school_break' ? 'school_breaks' : 'school_markers',
        title: entry.label,
        startDate: entry.startDate,
        endDate: entry.endDate,
        notes: entry.notes || null,
        metadata: {
          type: entry.type,
          districts: entry.districts || [],
          academicYear: entry.academicYear || null,
          originalId: entry.id,
        },
        updatedAt: new Date(),
      };

      if (existing.length > 0) {
        await db
          .update(trackedCalendarItems)
          .set(itemData)
          .where(eq(trackedCalendarItems.externalId, externalId));
        updated++;
        console.log(`  Updated: ${entry.label} (${entry.startDate})`);
      } else {
        await db.insert(trackedCalendarItems).values({
          ...itemData,
          createdAt: new Date(),
        });
        created++;
        console.log(`  Created: ${entry.label} (${entry.startDate})`);
      }
    } catch (err) {
      errors++;
      console.error(`  Error processing ${entry.id}:`, err);
    }
  }

  console.log(`\nImport complete!`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);

  process.exit(0);
}

importSchoolCalendar().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
