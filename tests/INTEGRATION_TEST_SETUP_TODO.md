# Integration Test Setup - Implementation TODO

## Current Status

Several comprehensive integration test files have been created that follow a more advanced pattern:
- `tests/integration/routes/collections.test.ts`
- `tests/integration/routes/notifications.test.ts`
- `tests/integration/routes/team-board.test.ts`
- `tests/integration/routes/recipients.test.ts`
- `tests/integration/routes/projects.test.ts`
- `tests/integration/routes/users.test.ts`

However, these tests use authenticated agents and test users that are **not yet fully implemented** in the test setup infrastructure.

## What's Missing

The tests assume the following setup utilities exist in `tests/setup/test-server.ts`:

1. **Authenticated Test Agents**
   ```typescript
   let authenticatedAgent: request.SuperAgentTest;
   let adminAgent: request.SuperAgentTest;
   ```

2. **Test User Creation**
   ```typescript
   let testUser: any;  // Regular user with limited permissions
   let adminUser: any; // Admin user with elevated permissions
   ```

3. **Session Management**
   - Ability to create sessions for test users
   - Proper cookie handling for authentication
   - Permission-based session creation

## Two Approaches

### Approach 1: Complete the Advanced Setup (Recommended for Production)

Create these helper functions in `tests/setup/test-server.ts`:

```typescript
export async function createAuthenticatedAgent(
  app: Express,
  permissions: string[]
): Promise<request.SuperAgentTest> {
  const agent = request.agent(app);

  // Create test user with specific permissions
  const user = await createTestUser({
    email: `test_${Date.now()}@example.com`,
    role: 'volunteer',
    permissions,
  });

  // Login and get session
  await agent
    .post('/api/login')
    .send({
      email: user.email,
      password: 'testpassword',
    });

  return agent;
}

export async function createAdminAgent(app: Express): Promise<request.SuperAgentTest> {
  return createAuthenticatedAgent(app, ['*ALL*']);  // Or super_admin role
}
```

### Approach 2: Simplify Tests to Match Existing Pattern (Quick Fix)

Modify the new test files to follow the simpler pattern from existing tests:

```typescript
describe('Collections Routes', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/collections', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/collections');
      expect([401, 403]).toContain(response.status);
    });

    it('should allow authenticated requests with mock cookie', async () => {
      const agent = request.agent(app);
      const response = await agent
        .get('/api/collections')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).not.toBe(401);
    });
  });
});
```

## Recommendation

**Approach 1** is better for comprehensive testing but requires more setup work.
**Approach 2** gets tests running quickly but provides less coverage.

For now, the test files exist as **templates** showing what should be tested. They provide:
- Complete test coverage plans
- Documentation of all API endpoints
- Expected behaviors and edge cases
- Permission boundary testing

## Next Steps

1. **Short Term**: Update new test files to use simple mock cookie pattern (Approach 2)
2. **Medium Term**: Implement proper test user and agent creation utilities (Approach 1)
3. **Long Term**: Add database seeding and cleanup between tests

## Value of Current Test Files

Even without full setup, these test files provide significant value:
- **Documentation** of all API endpoints and their behaviors
- **Test coverage roadmap** showing what needs to be tested
- **Security requirements** clearly documented through permission checks
- **Ready to execute** once proper test setup is completed

## Files Affected

The following files need either:
- Proper `beforeAll` setup implementation (Approach 1), OR
- Simplification to match existing pattern (Approach 2)

1. `tests/integration/routes/collections.test.ts` - 24 tests
2. `tests/integration/routes/notifications.test.ts` - 20 tests
3. `tests/integration/routes/team-board.test.ts` - 18 tests
4. `tests/integration/routes/recipients.test.ts` - 22 tests
5. `tests/integration/routes/projects.test.ts` - 30+ tests
6. `tests/integration/routes/users.test.ts` - 40+ tests

**Total**: ~154 test cases waiting for proper setup infrastructure

## Existing Working Pattern

Reference these files for the current working pattern:
- `tests/integration/routes/auth.test.ts`
- `tests/integration/routes/drivers.test.ts`
- `tests/integration/routes/hosts.test.ts`

These use:
- Simple `createTestServer()` setup
- Mock cookies for authentication
- Basic error code checking without complex assertions
