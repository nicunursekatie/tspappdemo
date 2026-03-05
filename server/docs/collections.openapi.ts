/**
 * OpenAPI documentation for Collections endpoints
 */
import { z } from '../lib/zod-openapi';
import { registry, commonErrorResponses } from '../config/openapi';

// Collection schema
const CollectionSchema = z.object({
  id: z.number().describe('Collection ID'),
  date: z.string().date().describe('Collection date'),
  hostLocation: z.string().describe('Host location name'),
  recipientName: z.string().describe('Recipient organization name'),
  sandwichCount: z.number().int().describe('Number of sandwiches collected'),
  notes: z.string().nullable().describe('Additional notes'),
  driverId: z.string().nullable().describe('ID of the driver who completed the delivery'),
  status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).describe('Collection status'),
  createdAt: z.string().datetime().describe('Record creation timestamp'),
  updatedAt: z.string().datetime().describe('Record last update timestamp'),
}).openapi('Collection');

const CreateCollectionSchema = z.object({
  date: z.string().date().describe('Collection date (required)'),
  hostLocation: z.string().min(1).describe('Host location name (required)'),
  recipientName: z.string().min(1).describe('Recipient organization name (required)'),
  sandwichCount: z.number().int().min(0).describe('Number of sandwiches (required)'),
  notes: z.string().optional().describe('Additional notes'),
  driverId: z.string().optional().describe('ID of the assigned driver'),
  status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).optional().default('scheduled'),
}).openapi('CreateCollection');

const UpdateCollectionSchema = CreateCollectionSchema.partial().openapi('UpdateCollection');

// Register schemas
registry.register('Collection', CollectionSchema);
registry.register('CreateCollection', CreateCollectionSchema);
registry.register('UpdateCollection', UpdateCollectionSchema);

// Register collection endpoints
registry.registerPath({
  method: 'get',
  path: '/sandwich-collections',
  description: 'Get all sandwich collections with optional filtering by date range and status',
  summary: 'List all collections',
  tags: ['Collections'],
  request: {
    query: z.object({
      startDate: z.string().date().optional().describe('Filter by start date (YYYY-MM-DD)'),
      endDate: z.string().date().optional().describe('Filter by end date (YYYY-MM-DD)'),
      status: z.enum(['scheduled', 'in-progress', 'completed', 'cancelled']).optional().describe('Filter by status'),
      hostLocation: z.string().optional().describe('Filter by host location'),
    }),
  },
  responses: {
    200: {
      description: 'List of collections',
      content: {
        'application/json': {
          schema: z.array(CollectionSchema),
        },
      },
    },
    ...commonErrorResponses,
  },
});

registry.registerPath({
  method: 'get',
  path: '/sandwich-collections/{id}',
  description: 'Get details of a specific collection by ID',
  summary: 'Get collection by ID',
  tags: ['Collections'],
  request: {
    params: z.object({
      id: z.string().describe('Collection ID'),
    }),
  },
  responses: {
    200: {
      description: 'Collection details',
      content: {
        'application/json': {
          schema: CollectionSchema,
        },
      },
    },
    404: {
      description: 'Collection not found',
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
  path: '/sandwich-collections',
  description: 'Create a new sandwich collection record',
  summary: 'Create new collection',
  tags: ['Collections'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateCollectionSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Collection created successfully',
      content: {
        'application/json': {
          schema: CollectionSchema,
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
  method: 'patch',
  path: '/sandwich-collections/{id}',
  description: 'Update an existing collection. All fields are optional.',
  summary: 'Update collection',
  tags: ['Collections'],
  request: {
    params: z.object({
      id: z.string().describe('Collection ID'),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateCollectionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Collection updated successfully',
      content: {
        'application/json': {
          schema: CollectionSchema,
        },
      },
    },
    404: {
      description: 'Collection not found',
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
  path: '/sandwich-collections/{id}',
  description: 'Delete a collection record permanently',
  summary: 'Delete collection',
  tags: ['Collections'],
  request: {
    params: z.object({
      id: z.string().describe('Collection ID'),
    }),
  },
  responses: {
    200: {
      description: 'Collection deleted successfully',
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
      description: 'Collection not found',
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

// Groups catalog endpoint
registry.registerPath({
  method: 'get',
  path: '/groups-catalog',
  description: 'Get the catalog of all organizations (hosts and recipients) for display purposes',
  summary: 'Get groups catalog',
  tags: ['Collections'],
  responses: {
    200: {
      description: 'Catalog of all organizations',
      content: {
        'application/json': {
          schema: z.object({
            hosts: z.array(z.object({
              id: z.number(),
              name: z.string(),
              location: z.string().nullable(),
              category: z.string().nullable(),
            })),
            recipients: z.array(z.object({
              id: z.number(),
              name: z.string(),
              region: z.string().nullable(),
              category: z.string().nullable(),
            })),
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});
