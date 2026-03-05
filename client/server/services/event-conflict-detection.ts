/**
 * Event Conflict Detection Service
 *
 * Automatically detects scheduling conflicts for events:
 * - Van booking conflicts (overlapping times when van is needed)
 * - High volume days (multiple events on same day)
 * - Van driver conflicts (same van driver assigned to overlapping events)
 * - Speaker conflicts (same speaker assigned to overlapping events)
 * - Recipient conflicts (same recipient has another event)
 * - Pickup time conflicts (multiple events with similar pickup times)
 *
 * Conflicts are flagged but don't prevent event creation.
 */

import { db } from '../db';
import { eventRequests, drivers } from '@shared/schema';
import { eq, and, ne, gte, lte, or, sql, inArray } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export interface ConflictWarning {
  type: 'van_conflict' | 'high_volume_day' | 'driver_conflict' | 'recipient_conflict' | 'time_overlap' | 'speaker_conflict' | 'pickup_conflict';
  severity: 'warning' | 'critical';
  message: string;
  conflictingEventId?: number;
  conflictingEventName?: string;
  conflictingEventTime?: string;
  details?: Record<string, any>;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  warnings: ConflictWarning[];
  summary: string;
}

/**
 * Parse time string (e.g., "2:30 PM", "14:30") to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;

  // Try parsing "HH:MM AM/PM" format
  const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = parseInt(amPmMatch[2], 10);
    const period = amPmMatch[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Try parsing "HH:MM" 24-hour format
  const h24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Check if two time ranges overlap
 */
function timesOverlap(
  start1: number | null,
  end1: number | null,
  start2: number | null,
  end2: number | null
): boolean {
  // If we don't have complete time info, assume potential overlap
  if (start1 === null || end1 === null || start2 === null || end2 === null) {
    return true; // Conservative: assume overlap if we can't determine
  }

  // Check for overlap: one range starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Get the date portion of a Date object as YYYY-MM-DD string
 */
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check for all conflicts for an event
 */
export async function checkEventConflicts(
  eventData: {
    id?: number; // If editing existing event
    scheduledEventDate?: Date | string | null;
    eventStartTime?: string | null;
    eventEndTime?: string | null;
    pickupTime?: string | null; // Pickup time for drivers
    vanDriverNeeded?: boolean | null; // Whether a van driver is required
    isDhlVan?: boolean | null; // External DHL van covers transportation
    selfTransport?: boolean | null; // Organization transporting sandwiches themselves
    assignedVanDriverId?: string | null; // Van driver ID from database
    assignedSpeakerIds?: string[] | null; // Array of speaker IDs
    assignedRecipientIds?: string[] | null; // Array of recipient IDs
    organizationName?: string | null;
    // Legacy fields for backwards compatibility
    vanBooked?: string | null;
    driverName?: string | null;
    recipientId?: number | null;
  }
): Promise<ConflictCheckResult> {
  const warnings: ConflictWarning[] = [];

  // Parse the scheduled date
  let scheduledDate: Date | null = null;
  if (eventData.scheduledEventDate) {
    scheduledDate = typeof eventData.scheduledEventDate === 'string'
      ? new Date(eventData.scheduledEventDate)
      : eventData.scheduledEventDate;
  }

  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return {
      hasConflicts: false,
      warnings: [],
      summary: 'No scheduled date provided - cannot check conflicts',
    };
  }

  const dateStr = getDateString(scheduledDate);
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

  try {
    // Find all other events on the same day (excluding current event if editing)
    // Include new, in_process, scheduled, and rescheduled for high volume detection
    const allRelevantConditions = [
      gte(eventRequests.scheduledEventDate, startOfDay),
      lte(eventRequests.scheduledEventDate, endOfDay),
      // Include new, in_process, scheduled, and rescheduled events (not cancelled/completed/postponed/declined)
      or(
        eq(eventRequests.status, 'new'),
        eq(eventRequests.status, 'in_process'),
        eq(eventRequests.status, 'scheduled'),
        eq(eventRequests.status, 'rescheduled')
      ),
    ];

    if (eventData.id) {
      allRelevantConditions.push(ne(eventRequests.id, eventData.id));
    }

    const allEventsOnSameDay = await db
      .select()
      .from(eventRequests)
      .where(and(...allRelevantConditions));

    // Only check against SCHEDULED events for resource conflicts
    // Scheduled events take precedence - new/in_process events need to work around them
    const eventsOnSameDay = allEventsOnSameDay.filter(
      e => e.status === 'scheduled'
    );

    // Check 1: High volume day warning (count all relevant events including new/in_process)
    // This still shows all events for awareness, even if they're not scheduled yet
    if (allEventsOnSameDay.length >= 2) {
      const scheduledCount = eventsOnSameDay.length;
      const pendingCount = allEventsOnSameDay.length - scheduledCount;

      let message: string;
      if (pendingCount > 0 && scheduledCount > 0) {
        message = `${scheduledCount} scheduled + ${pendingCount} pending event(s) for ${scheduledDate.toLocaleDateString()}`;
      } else if (pendingCount > 0) {
        message = `${pendingCount} pending event(s) already being planned for ${scheduledDate.toLocaleDateString()}`;
      } else {
        message = `${scheduledCount} event(s) already scheduled for ${scheduledDate.toLocaleDateString()}`;
      }

      warnings.push({
        type: 'high_volume_day',
        severity: allEventsOnSameDay.length >= 4 ? 'critical' : 'warning',
        message,
        details: {
          eventCount: allEventsOnSameDay.length + 1, // Include the new event
          scheduledCount,
          pendingCount,
          events: allEventsOnSameDay.map(e => ({
            id: e.id,
            name: e.organizationName,
            time: e.eventStartTime,
            status: e.status,
          })),
        },
      });
    }

    // Parse current event times
    const currentStart = parseTimeToMinutes(eventData.eventStartTime);
    const currentEnd = parseTimeToMinutes(eventData.eventEndTime);
    const currentPickup = parseTimeToMinutes(eventData.pickupTime);

    // Determine if current event needs van (using proper schema fields)
    // Support both new schema fields and legacy vanBooked field for backwards compatibility
    const currentNeedsVan = eventData.isDhlVan === true ? false : (
      (eventData.vanDriverNeeded === true && eventData.selfTransport !== true) ||
      (eventData.vanBooked && eventData.vanBooked.toLowerCase() !== 'no' && eventData.vanBooked.toLowerCase() !== 'false')
    );

    // Get van driver ID (new field or legacy driverName)
    const currentVanDriverId = eventData.assignedVanDriverId || eventData.driverName || null;

    // Helper to normalize PostgreSQL array format to JS array of strings
    // This ensures consistent string comparison for IDs
    const normalizeArrayField = (field: any): string[] => {
      if (!field) return [];
      if (Array.isArray(field)) return field.filter(Boolean).map(String);
      if (typeof field === 'string' && field.startsWith('{') && field.endsWith('}')) {
        // PostgreSQL array format: {val1,val2,val3}
        const content = field.slice(1, -1);
        if (!content) return [];
        return content.split(',').map(v => v.trim().replace(/^"|"$/g, '')).filter(Boolean);
      }
      return [String(field)];
    };

    // Get speaker IDs (array) - normalize to strings for consistent comparison
    const currentSpeakerIds = normalizeArrayField(eventData.assignedSpeakerIds);

    // Get recipient IDs (array) - support both new array format and legacy single recipientId
    // Normalize to strings for consistent comparison with database values
    const currentRecipientIds = eventData.assignedRecipientIds && eventData.assignedRecipientIds.length > 0
      ? normalizeArrayField(eventData.assignedRecipientIds)
      : (eventData.recipientId ? [String(eventData.recipientId)] : []);

    // Fetch driver names for better messaging
    const driverNamesMap = new Map<string, string>();
    const allDriverIds = new Set<string>();

    if (currentVanDriverId) allDriverIds.add(currentVanDriverId);
    for (const event of eventsOnSameDay) {
      if (event.assignedVanDriverId) allDriverIds.add(event.assignedVanDriverId);
    }

    if (allDriverIds.size > 0) {
      try {
        const driverRecords = await db
          .select({ id: drivers.id, name: drivers.name })
          .from(drivers)
          .where(inArray(drivers.id, Array.from(allDriverIds).map(Number).filter(n => !isNaN(n))));

        for (const driver of driverRecords) {
          driverNamesMap.set(String(driver.id), driver.name);
        }
      } catch (err) {
        // If driver lookup fails, continue without names
        logger.warn('Could not fetch driver names for conflict messages');
      }
    }

    // Track already reported conflicts to avoid duplicates
    const reportedVanConflicts = new Set<number>();
    const reportedDriverConflicts = new Set<string>();
    const reportedSpeakerConflicts = new Set<string>();
    const reportedRecipientConflicts = new Set<string>();

    // Check each event for specific conflicts
    for (const existingEvent of eventsOnSameDay) {
      const existingStart = parseTimeToMinutes(existingEvent.eventStartTime);
      const existingEnd = parseTimeToMinutes(existingEvent.eventEndTime);
      const existingPickup = parseTimeToMinutes(existingEvent.pickupTime || existingEvent.driverPickupTime);
      const hasTimeOverlap = timesOverlap(currentStart, currentEnd, existingStart, existingEnd);

      // Check 2: Van booking conflict
      // An event needs the van if vanDriverNeeded is true AND selfTransport is false
      const existingNeedsVan = existingEvent.vanDriverNeeded === true && existingEvent.selfTransport !== true && existingEvent.isDhlVan !== true;

      if (currentNeedsVan && existingNeedsVan && hasTimeOverlap && !reportedVanConflicts.has(existingEvent.id)) {
        reportedVanConflicts.add(existingEvent.id);
        warnings.push({
          type: 'van_conflict',
          severity: 'critical',
          message: `Van already needed for "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}. Only one van is available.`,
          conflictingEventId: existingEvent.id,
          conflictingEventName: existingEvent.organizationName || 'Unknown',
          conflictingEventTime: existingEvent.eventStartTime || undefined,
          details: {
            existingEventAddress: existingEvent.eventAddress,
            existingPickupTime: existingEvent.pickupTime || existingEvent.driverPickupTime,
          },
        });
      }

      // Check 3: Van Driver conflict (same driver assigned to overlapping events)
      const existingVanDriverId = existingEvent.assignedVanDriverId;
      if (currentVanDriverId && existingVanDriverId && hasTimeOverlap) {
        const conflictKey = `${currentVanDriverId}-${existingEvent.id}`;
        if (currentVanDriverId === existingVanDriverId && !reportedDriverConflicts.has(conflictKey)) {
          reportedDriverConflicts.add(conflictKey);
          const driverDisplayName = driverNamesMap.get(currentVanDriverId) || `Driver #${currentVanDriverId}`;
          warnings.push({
            type: 'driver_conflict',
            severity: 'critical',
            message: `${driverDisplayName} is already assigned to drive for "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}`,
            conflictingEventId: existingEvent.id,
            conflictingEventName: existingEvent.organizationName || 'Unknown',
            conflictingEventTime: existingEvent.eventStartTime || undefined,
            details: { driverName: driverDisplayName, driverId: currentVanDriverId },
          });
        }
      }

      // Check 4: Speaker conflict (same speaker assigned to overlapping events)
      const existingSpeakerIds = normalizeArrayField(existingEvent.assignedSpeakerIds);
      if (currentSpeakerIds.length > 0 && existingSpeakerIds.length > 0 && hasTimeOverlap) {
        for (const speakerId of currentSpeakerIds) {
          const conflictKey = `${speakerId}-${existingEvent.id}`;
          if (existingSpeakerIds.includes(speakerId) && !reportedSpeakerConflicts.has(conflictKey)) {
            reportedSpeakerConflicts.add(conflictKey);
            warnings.push({
              type: 'speaker_conflict',
              severity: 'critical',
              message: `Speaker #${speakerId} is already assigned to speak at "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}`,
              conflictingEventId: existingEvent.id,
              conflictingEventName: existingEvent.organizationName || 'Unknown',
              conflictingEventTime: existingEvent.eventStartTime || undefined,
              details: { speakerId },
            });
          }
        }
      }

      // Check 5: Recipient conflict (same recipient has multiple events on same day)
      const existingRecipientIds = normalizeArrayField(existingEvent.assignedRecipientIds);
      if (currentRecipientIds.length > 0 && existingRecipientIds.length > 0) {
        for (const recipientId of currentRecipientIds) {
          const conflictKey = `${recipientId}-${existingEvent.id}`;
          if (existingRecipientIds.includes(recipientId) && !reportedRecipientConflicts.has(conflictKey)) {
            reportedRecipientConflicts.add(conflictKey);
            warnings.push({
              type: 'recipient_conflict',
              severity: 'warning',
              message: `Same recipient already receiving sandwiches from "${existingEvent.organizationName}" on this day`,
              conflictingEventId: existingEvent.id,
              conflictingEventName: existingEvent.organizationName || 'Unknown',
              conflictingEventTime: existingEvent.eventStartTime || undefined,
              details: { recipientId },
            });
          }
        }
      }

      // Check 6: Pickup time conflict (same driver has pickups within 30 minutes of each other)
      // Only matters if the same driver is assigned to both events
      if (currentVanDriverId && existingVanDriverId && currentVanDriverId === existingVanDriverId) {
        if (currentPickup !== null && existingPickup !== null) {
          const pickupDifference = Math.abs(currentPickup - existingPickup);
          const PICKUP_CONFLICT_THRESHOLD = 30; // 30 minutes

          if (pickupDifference <= PICKUP_CONFLICT_THRESHOLD && pickupDifference > 0) {
            const driverDisplayName = driverNamesMap.get(currentVanDriverId) || `Driver #${currentVanDriverId}`;
            warnings.push({
              type: 'pickup_conflict',
              severity: 'warning',
              message: `${driverDisplayName} has another pickup within ${pickupDifference} minutes for "${existingEvent.organizationName}" (${existingEvent.pickupTime || existingEvent.driverPickupTime || 'TBD'})`,
              conflictingEventId: existingEvent.id,
              conflictingEventName: existingEvent.organizationName || 'Unknown',
              conflictingEventTime: existingEvent.pickupTime || existingEvent.driverPickupTime || undefined,
              details: {
                driverName: driverDisplayName,
                driverId: currentVanDriverId,
                currentPickupTime: eventData.pickupTime,
                existingPickupTime: existingEvent.pickupTime || existingEvent.driverPickupTime,
                timeDifferenceMinutes: pickupDifference,
              },
            });
          }
        }
      }
    }

    // Generate summary
    const criticalCount = warnings.filter(w => w.severity === 'critical').length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;

    let summary = 'No conflicts detected';
    if (warnings.length > 0) {
      const parts = [];
      if (criticalCount > 0) parts.push(`${criticalCount} critical`);
      if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
      summary = `${parts.join(', ')} found`;
    }

    return {
      hasConflicts: warnings.length > 0,
      warnings,
      summary,
    };
  } catch (error) {
    logger.error('Error checking event conflicts:', error);
    return {
      hasConflicts: false,
      warnings: [],
      summary: 'Error checking conflicts - please review manually',
    };
  }
}

/**
 * Get conflicts for a specific date (useful for calendar views)
 */
export async function getConflictsForDate(date: Date): Promise<{
  vanConflicts: Array<{ event1: any; event2: any }>;
  driverConflicts: Array<{ driver: string; events: any[] }>;
  highVolume: boolean;
  eventCount: number;
}> {
  const dateStr = getDateString(date);
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

  try {
    // Get all relevant events (new, in_process, scheduled, rescheduled) for high volume
    const allEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          gte(eventRequests.scheduledEventDate, startOfDay),
          lte(eventRequests.scheduledEventDate, endOfDay),
          or(
            eq(eventRequests.status, 'new'),
            eq(eventRequests.status, 'in_process'),
            eq(eventRequests.status, 'scheduled'),
            eq(eventRequests.status, 'rescheduled')
          )
        )
      );

    // For van/driver conflicts, only check scheduled/rescheduled events (with locked-in dates)
    const scheduledEvents = allEvents.filter(
      e => e.status === 'scheduled' || e.status === 'rescheduled'
    );

    const vanConflicts: Array<{ event1: any; event2: any }> = [];
    const driverGroups: Map<string, any[]> = new Map();

    // Check each pair of scheduled events
    for (let i = 0; i < scheduledEvents.length; i++) {
      const event1 = scheduledEvents[i];

      // Track van drivers by ID
      if (event1.assignedVanDriverId) {
        const driverKey = event1.assignedVanDriverId;
        if (!driverGroups.has(driverKey)) {
          driverGroups.set(driverKey, []);
        }
        driverGroups.get(driverKey)!.push(event1);
      }

      for (let j = i + 1; j < scheduledEvents.length; j++) {
        const event2 = scheduledEvents[j];

        // Check van conflict (using proper schema fields)
        const van1 = event1.vanDriverNeeded === true && event1.selfTransport !== true;
        const van2 = event2.vanDriverNeeded === true && event2.selfTransport !== true;

        if (van1 && van2) {
          const start1 = parseTimeToMinutes(event1.eventStartTime);
          const end1 = parseTimeToMinutes(event1.eventEndTime);
          const start2 = parseTimeToMinutes(event2.eventStartTime);
          const end2 = parseTimeToMinutes(event2.eventEndTime);

          if (timesOverlap(start1, end1, start2, end2)) {
            vanConflicts.push({ event1, event2 });
          }
        }
      }
    }

    // Find driver conflicts (drivers with multiple events that overlap in time)
    const driverConflicts = Array.from(driverGroups.entries())
      .filter(([_, events]) => {
        if (events.length < 2) return false;
        // Check if any pair of events overlaps in time
        for (let i = 0; i < events.length; i++) {
          for (let j = i + 1; j < events.length; j++) {
            const start1 = parseTimeToMinutes(events[i].eventStartTime);
            const end1 = parseTimeToMinutes(events[i].eventEndTime);
            const start2 = parseTimeToMinutes(events[j].eventStartTime);
            const end2 = parseTimeToMinutes(events[j].eventEndTime);
            if (timesOverlap(start1, end1, start2, end2)) {
              return true;
            }
          }
        }
        return false;
      })
      .map(([driver, events]) => ({ driver, events }));

    return {
      vanConflicts,
      driverConflicts,
      highVolume: allEvents.length >= 3, // Count all relevant events for high volume
      eventCount: allEvents.length,
    };
  } catch (error) {
    logger.error('Error getting conflicts for date:', error);
    return {
      vanConflicts: [],
      driverConflicts: [],
      highVolume: false,
      eventCount: 0,
    };
  }
}
