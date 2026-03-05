import { Router } from 'express';
import { activityService } from '../services/activities';
import { featureFlagService } from '../services/feature-flags';
import { isAuthenticated } from '../auth';
import { requirePermission } from '../middleware/auth';
import { logger } from '../utils/production-safe-logger';

const router = Router();

/**
 * Safely extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Check if unified activities feature is enabled for user
 */
async function checkActivityFeatureFlag(req: any): Promise<boolean> {
  const enabled = await featureFlagService.isEnabled(
    'unified-activities-read',
    req.user?.id,
    req.user?.role
  );

  if (!enabled) {
    logger.log(
      `[Activities] Feature not enabled for user ${req.user?.id || 'unknown'}`
    );
  }

  return enabled;
}

/**
 * GET /api/activities
 * Get activities with filters
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Check feature flag
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({
        error: 'Feature not enabled',
        message: 'Unified activities feature is not enabled for your account',
      });
    }

    const {
      type,
      contextType,
      contextId,
      userId,
      status,
      includeDeleted,
      parentId,
      limit,
      offset,
    } = req.query;

    // Parse query parameters
    const filters = {
      type: type ? (type as string).split(',') : undefined,
      contextType: contextType as string,
      contextId: contextId as string,
      userId: userId as string,
      status: status ? (status as string).split(',') : undefined,
      includeDeleted: includeDeleted === 'true',
      parentId: parentId === 'null' ? null : (parentId as string),
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    };

    const activities = await activityService.getActivities(filters);

    res.json(activities);
  } catch (error) {
    logger.error('Error getting activities:', error);
    res.status(500).json({
      error: 'Failed to get activities',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/unread/count
 * Get unread count for current user
 * IMPORTANT: Must be defined before /:id route to avoid path collision
 */
router.get('/unread/count', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.json({ count: 0 }); // Return 0 if feature not enabled
    }

    const count = await activityService.getUnreadCount(req.user!.id);

    res.json({ count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/:id
 * Get a single activity by ID with full details
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const activity = await activityService.getActivityById(id, req.user?.id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    logger.error('Error getting activity:', error);
    res.status(500).json({
      error: 'Failed to get activity',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/:id/thread
 * Get full activity thread (root + all replies)
 */
router.get('/:id/thread', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const thread = await activityService.getActivityThread(id, req.user?.id);

    res.json(thread);
  } catch (error) {
    logger.error('Error getting activity thread:', error);
    res.status(500).json({
      error: 'Failed to get thread',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/activities
 * Create a new activity
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    // Check write feature flag
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const {
      id,
      type,
      title,
      content,
      assignedTo,
      status,
      priority,
      parentId,
      rootId,
      contextType,
      contextId,
      metadata,
    } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'type and title are required',
      });
    }

    const activity = await activityService.createActivity({
      id,
      type,
      title,
      content,
      createdBy: req.user!.id,
      assignedTo,
      status,
      priority,
      parentId,
      rootId,
      contextType,
      contextId,
      metadata,
    });

    res.status(201).json(activity);
  } catch (error) {
    logger.error('Error creating activity:', error);
    res.status(500).json({
      error: 'Failed to create activity',
      message: getErrorMessage(error),
    });
  }
});

/**
 * PATCH /api/activities/:id
 * Update an activity
 */
router.patch('/:id', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const { title, content, assignedTo, status, priority, metadata } = req.body;

    const activity = await activityService.updateActivity(id, {
      title,
      content,
      assignedTo,
      status,
      priority,
      metadata,
    });

    res.json(activity);
  } catch (error) {
    logger.error('Error updating activity:', error);
    res.status(500).json({
      error: 'Failed to update activity',
      message: getErrorMessage(error),
    });
  }
});

/**
 * DELETE /api/activities/:id
 * Soft delete an activity
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    await activityService.deleteActivity(id);

    res.json({ success: true, message: 'Activity deleted' });
  } catch (error) {
    logger.error('Error deleting activity:', error);
    res.status(500).json({
      error: 'Failed to delete activity',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/activities/:id/participants
 * Add a participant to an activity
 */
router.post('/:id/participants', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId and role are required',
      });
    }

    await activityService.addParticipant(id, userId, role);

    res.json({ success: true, message: 'Participant added' });
  } catch (error) {
    logger.error('Error adding participant:', error);
    res.status(500).json({
      error: 'Failed to add participant',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/:id/participants
 * Get participants for an activity
 */
router.get('/:id/participants', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const participants = await activityService.getParticipants(id);

    res.json(participants);
  } catch (error) {
    logger.error('Error getting participants:', error);
    res.status(500).json({
      error: 'Failed to get participants',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/activities/:id/reactions
 * Add a reaction to an activity
 */
router.post('/:id/reactions', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const { reactionType } = req.body;

    if (!reactionType) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'reactionType is required',
      });
    }

    await activityService.addReaction(id, req.user!.id, reactionType);

    res.json({ success: true, message: 'Reaction added' });
  } catch (error) {
    logger.error('Error adding reaction:', error);
    res.status(500).json({
      error: 'Failed to add reaction',
      message: getErrorMessage(error),
    });
  }
});

/**
 * DELETE /api/activities/:id/reactions/:reactionType
 * Remove a reaction from an activity
 */
router.delete('/:id/reactions/:reactionType', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id, reactionType } = req.params;
    await activityService.removeReaction(id, req.user!.id, reactionType);

    res.json({ success: true, message: 'Reaction removed' });
  } catch (error) {
    logger.error('Error removing reaction:', error);
    res.status(500).json({
      error: 'Failed to remove reaction',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/:id/reactions
 * Get reactions for an activity
 */
router.get('/:id/reactions', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const reactions = await activityService.getReactions(id);

    res.json(reactions);
  } catch (error) {
    logger.error('Error getting reactions:', error);
    res.status(500).json({
      error: 'Failed to get reactions',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/activities/:id/attachments
 * Get attachments for an activity
 */
router.get('/:id/attachments', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const attachments = await activityService.getAttachments(id);

    res.json(attachments);
  } catch (error) {
    logger.error('Error getting attachments:', error);
    res.status(500).json({
      error: 'Failed to get attachments',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/activities/:id/attachments
 * Add an attachment to an activity
 */
router.post('/:id/attachments', isAuthenticated, async (req, res) => {
  try {
    const enabled = await featureFlagService.isEnabled(
      'unified-activities-write',
      req.user?.id,
      req.user?.role
    );

    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    const { fileUrl, fileType, fileName, fileSize } = req.body;

    if (!fileUrl || !fileName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'fileUrl and fileName are required',
      });
    }

    const attachment = await activityService.addAttachment({
      activityId: id,
      fileUrl,
      fileType,
      fileName,
      fileSize,
      uploadedBy: req.user!.id,
    });

    res.status(201).json(attachment);
  } catch (error) {
    logger.error('Error adding attachment:', error);
    res.status(500).json({
      error: 'Failed to add attachment',
      message: getErrorMessage(error),
    });
  }
});

/**
 * POST /api/activities/:id/mark-read
 * Mark activity as read
 */
router.post('/:id/mark-read', isAuthenticated, async (req, res) => {
  try {
    const enabled = await checkActivityFeatureFlag(req);
    if (!enabled) {
      return res.status(403).json({ error: 'Feature not enabled' });
    }

    const { id } = req.params;
    await activityService.markAsRead(id, req.user!.id);

    res.json({ success: true, message: 'Marked as read' });
  } catch (error) {
    logger.error('Error marking as read:', error);
    res.status(500).json({
      error: 'Failed to mark as read',
      message: getErrorMessage(error),
    });
  }
});

export default router;
