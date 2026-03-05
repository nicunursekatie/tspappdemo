import { Router, Response } from 'express';
import { messagingService, MessageAttachment } from '../services/messaging-service';
import { isAuthenticated } from '../auth';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/production-safe-logger';
import { objectStorageService } from '../objectStorage';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';

const router = Router();

// Configure multer for file uploads (store in memory temporarily)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size (for videos)
    files: 5, // Max 5 files per upload
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm',
      'video/mpeg',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

// Get messages for an event context (stub route - events don't have messaging yet)
router.get('/context/event/:eventId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  // Event requests don't have a messaging system yet, so return empty array
  // This prevents 404 errors in the console when EventMessageThread loads
  res.json({ messages: [] });
});

// Get unread messages for the user
router.get('/unread', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { groupByContext } = req.query;

    if (groupByContext) {
      // Get unread counts by context
      const contextCounts = await messagingService.getUnreadCountsByContext(user.id);
      res.json(contextCounts);
    } else {
      // Get unread messages
      const messages = await messagingService.getUnreadMessages(user.id);
      res.json({ messages });
    }
  } catch (error) {
    logger.error('[Messaging API] Error fetching unread messages:', error);
    res.json({ messages: [] });
  }
});

// Get unnotified kudos for login notifications
router.get('/kudos/unnotified', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    logger.log(`[Messaging API] Getting unnotified kudos for user: ${user.email}`);

    const unnotifiedKudos = await messagingService.getUnnotifiedKudos(user.id);

    // Ensure we always return an array
    const kudosArray = Array.isArray(unnotifiedKudos) ? unnotifiedKudos : [];

    logger.log(`[Messaging API] Found ${kudosArray.length} unnotified kudos`);
    res.json(kudosArray);
  } catch (error) {
    logger.error('[Messaging API] Error fetching unnotified kudos:', error);
    // Return empty array on error to prevent slice errors
    res.json([]);
  }
});

// Mark kudos as initially notified
router.post('/kudos/mark-initial-notified', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { kudosIds } = req.body;

    if (!kudosIds || !Array.isArray(kudosIds)) {
      return res.status(400).json({ message: 'kudosIds array is required' });
    }

    logger.log(`[Messaging API] Marking ${kudosIds.length} kudos as initially notified for user: ${user.email}`);

    await messagingService.markKudosInitiallyNotified(user.id, kudosIds);

    res.json({ success: true, message: 'Kudos marked as initially notified' });
  } catch (error) {
    logger.error('[Messaging API] Error marking kudos as initially notified:', error);
    res.status(500).json({ message: 'Failed to mark kudos as initially notified' });
  }
});

// Mark kudos as read
router.post('/kudos/mark-read', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { kudosIds } = req.body;

    if (!kudosIds || !Array.isArray(kudosIds)) {
      return res.status(400).json({ message: 'kudosIds array is required' });
    }

    logger.log(`[Messaging API] Marking ${kudosIds.length} kudos as read for user: ${user.email}`);

    await messagingService.markKudosAsRead(user.id, kudosIds);

    res.json({ success: true, markedCount: kudosIds.length });
  } catch (error) {
    logger.error('[Messaging API] Error marking kudos as read:', error);
    res.status(500).json({ message: 'Failed to mark kudos as read' });
  }
});

// Get received kudos for a user
router.get('/kudos/received', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    logger.log(`[Messaging API] Getting received kudos for user: ${user.email}`);

    const kudos = await messagingService.getReceivedKudos(user.id);

    // Ensure we always return an array
    const kudosArray = Array.isArray(kudos) ? kudos : [];

    logger.log(`[Messaging API] Found ${kudosArray.length} received kudos`);
    res.json(kudosArray);
  } catch (error) {
    logger.error('[Messaging API] Error fetching received kudos:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Send kudos
router.post('/kudos/send', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      recipientId,
      content,
      contextType,
      contextId,
      entityName,
    } = req.body;

    // For 'general' kudos, contextId and entityName are optional
    const isGeneralKudos = contextType === 'general';

    if (!recipientId || !contextType) {
      return res.status(400).json({
        message: 'recipientId and contextType are required'
      });
    }

    // For non-general kudos, contextId and entityName are required
    if (!isGeneralKudos && (!contextId || !entityName)) {
      return res.status(400).json({
        message: 'contextId and entityName are required for non-general kudos'
      });
    }

    logger.log(`[Messaging API] Sending kudos from ${user.email} to ${recipientId}, type: ${contextType}`);

    const result = await messagingService.sendKudos({
      senderId: user.id,
      recipientId,
      content,
      contextType,
      contextId: contextId || `general-${Date.now()}`, // Generate unique ID for general kudos
      entityName: entityName || 'General Recognition',
    });

    res.json(result);
  } catch (error) {
    logger.error('[Messaging API] Error sending kudos:', error);
    res.status(500).json({ message: 'Failed to send kudos' });
  }
});

// Check if kudos was already sent
router.get('/kudos/check', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, contextType, contextId } = req.query;

    if (!recipientId || !contextType || !contextId) {
      return res.status(400).json({
        message: 'recipientId, contextType, and contextId are required'
      });
    }

    const hasSent = await messagingService.hasKudosSent(
      user.id,
      recipientId as string,
      contextType as string,
      contextId as string
    );

    res.json({ hasSent });
  } catch (error) {
    logger.error('[Messaging API] Error checking kudos status:', error);
    res.status(500).json({ message: 'Failed to check kudos status' });
  }
});

// Send message
router.post('/send', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      recipientIds,
      content,
      contextType,
      contextId,
      contextTitle,
      parentMessageId,
      attachments,
    } = req.body;

    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ message: 'recipientIds array is required' });
    }

    // Content is only required if there are no attachments
    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: 'content or attachments required' });
    }

    logger.log(`[Messaging API] Sending message from ${user.email} to ${recipientIds.length} recipient(s) with ${attachments?.length || 0} attachments`);

    const result = await messagingService.sendMessage({
      senderId: user.id,
      recipientIds,
      content: content || '',
      contextType,
      contextId,
      contextTitle,
      parentMessageId,
      attachments: attachments as MessageAttachment[],
    });

    res.json(result);
  } catch (error) {
    logger.error('[Messaging API] Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Upload attachment for message
router.post('/attachments/upload', isAuthenticated, upload.array('files', 5), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    logger.log(`[Messaging API] Uploading ${files.length} attachment(s) from ${user.email}`);

    const uploadedAttachments: MessageAttachment[] = [];

    for (const file of files) {
      try {
        // Generate unique filename
        const fileId = randomUUID();
        const ext = path.extname(file.originalname);
        const destKey = `message-attachments/${user.id}/${fileId}${ext}`;

        // Write buffer to temp file, upload, then clean up
        const fs = await import('fs');
        const os = await import('os');
        const tempPath = path.join(os.tmpdir(), `upload-${fileId}${ext}`);

        fs.writeFileSync(tempPath, file.buffer);

        try {
          const url = await objectStorageService.uploadLocalFile(tempPath, destKey);

          uploadedAttachments.push({
            name: file.originalname,
            url,
            type: file.mimetype,
            size: file.size,
          });
        } finally {
          // Clean up temp file
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        }
      } catch (uploadError) {
        logger.error(`[Messaging API] Failed to upload file ${file.originalname}:`, uploadError);
        // Continue with other files
      }
    }

    if (uploadedAttachments.length === 0) {
      return res.status(500).json({ message: 'Failed to upload any files' });
    }

    logger.log(`[Messaging API] Successfully uploaded ${uploadedAttachments.length} attachment(s)`);
    res.json({ attachments: uploadedAttachments });
  } catch (error) {
    logger.error('[Messaging API] Error uploading attachments:', error);
    res.status(500).json({ message: 'Failed to upload attachments' });
  }
});

// Get signed URL for viewing an attachment
router.get('/attachments/view', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url parameter is required' });
    }

    // Generate a signed URL that's valid for 1 hour
    const signedUrl = await objectStorageService.getSignedViewUrl(url, 3600);
    res.json({ signedUrl });
  } catch (error) {
    logger.error('[Messaging API] Error getting signed URL:', error);
    res.status(500).json({ message: 'Failed to get signed URL' });
  }
});

export default router;
