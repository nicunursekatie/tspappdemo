/**
 * Event Requests - AI Assistant Routes
 *
 * Handles AI-powered features for event requests including:
 * - Date suggestions
 * - Intake assistance
 * - Event categorization
 *
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Enhanced logging function for activity tracking
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
};

// ============================================================================
// AI Assistant Routes
// ============================================================================

// AI Date Suggestion - Analyze possible dates and suggest optimal scheduling
router.post('/:id/ai-suggest-dates', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get flexibility options from request body
    const flexibilityOptions = {
      canChangeDayOfWeek: req.body?.canChangeDayOfWeek || false,
      canChangeWeek: req.body?.canChangeWeek || false,
      canChangeMonth: req.body?.canChangeMonth || false,
    };

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get all scheduled events for analysis
    const allEventRequests = await storage.getAllEventRequests();
    const scheduledEvents = allEventRequests.filter(e =>
      e.status === 'scheduled' && e.scheduledEventDate
    );

    // Import and call AI scheduling assistant with flexibility options
    const { suggestOptimalEventDate } = await import('../../services/ai-scheduling');
    const suggestion = await suggestOptimalEventDate(eventRequest, scheduledEvents, flexibilityOptions);

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI assistant to analyze dates for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName, flexibility: flexibilityOptions }
    );

    res.json(suggestion);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI date suggestion:', error);
    res.status(500).json({
      error: 'Failed to generate AI suggestion',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// AI Intake Assistant - Comprehensive analysis and suggestions for intake coordinators
router.post('/:id/ai-intake-assist', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Get all scheduled events for context (for date conflict analysis)
    const allEventRequests = await storage.getAllEventRequests();
    const scheduledEvents = allEventRequests.filter(e =>
      e.status === 'scheduled' && e.scheduledEventDate
    );

    // Import and call AI intake assistant
    const { analyzeEventRequest } = await import('../../services/ai-intake-assistant');
    const analysis = await analyzeEventRequest(eventRequest, scheduledEvents);

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI intake assistant for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName }
    );

    res.json(analysis);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI intake assistance:', error);
    res.status(500).json({
      error: 'Failed to generate AI assistance',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

// AI Event Categorization - Automatically categorize event based on organization and details
router.post('/:id/ai-categorize', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    // Check permissions
    if (!hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Get the event request
    const eventRequest = await storage.getEventRequestById(eventId);
    if (!eventRequest) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    // Import and call AI categorization service
    const { categorizeEventRequest } = await import('../../services/ai-event-categorization');
    const categorization = await categorizeEventRequest({
      organizationName: eventRequest.organizationName || '',
      organizationCategory: eventRequest.organizationCategory || undefined,
      description: eventRequest.message || undefined,
      estimatedSandwichCount: eventRequest.estimatedSandwichCount || undefined,
      eventType: eventRequest.organizationCategory || undefined,
      location: eventRequest.eventAddress || undefined,
      deliveryDestination: eventRequest.deliveryDestination || undefined,
    });

    // Persist the categorization to the database
    await storage.updateEventRequest(eventId, {
      autoCategories: {
        eventType: categorization.eventType,
        eventSize: categorization.eventSize,
        specialNeeds: categorization.specialNeeds,
        targetAudience: categorization.targetAudience,
        confidence: categorization.confidence,
        reasoning: categorization.reasoning,
        suggestedTags: categorization.suggestedTags,
      },
      categorizedAt: new Date(),
      categorizedBy: 'ai',
      updatedAt: new Date(),
    });

    // Log activity
    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_VIEW',
      `Used AI categorization for event request: ${eventId}`,
      { organizationName: eventRequest.organizationName, eventType: categorization.eventType }
    );

    res.json(categorization);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('❌ Error generating AI categorization:', error);
    res.status(500).json({
      error: 'Failed to generate AI categorization',
      message: err?.message || 'Unknown error occurred'
    });
  }
});

export default router;
