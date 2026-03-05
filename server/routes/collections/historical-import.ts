import { Router, Response } from 'express';
import multer from 'multer';
import { excelImportService } from '../../services/collections/excel-import-service';
import { logger } from '../../middleware/logger';
import { AuthenticatedRequest, getUserId } from '../../types';

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an Excel file (.xls, .xlsx)'));
    }
  },
});

const historicalImportRouter = Router();

/**
 * Upload and import historical event records from Excel
 */
historicalImportRouter.post(
  '/upload',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      logger.info('Historical import file uploaded', {
        fileName: req.file.originalname,
        size: req.file.size,
        userId,
      });

      // Parse Excel file
      const rows = excelImportService.parseExcelFile(req.file.buffer);

      if (rows.length === 0) {
        return res.status(400).json({
          message: 'Excel file is empty or has no valid data',
        });
      }

      // Import records
      const result = await excelImportService.importHistoricalRecords(rows, userId);

      logger.info('Historical import completed', {
        fileName: req.file.originalname,
        result: {
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
        },
      });

      res.json({
        success: result.success,
        message: `Import completed: ${result.imported} records imported, ${result.skipped} skipped`,
        result,
      });
    } catch (error) {
      logger.error('Historical import failed', error);

      const errorMessage = error instanceof Error ? error.message : 'Import failed';

      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }
);

/**
 * Preview Excel file contents before importing
 */
historicalImportRouter.post(
  '/preview',
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Parse Excel file
      const rows = excelImportService.parseExcelFile(req.file.buffer);

      // Return first 10 rows for preview
      const preview = rows.slice(0, 10);

      res.json({
        success: true,
        totalRows: rows.length,
        preview,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      });
    } catch (error) {
      logger.error('Preview failed', error);

      const errorMessage = error instanceof Error ? error.message : 'Preview failed';

      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  }
);

/**
 * Download Excel template for imports
 */
historicalImportRouter.get('/template', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const templateBuffer = excelImportService.generateTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="historical-events-template.xlsx"'
    );
    res.setHeader('Content-Length', templateBuffer.length);

    res.send(templateBuffer);
  } catch (error) {
    logger.error('Failed to generate template', error);

    res.status(500).json({
      message: 'Failed to generate template',
    });
  }
});

export default historicalImportRouter;
