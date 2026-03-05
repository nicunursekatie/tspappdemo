import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { QueryOptimizer } from '../performance/query-optimizer';
import { CacheManager } from '../performance/cache-manager';
import { logger } from '../utils/production-safe-logger';

export function createPerformanceRouter(deps: RouterDependencies) {
  const router = Router();

  // Performance health check endpoint
  router.get('/health', async (req, res) => {
    try {
      const health = await QueryOptimizer.performHealthCheck();
      const cacheStats = CacheManager.getStats();

      res.json({
        database: health,
        cache: cacheStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Performance health check failed:', error);
      res.status(500).json({
        error: 'Failed to get performance metrics',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Database optimization endpoint
  router.post('/optimize', async (req, res) => {
    try {
      const { action } = req.body;

      if (action === 'create_indexes') {
        const results = await QueryOptimizer.createOptimalIndexes();
        res.json({
          message: 'Index creation completed',
          results,
          timestamp: new Date().toISOString(),
        });
      } else if (action === 'analyze_queries') {
        const suggestions =
          await QueryOptimizer.analyzeAndSuggestOptimizations();
        res.json({
          message: 'Query analysis completed',
          suggestions,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      logger.error('Performance optimization failed:', error);
      res.status(500).json({
        error: 'Failed to perform optimization',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Cache management endpoints
  router.delete('/cache/:cacheName?', (req, res) => {
    try {
      const { cacheName } = req.params;
      const { pattern } = req.query;

      if (cacheName) {
        CacheManager.invalidate(cacheName, pattern as string);
        res.json({
          message: `Cache ${cacheName} invalidated`,
          pattern: pattern || 'all',
        });
      } else {
        // Clear all caches
        [
          'collections',
          'hosts',
          'projects',
          'stats',
          'search',
          'users',
        ].forEach((name) => {
          CacheManager.invalidate(name);
        });
        res.json({ message: 'All caches cleared' });
      }
    } catch (error) {
      logger.error('Cache invalidation failed:', error);
      res.status(500).json({ error: 'Failed to invalidate cache' });
    }
  });

  // Cache warming endpoint
  router.post('/cache/warm', async (req, res) => {
    try {
      await CacheManager.warmCaches();
      res.json({
        message: 'Cache warming completed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Cache warming failed:', error);
      res.status(500).json({ error: 'Failed to warm caches' });
    }
  });

  // Cache maintenance endpoint
  router.post('/cache/maintenance', (req, res) => {
    try {
      CacheManager.performMaintenance();
      const stats = CacheManager.getStats();
      res.json({
        message: 'Cache maintenance completed',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Cache maintenance failed:', error);
      res.status(500).json({ error: 'Failed to perform cache maintenance' });
    }
  });

  // Performance monitoring dashboard endpoint
  router.get('/dashboard', async (req, res) => {
    try {
      const [
        connectionPool,
        slowQueries,
        indexUsage,
        tableStats,
        optimizationSuggestions,
      ] = await Promise.all([
        QueryOptimizer.getConnectionPoolStatus(),
        QueryOptimizer.getSlowQueries(),
        QueryOptimizer.getIndexUsage(),
        QueryOptimizer.getTableStats(),
        QueryOptimizer.analyzeAndSuggestOptimizations(),
      ]);

      const cacheStats = CacheManager.getStats();

      res.json({
        database: {
          connectionPool,
          slowQueries,
          indexUsage,
          tableStats,
          optimizationSuggestions,
        },
        cache: cacheStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Performance dashboard failed:', error);
      res.status(500).json({
        error: 'Failed to get performance dashboard data',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
