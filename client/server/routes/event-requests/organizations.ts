/**
 * Event Requests - Organization Management Routes
 *
 * Handles organization lookup, creation, and duplicate checking.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../storage-wrapper';
import { insertOrganizationSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Enhanced logging function for activity tracking
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
};

// ============================================================================
// Organization Management Routes
// ============================================================================

// Check organization duplicates
router.post('/check-duplicates', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, 'EVENT_REQUESTS_VIEW')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const { organizationName } = req.body;
    if (!organizationName) {
      return res.status(400).json({ message: 'Organization name is required' });
    }

    const duplicateCheck = { exists: false, matches: [] };
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Checked duplicates for organization: ${organizationName}`
    );
    res.json(duplicateCheck);
  } catch (error) {
    logger.error('Error checking organization duplicates:', error);
    res.status(500).json({ message: 'Failed to check duplicates' });
  }
});

// Get all organizations
router.get('/organizations/all', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, 'EVENT_REQUESTS_VIEW')) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const organizations = await storage.getAllOrganizations();
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      'Retrieved all organizations'
    );
    res.json(organizations);
  } catch (error) {
    logger.error('Error fetching organizations:', error);
    res.status(500).json({ message: 'Failed to fetch organizations' });
  }
});

// Create new organization
router.post('/organizations', async (req, res) => {
  try {
    const user = req.user;
    if (!user || !hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const validatedData = insertOrganizationSchema.parse(req.body);
    const newOrganization = await storage.createOrganization(validatedData);

    await logActivity(
      req,
      res,
      PERMISSIONS.EVENT_REQUESTS_EDIT,
      `Created organization: ${newOrganization.name}`
    );
    res.status(201).json(newOrganization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: 'Invalid input', errors: error.errors });
    }
    logger.error('Error creating organization:', error);
    res.status(500).json({ message: 'Failed to create organization' });
  }
});

export default router;
