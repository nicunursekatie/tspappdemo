#!/usr/bin/env node

/**
 * Script to remove backwards compatibility exports that use require()
 * These don't work in ES module projects
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const routesDir = path.join(__dirname, '../server/routes');

const files = [
  'drivers.ts',
  'volunteers.ts',
  'hosts.ts',
  'event-reminders.ts',
  'onboarding.ts',
  'google-sheets.ts',
  'google-calendar.ts',
  'routes.ts',
  'recipient-tsp-contacts.ts',
  'sandwich-distributions.ts',
  'import-events.ts',
  'data-management.ts',
  'password-reset.ts',
  'message-notifications.ts',
  'announcements.ts',
  'performance.ts',
];

let fixedCount = 0;

files.forEach(file => {
  const filePath = path.join(routesDir, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${file} (not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Pattern to match the backwards compatibility export block
  const pattern = /\/\/ Backwards compatibility export\nexport (?:default|function|const) [^]*?}\);?\n/g;

  const newContent = content.replace(pattern, '');

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Fixed ${file}`);
    fixedCount++;
  } else {
    console.log(`⏭️  No changes needed in ${file}`);
  }
});

console.log(`\n🎉 Fixed ${fixedCount} files`);
