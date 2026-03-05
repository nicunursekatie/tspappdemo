import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { logger } from '../utils/production-safe-logger';

const router = Router();

// Get all meeting notes with optional filters
router.get('/', async (req, res) => {
  try {
    const { meetingId, projectId, type, status } = req.query;

    // Build filters object
    const filters: any = {};
    if (meetingId) filters.meetingId = Number(meetingId);
    if (projectId) filters.projectId = Number(projectId);
    if (type) filters.type = String(type);
    if (status) filters.status = String(status);

    // Use storage method with filters
    const notes = await storage.getMeetingNotesByFilters(filters);

    res.json(notes);
  } catch (error) {
    logger.error('Error fetching meeting notes:', error);
    res.status(500).json({ error: 'Failed to fetch meeting notes' });
  }
});

// Get single meeting note by ID
router.get('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const note = await storage.getMeetingNote(noteId);

    if (!note) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    res.json(note);
  } catch (error) {
    logger.error('Error fetching meeting note:', error);
    res.status(500).json({ error: 'Failed to fetch meeting note' });
  }
});

// Create new meeting note
router.post('/', async (req, res) => {
  try {
    const { projectId, meetingId, type, content, status } = req.body;

    // Validate required fields
    if (!content) {
      return res.status(400).json({ error: 'Note content is required' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Get user info from session
    const user = (req.session as any)?.user || (req as any).user;
    const userId = user?.id;
    const userName = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email;

    // Create the note object
    const noteData = {
      projectId: Number(projectId),
      meetingId: meetingId ? Number(meetingId) : null,
      type: type || 'meeting',
      content,
      status: status || 'active',
      createdBy: userId?.toString() || null,
      createdByName: userName || null,
    };

    // Save to database
    const savedNote = await storage.createMeetingNote(noteData);

    res.status(201).json(savedNote);
  } catch (error) {
    logger.error('Error creating meeting note:', error);
    res.status(500).json({ error: 'Failed to create meeting note' });
  }
});

// Update meeting note
router.patch('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Update in database
    const updatedNote = await storage.updateMeetingNote(noteId, updates);

    if (!updatedNote) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    res.json(updatedNote);
  } catch (error) {
    logger.error('Error updating meeting note:', error);
    res.status(500).json({ error: 'Failed to update meeting note' });
  }
});

// Delete meeting note
router.delete('/:id', async (req, res) => {
  try {
    const noteId = parseInt(req.params.id, 10);

    // Delete from database
    const success = await storage.deleteMeetingNote(noteId);

    if (!success) {
      return res.status(404).json({ error: 'Meeting note not found' });
    }

    res.json({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    logger.error('Error deleting meeting note:', error);
    res.status(500).json({ error: 'Failed to delete meeting note' });
  }
});

// Bulk update note status
router.patch('/bulk/status', async (req, res) => {
  try {
    const { noteIds, status } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs array is required' });
    }
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Update each note
    const updates = await Promise.all(
      noteIds.map(id => storage.updateMeetingNote(Number(id), { status }))
    );

    const successCount = updates.filter(note => note !== undefined).length;

    res.json({ 
      success: true, 
      message: `${successCount} note(s) updated`,
      updated: successCount 
    });
  } catch (error) {
    logger.error('Error bulk updating meeting notes:', error);
    res.status(500).json({ error: 'Failed to bulk update meeting notes' });
  }
});

// Bulk delete notes
router.delete('/bulk', async (req, res) => {
  try {
    const { noteIds } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs array is required' });
    }

    // Delete each note
    const deletions = await Promise.all(
      noteIds.map(id => storage.deleteMeetingNote(Number(id)))
    );

    const successCount = deletions.filter(success => success).length;

    res.json({ 
      success: true, 
      message: `${successCount} note(s) deleted`,
      deleted: successCount 
    });
  } catch (error) {
    logger.error('Error bulk deleting meeting notes:', error);
    res.status(500).json({ error: 'Failed to bulk delete meeting notes' });
  }
});

export default router;