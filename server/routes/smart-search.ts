/**
 * Smart Search API Routes
 * Intelligent app-wide navigation and feature discovery
 */

import { Router } from 'express';
import { SmartSearchService } from '../services/smart-search.service';
import type { SmartSearchQuery, SmartSearchResponse } from '../types/smart-search';
import type { SessionUser } from '../types/express';
import { storage } from '../storage';
import { safeAssign, validateNoPrototypePollution } from '../utils/object-utils';
import { logger } from '../utils/production-safe-logger';

interface ExtendedSmartSearchQuery extends SmartSearchQuery {
  userPermissions?: string[];
  userId?: string;
  includeMessages?: boolean;
}

export function createSmartSearchRouter(searchService: SmartSearchService) {
  const router = Router();

  /**
   * POST /api/smart-search/query
   * Perform intelligent search (includes messages/emails)
   */
  router.post('/query', async (req, res) => {
    try {
      const startTime = Date.now();
      const sessionUser = req.user as SessionUser | undefined;
      const query: ExtendedSmartSearchQuery = {
        query: req.body.query || '',
        limit: req.body.limit || 10,
        userRole: sessionUser?.role || 'user',
        userPermissions: sessionUser?.permissions || [],
        userId: sessionUser?.id, // Include userId for message search
        includeMessages: req.body.includeMessages !== false, // Default to true
      };

      if (!query.query.trim()) {
        return res.json({
          results: [],
          queryTime: 0,
          usedAI: false
        });
      }

      // Check common questions first
      const commonAnswer = await searchService.checkCommonQuestions(query.query);
      if (commonAnswer) {
        const response: SmartSearchResponse = {
          results: [{
            feature: commonAnswer,
            score: 1.0,
            matchType: 'exact'
          }],
          queryTime: Date.now() - startTime,
          usedAI: false
        };
        return res.json(response);
      }

      // Use hybrid search for best results
      const searchData = await searchService.hybridSearch(query);

      const response: SmartSearchResponse = {
        results: searchData.results,
        queryTime: Date.now() - startTime,
        usedAI: searchData.usedAI
      };

      res.json(response);
    } catch (error) {
      logger.error('Smart search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * POST /api/smart-search/fuzzy
   * Perform fast fuzzy search (for real-time autocomplete)
   * Includes messages/emails when user is authenticated
   */
  router.post('/fuzzy', async (req, res) => {
    try {
      const startTime = Date.now();
      const sessionUser = req.user as SessionUser | undefined;
      const query: ExtendedSmartSearchQuery = {
        query: req.body.query || '',
        limit: req.body.limit || 8,
        userRole: sessionUser?.role || 'user',
        userPermissions: sessionUser?.permissions || [],
        userId: sessionUser?.id, // Include userId for message search
        includeMessages: req.body.includeMessages !== false, // Default to true
      };

      const results = await searchService.fuzzySearch(query);

      const response: SmartSearchResponse = {
        results,
        queryTime: Date.now() - startTime,
        usedAI: false
      };

      res.json(response);
    } catch (error) {
      logger.error('Fuzzy search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * GET /api/smart-search/features
   * Get all searchable features
   */
  router.get('/features', async (req, res) => {
    try {
      const features = await searchService.getAllFeatures();
      res.json({ features });
    } catch (error) {
      logger.error('Get features error:', error);
      res.status(500).json({ error: 'Failed to get features' });
    }
  });

  /**
   * POST /api/smart-search/regenerate-embeddings
   * Regenerate all embeddings (admin only) - legacy endpoint
   */
  router.post('/regenerate-embeddings', async (req, res) => {
    try {
      // Check if user is admin or super_admin
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await searchService.regenerateEmbeddings();
      res.json({ success: true, message: 'Embeddings regenerated successfully' });
    } catch (error) {
      logger.error('Regenerate embeddings error:', error);
      res.status(500).json({ error: 'Failed to regenerate embeddings' });
    }
  });

  /**
   * POST /api/smart-search/regenerate-embeddings-advanced
   * Regenerate embeddings with options (admin only)
   */
  router.post('/regenerate-embeddings-advanced', async (req, res) => {
    try {
      // Check if user is admin or super_admin
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const options = req.body;

      // Validate options
      const allowedModes = ['all', 'missing', 'failed', 'selected'];
      if (
        !options ||
        typeof options.mode !== 'string' ||
        !allowedModes.includes(options.mode) ||
        (options.mode === 'selected' && (!Array.isArray(options.featureIds) || options.featureIds.length === 0))
      ) {
        return res.status(400).json({
          error: "Invalid options: 'mode' must be one of 'all', 'missing', 'failed', 'selected'. If 'mode' is 'selected', 'featureIds' must be a non-empty array."
        });
      }

      // Start regeneration in background
      searchService.regenerateEmbeddingsWithOptions(options)
        .catch(err => logger.error('Background regeneration error:', err));

      res.json({ success: true, message: 'Regeneration started' });
    } catch (error) {
      logger.error('Regenerate embeddings error:', error);
      res.status(500).json({ error: 'Failed to start regeneration' });
    }
  });

  /**
   * GET /api/smart-search/regeneration-progress
   * Get regeneration progress (admin only)
   */
  router.get('/regeneration-progress', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const progress = searchService.getRegenerationProgress();
      res.json(progress);
    } catch (error) {
      logger.error('Get progress error:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  /**
   * POST /api/smart-search/pause-regeneration
   * Pause ongoing regeneration (admin only)
   */
  router.post('/pause-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.pauseRegeneration();
      res.json({ success: true });
    } catch (error) {
      logger.error('Pause error:', error);
      res.status(500).json({ error: 'Failed to pause' });
    }
  });

  /**
   * POST /api/smart-search/resume-regeneration
   * Resume paused regeneration (admin only)
   */
  router.post('/resume-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.resumeRegeneration();
      res.json({ success: true });
    } catch (error) {
      logger.error('Resume error:', error);
      res.status(500).json({ error: 'Failed to resume' });
    }
  });

  /**
   * POST /api/smart-search/stop-regeneration
   * Stop ongoing regeneration (admin only)
   */
  router.post('/stop-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.stopRegeneration();
      res.json({ success: true });
    } catch (error) {
      logger.error('Stop error:', error);
      res.status(500).json({ error: 'Failed to stop' });
    }
  });

  /**
   * POST /api/smart-search/cost-estimate
   * Get cost estimate for regeneration (admin only)
   */
  router.post('/cost-estimate', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const options = req.body;
      const estimate = await searchService.getCostEstimate(options);
      res.json(estimate);
    } catch (error) {
      logger.error('Cost estimate error:', error);
      res.status(500).json({ error: 'Failed to estimate cost' });
    }
  });

  /**
   * GET /api/smart-search/analytics-summary
   * Get analytics summary (admin only)
   */
  router.get('/analytics-summary', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const summary = await searchService.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      logger.error('Analytics summary error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  /**
   * GET /api/smart-search/quality-metrics
   * Get embedding quality metrics (admin only)
   */
  router.get('/quality-metrics', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const metrics = await searchService.getEmbeddingQualityMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Quality metrics error:', error);
      res.status(500).json({ error: 'Failed to get quality metrics' });
    }
  });

  /**
   * POST /api/smart-search/test-search
   * Test search functionality (admin only)
   */
  router.post('/test-search', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { query, userRole } = req.body;
      if (typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query parameter must be a non-empty string' });
      }

      const result = await searchService.testSearch(query, userRole);
      res.json(result);
    } catch (error) {
      logger.error('Test search error:', error);
      res.status(500).json({ error: 'Failed to test search' });
    }
  });

  /**
   * POST /api/smart-search/feature
   * Add a new feature (admin only)
   */
  router.post('/feature', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate required fields
      const requiredFields = ['title', 'description', 'category', 'route', 'keywords'];
      const missingFields = requiredFields.filter(field => !(field in req.body));
      if (missingFields.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
      }

      const feature = await searchService.addFeature(req.body);
      res.json(feature);
    } catch (error) {
      logger.error('Add feature error:', error);
      res.status(500).json({ error: 'Failed to add feature' });
    }
  });

  /**
   * PUT /api/smart-search/feature/:id
   * Update a feature (admin only)
   */
  router.put('/feature/:id', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Validate against prototype pollution attempts
      try {
        validateNoPrototypePollution(req.body);
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid request: prohibited property names detected'
        });
      }

      // Validate and sanitize update payload (using safe assignment)
      const allowedFields = ['title', 'description', 'category', 'route', 'keywords', 'requiredPermissions'];
      const updatePayload: Record<string, any> = {};
      safeAssign(updatePayload, req.body, allowedFields);

      // Prevent attempts to update system fields
      if ('id' in req.body) {
        return res.status(400).json({ error: 'Cannot update system-generated field: id' });
      }

      // Basic type validation
      if ('title' in updatePayload && typeof updatePayload.title !== 'string') {
        return res.status(400).json({ error: 'Invalid type for title' });
      }
      if ('description' in updatePayload && typeof updatePayload.description !== 'string') {
        return res.status(400).json({ error: 'Invalid type for description' });
      }
      if ('category' in updatePayload && typeof updatePayload.category !== 'string') {
        return res.status(400).json({ error: 'Invalid type for category' });
      }
      if ('route' in updatePayload && typeof updatePayload.route !== 'string') {
        return res.status(400).json({ error: 'Invalid type for route' });
      }
      if ('keywords' in updatePayload && !Array.isArray(updatePayload.keywords)) {
        return res.status(400).json({ error: 'Invalid type for keywords' });
      }

      const feature = await searchService.updateFeature(req.params.id, updatePayload);
      if (!feature) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      res.json(feature);
    } catch (error) {
      logger.error('Update feature error:', error);
      res.status(500).json({ error: 'Failed to update feature' });
    }
  });

  /**
   * DELETE /api/smart-search/feature/:id
   * Delete a feature (admin only)
   */
  router.delete('/feature/:id', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const success = await searchService.deleteFeature(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Delete feature error:', error);
      res.status(500).json({ error: 'Failed to delete feature' });
    }
  });

  /**
   * GET /api/smart-search/export
   * Export features (admin only)
   */
  router.get('/export', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const features = await searchService.exportFeatures();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=smart-search-features.json');
      res.json(features);
    } catch (error) {
      logger.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export features' });
    }
  });

  /**
   * POST /api/smart-search/import
   * Import features (admin only)
   */
  router.post('/import', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { features, mode } = req.body;

      // Validate features is an array
      if (!Array.isArray(features)) {
        return res.status(400).json({ error: '`features` must be an array' });
      }

      // Validate mode if provided
      if (mode && mode !== 'replace' && mode !== 'merge') {
        return res.status(400).json({ error: "`mode` must be either 'replace' or 'merge'" });
      }

      await searchService.importFeatures(features, mode || 'merge');
      res.json({ success: true, message: `Imported ${features.length} features` });
    } catch (error) {
      logger.error('Import error:', error);
      res.status(500).json({ error: 'Failed to import features' });
    }
  });

  /**
   * POST /api/smart-search/analytics
   * Track search analytics
   */
  router.post('/analytics', async (req, res) => {
    try {
      // Log search analytics for learning and ML improvements
      const sessionUser = req.user as SessionUser | undefined;

      await storage.logSearchAnalytics({
        query: req.body.query || '',
        resultId: req.body.resultId || null,
        clicked: req.body.clicked || false,
        userId: sessionUser?.id || null,
        userRole: sessionUser?.role || null,
        usedAI: req.body.usedAI || false,
        resultsCount: req.body.resultsCount || 0,
        queryTime: req.body.queryTime || 0,
      });

      // Also record in service for internal analytics
      await searchService.recordAnalytics({
        query: req.body.query || '',
        resultId: req.body.resultId || null,
        clicked: req.body.clicked || false,
        timestamp: new Date(),
        userId: sessionUser?.id
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Analytics error:', error);
      res.status(500).json({ error: 'Failed to log analytics' });
    }
  });

  return router;
}
