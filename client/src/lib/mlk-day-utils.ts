/**
 * Utility functions for detecting and managing MLK Day events
 * MLK Day is observed on the third Monday of January each year
 */

/**
 * Get MLK Day date for a given year
 * @param year - The year to calculate MLK Day for
 * @returns Date object for MLK Day of that year
 */
export function getMlkDayDate(year: number): Date {
  // Start with January 1st of the given year
  const januaryFirst = new Date(year, 0, 1);
  
  // Find the first Monday of January
  const firstMonday = new Date(year, 0, 1);
  const dayOfWeek = januaryFirst.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days to add to get to first Monday
  const daysToFirstMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  firstMonday.setDate(januaryFirst.getDate() + daysToFirstMonday);
  
  // Add 14 days to get to the third Monday
  const thirdMonday = new Date(firstMonday);
  thirdMonday.setDate(firstMonday.getDate() + 14);
  
  return thirdMonday;
}

/**
 * Check if a date is within MLK Day week (the week containing MLK Day)
 * @param date - Date to check (can be string or Date object)
 * @returns true if the date falls in MLK Day week
 */
export function isInMlkDayWeek(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  const year = checkDate.getFullYear();
  
  // Get MLK Day for that year
  const mlkDay = getMlkDayDate(year);
  
  // Calculate the start (Sunday) and end (Saturday) of MLK week
  const mlkDayOfWeek = mlkDay.getDay(); // 1 for Monday
  const weekStart = new Date(mlkDay);
  weekStart.setDate(mlkDay.getDate() - mlkDayOfWeek); // Go back to Sunday
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Saturday
  weekEnd.setHours(23, 59, 59, 999);
  
  // Check if the date falls within this range
  return checkDate >= weekStart && checkDate <= weekEnd;
}

/**
 * Get a human-readable description of MLK Day week for a given year
 * @param year - The year
 * @returns String description like "Jan 13-19, 2026"
 */
export function getMlkDayWeekDescription(year: number): string {
  const mlkDay = getMlkDayDate(year);
  const mlkDayOfWeek = mlkDay.getDay();
  
  const weekStart = new Date(mlkDay);
  weekStart.setDate(mlkDay.getDate() - mlkDayOfWeek);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const monthName = mlkDay.toLocaleString('en-US', { month: 'short' });
  
  return `${monthName} ${weekStart.getDate()}-${weekEnd.getDate()}, ${year}`;
}

/**
 * Get MLK Day as a formatted string
 * @param year - The year
 * @returns String like "Monday, January 20, 2026"
 */
export function getMlkDayString(year: number): string {
  const mlkDay = getMlkDayDate(year);
  return mlkDay.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
