import { Router, type Response } from 'express';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  expenses,
  insertExpenseSchema,
  updateExpenseSchema,
  type Expense,
  type InsertExpense,
  users
} from '../../shared/schema';
import { logger } from '../middleware/logger';
import { receiptUpload } from '../middleware/uploads';
import { ObjectStorageService } from '../objectStorage';
import { promises as fs } from 'fs';
import path from 'path';
import { safeDeleteFile } from '../utils/file-cleanup';
import type { AuthenticatedRequest } from '../types/express';

// Initialize object storage service for receipt uploads
const objectStorageService = new ObjectStorageService();

// Input validation schemas
const createExpenseWithoutReceiptSchema = insertExpenseSchema.omit({
  uploadedBy: true,
  receiptUrl: true,
  receiptFileName: true,
  receiptFileSize: true,
});

// Create expenses router
export const expensesRouter = Router();

// GET /api/expenses - Get all expenses (with optional filters)
expensesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { contextType, contextId, status, category } = req.query;

    logger.info('Fetching expenses', {
      userId: req.user.id,
      filters: { contextType, contextId, status, category }
    });

    // Build where conditions
    const conditions = [];
    if (contextType && typeof contextType === 'string') {
      conditions.push(eq(expenses.contextType, contextType));
    }
    if (contextId && typeof contextId === 'string') {
      const parsedContextId = parseInt(contextId);
      if (!isNaN(parsedContextId)) {
        conditions.push(eq(expenses.contextId, parsedContextId));
      }
    }
    if (status && typeof status === 'string') {
      conditions.push(eq(expenses.status, status));
    }
    if (category && typeof category === 'string') {
      conditions.push(eq(expenses.category, category));
    }

    // Fetch expenses with user information
    const expensesList = await db
      .select({
        id: expenses.id,
        contextType: expenses.contextType,
        contextId: expenses.contextId,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        vendor: expenses.vendor,
        purchaseDate: expenses.purchaseDate,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        receiptFileSize: expenses.receiptFileSize,
        uploadedBy: expenses.uploadedBy,
        uploadedAt: expenses.uploadedAt,
        approvedBy: expenses.approvedBy,
        approvedAt: expenses.approvedAt,
        status: expenses.status,
        notes: expenses.notes,
        metadata: expenses.metadata,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        uploaderName: sql<string>`COALESCE(${users.displayName}, CONCAT(${users.firstName}, ' ', ${users.lastName}), ${users.email})`.as('uploader_name'),
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.uploadedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.createdAt));

    res.json(expensesList);
  } catch (error) {
    logger.error('Error fetching expenses', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/expenses/summary/stats - Get expense statistics
// NOTE: This route must come before /:id to avoid "summary" being treated as an ID
expensesRouter.get('/summary/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { contextType, contextId } = req.query;

    logger.info('Fetching expense statistics', {
      userId: req.user.id,
      filters: { contextType, contextId }
    });

    // Build where conditions
    const conditions = [];
    if (contextType && typeof contextType === 'string') {
      conditions.push(eq(expenses.contextType, contextType));
    }
    if (contextId && typeof contextId === 'string') {
      const parsedContextId = parseInt(contextId);
      if (!isNaN(parsedContextId)) {
        conditions.push(eq(expenses.contextId, parsedContextId));
      }
    }

    // Fetch statistics
    const [stats] = await db
      .select({
        totalExpenses: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        pendingCount: sql<number>`COUNT(CASE WHEN ${expenses.status} = 'pending' THEN 1 END)::int`,
        approvedCount: sql<number>`COUNT(CASE WHEN ${expenses.status} = 'approved' THEN 1 END)::int`,
        rejectedCount: sql<number>`COUNT(CASE WHEN ${expenses.status} = 'rejected' THEN 1 END)::int`,
        reimbursedCount: sql<number>`COUNT(CASE WHEN ${expenses.status} = 'reimbursed' THEN 1 END)::int`,
      })
      .from(expenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching expense statistics', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch expense statistics' });
  }
});

// GET /api/expenses/:id - Get a specific expense
expensesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    logger.info('Fetching expense', { userId: req.user.id, expenseId });

    const [expense] = await db
      .select({
        id: expenses.id,
        contextType: expenses.contextType,
        contextId: expenses.contextId,
        description: expenses.description,
        amount: expenses.amount,
        category: expenses.category,
        vendor: expenses.vendor,
        purchaseDate: expenses.purchaseDate,
        receiptUrl: expenses.receiptUrl,
        receiptFileName: expenses.receiptFileName,
        receiptFileSize: expenses.receiptFileSize,
        uploadedBy: expenses.uploadedBy,
        uploadedAt: expenses.uploadedAt,
        approvedBy: expenses.approvedBy,
        approvedAt: expenses.approvedAt,
        status: expenses.status,
        notes: expenses.notes,
        metadata: expenses.metadata,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
        uploaderName: sql<string>`COALESCE(${users.displayName}, CONCAT(${users.firstName}, ' ', ${users.lastName}), ${users.email})`.as('uploader_name'),
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.uploadedBy, users.id))
      .where(eq(expenses.id, expenseId));

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    logger.error('Error fetching expense', { error, userId: req.user?.id, expenseId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// POST /api/expenses - Create a new expense (with optional receipt upload)
expensesRouter.post('/', receiptUpload.single('receipt'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    logger.info('Creating new expense', { userId: req.user.id, body: req.body, hasFile: !!req.file });

    // Validate input
    const validatedData = createExpenseWithoutReceiptSchema.parse(req.body);

    // Prepare expense data
    const expenseData: InsertExpense = {
      ...validatedData,
      uploadedBy: req.user.id,
    };

    // If a file was uploaded, handle it
    if (req.file) {
      try {
        // Upload to storage
        const receiptUrl = await objectStorageService.uploadLocalFile(
          req.file.path,
          `receipts/${Date.now()}-${req.file.originalname}`
        );

        expenseData.receiptUrl = receiptUrl;
        expenseData.receiptFileName = req.file.originalname;
        expenseData.receiptFileSize = req.file.size;

        // Clean up temp file
        await fs.unlink(req.file.path).catch(err =>
          logger.warn('Failed to delete temp file', { path: req.file!.path, error: err })
        );
      } catch (uploadError) {
        logger.error('Failed to upload receipt', { error: uploadError });
        // Continue without receipt - don't fail the entire expense creation
      }
    }

    // Insert into database
    const [newExpense] = await db
      .insert(expenses)
      .values(expenseData)
      .returning();

    logger.info('Expense created successfully', { expenseId: newExpense.id, userId: req.user.id });
    res.status(201).json(newExpense);
  } catch (error) {
    logger.error('Error creating expense', { error, userId: req.user?.id });

    // Clean up uploaded file if it exists
    if (req.file?.path) {
      await safeDeleteFile(req.file.path, 'expense creation cleanup after error');
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// PATCH /api/expenses/:id - Update an expense
expensesRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    logger.info('Updating expense', { userId: req.user.id, expenseId, body: req.body });

    // Validate input
    const validatedData = updateExpenseSchema.parse(req.body);

    // Update expense
    const [updatedExpense] = await db
      .update(expenses)
      .set({
        ...validatedData,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    if (!updatedExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    logger.info('Expense updated successfully', { expenseId, userId: req.user.id });
    res.json(updatedExpense);
  } catch (error) {
    logger.error('Error updating expense', { error, userId: req.user?.id, expenseId: req.params.id });

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// PATCH /api/expenses/:id/approve - Approve an expense
expensesRouter.patch('/:id/approve', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has permission to approve expenses
    const userRole = req.user.role;
    if (userRole !== 'admin' && userRole !== 'admin_coordinator') {
      return res.status(403).json({ error: 'Insufficient permissions to approve expenses' });
    }

    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    logger.info('Approving expense', { userId: req.user.id, expenseId });

    const [updatedExpense] = await db
      .update(expenses)
      .set({
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    if (!updatedExpense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    logger.info('Expense approved successfully', { expenseId, userId: req.user.id });
    res.json(updatedExpense);
  } catch (error) {
    logger.error('Error approving expense', { error, userId: req.user?.id, expenseId: req.params.id });
    res.status(500).json({ error: 'Failed to approve expense' });
  }
});

// POST /api/expenses/:id/receipt - Upload or replace receipt for existing expense
expensesRouter.post('/:id/receipt', receiptUpload.single('receipt'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Receipt file is required' });
    }

    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    logger.info('Uploading receipt for expense', { userId: req.user.id, expenseId, file: req.file.originalname });

    // Check if expense exists
    const [existingExpense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId));

    if (!existingExpense) {
      await safeDeleteFile(req.file.path, 'receipt upload cleanup - expense not found');
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Upload to storage
    const receiptUrl = await objectStorageService.uploadLocalFile(
      req.file.path,
      `receipts/${Date.now()}-${req.file.originalname}`
    );

    // Update expense with receipt info
    const [updatedExpense] = await db
      .update(expenses)
      .set({
        receiptUrl,
        receiptFileName: req.file.originalname,
        receiptFileSize: req.file.size,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, expenseId))
      .returning();

    // Clean up temp file
    await fs.unlink(req.file.path).catch(err =>
      logger.warn('Failed to delete temp file', { path: req.file!.path, error: err })
    );

    logger.info('Receipt uploaded successfully', { expenseId, userId: req.user.id });
    res.json(updatedExpense);
  } catch (error) {
    logger.error('Error uploading receipt', { error, userId: req.user?.id, expenseId: req.params.id });

    // Clean up uploaded file if it exists
    if (req.file?.path) {
      await safeDeleteFile(req.file.path, 'receipt upload cleanup after error');
    }

    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// POST /api/expenses/process-receipt - Process receipt image with AI to extract data
expensesRouter.post('/process-receipt', receiptUpload.single('receipt'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image is required' });
    }

    logger.info('Processing receipt with AI', {
      userId: req.user.id,
      fileName: req.file.filename,
      fileSize: req.file.size
    });

    let receiptUrl: string | undefined;
    try {
      // Upload receipt to object storage first
      receiptUrl = await objectStorageService.uploadLocalFile(
        req.file.path,
        `receipts/${Date.now()}-${req.file.originalname}`
      );

      // Get context hint from request body if provided
      const contextHint = req.body.contextHint || undefined;

      // Call AI receipt processing service
      const { processReceiptImage } = await import('../services/ai-receipt-processor');
      const extractedData = await processReceiptImage({
        imageUrl: receiptUrl,
        contextHint,
      });

      logger.info('AI receipt processing completed', {
        userId: req.user.id,
        vendor: extractedData.vendor,
        amount: extractedData.totalAmount,
        confidence: extractedData.confidence
      });

      // Return extracted data plus the receipt URL
      res.json({
        ...extractedData,
        receiptUrl: receiptUrl,
        receiptFileName: req.file.originalname,
        receiptFileSize: req.file.size,
      });
    } finally {
      // Always clean up temporary file
      await safeDeleteFile(req.file.path, 'receipt processing - cleanup after upload');
    }

  } catch (error) {
    logger.error('Error processing receipt with AI', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      error: 'Failed to process receipt',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// DELETE /api/expenses/:id - Delete an expense
expensesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const expenseId = parseInt(req.params.id);
    if (isNaN(expenseId)) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    // Check if user has permission to delete (admin or original uploader)
    const [expense] = await db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId));

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const userRole = req.user.role;
    if (expense.uploadedBy !== req.user.id && userRole !== 'admin' && userRole !== 'admin_coordinator') {
      return res.status(403).json({ error: 'Insufficient permissions to delete this expense' });
    }

    logger.info('Deleting expense', { userId: req.user.id, expenseId });

    await db
      .delete(expenses)
      .where(eq(expenses.id, expenseId));

    logger.info('Expense deleted successfully', { expenseId, userId: req.user.id });
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    logger.error('Error deleting expense', { error, userId: req.user?.id, expenseId: req.params.id });
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default expensesRouter;
