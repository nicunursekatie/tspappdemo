import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { AuditLogger } from '../audit-logger';
import { PERMISSIONS } from '@shared/auth-utils';
import { safeJsonParse } from '../utils/safe-json';
import { db } from '../db';
import { auditLogs, users } from '@shared/schema';
import { desc, sql, and, or, eq, gte } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export function createAuditLogsRouter(deps: RouterDependencies) {
  const router = Router();
  const { requirePermission } = deps;

  // Get audit logs with filtering
  router.get(
    '/',
    requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: any, res) => {
      try {
        const {
          tableName,
          recordId,
          userId,
          limit = 100,
          offset = 0
        } = req.query;

        // Safely parse limit and offset with validation
        const parsedLimit = parseInt(limit as string, 10);
        const parsedOffset = parseInt(offset as string, 10);

        const validLimit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100;
        const validOffset = !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

        const logs = await AuditLogger.getAuditHistory(
          tableName as string | undefined,
          recordId as string | undefined,
          userId as string | undefined,
          validLimit,
          validOffset
        );

        // Parse JSON strings in the logs for easier consumption
        const parsedLogs = logs.map(log => {
          let oldData = null;
          let newData = null;

          // Safely parse oldData using safe JSON parser
          if (log.oldData) {
            const parseResult = safeJsonParse(log.oldData, null, `audit log ${log.id} oldData`);
            if (parseResult.success) {
              oldData = parseResult.data;
            } else {
              oldData = { _parseError: 'Malformed JSON', _raw: log.oldData.substring(0, 100) };
            }
          }

          // Safely parse newData using safe JSON parser
          if (log.newData) {
            const parseResult = safeJsonParse(log.newData, null, `audit log ${log.id} newData`);
            if (parseResult.success) {
              newData = parseResult.data;
            } else {
              newData = { _parseError: 'Malformed JSON', _raw: log.newData.substring(0, 100) };
            }
          }

          return {
            ...log,
            oldData,
            newData
          };
        });

        res.json(parsedLogs);
      } catch (error) {
        logger.error('Failed to fetch audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  // Get audit logs for a specific entity
  router.get(
    '/:tableName/:recordId',
    requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: any, res) => {
      try {
        const { tableName, recordId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Safely parse limit and offset with validation
        const parsedLimit = parseInt(limit as string, 10);
        const parsedOffset = parseInt(offset as string, 10);

        const validLimit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
        const validOffset = !isNaN(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

        const logs = await AuditLogger.getAuditHistory(
          tableName,
          recordId,
          undefined,
          validLimit,
          validOffset
        );

        // Parse JSON strings with error handling
        const parsedLogs = logs.map(log => {
          let oldData = null;
          let newData = null;

          // Safely parse oldData using safe JSON parser
          if (log.oldData) {
            const parseResult = safeJsonParse(log.oldData, null, `audit log ${log.id} oldData`);
            if (parseResult.success) {
              oldData = parseResult.data;
            } else {
              oldData = { _parseError: 'Malformed JSON', _raw: log.oldData.substring(0, 100) };
            }
          }

          // Safely parse newData using safe JSON parser
          if (log.newData) {
            const parseResult = safeJsonParse(log.newData, null, `audit log ${log.id} newData`);
            if (parseResult.success) {
              newData = parseResult.data;
            } else {
              newData = { _parseError: 'Malformed JSON', _raw: log.newData.substring(0, 100) };
            }
          }

          return {
            ...log,
            oldData,
            newData
          };
        });

        res.json(parsedLogs);
      } catch (error) {
        logger.error('Failed to fetch audit logs for entity:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
      }
    }
  );

  // Activity Feed - Get recent event status changes in a user-friendly format
  router.get(
    '/activity-feed',
    requirePermission(PERMISSIONS.EVENT_REQUESTS_VIEW),
    async (req: any, res) => {
      try {
        const { limit = 50, hours = 72 } = req.query;
        const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
        const parsedHours = parseInt(hours as string, 10) || 72;
        
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - parsedHours);

        // Query audit logs for event status changes with user info
        const activityLogs = await db
          .select({
            id: auditLogs.id,
            timestamp: auditLogs.timestamp,
            action: auditLogs.action,
            recordId: auditLogs.recordId,
            oldData: auditLogs.oldData,
            newData: auditLogs.newData,
            userId: auditLogs.userId,
          })
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.tableName, 'event_requests'),
              gte(auditLogs.timestamp, cutoffDate),
              or(
                sql`${auditLogs.action} = 'EVENT_REQUEST_CHANGE'`,
                sql`${auditLogs.action} = 'CREATE'`,
                sql`${auditLogs.action} = 'UPDATE'`
              )
            )
          )
          .orderBy(desc(auditLogs.timestamp))
          .limit(parsedLimit);

        // Get unique user IDs to fetch user names
        const userIds = [...new Set(activityLogs.map(log => log.userId).filter(Boolean))];
        
        // Fetch user names
        const userMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const usersData = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(sql`${users.id}::text IN (${sql.raw(userIds.map(id => `'${id}'`).join(','))})`);
          
          usersData.forEach(user => {
            const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown User';
            userMap[user.id.toString()] = name;
          });
        }

        // Transform logs into activity feed items
        const activityFeed = activityLogs.map(log => {
          let oldData: any = null;
          let newData: any = null;

          if (log.oldData) {
            const parseResult = safeJsonParse(log.oldData, null, `activity log ${log.id} oldData`);
            if (parseResult.success) oldData = parseResult.data;
          }
          if (log.newData) {
            const parseResult = safeJsonParse(log.newData, null, `activity log ${log.id} newData`);
            if (parseResult.success) newData = parseResult.data;
          }

          const oldStatus = oldData?.status;
          const newStatus = newData?.status;
          const organizationName = newData?.organizationName || oldData?.organizationName || 'Unknown Organization';
          const userName = log.userId ? (userMap[log.userId] || 'System') : 'System';
          const eventDate = newData?.scheduledEventDate || newData?.desiredEventDate || oldData?.scheduledEventDate || oldData?.desiredEventDate || null;

          // Determine activity type
          let activityType = 'update';
          let description = '';

          if (log.action === 'CREATE') {
            activityType = 'created';
            description = `New event request created`;
          } else if (oldStatus !== newStatus && newStatus) {
            activityType = 'status_change';
            description = `Status changed from "${oldStatus || 'new'}" to "${newStatus}"`;
          } else if (newData?.tspContactName && newData?.tspContactName !== oldData?.tspContactName) {
            activityType = 'assignment';
            description = `TSP Contact assigned: ${newData.tspContactName}`;
          } else {
            activityType = 'update';
            description = 'Event details updated';
          }

          return {
            id: log.id,
            timestamp: log.timestamp,
            eventId: log.recordId,
            organizationName,
            userName,
            userId: log.userId,
            activityType,
            description,
            oldStatus,
            newStatus,
            eventDate,
          };
        });

        // Filter to only include meaningful status changes
        const filteredFeed = activityFeed.filter(item => 
          item.activityType === 'status_change' || 
          item.activityType === 'created' ||
          item.activityType === 'assignment'
        );

        res.json({
          activities: filteredFeed,
          count: filteredFeed.length,
          totalCount: activityFeed.length,
          timeRange: {
            hours: parsedHours,
            since: cutoffDate.toISOString()
          }
        });
      } catch (error) {
        logger.error('Failed to fetch activity feed:', error);
        res.status(500).json({ error: 'Failed to fetch activity feed' });
      }
    }
  );

  return router;
}
