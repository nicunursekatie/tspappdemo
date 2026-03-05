import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { requirePermission } from '../../middleware/auth';
import { AdminDependencies, AuthenticatedRequest } from '../../types';
import { logger } from '../../utils/production-safe-logger';
import {
  categorizeUncategorizedEventRequests,
  categorizeOrganization,
} from '../../services/ai-organization-categorization';

export function createAdminRoutes(deps: AdminDependencies) {
  const router = Router();

  // Permission migration endpoint (admin only)
  router.post(
    '/migrate-permissions',
    deps.isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: any, res) => {
      try {
        logger.log('🔄 Starting permission migration...');

        // Get all users
        const allUsers = await storage.getAllUsers();
        logger.log(`Found ${allUsers.length} users to migrate`);

        let migratedCount = 0;
        let unchangedCount = 0;

        // Permission mapping from old to new format
        const PERMISSION_MAPPING: Record<string, string> = {
          // Host management
          access_hosts: 'HOSTS_VIEW',
          manage_hosts: 'HOSTS_EDIT',
          view_hosts: 'HOSTS_VIEW',
          add_hosts: 'HOSTS_ADD',
          edit_hosts: 'HOSTS_EDIT',
          delete_hosts: 'HOSTS_DELETE',

          // Recipient management
          access_recipients: 'RECIPIENTS_VIEW',
          manage_recipients: 'RECIPIENTS_EDIT',
          view_recipients: 'RECIPIENTS_VIEW',
          add_recipients: 'RECIPIENTS_ADD',
          edit_recipients: 'RECIPIENTS_EDIT',
          delete_recipients: 'RECIPIENTS_DELETE',

          // Driver management
          access_drivers: 'DRIVERS_VIEW',
          manage_drivers: 'DRIVERS_EDIT',
          view_drivers: 'DRIVERS_VIEW',
          add_drivers: 'DRIVERS_ADD',
          edit_drivers: 'DRIVERS_EDIT',
          delete_drivers: 'DRIVERS_DELETE',

          // User management
          manage_users: 'USERS_EDIT',
          view_users: 'USERS_VIEW',

          // Collections
          access_collections: 'COLLECTIONS_VIEW',
          manage_collections: 'COLLECTIONS_EDIT',
          create_collections: 'COLLECTIONS_ADD',
          edit_all_collections: 'COLLECTIONS_EDIT_ALL',
          delete_all_collections: 'COLLECTIONS_DELETE_ALL',
          use_collection_walkthrough: 'COLLECTIONS_WALKTHROUGH',

          // Projects
          access_projects: 'PROJECTS_VIEW',
          manage_projects: 'PROJECTS_EDIT',
          create_projects: 'PROJECTS_ADD',
          edit_all_projects: 'PROJECTS_EDIT_ALL',
          delete_all_projects: 'PROJECTS_DELETE_ALL',

          // Distributions
          access_donation_tracking: 'DISTRIBUTIONS_VIEW',
          manage_donation_tracking: 'DISTRIBUTIONS_EDIT',
          view_donation_tracking: 'DISTRIBUTIONS_VIEW',
          add_donation_tracking: 'DISTRIBUTIONS_ADD',
          edit_donation_tracking: 'DISTRIBUTIONS_EDIT',
          delete_donation_tracking: 'DISTRIBUTIONS_DELETE',

          // Event requests
          access_event_requests: 'EVENT_REQUESTS_VIEW',
          manage_event_requests: 'EVENT_REQUESTS_EDIT',
          view_event_requests: 'EVENT_REQUESTS_VIEW',
          add_event_requests: 'EVENT_REQUESTS_ADD',
          edit_event_requests: 'EVENT_REQUESTS_EDIT',
          delete_event_requests: 'EVENT_REQUESTS_DELETE',

          // Messages
          access_messages: 'MESSAGES_VIEW',
          send_messages: 'MESSAGES_SEND',
          moderate_messages: 'MESSAGES_MODERATE',

          // Work logs
          access_work_logs: 'WORK_LOGS_VIEW',
          create_work_logs: 'WORK_LOGS_ADD',
          view_all_work_logs: 'WORK_LOGS_VIEW_ALL',
          edit_all_work_logs: 'WORK_LOGS_EDIT_ALL',
          delete_all_work_logs: 'WORK_LOGS_DELETE_ALL',

          // Chat permissions
          access_chat: 'CHAT_GENERAL',
          general_chat: 'CHAT_GENERAL',
          committee_chat: 'CHAT_COMMITTEE',
          host_chat: 'CHAT_HOST',
          driver_chat: 'CHAT_DRIVER',
          recipient_chat: 'CHAT_RECIPIENT',
          core_team_chat: 'CHAT_CORE_TEAM',
          direct_messages: 'CHAT_DIRECT',
          GENERAL_CHAT: 'CHAT_GENERAL',
          COMMITTEE_CHAT: 'CHAT_COMMITTEE',
          HOST_CHAT: 'CHAT_HOST',
          DRIVER_CHAT: 'CHAT_DRIVER',
          RECIPIENT_CHAT: 'CHAT_RECIPIENT',
          CORE_TEAM_CHAT: 'CHAT_CORE_TEAM',

          // Analytics and other features
          access_analytics: 'ANALYTICS_VIEW',
          access_meetings: 'MEETINGS_VIEW',
          manage_meetings: 'MEETINGS_MANAGE',
          access_suggestions: 'SUGGESTIONS_VIEW',
          create_suggestions: 'SUGGESTIONS_ADD',
          manage_suggestions: 'SUGGESTIONS_MANAGE',
          access_toolkit: 'DOCUMENTS_VIEW',
          access_documents: 'DOCUMENTS_VIEW',
          manage_documents: 'DOCUMENTS_MANAGE',
          export_data: 'DATA_EXPORT',
          import_data: 'DATA_IMPORT',
          edit_data: 'DATA_EXPORT',
        };

        for (const user of allUsers) {
          // Ensure permissions is treated as an array
          const userPermissions = Array.isArray(user.permissions)
            ? user.permissions
            : [];

          if (!userPermissions || userPermissions.length === 0) {
            logger.log(`⏭️  Skipping ${user.email} - no permissions`);
            unchangedCount++;
            continue;
          }

          // Map old permissions to new ones
          const newPermissions = userPermissions
            .map((oldPerm: string) => {
              const newPerm = PERMISSION_MAPPING[oldPerm.toLowerCase()];
              if (newPerm) {
                logger.log(`  📝 ${oldPerm} → ${newPerm}`);
                return newPerm;
              } else {
                // Keep permission as-is if already in new format or unrecognized
                if (oldPerm.includes('_')) {
                  logger.log(`  ✅ ${oldPerm} (already new format)`);
                } else {
                  logger.log(
                    `  ⚠️  Unknown permission: ${oldPerm} (keeping as-is)`
                  );
                }
                return oldPerm;
              }
            })
            // Remove duplicates
            .filter(
              (perm: string, index: number, array: string[]) =>
                array.indexOf(perm) === index
            );

          // Check if anything changed
          const hasChanges =
            JSON.stringify([...userPermissions].sort()) !==
            JSON.stringify(newPermissions.sort());

          if (hasChanges) {
            logger.log(`🔄 Migrating ${user.email}:`);
            logger.log(`   Old: ${userPermissions.join(', ')}`);
            logger.log(`   New: ${newPermissions.join(', ')}`);

            await storage.updateUser(user.id, { permissions: newPermissions });
            migratedCount++;
          } else {
            logger.log(`✅ ${user.email} - no migration needed`);
            unchangedCount++;
          }
        }

        logger.log(`\n🎉 Migration complete!`);
        logger.log(`   ✅ ${migratedCount} users migrated`);
        logger.log(`   ➡️  ${unchangedCount} users unchanged`);

        res.json({
          success: true,
          migrated: migratedCount,
          unchanged: unchangedCount,
          message: `Migration complete: ${migratedCount} users updated, ${unchangedCount} unchanged`,
        });
      } catch (error) {
        logger.error('❌ Permission migration failed:', error);
        res.status(500).json({
          success: false,
          error: 'Migration failed',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Debug endpoint for session information
  router.get(
    '/debug/session',
    deps.isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: any, res) => {
      try {
        const sessionUser = req.session?.user;
        const reqUser = req.user;

        res.json({
          hasSession: !!req.session,
          sessionId: req.sessionID,
          sessionStore: !!deps.sessionStore,
          sessionUser: sessionUser
            ? {
                id: sessionUser.id,
                email: sessionUser.email,
                role: sessionUser.role,
                isActive: sessionUser.isActive,
              }
            : null,
          reqUser: reqUser
            ? {
                id: reqUser.id,
                email: reqUser.email,
                role: reqUser.role,
                isActive: reqUser.isActive,
              }
            : null,
          cookies: req.headers.cookie,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
        });
      } catch (error) {
        logger.error('Debug session error:', error);
        res.status(500).json({ error: 'Failed to get session info' });
      }
    }
  );

  // Debug endpoint to check authentication status
  router.get(
    '/debug/auth-status',
    deps.isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: any, res) => {
      try {
        const user = req.session?.user || req.user;

        res.json({
          isAuthenticated: !!user,
          sessionExists: !!req.session,
          userInSession: !!req.session?.user,
          userInRequest: !!req.user,
          userId: user?.id || null,
          userEmail: user?.email || null,
          userRole: user?.role || null,
          sessionId: req.sessionID,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Debug auth status error:', error);
        res.status(500).json({ error: 'Failed to get auth status' });
      }
    }
  );

  // Removed duplicate GET /login route - now only in auth.ts

  // AI Organization Categorization - categorize all uncategorized event requests
  router.post(
    '/ai-categorize-organizations',
    deps.isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: any, res) => {
      try {
        logger.info('Starting AI event request categorization...');

        // Categorize event requests (which is what the UI shows)
        const progress = await categorizeUncategorizedEventRequests();

        res.json({
          success: true,
          message: 'Event request categorization complete',
          results: {
            total: progress.total,
            patternMatched: progress.patternMatched,
            aiCategorized: progress.aiCategorized,
            skipped: progress.skipped,
            errors: progress.errors,
          },
        });
      } catch (error) {
        logger.error('AI event request categorization failed:', error);
        res.status(500).json({
          error: 'Failed to categorize event requests',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // AI Organization Categorization - categorize a single organization
  router.post(
    '/ai-categorize-organization/:id',
    deps.isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: any, res) => {
      try {
        const organizationId = parseInt(req.params.id);
        if (isNaN(organizationId)) {
          return res.status(400).json({ error: 'Invalid organization ID' });
        }

        logger.info(`Categorizing organization ${organizationId}...`);

        const result = await categorizeOrganization(organizationId);

        if (!result) {
          return res
            .status(404)
            .json({ error: 'Organization not found or could not be categorized' });
        }

        res.json({
          success: true,
          organizationId,
          category: result.category,
          schoolClassification: result.schoolClassification,
          isReligious: result.isReligious,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      } catch (error) {
        logger.error('AI organization categorization failed:', error);
        res.status(500).json({
          error: 'Failed to categorize organization',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  return router;
}

export default createAdminRoutes;
