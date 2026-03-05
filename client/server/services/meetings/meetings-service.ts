import { z } from 'zod';
import { insertMeetingSchema } from '@shared/schema';
import type {
  Meeting,
  MeetingMinutes,
  Committee,
  CommitteeMembership
} from '@shared/schema';
import { insertMeetingSchema, type Meeting } from '@shared/schema';
import type { IMeetingsStorage } from '../../routes/meetings/types';

type InsertMeetingPayload = z.infer<typeof insertMeetingSchema>;

/**
 * Request body for meeting operations
 * Supports both standard and legacy field names
 */
export interface MeetingRequest {
  // Standard fields
  title?: string;
  type?: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  finalAgenda?: string;
  status?: string;

  // Legacy field names (for backwards compatibility)
  meetingDate?: string;
  startTime?: string;
  meetingLink?: string;
  agenda?: string;

  // Allow additional fields
  [key: string]: unknown;
}

/**
 * Response format for meeting data
 * Includes both standard and legacy field names for backwards compatibility
 */
export interface MeetingResponse extends Meeting {
  meetingDate: string;
  startTime: string;
  meetingLink: string | null;
  agenda: string | null;
}

/**
 * Committee with membership information
 */
export type CommitteeWithMembership = Committee & {
  membership: CommitteeMembership
};

const MEETING_FIELDS: Array<keyof InsertMeetingPayload> = [
  'title',
  'type',
  'date',
  'time',
  'location',
  'description',
  'finalAgenda',
  'status',
];

export interface MapMeetingOptions {
  includeDefaults?: boolean;
}

export class MeetingsService {
  constructor(private storage: IMeetingsStorage) {}

  /**
   * Map request body to meeting payload
   * Handles field name variations (meetingDate -> date, etc.)
   */
  mapRequestToMeetingPayload(
    body: MeetingRequest,
    options: MapMeetingOptions = {}
  ): Partial<InsertMeetingPayload> {
    const source = body ?? {};
    const mapped: Record<string, unknown> = { ...source };

    // Map alternative field names
    if (mapped.meetingDate !== undefined && mapped.date === undefined) {
      mapped.date = mapped.meetingDate;
    }
    if (mapped.startTime !== undefined && mapped.time === undefined) {
      mapped.time = mapped.startTime;
    }
    if (mapped.meetingLink !== undefined && mapped.location === undefined) {
      mapped.location = mapped.meetingLink;
    }
    if (mapped.agenda !== undefined && mapped.finalAgenda === undefined) {
      mapped.finalAgenda = mapped.agenda;
    }

    // Extract only valid meeting fields
    const payload: Partial<InsertMeetingPayload> = {};
    for (const field of MEETING_FIELDS) {
      if (mapped[field] !== undefined) {
        // TypeScript cannot verify type safety of dynamic property access,
        // so we cast through 'unknown'. The value is validated by Zod at call site.
        const value = mapped[field] as unknown;
        payload[field] = value as InsertMeetingPayload[typeof field];
      }
    }

    // Apply defaults if requested
    if (options.includeDefaults) {
      if (payload.type === undefined) {
        payload.type = 'weekly' as InsertMeetingPayload['type'];
      }
      if (payload.status === undefined) {
        payload.status = 'planning' as InsertMeetingPayload['status'];
      }
    }

    return payload;
  }

  /**
   * Map meeting to response format
   * Adds legacy field names for backwards compatibility
   * Returns null/undefined as-is for safety
   */
  mapMeetingToResponse(meeting: Meeting | null | undefined): MeetingResponse | null | undefined {
    if (!meeting) {
      return meeting;
    }

    return {
      ...meeting,
      meetingDate: meeting.date,
      startTime: meeting.time,
      meetingLink: meeting.location,
      agenda: meeting.finalAgenda,
    };
  }

  /**
   * Map multiple meetings to response format
   * Preserves array length and positions (1:1 mapping)
   */
  mapMeetingsToResponse(meetings: Meeting[]): MeetingResponse[] {
    return meetings.map((m) => this.mapMeetingToResponse(m)) as MeetingResponse[];
  }

  /**
   * Filter meeting minutes based on user role and committee membership
   */
  async filterMeetingMinutesByRole(
    userId: string,
    minutes: MeetingMinutes[]
  ): Promise<MeetingMinutes[]> {
    const user = await this.storage.getUser(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Admins see all meeting minutes
    if (
      user.role === 'admin' ||
      user.role === 'admin_coordinator' ||
      user.role === 'admin_viewer'
    ) {
      return minutes;
    }

    // Committee members only see minutes for their committees
    if (user.role === 'committee_member') {
      const userCommittees = await this.storage.getUserCommittees(userId);
      const committeeTypes = userCommittees.map(
        (membership: CommitteeWithMembership) => membership.membership.committeeId
      );

      return minutes.filter(
        (minute) =>
          !minute.committeeType ||
          committeeTypes.includes(Number(minute.committeeType))
      );
    }

    // Other roles see general meeting minutes and their role-specific minutes
    return minutes.filter(
      (minute) => !minute.committeeType || minute.committeeType === user.role
    );
  }

  /**
   * Check if user can modify agenda items
   */
  async canModifyAgendaItem(userId: string): Promise<boolean> {
    const user = await this.storage.getUser(userId);

    if (!user) {
      return false;
    }

    // Committee members cannot modify agenda items
    return user.role !== 'committee_member';
  }

  /**
   * Validate agenda item status
   */
  isValidAgendaStatus(status: string): boolean {
    return ['pending', 'approved', 'rejected', 'postponed'].includes(status);
  }
}
