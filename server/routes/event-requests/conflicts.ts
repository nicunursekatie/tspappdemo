/**
 * Event Requests - Conflict Detection Routes
 *
 * Handles checking for scheduling conflicts, date conflicts, and returning organizations.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router } from 'express';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';

const router = Router();

// ============================================================================
// Conflict Detection Routes
// ============================================================================

/**
 * Optimistic conflict checking for event scheduling
 * POST /api/event-requests/check-conflicts
 *
 * Returns conflicts/warnings without blocking event creation
 */
router.post('/check-conflicts', isAuthenticated, async (req, res) => {
  try {
    const { checkEventConflicts } = await import('../../services/event-conflict-detection');

    const eventData = {
      id: req.body.id,
      scheduledEventDate: req.body.scheduledEventDate,
      eventStartTime: req.body.eventStartTime,
      eventEndTime: req.body.eventEndTime,
      vanBooked: req.body.vanBooked,
      driverName: req.body.driverName,
      recipientId: req.body.recipientId,
      organizationName: req.body.organizationName,
    };

    const result = await checkEventConflicts(eventData);

    res.json(result);
  } catch (error) {
    logger.error('Error checking event conflicts:', error);
    res.status(500).json({
      hasConflicts: false,
      warnings: [],
      summary: 'Error checking conflicts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all conflicts for a specific date
 * GET /api/event-requests/conflicts-for-date?date=2024-01-15
 */
router.get('/conflicts-for-date', isAuthenticated, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const { getConflictsForDate } = await import('../../services/event-conflict-detection');
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const result = await getConflictsForDate(date);
    res.json(result);
  } catch (error) {
    logger.error('Error getting conflicts for date:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Check if an organization is a returning organization
 * GET /api/event-requests/check-returning-org?orgName=...&currentEventId=...&contactEmail=...&contactName=...&contactPhone=...
 *
 * This endpoint helps the intake team identify organizations that have worked with us before,
 * so they can personalize their outreach instead of sending generic first-time emails.
 *
 * IMPORTANT: Contact matching requires email OR (name + phone) match to prevent
 * false positives from people with the same name.
 *
 * Returns:
 * - isReturning: boolean - Whether the organization has past events/collections
 * - isReturningContact: boolean - Whether the contact person has been involved in past events
 * - pastEventCount: number - Number of past events
 * - collectionCount: number - Number of sandwich collections
 * - mostRecentEvent: object - Most recent event info (if any)
 * - pastContactName: string - Name of the most recent past contact (for context)
 */
router.get('/check-returning-org', isAuthenticated, async (req, res) => {
  try {
    const orgName = req.query.orgName as string;
    const currentEventId = req.query.currentEventId ? parseInt(req.query.currentEventId as string) : undefined;
    const contactEmail = req.query.contactEmail as string | undefined;
    const contactName = req.query.contactName as string | undefined;
    const contactPhone = req.query.contactPhone as string | undefined;
    const department = req.query.department as string | undefined;

    if (!orgName) {
      return res.status(400).json({ error: 'Organization name required' });
    }

    const { checkReturningOrganization } = await import('../../services/organizations/returning-organization');
    const result = await checkReturningOrganization(orgName, currentEventId, contactEmail, contactName, contactPhone, department);

    res.json(result);
  } catch (error) {
    logger.error('Error checking returning organization:', error);
    res.status(500).json({
      isReturning: false,
      isReturningContact: false,
      pastEventCount: 0,
      collectionCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
