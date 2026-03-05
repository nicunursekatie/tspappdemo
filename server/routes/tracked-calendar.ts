import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, lte, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import { trackedCalendarItems } from '../../shared/schema';
import { logger } from '../utils/production-safe-logger';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '../../shared/auth-utils';

const router = Router();

// Schema for school break import
const schoolBreakSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
  districts: z.array(z.string()).optional(),
  academicYear: z.string().optional(),
  notes: z.string().optional(),
});

const schoolBreaksImportSchema = z.array(schoolBreakSchema);

// Schema for religious holiday import
const religiousHolidaySchema = z.object({
  id: z.string(),
  tradition: z.string(), // "Christian", "Jewish"
  type: z.string(),
  label: z.string(),
  startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date format',
  }),
  endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date format',
  }),
  notes: z.string().optional(),
});

const religiousHolidaysImportSchema = z.array(religiousHolidaySchema);

// GET /api/tracked-calendar - Get tracked items for a year
router.get('/', requirePermission(PERMISSIONS.YEARLY_CALENDAR_VIEW), async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const category = req.query.category as string | undefined;

    // Get items that overlap with any month in the given year
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    let query = db
      .select()
      .from(trackedCalendarItems)
      .where(
        and(
          // Item overlaps with the year if:
          // startDate <= yearEnd AND endDate >= yearStart
          lte(trackedCalendarItems.startDate, yearEnd),
          gte(trackedCalendarItems.endDate, yearStart),
          category ? eq(trackedCalendarItems.category, category) : undefined
        )
      )
      .orderBy(trackedCalendarItems.startDate);

    const items = await query;

    res.json({ items });
  } catch (error) {
    logger.error('Failed to fetch tracked calendar items:', error);
    res.status(500).json({ message: 'Failed to fetch tracked calendar items' });
  }
});

// GET /api/tracked-calendar/categories - Get list of categories
router.get('/categories', requirePermission(PERMISSIONS.YEARLY_CALENDAR_VIEW), async (req: Request, res: Response) => {
  try {
    const categories = await db
      .selectDistinct({ category: trackedCalendarItems.category })
      .from(trackedCalendarItems)
      .orderBy(trackedCalendarItems.category);

    res.json({ categories: categories.map((c) => c.category) });
  } catch (error) {
    logger.error('Failed to fetch categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
});

// POST /api/tracked-calendar/import-school-breaks - Import school breaks from JSON
router.post('/import-school-breaks', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const parseResult = schoolBreaksImportSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Invalid school breaks data',
        errors: parseResult.error.errors,
      });
    }

    const schoolBreaks = parseResult.data;
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const breakItem of schoolBreaks) {
      try {
        const externalId = `school_break_${breakItem.id}`;

        // Check if item exists
        const existing = await db
          .select()
          .from(trackedCalendarItems)
          .where(eq(trackedCalendarItems.externalId, externalId))
          .limit(1);

        const itemData = {
          externalId,
          category: 'school_breaks',
          title: breakItem.label,
          startDate: breakItem.startDate,
          endDate: breakItem.endDate,
          notes: breakItem.notes || null,
          metadata: {
            type: breakItem.type,
            districts: breakItem.districts || [],
            academicYear: breakItem.academicYear || null,
            originalId: breakItem.id,
          },
          updatedAt: new Date(),
        };

        if (existing.length > 0) {
          // Update existing
          await db
            .update(trackedCalendarItems)
            .set(itemData)
            .where(eq(trackedCalendarItems.externalId, externalId));
          results.updated++;
        } else {
          // Insert new
          await db.insert(trackedCalendarItems).values({
            ...itemData,
            createdAt: new Date(),
          });
          results.created++;
        }
      } catch (itemError) {
        results.errors.push(`Failed to process item ${breakItem.id}: ${itemError}`);
      }
    }

    logger.log(`School breaks import: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      message: 'Import completed',
      ...results,
    });
  } catch (error) {
    logger.error('Failed to import school breaks:', error);
    res.status(500).json({ message: 'Failed to import school breaks' });
  }
});

// POST /api/tracked-calendar/import-religious-holidays - Import religious holidays from JSON
router.post('/import-religious-holidays', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const parseResult = religiousHolidaysImportSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Invalid religious holidays data',
        errors: parseResult.error.errors,
      });
    }

    const holidays = parseResult.data;
    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const holiday of holidays) {
      try {
        const externalId = `religious_holiday_${holiday.id}`;

        // Check if item exists
        const existing = await db
          .select()
          .from(trackedCalendarItems)
          .where(eq(trackedCalendarItems.externalId, externalId))
          .limit(1);

        const itemData = {
          externalId,
          category: 'religious_holidays',
          title: holiday.label,
          startDate: holiday.startDate,
          endDate: holiday.endDate,
          notes: holiday.notes || null,
          metadata: {
            type: holiday.type,
            tradition: holiday.tradition,
            originalId: holiday.id,
          },
          updatedAt: new Date(),
        };

        if (existing.length > 0) {
          // Update existing
          await db
            .update(trackedCalendarItems)
            .set(itemData)
            .where(eq(trackedCalendarItems.externalId, externalId));
          results.updated++;
        } else {
          // Insert new
          await db.insert(trackedCalendarItems).values({
            ...itemData,
            createdAt: new Date(),
          });
          results.created++;
        }
      } catch (itemError) {
        results.errors.push(`Failed to process item ${holiday.id}: ${itemError}`);
      }
    }

    logger.log(`Religious holidays import: ${results.created} created, ${results.updated} updated, ${results.errors.length} errors`);

    res.json({
      message: 'Import completed',
      ...results,
    });
  } catch (error) {
    logger.error('Failed to import religious holidays:', error);
    res.status(500).json({ message: 'Failed to import religious holidays' });
  }
});

// POST /api/tracked-calendar - Create a tracked item
router.post('/', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const { category, title, startDate, endDate, notes, metadata, externalId } = req.body;

    if (!category || !title || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields: category, title, startDate, endDate' });
    }

    const [item] = await db
      .insert(trackedCalendarItems)
      .values({
        externalId: externalId || null,
        category,
        title,
        startDate,
        endDate,
        notes: notes || null,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json({ item });
  } catch (error) {
    logger.error('Failed to create tracked calendar item:', error);
    res.status(500).json({ message: 'Failed to create tracked calendar item' });
  }
});

// PATCH /api/tracked-calendar/:id - Update a tracked item
router.patch('/:id', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { category, title, startDate, endDate, notes, metadata } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (category !== undefined) updateData.category = category;
    if (title !== undefined) updateData.title = title;
    if (startDate !== undefined) updateData.startDate = startDate;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (notes !== undefined) updateData.notes = notes;
    if (metadata !== undefined) updateData.metadata = metadata;

    const [item] = await db
      .update(trackedCalendarItems)
      .set(updateData)
      .where(eq(trackedCalendarItems.id, id))
      .returning();

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ item });
  } catch (error) {
    logger.error('Failed to update tracked calendar item:', error);
    res.status(500).json({ message: 'Failed to update tracked calendar item' });
  }
});

// DELETE /api/tracked-calendar/:id - Delete a tracked item
router.delete('/:id', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [deleted] = await db
      .delete(trackedCalendarItems)
      .where(eq(trackedCalendarItems.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ message: 'Item deleted', item: deleted });
  } catch (error) {
    logger.error('Failed to delete tracked calendar item:', error);
    res.status(500).json({ message: 'Failed to delete tracked calendar item' });
  }
});

// DELETE /api/tracked-calendar/category/:category - Delete all items in a category
router.delete('/category/:category', requirePermission(PERMISSIONS.YEARLY_CALENDAR_EDIT), async (req: Request, res: Response) => {
  try {
    const category = req.params.category;

    const deleted = await db
      .delete(trackedCalendarItems)
      .where(eq(trackedCalendarItems.category, category))
      .returning();

    res.json({ message: `Deleted ${deleted.length} items from category ${category}`, count: deleted.length });
  } catch (error) {
    logger.error('Failed to delete category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

export default router;
