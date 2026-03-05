/**
 * OpenAPI documentation for Users endpoints
 */
import { z } from '../lib/zod-openapi';
import { registry, commonErrorResponses } from '../config/openapi';

// User schema
const UserSchema = z.object({
  id: z.string().describe('User ID'),
  email: z.string().email().describe('User email'),
  firstName: z.string().describe('First name'),
  lastName: z.string().describe('Last name'),
  displayName: z.string().nullable().describe('Display name for chat/activities'),
  profileImageUrl: z.string().nullable().describe('URL to profile image'),
  phoneNumber: z.string().nullable().describe('Contact phone number'),
  preferredEmail: z.string().email().nullable().describe('Preferred email for communications'),
  role: z.enum(['admin', 'admin_coordinator', 'admin_viewer', 'volunteer', 'committee_member', 'viewer'])
    .describe('User role'),
  permissions: z.array(z.string()).describe('Array of permission strings'),
  isActive: z.boolean().describe('Whether the account is active'),
  lastLoginAt: z.string().datetime().nullable().describe('Last login timestamp'),
  createdAt: z.string().datetime().describe('Account creation timestamp'),
}).openapi('User');

const CreateUserSchema = z.object({
  email: z.string().email().describe('User email (required)'),
  password: z.string().min(8).describe('User password (required, min 8 characters)'),
  firstName: z.string().min(1).describe('First name (required)'),
  lastName: z.string().min(1).describe('Last name (required)'),
  phoneNumber: z.string().optional().describe('Contact phone number'),
  role: z.enum(['admin', 'admin_coordinator', 'admin_viewer', 'volunteer', 'committee_member', 'viewer'])
    .optional().default('volunteer').describe('User role'),
  isActive: z.boolean().optional().default(true).describe('Whether the account is active'),
}).openapi('CreateUser');

const UpdateUserSchema = z.object({
  email: z.string().email().optional().describe('Updated email'),
  firstName: z.string().optional().describe('Updated first name'),
  lastName: z.string().optional().describe('Updated last name'),
  displayName: z.string().optional().describe('Updated display name'),
  phoneNumber: z.string().optional().describe('Updated phone number'),
  preferredEmail: z.string().email().optional().describe('Updated preferred email'),
  profileImageUrl: z.string().url().optional().describe('Updated profile image URL'),
  role: z.enum(['admin', 'admin_coordinator', 'admin_viewer', 'volunteer', 'committee_member', 'viewer'])
    .optional().describe('Updated role (admin only)'),
  permissions: z.array(z.string()).optional().describe('Updated permissions (admin only)'),
  isActive: z.boolean().optional().describe('Updated active status (admin only)'),
}).openapi('UpdateUser');

const UpdatePermissionsSchema = z.object({
  permissions: z.array(z.string()).describe('Array of permission strings to assign'),
}).openapi('UpdatePermissions');

// Register schemas
registry.register('User', UserSchema);
registry.register('CreateUser', CreateUserSchema);
registry.register('UpdateUser', UpdateUserSchema);
registry.register('UpdatePermissions', UpdatePermissionsSchema);

// Register user endpoints
registry.registerPath({
  method: 'get',
  path: '/users',
  description: 'Get all users in the system. Requires admin or user management permissions.',
  summary: 'List all users',
  tags: ['Users'],
  responses: {
    200: {
      description: 'List of all users',
      content: {
        'application/json': {
          schema: z.array(UserSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/users/{id}',
  description: 'Get details of a specific user by ID',
  summary: 'Get user by ID',
  tags: ['Users'],
  request: {
    params: z.object({
      id: z.string().describe('User ID'),
    }),
  },
  responses: {
    200: {
      description: 'User details',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/users',
  description: 'Create a new user account. Requires admin permissions.',
  summary: 'Create new user',
  tags: ['Users'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid data or email already exists',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.any().optional(),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}',
  description: 'Update user information. Users can update their own profile, admins can update any user.',
  summary: 'Update user',
  tags: ['Users'],
  request: {
    params: z.object({
      id: z.string().describe('User ID'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User updated successfully',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid data',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/users/{id}/permissions',
  description: 'Update user permissions. Requires admin permissions.',
  summary: 'Update user permissions',
  tags: ['Users'],
  request: {
    params: z.object({
      id: z.string().describe('User ID'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePermissionsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Permissions updated successfully',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/users/{id}',
  description: 'Delete a user account. This action deactivates the account rather than permanently deleting it. Requires admin permissions.',
  summary: 'Delete user',
  tags: ['Users'],
  request: {
    params: z.object({
      id: z.string().describe('User ID'),
    }),
  },
  responses: {
    200: {
      description: 'User deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
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
            error: z.string(),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

// /api/me endpoints (user's own profile)
registry.registerPath({
  method: 'get',
  path: '/me',
  description: 'Get current authenticated user profile information',
  summary: 'Get own profile',
  tags: ['Users'],
  responses: {
    200: {
      description: 'Current user profile',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/me',
  description: 'Update current authenticated user own profile',
  summary: 'Update own profile',
  tags: ['Users'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UpdateUserSchema.omit({ role: true, permissions: true, isActive: true }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    ...commonErrorResponses,
  },
});
