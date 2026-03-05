import { Router, Request, Response } from 'express';
import { db } from '../db';
import { alertRequests, users } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { sanitizeText } from '../middleware/sanitizer';
import OpenAI from 'openai';

/**
 * Validates and parses an ID parameter from request params.
 * Returns the parsed integer if valid, or null if invalid.
 */
function parseAndValidateId(id: string): number | null {
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return null;
  }
  return parsedId;
}

/**
 * Alert Requests API
 * Handles user-submitted requests for new notification types
 */

export function createAlertRequestsRouter(deps: { isAuthenticated: any }) {
  const router = Router();

  // Get all alert requests for the current user
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const requests = await db
        .select()
        .from(alertRequests)
        .where(eq(alertRequests.userId, userId))
        .orderBy(desc(alertRequests.createdAt));

      res.json(requests);
    } catch (error) {
      logger.error('Error fetching alert requests:', error);
      res.status(500).json({ error: 'Failed to fetch alert requests' });
    }
  });

  // Create a new alert request
  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { alertDescription, preferredChannel, frequency, additionalNotes } = req.body;

      if (!alertDescription || alertDescription.length < 10) {
        return res.status(400).json({ error: 'Alert description must be at least 10 characters' });
      }

      const [newRequest] = await db
        .insert(alertRequests)
        .values({
          userId,
          alertDescription,
          preferredChannel: preferredChannel || 'no_preference',
          frequency: frequency || 'immediate',
          additionalNotes: additionalNotes || null,
        })
        .returning();

      logger.info(`Alert request created by user ${userId}: ${alertDescription.substring(0, 50)}...`);

      res.status(201).json(newRequest);
    } catch (error) {
      logger.error('Error creating alert request:', error);
      res.status(500).json({ error: 'Failed to create alert request' });
    }
  });

  // Get all alert requests (admin only)
  router.get('/admin/all', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has admin permissions (80+ is admin level)
      if (typeof user.permissions !== 'number' || user.permissions < 80) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const requests = await db
        .select({
          request: alertRequests,
          userName: users.displayName,
          userEmail: users.email,
        })
        .from(alertRequests)
        .leftJoin(users, eq(alertRequests.userId, users.id))
        .orderBy(desc(alertRequests.createdAt));

      res.json(requests);
    } catch (error) {
      logger.error('Error fetching all alert requests:', error);
      res.status(500).json({ error: 'Failed to fetch alert requests' });
    }
  });

  // Update alert request status (admin only)
  router.put('/admin/:id', async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has admin permissions
      if (typeof user.permissions !== 'number' || user.permissions < 80) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { id } = req.params;
      const alertId = parseInt(id, 10);

      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert request ID' });
      }

      const { status, adminNotes } = req.body;

      // Validate that id is a valid integer
      const parsedId = parseAndValidateId(id);
      if (parsedId === null) {
        return res.status(400).json({ error: 'Invalid alert request ID' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (status) {
        updateData.status = status;
        updateData.reviewedBy = user.id;
        updateData.reviewedAt = new Date();

        if (status === 'implemented') {
          updateData.implementedAt = new Date();
        }
      }

      if (adminNotes !== undefined) {
        updateData.adminNotes = adminNotes;
      }

      const [updatedRequest] = await db
        .update(alertRequests)
        .set(updateData)
        .where(eq(alertRequests.id, parsedId))
        .returning();

      if (!updatedRequest) {
        return res.status(404).json({ error: 'Alert request not found' });
      }

      logger.info(`Alert request ${parsedId} updated by admin ${user.id}: status=${status}`);

      res.json(updatedRequest);
    } catch (error) {
      logger.error('Error updating alert request:', error);
      res.status(500).json({ error: 'Failed to update alert request' });
    }
  });

  // Delete alert request
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const alertId = parseInt(id, 10);

      if (isNaN(alertId)) {
        return res.status(400).json({ error: 'Invalid alert request ID' });
      }

      // Validate that id is a valid integer
      const parsedId = parseAndValidateId(id);
      if (parsedId === null) {
        return res.status(400).json({ error: 'Invalid alert request ID' });
      }

      // Only allow users to delete their own requests (or admins)
      const user = (req as any).user;
      const isAdmin = typeof user.permissions === 'number' && user.permissions >= 80;

      const [deleted] = await db
        .delete(alertRequests)
        .where(
          isAdmin
            ? eq(alertRequests.id, parsedId)
            : and(eq(alertRequests.id, parsedId), eq(alertRequests.userId, userId))
        )
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Alert request not found or not authorized' });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting alert request:', error);
      res.status(500).json({ error: 'Failed to delete alert request' });
    }
  });

  return router;
}

/**
 * AI Alert Generation API
 * Uses OpenAI to help users describe and refine their alert requests
 */
export function createAIAlertRouter(deps: { isAuthenticated: any }) {
  const router = Router();

  router.post('/generate-alert', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { prompt } = req.body;

      if (!prompt || prompt.length < 10) {
        return res.status(400).json({ error: 'Please provide a more detailed description' });
      }

      if (prompt.length > 1000) {
        return res.status(400).json({ error: 'Prompt must be 1000 characters or less' });
      }

      // Check if OpenAI is configured
      if (!process.env.OPENAI_API_KEY) {
        // Sanitize user input before including in response
        const sanitizedPrompt = sanitizeText(prompt);
        const sanitizedAfterWhen = prompt.toLowerCase().includes('when')
          ? sanitizeText(prompt.split('when')[1]?.trim() || prompt)
          : sanitizedPrompt;
        
        // Provide a helpful fallback response if no AI is available
        return res.json({
          generatedAlert: `Based on your request: "${sanitizedPrompt}"\n\nHere's a suggested alert description:\n\nI would like to receive notifications when ${prompt.toLowerCase().includes('when') ? sanitizedAfterWhen : sanitizedPrompt}.\n\nPlease include:\n- The specific trigger condition\n- Preferred timing (immediately, daily digest, etc.)\n- Which delivery method works best (email, SMS, or both)`,
          suggestion: `I would like to be notified ${prompt.toLowerCase().includes('when') ? 'when' + sanitizedAfterWhen : 'about: ' + sanitizedPrompt}`,
        });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for The Sandwich Project, a non-profit organization that coordinates volunteers to make sandwiches for those in need.

Your job is to help users describe alert/notification preferences they want to set up. The platform currently supports:
- Email notifications
- SMS text message notifications

Current alerts in the system include:
1. Event reminders before volunteer shifts (configurable timing)
2. TSP contact assignment notifications when assigned to an event
3. Chat room @mention notifications
4. Team board assignment notifications
5. Weekly sandwich collection reminders (SMS)

When a user describes what they want to be notified about, help them refine their request into a clear, actionable alert description that includes:
1. What triggers the notification (the condition)
2. When it should be sent (timing)
3. What information should be included

Be concise and practical. Frame the response as a well-written alert request that the development team can implement.`,
          },
          {
            role: 'user',
            content: `Help me create an alert for the following: ${prompt}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const generatedAlert = completion.choices[0]?.message?.content || 'Unable to generate suggestion';

      res.json({
        generatedAlert,
        suggestion: generatedAlert,
      });
    } catch (error) {
      logger.error('Error generating AI alert:', error);

      // Sanitize user input before including in fallback response
      const sanitizedPrompt = sanitizeText(req.body.prompt || '');
      
      // Provide fallback on error
      const safePrompt =
        typeof req.body?.prompt === 'string' && req.body.prompt.trim().length > 0
          ? req.body.prompt.replace(/[\r\n]+/g, ' ').slice(0, 200)
          : 'a new alert (details not provided)';
      res.json({
        generatedAlert: `Based on your description, here's a draft alert request:\n\nI would like to receive a notification about: ${sanitizedPrompt}\n\nPlease specify:\n- What should trigger this alert?\n- How soon before/after should it be sent?\n- Do you prefer email, SMS, or both?`,
        suggestion: `Notification request: ${sanitizedPrompt}`,
      });
    }
  });

  return router;
}
