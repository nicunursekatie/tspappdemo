import XLSX from 'xlsx';
import * as path from 'path';
import { db } from '../db';
import { sandwichCollections } from '../../shared/schema';
import { sql } from 'drizzle-orm';

// Excel date to JavaScript date converter
function excelDateToJSDate(excelDate: number): Date {
  // Excel dates are days since 1900-01-01 (with a leap year bug at 1900)
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
    console.log('Reading Scott\'s Excel file...');
    const filePath = path.join(process.cwd(), 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['InputData'];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];
    
    console.log(`Found ${data.length} records in Excel file`);
    
    // First, let's see what we're working with
    console.log('\nSample records:');
    data.slice(0, 3).forEach(row => {
      const date = excelDateToJSDate(row.Date);
      console.log(`  ${formatDate(date)} | ${row.Location} | ${row.Sandwiches} sandwiches`);
    });
    
    console.log('\n⚠️  IMPORTANT: This will REPLACE all existing sandwich_collections data.');
    console.log('Do you want to proceed? (This script will delete existing data and import Scott\'s weekly data)');
    
    // For now, just show what would be imported
    const yearStats: Record<number, { count: number; total: number }> = {};
    
    for (const row of data) {
      const year = row.Year;
      if (!year || year < 2020 || year > 2026) continue;
      
      const sandwiches = typeof row.Sandwiches === 'number' ? row.Sandwiches : 0;
      if (sandwiches > 100000) continue; // Skip corrupted data
      
      if (!yearStats[year]) yearStats[year] = { count: 0, total: 0 };
      yearStats[year].count++;
      yearStats[year].total += sandwiches;
    }
    
    console.log('\nData to be imported:');
    Object.keys(yearStats).sort().forEach(y => {
      console.log(`  ${y}: ${yearStats[+y].count} records, ${yearStats[+y].total.toLocaleString()} sandwiches`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

importScottData();
