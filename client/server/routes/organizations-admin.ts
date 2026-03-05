/**
 * Organizations Admin API Routes
 *
 * Admin-only endpoints for managing organization duplicates and merges.
 * Requires ADMIN_PANEL_ACCESS permission.
 */

import { Router, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express';
import { findPotentialDuplicates, getOrganizationDetails } from '../services/organizations/returning-organization';
import { mergeOrganizations, getMergeHistory, previewMerge } from '../services/organizations/merge-service';
import { logger } from '../utils/production-safe-logger';
import { PERMISSIONS } from '../../shared/auth-utils';

export interface AdminDependencies {
  isAuthenticated: any;
  requirePermission: any;
}

export function createOrganizationsAdminRoutes(deps: AdminDependencies) {
  const router = Router();

  /**
   * GET /api/organizations-admin/duplicates
   *
   * Find potential duplicate organizations across all data sources.
   * Returns pairs of organizations that likely refer to the same entity.
   *
   * Query params:
   * - threshold: Minimum similarity score (0-1, default: 0.85)
   *
   * Response:
   * {
   *   duplicates: DuplicatePair[],
   *   totalPairs: number
   * }
   */
  router.get(
    '/duplicates',
    deps.isAuthenticated,
    deps.requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const threshold = parseFloat(req.query.threshold as string) || 0.85;

        // Validate threshold
        if (threshold < 0 || threshold > 1) {
          return res.status(400).json({
            error: 'Invalid threshold',
            message: 'Threshold must be between 0 and 1',
          });
        }

        logger.info('Fetching duplicate organizations', {
          threshold,
          userId: req.user?.id,
        });

        const duplicates = await findPotentialDuplicates(threshold);

        res.json({
          duplicates,
          totalPairs: duplicates.length,
          threshold,
        });
      } catch (error) {
        logger.error('Error fetching duplicate organizations', {
          error,
          userId: req.user?.id,
        });

        res.status(500).json({
          error: 'Failed to fetch duplicates',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/organizations-admin/details/:name
   *
   * Get detailed information about a specific organization.
   * Useful for displaying in merge preview modal.
   *
   * Response:
   * {
   *   name: string,
   *   canonicalName: string,
   *   eventCount: number,
   *   collectionCount: number,
   *   recentEvents: Event[],
   *   recentCollections: Collection[]
   * }
   */
  router.get(
    '/details/:name',
    deps.isAuthenticated,
    deps.requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const orgName = decodeURIComponent(req.params.name);

        if (!orgName) {
          return res.status(400).json({
            error: 'Organization name is required',
          });
        }

        const details = await getOrganizationDetails(orgName);

        res.json(details);
      } catch (error) {
        logger.error('Error fetching organization details', {
          error,
          orgName: req.params.name,
          userId: req.user?.id,
        });

        res.status(500).json({
          error: 'Failed to fetch organization details',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/organizations-admin/merge/preview
   *
   * Preview what would be affected by a merge without executing it.
   *
   * Request body:
   * {
   *   sourceName: string,  // Name to be replaced
   *   targetName: string   // Name to keep
   * }
   *
   * Response:
   * {
   *   affectedEventRequests: number,
   *   affectedCollections: number,
   *   sampleEvents: Event[],
   *   sampleCollections: Collection[]
   * }
   */
  router.post(
    '/merge/preview',
    deps.isAuthenticated,
    deps.requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sourceName, targetName } = req.body;

        if (!sourceName || !targetName) {
          return res.status(400).json({
            error: 'Both sourceName and targetName are required',
          });
        }

        if (sourceName === targetName) {
          return res.status(400).json({
            error: 'Source and target names cannot be the same',
          });
        }

        const preview = await previewMerge(sourceName, targetName);

        res.json(preview);
      } catch (error) {
        logger.error('Error previewing merge', {
          error,
          userId: req.user?.id,
          body: req.body,
        });

        res.status(500).json({
          error: 'Failed to preview merge',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * POST /api/organizations-admin/merge
   *
   * Execute an organization merge operation.
   * This updates all references to sourceName to use targetName instead.
   *
   * Request body:
   * {
   *   sourceName: string,  // Name to be replaced
   *   targetName: string,  // Name to keep
   *   reason?: string      // Optional reason for merge
   * }
   *
   * Response:
   * {
   *   success: boolean,
   *   targetName: string,
   *   sourceName: string,
   *   affectedEventRequests: number,
   *   affectedCollections: number,
   *   error?: string
   * }
   */
  router.post(
    '/merge',
    deps.isAuthenticated,
    deps.requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { sourceName, targetName, reason } = req.body;

        if (!sourceName || !targetName) {
          return res.status(400).json({
            error: 'Both sourceName and targetName are required',
          });
        }

        if (sourceName === targetName) {
          return res.status(400).json({
            error: 'Source and target names cannot be the same',
          });
        }

        logger.info('Executing organization merge', {
          sourceName,
          targetName,
          reason,
          userId: req.user?.id,
          userName: req.user?.fullName || req.user?.email,
        });

        const result = await mergeOrganizations(
          sourceName,
          targetName,
          req.user?.id || 'unknown',
          reason
        );

        if (result.success) {
          logger.info('Organization merge completed successfully', {
            ...result,
            userId: req.user?.id,
          });

          res.json(result);
        } else {
          logger.warn('Organization merge failed', {
            ...result,
            userId: req.user?.id,
          });

          res.status(400).json(result);
        }
      } catch (error) {
        logger.error('Error executing merge', {
          error,
          userId: req.user?.id,
          body: req.body,
        });

        res.status(500).json({
          success: false,
          error: 'Failed to execute merge',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  /**
   * GET /api/organizations-admin/merge-history
   *
   * Get history of recent organization merges.
   *
   * Query params:
   * - limit: Maximum number of records to return (default: 100)
   *
   * Response:
   * {
   *   merges: MergeHistoryEntry[],
   *   total: number
   * }
   */
  router.get(
    '/merge-history',
    deps.isAuthenticated,
    deps.requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;

        // Validate limit
        if (limit < 1 || limit > 1000) {
          return res.status(400).json({
            error: 'Invalid limit',
            message: 'Limit must be between 1 and 1000',
          });
        }

        const merges = await getMergeHistory(limit);

        res.json({
          merges,
          total: merges.length,
        });
      } catch (error) {
        logger.error('Error fetching merge history', {
          error,
          userId: req.user?.id,
        });

        res.status(500).json({
          error: 'Failed to fetch merge history',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  return router;
}
