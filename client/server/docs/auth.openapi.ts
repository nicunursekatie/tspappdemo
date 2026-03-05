/**
 * OpenAPI documentation for Authentication endpoints
 */
import { z } from '../lib/zod-openapi';
import { registry } from '../config/openapi';

// Define request/response schemas
const LoginRequestSchema = z.object({
  email: z.string().email().describe('User email address'),
  password: z.string().min(1).describe('User password'),
}).openapi('LoginRequest');

const UserSchema = z.object({
  id: z.string().describe('User ID'),
  email: z.string().email().describe('User email'),
  firstName: z.string().describe('User first name'),
  lastName: z.string().describe('User last name'),
  displayName: z.string().optional().describe('User display name'),
  profileImageUrl: z.string().nullable().describe('URL to profile image'),
  role: z.string().describe('User role (admin, volunteer, etc.)'),
  permissions: z.array(z.string()).describe('Array of permission strings'),
  isActive: z.boolean().describe('Whether the user account is active'),
}).openapi('User');

const LoginResponseSchema = z.object({
  success: z.boolean().describe('Whether login was successful'),
  user: UserSchema.optional().describe('User object if login successful'),
  message: z.string().optional().describe('Error message if login failed'),
}).openapi('LoginResponse');

const LogoutResponseSchema = z.object({
  success: z.boolean().describe('Whether logout was successful'),
  message: z.string().describe('Success or error message'),
}).openapi('LogoutResponse');

const ProfileSchema = UserSchema.extend({
  preferredEmail: z.string().email().nullable().optional().describe('Preferred email for communications'),
  phoneNumber: z.string().nullable().optional().describe('Contact phone number'),
}).openapi('UserProfile');

const UpdateProfileRequestSchema = z.object({
  firstName: z.string().optional().describe('Updated first name'),
  lastName: z.string().optional().describe('Updated last name'),
  displayName: z.string().optional().describe('Updated display name'),
  email: z.string().email().optional().describe('Updated email'),
  preferredEmail: z.string().email().optional().describe('Updated preferred email'),
  phoneNumber: z.string().optional().describe('Updated phone number'),
}).openapi('UpdateProfileRequest');

// Register schemas
registry.register('LoginRequest', LoginRequestSchema);
registry.register('User', UserSchema);
registry.register('LoginResponse', LoginResponseSchema);
registry.register('LogoutResponse', LogoutResponseSchema);
registry.register('UserProfile', ProfileSchema);
registry.register('UpdateProfileRequest', UpdateProfileRequestSchema);

// Register authentication routes
registry.registerPath({
  method: 'post',
  path: '/auth/login',
  description: 'Authenticate user and create session',
  summary: 'User login',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful - session cookie will be set',
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Missing email or password',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized - Invalid credentials or inactive account',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error - Login failed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [], // No auth required for login endpoint
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  description: 'End user session and clear authentication cookie',
  summary: 'User logout',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Logout successful - session destroyed',
      content: {
        'application/json': {
          schema: LogoutResponseSchema,
        },
      },
    },
    500: {
      description: 'Internal Server Error - Logout failed',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [], // Logout should work even without valid session
});

registry.registerPath({
  method: 'get',
  path: '/auth/user',
  description: 'Get current authenticated user information from session',
  summary: 'Get current user',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'Current user information',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - No active session',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/profile',
  description: 'Get detailed profile information for the current user including contact details',
  summary: 'Get user profile',
  tags: ['Authentication'],
  responses: {
    200: {
      description: 'User profile information',
      content: {
        'application/json': {
          schema: ProfileSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - No active session',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'put',
  path: '/auth/profile',
  description: 'Update own profile information (self-service). Users can only update their own profile.',
  summary: 'Update user profile',
  tags: ['Authentication'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateProfileRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: ProfileSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - No active session',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
});
