# API Documentation

This directory contains OpenAPI documentation for the Sandwich Project Platform API.

## Overview

The API documentation is built using `@asteasolutions/zod-to-openapi` which allows us to leverage existing Zod validation schemas to generate type-safe OpenAPI documentation.

## Viewing the Documentation

The interactive API documentation is available at `/api/docs` when the server is running. This provides a Swagger UI interface where you can:

- Browse all available endpoints
- View request/response schemas
- Test endpoints directly in the browser
- See authentication requirements
- View example requests and responses

The raw OpenAPI specification is available at `/api/docs/openapi.json`.

## Documentation Structure

Each file in this directory documents a specific feature area:

- **auth.openapi.ts** - Authentication and user session endpoints (`/api/auth/*`)
- **recipients.openapi.ts** - Recipient organization management (`/api/recipients/*`)
- **users.openapi.ts** - User management (`/api/users/*`, `/api/me`)
- **collections.openapi.ts** - Sandwich collection tracking (`/api/sandwich-collections/*`, `/api/groups-catalog`)

## How It Works

1. **Schema Definition**: Each documentation file defines Zod schemas for request/response objects
2. **Registration**: Schemas and endpoints are registered with the OpenAPI registry
3. **Import**: Documentation files are imported in `server/config/openapi.ts`
4. **Generation**: OpenAPI specification is auto-generated from the registry
5. **Serving**: Swagger UI serves the interactive documentation at `/api/docs`

## Adding Documentation for New Endpoints

To document a new endpoint or feature area:

### 1. Create a new documentation file

Create a file like `server/docs/your-feature.openapi.ts`:

\`\`\`typescript
import { z } from 'zod';
import { registry, commonErrorResponses } from '../config/openapi';

// Define your schemas
const YourSchema = z.object({
  id: z.number().describe('Unique ID'),
  name: z.string().describe('Resource name'),
  // ... other fields
}).openapi('YourSchemaName');

// Register schemas
registry.register('YourSchemaName', YourSchema);

// Register endpoints
registry.registerPath({
  method: 'get',
  path: '/your-endpoint',
  description: 'Detailed description of what this endpoint does',
  summary: 'Short summary',
  tags: ['Your Feature'],
  responses: {
    200: {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: z.array(YourSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
});
\`\`\`

### 2. Import the documentation file

Add your import to `server/config/openapi.ts`:

\`\`\`typescript
import '../docs/your-feature.openapi';
\`\`\`

### 3. Test your documentation

1. Start the server
2. Visit `http://localhost:3000/api/docs`
3. Find your endpoints in the Swagger UI
4. Test them to ensure the schemas match the actual API behavior

## Permission Documentation

Each endpoint should document its required permissions in the description field:

\`\`\`typescript
description: 'Get all recipients. Requires RECIPIENTS_VIEW permission.',
\`\`\`

Common permissions include:
- `RECIPIENTS_VIEW`, `RECIPIENTS_ADD`, `RECIPIENTS_EDIT`, `RECIPIENTS_DELETE`
- `USERS_MANAGE`, `USERS_VIEW`
- `COLLECTIONS_VIEW`, `COLLECTIONS_MANAGE`
- Admin-only endpoints should note "Requires admin role"

## Available Common Schemas

The following schemas are available for reuse across all documentation files:

- **ErrorResponse** - Standard error response format
- **SuccessResponse** - Generic success message
- **commonErrorResponses** - Standard HTTP error responses (400, 401, 403, 404, 500)

Example usage:

\`\`\`typescript
import { registry, commonErrorResponses } from '../config/openapi';

registry.registerPath({
  // ... path config
  responses: {
    200: { /* success response */ },
    ...commonErrorResponses, // Adds standard error responses
  },
});
\`\`\`

## Remaining Endpoints to Document

The following endpoint categories still need documentation files created:

### High Priority
- [ ] **Projects** (`/api/projects/*`) - Project management
- [ ] **Tasks** (`/api/tasks/*`) - Task management
- [ ] **Meetings** (`/api/meetings/*`, `/api/meeting-notes/*`) - Meeting management
- [ ] **Messaging** (`/api/messaging/*`) - Internal messaging
- [ ] **Notifications** (`/api/notifications/*`) - Notification system

### Medium Priority
- [ ] **Reports** (`/api/reports/*`) - Reporting and analytics
- [ ] **Storage** (`/api/storage/*`, `/api/documents/*`) - File storage
- [ ] **Search** (`/api/search/*`) - Search functionality
- [ ] **Volunteers** (`/api/volunteers/*`) - Volunteer management
- [ ] **Drivers** (`/api/drivers/*`) - Driver management
- [ ] **Hosts** (`/api/hosts/*`) - Host location management

### Lower Priority
- [ ] **Admin** (`/api/admin/*`) - Administrative functions
- [ ] **Audit Logs** (`/api/audit-logs/*`, `/api/activity-log/*`) - Audit trails
- [ ] **Event Requests** (`/api/event-requests/*`) - Event request management
- [ ] **Google Integration** (`/api/google-sheets/*`, `/api/google-calendar/*`)
- [ ] **Announcements** (`/api/announcements/*`) - System announcements
- [ ] **SMS** (`/api/sms-announcement/*`) - SMS notifications
- [ ] **Onboarding** (`/api/onboarding/*`) - User onboarding

## Best Practices

1. **Use existing Zod schemas** - If a Zod schema exists in `shared/schema.ts`, reuse it
2. **Provide clear descriptions** - Every field should have a meaningful description
3. **Include examples** - Where helpful, include example values in schema descriptions
4. **Document permissions** - Always note what permissions are required
5. **Test thoroughly** - Use the Swagger UI "Try it out" feature to verify accuracy
6. **Keep it up to date** - Update documentation when endpoints change

## Troubleshooting

### Documentation not appearing
- Make sure the file is imported in `server/config/openapi.ts`
- Check the server console for any import errors
- Verify the schemas are registered before use

### Schema validation errors
- Ensure Zod schemas match actual API request/response structure
- Check that required fields are marked correctly
- Verify enum values match what the API actually accepts

### Authentication not working in Swagger UI
- The session cookie is automatically included
- For testing, log in through the main app first
- Then the Swagger UI will use your authenticated session
