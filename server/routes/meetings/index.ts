import { Router, Response } from 'express';
import { z } from 'zod';
import { storage } from '../../storage-wrapper';
import { logger } from '../../middleware/logger';
import { meetingMinutesUpload } from '../../middleware/uploads';
import { safeAssign, validateNoPrototypePollution } from '../../utils/object-utils';
import {
  insertMeetingMinutesSchema,
  insertAgendaItemSchema,
  insertMeetingSchema,
  insertMeetingNoteSchema,
} from '@shared/schema';
import {
  MeetingsService,
  meetingFileService,
} from '../../services/meetings';
import {
  AuthenticatedRequest,
  getUserId,
} from '../../types';
import { RouterDependencies } from '../../types/router-deps';
// REFACTOR: Import meeting-project service for new endpoints
import { meetingProjectService } from '../../services/assignments';

// Factory function to create meetings routes with dependencies
export default function createMeetingsRouter(deps: RouterDependencies): Router {
  const meetingsRouter = Router();
  const { requirePermission } = deps;

  // Initialize meetings service with type-safe storage interface
  const meetingsService = new MeetingsService(storage);

// Meeting Minutes
meetingsRouter.get('/minutes', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }

    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined;
    const minutes = limit
      ? await storage.getRecentMeetingMinutes(limit)
      : await storage.getAllMeetingMinutes();

    // Filter meeting minutes based on user role and committee membership
    const filteredMinutes = await meetingsService.filterMeetingMinutesByRole(
      userId,
      minutes
    );

    res.json(filteredMinutes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch meeting minutes' });
  }
}) as any);

meetingsRouter.post('/minutes', async (req, res) => {
  try {
    const minutesData = insertMeetingMinutesSchema.parse(req.body);
    const minutes = await storage.createMeetingMinutes(minutesData);
    res.status(201).json(minutes);
  } catch (error) {
    res.status(400).json({ message: 'Invalid meeting minutes data' });
  }
});

meetingsRouter.delete('/minutes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const success = await storage.deleteMeetingMinutes(id);

    if (success) {
      logger.info('Meeting minutes deleted', {
        method: req.method,
        url: req.url,
        ip: req.ip,
      });
      res.json({
        success: true,
        message: 'Meeting minutes deleted successfully',
      });
    } else {
      res.status(404).json({ message: 'Meeting minutes not found' });
    }
  } catch (error) {
    logger.error('Failed to delete meeting minutes', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ message: 'Failed to delete meeting minutes' });
  }
});

// Meeting minutes file upload endpoint
meetingsRouter.post(
  '/minutes/upload',
  meetingMinutesUpload.single('file'),
  async (req, res) => {
    try {
      const { meetingId, title, date, summary, googleDocsUrl } = req.body;

      if (!meetingId || !title || !date) {
        return res.status(400).json({
          message: 'Missing required fields: meetingId, title, date',
        });
      }

      let finalSummary = summary;
      let fileMetadata = null;

      // Handle file upload
      if (req.file) {
        logger.info('Meeting minutes file uploaded', {
          method: req.method,
          url: req.url,
          ip: req.ip,
        });

        try {
          const uploadResult = await meetingFileService.processUploadedFile(
            req.file
          );
          fileMetadata = uploadResult.metadata;
          finalSummary = uploadResult.summary;
        } catch (fileError) {
          logger.error('Failed to store document file', fileError);
          finalSummary = `Document uploaded: ${req.file.originalname} (storage failed)`;
        }
      }

      // Handle Google Docs URL
      if (googleDocsUrl) {
        finalSummary = `Google Docs link: ${googleDocsUrl}`;
      }

      if (!finalSummary) {
        return res
          .status(400)
          .json({ message: 'Must provide either a file or Google Docs URL' });
      }

      // Create meeting minutes record
      const minutesData = {
        title,
        date,
        summary: finalSummary,
        fileName: fileMetadata?.fileName || null,
        filePath: fileMetadata?.filePath || null,
        fileType:
          fileMetadata?.fileType || (googleDocsUrl ? 'google_docs' : 'text'),
        mimeType: fileMetadata?.mimeType || null,
      };

      const minutes = await storage.createMeetingMinutes(minutesData);

      logger.info('Meeting minutes created successfully', {
        method: req.method,
        url: req.url,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: 'Meeting minutes uploaded successfully',
        minutes: minutes,
        filename: req.file?.originalname,
        extractedContent: false,
      });
    } catch (error) {
      logger.error(
        'Failed to upload meeting minutes',
        error instanceof Error ? error : new Error(String(error))
      );
      res.status(500).json({
        message: 'Failed to upload meeting minutes',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

// File serving endpoint for meeting minutes documents by ID
meetingsRouter.get('/minutes/:id/file', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const minutesId = parseInt(req.params.id, 10);
    if (isNaN(minutesId)) {
      return res.status(400).json({ message: 'Invalid meeting minutes ID' });
    }

    // Get all meeting minutes and find the specific one
    const allMinutes = await storage.getAllMeetingMinutes();
    const minutes = allMinutes.find((m: any) => m.id === minutesId);
    if (!minutes) {
      return res.status(404).json({ message: 'Meeting minutes not found' });
    }

    if (!minutes.filePath) {
      return res
        .status(404)
        .json({ message: 'No file associated with these meeting minutes' });
    }

    logger.info('Serving meeting minutes file', {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    try {
      const fileData = await meetingFileService.serveFile(
        minutes.filePath,
        minutes.fileName || undefined
      );

      // Set appropriate headers
      res.setHeader('Content-Type', fileData.contentType);
      res.setHeader('Content-Length', fileData.stats.size);
      res.setHeader('Content-Disposition', fileData.disposition);

      // Stream the file
      fileData.stream.pipe(res);
    } catch (error) {
      logger.error(
        'File access failed',
        error instanceof Error ? error : new Error(String(error))
      );
      return res.status(404).json({ message: 'File not found on disk' });
    }
  } catch (error) {
    logger.error(
      'Failed to serve meeting minutes file',
      error instanceof Error ? error : new Error(String(error))
    );
    res.status(500).json({ message: 'Failed to serve file' });
  }
}) as any);

// File serving endpoint for meeting minutes documents by filename (legacy)
meetingsRouter.get('/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    const fileData = await meetingFileService.serveFileByName(filename);

    // Set headers for inline display
    res.setHeader('Content-Type', fileData.contentType);
    res.setHeader('Content-Length', fileData.stats.size);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileData.displayName}"`
    );
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.send(fileData.buffer);
  } catch (error) {
    logger.error('Failed to serve file', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// Drive Links
meetingsRouter.get('/drive-links', async (req, res) => {
  try {
    const links = await storage.getAllDriveLinks();
    res.json(links);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch drive links' });
  }
});

// Agenda Items
meetingsRouter.get('/agenda-items', async (req, res) => {
  try {
    const items = await storage.getAllAgendaItems();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch agenda items' });
  }
});

meetingsRouter.post('/agenda-items', async (req, res) => {
  try {
    const itemData = insertAgendaItemSchema.parse(req.body);
    const item = await storage.createAgendaItem(itemData);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ message: 'Invalid agenda item data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to create agenda item' });
    }
  }
});

meetingsRouter.patch('/agenda-items/:id', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }

    // Check if user can modify agenda items
    const canModify = await meetingsService.canModifyAgendaItem(userId);
    if (!canModify) {
      return res.status(403).json({
        message: 'You do not have permission to modify agenda item statuses',
      });
    }

    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!meetingsService.isValidAgendaStatus(status)) {
      res.status(400).json({ message: 'Invalid status' });
      return;
    }

    const updatedItem = await storage.updateAgendaItemStatus(id, status);
    if (!updatedItem) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update agenda item' });
  }
}) as any);

meetingsRouter.put('/agenda-items/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description } = req.body;

    const updatedItem = await storage.updateAgendaItem(id, {
      title,
      description,
    });
    if (!updatedItem) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update agenda item' });
  }
});

meetingsRouter.delete('/agenda-items/:id', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'User ID not found' });
    }

    // Check if user can modify agenda items
    const canModify = await meetingsService.canModifyAgendaItem(userId);
    if (!canModify) {
      return res
        .status(403)
        .json({ message: 'You do not have permission to delete agenda items' });
    }

    const id = parseInt(req.params.id, 10);
    const success = await storage.deleteAgendaItem(id);

    if (!success) {
      res.status(404).json({ message: 'Agenda item not found' });
      return;
    }

    res.json({ message: 'Agenda item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete agenda item' });
  }
}) as any);

// Meetings
meetingsRouter.get('/', async (req, res) => {
  try {
    const meetings = await storage.getAllMeetings();
    const mappedMeetings = meetingsService.mapMeetingsToResponse(meetings);
    res.json(mappedMeetings);
  } catch (error) {
    logger.error('Failed to fetch meetings', error);
    res.json([]);
  }
});

meetingsRouter.get('/current', async (req, res) => {
  try {
    const meeting = await storage.getCurrentMeeting();
    if (!meeting) {
      return res.status(404).json({ message: 'No current meeting found' });
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch current meeting' });
  }
});

meetingsRouter.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const meetings = await storage.getMeetingsByType(type);
    const mappedMeetings = meetingsService.mapMeetingsToResponse(meetings);
    res.json(mappedMeetings);
  } catch (error) {
    logger.error('Failed to fetch meetings by type', error);
    res.json([]);
  }
});

meetingsRouter.post('/', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingPayload = meetingsService.mapRequestToMeetingPayload(
      req.body,
      { includeDefaults: true }
    );
    const meetingData = insertMeetingSchema.parse(meetingPayload);
    const meeting = await storage.createMeeting(meetingData);
    res.status(201).json(meeting);
  } catch (error) {
    logger.error('Failed to create meeting', error);
    if (error instanceof z.ZodError) {
      res
        .status(400)
        .json({ message: 'Invalid meeting data', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to create meeting' });
    }
  }
});

// Meeting Notes
meetingsRouter.get('/notes', requirePermission('MEETINGS_VIEW'), async (req, res) => {
  try {
    const { projectId, meetingId, type, status } = req.query;
    
    const filters: any = {};
    if (projectId) filters.projectId = parseInt(projectId as string);
    if (meetingId) filters.meetingId = parseInt(meetingId as string);
    if (type) filters.type = type as string;
    if (status) filters.status = status as string;

    const notes = Object.keys(filters).length > 0 
      ? await storage.getMeetingNotesByFilters(filters)
      : await storage.getAllMeetingNotes();
    
    res.json(notes);
  } catch (error) {
    logger.error('Failed to fetch meeting notes', error);
    res.status(500).json({ message: 'Failed to fetch meeting notes' });
  }
});

meetingsRouter.get('/notes/:id', requirePermission('MEETINGS_VIEW'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    const note = await storage.getMeetingNote(id);
    if (!note) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }

    res.json(note);
  } catch (error) {
    logger.error('Failed to fetch meeting note', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ message: 'Failed to fetch meeting note' });
  }
});

meetingsRouter.post('/notes', requirePermission('MEETINGS_MANAGE'), (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = getUserId(req);
    const user = userId ? await storage.getUser(userId) : null;

    const noteData = insertMeetingNoteSchema.parse(req.body);

    // Add creator information if available
    if (user) {
      noteData.createdBy = user.id;
      noteData.createdByName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    }

    const note = await storage.createMeetingNote(noteData);

    logger.info('Meeting note created', {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid meeting note data',
        errors: error.errors
      });
    } else {
      logger.error('Failed to create meeting note', error instanceof Error ? error : new Error(String(error)));
      res.status(500).json({ message: 'Failed to create meeting note' });
    }
  }
}) as any);

meetingsRouter.patch('/notes/:id', requirePermission('MEETINGS_MANAGE'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    // Validate against prototype pollution attempts
    try {
      validateNoPrototypePollution(req.body);
    } catch (error) {
      logger.error('Prototype pollution attempt detected in meeting note update', {
        userId: getUserId(req),
        error
      });
      return res.status(400).json({
        message: 'Invalid request: prohibited property names detected'
      });
    }

    // Validate that only allowed fields are being updated (using safe assignment)
    const allowedUpdates = ['content', 'type', 'status'];
    const updates: any = {};
    safeAssign(updates, req.body, allowedUpdates);
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updatedNote = await storage.updateMeetingNote(id, updates);
    if (!updatedNote) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }

    logger.info('Meeting note updated', {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    res.json(updatedNote);
  } catch (error) {
    logger.error('Failed to update meeting note', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ message: 'Failed to update meeting note' });
  }
});

meetingsRouter.delete('/notes/:id', requirePermission('MEETINGS_MANAGE'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    const success = await storage.deleteMeetingNote(id);
    if (!success) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }

    logger.info('Meeting note deleted', {
      method: req.method,
      url: req.url,
      ip: req.ip,
    });

    res.json({ message: 'Meeting note deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete meeting note', error);
    res.status(500).json({ message: 'Failed to delete meeting note' });
  }
});

meetingsRouter.get('/:id', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) {
      return res.status(400).json({ message: 'Invalid meeting ID' });
    }

    const meetings = await storage.getAllMeetings();
    const meetingsArray = Array.isArray(meetings) ? meetings : [];
    const meeting = meetingsArray.find((item: any) => item.id === meetingId);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const meetingResponse = meetingsService.mapMeetingToResponse(meeting);

    // REFACTOR: Include projects from normalized meeting_projects table
    try {
      const projects = await meetingProjectService.getMeetingProjects(meetingId);
      res.json({
        ...meetingResponse,
        projects,
      });
    } catch (projectError) {
      logger.error('Failed to fetch meeting projects, returning meeting without projects', projectError);
      res.json(meetingResponse);
    }
  } catch (error) {
    logger.error('Failed to fetch meeting', error);
    res.status(500).json({ message: 'Failed to fetch meeting' });
  }
});

meetingsRouter.patch('/:id', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) {
      return res.status(400).json({ message: 'Invalid meeting ID' });
    }

    const updates = meetingsService.mapRequestToMeetingPayload(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updatedMeeting = await storage.updateMeeting(meetingId, updates);

    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting', error);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

meetingsRouter.patch('/:id/agenda', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) {
      return res.status(400).json({ message: 'Invalid meeting ID' });
    }

    const { agenda } = req.body;
    const updatedMeeting = await storage.updateMeetingAgenda(meetingId, agenda);

    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting agenda', error);
    res.status(500).json({ message: 'Failed to update meeting agenda' });
  }
});

meetingsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id, 10);
    if (isNaN(meetingId)) {
      return res.status(400).json({ message: 'Invalid meeting ID' });
    }

    const success = await storage.deleteMeeting(meetingId);

    if (!success) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete meeting', error);
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

// POST /:meetingId/projects/:projectId - Add project to meeting
meetingsRouter.post('/:meetingId/projects/:projectId', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.meetingId, 10);
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(meetingId) || isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid meeting or project ID' });
    }

    const {
      discussionPoints,
      questionsToAddress,
      status,
      includeInAgenda,
      agendaOrder,
      section,
    } = req.body;

    const meetingProject = await meetingProjectService.addProjectToMeeting({
      meetingId,
      projectId,
      discussionPoints,
      questionsToAddress,
      status,
      includeInAgenda,
      agendaOrder,
      section,
      addedBy: userId,
    });

    logger.info('Successfully added project to meeting', {
      meetingId,
      projectId,
      addedBy: userId,
    });

    res.status(201).json(meetingProject);
  } catch (error) {
    logger.error('Failed to add project to meeting', error);
    res.status(500).json({ message: 'Failed to add project to meeting' });
  }
});

// PATCH /:meetingId/projects/:projectId - Update meeting-project relationship
meetingsRouter.patch('/:meetingId/projects/:projectId', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.meetingId, 10);
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(meetingId) || isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid meeting or project ID' });
    }

    const updates = req.body;

    const updatedMeetingProject = await meetingProjectService.updateMeetingProject(
      meetingId,
      projectId,
      updates
    );

    if (!updatedMeetingProject) {
      return res.status(404).json({ message: 'Meeting-project relationship not found' });
    }

    logger.info('Successfully updated meeting-project relationship', {
      meetingId,
      projectId,
      updatedBy: userId,
    });

    res.json(updatedMeetingProject);
  } catch (error) {
    logger.error('Failed to update meeting-project relationship', error);
    res.status(500).json({ message: 'Failed to update meeting-project relationship' });
  }
});

// DELETE /:meetingId/projects/:projectId - Remove project from meeting
meetingsRouter.delete('/:meetingId/projects/:projectId', async (req, res) => {
  try {
    const userId = getUserId(req as any);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.meetingId, 10);
    const projectId = parseInt(req.params.projectId, 10);

    if (isNaN(meetingId) || isNaN(projectId)) {
      return res.status(400).json({ message: 'Invalid meeting or project ID' });
    }

    const success = await meetingProjectService.removeProjectFromMeeting(
      meetingId,
      projectId
    );

    if (!success) {
      return res.status(404).json({ message: 'Meeting-project relationship not found' });
    }

    logger.info('Successfully removed project from meeting', {
      meetingId,
      projectId,
      removedBy: userId,
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to remove project from meeting', error);
    res.status(500).json({ message: 'Failed to remove project from meeting' });
  }
});

// GET /:meetingId/projects - Get all projects in a meeting
meetingsRouter.get('/:meetingId/projects', async (req, res) => {
  try {
    const meetingId = parseInt(req.params.meetingId, 10);

    if (isNaN(meetingId)) {
      return res.status(400).json({ message: 'Invalid meeting ID' });
    }

    const projects = await meetingProjectService.getMeetingProjects(meetingId);

    logger.info('Successfully fetched meeting projects', {
      meetingId,
      count: projects.length,
    });

    res.json(projects);
  } catch (error) {
    logger.error('Failed to fetch meeting projects', error);
    res.status(500).json({ message: 'Failed to fetch meeting projects' });
  }
});

  return meetingsRouter;
}
