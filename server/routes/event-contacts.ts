import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { logger } from '../utils/production-safe-logger';
import type { EventContact, EventContactDetail, EventContactEvent } from '@shared/schema';

const router = Router();

/**
 * Generates a unique key for a contact based on email, phone, or name
 * Keys must be stable across API calls for the detail page to work
 */
function getContactKey(
  email: string | null | undefined,
  phone: string | null | undefined,
  firstName?: string | null,
  lastName?: string | null
): string {
  const normalizedEmail = email?.toLowerCase().trim() || '';
  const normalizedPhone = phone?.replace(/\D/g, '') || '';

  // Prefer email as primary key, fall back to phone
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }
  if (normalizedPhone) {
    return `phone:${normalizedPhone}`;
  }

  // Use name as stable fallback (instead of random ID)
  const normalizedName = [firstName, lastName].filter(Boolean).join(' ').toLowerCase().trim();
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  // Last resort: empty contact (shouldn't happen in practice)
  return 'unknown:empty';
}

/**
 * Aggregates contacts from all event requests
 * Deduplicates by email/phone and tracks which events each contact is associated with
 */
async function aggregateEventContacts(): Promise<{
  contacts: EventContact[];
  contactEventsMap: Map<string, EventContactEvent[]>;
}> {
  const eventRequests = await storage.getAllEventRequests();

  // Map to track contacts and their events
  const contactMap = new Map<string, {
    contact: Omit<EventContact, 'id'> & { id: string };
    events: EventContactEvent[];
  }>();

  for (const event of eventRequests) {
    const eventDate = event.scheduledEventDate
      ? new Date(event.scheduledEventDate).toISOString()
      : null;

    const sandwichCount = event.actualSandwichCount ?? event.estimatedSandwichCount ?? 0;

    // Process primary contact
    if (event.firstName || event.lastName || event.email || event.phone) {
      const key = getContactKey(event.email, event.phone, event.firstName, event.lastName);

      if (!contactMap.has(key)) {
        contactMap.set(key, {
          contact: {
            id: key,
            firstName: event.firstName || '',
            lastName: event.lastName || '',
            fullName: [event.firstName, event.lastName].filter(Boolean).join(' ') || 'Unknown',
            email: event.email || null,
            phone: event.phone || null,
            contactRoles: ['primary'],
            totalEvents: 0,
            completedEvents: 0,
            hasOnlyIncompleteEvents: false,
            organizations: [],
            organizationCategories: [],
            lastEventDate: null,
            firstEventDate: null,
          },
          events: [],
        });
      }

      const entry = contactMap.get(key)!;

      // Add primary role if not already present
      if (!entry.contact.contactRoles.includes('primary')) {
        entry.contact.contactRoles.push('primary');
      }

      // Update stats
      entry.contact.totalEvents++;
      if (event.status === 'completed') {
        entry.contact.completedEvents++;
      }

      // Update organization list
      if (event.organizationName && !entry.contact.organizations.includes(event.organizationName)) {
        entry.contact.organizations.push(event.organizationName);
      }

      // Update organization categories
      if (event.organizationCategory && !entry.contact.organizationCategories.includes(event.organizationCategory)) {
        entry.contact.organizationCategories.push(event.organizationCategory);
      }

      // Update dates
      if (eventDate) {
        if (!entry.contact.lastEventDate || eventDate > entry.contact.lastEventDate) {
          entry.contact.lastEventDate = eventDate;
        }
        if (!entry.contact.firstEventDate || eventDate < entry.contact.firstEventDate) {
          entry.contact.firstEventDate = eventDate;
        }
      }

      // Add event to history
      entry.events.push({
        eventId: event.id,
        organizationName: event.organizationName || 'Unknown Organization',
        scheduledEventDate: eventDate,
        eventAddress: event.eventAddress || null,
        status: event.status || 'new',
        sandwichCount,
        contactRole: 'primary',
      });
    }

    // Process backup contact
    if (event.backupContactFirstName || event.backupContactLastName || event.backupContactEmail || event.backupContactPhone) {
      const key = getContactKey(event.backupContactEmail, event.backupContactPhone, event.backupContactFirstName, event.backupContactLastName);

      if (!contactMap.has(key)) {
        contactMap.set(key, {
          contact: {
            id: key,
            firstName: event.backupContactFirstName || '',
            lastName: event.backupContactLastName || '',
            fullName: [event.backupContactFirstName, event.backupContactLastName].filter(Boolean).join(' ') || 'Unknown',
            email: event.backupContactEmail || null,
            phone: event.backupContactPhone || null,
            contactRoles: ['backup'],
            totalEvents: 0,
            completedEvents: 0,
            hasOnlyIncompleteEvents: false,
            organizations: [],
            organizationCategories: [],
            lastEventDate: null,
            firstEventDate: null,
          },
          events: [],
        });
      }

      const entry = contactMap.get(key)!;

      // Add backup role if not already present
      if (!entry.contact.contactRoles.includes('backup')) {
        entry.contact.contactRoles.push('backup');
      }

      // Update stats
      entry.contact.totalEvents++;
      if (event.status === 'completed') {
        entry.contact.completedEvents++;
      }

      // Update organization list
      if (event.organizationName && !entry.contact.organizations.includes(event.organizationName)) {
        entry.contact.organizations.push(event.organizationName);
      }

      // Update organization categories
      if (event.organizationCategory && !entry.contact.organizationCategories.includes(event.organizationCategory)) {
        entry.contact.organizationCategories.push(event.organizationCategory);
      }

      // Update dates
      if (eventDate) {
        if (!entry.contact.lastEventDate || eventDate > entry.contact.lastEventDate) {
          entry.contact.lastEventDate = eventDate;
        }
        if (!entry.contact.firstEventDate || eventDate < entry.contact.firstEventDate) {
          entry.contact.firstEventDate = eventDate;
        }
      }

      // Add event to history
      entry.events.push({
        eventId: event.id,
        organizationName: event.organizationName || 'Unknown Organization',
        scheduledEventDate: eventDate,
        eventAddress: event.eventAddress || null,
        status: event.status || 'new',
        sandwichCount,
        contactRole: 'backup',
      });
    }

    // Note: TSP contacts are not included in the Event Contacts Directory
    // They are managed through the User Management system instead
  }

  // Build final contacts list
  const contacts: EventContact[] = [];
  const contactEventsMap = new Map<string, EventContactEvent[]>();

  for (const [key, entry] of contactMap) {
    // Determine if contact has only incomplete events
    entry.contact.hasOnlyIncompleteEvents =
      entry.contact.completedEvents === 0 && entry.contact.totalEvents > 0;

    contacts.push(entry.contact);

    // Sort events by date (most recent first)
    entry.events.sort((a, b) => {
      if (!a.scheduledEventDate) return 1;
      if (!b.scheduledEventDate) return -1;
      return b.scheduledEventDate.localeCompare(a.scheduledEventDate);
    });

    contactEventsMap.set(key, entry.events);
  }

  // Sort contacts by total events (most active first)
  contacts.sort((a, b) => b.totalEvents - a.totalEvents);

  return { contacts, contactEventsMap };
}

// GET /api/event-contacts - Get all contacts from event requests (deduplicated)
router.get(
  '/',
  requirePermission(PERMISSIONS.EVENTS_VIEW),
  async (req, res) => {
    try {
      logger.log('[EVENT CONTACTS] Fetching all event contacts');

      const { contacts } = await aggregateEventContacts();

      logger.log(`[EVENT CONTACTS] Returning ${contacts.length} deduplicated contacts`);
      res.json(contacts);
    } catch (error) {
      logger.error('[EVENT CONTACTS] Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch event contacts' });
    }
  }
);

// GET /api/event-contacts/:id - Get a specific contact with their event history
router.get(
  '/:id',
  requirePermission(PERMISSIONS.EVENTS_VIEW),
  async (req, res) => {
    try {
      const { id } = req.params;
      const decodedId = decodeURIComponent(id);

      logger.log(`[EVENT CONTACTS] Fetching contact details for: ${decodedId}`);

      const { contacts, contactEventsMap } = await aggregateEventContacts();

      const contact = contacts.find(c => c.id === decodedId);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const events = contactEventsMap.get(decodedId) || [];

      const contactDetail: EventContactDetail = {
        ...contact,
        events,
      };

      logger.log(`[EVENT CONTACTS] Returning contact with ${events.length} events`);
      res.json(contactDetail);
    } catch (error) {
      logger.error('[EVENT CONTACTS] Error fetching contact details:', error);
      res.status(500).json({ error: 'Failed to fetch contact details' });
    }
  }
);

// PUT /api/event-contacts/:id - Update contact info across all associated events
router.put(
  '/:id',
  requirePermission(PERMISSIONS.EVENTS_EDIT),
  async (req, res) => {
    try {
      const { id } = req.params;
      const decodedId = decodeURIComponent(id);
      const { firstName, lastName, email, phone } = req.body;

      logger.log(`[EVENT CONTACTS] Updating contact: ${decodedId}`);

      // Get all event requests to find which ones have this contact
      const eventRequests = await storage.getAllEventRequests();

      let updatedCount = 0;

      for (const event of eventRequests) {
        // Check if primary contact matches
        const primaryKey = getContactKey(event.email, event.phone, event.firstName, event.lastName);
        if (primaryKey === decodedId) {
          await storage.updateEventRequest(event.id, {
            firstName: firstName ?? event.firstName,
            lastName: lastName ?? event.lastName,
            email: email ?? event.email,
            phone: phone ?? event.phone,
          });
          updatedCount++;
          continue;
        }

        // Check if backup contact matches
        const backupKey = getContactKey(event.backupContactEmail, event.backupContactPhone, event.backupContactFirstName, event.backupContactLastName);
        if (backupKey === decodedId) {
          await storage.updateEventRequest(event.id, {
            backupContactFirstName: firstName ?? event.backupContactFirstName,
            backupContactLastName: lastName ?? event.backupContactLastName,
            backupContactEmail: email ?? event.backupContactEmail,
            backupContactPhone: phone ?? event.backupContactPhone,
          });
          updatedCount++;
        }
      }

      if (updatedCount === 0) {
        return res.status(404).json({ error: 'Contact not found in any events' });
      }

      logger.log(`[EVENT CONTACTS] Updated contact info in ${updatedCount} events`);
      res.json({ success: true, updatedCount });
    } catch (error) {
      logger.error('[EVENT CONTACTS] Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  }
);

// GET /api/event-contacts/search - Search contacts by name, email, or phone
router.get(
  '/search',
  requirePermission(PERMISSIONS.EVENTS_VIEW),
  async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query (q) is required' });
      }

      const searchTerm = q.toLowerCase().trim();
      logger.log(`[EVENT CONTACTS] Searching for: ${searchTerm}`);

      const { contacts } = await aggregateEventContacts();

      const filtered = contacts.filter(contact =>
        contact.fullName.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.phone?.includes(searchTerm) ||
        contact.organizations.some(org => org.toLowerCase().includes(searchTerm))
      );

      logger.log(`[EVENT CONTACTS] Search returned ${filtered.length} results`);
      res.json(filtered);
    } catch (error) {
      logger.error('[EVENT CONTACTS] Error searching contacts:', error);
      res.status(500).json({ error: 'Failed to search contacts' });
    }
  }
);

export function createEventContactsRouter() {
  return router;
}

export default router;
