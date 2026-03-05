/**
 * Test Server Setup
 *
 * Creates an Express app instance for integration testing with proper
 * authentication, database, and middleware setup.
 */

import express, { Express } from 'express';
import session from 'express-session';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { registerRoutes } from '../../server/routes';
import { storage } from '../../server/storage-wrapper';
import { getDefaultPermissionsForRole } from '../../shared/auth-utils';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  isActive: boolean;
}

export interface TestContext {
  app: Express;
  authenticatedSession: any;
  unauthenticatedSession: any;
  adminSession: any;
}

/**
 * Create a test Express app with all routes registered
 */
export async function createTestServer(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session middleware for testing
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  // Register all routes
  await registerRoutes(app);

  return app;
}

/**
 * Create a mock authenticated session
 */
export function createMockSession(user: Partial<TestUser> = {}): any {
  return {
    user: {
      id: user.id || 'test-user-1',
      email: user.email || 'test@example.com',
      firstName: user.firstName || 'Test',
      lastName: user.lastName || 'User',
      permissions: user.permissions || [],
      isActive: user.isActive !== undefined ? user.isActive : true,
    },
  };
}

/**
 * Create a mock admin session
 */
export function createAdminSession(): any {
  return createMockSession({
    id: 'admin-user',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    permissions: [
      'USERS_VIEW',
      'USERS_EDIT',
      'DRIVERS_VIEW',
      'DRIVERS_EDIT',
      'VOLUNTEERS_VIEW',
      'VOLUNTEERS_EDIT',
      'HOSTS_VIEW',
      'HOSTS_EDIT',
      'RECIPIENTS_VIEW',
      'RECIPIENTS_EDIT',
      'DATA_EXPORT',
    ],
  });
}

/**
 * Helper to set authentication on a request
 */
export function authenticateRequest(req: any, user?: Partial<TestUser>): void {
  req.session = createMockSession(user);
  req.user = req.session.user;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(options: {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
}): Promise<any> {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 9);

  const email = options.email || `test_${timestamp}_${randomStr}@example.com`;
  const password = options.password || 'testpassword123';
  const firstName = options.firstName || 'Test';
  const lastName = options.lastName || 'User';
  const role = options.role || 'volunteer';

  // Get default permissions for role or use provided permissions
  const permissions = options.permissions || getDefaultPermissionsForRole(role);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user in database
  const userId = `test_user_${timestamp}_${randomStr}`;
  const user = await storage.createUser({
    id: userId,
    email,
    password: hashedPassword,
    firstName,
    lastName,
    role,
    permissions,
    isActive: true,
    profileImageUrl: null,
    metadata: {},
  });

  // Return user with plaintext password for testing
  return {
    ...user,
    password, // Return plaintext password for login
  };
}

/**
 * Create an authenticated SuperTest agent for a test user
 */
export async function createAuthenticatedAgent(
  app: Express,
  options: {
    email?: string;
    password?: string;
    permissions?: string[];
    role?: string;
  } = {}
): Promise<request.SuperAgentTest> {
  // Create test user
  const testUser = await createTestUser({
    email: options.email,
    password: options.password || 'testpassword123',
    role: options.role || 'volunteer',
    permissions: options.permissions,
  });

  // Create agent
  const agent = request.agent(app);

  // Login to get session
  const loginResponse = await agent
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: testUser.password,
    });

  // Log login response for debugging
  if (loginResponse.status !== 200) {
    console.error('Login failed:', {
      status: loginResponse.status,
      body: loginResponse.body,
    });
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }

  return agent;
}

/**
 * Create an authenticated SuperTest agent with admin permissions
 */
export async function createAdminAgent(app: Express): Promise<request.SuperAgentTest> {
  return createAuthenticatedAgent(app, {
    role: 'admin',
    email: `admin_${Date.now()}@example.com`,
  });
}
