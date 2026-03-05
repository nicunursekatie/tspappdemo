/**
 * SHARED DATE UTILITIES - Timezone-Safe Date Handling
 *
 * ============================================================================
 * CRITICAL: ALL DATE HANDLING IN THIS APP SHOULD USE THESE UTILITIES
 * ============================================================================
 *
 * This module solves the recurring "date off by one day" bug caused by timezone
 * conversions. The root cause is that when dates like "2025-09-03" are parsed
 * with UTC timezone (using 'Z' suffix), they get converted incorrectly when
 * displayed in local time.
 *
 * PROBLEM EXAMPLE:
 * - User selects "September 3, 2025" in a date picker
 * - Old code: new Date("2025-09-03T12:00:00.000Z") → Sept 3 12:00 UTC
 * - When displayed in Eastern Time: Sept 3 08:00 AM (if DST) or 07:00 AM
 * - If the original datetime from DB is at midnight UTC, it becomes Sept 2 in Eastern!
 *
 * SOLUTION:
 * - For date-only fields: Parse without 'Z' to treat as local time
 * - For display: Always use 'America/New_York' timezone
 * - This app is exclusively used by Eastern Time users, so we hardcode this
 *
 * USAGE:
 * - Server: Use `parseDateOnly()` for converting HTML date input strings to Date objects
 * - Client: Use `formatDateForDisplay()` for showing dates to users
 * - Both: Never use `new Date(string + 'T12:00:00.000Z')` - this causes the bug!
 */

// Eastern Time Zone - all users of this app are in this timezone
export const APP_TIMEZONE = 'America/New_York';

/**
 * Parse a date-only string (YYYY-MM-DD) into a Date object WITHOUT timezone shift.
 *
 * This is the CORRECT way to parse dates from HTML date inputs or database
 * date-only columns. It treats the date as local noon, avoiding the midnight
 * boundary issue that causes dates to shift.
 *
 * @example
 * // CORRECT - use this:
 * const date = parseDateOnly("2025-09-03");
 *
 * // WRONG - never do this:
 * const date = new Date("2025-09-03T12:00:00.000Z"); // Causes timezone shift!
 */
export function parseDateOnly(dateString: string | null | undefined): Date | null {
  if (!dateString || dateString === '') {
    return null;
  }

  // If already a Date object somehow, return it
  if (dateString instanceof Date) {
    return dateString;
  }

  const trimmed = String(dateString).trim();

  // Handle YYYY-MM-DD format (from HTML5 date inputs)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Parse as LOCAL noon time - NO 'Z' suffix!
    // This keeps the date stable regardless of timezone
    return new Date(trimmed + 'T12:00:00');
  }

  // Handle full datetime strings (already have time component)
  // These might come from the database with timestamps
  if (trimmed.includes('T') || trimmed.includes(' ')) {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Try to parse as-is
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Convert a Date object to YYYY-MM-DD string format.
 * Uses the local date parts to avoid timezone conversion.
 */
export function toDateOnlyString(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d || isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format options for displaying dates - always in Eastern Time
 */
export const EASTERN_DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIMEZONE,
};

/**
 * Format a date for display to users.
 *
 * ALWAYS uses America/New_York timezone to ensure consistency for all users.
 * This prevents dates from shifting when displayed.
 *
 * @example
 * formatDateForDisplay("2025-09-03") // "Wednesday, September 3, 2025"
 * formatDateForDisplay("2025-09-03", { weekday: 'short' }) // "Wed, September 3, 2025"
 */
export function formatDateForDisplay(
  date: Date | string | null | undefined,
  options: Partial<Intl.DateTimeFormatOptions> = {}
): string {
  if (!date) return '';

  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d || isNaN(d.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  };

  return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format a date for display with a short format.
 *
 * @example
 * formatDateShort("2025-09-03") // "Sep 3, 2025"
 */
export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d || isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Format just the weekday name.
 *
 * @example
 * formatWeekday("2025-09-03") // "Wednesday"
 */
export function formatWeekday(
  date: Date | string | null | undefined,
  style: 'long' | 'short' | 'narrow' = 'long'
): string {
  if (!date) return '';

  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d || isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', {
    weekday: style,
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Format month and day only (for week labels, etc.)
 *
 * @example
 * formatMonthDay("2025-09-03") // "Sep 3"
 */
export function formatMonthDay(date: Date | string | null | undefined): string {
  if (!date) return '';

  const d = date instanceof Date ? date : parseDateOnly(date);
  if (!d || isNaN(d.getTime())) return '';

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
  });
}

/**
 * Get today's date as a YYYY-MM-DD string in Eastern Time.
 */
export function getTodayString(): string {
  const now = new Date();
  // Use Intl to get today's date in Eastern Time
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Check if a date string represents today in Eastern Time.
 */
export function isToday(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return toDateOnlyString(date) === getTodayString();
}

/**
 * Compare two dates (date-only, ignoring time).
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareDates(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const dateA = toDateOnlyString(a);
  const dateB = toDateOnlyString(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;

  return dateA.localeCompare(dateB);
}

/**
 * Check if a date is in the past (compared to today in Eastern Time).
 */
export function isDateInPast(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateStr = toDateOnlyString(date);
  const todayStr = getTodayString();
  return dateStr < todayStr;
}

/**
 * Check if a date is in the future (compared to today in Eastern Time).
 */
export function isDateInFuture(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateStr = toDateOnlyString(date);
  const todayStr = getTodayString();
  return dateStr > todayStr;
}
