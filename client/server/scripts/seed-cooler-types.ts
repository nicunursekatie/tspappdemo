import { db } from '../db';
import { coolerTypes } from '../../shared/schema';
import { logger } from '../middleware/logger';

/**
 * Seed default cooler types
 * Run this with: npx tsx server/scripts/seed-cooler-types.ts
 */
async function seedCoolerTypes() {
  try {
    logger.info('Seeding default cooler types...');

    const defaultTypes = [
      {
        name: 'Large Rolling Cooler',
        description: 'Large insulated cooler with wheels and handle',
        sortOrder: 1,
        isActive: true,
      },
      {
        name: 'Medium Cooler',
        description: 'Medium-sized portable cooler',
        sortOrder: 2,
        isActive: true,
      },
      {
        name: 'Small Cooler',
        description: 'Small portable cooler or lunch box',
        sortOrder: 3,
        isActive: true,
      },
      {
        name: 'Soft-Sided Cooler',
        description: 'Flexible insulated cooler bag',
        sortOrder: 4,
        isActive: true,
      },
    ];

    for (const type of defaultTypes) {
      await db.insert(coolerTypes).values(type).onConflictDoNothing();
      logger.info(`Added cooler type: ${type.name}`);
    }

    logger.info('✅ Cooler types seeded successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to seed cooler types', error);
    process.exit(1);
  }
}

seedCoolerTypes();
