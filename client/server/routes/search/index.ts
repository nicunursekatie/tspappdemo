import { Router, type Response } from 'express';
import { z } from 'zod';
import { searchService } from '../../services/search';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

// Validation schemas
const globalSearchSchema = z
  .object({
    // Allow empty query - both q and query are truly optional
    q: z.string().optional(),
    query: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100).optional(),
    types: z
      .string()
      .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(
        z
          .array(
            z.enum([
              'collection',
              'host',
              'recipient',
              'project',
              'contact',
              'wishlist',
              'volunteer',
            ])
          )
          .optional()
      )
      .optional(),
    // Filter options - validate array elements after splitting
    status: z
      .string()
      .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.string().min(1)).optional())
      .optional(),
    priority: z
      .string()
      .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.enum(['high', 'medium', 'low'])).optional())
      .optional(),
    wishlistStatus: z
      .string()
      .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.enum(['pending', 'approved', 'rejected', 'added'])).optional())
      .optional(),
    // Date range
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    // Count range
    minCount: z.coerce.number().int().nonnegative().optional(),
    maxCount: z.coerce.number().int().positive().optional(),
    // Host filter - validate array elements
    hostNames: z
      .string()
      .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.string().min(1)).optional())
      .optional(),
  })
  .refine(
    (data) => {
      // Validate that minCount <= maxCount when both are provided
      if (data.minCount !== undefined && data.maxCount !== undefined) {
        return data.minCount <= data.maxCount;
      }
      return true;
    },
    {
      message: 'minCount must be less than or equal to maxCount',
      path: ['minCount'],
    }
  )
  .refine(
    (data) => {
      // Validate that startDate <= endDate when both are provided
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['startDate'],
    }
  );

const wishlistSearchSchema = z.object({
  // Allow empty query - both q and query are truly optional
  q: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50).optional(),
  status: z
    .string()
    .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.enum(['pending', 'approved', 'rejected', 'added'])).optional())
    .optional(),
  priority: z
    .string()
    .transform((val) => val.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.enum(['high', 'medium', 'low'])).optional())
    .optional(),
});

const suggestionsSchema = z.object({
  // Allow empty query - both q and query are truly optional
  q: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().positive().max(20).default(10).optional(),
});

const popularSearchesSchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(10).optional(),
});

// Create search router
const searchRouter = Router();

/**
 * GET /api/search
 * Global search across all entities with advanced filtering
 */
searchRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate query parameters
    const validation = globalSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Global search request', {
      userId: req.user.id,
      query,
      types: params.types,
      limit: params.limit,
    });

    // Build filters
    const filters: any = {
      searchTypes: params.types,
      status: params.status,
      priority: params.priority,
      wishlistStatus: params.wishlistStatus,
      minCount: params.minCount,
      maxCount: params.maxCount,
      hostNames: params.hostNames,
    };

    // Add date range if provided
    if (params.startDate && params.endDate) {
      filters.dateRange = {
        start: params.startDate,
        end: params.endDate,
      };
    }

    // Execute search
    const results = await searchService.globalSearch(
      query,
      filters,
      params.limit || 100
    );

    logger.info('Global search completed', {
      userId: req.user.id,
      query,
      totalResults: results.summary.total,
    });

    res.json(results);
  } catch (error) {
    logger.error('Global search failed', error);
    res.status(500).json({
      error: 'Search failed',
      message: 'An error occurred while performing the search',
    });
  }
});

/**
 * GET /api/search/collections
 * Search sandwich collections specifically
 */
searchRouter.get('/collections', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = globalSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Collection search request', { userId: req.user.id, query });

    const filters: any = {};
    if (params.startDate && params.endDate) {
      filters.dateRange = { start: params.startDate, end: params.endDate };
    }
    if (params.minCount) filters.minCount = params.minCount;
    if (params.maxCount) filters.maxCount = params.maxCount;
    if (params.hostNames) filters.hostNames = params.hostNames;

    const results = await searchService.searchCollections(
      query,
      filters,
      params.limit || 50
    );

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Collection search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/hosts
 * Search hosts specifically
 */
searchRouter.get('/hosts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = globalSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Host search request', { userId: req.user.id, query });

    const filters: any = {};
    if (params.status) filters.status = params.status;

    const results = await searchService.searchHosts(
      query,
      filters,
      params.limit || 50
    );

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Host search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/projects
 * Search projects specifically
 */
searchRouter.get('/projects', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = globalSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Project search request', { userId: req.user.id, query });

    const filters: any = {};
    if (params.status) filters.status = params.status;

    const results = await searchService.searchProjects(
      query,
      filters,
      params.limit || 50
    );

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Project search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/wishlist
 * Search wishlist suggestions with filtering
 */
searchRouter.get('/wishlist', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = wishlistSearchSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Wishlist search request', {
      userId: req.user.id,
      query,
      status: params.status,
      priority: params.priority,
    });

    const results = await searchService.searchWishlistSuggestions(
      query,
      {
        wishlistStatus: params.status,
        priority: params.priority,
      },
      params.limit || 50
    );

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Wishlist search failed', error);
    res.status(500).json({
      error: 'Search failed',
      message: 'An error occurred while searching wishlist suggestions',
    });
  }
});

/**
 * GET /api/search/volunteers
 * Search volunteers specifically
 */
searchRouter.get('/volunteers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = suggestionsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Volunteer search request', { userId: req.user.id, query });

    const results = await searchService.searchVolunteers(query, params.limit || 50);

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Volunteer search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/recipients
 * Search recipients specifically
 */
searchRouter.get('/recipients', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = suggestionsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid search parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Recipient search request', { userId: req.user.id, query });

    const results = await searchService.searchRecipients(query, params.limit || 50);

    res.json({ results, total: results.length });
  } catch (error) {
    logger.error('Recipient search failed', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/suggestions
 * Get quick search suggestions for autocomplete
 */
searchRouter.get('/suggestions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = suggestionsSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const query = params.q || params.query || '';

    logger.info('Search suggestions request', { userId: req.user.id, query });

    const suggestions = await searchService.getQuickSuggestions(
      query,
      params.limit || 10
    );

    res.json({ suggestions });
  } catch (error) {
    logger.error('Search suggestions failed', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: 'An error occurred while fetching suggestions',
    });
  }
});

/**
 * GET /api/search/popular
 * Get popular/trending search terms
 */
searchRouter.get('/popular', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = popularSearchesSchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid parameters',
        details: validation.error.issues,
      });
    }

    const params = validation.data;
    const limit = params.limit || 10;

    logger.info('Popular searches request', { userId: req.user.id, limit });

    const popularSearches = await searchService.getPopularSearches(limit);

    res.json({ searches: popularSearches });
  } catch (error) {
    logger.error('Popular searches failed', error);
    res.status(500).json({
      error: 'Failed to get popular searches',
    });
  }
});

/**
 * GET /api/search/health
 * Health check endpoint for search service
 */
searchRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    // Perform a real database query to verify service connectivity
    // Use a small limit to minimize performance impact
    const testResult = await searchService.searchCollections('', {}, 1);

    // Verify the query executed successfully (returns array, even if empty)
    const operational = Array.isArray(testResult);

    res.json({
      status: operational ? 'healthy' : 'unhealthy',
      service: 'search',
      timestamp: new Date().toISOString(),
      operational,
      details: {
        dbConnected: operational,
        testQuery: 'searchCollections',
      },
    });
  } catch (error) {
    logger.error('Search health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'search',
      timestamp: new Date().toISOString(),
      operational: false,
      error: 'Service unavailable',
      details: {
        dbConnected: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

export default searchRouter;
