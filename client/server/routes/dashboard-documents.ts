import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../storage';
import { logger } from '../utils/production-safe-logger';

export function createDashboardDocumentsRoutes(
  isAuthenticated: any,
  requirePermission: any,
  storage: IStorage
) {
  const router = Router();

  router.get('/', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const documents = await storage.getDashboardDocuments();
      res.json(documents);
    } catch (error) {
      logger.error('Error fetching dashboard documents:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard documents' });
    }
  });

  router.post(
    '/',
    isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: Request, res: Response) => {
      try {
        const schema = z.object({
          documentId: z.string(),
          displayOrder: z.number().int().min(0),
        });

        const validatedData = schema.parse(req.body);
        const userId = (req as any).user?.id || 'unknown';

        const document = await storage.addDashboardDocument(
          validatedData.documentId,
          validatedData.displayOrder,
          userId
        );

        res.status(201).json(document);
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Invalid request data', details: error.errors });
        } else {
          logger.error('Error adding dashboard document:', error);
          res.status(500).json({ error: 'Failed to add dashboard document' });
        }
      }
    }
  );

  router.delete(
    '/:documentId',
    isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: Request, res: Response) => {
      try {
        const { documentId } = req.params;
        const success = await storage.removeDashboardDocument(documentId);

        if (!success) {
          return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ success: true });
      } catch (error) {
        logger.error('Error removing dashboard document:', error);
        res.status(500).json({ error: 'Failed to remove dashboard document' });
      }
    }
  );

  router.put(
    '/reorder',
    isAuthenticated,
    requirePermission('ADMIN_ACCESS'),
    async (req: Request, res: Response) => {
      try {
        const schema = z.array(
          z.object({
            documentId: z.string(),
            displayOrder: z.number().int().min(0),
          })
        );

        const validatedData = schema.parse(req.body);

        await storage.updateDashboardDocumentOrder(validatedData);

        res.json({ success: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          res.status(400).json({ error: 'Invalid request data', details: error.errors });
        } else {
          logger.error('Error updating dashboard document order:', error);
          res.status(500).json({ error: 'Failed to update dashboard document order' });
        }
      }
    }
  );

  return router;
}

export default createDashboardDocumentsRoutes;
