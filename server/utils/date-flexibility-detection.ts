/**
 * Date Flexibility Detection
 *
 * Analyzes message text to detect if an organization is flexible with their event date.
 * Returns null if no clear indicator, true if flexibility detected, false if inflexibility detected.
 */

// Phrases that indicate flexibility
const FLEXIBILITY_INDICATORS = [
  // Direct flexibility statements
  /\bflexible\b/i,
  /\bopen to( other)? dates?\b/i,
  /\bany (day|date|time)\b/i,
  /\bwhenever works\b/i,
  /\bwhatever works\b/i,
  /\bwhenever is (best|good|convenient)\b/i,
  /\bwhatever (day|date|time)\b/i,
  /\bcan (be |adjust|change|move|do)\b/i,
  /\bwe('re| are) (flexible|open)\b/i,
  /\b(happy|willing) to (adjust|change|move|work with|be flexible)\b/i,
  /\bwork(s)? (for|with) (us|our|the group)\b/i,
  /\blet (me|us) know what works\b/i,
  /\bno (particular|specific) (date|day)\b/i,
  /\bdon't have a (set|specific|particular) date\b/i,
  /\b(multiple|several|various|a few) dates?\b/i,
  /\balternate dates?\b/i,
  /\bbackup dates?\b/i,
  /\bother (options|dates|days)\b/i,
  /\bif that (date|day) (doesn't|does not) work\b/i,
  /\bif (needed|necessary)\b/i,
  /\bcan move\b/i,
  /\bcan change\b/i,
];

// Phrases that indicate inflexibility
const INFLEXIBILITY_INDICATORS = [
  /\b(must|has to|needs to) be\s+(on\s+)?(this|that|the) (date|day)\b/i,
  /\bnot flexible\b/i,
  /\bcannot (change|move|adjust)\b/i,
  /\bcan('t|not) (change|move|adjust)\b/i,
  /\b(only|specifically) (this|that|the) (date|day)\b/i,
  /\bset date\b/i,
  /\bfixed date\b/i,
  /\balready (planned|scheduled|booked)\b/i,
  /\bpre(-| )?planned\b/i,
  /\bexisting event\b/i,
  /\bthis is the (only|one) (date|day)\b/i,
  /\b(date|day) (is|was) (already )?(set|fixed|determined|chosen)\b/i,
];

export interface FlexibilityDetectionResult {
  dateFlexible: boolean | null;
  confidence: 'high' | 'medium' | 'low' | null;
  matchedPhrase?: string;
}

/**
 * Detects if a message indicates date flexibility or inflexibility
 *
 * @param message - The message text to analyze
 * @returns Object with dateFlexible (true/false/null) and confidence level
 */
export function detectDateFlexibility(message: string | null | undefined): FlexibilityDetectionResult {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return { dateFlexible: null, confidence: null };
  }

  const text = message.toLowerCase();

  // Check for inflexibility first (they tend to be more explicit)
  for (const pattern of INFLEXIBILITY_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      return {
        dateFlexible: false,
        confidence: 'high',
        matchedPhrase: match[0],
      };
    }
  }

  // Check for flexibility indicators
  for (const pattern of FLEXIBILITY_INDICATORS) {
    const match = text.match(pattern);
    if (match) {
      return {
        dateFlexible: true,
        confidence: 'medium', // Medium because flexibility is often implied
        matchedPhrase: match[0],
      };
    }
  }

  return { dateFlexible: null, confidence: null };
}

/**
 * Check if a message suggests the organization might be flexible
 * This is a simpler boolean check for quick filtering
 */
export function messageIndicatesFlexibility(message: string | null | undefined): boolean {
  const result = detectDateFlexibility(message);
  return result.dateFlexible === true;
}

/**
 * Check if a message explicitly states inflexibility
 */
export function messageIndicatesInflexibility(message: string | null | undefined): boolean {
  const result = detectDateFlexibility(message);
  return result.dateFlexible === false;
}
