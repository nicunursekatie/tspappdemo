import XLSX from 'xlsx';

console.log('📊 Analyzing 2023 Excel file structure...\n');
const workbook2023 = XLSX.readFile('attached_assets/2023 Events (2)_1760559222867.xlsx');
const sheet2023 = workbook2023.Sheets[workbook2023.SheetNames[0]];
const data2023 = XLSX.utils.sheet_to_json(sheet2023);

console.log('2023 FILE:');
console.log('- Total rows:', data2023.length);
console.log('- Columns:', Object.keys(data2023[0] || {}));
console.log('\nSample rows:');
console.table(data2023.slice(0, 5));

console.log('\n\n📊 Analyzing 2022 Excel file structure...\n');
const workbook2022 = XLSX.readFile('attached_assets/2022 Group Events (1)_1760559778419.xlsx');
const sheet2022 = workbook2022.Sheets[workbook2022.SheetNames[0]];
const data2022 = XLSX.utils.sheet_to_json(sheet2022);

console.log('2022 FILE:');
console.log('- Total rows:', data2022.length);
console.log('- Columns:', Object.keys(data2022[0] || {}));
console.log('\nSample rows:');
console.table(data2022.slice(0, 5));
