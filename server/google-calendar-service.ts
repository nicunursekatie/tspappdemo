import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { logger } from './utils/production-safe-logger';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  colorId?: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

export class GoogleCalendarService {
  private auth!: JWT;
  private calendar: any;

  constructor(private calendarId: string) {}

  private async initializeAuth() {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error('Missing Google service account credentials');
    }

    // Handle private key format (same as Google Sheets service)
    let cleanPrivateKey = privateKey;
    
    if (cleanPrivateKey.includes('\\n')) {
      cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
    }

    cleanPrivateKey = cleanPrivateKey
      .replace(/\\r\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // Handle single-line key format
    if (!cleanPrivateKey.includes('\n') && cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      const beginIndex = cleanPrivateKey.indexOf(beginMarker);
      const endIndex = cleanPrivateKey.indexOf(endMarker);

      if (beginIndex !== -1 && endIndex !== -1) {
        const keyContent = cleanPrivateKey
          .substring(beginIndex + beginMarker.length, endIndex)
          .trim();
        cleanPrivateKey = `${beginMarker}\n${keyContent}\n${endMarker}`;
      }
    }

    this.auth = new JWT({
      email: clientEmail,
      key: cleanPrivateKey,
      scopes: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ],
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async getEvents(timeMin?: Date, timeMax?: Date): Promise<CalendarEvent[]> {
    if (!this.calendar) {
      await this.initializeAuth();
    }

    const params: any = {
      calendarId: this.calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500, // Increase limit to fetch more events
    };

    if (timeMin) {
      params.timeMin = timeMin.toISOString();
    }

    if (timeMax) {
      params.timeMax = timeMax.toISOString();
    }

    const response = await this.calendar.events.list(params);
    const events = response.data.items || [];

    // Fetch color definitions from Google Calendar API
    const colors = await this.getColors();

    // Map events with their colors
    // Use person-based color assignment to ensure each person gets a unique color
    const availableColorIds = ['1', '2', '3', '4', '5', '6', '7', '9', '10', '11']; // Skip 8 (gray)

    // Extract person name from event summary for consistent color assignment
    const extractPersonName = (summary: string): string => {
      const lowerSummary = summary.toLowerCase();
      
      // Common patterns for unavailability events
      const patterns = [
        /^([^,\s]+)\s+(unavailable|out of town|unavail|away)/i,
        /^([^,\s]+)\s+(unavailable)/i,
        /^([^,\s]+)\s+(out of town)/i,
        /^([^,\s]+)\s+(unavail)/i,
        /^([^,\s]+)\s+(away)/i,
      ];
      
      for (const pattern of patterns) {
        const match = summary.match(pattern);
        if (match && match[1]) {
          return match[1].trim().toLowerCase();
        }
      }
      
      // If no pattern matches, use the first word as person name
      const firstWord = summary.split(/\s+/)[0];
      return firstWord ? firstWord.toLowerCase() : summary.toLowerCase();
    };

    // Create a mapping of person names to colors for consistency
    const personColorMap = new Map<string, string>();
    let colorIndex = 0;

    // First pass: collect all unique person names and assign colors
    const uniquePersons = new Set<string>();
    events.forEach((event: any) => {
      const personName = extractPersonName(event.summary || 'Untitled');
      uniquePersons.add(personName);
    });

    // Assign colors to each unique person
    Array.from(uniquePersons).forEach(personName => {
      const colorId = availableColorIds[colorIndex % availableColorIds.length];
      personColorMap.set(personName, colorId);
      colorIndex++;
      logger.log(`Assigned color ${colorId} to person: "${personName}"`);
    });

    const getColorForEvent = (event: any) => {
      const summary = event.summary || 'Untitled';
      const personName = extractPersonName(summary);
      
      // Get the assigned color for this person
      const colorId = personColorMap.get(personName) || availableColorIds[0];
      return colorId;
    };

    const mappedEvents = events.map((event: any) => {
      const colorId = getColorForEvent(event);
      const backgroundColor = colors.event?.[colorId]?.background || '#a4bdfc';
      const foregroundColor = colors.event?.[colorId]?.foreground || '#1d1d1d';

      // Debug logging to understand color assignment
      const personName = extractPersonName(event.summary || 'Untitled');
      logger.log(`Event: "${event.summary}" -> Person: "${personName}" -> Color: ${colorId} -> Background: ${backgroundColor}`);

      return {
        ...event,
        colorId,
        backgroundColor,
        foregroundColor,
      };
    });

    return mappedEvents;
  }

  private async getColors(): Promise<any> {
    if (!this.calendar) {
      await this.initializeAuth();
    }

    try {
      const response = await this.calendar.colors.get();
      logger.log('✅ Successfully fetched colors from Google Calendar API');
      return response.data;
    } catch (error: any) {
      logger.error('❌ Failed to fetch colors from Google Calendar API:', error.message);
      logger.log('📝 Using default color palette');
      // Return default Google Calendar colors with white text for better readability
      return {
        event: {
          '1': { background: '#a4bdfc', foreground: '#000000' }, // Light blue - dark text
          '2': { background: '#7ae7bf', foreground: '#000000' }, // Light green - dark text
          '3': { background: '#dbadff', foreground: '#000000' }, // Light purple - dark text
          '4': { background: '#ff887c', foreground: '#000000' }, // Light red - dark text
          '5': { background: '#fbd75b', foreground: '#000000' }, // Yellow - dark text
          '6': { background: '#ffb878', foreground: '#000000' }, // Orange - dark text
          '7': { background: '#46d6db', foreground: '#000000' }, // Cyan - dark text
          '8': { background: '#e1e1e1', foreground: '#000000' }, // Gray - dark text
          '9': { background: '#5484ed', foreground: '#ffffff' }, // Dark blue - white text
          '10': { background: '#51b749', foreground: '#ffffff' }, // Dark green - white text
          '11': { background: '#dc2127', foreground: '#ffffff' }, // Dark red - white text
        },
      };
    }
  }
}
