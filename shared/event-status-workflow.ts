/**
 * Event Status Workflow Definitions
 *
 * Central source of truth for event request status definitions,
 * valid transitions, and descriptions for intake team reference.
 *
 * Used by both server (enforcement) and client (UI display + filtering).
 */

export const EVENT_STATUSES = [
  'new',
  'in_process',
  'scheduled',
  'rescheduled',
  'completed',
  'declined',
  'postponed',
  'cancelled',
  'non_event',
  'standby',
  'stalled',
] as const;

export type EventStatus = typeof EVENT_STATUSES[number];

/**
 * Status definitions with descriptions for intake team.
 * Each status has a label, a short definition, and contextual guidance.
 */
export const STATUS_DEFINITIONS: Record<EventStatus, {
  label: string;
  definition: string;
  guidance: string;
}> = {
  new: {
    label: 'New Request',
    definition: 'A new event request that has not yet been reviewed or contacted.',
    guidance: 'Review details and make initial contact. Move to In Process once the toolkit is sent and first contact is made, or Non-Event if it is not a real event request.',
  },
  in_process: {
    label: 'In Process',
    definition: 'Has received the toolkit and at least one contact attempt has been made.',
    guidance: 'Work with the contact to finalize event details. Can move to Scheduled, Declined, Standby, or Stalled.',
  },
  scheduled: {
    label: 'Scheduled',
    definition: 'Event is on our calendar and the majority of details are nailed down. All details should be finalized at least a few days before the event whenever possible.',
    guidance: 'Assign drivers, speakers, and volunteers. Can move to Completed, Cancelled, or Postponed. If the date changes, move to Rescheduled.',
  },
  rescheduled: {
    label: 'Rescheduled',
    definition: 'A previously scheduled or postponed event that has been assigned a new confirmed date.',
    guidance: 'Treat like a scheduled event. Can move to Completed, Cancelled, or Postponed.',
  },
  completed: {
    label: 'Completed',
    definition: 'The event date has passed and the event was not cancelled or postponed.',
    guidance: 'Complete follow-up tasks: 1-day follow-up, 1-month follow-up, and social media post request.',
  },
  declined: {
    label: 'Declined',
    definition: 'The organization was in process but decided not to proceed with hosting an event.',
    guidance: 'Record the reason. Can be reactivated if they come back.',
  },
  postponed: {
    label: 'Postponed',
    definition: 'A previously scheduled event that needs to happen at a later date but no new date is confirmed yet.',
    guidance: 'Follow up to determine a new date. Once a new date is confirmed, move to Rescheduled.',
  },
  cancelled: {
    label: 'Cancelled',
    definition: 'A previously scheduled event that has been cancelled without the intention of rescheduling.',
    guidance: 'Must have been Scheduled at some point. Record the reason for cancellation.',
  },
  non_event: {
    label: 'Non-Event',
    definition: 'A new request that was never a real event request (e.g., someone dropping off sandwiches they already made, general inquiries that are not event requests).',
    guidance: 'Only applies to New Requests that do not belong in the event pipeline.',
  },
  standby: {
    label: 'Standby',
    definition: 'The event was in process, but the contact is waiting on something specific (e.g., information or permission from someone in their organization) in order to continue planning.',
    guidance: 'Follow closely. Move to Scheduled once the blocker is resolved.',
  },
  stalled: {
    label: 'Stalled',
    definition: 'The event was in process but all attempts to reach the contact have failed multiple times. The event is sidelined for the time being.',
    guidance: 'Continue periodic outreach. If they respond, move back to In Process. If they confirm they are no longer interested, move to Declined.',
  },
};

/**
 * Valid status transitions.
 * Maps each status to the list of statuses it can transition to.
 *
 * Key business rules:
 * - Cancelled requires the event to have been Scheduled first
 * - In Process events that don't happen become Declined (not Cancelled)
 * - Postponed events move to Rescheduled once a new date is confirmed
 * - Non-Event is terminal — only reachable from New Request
 * - Rescheduled has the same outbound transitions as Scheduled
 * - Completed is typically a terminal state but can be reopened to Scheduled if needed
 */
export const VALID_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  new: ['in_process', 'non_event', 'declined', 'standby', 'stalled'],
  in_process: ['scheduled', 'declined', 'standby', 'stalled'],
  scheduled: ['completed', 'cancelled', 'postponed', 'rescheduled', 'in_process'],  // in_process allows undoing accidental scheduling
  rescheduled: ['completed', 'cancelled', 'postponed', 'in_process'],
  completed: ['scheduled'],  // Reopen if needed (e.g., data entry error)
  declined: ['new', 'in_process'],  // Can reactivate if they come back
  postponed: ['rescheduled', 'cancelled'],  // Reschedule or cancel
  cancelled: ['scheduled'],  // Can reinstate if the group comes back
  non_event: [],  // Terminal — no transitions out
  standby: ['in_process', 'declined', 'stalled'],
  stalled: ['in_process', 'declined', 'new'],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) return true; // No change is always valid
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get a human-readable error message for an invalid transition.
 */
export function getTransitionError(from: EventStatus, to: EventStatus): string {
  const fromDef = STATUS_DEFINITIONS[from];
  const toDef = STATUS_DEFINITIONS[to];
  const fromLabel = fromDef?.label || from;
  const toLabel = toDef?.label || to;

  // Provide specific guidance for common mistakes
  if (to === 'cancelled' && from !== 'scheduled' && from !== 'rescheduled' && from !== 'postponed' && from !== 'cancelled') {
    return `Cannot cancel an event that is "${fromLabel}". Only Scheduled, Rescheduled, or Postponed events can be cancelled. If this event won't proceed, mark it as Declined instead.`;
  }

  if (to === 'completed' && from !== 'scheduled' && from !== 'rescheduled' && from !== 'completed') {
    return `Cannot mark a "${fromLabel}" event as Completed. The event must be Scheduled or Rescheduled first.`;
  }

  if (to === 'postponed' && from !== 'scheduled' && from !== 'rescheduled') {
    return `Cannot postpone a "${fromLabel}" event. Only Scheduled or Rescheduled events can be postponed.`;
  }

  if (to === 'rescheduled' && from !== 'scheduled' && from !== 'postponed') {
    return `Cannot reschedule a "${fromLabel}" event. Only Scheduled or Postponed events can be rescheduled.`;
  }

  if (to === 'non_event' && from !== 'new') {
    return `Cannot mark a "${fromLabel}" event as Non-Event. Only New Requests can be marked as Non-Event.`;
  }

  const allowedLabels = (VALID_STATUS_TRANSITIONS[from] || [])
    .map(s => STATUS_DEFINITIONS[s]?.label || s);

  return `Cannot move from "${fromLabel}" to "${toLabel}". Valid next statuses are: ${allowedLabels.join(', ')}.`;
}
