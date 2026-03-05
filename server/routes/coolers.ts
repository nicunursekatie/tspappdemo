import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coolerTypes,
  coolerInventory,
  users,
  insertCoolerTypeSchema,
  insertCoolerInventorySchema,
  type CoolerType,
  type CoolerInventory,
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { PERMISSIONS } from '../../shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import type { AuthenticatedRequest } from '../types/express';

// ============================================
// COOLER TYPES ROUTES
// ============================================

export const coolerTypesRouter = Router();

// GET /api/cooler-types - Get all cooler types
coolerTypesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const types = await db
      .select()
      .from(coolerTypes)
      .where(eq(coolerTypes.isActive, true))
      .orderBy(coolerTypes.sortOrder, coolerTypes.name);

    res.json(types);
  } catch (error) {
    logger.error('Failed to fetch cooler types', error);
    res.status(500).json({ error: 'Failed to fetch cooler types' });
  }
});

// POST /api/cooler-types - Create new cooler type (requires COOLERS_MANAGE)
coolerTypesRouter.post('/', requirePermission(PERMISSIONS.COOLERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validation = insertCoolerTypeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues,
      });
    }

    const [newType] = await db
      .insert(coolerTypes)
      .values(validation.data)
      .returning();

    logger.info('Cooler type created', { typeId: newType.id, userId: req.user.id });
    res.status(201).json(newType);
  } catch (error) {
    logger.error('Failed to create cooler type', error);
    res.status(500).json({ error: 'Failed to create cooler type' });
  }
});

// PATCH /api/cooler-types/:id - Update cooler type (requires COOLERS_MANAGE)
coolerTypesRouter.patch('/:id', requirePermission(PERMISSIONS.COOLERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) {
      return res.status(400).json({ error: 'Invalid cooler type ID' });
    }

    const updateSchema = z.object({
      name: z.string().max(100).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });

    const validation = updateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues,
      });
    }

    const [updated] = await db
      .update(coolerTypes)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(coolerTypes.id, typeId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Cooler type not found' });
    }

    logger.info('Cooler type updated', { typeId, userId: req.user.id });
    res.json(updated);
  } catch (error) {
    logger.error('Failed to update cooler type', error);
    res.status(500).json({ error: 'Failed to update cooler type' });
  }
});

// ============================================
// COOLER INVENTORY ROUTES
// ============================================

export const coolerInventoryRouter = Router();

// GET /api/cooler-inventory - Get current cooler inventory with aggregation
coolerInventoryRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the latest inventory report for each host home + cooler type combination
    const latestInventory = await db
      .select({
        id: coolerInventory.id,
        hostHomeId: coolerInventory.hostHomeId,
        hostFirstName: users.firstName,
        hostLastName: users.lastName,
        coolerTypeId: coolerInventory.coolerTypeId,
        coolerTypeName: coolerTypes.name,
        quantity: coolerInventory.quantity,
        notes: coolerInventory.notes,
        reportedAt: coolerInventory.reportedAt,
        reportedBy: coolerInventory.reportedBy,
      })
      .from(coolerInventory)
      .innerJoin(users, eq(coolerInventory.hostHomeId, users.id))
      .innerJoin(coolerTypes, eq(coolerInventory.coolerTypeId, coolerTypes.id))
      .where(eq(coolerTypes.isActive, true))
      .orderBy(desc(coolerInventory.reportedAt));

    // Group by host home and cooler type, keeping only the most recent report
    const groupedInventory = latestInventory.reduce((acc: any[], item) => {
      const key = `${item.hostHomeId}-${item.coolerTypeId}`;
      if (!acc.find((i) => `${i.hostHomeId}-${i.coolerTypeId}` === key)) {
        acc.push(item);
      }
      return acc;
    }, []);

    res.json(groupedInventory);
  } catch (error) {
    logger.error('Failed to fetch cooler inventory', error);
    res.status(500).json({ error: 'Failed to fetch cooler inventory' });
  }
});

// GET /api/cooler-inventory/summary - Get summary of all coolers by type
coolerInventoryRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get the latest report for each host/type combo, then sum by type
    const summary = await db
      .select({
        coolerTypeId: coolerTypes.id,
        coolerTypeName: coolerTypes.name,
        totalQuantity: sql<number>`COALESCE(SUM(${coolerInventory.quantity})::integer, 0)`,
        locationCount: sql<number>`COUNT(DISTINCT ${coolerInventory.hostHomeId})::integer`,
      })
      .from(coolerTypes)
      .leftJoin(
        coolerInventory,
        eq(coolerTypes.id, coolerInventory.coolerTypeId)
      )
      .where(eq(coolerTypes.isActive, true))
      .groupBy(coolerTypes.id, coolerTypes.name)
      .orderBy(coolerTypes.sortOrder, coolerTypes.name);

    res.json(summary);
  } catch (error) {
    logger.error('Failed to fetch cooler summary', error);
    res.status(500).json({ error: 'Failed to fetch cooler summary' });
  }
});

// GET /api/cooler-inventory/my-inventory - Get current user's inventory
coolerInventoryRouter.get('/my-inventory', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const myInventory = await db
      .select({
        id: coolerInventory.id,
        coolerTypeId: coolerInventory.coolerTypeId,
        coolerTypeName: coolerTypes.name,
        quantity: coolerInventory.quantity,
        notes: coolerInventory.notes,
        reportedAt: coolerInventory.reportedAt,
      })
      .from(coolerInventory)
      .innerJoin(coolerTypes, eq(coolerInventory.coolerTypeId, coolerTypes.id))
      .where(eq(coolerInventory.hostHomeId, req.user.id))
      .orderBy(desc(coolerInventory.reportedAt));

    // Group by cooler type, keeping only the most recent
    const latestByType = myInventory.reduce((acc: any[], item) => {
      if (!acc.find((i) => i.coolerTypeId === item.coolerTypeId)) {
        acc.push(item);
      }
      return acc;
    }, []);

    res.json(latestByType);
  } catch (error) {
    logger.error('Failed to fetch my cooler inventory', error);
    res.status(500).json({ error: 'Failed to fetch your cooler inventory' });
  }
});

// POST /api/cooler-inventory - Submit cooler inventory report
coolerInventoryRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const reportSchema = z.object({
      inventory: z.array(
        z.object({
          coolerTypeId: z.number().int().positive(),
          quantity: z.number().int().min(0),
          notes: z.string().optional(),
        })
      ),
    });

    const validation = reportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues,
      });
    }

    const { inventory } = validation.data;

    // Insert all inventory reports
    const reports = inventory.map((item) => ({
      hostHomeId: req.user!.id,
      coolerTypeId: item.coolerTypeId,
      quantity: item.quantity,
      notes: item.notes || null,
      reportedBy: req.user!.id,
      reportedAt: new Date(),
    }));

    const inserted = await db
      .insert(coolerInventory)
      .values(reports)
      .returning();

    logger.info('Cooler inventory reported', {
      userId: req.user.id,
      itemCount: inserted.length,
    });

    res.status(201).json({
      message: 'Inventory report submitted successfully',
      reports: inserted,
    });
  } catch (error) {
    logger.error('Failed to submit cooler inventory', error);
    res.status(500).json({ error: 'Failed to submit cooler inventory' });
  }
});

// GET /api/cooler-inventory/history/:hostHomeId - Get inventory history for a host home
coolerInventoryRouter.get('/history/:hostHomeId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hostHomeId = req.params.hostHomeId;

    const history = await db
      .select({
        id: coolerInventory.id,
        coolerTypeId: coolerInventory.coolerTypeId,
        coolerTypeName: coolerTypes.name,
        quantity: coolerInventory.quantity,
        notes: coolerInventory.notes,
        reportedAt: coolerInventory.reportedAt,
        reportedBy: coolerInventory.reportedBy,
      })
      .from(coolerInventory)
      .innerJoin(coolerTypes, eq(coolerInventory.coolerTypeId, coolerTypes.id))
      .where(eq(coolerInventory.hostHomeId, hostHomeId))
      .orderBy(desc(coolerInventory.reportedAt))
      .limit(50);

    res.json(history);
  } catch (error) {
    logger.error('Failed to fetch cooler inventory history', error);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
});

// POST /api/cooler-inventory/admin-add - Add cooler for any user (requires COOLERS_MANAGE)
coolerInventoryRouter.post('/admin-add', requirePermission(PERMISSIONS.COOLERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const addSchema = z.object({
      hostHomeId: z.string(),
      coolerTypeId: z.number().int().positive(),
      quantity: z.number().int().min(0),
      notes: z.string().optional(),
    });

    const validation = addSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validation.error.issues,
      });
    }

    const { hostHomeId, coolerTypeId, quantity, notes } = validation.data;

    const [inserted] = await db
      .insert(coolerInventory)
      .values({
        hostHomeId,
        coolerTypeId,
        quantity,
        notes: notes || null,
        reportedBy: req.user.id,
        reportedAt: new Date(),
      })
      .returning();

    logger.info('Admin added cooler inventory', {
      adminId: req.user.id,
      hostHomeId,
      coolerTypeId,
      quantity,
    });

    res.status(201).json(inserted);
  } catch (error) {
    logger.error('Failed to add cooler inventory (admin)', error);
    res.status(500).json({ error: 'Failed to add cooler inventory' });
  }
});

// DELETE /api/cooler-inventory/:id - Delete a cooler entry (requires COOLERS_MANAGE)
coolerInventoryRouter.delete('/:id', requirePermission(PERMISSIONS.COOLERS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const entryId = parseInt(req.params.id);
    if (isNaN(entryId)) {
      return res.status(400).json({ error: 'Invalid entry ID' });
    }

    const [deleted] = await db
      .delete(coolerInventory)
      .where(eq(coolerInventory.id, entryId))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Cooler entry not found' });
    }

    logger.info('Admin deleted cooler inventory entry', {
      adminId: req.user.id,
      entryId,
    });

    res.json({ message: 'Cooler entry deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete cooler inventory entry', error);
    res.status(500).json({ error: 'Failed to delete cooler entry' });
  }
});

export default coolerInventoryRouter;
