import { Router } from 'express';
import { VersioningService } from '../../services/versioning';
import { createStandardMiddleware, createErrorHandler } from '../../middleware';

const router = Router();

// Apply standard middleware and error handling for this module
const standardMiddleware = createStandardMiddleware();
const errorHandler = createErrorHandler('versioning');

/**
 * Version Control Routes - Entity versioning and change management
 * All routes require authentication as they deal with sensitive version data
 */

// Get version history for an entity
router.get(
  '/:entityType/:entityId/history',
  ...standardMiddleware,
  async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const history = await VersioningService.getVersionHistory(
        entityType,
        parseInt(entityId)
      );
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get specific version of an entity
router.get(
  '/:entityType/:entityId/version/:version',
  ...standardMiddleware,
  async (req, res) => {
    try {
      const { entityType, entityId, version } = req.params;
      const versionData = await VersioningService.getVersion(
        entityType,
        parseInt(entityId),
        parseInt(version)
      );
      if (!versionData) {
        return res.status(404).json({ error: 'Version not found' });
      }
      res.json(versionData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Restore a specific version of an entity
router.post(
  '/:entityType/:entityId/restore/:version',
  ...standardMiddleware,
  async (req, res) => {
    try {
      const { entityType, entityId, version } = req.params;
      const userId = req.user?.claims?.sub;

      const success = await VersioningService.restoreVersion(
        entityType,
        parseInt(entityId),
        parseInt(version),
        userId
      );

      if (success) {
        res.json({ success: true, message: 'Version restored successfully' });
      } else {
        res.status(400).json({ error: 'Failed to restore version' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Compare two versions of an entity
router.get(
  '/:entityType/:entityId/compare/:version1/:version2',
  ...standardMiddleware,
  async (req, res) => {
    try {
      const { entityType, entityId, version1, version2 } = req.params;
      const comparison = await VersioningService.compareVersions(
        entityType,
        parseInt(entityId),
        parseInt(version1),
        parseInt(version2)
      );
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Create a changeset
router.post('/changeset', ...standardMiddleware, async (req, res) => {
  try {
    const userId = req.user?.claims?.sub;
    const result = await VersioningService.createChangeset(req.body, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get change statistics
router.get('/stats', ...standardMiddleware, async (req, res) => {
  try {
    const { entityType, userId, startDate, endDate } = req.query;
    const stats = await VersioningService.getChangeStats(
      entityType as string,
      userId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export version history
router.get('/export', ...standardMiddleware, async (req, res) => {
  try {
    const { entityType, entityId } = req.query;
    const history = await VersioningService.exportVersionHistory(
      entityType as string,
      entityId ? parseInt(entityId as string) : undefined
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply error handler at the end
router.use(errorHandler);

export default router;
