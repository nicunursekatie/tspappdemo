/**
 * Notification Analytics API Routes
 * 
 * Provides comprehensive analytics and A/B testing for notifications:
 * - Performance metrics and insights
 * - A/B test management and results
 * - Batch processing for ML model updates
 * - Aggregated analytics for business intelligence
 */

import { Router } from 'express';
import { eq, desc, and, sql, or, gte, lte, count, avg, sum } from 'drizzle-orm';
import { db } from '../../db';
import { 
  notificationHistory,
  notificationAnalytics,
  notificationABTests,
  userNotificationPatterns,
  users,
  notifications
} from '../../../shared/schema';
import { 
  insertNotificationAnalyticsSchema,
  insertNotificationABTestsSchema 
} from '../../../shared/schema';
import { createStandardMiddleware } from '../../middleware';
import { z } from 'zod';
import logger from '../../utils/logger';

const analyticsRouter = Router();
const analyticsLogger = logger.child({ service: 'notification-analytics' });

// Apply standard middleware
analyticsRouter.use(createStandardMiddleware());

/**
 * GET /api/notifications/analytics/overview
 * Get comprehensive notification analytics overview
 */
analyticsRouter.get('/overview', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      period = '30d',
      startDate,
      endDate 
    } = req.query;

    // Calculate date range
    let dateFilter;
    if (startDate && endDate) {
      dateFilter = and(
        gte(notificationHistory.deliveredAt, new Date(startDate as string)),
        lte(notificationHistory.deliveredAt, new Date(endDate as string))
      );
    } else {
      const periodDays = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
      const start = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      dateFilter = gte(notificationHistory.deliveredAt, start);
    }

    // Get aggregate statistics
    const [
      totalStats,
      channelStats,
      typeStats,
      dailyTrends,
      topPerformers,
      userEngagement
    ] = await Promise.all([
      // Total statistics
      db
        .select({
          totalSent: count(),
          totalOpened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
          totalClicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
          totalDismissed: sum(sql`CASE WHEN dismissed_at IS NOT NULL THEN 1 ELSE 0 END`),
          avgMlScore: avg(notificationHistory.mlScore)
        })
        .from(notificationHistory)
        .where(dateFilter),

      // Channel performance
      db
        .select({
          channel: notificationHistory.channel,
          sent: count(),
          opened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
          clicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
          avgMlScore: avg(notificationHistory.mlScore)
        })
        .from(notificationHistory)
        .where(dateFilter)
        .groupBy(notificationHistory.channel),

      // Type performance
      db
        .select({
          type: notificationHistory.notificationType,
          sent: count(),
          opened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
          clicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
          avgMlScore: avg(notificationHistory.mlScore)
        })
        .from(notificationHistory)
        .where(dateFilter)
        .groupBy(notificationHistory.notificationType),

      // Daily trends
      db
        .select({
          date: sql`DATE(delivered_at)`,
          sent: count(),
          opened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
          clicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`)
        })
        .from(notificationHistory)
        .where(dateFilter)
        .groupBy(sql`DATE(delivered_at)`)
        .orderBy(sql`DATE(delivered_at)`),

      // Top performing notifications
      db
        .select({
          notificationId: notificationHistory.notificationId,
          title: notifications.title,
          type: notificationHistory.notificationType,
          channel: notificationHistory.channel,
          sent: count(),
          opened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
          clicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
          mlScore: avg(notificationHistory.mlScore)
        })
        .from(notificationHistory)
        .leftJoin(notifications, eq(notificationHistory.notificationId, notifications.id))
        .where(dateFilter)
        .groupBy(notificationHistory.notificationId, notifications.title, notificationHistory.notificationType, notificationHistory.channel)
        .orderBy(desc(sql`CASE WHEN COUNT(*) > 0 THEN SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END)::float / COUNT(*) ELSE 0 END`))
        .limit(10),

      // User engagement summary
      db
        .select({
          userId: userNotificationPatterns.userId,
          firstName: users.firstName,
          lastName: users.lastName,
          engagementRate: userNotificationPatterns.engagementRate,
          averageResponseTime: userNotificationPatterns.averageResponseTime,
          optimalFrequency: userNotificationPatterns.optimalFrequency,
          lastUpdated: userNotificationPatterns.lastUpdated
        })
        .from(userNotificationPatterns)
        .leftJoin(users, eq(userNotificationPatterns.userId, users.id))
        .orderBy(desc(userNotificationPatterns.engagementRate))
        .limit(20)
    ]);

    // Calculate derived metrics
    const overview = {
      summary: {
        totalSent: parseInt(totalStats[0]?.totalSent as string) || 0,
        totalOpened: parseInt(totalStats[0]?.totalOpened as string) || 0,
        totalClicked: parseInt(totalStats[0]?.totalClicked as string) || 0,
        totalDismissed: parseInt(totalStats[0]?.totalDismissed as string) || 0,
        averageMlScore: parseFloat(totalStats[0]?.avgMlScore as string) || 0,
        openRate: 0,
        clickRate: 0,
        dismissRate: 0
      },
      channelPerformance: channelStats.map(stat => ({
        channel: stat.channel,
        sent: parseInt(stat.sent as string),
        opened: parseInt(stat.opened as string),
        clicked: parseInt(stat.clicked as string),
        openRate: parseInt(stat.sent as string) > 0 ? 
          parseInt(stat.opened as string) / parseInt(stat.sent as string) : 0,
        clickRate: parseInt(stat.sent as string) > 0 ? 
          parseInt(stat.clicked as string) / parseInt(stat.sent as string) : 0,
        averageMlScore: parseFloat(stat.avgMlScore as string) || 0
      })),
      typePerformance: typeStats.map(stat => ({
        type: stat.type,
        sent: parseInt(stat.sent as string),
        opened: parseInt(stat.opened as string),
        clicked: parseInt(stat.clicked as string),
        openRate: parseInt(stat.sent as string) > 0 ? 
          parseInt(stat.opened as string) / parseInt(stat.sent as string) : 0,
        clickRate: parseInt(stat.sent as string) > 0 ? 
          parseInt(stat.clicked as string) / parseInt(stat.sent as string) : 0,
        averageMlScore: parseFloat(stat.avgMlScore as string) || 0
      })),
      dailyTrends: dailyTrends.map(day => ({
        date: day.date,
        sent: parseInt(day.sent as string),
        opened: parseInt(day.opened as string),
        clicked: parseInt(day.clicked as string),
        openRate: parseInt(day.sent as string) > 0 ? 
          parseInt(day.opened as string) / parseInt(day.sent as string) : 0,
        clickRate: parseInt(day.sent as string) > 0 ? 
          parseInt(day.clicked as string) / parseInt(day.sent as string) : 0
      })),
      topPerformers: topPerformers.map(notif => ({
        notificationId: notif.notificationId,
        title: notif.title,
        type: notif.type,
        channel: notif.channel,
        sent: parseInt(notif.sent as string),
        opened: parseInt(notif.opened as string),
        clicked: parseInt(notif.clicked as string),
        openRate: parseInt(notif.sent as string) > 0 ? 
          parseInt(notif.opened as string) / parseInt(notif.sent as string) : 0,
        clickRate: parseInt(notif.sent as string) > 0 ? 
          parseInt(notif.clicked as string) / parseInt(notif.sent as string) : 0,
        mlScore: parseFloat(notif.mlScore as string) || 0
      })),
      userEngagement: userEngagement.map(user => ({
        userId: user.userId,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        engagementRate: user.engagementRate || 0,
        averageResponseTime: user.averageResponseTime || 0,
        optimalFrequency: user.optimalFrequency || 0,
        lastUpdated: user.lastUpdated
      }))
    };

    // Calculate summary rates
    if (overview.summary.totalSent > 0) {
      overview.summary.openRate = overview.summary.totalOpened / overview.summary.totalSent;
      overview.summary.clickRate = overview.summary.totalClicked / overview.summary.totalSent;
      overview.summary.dismissRate = overview.summary.totalDismissed / overview.summary.totalSent;
    }

    res.json({
      success: true,
      analytics: overview,
      period: period as string,
      generatedAt: new Date()
    });

  } catch (error) {
    analyticsLogger.error('Error fetching analytics overview', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * POST /api/notifications/analytics/ab-test
 * Create a new A/B test for notifications
 */
analyticsRouter.post('/ab-test', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      notificationType: z.string().min(1),
      variants: z.array(z.object({
        name: z.string(),
        title: z.string(),
        message: z.string(),
        channel: z.string().optional(),
        metadata: z.object({}).optional()
      })).min(2).max(5),
      trafficSplit: z.array(z.number()).min(2).max(5),
      targetAudience: z.object({
        userIds: z.array(z.string()).optional(),
        roles: z.array(z.string()).optional(),
        criteria: z.object({}).optional()
      }).optional(),
      duration: z.number().min(1).max(90), // days
      successMetric: z.enum(['open_rate', 'click_rate', 'engagement_time']).default('click_rate')
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid A/B test data',
        details: validationResult.error.errors
      });
    }

    const data = validationResult.data;

    // Validate traffic split sums to 100%
    const totalSplit = data.trafficSplit.reduce((sum, split) => sum + split, 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      return res.status(400).json({ error: 'Traffic split must sum to 100%' });
    }

    // Create A/B test
    const result = await db
      .insert(notificationABTests)
      .values({
        name: data.name,
        description: data.description,
        notificationType: data.notificationType,
        variants: data.variants,
        trafficSplit: data.trafficSplit,
        targetAudience: data.targetAudience || {},
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + data.duration * 24 * 60 * 60 * 1000),
        successMetric: data.successMetric,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    analyticsLogger.info('A/B test created', { 
      testId: result[0].id, 
      name: data.name,
      userId: req.user.id 
    });

    res.status(201).json({
      success: true,
      abTest: result[0]
    });

  } catch (error) {
    analyticsLogger.error('Error creating A/B test', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create A/B test' });
  }
});

/**
 * GET /api/notifications/analytics/ab-tests
 * Get all A/B tests with results
 */
analyticsRouter.get('/ab-tests', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, limit = 50 } = req.query;

    let query = db.select().from(notificationABTests);

    if (status) {
      query = query.where(eq(notificationABTests.status, status as string));
    }

    const abTests = await query
      .orderBy(desc(notificationABTests.createdAt))
      .limit(parseInt(limit as string));

    // Get results for each test
    const testsWithResults = await Promise.all(
      abTests.map(async (test) => {
        try {
          // Get notification history for this A/B test
          const results = await db
            .select({
              variant: notificationHistory.abTestVariant,
              sent: count(),
              opened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
              clicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
              avgEngagementTime: avg(sql`EXTRACT(EPOCH FROM (COALESCE(clicked_at, opened_at, dismissed_at) - delivered_at))`)
            })
            .from(notificationHistory)
            .where(eq(notificationHistory.abTestId, test.id))
            .groupBy(notificationHistory.abTestVariant);

          const variantResults = results.map(result => ({
            variant: result.variant,
            sent: parseInt(result.sent as string),
            opened: parseInt(result.opened as string),
            clicked: parseInt(result.clicked as string),
            openRate: parseInt(result.sent as string) > 0 ? 
              parseInt(result.opened as string) / parseInt(result.sent as string) : 0,
            clickRate: parseInt(result.sent as string) > 0 ? 
              parseInt(result.clicked as string) / parseInt(result.sent as string) : 0,
            avgEngagementTime: parseFloat(result.avgEngagementTime as string) || 0
          }));

          // Determine winner based on success metric
          let winner = null;
          if (variantResults.length > 0) {
            winner = variantResults.reduce((best, current) => {
              const bestMetric = test.successMetric === 'open_rate' ? best.openRate :
                               test.successMetric === 'click_rate' ? best.clickRate :
                               best.avgEngagementTime;
              
              const currentMetric = test.successMetric === 'open_rate' ? current.openRate :
                                   test.successMetric === 'click_rate' ? current.clickRate :
                                   current.avgEngagementTime;

              return currentMetric > bestMetric ? current : best;
            });
          }

          return {
            ...test,
            results: variantResults,
            winner,
            totalParticipants: variantResults.reduce((sum, r) => sum + r.sent, 0),
            isComplete: new Date() > test.endDate
          };
        } catch (error) {
          analyticsLogger.error('Error getting A/B test results', { error, testId: test.id });
          return {
            ...test,
            results: [],
            winner: null,
            totalParticipants: 0,
            isComplete: new Date() > test.endDate
          };
        }
      })
    );

    res.json({
      success: true,
      abTests: testsWithResults
    });

  } catch (error) {
    analyticsLogger.error('Error fetching A/B tests', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch A/B tests' });
  }
});

/**
 * PATCH /api/notifications/analytics/ab-test/:id
 * Update A/B test status
 */
analyticsRouter.patch('/ab-test/:id', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: 'Invalid test ID' });
    }

    const schema = z.object({
      status: z.enum(['active', 'paused', 'completed', 'cancelled'])
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid status',
        details: validationResult.error.errors
      });
    }

    const { status } = validationResult.data;

    const result = await db
      .update(notificationABTests)
      .set({ 
        status,
        updatedAt: new Date(),
        ...(status === 'completed' && { endDate: new Date() })
      })
      .where(eq(notificationABTests.id, testId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'A/B test not found' });
    }

    analyticsLogger.info('A/B test status updated', { 
      testId,
      status,
      userId: req.user.id 
    });

    res.json({
      success: true,
      abTest: result[0]
    });

  } catch (error) {
    analyticsLogger.error('Error updating A/B test', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to update A/B test' });
  }
});

/**
 * POST /api/notifications/analytics/batch-process
 * Batch process ML model updates and analytics
 */
analyticsRouter.post('/batch-process', async (req, res) => {
  try {
    if (!req.user?.permissions?.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const schema = z.object({
      operations: z.array(z.enum([
        'update_user_patterns',
        'recalculate_ml_scores',
        'cleanup_old_data',
        'generate_insights'
      ])),
      batchSize: z.number().min(10).max(1000).default(100)
    });

    const validationResult = schema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid batch process data',
        details: validationResult.error.errors
      });
    }

    const { operations, batchSize } = validationResult.data;

    analyticsLogger.info('Starting batch processing', { operations, batchSize, userId: req.user.id });

    const results = {
      startTime: new Date(),
      operations: [] as any[]
    };

    // Process each operation
    for (const operation of operations) {
      const operationStart = Date.now();
      let result;

      try {
        switch (operation) {
          case 'update_user_patterns':
            result = await batchUpdateUserPatterns(batchSize);
            break;
          case 'recalculate_ml_scores':
            result = await batchRecalculateMLScores(batchSize);
            break;
          case 'cleanup_old_data':
            result = await batchCleanupOldData();
            break;
          case 'generate_insights':
            result = await batchGenerateInsights();
            break;
          default:
            result = { processed: 0, error: 'Unknown operation' };
        }

        results.operations.push({
          operation,
          duration: Date.now() - operationStart,
          result,
          success: true
        });

      } catch (error) {
        analyticsLogger.error('Batch operation failed', { operation, error });
        results.operations.push({
          operation,
          duration: Date.now() - operationStart,
          error: error.message,
          success: false
        });
      }
    }

    results.endTime = new Date();
    results.totalDuration = Date.now() - results.startTime.getTime();

    analyticsLogger.info('Batch processing completed', { 
      operations, 
      duration: results.totalDuration,
      userId: req.user.id 
    });

    res.json({
      success: true,
      results
    });

  } catch (error) {
    analyticsLogger.error('Error in batch processing', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to execute batch processing' });
  }
});

/**
 * Helper functions for batch processing
 */
async function batchUpdateUserPatterns(batchSize: number): Promise<any> {
  // Get users who need pattern updates (haven't been updated in 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const usersToUpdate = await db
    .select({ userId: users.id })
    .from(users)
    .leftJoin(userNotificationPatterns, eq(users.id, userNotificationPatterns.userId))
    .where(
      or(
        eq(userNotificationPatterns.userId, null),
        lte(userNotificationPatterns.lastUpdated, sevenDaysAgo)
      )
    )
    .limit(batchSize);

  const mlEngine = await import('../../services/notifications/ml-engine');
  
  let processed = 0;
  for (const user of usersToUpdate) {
    try {
      await mlEngine.mlEngine.getUserBehaviorPattern(user.userId);
      processed++;
    } catch (error) {
      analyticsLogger.error('Error updating user pattern', { userId: user.userId, error });
    }
  }

  return { processed, total: usersToUpdate.length };
}

async function batchRecalculateMLScores(batchSize: number): Promise<any> {
  // Get recent notifications without ML scores
  const recentNotifications = await db
    .select()
    .from(notificationHistory)
    .where(
      and(
        gte(notificationHistory.deliveredAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        eq(notificationHistory.mlScore, null)
      )
    )
    .limit(batchSize);

  const mlEngine = await import('../../services/notifications/ml-engine');
  
  let processed = 0;
  for (const notification of recentNotifications) {
    try {
      const score = await mlEngine.mlEngine.calculateRelevanceScore(
        notification.userId,
        notification.notificationType,
        '', // We don't have the content stored in history
        notification.metadata
      );

      await db
        .update(notificationHistory)
        .set({ 
          mlScore: score.score,
          mlFactors: score.factors
        })
        .where(eq(notificationHistory.id, notification.id));

      processed++;
    } catch (error) {
      analyticsLogger.error('Error recalculating ML score', { notificationId: notification.id, error });
    }
  }

  return { processed, total: recentNotifications.length };
}

async function batchCleanupOldData(): Promise<any> {
  // Clean up old notification history (older than 1 year)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  
  const deletedHistory = await db
    .delete(notificationHistory)
    .where(lte(notificationHistory.deliveredAt, oneYearAgo))
    .returning({ id: notificationHistory.id });

  // Clean up completed A/B tests older than 6 months
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  
  const deletedTests = await db
    .delete(notificationABTests)
    .where(
      and(
        lte(notificationABTests.endDate, sixMonthsAgo),
        eq(notificationABTests.status, 'completed')
      )
    )
    .returning({ id: notificationABTests.id });

  return { 
    deletedHistory: deletedHistory.length,
    deletedTests: deletedTests.length 
  };
}

async function batchGenerateInsights(): Promise<any> {
  // Generate aggregated analytics for the past day
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  const today = new Date(yesterday);
  today.setDate(today.getDate() + 1);

  // Check if insights already exist for yesterday
  const existingInsights = await db
    .select()
    .from(notificationAnalytics)
    .where(
      and(
        gte(notificationAnalytics.date, yesterday),
        lte(notificationAnalytics.date, today)
      )
    );

  if (existingInsights.length > 0) {
    return { insights: 0, message: 'Insights already generated for this date' };
  }

  // Calculate insights for yesterday
  const insights = await db
    .select({
      totalSent: count(),
      totalOpened: sum(sql`CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END`),
      totalClicked: sum(sql`CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END`),
      avgMlScore: avg(notificationHistory.mlScore)
    })
    .from(notificationHistory)
    .where(
      and(
        gte(notificationHistory.deliveredAt, yesterday),
        lte(notificationHistory.deliveredAt, today)
      )
    );

  if (insights[0] && parseInt(insights[0].totalSent as string) > 0) {
    await db.insert(notificationAnalytics).values({
      date: yesterday,
      totalSent: parseInt(insights[0].totalSent as string),
      totalOpened: parseInt(insights[0].totalOpened as string),
      totalClicked: parseInt(insights[0].totalClicked as string),
      openRate: parseInt(insights[0].totalOpened as string) / parseInt(insights[0].totalSent as string),
      clickRate: parseInt(insights[0].totalClicked as string) / parseInt(insights[0].totalSent as string),
      averageMlScore: parseFloat(insights[0].avgMlScore as string) || 0,
      metadata: {},
      createdAt: new Date()
    });

    return { insights: 1, date: yesterday };
  }

  return { insights: 0, message: 'No data to generate insights from' };
}

export { analyticsRouter };