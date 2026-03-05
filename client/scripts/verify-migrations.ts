/**
 * Migration Verification Script
 *
 * Verifies that all database migrations have unique sequential numbers
 * and no duplicates exist.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-011
 */

import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, '../migrations');

interface MigrationFile {
  number: string;
  filename: string;
  fullPath: string;
}

function verifyMigrationNumbers(): void {
  console.log('🔍 Verifying migration file numbering...\n');

  // Read all SQL migration files
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }

  // Parse migration numbers
  const migrations: MigrationFile[] = [];
  const numberMap = new Map<string, string[]>();
  const unnumbered: string[] = [];

  for (const file of files) {
    const match = file.match(/^(\d+)_/);

    if (match) {
      const num = match[1];
      migrations.push({
        number: num,
        filename: file,
        fullPath: join(migrationsDir, file)
      });

      // Track duplicates
      if (!numberMap.has(num)) {
        numberMap.set(num, []);
      }
      numberMap.get(num)!.push(file);
    } else {
      unnumbered.push(file);
    }
  }

  // Check for duplicates
  let hasDuplicates = false;
  console.log('📋 Checking for duplicate migration numbers...\n');

  for (const [num, files] of numberMap.entries()) {
    if (files.length > 1) {
      console.error(`❌ DUPLICATE migration number ${num}:`);
      files.forEach(f => console.error(`   - ${f}`));
      console.error('');
      hasDuplicates = true;
    }
  }

  // Check for unnumbered files
  if (unnumbered.length > 0) {
    console.error(`⚠️  Found ${unnumbered.length} unnumbered migration file(s):`);
    unnumbered.forEach(f => console.error(`   - ${f}`));
    console.error('');
  }

  // Check for sequential numbering
  console.log('📊 Checking for sequential numbering...\n');

  const numbers = Array.from(numberMap.keys())
    .map(n => parseInt(n, 10))
    .sort((a, b) => a - b);

  let hasGaps = false;
  for (let i = 0; i < numbers.length - 1; i++) {
    const current = numbers[i];
    const next = numbers[i + 1];

    if (next !== current + 1) {
      console.warn(`⚠️  Gap detected: ${current} → ${next} (missing ${current + 1})`);
      hasGaps = true;
    }
  }

  if (!hasGaps) {
    console.log('✅ No gaps in migration sequence');
  }

  // Display migration order
  console.log('\n📑 Migration execution order:\n');
  migrations
    .sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10))
    .forEach((m, index) => {
      console.log(`   ${index + 1}. ${m.filename}`);
    });

  // Final verdict
  console.log('\n' + '='.repeat(60) + '\n');

  if (hasDuplicates) {
    console.error('❌ MIGRATION VERIFICATION FAILED');
    console.error('   Duplicate migration numbers detected!');
    console.error('   Please rename migrations to ensure unique sequential numbers.\n');
    process.exit(1);
  }

  if (unnumbered.length > 0) {
    console.warn('⚠️  WARNING: Unnumbered migration files detected');
    console.warn('   These files will not be executed in a predictable order.\n');
  }

  console.log('✅ MIGRATION VERIFICATION PASSED');
  console.log(`   Found ${files.length} migrations with unique numbers`);
  console.log(`   Migration sequence: ${numbers[0]} → ${numbers[numbers.length - 1]}\n`);
}

// Run verification
try {
  verifyMigrationNumbers();
} catch (error) {
  console.error('❌ Error during migration verification:');
  console.error(error);
  process.exit(1);
}
