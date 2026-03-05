// Error logging endpoint for dynamic error management system
import { Router } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';
import { logger } from '../utils/production-safe-logger';

const errorLogSchema = z.object({
  error: z.string(),
  context: z.object({
    userRole: z.string().optional(),
    currentPage: z.string().optional(),
    attemptedAction: z.string().optional(),
    formData: z.record(z.any()).optional(),
    userId: z.string().optional(),
    sessionValid: z.boolean().optional(),
  }),
  userAgent: z.string().optional(),
  timestamp: z.string(),
});

export function createErrorLogsRoutes(storage: IStorage) {
  const router = Router();

  // Log error for monitoring and analytics
  router.post('/', async (req, res) => {
    try {
      const errorData = errorLogSchema.parse(req.body);

      // Add additional server-side context
      const logEntry = {
        ...errorData,
        ipAddress: req.ip,
        sessionId: (req as any).sessionID,
        serverTimestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent') || errorData.userAgent,
      };

      // Log to console for immediate monitoring
      logger.log('🚨 Client Error Logged:', {
        error: errorData.error,
        user: errorData.context.userId,
        page: errorData.context.currentPage,
        action: errorData.context.attemptedAction,
        timestamp: errorData.timestamp,
      });

      // In a production app, you might want to:
      // 1. Store in a dedicated error logging table
      // 2. Send to external error monitoring service (Sentry, LogRocket, etc.)
      // 3. Alert administrators for critical errors

      // For now, we'll store basic error analytics
      if (storage.logUserActivity) {
        await storage.logUserActivity({
          userId: errorData.context.userId || 'anonymous',
          action: 'error_occurred',
          section: 'system',
          page: errorData.context.currentPage || 'unknown',
          feature: errorData.error,
          sessionId: (req as any).sessionID,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent') || 'Unknown',
          metadata: {
            errorType: errorData.error,
            attemptedAction: errorData.context.attemptedAction,
            userRole: errorData.context.userRole,
            formData: errorData.context.formData ? 'present' : 'none',
            clientTimestamp: errorData.timestamp,
            serverTimestamp: logEntry.serverTimestamp,
          },
        });
      }

      res.status(200).json({
        success: true,
        message: 'Error logged successfully',
      });
    } catch (error) {
      logger.error('Failed to log client error:', error);

      // Don't let error logging failures break the client
      res.status(200).json({
        success: false,
        message: 'Error logging failed but ignored',
      });
    }
  });

  return router;
}
