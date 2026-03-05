/**
 * Mention Utilities
 * 
 * Utilities for parsing and extracting @mentions from text content.
 * Supports both quoted names (@"John Doe") and unquoted usernames/emails (@john or @john@example.com)
 */

/**
 * Extract all @mentions from text
 * Supports:
 * - @"John Doe" (quoted names with spaces)
 * - @john (simple username)
 * - @john@example.com (email addresses)
 * 
 * @param text - The text to parse for mentions
 * @returns Array of mentioned usernames/names/emails (without the @ symbol)
 */
export function extractMentions(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match @username, @"display name", or @email patterns
  // Supports:
  // - @"John Doe" -> captures "John Doe"
  // - @john -> captures "john"
  // - @john@example.com -> captures "john@example.com"
  const mentionRegex = /@(?:"([^"]+)"|([a-zA-Z0-9._@-]+(?:\s+[a-zA-Z0-9._@-]+)*))/g;
  
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Extract the mention text (either quoted or unquoted)
    const mentionText = match[1] || match[2];
    if (mentionText && mentionText.trim()) {
      mentions.push(mentionText.trim());
    }
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(mentions));
}

/**
 * Check if text contains any @mentions
 * 
 * @param text - The text to check
 * @returns true if text contains at least one mention
 */
export function hasMentions(text: string): boolean {
  return extractMentions(text).length > 0;
}

/**
 * Count the number of unique @mentions in text
 * 
 * @param text - The text to count mentions in
 * @returns Number of unique mentions
 */
export function countMentions(text: string): number {
  return extractMentions(text).length;
}

/**
 * Replace @mentions in text with a custom renderer function
 * Useful for highlighting or linking mentions in UI
 * 
 * @param text - The text containing mentions
 * @param replacer - Function that takes mention text and returns replacement
 * @returns Modified text with replacements applied
 */
export function replaceMentions(
  text: string,
  replacer: (mention: string) => string
): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const mentionRegex = /@(?:"([^"]+)"|([a-zA-Z0-9._@-]+(?:\s+[a-zA-Z0-9._@-]+)*))/g;
  
  return text.replace(mentionRegex, (fullMatch, quoted, unquoted) => {
    const mentionText = quoted || unquoted;
    return replacer(mentionText);
  });
}
