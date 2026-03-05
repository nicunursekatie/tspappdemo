import { db } from '../db';
import { resources } from '../../shared/schema';
import { eq, or } from 'drizzle-orm';

async function reorganize() {
  console.log('📦 Reorganizing resources into Toolkit category...');
  
  // Update category from 'training' to 'toolkit'
  const result1 = await db.update(resources)
    .set({ category: 'toolkit' })
    .where(eq(resources.category, 'training'));
  console.log('  ✓ Updated training → toolkit');
  
  // Move labels to toolkit
  const result2 = await db.update(resources)
    .set({ category: 'toolkit' })
    .where(or(
      eq(resources.title, 'Deli Labels'),
      eq(resources.title, 'PBJ Labels')
    ));
  console.log('  ✓ Moved labels to toolkit');
  
  // Move food safety guides to toolkit
  const result3 = await db.update(resources)
    .set({ category: 'toolkit' })
    .where(or(
      eq(resources.title, 'Food Safety Volunteers Guide'),
      eq(resources.title, 'Food Safety Hosts Guide'),
      eq(resources.title, 'Food Safety Recipients Guide')
    ));
  console.log('  ✓ Moved food safety guides to toolkit');
  
  console.log('\n✅ Resources reorganized successfully!');
  process.exit(0);
}

reorganize().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
