import { Router } from 'express';
import type { RouterDependencies } from '../types';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { isValid, parseISO } from 'date-fns';
import { logger } from '../utils/production-safe-logger';
import { AuditLogger } from '../audit-logger';

export function createImportEventsRouter(deps: RouterDependencies) {
  const router = Router();
  const { storage, isAuthenticated } = deps;

// Helper functions for pickup time data migration (same as in event-requests.ts)
const convertTimeToDateTime = (timeStr: string, baseDate?: Date | string): string | null => {
  if (!timeStr) return null;
  
  try {
    // Parse time string (supports formats like "2:30 PM", "14:30", "2:30")
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3]?.toUpperCase();
    
    // Convert to 24-hour format if needed
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    // Extract date components safely without timezone conversion
    let year: number, month: string, day: string;
    
    if (baseDate) {
      const dateStr = typeof baseDate === 'string' ? baseDate : baseDate.toISOString();
      // Extract YYYY-MM-DD directly from the string to avoid timezone issues
      const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        year = parseInt(dateMatch[1]);
        month = dateMatch[2];
        day = dateMatch[3];
      } else {
        // Fallback to Date object if string parsing fails
        const d = new Date(dateStr);
        year = d.getUTCFullYear();
        month = String(d.getUTCMonth() + 1).padStart(2, '0');
        day = String(d.getUTCDate()).padStart(2, '0');
      }
    } else {
      // Use today's date in local timezone
      const now = new Date();
      year = now.getFullYear();
      month = String(now.getMonth() + 1).padStart(2, '0');
      day = String(now.getDate()).padStart(2, '0');
    }
    
    const hoursStr = String(hours).padStart(2, '0');
    const minutesStr = String(minutes).padStart(2, '0');
    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}:00`;
  } catch (error) {
    logger.warn('Failed to convert time to datetime:', timeStr, error);
    return null;
  }
};

const extractTimeFromDateTime = (dateTimeStr: string): string | null => {
  if (!dateTimeStr) return null;
  
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return null;
    
    // Extract time in 12-hour format with AM/PM
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return timeStr;
  } catch (error) {
    logger.warn('Failed to extract time from datetime:', dateTimeStr, error);
    return null;
  }
};

// Process imported event data to ensure both pickup time fields are set
const processImportedPickupTime = (eventData: any, eventDate?: Date) => {
  const result = { ...eventData };
  
  // If we have pickupTime but no pickupDateTime, convert it
  if (result.pickupTime && !result.pickupDateTime) {
    logger.log('📅 Converting imported pickupTime to pickupDateTime');
    const baseDate = eventDate || new Date();
    const convertedDateTime = convertTimeToDateTime(result.pickupTime, baseDate);
    if (convertedDateTime) {
      result.pickupDateTime = convertedDateTime;
    }
  }
  // If we have pickupDateTime but no pickupTime, extract it
  else if (result.pickupDateTime && !result.pickupTime) {
    logger.log('📅 Extracting pickupTime from imported pickupDateTime');
    const extractedTime = extractTimeFromDateTime(result.pickupDateTime);
    if (extractedTime) {
      result.pickupTime = extractedTime;
    }
  }
  
  return result;
};

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import past events that are already completed
  router.post('/import-past-events', isAuthenticated, async (req, res) => {
  try {
    logger.log('Starting past events import...');

    // Parse events data from request body
    const { events: eventData } = req.body;

    if (!eventData || !Array.isArray(eventData)) {
      return res.status(400).json({ error: 'No event data provided' });
    }

    const events = [];

    for (const eventInfo of eventData) {
      // Parse the date
      let parsedDate = null;
      if (eventInfo.date) {
        try {
          // TIMEZONE SAFE: Parse as local date by adding noon time
          const dateStr = eventInfo.date.toString().trim();
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            parsedDate = new Date(dateStr + 'T12:00:00');
          } else {
            const tempDate = new Date(dateStr);
            parsedDate = new Date(
              tempDate.getFullYear(),
              tempDate.getMonth(),
              tempDate.getDate()
            );
          }
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          logger.warn(`Could not parse date "${eventInfo.date}"`);
          parsedDate = null;
        }
      }

      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (eventInfo.contactName) {
        const nameParts = eventInfo.contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      if (firstName && eventInfo.organizationName && eventInfo.email) {
        const baseEventData = {
          firstName: firstName,
          lastName: lastName || '',
          email: eventInfo.email,
          phone: eventInfo.phone || null,
          organizationName: eventInfo.organizationName,
          desiredEventDate: parsedDate,
          status: 'completed', // These are past events
          contactedAt: parsedDate, // Use event date as contacted date
          previouslyHosted: 'i_dont_know',
          message: 'Imported past event',
          createdBy: req.user?.id,
          eventStartTime: eventInfo.eventStartTime || null,
          eventEndTime: eventInfo.eventEndTime || null,
          pickupTime: eventInfo.pickupTime || null,
          pickupDateTime: eventInfo.pickupDateTime || null,
          eventAddress: eventInfo.eventAddress || null,
          estimatedSandwichCount: eventInfo.estimatedSandwichCount || null,
          toolkitSent: eventInfo.toolkitSent || false,
          toolkitStatus: eventInfo.toolkitSent ? 'sent' : 'not_sent',
          additionalRequirements: eventInfo.notes || null,
          planningNotes: eventInfo.tspContact || null,
          tspContactAssigned: eventInfo.tspContact || null,
        };

        // Process pickup time fields for data migration
        const processedEventData = processImportedPickupTime(baseEventData, parsedDate);
        events.push(processedEventData);
      }
    }

    // Import the events
    const importedEvents = [];
    const skippedDuplicates = [];

    for (const event of events) {
      try {
        // Check if event already exists
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(
          (existing) =>
            existing.email.toLowerCase() === event.email.toLowerCase() &&
            existing.organizationName.toLowerCase() ===
              event.organizationName.toLowerCase()
        );

        if (isDuplicate) {
          logger.log(
            `⚠️  Skipping duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`
          );
          skippedDuplicates.push(event);
          continue;
        }

        const result = await storage.createEventRequest(event);
        
        // Add audit logging for imported event
        await AuditLogger.logEventRequestChange(
          result.id?.toString() || 'unknown',
          null,
          result,
          {
            userId: 'SYSTEM',
            ipAddress: 'SYSTEM_IMPORT',
            userAgent: 'Google Sheets - Past Events Import',
            sessionId: 'IMPORT_SESSION',
          },
          { actionType: 'CREATE', operation: 'GOOGLE_SHEETS_IMPORT' }
        );
        
        importedEvents.push(result);
        logger.log(
          `✅ Imported past event: ${event.firstName} ${event.lastName} - ${event.organizationName}`
        );
      } catch (error) {
        logger.error(
          `❌ Failed to import: ${event.firstName} ${event.lastName} - ${event.organizationName}`,
          error
        );
      }
    }

    logger.log(
      `✅ Successfully imported ${importedEvents.length} past events!`
    );

    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} past events`,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length,
    });
  } catch (error) {
    logger.error('❌ Error importing past events:', error);
    res.status(500).json({
      error: 'Failed to import past events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import historical 2024 events from attached Excel/CSV file
  router.post('/import-historical', isAuthenticated, async (req, res) => {
  try {
    logger.log('Starting historical 2024 event import...');

    // Read the 2024 historical data file
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'attached_assets',
      '2024 Groups_1756753446666.xlsx'
    );
    logger.log('Reading historical file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    logger.log('Historical headers:', data[0]);
    logger.log(`Total historical rows: ${data.length}`);

    // Skip header row and process data
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows or rows without meaningful data
      if (!row || row.length === 0) continue;

      // Skip header row and rows that look like headers
      const possibleGroupName = row[3];
      if (
        !possibleGroupName ||
        possibleGroupName.toString().toLowerCase().includes('group name')
      )
        continue;

      // Map 2024 data structure:
      // 0: (empty or date), 1: Time, 2: Social Post, 3: Group Name, 4: Estimate/Final # sandwiches made,
      // 5: Day of Week, 6: Sent toolkit, 7: Email Address, 8: Contact Name,
      // 9: Contact Cell Number, 10: TSP Contact, 11: TSP Volunteer speaking/picking up,
      // 12: volunteer picking up or delivering, 13: Where are sandwiches going?, 14: Notes
      const eventDateStr = row[0] || row[1]; // Date could be in column 0 or 1
      const groupName = row[3]; // Group Name
      const sandwichCount = row[4]; // Estimate/Final # sandwiches made
      const toolkitSent = row[6]; // Sent toolkit
      const email = row[7]; // Email Address
      const contactName = row[8]; // Contact Name
      const phone = row[9]; // Contact Cell Number
      const tspContact = row[10]; // TSP Contact
      const deliveryLocation = row[13]; // Where are sandwiches going?
      const notes = row[14]; // Notes

      // Parse MM/DD/YYYY date format
      let parsedDate = null;
      if (eventDateStr) {
        try {
          if (typeof eventDateStr === 'number') {
            // Excel numeric date - TIMEZONE SAFE
            const excelEpoch = new Date(1899, 11, 30);
            const tempDate = new Date(
              excelEpoch.getTime() + eventDateStr * 24 * 60 * 60 * 1000
            );
            // Create local date to avoid timezone shift
            parsedDate = new Date(
              tempDate.getFullYear(),
              tempDate.getMonth(),
              tempDate.getDate()
            );
          } else {
            // Handle MM/DD/YYYY string format - TIMEZONE SAFE
            const dateStr = eventDateStr.toString().trim();
            const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
              const [, month, day, year] = dateMatch;
              // Use local date constructor to avoid timezone issues
              parsedDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day)
              );
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // YYYY-MM-DD format - add noon time
              parsedDate = new Date(dateStr + 'T12:00:00');
            } else {
              // Fallback: parse and convert to local date
              const tempDate = new Date(dateStr);
              parsedDate = new Date(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate()
              );
            }
          }

          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          logger.warn(
            `Could not parse historical date "${eventDateStr}" for row ${i + 1}`
          );
          parsedDate = null;
        }
      }

      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Parse toolkit sent status
      const toolkitSentStatus =
        toolkitSent && toolkitSent.toString().toLowerCase() === 'yes';

      // Parse estimated sandwich count
      let parsedSandwichCount = null;
      if (sandwichCount) {
        const countStr = sandwichCount.toString().replace(/[^\d]/g, ''); // Remove non-digits
        if (countStr && !isNaN(parseInt(countStr))) {
          parsedSandwichCount = parseInt(countStr);
        }
      }

      // Debug the mapping for first few rows
      if (i <= 5) {
        logger.log(`🔍 Row ${i + 1} debug:`, {
          firstName,
          lastName,
          groupName,
          email,
          rawRow: row.slice(0, 10),
        });
      }

      // Only add if we have required fields
      if (firstName && groupName && email) {
        events.push({
          firstName: firstName,
          lastName: lastName || '',
          email: email.toString(),
          phone: phone ? phone.toString() : null,
          organizationName: groupName.toString(),
          desiredEventDate: parsedDate,
          status: 'completed', // Historical events are completed
          contactedAt: parsedDate, // Use event date as contacted date
          previouslyHosted: 'yes', // These are past hosts
          message: 'Imported historical 2024 event',
          createdBy: req.user?.id,
          estimatedSandwichCount: parsedSandwichCount,
          toolkitSent: toolkitSentStatus,
          toolkitStatus: toolkitSentStatus ? 'sent' : 'not_sent',
          planningNotes: notes ? notes.toString() : null,
          tspContactAssigned: tspContact ? tspContact.toString() : null,
          additionalRequirements: deliveryLocation
            ? `Delivery location: ${deliveryLocation}`
            : null,
        });

        logger.log(
          `✅ Prepared historical event: ${firstName} ${lastName} from ${groupName} (${email})`
        );
      } else {
        logger.log(
          `⚠️  Skipping historical row ${i + 1} - missing required fields:`,
          {
            firstName: !!firstName,
            groupName: !!groupName,
            email: !!email,
          }
        );
      }
    }

    logger.log(`\nPrepared ${events.length} historical events for import`);

    if (events.length > 0) {
      logger.log('First 3 prepared events:');
      events.slice(0, 3).forEach((event, idx) => {
        logger.log(
          `  ${idx + 1}. ${event.firstName} ${event.lastName} - ${
            event.organizationName
          } (${event.email})`
        );
      });
    }

    if (events.length === 0) {
      return res
        .status(400)
        .json({ error: 'No valid historical events found to import' });
    }

    // Import with duplicate checking
    const importedEvents = [];
    const skippedDuplicates = [];

    for (const event of events) {
      try {
        // Check if event already exists (by email and organization)
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(
          (existing) =>
            existing.email.toLowerCase() === event.email.toLowerCase() &&
            existing.organizationName.toLowerCase() ===
              event.organizationName.toLowerCase()
        );

        if (isDuplicate) {
          logger.log(
            `⚠️  Skipping historical duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName} (${event.email})`
          );
          skippedDuplicates.push(event);
          continue;
        }

        const result = await storage.createEventRequest(event);
        
        // Add audit logging for imported historical event
        await AuditLogger.logEventRequestChange(
          result.id?.toString() || 'unknown',
          null,
          result,
          {
            userId: 'SYSTEM',
            ipAddress: 'SYSTEM_IMPORT',
            userAgent: 'Excel - Historical 2024 Import',
            sessionId: 'IMPORT_SESSION',
          },
          { actionType: 'CREATE', operation: 'EXCEL_HISTORICAL_IMPORT' }
        );
        
        importedEvents.push(result);
        logger.log(
          `✅ Imported historical: ${event.firstName} ${event.lastName} - ${event.organizationName}`
        );
      } catch (error) {
        logger.error(
          `❌ Failed to import historical: ${event.firstName} ${event.lastName} - ${event.organizationName}`,
          error
        );
      }
    }

    logger.log(
      `✅ Successfully imported ${importedEvents.length} historical events!`
    );
    if (skippedDuplicates.length > 0) {
      logger.log(
        `⚠️  Skipped ${skippedDuplicates.length} historical duplicates`
      );
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} historical events from 2024`,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length,
      events: importedEvents.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        organization: e.organizationName,
        email: e.email,
      })),
    });
  } catch (error) {
    logger.error('❌ Error importing historical events:', error);
    res.status(500).json({
      error: 'Failed to import historical events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

  router.post('/import-excel', isAuthenticated, async (req, res) => {
  try {
    logger.log('Starting Excel event import...');

    // Read the Excel file
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'attached_assets',
      'Events January - May_1756610094691.xlsx'
    );
    logger.log('Reading file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    logger.log('Headers:', data[0]);
    logger.log(`Total rows: ${data.length}`);

    // Skip header row and process data
    const events = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) continue;

      // Map the data based on the April-June Excel column structure:
      // 0: Date, 1: Event Start time Optional, 2: Event end time Optional, 3: Pick up time
      // 4: ALL DETAILS, 5: Social Post, 6: Call Made, 7: Group Name, 8: Estimate/Final # sandwiches made
      // 9: Day of Week, 10: Sent toolkit, 11: Email Address, 12: Contact Name
      // 13: Contact Cell Number, 14: TSP Contact, 15: Address, 16: Notes
      const eventDate = row[0];
      const eventStartTime = row[1]; // Event Start time Optional
      const eventEndTime = row[2]; // Event end time Optional
      const pickupTime = row[3]; // Pick up time
      const allDetails = row[4]; // ALL DETAILS
      const organization = row[7]; // Group Name
      const estimatedSandwichCount = row[8]; // Estimate/Final # sandwiches made
      const toolkitSent = row[10]; // Sent toolkit
      const email = row[11]; // Email Address
      const contactName = row[12]; // Contact Name
      const phone = row[13]; // Contact Cell Number
      const tspContact = row[14]; // TSP Contact
      const eventAddress = row[15]; // Address
      const notes = row[16]; // Notes

      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName) {
        const nameParts = contactName.toString().trim().split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Helper function to convert Excel time decimal to time string
      const parseExcelTime = (timeValue: any): string | null => {
        if (!timeValue) return null;

        if (typeof timeValue === 'number') {
          // Excel time is stored as fraction of day (0.5 = 12:00 PM)
          const totalMinutes = Math.round(timeValue * 24 * 60);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          return `${hours
            .toString()
            .padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        // If it's already a string, return as-is
        return timeValue.toString();
      };

      // Parse date
      let parsedDate = null;
      if (eventDate) {
        try {
          // Handle Excel date formats - TIMEZONE SAFE
          if (typeof eventDate === 'number') {
            // Excel numeric date
            const excelEpoch = new Date(1899, 11, 30);
            const tempDate = new Date(
              excelEpoch.getTime() + eventDate * 24 * 60 * 60 * 1000
            );
            // Create local date to avoid timezone shift
            parsedDate = new Date(
              tempDate.getFullYear(),
              tempDate.getMonth(),
              tempDate.getDate()
            );
          } else {
            // String date - parse as local date
            const dateStr = eventDate.toString().trim();
            if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // Already in YYYY-MM-DD format - add noon time
              parsedDate = new Date(dateStr + 'T12:00:00');
            } else {
              // Try to parse and convert to local date
              const tempDate = new Date(dateStr);
              parsedDate = new Date(
                tempDate.getFullYear(),
                tempDate.getMonth(),
                tempDate.getDate()
              );
            }
          }

          // Validate date
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          logger.warn(`Could not parse date "${eventDate}" for row ${i + 1}`);
          parsedDate = null;
        }
      }

      // Parse toolkit sent status
      const toolkitSentStatus =
        toolkitSent && toolkitSent.toString().toLowerCase() === 'yes';

      // Parse estimated sandwich count
      let parsedSandwichCount = null;
      if (
        estimatedSandwichCount &&
        !isNaN(parseInt(estimatedSandwichCount.toString()))
      ) {
        parsedSandwichCount = parseInt(estimatedSandwichCount.toString());
      }

      // Only add if we have required fields
      if (firstName && organization && email) {
        const baseEventData = {
          firstName: firstName,
          lastName: lastName || '',
          email: email,
          phone: phone ? phone.toString() : null,
          organizationName: organization,
          desiredEventDate: parsedDate,
          status: 'contact_completed',
          contactedAt: new Date(), // Mark as contacted since these are scheduled events
          previouslyHosted: 'i_dont_know',
          message: 'Imported from Excel file',
          createdBy: req.user?.id, // Mark who imported this
          // Map all Excel fields to database fields with proper time parsing
          eventStartTime: parseExcelTime(eventStartTime),
          eventEndTime: parseExcelTime(eventEndTime),
          pickupTime: parseExcelTime(pickupTime),
          eventAddress: eventAddress ? eventAddress.toString() : null,
          estimatedSandwichCount: parsedSandwichCount,
          toolkitSent: toolkitSentStatus,
          toolkitStatus: toolkitSentStatus ? 'sent' : 'not_sent',
          additionalRequirements: allDetails ? allDetails.toString() : null,
          planningNotes: notes ? notes.toString() : null,
          tspContactAssigned: tspContact ? tspContact.toString() : null,
        };

        // Process pickup time fields for data migration
        const processedEventData = processImportedPickupTime(baseEventData, parsedDate);
        events.push(processedEventData);

        logger.log(
          `✅ Prepared event: ${firstName} ${lastName} from ${organization}`
        );
      } else {
        logger.log(`⚠️  Skipping row ${i + 1} - missing required fields:`, {
          firstName: !!firstName,
          organization: !!organization,
          email: !!email,
        });
      }
    }

    logger.log(`\nPrepared ${events.length} events for import`);

    if (events.length === 0) {
      return res.status(400).json({ error: 'No valid events found to import' });
    }

    // Check for existing events to prevent duplicates
    const importedEvents = [];
    const skippedDuplicates = [];

    for (const event of events) {
      try {
        // Check if event already exists (by email and organization)
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(
          (existing) =>
            existing.email.toLowerCase() === event.email.toLowerCase() &&
            existing.organizationName.toLowerCase() ===
              event.organizationName.toLowerCase()
        );

        if (isDuplicate) {
          logger.log(
            `⚠️  Skipping duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`
          );
          skippedDuplicates.push(event);
          continue;
        }

        const result = await storage.createEventRequest(event);
        
        // Add audit logging for imported event
        await AuditLogger.logEventRequestChange(
          result.id?.toString() || 'unknown',
          null,
          result,
          {
            userId: 'SYSTEM',
            ipAddress: 'SYSTEM_IMPORT',
            userAgent: 'Excel - General Events Import',
            sessionId: 'IMPORT_SESSION',
          },
          { actionType: 'CREATE', operation: 'EXCEL_IMPORT' }
        );
        
        importedEvents.push(result);
        logger.log(
          `✅ Imported: ${event.firstName} ${event.lastName} - ${event.organizationName}`
        );
      } catch (error) {
        logger.error(
          `❌ Failed to import: ${event.firstName} ${event.lastName} - ${event.organizationName}`,
          error
        );
      }
    }

    logger.log(`✅ Successfully imported ${importedEvents.length} events!`);
    if (skippedDuplicates.length > 0) {
      logger.log(`⚠️  Skipped ${skippedDuplicates.length} duplicates`);
    }

    const message =
      skippedDuplicates.length > 0
        ? `Successfully imported ${importedEvents.length} events, skipped ${skippedDuplicates.length} duplicates`
        : `Successfully imported ${importedEvents.length} events out of ${events.length} parsed`;

    res.json({
      success: true,
      message,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length,
      events: importedEvents.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        organization: e.organizationName,
        email: e.email,
      })),
    });
  } catch (error) {
    logger.error('❌ Error importing events:', error);
    res.status(500).json({
      error: 'Failed to import events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Sync from Google Sheets - proxy to event requests sync endpoint
  router.post('/sync-from-sheets', isAuthenticated, async (req, res) => {
  try {
    logger.log(
      '🔄 Proxying sync-from-sheets request to event-requests sync endpoint...'
    );

    // Import the event requests sync service
    const { getEventRequestsGoogleSheetsService } = await import(
      '../google-sheets-event-requests-sync'
    );
    const { storage: storageWrapper } = await import('../storage-wrapper');

    const syncService = getEventRequestsGoogleSheetsService(storageWrapper);
    if (!syncService) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets service not configured',
      });
    }

    const result = await syncService.syncFromGoogleSheets();

    // Ensure the response has the expected format for the frontend
    const response = {
      success: true,
      message:
        result.message ||
        `Successfully synced from Google Sheets: ${
          result.created || 0
        } created, ${result.updated || 0} updated`,
      total: (result.created || 0) + (result.updated || 0),
      imported: result.created || 0,
      updated: result.updated || 0,
      created: result.created || 0,
      ...result,
    };

    res.json(response);
  } catch (error) {
    logger.error('❌ Error syncing from Google Sheets:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Import 2023 historical events
  router.post('/import-2023-events', isAuthenticated, async (req, res) => {
  try {
    logger.log('Starting 2023 events import...');

    // Read the 2023 Excel file
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'attached_assets',
      '2023 Events_1757981703985.xlsx'
    );
    logger.log('Reading 2023 events file:', filePath);

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // '2023 groups'
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with proper headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    logger.log('2023 Events headers:', data[0]);
    logger.log(`Total 2023 rows: ${data.length}`);

    // Skip header row and process data
    const events = [];
    let skippedRows = 0;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip completely empty rows
      if (!row || row.length === 0) continue;

      // Based on the Excel structure:
      // 0: Sandwich-making date, 3: Estimate/Final # sandwiches made, 6: Group Name,
      // 7: Sent toolkit, 8: Email Address, 9: Contact Name, 10: Contact Cell Number,
      // 11: TSP Contact, 14: Where are sandwiches going?, 15: Notes
      const eventDateRaw = row[0]; // Sandwich-making date
      const estimatedSandwichCount = row[3]; // Estimate/Final # sandwiches made
      const groupName = row[6]; // Group Name
      const toolkitSent = row[7]; // Sent toolkit
      const email = row[8]; // Email Address  
      const contactName = row[9]; // Contact Name
      const phone = row[10]; // Contact Cell Number
      const tspContact = row[11]; // TSP Contact
      const deliveryLocation = row[14]; // Where are sandwiches going?
      const notes = row[15]; // Notes

      // Parse date - handle both Excel numeric dates and text dates
      let parsedDate = null;
      if (eventDateRaw) {
        try {
          if (typeof eventDateRaw === 'number') {
            // Excel numeric date - TIMEZONE SAFE
            const excelEpoch = new Date(1899, 11, 30);
            const tempDate = new Date(
              excelEpoch.getTime() + eventDateRaw * 24 * 60 * 60 * 1000
            );
            // Create local date to avoid timezone shift
            parsedDate = new Date(
              tempDate.getFullYear(),
              tempDate.getMonth(),
              tempDate.getDate()
            );
          } else {
            // Handle text dates like "1/14 Saturday night"
            const dateStr = eventDateRaw.toString().trim();
            
            // Try to extract date from various formats
            let dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})/); // MM/DD or M/D
            if (dateMatch) {
              const [, month, day] = dateMatch;
              // Assume 2023 since this is 2023 events file
              parsedDate = new Date(2023, parseInt(month) - 1, parseInt(day));
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              // YYYY-MM-DD format - add noon time
              parsedDate = new Date(dateStr + 'T12:00:00');
            } else {
              // Fallback: try to parse as regular date
              const tempDate = new Date(dateStr);
              if (!isNaN(tempDate.getTime())) {
                parsedDate = new Date(
                  tempDate.getFullYear(),
                  tempDate.getMonth(),
                  tempDate.getDate()
                );
              }
            }
          }

          if (parsedDate && isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        } catch (e) {
          logger.warn(`Could not parse 2023 date "${eventDateRaw}" for row ${i + 1}`);
          parsedDate = null;
        }
      }

      // Split contact name into first and last name
      let firstName = '';
      let lastName = '';
      if (contactName && contactName.toString().trim()) {
        const nameParts = contactName.toString().trim().split(/[\/\s]+/);
        // Take first name as first part, rest as last name
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Parse toolkit sent status
      const toolkitSentStatus = toolkitSent && 
        toolkitSent.toString().toLowerCase().includes('yes');

      // Parse estimated sandwich count
      let parsedSandwichCount = null;
      if (estimatedSandwichCount && !isNaN(parseInt(estimatedSandwichCount.toString()))) {
        parsedSandwichCount = parseInt(estimatedSandwichCount.toString());
      }

      // Clean up email address
      let cleanEmail = null;
      if (email && email.toString().trim() && email.toString().trim() !== ' ') {
        const emailStr = email.toString().trim();
        // Basic email validation
        if (emailStr.includes('@') && emailStr.includes('.')) {
          cleanEmail = emailStr;
        }
      }

      // Debug first few rows
      if (i <= 5) {
        logger.log(`🔍 Row ${i + 1} debug:`, {
          firstName,
          lastName,
          groupName: groupName ? groupName.toString() : 'N/A',
          email: cleanEmail,
          date: parsedDate ? parsedDate.toDateString() : 'N/A',
          sandwichCount: parsedSandwichCount,
          rawRow: row.slice(0, 12), // Show first 12 columns for debugging
        });
      }

      // Only add if we have minimum required fields: groupName and either email or contactName
      if (groupName && groupName.toString().trim() && 
          (cleanEmail || (firstName && firstName.trim()))) {
        
        // Use a placeholder email if missing but we have contact info
        const finalEmail = cleanEmail || `${firstName.toLowerCase().replace(/\s+/g, '')}@placeholder.org`;
        
        events.push({
          firstName: firstName || 'Unknown',
          lastName: lastName || '',
          email: finalEmail,
          phone: phone ? phone.toString() : null,
          organizationName: groupName.toString(),
          desiredEventDate: parsedDate,
          status: 'completed', // 2023 events are completed
          contactedAt: parsedDate, // Use event date as contacted date
          previouslyHosted: 'yes', // These are past hosts
          message: 'Imported 2023 historical event',
          createdBy: req.user?.id,
          estimatedSandwichCount: parsedSandwichCount,
          actualSandwichCount: parsedSandwichCount, // Use same value for actual
          toolkitSent: toolkitSentStatus,
          toolkitStatus: toolkitSentStatus ? 'sent' : 'not_sent',
          planningNotes: notes ? notes.toString() : null,
          tspContactAssigned: tspContact ? tspContact.toString() : null,
          additionalRequirements: deliveryLocation 
            ? `Delivery location: ${deliveryLocation}` 
            : null,
        });

        logger.log(
          `✅ Prepared 2023 event: ${firstName} ${lastName} from ${groupName.toString()}`
        );
      } else {
        skippedRows++;
        if (skippedRows <= 10) { // Only show first 10 skipped rows to avoid spam
          logger.log(`⚠️  Skipping 2023 row ${i + 1} - insufficient data:`, {
            groupName: groupName ? groupName.toString() : 'N/A',
            email: cleanEmail,
            contactName: contactName ? contactName.toString() : 'N/A',
          });
        }
      }
    }

    logger.log(`\nPrepared ${events.length} 2023 events for import (skipped ${skippedRows} incomplete rows)`);

    if (events.length === 0) {
      return res.status(400).json({ 
        error: 'No valid 2023 events found to import',
        details: `Processed ${data.length - 1} rows, but none had sufficient data (group name + contact info)`
      });
    }

    // Show sample events
    if (events.length > 0) {
      logger.log('First 3 prepared 2023 events:');
      events.slice(0, 3).forEach((event, idx) => {
        logger.log(
          `  ${idx + 1}. ${event.firstName} ${event.lastName} - ${event.organizationName} (${event.email})`
        );
      });
    }

    // Import with duplicate checking
    const importedEvents = [];
    const skippedDuplicates = [];

    for (const event of events) {
      try {
        // Check if event already exists (by email and organization)
        const existingEvents = await storage.getAllEventRequests();
        const isDuplicate = existingEvents.some(
          (existing) =>
            existing.email.toLowerCase() === event.email.toLowerCase() &&
            existing.organizationName.toLowerCase() === 
              event.organizationName.toLowerCase()
        );

        if (isDuplicate) {
          logger.log(
            `⚠️  Skipping 2023 duplicate: ${event.firstName} ${event.lastName} - ${event.organizationName}`
          );
          skippedDuplicates.push(event);
          continue;
        }

        const result = await storage.createEventRequest(event);
        
        // Add audit logging for imported 2023 event
        await AuditLogger.logEventRequestChange(
          result.id?.toString() || 'unknown',
          null,
          result,
          {
            userId: 'SYSTEM',
            ipAddress: 'SYSTEM_IMPORT',
            userAgent: 'Excel - Historical 2023 Import',
            sessionId: 'IMPORT_SESSION',
          },
          { actionType: 'CREATE', operation: 'EXCEL_HISTORICAL_2023_IMPORT' }
        );
        
        importedEvents.push(result);
        logger.log(
          `✅ Imported 2023: ${event.firstName} ${event.lastName} - ${event.organizationName}`
        );
      } catch (error) {
        logger.error(
          `❌ Failed to import 2023: ${event.firstName} ${event.lastName} - ${event.organizationName}`,
          error
        );
      }
    }

    logger.log(`✅ Successfully imported ${importedEvents.length} 2023 events!`);
    if (skippedDuplicates.length > 0) {
      logger.log(`⚠️  Skipped ${skippedDuplicates.length} 2023 duplicates`);
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedEvents.length} events from 2023`,
      imported: importedEvents.length,
      total: events.length,
      skipped: skippedDuplicates.length + skippedRows,
      duplicates: skippedDuplicates.length,
      incompleteRows: skippedRows,
      events: importedEvents.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        organization: e.organizationName,
        email: e.email,
        date: e.desiredEventDate,
      })),
    });
  } catch (error) {
    logger.error('❌ Error importing 2023 events:', error);
    res.status(500).json({
      error: 'Failed to import 2023 events',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

  return router;
}

