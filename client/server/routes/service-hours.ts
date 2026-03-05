import { Router } from 'express';
import { ServiceHoursPDFGenerator } from '../services/service-hours-pdf-generator';
import { isAuthenticated } from '../auth';
import { requirePermission } from '../middleware/auth';
import { PERMISSIONS } from '@shared/auth-utils';
import { z } from 'zod';
import { logger } from '../middleware/logger';

const router = Router();

const serviceEntrySchema = z.object({
  date: z.string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  hours: z.string()
    .min(1, 'Hours are required')
    .regex(/^\d+(\.\d+)?$/, 'Hours must be a valid number'),
  description: z.string().min(1, 'Description is required'),
});

const serviceHoursRequestSchema = z.object({
  volunteerName: z.string().min(1, 'Volunteer name is required'),
  serviceEntries: z.array(serviceEntrySchema).min(1, 'At least one service entry is required'),
  approverName: z.string().default('Katie Long'),
  approverSignature: z.string().default(''),
  approverContact: z.string().default(''),
  totalHours: z.number().min(0),
}).refine((data) => {
  const calculatedTotal = data.serviceEntries.reduce((sum, entry) => {
    return sum + (parseFloat(entry.hours) || 0);
  }, 0);
  return Math.abs(calculatedTotal - data.totalHours) < 0.01; // Allow small floating point differences
}, {
  message: 'Total hours must match the sum of individual entry hours',
  path: ['totalHours'],
});

router.post(
  '/',
  isAuthenticated,
  requirePermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
  async (req, res) => {
    try {
      // Validate request body
      const validatedData = serviceHoursRequestSchema.parse(req.body);

      logger.info('Generating service hours PDF', {
        userId: req.user?.id,
        volunteerName: validatedData.volunteerName,
        entries: validatedData.serviceEntries.length,
      });

      // Generate PDF
      const pdfBuffer = await ServiceHoursPDFGenerator.generatePDF(validatedData);

      // Convert to base64 for JSON response
      const pdfBase64 = pdfBuffer.toString('base64');

      res.json({
        success: true,
        pdf: pdfBase64,
      });
    } catch (error: any) {
      logger.error('Error generating service hours PDF:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors,
        });
      }

      res.status(500).json({
        error: 'Failed to generate PDF',
        message: error.message,
      });
    }
  }
);

export default router;
