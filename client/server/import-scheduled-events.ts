import { storage } from './storage-wrapper';
import { logger } from './utils/production-safe-logger';
import { AuditLogger } from './audit-logger';

// Event data extracted from the spreadsheet
const scheduledEvents = [
  {
    date: '2025-09-14',
    eventStartTime: '2:30:00 PM',
    eventEndTime: '5:00:00 PM',
    pickupTime: '5:00:00 PM',
    details: 'Rina + Marcy +',
    groupName: 'Interfaith Festival',
    estimatedSandwiches: 500,
    dayOfWeek: 'Sunday',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    tspContact: '',
    address: '701 S. Columbia Drive Decatur, GA',
    notes: '',
  },
  {
    date: '2025-09-23',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    details: 'Felipe will speak and deliver to Marcy',
    groupName: 'Allied World',
    estimatedSandwiches: 400,
    dayOfWeek: 'Tuesday',
    contactName: 'Felipe Buzeta',
    contactEmail: '',
    contactPhone: '',
    tspContact: 'Lisa Hiles',
    address: '',
    notes: '',
  },
  {
    date: '2025-09-23',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '11:00:00 AM',
    details:
      'driver to pull up in the front will have cart to bring down sandwiches',
    groupName: 'The National Christian Foundation',
    estimatedSandwiches: 200,
    dayOfWeek: 'Tuesday',
    contactName: 'Shamika Hartgrove',
    contactEmail: 'shartgrove@ncfgiving.com',
    contactPhone: '(646) 808-4581',
    tspContact: 'Stephanie Luis',
    address: '1150 Sanctuary Pkwy Suite 350',
    notes: '',
  },
  {
    date: '2025-09-24',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    details: 'need driver',
    groupName: 'Brookhaven Rotary Club',
    estimatedSandwiches: 200, // 100 deli + 100 PBJ
    dayOfWeek: 'Wednesday',
    contactName: 'Linda Hatten',
    contactEmail: 'lbhatten@gmail.com',
    contactPhone: '404-457-8843',
    tspContact: 'Stephanie Luis',
    address: '4001 Peachtree Rd NE 30319',
    notes: '',
  },
  {
    date: '2025-09-25',
    eventStartTime: '10:00:00 AM',
    eventEndTime: '',
    pickupTime: '',
    details:
      'Lisa + Andy Hiles, Barbra Bancroft, Kim Ross + friend to attend need van driver',
    groupName: 'Georgia Lions Lighthouse Foundation',
    estimatedSandwiches: 1000,
    dayOfWeek: 'Thursday',
    contactName: 'Trudy Rudert',
    contactEmail: '',
    contactPhone: '404-713-6934',
    tspContact: 'Lisa Hiles',
    address: '5582 Peachtree Road, Chamblee, GA 30341',
    notes: '',
  },
  {
    date: '2025-09-26',
    eventStartTime: '2:00:00 PM',
    eventEndTime: '5:00:00 PM',
    pickupTime: '5:00:00 PM',
    details: 'need more volunteers, Lisa + Rina to attend',
    groupName: 'Marist School 9th Grade Retreat',
    estimatedSandwiches: 800,
    dayOfWeek: 'Friday',
    contactName: 'Mary Ujda',
    contactEmail: 'ujdam@marist.com',
    contactPhone: '770-457-7201',
    tspContact: 'Lisa Hiles',
    address: '3790 Ashford Dunwoody Road Atlanta, GA 30319',
    notes: '',
  },
  {
    date: '2025-09-26',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '3:30:00 PM',
    details: 'need a driver',
    groupName: 'Pope High School Volleyball',
    estimatedSandwiches: 200,
    dayOfWeek: 'Friday',
    contactName: 'Aronda Rodgers',
    contactEmail: 'anranr4@gmail.com',
    contactPhone: '(401) 573-6300',
    tspContact: 'Stephanie Luis',
    address: '4009 Regency Lake Trail Marietta',
    notes: '',
  },
  {
    date: '2025-09-26',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    details: '',
    groupName: 'Cherokee Indivisible',
    estimatedSandwiches: 0, // TBD
    dayOfWeek: 'Friday',
    contactName: 'Courtney Maniatis',
    contactEmail: 'courtneymaniatis@proton.me',
    contactPhone: '(678) 770-4597',
    tspContact: 'Stephanie Luis',
    address: '804 Crow View Ct, Woodstock, GA 30189',
    notes: '',
  },
  {
    date: '2025-09-30',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    details: 'need pick up',
    groupName: 'Early Emory',
    estimatedSandwiches: 200,
    dayOfWeek: 'Tuesday',
    contactName: 'Bethany Colvin',
    contactEmail: '',
    contactPhone: '404-697-3433',
    tspContact: 'Stephanie Luis',
    address: '',
    notes: '',
  },
  {
    date: '2025-10-01',
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '6:50:00 PM',
    details: 'need 2 drivers take to Marcy',
    groupName: 'Roswell Presbyterian Church',
    estimatedSandwiches: 1000,
    dayOfWeek: 'Wednesday',
    contactName: 'Donna Brodsky',
    contactEmail: 'donna@roswellpres.org',
    contactPhone: '617-921-0988',
    tspContact: 'Stephanie Luis',
    address: '',
    notes: '',
  },
  {
    date: '2025-10-04',
    eventStartTime: '10:00:00 AM', // flexible 10 AM/11 AM
    eventEndTime: '',
    pickupTime: 'flexible',
    details: 'need to circle back with their group to confirm 15-20',
    groupName: 'NCL North East',
    estimatedSandwiches: 300, // + deli
    dayOfWeek: 'Saturday',
    contactName: 'Natalie Muir',
    contactEmail: 'nataliecmuir@gmail.com',
    contactPhone: '678-642-7230',
    tspContact: 'Stephanie',
    address: '',
    notes: '',
  },
];

// Function to check if an event already exists
async function eventExists(
  organizationName: string,
  eventDate: string
): Promise<boolean> {
  try {
    const allEvents = await storage.getAllEventRequests();
    // Parse date in local timezone to avoid UTC shifts
    const [year, month, day] = eventDate.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day); // month is 0-indexed

    return allEvents.some((event: any) => {
      if (!event.desired_event_date || !event.organization_name) return false;

      const existingDate = new Date(event.desired_event_date);
      // Compare year, month, day directly to avoid timezone issues
      const sameDate =
        existingDate.getFullYear() === targetDate.getFullYear() &&
        existingDate.getMonth() === targetDate.getMonth() &&
        existingDate.getDate() === targetDate.getDate();
      const sameOrg =
        event.organization_name.toLowerCase() ===
        organizationName.toLowerCase();

      return sameDate && sameOrg;
    });
  } catch (error) {
    logger.error(
      'Error checking event existence:',
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

// Function to import new events
export async function importScheduledEvents(): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const results = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };

  logger.log(
    `🔄 Starting import of ${scheduledEvents.length} scheduled events...`
  );

  for (const event of scheduledEvents) {
    try {
      // Check if event already exists
      const exists = await eventExists(event.groupName, event.date);

      if (exists) {
        logger.log(
          `⏭️ Skipping existing event: ${event.groupName} on ${event.date}`
        );
        results.skipped++;
        continue;
      }

      // Parse contact name with robust fallbacks for empty/null values
      const contactName = event.contactName?.trim();
      let firstName = 'Contact';
      let lastName = 'Person';

      if (contactName && contactName.length > 0) {
        const nameParts = contactName.split(' ');
        firstName = nameParts[0] || 'Contact';
        lastName = nameParts.slice(1).join(' ') || 'Person';
      }

      // Extra safety check to ensure we never have null/empty names
      if (!firstName || firstName.trim() === '') firstName = 'Contact';
      if (!lastName || lastName.trim() === '') lastName = 'Person';

      // Create new event request
      const newEvent = {
        first_name: firstName,
        last_name: lastName,
        email: event.contactEmail || '',
        phone: event.contactPhone || '',
        organization_name: event.groupName,
        desired_event_date: (() => {
          const [year, month, day] = event.date.split('-').map(Number);
          return new Date(year, month - 1, day, 16, 0, 0); // 4 PM local time, month is 0-indexed
        })(),
        message: event.details,
        status: 'scheduled',
        event_address: event.address || '',
        estimated_sandwich_count: event.estimatedSandwiches || 0,
        event_start_time: event.eventStartTime || '',
        event_end_time: event.eventEndTime || '',
        pickup_time:
          event.pickupTime === 'flexible'
            ? 'Flexible timing'
            : event.pickupTime || '',
        planning_notes: event.notes || '',
        toolkit_sent: true, // Marked as sent in spreadsheet
        toolkit_status: 'sent',
        tsp_contact: event.tspContact || '',
        created_at: new Date(),
        updated_at: new Date(),
      };

      logger.log(
        `🔍 About to create event request:`,
        JSON.stringify(newEvent, null, 2)
      );

      try {
        const createdEvent = await storage.createEventRequest(newEvent);
        
        // Add audit logging for scheduled event import
        await AuditLogger.logEventRequestChange(
          createdEvent.id?.toString() || 'unknown',
          null,
          createdEvent,
          {
            userId: 'SYSTEM',
            ipAddress: 'SYSTEM_IMPORT',
            userAgent: 'Scheduled Events Import Script',
            sessionId: 'IMPORT_SESSION',
          },
          { actionType: 'CREATE', operation: 'SCHEDULED_EVENTS_IMPORT' }
        );
        
        logger.log(
          `✅ Successfully created event with ID: ${createdEvent.id} for ${event.groupName}`
        );
        results.imported++;
      } catch (createError) {
        logger.error(`❌ Failed to create event request:`, createError);
        throw createError;
      }
    } catch (error) {
      const errorMsg = `Failed to import ${event.groupName}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      logger.error(`❌ ${errorMsg}`);
      logger.error('Full error details:', error);
      results.errors.push(errorMsg);
    }
  }

  logger.log(
    `📊 Import complete: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`
  );
  return results;
}
