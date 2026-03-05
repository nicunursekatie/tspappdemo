import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eventRequests, users } from '@shared/schema';
import { eq, and, or, inArray, isNull, like, sql } from 'drizzle-orm';

const router = Router();

/**
 * External API for Intake Workflow App
 *
 * GET /api/external/event-requests
 *   - Fetches event requests for a specific user
 *   - Query params:
 *     - assignedTo: Filter by assignedTo field (user ID)
 *     - tspContact: Filter by tspContactAssigned, tspContact, OR customTspContact containing the user ID
 *     - status: Comma-separated list of statuses (optional, defaults to 'new,in_process')
 *   - At least one of assignedTo or tspContact is required
 *
 * PATCH /api/external/event-requests/:id
 *   - Updates an event request with intake data
 *   - Typically used to complete intake and move to 'scheduled' status
 *
 * GET /api/external/event-requests/user-lookup
 *   - Looks up a user's platform ID by email address
 *   - Query params:
 *     - email: The user's email address
 *   - Returns the user's ID, name, and role
 */

// GET - Look up a user's platform ID by email address
router.get('/user-lookup', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({
        message: 'Email query parameter is required',
        code: 'MISSING_EMAIL',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        role: users.role,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(sql`LOWER(${users.email})`, normalizedEmail));

    if (!user) {
      return res.status(404).json({
        message: 'No user found with that email address',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'User account is inactive',
        code: 'USER_INACTIVE',
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error looking up user:', error);
    res.status(500).json({
      message: 'Failed to look up user',
      code: 'LOOKUP_ERROR',
    });
  }
});

// GET - Fetch event requests assigned to a user or by TSP contact
router.get('/', async (req: Request, res: Response) => {
  try {
    const { assignedTo, tspContact, status } = req.query;

    if (!assignedTo && !tspContact) {
      return res.status(400).json({
        message: 'Either assignedTo or tspContact query parameter is required',
        code: 'MISSING_FILTER',
      });
    }

    // Build query conditions
    const conditions: any[] = [
      isNull(eventRequests.deletedAt),
    ];

    // Add user filter - either by assignedTo or tspContact
    if (assignedTo) {
      conditions.push(eq(eventRequests.assignedTo, assignedTo as string));
    }

    if (tspContact) {
      const tspId = tspContact as string;
      conditions.push(
        or(
          eq(eventRequests.tspContactAssigned, tspId),
          eq(eventRequests.tspContact, tspId),
          like(eventRequests.customTspContact, `%${tspId}%`)
        )
      );
    }

    // Filter by status if provided, otherwise default to active intake statuses
    if (status) {
      const statusList = (status as string).split(',');
      conditions.push(inArray(eventRequests.status, statusList));
    } else {
      // Default: fetch events that need intake work (new, in_process)
      conditions.push(inArray(eventRequests.status, ['new', 'in_process']));
    }

    const requests = await db
      .select()
      .from(eventRequests)
      .where(and(...conditions));

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error('Error fetching external event requests:', error);
    res.status(500).json({
      message: 'Failed to fetch event requests',
      code: 'FETCH_ERROR',
    });
  }
});

// PATCH - Update an event request with intake data
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        message: 'Valid event request ID is required',
        code: 'INVALID_ID',
      });
    }

    // Validate the event exists and is assigned to the requesting user
    const [existing] = await db
      .select()
      .from(eventRequests)
      .where(and(
        eq(eventRequests.id, parseInt(id)),
        isNull(eventRequests.deletedAt)
      ));

    if (!existing) {
      return res.status(404).json({
        message: 'Event request not found',
        code: 'NOT_FOUND',
      });
    }

    // Define allowed fields that can be updated via external API
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'backupContactFirstName',
      'backupContactLastName',
      'backupContactEmail',
      'backupContactPhone',
      'backupContactRole',
      'organizationName',
      'department',
      'organizationCategory',
      'schoolClassification',
      'partnerOrganizations',
      'desiredEventDate',
      'backupDates',
      'dateFlexible',
      'scheduledEventDate',
      'isConfirmed',
      'eventLocation',
      'locationAddress',
      'locationDetails',
      'latitude',
      'longitude',
      'expectedAttendance',
      'estimatedSandwiches',
      'actualSandwichCount',
      'eventDescription',
      'message',
      'specialRequests',
      'dietaryRestrictions',
      'eventType',
      'isRecurring',
      'recurringPattern',
      'status',
      'notes',
      'internalNotes',
    ];

    // Filter to only allowed fields
    const filteredUpdate: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updateData) {
        filteredUpdate[key] = updateData[key];
      }
    }

    if (Object.keys(filteredUpdate).length === 0) {
      return res.status(400).json({
        message: 'No valid fields to update',
        code: 'NO_VALID_FIELDS',
      });
    }

    // If status is being changed, track when
    if (filteredUpdate.status && filteredUpdate.status !== existing.status) {
      filteredUpdate.statusChangedAt = new Date();
    }

    // Add updated timestamp
    filteredUpdate.updatedAt = new Date();

    // Perform the update
    await db
      .update(eventRequests)
      .set(filteredUpdate)
      .where(eq(eventRequests.id, parseInt(id)));

    // Fetch the updated record
    const [updated] = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, parseInt(id)));

    res.json({
      success: true,
      message: 'Event request updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating external event request:', error);
    res.status(500).json({
      message: 'Failed to update event request',
      code: 'UPDATE_ERROR',
    });
  }
});

export default router;
