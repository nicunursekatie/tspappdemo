import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { storage } from '../storage-wrapper';
import { insertRecipientSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { logger } from '../utils/production-safe-logger';
import { AuditLogger } from '../audit-logger';
import { geocodeAddress } from '../utils/geocoding';
import {
  transformRecipientForApi,
  createSuccessResponse,
  createErrorResponse,
} from '@shared/types';
import { RATE_LIMITS } from '../config/constants';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/recipients - Get all recipients
router.get(
  '/',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      // Transform recipients to use canonical field names (focusAreas instead of focusArea)
      const transformedRecipients = recipients.map((r) => transformRecipientForApi(r));
      res.json(transformedRecipients);
    } catch (error) {
      logger.error('Error fetching recipients:', error);
      res.status(500).json(createErrorResponse('Failed to fetch recipients', 'INTERNAL_ERROR'));
    }
  }
);

// GET /api/recipients/export-csv - Export recipients as CSV (MUST come before /:id route)
router.get(
  '/export-csv',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      logger.log('[RECIPIENTS EXPORT] Export route hit!');
      const recipients = await storage.getAllRecipients();

      // CSV headers - all relevant fields
      const headers = [
        'ID',
        'Name',
        'Phone',
        'Email',
        'Website',
        'Instagram Handle',
        'Address',
        'Region',
        'Status',
        'Contact Person Name',
        'Contact Person Phone',
        'Contact Person Email',
        'Contact Person Role',
        'Second Contact Person Name',
        'Second Contact Person Phone',
        'Second Contact Person Email',
        'Second Contact Person Role',
        'Reporting Group',
        'Estimated Sandwiches',
        'Sandwich Type',
        'Focus Area',
        'TSP Contact',
        'Contract Signed',
        'Contract Signed Date',
        'Collection Day',
        'Collection Time',
        'Feeding Day',
        'Feeding Time',
        'Has Shared Post',
        'Shared Post Date',
        'Created At',
      ];

      // Convert recipients to CSV rows
      const rows = recipients.map((recipient: any) => [
        recipient.id || '',
        recipient.name || '',
        recipient.phone || '',
        recipient.email || '',
        recipient.website || '',
        recipient.instagramHandle || '',
        recipient.address || '',
        recipient.region || '',
        recipient.status || '',
        recipient.contactPersonName || '',
        recipient.contactPersonPhone || '',
        recipient.contactPersonEmail || '',
        recipient.contactPersonRole || '',
        recipient.secondContactPersonName || '',
        recipient.secondContactPersonPhone || '',
        recipient.secondContactPersonEmail || '',
        recipient.secondContactPersonRole || '',
        recipient.reportingGroup || '',
        recipient.estimatedSandwiches || '',
        recipient.sandwichType || '',
        recipient.focusArea || '',
        recipient.tspContact || '',
        recipient.contractSigned ? 'Yes' : 'No',
        recipient.contractSignedDate
          ? new Date(recipient.contractSignedDate).toISOString().split('T')[0]
          : '',
        recipient.collectionDay || '',
        recipient.collectionTime || '',
        recipient.feedingDay || '',
        recipient.feedingTime || '',
        recipient.hasSharedPost ? 'Yes' : 'No',
        recipient.sharedPostDate
          ? new Date(recipient.sharedPostDate).toISOString().split('T')[0]
          : '',
        recipient.createdAt
          ? new Date(recipient.createdAt).toISOString().split('T')[0]
          : '',
      ]);

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const cellStr = String(cell).replace(/"/g, '""');
              return cellStr.includes(',') ||
                cellStr.includes('"') ||
                cellStr.includes('\n')
                ? `"${cellStr}"`
                : cellStr;
            })
            .join(',')
        ),
      ].join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="recipients-${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      logger.error('Failed to export recipients', error);
      res.status(500).json({ error: 'Failed to export recipients' });
    }
  }
);

// POST /api/recipients/import - Import recipients from CSV/XLSX
router.post(
  '/import',
  requirePermission(PERMISSIONS.RECIPIENTS_ADD),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      let records: any[] = [];
      const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();

      // Parse based on file type
      if (fileExt === 'csv') {
        records = parse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (fileExt === 'xlsx' || fileExt === 'xls') {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        records = XLSX.utils.sheet_to_json(worksheet);
      } else {
        return res
          .status(400)
          .json({ error: 'Invalid file type. Use CSV or XLSX' });
      }

      let imported = 0;
      let skipped = 0;

      // Process each record
      for (const record of records) {
        try {
          // Map CSV columns to schema fields (case-insensitive)
          const recipientData: any = {
            name: record.Name || record.name,
            phone: record.Phone || record.phone,
            email: record.Email || record.email || '',
            website: record.Website || record.website || '',
            instagramHandle: record['Instagram Handle'] || record.instagramHandle || '',
            address: record.Address || record.address || '',
            region: record.Region || record.region || '',
            status: record.Status || record.status || 'active',
            contactPersonName: record['Contact Person Name'] || record.contactPersonName || '',
            contactPersonPhone: record['Contact Person Phone'] || record.contactPersonPhone || '',
            contactPersonEmail: record['Contact Person Email'] || record.contactPersonEmail || '',
            contactPersonRole: record['Contact Person Role'] || record.contactPersonRole || '',
            secondContactPersonName: record['Second Contact Person Name'] || record.secondContactPersonName || '',
            secondContactPersonPhone: record['Second Contact Person Phone'] || record.secondContactPersonPhone || '',
            secondContactPersonEmail: record['Second Contact Person Email'] || record.secondContactPersonEmail || '',
            secondContactPersonRole: record['Second Contact Person Role'] || record.secondContactPersonRole || '',
            reportingGroup: record['Reporting Group'] || record.reportingGroup || '',
            estimatedSandwiches: record['Estimated Sandwiches'] || record.estimatedSandwiches || null,
            sandwichType: record['Sandwich Type'] || record.sandwichType || '',
            focusArea: record['Focus Area'] || record.focusArea || '',
            tspContact: record['TSP Contact'] || record.tspContact || '',
            contractSigned: (record['Contract Signed'] || record.contractSigned || '').toString().toLowerCase() === 'yes',
            contractSignedDate: record['Contract Signed Date'] || record.contractSignedDate || null,
            collectionDay: record['Collection Day'] || record.collectionDay || '',
            collectionTime: record['Collection Time'] || record.collectionTime || '',
            feedingDay: record['Feeding Day'] || record.feedingDay || '',
            feedingTime: record['Feeding Time'] || record.feedingTime || '',
            hasSharedPost: (record['Has Shared Post'] || record.hasSharedPost || '').toString().toLowerCase() === 'yes',
            sharedPostDate: record['Shared Post Date'] || record.sharedPostDate || null,
          };

          // Skip if missing required fields
          if (!recipientData.name || !recipientData.phone) {
            skipped++;
            continue;
          }

          // Convert estimated sandwiches to number
          if (recipientData.estimatedSandwiches) {
            recipientData.estimatedSandwiches = parseInt(recipientData.estimatedSandwiches, 10);
          }

          // Validate and create recipient
          const validatedData = insertRecipientSchema.parse(recipientData);
          await storage.createRecipient(validatedData);
          imported++;
        } catch (error) {
          logger.error('Error importing recipient record:', error);
          skipped++;
        }
      }

      res.json({ imported, skipped });
    } catch (error) {
      logger.error('Failed to import recipients', error);
      res.status(500).json({ error: 'Failed to import recipients' });
    }
  }
);

// GET /api/recipients/map - Get recipients with coordinates for map display
// NOTE: Must come before /:id route to avoid "map" being parsed as an ID
router.get(
  '/map',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      
      // Log recipients status for debugging
      const totalRecipients = recipients.length;
      const activeRecipients = recipients.filter((r: any) => r.status === 'active');
      const activeWithAddress = activeRecipients.filter((r: any) => r.address && r.address.trim());
      const activeWithCoords = activeRecipients.filter((r: any) => r.latitude && r.longitude);
      const activeMissingCoords = activeWithAddress.filter((r: any) => !r.latitude || !r.longitude);
      
      logger.log(`📊 Recipients map endpoint stats:`, {
        total: totalRecipients,
        active: activeRecipients.length,
        activeWithAddress: activeWithAddress.length,
        activeWithCoords: activeWithCoords.length,
        activeMissingCoords: activeMissingCoords.length,
        missingCoordsIds: activeMissingCoords.map((r: any) => r.id).slice(0, 10), // First 10 for logging
      });
      
      // Filter to only include recipients with coordinates and active status
      const mappableRecipients = recipients
        .filter((r: any) => {
          const hasCoords = r.latitude && r.longitude;
          const isActive = r.status === 'active';
          return hasCoords && isActive;
        })
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          region: r.region,
          latitude: r.latitude,
          longitude: r.longitude,
          estimatedSandwiches: r.estimatedSandwiches,
          collectionDay: r.collectionDay,
          collectionTime: r.collectionTime,
          focusAreas: r.focusAreas,
          contactPersonName: r.contactPersonName,
          phone: r.phone,
        }));
      
      res.json(mappableRecipients);
    } catch (error) {
      logger.error('Error fetching recipients for map:', error);
      res.status(500).json({ error: 'Failed to fetch recipients for map' });
    }
  }
);

// POST /api/recipients/geocode-all - Backfill geocoding for all recipients with addresses but no coordinates
// NOTE: Must come before /:id route
router.post(
  '/geocode-all',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req, res) => {
    try {
      const recipients = await storage.getAllRecipients();
      
      // Find recipients that have addresses but no coordinates
      const needsGeocoding = recipients.filter(
        (r: any) => r.address && (!r.latitude || !r.longitude)
      );
      
      logger.log(`🗺️ Starting geocode backfill for ${needsGeocoding.length} recipients`);
      
      // Start geocoding in background (don't block response)
      const geocodeRecipients = async () => {
        let success = 0;
        let failed = 0;
        
        for (const recipient of needsGeocoding) {
          try {
            // Rate limit: respect OpenStreetMap's usage policy
            await new Promise(resolve => setTimeout(resolve, RATE_LIMITS.OPENSTREETMAP));
            
            const coords = await geocodeAddress(recipient.address!);
            if (coords) {
              await storage.updateRecipient(recipient.id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                geocodedAt: new Date(),
              });
              success++;
              logger.log(`✅ Geocoded recipient ${recipient.id}: ${recipient.name}`);
            } else {
              failed++;
              logger.warn(`❌ Failed to geocode recipient ${recipient.id}: ${recipient.name}`);
            }
          } catch (error) {
            failed++;
            logger.error(`Failed to geocode recipient ${recipient.id}:`, error);
          }
        }
        
        logger.log(`🗺️ Geocode backfill complete: ${success} success, ${failed} failed`);
      };
      
      // Start geocoding in background
      geocodeRecipients();
      
      res.json({
        message: 'Geocoding started in background',
        recipientsToProcess: needsGeocoding.length,
        recipientIds: needsGeocoding.map((r: any) => r.id),
      });
    } catch (error) {
      logger.error('Error starting geocode backfill:', error);
      res.status(500).json({ error: 'Failed to start geocode backfill' });
    }
  }
);

// GET /api/recipients/:id - Get single recipient
router.get(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_VIEW),
  async (req, res) => {
    try {
      logger.log('[RECIPIENTS GET BY ID] Route hit with id:', req.params.id);
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        logger.log('[RECIPIENTS GET BY ID] Invalid ID - returning 400');
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const recipient = await storage.getRecipient(id);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json(recipient);
    } catch (error) {
      logger.error('Error fetching recipient:', error);
      res.status(500).json({ error: 'Failed to fetch recipient' });
    }
  }
);

// POST /api/recipients/:id/geocode - Geocode a single recipient's address
router.post(
  '/:id/geocode',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const recipient = await storage.getRecipient(id);
      if (!recipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      if (!recipient.address) {
        return res.status(400).json({ error: 'Recipient has no address to geocode' });
      }

      const coords = await geocodeAddress(recipient.address);
      if (!coords) {
        return res.status(400).json({ error: 'Failed to geocode address. The address may be incomplete or not recognized.' });
      }

      await storage.updateRecipient(id, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: new Date(),
      });

      logger.log(`✅ Geocoded recipient ${id}: ${recipient.address}`);

      res.json({
        success: true,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (error) {
      logger.error('Error geocoding recipient:', error);
      res.status(500).json({ error: 'Failed to geocode recipient' });
    }
  }
);

// POST /api/recipients - Create new recipient
router.post(
  '/',
  requirePermission(PERMISSIONS.RECIPIENTS_ADD),
  async (req: any, res) => {
    try {
      const validatedData = insertRecipientSchema.parse(req.body);

      const recipient = await storage.createRecipient(validatedData);

      // Audit log
      await AuditLogger.logCreate(
        'recipients',
        String(recipient.id),
        recipient,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      // Geocode address asynchronously (don't block response)
      if (validatedData.address) {
        geocodeAddress(validatedData.address)
          .then(async (coords) => {
            if (coords) {
              await storage.updateRecipient(recipient.id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                geocodedAt: new Date(),
              });
              logger.log(`✅ Geocoded recipient ${recipient.id}: ${validatedData.address}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to geocode recipient ${recipient.id}:`, error);
          });
      }

      res.status(201).json(recipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      logger.error('Error creating recipient:', error);
      res.status(500).json({ error: 'Failed to create recipient' });
    }
  }
);

// PUT /api/recipients/:id - Update recipient
router.put(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      // Check if recipient exists
      const existingRecipient = await storage.getRecipient(id);
      if (!existingRecipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      // Validate the update data (partial)
      const updateSchema = insertRecipientSchema.partial();
      const validatedData = updateSchema.parse(req.body);

      const updatedRecipient = await storage.updateRecipient(id, validatedData);
      if (!updatedRecipient) {
        return res
          .status(404)
          .json({ error: 'Recipient not found after update' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'recipients',
        String(id),
        existingRecipient,
        updatedRecipient,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      // Re-geocode if address changed (async, don't block response)
      const addressChanged = validatedData.address && validatedData.address !== existingRecipient.address;
      if (addressChanged) {
        geocodeAddress(validatedData.address!)
          .then(async (coords) => {
            if (coords) {
              await storage.updateRecipient(id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                geocodedAt: new Date(),
              });
              logger.log(`✅ Re-geocoded recipient ${id}: ${validatedData.address}`);
            }
          })
          .catch((error) => {
            logger.error(`Failed to re-geocode recipient ${id}:`, error);
          });
      }

      res.json(updatedRecipient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid data',
          details: error.errors,
        });
      }

      logger.error('Error updating recipient:', error);
      res.status(500).json({ error: 'Failed to update recipient' });
    }
  }
);

// DELETE /api/recipients/:id - Delete recipient
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.RECIPIENTS_DELETE),
  async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      // Get old data before delete
      const oldRecipient = await storage.getRecipient(id);
      if (!oldRecipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      const success = await storage.deleteRecipient(id);
      if (!success) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'recipients',
        String(id),
        oldRecipient,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json({ success: true, message: 'Recipient deleted successfully' });
    } catch (error) {
      logger.error('Error deleting recipient:', error);
      res.status(500).json({ error: 'Failed to delete recipient' });
    }
  }
);

// PATCH /api/recipients/:id/status - Update recipient status
router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.RECIPIENTS_EDIT),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid recipient ID' });
      }

      const { status } = req.body;
      if (!status || !['active', 'inactive'].includes(status)) {
        return res
          .status(400)
          .json({ error: "Status must be 'active' or 'inactive'" });
      }

      const updatedRecipient = await storage.updateRecipient(id, { status });
      if (!updatedRecipient) {
        return res.status(404).json({ error: 'Recipient not found' });
      }

      res.json(updatedRecipient);
    } catch (error) {
      logger.error('Error updating recipient status:', error);
      res.status(500).json({ error: 'Failed to update recipient status' });
    }
  }
);

export default router;
