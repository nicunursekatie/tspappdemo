/**
 * Reset Development Database Script
 *
 * This script drops all data from the development database and reseeds it
 * with fresh sample data. Use with caution - this will DELETE ALL DATA!
 *
 * Usage:
 *   npm run db:reset
 *
 * This script will:
 * 1. Drop all tables (via Drizzle migrations)
 * 2. Re-run migrations to create fresh schema
 * 3. Seed the database with sample data
 */

import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🔄 Resetting development database...\n');

    // Check if we're in production
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot reset database in production!');
      console.error('This script is for development only.');
      process.exit(1);
    }

    // Confirm reset
    console.log('⚠️  WARNING: This will DELETE ALL DATA in your development database!');
    console.log('Press Ctrl+C now to cancel, or wait 3 seconds to continue...\n');

    // Wait 3 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 1: Push schema (this will drop and recreate tables)
    console.log('📋 Step 1: Pushing fresh schema to database...');
    execSync('npm run db:push', { stdio: 'inherit' });

    // Step 2: Run migrations
    console.log('\n📋 Step 2: Running migrations...');
    execSync('npm run db:migrate', { stdio: 'inherit' });

    // Step 3: Seed the database
    console.log('\n📋 Step 3: Seeding database with sample data...');
    execSync('tsx scripts/seed-dev-database.ts', { stdio: 'inherit' });

    console.log('\n✨ Database reset completed successfully!');

  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    process.exit(1);
  }
}

main();
