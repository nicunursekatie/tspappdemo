# Integration Testing Guide

## Overview

This guide explains how to test the migrated routes to ensure authentication, permissions, and functionality work correctly.

## Setup

### 1. Install Testing Dependencies

```bash
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest
```

### 2. Test Structure

```
tests/
├── integration/
│   ├── routes/
│   │   ├── auth.test.ts           # Authentication tests
│   │   ├── drivers.test.ts        # Example route tests
│   │   ├── permissions.test.ts    # Permission tests
│   │   └── [route-name].test.ts   # Other route tests
│   ├── setup/
│   │   └── jest.setup.ts          # Test configuration
│   └── jest.config.js             # Jest configuration
└── setup/
    └── test-server.ts             # Test server utilities
```

## Running Tests

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test File
```bash
npm run test:integration -- drivers.test.ts
```

### Run Tests in Watch Mode
```bash
npm run test:integration -- --watch
```

### Run with Coverage
```bash
npm run test:integration -- --coverage
```

## Writing Tests

### 1. Authentication Tests

Test that protected routes require authentication:

```typescript
import request from 'supertest';
import { createTestServer } from '../../setup/test-server';

describe('Route Authentication', () => {
  let app;

  beforeAll(async () => {
    app = await createTestServer();
  });

  it('should reject unauthenticated requests', async () => {
    const response = await request(app).get('/api/drivers');
    expect([401, 403]).toContain(response.status);
  });

  it('should allow authenticated requests', async () => {
    const agent = request.agent(app);
    // Set up authentication here
    const response = await agent.get('/api/drivers');
    expect(response.status).not.toBe(401);
  });
});
```

### 2. Permission Tests

Test that routes enforce required permissions:

```typescript
describe('Permission Checks', () => {
  it('should require DRIVERS_VIEW permission', async () => {
    const agent = request.agent(app);
    // Mock user without permission
    const response = await agent.get('/api/drivers');
    expect([401, 403]).toContain(response.status);
  });

  it('should allow users with correct permission', async () => {
    const agent = request.agent(app);
    // Mock user WITH permission
    const response = await agent.get('/api/drivers');
    expect(response.status).toBe(200);
  });
});
```

### 3. Input Validation Tests

Test that routes validate input correctly:

```typescript
describe('Input Validation', () => {
  it('should reject invalid data', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/drivers')
      .send({ invalid: 'data' });

    expect(response.status).toBe(400);
  });

  it('should accept valid data', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/drivers')
      .send({
        name: 'Test Driver',
        email: 'driver@example.com',
      });

    expect([200, 201]).toContain(response.status);
  });
});
```

### 4. Error Handling Tests

Test that routes return consistent errors:

```typescript
describe('Error Handling', () => {
  it('should return standardized error format', async () => {
    const response = await request(app).get('/api/drivers/999999');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('message');
  });
});
```

## Test Checklist for Each Migrated Route

Use this checklist when testing a migrated route:

### Authentication
- [ ] Unauthenticated requests are rejected (401/403)
- [ ] Authenticated requests are accepted
- [ ] Session handling works correctly
- [ ] Token/cookie authentication works

### Authorization (Permissions)
- [ ] Users without required permissions are rejected (403)
- [ ] Users with permissions can access routes
- [ ] Admin users have full access
- [ ] Permission combinations work correctly

### Input Validation
- [ ] Invalid data is rejected with 400
- [ ] Missing required fields are caught
- [ ] Data type validation works
- [ ] Sanitization is applied (XSS protection)

### Functionality
- [ ] GET routes return correct data
- [ ] POST routes create resources
- [ ] PUT/PATCH routes update correctly
- [ ] DELETE routes remove resources
- [ ] Export routes generate files

### Error Handling
- [ ] 404 for non-existent resources
- [ ] 500 for server errors
- [ ] Consistent error format
- [ ] Error messages are helpful

### Middleware
- [ ] Request logging occurs
- [ ] Activity logging captures actions
- [ ] CORS headers are set correctly
- [ ] Rate limiting works (if applicable)

## Example: Complete Route Test

```typescript
// tests/integration/routes/volunteers.test.ts
import request from 'supertest';
import { createTestServer } from '../../setup/test-server';

describe('Volunteers Routes', () => {
  let app;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/volunteers', () => {
    it('requires authentication', async () => {
      const response = await request(app).get('/api/volunteers');
      expect([401, 403]).toContain(response.status);
    });

    it('returns volunteer list for authenticated users', async () => {
      const agent = request.agent(app);
      // Mock authenticated session
      const response = await agent.get('/api/volunteers');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/volunteers', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .post('/api/volunteers')
        .send({ name: 'Test' });
      expect([401, 403]).toContain(response.status);
    });

    it('validates required fields', async () => {
      const agent = request.agent(app);
      const response = await agent
        .post('/api/volunteers')
        .send({});
      expect(response.status).toBe(400);
    });

    it('creates volunteer with valid data', async () => {
      const agent = request.agent(app);
      const response = await agent
        .post('/api/volunteers')
        .send({
          firstName: 'Test',
          lastName: 'Volunteer',
          email: 'test@example.com',
        });
      expect([200, 201]).toContain(response.status);
    });
  });

  describe('GET /api/volunteers/export', () => {
    it('requires authentication', async () => {
      const response = await request(app).get('/api/volunteers/export');
      expect([401, 403]).toContain(response.status);
    });

    it('returns CSV file', async () => {
      const agent = request.agent(app);
      const response = await agent.get('/api/volunteers/export?format=csv');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });
  });
});
```

## Testing in Staging

### 1. Manual Testing Checklist

Create a spreadsheet or document with:

| Route | Method | Auth Required | Permission | Test Result | Notes |
|-------|--------|--------------|------------|-------------|-------|
| /api/drivers | GET | Yes | None | ✅ Pass | Returns driver list |
| /api/drivers | POST | Yes | DRIVERS_EDIT | ✅ Pass | Creates driver |
| /api/drivers/:id | GET | Yes | None | ✅ Pass | Returns single driver |
| ... | ... | ... | ... | ... | ... |

### 2. Automated Staging Tests

```bash
# Set staging environment
export API_URL=https://staging.yourapp.com
export TEST_USER_EMAIL=test@example.com
export TEST_USER_PASSWORD=testpassword

# Run integration tests against staging
npm run test:integration:staging
```

### 3. Smoke Tests

Quick tests to run after deployment:

```bash
# Test authentication
curl -X GET https://staging.yourapp.com/api/drivers
# Should return 401

# Test login
curl -X POST https://staging.yourapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Test protected route with token
curl -X GET https://staging.yourapp.com/api/drivers \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
# Should return 200 with data
```

## Continuous Integration

Add to your CI pipeline (GitHub Actions, etc.):

```yaml
# .github/workflows/test.yml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test

      - name: Check route safety
        run: npm run check:routes
```

## Troubleshooting

### Tests Failing Due to Authentication

Make sure your test setup correctly mocks authentication:

```typescript
// In test-server.ts
export function setupAuthMock(app: Express) {
  app.use((req, res, next) => {
    if (req.headers.authorization === 'Bearer test-token') {
      req.user = { id: 'test-user', permissions: [] };
    }
    next();
  });
}
```

### Database Connection Issues

Use a separate test database:

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5432/test_db
```

### Tests Timing Out

Increase timeout in Jest config:

```javascript
// jest.config.js
module.exports = {
  testTimeout: 30000, // 30 seconds
};
```

## Summary

1. ✅ **Write tests** using the examples in `tests/integration/routes/`
2. ✅ **Run locally** with `npm run test:integration`
3. ✅ **Test in staging** using manual checklist + automated tests
4. ✅ **Add to CI/CD** to catch regressions automatically
5. ✅ **Document results** to track coverage

This comprehensive testing ensures your migrated routes work correctly and maintain security!
