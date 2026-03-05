import { db } from '../db';
import { resources } from '../../shared/schema';
import { or, eq } from 'drizzle-orm';

async function moveToMaster() {
  console.log('📋 Moving reference lists to Master Documents...');
  
  // Move the three lists to master_documents
  await db.update(resources)
    .set({ category: 'master_documents' })
    .where(or(
      eq(resources.title, 'Master Congregations List'),
      eq(resources.title, 'TSP Company Partners List'),
      eq(resources.title, 'Unified Schools List')
    ));
  
  console.log('  ✓ Moved Master Congregations List to Master Documents');
  console.log('  ✓ Moved TSP Company Partners List to Master Documents');
  console.log('  ✓ Moved Unified Schools List to Master Documents');
  console.log('\n✅ Reference lists reorganized successfully!');
  process.exit(0);
}

moveToMaster().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
