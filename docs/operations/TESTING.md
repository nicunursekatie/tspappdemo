# Testing Guide

This document provides comprehensive information about testing in the Sandwich Project Platform.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

We use a multi-layered testing approach to ensure code quality and prevent regressions:

1. **Unit Tests** - Test individual components, hooks, and functions in isolation
2. **Integration Tests** - Test API endpoints and server routes
3. **End-to-End Tests** - Test complete user workflows in a browser

## Testing Stack

### Unit & Integration Testing
- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **Supertest** - HTTP assertion library for API testing
- **ts-jest** - TypeScript support for Jest

### End-to-End Testing
- **Playwright** - Browser automation for E2E tests
- Supports Chromium, Firefox, and WebKit

### Utilities
- **@testing-library/user-event** - Realistic user interactions
- **@testing-library/jest-dom** - Custom DOM matchers
- **jest-mock-extended** - Enhanced mocking capabilities

## Running Tests

### Quick Start

```bash
# Run all unit and integration tests
npm test

# Run all tests including E2E
npm run test:all

# Run specific test suites
npm run test:unit          # All unit tests (client + server)
npm run test:client        # Client-side unit tests only
npm run test:server        # Server-side unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Development workflows
npm run test:watch        # Watch mode for rapid development
npm run test:e2e:ui       # Playwright UI mode (interactive)
npm run test:e2e:headed   # Run E2E tests with visible browser

# Coverage reports
npm run test:coverage           # Full coverage report
npm run test:coverage:client    # Client coverage only
npm run test:coverage:server    # Server coverage only

# CI/CD
npm run test:ci           # Optimized for CI pipelines
```

### Test File Locations

```
project/
├── client/src/
│   ├── components/
│   │   └── __tests__/           # Component tests
│   │       ├── error-boundary.test.tsx
│   │       └── ...
│   ├── hooks/
│   │   └── __tests__/           # Hook tests
│   │       ├── useAuth.test.ts
│   │       └── ...
│   └── components/ui/
│       └── __tests__/           # UI component tests
│           └── button.test.tsx
├── tests/
│   ├── integration/
│   │   └── routes/              # API integration tests
│   │       ├── auth.test.ts
│   │       ├── drivers.test.ts
│   │       ├── event-requests.test.ts
│   │       └── hosts.test.ts
│   ├── setup/                   # Test utilities
│   │   ├── test-server.ts
│   │   └── jest.setup.client.ts
│   └── utils/                   # Test helpers
│       ├── test-utils.tsx
│       ├── mock-factories.ts
│       └── mock-server-helpers.ts
└── e2e/                         # End-to-end tests
    ├── auth.spec.ts
    ├── event-requests.spec.ts
    └── drivers.spec.ts
```

## Test Types

### 1. Unit Tests

#### Component Tests

Test React components in isolation with mocked dependencies.

**Example:**
```typescript
// client/src/components/__tests__/button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

test('should handle click events', async () => {
  const handleClick = jest.fn();
  const user = userEvent.setup();

  render(<Button onClick={handleClick}>Click me</Button>);

  await user.click(screen.getByRole('button'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});
```

#### Hook Tests

Test custom React hooks with `renderHook` from React Testing Library.

**Example:**
```typescript
// client/src/hooks/__tests__/useAuth.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../useAuth';

test('should return user data when authenticated', async () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useAuth(), { wrapper });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.isAuthenticated).toBe(true);
});
```

### 2. Integration Tests

Test API endpoints with real HTTP requests and mocked authentication.

**Example:**
```typescript
// tests/integration/routes/drivers.test.ts
import request from 'supertest';
import { createTestServer } from '../../setup/test-server';

describe('Drivers Routes', () => {
  let app;

  beforeAll(async () => {
    app = await createTestServer();
  });

  test('should reject unauthenticated requests', async () => {
    const response = await request(app).get('/api/drivers');
    expect([401, 403]).toContain(response.status);
  });

  test('should create a new driver', async () => {
    const agent = request.agent(app);
    const response = await agent
      .post('/api/drivers')
      .send({
        name: 'Test Driver',
        email: 'driver@example.com',
        phone: '555-0100',
      })
      .set('Cookie', ['connect.sid=mock-session-id']);

    expect(response.status).toBeLessThan(500);
  });
});
```

### 3. End-to-End Tests

Test complete user workflows in a real browser environment.

**Example:**
```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByLabel(/password/i).fill('testpassword');
  await page.getByRole('button', { name: /login/i }).click();

  await expect(page).toHaveURL(/dashboard/i);
});
```

## Writing Tests

### Test Utilities

#### Rendering Components with Providers

Use the custom `renderWithProviders` function to wrap components with necessary providers:

```typescript
import { render } from '../../../tests/utils/test-utils';

test('component with providers', () => {
  render(<MyComponent />);
  // Component is wrapped with QueryClient and Router
});
```

#### Mock Factories

Use pre-built mock factories for consistent test data:

```typescript
import {
  mockUser,
  mockDriver,
  mockEventRequest,
} from '../../../tests/utils/mock-factories';

test('with mock data', () => {
  const user = mockUser({ role: 'admin' });
  const driver = mockDriver({ name: 'John Doe' });
  // Use in your tests
});
```

#### Server Helpers

For integration tests, use server helpers:

```typescript
import {
  mockRequest,
  mockResponse,
  mockAuthRequest,
  createMockSession,
} from '../../../tests/utils/mock-server-helpers';

test('route handler', () => {
  const req = mockAuthRequest(1, 'admin');
  const res = mockResponse();

  // Test your route handler
});
```

### Mocking

#### Mocking Modules

```typescript
// Mock a module
jest.mock('@/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));
```

#### Mocking Fetch

```typescript
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({ data: 'test' }),
  })
);
```

#### Mocking User Events

```typescript
import userEvent from '@testing-library/user-event';

test('user interaction', async () => {
  const user = userEvent.setup();
  render(<MyForm />);

  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
});
```

## Best Practices

### General

1. **Write Tests First (TDD)** - Consider writing tests before implementation
2. **Test Behavior, Not Implementation** - Focus on what the code does, not how
3. **Keep Tests Focused** - One assertion per test when possible
4. **Use Descriptive Names** - Test names should describe what they verify
5. **Avoid Test Interdependence** - Tests should be able to run in any order
6. **Mock External Dependencies** - API calls, databases, third-party services
7. **Clean Up After Tests** - Use `afterEach` to reset state

### Component Testing

1. **Use Testing Library Queries** - Prefer `getByRole`, `getByLabelText` over `getByTestId`
2. **Test Accessibility** - Ensure components are accessible
3. **Test User Interactions** - Use `userEvent` for realistic interactions
4. **Avoid Implementation Details** - Don't test internal state or methods
5. **Test Error States** - Verify error boundaries and error messages

### Integration Testing

1. **Test Real Scenarios** - Use realistic data and workflows
2. **Test Authentication** - Verify protected routes require auth
3. **Test Validation** - Ensure invalid input is rejected
4. **Test Error Responses** - Verify proper error handling
5. **Use Supertest Agents** - Maintain session across requests

### E2E Testing

1. **Test Critical Paths** - Focus on essential user workflows
2. **Use Page Objects** - Organize selectors and actions
3. **Wait for Elements** - Use Playwright's auto-waiting
4. **Test in Multiple Browsers** - Verify cross-browser compatibility
5. **Keep Tests Independent** - Each test should set up its own state

### Coverage Goals

- **Server Code (including shared)**: 60% minimum enforced, aim for 70%+
- **Client Code**: 40% minimum enforced, aim for 60%+
- **Critical Paths (permissions, auth)**: 90%+ coverage required
- **Utilities**: 80%+ coverage recommended

### Current Coverage Status

As of the latest expansion (October 2025), the test suite includes:

**Unit Tests (11 files)**:
- Permission system (`tests/unit/unified-auth-utils.test.ts`)
- Auth middleware (`tests/unit/auth-middleware.test.ts`)
- React components (5 component test files)
- React hooks (3 hook test files)

**Integration Tests (16 files total)**:

*Fully Functional (4 files)*:
- Authentication routes (`auth.test.ts`)
- Drivers API routes (`drivers.test.ts`)
- Hosts API routes (`hosts.test.ts`)
- Event Requests API routes (`event-requests.test.ts`)
- Permissions routes (`permissions.test.ts`)
- Quick check routes (`quick-check.test.ts`)

*Test Templates - Need Setup Infrastructure (6 files, 154 test cases)*:
- Collections API routes (`collections.test.ts` - 24 tests)
- Notifications API routes (`notifications.test.ts` - 20 tests)
- Team Board API routes (`team-board.test.ts` - 18 tests)
- Recipients API routes (`recipients.test.ts` - 22 tests)
- Projects API routes (`projects.test.ts` - 30 tests)
- Users/Admin API routes (`users.test.ts` - 40 tests)

**Note**: The template tests provide comprehensive test coverage plans and documentation
but need test infrastructure setup to run. See `tests/INTEGRATION_TEST_SETUP_TODO.md` for details.

**End-to-End Tests (3 files)**:
- Authentication workflows
- Driver management
- Event request workflows

To generate a comprehensive coverage report:
```bash
./scripts/generate-coverage-report.sh
```

This will run all tests with coverage and display a combined summary.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
npm run test:ci
```

## Troubleshooting

### Common Issues

#### Jest: "Cannot find module"

**Solution:** Check `moduleNameMapper` in jest configs for path aliases.

```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/client/src/$1',
  '^@shared/(.*)$': '<rootDir>/shared/$1',
}
```

#### React Testing Library: "Unable to find element"

**Solution:** Use `screen.debug()` to see the current DOM state.

```typescript
render(<Component />);
screen.debug(); // Prints current DOM
```

#### Playwright: "Browser not installed"

**Solution:** Install Playwright browsers locally:

```bash
npx playwright install chromium
```

Note: Browser downloads are restricted in some environments. E2E tests can be run locally.

#### Async Tests Timing Out

**Solution:** Increase timeout or use proper async utilities:

```typescript
// Increase timeout
test('async operation', async () => {
  // ...
}, 10000); // 10 second timeout

// Use waitFor
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

#### Mock Not Working

**Solution:** Ensure mocks are defined before imports:

```typescript
// Mock BEFORE importing component
jest.mock('@/lib/api');

import { MyComponent } from './MyComponent';
```

### Getting Help

- **Jest Documentation**: https://jestjs.io/
- **React Testing Library**: https://testing-library.com/react
- **Playwright**: https://playwright.dev/
- **Project Issues**: Create an issue in the repository

## Next Steps

1. **Expand Coverage** - Add tests for remaining components and routes
2. **Add Visual Regression** - Integrate screenshot testing
3. **Performance Tests** - Add Lighthouse or similar
4. **Mutation Testing** - Use Stryker for mutation testing
5. **Load Testing** - Add k6 or similar for load tests

## Resources

- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [React Testing Library Cheat Sheet](https://testing-library.com/docs/react-testing-library/cheatsheet)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing JavaScript Course](https://testingjavascript.com/)
