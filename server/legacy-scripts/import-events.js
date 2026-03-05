import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import { eventRequests } from '../shared/schema.ts';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
// Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

async function importEvents() {
  try {
    console.log('Starting event import...');

    // Read the Excel file
    const filePath = path.join(
      __dirname,
      '..',
      'attached_assets',
      'Events for Import (1)_1756516126221.xlsx'
    );
    console.log('Reading file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log('Raw data from Excel:');
    console.log('Headers (Row 1):', data[0]);
    console.log('Sample data (Row 2):', data[1]);
    console.log(`Total rows: ${data.length}`);

    // Skip header row and process data
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) continue;

      // Expected columns based on user description:
      // - Date column
      // - Organization column
      // - Contact name column (first and last name)
      // - Email address
      // - Contact cell number (phone)

      // Let's identify columns by looking at the headers
      const headers = data[0];
      console.log(`Processing row ${i + 1}:`, row);

      // Map the data based on the specific column structure we found:
      // 0: Date, 1: Group Name, 12: Email Address, 13: Contact Name, 14: Contact Cell Number
      const eventDate = row[0];
      const organization = row[1]; // Group Name
      const email = row[12]; // Email Address
      const contactName = row[13]; // Contact Name
      const phone = row[14]; // Contact Cell Number

      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Parse date
      let parsedDate = null;
      if (eventDate) {
        try {
          // Handle Excel date formats - TIMEZONE SAFE
          if (typeof eventDate === 'number') {
            // Excel numeric date
            const excelEpoch = new Date(1899, 11, 30);
            const tempDate = new Date(
              excelEpoch.getTime() + eventDate * 24 * 60 * 60 * 1000
            );
            // Create local date to avoid timezone shift
            parsedDate = new Date(
              tempDate.getFullYear(),
              tempDate.getMonth(),
              tempDate.getDate()
            );
          } else {
            // String date - parse as local date by adding noon time
            const dateStr = eventDate.toString().trim();
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Already in YYYY-MM-DD format
              parsedDate = new Date(dateStr + 'T12:00:00');
            } else {
              // Try to parse and convert to local date
              const tempDate = new Date(dateStr);
              parsedDate = new Date(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate()
              );
            }
          }

          // Validate date
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          console.warn(`Could not parse date "${eventDate}" for row ${i + 1}`);
          parsedDate = null;
        }
      }

      // Only add if we have required fields
      if (firstName && organization && email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: email,
          phone: phone ? phone.toString() : null,
          organizationName: organization,
          desiredEventDate: parsedDate,
          status: 'new',
          previouslyHosted: 'i_dont_know',
          message: 'Imported from Excel file',
        });

        console.log(
          `✅ Prepared event: ${firstName} ${lastName} from ${organization}`
        );
      } else {
        console.warn(`⚠️  Skipping row ${i + 1} - missing required fields:`, {
          firstName: !!firstName,
          organization: !!organization,
          email: !!email,
          row: row,
        });
      }
    }

    console.log(`\nPrepared ${events.length} events for import`);

    if (events.length === 0) {
      console.log('No valid events to import. Exiting.');
      return;
    }

    // Show first few events for confirmation
    console.log('\nSample events to be imported:');
    events.slice(0, 3).forEach((event, index) => {
      console.log(
        `${index + 1}. ${event.firstName} ${event.lastName} (${
          event.email
        }) - ${event.organizationName} - ${
          event.desiredEventDate
            ? event.desiredEventDate.toDateString()
            : 'No date'
        }`
      );
    });

    // Import into database
    console.log('\nInserting into database...');
    const result = await db
      .insert(eventRequests)
      .values(events)
      .returning({ id: eventRequests.id });

    console.log(`✅ Successfully imported ${result.length} events!`);
    console.log(
      'Event IDs:',
      result.map((r) => r.id)
    );
  } catch (error) {
    console.error('❌ Error importing events:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await pool.end();
  }
}

// Run the import
importEvents();
