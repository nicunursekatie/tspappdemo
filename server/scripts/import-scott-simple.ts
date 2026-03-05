import XLSX from 'xlsx';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

const execAsync = promisify(exec);

function excelDateToJSDate(excelDate: number): Date {
  const EXCEL_EPOCH = new Date(1899, 11, 30);
  const jsDate = new Date(EXCEL_EPOCH.getTime() + excelDate * 86400000);
  return jsDate;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function importScottData() {
  try {
    console.log('📊 Reading Scott\'s Excel file...');
    const filePath = path.join(process.cwd(), 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['InputData'];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];
    
    console.log(`Found ${data.length} records in Excel file`);
    
    // Generate SQL
    const sqlStatements = [];
    let skipped = 0;
    let imported = 0;
    
    for (const row of data) {
      const year = row.Year;
      const sandwiches = typeof row.Sandwiches === 'number' ? row.Sandwiches : 0;
      
      if (!year || year < 2020 || year > 2026 || sandwiches > 100000 || sandwiches < 0) {
        skipped++;
        continue;
      }
      
      const date = excelDateToJSDate(row.Date);
      const weekDate = formatDate(date);
      const location = (row.Location || 'Unknown').replace(/'/g, "''");
      const weekOfYear = row.WeekOfYear || 0;
      const weekOfProgram = row.WeekOfProgram || 0;
      
      sqlStatements.push(
        `('${weekDate}', '${location}', ${sandwiches}, ${weekOfYear}, ${weekOfProgram}, ${year})`
      );
      imported++;
    }
    
    console.log(`Generating SQL for ${imported} records (skipped ${skipped})...`);
    
    // Write SQL file
    const sqlFile = '/tmp/import_scott_data.sql';
    const sql = `
DELETE FROM authoritative_weekly_collections;
INSERT INTO authoritative_weekly_collections (week_date, location, sandwiches, week_of_year, week_of_program, year)
VALUES
${sqlStatements.join(',\n')};
`;
    
    fs.writeFileSync(sqlFile, sql);
    console.log(`\n📝 SQL file written to ${sqlFile}`);
    
    // Execute SQL
    console.log('📥 Importing data...');
    await execAsync(`psql $DATABASE_URL -f ${sqlFile}`);
    
    // Verify
    console.log('\n✅ Verifying import...');
    const { stdout } = await execAsync(`psql $DATABASE_URL -t -c "
      SELECT year, COUNT(*) as records, SUM(sandwiches) as total
      FROM authoritative_weekly_collections
      GROUP BY year
      ORDER BY year
    "`);
    
    console.log('\n=== IMPORT COMPLETE ===');
    console.log(stdout);
    
    console.log('✅ Scott\'s authoritative data successfully imported!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importScottData();
