import express, { Request, Response } from 'express';
import { eq, desc, inArray, or, sql } from 'drizzle-orm';
import type { RouterDependencies } from '../types';
import type { AuthenticatedRequest } from '../types/express';
import { drivers, insertDriverSchema, type Driver, type DriverAgreement } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { AuditLogger } from '../audit-logger';
import { geocodeAddress } from '../utils/geocoding';
import { db } from '../db';
import { transformDriverForApi, createErrorResponse } from '@shared/types';
import { RATE_LIMITS, normalizeAddressForGeocoding } from '../config/constants';

// Get driver's address for geocoding - only use actual addresses, not zone/area guesses
// Checks both 'address' (UI field) and 'homeAddress' (legacy field)
function getDriverAddressForGeocoding(driver: Driver): string | null {
  // Check both address fields - UI uses 'address', some data may have 'homeAddress'
  const address = (driver.address?.trim()) || (driver.homeAddress?.trim());
  if (!address) return null;

  // Use centralized address normalization for consistent geocoding
  return normalizeAddressForGeocoding(address);
}

// Check if driver has an address (for filtering)
function driverHasAddress(driver: Driver): boolean {
  return !!(driver.address?.trim() || driver.homeAddress?.trim());
}

// Rate limits by geocoding service - use centralized config
const SERVICE_RATE_LIMITS = {
  google: RATE_LIMITS.GOOGLE_GEOCODING,
  openstreetmap: RATE_LIMITS.OPENSTREETMAP,
};

export function createDriversRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Get all drivers
  router.get('/', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const allDrivers = await storage.getAllDrivers();
      // Transform drivers to use canonical field names (isSpeaker instead of willingToSpeak)
      const transformedDrivers = allDrivers.map((d) => transformDriverForApi(d));
      res.json(transformedDrivers);
    } catch (error) {
      logger.error('Failed to get drivers', error);
      res.status(500).json(createErrorResponse('Failed to get drivers', 'INTERNAL_ERROR'));
    }
  });

  // Unified driver candidates: drivers + host contacts + volunteers flagged as drivers
  router.get('/driver-candidates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const [allDrivers, hostsWithContacts, volunteers] = await Promise.all([
        storage.getAllDrivers(),
        storage.getAllHostsWithContacts(),
        storage.getAllVolunteers?.(),
      ]);

      // Only include drivers with an address AND geocoded coordinates
      // This ensures we're showing actual address-based locations, not zone/area guesses
      const driverCandidates = (allDrivers || [])
        .filter((d: any) => d.isActive && (d.address?.trim() || d.homeAddress?.trim()) && d.latitude && d.longitude)
        .map((d: any) => ({
          id: `driver-${d.id}`,
          driverId: d.id,
          source: 'driver' as const,
          name: d.name,
          email: d.email,
          phone: d.phone,
          latitude: String(d.latitude),
          longitude: String(d.longitude),
          availability: d.availability,
          vehicleType: d.vehicleType,
          vanApproved: d.vanApproved,
          homeAddress: d.address || d.homeAddress, // Return whichever address field is set
        }));

      const hostCandidates = (hostsWithContacts || [])
        .filter((host: any) => host.status === 'active')
        .flatMap((host: any) =>
          (host.contacts || [])
            .filter((contact: any) => contact.latitude && contact.longitude)
            .map((contact: any) => ({
              id: `host-${contact.id}`,
              source: 'host' as const,
              name: contact.name || contact.contactName,
              email: contact.email,
              phone: contact.phone,
              latitude: String(contact.latitude),
              longitude: String(contact.longitude),
              availability: contact.weeklyActive ? 'available' : 'unknown',
              hostLocation: host.name || contact.hostLocationName,
            }))
        );

      const volunteerCandidates = (volunteers || [])
        .filter((v: any) => v.isActive && v.isDriver && v.latitude && v.longitude)
        .map((v: any) => ({
          id: `volunteer-${v.id}`,
          source: 'volunteer' as const,
          name: v.name,
          email: v.email,
          phone: v.phone,
          latitude: String(v.latitude),
          longitude: String(v.longitude),
          availability: v.availability,
          vehicleType: v.vehicleType,
          vanApproved: v.vanApproved,
          hostLocation: v.hostLocation || v.routeDescription || v.zone,
        }));

      res.json([...driverCandidates, ...hostCandidates, ...volunteerCandidates]);
    } catch (error) {
      logger.error('Failed to get driver candidates', error);
      res.status(500).json({ message: 'Failed to get driver candidates' });
    }
  });

  // Export drivers as CSV - MUST come before /:id route
  router.get('/export', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const drivers = await storage.getAllDrivers();

      // Query driver agreements directly from database
      // Strategy: Get agreements for exported drivers only to ensure completeness
      const { db } = await import('../db');
      const { driverAgreements } = await import('@shared/schema');
      
      // Get emails of all drivers and pre-compute lowercase versions
      const driverEmails = drivers
        .map(d => d.email)
        .filter((email): email is string => !!email && email.trim() !== '');
      
      const lowerCaseEmails = driverEmails.map(e => e.toLowerCase());
      
      // Query agreements filtered to exported drivers using case-insensitive matching
      // Handle large lists by chunking if needed (PostgreSQL limit ~32767 parameters)
      let agreements: DriverAgreement[] = [];
      
      if (lowerCaseEmails.length > 0) {
        const CHUNK_SIZE = 1000; // Safe chunk size for inArray queries
        
        if (lowerCaseEmails.length <= CHUNK_SIZE) {
          // Single query for smaller lists
          agreements = await db.select()
            .from(driverAgreements)
            .where(sql`LOWER(${driverAgreements.email}) IN (${sql.join(lowerCaseEmails.map(e => sql`${e}`), sql`, `)})`)
            .orderBy(desc(driverAgreements.submittedAt));
        } else {
          // Chunk for larger lists
          for (let i = 0; i < lowerCaseEmails.length; i += CHUNK_SIZE) {
            const chunk = lowerCaseEmails.slice(i, i + CHUNK_SIZE);
            const chunkResults = await db.select()
              .from(driverAgreements)
              .where(sql`LOWER(${driverAgreements.email}) IN (${sql.join(chunk.map(e => sql`${e}`), sql`, `)})`)
              .orderBy(desc(driverAgreements.submittedAt));
            agreements.push(...chunkResults);
          }
        }
      }
      
      // Log if we're processing a large number of agreements
      if (agreements.length > 0) {
        logger.info(`Exporting ${drivers.length} drivers with ${agreements.length} agreements`);
      }

      // Create a map of driver agreements by email for quick lookup
      const agreementsByEmail = new Map();
      agreements.forEach(agreement => {
        agreementsByEmail.set(agreement.email.toLowerCase(), agreement);
      });

      // CSV headers - all the fields requested
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Agreement Signed',
        'Agreement Signed Date',
        'Van Driver Approved',
        'Van Driver Willing',
        'Driver Location',
        'Is Active',
        'License Number',
        'Availability',
        'Zone',
        'Route Description',
        'Availability Notes',
        'Email Agreement Sent',
        'Notes',
        'Created At'
      ];

      // Convert drivers to CSV rows
      const rows = drivers.map(driver => {
        const driverEmail = (driver.email || '').toLowerCase();
        const agreement = agreementsByEmail.get(driverEmail);

        return [
          driver.id,
          driver.name || '',
          driver.email || '',
          driver.phone || '',
          driver.emailAgreementSent ? 'Yes' : 'No',
          agreement?.submittedAt ? new Date(agreement.submittedAt).toISOString().split('T')[0] : '',
          driver.vanApproved ? 'Yes' : 'No',
          driver.vehicleType === 'van' ? 'Yes' : 'No',
          driver.hostLocation || driver.area || '',
          driver.isActive ? 'Active' : 'Inactive',
          driver.licenseNumber || '',
          driver.availability || '',
          driver.zone || '',
          driver.routeDescription || '',
          driver.availabilityNotes || '',
          driver.emailAgreementSent ? 'Yes' : 'No',
          driver.notes || '',
          driver.createdAt ? new Date(driver.createdAt).toISOString().split('T')[0] : ''
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma or quote
          const cellStr = String(cell).replace(/"/g, '""');
          return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
            ? `"${cellStr}"`
            : cellStr;
        }).join(','))
      ].join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="drivers-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      logger.error('Failed to export drivers', error);
      res.status(500).json({ message: 'Failed to export drivers' });
    }
  });

  // Get driver by ID
  router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      res.json(driver);
    } catch (error) {
      logger.error('Failed to get driver', error);
      res.status(500).json({ message: 'Failed to get driver' });
    }
  });

  // Create new driver
  router.post('/', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Convert date strings to Date objects for timestamp fields
      const createData = { ...req.body };

      // Handle all timestamp fields consistently
      const timestampFields = ['unavailableUntil', 'unavailableStartDate', 'checkInDate'];
      timestampFields.forEach(field => {
        if (createData[field] && typeof createData[field] === 'string') {
          createData[field] = new Date(createData[field]);
        }
        if (createData[field] === '') {
          createData[field] = null;
        }
      });

      const validatedData = insertDriverSchema.parse(createData);
      const driver = await storage.createDriver(validatedData);

      // Audit log
      const authReq = req as AuthenticatedRequest;
      await AuditLogger.logCreate(
        'drivers',
        String(driver.id),
        driver,
        {
          userId: authReq.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(driver);
    } catch (error) {
      logger.error('Failed to create driver', error);
      res.status(500).json({ message: 'Failed to create driver' });
    }
  });

  // Update driver (PUT)
  router.put('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Convert date strings to Date objects for timestamp fields
      const updateData = { ...req.body };

      // Remove read-only fields that shouldn't be updated
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.geocodedAt;

      // CRITICAL: Preserve address and geocoding data when not explicitly provided
      // This prevents partial updates from wiping out addresses
      const preserveFields = ['address', 'homeAddress', 'latitude', 'longitude'];
      preserveFields.forEach(field => {
        // Only delete if undefined or empty string (not if explicitly set to a value)
        if (updateData[field] === undefined || updateData[field] === '') {
          delete updateData[field];
        }
      });

      // Handle timestamp fields that can be updated
      const timestampFields = ['unavailableUntil'];
      timestampFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string') {
          updateData[field] = new Date(updateData[field]);
        }
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });

      const driver = await storage.updateDriver(id, updateData);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'drivers',
        String(id),
        oldDriver,
        driver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(driver);
    } catch (error) {
      logger.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Update driver (PATCH)
  router.patch('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Convert date strings to Date objects for timestamp fields
      const updateData = { ...req.body };

      // Remove read-only fields that shouldn't be updated
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.geocodedAt;

      // CRITICAL: Preserve address and geocoding data when not explicitly provided
      // This prevents partial updates from wiping out addresses
      const preserveFields = ['address', 'homeAddress', 'latitude', 'longitude'];
      preserveFields.forEach(field => {
        // Only delete if undefined or empty string (not if explicitly set to a value)
        if (updateData[field] === undefined || updateData[field] === '') {
          delete updateData[field];
        }
      });

      // Handle timestamp fields that can be updated
      const timestampFields = ['unavailableUntil'];
      timestampFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string') {
          updateData[field] = new Date(updateData[field]);
        }
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });

      const driver = await storage.updateDriver(id, updateData);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'drivers',
        String(id),
        oldDriver,
        driver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(driver);
    } catch (error) {
      logger.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Delete driver
  router.delete('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before delete
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      const deleted = await storage.deleteDriver(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'drivers',
        String(id),
        oldDriver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete driver', error);
      res.status(500).json({ message: 'Failed to delete driver' });
    }
  });

  // Clear coordinates for drivers without a home address (removes old guess-based geocoding)
  router.post('/clear-guessed-coordinates', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allDrivers = await storage.getAllDrivers();

      // Find drivers with coordinates but no address (these were geocoded from zones/areas)
      const driversToReset = allDrivers.filter(d =>
        (d.latitude || d.longitude) && !driverHasAddress(d)
      );

      if (driversToReset.length === 0) {
        return res.json({
          message: 'No drivers with guessed coordinates found',
          total: allDrivers.length,
        });
      }

      // Clear coordinates for these drivers
      for (const driver of driversToReset) {
        await db.update(drivers)
          .set({
            latitude: null,
            longitude: null,
            geocodedAt: null,
          })
          .where(eq(drivers.id, driver.id));
      }

      logger.info('Cleared guessed coordinates', {
        count: driversToReset.length,
        driverNames: driversToReset.map(d => d.name),
      });

      res.json({
        message: `Cleared coordinates for ${driversToReset.length} drivers without home addresses`,
        cleared: driversToReset.length,
        driversCleared: driversToReset.map(d => ({ id: d.id, name: d.name })),
      });
    } catch (error) {
      logger.error('Failed to clear guessed coordinates', error);
      res.status(500).json({ message: 'Failed to clear guessed coordinates' });
    }
  });

  // Reset ALL coordinates and re-geocode from home addresses only
  // Use this to migrate from old guess-based geocoding to address-based
  router.post('/reset-and-geocode', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allDrivers = await storage.getAllDrivers();

      // Step 1: Clear ALL coordinates
      const driversWithCoords = allDrivers.filter(d => d.latitude || d.longitude);
      for (const driver of driversWithCoords) {
        await db.update(drivers)
          .set({
            latitude: null,
            longitude: null,
            geocodedAt: null,
          })
          .where(eq(drivers.id, driver.id));
      }

      logger.info('Cleared all driver coordinates for re-geocoding', {
        count: driversWithCoords.length,
      });

      // Step 2: Geocode only drivers with addresses
      const driversWithAddress = allDrivers.filter(d => driverHasAddress(d));

      if (driversWithAddress.length === 0) {
        return res.json({
          message: 'Cleared all coordinates but no drivers have addresses to geocode',
          cleared: driversWithCoords.length,
          success: 0,
          failed: 0,
          withoutAddress: allDrivers.length,
        });
      }

      const results = {
        cleared: driversWithCoords.length,
        success: 0,
        failed: 0,
        total: driversWithAddress.length,
        failures: [] as Array<{ driverId: number; name: string; address: string }>,
      };

      // Geocode each driver with adaptive rate limiting
      let lastSource: 'google' | 'openstreetmap' = 'google';
      for (let i = 0; i < driversWithAddress.length; i++) {
        const driver = driversWithAddress[i];

        // Rate limit based on which service was used last
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, SERVICE_RATE_LIMITS[lastSource]));
        }

        const address = getDriverAddressForGeocoding(driver);
        if (!address) continue;

        const geocodeResult = await geocodeAddress(address);

        // Track which service was last attempted for rate limiting
        // If null, OpenStreetMap was last attempted (as fallback)
        lastSource = geocodeResult ? geocodeResult.source : 'openstreetmap';

        if (geocodeResult) {
          await db.update(drivers)
            .set({
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              geocodedAt: new Date(),
            })
            .where(eq(drivers.id, driver.id));

          results.success++;
          logger.info('Re-geocoded driver from home address', {
            driverId: driver.id,
            name: driver.name,
            address,
            source: geocodeResult.source,
          });
        } else {
          results.failed++;
          results.failures.push({
            driverId: driver.id,
            name: driver.name || 'Unknown',
            address,
          });
        }
      }

      res.json(results);
    } catch (error) {
      logger.error('Reset and geocode failed', error);
      res.status(500).json({ message: 'Reset and geocode failed' });
    }
  });

  // Batch geocode drivers that have a home address but no coordinates
  // Only uses actual addresses, not zone/area guesses
  router.post('/batch-geocode', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allDrivers = await storage.getAllDrivers();

      // Build the list of drivers with a home address that need geocoding
      const driversToGeocode = allDrivers
        .map((driver) => ({
          driver,
          address: getDriverAddressForGeocoding(driver),
        }))
        .filter(
          (item): item is { driver: Driver; address: string } =>
            Boolean(item.address) && (!item.driver.latitude || !item.driver.longitude)
        );

      // Count drivers with addresses vs without
      const driversWithAddress = allDrivers.filter(d => driverHasAddress(d));
      const driversWithCoords = allDrivers.filter(d => d.latitude && d.longitude && driverHasAddress(d));

      if (driversToGeocode.length === 0) {
        return res.json({
          message: 'No drivers need geocoding',
          success: 0,
          failed: 0,
          total: allDrivers.length,
          withAddress: driversWithAddress.length,
          alreadyGeocoded: driversWithCoords.length,
          withoutAddress: allDrivers.length - driversWithAddress.length,
        });
      }

      logger.info('Starting batch geocoding (address-based only)', {
        count: driversToGeocode.length
      });

      const results = {
        success: 0,
        failed: 0,
        total: driversToGeocode.length,
        failures: [] as Array<{
          driverId: number;
          name: string;
          address: string;
        }>,
      };

      // Geocode each driver with adaptive rate limiting
      let lastSource: 'google' | 'openstreetmap' = 'google';
      for (let i = 0; i < driversToGeocode.length; i++) {
        const { driver, address } = driversToGeocode[i];

        // Rate limit based on which service was used last
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, SERVICE_RATE_LIMITS[lastSource]));
        }

        const geocodeResult = await geocodeAddress(address);

        // Track which service was last attempted for rate limiting
        // If null, OpenStreetMap was last attempted (as fallback)
        lastSource = geocodeResult ? geocodeResult.source : 'openstreetmap';

        if (geocodeResult) {
          // Update driver with coordinates
          await db.update(drivers)
            .set({
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              geocodedAt: new Date(),
            })
            .where(eq(drivers.id, driver.id));

          results.success++;
          logger.info('Geocoded driver from home address', {
            driverId: driver.id,
            name: driver.name,
            address,
            source: geocodeResult.source,
          });
        } else {
          results.failed++;
          results.failures.push({
            driverId: driver.id,
            name: driver.name || 'Unknown',
            address,
          });
          logger.warn('Failed to geocode driver address', {
            driverId: driver.id,
            name: driver.name,
            address,
          });
        }
      }

      res.json(results);
    } catch (error) {
      logger.error('Batch geocoding failed', error);
      res.status(500).json({ message: 'Batch geocoding failed' });
    }
  });

  // === Driver Vehicles Routes ===

  // Get all vehicles for a driver
  router.get('/:driverId/vehicles', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const vehicles = await storage.getDriverVehicles(driverId);
      res.json(vehicles);
    } catch (error) {
      logger.error('Failed to get driver vehicles', error);
      res.status(500).json({ message: 'Failed to get driver vehicles' });
    }
  });

  // Create a new vehicle for a driver
  router.post('/:driverId/vehicles', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const vehicleData = { ...req.body, driverId };
      const vehicle = await storage.createDriverVehicle(vehicleData);

      // Audit log
      await AuditLogger.logCreate(
        'driver_vehicles',
        String(vehicle.id),
        vehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(vehicle);
    } catch (error) {
      logger.error('Failed to create driver vehicle', error);
      res.status(500).json({ message: 'Failed to create driver vehicle' });
    }
  });

  // Update a vehicle
  router.put('/vehicles/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const oldVehicle = await storage.getDriverVehicle(id);
      if (!oldVehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      const vehicle = await storage.updateDriverVehicle(id, req.body);
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'driver_vehicles',
        String(id),
        oldVehicle,
        vehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(vehicle);
    } catch (error) {
      logger.error('Failed to update driver vehicle', error);
      res.status(500).json({ message: 'Failed to update driver vehicle' });
    }
  });

  // Delete a vehicle
  router.delete('/vehicles/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const oldVehicle = await storage.getDriverVehicle(id);
      if (!oldVehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      const deleted = await storage.deleteDriverVehicle(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'driver_vehicles',
        String(id),
        oldVehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete driver vehicle', error);
      res.status(500).json({ message: 'Failed to delete driver vehicle' });
    }
  });

  return router;
}

// Backwards compatibility export
export default createDriversRouter;
