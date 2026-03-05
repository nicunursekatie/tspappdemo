/**
 * Safe JSON Parser Utilities
 *
 * Provides safe JSON parsing with error handling to prevent server crashes
 * from malformed JSON input.
 *
 * See: BUG_FIXES_IMPLEMENTATION_GUIDE.md - BUG-008
 */

import { logger } from './production-safe-logger';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Safely parse JSON with error handling
 * Returns a result object indicating success/failure
 *
 * @param jsonString - String to parse as JSON (or null/undefined which will return error)
 * @param defaultValue - Default value to return if parsing fails
 * @param context - Optional context for error logging (e.g., "API response", "user input")
 * @returns ParseResult with success flag and either data or error
 *
 * @example
 * // Preferred: Handle null/undefined at call site
 * const result = safeJsonParse(req.body.data ?? '', [], 'sandwichTypes field');
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 * const data = result.data;
 *
 * @example
 * // Also supported: Pass potentially null value
 * const result = safeJsonParse(req.body.data, [], 'sandwichTypes field');
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 */
export function safeJsonParse<T = any>(
  jsonString: string | null | undefined,
  defaultValue?: T,
  context?: string
): ParseResult<T> {
  // Handle null/undefined
  if (jsonString === null || jsonString === undefined) {
    return {
      success: false,
      error: 'JSON string is null or undefined',
      data: defaultValue
    };
  }

  // Handle non-string input
  if (typeof jsonString !== 'string') {
    return {
      success: false,
      error: `Expected string but got ${typeof jsonString}`,
      data: defaultValue
    };
  }

  // Handle empty string
  if (jsonString.trim() === '') {
    return {
      success: false,
      error: 'JSON string is empty',
      data: defaultValue
    };
  }

  // Attempt parse
  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('JSON parse error', {
      context,
      error: errorMessage,
      preview: jsonString.substring(0, 100) // Only log first 100 chars
    });

    return {
      success: false,
      error: errorMessage,
      data: defaultValue
    };
  }
}

/**
 * Parse JSON or throw with descriptive error
 * Use when JSON is required and failure should abort the operation
 *
 * @param jsonString - String to parse as JSON
 * @param context - Optional context for error message
 * @returns Parsed JSON data
 * @throws Error if parsing fails
 *
 * @example
 * try {
 *   const data = parseJsonStrict(apiResponse, 'OpenAI API response');
 *   // Use data...
 * } catch (error) {
 *   logger.error('Failed to parse API response', { error });
 *   throw new Error('Service returned invalid response');
 * }
 */
export function parseJsonStrict<T = any>(
  jsonString: string,
  context?: string
): T {
  const result = safeJsonParse<T>(jsonString, undefined, context);

  if (!result.success) {
    throw new Error(
      `Failed to parse JSON${context ? ` (${context})` : ''}: ${result.error}`
    );
  }

  return result.data as T;
}

/**
 * Parse JSON from potentially JSON-encoded field
 * Handles both parsed objects and JSON strings
 *
 * @param value - Value that might be JSON string or already parsed
 * @param defaultValue - Default value if parsing fails
 * @param context - Context for logging
 * @returns Parsed value or default
 *
 * @example
 * // Handles both cases:
 * // 1. value = '["turkey", "ham"]' (string)
 * // 2. value = ["turkey", "ham"] (already parsed)
 * const types = parseFlexible(row.sandwichTypes, [], 'sandwich types');
 */
export function parseFlexible<T = any>(
  value: any,
  defaultValue?: T,
  context?: string
): T {
  // Already an object/array - return as-is
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }

  // Try to parse as JSON string
  if (typeof value === 'string') {
    const result = safeJsonParse<T>(value, defaultValue, context);
    return result.data ?? defaultValue!;
  }

  // Other types - return default
  return defaultValue!;
}

/**
 * Safely stringify object to JSON
 * Handles circular references and BigInt
 *
 * @param value - Value to stringify
 * @param space - Indentation for pretty printing
 * @returns JSON string or null if stringify fails
 *
 * @example
 * const json = safeJsonStringify(largeObject);
 * if (json) {
 *   await fs.writeFile('output.json', json);
 * }
 */
export function safeJsonStringify(
  value: any,
  space?: string | number
): string | null {
  try {
    return JSON.stringify(value, (key, val) => {
      // Handle BigInt
      if (typeof val === 'bigint') {
        return val.toString();
      }
      return val;
    }, space);
  } catch (error) {
    logger.error('JSON stringify error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      valueType: typeof value
    });
    return null;
  }
}
