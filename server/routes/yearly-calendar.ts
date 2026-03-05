import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  yearlyCalendarItems,
  insertYearlyCalendarItemSchema,
  type YearlyCalendarItem,
  type InsertYearlyCalendarItem,
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { requirePermission, requireAnyPermission } from '../middleware/auth';
import { PERMISSIONS } from '../../shared/auth-utils';
import type { AuthenticatedRequest } from '../types/express';

// Input validation schemas
// Date string validation (YYYY-MM-DD format)
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').nullable().optional();

// Recurrence pattern schema
const recurrencePatternSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(), // 0 = Sunday, 6 = Saturday
  dayOfMonth: z.number().int().min(1).max(31).optional(), // 1-31
  weekOfMonth: z.number().int().min(1).max(5).optional(), // 1st, 2nd, 3rd, 4th, 5th (last)
  month: z.number().int().min(1).max(12).optional(), // For yearly recurrence
}).nullable().optional();

const createItemSchema = insertYearlyCalendarItemSchema
  .omit({ createdBy: true, createdByName: true })
  .extend({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    description: z.string().max(2000, 'Description too long').optional().nullable(),
    category: z.enum(['preparation', 'event-rush', 'event', 'staffing', 'board', 'seasonal', 'planning', 'other']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    assignedTo: z.array(z.string()).nullable().optional(),
    assignedToNames: z.array(z.string()).nullable().optional(),
    // New recurrence fields
    recurrenceType: z.enum(['none', 'weekly', 'monthly', 'yearly']).optional(),
    recurrencePattern: recurrencePatternSchema,
    recurrenceEndDate: dateStringSchema,
  });

const updateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['preparation', 'event-rush', 'event', 'staffing', 'board', 'seasonal', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  assignedTo: z.array(z.string()).nullable().optional(),
  assignedToNames: z.array(z.string()).nullable().optional(),
  isCompleted: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  // New recurrence fields
  recurrenceType: z.enum(['none', 'weekly', 'monthly', 'yearly']).optional(),
  recurrencePattern: recurrencePatternSchema,
  recurrenceEndDate: dateStringSchema,
});

// Helper function to generate recurring dates within a date range
function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  recurrenceType: string,
  pattern: { dayOfWeek?: number; dayOfMonth?: number; weekOfMonth?: number; month?: number } | null
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  if (!pattern) return dates;

  while (current <= endDate) {
    if (recurrenceType === 'weekly' && pattern.dayOfWeek !== undefined) {
      // Weekly: every X day of week
      if (current.getDay() === pattern.dayOfWeek) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    } else if (recurrenceType === 'monthly') {
      if (pattern.dayOfMonth !== undefined) {
        // Monthly: specific day of month (e.g., 15th of every month)
        if (current.getDate() === pattern.dayOfMonth) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      } else if (pattern.weekOfMonth !== undefined && pattern.dayOfWeek !== undefined) {
        // Monthly: Nth weekday of month (e.g., 2nd Tuesday)
        const firstOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
        const firstWeekday = firstOfMonth.getDay();
        let targetDay = pattern.dayOfWeek - firstWeekday;
        if (targetDay < 0) targetDay += 7;
        targetDay += 1; // Convert to 1-indexed day of month
        targetDay += (pattern.weekOfMonth - 1) * 7;

        if (current.getDate() === targetDay && targetDay <= new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()) {
          dates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    } else if (recurrenceType === 'yearly' && pattern.month !== undefined && pattern.dayOfMonth !== undefined) {
      // Yearly: specific month and day
      if (current.getMonth() + 1 === pattern.month && current.getDate() === pattern.dayOfMonth) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    } else {
      current.setDate(current.getDate() + 1);
    }
  }

  return dates;
}

// Create yearly calendar router
export const yearlyCalendarRouter = Router();

// GET /api/yearly-calendar - Get all calendar items for a specific year
yearlyCalendarRouter.get(
  '/',
  requirePermission(PERMISSIONS.YEARLY_CALENDAR_VIEW),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year parameter' });
      }

      logger.info('Fetching yearly calendar items', { year, userId: req.user.id });

      // Fetch all items for the specified year, ordered by month
      const items = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.year, year))
        .orderBy(yearlyCalendarItems.month, desc(yearlyCalendarItems.createdAt));

      logger.info('Successfully fetched yearly calendar items', {
        year,
        count: items.length,
        userId: req.user.id,
      });

      res.json(items);
    } catch (error) {
      logger.error('Failed to fetch yearly calendar items', error);
      res.status(500).json({
        error: 'Failed to fetch calendar items',
        message: 'An error occurred while retrieving calendar items',
      });
    }
  }
);

// POST /api/yearly-calendar - Create new calendar item
yearlyCalendarRouter.post(
  '/',
  requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validation = createItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const data = validation.data;

      // Get user's display name
      const createdByName =
        req.user.displayName ||
        `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() ||
        req.user.email ||
        'Unknown User';

      logger.info('Creating yearly calendar item', {
        month: data.month,
        year: data.year,
        title: data.title,
        userId: req.user.id,
      });

      const [newItem] = await db
        .insert(yearlyCalendarItems)
        .values({
          ...data,
          createdBy: req.user.id,
          createdByName,
          updatedAt: new Date(),
        })
        .returning();

      logger.info('Successfully created yearly calendar item', {
        itemId: newItem.id,
        userId: req.user.id,
      });

      res.status(201).json(newItem);
    } catch (error) {
      logger.error('Failed to create yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to create calendar item',
        message: 'An error occurred while creating the calendar item',
      });
    }
  }
);

// PATCH /api/yearly-calendar/:id - Update calendar item
yearlyCalendarRouter.patch(
  '/:id',
  requireAnyPermission(PERMISSIONS.YEARLY_CALENDAR_EDIT, PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      const validation = updateItemSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input data',
          details: validation.error.issues,
        });
      }

      const data = validation.data;

      // Check if item exists
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      // Check ownership - users can only edit their own items unless they have YEARLY_CALENDAR_EDIT_ALL
      // Compare as strings to handle type differences (DB stores string, auth may supply number)
      const isOwner = String(existingItem.createdBy) === String(req.user.id);
      const userPermissions = req.user.permissions || [];
      const canEditAll = userPermissions.includes(PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL) || 
                         req.user.role === 'super_admin' || 
                         req.user.role === 'admin';
      
      if (!isOwner && !canEditAll) {
        return res.status(403).json({ error: 'You can only edit your own calendar items' });
      }

      // If marking as completed, set completedBy and completedAt
      const updateData: any = {
        ...data,
        updatedAt: new Date(),
      };

      if (data.isCompleted !== undefined) {
        if (data.isCompleted && !existingItem.isCompleted) {
          updateData.completedAt = new Date();
          updateData.completedBy = req.user.id;
        } else if (!data.isCompleted) {
          updateData.completedAt = null;
          updateData.completedBy = null;
        }
      }

      logger.info('Updating yearly calendar item', {
        itemId,
        updates: Object.keys(data),
        userId: req.user.id,
      });

      const [updatedItem] = await db
        .update(yearlyCalendarItems)
        .set(updateData)
        .where(eq(yearlyCalendarItems.id, itemId))
        .returning();

      logger.info('Successfully updated yearly calendar item', {
        itemId,
        userId: req.user.id,
      });

      res.json(updatedItem);
    } catch (error) {
      logger.error('Failed to update yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to update calendar item',
        message: 'An error occurred while updating the calendar item',
      });
    }
  }
);

// DELETE /api/yearly-calendar/:id - Delete calendar item
yearlyCalendarRouter.delete(
  '/:id',
  requireAnyPermission(PERMISSIONS.YEARLY_CALENDAR_EDIT, PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      logger.info('Deleting yearly calendar item', { itemId, userId: req.user.id });

      // Check if item exists
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      // Check ownership - users can only delete their own items unless they have YEARLY_CALENDAR_EDIT_ALL
      // Compare as strings to handle type differences (DB stores string, auth may supply number)
      const isOwner = String(existingItem.createdBy) === String(req.user.id);
      const userPermissions = req.user.permissions || [];
      const canEditAll = userPermissions.includes(PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL) || 
                         req.user.role === 'super_admin' || 
                         req.user.role === 'admin';
      
      if (!isOwner && !canEditAll) {
        return res.status(403).json({ error: 'You can only delete your own calendar items' });
      }

      await db.delete(yearlyCalendarItems).where(eq(yearlyCalendarItems.id, itemId));

      logger.info('Successfully deleted yearly calendar item', {
        itemId,
        userId: req.user.id,
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to delete calendar item',
        message: 'An error occurred while deleting the calendar item',
      });
    }
  }
);

// POST /api/yearly-calendar/:id/copy-to-next-year - Copy recurring item to next year
yearlyCalendarRouter.post(
  '/:id/copy-to-next-year',
  requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: 'Invalid item ID' });
      }

      logger.info('Copying yearly calendar item to next year', {
        itemId,
        userId: req.user.id,
      });

      // Get the existing item
      const [existingItem] = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.id, itemId))
        .limit(1);

      if (!existingItem) {
        return res.status(404).json({ error: 'Calendar item not found' });
      }

      // Helper to adjust a date string to next year
      const adjustDateToNextYear = (dateStr: string | null): string | null => {
        if (!dateStr) return null;
        const date = new Date(dateStr + 'T12:00:00');
        date.setFullYear(date.getFullYear() + 1);
        return date.toISOString().split('T')[0];
      };

      // Create a copy for next year
      const [newItem] = await db
        .insert(yearlyCalendarItems)
        .values({
          month: existingItem.month,
          year: existingItem.year + 1,
          title: existingItem.title,
          description: existingItem.description,
          category: existingItem.category,
          priority: existingItem.priority,
          startDate: adjustDateToNextYear(existingItem.startDate),
          endDate: adjustDateToNextYear(existingItem.endDate),
          createdBy: existingItem.createdBy,
          createdByName: existingItem.createdByName,
          assignedTo: existingItem.assignedTo,
          assignedToNames: existingItem.assignedToNames,
          isRecurring: existingItem.isRecurring,
          recurrenceType: existingItem.recurrenceType,
          recurrencePattern: existingItem.recurrencePattern,
          recurrenceEndDate: adjustDateToNextYear(existingItem.recurrenceEndDate),
          isCompleted: false, // Reset completion status
          completedAt: null,
          completedBy: null,
          updatedAt: new Date(),
        })
        .returning();

      logger.info('Successfully copied yearly calendar item to next year', {
        originalItemId: itemId,
        newItemId: newItem.id,
        userId: req.user.id,
      });

      res.status(201).json(newItem);
    } catch (error) {
      logger.error('Failed to copy yearly calendar item', error);
      res.status(500).json({
        error: 'Failed to copy calendar item',
        message: 'An error occurred while copying the calendar item',
      });
    }
  }
);

// GET /api/yearly-calendar/recurring-instances - Get expanded recurring instances for a date range
yearlyCalendarRouter.get(
  '/recurring-instances',
  requirePermission(PERMISSIONS.YEARLY_CALENDAR_VIEW),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const month = req.query.month ? parseInt(req.query.month as string) : null;

      if (isNaN(year)) {
        return res.status(400).json({ error: 'Invalid year parameter' });
      }

      logger.info('Fetching recurring calendar instances', { year, month, userId: req.user.id });

      // Get all items with recurrence for this year
      const items = await db
        .select()
        .from(yearlyCalendarItems)
        .where(eq(yearlyCalendarItems.year, year));

      // Filter to only recurring items and expand them
      const instances: Array<{
        sourceItemId: number;
        title: string;
        description: string | null;
        category: string | null;
        priority: string | null;
        date: string;
        recurrenceType: string;
        assignedTo: string[] | null;
        assignedToNames: string[] | null;
      }> = [];

      // Calculate date range
      const startDate = month
        ? new Date(year, month - 1, 1)
        : new Date(year, 0, 1);
      const endDate = month
        ? new Date(year, month, 0) // Last day of specified month
        : new Date(year, 11, 31); // Dec 31

      for (const item of items) {
        if (!item.recurrenceType || item.recurrenceType === 'none' || item.recurrenceType === 'yearly') {
          continue; // Skip non-recurring or yearly items (yearly are handled differently)
        }

        // Check if recurrence has ended
        if (item.recurrenceEndDate && new Date(item.recurrenceEndDate) < startDate) {
          continue;
        }

        const pattern = item.recurrencePattern as {
          dayOfWeek?: number;
          dayOfMonth?: number;
          weekOfMonth?: number;
        } | null;

        if (!pattern) continue;

        const recurringDates = generateRecurringDates(
          startDate,
          item.recurrenceEndDate && new Date(item.recurrenceEndDate) < endDate
            ? new Date(item.recurrenceEndDate)
            : endDate,
          item.recurrenceType,
          pattern
        );

        for (const date of recurringDates) {
          instances.push({
            sourceItemId: item.id,
            title: item.title,
            description: item.description,
            category: item.category,
            priority: item.priority,
            date: date.toISOString().split('T')[0],
            recurrenceType: item.recurrenceType,
            assignedTo: item.assignedTo,
            assignedToNames: item.assignedToNames,
          });
        }
      }

      // Sort by date
      instances.sort((a, b) => a.date.localeCompare(b.date));

      logger.info('Successfully generated recurring instances', {
        year,
        month,
        count: instances.length,
        userId: req.user.id,
      });

      res.json(instances);
    } catch (error) {
      logger.error('Failed to fetch recurring calendar instances', error);
      res.status(500).json({
        error: 'Failed to fetch recurring instances',
        message: 'An error occurred while generating recurring instances',
      });
    }
  }
);

export default yearlyCalendarRouter;

