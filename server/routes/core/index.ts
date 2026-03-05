import { Router } from 'express';
import { CoreService } from '../../services/core';
import { runWeeklyMonitoring } from '../../weekly-monitoring';
import {
  createPublicMiddleware,
  createStandardMiddleware,
  createErrorHandler,
} from '../../middleware';
import { logger } from '../../utils/production-safe-logger';

const router = Router();

// Apply error handling for this module
const errorHandler = createErrorHandler('core');

/**
 * Core Routes - Health checks and system monitoring
 */

// Basic health check endpoint for deployment monitoring (public - no auth required)
router.get('/health', ...createPublicMiddleware(), (req, res) => {
  try {
    const healthData = CoreService.getBasicHealth();
    res.status(200).json(healthData);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Health check failed' });
  }
});

// System health check with performance stats (authenticated)
router.get(
  '/system/health',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      const healthData = CoreService.getSystemHealth();
      res.json(healthData);
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Health check failed' });
    }
  }
);

// Weekly monitoring endpoints (all require authentication)
router.get(
  '/monitoring/weekly-status/:weeksAgo',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      const weeksAgo = parseInt(req.params.weeksAgo, 10) || 0;
      const submissionStatus = await CoreService.getWeeklyMonitoringStatus(weeksAgo);
      res.json(submissionStatus);
    } catch (error) {
      logger.error('Error checking weekly submissions:', error);
      res.status(500).json({ error: 'Failed to check weekly submissions' });
    }
  }
);

// Legacy route for backward compatibility (defaults to current week)
router.get(
  '/monitoring/weekly-status',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      const submissionStatus = await CoreService.getWeeklyMonitoringStatus(0);
      res.json(submissionStatus);
    } catch (error) {
      logger.error('Error checking weekly submissions:', error);
      res.status(500).json({ error: 'Failed to check weekly submissions' });
    }
  }
);

router.get(
  '/monitoring/stats',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      const stats = await CoreService.getMonitoringStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting monitoring stats:', error);
      res.status(500).json({ error: 'Failed to get monitoring stats' });
    }
  }
);

router.post(
  '/monitoring/check-now',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      await runWeeklyMonitoring();
      res.json({ success: true, message: 'Weekly monitoring check completed' });
    } catch (error) {
      logger.error('Error running weekly monitoring:', error);
      res.status(500).json({ error: 'Failed to run weekly monitoring' });
    }
  }
);

// Project data status check (authenticated)
router.get(
  '/project-data/status',
  ...createStandardMiddleware(),
  async (req, res) => {
    try {
      const status = await CoreService.getProjectDataStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting project data status:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get project data status',
        error: error.message,
      });
    }
  }
);

// Apply error handler at the end
router.use(errorHandler);

export default router;
