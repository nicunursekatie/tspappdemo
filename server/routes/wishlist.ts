import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, or } from 'drizzle-orm';
import { db } from '../db';
import {
  wishlistSuggestions,
  insertWishlistSuggestionSchema,
  type WishlistSuggestion,
  type InsertWishlistSuggestion
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import type { AuthenticatedRequest } from '../types/express';

// Input validation schemas
const createSuggestionSchema = insertWishlistSuggestionSchema
  .omit({ suggestedBy: true, reviewedBy: true })
  .extend({
    item: z.string().min(1, 'Item name is required').max(500, 'Item name too long'),
    reason: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
  });

const updateSuggestionSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'added']),
  adminNotes: z.string().optional(),
  amazonUrl: z.string().url().optional().or(z.literal('')),
  estimatedCost: z.number().positive().optional(),
});

// Create suggestions router (standard middleware is applied by the parent router)
export const wishlistSuggestionsRouter = Router();

// GET /api/wishlist-suggestions - Return all wishlist suggestions from database
wishlistSuggestionsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Fetching wishlist suggestions', { userId: req.user.id });

    // Fetch all wishlist suggestions ordered by creation date (newest first)
    const suggestions = await db
      .select()
      .from(wishlistSuggestions)
      .orderBy(desc(wishlistSuggestions.createdAt));

    // Transform the data to include user-friendly information
    const formattedSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      // Ensure dates are properly formatted
      createdAt: suggestion.createdAt.toISOString(),
      updatedAt: suggestion.updatedAt.toISOString(),
      reviewedAt: suggestion.reviewedAt?.toISOString() || null,
    }));

    logger.info('Successfully fetched wishlist suggestions', { 
      count: suggestions.length,
      userId: req.user.id 
    });

    res.json(formattedSuggestions);
  } catch (error) {
    logger.error('Failed to fetch wishlist suggestions', error);
    res.status(500).json({ 
      error: 'Failed to fetch wishlist suggestions',
      message: 'An error occurred while retrieving suggestions' 
    });
  }
});

// POST /api/wishlist-suggestions - Create new wishlist suggestion
wishlistSuggestionsRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate input data
    const validation = createSuggestionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues
      });
    }

    const suggestionData = validation.data;

    logger.info('Creating new wishlist suggestion', { 
      userId: req.user.id,
      item: suggestionData.item 
    });

    // Prepare the suggestion data for insertion
    const newSuggestion: InsertWishlistSuggestion = {
      item: suggestionData.item,
      reason: suggestionData.reason || null,
      priority: suggestionData.priority,
      suggestedBy: req.user.id,
      status: 'pending',
      adminNotes: null,
      amazonUrl: null,
      estimatedCost: null,
      reviewedBy: null,
    };

    // Insert the new suggestion
    const [createdSuggestion] = await db
      .insert(wishlistSuggestions)
      .values(newSuggestion)
      .returning();

    // Format the response
    const formattedSuggestion = {
      ...createdSuggestion,
      createdAt: createdSuggestion.createdAt.toISOString(),
      updatedAt: createdSuggestion.updatedAt.toISOString(),
      reviewedAt: createdSuggestion.reviewedAt?.toISOString() || null,
    };

    logger.info('Successfully created wishlist suggestion', { 
      suggestionId: createdSuggestion.id,
      userId: req.user.id 
    });

    res.status(201).json(formattedSuggestion);
  } catch (error) {
    logger.error('Failed to create wishlist suggestion', error);
    res.status(500).json({ 
      error: 'Failed to create suggestion',
      message: 'An error occurred while creating the suggestion' 
    });
  }
});

// PATCH /api/wishlist-suggestions/:id - Update suggestion status (approve/reject)
wishlistSuggestionsRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const suggestionId = parseInt(req.params.id);
    if (isNaN(suggestionId)) {
      return res.status(400).json({ error: 'Invalid suggestion ID' });
    }

    // Validate update data
    const validation = updateSuggestionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid update data',
        details: validation.error.issues
      });
    }

    const updateData = validation.data;

    logger.info('Updating wishlist suggestion', { 
      suggestionId,
      userId: req.user.id,
      status: updateData.status 
    });

    // Update the suggestion
    const [updatedSuggestion] = await db
      .update(wishlistSuggestions)
      .set({
        ...updateData,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wishlistSuggestions.id, suggestionId))
      .returning();

    if (!updatedSuggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Format the response
    const formattedSuggestion = {
      ...updatedSuggestion,
      createdAt: updatedSuggestion.createdAt.toISOString(),
      updatedAt: updatedSuggestion.updatedAt.toISOString(),
      reviewedAt: updatedSuggestion.reviewedAt?.toISOString() || null,
    };

    logger.info('Successfully updated wishlist suggestion', { 
      suggestionId,
      userId: req.user.id,
      newStatus: updateData.status 
    });

    res.json(formattedSuggestion);
  } catch (error) {
    logger.error('Failed to update wishlist suggestion', error);
    res.status(500).json({ 
      error: 'Failed to update suggestion',
      message: 'An error occurred while updating the suggestion' 
    });
  }
});

// DELETE /api/wishlist-suggestions/:id - Delete suggestion
wishlistSuggestionsRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const suggestionId = parseInt(req.params.id);
    if (isNaN(suggestionId)) {
      return res.status(400).json({ error: 'Invalid suggestion ID' });
    }

    logger.info('Deleting wishlist suggestion', { 
      suggestionId,
      userId: req.user.id 
    });

    // Delete the suggestion
    const result = await db
      .delete(wishlistSuggestions)
      .where(eq(wishlistSuggestions.id, suggestionId));

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    logger.info('Successfully deleted wishlist suggestion', { 
      suggestionId,
      userId: req.user.id 
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete wishlist suggestion', error);
    res.status(500).json({ 
      error: 'Failed to delete suggestion',
      message: 'An error occurred while deleting the suggestion' 
    });
  }
});

// Create activity router (standard middleware is applied by the parent router)
export const wishlistActivityRouter = Router();

// GET /api/wishlist-activity - Return recent wishlist activity/history
wishlistActivityRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = '10' } = req.query;
    const activityLimit = Math.min(parseInt(limit as string) || 10, 50); // Cap at 50 items

    logger.info('Fetching wishlist activity', { 
      userId: req.user.id,
      limit: activityLimit 
    });

    // Fetch recent activity (approved or added items)
    const activity = await db
      .select()
      .from(wishlistSuggestions)
      .where(
        or(
          eq(wishlistSuggestions.status, 'approved'),
          eq(wishlistSuggestions.status, 'added')
        )
      )
      .orderBy(desc(wishlistSuggestions.updatedAt))
      .limit(activityLimit);

    // Transform the data for activity display
    const formattedActivity = activity.map(item => ({
      id: item.id,
      item: item.item,
      status: item.status,
      priority: item.priority,
      estimatedCost: item.estimatedCost,
      amazonUrl: item.amazonUrl,
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString(),
      reviewedAt: item.reviewedAt?.toISOString() || null,
    }));

    logger.info('Successfully fetched wishlist activity', { 
      count: activity.length,
      userId: req.user.id 
    });

    res.json(formattedActivity);
  } catch (error) {
    logger.error('Failed to fetch wishlist activity', error);
    res.status(500).json({ 
      error: 'Failed to fetch activity',
      message: 'An error occurred while retrieving activity' 
    });
  }
});

// Default export for backwards compatibility
export default wishlistSuggestionsRouter;