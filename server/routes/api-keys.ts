import { Router } from 'express';
import { db } from '../db';
import { apiKeys } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth';
import { generateApiKey, hashApiKey } from '../middleware/api-key-auth';
import { logger } from '../utils/production-safe-logger';
import { z } from 'zod';

const apiKeysRouter = Router();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional().default(['EVENT_REQUESTS_VIEW']),
  expiresAt: z.string().optional(),
});

apiKeysRouter.get('/', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        createdBy: apiKeys.createdBy,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);

    res.json(keys);
  } catch (error) {
    next(error);
  }
});

apiKeysRouter.post('/', requireAuth, requireRole('super_admin'), async (req: any, res, next) => {
  try {
    const parsed = createApiKeySchema.parse(req.body);
    const { key, prefix, hash } = generateApiKey();

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        name: parsed.name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions: parsed.permissions,
        createdBy: req.user.id,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        isActive: true,
      })
      .returning();

    logger.info(`API key created: ${parsed.name} by user ${req.user.id}`);

    res.status(201).json({
      id: newKey.id,
      name: newKey.name,
      key: key,
      keyPrefix: prefix,
      permissions: newKey.permissions,
      expiresAt: newKey.expiresAt,
      createdAt: newKey.createdAt,
      message: 'Store this API key securely. It will not be shown again.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid request', errors: error.errors });
    }
    next(error);
  }
});

apiKeysRouter.delete('/:id', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const [deleted] = await db
      .delete(apiKeys)
      .where(eq(apiKeys.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'API key not found' });
    }

    logger.info(`API key deleted: ${deleted.name}`);
    res.json({ message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
});

apiKeysRouter.patch('/:id/deactivate', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'API key not found' });
    }

    logger.info(`API key deactivated: ${updated.name}`);
    res.json({ message: 'API key deactivated', key: updated });
  } catch (error) {
    next(error);
  }
});

apiKeysRouter.patch('/:id/activate', requireAuth, requireRole('super_admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    
    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: true })
      .where(eq(apiKeys.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'API key not found' });
    }

    logger.info(`API key activated: ${updated.name}`);
    res.json({ message: 'API key activated', key: updated });
  } catch (error) {
    next(error);
  }
});

export { apiKeysRouter };
