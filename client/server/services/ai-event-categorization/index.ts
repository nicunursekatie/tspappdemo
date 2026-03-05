import OpenAI from 'openai';
import type { EventRequest } from '@shared/schema';
import { logger } from '../../utils/production-safe-logger';
import { parseJsonStrict } from '../../utils/safe-json';

// Lazy-initialize OpenAI client to avoid crashing app if API key is not configured
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required for event categorization');
  }

  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }

  return openai;
}

// Event categorization result
export interface EventCategorizationResult {
  eventType: 'corporate' | 'school' | 'nonprofit' | 'community' | 'religious' | 'government' | 'other';
  eventSize: 'small' | 'medium' | 'large' | 'extra_large';
  specialNeeds: string[];
  targetAudience: string;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  suggestedTags?: string[];
}

// Input data for categorization
export interface CategorizationInput {
  organizationName: string;
  organizationCategory?: string;
  description?: string;
  estimatedSandwichCount?: number;
  eventType?: string;
  location?: string;
  deliveryDestination?: string;
}

/**
 * Categorize an event request using AI to extract key characteristics
 */
export async function categorizeEventRequest(
  input: CategorizationInput
): Promise<EventCategorizationResult> {
  const startTime = Date.now();

  try {
    logger.info('Starting AI event categorization', {
      organizationName: input.organizationName,
      sandwichCount: input.estimatedSandwichCount,
    });

    // Build context string
    const contextParts = [];
    contextParts.push(`Organization: ${input.organizationName || 'Unknown'}`);
    if (input.organizationCategory) {
      contextParts.push(`Category: ${input.organizationCategory}`);
    }
    if (input.description) {
      contextParts.push(`Description: ${input.description}`);
    }
    if (input.estimatedSandwichCount) {
      contextParts.push(`Estimated sandwiches: ${input.estimatedSandwichCount}`);
    }
    if (input.eventType) {
      contextParts.push(`Event type: ${input.eventType}`);
    }
    if (input.location) {
      contextParts.push(`Location: ${input.location}`);
    }
    if (input.deliveryDestination) {
      contextParts.push(`Delivery to: ${input.deliveryDestination}`);
    }

    const contextString = contextParts.join('\n');

    // Call OpenAI API
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an intelligent categorization assistant for The Sandwich Project, a nonprofit that distributes sandwiches to people in need.

Your task is to analyze event request information and categorize it to help coordinators better understand and manage events.

CATEGORIZATION GUIDELINES:

**Event Type:**
- corporate: Business/company events, corporate volunteer days, workplace initiatives
- school: K-12 schools, universities, educational institutions
- nonprofit: Other charitable organizations, community services, shelters
- community: Community centers, neighborhood associations, public events
- religious: Churches, synagogues, mosques, faith-based organizations
- government: Government agencies, municipal programs, public services
- other: Events that don't fit above categories

**Event Size (based on sandwich count):**
- small: 1-50 sandwiches
- medium: 51-150 sandwiches
- large: 151-300 sandwiches
- extra_large: 301+ sandwiches

**Special Needs (select all that apply):**
- dietary: Mentions dietary restrictions, allergies, vegetarian, halal, kosher, etc.
- refrigeration: Needs refrigeration, lacks storage, special storage requirements
- delivery: Requires delivery service, specific delivery instructions
- volunteers: Needs volunteer support, mentions volunteer coordination
- speakers: Requests speaker or presentation
- drivers: Needs transportation assistance
- setup: Requires setup support, table arrangements, etc.
- timing: Time-sensitive, specific timing requirements

**Target Audience:** Brief description of who will receive the sandwiches (e.g., "homeless individuals", "elementary students", "hospital staff", "seniors")

Return your analysis as a JSON object with this structure:
{
  "eventType": "corporate|school|nonprofit|community|religious|government|other",
  "eventSize": "small|medium|large|extra_large",
  "specialNeeds": ["array of applicable needs"],
  "targetAudience": "brief description",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of categorization",
  "suggestedTags": ["array of 2-4 relevant tags for filtering"]
}`,
        },
        {
          role: 'user',
          content: `Please categorize this event request:\n\n${contextString}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent categorization
      max_tokens: 500,
    });

    const responseContent = completion.choices[0].message.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    // Parse and validate response
    const result = parseJsonStrict<EventCategorizationResult>(responseContent);

    // Validate required fields
    if (!result.eventType || !result.eventSize || !result.targetAudience) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Ensure confidence is between 0 and 1
    result.confidence = Math.max(0, Math.min(1, result.confidence || 0.7));

    const duration = Date.now() - startTime;
    logger.info('AI event categorization completed', {
      organizationName: input.organizationName,
      eventType: result.eventType,
      eventSize: result.eventSize,
      confidence: result.confidence,
      duration,
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('AI event categorization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      input,
    });

    // Return fallback categorization based on heuristics
    return getFallbackCategorization(input);
  }
}

/**
 * Fallback categorization when AI is unavailable
 */
function getFallbackCategorization(input: CategorizationInput): EventCategorizationResult {
  logger.info('Using fallback categorization heuristics');

  // Determine event type from organization category or name
  let eventType: EventCategorizationResult['eventType'] = 'other';
  const orgLower = (input.organizationName || '').toLowerCase();
  const categoryLower = (input.organizationCategory || '').toLowerCase();
  const combined = `${orgLower} ${categoryLower}`;

  if (combined.includes('school') || combined.includes('elementary') ||
      combined.includes('university') || combined.includes('college')) {
    eventType = 'school';
  } else if (combined.includes('church') || combined.includes('ministry') ||
             combined.includes('faith') || combined.includes('synagogue') ||
             combined.includes('mosque')) {
    eventType = 'religious';
  } else if (combined.includes('nonprofit') || combined.includes('charity') ||
             combined.includes('shelter') || combined.includes('foundation')) {
    eventType = 'nonprofit';
  } else if (combined.includes('company') || combined.includes('corporation') ||
             combined.includes('inc') || combined.includes('llc')) {
    eventType = 'corporate';
  } else if (combined.includes('community') || combined.includes('center') ||
             combined.includes('park')) {
    eventType = 'community';
  } else if (combined.includes('city') || combined.includes('county') ||
             combined.includes('government') || combined.includes('municipal')) {
    eventType = 'government';
  }

  // Determine event size from sandwich count
  let eventSize: EventCategorizationResult['eventSize'] = 'medium';
  const count = input.estimatedSandwichCount || 0;
  if (count <= 50) {
    eventSize = 'small';
  } else if (count <= 150) {
    eventSize = 'medium';
  } else if (count <= 300) {
    eventSize = 'large';
  } else {
    eventSize = 'extra_large';
  }

  // Check for special needs from description
  const specialNeeds: string[] = [];
  const descLower = (input.description || '').toLowerCase();
  if (descLower.includes('vegetarian') || descLower.includes('dietary') ||
      descLower.includes('allergy') || descLower.includes('vegan') ||
      descLower.includes('gluten')) {
    specialNeeds.push('dietary');
  }
  if (descLower.includes('refrigerat') || descLower.includes('storage')) {
    specialNeeds.push('refrigeration');
  }
  if (descLower.includes('deliver') || descLower.includes('transport')) {
    specialNeeds.push('delivery');
  }
  if (descLower.includes('volunteer')) {
    specialNeeds.push('volunteers');
  }
  if (descLower.includes('speaker') || descLower.includes('presentation')) {
    specialNeeds.push('speakers');
  }
  if (descLower.includes('driver')) {
    specialNeeds.push('drivers');
  }

  return {
    eventType,
    eventSize,
    specialNeeds,
    targetAudience: 'Recipients determined from event context',
    confidence: 0.5, // Lower confidence for fallback
    reasoning: 'Categorized using rule-based heuristics (AI unavailable)',
    suggestedTags: [eventType, eventSize],
  };
}

/**
 * Batch categorize multiple events (useful for processing existing events)
 */
export async function batchCategorizeEvents(
  events: CategorizationInput[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<number, EventCategorizationResult>> {
  const results = new Map<number, EventCategorizationResult>();

  logger.info('Starting batch event categorization', { count: events.length });

  for (let i = 0; i < events.length; i++) {
    try {
      const result = await categorizeEventRequest(events[i]);
      results.set(i, result);

      if (onProgress) {
        onProgress(i + 1, events.length);
      }

      // Rate limiting: wait 100ms between requests to avoid OpenAI rate limits
      if (i < events.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.error('Failed to categorize event in batch', {
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info('Batch event categorization completed', {
    total: events.length,
    successful: results.size,
  });

  return results;
}
