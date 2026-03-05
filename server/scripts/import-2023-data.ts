import { db } from '../db';
import { sandwichCollections } from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';

async function import2023Data() {
  try {
    console.log('Reading 2023 data file...');
    const filePath = path.join(process.cwd(), 'attached_assets/2023 sandwiche_1761798032594.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`Found ${data.length} records to import`);
    
    // Process in batches of 50 to avoid timeout
    const batchSize = 50;
    let imported = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Transform records to match database schema
      const records = batch.map((record: any) => {
        let groupCollections;
        try {
          groupCollections = record.group_collections === '[]' ? [] : JSON.parse(record.group_collections);
        } catch {
          groupCollections = [];
        }
        
        return {
          collectionDate: record.collection_date,
          hostName: record.host_name,
          individualSandwiches: record.individual_sandwiches || 0,
          groupCollections: groupCollections,
          group1Name: record.group1_name,
          group1Count: record.group1_count,
          group2Name: record.group2_name,
          group2Count: record.group2_count,
          notes: record.notes || null,
          sandwichTypes: record.sandwich_types ? JSON.parse(record.sandwich_types) : null,
          createdBy: record.created_by || 'data_import_2023',
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
      
      // Insert batch
      await db.insert(sandwichCollections).values(records);
      
      imported += records.length;
      console.log(`Imported ${imported}/${data.length} records...`);
    }
    
    console.log('✅ Import complete!');
    console.log(`Total records imported: ${imported}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

import2023Data();
