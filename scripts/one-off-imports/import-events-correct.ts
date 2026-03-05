import XLSX from 'xlsx';
import { db } from './server/db';
import { eventRequests } from './shared/schema';

// Helper to convert Excel date serial to JS Date
function excelDateToJSDate(serial: number): Date {
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;  
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
}

async function importEvents() {
  console.log('🚀 Starting proper historical events import...\n');

  // ==================== 2023 EVENTS ====================
  console.log('📊 Importing 2023 events...');
  const workbook2023 = XLSX.readFile('attached_assets/2023 Events (2)_1760559222867.xlsx');
  const sheet2023 = workbook2023.Sheets[workbook2023.SheetNames[0]];
  const data2023 = XLSX.utils.sheet_to_json(sheet2023) as any[];

  let imported2023 = 0;
  let skipped2023 = 0;

  for (const [index, record] of data2023.entries()) {
    try {
      // Parse date from Excel serial number
      let eventDate = null;
      if (record['Date'] && typeof record['Date'] === 'number') {
        eventDate = excelDateToJSDate(record['Date']);
      }

      // Get organization name from "Group Name" column
      const orgName = record['Group Name'] || 'Unknown';
      
      // Skip if no organization name
      if (!orgName || orgName.trim() === '' || orgName === 'Unknown') {
        skipped2023++;
        continue;
      }

      // Parse contact name
      let firstName = '';
      let lastName = '';
      const contactName = record['Contact Name'] || '';
      if (contactName && contactName.trim()) {
        const nameParts = contactName.trim().split(/[\s\/]+/); // Split on space or slash
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Generate unique external_id
      const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : 'no-date';
      const externalId = `historical-2023-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${index}`;

      await db.insert(eventRequests).values({
        organizationName: orgName.trim(),
        firstName: firstName || '',
        lastName: lastName || '',
        email: record['Email Address'] && record['Email Address'].trim() !== '' ? record['Email Address'].trim() : null,
        phone: record['Contact Cell Number'] || null,
        desiredEventDate: eventDate,
        estimatedSandwichCount: record['Estimate/Final # sandwiches made'] ? 
          parseInt(String(record['Estimate/Final # sandwiches made'])) : null,
        status: 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2023++;
    } catch (error) {
      console.error(`Error importing 2023 row ${index}:`, error);
      skipped2023++;
    }
  }
  console.log(`✅ 2023: Imported ${imported2023}, Skipped ${skipped2023}\n`);

  // ==================== 2022 EVENTS ====================
  console.log('📊 Importing 2022 events...');
  const workbook2022 = XLSX.readFile('attached_assets/2022 Group Events (1)_1760559778419.xlsx');
  const sheet2022 = workbook2022.Sheets[workbook2022.SheetNames[0]];
  const data2022 = XLSX.utils.sheet_to_json(sheet2022) as any[];

  let imported2022 = 0;
  let skipped2022 = 0;

  for (const [index, record] of data2022.entries()) {
    try {
      // Parse date from DATE column (Excel serial)
      let eventDate = null;
      if (record['DATE'] && typeof record['DATE'] === 'number') {
        eventDate = excelDateToJSDate(record['DATE']);
      }

      // Skip if no date (2022 events without dates are not useful)
      if (!eventDate) {
        skipped2022++;
        continue;
      }

      // Get organization name from "Group Name" column
      const orgName = record['Group Name'] || 'Unknown';
      
      // Skip if no organization name
      if (!orgName || orgName.trim() === '' || orgName === 'Unknown') {
        skipped2022++;
        continue;
      }

      // Parse contact name
      let firstName = '';
      let lastName = '';
      const contactName = record['Contact Name'] || '';
      if (contactName && contactName.trim()) {
        const nameParts = contactName.trim().split(/[\s\/]+/);
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Generate unique external_id
      const dateStr = eventDate.toISOString().split('T')[0];
      const externalId = `historical-2022-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${index}`;

      await db.insert(eventRequests).values({
        organizationName: orgName.trim(),
        firstName: firstName || '',
        lastName: lastName || '',
        email: record['Email Address'] && record['Email Address'].trim() !== '' ? record['Email Address'].trim() : null,
        phone: record['Contact Cell Number'] ? String(record['Contact Cell Number']) : null,
        desiredEventDate: eventDate,
        estimatedSandwichCount: record['Approx Sandwiches'] ? 
          parseInt(String(record['Approx Sandwiches']).replace(/[^0-9]/g, '')) : null,
        status: 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2022++;
    } catch (error) {
      console.error(`Error importing 2022 row ${index}:`, error);
      skipped2022++;
    }
  }
  console.log(`✅ 2022: Imported ${imported2022}, Skipped ${skipped2022}\n`);

  console.log(`🎉 Total imported: ${imported2022 + imported2023} events`);
  console.log(`⏭️ Total skipped: ${skipped2022 + skipped2023} events`);
  console.log('✅ Import complete!');
  
  process.exit(0);
}

importEvents().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
