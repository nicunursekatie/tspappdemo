import { Request, Response, Router } from 'express';
import type { RouterDependencies } from '../types';
import { z } from 'zod';
import { logger } from '../utils/production-safe-logger';
import { db } from '../db';
import { dismissedAnnouncements } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Get announcements
const getAnnouncements = async (req: Request, res: Response) => {
  try {
    // Return empty array for now - can be implemented later
    res.json([]);
  } catch (error) {
    logger.error('Error getting announcements:', error);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
};

const broadcastAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  actionUrl: z.string().optional(),
  actionText: z.string().optional(),
  targetRoles: z.array(z.string()).optional(), // Filter by user roles
});

export function createAnnouncementsRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated, storage } = deps;

  router.get('/', isAuthenticated, getAnnouncements);

  // Check if user has dismissed a specific announcement
  router.get('/dismissed/:announcementId', isAuthenticated, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { announcementId } = req.params;

      const dismissed = await db
        .select()
        .from(dismissedAnnouncements)
        .where(
          and(
            eq(dismissedAnnouncements.userId, user.id),
            eq(dismissedAnnouncements.announcementId, announcementId)
          )
        )
        .limit(1);

      res.json({ dismissed: dismissed.length > 0 });
    } catch (error) {
      logger.error('Error checking dismissed announcement:', error);
      res.status(500).json({ error: 'Failed to check announcement status' });
    }
  });

  // Mark an announcement as dismissed for the current user
  router.post('/dismiss', isAuthenticated, async (req: any, res: Response) => {
    try {
      const user = req.user || req.session?.user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { announcementId } = req.body;
      if (!announcementId) {
        return res.status(400).json({ error: 'announcementId is required' });
      }

      // Insert or ignore if already exists (unique constraint)
      await db
        .insert(dismissedAnnouncements)
        .values({
          userId: user.id,
          announcementId,
        })
        .onConflictDoNothing();

      logger.log(`User ${user.id} dismissed announcement: ${announcementId}`);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error dismissing announcement:', error);
      res.status(500).json({ error: 'Failed to dismiss announcement' });
    }
  });

  // Broadcast announcement to all users or specific roles
  router.post('/broadcast', isAuthenticated, async (req: any, res: Response) => {
    try {
      // Only admins can broadcast announcements
      if (!req.user?.permissions?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const announcementData = broadcastAnnouncementSchema.parse(req.body);
      const { targetRoles, ...notificationData } = announcementData;

      // Get all active users
      const allUsers = await storage.getAllUsers();
      let targetUsers = allUsers.filter((user: any) => user.isActive);

      // Filter by roles if specified
      if (targetRoles && targetRoles.length > 0) {
        targetUsers = targetUsers.filter((user: any) => targetRoles.includes(user.role));
      }

      // Create notifications for all target users
      let successCount = 0;
      let failureCount = 0;

      for (const user of targetUsers) {
        try {
          await storage.createNotification({
            userId: user.id,
            type: 'announcement',
            priority: notificationData.priority,
            title: notificationData.title,
            message: notificationData.message,
            category: 'updates',
            actionUrl: notificationData.actionUrl,
            actionText: notificationData.actionText,
          });
          successCount++;
        } catch (notifError) {
          logger.error(`Failed to create notification for ${user.id}:`, notifError);
          failureCount++;
        }
      }

      res.json({
        success: true,
        message: `Announcement sent to ${successCount} users`,
        successCount,
        failureCount,
        totalUsers: targetUsers.length,
      });
    } catch (error) {
      logger.error('Error broadcasting announcement:', error);
      res.status(500).json({ error: 'Failed to broadcast announcement' });
    }
  });

  return router;
}