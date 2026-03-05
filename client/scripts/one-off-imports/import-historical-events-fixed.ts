import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from './server/db';
import { eventRequests } from './shared/schema';

async function importHistoricalEvents() {
  console.log('🚀 Starting historical events import with proper date mapping...\n');

  // Import 2023 data
  console.log('📊 Importing 2023 events...');
  const csv2023 = fs.readFileSync('school_contacts_2023.csv', 'utf-8');
  const records2023 = parse(csv2023, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let imported2023 = 0;
  for (const record of records2023) {
    try {
      // Parse the date from the CSV
      const eventDate = record['Date'] ? new Date(record['Date']) : null;
      
      // Split contact name into first and last name
      const contactName = record['Contact Name'] || '';
      const nameParts = contactName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Generate unique external_id for historical data
      const orgName = record['Organization Name'] || 'Unknown';
      const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : 'no-date';
      const externalId = `historical-2023-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${imported2023}`;

      await db.insert(eventRequests).values({
        organizationName: orgName,
        firstName,
        lastName,
        email: record['Email'] || null,
        phone: record['Phone'] || null,
        desiredEventDate: eventDate,
        estimatedSandwichCount: record['Sandwiches'] ? parseInt(record['Sandwiches']) : null,
        status: 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2023++;
    } catch (error) {
      console.error(`Error importing 2023 record:`, record, error);
    }
  }
  console.log(`✅ Imported ${imported2023} events from 2023\n`);

  // Import 2022 data
  console.log('📊 Importing 2022 events...');
  const csv2022 = fs.readFileSync('school_contacts_past_events.csv', 'utf-8');
  const records2022 = parse(csv2022, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let imported2022 = 0;
  for (const record of records2022) {
    try {
      // Parse the date from the CSV (column name is "Event Date")
      const eventDate = record['Event Date'] ? new Date(record['Event Date']) : null;
      
      // Split contact name into first and last name
      const contactName = record['Contact Name'] || '';
      const nameParts = contactName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Generate unique external_id for historical data
      const orgName = record['Organization Name'] || 'Unknown';
      const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : 'no-date';
      const externalId = `historical-2022-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${imported2022}`;

      await db.insert(eventRequests).values({
        organizationName: orgName,
        firstName,
        lastName,
        email: record['Email'] || null,
        phone: record['Phone'] || null,
        desiredEventDate: eventDate,
        status: record['Status']?.toLowerCase() || 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2022++;
    } catch (error) {
      console.error(`Error importing 2022 record:`, record, error);
    }
  }
  console.log(`✅ Imported ${imported2022} events from 2022\n`);

  console.log(`🎉 Total imported: ${imported2022 + imported2023} events`);
  console.log('✅ Import complete!');
  
  process.exit(0);
}

importHistoricalEvents().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
