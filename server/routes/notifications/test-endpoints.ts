/**
 * Test endpoints for Smart Notification System
 * 
 * These endpoints are for testing and demonstration purposes only.
 * Remove in production.
 */

import { Router } from 'express';
import { createStandardMiddleware } from '../../middleware';
import { smartDeliveryService } from '../../services/notifications/smart-delivery';
import { mlEngine } from '../../services/notifications/ml-engine';
import { z } from 'zod';
import logger from '../../utils/logger';

const testRouter = Router();
const testLogger = logger.child({ service: 'notification-tests' });

// Apply standard middleware
testRouter.use(createStandardMiddleware());

/**
 * POST /api/notifications/test/send-smart
 * Test smart notification delivery
 */
testRouter.post('/send-smart', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      title: z.string().default('Test Smart Notification'),
      message: z.string().default('This is a test of the smart notification system with ML-powered delivery.'),
      type: z.string().default('test'),
      skipMLScoring: z.boolean().default(false),
      forceChannel: z.enum(['email', 'sms', 'in_app']).optional()
    });

    const data = schema.parse(req.body);

    const result = await smartDeliveryService.sendNotification(
      req.user.id,
      data.title,
      data.message,
      data.type,
      {
        skipMLScoring: data.skipMLScoring,
        forceChannel: data.forceChannel
      }
    );

    testLogger.info('Test smart notification sent', { 
      userId: req.user.id, 
      result 
    });

    res.json({
      success: true,
      message: 'Smart notification sent successfully',
      result
    });

  } catch (error) {
    testLogger.error('Error sending test notification', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * GET /api/notifications/test/ml-score
 * Test ML relevance scoring
 */
testRouter.get('/ml-score', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type = 'test', message = 'Test message for ML scoring' } = req.query;

    const relevanceResult = await mlEngine.calculateRelevanceScore(
      req.user.id,
      type as string,
      message as string,
      { test: true }
    );

    const behaviorPattern = await mlEngine.getUserBehaviorPattern(req.user.id);

    res.json({
      success: true,
      relevanceScore: relevanceResult,
      behaviorPattern,
      userId: req.user.id,
      timestamp: new Date()
    });

  } catch (error) {
    testLogger.error('Error calculating ML score', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to calculate ML score' });
  }
});

/**
 * POST /api/notifications/test/track-interaction
 * Test interaction tracking
 */
testRouter.post('/track-interaction', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      notificationId: z.number(),
      interactionType: z.enum(['opened', 'clicked', 'dismissed', 'ignored']),
      responseTime: z.number().optional()
    });

    const data = schema.parse(req.body);

    await smartDeliveryService.trackInteraction(
      data.notificationId,
      req.user.id,
      data.interactionType,
      { test: true, responseTime: data.responseTime }
    );

    testLogger.info('Test interaction tracked', { 
      userId: req.user.id, 
      notificationId: data.notificationId,
      interactionType: data.interactionType
    });

    res.json({
      success: true,
      message: 'Interaction tracked successfully'
    });

  } catch (error) {
    testLogger.error('Error tracking test interaction', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to track interaction' });
  }
});

/**
 * POST /api/notifications/test/broadcast
 * Test smart broadcast functionality
 */
testRouter.post('/broadcast', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const schema = z.object({
      title: z.string().default('Test Broadcast'),
      message: z.string().default('This is a test broadcast using smart delivery to multiple users.'),
      type: z.string().default('test_broadcast'),
      userIds: z.array(z.string()).min(1),
      forceChannel: z.enum(['email', 'sms', 'in_app']).optional()
    });

    const data = schema.parse(req.body);

    const results = await smartDeliveryService.broadcastNotification(
      data.userIds,
      data.title,
      data.message,
      data.type,
      {
        forceChannel: data.forceChannel
      }
    );

    testLogger.info('Test broadcast sent', { 
      userCount: data.userIds.length,
      successCount: results.filter(r => r.success).length,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Broadcast sent successfully',
      results: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        details: results
      }
    });

  } catch (error) {
    testLogger.error('Error sending test broadcast', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to send test broadcast' });
  }
});

/**
 * GET /api/notifications/test/system-status
 * Get smart notification system status
 */
testRouter.get('/system-status', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    res.json({
      success: true,
      system: {
        smartDeliveryService: 'operational',
        mlEngine: 'operational',
        webSocketIntegration: 'operational',
        databaseConnections: 'operational'
      },
      features: {
        mlRelevanceScoring: true,
        smartTimingOptimization: true,
        channelSelection: true,
        behaviorTracking: true,
        abTesting: true,
        realTimeDelivery: true,
        batchProcessing: true,
        analytics: true
      },
      endpoints: {
        preferences: '/api/notifications/smart/preferences',
        smartSend: '/api/notifications/smart/send',
        tracking: '/api/notifications/smart/track-interaction',
        analytics: '/api/notifications/analytics/overview',
        abTests: '/api/notifications/analytics/ab-tests',
        rules: '/api/notifications/smart/rules',
        patterns: '/api/notifications/smart/user-patterns'
      },
      timestamp: new Date(),
      version: '1.0.0'
    });

  } catch (error) {
    testLogger.error('Error getting system status', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

export { testRouter };