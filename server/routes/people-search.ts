import { Router } from 'express';
import { db } from '../db';
import {
  users,
  drivers,
  volunteers,
  hosts,
  hostContacts,
  recipients,
  recipientTspContacts,
  contacts
} from '@shared/schema';
import { ilike, or, sql } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

const router = Router();

interface PersonSearchResult {
  id: number | string;
  name: string;
  email: string | null;
  phone: string | null;
  sourceType: 'user' | 'driver' | 'volunteer' | 'host' | 'hostContact' | 'recipient' | 'recipientTspContact' | 'contact';
  sourceLabel: string;
  organization?: string | null;
  role?: string | null;
  link: string;
}

/**
 * Unified people search across all contact databases
 * GET /api/people/search?q=searchTerm
 */
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length < 2) {
      return res.json({ results: [] });
    }

    const searchTerm = `%${query.trim()}%`;
    const results: PersonSearchResult[] = [];

    // Search users
    const userResults = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        displayName: users.displayName,
        email: users.email,
        phone: users.phoneNumber,
      })
      .from(users)
      .where(
        or(
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm),
          ilike(users.displayName, searchTerm),
          ilike(users.email, searchTerm),
          ilike(users.phoneNumber, searchTerm)
        )
      )
      .limit(10);

    for (const user of userResults) {
      const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
      results.push({
        id: user.id,
        name,
        email: user.email,
        phone: user.phone,
        sourceType: 'user',
        sourceLabel: 'Team Member',
        link: `/dashboard?section=users&user=${user.id}`,
      });
    }

    // Search drivers
    const driverResults = await db
      .select({
        id: drivers.id,
        name: drivers.name,
        email: drivers.email,
        phone: drivers.phone,
      })
      .from(drivers)
      .where(
        or(
          ilike(drivers.name, searchTerm),
          ilike(drivers.email, searchTerm),
          ilike(drivers.phone, searchTerm)
        )
      )
      .limit(10);

    for (const driver of driverResults) {
      results.push({
        id: driver.id,
        name: driver.name || 'Unknown Driver',
        email: driver.email,
        phone: driver.phone,
        sourceType: 'driver',
        sourceLabel: 'Driver',
        link: `/dashboard?section=drivers`,
      });
    }

    // Search volunteers
    const volunteerResults = await db
      .select({
        id: volunteers.id,
        name: volunteers.name,
        email: volunteers.email,
        phone: volunteers.phone,
      })
      .from(volunteers)
      .where(
        or(
          ilike(volunteers.name, searchTerm),
          ilike(volunteers.email, searchTerm),
          ilike(volunteers.phone, searchTerm)
        )
      )
      .limit(10);

    for (const volunteer of volunteerResults) {
      results.push({
        id: volunteer.id,
        name: volunteer.name || 'Unknown Volunteer',
        email: volunteer.email,
        phone: volunteer.phone,
        sourceType: 'volunteer',
        sourceLabel: 'Volunteer',
        link: `/dashboard?section=volunteers`,
      });
    }

    // Search hosts
    const hostResults = await db
      .select({
        id: hosts.id,
        name: hosts.name,
        email: hosts.email,
        phone: hosts.phone,
      })
      .from(hosts)
      .where(
        or(
          ilike(hosts.name, searchTerm),
          ilike(hosts.email, searchTerm),
          ilike(hosts.phone, searchTerm)
        )
      )
      .limit(10);

    for (const host of hostResults) {
      results.push({
        id: host.id,
        name: host.name || 'Unknown Host',
        email: host.email,
        phone: host.phone,
        sourceType: 'host',
        sourceLabel: 'Host',
        link: `/dashboard?section=hosts`,
      });
    }

    // Search host contacts
    const hostContactResults = await db
      .select({
        id: hostContacts.id,
        name: hostContacts.name,
        email: hostContacts.email,
        phone: hostContacts.phone,
        role: hostContacts.role,
        hostId: hostContacts.hostId,
      })
      .from(hostContacts)
      .where(
        or(
          ilike(hostContacts.name, searchTerm),
          ilike(hostContacts.email, searchTerm),
          ilike(hostContacts.phone, searchTerm)
        )
      )
      .limit(10);

    for (const contact of hostContactResults) {
      results.push({
        id: contact.id,
        name: contact.name || 'Unknown Contact',
        email: contact.email,
        phone: contact.phone,
        sourceType: 'hostContact',
        sourceLabel: 'Host Contact',
        role: contact.role,
        link: `/dashboard?section=hosts`,
      });
    }

    // Search recipients
    const recipientResults = await db
      .select({
        id: recipients.id,
        name: recipients.name,
        email: recipients.email,
        phone: recipients.phone,
        contactPerson1Name: recipients.contactPerson1Name,
        contactPerson1Email: recipients.contactPerson1Email,
        contactPerson1Phone: recipients.contactPerson1Phone,
        contactPerson2Name: recipients.contactPerson2Name,
        contactPerson2Email: recipients.contactPerson2Email,
        contactPerson2Phone: recipients.contactPerson2Phone,
      })
      .from(recipients)
      .where(
        or(
          ilike(recipients.name, searchTerm),
          ilike(recipients.email, searchTerm),
          ilike(recipients.phone, searchTerm),
          ilike(recipients.contactPerson1Name, searchTerm),
          ilike(recipients.contactPerson1Email, searchTerm),
          ilike(recipients.contactPerson2Name, searchTerm),
          ilike(recipients.contactPerson2Email, searchTerm)
        )
      )
      .limit(10);

    for (const recipient of recipientResults) {
      // Add main recipient
      results.push({
        id: recipient.id,
        name: recipient.name || 'Unknown Recipient',
        email: recipient.email,
        phone: recipient.phone,
        sourceType: 'recipient',
        sourceLabel: 'Recipient',
        link: `/dashboard?section=recipients`,
      });

      // Also check if we matched a contact person
      const searchLower = query.toLowerCase();
      if (recipient.contactPerson1Name?.toLowerCase().includes(searchLower) ||
          recipient.contactPerson1Email?.toLowerCase().includes(searchLower)) {
        results.push({
          id: `${recipient.id}-contact1`,
          name: recipient.contactPerson1Name || 'Contact 1',
          email: recipient.contactPerson1Email,
          phone: recipient.contactPerson1Phone,
          sourceType: 'recipient',
          sourceLabel: 'Recipient Contact',
          organization: recipient.name,
          link: `/dashboard?section=recipients`,
        });
      }
      if (recipient.contactPerson2Name?.toLowerCase().includes(searchLower) ||
          recipient.contactPerson2Email?.toLowerCase().includes(searchLower)) {
        results.push({
          id: `${recipient.id}-contact2`,
          name: recipient.contactPerson2Name || 'Contact 2',
          email: recipient.contactPerson2Email,
          phone: recipient.contactPerson2Phone,
          sourceType: 'recipient',
          sourceLabel: 'Recipient Contact',
          organization: recipient.name,
          link: `/dashboard?section=recipients`,
        });
      }
    }

    // Search recipient TSP contacts
    const tspContactResults = await db
      .select({
        id: recipientTspContacts.id,
        contactName: recipientTspContacts.contactName,
        contactEmail: recipientTspContacts.contactEmail,
        contactPhone: recipientTspContacts.contactPhone,
        recipientId: recipientTspContacts.recipientId,
      })
      .from(recipientTspContacts)
      .where(
        or(
          ilike(recipientTspContacts.contactName, searchTerm),
          ilike(recipientTspContacts.contactEmail, searchTerm),
          ilike(recipientTspContacts.contactPhone, searchTerm)
        )
      )
      .limit(10);

    for (const contact of tspContactResults) {
      results.push({
        id: contact.id,
        name: contact.contactName || 'Unknown TSP Contact',
        email: contact.contactEmail,
        phone: contact.contactPhone,
        sourceType: 'recipientTspContact',
        sourceLabel: 'TSP Contact',
        link: `/dashboard?section=recipients`,
      });
    }

    // Search contacts table
    const contactResults = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        phone: contacts.phone,
        organization: contacts.organization,
      })
      .from(contacts)
      .where(
        or(
          ilike(contacts.name, searchTerm),
          ilike(contacts.email, searchTerm),
          ilike(contacts.phone, searchTerm),
          ilike(contacts.organization, searchTerm)
        )
      )
      .limit(10);

    for (const contact of contactResults) {
      results.push({
        id: contact.id,
        name: contact.name || 'Unknown Contact',
        email: contact.email,
        phone: contact.phone,
        sourceType: 'contact',
        sourceLabel: 'Contact',
        organization: contact.organization,
        link: `/dashboard?section=contacts`,
      });
    }

    // Sort results: exact matches first, then partial matches
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query.toLowerCase();
      const bExact = b.name.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.name.localeCompare(b.name);
    });

    // Limit total results
    const limitedResults = results.slice(0, 25);

    res.json({ results: limitedResults });
  } catch (error) {
    logger.error('People search error:', error);
    res.status(500).json({ error: 'Failed to search people' });
  }
});

export default router;
