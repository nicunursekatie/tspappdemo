import { format, formatDistance, formatRelative, isToday, isTomorrow, isYesterday, startOfWeek, endOfWeek } from 'date-fns';

/**
 * Centralized date formatting utilities for consistent date display across the app
 */

export const DateFormats = {
  // Standard formats
  SHORT: 'MMM d, yyyy',           // Sep 19, 2024
  MEDIUM: 'MMMM d, yyyy',         // September 19, 2024
  LONG: 'EEEE, MMMM d, yyyy',     // Thursday, September 19, 2024

  // Time formats
  TIME_12H: 'h:mm a',             // 2:30 PM
  TIME_24H: 'HH:mm',              // 14:30

  // Combined date and time
  DATETIME_SHORT: 'MMM d, yyyy h:mm a',      // Sep 19, 2024 2:30 PM
  DATETIME_MEDIUM: 'MMMM d, yyyy h:mm a',    // September 19, 2024 2:30 PM
  DATETIME_LONG: 'EEEE, MMMM d, yyyy h:mm a', // Thursday, September 19, 2024 2:30 PM

  // ISO format
  ISO: "yyyy-MM-dd'T'HH:mm:ss",   // 2024-09-19T14:30:00
} as const;

/**
 * Format a date using a predefined format
 */
export function formatDate(date: Date | string | number, formatString: string = DateFormats.SHORT): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  return format(dateObj, formatString);
}

/**
 * Format a date with relative descriptions for recent dates
 * e.g., "Today", "Yesterday", "Tomorrow", or falls back to formatted date
 */
export function formatRelativeDate(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  if (isToday(dateObj)) {
    return 'Today';
  }

  if (isTomorrow(dateObj)) {
    return 'Tomorrow';
  }

  if (isYesterday(dateObj)) {
    return 'Yesterday';
  }

  return format(dateObj, DateFormats.SHORT);
}

/**
 * Format a date with time, using relative descriptions for recent dates
 * e.g., "Today at 2:30 PM", "Yesterday at 3:45 PM", or "Sep 19, 2024 at 2:30 PM"
 */
export function formatRelativeDateTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const time = format(dateObj, DateFormats.TIME_12H);

  if (isToday(dateObj)) {
    return `Today at ${time}`;
  }

  if (isTomorrow(dateObj)) {
    return `Tomorrow at ${time}`;
  }

  if (isYesterday(dateObj)) {
    return `Yesterday at ${time}`;
  }

  return `${format(dateObj, DateFormats.SHORT)} at ${time}`;
}

/**
 * Format time ago (e.g., "2 hours ago", "3 days ago")
 */
export function formatTimeAgo(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  return formatDistance(dateObj, new Date(), { addSuffix: true });
}

/**
 * Format a date range with explicit start and end dates
 * e.g., "Sep 19 - Sep 25, 2024" or "Sep 19, 2024 - Oct 3, 2024"
 *
 * When using the default format, the output is optimized for readability.
 * Custom formats are always respected without optimization.
 */
export function formatDateRange(
  startDate: Date | string | number,
  endDate: Date | string | number,
  formatString: string = DateFormats.SHORT
): string {
  const start = typeof startDate === 'string' || typeof startDate === 'number' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' || typeof endDate === 'number' ? new Date(endDate) : endDate;

  if (!start || isNaN(start.getTime()) || !end || isNaN(end.getTime())) {
    return 'Invalid date range';
  }

  // Only optimize format when using the default SHORT format
  // Custom formats are always respected
  if (formatString === DateFormats.SHORT) {
    // If same year and month, optimize format
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
    }

    // If same year but different months
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
  }

  // Use custom format string for both dates
  const startFormatted = format(start, formatString);
  const endFormatted = format(end, formatString);
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Format a week range with explicit dates
 * e.g., "Week of Sep 19 - Sep 25, 2024"
 */
export function formatWeekRange(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid date';
  }

  const weekStart = startOfWeek(dateObj, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(dateObj, { weekStartsOn: 0 });

  return `Week of ${formatDateRange(weekStart, weekEnd)}`;
}

/**
 * Format only the time component
 */
export function formatTime(date: Date | string | number, use24Hour: boolean = false): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Invalid time';
  }

  return format(dateObj, use24Hour ? DateFormats.TIME_24H : DateFormats.TIME_12H);
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date | string | number): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return false;
  }

  return dateObj < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(date: Date | string | number): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  if (!dateObj || isNaN(dateObj.getTime())) {
    return false;
  }

  return dateObj > new Date();
}
