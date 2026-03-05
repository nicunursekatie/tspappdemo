import XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets['InputData'];
const data = XLSX.utils.sheet_to_json(sheet);

console.log(`Total records: ${data.length}`);

// Calculate totals by year
const yearTotals: Record<number, { records: number; sandwiches: number }> = {};

for (const row of data as any[]) {
  const year = row.Year;
  let sandwiches = row.Sandwiches || 0;
  
  // Handle numeric types properly
  if (typeof sandwiches === 'string') {
    sandwiches = parseInt(sandwiches) || 0;
  }
  
  // Skip invalid data
  if (!year || year < 2020 || year > 2026) continue;
  if (sandwiches > 100000) continue; // Skip corrupted large values
  
  if (!yearTotals[year]) {
    yearTotals[year] = { records: 0, sandwiches: 0 };
  }
  
  yearTotals[year].records++;
  yearTotals[year].sandwiches += sandwiches;
}

console.log('\n=== EXCEL DATA TOTALS ===');
[2020, 2021, 2022, 2023, 2024, 2025].forEach(year => {
  if (yearTotals[year]) {
    const { records, sandwiches } = yearTotals[year];
    console.log(`${year}: ${records.toLocaleString().padStart(4)} records, ${sandwiches.toLocaleString().padStart(10)} sandwiches`);
  }
});

console.log('\n=== TARGET TOTALS (User Provided) ===');
console.log('2020:   37 records,     44,958 sandwiches');
console.log('2021:  127 records,    281,383 sandwiches');
console.log('2022:  489 records,    434,825 sandwiches');
console.log('2023:  422 records,    489,186 sandwiches');
console.log('2024:  367 records,    465,242 sandwiches');

console.log('\n=== CURRENT DATABASE ===');
console.log('2020:   37 records,     44,958 sandwiches ✓');
console.log('2021:  128 records,    281,395 sandwiches (12 diff)');
console.log('2022:  493 records,    373,024 sandwiches ❌ (missing 61,801)');
console.log('2023:  446 records,    396,353 sandwiches ❌ (missing 92,833)');
console.log('2024:  380 records,    354,412 sandwiches ❌ (missing 110,830)');
