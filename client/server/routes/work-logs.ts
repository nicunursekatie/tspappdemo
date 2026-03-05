import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { workLogs } from '@shared/schema';
import { db } from '../db';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  requirePermission,
  requireOwnershipPermission,
} from '../middleware/auth';
import { logger } from '../utils/production-safe-logger';

// Default and maximum limits for pagination to prevent unbounded queries
// Default is set high (1000) to maintain backwards compatibility since client doesn't paginate yet
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

const router = Router();

// Zod schema for validation
const insertWorkLogSchema = z.object({
  description: z.string().min(1),
  hours: z.number().int().min(0),
  minutes: z.number().int().min(0).max(59),
  workDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid date format',
  }),
});

// Middleware to check if user is super admin or admin
function isSuperAdmin(req: any) {
  return req.user?.role === 'super_admin' || req.user?.role === 'admin';
}

// Get work logs - Check permissions first
router.get('/', async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role;

    // Parse pagination params with safe defaults
    const requestedLimit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
    const limit = Math.min(Math.max(1, requestedLimit), MAX_LIMIT);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    logger.log(
      `[WORK LOGS] User: ${userId}, Email: ${userEmail}, Role: ${userRole}`
    );

    // Check if user has any work log permissions
    const canCreate = req.user?.permissions?.includes(PERMISSIONS.WORK_LOGS_ADD);
    const canViewAll = req.user?.permissions?.includes(PERMISSIONS.WORK_LOGS_VIEW_ALL);
    const isAdmin = isSuperAdmin(req) || userEmail === 'mdlouza@gmail.com';

    logger.log(
      `[WORK LOGS] Permissions - canCreate: ${canCreate}, canViewAll: ${canViewAll}, isAdmin: ${isAdmin}`
    );

    // User must have at least WORK_LOGS_ADD permission to access work logs
    if (!canCreate && !canViewAll && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to view work logs' });
    }

    // Only users with explicit WORK_LOGS_VIEW_ALL permission can see ALL work logs
    if (canViewAll || isAdmin) {
      logger.log(`[WORK LOGS] ViewAll permission - fetching logs with limit ${limit}, offset ${offset}`);
      
      // Get total count for pagination
      const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(workLogs);
      const total = Number(totalResult?.count || 0);
      
      const logs = await db
        .select()
        .from(workLogs)
        .orderBy(desc(workLogs.workDate))
        .limit(limit)
        .offset(offset);
      logger.log(
        `[WORK LOGS] Found ${logs.length} logs (page)`
      );
      return res.json({
        data: logs,
        total,
        limit,
        offset,
        hasMore: offset + logs.length < total
      });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User context missing' });
    }

    logger.log(
      `[WORK LOGS] Regular user access - fetching logs for ${userId} with limit ${limit}, offset ${offset}`
    );
    
    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workLogs)
      .where(eq(workLogs.userId, userId));
    const total = Number(totalResult?.count || 0);
    
    const logs = await db
      .select()
      .from(workLogs)
      .where(eq(workLogs.userId, userId))
      .orderBy(desc(workLogs.workDate))
      .limit(limit)
      .offset(offset);
    logger.log(
      `[WORK LOGS] Found ${logs.length} logs for user ${userId} (page)`
    );
    return res.json({
      data: logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total
    });
  } catch (error) {
    logger.error('Error fetching work logs:', error);
    res.status(500).json({ error: 'Failed to fetch work logs' });
  }
});

// Create a new work log
router.post(
  '/',
  requirePermission(PERMISSIONS.WORK_LOGS_ADD),
  async (req, res) => {
    const result = insertWorkLogSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: result.error.message });
    
    if (!req.user?.id) {
      return res.status(400).json({ error: 'User context missing' });
    }
    
    try {
      const log = await db
        .insert(workLogs)
        .values({
          userId: req.user.id,
          description: result.data.description,
          hours: result.data.hours,
          minutes: result.data.minutes,
          workDate: new Date(result.data.workDate),
        })
        .returning();
      res.status(201).json(log[0]);
    } catch (error) {
      logger.error('Error creating work log:', error);
      res.status(500).json({ error: 'Failed to create work log' });
    }
  }
);

// Update a work log (own or any if super admin)
router.put(
  '/:id',
  requireOwnershipPermission(
    PERMISSIONS.WORK_LOGS_EDIT_OWN,
    PERMISSIONS.WORK_LOGS_EDIT_ALL,
    async (req) => {
      const logId = parseInt(req.params.id);
      const log = await db
        .select()
        .from(workLogs)
        .where(eq(workLogs.id, logId));
      return log[0]?.userId || null;
    }
  ),
  async (req, res) => {
    const logId = parseInt(req.params.id);
    if (isNaN(logId)) return res.status(400).json({ error: 'Invalid log ID' });
    const result = insertWorkLogSchema.safeParse(req.body);
    if (!result.success)
      return res.status(400).json({ error: result.error.message });
    try {
      const updated = await db
        .update(workLogs)
        .set({
          description: result.data.description,
          hours: result.data.hours,
          minutes: result.data.minutes,
          workDate: new Date(result.data.workDate),
        })
        .where(eq(workLogs.id, logId))
        .returning();
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update work log' });
    }
  }
);

// Delete a work log (own or any if super admin)
router.delete(
  '/:id',
  requireOwnershipPermission(
    PERMISSIONS.WORK_LOGS_DELETE_OWN,
    PERMISSIONS.WORK_LOGS_DELETE_ALL,
    async (req) => {
      const logId = parseInt(req.params.id);
      const log = await db
        .select()
        .from(workLogs)
        .where(eq(workLogs.id, logId));
      return log[0]?.userId || null;
    }
  ),
  async (req, res) => {
    const logId = parseInt(req.params.id);
    logger.log('[WORK LOGS DELETE] Attempting to delete log ID:', logId);

    if (isNaN(logId)) return res.status(400).json({ error: 'Invalid log ID' });

    try {
      logger.log('[WORK LOGS DELETE] Deleting log...');
      await db.delete(workLogs).where(eq(workLogs.id, logId));
      logger.log('[WORK LOGS DELETE] Successfully deleted log ID:', logId);

      res.status(204).send();
    } catch (error) {
      logger.error('[WORK LOGS DELETE] Error:', error);
      logger.error('[WORK LOGS DELETE] Stack trace:', (error as Error).stack);
      res.status(500).json({ error: 'Failed to delete work log' });
    }
  }
);

export default router;
