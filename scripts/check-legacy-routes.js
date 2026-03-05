#!/usr/bin/env node

/**
 * Legacy Route Detection Script
 *
 * This script checks server/routes.ts for any new route registrations
 * that shouldn't be added to the legacy routing system.
 *
 * Run with: node scripts/check-legacy-routes.js
 * Or via npm: npm run check:routes
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

// File to check
const ROUTES_FILE = path.join(__dirname, '../server/routes.ts');

// Patterns that indicate route registrations (potential violations)
const ROUTE_PATTERNS = [
  /app\.use\(['"`]\/api\/(?!.*\/\/)/,  // app.use('/api/...') but not commented
  /app\.get\(['"`]\/api\//,              // app.get('/api/...')
  /app\.post\(['"`]\/api\//,             // app.post('/api/...')
  /app\.put\(['"`]\/api\//,              // app.put('/api/...')
  /app\.patch\(['"`]\/api\//,            // app.patch('/api/...')
  /app\.delete\(['"`]\/api\//,           // app.delete('/api/...')
  /const \w+Routes = await import\(['"`]\.\/routes\//,  // const someRoutes = await import('./routes/...')
];

// Allowed patterns (whitelisted - these are intentional)
const ALLOWED_PATTERNS = [
  /\/\/ REMOVED:/,                       // Commented out routes
  /signupRoutes/,                        // Signup is intentionally in legacy system
  /mainRoutes/,                          // Main routes registration (the modular system)
];

// Known baseline - routes that existed before migration (should remain commented)
const BASELINE_ROUTES = [
  'passwordResetRoutes',
  'driversRoutes',
  'volunteersRoutes',
  'hostsRoutes',
  'recipientsRoutes',
  'recipientTspContactRoutes',
  'eventRequestRoutes',
  'eventRemindersRoutes',
  'sandwichDistributionsRoutes',
  'importEventsRoutes',
  'dataManagementRoutes',
  'dashboardDocumentsRoutes',
  'emailRoutes',
  'streamRoutes',
  'onboardingRoutes',
  'registerMessageNotificationRoutes',
  'registerAnnouncementRoutes',
  'registerPerformanceRoutes',
  'googleSheetsRoutes',
  'googleCalendarRoutes',
  'routeOptimizationRoutes',
  'monitoringRoutes',
];

function checkLegacyRoutes() {
  console.log(`${colors.blue}${colors.bold}🔍 Checking for legacy route additions...${colors.reset}\n`);

  // Read the routes.ts file
  let content;
  try {
    content = fs.readFileSync(ROUTES_FILE, 'utf8');
  } catch (error) {
    console.error(`${colors.red}❌ Error reading ${ROUTES_FILE}:${colors.reset}`, error.message);
    process.exit(1);
  }

  const lines = content.split('\n');
  const violations = [];
  const warnings = [];

  // Check each line
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    // Skip empty lines and pure comments
    if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }

    // Check for route registration patterns
    for (const pattern of ROUTE_PATTERNS) {
      if (pattern.test(line)) {
        // Check if it's allowed
        const isAllowed = ALLOWED_PATTERNS.some(allowedPattern =>
          allowedPattern.test(line)
        );

        if (!isAllowed) {
          // Check if it's a baseline route that should be commented
          const isBaseline = BASELINE_ROUTES.some(baseline =>
            line.includes(baseline)
          );

          if (isBaseline && !line.trim().startsWith('//')) {
            violations.push({
              line: lineNumber,
              content: trimmedLine,
              message: 'Baseline route should be commented out',
            });
          } else if (!isBaseline) {
            violations.push({
              line: lineNumber,
              content: trimmedLine,
              message: 'New route registration detected',
            });
          }
        }
      }
    }

    // Check for uncommented baseline routes
    for (const baseline of BASELINE_ROUTES) {
      if (line.includes(baseline) && !line.trim().startsWith('//') && line.includes('await import')) {
        warnings.push({
          line: lineNumber,
          content: trimmedLine,
          message: `Baseline route "${baseline}" is uncommented`,
        });
      }
    }
  });

  // Report findings
  if (violations.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}${colors.bold}✅ No legacy route violations found!${colors.reset}`);
    console.log(`${colors.green}All routes are properly registered in the modular system.${colors.reset}\n`);
    return 0;
  }

  if (violations.length > 0) {
    console.log(`${colors.red}${colors.bold}❌ Found ${violations.length} route violation(s):${colors.reset}\n`);
    violations.forEach(({ line, content, message }) => {
      console.log(`${colors.red}Line ${line}:${colors.reset} ${message}`);
      console.log(`${colors.yellow}  ${content}${colors.reset}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠️  Found ${warnings.length} warning(s):${colors.reset}\n`);
    warnings.forEach(({ line, content, message }) => {
      console.log(`${colors.yellow}Line ${line}:${colors.reset} ${message}`);
      console.log(`  ${content}\n`);
    });
  }

  console.log(`\n${colors.blue}${colors.bold}📚 Reminder:${colors.reset}`);
  console.log(`${colors.blue}New routes should be added to server/routes/index.ts using RouterDependencies pattern.${colors.reset}`);
  console.log(`${colors.blue}See ROUTING_CONSOLIDATION_PLAN.md for details.${colors.reset}\n`);

  return violations.length > 0 ? 1 : 0;
}

// Run the check
const exitCode = checkLegacyRoutes();
process.exit(exitCode);
