import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/production-safe-logger';
import type { RouterDependencies } from '../types';

/**
 * Holding Zone Collaboration API Routes
 *
 * Provides REST endpoints for:
 * - Comments on holding zone items
 * - Field locking for concurrent editing
 * - Edit revision history
 *
 * These work in conjunction with Socket.IO real-time collaboration
 *
 * Permission Requirements:
 * - All endpoints require authentication (isAuthenticated middleware)
 * - All endpoints require VIEW_HOLDING_ZONE permission for reads
 * - Mutation endpoints require MANAGE_HOLDING_ZONE permission
 */

// Validation schemas
const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
  parentCommentId: z.number().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
});

const acquireLockSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required'),
  expiresInMinutes: z.number().min(1).max(30).optional().default(5),
});

export function createHoldingZoneCollaborationRouter(deps: RouterDependencies) {
  const router = Router();
  const { storage, requirePermission } = deps;

  // Note: Authentication is applied at mount time in server/routes/index.ts
  // Permissions are applied per-endpoint: VIEW for reads, MANAGE for mutations

  // ============================================================================
  // COMMENTS ENDPOINTS
  // ============================================================================

  /**
   * GET /api/holding-zone/:id/collaboration/comments
   * Get all comments for a holding zone item
   * Permission: VIEW_HOLDING_ZONE
   */
  router.get('/:id/collaboration/comments', requirePermission('VIEW_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;

      // For holding-zone, we use 'main' as a single shared space
      // But still accept the ID parameter for consistency
      const comments = await storage.getHoldingZoneCollaborationComments(itemId);

      res.json({ comments: comments || [] });
    } catch (error) {
      // Return empty array if collaboration tables don't exist yet
      if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
        return res.json({ comments: [] });
      }
      logger.error('[Holding Zone Collaboration] Error fetching comments:', error);
      res.status(500).json({
        error: 'Failed to fetch comments',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/holding-zone/:id/collaboration/comments
   * Create a new comment on a holding zone item
   * Permission: MANAGE_HOLDING_ZONE
   */
  router.post('/:id/collaboration/comments', requirePermission('MANAGE_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createCommentSchema.parse(req.body);

      const comment = await storage.createHoldingZoneCollaborationComment({
        holdingZoneId: itemId,
        userId: req.user.id,
        userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'Unknown User',
        content: validatedData.content,
        parentCommentId: validatedData.parentCommentId,
      });

      res.status(201).json({ comment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      logger.error('[Holding Zone Collaboration] Error creating comment:', error);
      res.status(500).json({
        error: 'Failed to create comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * PATCH /api/holding-zone/:id/collaboration/comments/:commentId
   * Edit an existing comment
   * Permission: MANAGE_HOLDING_ZONE
   */
  router.patch('/:id/collaboration/comments/:commentId', requirePermission('MANAGE_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;
      const commentId = parseInt(req.params.commentId, 10);

      if (isNaN(commentId)) {
        return res.status(400).json({ error: 'Invalid comment ID' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = updateCommentSchema.parse(req.body);

      const comment = await storage.updateHoldingZoneCollaborationComment(
        commentId,
        req.user.id,
        validatedData.content
      );

      if (!comment) {
        return res.status(404).json({
          error: 'Comment not found or unauthorized'
        });
      }

      res.json({ comment });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      logger.error('[Holding Zone Collaboration] Error updating comment:', error);
      res.status(500).json({
        error: 'Failed to update comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /api/holding-zone/:id/collaboration/comments/:commentId
   * Delete a comment
   * Permission: MANAGE_HOLDING_ZONE
   */
  router.delete('/:id/collaboration/comments/:commentId', requirePermission('MANAGE_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;
      const commentId = parseInt(req.params.commentId, 10);

      if (isNaN(commentId)) {
        return res.status(400).json({ error: 'Invalid comment ID' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const success = await storage.deleteHoldingZoneCollaborationComment(
        commentId,
        req.user.id
      );

      if (!success) {
        return res.status(404).json({
          error: 'Comment not found or unauthorized'
        });
      }

      res.status(204).send();
    } catch (error) {
      logger.error('[Holding Zone Collaboration] Error deleting comment:', error);
      res.status(500).json({
        error: 'Failed to delete comment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============================================================================
  // FIELD LOCKING ENDPOINTS
  // ============================================================================

  /**
   * GET /api/holding-zone/:id/collaboration/locks
   * Get all active field locks for a holding zone item
   * Permission: VIEW_HOLDING_ZONE
   */
  router.get('/:id/collaboration/locks', requirePermission('VIEW_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;

      const locks = await storage.getHoldingZoneFieldLocks(itemId);

      res.json({ locks: locks || [] });
    } catch (error) {
      // Return empty array if collaboration tables don't exist yet
      if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
        return res.json({ locks: [] });
      }
      logger.error('[Holding Zone Collaboration] Error fetching locks:', error);
      res.status(500).json({
        error: 'Failed to fetch field locks',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/holding-zone/:id/collaboration/locks
   * Acquire a field lock
   * Permission: MANAGE_HOLDING_ZONE
   */
  router.post('/:id/collaboration/locks', requirePermission('MANAGE_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = acquireLockSchema.parse(req.body);

      const lock = await storage.acquireHoldingZoneFieldLock({
        holdingZoneId: itemId,
        userId: req.user.id,
        userName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'Unknown User',
        fieldName: validatedData.fieldName,
        expiresInMinutes: validatedData.expiresInMinutes,
      });

      if (!lock) {
        return res.status(409).json({
          error: 'Field is already locked by another user'
        });
      }

      res.status(201).json({ lock });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }

      logger.error('[Holding Zone Collaboration] Error acquiring lock:', error);
      res.status(500).json({
        error: 'Failed to acquire field lock',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * DELETE /api/holding-zone/:id/collaboration/locks/:fieldName
   * Release a field lock
   * Permission: MANAGE_HOLDING_ZONE
   */
  router.delete('/:id/collaboration/locks/:fieldName', requirePermission('MANAGE_HOLDING_ZONE'), async (req, res) => {
    try {
      const itemId = req.params.id;
      const fieldName = req.params.fieldName;

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const success = await storage.releaseHoldingZoneFieldLock(
        itemId,
        fieldName,
        req.user.id
      );

      if (!success) {
        return res.status(404).json({
          error: 'Lock not found or unauthorized'
        });
      }

      res.status(204).send();
    } catch (error) {
      // Return success if collaboration tables don't exist yet (lock can't exist anyway)
      if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('relation'))) {
        return res.status(204).send();
      }
      logger.error('[Holding Zone Collaboration] Error releasing lock:', error);
      res.status(500).json({
        error: 'Failed to release field lock',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createHoldingZoneCollaborationRouter;