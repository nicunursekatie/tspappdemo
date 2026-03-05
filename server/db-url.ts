/**
 * DATABASE CONNECTIONS DISABLED
 *
 * This repo has been isolated from the production database.
 * All database connections return undefined/dummy values to prevent
 * accidental connections to the production Neon database.
 */

export const isProduction = false;

export function getDatabaseUrl(): string | undefined {
  // DATABASE DISABLED - this repo is isolated from production
  return undefined;
}

export function getDatabaseBranch(): 'dev' | 'production' {
  return 'dev';
}

export const databaseInfo = {
  isProduction: false,
  get url() { return undefined; },
  get branch(): 'dev' | 'production' { return 'dev'; }
};
