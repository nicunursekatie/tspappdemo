/**
 * Event Requests - Volunteer Management Routes
 *
 * Handles volunteer signup, management, and assignment for events.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../storage-wrapper';
import { insertEventVolunteerSchema } from '@shared/schema';
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
// Event Volunteers Routes
// ============================================================================

// Get all event volunteers for a specific event
router.get('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    const volunteers = await storage.getEventVolunteersByEventId(eventId);

    res.json(volunteers);
  } catch (error) {
    logger.error('Error fetching event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch event volunteers' });
  }
});

// Sign up a user as a volunteer for an event
router.post('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user?.id;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    // Validate request body against schema
    const volunteerData = insertEventVolunteerSchema.parse({
      ...req.body,
      eventRequestId: eventId,
      volunteerUserId: userId,
    });

    // Check if user is already signed up for this event with the same role
    const existingVolunteers =
      await storage.getEventVolunteersByEventId(eventId);
    const alreadySignedUp = existingVolunteers.find(
      (v) => v.volunteerUserId === userId && v.role === volunteerData.role
    );

    if (alreadySignedUp) {
      return res.status(400).json({
        error: `You are already signed up as a ${volunteerData.role} for this event`,
      });
    }

    const newVolunteer = await storage.createEventVolunteer(volunteerData);

    await logActivity(
      req,
      res,
      'volunteer_signup',
      `Signed up as ${volunteerData.role} for event: ${eventId}`
    );

    res.status(201).json(newVolunteer);
  } catch (error) {
    logger.error('Error creating event volunteer signup:', error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid volunteer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to sign up for event' });
  }
});

// Update volunteer status or assignment
router.patch('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const updates = req.body;

    const updatedVolunteer = await storage.updateEventVolunteer(
      volunteerId,
      updates
    );

    if (!updatedVolunteer) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    await logActivity(
      req,
      res,
      'volunteer_update',
      `Updated volunteer assignment: ${volunteerId}`
    );

    res.json(updatedVolunteer);
  } catch (error) {
    logger.error('Error updating event volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer assignment' });
  }
});

// Remove volunteer from event
router.delete('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const deleted = await storage.deleteEventVolunteer(volunteerId);

    if (!deleted) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    await logActivity(
      req,
      res,
      'volunteer_removal',
      `Removed volunteer assignment: ${volunteerId}`
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing event volunteer:', error);
    res.status(500).json({ error: 'Failed to remove volunteer assignment' });
  }
});

// Get all event volunteers (for admin search/filtering)
router.get('/all-volunteers', isAuthenticated, async (req, res) => {
  try {
    const allVolunteers = await storage.getAllEventVolunteers();
    res.json(allVolunteers);
  } catch (error) {
    logger.error('Error fetching all event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch all event volunteers' });
  }
});

// Get all volunteer signups for the current user
router.get('/my-volunteers', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    const userVolunteers = await storage.getEventVolunteersByUserId(userId);

    // Enrich with event details
    const enrichedVolunteers = await Promise.all(
      userVolunteers.map(async (volunteer) => {
        const eventRequest = await storage.getEventRequestById(
          volunteer.eventRequestId
        );
        return {
          ...volunteer,
          eventRequest,
        };
      })
    );

    res.json(enrichedVolunteers);
  } catch (error) {
    logger.error('Error fetching user volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch volunteer signups' });
  }
});

export default router;
