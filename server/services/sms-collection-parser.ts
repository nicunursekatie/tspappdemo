import OpenAI from 'openai';
import { logger } from '../utils/production-safe-logger';

/**
 * SMS Collection Parser Service
 * Parses natural language text messages into structured collection log data
 *
 * Supports various formats:
 * - "50 sandwiches at Downtown Library"
 * - "Made 30 today, 20 deli 10 pbj"
 * - "25 Youth Group, 15 Seniors at Community Center"
 * - "LOG 45 Main St Church"
 */

export interface ParsedCollectionData {
  hostName: string;
  individualSandwiches: number;
  individualDeli?: number;
  individualTurkey?: number;
  individualHam?: number;
  individualPbj?: number;
  individualGeneric?: number;
  groupCollections?: Array<{
    name: string;
    count: number;
    deli?: number;
    turkey?: number;
    ham?: number;
    pbj?: number;
    generic?: number;
  }>;
  collectionDate: string; // YYYY-MM-DD
  confidence: number; // 0.0-1.0
  needsClarification: boolean;
  clarificationMessage?: string;
}

export interface CollectionParseResult {
  success: boolean;
  data?: ParsedCollectionData;
  error?: string;
  rawMessage: string;
}

// Parse date from text - supports various formats
export function parseDateFromText(text: string): { date: string; remainingText: string } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Check for explicit date patterns at the end of the message
  // Format: MM/DD or MM-DD or MM/DD/YY or MM/DD/YYYY (with or without leading space)
  const dateMatch = text.match(/\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/i);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
    if (year < 100) year += 2000; // Convert 24 to 2024
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const remaining = text.substring(0, text.length - dateMatch[0].length).trim();
      logger.info(`[DateParser] Extracted date ${dateStr} from "${text}", remaining: "${remaining}"`);
      return { date: dateStr, remainingText: remaining };
    }
  }
  
  // Check for "yesterday"
  if (/\s+yesterday$/i.test(text)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { 
      date: yesterday.toISOString().split('T')[0], 
      remainingText: text.replace(/\s+yesterday$/i, '').trim() 
    };
  }
  
  // Check for "last Wednesday", "last Monday", etc.
  const lastDayMatch = text.match(/\s+last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (lastDayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(lastDayMatch[1].toLowerCase());
    const currentDay = today.getDay();
    let daysBack = currentDay - targetDay;
    if (daysBack <= 0) daysBack += 7; // Go back to previous week
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysBack);
    return { 
      date: targetDate.toISOString().split('T')[0], 
      remainingText: text.replace(lastDayMatch[0], '').trim() 
    };
  }
  
  // Check for just day name (this week or last occurrence)
  const dayMatch = text.match(/\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (dayMatch) {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
    const currentDay = today.getDay();
    let daysBack = currentDay - targetDay;
    if (daysBack < 0) daysBack += 7; // If target day is ahead, go back a week
    if (daysBack === 0) daysBack = 0; // Today
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysBack);
    return { 
      date: targetDate.toISOString().split('T')[0], 
      remainingText: text.replace(dayMatch[0], '').trim() 
    };
  }
  
  return { date: todayStr, remainingText: text };
}

// Check if message contains sandwich type keywords that require AI parsing
function hasSandwichTypeKeywords(message: string): boolean {
  const typePattern = /\b(pbj|pb&j|peanut\s*butter|deli|ham|turkey|generic)\b/i;
  return typePattern.test(message);
}

// Check if message needs AI parsing (complex formats, multiple numbers, groups)
function needsAIParsing(message: string): boolean {
  // Multiple numbers suggest complex parsing (groups, types breakdown)
  const numbers = message.match(/\d+/g);
  if (numbers && numbers.length > 2) return true;

  // Contains comma (likely groups)
  if (message.includes(',')) return true;

  // Sandwich types need AI
  if (hasSandwichTypeKeywords(message)) return true;

  // Contains group indicators
  if (/\b(group|team|corp|company|inc\.|llc)\b/i.test(message)) return true;

  return false;
}

// Extract a number and location from simple messages
function parseSimpleMessage(message: string): CollectionParseResult | null {
  // Remove common filler words to make parsing easier
  const cleaned = message
    .replace(/^(log|logged|made|collected|we made|we collected|just made|just collected)\s*/i, '')
    .replace(/\s*(sandwiches?|sammies|sammiches)\s*/gi, ' ')
    .replace(/\s*(today|this morning|this afternoon|tonight)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Try to find a number anywhere in the message
  const numberMatch = cleaned.match(/(\d+)/);
  if (!numberMatch) return null;

  const count = parseInt(numberMatch[1], 10);
  if (count < 1 || count > 50000) return null; // Sanity check

  // Extract the location - everything that's not the number, cleaned up
  let location = cleaned
    .replace(/\d+/g, '')
    .replace(/\s*(at|from|for|@)\s*/gi, ' ')
    .replace(/^\s*[-:,]\s*/, '')
    .replace(/\s*[-:,]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Apply date parsing to extract any date from the location
  const { date, remainingText: locationWithoutDate } = parseDateFromText(location);
  location = locationWithoutDate.trim();

  // Need at least some location info
  if (location.length < 2) return null;

  return {
    success: true,
    data: {
      hostName: location,
      individualSandwiches: count,
      collectionDate: date,
      confidence: 0.80,
      needsClarification: false,
    },
    rawMessage: message,
  };
}

// Simple regex-based parser for structured messages
function parseStructuredMessage(message: string): CollectionParseResult | null {
  // If message needs complex parsing, route to AI
  if (needsAIParsing(message)) {
    logger.info(`[StructuredParser] Complex message detected, routing to AI parser for: "${message}"`);
    return null; // Let AI handle the complex parsing
  }

  // Format with groups: LOG <count> <host> [date], <group1> <count1>, <group2> <count2>
  // Example: "LOG 1074 Dunwoody 12/10, Willis Towers Watson 400"
  const groupMatch = message.match(/^LOG\s+(\d+)\s+(.+?)(?:\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?))?\s*,\s*(.+)$/i);
  if (groupMatch) {
    const individualCount = parseInt(groupMatch[1], 10);
    const hostName = groupMatch[2].trim();
    const dateStr = groupMatch[3];
    const groupsPart = groupMatch[4];

    // Parse the date
    let collectionDate: string;
    if (dateStr) {
      const parts = dateStr.split(/[\/\-]/);
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parts[2] ? parseInt(parts[2], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      collectionDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    } else {
      collectionDate = new Date().toISOString().split('T')[0];
    }

    // Parse groups: "Willis Towers Watson 400, Another Group 200"
    const groupCollections: Array<{ name: string; count: number }> = [];
    const groupEntries = groupsPart.split(/\s*,\s*/);
    let totalGroupCount = 0;

    for (const entry of groupEntries) {
      // Match "Group Name 123" pattern - number at end
      const entryMatch = entry.match(/^(.+?)\s+(\d+)$/);
      if (entryMatch) {
        const groupName = entryMatch[1].trim();
        const groupCount = parseInt(entryMatch[2], 10);
        if (groupName && groupCount > 0) {
          groupCollections.push({ name: groupName, count: groupCount });
          totalGroupCount += groupCount;
        }
      }
    }

    if (individualCount > 0 && hostName.length >= 2) {
      logger.info(`[StructuredParser] Parsed with groups: ${individualCount} individual + ${groupCollections.length} groups at ${hostName} on ${collectionDate}`);
      return {
        success: true,
        data: {
          hostName,
          individualSandwiches: individualCount, // Individual count stays separate from groups
          groupCollections: groupCollections.length > 0 ? groupCollections : undefined,
          collectionDate,
          confidence: 0.95,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  // Format: LOG <count> <host> [date]
  const logMatch = message.match(/^LOG\s+(\d+)\s+(?:at\s+)?(.+)$/i);
  if (logMatch) {
    const count = parseInt(logMatch[1], 10);
    const hostAndDate = logMatch[2].trim();
    const { date, remainingText: host } = parseDateFromText(hostAndDate);

    if (count > 0 && host.length >= 2) {
      return {
        success: true,
        data: {
          hostName: host,
          individualSandwiches: count,
          collectionDate: date,
          confidence: 0.95,
          needsClarification: false,
        },
        rawMessage: message,
      };
    }
  }

  // Try flexible simple parsing for natural messages like:
  // "50 downtown library", "made 100 at first baptist", "75 sandwiches community center"
  const simpleResult = parseSimpleMessage(message);
  if (simpleResult) {
    return simpleResult;
  }

  return null;
}

// AI-powered parser for complex messages
async function parseWithAI(message: string): Promise<CollectionParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    logger.warn('[SMSCollectionParser] No OpenAI API key, falling back to simple parsing');
    return {
      success: false,
      error: 'Could not parse message. Try: LOG [count] [location name]',
      rawMessage: message,
    };
  }

  try {
    const client = new OpenAI({ apiKey });

    const today = new Date().toISOString().split('T')[0];

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: `You are a parser for sandwich collection log SMS messages from The Sandwich Project volunteers. Your job is to understand natural language texts about sandwich making events and extract structured data.

BE FLEXIBLE AND SMART - volunteers text in casual, natural ways. Accept many formats!

Output JSON with these fields:
- hostName: string (location/organization name, REQUIRED - this is where sandwiches were made)
- individualSandwiches: number (TOTAL individual count - sum of all typed sandwiches, REQUIRED, minimum 1)
- individualDeli: number (optional, deli sandwiches count)
- individualTurkey: number (optional, turkey sandwiches count)
- individualHam: number (optional, ham sandwiches count)
- individualPbj: number (optional, PB&J sandwiches count)
- individualGeneric: number (optional, generic/untyped sandwiches count - use when type not specified)
- groupCollections: array of {name, count, deli?, turkey?, ham?, pbj?, generic?} (optional, for corporate/organization group collections separate from the host location)
- collectionDate: string YYYY-MM-DD (interpret dates, default to ${today} if not specified)
- confidence: number 0-1 (how confident you are in the parse)
- needsClarification: boolean (true if message is ambiguous)
- clarificationMessage: string (what to ask if clarification needed)

SANDWICH TYPE KEYWORDS (case-insensitive):
- "PBJ", "pb&j", "peanut butter", "pb" = pbj
- "Deli", "deli meat" = deli
- "Ham" = ham
- "Turkey" = turkey
- When no type is specified, it's generic/untyped

DATE INTERPRETATION:
- "12/10" or "12-10" = December 10, ${today.substring(0,4)}
- "yesterday" = ${new Date(Date.now() - 86400000).toISOString().split('T')[0]}
- Day names like "Wednesday" = most recent or current week
- No date = default to ${today}

UNDERSTANDING GROUP COLLECTIONS:
- Groups come AFTER the main location, separated by comma
- Group format: "[GroupName] [count] [optional type]"
- Example: "1000 Dunwoody, Google 200, Acme 300" = 1000 TOTAL, with Google (200) and Acme (300) as groups

CRITICAL CALCULATION RULE - THE FIRST NUMBER IS THE TOTAL:
When a user texts "1000 Dunwoody, Google 200, Acme 300":
- 1000 is the TOTAL sandwich count for that day (individual + all groups combined)
- Google brought 200, Acme brought 300 (these are group collections)
- individualSandwiches = 1000 - 200 - 300 = 500 (the remainder after subtracting groups)

So: individualSandwiches = [first total] - [sum of all group counts]

If the first number equals the sum of groups, then individualSandwiches = 0 is valid (all sandwiches came from groups).

PARSING EXAMPLES (be this flexible!):

Simple counts:
"500 dunwoody" → {hostName: "Dunwoody", individualSandwiches: 500, confidence: 0.95}
"made 100 at first baptist" → {hostName: "First Baptist", individualSandwiches: 100, confidence: 0.90}
"1000 intown today" → {hostName: "Intown", individualSandwiches: 1000, collectionDate: "${today}", confidence: 0.95}
"log 250 downtown" → {hostName: "Downtown", individualSandwiches: 250, confidence: 0.95}

With sandwich types:
"100 pbj 200 deli dunwoody" → {hostName: "Dunwoody", individualSandwiches: 300, individualPbj: 100, individualDeli: 200, confidence: 0.95}
"dunwoody 150 pb&j and 250 deli" → {hostName: "Dunwoody", individualSandwiches: 400, individualPbj: 150, individualDeli: 250, confidence: 0.95}
"500 - 200 pbj 300 deli - intown" → {hostName: "Intown", individualSandwiches: 500, individualPbj: 200, individualDeli: 300, confidence: 0.90}

With groups (TOTAL minus groups = individual):
"600 dunwoody, google 200" → {hostName: "Dunwoody", individualSandwiches: 400, groupCollections: [{name: "Google", count: 200}], confidence: 0.95}
  (600 total - 200 google = 400 individual)
"1000 intown 12/10, wells fargo 300, acme 200" → {hostName: "Intown", individualSandwiches: 500, collectionDate: "${today.substring(0,4)}-12-10", groupCollections: [{name: "Wells Fargo", count: 300}, {name: "Acme", count: 200}], confidence: 0.95}
  (1000 total - 300 - 200 = 500 individual)
"1200 dunwoody, google 400 deli, microsoft 300 pbj" → {hostName: "Dunwoody", individualSandwiches: 500, groupCollections: [{name: "Google", count: 400, deli: 400}, {name: "Microsoft", count: 300, pbj: 300}], confidence: 0.95}
  (1200 total - 400 - 300 = 500 individual)

Complex real-world examples:
"1145 dunwoody - 100 pbj, 245 deli and 400 generic from individuals. willis towers watson brought 400 deli" → {hostName: "Dunwoody", individualSandwiches: 745, individualPbj: 100, individualDeli: 245, individualGeneric: 400, groupCollections: [{name: "Willis Towers Watson", count: 400, deli: 400}], confidence: 0.95}
  (1145 total - 400 WTW = 745 individual, broken down as 100+245+400)
"800 intown, delta 500, coca cola 300" → {hostName: "Intown", individualSandwiches: 0, groupCollections: [{name: "Delta", count: 500}, {name: "Coca Cola", count: 300}], confidence: 0.95}
  (800 total - 500 - 300 = 0 individual, all from groups)

Too vague (ask for clarification):
"made sandwiches today" → {needsClarification: true, clarificationMessage: "How many sandwiches and where? Example: 500 Dunwoody", confidence: 0.2}
"great event!" → {needsClarification: true, clarificationMessage: "To log sandwiches, include the count and location. Example: 500 Dunwoody", confidence: 0.1}

If message clearly isn't about logging sandwiches, return needsClarification: true with a helpful message.`,
        },
        {
          role: 'user',
          content: message,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'Could not parse message. Try: LOG [count] [location name]',
        rawMessage: message,
      };
    }

    const parsed = JSON.parse(content);

    // Validate required fields
    if (parsed.needsClarification) {
      return {
        success: false,
        error: parsed.clarificationMessage || 'Could not understand message. Try: LOG [count] [location name]',
        rawMessage: message,
      };
    }

    // Validate required fields
    // individualSandwiches can be 0 if all sandwiches came from groups
    const hasGroupCollections = parsed.groupCollections && parsed.groupCollections.length > 0;
    const totalGroupCount = hasGroupCollections
      ? parsed.groupCollections.reduce((sum: number, g: any) => sum + (g.count || 0), 0)
      : 0;

    if (!parsed.hostName) {
      return {
        success: false,
        error: 'Missing location. Try: 500 Dunwoody',
        rawMessage: message,
      };
    }

    // Must have either individual sandwiches OR group collections with counts
    if ((parsed.individualSandwiches === undefined || parsed.individualSandwiches < 0) && totalGroupCount === 0) {
      return {
        success: false,
        error: 'Missing sandwich count. Try: 500 Dunwoody',
        rawMessage: message,
      };
    }

    return {
      success: true,
      data: {
        hostName: parsed.hostName,
        individualSandwiches: parsed.individualSandwiches,
        individualDeli: parsed.individualDeli,
        individualTurkey: parsed.individualTurkey,
        individualHam: parsed.individualHam,
        individualPbj: parsed.individualPbj,
        individualGeneric: parsed.individualGeneric,
        groupCollections: parsed.groupCollections,
        collectionDate: parsed.collectionDate || today,
        confidence: parsed.confidence || 0.7,
        needsClarification: false,
      },
      rawMessage: message,
    };
  } catch (error) {
    logger.error('[SMSCollectionParser] AI parsing error:', error);
    return {
      success: false,
      error: 'Could not parse message. Try: LOG [count] [location name]',
      rawMessage: message,
    };
  }
}

/**
 * Main parsing function - tries simple regex first, then AI
 */
export async function parseCollectionSMS(message: string): Promise<CollectionParseResult> {
  const trimmedMessage = message.trim();

  // Try simple structured parsing first (fast, no API call)
  const simpleResult = parseStructuredMessage(trimmedMessage);
  if (simpleResult) {
    logger.info('[SMSCollectionParser] Parsed with simple regex:', simpleResult.data);
    return simpleResult;
  }

  // Fall back to AI parsing for complex messages
  logger.info('[SMSCollectionParser] Attempting AI parsing for:', trimmedMessage);
  return parseWithAI(trimmedMessage);
}

/**
 * Generate a confirmation message for parsed collection
 */
export function generateConfirmationMessage(data: ParsedCollectionData, matchedHostName?: string): string {
  const displayHost = matchedHostName || data.hostName;

  // Calculate total (individual + groups)
  const groupTotal = data.groupCollections?.reduce((sum, g) => sum + g.count, 0) || 0;
  const grandTotal = data.individualSandwiches + groupTotal;

  // Show total and individual breakdown
  let message: string;
  if (groupTotal > 0) {
    message = `✅ Logged ${grandTotal} total at ${displayHost}`;
    message += `\n(${data.individualSandwiches} individual + ${groupTotal} from groups)`;
  } else {
    message = `✅ Logged ${data.individualSandwiches} sandwiches at ${displayHost}`;
  }
  
  // Add date if not today
  const today = new Date().toISOString().split('T')[0];
  if (data.collectionDate && data.collectionDate !== today) {
    const dateObj = new Date(data.collectionDate + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
    message += ` for ${dateStr}`;
  }

  // Add sandwich type breakdown if available (for individual)
  // Only show if there are types AND either no groups or we want to detail individual types
  const breakdowns: string[] = [];
  if (data.individualPbj) breakdowns.push(`${data.individualPbj} PBJ`);
  if (data.individualDeli) breakdowns.push(`${data.individualDeli} deli`);
  if (data.individualTurkey) breakdowns.push(`${data.individualTurkey} turkey`);
  if (data.individualHam) breakdowns.push(`${data.individualHam} ham`);
  if (data.individualGeneric) breakdowns.push(`${data.individualGeneric} generic`);

  if (breakdowns.length > 0 && groupTotal === 0) {
    // No groups - show type breakdown in parentheses
    message += `\n(${breakdowns.join(', ')})`;
  } else if (breakdowns.length > 0 && groupTotal > 0) {
    // Has groups - show individual types on separate line
    message += `\nIndividual types: ${breakdowns.join(', ')}`;
  }

  // Add group info if available (show prominently with types)
  if (data.groupCollections && data.groupCollections.length > 0) {
    const groupStrs = data.groupCollections.map(g => {
      let groupStr = `${g.name}: ${g.count}`;
      const typeBreakdown: string[] = [];
      if (g.pbj) typeBreakdown.push(`${g.pbj} PBJ`);
      if (g.deli) typeBreakdown.push(`${g.deli} deli`);
      if (g.turkey) typeBreakdown.push(`${g.turkey} turkey`);
      if (g.ham) typeBreakdown.push(`${g.ham} ham`);
      if (g.generic) typeBreakdown.push(`${g.generic} generic`);
      if (typeBreakdown.length > 0) {
        groupStr += ` (${typeBreakdown.join(', ')})`;
      }
      return groupStr;
    });
    message += `\nGroups: ${groupStrs.join('; ')}`;
  }

  message += '\n\n🥪 Thanks for making sandwiches!';

  return message;
}
