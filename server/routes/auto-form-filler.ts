import { Router, type Response } from 'express';
import { isAuthenticated } from '../auth';
import { logger } from '../middleware/logger';
import { createStandardMiddleware, createErrorHandler } from '../middleware';
import multer from 'multer';
import { ServiceHoursPDFGenerator } from '../services/service-hours-pdf-generator';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db';
import { volunteers, eventVolunteers, eventRequests } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../types/express';

// Create auto-form-filler router
const autoFormFillerRouter = Router();

// Error handling for this module
const errorHandler = createErrorHandler('auto-form-filler');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  },
});

// POST /api/auto-form-filler/process - Process form filling
autoFormFillerRouter.post(
  '/process',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { formType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!formType) {
        return res.status(400).json({ error: 'Form type is required' });
      }

      logger.info('Processing auto form filler request', {
        userId: user.id,
        formType,
        fileName: file.originalname,
        fileSize: file.size,
      });

      // Handle service hours form type
      if (formType === 'service_hours') {
        // Optional parameters for volunteer and event IDs
        const { volunteerId, eventId } = req.body;

        let volunteerName = '[Volunteer Name]';
        let serviceEntries: Array<{ date: string; hours: string; description: string }> = [
          {
            date: new Date().toISOString().split('T')[0],
            hours: '3',
            description: '[Description of volunteer work]',
          },
        ];
        let totalHours = 3;

        // Try to fetch volunteer data if volunteerId is provided
        if (volunteerId) {
          const volunteer = await db
            .select()
            .from(volunteers)
            .where(eq(volunteers.id, parseInt(volunteerId)))
            .limit(1);

          if (volunteer.length > 0) {
            volunteerName = volunteer[0].name;
          }
        }

        // Try to fetch event data if eventId is provided
        if (eventId) {
          const eventData = await db
            .select({
              requestedDate: eventRequests.requestedDate,
              organizationName: eventRequests.organizationName,
              eventType: eventRequests.eventType,
            })
            .from(eventRequests)
            .where(eq(eventRequests.id, parseInt(eventId)))
            .limit(1);

          if (eventData.length > 0) {
            const event = eventData[0];
            serviceEntries = [
              {
                date: event.requestedDate
                  ? new Date(event.requestedDate).toISOString().split('T')[0]
                  : new Date().toISOString().split('T')[0],
                hours: '3',
                description: `${event.eventType || 'Event'} at ${event.organizationName || 'location'}`,
              },
            ];
            totalHours = 3;
          }
        }

        const serviceHoursData = {
          volunteerName,
          serviceEntries,
          approverName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : 'Katie Long',
          approverSignature: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : '',
          approverContact: '[Contact Number]',
          totalHours,
        };

        // Generate the PDF
        const pdfBuffer = await ServiceHoursPDFGenerator.generatePDF(serviceHoursData);

        // Save to temporary location
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        const fileName = `service_hours_${timestamp}.pdf`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        const result = {
          success: true,
          formType,
          fileName: file.originalname,
          extractedData: {
            volunteerName: serviceHoursData.volunteerName,
            approverName: serviceHoursData.approverName,
            approverContact: serviceHoursData.approverContact,
            totalHours: serviceHoursData.totalHours.toString(),
            entries: serviceHoursData.serviceEntries.length.toString(),
          },
          filledFormUrl: `/api/auto-form-filler/download/${fileName}`,
          message: 'Service hours form has been filled. Please update the volunteer name and service details as needed.',
        };

        return res.json(result);
      }

      // For other form types, return placeholder response
      const result = {
        success: true,
        formType,
        fileName: file.originalname,
        extractedData: {
          organizationName: 'The Sandwich Project',
          contactName: [user.firstName, user.lastName].filter(Boolean).join(' '),
          email: user.email,
          date: new Date().toISOString().split('T')[0],
        },
        filledFormUrl: null,
        message: 'This form type is not yet fully implemented. Only Service Hours forms are currently supported.',
      };

      return res.json(result);
    } catch (error) {
      logger.error('Error processing form:', error);
      errorHandler(error, req, res, () => {});
    }
  }
);

// GET /api/auto-form-filler/download/:filename - Download generated form
autoFormFillerRouter.get(
  '/download/:filename',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { filename } = req.params;

      // Validate filename to prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const filePath = path.join(process.cwd(), 'temp', filename);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Send the file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      // Clean up the file after a short delay (to ensure download completes)
      fileStream.on('end', () => {
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000);
      });
    } catch (error) {
      logger.error('Error downloading file:', error);
      errorHandler(error, req, res, () => {});
    }
  }
);

// GET /api/auto-form-filler/supported-types - Get list of supported form types
autoFormFillerRouter.get(
  '/supported-types',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const supportedTypes = [
        {
          id: 'service_hours',
          name: 'Service Hours Form',
          description: 'Track volunteer service hours',
        },
        {
          id: 'event_request',
          name: 'Event Request Form',
          description: 'Request new events or presentations',
        },
        {
          id: 'volunteer_application',
          name: 'Volunteer Application',
          description: 'New volunteer registration',
        },
        {
          id: 'host_agreement',
          name: 'Host Agreement',
          description: 'Host location partnership forms',
        },
        {
          id: 'grant_application',
          name: 'Grant Application',
          description: 'Grant and funding applications',
        },
        {
          id: 'custom',
          name: 'Custom Form',
          description: 'Any other custom form template',
        },
      ];

      return res.json(supportedTypes);
    } catch (error) {
      logger.error('Error fetching supported types:', error);
      errorHandler(error, req, res, () => {});
    }
  }
);

export default autoFormFillerRouter;
