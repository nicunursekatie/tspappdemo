import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import { signInSheetUpload } from '../middleware/uploads';
import { parseSignInSheetPhoto, parseSignInSheetBase64 } from '../services/signin-sheet-parser';
import { storage } from '../storage-wrapper';
import { requirePermission } from '../middleware/auth';
import { logger } from '../utils/production-safe-logger';
import { QueryOptimizer } from '../performance/query-optimizer';
import { getSocketInstance } from '../socket-chat';

const photoScannerRouter = Router();

const confirmDataSchema = z.object({
  entries: z.array(z.object({
    location: z.string().min(1),
    sandwichCount: z.number().int().min(0),
    collectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    volunteerName: z.string().optional(),
  })),
});

/**
 * POST /api/photo-scanner/scan
 * Upload and scan a sign-in sheet photo
 * Returns extracted data for user review
 */
photoScannerRouter.post(
  '/scan',
  requirePermission('COLLECTIONS_ADD'),
  signInSheetUpload.single('photo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No photo uploaded'
        });
      }

      logger.info(`[PhotoScanner] Processing uploaded file: ${req.file.originalname}`);

      // Optional context hint from user (e.g., "This is from Dunwoody location")
      const contextHint = req.body.contextHint as string | undefined;

      // Parse the uploaded image
      const result = await parseSignInSheetPhoto(req.file.path, contextHint);

      // Clean up the uploaded file after processing
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn(`[PhotoScanner] Failed to cleanup uploaded file: ${req.file.path}`);
      }

      if (!result.success) {
        return res.status(422).json({
          success: false,
          message: 'Failed to extract data from image',
          warnings: result.warnings,
        });
      }

      // Return extracted data for user review
      res.json({
        success: true,
        data: {
          entries: result.entries,
          totalSandwiches: result.totalSandwiches,
          suggestedDate: result.suggestedDate,
          overallConfidence: result.overallConfidence,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      logger.error('[PhotoScanner] Error processing photo:', error);

      // Clean up file on error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch {
          // Ignore cleanup errors
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to process photo',
      });
    }
  }
);

/**
 * POST /api/photo-scanner/scan-base64
 * Scan a sign-in sheet photo from base64 data (for mobile uploads)
 * Returns extracted data for user review
 */
photoScannerRouter.post(
  '/scan-base64',
  requirePermission('COLLECTIONS_ADD'),
  async (req, res) => {
    try {
      const { imageData, mimeType, contextHint } = req.body;

      if (!imageData) {
        return res.status(400).json({
          success: false,
          message: 'No image data provided',
        });
      }

      if (!mimeType) {
        return res.status(400).json({
          success: false,
          message: 'No mime type provided',
        });
      }

      // Validate mime type - must match Claude's vision API supported formats
      const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validMimeTypes.includes(mimeType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid image type. Supported types: JPEG, PNG, WebP, GIF',
        });
      }

      logger.info(`[PhotoScanner] Processing base64 image, type: ${mimeType}`);

      // Remove data URL prefix if present
      let base64Data = imageData;
      if (imageData.includes(',')) {
        base64Data = imageData.split(',')[1];
      }

      // Validate base64 decoded size (limit: 15MB)
      const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid base64 image data',
        });
      }
      if (imageBuffer.length > MAX_IMAGE_SIZE) {
        return res.status(413).json({
          success: false,
          message: 'Image too large. Maximum allowed size is 15MB.',
        });
      }

      // Parse the image
      const result = await parseSignInSheetBase64(base64Data, mimeType, contextHint);

      if (!result.success) {
        return res.status(422).json({
          success: false,
          message: 'Failed to extract data from image',
          warnings: result.warnings,
        });
      }

      // Return extracted data for user review
      res.json({
        success: true,
        data: {
          entries: result.entries,
          totalSandwiches: result.totalSandwiches,
          suggestedDate: result.suggestedDate,
          overallConfidence: result.overallConfidence,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      logger.error('[PhotoScanner] Error processing base64 image:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process image',
      });
    }
  }
);

/**
 * POST /api/photo-scanner/confirm
 * Save confirmed/edited extracted data to the database
 * Creates collection records the same way as the text message parser
 */
photoScannerRouter.post(
  '/confirm',
  requirePermission('COLLECTIONS_ADD'),
  async (req, res) => {
    try {
      const validatedData = confirmDataSchema.parse(req.body);

      if (validatedData.entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No entries to save',
        });
      }

      const user = req.user || req.session?.user;
      const createdCollections = [];

      // Create a collection record for each entry
      for (const entry of validatedData.entries) {
        const collectionData = {
          collectionDate: entry.collectionDate,
          hostName: entry.location,
          individualSandwiches: entry.sandwichCount,
          groupCollections: [], // Photo scanner creates individual entries, no groups
          createdBy: user?.id || 'photo-scanner',
          createdByName: user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.email || 'Photo Scanner',
          submissionMethod: 'photo-scanner',
        };

        const collection = await storage.createSandwichCollection(collectionData);
        createdCollections.push(collection);
      }

      // Invalidate cache
      QueryOptimizer.invalidateCache('sandwich-collections');
      QueryOptimizer.invalidateCache('sandwich-collections-stats');

      // Broadcast real-time update
      try {
        const io = getSocketInstance();
        if (io) {
          io.emit('collections:updated', {
            trigger: 'photo-scanner-batch',
            count: createdCollections.length,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (socketError) {
        logger.error('[PhotoScanner] Failed to emit socket event:', socketError);
      }

      const totalSandwiches = createdCollections.reduce(
        (sum, c) => sum + (c.individualSandwiches || 0),
        0
      );

      logger.info(
        `[PhotoScanner] Created ${createdCollections.length} collections, total: ${totalSandwiches} sandwiches`
      );

      res.json({
        success: true,
        message: `Successfully saved ${createdCollections.length} collection${createdCollections.length !== 1 ? 's' : ''} with ${totalSandwiches} total sandwiches`,
        collections: createdCollections,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('[PhotoScanner] Validation error:', error.errors);
        return res.status(400).json({
          success: false,
          message: 'Invalid data',
          errors: error.errors,
        });
      }

      logger.error('[PhotoScanner] Error saving collections:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save collections',
      });
    }
  }
);

/**
 * GET /api/photo-scanner/hosts
 * Get list of known host locations for matching/suggestions
 */
photoScannerRouter.get(
  '/hosts',
  requirePermission('COLLECTIONS_ADD'),
  async (req, res) => {
    try {
      const hosts = await storage.getAllHosts();
      const activeHosts = hosts.filter((h: any) => h.status === 'active');

      res.json({
        success: true,
        hosts: activeHosts.map((h: any) => ({
          id: h.id,
          name: h.name,
        })),
      });
    } catch (error) {
      logger.error('[PhotoScanner] Error fetching hosts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch hosts',
      });
    }
  }
);

export default photoScannerRouter;
