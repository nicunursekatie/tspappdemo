import { Router } from 'express';
import { db } from '../db';
import { userActivityLogs } from '@shared/schema';
import { sql, desc, and, gte, eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { isAuthenticated } from '../auth';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Helper function to calculate date threshold
function getDateThreshold(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Get enhanced system-wide stats
router.get('/enhanced-stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const dateThreshold = getDateThreshold(days);

    // Total actions in timeframe
    const totalActionsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold));
    
    const totalActions = totalActionsResult[0]?.count || 0;

    // Unique users (total and active in timeframe)
    const activeUsersResult = await db
      .select({ count: sql<number>`count(distinct ${userActivityLogs.userId})::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold));
    
    const activeUsers = activeUsersResult[0]?.count || 0;

    // Active users last 24h
    const last24h = getDateThreshold(1);
    const activeUsers24hResult = await db
      .select({ count: sql<number>`count(distinct ${userActivityLogs.userId})::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, last24h));
    
    const activeUsersLast24h = activeUsers24hResult[0]?.count || 0;

    // Active users last 12h
    const last12h = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const activeUsers12hResult = await db
      .select({ count: sql<number>`count(distinct ${userActivityLogs.userId})::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, last12h));
    
    const activeUsersLast12h = activeUsers12hResult[0]?.count || 0;

    // Top sections by action count
    const topSections = await db
      .select({
        section: userActivityLogs.section,
        actions: sql<number>`count(*)::int`,
        usage: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(userActivityLogs.section)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Top features
    const topFeatures = await db
      .select({
        feature: userActivityLogs.feature,
        usage: sql<number>`count(*)::int`
      })
      .from(userActivityLogs)
      .where(and(
        gte(userActivityLogs.createdAt, dateThreshold),
        sql`${userActivityLogs.feature} IS NOT NULL`
      ))
      .groupBy(userActivityLogs.feature)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Daily active users
    const dailyActiveUsers = await db
      .select({
        date: sql<string>`date(${userActivityLogs.createdAt})`,
        users: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(sql`date(${userActivityLogs.createdAt})`)
      .orderBy(sql`date(${userActivityLogs.createdAt})`);

    const averageActionsPerUser = activeUsers > 0 ? Math.round(totalActions / activeUsers) : 0;

    res.json({
      totalUsers: activeUsers,
      activeUsers,
      activeUsersLast24h,
      activeUsersLast12h,
      totalActions,
      averageActionsPerUser,
      topSections: topSections || [],
      topFeatures: topFeatures || [],
      dailyActiveUsers: dailyActiveUsers || []
    });
  } catch (error) {
    logger.error('Error fetching enhanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch enhanced stats' });
  }
});

// Get detailed user activities
router.get('/detailed-users', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const dateThreshold = getDateThreshold(days);

    // Get basic user activity stats
    const userActivities = await db
      .select({
        userId: userActivityLogs.userId,
        userName: sql<string>`COALESCE((
          SELECT first_name || ' ' || last_name 
          FROM users 
          WHERE id = ${userActivityLogs.userId}
        ), ${userActivityLogs.userId})`,
        totalActions: sql<number>`count(*)::int`,
        lastActivity: sql<string>`max(${userActivityLogs.createdAt})::text`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(userActivityLogs.userId)
      .orderBy(desc(sql`count(*)`))
      .limit(100);

    // For each user, get detailed breakdowns
    const detailedActivities = await Promise.all(
      userActivities.map(async (user) => {
        // Top actions
        const topActions = await db
          .select({
            action: userActivityLogs.action,
            count: sql<number>`count(*)::int`
          })
          .from(userActivityLogs)
          .where(and(
            eq(userActivityLogs.userId, user.userId),
            gte(userActivityLogs.createdAt, dateThreshold)
          ))
          .groupBy(userActivityLogs.action)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        // Daily activity
        const dailyActivity = await db
          .select({
            date: sql<string>`date(${userActivityLogs.createdAt})`,
            count: sql<number>`count(*)::int`
          })
          .from(userActivityLogs)
          .where(and(
            eq(userActivityLogs.userId, user.userId),
            gte(userActivityLogs.createdAt, dateThreshold)
          ))
          .groupBy(sql`date(${userActivityLogs.createdAt})`)
          .orderBy(sql`date(${userActivityLogs.createdAt})`);

        // Feature usage
        const featureUsage = await db
          .select({
            feature: userActivityLogs.feature,
            count: sql<number>`count(*)::int`,
            avgDuration: sql<number>`avg(${userActivityLogs.duration})::int`
          })
          .from(userActivityLogs)
          .where(and(
            eq(userActivityLogs.userId, user.userId),
            gte(userActivityLogs.createdAt, dateThreshold),
            sql`${userActivityLogs.feature} IS NOT NULL`
          ))
          .groupBy(userActivityLogs.feature)
          .orderBy(desc(sql`count(*)`))
          .limit(10);

        // Section breakdown
        const sectionBreakdown = await db
          .select({
            section: userActivityLogs.section,
            actions: sql<number>`count(*)::int`,
            timeSpent: sql<number>`sum(${userActivityLogs.duration})::int`
          })
          .from(userActivityLogs)
          .where(and(
            eq(userActivityLogs.userId, user.userId),
            gte(userActivityLogs.createdAt, dateThreshold)
          ))
          .groupBy(userActivityLogs.section)
          .orderBy(desc(sql`count(*)`));

        // Peak usage times
        const peakUsageTimes = await db
          .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})::int`,
            count: sql<number>`count(*)::int`
          })
          .from(userActivityLogs)
          .where(and(
            eq(userActivityLogs.userId, user.userId),
            gte(userActivityLogs.createdAt, dateThreshold)
          ))
          .groupBy(sql`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})`)
          .orderBy(desc(sql`count(*)`));

        return {
          ...user,
          topActions,
          dailyActivity,
          featureUsage,
          sectionBreakdown,
          peakUsageTimes
        };
      })
    );

    res.json(detailedActivities || []);
  } catch (error) {
    logger.error('Error fetching detailed users:', error);
    res.status(500).json({ error: 'Failed to fetch detailed user activities' });
  }
});

// Get activity logs with filtering
router.get('/logs', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const userId = req.query.userId as string;
    const action = req.query.action as string;
    const dateThreshold = getDateThreshold(days);

    let query = db
      .select({
        id: userActivityLogs.id,
        userId: userActivityLogs.userId,
        userName: sql<string>`COALESCE((
          SELECT first_name || ' ' || last_name 
          FROM users 
          WHERE id = ${userActivityLogs.userId}
        ), ${userActivityLogs.userId})`,
        action: userActivityLogs.action,
        section: userActivityLogs.section,
        feature: userActivityLogs.feature,
        page: userActivityLogs.page,
        details: userActivityLogs.details,
        duration: userActivityLogs.duration,
        createdAt: sql<string>`${userActivityLogs.createdAt}::text`,
        metadata: userActivityLogs.metadata
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .$dynamic();

    if (userId && userId !== 'all') {
      query = query.where(eq(userActivityLogs.userId, userId));
    }

    if (action && action !== 'all') {
      query = query.where(eq(userActivityLogs.action, action));
    }

    const logs = await query
      .orderBy(desc(userActivityLogs.createdAt))
      .limit(500);

    res.json(logs || []);
  } catch (error) {
    logger.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get individual user stats
router.get('/user-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    const dateThreshold = getDateThreshold(days);

    // Total actions
    const totalActionsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold)
      ));
    
    const totalActions = totalActionsResult[0]?.count || 0;

    // Top actions
    const topActions = await db
      .select({
        action: userActivityLogs.action,
        count: sql<number>`count(*)::int`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold)
      ))
      .groupBy(userActivityLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Daily activity
    const dailyActivity = await db
      .select({
        date: sql<string>`date(${userActivityLogs.createdAt})`,
        count: sql<number>`count(*)::int`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold)
      ))
      .groupBy(sql`date(${userActivityLogs.createdAt})`)
      .orderBy(sql`date(${userActivityLogs.createdAt})`);

    // Feature usage
    const featureUsage = await db
      .select({
        feature: userActivityLogs.feature,
        count: sql<number>`count(*)::int`,
        avgDuration: sql<number>`avg(${userActivityLogs.duration})::int`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold),
        sql`${userActivityLogs.feature} IS NOT NULL`
      ))
      .groupBy(userActivityLogs.feature)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Section breakdown
    const sectionBreakdown = await db
      .select({
        section: userActivityLogs.section,
        count: sql<number>`count(*)::int`,
        timeSpent: sql<number>`sum(${userActivityLogs.duration})::int`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold)
      ))
      .groupBy(userActivityLogs.section)
      .orderBy(desc(sql`count(*)`));

    // Peak usage times
    const peakUsageTimes = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})::int`,
        count: sql<number>`count(*)::int`
      })
      .from(userActivityLogs)
      .where(and(
        eq(userActivityLogs.userId, userId),
        gte(userActivityLogs.createdAt, dateThreshold)
      ))
      .groupBy(sql`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})`)
      .orderBy(desc(sql`count(*)`));

    res.json({
      totalActions,
      topActions: topActions || [],
      dailyActivity: dailyActivity || [],
      featureUsage: featureUsage || [],
      sectionBreakdown: sectionBreakdown || [],
      peakUsageTimes: peakUsageTimes || []
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

/**
 * Track user activity endpoint
 */
router.post('/track', async (req, res) => {
  try {
    const {
      userId,
      action,
      section,
      feature,
      page,
      details,
      duration,
      metadata
    } = req.body;

    if (!userId || !action || !section) {
      return res.status(400).json({ error: 'userId, action, and section are required' });
    }

    await db.insert(userActivityLogs).values({
      userId,
      action,
      section,
      feature: feature || null,
      page: page || null,
      details: details || null,
      duration: duration || 0,
      metadata: metadata || {},
      sessionId: req.sessionID || null,
      ipAddress: req.ip || null,
      userAgent: req.get('User-Agent') || null
    });

    res.json({
      success: true,
      message: 'Activity tracked',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error tracking activity:', error);
    res.status(500).json({ error: 'Failed to track activity' });
  }
});

export default router;
