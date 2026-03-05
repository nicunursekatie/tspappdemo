# Developer Experience Guide

This guide covers the developer experience improvements added to the Sandwich Project Platform.

## Table of Contents

- [Quick Start](#quick-start)
- [Hot Module Reloading](#hot-module-reloading)
- [Database Development](#database-development)
- [VS Code Setup](#vs-code-setup)
- [NPM Scripts Reference](#npm-scripts-reference)
- [Debugging](#debugging)

## Quick Start

### First Time Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Copy `.env.example` to `.env` and configure your database URL

3. **Initialize the database**:
   ```bash
   npm run db:push      # Push schema to database
   npm run db:migrate   # Run migrations
   npm run db:seed      # Seed with sample data
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

### Recommended: Install VS Code Extensions

When you open this project in VS Code, you'll be prompted to install recommended extensions. Click "Install All" to get:

- ESLint & Prettier for code quality
- Tailwind CSS IntelliSense
- Drizzle ORM support
- Jest testing support
- And more!

## Hot Module Reloading

**Status**: ✅ Already Enabled

The project uses **Vite's Hot Module Replacement (HMR)** for instant updates during development:

- **Client-side**: React components reload without losing state
- **Server-side**: TypeScript files are watched and auto-restart via `tsx watch`
- **CSS**: Tailwind and CSS changes apply instantly

No additional configuration needed - it works out of the box!

## Database Development

### Seeding the Database

Populate your development database with realistic sample data:

```bash
npm run db:seed
```

This creates:
- 5 test users (admin, coordinator, volunteers, driver) with hashed passwords
- 3 sample projects (Thanksgiving Drive, Winter Coats, Weekly Distribution)
- 3 host locations with addresses and coordinates
- 2 drivers with vehicle information
- 3 recipient organizations with contact details and schedules
- 3 sandwich distribution records
- 4 chat messages across different channels
- 3 team board items (tasks and notes)
- 2 active announcements

**Test Credentials** (all use password: `password123`):
- Admin: `admin@sandwich.dev`
- Coordinator: `coordinator@sandwich.dev`
- Volunteer: `volunteer1@sandwich.dev`
- Driver: `driver@sandwich.dev`

### Resetting the Database

To start fresh with a clean database:

```bash
npm run db:reset
```

⚠️ **Warning**: This will:
1. Drop all existing data
2. Re-run migrations to create fresh schema
3. Seed with sample data

**Safety**: This script will only run in development mode and includes a 3-second confirmation delay.

### Database Scripts

| Script | Description |
|--------|-------------|
| `npm run db:push` | Push schema changes to database (Drizzle) |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:reset` | ⚠️ Reset database (drop + migrate + seed) |

## VS Code Setup

### Workspace Settings

The project includes optimized VS Code settings:

- **Auto-format on save** with Prettier
- **Auto-fix ESLint errors** on save
- **TypeScript path aliases** for imports (`@/`, `@shared/`)
- **Tailwind CSS IntelliSense** for `cn()` and `cva()`
- **Smart imports** that update automatically when files move

### Debug Configurations

Press `F5` or go to the Debug panel to use these configurations:

#### Individual Debuggers

- **Debug Server**: Debug the Express.js backend with auto-restart
- **Debug Client (Chrome)**: Debug React app in Chrome with sourcemaps
- **Debug Tests (Jest)**: Debug all Jest tests
- **Debug Current Test File**: Debug just the test file you're viewing
- **Debug E2E Tests (Playwright)**: Debug end-to-end tests with headed browser
- **Debug Database Migration**: Step through migration scripts
- **Debug Database Seed**: Step through seeding scripts

#### Compound Debuggers

- **Full Stack Debug**: Debug both client and server simultaneously

### Using the Debugger

1. Set breakpoints by clicking in the gutter (left of line numbers)
2. Press `F5` or select a debug configuration
3. Use the debug toolbar to:
   - Continue (`F5`)
   - Step Over (`F10`)
   - Step Into (`F11`)
   - Step Out (`Shift+F11`)
   - Restart (`Ctrl+Shift+F5`)
   - Stop (`Shift+F5`)

## NPM Scripts Reference

### Development

```bash
npm run dev          # Start development server (with HMR)
npm run type-check   # Check TypeScript types (alias: npm run check)
```

### Building & Production

```bash
npm run build        # Build for production (client + server)
npm run start        # Start production server
```

### Testing

```bash
npm run test              # Run unit + integration tests
npm run test:watch        # Run tests in watch mode (auto-rerun)
npm run test:unit         # Run unit tests only
npm run test:client       # Run client tests only
npm run test:server       # Run server tests only
npm run test:integration  # Run integration tests only
npm run test:e2e          # Run Playwright E2E tests
npm run test:e2e:ui       # Run E2E tests with Playwright UI
npm run test:coverage     # Run tests with coverage report
```

### Database

```bash
npm run db:push      # Push schema changes to database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm run db:reset     # ⚠️ Reset database (destructive!)
```

### Code Quality

```bash
npm run type-check   # TypeScript type checking
npm run check:routes # Check for legacy route issues
```

## Debugging

### Backend Debugging

1. Open the Debug panel (`Ctrl+Shift+D` or `Cmd+Shift+D`)
2. Select "Debug Server"
3. Press `F5` to start
4. Set breakpoints in `server/**/*.ts` files
5. Server will auto-restart on file changes

### Frontend Debugging

1. Select "Debug Client (Chrome)" configuration
2. Press `F5` to launch Chrome with debugging
3. Set breakpoints in `client/src/**/*.tsx` files
4. Use Chrome DevTools or VS Code for debugging

### Full Stack Debugging

1. Select "Full Stack Debug" configuration
2. Press `F5` to start both debuggers
3. Debug both frontend and backend simultaneously

### Test Debugging

1. Open a test file (e.g., `*.test.ts`)
2. Select "Debug Current Test File"
3. Set breakpoints in your test or source code
4. Press `F5` to debug

## Tips & Tricks

### Fast Iteration

1. Use `npm run test:watch` in a terminal for continuous test feedback
2. Use `npm run type-check` to catch TypeScript errors before running tests
3. The HMR is already optimized - just save files and see instant updates!

### Database Workflow

1. Make schema changes in `shared/schema.ts`
2. Run `npm run db:push` to update your dev database
3. Run `npm run db:seed` to add sample data
4. If things get messy, use `npm run db:reset` to start fresh

### Code Quality

- Install the recommended VS Code extensions for the best experience
- ESLint will auto-fix many issues on save
- Prettier will auto-format on save
- ErrorLens will show inline error messages as you type

### Performance

- Client bundle is optimized with code splitting
- Vendor chunks are separated for better caching
- Assets under 4KB are inlined automatically
- Production builds include tree-shaking and minification

## Troubleshooting

### Database Connection Issues

- Check that `DATABASE_URL` is set in your `.env` file
- Ensure PostgreSQL is running (or using Neon serverless)
- Try `npm run db:push` to ensure schema is up to date

### TypeScript Errors

- Run `npm run type-check` to see all errors
- Make sure VS Code is using the workspace TypeScript version
- Check that path aliases (`@/`, `@shared/`) are resolving correctly

### Hot Reload Not Working

- Clear the browser cache
- Check that you're running `npm run dev` (not `npm start`)
- Restart the dev server

### Tests Failing

- Make sure database is seeded: `npm run db:seed`
- Clear Jest cache: `jest --clearCache`
- Check that test environment variables are set

## Next Steps

- Explore the codebase structure
- Read the main README.md for project overview
- Check the API documentation at `/api/docs` when running the dev server
- Join the team chat and start contributing!

---

**Questions or issues?** Check the project README or ask the team in the chat!
