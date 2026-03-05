import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, inArray, count, and } from 'drizzle-orm';
import { db } from '../db';
import {
  teamBoardItems,
  insertTeamBoardItemSchema,
  type TeamBoardItem,
  type InsertTeamBoardItem,
  teamBoardComments,
  insertTeamBoardCommentSchema,
  type TeamBoardComment,
  type InsertTeamBoardComment,
  teamBoardItemLikes,
  insertTeamBoardItemLikeSchema,
  type TeamBoardItemLike,
  type InsertTeamBoardItemLike,
  holdingZoneCategories,
  type HoldingZoneCategory,
  teamBoardItemCategories,
  users
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { EmailNotificationService } from '../services/email-notification-service';
// REFACTOR: Import new assignment service for dual-write
import { teamBoardAssignmentService } from '../services/assignments';
import { requirePermission, requireOwnershipPermission } from '../middleware/auth';
import { PERMISSIONS } from '../../shared/auth-utils';
import type { AuthenticatedRequest } from '../types/express';

// Input validation schemas
const createItemSchema = insertTeamBoardItemSchema
  .omit({ createdBy: true, createdByName: true })
  .extend({
    content: z.string().min(1, 'Content is required').max(2000, 'Content too long'),
    type: z.enum(['task', 'note', 'idea', 'canvas']).optional(), // Match database schema - 'reminder' removed
    categoryId: z.number().int().positive().optional().nullable(), // Holding zone category (legacy single)
    categoryIds: z.array(z.number().int().positive()).optional().nullable(), // Multiple categories
    isUrgent: z.boolean().optional(), // Urgent flag for priority items
    isPrivate: z.boolean().optional(), // Private items only visible to creator and admins
    details: z.string().max(5000, 'Details too long').optional().nullable(), // Free text details section
    dueDate: z.string().datetime().optional().nullable(), // Optional due date
    assignedTo: z.array(z.string()).nullable().optional(), // Allow assignment on creation
    assignedToNames: z.array(z.string()).nullable().optional(), // Allow assignment names on creation
    isCanvas: z.boolean().optional(),
    canvasStatus: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
    canvasSections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          cards: z
            .array(
              z.object({
                id: z.string(),
                type: z.string().default('text'),
                content: z.any(),
              })
            )
            .optional(),
        })
      )
      .optional()
      .nullable(),
  });

const updateItemSchema = z.object({
  status: z.enum(['open', 'done']).optional(),
  assignedTo: z.array(z.string()).nullable().optional(),
  assignedToNames: z.array(z.string()).nullable().optional(),
  completedAt: z.string().datetime().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(), // Holding zone category (legacy single)
  categoryIds: z.array(z.number().int().positive()).optional().nullable(), // Multiple categories
  isUrgent: z.boolean().optional(), // Urgent flag for priority items
  isPrivate: z.boolean().optional(), // Private items only visible to creator and admins
  content: z.string().min(1, 'Content is required').max(2000, 'Content too long').optional(),
  type: z.enum(['task', 'note', 'idea', 'canvas']).optional(),
  details: z.string().max(5000, 'Details too long').optional().nullable(), // Free text details section
  dueDate: z.string().datetime().optional().nullable(), // Optional due date
  isCanvas: z.boolean().optional(),
  canvasStatus: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
  canvasSections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        cards: z
          .array(
            z.object({
              id: z.string(),
              type: z.string().default('text'),
              content: z.any(),
            })
          )
          .optional(),
      })
    )
    .optional()
    .nullable(),
  canvasPublishedSnapshot: z.any().optional(),
  canvasPublishedAt: z.string().datetime().optional().nullable(),
  canvasPublishedBy: z.string().optional().nullable(),
});

const createCommentSchema = insertTeamBoardCommentSchema
  .omit({ userId: true, userName: true })
  .extend({
    content: z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment too long'),
  });

// Create team board router
export const teamBoardRouter = Router();

// GET /api/team-board/users - Get all active users for assignment
teamBoardRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching active users for team board assignment', { userId: req.user.id });

    // Fetch all active users
    const activeUsers = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.isActive, true));

    // Format user names for display
    const formattedUsers = activeUsers.map(user => ({
      id: user.id,
      email: user.email,
      name: user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    }));

    logger.info('Successfully fetched active users', { 
      count: formattedUsers.length,
      userId: req.user.id 
    });

    res.json(formattedUsers);
  } catch (error) {
    logger.error('Failed to fetch active users', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: 'An error occurred while retrieving users' 
    });
  }
});

// GET /api/team-board - Get all board items with comment counts
teamBoardRouter.get('/', requirePermission(PERMISSIONS.VIEW_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching team board items', { userId: req.user.id });

    // Determine if user is admin
    const isAdmin = req.user.role === 'super_admin' || req.user.role === 'admin';

    // Fetch all items with category information via left join
    // Filter: show public items, private items created by user, or all items if admin
    const items = await db
      .select({
        item: teamBoardItems,
        category: holdingZoneCategories,
      })
      .from(teamBoardItems)
      .leftJoin(
        holdingZoneCategories,
        eq(teamBoardItems.categoryId, holdingZoneCategories.id)
      )
      .where(
        isAdmin
          ? undefined // Admins see everything
          : and(
              // Non-admins see: public items OR items they created
              eq(teamBoardItems.isPrivate, false)
            )
      )
      .orderBy(desc(teamBoardItems.createdAt));

    // If non-admin, also fetch their private items
    const privateItems = !isAdmin
      ? await db
          .select({
            item: teamBoardItems,
            category: holdingZoneCategories,
          })
          .from(teamBoardItems)
          .leftJoin(
            holdingZoneCategories,
            eq(teamBoardItems.categoryId, holdingZoneCategories.id)
          )
          .where(
            and(
              eq(teamBoardItems.isPrivate, true),
              eq(teamBoardItems.createdBy, req.user.id)
            )
          )
          .orderBy(desc(teamBoardItems.createdAt))
      : [];

    // Combine public and private items
    const allItems = [...items, ...privateItems];

    // Flatten the results to include legacy single category info
    const flattenedItems = allItems.map(row => ({
      ...row.item,
      category: row.category, // Legacy single category from categoryId
    }));

    // Get comment counts for all items
    const itemIds = flattenedItems.map(item => item.id);

    // Fetch all categories for items from the junction table
    const itemCategoriesData = itemIds.length > 0
      ? await db
          .select({
            itemId: teamBoardItemCategories.itemId,
            categoryId: teamBoardItemCategories.categoryId,
            categoryName: holdingZoneCategories.name,
            categoryColor: holdingZoneCategories.color,
          })
          .from(teamBoardItemCategories)
          .innerJoin(
            holdingZoneCategories,
            eq(teamBoardItemCategories.categoryId, holdingZoneCategories.id)
          )
          .where(inArray(teamBoardItemCategories.itemId, itemIds))
      : [];

    // Create a map of itemId -> categories array
    const itemCategoriesMap = new Map<number, Array<{ id: number; name: string; color: string }>>();
    for (const row of itemCategoriesData) {
      if (!itemCategoriesMap.has(row.itemId)) {
        itemCategoriesMap.set(row.itemId, []);
      }
      itemCategoriesMap.get(row.itemId)!.push({
        id: row.categoryId,
        name: row.categoryName,
        color: row.categoryColor,
      });
    }
    const commentCounts = itemIds.length > 0 
      ? await db
          .select({
            itemId: teamBoardComments.itemId,
            count: count(teamBoardComments.id),
          })
          .from(teamBoardComments)
          .where(inArray(teamBoardComments.itemId, itemIds))
          .groupBy(teamBoardComments.itemId)
      : [];

    // Create a map of itemId -> comment count
    const countMap = new Map(commentCounts.map(c => [c.itemId, Number(c.count)]));

    // Get like counts and user's likes for all items in a single query
    const likeCounts = itemIds.length > 0
      ? await db
          .select({
            itemId: teamBoardItemLikes.itemId,
            count: count(teamBoardItemLikes.id),
          })
          .from(teamBoardItemLikes)
          .where(inArray(teamBoardItemLikes.itemId, itemIds))
          .groupBy(teamBoardItemLikes.itemId)
      : [];

    // Get which items the current user has liked
    const userLikes = itemIds.length > 0 && req.user?.id
      ? await db
          .select({
            itemId: teamBoardItemLikes.itemId,
          })
          .from(teamBoardItemLikes)
          .where(
            and(
              inArray(teamBoardItemLikes.itemId, itemIds),
              eq(teamBoardItemLikes.userId, req.user.id)
            )
          )
      : [];

    // Get child item counts for all items (to show how many items are nested under each)
    const childCounts = itemIds.length > 0
      ? await db
          .select({
            parentItemId: teamBoardItems.parentItemId,
            count: count(teamBoardItems.id),
          })
          .from(teamBoardItems)
          .where(inArray(teamBoardItems.parentItemId, itemIds))
          .groupBy(teamBoardItems.parentItemId)
      : [];

    // Create maps for quick lookup
    const likeCountMap = new Map(likeCounts.map(c => [c.itemId, Number(c.count)]));
    const userLikedSet = new Set(userLikes.map(l => l.itemId));
    const childCountMap = new Map(childCounts.map(c => [c.parentItemId, Number(c.count)]));

    // Add comment counts, like data, categories, and child counts to items
    const itemsWithCounts = flattenedItems.map(item => ({
      ...item,
      commentCount: countMap.get(item.id) || 0,
      likeCount: likeCountMap.get(item.id) || 0,
      userHasLiked: userLikedSet.has(item.id),
      categories: itemCategoriesMap.get(item.id) || [], // Multiple categories from junction table
      childCount: childCountMap.get(item.id) || 0, // Number of items nested under this item
    }));

    // Sort: open items first, then done items
    const sortedItems = itemsWithCounts.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // REFACTOR: Include assignments from normalized table for each item
    try {
      const itemsWithAssignments = await Promise.all(
        sortedItems.map(async (item) => {
          try {
            const assignments = await teamBoardAssignmentService.getItemAssignments(item.id);
            return {
              ...item,
              assignments,
            };
          } catch (err) {
            logger.error(`Failed to fetch assignments for team board item ${item.id}`, err);
            return item;
          }
        })
      );

      logger.info('Successfully fetched team board items with assignments', {
        count: items.length,
        userId: req.user.id
      });

      res.json(itemsWithAssignments);
    } catch (assignmentError) {
      logger.error('Failed to fetch team board assignments, returning items without assignments', assignmentError);
      logger.info('Successfully fetched team board items', {
        count: items.length,
        userId: req.user.id
      });
      res.json(sortedItems);
    }
  } catch (error) {
    logger.error('Failed to fetch team board items', error);
    res.status(500).json({ 
      error: 'Failed to fetch items',
      message: 'An error occurred while retrieving board items' 
    });
  }
});

// POST /api/team-board - Create new board item
teamBoardRouter.post('/', requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate input data
    const validation = createItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues
      });
    }

    const itemData = validation.data;

    logger.info('Creating new team board item', { 
      userId: req.user.id,
      type: itemData.type 
    });

    const displayName = req.user.displayName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    // Determine category IDs - prefer categoryIds array, fallback to single categoryId
    const categoryIdsToAssign = itemData.categoryIds && itemData.categoryIds.length > 0
      ? itemData.categoryIds
      : itemData.categoryId
        ? [itemData.categoryId]
        : [];

    const isCanvas = itemData.isCanvas === true || itemData.type === 'canvas';
    const canvasSections = isCanvas
      ? itemData.canvasSections && itemData.canvasSections.length > 0
        ? itemData.canvasSections
        : [
            { id: 'context', title: 'Context', cards: [{ id: 'context-1', type: 'text', content: itemData.details || '' }] },
            { id: 'working-notes', title: 'Working Notes', cards: [] },
          ]
      : null;
    const canvasStatus = isCanvas ? itemData.canvasStatus || 'draft' : null;

    // Prepare the item data for insertion (keep legacy categoryId for backward compatibility)
    const newItem: InsertTeamBoardItem = {
      content: itemData.content,
      type: isCanvas ? 'canvas' : itemData.type || 'note',
      createdBy: req.user.id,
      createdByName: displayName,
      status: 'open',
      assignedTo: itemData.assignedTo ?? null,
      assignedToNames: itemData.assignedToNames ?? null,
      completedAt: null,
      categoryId: categoryIdsToAssign.length > 0 ? categoryIdsToAssign[0] : null, // Keep first category for legacy
      isUrgent: itemData.isUrgent ?? false,
      isPrivate: itemData.isPrivate ?? false,
      details: itemData.details ?? null,
      dueDate: itemData.dueDate ? new Date(itemData.dueDate) : null,
      isCanvas,
      canvasSections,
      canvasStatus: canvasStatus || 'draft',
      canvasPublishedSnapshot: null,
      canvasPublishedAt: null,
      canvasPublishedBy: null,
    };

    // Insert the new item
    const [createdItem] = await db
      .insert(teamBoardItems)
      .values(newItem)
      .returning();

    // Insert category associations into junction table
    if (categoryIdsToAssign.length > 0) {
      await db.insert(teamBoardItemCategories).values(
        categoryIdsToAssign.map(catId => ({
          itemId: createdItem.id,
          categoryId: catId,
        }))
      );
    }

    logger.info('Successfully created team board item', {
      itemId: createdItem.id,
      userId: req.user.id,
      categoryCount: categoryIdsToAssign.length,
    });

    // Process mentions in the item content asynchronously
    EmailNotificationService.processTeamBoardItemMentions(
      itemData.content,
      req.user.id,
      displayName,
      createdItem.id
    ).catch((error) => {
      logger.error('Failed to process team board item mentions', error);
    });

    res.status(201).json(createdItem);
  } catch (error) {
    logger.error('Failed to create team board item', error);
    res.status(500).json({ 
      error: 'Failed to create item',
      message: 'An error occurred while creating the item' 
    });
  }
});

// PATCH /api/team-board/:id - Update item (claim, complete, etc.)
// SECURITY: Layered permission enforcement
// 1. requirePermission ensures user currently has SUBMIT capability
// 2. requireOwnershipPermission verifies user is owner OR has MANAGE
// This prevents revoked submitters from accessing resources they created
teamBoardRouter.patch('/:id', 
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), // First: check user has SUBMIT
  requireOwnershipPermission(
    PERMISSIONS.SUBMIT_HOLDING_ZONE, // Can edit own items
    PERMISSIONS.MANAGE_HOLDING_ZONE, // Can edit any items
    async (req: AuthenticatedRequest) => {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) return null;
      
      const [item] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);
      
      return item?.createdBy || null;
    }
  ), // Then: check ownership OR MANAGE
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Validate update data
    const validation = updateItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid update data',
        details: validation.error.issues
      });
    }

    const updateData = validation.data;

    logger.info('Updating team board item', { 
      itemId,
      userId: req.user.id,
      status: updateData.status 
    });

    // Get the existing item before updating to check for assignment changes
    const [existingItem] = await db
      .select()
      .from(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Determine category IDs if updating categories
    const categoryIdsToAssign = updateData.categoryIds !== undefined
      ? (updateData.categoryIds || [])
      : updateData.categoryId !== undefined
        ? (updateData.categoryId ? [updateData.categoryId] : [])
        : null; // null means don't update categories

    // Prepare update data, setting legacy categoryId if categories are being updated
    const willBeCanvas =
      updateData.isCanvas === true ||
      updateData.type === 'canvas' ||
      existingItem.isCanvas === true;

    const dbUpdateData = {
      ...updateData,
      isCanvas: willBeCanvas,
      ...(willBeCanvas
        ? {
            canvasStatus: updateData.canvasStatus || existingItem.canvasStatus || 'draft',
            canvasSections:
              updateData.canvasSections !== undefined
                ? updateData.canvasSections
                : existingItem.canvasSections,
            canvasPublishedSnapshot:
              updateData.canvasPublishedSnapshot !== undefined
                ? updateData.canvasPublishedSnapshot
                : existingItem.canvasPublishedSnapshot,
            canvasPublishedAt:
              updateData.canvasPublishedAt !== undefined
                ? updateData.canvasPublishedAt
                : existingItem.canvasPublishedAt,
            canvasPublishedBy:
              updateData.canvasPublishedBy !== undefined
                ? updateData.canvasPublishedBy
                : existingItem.canvasPublishedBy,
          }
        : {
            canvasSections: null,
            canvasStatus: null,
            canvasPublishedSnapshot: null,
            canvasPublishedAt: null,
            canvasPublishedBy: null,
          }),
      ...(updateData.completedAt ? { completedAt: new Date(updateData.completedAt) } : {}),
      ...(updateData.dueDate !== undefined ? { dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null } : {}),
      ...(categoryIdsToAssign !== null ? { categoryId: categoryIdsToAssign.length > 0 ? categoryIdsToAssign[0] : null } : {}),
    };
    // Remove categoryIds from db update since it's not a column
    delete (dbUpdateData as any).categoryIds;

    // Update the item
    const [updatedItem] = await db
      .update(teamBoardItems)
      .set(dbUpdateData)
      .where(eq(teamBoardItems.id, itemId))
      .returning();

    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Update categories in junction table if provided
    if (categoryIdsToAssign !== null) {
      // Delete existing category associations
      await db
        .delete(teamBoardItemCategories)
        .where(eq(teamBoardItemCategories.itemId, itemId));

      // Insert new category associations
      if (categoryIdsToAssign.length > 0) {
        await db.insert(teamBoardItemCategories).values(
          categoryIdsToAssign.map(catId => ({
            itemId,
            categoryId: catId,
          }))
        );
      }
    }

    // REFACTOR: Dual-write to team_board_assignments table
    if (updateData.assignedTo !== undefined) {
      try {
        // Build assignments from assignedTo and assignedToNames
        const assignedTo = updateData.assignedTo || [];
        const assignedToNames = updateData.assignedToNames || [];

        const assignments = assignedTo.map((userId: string, index: number) => ({
          userId,
          userName: assignedToNames[index] || 'Unknown',
        }));

        await teamBoardAssignmentService.replaceItemAssignments(
          itemId,
          assignments
        );
        logger.info(`Synced ${assignments.length} team board assignments for item ${itemId}`);
      } catch (syncError) {
        logger.error('Failed to sync team board assignments:', syncError);
        // Don't fail the item update if assignment sync fails
      }
    }

    // Check if assignment changed and send email notifications to newly assigned users
    if (updateData.assignedTo && updateData.assignedTo.length > 0) {
      const oldAssignedTo = existingItem.assignedTo || [];
      const newAssignedTo = updateData.assignedTo;
      
      // Find newly assigned users (those not previously assigned)
      const newlyAssignedUsers = newAssignedTo.filter(
        (userId) => !oldAssignedTo.includes(userId)
      );

      // Send email notifications to newly assigned users
      if (newlyAssignedUsers.length > 0) {
        const assignerName = req.user.displayName || 
                            `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || 
                            req.user.email;
        
        // Send notifications asynchronously (don't block the response)
        EmailNotificationService.sendTeamBoardAssignmentNotification(
          newlyAssignedUsers,
          updatedItem.id,
          updatedItem.content,
          updatedItem.type,
          assignerName
        ).catch((error) => {
          logger.error('Failed to send team board assignment notification', error);
        });

        logger.info('Team board assignment notifications queued', {
          itemId: updatedItem.id,
          newlyAssignedCount: newlyAssignedUsers.length
        });
      }
    }

    logger.info('Successfully updated team board item', { 
      itemId,
      userId: req.user.id,
      newStatus: updateData.status 
    });

    res.json(updatedItem);
  } catch (error) {
    logger.error('Failed to update team board item', error);
    res.status(500).json({ 
      error: 'Failed to update item',
      message: 'An error occurred while updating the item' 
    });
  }
});

// DELETE /api/team-board/:id - Delete item
// SECURITY: Layered permission enforcement
// 1. requirePermission ensures user currently has SUBMIT capability
// 2. requireOwnershipPermission verifies user is owner OR has MANAGE
// This prevents revoked submitters from accessing resources they created
teamBoardRouter.delete('/:id', 
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE), // First: check user has SUBMIT
  requireOwnershipPermission(
    PERMISSIONS.SUBMIT_HOLDING_ZONE, // Can delete own items
    PERMISSIONS.MANAGE_HOLDING_ZONE, // Can delete any items
    async (req: AuthenticatedRequest) => {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) return null;
      
      const [item] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);
      
      return item?.createdBy || null;
    }
  ), // Then: check ownership OR MANAGE
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    logger.info('Deleting team board item', { 
      itemId,
      userId: req.user.id 
    });

    // Delete the item
    const result = await db
      .delete(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId));

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    logger.info('Successfully deleted team board item', { 
      itemId,
      userId: req.user.id 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete team board item', error);
    res.status(500).json({ 
      error: 'Failed to delete item',
      message: 'An error occurred while deleting the item' 
    });
  }
});

// GET /api/team-board/:id/comments - Get all comments for a board item
teamBoardRouter.get('/:id/comments', requirePermission(PERMISSIONS.VIEW_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    logger.info('Fetching comments for team board item', { 
      itemId,
      userId: req.user.id 
    });

    // Fetch all comments for this item, ordered by creation date (oldest first for chronological reading)
    const comments = await db
      .select()
      .from(teamBoardComments)
      .where(eq(teamBoardComments.itemId, itemId))
      .orderBy(teamBoardComments.createdAt);

    logger.info('Successfully fetched comments', { 
      itemId,
      count: comments.length,
      userId: req.user.id 
    });

    res.json(comments);
  } catch (error) {
    logger.error('Failed to fetch comments', error);
    res.status(500).json({ 
      error: 'Failed to fetch comments',
      message: 'An error occurred while retrieving comments' 
    });
  }
});

// POST /api/team-board/:id/comments - Create a new comment
teamBoardRouter.post('/:id/comments', requirePermission(PERMISSIONS.COMMENT_HOLDING_ZONE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const itemId = parseInt(req.params.id);
    if (isNaN(itemId)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    // Validate input data
    const validation = createCommentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid comment data',
        details: validation.error.issues
      });
    }

    const commentData = validation.data;

    logger.info('Creating comment on team board item', { 
      itemId,
      userId: req.user.id 
    });

    const displayName = req.user.displayName || `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    // Prepare the comment data for insertion
    const newComment: InsertTeamBoardComment = {
      itemId,
      userId: req.user.id,
      userName: displayName,
      content: commentData.content,
    };

    // Insert the new comment
    const [createdComment] = await db
      .insert(teamBoardComments)
      .values(newComment)
      .returning();

    logger.info('Successfully created comment', {
      commentId: createdComment.id,
      itemId,
      userId: req.user.id
    });

    // Process mentions in the comment asynchronously (don't block the response)
    // First, fetch the item to get its content
    const [item] = await db
      .select()
      .from(teamBoardItems)
      .where(eq(teamBoardItems.id, itemId))
      .limit(1);

    if (item) {
      EmailNotificationService.processTeamBoardComment(
        commentData.content,
        req.user.id,
        displayName,
        itemId,
        item.content
      ).catch((error) => {
        logger.error('Failed to process team board comment mentions', error);
      });

      logger.info('Team board comment mention processing queued', {
        commentId: createdComment.id,
        itemId
      });
    }

    res.status(201).json(createdComment);
  } catch (error) {
    logger.error('Failed to create comment', error);
    res.status(500).json({ 
      error: 'Failed to create comment',
      message: 'An error occurred while creating the comment' 
    });
  }
});

// DELETE /api/team-board/comments/:commentId - Delete a comment
teamBoardRouter.delete('/comments/:commentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    logger.info('Deleting team board comment', { 
      commentId,
      userId: req.user.id 
    });

    // Check if comment exists and belongs to user (or user is admin)
    const [comment] = await db
      .select()
      .from(teamBoardComments)
      .where(eq(teamBoardComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only allow deletion if the user created the comment or is an admin
    const isAdmin = req.user.permissions?.includes('ADMIN_ACCESS');
    if (comment.userId !== req.user.id && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Delete the comment
    const result = await db
      .delete(teamBoardComments)
      .where(eq(teamBoardComments.id, commentId));

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    logger.info('Successfully deleted comment', { 
      commentId,
      userId: req.user.id 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete comment', error);
    res.status(500).json({
      error: 'Failed to delete comment',
      message: 'An error occurred while deleting the comment'
    });
  }
});

// PATCH /api/team-board/comments/:commentId - Edit a comment
teamBoardRouter.patch('/comments/:commentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    logger.info('Editing team board comment', {
      commentId,
      userId: req.user.id
    });

    // Check if comment exists and belongs to user
    const [comment] = await db
      .select()
      .from(teamBoardComments)
      .where(eq(teamBoardComments.id, commentId));

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check permissions: user must own the comment OR have MANAGE permission
    const hasManagePermission = req.user.permissions?.includes(PERMISSIONS.MANAGE_HOLDING_ZONE);
    const hasEditPermission = req.user.permissions?.includes(PERMISSIONS.EDIT_OWN_COMMENTS_HOLDING_ZONE);

    if (comment.userId !== req.user.id && !hasManagePermission) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    if (comment.userId === req.user.id && !hasEditPermission && !hasManagePermission) {
      return res.status(403).json({ error: 'You do not have permission to edit comments' });
    }

    // Update the comment
    const [updatedComment] = await db
      .update(teamBoardComments)
      .set({ content: content.trim() })
      .where(eq(teamBoardComments.id, commentId))
      .returning();

    if (!updatedComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Process mentions in the edited comment
    const [item] = await db
      .select()
      .from(teamBoardItems)
      .where(eq(teamBoardItems.id, comment.itemId))
      .limit(1);

    if (item) {
      const displayName = req.user.displayName || req.user.email || 'Unknown User';
      EmailNotificationService.processTeamBoardComment(
        content.trim(),
        req.user.id,
        displayName,
        comment.itemId,
        item.content
      ).catch((error) => {
        logger.error('Failed to process edited comment mentions', error);
      });
    }

    logger.info('Successfully edited comment', {
      commentId,
      userId: req.user.id
    });

    res.json(updatedComment);
  } catch (error) {
    logger.error('Failed to edit comment', error);
    res.status(500).json({
      error: 'Failed to edit comment',
      message: 'An error occurred while editing the comment'
    });
  }
});

// POST /:id/assignments - Add assignment to team board item
teamBoardRouter.post(
  '/:id/assignments',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const { userId, userName } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({
          error: 'Missing required fields: userId and userName are required'
        });
      }

      const assignment = await teamBoardAssignmentService.addAssignment(
        itemId,
        userId
      );

      logger.info('Successfully added team board assignment', {
        itemId,
        userId,
        addedBy: req.user.id
      });

      res.status(201).json(assignment);
    } catch (error) {
      logger.error('Failed to add team board assignment', error);
      res.status(500).json({ error: 'Failed to add team board assignment' });
    }
  }
);

// DELETE /:id/assignments/:userId - Remove assignment from team board item
teamBoardRouter.delete(
  '/:id/assignments/:userId',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      const { userId } = req.params;

      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await teamBoardAssignmentService.removeAssignment(itemId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      logger.info('Successfully removed team board assignment', {
        itemId,
        userId,
        removedBy: req.user.id
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to remove team board assignment', error);
      res.status(500).json({ error: 'Failed to remove team board assignment' });
    }
  }
);

// GET /:id/assignments - Get all assignments for a team board item
teamBoardRouter.get(
  '/:id/assignments',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);

      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const assignments = await teamBoardAssignmentService.getItemAssignments(itemId);

      logger.info('Successfully fetched team board assignments', {
        itemId,
        count: assignments.length
      });

      res.json(assignments);
    } catch (error) {
      logger.error('Failed to fetch team board assignments', error);
      res.status(500).json({ error: 'Failed to fetch team board assignments' });
    }
  }
);

// ==========================================
// Like/Unlike Team Board Items
// ==========================================

// POST /api/team-board/items/:id/like - Like a team board item
teamBoardRouter.post(
  '/items/:id/like',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Check if item exists
      const item = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);

      if (item.length === 0) {
        return res.status(404).json({ error: 'Team board item not found' });
      }

      // Insert like (will fail silently if already liked due to unique constraint)
      try {
        await db.insert(teamBoardItemLikes).values({
          itemId,
          userId,
        });

        logger.info('User liked team board item', { userId, itemId });
      } catch (error: any) {
        // Check if it's a duplicate key error (already liked)
        if (error.code === '23505') {
          // Already liked, just return success
          logger.debug('User already liked this item', { userId, itemId });
        } else {
          throw error;
        }
      }

      // Get updated like count
      const [likeCount] = await db
        .select({ count: count() })
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      res.json({ success: true, likeCount: likeCount?.count || 0 });
    } catch (error) {
      logger.error('Failed to like team board item', error);
      res.status(500).json({ error: 'Failed to like item' });
    }
  }
);

// DELETE /api/team-board/items/:id/like - Unlike a team board item
teamBoardRouter.delete(
  '/items/:id/like',
  requirePermission(PERMISSIONS.SUBMIT_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Delete the like
      await db
        .delete(teamBoardItemLikes)
        .where(
          and(
            eq(teamBoardItemLikes.itemId, itemId),
            eq(teamBoardItemLikes.userId, userId)
          )
        );

      logger.info('User unliked team board item', { userId, itemId });

      // Get updated like count
      const [likeCount] = await db
        .select({ count: count() })
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      res.json({ success: true, likeCount: likeCount?.count || 0 });
    } catch (error) {
      logger.error('Failed to unlike team board item', error);
      res.status(500).json({ error: 'Failed to unlike item' });
    }
  }
);

// GET /api/team-board/items/:id/likes - Get likes for an item
teamBoardRouter.get(
  '/items/:id/likes',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.id);

      const likes = await db
        .select()
        .from(teamBoardItemLikes)
        .where(eq(teamBoardItemLikes.itemId, itemId));

      const userHasLiked = req.user?.id
        ? likes.some(like => like.userId === req.user?.id)
        : false;

      res.json({
        likes: likes.length,
        userHasLiked,
        likedBy: likes.map(like => like.userId),
      });
    } catch (error) {
      logger.error('Failed to fetch likes for team board item', error);
      res.status(500).json({ error: 'Failed to fetch likes' });
    }
  }
);

// POST /api/team-board/:id/promote - Move holding zone item to To-Do List (instead of promoting to project tasks)
teamBoardRouter.post(
  '/:id/promote',
  requirePermission(PERMISSIONS.MANAGE_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      // Validation schema for promote request - now supports multiple assignees and due dates
      const promoteSchema = z.object({
        assignedTo: z.array(z.string()).optional().nullable(), // Array of user IDs
        assignedToNames: z.array(z.string()).optional().nullable(), // Array of user display names
        dueDate: z.string().optional().nullable(), // ISO date string
      });

      const validation = promoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const { assignedTo, assignedToNames, dueDate } = validation.data;

      logger.info('Moving holding zone item to To-Do List', {
        itemId,
        userId: req.user.id,
        assignedTo: assignedTo?.length || 0,
        hasDueDate: !!dueDate,
      });

      // Get the holding zone item
      const [holdingZoneItem] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);

      if (!holdingZoneItem) {
        return res.status(404).json({ error: 'Holding zone item not found' });
      }

      // Check if already in todo status
      if (holdingZoneItem.status === 'todo') {
        return res.status(400).json({
          error: 'Item is already in the To-Do List',
        });
      }

      // Update the holding zone item to move it to To-Do List
      // Merge existing assignees with new ones if provided
      const finalAssignedTo = assignedTo && assignedTo.length > 0 
        ? assignedTo 
        : holdingZoneItem.assignedTo || [];
      const finalAssignedToNames = assignedToNames && assignedToNames.length > 0
        ? assignedToNames
        : holdingZoneItem.assignedToNames || [];
      
      // Parse due date if provided
      const finalDueDate = dueDate ? new Date(dueDate) : (holdingZoneItem.dueDate ? new Date(holdingZoneItem.dueDate) : null);

      const [updatedItem] = await db
        .update(teamBoardItems)
        .set({
          status: 'todo', // Move to To-Do List status
          assignedTo: finalAssignedTo,
          assignedToNames: finalAssignedToNames,
          dueDate: finalDueDate,
        })
        .where(eq(teamBoardItems.id, itemId))
        .returning();

      logger.info('Successfully moved holding zone item to To-Do List', {
        itemId,
        userId: req.user.id,
        status: updatedItem.status,
      });

      res.status(200).json({
        success: true,
        item: updatedItem,
        message: 'Item moved to To-Do List',
      });
    } catch (error) {
      logger.error('Failed to move holding zone item to To-Do List', error);
      res.status(500).json({
        error: 'Failed to move item',
        message: 'An error occurred while moving the item to the To-Do List',
      });
    }
  }
);

// PATCH /api/team-board/:id/link - Link or unlink an item to/from a parent item
teamBoardRouter.patch(
  '/:id/link',
  requirePermission(PERMISSIONS.MANAGE_HOLDING_ZONE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      // Validation schema for link request
      const linkSchema = z.object({
        parentItemId: z.number().int().positive().nullable().optional(), // null to unlink, number to link
      });

      const validation = linkSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const { parentItemId } = validation.data;

      logger.info('Linking/unlinking holding zone item', {
        itemId,
        parentItemId: parentItemId || null,
        userId: req.user.id,
      });

      // Get the item to link
      const [item] = await db
        .select()
        .from(teamBoardItems)
        .where(eq(teamBoardItems.id, itemId))
        .limit(1);

      if (!item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Prevent circular references - check if parentItemId would create a cycle
      if (parentItemId) {
        // Check if the parent item is a child of this item (directly or indirectly)
        let currentParentId = parentItemId;
        const visited = new Set<number>([itemId]); // Start with current item to prevent self-reference
        
        while (currentParentId) {
          if (visited.has(currentParentId)) {
            return res.status(400).json({
              error: 'Circular reference detected',
              message: 'Cannot link item to a parent that would create a circular reference',
            });
          }
          
          visited.add(currentParentId);
          
          const [parentItem] = await db
            .select({ parentItemId: teamBoardItems.parentItemId })
            .from(teamBoardItems)
            .where(eq(teamBoardItems.id, currentParentId))
            .limit(1);
          
          if (!parentItem) break;
          currentParentId = parentItem.parentItemId || undefined;
        }
      }

      // Update the item's parent
      const [updatedItem] = await db
        .update(teamBoardItems)
        .set({
          parentItemId: parentItemId || null,
        })
        .where(eq(teamBoardItems.id, itemId))
        .returning();

      logger.info('Successfully linked/unlinked holding zone item', {
        itemId,
        parentItemId: updatedItem.parentItemId,
        userId: req.user.id,
      });

      res.status(200).json({
        success: true,
        item: updatedItem,
        message: parentItemId ? 'Item linked to parent' : 'Item unlinked from parent',
      });
    } catch (error) {
      logger.error('Failed to link/unlink holding zone item', error);
      res.status(500).json({
        error: 'Failed to link/unlink item',
        message: 'An error occurred while linking/unlinking the item',
      });
    }
  }
);

export default teamBoardRouter;
