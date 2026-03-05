import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  holdingZoneCategories,
  type HoldingZoneCategory,
  type InsertHoldingZoneCategory,
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import type { AuthenticatedRequest } from '../types/express';

// Input validation schemas - only validate fields from request body, not createdBy (comes from session)
const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name too long'),
  color: z.string().min(1, 'Color is required').max(50, 'Color value too long'),
});

const updateCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Name too long').optional(),
  color: z.string().min(1, 'Color is required').max(50, 'Color value too long').optional(),
  isActive: z.boolean().optional(),
});

// Create holding zone categories router
export const holdingZoneCategoriesRouter = Router();

// GET /api/holding-zone/categories - Get all active categories
holdingZoneCategoriesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check VIEW_HOLDING_ZONE permission
    const hasViewPermission = req.user.permissions?.includes('VIEW_HOLDING_ZONE') || 
                              req.user.permissions?.includes('MANAGE_HOLDING_ZONE') ||
                              req.user.role === 'admin' ||
                              req.user.role === 'super_admin';

    if (!hasViewPermission) {
      return res.status(403).json({ error: 'Insufficient permissions to view categories' });
    }

    logger.info('Fetching holding zone categories', { userId: req.user.id });

    // Fetch all active categories
    const categories = await db
      .select()
      .from(holdingZoneCategories)
      .where(eq(holdingZoneCategories.isActive, true));

    logger.info('Successfully fetched categories', {
      count: categories.length,
      userId: req.user.id
    });

    res.json(categories);
  } catch (error) {
    logger.error('Failed to fetch holding zone categories', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: 'An error occurred while retrieving categories'
    });
  }
});

// POST /api/holding-zone/categories - Create new category (requires MANAGE_HOLDING_ZONE)
holdingZoneCategoriesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check MANAGE_HOLDING_ZONE permission
    const hasManagePermission = req.user.permissions?.includes('MANAGE_HOLDING_ZONE') ||
                                req.user.role === 'admin' ||
                                req.user.role === 'super_admin';

    if (!hasManagePermission) {
      return res.status(403).json({ error: 'Insufficient permissions to create categories' });
    }

    // Validate input data
    const validation = createCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues
      });
    }

    const categoryData = validation.data;

    logger.info('Creating new holding zone category', {
      userId: req.user.id,
      categoryName: categoryData.name
    });

    // Prepare the category data for insertion
    const newCategory: InsertHoldingZoneCategory = {
      name: categoryData.name,
      color: categoryData.color,
      createdBy: req.user.id,
      isActive: true,
    };

    // Insert the new category
    const [createdCategory] = await db
      .insert(holdingZoneCategories)
      .values(newCategory)
      .returning();

    logger.info('Successfully created holding zone category', {
      categoryId: createdCategory.id,
      userId: req.user.id
    });

    res.status(201).json(createdCategory);
  } catch (error) {
    logger.error('Failed to create holding zone category', error);
    res.status(500).json({
      error: 'Failed to create category',
      message: 'An error occurred while creating the category'
    });
  }
});

// PATCH /api/holding-zone/categories/:id - Update category (requires MANAGE_HOLDING_ZONE)
holdingZoneCategoriesRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check MANAGE_HOLDING_ZONE permission
    const hasManagePermission = req.user.permissions?.includes('MANAGE_HOLDING_ZONE') ||
                                req.user.role === 'admin' ||
                                req.user.role === 'super_admin';

    if (!hasManagePermission) {
      return res.status(403).json({ error: 'Insufficient permissions to update categories' });
    }

    // Validate update data
    const validation = updateCategorySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid update data',
        details: validation.error.issues
      });
    }

    const updateData = validation.data;

    logger.info('Updating holding zone category', {
      categoryId,
      userId: req.user.id,
      updates: updateData
    });

    // Check if category exists
    const [existingCategory] = await db
      .select()
      .from(holdingZoneCategories)
      .where(eq(holdingZoneCategories.id, categoryId))
      .limit(1);

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Update the category
    const [updatedCategory] = await db
      .update(holdingZoneCategories)
      .set(updateData)
      .where(eq(holdingZoneCategories.id, categoryId))
      .returning();

    logger.info('Successfully updated holding zone category', {
      categoryId,
      userId: req.user.id
    });

    res.json(updatedCategory);
  } catch (error) {
    logger.error('Failed to update holding zone category', error);
    res.status(500).json({
      error: 'Failed to update category',
      message: 'An error occurred while updating the category'
    });
  }
});

// DELETE /api/holding-zone/categories/:id - Soft delete category (requires MANAGE_HOLDING_ZONE)
holdingZoneCategoriesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const categoryId = parseInt(req.params.id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }

    // Check MANAGE_HOLDING_ZONE permission
    const hasManagePermission = req.user.permissions?.includes('MANAGE_HOLDING_ZONE') ||
                                req.user.role === 'admin' ||
                                req.user.role === 'super_admin';

    if (!hasManagePermission) {
      return res.status(403).json({ error: 'Insufficient permissions to delete categories' });
    }

    logger.info('Soft deleting holding zone category', {
      categoryId,
      userId: req.user.id
    });

    // Check if category exists
    const [existingCategory] = await db
      .select()
      .from(holdingZoneCategories)
      .where(eq(holdingZoneCategories.id, categoryId))
      .limit(1);

    if (!existingCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Soft delete by setting isActive to false
    await db
      .update(holdingZoneCategories)
      .set({ isActive: false })
      .where(eq(holdingZoneCategories.id, categoryId));

    logger.info('Successfully soft deleted holding zone category', {
      categoryId,
      userId: req.user.id
    });

    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    logger.error('Failed to delete holding zone category', error);
    res.status(500).json({
      error: 'Failed to delete category',
      message: 'An error occurred while deleting the category'
    });
  }
});

export default holdingZoneCategoriesRouter;
