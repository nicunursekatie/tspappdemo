import XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'attached_assets/New Sandwich Totals Scott (5)_1761847323011.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Available sheets:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`Total rows: ${data.length}`);
  
  if (data.length > 0) {
    console.log('\nColumns:', Object.keys(data[0]));
    console.log('\nFirst 5 rows:');
    data.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i}:`, row);
    });
  }
}
