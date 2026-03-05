import XLSX from 'xlsx';
import { db } from './server/db';
import { eventRequests } from './shared/schema';

async function importExcelEvents() {
  console.log('🚀 Starting Excel events import...\n');

  // Import 2023 events
  console.log('📊 Importing 2023 events from Excel...');
  const workbook2023 = XLSX.readFile('attached_assets/2023 Events (2)_1760559222867.xlsx');
  const sheetName2023 = workbook2023.SheetNames[0];
  const sheet2023 = workbook2023.Sheets[sheetName2023];
  const data2023 = XLSX.utils.sheet_to_json(sheet2023);

  console.log(`Found ${data2023.length} rows in 2023 Excel file`);
  console.log('Sample columns:', Object.keys(data2023[0] || {}));

  let imported2023 = 0;
  for (const [index, record] of (data2023 as any[]).entries()) {
    try {
      // Parse date - try different column names
      let eventDate = null;
      const dateValue = record['Event Date'] || record['Date'] || record['Desired Event Date'] || record['date'];
      
      if (dateValue) {
        if (typeof dateValue === 'number') {
          // Excel serial date number
          eventDate = XLSX.SSF.parse_date_code(dateValue);
          eventDate = new Date(eventDate.y, eventDate.m - 1, eventDate.d);
        } else {
          eventDate = new Date(dateValue);
        }
      }

      // Parse organization name
      const orgName = record['Organization Name'] || record['Organization'] || record['organization_name'] || 'Unknown';
      
      // Parse contact name
      let firstName = '';
      let lastName = '';
      const contactName = record['Contact Name'] || record['Contact'] || record['Name'] || '';
      if (contactName) {
        const nameParts = contactName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Generate unique external_id
      const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : 'no-date';
      const externalId = `historical-2023-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${index}`;

      await db.insert(eventRequests).values({
        organizationName: orgName,
        firstName,
        lastName,
        email: record['Email'] || record['email'] || null,
        phone: record['Phone'] || record['phone'] || null,
        desiredEventDate: eventDate,
        estimatedSandwichCount: record['Sandwiches'] || record['sandwiches'] || record['Estimated Sandwich Count'] ? 
          parseInt(String(record['Sandwiches'] || record['sandwiches'] || record['Estimated Sandwich Count'])) : null,
        status: 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2023++;
    } catch (error) {
      console.error(`Error importing 2023 row ${index}:`, error);
    }
  }
  console.log(`✅ Imported ${imported2023} events from 2023\n`);

  // Import 2022 events
  console.log('📊 Importing 2022 events from Excel...');
  const workbook2022 = XLSX.readFile('attached_assets/2022 Group Events (1)_1760559778419.xlsx');
  const sheetName2022 = workbook2022.SheetNames[0];
  const sheet2022 = workbook2022.Sheets[sheetName2022];
  const data2022 = XLSX.utils.sheet_to_json(sheet2022);

  console.log(`Found ${data2022.length} rows in 2022 Excel file`);
  console.log('Sample columns:', Object.keys(data2022[0] || {}));

  let imported2022 = 0;
  for (const [index, record] of (data2022 as any[]).entries()) {
    try {
      // Parse date - try different column names
      let eventDate = null;
      const dateValue = record['Event Date'] || record['Date'] || record['Desired Event Date'] || record['date'];
      
      if (dateValue) {
        if (typeof dateValue === 'number') {
          // Excel serial date number
          eventDate = XLSX.SSF.parse_date_code(dateValue);
          eventDate = new Date(eventDate.y, eventDate.m - 1, eventDate.d);
        } else {
          eventDate = new Date(dateValue);
        }
      }

      // Parse organization name
      const orgName = record['Organization Name'] || record['Organization'] || record['organization_name'] || 'Unknown';
      
      // Parse contact name
      let firstName = '';
      let lastName = '';
      const contactName = record['Contact Name'] || record['Contact'] || record['Name'] || '';
      if (contactName) {
        const nameParts = contactName.trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Generate unique external_id
      const dateStr = eventDate ? eventDate.toISOString().split('T')[0] : 'no-date';
      const externalId = `historical-2022-${orgName.replace(/[^a-zA-Z0-9]/g, '-')}-${dateStr}-${index}`;

      await db.insert(eventRequests).values({
        organizationName: orgName,
        firstName,
        lastName,
        email: record['Email'] || record['email'] || null,
        phone: record['Phone'] || record['phone'] || null,
        desiredEventDate: eventDate,
        status: record['Status']?.toLowerCase() || 'completed',
        externalId,
        createdAt: new Date(),
      });
      imported2022++;
    } catch (error) {
      console.error(`Error importing 2022 row ${index}:`, error);
    }
  }
  console.log(`✅ Imported ${imported2022} events from 2022\n`);

  console.log(`🎉 Total imported: ${imported2022 + imported2023} events`);
  console.log('✅ Import complete!');
  
  process.exit(0);
}

importExcelEvents().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
