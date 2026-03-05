import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import { z } from '../lib/zod-openapi';

// Note: The z import above comes from lib/zod-openapi which extends Zod with OpenAPI support
// This ensures all .openapi() calls work correctly throughout the application

// Create the OpenAPI registry
export const registry = new OpenAPIRegistry();

// Flag to track if docs have been loaded
let docsLoaded = false;

// Lazy load documentation files to avoid circular dependency issues
// These files register their routes/schemas when imported
async function loadDocs() {
  if (docsLoaded) return;
  
  await import('../docs/auth.openapi');
  await import('../docs/recipients.openapi');
  await import('../docs/users.openapi');
  await import('../docs/collections.openapi');
  
  docsLoaded = true;
}

// Define common security schemes
registry.registerComponent('securitySchemes', 'sessionAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'connect.sid',
  description: 'Session-based authentication using Passport.js',
});

// Define common response schemas
export const ErrorResponseSchema = z.object({
  error: z.string().describe('Error message'),
  details: z.any().optional().describe('Additional error details'),
}).openapi('ErrorResponse');

export const SuccessResponseSchema = z.object({
  message: z.string().describe('Success message'),
}).openapi('SuccessResponse');

registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);

// Common error responses
export const commonErrorResponses = {
  400: {
    description: 'Bad Request - Invalid input data',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
  401: {
    description: 'Unauthorized - Authentication required',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
  403: {
    description: 'Forbidden - Insufficient permissions',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
  404: {
    description: 'Not Found - Resource not found',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
  409: {
    description: 'Conflict - Resource already exists or state conflict',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
  500: {
    description: 'Internal Server Error',
    content: {
      'application/json': {
        schema: ErrorResponseSchema,
      },
    },
  },
};

// Helper function to generate OpenAPI documentation
export async function generateOpenAPIDocument() {
  // Load all documentation files first
  await loadDocs();
  
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Sandwich Project Platform API',
      description: `
# Sandwich Project Platform API Documentation

This is the comprehensive API documentation for the Sandwich Project Platform, a volunteer management and coordination system.

## Authentication

This API uses **session-based authentication** with Passport.js. After logging in through \`/api/auth/login\`,
a session cookie (\`connect.sid\`) is set that must be included in subsequent requests.

### Authentication Flow:
1. POST to \`/api/auth/login\` with email and password
2. Receive session cookie in response
3. Include cookie in all subsequent requests
4. POST to \`/api/auth/logout\` to end session

## Authorization

The API implements a **Role-Based Access Control (RBAC)** system with the following roles:
- \`admin\` - Full system access
- \`admin_coordinator\` - Administrative coordinator privileges
- \`admin_viewer\` - Read-only administrative access
- \`volunteer\` - Base volunteer role
- \`committee_member\` - Committee-specific access
- \`viewer\` - Read-only viewer

Each endpoint may require specific permissions beyond just authentication. Permission requirements are documented for each endpoint.

## Common Patterns

### Pagination
Many list endpoints support pagination using query parameters:
- \`page\` - Page number (default: 1)
- \`limit\` - Items per page (default: 50)

### Filtering
List endpoints often support filtering via query parameters specific to each resource.

### Error Responses
All endpoints return consistent error responses with the structure:
\`\`\`json
{
  "error": "Error message",
  "details": {} // Optional additional context
}
\`\`\`

## Rate Limiting
Currently no rate limiting is implemented, but this may change in future versions.
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    tags: [
      { name: 'Authentication', description: 'User authentication and session management' },
      { name: 'Users', description: 'User management and profiles' },
      { name: 'Projects', description: 'Project management' },
      { name: 'Tasks', description: 'Task management' },
      { name: 'Meetings', description: 'Meeting scheduling and management' },
      { name: 'Recipients', description: 'Recipient/beneficiary management' },
      { name: 'Collections', description: 'Sandwich collections and groups catalog' },
      { name: 'Reports', description: 'Reporting and analytics' },
      { name: 'Messaging', description: 'Internal messaging system' },
      { name: 'Notifications', description: 'Notification management' },
      { name: 'Admin', description: 'Administrative functions' },
      { name: 'Audit', description: 'Audit logs and activity tracking' },
      { name: 'Documents', description: 'Document management' },
      { name: 'Storage', description: 'File storage and uploads' },
      { name: 'Calendar', description: 'Calendar and event management' },
      { name: 'Volunteers', description: 'Volunteer management' },
      { name: 'Announcements', description: 'System announcements' },
      { name: 'Search', description: 'Search functionality' },
    ],
    security: [
      {
        sessionAuth: [],
      },
    ],
  });
}
