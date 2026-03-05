/**
 * Date utility functions specific to meetings dashboard
 */

import {
  formatTimeForDisplay,
  isDateInPast,
} from '@/lib/date-utils';

/**
 * Format meeting date in a user-friendly way (Today, Tomorrow, or formatted date)
 * Timezone-safe implementation
 */
export const formatMeetingDate = (dateString: string): string => {
  // Use timezone-safe parsing by adding noon time
  const date = new Date(dateString + 'T12:00:00');
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Create local date comparisons to avoid timezone issues
  const meetingDateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const tomorrowOnly = new Date(
    tomorrow.getFullYear(),
    tomorrow.getMonth(),
    tomorrow.getDate()
  );

  if (meetingDateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  } else if (meetingDateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
};

/**
 * Format meeting time in a user-friendly way (wrapper for utility)
 */
export const formatMeetingTime = (timeString: string): string => {
  return formatTimeForDisplay(timeString);
};

/**
 * Determine if a meeting is in the past (wrapper for utility)
 */
export const isPastMeeting = (dateString: string, timeString: string): boolean => {
  return isDateInPast(dateString, timeString);
};

/**
 * Get the current date range for week view (Sunday to Saturday)
 */
export const getCurrentDateRange = () => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

  return {
    week: `${startOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${endOfWeek.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })}`,
    month: now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
  };
};

/**
 * Format section name for display (convert from snake_case to readable format)
 */
export const formatSectionName = (section: string | null | undefined): string => {
  if (!section) return 'General';
  
  const sectionMap: Record<string, string> = {
    'urgent_items': 'Urgent Items',
    'old_business': 'Old Business', 
    'new_business': 'New Business',
    'housekeeping': 'Housekeeping',
    'general': 'General'
  };
  
  return sectionMap[section] || section;
};