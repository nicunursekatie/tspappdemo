import express from 'express';
import type { RouterDependencies } from '../types';
import { logger } from '../utils/production-safe-logger';
import { EmailNotificationService } from '../services/email-notification-service';

export function createPermissionRequestsRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Submit a permission request
  router.post('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const {
        userId,
        userEmail,
        userName,
        requestedAction,
        requiredPermission,
        userMessage,
        requestedAt,
      } = req.body;

      // Validate required fields
      if (!userId || !userEmail) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create a notification for super admins
      try {
        // Get all super admin users
        const allUsers = await storage.getAllUsers();
        const superAdmins = allUsers.filter(u => u.role === 'super_admin');

        // Create in-app notifications for all super admins
        for (const admin of superAdmins) {
          await storage.createNotification({
            userId: admin.id,
            type: 'permission_request',
            priority: 'medium',
            title: 'Permission Access Request',
            message: `${userName || userEmail} is requesting permission to ${requestedAction || 'access a feature'}.${userMessage ? ` Message: "${userMessage}"` : ''}`,
            category: 'admin',
            relatedType: 'permission_request',
            actionUrl: '/admin-settings?tab=permissions',
            actionText: 'Review Request',
            metadata: {
              requestingUserId: userId,
              requestingUserEmail: userEmail,
              requestingUserName: userName,
              requestedAction,
              requiredPermission,
              userMessage,
              requestedAt,
            },
          });
        }

        // Send email notification to super admins
        const superAdminEmails = superAdmins
          .map(a => a.preferredEmail || a.email)
          .filter(Boolean);

        if (superAdminEmails.length > 0) {
          await EmailNotificationService.sendPermissionRequestNotification(
            superAdminEmails,
            {
              userName: userName || userEmail,
              userEmail,
              requestedAction: requestedAction || 'access a feature',
              requiredPermission,
              userMessage,
            }
          );
        }

        logger.info(`Permission request submitted by ${userEmail} for: ${requestedAction}`);

        res.status(201).json({
          success: true,
          message: 'Permission request submitted successfully',
        });
      } catch (notificationError) {
        logger.error('Error sending permission request notifications:', notificationError);
        // Still return success if the request was logged, even if notification failed
        res.status(201).json({
          success: true,
          message: 'Permission request submitted (notification may have failed)',
        });
      }
    } catch (error) {
      logger.error('Error submitting permission request:', error);
      res.status(500).json({ error: 'Failed to submit permission request' });
    }
  });

  return router;
}

export default createPermissionRequestsRouter;
