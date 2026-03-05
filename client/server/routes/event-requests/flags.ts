/**
 * Event Requests - Pre-Event Flag Routes
 *
 * Handles adding, resolving, and deleting pre-event flags for events.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Enhanced logging function for activity tracking
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
};

// ============================================================================
// Pre-Event Flag Routes
// ============================================================================

// Add a pre-event flag to an event
router.post('/:id/flags', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { type, message, createdBy, createdByName, dueDate } = req.body;

    if (!type || !message) {
      return res.status(400).json({ error: 'Type and message are required' });
    }

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags or initialize empty array
    const currentFlags = existingEvent.preEventFlags || [];

    // Create new flag
    const newFlag = {
      id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      createdAt: new Date().toISOString(),
      createdBy,
      createdByName,
      resolvedAt: null,
      resolvedBy: null,
      resolvedByName: null,
      dueDate: dueDate || null,
    };

    // Add flag to array
    const updatedFlags = [...currentFlags, newFlag];

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_ADD',
      `Added ${type} flag to event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error adding pre-event flag:', error);
    res.status(500).json({ error: 'Failed to add pre-event flag' });
  }
});

// Resolve a pre-event flag
router.patch('/:id/flags/:flagId/resolve', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { flagId } = req.params;
    const { resolvedBy, resolvedByName } = req.body;

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags
    const currentFlags = existingEvent.preEventFlags || [];

    // Find and update the flag
    const updatedFlags = currentFlags.map(flag => {
      if (flag.id === flagId) {
        return {
          ...flag,
          resolvedAt: new Date().toISOString(),
          resolvedBy,
          resolvedByName,
        };
      }
      return flag;
    });

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_RESOLVE',
      `Resolved flag for event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error resolving pre-event flag:', error);
    res.status(500).json({ error: 'Failed to resolve pre-event flag' });
  }
});

// Delete a pre-event flag
router.delete('/:id/flags/:flagId', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const { flagId } = req.params;

    // Fetch current event
    const existingEvent = await storage.getEventRequestById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get current flags and filter out the one to delete
    const currentFlags = existingEvent.preEventFlags || [];
    const updatedFlags = currentFlags.filter(flag => flag.id !== flagId);

    // Update event
    const updatedEvent = await storage.updateEventRequest(eventId, {
      preEventFlags: updatedFlags,
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_FLAGS_DELETE',
      `Deleted flag from event: ${existingEvent.organizationName}`
    );

    res.json(updatedEvent);
  } catch (error) {
    logger.error('Error deleting pre-event flag:', error);
    res.status(500).json({ error: 'Failed to delete pre-event flag' });
  }
});

export default router;
