/**
 * OpenAPI documentation for Recipients endpoints
 */
import { z } from '../lib/zod-openapi';
import { registry, commonErrorResponses } from '../config/openapi';

// Recipient schema based on database schema
const RecipientSchema = z.object({
  id: z.number().describe('Unique recipient ID'),
  name: z.string().describe('Organization or recipient name'),
  phone: z.string().describe('Primary phone number'),
  email: z.string().email().nullable().describe('Email address'),
  website: z.string().url().nullable().describe('Organization website URL'),
  instagramHandle: z.string().nullable().describe('Instagram handle for social media tracking'),
  address: z.string().nullable().describe('Physical street address'),
  region: z.string().nullable().describe('Geographic region/area (e.g., "Downtown", "Sandy Springs")'),
  status: z.enum(['active', 'inactive']).describe('Current status of the recipient'),
  focusArea: z.string().nullable().describe('Focus area (e.g., "youth", "veterans", "seniors", "families")'),

  // Contact person fields
  contactPersonName: z.string().nullable().describe('Primary contact person name'),
  contactPersonPhone: z.string().nullable().describe('Primary contact person phone'),
  contactPersonEmail: z.string().email().nullable().describe('Primary contact person email'),
  contactPersonRole: z.string().nullable().describe('Primary contact person role/title'),

  // Second contact person fields
  secondContactPersonName: z.string().nullable().describe('Second contact person name'),
  secondContactPersonPhone: z.string().nullable().describe('Second contact person phone'),
  secondContactPersonEmail: z.string().email().nullable().describe('Second contact person email'),
  secondContactPersonRole: z.string().nullable().describe('Second contact person role/title'),

  // Operational fields
  reportingGroup: z.string().nullable().describe('Operational grouping (corresponds to host locations)'),
  estimatedSandwiches: z.number().int().nullable().describe('Estimated number of sandwiches needed'),
  sandwichType: z.string().nullable().describe('Type of sandwiches preferred'),
  tspContact: z.string().nullable().describe('TSP contact person name'),
  tspContactUserId: z.string().nullable().describe('User ID of TSP contact if they have an account'),
  contractSigned: z.boolean().describe('Whether contract has been signed'),
  contractSignedDate: z.string().datetime().nullable().describe('When contract was signed'),

  // Schedule fields
  collectionDay: z.string().nullable().describe('Day of week they collect sandwiches'),
  collectionTime: z.string().nullable().describe('Time they collect sandwiches'),
  feedingDay: z.string().nullable().describe('Day of week they feed people'),
  feedingTime: z.string().nullable().describe('Time they feed people'),

  // Social media tracking
  hasSharedPost: z.boolean().describe('Whether recipient has shared a post about TSP'),
  sharedPostDate: z.string().datetime().nullable().describe('When the post was shared'),

  createdAt: z.string().datetime().describe('Record creation timestamp'),
  updatedAt: z.string().datetime().describe('Record last update timestamp'),
}).openapi('Recipient');

const CreateRecipientSchema = z.object({
  name: z.string().min(1).describe('Organization or recipient name (required)'),
  phone: z.string().min(1).describe('Primary phone number (required)'),
  email: z.string().email().optional().describe('Email address'),
  website: z.string().url().optional().describe('Organization website URL'),
  instagramHandle: z.string().optional().describe('Instagram handle'),
  address: z.string().optional().describe('Physical street address'),
  region: z.string().optional().describe('Geographic region/area'),
  status: z.enum(['active', 'inactive']).optional().default('active').describe('Status'),
  focusArea: z.string().optional().describe('Focus area'),
  contactPersonName: z.string().optional().describe('Primary contact person name'),
  contactPersonPhone: z.string().optional().describe('Primary contact person phone'),
  contactPersonEmail: z.string().email().optional().describe('Primary contact person email'),
  contactPersonRole: z.string().optional().describe('Primary contact person role/title'),
  secondContactPersonName: z.string().optional().describe('Second contact person name'),
  secondContactPersonPhone: z.string().optional().describe('Second contact person phone'),
  secondContactPersonEmail: z.string().email().optional().describe('Second contact person email'),
  secondContactPersonRole: z.string().optional().describe('Second contact person role/title'),
  reportingGroup: z.string().optional().describe('Operational grouping'),
  estimatedSandwiches: z.number().int().optional().describe('Estimated number of sandwiches needed'),
  sandwichType: z.string().optional().describe('Type of sandwiches preferred'),
  tspContact: z.string().optional().describe('TSP contact person name'),
  tspContactUserId: z.string().optional().describe('User ID of TSP contact'),
  contractSigned: z.boolean().optional().default(false).describe('Whether contract has been signed'),
  contractSignedDate: z.string().datetime().optional().describe('When contract was signed'),
  collectionDay: z.string().optional().describe('Day of week they collect sandwiches'),
  collectionTime: z.string().optional().describe('Time they collect sandwiches'),
  feedingDay: z.string().optional().describe('Day of week they feed people'),
  feedingTime: z.string().optional().describe('Time they feed people'),
  hasSharedPost: z.boolean().optional().default(false).describe('Whether recipient has shared a post'),
  sharedPostDate: z.string().datetime().optional().describe('When the post was shared'),
}).openapi('CreateRecipient');

const UpdateRecipientSchema = CreateRecipientSchema.partial().openapi('UpdateRecipient');

const UpdateStatusSchema = z.object({
  status: z.enum(['active', 'inactive']).describe('New status for the recipient'),
}).openapi('UpdateRecipientStatus');

const ImportResultSchema = z.object({
  imported: z.number().int().describe('Number of recipients successfully imported'),
  skipped: z.number().int().describe('Number of records skipped due to errors'),
}).openapi('ImportResult');

// Register schemas
registry.register('Recipient', RecipientSchema);
registry.register('CreateRecipient', CreateRecipientSchema);
registry.register('UpdateRecipient', UpdateRecipientSchema);
registry.register('UpdateRecipientStatus', UpdateStatusSchema);
registry.register('ImportResult', ImportResultSchema);

// Register recipient endpoints
registry.registerPath({
  method: 'get',
  path: '/recipients',
  description: 'Get all recipients (beneficiary organizations)',
  summary: 'List all recipients',
  tags: ['Recipients'],
  responses: {
    200: {
      description: 'List of all recipients',
      content: {
        'application/json': {
          schema: z.array(RecipientSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/recipients/export-csv',
  description: 'Export all recipients data as a CSV file',
  summary: 'Export recipients to CSV',
  tags: ['Recipients'],
  responses: {
    200: {
      description: 'CSV file download',
      content: {
        'text/csv': {
          schema: z.string(),
        },
      },
      headers: {
        'Content-Disposition': {
          description: 'Attachment filename',
          schema: {
            type: 'string',
          },
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'post',
  path: '/recipients/import',
  description: 'Import recipients from a CSV or XLSX file. File must contain columns for Name and Phone (required), plus any optional fields.',
  summary: 'Import recipients from file',
  tags: ['Recipients'],
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().describe('CSV or XLSX file containing recipient data'),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Import results',
      content: {
        'application/json': {
          schema: ImportResultSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - No file uploaded or invalid file type',
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
  method: 'get',
  path: '/recipients/{id}',
  description: 'Get details of a specific recipient by ID',
  summary: 'Get recipient by ID',
  tags: ['Recipients'],
  request: {
    params: z.object({
      id: z.string().describe('Recipient ID'),
    }),
  },
  responses: {
    200: {
      description: 'Recipient details',
      content: {
        'application/json': {
          schema: RecipientSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid recipient ID',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Not Found - Recipient not found',
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
  path: '/recipients',
  description: 'Create a new recipient organization. Name and phone are required fields.',
  summary: 'Create new recipient',
  tags: ['Recipients'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateRecipientSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Recipient created successfully',
      content: {
        'application/json': {
          schema: RecipientSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid data',
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
  method: 'put',
  path: '/recipients/{id}',
  description: 'Update an existing recipient. All fields are optional - only provide the fields you want to update.',
  summary: 'Update recipient',
  tags: ['Recipients'],
  request: {
    params: z.object({
      id: z.string().describe('Recipient ID'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRecipientSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Recipient updated successfully',
      content: {
        'application/json': {
          schema: RecipientSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid recipient ID or data',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
            details: z.any().optional(),
          }),
        },
      },
    },
    404: {
      description: 'Not Found - Recipient not found',
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
  path: '/recipients/{id}',
  description: 'Delete a recipient permanently. This action cannot be undone.',
  summary: 'Delete recipient',
  tags: ['Recipients'],
  request: {
    params: z.object({
      id: z.string().describe('Recipient ID'),
    }),
  },
  responses: {
    200: {
      description: 'Recipient deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid recipient ID',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Not Found - Recipient not found',
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
  path: '/recipients/{id}/status',
  description: 'Update only the status of a recipient (active or inactive)',
  summary: 'Update recipient status',
  tags: ['Recipients'],
  request: {
    params: z.object({
      id: z.string().describe('Recipient ID'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Status updated successfully',
      content: {
        'application/json': {
          schema: RecipientSchema,
        },
      },
    },
    400: {
      description: 'Bad Request - Invalid recipient ID or status value',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    404: {
      description: 'Not Found - Recipient not found',
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
