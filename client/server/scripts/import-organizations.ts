import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { getDatabaseUrl, getDatabaseBranch, isProduction } from '../db-url';

const DATABASE_URL = getDatabaseUrl();
if (!DATABASE_URL) {
  throw new Error('Database URL not configured. Set DATABASE_URL_DEV for development or DATABASE_URL for production.');
}

console.log(`🗄️ Connecting to ${getDatabaseBranch()} database (${isProduction ? 'production' : 'development'} mode)`);

const connection = neon(DATABASE_URL);
const db = drizzle(connection, { schema });

async function importOrganizations() {
  console.log('🔄 Starting organizations import...');
  
  const csvPath = join(process.cwd(), 'attached_assets', 'organizations_1761357165031.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  console.log(`📊 Found ${records.length} organizations to import`);
  
  let imported = 0;
  let updated = 0;
  let errors = 0;
  
  for (const record of records) {
    try {
      // Parse the data
      const orgData: any = {
        id: parseInt(record.id),
        name: record.name,
        department: record.department || null,
        alternateNames: record.alternate_names ? [record.alternate_names] : [],
        addresses: record.addresses ? [record.addresses] : [],
        domains: record.domains ? [record.domains] : [],
        totalEvents: parseInt(record.total_events) || 0,
        lastEventDate: record.last_event_date ? new Date(record.last_event_date) : null,
        category: record.category || null,
        schoolClassification: record.school_classification || null,
        isReligious: record.is_religious === 'true',
        createdAt: new Date(record.created_at),
        updatedAt: new Date(record.updated_at),
      };
      
      // Use raw SQL to upsert with explicit ID
      await db.execute(sql`
        INSERT INTO organizations (
          id, name, department, alternate_names, addresses, domains,
          total_events, last_event_date, category, school_classification,
          is_religious, created_at, updated_at
        ) VALUES (
          ${orgData.id}, 
          ${orgData.name}, 
          ${orgData.department}, 
          ${sql`ARRAY[]::text[]`},
          ${sql`ARRAY[]::text[]`}, 
          ${sql`ARRAY[]::text[]`}, 
          ${orgData.totalEvents}, 
          ${orgData.lastEventDate},
          ${orgData.category}, 
          ${orgData.schoolClassification}, 
          ${orgData.isReligious},
          ${orgData.createdAt}, 
          ${orgData.updatedAt}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          department = EXCLUDED.department,
          total_events = EXCLUDED.total_events,
          last_event_date = EXCLUDED.last_event_date,
          category = EXCLUDED.category,
          school_classification = EXCLUDED.school_classification,
          is_religious = EXCLUDED.is_religious,
          updated_at = EXCLUDED.updated_at
      `);
      
      imported++;
      
      if (imported % 50 === 0) {
        console.log(`✅ Processed ${imported}/${records.length} organizations...`);
      }
    } catch (error) {
      errors++;
      console.error(`❌ Error importing organization ${record.name}:`, error);
    }
  }
  
  // Update the sequence to prevent ID conflicts
  await db.execute(sql`
    SELECT setval('organizations_id_seq', (SELECT MAX(id) FROM organizations))
  `);
  
  console.log('\n📊 Import Summary:');
  console.log(`   Total records: ${records.length}`);
  console.log(`   ✅ Successfully imported: ${imported}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('\n✨ Organizations import complete!');
}

importOrganizations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
