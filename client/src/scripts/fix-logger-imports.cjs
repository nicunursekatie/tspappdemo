#!/usr/bin/env node

/**
 * Fix logger imports that were placed incorrectly
 * This script:
 * 1. Removes incorrectly placed logger imports
 * 2. Adds them back at the correct location (end of imports block)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TypeScript/TSX files that use logger
const files = execSync('find ./src -type f \\( -name "*.ts" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/lib/logger.ts"', { encoding: 'utf-8' })
  .trim()
  .split('\n')
  .filter(Boolean);

let fixedCount = 0;

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if file uses logger
  if (!content.includes('logger.')) {
    return;
  }

  // Check if file already has correct logger import
  const lines = content.split('\n');
  let hasLoggerImport = false;
  let incorrectImportLine = -1;

  lines.forEach((line, index) => {
    if (line.includes("import { logger } from '@/lib/logger'")) {
      hasLoggerImport = true;
      // Check if it's on a line by itself (correct) or part of another import (incorrect)
      if (!line.trim().startsWith('import { logger }')) {
        incorrectImportLine = index;
      }
    }
  });

  if (!hasLoggerImport || incorrectImportLine !== -1) {
    // Remove any existing logger imports (correct or incorrect)
    let newContent = content.replace(/import { logger } from '@\/lib\/logger';\n?/g, '');

    // Find the end of the import block
    const newLines = newContent.split('\n');
    let lastImportIndex = -1;
    let inMultiLineImport = false;

    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i].trim();

      // Check if we're in a multi-line import
      if (line.startsWith('import ') && line.includes('{') && !line.includes('}')) {
        inMultiLineImport = true;
      }

      if (inMultiLineImport) {
        if (line.includes('}')) {
          inMultiLineImport = false;
          lastImportIndex = i;
        }
      } else if (line.startsWith('import ')) {
        lastImportIndex = i;
      }

      // Stop when we hit the first non-import, non-empty, non-comment line after imports
      if (lastImportIndex !== -1 && !inMultiLineImport &&
          line &&
          !line.startsWith('import ') &&
          !line.startsWith('//') &&
          !line.startsWith('/*') &&
          !line.startsWith('*') &&
          line !== '') {
        break;
      }
    }

    // Insert logger import after the last import
    if (lastImportIndex !== -1) {
      newLines.splice(lastImportIndex + 1, 0, "import { logger } from '@/lib/logger';");
      newContent = newLines.join('\n');

      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`✅ Fixed: ${filePath}`);
      fixedCount++;
    }
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files`);
