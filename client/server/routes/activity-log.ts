import { Router } from 'express';
import { z } from 'zod';
// Auth will be handled by existing middleware
import { IStorage } from '../storage';
import { logger } from '../utils/production-safe-logger';

const activityLogSchema = z.object({
  action: z.string().min(1),
  section: z.string().min(1),
  feature: z.string().min(1),
  page: z.string().optional(),
  details: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export function createActivityLogRoutes(storage: IStorage) {
  const router = Router();

  // Get activity logs with optional date filtering
  router.get('/', async (req, res) => {
    try {
      const user = (req as any).user;

      if (!user?.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { startDate, endDate, action, section, limit = '100' } = req.query;

      // Build filter options
      const options: any = {
        userId: user.id,
        limit: parseInt(limit as string),
      };

      if (startDate) {
        options.startDate = new Date(startDate as string);
      }
      if (endDate) {
        options.endDate = new Date(endDate as string);
      }
      if (action) {
        options.action = action as string;
      }
      if (section) {
        options.section = section as string;
      }

      const logs = await storage.getUserActivityLogs(options);
      res.json(logs || []);
    } catch (error) {
      logger.error('Failed to fetch activity logs:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  // Log client-side activity
  router.post('/', async (req, res) => {
    try {
      const validatedData = activityLogSchema.parse(req.body);
      const user = (req as any).user;

      if (!user?.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Create activity log entry using existing storage method
      // Store details as a plain string, not a JSON object
      await storage.logUserActivity({
        userId: user.id,
        action: validatedData.action,
        section: validatedData.section,
        feature: validatedData.feature,
        page: validatedData.page || req.headers.referer || 'unknown',
        details: validatedData.details || '',
        duration: null,
        metadata: validatedData.metadata || {},
        sessionId: (req as any).sessionID || null,
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Activity log error:', error);
      res.status(500).json({ error: 'Failed to log activity' });
    }
  });

  return router;
}
