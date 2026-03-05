import { Router, Response } from 'express';
import { isAuthenticated } from '../auth';
import { storage } from '../storage-wrapper';
import { z } from 'zod';
import { insertMeetingNoteSchema, type MeetingNote } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';
import { safeAssign, validateNoPrototypePollution } from '../utils/object-utils';

// Type for project objects used in agenda compilation
interface AgendaProject {
  id?: number;
  title: string;
  status?: string;
  priority?: string;
  description?: string;
  discussionPoints?: string;
  decisionItems?: string;
  owner?: string;
  supportPeople?: string;
  tasks?: unknown[];
  attachments?: unknown[];
  reason?: string;
  reviewInNextMeeting?: boolean;
}

const router = Router();

// Get all meetings
router.get('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('[Meetings API] Getting all meetings');
    const meetings = await storage.getAllMeetings();
    
    // Ensure we always return an array
    const meetingsArray = Array.isArray(meetings) ? meetings : [];
    
    logger.log(`[Meetings API] Found ${meetingsArray.length} meetings`);
    logger.log('[Meetings API] Meetings data:', JSON.stringify(meetingsArray, null, 2));
    
    // Map database field names to client field names
    const mappedMeetings = meetingsArray.map(meeting => ({
      ...meeting,
      meetingDate: meeting.date, // Map date to meetingDate for client
      startTime: meeting.time,   // Map time to startTime for client
      meetingLink: meeting.location, // Map location to meetingLink for client
      agenda: meeting.finalAgenda,   // Map finalAgenda to agenda for client
    }));
    
    logger.log('[Meetings API] Mapped meetings for client:', JSON.stringify(mappedMeetings, null, 2));
    res.json(mappedMeetings);
  } catch (error) {
    logger.error('Failed to get meetings', error);
    logger.error('[Meetings API] Error fetching meetings:', error);
    // Return empty array on error to prevent filter errors
    res.json([]);
  }
});

// Get meetings by type
router.get('/type/:type', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type } = req.params;
    logger.log(`[Meetings API] Getting meetings by type: ${type}`);
    
    const meetings = await storage.getMeetingsByType(type);
    
    // Ensure we always return an array
    const meetingsArray = Array.isArray(meetings) ? meetings : [];
    
    logger.log(`[Meetings API] Found ${meetingsArray.length} meetings of type ${type}`);
    res.json(meetingsArray);
  } catch (error) {
    logger.error('Failed to get meetings by type', error);
    logger.error('[Meetings API] Error fetching meetings by type:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Get current meeting
router.get('/current', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('[Meetings API] Getting current meeting');
    
    const currentMeeting = await storage.getCurrentMeeting();
    
    if (!currentMeeting) {
      return res.status(404).json({ message: 'No current meeting found' });
    }
    
    logger.log(`[Meetings API] Found current meeting: ${currentMeeting.title}`);
    res.json(currentMeeting);
  } catch (error) {
    logger.error('Failed to get current meeting', error);
    logger.error('[Meetings API] Error fetching current meeting:', error);
    res.status(500).json({ message: 'Failed to get current meeting' });
  }
});

// Create a new meeting
router.post('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingData = req.body;
    logger.log(`[Meetings API] Creating new meeting: ${meetingData.title}`);
    logger.log('[Meetings API] Meeting data received:', JSON.stringify(meetingData, null, 2));

    // Map client field names to database field names
    const mappedMeetingData = {
      title: meetingData.title,
      type: meetingData.type || 'weekly', // Default to weekly if not specified
      date: meetingData.meetingDate || meetingData.date, // Map meetingDate to date
      time: meetingData.startTime || meetingData.time, // Map startTime to time
      location: meetingData.location || meetingData.meetingLink,
      description: meetingData.description,
      finalAgenda: meetingData.agenda,
      status: meetingData.status || 'planning', // Default to planning if not specified
    };

    logger.log('[Meetings API] Mapped meeting data:', JSON.stringify(mappedMeetingData, null, 2));

    const newMeeting = await storage.createMeeting(mappedMeetingData);
    
    logger.log(`[Meetings API] Created meeting with ID: ${newMeeting.id}`);
    logger.log('[Meetings API] Created meeting data:', JSON.stringify(newMeeting, null, 2));
    res.status(201).json(newMeeting);
  } catch (error) {
    logger.error('Failed to create meeting', error);
    logger.error('[Meetings API] Error creating meeting:', error);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// Update a meeting
router.patch('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    const updates = req.body;
    
    logger.log(`[Meetings API] Updating meeting ${meetingId}`);

    const updatedMeeting = await storage.updateMeeting(meetingId, updates);
    
    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    logger.log(`[Meetings API] Updated meeting ${meetingId}`);
    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting', error);
    logger.error('[Meetings API] Error updating meeting:', error);
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

// Update meeting agenda
router.patch('/:id/agenda', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    const { agenda } = req.body;
    
    logger.log(`[Meetings API] Updating agenda for meeting ${meetingId}`);

    const updatedMeeting = await storage.updateMeetingAgenda(meetingId, agenda);
    
    if (!updatedMeeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    logger.log(`[Meetings API] Updated agenda for meeting ${meetingId}`);
    res.json(updatedMeeting);
  } catch (error) {
    logger.error('Failed to update meeting agenda', error);
    logger.error('[Meetings API] Error updating meeting agenda:', error);
    res.status(500).json({ message: 'Failed to update meeting agenda' });
  }
});

// Delete a meeting
router.delete('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const meetingId = parseInt(req.params.id);
    logger.log(`[Meetings API] Deleting meeting ${meetingId}`);

    const success = await storage.deleteMeeting(meetingId);
    
    if (!success) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    logger.log(`[Meetings API] Deleted meeting ${meetingId}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete meeting', error);
    logger.error('[Meetings API] Error deleting meeting:', error);
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

// Simple One-Off Agenda Items - Fresh Implementation
// GET agenda items for a meeting
router.get('/agenda-items', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('🟢 Simple Agenda API - GET request:', req.query);
    const { meetingId } = req.query;
    
    if (!meetingId) {
      return res.json([]);
    }
    
    const items = await storage.getAllAgendaItems();
    const filteredItems = items.filter(item => item.meetingId === parseInt(meetingId));
    
    logger.log('✅ Simple Agenda API - Returning', filteredItems.length, 'items for meeting', meetingId);
    res.json(filteredItems);
  } catch (error) {
    logger.error('❌ Simple Agenda API - Error:', error);
    res.status(500).json({ message: 'Failed to fetch agenda items' });
  }
});

// POST create agenda item
router.post('/agenda-items', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('🟢 Simple Agenda API - POST request:', req.body);
    
    const { title, description, meetingId } = req.body;
    
    if (!title || !meetingId) {
      return res.status(400).json({ message: 'Title and meetingId are required' });
    }
    
    const newItem = await storage.createAgendaItem({
      title,
      description: description || '',
      meetingId: parseInt(meetingId),
      submittedBy: req.user?.email || 'unknown',
      status: 'pending'
    });
    
    logger.log('✅ Simple Agenda API - Created item:', newItem.id);
    res.status(201).json(newItem);
  } catch (error) {
    logger.error('❌ Simple Agenda API - Error:', error);
    res.status(500).json({ message: 'Failed to create agenda item' });
  }
});

// POST /api/meetings/finalize-agenda-pdf - Generate and download agenda PDF
router.post('/finalize-agenda-pdf', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('📄 Generating agenda PDF...');
    
    const agendaData = req.body;
    logger.log('Agenda data received:', JSON.stringify(agendaData, null, 2));
    
    // Import the PDF generator
    const { generateMeetingAgendaPDF } = await import('../meeting-agenda-pdf-generator');
    
    // Transform agenda data to meeting format for PDF generator
    const meetingData = {
      id: 1,
      title: `Meeting Agenda`,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      time: '13:30',
      type: 'core_team',
      description: 'Weekly agenda planning',
      location: 'Meeting location'
    };
    
    // Transform agenda projects to sections for PDF
    const agendaSections = [];
    
    // Add regular agenda projects
    if (agendaData.agendaProjects && agendaData.agendaProjects.length > 0) {
      agendaSections.push({
        id: 1,
        title: 'Needs Discussion',
        items: agendaData.agendaProjects.map((project: AgendaProject, index: number) => ({
          id: index + 1,
          title: project.title,
          description: project.discussionPoints || project.decisionItems || '',
          submittedBy: project.owner || 'Unknown',
          type: 'project',
          estimatedTime: '10 mins',
          project: {
            id: project.id || index + 1,
            title: project.title,
            status: project.status || 'pending',
            priority: project.priority || 'medium',
            description: project.description || '',
            reviewInNextMeeting: true,
            meetingDiscussionPoints: project.discussionPoints || '',
            meetingDecisionItems: project.decisionItems || '',
            supportPeople: project.supportPeople || '',
            assigneeName: project.owner || 'Unknown',
            tasks: project.tasks || [],
            attachments: project.attachments || []
          }
        }))
      });
    }
    
    // Add tabled projects if they exist
    if (agendaData.tabledProjects && agendaData.tabledProjects.length > 0) {
      agendaSections.push({
        id: agendaSections.length + 1,
        title: 'Tabled Items',
        items: agendaData.tabledProjects.map((project: AgendaProject, index: number) => ({
          id: index + 1,
          title: project.title,
          description: project.reason || 'No reason specified',
          submittedBy: project.owner || 'Unknown',
          type: 'tabled_project',
          estimatedTime: '5 mins',
          project: {
            id: project.id || index + 1000,
            title: project.title,
            status: 'tabled',
            priority: 'low',
            description: project.reason || 'No reason specified',
            reviewInNextMeeting: false,
            meetingDiscussionPoints: project.reason || '',
            meetingDecisionItems: '',
            supportPeople: project.supportPeople || '',
            assigneeName: project.owner || 'Unknown',
            tasks: [],
            attachments: []
          }
        }))
      });
    }
    
    // Add off-agenda items (fetch from database)
    try {
      const agendaItems = await storage.getAllAgendaItems();
      const currentMeetingItems = agendaItems.filter(item => 
        item.meetingId === 17 && item.status === 'pending'
      );
      
      if (currentMeetingItems.length > 0) {
        // Group by section
        const itemsBySection = currentMeetingItems.reduce((acc, item) => {
          const section = item.section || 'other_business';
          if (!acc[section]) acc[section] = [];
          acc[section].push(item);
          return acc;
        }, {} as Record<string, typeof currentMeetingItems>);

        // Add each section
        Object.entries(itemsBySection).forEach(([sectionName, items]) => {
          const sectionTitle = sectionName.replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
          
          agendaSections.push({
            id: agendaSections.length + 1,
            title: sectionTitle,
            items: items.map((item, index: number) => ({
              id: index + 1,
              title: item.title,
              description: item.description || '',
              submittedBy: item.submittedBy || 'Unknown',
              type: 'agenda_item',
              estimatedTime: '5 mins'
            }))
          });
        });
      }
    } catch (error) {
      logger.error('Error fetching agenda items:', error);
    }
    
    const compiledAgenda = {
      id: 1,
      meetingId: 1,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      status: 'draft',
      sections: agendaSections
    };
    
    // Create the agenda object for PDF generation
    const agenda = {
      title: `Meeting Agenda`,
      date: agendaData.meetingDate || new Date().toISOString().split('T')[0],
      startTime: '13:30',
      location: 'Meeting location',
      description: 'Weekly agenda planning',
      sections: agendaSections
    };
    
    const pdfBuffer = await generateMeetingAgendaPDF(agenda);
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="agenda.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the PDF
    res.send(pdfBuffer);
    logger.log('✅ Agenda PDF generated and sent successfully');
    
  } catch (error) {
    logger.error('Error generating agenda PDF:', error);
    res.status(500).json({ error: 'Failed to generate agenda PDF' });
  }
});

// GET /api/meetings/:id/download-pdf - Download existing meeting PDF
router.get('/:id/download-pdf', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meetingId = parseInt(req.params.id);
    logger.log('📄 Downloading PDF for meeting:', meetingId);
    
    // Fetch the meeting from storage
    const meeting = await storage.getMeeting(meetingId);
    
    if (!meeting) {
      return res.status(404).json({ 
        error: 'Meeting not found',
        message: `No meeting found with ID ${meetingId}`
      });
    }
    
    // Try to fetch the compiled agenda for the meeting
    let compiledAgenda;
    try {
      const agendas = await storage.getCompiledAgendasByMeeting(meetingId);
      if (agendas && agendas.length > 0) {
        // Get the most recent compiled agenda
        compiledAgenda = agendas[0];
        logger.log('📋 Found compiled agenda for meeting:', compiledAgenda.id);
      }
    } catch (err) {
      logger.log('ℹ️ No compiled agenda found for meeting, will use meeting details only');
    }
    
    // Import the PDF generator
    const { generateMeetingMinutesPDF } = await import('../meeting-minutes-pdf-generator');
    
    // Generate the PDF
    const pdfBuffer = await generateMeetingMinutesPDF(meeting, compiledAgenda);
    
    // Create a safe filename from the meeting title and date
    const safeTitle = meeting.title
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase()
      .substring(0, 50);
    const meetingDate = new Date(meeting.date).toISOString().split('T')[0];
    const filename = `meeting-minutes-${safeTitle}-${meetingDate}.pdf`;
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // Send the PDF
    res.send(pdfBuffer);
    logger.log('✅ Meeting minutes PDF generated and sent successfully');
    
  } catch (error) {
    logger.error('Error downloading meeting PDF:', error);
    res.status(500).json({ error: 'Failed to download meeting PDF' });
  }
});

// Meeting Notes API Endpoints

// GET /api/meetings/notes - Get all meeting notes with optional query filters
router.get('/notes', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.log('[Meeting Notes API] Getting meeting notes with filters:', req.query);
    const { projectId, meetingId, type, status } = req.query;

    const filters: Partial<MeetingNote> = {};
    if (projectId) filters.projectId = parseInt(projectId as string);
    if (meetingId) filters.meetingId = parseInt(meetingId as string);
    if (type) filters.type = type as string;
    if (status) filters.status = status as string;

    const notes = Object.keys(filters).length > 0
      ? await storage.getMeetingNotesByFilters(filters)
      : await storage.getAllMeetingNotes();

    // Log detailed info about notes
    logger.log(`[Meeting Notes API] Found ${notes.length} meeting notes`);
    if (notes.length > 0) {
      logger.log('[Meeting Notes API] Sample of notes (first 3):');
      notes.slice(0, 3).forEach(note => {
        logger.log({
          id: note.id,
          projectId: note.projectId,
          meetingId: note.meetingId,
          type: note.type,
          status: note.status,
          createdAt: note.createdAt,
          contentPreview: note.content.substring(0, 100)
        });
      });
    }

    res.json(notes);
  } catch (error) {
    logger.error('Failed to get meeting notes', error);
    logger.error('[Meeting Notes API] Error fetching meeting notes:', error);
    res.status(500).json({ message: 'Failed to get meeting notes' });
  }
});

// POST /api/meetings/notes - Create a new meeting note
router.post('/notes', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    logger.log('[Meeting Notes API] Creating new meeting note:', req.body);

    const noteData = insertMeetingNoteSchema.parse(req.body);

    // Add creator information
    noteData.createdBy = user.id;
    noteData.createdByName = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

    logger.log('[Meeting Notes API] Note data after validation and user info:', {
      projectId: noteData.projectId,
      meetingId: noteData.meetingId,
      type: noteData.type,
      status: noteData.status,
      createdBy: noteData.createdBy,
      createdByName: noteData.createdByName,
      contentLength: noteData.content?.length || 0
    });

    const note = await storage.createMeetingNote(noteData);

    logger.log(`[Meeting Notes API] ✅ Successfully created meeting note with ID: ${note.id}, meetingId: ${note.meetingId}, status: ${note.status}`);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[Meeting Notes API] Validation error:', error.errors);
      return res.status(400).json({
        message: 'Invalid meeting note data',
        errors: error.errors
      });
    }
    logger.error('Failed to create meeting note', error);
    logger.error('[Meeting Notes API] ❌ Error creating meeting note:', error);
    res.status(500).json({ message: 'Failed to create meeting note' });
  }
});

// GET /api/meetings/notes/:id - Get a single meeting note by ID
router.get('/notes/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    logger.log(`[Meeting Notes API] Getting meeting note ${id}`);
    
    const note = await storage.getMeetingNote(id);
    if (!note) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }

    // TODO: Add joined data (projectTitle, meetingTitle) if needed by frontend
    logger.log(`[Meeting Notes API] Found meeting note ${id}`);
    res.json(note);
  } catch (error) {
    logger.error('Failed to get meeting note', error);
    logger.error('[Meeting Notes API] Error fetching meeting note:', error);
    res.status(500).json({ message: 'Failed to get meeting note' });
  }
});

// PATCH /api/meetings/notes/:id - Update a meeting note
router.patch('/notes/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    logger.log(`[Meeting Notes API] Updating meeting note ${id}`, req.body);

    // Validate against prototype pollution attempts
    try {
      validateNoPrototypePollution(req.body);
    } catch (error) {
      logger.error('Prototype pollution attempt detected in meeting note update', {
        userId: user.id,
        noteId: id,
        error
      });
      return res.status(400).json({
        message: 'Invalid request: prohibited property names detected'
      });
    }

    // Validate that only allowed fields are being updated (using safe assignment)
    const allowedUpdates = ['content', 'type', 'status'];
    const updates: Partial<MeetingNote> = {};
    safeAssign(updates, req.body, allowedUpdates);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updatedNote = await storage.updateMeetingNote(id, updates);
    if (!updatedNote) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }

    logger.log(`[Meeting Notes API] Updated meeting note ${id}`);
    res.json(updatedNote);
  } catch (error) {
    logger.error('Failed to update meeting note', error);
    logger.error('[Meeting Notes API] Error updating meeting note:', error);
    res.status(500).json({ message: 'Failed to update meeting note' });
  }
});

// DELETE /api/meetings/notes/:id - Delete a meeting note
router.delete('/notes/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid note ID' });
    }

    logger.log(`[Meeting Notes API] Deleting meeting note ${id}`);

    const success = await storage.deleteMeetingNote(id);
    
    if (!success) {
      return res.status(404).json({ message: 'Meeting note not found' });
    }
    
    logger.log(`[Meeting Notes API] Deleted meeting note ${id}`);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete meeting note', error);
    logger.error('[Meeting Notes API] Error deleting meeting note:', error);
    res.status(500).json({ message: 'Failed to delete meeting note' });
  }
});

export default router;
