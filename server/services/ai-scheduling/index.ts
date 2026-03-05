import OpenAI from 'openai';
import type { EventRequest } from '@shared/schema';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface NearbyEvent {
  organizationName: string;
  date: string;
  estimatedSandwichCount: number;
}

interface DateAnalysis {
  date: string;
  dayOfWeek: string;
  weekStarting: string;
  totalScheduledSandwiches: number;
  eventCount: number;
  isOptimal: boolean;
  nearbyEvents: NearbyEvent[];
}

interface AiDateSuggestion {
  recommendedDate: string;
  reasoning: string;
  dateAnalysis: DateAnalysis[];
  confidence: 'high' | 'medium' | 'low';
  originallyRequestedDate: string | null;
}

interface OpenAiDateResponse {
  recommendedDate: string;
  reasoning: string;
  confidence: number;
}

interface FlexibilityOptions {
  canChangeDayOfWeek: boolean;
  canChangeWeek: boolean;
  canChangeMonth: boolean;
}

/**
 * Analyzes possible event dates and suggests the optimal date
 * based on current scheduled events and sandwich distribution
 */
export async function suggestOptimalEventDate(
  eventRequest: EventRequest,
  allScheduledEvents: EventRequest[],
  flexibilityOptions?: FlexibilityOptions
): Promise<AiDateSuggestion> {
  // Extract all possible dates from the event request
  const possibleDates = extractPossibleDates(eventRequest, flexibilityOptions);
  
  if (possibleDates.length === 0) {
    throw new Error('No dates found in event request');
  }

  // Analyze each possible date
  const dateAnalyses = possibleDates.map(date => analyzeDateOption(date, allScheduledEvents));

  // Create prompt for OpenAI with flexibility context
  const prompt = buildPrompt(eventRequest, dateAnalyses, flexibilityOptions);

  // Call OpenAI for intelligent recommendation with structured JSON output
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for The Sandwich Project, a nonprofit that coordinates volunteers to make sandwiches for people experiencing food insecurity. Your goal is to help analyze their requested event date and suggest alternatives only when needed.

CRITICAL CONSTRAINT: You may ONLY recommend dates on or after their originally requested date. NEVER recommend a date before what they requested.

Most event requests are NOT flexible, so:
1. Start by analyzing what's happening on their requested date
2. If their requested date looks fine (fewer than 4 events that week, under 4,000 sandwiches), recommend it
3. Only suggest an alternative if their requested date is very busy or creates an imbalance
4. All alternatives must be on or after their requested date - never suggest earlier dates
5. Explain what events are already scheduled that week so they understand the context

When suggesting alternatives, consider:
- Balance - Prefer weeks with fewer scheduled sandwiches
- Distribution - Avoid clustering too many events in one week  
- Nearby dates - Only suggest dates close to their request (within 1-3 days) and AFTER their request
- Impact - Help maintain steady sandwich production toward the 500,000 annual goal

You must respond with a JSON object containing exactly these fields:
- recommendedDate: The date in YYYY-MM-DD format that you recommend (MUST be on or after their requested date!)
- reasoning: A clear explanation focusing on what's happening that week and why you're recommending this date (2-3 sentences)
- confidence: A number from 0-100 indicating your confidence in this recommendation`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content || '';

    // Log the raw AI response for debugging
    logger.log(`Raw AI response: ${aiResponse}`);

    // Parse the JSON response from OpenAI (with error handling)
    let parsedResponse: OpenAiDateResponse;
    try {
      parsedResponse = parseJsonStrict<OpenAiDateResponse>(aiResponse, 'OpenAI API response');
    } catch (error) {
      logger.error('Failed to parse OpenAI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: aiResponse.substring(0, 200)
      });
      throw new Error('AI scheduling service returned invalid JSON response');
    }

    // Log the parsed response
    logger.log(`Parsed AI response: ${JSON.stringify(parsedResponse)}`);

    // Validate the response has required fields
    if (!parsedResponse.recommendedDate || !parsedResponse.reasoning || typeof parsedResponse.confidence !== 'number') {
      logger.error(`Invalid AI response structure. recommendedDate: ${parsedResponse.recommendedDate}, reasoning: ${parsedResponse.reasoning}, confidence: ${parsedResponse.confidence}`);
      throw new Error('Invalid AI response structure');
    }

    // Normalize the AI-recommended date to YYYY-MM-DD format
    // AI might return "Wednesday, December 3, 2025" or "2025-12-03T00:00:00.000Z" or "2025-12-03"
    let normalizedRecommendedDate = parsedResponse.recommendedDate;
    
    // Try to parse it as a date and convert to YYYY-MM-DD
    const parsedDate = new Date(normalizedRecommendedDate);
    if (!isNaN(parsedDate.getTime())) {
      normalizedRecommendedDate = parsedDate.toISOString().split('T')[0];
    } else {
      // If parsing fails, try to extract YYYY-MM-DD pattern
      const dateMatch = normalizedRecommendedDate.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        normalizedRecommendedDate = dateMatch[0];
      }
    }
    
    logger.log(`Normalized recommended date: ${normalizedRecommendedDate}`);

    // Validate the recommended date is one of the available options
    const isValidDate = dateAnalyses.some(analysis => analysis.date === normalizedRecommendedDate);
    if (!isValidDate) {
      logger.warn(`AI recommended date ${normalizedRecommendedDate} is not in available options, falling back to heuristic`);
      logger.warn(`Available options: ${dateAnalyses.map(d => d.date).join(', ')}`);
      throw new Error('AI recommended date not in available options');
    }

    // CRITICAL VALIDATION: Ensure recommended date is not before the requested date
    const desiredDate = eventRequest.desiredEventDate;
    if (desiredDate) {
      // Convert desiredDate to string format for comparison
      const desiredDateString = typeof desiredDate === 'string' 
        ? desiredDate 
        : desiredDate.toISOString().split('T')[0];
      
      if (normalizedRecommendedDate < desiredDateString) {
        logger.error(`AI recommended date ${normalizedRecommendedDate} is BEFORE requested date ${desiredDateString}, falling back to heuristic`);
        throw new Error('AI recommended date before requested date - this should never happen');
      }
    }

    // Convert numeric confidence (0-100) to categorical
    const confidence: 'high' | 'medium' | 'low' = 
      parsedResponse.confidence >= 70 ? 'high' :
      parsedResponse.confidence >= 40 ? 'medium' : 'low';

    logger.log(`AI scheduling recommendation: ${normalizedRecommendedDate} (confidence: ${parsedResponse.confidence})`);

    return {
      recommendedDate: normalizedRecommendedDate,
      reasoning: parsedResponse.reasoning,
      dateAnalysis: dateAnalyses,
      confidence,
      originallyRequestedDate: eventRequest.desiredEventDate || null,
    };
  } catch (error) {
    // Log the error and fall back to heuristic-based recommendation
    logger.error('OpenAI scheduling failed, falling back to heuristic', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      eventRequestId: eventRequest.id,
      hasApiKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      apiKeyLength: process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.length || 0,
    });
    logger.error('❌ OpenAI API Error Details:', error);
    
    const fallbackDate = determineRecommendedDateHeuristic(dateAnalyses);
    const fallbackConfidence = calculateConfidence(dateAnalyses);

    return {
      recommendedDate: fallbackDate,
      reasoning: 'Automatic recommendation based on balancing sandwich production across weeks. (AI suggestion unavailable)',
      dateAnalysis: dateAnalyses,
      confidence: fallbackConfidence,
      originallyRequestedDate: eventRequest.desiredEventDate || null,
    };
  }
}

/**
 * Extracts all possible dates from an event request based on flexibility options
 * Focus on requested date + alternatives based on coordinator-specified flexibility
 */
function extractPossibleDates(eventRequest: EventRequest, flexibilityOptions?: FlexibilityOptions): string[] {
  const dates: string[] = [];
  const desiredDate = eventRequest.desiredEventDate;

  // If no desired date, we can't suggest alternatives
  if (!desiredDate) {
    return dates;
  }

  // Convert desired date to string format (YYYY-MM-DD)
  const desiredDateString = typeof desiredDate === 'string' 
    ? desiredDate 
    : desiredDate.toISOString().split('T')[0];

  // Add the desired event date (primary focus)
  dates.push(desiredDateString);

  const baseDate = new Date(desiredDate);
  const flexibility = flexibilityOptions || { canChangeDayOfWeek: false, canChangeWeek: false, canChangeMonth: false };
  
  logger.log(`Flexibility options - canChangeDayOfWeek: ${flexibility.canChangeDayOfWeek}, canChangeWeek: ${flexibility.canChangeWeek}, canChangeMonth: ${flexibility.canChangeMonth}`);

  // Case 1: Can change day of week - Analyze all 7 days in the same week
  if (flexibility.canChangeDayOfWeek) {
    logger.log(`Analyzing all days in the requested week`);
    const dayOfWeek = baseDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    // Add all other days in the week
    for (let i = -dayOfWeek; i <= (6 - dayOfWeek); i++) {
      if (i === 0) continue; // Skip the original date (already added)
      const date = new Date(baseDate);
      date.setUTCDate(date.getUTCDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      if (dateStr >= desiredDateString && !dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    }
  }

  // Case 2: Can change week - Analyze 2-4 weeks around the requested date
  if (flexibility.canChangeWeek) {
    logger.log(`Analyzing multiple weeks around the requested date`);
    const weeksToAnalyze = [7, 14, 21, 28]; // 1, 2, 3, 4 weeks later
    weeksToAnalyze.forEach(days => {
      const futureDate = new Date(baseDate);
      futureDate.setUTCDate(futureDate.getUTCDate() + days);
      const dateStr = futureDate.toISOString().split('T')[0];
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    });
  }

  // Case 3: Can change month - Analyze 5-8 weeks into the future
  if (flexibility.canChangeMonth) {
    logger.log(`Analyzing extended date range (different months)`);
    const daysToAdd = [7, 14, 21, 28, 35, 42, 49, 56]; // Up to 8 weeks
    daysToAdd.forEach(days => {
      const futureDate = new Date(baseDate);
      futureDate.setUTCDate(futureDate.getUTCDate() + days);
      const dateStr = futureDate.toISOString().split('T')[0];
      if (!dates.includes(dateStr)) {
        dates.push(dateStr);
      }
    });
  }

  // If no flexibility specified, add just 1-2 nearby alternatives
  if (!flexibility.canChangeDayOfWeek && !flexibility.canChangeWeek && !flexibility.canChangeMonth) {
    logger.log(`No flexibility specified - analyzing 2 nearby dates`);
    const dayAfter = new Date(baseDate);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    dates.push(dayAfter.toISOString().split('T')[0]);
    
    const threeDaysLater = new Date(baseDate);
    threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
    dates.push(threeDaysLater.toISOString().split('T')[0]);
  }
  
  logger.log(`Final extracted dates: ${dates.join(', ')}`);

  // Add backup dates if explicitly provided (must be on or after desired date)
  if (eventRequest.backupDates && eventRequest.backupDates.length > 0) {
    eventRequest.backupDates.forEach(backupDate => {
      if (!dates.includes(backupDate) && backupDate >= desiredDateString) {
        dates.push(backupDate);
      }
    });
  }

  // CRITICAL: Filter out any dates before the requested date and sort them
  return dates.filter(date => date && date >= desiredDateString).sort();
}

/**
 * Extracts dates from natural language text
 */
function extractDatesFromText(text: string): string[] {
  const dates: string[] = [];
  
  // Simple date patterns - can be enhanced
  const datePatterns = [
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, // MM/DD/YYYY or M/D/YY
    /\b(\d{1,2}-\d{1,2}-\d{2,4})\b/g,   // MM-DD-YYYY
  ];

  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  });

  return dates;
}

/**
 * Analyzes a specific date option against scheduled events
 */
function analyzeDateOption(date: string, scheduledEvents: EventRequest[]): DateAnalysis {
  const targetDate = new Date(date);
  const weekStart = getWeekStart(targetDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get day of week - use Eastern Time for consistent display
  const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });

  // Find all events in the same week
  const eventsInWeek = scheduledEvents.filter(event => {
    if (!event.scheduledEventDate) return false;
    const eventDate = new Date(event.scheduledEventDate);
    return eventDate >= weekStart && eventDate < weekEnd;
  });

  // Calculate total sandwiches for the week
  const totalSandwiches = eventsInWeek.reduce((sum, event) => {
    return sum + (event.estimatedSandwichCount || 0);
  }, 0);

  // Build nearby events list and sort by date
  const nearbyEvents: NearbyEvent[] = eventsInWeek
    .map(event => ({
      organizationName: event.organizationName || 'Unknown Organization',
      date: event.scheduledEventDate!,
      estimatedSandwichCount: event.estimatedSandwichCount || 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine if this is an optimal choice (fewer events = better)
  const isOptimal = eventsInWeek.length <= 2 && totalSandwiches < 5000;

  return {
    date,
    dayOfWeek,
    weekStarting: weekStart.toISOString().split('T')[0],
    totalScheduledSandwiches: totalSandwiches,
    eventCount: eventsInWeek.length,
    isOptimal,
    nearbyEvents,
  };
}

/**
 * Gets the Monday of the week for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Builds the prompt for OpenAI
 */
function buildPrompt(eventRequest: EventRequest, dateAnalyses: DateAnalysis[], flexibilityOptions?: FlexibilityOptions): string {
  const requestedDate = eventRequest.desiredEventDate
    ? (
        typeof eventRequest.desiredEventDate === 'string'
          ? new Date(eventRequest.desiredEventDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
          : new Date(eventRequest.desiredEventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })
      )
    : 'Not specified';

  // Convert desiredEventDate to string for comparison
  const desiredDateString = eventRequest.desiredEventDate
    ? (typeof eventRequest.desiredEventDate === 'string' 
        ? eventRequest.desiredEventDate 
        : eventRequest.desiredEventDate.toISOString().split('T')[0])
    : null;

  const flexibility = flexibilityOptions || { canChangeDayOfWeek: false, canChangeWeek: false, canChangeMonth: false };
  
  // Build flexibility context
  const flexibilityContext = [];
  if (flexibility.canChangeDayOfWeek) flexibilityContext.push('change day of the week (e.g., Tuesday → Friday)');
  if (flexibility.canChangeWeek) flexibilityContext.push('move to a different week in the same month');
  if (flexibility.canChangeMonth) flexibilityContext.push('move to a completely different month');
  
  const flexibilityText = flexibilityContext.length > 0
    ? `\n\n✅ FLEXIBILITY CONFIRMED BY COORDINATOR:\nThe organization can: ${flexibilityContext.join(', ')}.\nYou should actively leverage this flexibility to find the optimal date that balances our workload.`
    : `\n\n⚠️ LIMITED FLEXIBILITY:\nThe coordinator has not confirmed any flexibility. Prefer their originally requested date unless it creates serious operational issues.`;

  const organizationInfo = `
Organization: ${eventRequest.organizationName}
${eventRequest.department ? `Department: ${eventRequest.department}` : ''}
Estimated Participants: ${eventRequest.estimatedSandwichCount || 'Not specified'}
Originally Requested Date: ${requestedDate}${flexibilityText}
${eventRequest.message ? `\n\nNOTE FROM SUBMISSION:\n"${eventRequest.message}"` : ''}
`.trim();

  const dateOptions = dateAnalyses.map((analysis, idx) => {
    const isRequestedDate = analysis.date === desiredDateString;
    // Parse dates at noon to avoid timezone edge cases
    return `
Option ${idx + 1}: ${new Date(analysis.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })}${isRequestedDate ? ' [ORIGINALLY REQUESTED]' : ''}
  - Week of: ${new Date(analysis.weekStarting + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}
  - Events already scheduled that week: ${analysis.eventCount}
  - Total sandwiches scheduled that week: ${analysis.totalScheduledSandwiches.toLocaleString()}
  - Status: ${analysis.isOptimal ? '✓ Good balance' : '⚠ Busy week'}
`.trim();
  }).join('\n\n');

  return `${organizationInfo}

AVAILABLE DATE OPTIONS (all on or after their requested date):
${dateOptions}

CRITICAL CONSTRAINTS:
- You may ONLY recommend dates on or after their originally requested date (${requestedDate})
- Consider the flexibility confirmed by the coordinator above

YOUR MISSION:
1. **Use flexibility wisely** - If the coordinator confirmed flexibility, actively recommend a better date that balances our workload. If no flexibility, prefer their requested date.
2. **Balance sandwich production** - Spread events across weeks to avoid overwhelming volunteers
3. **Avoid busy weeks** - Weeks with 8+ events or 5,000+ sandwiches are very challenging for our team
4. **Consider the context** - Read any notes from the submission for additional context

Provide a clear recommendation with specific reasoning.`;
}

/**
 * Checks if a date is a major holiday that should be avoided
 */
function isHoliday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const month = date.getUTCMonth() + 1; // 0-indexed
  const day = date.getUTCDate();
  
  // Major US holidays to avoid
  const holidays = [
    { month: 1, day: 1 },    // New Year's Day
    { month: 7, day: 4 },    // Independence Day
    { month: 12, day: 24 },  // Christmas Eve
    { month: 12, day: 25 },  // Christmas Day
    { month: 12, day: 31 },  // New Year's Eve
    { month: 11, day: 26 },  // Day after Thanksgiving (approximate)
    { month: 11, day: 27 },  // Day after Thanksgiving (approximate)
    { month: 11, day: 28 },  // Day after Thanksgiving (approximate)
  ];
  
  return holidays.some(h => h.month === month && h.day === day);
}

/**
 * Determines the recommended date using heuristics (fallback method)
 * Used when AI recommendation is unavailable or invalid
 */
function determineRecommendedDateHeuristic(dateAnalyses: DateAnalysis[]): string {
  // Filter out holidays first
  const nonHolidayDates = dateAnalyses.filter(d => !isHoliday(d.date));
  
  // If all dates are holidays (unlikely), use the original list
  const datesToSort = nonHolidayDates.length > 0 ? nonHolidayDates : dateAnalyses;
  
  // Find the optimal date (fewest events + sandwiches)
  const sorted = datesToSort.sort((a, b) => {
    // Prioritize weeks with fewer events
    if (a.eventCount !== b.eventCount) {
      return a.eventCount - b.eventCount;
    }
    // Then by total sandwiches
    return a.totalScheduledSandwiches - b.totalScheduledSandwiches;
  });

  return sorted[0].date;
}

/**
 * Calculates confidence level based on date analysis variance
 */
function calculateConfidence(dateAnalyses: DateAnalysis[]): 'high' | 'medium' | 'low' {
  if (dateAnalyses.length === 1) return 'low';

  const eventCounts = dateAnalyses.map(d => d.eventCount);
  const sandwichCounts = dateAnalyses.map(d => d.totalScheduledSandwiches);

  const maxEvents = Math.max(...eventCounts);
  const minEvents = Math.min(...eventCounts);
  const maxSandwiches = Math.max(...sandwichCounts);
  const minSandwiches = Math.min(...sandwichCounts);

  // High confidence if there's a clear winner
  if (maxEvents - minEvents >= 2 || maxSandwiches - minSandwiches >= 3000) {
    return 'high';
  }

  // Medium confidence if moderate difference
  if (maxEvents - minEvents >= 1 || maxSandwiches - minSandwiches >= 1000) {
    return 'medium';
  }

  return 'low';
}
