import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { sanitizeMiddleware } from '../middleware/sanitizer';
import { insertHostSchema, insertHostContactSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { scrapeHostAvailability } from '../services/host-availability-scraper';
import {
  hostsErrorHandler,
  asyncHandler,
  createHostsError,
  validateId,
  validateRequired,
  HostsError,
} from './hosts/error-handler';
import { z } from 'zod';
import { AuditLogger } from '../audit-logger';
import { logger } from '../utils/production-safe-logger';
import { geocodeAddress } from '../utils/geocoding';

// Normalize freeform contact role values to standardized ones
// Must match the client-side normalizeContactRole function
function normalizeContactRole(raw: string | null | undefined): string {
  if (!raw) return 'host';
  const lower = raw.toLowerCase().trim();
  if (lower === 'lead') return 'lead';
  if (lower === 'primary' || lower === 'primary contact') return 'primary';
  if (lower === 'alternate' || lower === 'alternate contact') return 'alternate';
  if (lower === 'volunteer') return 'volunteer';
  if (lower.includes('host')) return 'host';
  return 'host';
}

export function createHostsRouter(deps: RouterDependencies) {
  const router = Router();
  const { storage, requirePermission } = deps;

  // Validation schema for coordinate updates
  const coordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  });

  // Host management routes
  router.get('/hosts', 
  requirePermission(PERMISSIONS.HOSTS_VIEW), 
  asyncHandler(async (req, res) => {
    const hosts = await storage.getAllHosts();
    res.json(hosts);
  })
);

  router.get(
  '/hosts-with-contacts',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostsWithContacts = await storage.getAllHostsWithContacts();
    res.json(hostsWithContacts);
  })
);

// Map endpoint - get host contacts with valid coordinates for map display
  // Falls back to host-level coordinates when a host has no geocoded contacts
  router.get(
  '/hosts/map',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostsWithContacts = await storage.getAllHostsWithContacts();

    // Show all hosts visible on the host management page (everything except 'hidden')
    const mapData = hostsWithContacts
      .filter(host => host.status !== 'hidden')
      .flatMap(host => {
        // Get contacts that have valid coordinates
        const geocodedContacts = host.contacts
          .filter(contact =>
            contact.latitude !== null &&
            contact.longitude !== null
          )
          .map(contact => ({
            id: contact.id,
            contactName: contact.name,
            role: contact.role,
            hostLocationName: host.name,
            address: contact.address,
            latitude: contact.latitude,
            longitude: contact.longitude,
            email: contact.email,
            phone: contact.phone,
          }));

        // If no contacts have coordinates, fall back to the host's own coordinates
        // This ensures newly added hosts show up on the map immediately after geocoding
        if (geocodedContacts.length === 0 && host.latitude && host.longitude) {
          return [{
            id: host.id * -1, // Negative ID to distinguish host-level pins from contact pins
            contactName: host.name,
            role: 'Host Location',
            hostLocationName: host.name,
            address: host.address,
            latitude: host.latitude,
            longitude: host.longitude,
            email: host.email || null,
            phone: host.phone || null,
          }];
        }

        return geocodedContacts;
      });

    res.json(mapData);
  })
);

// Bulk geocode all hosts and contacts that have addresses but no coordinates
  // This backfills existing records that were created before auto-geocoding was added
  // Pass ?force=true to re-geocode ALL records, even those that already have coordinates
  router.post(
  '/hosts/geocode-all',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req, res) => {
    const force = req.query.force === 'true';
    const allHosts = await storage.getAllHosts();
    const allHostsWithContacts = await storage.getAllHostsWithContacts();

    // Find hosts with address but no coordinates (or all with addresses if force)
    const hostsToGeocode = allHosts.filter(
      (h) => h.address && h.address.trim() !== '' && (force || !h.latitude || !h.longitude)
    );

    // Find contacts with address but no coordinates (or all with addresses if force)
    const contactsToGeocode = allHostsWithContacts.flatMap((host) =>
      host.contacts.filter(
        (c) => c.address && c.address.trim() !== '' && (force || !c.latitude || !c.longitude)
      )
    );

    const totalToProcess = hostsToGeocode.length + contactsToGeocode.length;

    if (totalToProcess === 0) {
      res.json({
        message: 'All hosts and contacts with addresses already have coordinates',
        hostsProcessed: 0,
        contactsProcessed: 0,
      });
      return;
    }

    // Return immediately, geocode in background
    res.json({
      message: `Geocoding ${hostsToGeocode.length} hosts and ${contactsToGeocode.length} contacts in background`,
      hostsProcessed: hostsToGeocode.length,
      contactsProcessed: contactsToGeocode.length,
    });

    // Background geocoding for hosts
    (async () => {
      let hostsSuccess = 0;
      let hostsFailed = 0;

      for (const host of hostsToGeocode) {
        try {
          const coords = await geocodeAddress(host.address!);
          if (coords) {
            await storage.updateHost(host.id, {
              latitude: coords.latitude,
              longitude: coords.longitude,
              geocodedAt: new Date(),
            });
            hostsSuccess++;
            logger.info(`✅ Bulk geocoded host ${host.id}: ${host.address}`);
          } else {
            hostsFailed++;
            logger.warn(`⚠️ Bulk geocode returned no results for host ${host.id}: ${host.address}`);
          }
          // Rate limit between requests
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch (err) {
          hostsFailed++;
          logger.error(`Failed to bulk geocode host ${host.id}:`, err);
        }
      }

      // Background geocoding for contacts
      let contactsSuccess = 0;
      let contactsFailed = 0;

      for (const contact of contactsToGeocode) {
        try {
          const coords = await geocodeAddress(contact.address!);
          if (coords) {
            await storage.updateHostContact(contact.id, {
              latitude: coords.latitude,
              longitude: coords.longitude,
            });
            contactsSuccess++;
            logger.info(`✅ Bulk geocoded host contact ${contact.id}: ${contact.address}`);
          } else {
            contactsFailed++;
            logger.warn(`⚠️ Bulk geocode returned no results for contact ${contact.id}: ${contact.address}`);
          }
          // Rate limit between requests
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch (err) {
          contactsFailed++;
          logger.error(`Failed to bulk geocode host contact ${contact.id}:`, err);
        }
      }

      logger.info(`🗺️ Bulk geocode complete: ${hostsSuccess}/${hostsToGeocode.length} hosts, ${contactsSuccess}/${contactsToGeocode.length} contacts`);
    })();
  })
);

  router.get(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host');
    const host = await storage.getHost(id);
    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }
    res.json(host);
  })
);

  router.post(
  '/hosts',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    validateRequired(req.body, ['name'], 'host creation');

    const result = insertHostSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid host data provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    let host = await storage.createHost(result.data);

    // Audit log
    await AuditLogger.logCreate(
      'hosts',
      String(host.id),
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    // Auto-geocode address SYNCHRONOUSLY so coordinates are set before response
    if (result.data.address) {
      try {
        const coords = await geocodeAddress(result.data.address);
        if (coords) {
          const updated = await storage.updateHost(host.id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            geocodedAt: new Date(),
          });
          if (updated) {
            host = updated;
          }
          logger.info(`✅ Geocoded new host ${host.id}: ${result.data.address}`);
        } else {
          logger.warn(`⚠️ Geocoding returned no results for new host ${host.id}: ${result.data.address}`);
        }
      } catch (err) {
        logger.error(`Failed to geocode host ${host.id}:`, err);
      }
    }

    res.status(201).json(host);
  })
);

  router.patch(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }

    // Get old data before update
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    const host = await storage.updateHost(id, updates);
    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'hosts',
      String(id),
      oldHost,
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    // Re-geocode synchronously if address changed
    const addressChanged = updates.address && updates.address !== oldHost.address;
    let finalHost = host;
    if (addressChanged) {
      try {
        const coords = await geocodeAddress(updates.address);
        if (coords) {
          const updated = await storage.updateHost(id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            geocodedAt: new Date(),
          });
          if (updated) {
            finalHost = updated;
          }
          logger.info(`✅ Re-geocoded host ${id}: ${updates.address}`);
        } else {
          logger.warn(`⚠️ Geocoding returned no results for host ${id}: ${updates.address}`);
        }
      } catch (err) {
        logger.error(`Failed to re-geocode host ${id}:`, err);
      }
    }

    res.json(finalHost);
  })
);

// Update host coordinates endpoint
  router.patch(
  '/hosts/:id/coordinates',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');

    // Validate coordinates using Zod schema
    const result = coordinatesSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid coordinates provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    const { latitude, longitude } = result.data;

    // Get old data before update
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Update host with new coordinates and set geocodedAt timestamp
    const host = await storage.updateHost(id, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      geocodedAt: new Date(),
    });

    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'hosts',
      String(id),
      oldHost,
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.json(host);
  })
);

  router.delete(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');

    // Get old data before delete
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    try {
      const success = await storage.deleteHost(id);
      if (!success) {
        throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
      }

      // Audit log
      await AuditLogger.logDelete(
        'hosts',
        String(id),
        oldHost,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error: unknown) {
      // Check if it's a constraint error (has associated records)
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as any).message === 'string' &&
        (error as any).message.includes('associated collection')
      ) {
        throw createHostsError(
          (error as any).message,
          409,
          'CONSTRAINT_VIOLATION',
          { hostId: id, constraintType: 'associated_records' }
        );
      }
      throw error; // Re-throw to be handled by error handler
    }
  })
);

// Host contact routes
  router.get(
  '/host-contacts',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostId = req.query.hostId
      ? parseInt(req.query.hostId as string)
      : undefined;
      
    if (hostId && isNaN(hostId)) {
      throw createHostsError('Invalid host ID in query', 400, 'INVALID_HOST_ID', { providedHostId: req.query.hostId });
    }
    
    if (hostId) {
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } else {
      // Return all host contacts with their host location name
      const hosts = await storage.getAllHostsWithContacts();
      const allContacts = hosts.flatMap((host) => 
        host.contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          hostLocationName: host.name,
          displayName: `${contact.name} (${host.name})`,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          hostId: contact.hostId,
        }))
      );
      res.json(allContacts);
    }
  })
);

  router.post(
  '/host-contacts',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    validateRequired(req.body, ['name', 'role', 'phone', 'hostId'], 'host contact creation');

    // Normalize role before validation
    if (req.body.role) {
      req.body.role = normalizeContactRole(req.body.role);
    }

    const result = insertHostContactSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid host contact data provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    const contact = await storage.createHostContact(result.data);

    // Audit log
    await AuditLogger.logCreate(
      'host_contacts',
      String(contact.id),
      contact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    // Auto-geocode contact address SYNCHRONOUSLY so coordinates are set before response
    let finalContact = contact;
    if (result.data.address) {
      try {
        const coords = await geocodeAddress(result.data.address);
        if (coords) {
          const updated = await storage.updateHostContact(contact.id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          if (updated) {
            finalContact = updated;
          }
          logger.info(`✅ Geocoded new host contact ${contact.id}: ${result.data.address}`);

          // Also backfill the parent host's address and coordinates if it doesn't have any.
          // This happens when hosts are auto-created for new areas (they get no address).
          if (result.data.hostId) {
            try {
              const parentHost = await storage.getHost(result.data.hostId);
              if (parentHost && !parentHost.address) {
                await storage.updateHost(parentHost.id, {
                  address: result.data.address,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  geocodedAt: new Date(),
                });
                logger.info(`✅ Backfilled host ${parentHost.id} address from contact ${contact.id}`);
              } else if (parentHost && (!parentHost.latitude || !parentHost.longitude)) {
                // Host has address but no coordinates — geocode using contact's coords
                await storage.updateHost(parentHost.id, {
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  geocodedAt: new Date(),
                });
                logger.info(`✅ Backfilled host ${parentHost.id} coordinates from contact ${contact.id}`);
              }
            } catch (backfillErr) {
              logger.error(`Failed to backfill host from contact ${contact.id}:`, backfillErr);
            }
          }
        } else {
          logger.warn(`⚠️ Geocoding returned no results for contact ${contact.id}: ${result.data.address}`);
        }
      } catch (err) {
        logger.error(`Failed to geocode host contact ${contact.id}:`, err);
      }
    }

    res.status(201).json(finalContact);
  })
);

  router.patch(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host contact');
    const updates = req.body;

    // Normalize role on update
    if (updates.role) {
      updates.role = normalizeContactRole(updates.role);
    }

    logger.info(`Updating host contact ${id} with data:`, updates);

    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }

    // Get old data before update
    const oldContact = await storage.getHostContact(id);
    if (!oldContact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    let contact;
    try {
      contact = await storage.updateHostContact(id, updates);
    } catch (dbError: any) {
      logger.error(`Database error updating host contact ${id}:`, {
        error: dbError,
        errorMessage: dbError.message,
        errorStack: dbError.stack,
        updates: updates,
        updateKeys: Object.keys(updates)
      });
      throw createHostsError(
        `Database error: ${dbError.message || 'Unknown database error'}`,
        500,
        'DATABASE_ERROR',
        { originalError: dbError.message, errorStack: dbError.stack, updates }
      );
    }

    if (!contact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'host_contacts',
      String(id),
      oldContact,
      contact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    // Re-geocode synchronously if address changed
    const addressChanged = updates.address && updates.address !== oldContact.address;
    let finalContact = contact;
    if (addressChanged) {
      try {
        const coords = await geocodeAddress(updates.address);
        if (coords) {
          const updated = await storage.updateHostContact(id, {
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          if (updated) {
            finalContact = updated;
          }
          logger.info(`✅ Re-geocoded host contact ${id}: ${updates.address}`);
        } else {
          logger.warn(`⚠️ Geocoding returned no results for contact ${id}: ${updates.address}`);
        }
      } catch (err) {
        logger.error(`Failed to re-geocode host contact ${id}:`, err);
      }
    }

    res.json(finalContact);
  })
);

  router.delete(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host contact');

    // Get old data before delete
    const oldContact = await storage.getHostContact(id);
    if (!oldContact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    const success = await storage.deleteHostContact(id);

    if (!success) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    // Audit log
    await AuditLogger.logDelete(
      'host_contacts',
      String(id),
      oldContact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.status(204).send();
  })
);

// Weekly availability scraper endpoint
  router.post(
  '/scrape-availability',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req, res) => {
    const result = await scrapeHostAvailability();

    if (result.success) {
      res.json({
        message: 'Host availability updated successfully',
        ...result,
      });
    } else {
      throw createHostsError(
        'Host availability scrape failed',
        500,
        'SCRAPE_FAILED',
        { scrapeResult: result }
      );
    }
  })
);

  // Add error handling middleware for all routes
  router.use(hostsErrorHandler());

  return router;
}

