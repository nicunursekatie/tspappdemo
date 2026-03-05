import { Request, Response, NextFunction } from 'express';
import type { IStorage } from '../storage';
import { logger } from '../utils/production-safe-logger';

interface ActivityLoggerOptions {
  storage: IStorage;
}

// Semantic activity rule - maps API endpoints to meaningful user actions
interface ActivityRule {
  section: string;
  feature: string;
  action: string;
  details: string;
  groupKey?: string; // For deduplication - same groupKey within window = single log
  dedupeWindowMs?: number; // Time window for deduplication (default 60000 = 1 min)
  methods?: string[]; // Only log for these HTTP methods (default: all)
  dynamicDetails?: (req: Request) => string; // Function to extract dynamic details from request
}

// In-memory cache for activity deduplication
// Key format: `${userId}:${groupKey}` -> timestamp of last log
const activityDedupeCache = new Map<string, number>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  for (const [key, timestamp] of activityDedupeCache.entries()) {
    if (now - timestamp > maxAge) {
      activityDedupeCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Semantic activity rules registry - maps API patterns to meaningful user actions
// Order matters: more specific patterns should come first
// NOTE: Only endpoints with explicit rules here will be logged
// Unmapped endpoints are skipped to avoid confusing activity entries
//
// PHILOSOPHY: Only log MEANINGFUL user actions, not page views or polling
// - Creating things (new events, collections, messages)
// - Updating/editing things
// - Sending things (messages, kudos, emails)
// - Exporting data
// - Completing tasks
const activityRules: Array<{ pattern: RegExp | string; rule: ActivityRule }> = [
  // ===== MESSAGING & COMMUNICATION =====
  {
    pattern: /\/api\/messaging\/kudos\/send/,
    rule: {
      section: 'Recognition',
      feature: 'Kudos',
      action: 'Send',
      details: 'Sent kudos to a team member',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/emails\/send/,
    rule: {
      section: 'Communication',
      feature: 'Email',
      action: 'Send',
      details: 'Sent an email',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/messaging\/send/,
    rule: {
      section: 'Communication',
      feature: 'Messages',
      action: 'Send',
      details: 'Sent a message',
      methods: ['POST'],
    },
  },

  // ===== EVENT REQUESTS =====
  {
    pattern: /\/api\/event-requests\/(\d+)\/toolkit-sent/,
    rule: {
      section: 'Event Requests',
      feature: 'Event Management',
      action: 'Update',
      details: 'Marked event as scheduled (toolkit sent)',
      methods: ['PATCH', 'POST'],
      dynamicDetails: (req: Request) => {
        const match = req.path.match(/\/api\/event-requests\/(\d+)/);
        const eventId = match?.[1] || 'unknown';
        const orgName = req.body?.organizationName;
        return orgName
          ? `Sent toolkit for Event #${eventId}: ${orgName}`
          : `Sent toolkit for Event #${eventId}`;
      },
    },
  },
  {
    pattern: /\/api\/event-requests$/,
    rule: {
      section: 'Event Requests',
      feature: 'Event Management',
      action: 'Create',
      details: 'Created a new event request',
      methods: ['POST'],
      dynamicDetails: (req: Request) => {
        const orgName = req.body?.organizationName;
        return orgName
          ? `Created new event request for ${orgName}`
          : 'Created a new event request';
      },
    },
  },
  {
    pattern: /\/api\/event-requests\/(\d+)$/,
    rule: {
      section: 'Event Requests',
      feature: 'Event Management',
      action: 'Update',
      details: 'Updated an event request',
      methods: ['PUT', 'PATCH'],
      dynamicDetails: (req: Request) => {
        const match = req.path.match(/\/api\/event-requests\/(\d+)/);
        const eventId = match?.[1] || 'unknown';
        const orgName = req.body?.organizationName;

        // Try to identify what was changed
        const changedFields = Object.keys(req.body || {}).filter(
          key => !['id', 'createdAt', 'updatedAt'].includes(key)
        );

        let details = orgName
          ? `Updated Event #${eventId}: ${orgName}`
          : `Updated Event #${eventId}`;

        // Add info about what changed if available
        if (changedFields.includes('status')) {
          details += ` (status → ${req.body.status})`;
        } else if (changedFields.includes('scheduledEventDate')) {
          details += ' (date changed)';
        } else if (changedFields.includes('tspContact')) {
          details += ' (assigned TSP)';
        }

        return details;
      },
    },
  },

  // ===== EVENT AUDIT LOG =====
  {
    pattern: /\/api\/event-requests\/(\d+)\/audit/,
    rule: {
      section: 'Event Requests',
      feature: 'Audit Log',
      action: 'View',
      details: 'Viewed event audit log',
      methods: ['GET'],
      dynamicDetails: (req: Request) => {
        const match = req.path.match(/\/api\/event-requests\/(\d+)/);
        const eventId = match?.[1] || 'unknown';
        return `Reviewed audit history for Event #${eventId}`;
      },
    },
  },

  // ===== COLLECTIONS =====
  {
    pattern: '/api/sandwich-collections/export',
    rule: {
      section: 'Collections',
      feature: 'Export',
      action: 'Export',
      details: 'Exported sandwich collection data',
      methods: ['GET', 'POST'],
      dynamicDetails: (req: Request) => {
        const format = req.query?.format || 'csv';
        const dateRange = req.query?.startDate && req.query?.endDate
          ? ` (${req.query.startDate} to ${req.query.endDate})`
          : '';
        return `Exported collections as ${format}${dateRange}`;
      },
    },
  },
  {
    pattern: /\/api\/sandwich-collections$/,
    rule: {
      section: 'Collections',
      feature: 'Collection Log',
      action: 'Create',
      details: 'Logged a sandwich collection',
      methods: ['POST'],
      dynamicDetails: (req: Request) => {
        const hostName = req.body?.hostName;
        const count = req.body?.sandwichCount;
        if (hostName && count) {
          return `Logged collection: ${count} sandwiches from ${hostName}`;
        } else if (count) {
          return `Logged collection: ${count} sandwiches`;
        }
        return 'Logged a sandwich collection';
      },
    },
  },
  {
    pattern: /\/api\/sandwich-collections\/(\d+)$/,
    rule: {
      section: 'Collections',
      feature: 'Collection Log',
      action: 'Update',
      details: 'Updated a collection entry',
      methods: ['PUT', 'PATCH'],
      dynamicDetails: (req: Request) => {
        const match = req.path.match(/\/api\/sandwich-collections\/(\d+)/);
        const collectionId = match?.[1] || 'unknown';
        const hostName = req.body?.hostName;
        return hostName
          ? `Updated collection #${collectionId} (${hostName})`
          : `Updated collection #${collectionId}`;
      },
    },
  },

  // ===== DIRECTORY MANAGEMENT =====
  {
    pattern: /\/api\/hosts$/,
    rule: {
      section: 'Directory',
      feature: 'Hosts',
      action: 'Create',
      details: 'Added a new host',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/hosts\/\d+$/,
    rule: {
      section: 'Directory',
      feature: 'Hosts',
      action: 'Update',
      details: 'Updated host information',
      methods: ['PUT', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/drivers$/,
    rule: {
      section: 'Directory',
      feature: 'Drivers',
      action: 'Create',
      details: 'Added a new driver',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/drivers\/\d+$/,
    rule: {
      section: 'Directory',
      feature: 'Drivers',
      action: 'Update',
      details: 'Updated driver information',
      methods: ['PUT', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/recipients$/,
    rule: {
      section: 'Directory',
      feature: 'Recipients',
      action: 'Create',
      details: 'Added a new recipient',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/recipients\/\d+$/,
    rule: {
      section: 'Directory',
      feature: 'Recipients',
      action: 'Update',
      details: 'Updated recipient information',
      methods: ['PUT', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/volunteers$/,
    rule: {
      section: 'Directory',
      feature: 'Volunteers',
      action: 'Create',
      details: 'Added a new volunteer',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/volunteers\/\d+$/,
    rule: {
      section: 'Directory',
      feature: 'Volunteers',
      action: 'Update',
      details: 'Updated volunteer information',
      methods: ['PUT', 'PATCH'],
    },
  },

  // ===== PROJECTS & TASKS =====
  {
    pattern: /\/api\/projects$/,
    rule: {
      section: 'Projects',
      feature: 'Project Management',
      action: 'Create',
      details: 'Created a new project',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/projects\/\d+$/,
    rule: {
      section: 'Projects',
      feature: 'Project Management',
      action: 'Update',
      details: 'Updated a project',
      methods: ['PUT', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/tasks$/,
    rule: {
      section: 'Tasks',
      feature: 'Task Management',
      action: 'Create',
      details: 'Created a new task',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/tasks\/\d+\/complete/,
    rule: {
      section: 'Tasks',
      feature: 'Task Management',
      action: 'Complete',
      details: 'Completed a task',
      methods: ['POST', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/tasks\/\d+$/,
    rule: {
      section: 'Tasks',
      feature: 'Task Management',
      action: 'Update',
      details: 'Updated a task',
      methods: ['PUT', 'PATCH'],
    },
  },

  // ===== FILE VIEWS =====
  {
    pattern: /\/api\/objects\/proxy/,
    rule: {
      section: 'Files',
      feature: 'File Access',
      action: 'View',
      details: 'Viewed a file',
      methods: ['GET'],
      dynamicDetails: (req: Request) => {
        try {
          // Extract filename from the URL query parameter
          const urlParam = req.query.url as string;
          if (urlParam) {
            // URL format: objects/folder/filename.ext
            const filename = urlParam.split('/').pop() || urlParam;
            return `Viewed file: ${decodeURIComponent(filename)}`;
          }
          const filenameParam = req.query.filename as string;
          if (filenameParam) {
            return `Viewed file: ${filenameParam}`;
          }
          return 'Viewed a file';
        } catch {
          return 'Viewed a file';
        }
      },
    },
  },

  // ===== WORK LOGS =====
  {
    pattern: /\/api\/work-logs$/,
    rule: {
      section: 'Work Log',
      feature: 'Time Tracking',
      action: 'Create',
      details: 'Logged work time',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/work-logs\/\d+$/,
    rule: {
      section: 'Work Log',
      feature: 'Time Tracking',
      action: 'Update',
      details: 'Updated work log entry',
      methods: ['PUT', 'PATCH'],
    },
  },

  // ===== MEETINGS =====
  {
    pattern: /\/api\/meetings$/,
    rule: {
      section: 'Meetings',
      feature: 'Meeting Management',
      action: 'Create',
      details: 'Scheduled a new meeting',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/meetings\/\d+$/,
    rule: {
      section: 'Meetings',
      feature: 'Meeting Management',
      action: 'Update',
      details: 'Updated meeting details',
      methods: ['PUT', 'PATCH'],
    },
  },

  // ===== REPORTS =====
  {
    pattern: /\/api\/reports\/generate/,
    rule: {
      section: 'Reports',
      feature: 'Report Generation',
      action: 'Generate',
      details: 'Generated a report',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/impact-reports$/,
    rule: {
      section: 'Reports',
      feature: 'Impact Reports',
      action: 'Create',
      details: 'Created an impact report',
      methods: ['POST'],
    },
  },

  // ===== HOLDING ZONE =====
  {
    pattern: /\/api\/holding-zone$/,
    rule: {
      section: 'Holding Zone',
      feature: 'Ideas',
      action: 'Create',
      details: 'Added item to Holding Zone',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/holding-zone\/\d+$/,
    rule: {
      section: 'Holding Zone',
      feature: 'Ideas',
      action: 'Update',
      details: 'Updated Holding Zone item',
      methods: ['PUT', 'PATCH'],
    },
  },

  // ===== USER MANAGEMENT =====
  {
    pattern: /\/api\/users\/\d+\/permissions/,
    rule: {
      section: 'Admin',
      feature: 'User Management',
      action: 'Update',
      details: 'Updated user permissions',
      methods: ['PUT', 'PATCH', 'POST'],
    },
  },
  {
    pattern: /\/api\/users\/\d+\/activate/,
    rule: {
      section: 'Admin',
      feature: 'User Management',
      action: 'Activate',
      details: 'Activated a user account',
      methods: ['POST', 'PATCH'],
    },
  },
  {
    pattern: /\/api\/users\/\d+\/deactivate/,
    rule: {
      section: 'Admin',
      feature: 'User Management',
      action: 'Deactivate',
      details: 'Deactivated a user account',
      methods: ['POST', 'PATCH'],
    },
  },

  // ===== RESOURCES/DOCUMENTS =====
  {
    pattern: /\/api\/resources$/,
    rule: {
      section: 'Resources',
      feature: 'Documents',
      action: 'Upload',
      details: 'Uploaded a document',
      methods: ['POST'],
    },
  },
  {
    pattern: /\/api\/documents$/,
    rule: {
      section: 'Resources',
      feature: 'Documents',
      action: 'Upload',
      details: 'Uploaded a document',
      methods: ['POST'],
    },
  },
];

// Paths to completely skip - these provide zero user insight
// These are internal/polling/system endpoints that don't represent meaningful user activity
const skipPaths = [
  // Auth & session
  '/api/auth/user',
  '/api/auth/me',
  '/api/user/me',

  // Notification polling
  '/api/message-notifications',
  '/api/emails/unread-count',
  '/api/messaging/unread',
  '/unread',
  '/api/notifications/counts',
  '/api/notifications',

  // Stats & counts (background polling)
  '/count',
  '/stats',
  '/status-counts',
  '/kudos/unnotified',

  // Online status & presence
  '/api/online',
  '/api/users/online',

  // Health & system
  '/api/health',
  '/api/ping',
  '/healthz',
  '/socket.io',
  '/api/heartbeat', // System heartbeat only, not user presence heartbeat

  // Activity logging itself (prevent recursion)
  '/api/activity-log',
  '/api/activity-logs',

  // Announcements
  '/api/dismissed-announcements',
  '/api/announcements/dismissed',
  '/api/announcements',

  // Stream Chat (internal credentials)
  '/api/stream/credentials',
  '/api/stream/token',

  // Dashboard data polling
  '/api/dashboard',
  '/recent',
  '/api/resources/user/recent',

  // Collaboration data fetching (just loading comments/locks - not meaningful activity)
  '/collaboration/comments',
  '/collaboration/locks',
  '/collaboration/revisions',
  '/collaboration/bulk',

  // Object storage proxy - now logged with file names (removed from skip list)

  // Feature flags
  '/api/feature-flags',

  // Onboarding checks
  '/api/onboarding',

  // For-assignments queries (internal)
  '/for-assignments',
];

function matchActivityRule(path: string, method: string): ActivityRule | null {
  for (const { pattern, rule } of activityRules) {
    const matches =
      typeof pattern === 'string'
        ? path.includes(pattern)
        : pattern.test(path);

    if (matches) {
      // Check if method is allowed
      if (rule.methods && !rule.methods.includes(method)) {
        continue;
      }
      return rule;
    }
  }
  return null;
}

function shouldDedupe(userId: number, groupKey: string, windowMs: number): boolean {
  const cacheKey = `${userId}:${groupKey}`;
  const lastLog = activityDedupeCache.get(cacheKey);
  const now = Date.now();

  if (lastLog && now - lastLog < windowMs) {
    return true; // Skip - within dedup window
  }

  activityDedupeCache.set(cacheKey, now);
  return false;
}

// Map HTTP methods to readable actions for fallback
const methodToAction: Record<string, { action: string; description: string }> = {
  GET: { action: 'View', description: 'Viewed' },
  POST: { action: 'Create', description: 'Created' },
  PUT: { action: 'Update', description: 'Updated' },
  PATCH: { action: 'Update', description: 'Updated' },
  DELETE: { action: 'Delete', description: 'Deleted' },
};

export function createActivityLogger(options: ActivityLoggerOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip OPTIONS and paths with zero insight value
    const shouldSkip =
      req.method === 'OPTIONS' ||
      skipPaths.some((path) => req.path.includes(path));

    if (shouldSkip) {
      return next();
    }

    // Store original end method
    const originalEnd = res.end;

    // Override end method to log after response
    (res as any).end = function (this: Response, chunk?: any, encoding?: any) {
      setImmediate(async () => {
        try {
          const user = (req as any).user;

          if (user?.id && res.statusCode < 400) {
            // Try to match a semantic activity rule
            const rule = matchActivityRule(req.path, req.method);

            let section: string;
            let feature: string;
            let action: string;
            let details: string;

            // Only log activities that have explicit semantic rules
            // Skip unmapped endpoints to avoid confusing/meaningless entries
            if (!rule) {
              // Still update last active timestamp for all requests
              await options.storage.updateUserLastActive(user.id);
              return originalEnd.call(this, chunk, encoding);
            }

            // Check deduplication
            if (rule.groupKey && rule.dedupeWindowMs) {
              if (shouldDedupe(user.id, rule.groupKey, rule.dedupeWindowMs)) {
                // Skip logging - already logged recently
                return originalEnd.call(this, chunk, encoding);
              }
            }

            section = rule.section;
            feature = rule.feature;
            action = rule.action;
            // Use dynamic details if available, otherwise use static details
            details = rule.dynamicDetails ? rule.dynamicDetails(req) : rule.details;

            // Update user's last active timestamp
            await options.storage.updateUserLastActive(user.id);

            // Build metadata
            const metadata: any = {
              url: req.originalUrl || req.url,
              method: req.method,
              statusCode: res.statusCode,
              timestamp: new Date().toISOString(),
            };

            // Add query params if meaningful
            if (Object.keys(req.query).length > 0) {
              metadata.queryParams = req.query;
            }

            // Create activity log entry
            await options.storage.logUserActivity({
              userId: user.id,
              action,
              section,
              page: req.path,
              feature,
              details,
              sessionId: (req as any).sessionID,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent') || 'Unknown',
              metadata,
            });
          }
        } catch (error) {
          logger.error('Error logging user activity:', error);
        }
      });

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}
