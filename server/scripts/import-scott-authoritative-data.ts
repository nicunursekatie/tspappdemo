import XLSX from 'xlsx';
import * as path from 'path';
import { db } from '../db';
import { sql } from 'drizzle-orm';

function excelDateToJSDate(excelDate: number): Date {
  const EXCEL_EPOCH = new Date(1899, 11, 30);
  return new Date(EXCEL_EPOCH.getTime() + excelDate * 86400000);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function importScottData() {
  try {
    console.log("📊 Reading Scott's authoritative Excel file...");
    const filePath = path.join(
      process.cwd(),
      'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx'
    );
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['InputData'];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];

    console.log(`Found ${data.length} total records in Excel file`);

    console.log('\n🗑️  Clearing existing authoritative data...');
    await db.execute(
      sql`TRUNCATE TABLE authoritative_weekly_collections RESTART IDENTITY`
    );

    const records = [];
    let skipped = 0;

    for (const row of data) {
      const year = row.Year;
      const sandwiches =
        typeof row.Sandwiches === 'number' ? row.Sandwiches : 0;
      if (!year || year < 2020 || year > 2026) {
        skipped++;
        continue;
      }
      if (sandwiches > 100000 || sandwiches < 0) {
        skipped++;
        continue;
      }

      const date = excelDateToJSDate(row.Date);
      records.push({
        weekDate: formatDate(date),
        location: row.Location || 'Unknown',
        sandwiches,
        weekOfYear: row.WeekOfYear || 0,
        weekOfProgram: row.WeekOfProgram || 0,
        year,
      });
    }

    console.log(
      `📥 Importing ${records.length} valid records (skipped ${skipped} invalid)...`
    );

    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await db.execute(sql`
        INSERT INTO authoritative_weekly_collections 
          (week_date, location, sandwiches, week_of_year, week_of_program, year)
        SELECT * FROM ${sql.raw(
          `(VALUES ${batch
            .map(
              (r) =>
                `('${r.weekDate}', '${r.location.replace(/'/g, "''")}', ${r.sandwiches}, ${r.weekOfYear}, ${r.weekOfProgram}, ${r.year})`
            )
            .join(', ')}) AS t`
        )}
      `);
      imported += batch.length;
      console.log(`  Imported ${imported}/${records.length} records...`);
    }

    console.log('\n✅ Import complete!');

    const yearTotals = await db.execute(sql`
      SELECT year, COUNT(*) as record_count, SUM(sandwiches) as total_sandwiches
      FROM authoritative_weekly_collections GROUP BY year ORDER BY year
    `);

    const rows = Array.isArray(yearTotals)
      ? yearTotals
      : (yearTotals as any).rows || [];
    console.log('\nYearly totals:');
    for (const row of rows) {
      console.log(
        `  ${row.year}: ${row.record_count} records, ${Number(row.total_sandwiches).toLocaleString()} sandwiches`
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importScottData();
