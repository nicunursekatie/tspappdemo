import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { db } from './db';
import { eq, desc, inArray } from 'drizzle-orm';
import { eventRequests, proposedSheetChanges, users } from '@shared/schema';
import { logger } from './utils/production-safe-logger';

/**
 * Planning Sheet Column Mapping
 * Maps the Google Sheet columns to app fields
 */
export const PLANNING_SHEET_COLUMNS = {
  DATE: 0,                    // A - Date
  DAY_OF_WEEK: 1,             // B - Day of Week
  GROUP_NAME: 2,              // C - Group Name
  EVENT_START_TIME: 3,        // D - Event Start time
  EVENT_END_TIME: 4,          // E - Event end time
  PICK_UP_TIME: 5,            // F - Pick up time
  PICK_UP_NEXT_DAY: 6,        // G - Pick up next day?
  ALL_DETAILS: 7,             // H - ALL DETAILS
  VAN_BOOKED: 8,              // I - Van Booked?
  STAFFING: 9,                // J - Staffing (special format: D: Name, S: Name, V: Name)
  ESTIMATE_SANDWICHES: 10,    // K - Estimate # sandwiches
  DELI_OR_PBJ: 11,            // L - Deli or PBJ?
  FINAL_SANDWICHES: 12,       // M - Final # sandwiches made
  SOCIAL_POST: 13,            // N - Social Post
  SENT_TOOLKIT: 14,           // O - Sent toolkit?
  CONTACT_NAME: 15,           // P - Contact Name
  EMAIL: 16,                  // Q - Email Address
  PHONE: 17,                  // R - Contact Cell Number
  TSP_CONTACT: 18,            // S - TSP Contact
  ADDRESS: 19,                // T - Address
  RECIPIENT_HOST: 20,         // U - Planned Recipient/Host Home
  AFTER_EVENT_NOTES: 21,      // V - After Event Notes
  CANCELLED: 22,              // W - Cancelled
  NOTES: 23,                  // X - Notes
  ADDL_NOTES: 24,             // Y - Add'l Notes
  WAITING_ON: 25,             // Z - Waiting On
} as const;

/**
 * Staffing format parser and generator
 *
 * Format specifications:
 * - The staffing column contains role assignments separated by role prefixes
 * - Format: "D: Name1, Name2, S: Name3, V: Name4, VD: Name5"
 * - Each role can have multiple people assigned (comma-separated names)
 * - Each role can be:
 *   - Assigned with name(s): "D: John Doe, Jane Smith" (role needed, assigned to John and Jane)
 *   - Unassigned but needed: "D:" or "D: " (role needed but no one assigned)
 *   - Not needed: role is omitted from the string
 *
 * Roles:
 * - D: Driver (regular)
 * - VD: Van Driver (special type of driver, checked before D)
 * - S: Speaker
 * - V: Volunteer
 *
 * Examples:
 * - "D: John Doe, S: Jane Smith" = Driver assigned to John, Speaker assigned to Jane
 * - "D: John, Jane, S: Bob" = Drivers assigned to John AND Jane, Speaker assigned to Bob
 * - "D:, S:" = Driver and Speaker needed but unassigned
 * - "VD: Bob Jones, V:" = Van Driver assigned to Bob, Volunteer needed but unassigned
 * - "" = No roles needed
 *
 * Note: When parsing, VD must be checked before D to avoid false matches.
 * Note: Unassigned positions may include trailing space after colon (e.g., "D: ").
 * Note: Comma-separated names within a role are preserved as a single string.
 */
export interface StaffingInfo {
  driver: { needed: boolean; assigned: string | null; isVanDriver: boolean };
  speaker: { needed: boolean; assigned: string | null };
  volunteer: { needed: boolean; assigned: string | null };
}

/**
 * Parse a staffing column string into structured staffing information.
 *
 * Uses regex to split on role prefixes (VD:, D:, S:, V:) to correctly handle
 * multiple comma-separated names within a single role.
 *
 * See StaffingInfo documentation for format details.
 */
export function parseStaffingColumn(staffingStr: string): StaffingInfo {
  const result: StaffingInfo = {
    driver: { needed: false, assigned: null, isVanDriver: false },
    speaker: { needed: false, assigned: null },
    volunteer: { needed: false, assigned: null },
  };

  if (!staffingStr || !staffingStr.trim()) {
    return result;
  }

  // Use regex to find role sections - split on role prefixes
  // Match: VD: or D: or S: or V: (case insensitive, VD must come before D)
  // The lookahead ensures we capture content until the next role prefix
  const rolePattern = /\b(VD|D|S|V)\s*:/gi;
  const matches: { role: string; startIndex: number }[] = [];
  let match;

  while ((match = rolePattern.exec(staffingStr)) !== null) {
    matches.push({ role: match[1].toUpperCase(), startIndex: match.index });
  }

  // Process each role section
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    // Extract content from after the colon to the next role prefix (or end of string)
    const colonIndex = staffingStr.indexOf(':', currentMatch.startIndex);
    const endIndex = nextMatch ? nextMatch.startIndex : staffingStr.length;
    const content = staffingStr.slice(colonIndex + 1, endIndex).trim();

    // Remove trailing comma if present (from being before the next role)
    const cleanedContent = content.replace(/,\s*$/, '').trim();

    switch (currentMatch.role) {
      case 'VD':
        result.driver.needed = true;
        result.driver.isVanDriver = true;
        result.driver.assigned = cleanedContent || null;
        break;
      case 'D':
        // Only set if not already set by VD
        if (!result.driver.isVanDriver) {
          result.driver.needed = true;
          result.driver.assigned = cleanedContent || null;
        }
        break;
      case 'S':
        result.speaker.needed = true;
        result.speaker.assigned = cleanedContent || null;
        break;
      case 'V':
        result.volunteer.needed = true;
        result.volunteer.assigned = cleanedContent || null;
        break;
    }
  }

  return result;
}

/**
 * Format a StaffingInfo object into the string format for the Planning Sheet.
 * 
 * Trailing space behavior:
 * - When a role is needed but unassigned, the format includes a trailing space after the colon.
 * - Examples: "D: ", "S: ", "V: ", "VD: "
 * - This is intentional to indicate the position is open/needed but not yet filled.
 * - The parser handles both "D:" and "D: " as unassigned positions.
 * 
 * See StaffingInfo documentation for complete format specification.
 */
export function formatStaffingColumn(staffing: StaffingInfo): string {
  const parts: string[] = [];

  // Driver or Van Driver
  if (staffing.driver.needed) {
    const prefix = staffing.driver.isVanDriver ? 'VD' : 'D';
    if (staffing.driver.assigned) {
      parts.push(`${prefix}: ${staffing.driver.assigned}`);
    } else {
      parts.push(`${prefix}: `); // Unassigned but needed
    }
  }

  // Speaker
  if (staffing.speaker.needed) {
    if (staffing.speaker.assigned) {
      parts.push(`S: ${staffing.speaker.assigned}`);
    } else {
      parts.push(`S: `); // Unassigned but needed
    }
  }

  // Volunteer
  if (staffing.volunteer.needed) {
    if (staffing.volunteer.assigned) {
      parts.push(`V: ${staffing.volunteer.assigned}`);
    } else {
      parts.push(`V: `); // Unassigned but needed
    }
  }

  return parts.join(', ');
}

/**
 * Planning Sheet row data - represents one row in the Planning Sheet
 */
export interface PlanningSheetRow {
  rowIndex: number;
  date: string;
  dayOfWeek: string;
  groupName: string;
  eventStartTime: string;
  eventEndTime: string;
  pickUpTime: string;
  pickUpNextDay: string;
  allDetails: string;
  vanBooked: string;
  staffing: string;
  staffingParsed: StaffingInfo;
  estimateSandwiches: string;
  deliOrPbj: string;
  finalSandwiches: string;
  socialPost: string;
  sentToolkit: string;
  contactName: string;
  email: string;
  phone: string;
  tspContact: string;
  address: string;
  recipientHost: string;
  afterEventNotes: string;
  cancelled: string;
  notes: string;
  addlNotes: string;
  waitingOn: string;
}

/**
 * Planning Sheet Sync Service
 * Handles reading from and proposing changes to the Planning/Schedule Google Sheet
 *
 * IMPORTANT: This is SEPARATE from the Squarespace form responses sync.
 * This syncs with the team's planning sheet where scheduled events are tracked.
 */
export class PlanningSheetSyncService {
  private auth!: JWT;
  private sheets: any;
  private spreadsheetId: string;
  private worksheetName: string;

  constructor(spreadsheetId: string, worksheetName: string = 'Schedule') {
    this.spreadsheetId = spreadsheetId;
    this.worksheetName = worksheetName;
  }

  private getSheetRange(a1Range: string) {
    const safeSheetName = this.worksheetName.replace(/'/g, "''");
    return `'${safeSheetName}'!${a1Range}`;
  }

  private async ensureInitialized() {
    if (!this.sheets) {
      await this.initializeAuth();
    }
  }

  private async initializeAuth() {
    const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!rawPrivateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error('Google Sheets credentials not configured');
    }

    // Handle escaped newlines in private key
    let cleanPrivateKey = rawPrivateKey;
    if (cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }
    cleanPrivateKey = cleanPrivateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // Handle single-line key format
    if (
      !cleanPrivateKey.includes('\n') &&
      cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')
    ) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      const beginIndex = cleanPrivateKey.indexOf(beginMarker);
      const endIndex = cleanPrivateKey.indexOf(endMarker);

      if (beginIndex !== -1 && endIndex !== -1) {
        const keyContent = cleanPrivateKey
          .substring(beginIndex + beginMarker.length, endIndex)
          .trim();

        const lines = [beginMarker];
        for (let i = 0; i < keyContent.length; i += 64) {
          lines.push(keyContent.substring(i, i + 64));
        }
        lines.push(endMarker);
        cleanPrivateKey = lines.join('\n');
      }
    }

    this.auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      undefined,
      cleanPrivateKey,
      [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ]
    );

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Read all rows from the Planning Sheet
   */
  async readPlanningSheet(): Promise<PlanningSheetRow[]> {
    await this.ensureInitialized();

    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.getSheetRange('A2:Z'), // Skip header row
    });

    const rows = response.data.values || [];
    logger.log(`Read ${rows.length} rows from Planning Sheet`);

    return rows.map((row: string[], index: number) => {
      const staffingStr = row[PLANNING_SHEET_COLUMNS.STAFFING] || '';
      return {
        rowIndex: index + 2, // +2 because we start at A2 and arrays are 0-indexed
        date: row[PLANNING_SHEET_COLUMNS.DATE] || '',
        dayOfWeek: row[PLANNING_SHEET_COLUMNS.DAY_OF_WEEK] || '',
        groupName: row[PLANNING_SHEET_COLUMNS.GROUP_NAME] || '',
        eventStartTime: row[PLANNING_SHEET_COLUMNS.EVENT_START_TIME] || '',
        eventEndTime: row[PLANNING_SHEET_COLUMNS.EVENT_END_TIME] || '',
        pickUpTime: row[PLANNING_SHEET_COLUMNS.PICK_UP_TIME] || '',
        pickUpNextDay: row[PLANNING_SHEET_COLUMNS.PICK_UP_NEXT_DAY] || '',
        allDetails: row[PLANNING_SHEET_COLUMNS.ALL_DETAILS] || '',
        vanBooked: row[PLANNING_SHEET_COLUMNS.VAN_BOOKED] || '',
        staffing: staffingStr,
        staffingParsed: parseStaffingColumn(staffingStr),
        estimateSandwiches: row[PLANNING_SHEET_COLUMNS.ESTIMATE_SANDWICHES] || '',
        deliOrPbj: row[PLANNING_SHEET_COLUMNS.DELI_OR_PBJ] || '',
        finalSandwiches: row[PLANNING_SHEET_COLUMNS.FINAL_SANDWICHES] || '',
        socialPost: row[PLANNING_SHEET_COLUMNS.SOCIAL_POST] || '',
        sentToolkit: row[PLANNING_SHEET_COLUMNS.SENT_TOOLKIT] || '',
        contactName: row[PLANNING_SHEET_COLUMNS.CONTACT_NAME] || '',
        email: row[PLANNING_SHEET_COLUMNS.EMAIL] || '',
        phone: row[PLANNING_SHEET_COLUMNS.PHONE] || '',
        tspContact: row[PLANNING_SHEET_COLUMNS.TSP_CONTACT] || '',
        address: row[PLANNING_SHEET_COLUMNS.ADDRESS] || '',
        recipientHost: row[PLANNING_SHEET_COLUMNS.RECIPIENT_HOST] || '',
        afterEventNotes: row[PLANNING_SHEET_COLUMNS.AFTER_EVENT_NOTES] || '',
        cancelled: row[PLANNING_SHEET_COLUMNS.CANCELLED] || '',
        notes: row[PLANNING_SHEET_COLUMNS.NOTES] || '',
        addlNotes: row[PLANNING_SHEET_COLUMNS.ADDL_NOTES] || '',
        waitingOn: row[PLANNING_SHEET_COLUMNS.WAITING_ON] || '',
      };
    });
  }

  /**
   * Convert an EventRequest from the app into Planning Sheet row format
   */
  async eventToSheetRow(eventId: number): Promise<string[] | null> {
    const event = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event || event.length === 0) {
      return null;
    }

    const e = event[0];

    // Get assigned driver/speaker/volunteer names
    const driverNames = await this.getAssignedNames(e.assignedDriverIds || []);
    const speakerNames = await this.getAssignedNames(e.assignedSpeakerIds || []);
    const volunteerNames = await this.getAssignedNames(e.assignedVolunteerIds || []);

    // Resolve TSP contact - either customTspContact (free text) or tspContact (user ID)
    let tspContactName = '';
    if (e.customTspContact) {
      tspContactName = e.customTspContact;
    } else if (e.tspContact) {
      const names = await this.getAssignedNames([e.tspContact]);
      tspContactName = names[0] || e.tspContact; // Fall back to ID if not found
    }

    // Build staffing string
    const staffing: StaffingInfo = {
      driver: {
        needed: (e.driversNeeded || 0) > 0 || driverNames.length > 0,
        assigned: driverNames.length > 0 ? driverNames.join(', ') : null,
        isVanDriver: e.vanDriverNeeded || false,
      },
      speaker: {
        needed: (e.speakersNeeded || 0) > 0 || speakerNames.length > 0,
        assigned: speakerNames.length > 0 ? speakerNames.join(', ') : null,
      },
      volunteer: {
        needed: (e.volunteersNeeded || 0) > 0 || volunteerNames.length > 0,
        assigned: volunteerNames.length > 0 ? volunteerNames.join(', ') : null,
      },
    };

    // Format date with 2-digit year (M/D/YY)
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    const eventDateObj = eventDate ? new Date(eventDate) : null;
    const dateStr = eventDateObj ? eventDateObj.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit'
    }) : '';

    const dayOfWeek = eventDateObj ? eventDateObj.toLocaleDateString('en-US', {
      weekday: 'long'
    }) : '';

    // Convert military time (e.g., "14:00" or "14:00:00") to 12-hour format (e.g., "2:00 PM")
    const formatTime12Hour = (timeStr: string | null | undefined): string => {
      if (!timeStr) return '';
      // Handle HH:MM or HH:MM:SS format
      const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (!match) return timeStr; // Return as-is if not recognized format

      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';

      if (hours === 0) {
        hours = 12;
      } else if (hours > 12) {
        hours -= 12;
      }

      return `${hours}:${minutes} ${ampm}`;
    };

    // Format sandwich types with proper capitalization (e.g., "deli" -> "Deli", "pbj" -> "PBJ")
    const sandwichTypes = e.sandwichTypes as Array<{ type: string; quantity?: number }> | null;
    const formatSandwichType = (type: string): string => {
      const lower = type.toLowerCase();
      if (lower === 'pbj' || lower === 'pb&j') return 'PBJ';
      if (lower === 'deli') return 'Deli';
      // Capitalize first letter for any other type
      return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    };
    const deliOrPbj = sandwichTypes?.map(st => formatSandwichType(st.type)).join(', ') || '';

    // Build the row array matching column order
    const row: string[] = new Array(26).fill('');
    row[PLANNING_SHEET_COLUMNS.DATE] = dateStr;
    row[PLANNING_SHEET_COLUMNS.DAY_OF_WEEK] = dayOfWeek;
    row[PLANNING_SHEET_COLUMNS.GROUP_NAME] = e.organizationName || '';
    row[PLANNING_SHEET_COLUMNS.EVENT_START_TIME] = formatTime12Hour(e.eventStartTime);
    row[PLANNING_SHEET_COLUMNS.EVENT_END_TIME] = formatTime12Hour(e.eventEndTime);
    row[PLANNING_SHEET_COLUMNS.PICK_UP_TIME] = formatTime12Hour(e.pickupTime);
    row[PLANNING_SHEET_COLUMNS.PICK_UP_NEXT_DAY] = e.overnightHoldingLocation ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.ALL_DETAILS] = e.message || '';
    row[PLANNING_SHEET_COLUMNS.VAN_BOOKED] = e.vanDriverNeeded ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.STAFFING] = formatStaffingColumn(staffing);
    row[PLANNING_SHEET_COLUMNS.ESTIMATE_SANDWICHES] = e.estimatedSandwichCount?.toString() || '';
    row[PLANNING_SHEET_COLUMNS.DELI_OR_PBJ] = deliOrPbj;
    // Only show final sandwich count if it's a positive number (not 0 or null)
    row[PLANNING_SHEET_COLUMNS.FINAL_SANDWICHES] = (e.actualSandwichCount && e.actualSandwichCount > 0) ? e.actualSandwichCount.toString() : '';
    row[PLANNING_SHEET_COLUMNS.SOCIAL_POST] = e.socialMediaPostCompleted ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.SENT_TOOLKIT] = e.toolkitSent ? 'yes' : '';
    row[PLANNING_SHEET_COLUMNS.CONTACT_NAME] = `${e.firstName || ''} ${e.lastName || ''}`.trim();
    row[PLANNING_SHEET_COLUMNS.EMAIL] = e.email || '';
    row[PLANNING_SHEET_COLUMNS.PHONE] = e.phone || '';
    row[PLANNING_SHEET_COLUMNS.TSP_CONTACT] = tspContactName;
    row[PLANNING_SHEET_COLUMNS.ADDRESS] = e.eventAddress || '';
    row[PLANNING_SHEET_COLUMNS.RECIPIENT_HOST] = e.deliveryDestination || '';
    row[PLANNING_SHEET_COLUMNS.AFTER_EVENT_NOTES] = e.followUpNotes || '';
    row[PLANNING_SHEET_COLUMNS.CANCELLED] = e.status === 'cancelled' ? 'Yes' : '';
    row[PLANNING_SHEET_COLUMNS.NOTES] = '';
    row[PLANNING_SHEET_COLUMNS.ADDL_NOTES] = '';
    row[PLANNING_SHEET_COLUMNS.WAITING_ON] = e.nextAction || '';

    return row;
  }

  /**
   * Get display names for assigned user IDs
   */
  private async getAssignedNames(userIds: string[]): Promise<string[]> {
    if (!userIds || userIds.length === 0) return [];

    const userList = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));

    // Create a map of user IDs to names
    const userMap = new Map(
      userList.map(u => [
        u.id,
        u.displayName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown'
      ])
    );

    // Return names in the same order as userIds
    return userIds.map(id => userMap.get(id) || 'Unknown');
  }

  /**
   * Propose adding a new row to the Planning Sheet
   * Does NOT write to the sheet - creates a proposal for human review
   */
  async proposeNewRow(
    eventId: number,
    proposedBy: string,
    reason: string = 'Event scheduled'
  ): Promise<{ success: boolean; proposalId?: number; message: string }> {
    try {
      const rowData = await this.eventToSheetRow(eventId);
      if (!rowData) {
        return { success: false, message: 'Event not found' };
      }

      // Create the proposal
      const [proposal] = await db
        .insert(proposedSheetChanges)
        .values({
          eventRequestId: eventId,
          targetSheetId: this.spreadsheetId,
          targetSheetName: this.worksheetName,
          targetRowIndex: null, // New row, no existing index
          changeType: 'create_row',
          proposedRowData: rowData,
          proposedBy,
          proposalReason: reason,
          status: 'pending',
          columnMapping: PLANNING_SHEET_COLUMNS,
        })
        .returning({ id: proposedSheetChanges.id });

      logger.log(`Created proposal ${proposal.id} for new row in Planning Sheet`);
      return {
        success: true,
        proposalId: proposal.id,
        message: 'Proposed new row for review'
      };
    } catch (error) {
      logger.error('Error creating new row proposal:', error);
      return {
        success: false,
        message: `Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Propose updating a specific cell in the Planning Sheet
   * Does NOT write to the sheet - creates a proposal for human review
   */
  async proposeCellUpdate(
    eventId: number,
    rowIndex: number,
    fieldName: string,
    currentValue: string,
    proposedValue: string,
    proposedBy: string,
    reason: string
  ): Promise<{ success: boolean; proposalId?: number; message: string }> {
    try {
      const [proposal] = await db
        .insert(proposedSheetChanges)
        .values({
          eventRequestId: eventId,
          targetSheetId: this.spreadsheetId,
          targetSheetName: this.worksheetName,
          targetRowIndex: rowIndex,
          changeType: 'update_cell',
          fieldName,
          currentValue,
          proposedValue,
          proposedBy,
          proposalReason: reason,
          status: 'pending',
          columnMapping: PLANNING_SHEET_COLUMNS,
        })
        .returning({ id: proposedSheetChanges.id });

      logger.log(`Created proposal ${proposal.id} for cell update at row ${rowIndex}, field ${fieldName}`);
      return {
        success: true,
        proposalId: proposal.id,
        message: 'Proposed cell update for review'
      };
    } catch (error) {
      logger.error('Error creating cell update proposal:', error);
      return {
        success: false,
        message: `Failed to create proposal: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get all pending proposals
   */
  async getPendingProposals(): Promise<any[]> {
    return db
      .select()
      .from(proposedSheetChanges)
      .where(eq(proposedSheetChanges.status, 'pending'))
      .orderBy(desc(proposedSheetChanges.proposedAt));
  }

  /**
   * Apply an approved proposal to the sheet
   * This is the ONLY function that actually writes to Google Sheets
   */
  async applyApprovedProposal(
    proposalId: number,
    reviewedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureInitialized();

      // Get the proposal
      const [proposal] = await db
        .select()
        .from(proposedSheetChanges)
        .where(eq(proposedSheetChanges.id, proposalId))
        .limit(1);

      if (!proposal) {
        return { success: false, message: 'Proposal not found' };
      }

      if (proposal.status !== 'pending' && proposal.status !== 'approved') {
        return { success: false, message: `Cannot apply proposal with status: ${proposal.status}` };
      }

      // Mark as approved first
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'approved',
          reviewedBy,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      // Apply the change based on type
      let result: { success: boolean; message: string };

      if (proposal.changeType === 'create_row') {
        result = await this.applyNewRow(proposal);
      } else if (proposal.changeType === 'update_cell') {
        result = await this.applyCellUpdate(proposal);
      } else {
        result = { success: false, message: `Unknown change type: ${proposal.changeType}` };
      }

      // Update proposal status based on result
      await db
        .update(proposedSheetChanges)
        .set({
          status: result.success ? 'applied' : 'failed',
          appliedAt: result.success ? new Date() : null,
          applyError: result.success ? null : result.message,
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return result;
    } catch (error) {
      logger.error('Error applying approved proposal:', error);

      // Mark as failed
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'failed',
          applyError: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return {
        success: false,
        message: `Failed to apply: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Apply a new row to the sheet
   */
  private async applyNewRow(proposal: any): Promise<{ success: boolean; message: string }> {
    const rowData = proposal.proposedRowData as string[];
    if (!rowData || !Array.isArray(rowData)) {
      return { success: false, message: 'Invalid row data in proposal' };
    }

    // Append the row to the sheet
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.getSheetRange('A:Z'),
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rowData] },
    });

    logger.log(`Applied new row to Planning Sheet for proposal ${proposal.id}`);
    return { success: true, message: 'Row added successfully' };
  }

  /**
   * Apply a cell update to the sheet
   */
  private async applyCellUpdate(proposal: any): Promise<{ success: boolean; message: string }> {
    if (!proposal.targetRowIndex || !proposal.fieldName) {
      return { success: false, message: 'Missing row index or field name' };
    }

    // Get column letter from field name
    const columnIndex = PLANNING_SHEET_COLUMNS[proposal.fieldName as keyof typeof PLANNING_SHEET_COLUMNS];
    if (columnIndex === undefined) {
      return { success: false, message: `Unknown field: ${proposal.fieldName}` };
    }

    const columnLetter = String.fromCharCode(65 + columnIndex); // A=0, B=1, etc.
    const range = this.getSheetRange(`${columnLetter}${proposal.targetRowIndex}`);

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[proposal.proposedValue]] },
    });

    logger.log(`Applied cell update to ${range} for proposal ${proposal.id}`);
    return { success: true, message: `Updated ${proposal.fieldName} at row ${proposal.targetRowIndex}` };
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(
    proposalId: number,
    reviewedBy: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await db
        .update(proposedSheetChanges)
        .set({
          status: 'rejected',
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: notes,
          updatedAt: new Date(),
        })
        .where(eq(proposedSheetChanges.id, proposalId));

      return { success: true, message: 'Proposal rejected' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reject: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Parse a date string from the sheet (e.g., "1/15/26", "1/15/2026", or "01/15/2026") into a Date object
   */
  private parseSheetDate(dateStr: string): Date | null {
    if (!dateStr || !dateStr.trim()) return null;

    // Try parsing MM/DD/YY or MM/DD/YYYY format
    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1; // JS months are 0-indexed
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);

      // Handle 2-digit years (e.g., "26" -> 2026)
      if (year < 100) {
        // Assume 2000s for years 00-99
        year += 2000;
      }

      if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
        const date = new Date(year, month, day);
        logger.log(`[PlanningSheet] Parsed date "${dateStr}" -> ${date.toISOString()}`);
        return date;
      }
    }

    // Fallback: try native Date parsing
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      logger.log(`[PlanningSheet] Fallback parsed date "${dateStr}" -> ${parsed.toISOString()}`);
      return parsed;
    }

    logger.warn(`[PlanningSheet] Could not parse date: "${dateStr}"`);
    return null;
  }

  /**
   * Find the correct row index to insert a new event based on date ordering.
   * Returns the row index where the new row should be inserted (rows after this will shift down).
   * If no suitable position is found, returns null (append to end).
   */
  private async findInsertionRowIndex(eventDate: Date): Promise<number | null> {
    const sheetRows = await this.readPlanningSheet();

    logger.log(`[PlanningSheet] Finding insertion point for event date: ${eventDate.toISOString()}`);
    logger.log(`[PlanningSheet] Sheet has ${sheetRows.length} rows`);

    if (sheetRows.length === 0) {
      logger.log(`[PlanningSheet] Sheet is empty, will append`);
      return null; // Empty sheet, just append
    }

    // Log first few dates to help debug
    const firstRows = sheetRows.slice(0, 5);
    logger.log(`[PlanningSheet] First 5 row dates: ${firstRows.map(r => `row${r.rowIndex}="${r.date}"`).join(', ')}`);

    // Find the first row with a date AFTER the event date
    // We want to insert BEFORE that row (so the new event is in chronological order)
    for (const row of sheetRows) {
      const rowDate = this.parseSheetDate(row.date);
      if (rowDate && rowDate > eventDate) {
        logger.log(`[PlanningSheet] Found insertion point: row ${row.rowIndex} has date ${row.date} (parsed: ${rowDate.toISOString()}) which is AFTER event date ${eventDate.toISOString()}`);
        // Insert before this row
        return row.rowIndex;
      }
    }

    // Log the last few dates to help debug
    const lastRows = sheetRows.slice(-5);
    logger.log(`[PlanningSheet] Last 5 row dates: ${lastRows.map(r => `row${r.rowIndex}="${r.date}"`).join(', ')}`);
    logger.log(`[PlanningSheet] No row found with date after ${eventDate.toISOString()}, will append to end`);

    // No row found with a later date - check if we should append
    // If all dates are before or equal to our date, append to end
    return null;
  }

  /**
   * Get the worksheet/sheet ID (gid) for the current worksheet name
   */
  private async getWorksheetId(): Promise<number | null> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const sheets = response.data.sheets || [];
      for (const sheet of sheets) {
        if (sheet.properties?.title === this.worksheetName) {
          return sheet.properties.sheetId ?? null;
        }
      }
      return null;
    } catch (error) {
      logger.error('[PlanningSheet] Error getting worksheet ID:', error);
      return null;
    }
  }

  /**
   * Convert a PlanningSheetRow object back to a 26-element raw string array
   * Used for per-column merge comparisons
   */
  planningSheetRowToRawArray(row: PlanningSheetRow): string[] {
    const raw = new Array(26).fill('');
    raw[0] = row.date;
    raw[1] = row.dayOfWeek;
    raw[2] = row.groupName;
    raw[3] = row.eventStartTime;
    raw[4] = row.eventEndTime;
    raw[5] = row.pickUpTime;
    raw[6] = row.pickUpNextDay;
    raw[7] = row.allDetails;
    raw[8] = row.vanBooked;
    raw[9] = row.staffing;
    raw[10] = row.estimateSandwiches;
    raw[11] = row.deliOrPbj;
    raw[12] = row.finalSandwiches;
    raw[13] = row.socialPost;
    raw[14] = row.sentToolkit;
    raw[15] = row.contactName;
    raw[16] = row.email;
    raw[17] = row.phone;
    raw[18] = row.tspContact;
    raw[19] = row.address;
    raw[20] = row.recipientHost;
    raw[21] = row.afterEventNotes;
    raw[22] = row.cancelled;
    raw[23] = row.notes;
    raw[24] = row.addlNotes;
    raw[25] = row.waitingOn;
    return raw;
  }

  /**
   * Push an event directly to the Planning Sheet (no proposal workflow)
   * This is a direct write - user sees preview first, then pushes immediately
   * New rows are inserted in chronological order based on event date.
   *
   * When mergeDecisions is provided, applies per-column merge strategy:
   * - 'use_app': use the app's value (default)
   * - 'keep_sheet': keep the existing sheet value
   * - 'append': combine as "sheet value | app value"
   */
  async pushEventDirectly(
    eventId: number,
    userId: string,
    mergeDecisions?: Record<string, 'use_app' | 'keep_sheet' | 'append'>
  ): Promise<{ success: boolean; message: string; rowIndex?: number; isUpdate?: boolean }> {
    try {
      await this.ensureInitialized();

      // Get the row data for this event
      const rowData = await this.eventToSheetRow(eventId);
      if (!rowData) {
        return { success: false, message: 'Could not generate row data for this event' };
      }

      // Check if row already exists for this event
      const existingRow = await this.findMatchingRow(eventId);

      if (existingRow) {
        // Build the final row data, applying merge decisions if provided
        let finalRow: string[];

        if (mergeDecisions && Object.keys(mergeDecisions).length > 0) {
          const existingRaw = this.planningSheetRowToRawArray(existingRow);
          finalRow = [...rowData];

          for (let i = 0; i < 26; i++) {
            const decision = mergeDecisions[String(i)];
            if (decision === 'keep_sheet') {
              finalRow[i] = existingRaw[i];
            } else if (decision === 'append') {
              const existingVal = (existingRaw[i] || '').trim();
              const appVal = (rowData[i] || '').trim();
              if (existingVal && appVal && existingVal !== appVal) {
                finalRow[i] = `${existingVal} | ${appVal}`;
              } else if (existingVal) {
                finalRow[i] = existingVal;
              }
              // If only app value exists, finalRow[i] already has it
            }
            // 'use_app' or no decision = keep finalRow[i] as rowData[i] (default)
          }

          logger.log(`[PlanningSheet] Applied merge decisions for ${Object.keys(mergeDecisions).length} columns`);
        } else {
          // No merge decisions = full overwrite (backward compatible)
          finalRow = rowData;
        }

        // Update existing row
        const range = this.getSheetRange(`A${existingRow.rowIndex}:Z${existingRow.rowIndex}`);
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [finalRow] },
        });

        logger.log(`[PlanningSheet] User ${userId} updated row ${existingRow.rowIndex} for event ${eventId}`);
        return {
          success: true,
          message: `Updated row ${existingRow.rowIndex} in Planning Sheet`,
          rowIndex: existingRow.rowIndex,
          isUpdate: true
        };
      } else {
        // Get event date for insertion point calculation
        const event = await db
          .select()
          .from(eventRequests)
          .where(eq(eventRequests.id, eventId))
          .limit(1);

        if (!event || event.length === 0) {
          return { success: false, message: 'Event not found' };
        }

        const eventDate = event[0].scheduledEventDate || event[0].desiredEventDate;
        let eventDateObj = eventDate ? new Date(eventDate) : new Date();

        // Normalize to midnight for date-only comparison (ignore time component)
        eventDateObj = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate());

        // Find the correct insertion point based on date
        logger.log(`[PlanningSheet] Event date for insertion (normalized): ${eventDateObj.toISOString()}`);
        const insertBeforeRow = await this.findInsertionRowIndex(eventDateObj);
        logger.log(`[PlanningSheet] insertBeforeRow result: ${insertBeforeRow}`);

        if (insertBeforeRow !== null) {
          // Insert row at specific position to maintain chronological order
          const sheetId = await this.getWorksheetId();
          logger.log(`[PlanningSheet] Worksheet ID: ${sheetId}`);

          if (sheetId === null) {
            logger.warn(`[PlanningSheet] Could not find worksheet ID for "${this.worksheetName}", falling back to append`);
          } else {
            // Use batchUpdate to insert a blank row at the correct position
            await this.sheets.spreadsheets.batchUpdate({
              spreadsheetId: this.spreadsheetId,
              resource: {
                requests: [{
                  insertDimension: {
                    range: {
                      sheetId: sheetId,
                      dimension: 'ROWS',
                      startIndex: insertBeforeRow - 1, // 0-indexed
                      endIndex: insertBeforeRow, // Insert 1 row
                    },
                    inheritFromBefore: false,
                  },
                }],
              },
            });

            // Now write the data to the newly inserted row
            const range = this.getSheetRange(`A${insertBeforeRow}:Z${insertBeforeRow}`);
            await this.sheets.spreadsheets.values.update({
              spreadsheetId: this.spreadsheetId,
              range,
              valueInputOption: 'USER_ENTERED',
              resource: { values: [rowData] },
            });

            logger.log(`[PlanningSheet] User ${userId} inserted new row at position ${insertBeforeRow} for event ${eventId} (chronological order)`);
            return {
              success: true,
              message: `Inserted new row at position ${insertBeforeRow} in Planning Sheet (sorted by date)`,
              rowIndex: insertBeforeRow,
              isUpdate: false
            };
          }
        }

        // Fallback: Append to end if no insertion point found or worksheet ID unavailable
        const response = await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.spreadsheetId,
          range: this.getSheetRange('A:Z'),
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [rowData] },
        });

        // Extract the row number from the response
        const updatedRange = response.data.updates?.updatedRange || '';
        const rowMatch = updatedRange.match(/(\d+)$/);
        const newRowIndex = rowMatch ? parseInt(rowMatch[1]) : undefined;

        logger.log(`[PlanningSheet] User ${userId} appended new row ${newRowIndex} for event ${eventId}`);
        return {
          success: true,
          message: `Added new row ${newRowIndex || ''} to Planning Sheet`,
          rowIndex: newRowIndex,
          isUpdate: false
        };
      }
    } catch (error) {
      logger.error(`[PlanningSheet] Error pushing event ${eventId}:`, error);
      return {
        success: false,
        message: `Failed to push to sheet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Find a row in the Planning Sheet that matches an event
   * Used to determine if we should create a new row or update existing
   */
  async findMatchingRow(eventId: number): Promise<PlanningSheetRow | null> {
    const event = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event || event.length === 0) {
      return null;
    }

    const e = event[0];
    const sheetRows = await this.readPlanningSheet();

    // Try to match by organization name + date
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    const eventDateStr = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    }) : '';

    for (const row of sheetRows) {
      // Match by organization name (case-insensitive) and date
      const orgMatch = row.groupName.toLowerCase().trim() === (e.organizationName || '').toLowerCase().trim();
      const dateMatch = row.date === eventDateStr;

      if (orgMatch && dateMatch) {
        return row;
      }
    }

    return null;
  }
}

/**
 * Get the Planning Sheet service instance for the test sheet
 * Uses environment variable for sheet ID
 */
export function getPlanningSheetService(): PlanningSheetSyncService | null {
  const sheetId = process.env.PLANNING_SHEET_ID;
  const worksheetName = process.env.PLANNING_SHEET_WORKSHEET_NAME || '2026 Groups';
  if (!sheetId) {
    logger.warn('PLANNING_SHEET_ID not configured');
    return null;
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    logger.warn('Google Sheets credentials not configured');
    return null;
  }

  return new PlanningSheetSyncService(sheetId, worksheetName);
}
