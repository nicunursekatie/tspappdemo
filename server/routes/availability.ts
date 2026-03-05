import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage-wrapper';
import {
  requirePermission,
  requireOwnershipPermission,
} from '../middleware/auth';
import { logger } from '../middleware/logger';
import { insertAvailabilitySlotSchema } from '@shared/schema';
import { db } from '../db';
import { eventRequests, eventVolunteers, users } from '@shared/schema';
import { and, gte, lte, inArray, isNotNull, isNull, eq } from 'drizzle-orm';

const availabilityRouter = Router();

availabilityRouter.get('/', requirePermission('AVAILABILITY_VIEW'), async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    let slots;

    if (userId && startDate && endDate) {
      const userSlots = await storage.getAvailabilitySlotsByUserId(userId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      slots = userSlots.filter(
        slot =>
          new Date(slot.startAt) <= end && new Date(slot.endAt) >= start
      );
    } else if (userId) {
      slots = await storage.getAvailabilitySlotsByUserId(userId);
    } else if (startDate && endDate) {
      slots = await storage.getAvailabilitySlotsByDateRange(
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      slots = await storage.getAllAvailabilitySlots();
    }

    res.json(slots);
  } catch (error) {
    logger.error('Failed to fetch availability slots', error);
    res.status(500).json({ message: 'Failed to fetch availability slots' });
  }
});

// Events + assignments for Team Availability calendar
availabilityRouter.get('/events', requirePermission('AVAILABILITY_VIEW'), async (req, res) => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required (yyyy-MM-dd)' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for startDate or endDate' });
    }

    // Fetch scheduled events in range
    const events = await db
      .select({
        id: eventRequests.id,
        organizationName: eventRequests.organizationName,
        status: eventRequests.status,
        scheduledEventDate: eventRequests.scheduledEventDate,
        startTime: eventRequests.eventStartTime,
        endTime: eventRequests.eventEndTime,
        eventAddress: eventRequests.eventAddress,
        createdAt: eventRequests.createdAt,
      })
      .from(eventRequests)
      .where(
        and(
          isNotNull(eventRequests.scheduledEventDate),
          gte(eventRequests.scheduledEventDate, start),
          lte(eventRequests.scheduledEventDate, end),
          // Respect soft-delete
          isNull(eventRequests.deletedAt)
        )
      )
      .orderBy(eventRequests.scheduledEventDate);

    const eventIds = events.map((e) => e.id);
    if (eventIds.length === 0) {
      return res.json([]);
    }

    // Fetch volunteer assignments for the events in one query
    const volunteerRows = await db
      .select({
        id: eventVolunteers.id,
        eventRequestId: eventVolunteers.eventRequestId,
        volunteerUserId: eventVolunteers.volunteerUserId,
        volunteerName: eventVolunteers.volunteerName,
        role: eventVolunteers.role,
        status: eventVolunteers.status,
        userDisplayName: users.displayName,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(eventVolunteers)
      .leftJoin(users, eq(eventVolunteers.volunteerUserId, users.id))
      .where(inArray(eventVolunteers.eventRequestId, eventIds));

    const volunteersByEvent = volunteerRows.reduce<Record<number, any[]>>((acc, vol) => {
      if (!acc[vol.eventRequestId]) acc[vol.eventRequestId] = [];
      const name =
        vol.userDisplayName ||
        [vol.userFirstName, vol.userLastName].filter(Boolean).join(' ').trim() ||
        vol.volunteerName ||
        vol.userEmail ||
        'Unknown';
      acc[vol.eventRequestId].push({
        id: vol.id,
        userId: vol.volunteerUserId,
        name,
        role: vol.role,
        status: vol.status,
      });
      return acc;
    }, {});

    const response = events.map((event) => ({
      ...event,
      title: event.organizationName || 'Event',
      volunteers: volunteersByEvent[event.id] || [],
    }));

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch event assignments for availability view', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

availabilityRouter.get('/:id', requirePermission('AVAILABILITY_VIEW'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid availability slot ID' });
    }

    const slot = await storage.getAvailabilitySlotById(id);
    if (!slot) {
      return res.status(404).json({ message: 'Availability slot not found' });
    }

    res.json(slot);
  } catch (error) {
    logger.error('Failed to fetch availability slot', error);
    res.status(500).json({ message: 'Failed to fetch availability slot' });
  }
});

availabilityRouter.post('/', requirePermission('AVAILABILITY_ADD'), async (req, res) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Convert string dates to Date objects before validation
    const requestData = {
      ...req.body,
      userId: user.id,
      startAt: req.body.startAt ? new Date(req.body.startAt) : undefined,
      endAt: req.body.endAt ? new Date(req.body.endAt) : undefined,
    };

    const slotData = insertAvailabilitySlotSchema.parse(requestData);

    const slot = await storage.createAvailabilitySlot(slotData);

    res.status(201).json(slot);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid availability slot input', {
        error: error.errors,
        ip: req.ip,
      });
      res
        .status(400)
        .json({ message: 'Invalid availability slot data', errors: error.errors });
    } else {
      logger.error('Failed to create availability slot', error);
      res.status(500).json({ message: 'Failed to create availability slot' });
    }
  }
});

availabilityRouter.put(
  '/:id',
  requireOwnershipPermission(
    'AVAILABILITY_EDIT_OWN',
    'AVAILABILITY_EDIT_ALL',
    async (req) => {
      const id = parseInt(req.params.id);
      const slot = await storage.getAvailabilitySlotById(id);
      return slot?.userId || null;
    }
  ),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid availability slot ID' });
      }

      // Convert string dates to Date objects if present
      const updates = {
        ...req.body,
        ...(req.body.startAt && { startAt: new Date(req.body.startAt) }),
        ...(req.body.endAt && { endAt: new Date(req.body.endAt) }),
      };
      const slot = await storage.updateAvailabilitySlot(id, updates);

      if (!slot) {
        return res.status(404).json({ message: 'Availability slot not found' });
      }

      res.json(slot);
    } catch (error) {
      logger.error('Failed to update availability slot', error);
      res.status(500).json({ message: 'Failed to update availability slot' });
    }
  }
);

availabilityRouter.delete(
  '/:id',
  requireOwnershipPermission(
    'AVAILABILITY_DELETE_OWN',
    'AVAILABILITY_DELETE_ALL',
    async (req) => {
      const id = parseInt(req.params.id);
      const slot = await storage.getAvailabilitySlotById(id);
      return slot?.userId || null;
    }
  ),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid availability slot ID' });
      }

      const slot = await storage.getAvailabilitySlotById(id);
      if (!slot) {
        return res.status(404).json({ message: 'Availability slot not found' });
      }

      await storage.deleteAvailabilitySlot(id);

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete availability slot', error);
      res.status(500).json({ message: 'Failed to delete availability slot' });
    }
  }
);

export default availabilityRouter;
