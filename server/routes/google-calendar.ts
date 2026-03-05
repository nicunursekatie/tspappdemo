import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { GoogleCalendarService } from '../google-calendar-service';
import { logger } from '../utils/production-safe-logger';

export function createGoogleCalendarRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  // Calendar ID from environment or hardcoded
  const CALENDAR_ID = '0813cd575e262fbc020927f88f1fd5a1906f5bd9b2f27a66a4920235939e5ff4@group.calendar.google.com';

  router.get('/events', isAuthenticated, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const calendarService = new GoogleCalendarService(CALENDAR_ID);
    
    const timeMin = startDate ? new Date(startDate as string) : new Date();
    const timeMax = endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    const events = await calendarService.getEvents(timeMin, timeMax);
    
    res.json(events);
  } catch (error: any) {
    logger.error('Error fetching calendar events:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calendar events',
      message: error.message 
    });
  }
});

  return router;
}

