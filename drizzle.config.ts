import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './server/db-url';

// Used by `npm run db:push` to sync shared/schema.ts directly to the database.
// Migration files are managed manually in migrations/ and run by server/migrate.ts.
const databaseUrl = getDatabaseUrl() || 'postgresql://placeholder';

export default defineConfig({
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});