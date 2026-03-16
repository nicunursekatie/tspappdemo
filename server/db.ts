import { getDatabaseUrl, getDatabaseBranch, isProduction, databaseInfo } from './db-url';

/**
 * DATABASE CONNECTION — DEMO MODE
 *
 * In the isolated demo repo, no database is connected.
 * This module exports a dummy `db` object that will throw
 * descriptive errors if any code accidentally tries to query
 * the database. The app uses MemStorage instead.
 */

const databaseUrl = getDatabaseUrl();

// Re-export databaseInfo for backward compatibility
export { databaseInfo };

let db: any;

if (databaseUrl) {
  // Real database connection (not used in demo mode)
  const { neon } = require('@neondatabase/serverless');
  const { drizzle } = require('drizzle-orm/neon-http');
  const schema = require('../shared/schema');

  const sqlClient = neon(databaseUrl);
  db = drizzle(sqlClient, { schema, logger: false });
  (db as any).execute = async (query: any) => {
    return await sqlClient(query);
  };
} else {
  // Demo mode: create a proxy that throws helpful errors
  const handler = {
    get(_target: any, prop: string) {
      if (prop === 'execute') {
        return async () => { throw new Error('Database not connected (demo mode)'); };
      }
      // Return a function that throws for any db method call (select, insert, etc.)
      return (..._args: any[]) => {
        const chainHandler: ProxyHandler<any> = {
          get(_t: any, chainProp: string) {
            if (typeof chainProp === 'string' && ['then', 'catch', 'finally'].includes(chainProp)) {
              // Make it thenable so await works but rejects
              if (chainProp === 'then') {
                return (resolve: any, reject: any) => reject(new Error(`Database not connected (demo mode). Attempted: db.${prop}().${chainProp}`));
              }
              return () => Promise.reject(new Error('Database not connected (demo mode)'));
            }
            return (..._innerArgs: any[]) => new Proxy({}, chainHandler);
          }
        };
        return new Proxy({}, chainHandler);
      };
    }
  };
  db = new Proxy({}, handler);
  console.log('⚠️ Database not connected — running in demo mode with in-memory storage');
}

export { db };
