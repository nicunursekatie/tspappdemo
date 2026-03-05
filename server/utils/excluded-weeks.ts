/**
 * Excluded Weeks Utility
 *
 * Determines which collection weeks should be excluded from statistics.
 * Collection weeks run Wednesday to Tuesday.
 *
 * Excluded weeks include:
 * - Thanksgiving week (4th Thursday of November)
 * - Christmas week (week containing Dec 25)
 * - New Year's week (week containing Jan 1)
 * - Independence Day week (week containing July 4)
 * - Memorial Day week (last Monday of May)
 *
 * These weeks are ALWAYS excluded regardless of what day the holiday falls on,
 * because we intentionally don't hold collections during these periods.
 */

// Format a Date as YYYY-MM-DD (local time, no timezone tricks)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse a YYYY-MM-DD string as local date
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the Wednesday that starts the collection week containing a given date.
 * Collection weeks run Wednesday (day 3) to Tuesday (day 2).
 */
export function getWednesdayOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 3 = Wednesday
  const daysFromWednesday = (dayOfWeek + 4) % 7; // Days since last Wednesday
  const wednesday = new Date(date);
  wednesday.setDate(date.getDate() - daysFromWednesday);
  return wednesday;
}

/**
 * Calculate Thanksgiving (4th Thursday of November) for a given year
 */
export function getThanksgiving(year: number): Date {
  // Start at November 1st
  const nov1 = new Date(year, 10, 1); // month is 0-indexed
  const dayOfWeek = nov1.getDay(); // 0 = Sunday

  // Find first Thursday (day 4)
  const daysUntilFirstThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursday = daysUntilFirstThursday === 0 ? 7 : daysUntilFirstThursday;

  // 4th Thursday = first Thursday + 21 days
  return new Date(year, 10, 1 + firstThursday + 21 - (daysUntilFirstThursday === 0 ? 7 : 0));
}

/**
 * Correctly calculate Thanksgiving - the 4th Thursday of November
 */
function calculateThanksgiving(year: number): Date {
  // November 1st
  const nov1 = new Date(year, 10, 1);
  const dayOfWeek = nov1.getDay();

  // Days until first Thursday
  // If Nov 1 is Sunday (0), first Thursday is Nov 5 (4 days later)
  // If Nov 1 is Thursday (4), first Thursday is Nov 1 (0 days later)
  let daysToFirstThursday = (4 - dayOfWeek + 7) % 7;
  if (daysToFirstThursday === 0 && dayOfWeek !== 4) {
    daysToFirstThursday = 7;
  }

  // 4th Thursday = first Thursday + 21 days
  const thanksgiving = new Date(year, 10, 1 + daysToFirstThursday + 21);
  return thanksgiving;
}

/**
 * Calculate Memorial Day (last Monday of May) for a given year
 */
function calculateMemorialDay(year: number): Date {
  // Start with May 31st and work backwards to find the last Monday
  const may31 = new Date(year, 4, 31);
  const dayOfWeek = may31.getDay();
  // Days to subtract to get to Monday (day 1)
  const daysToSubtract = (dayOfWeek + 6) % 7;
  const memorialDay = new Date(year, 4, 31 - daysToSubtract);
  return memorialDay;
}

/**
 * Major holidays - we ALWAYS skip the week containing these dates
 * regardless of what day of the week they fall on.
 */
const ALWAYS_EXCLUDED_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's week" },
  { month: 7, day: 4, name: 'Independence Day week' },
  { month: 12, day: 25, name: 'Christmas week' },
];

/**
 * Get the Wednesday of Thanksgiving week for a given year
 */
export function getThanksgivingWeekWednesday(year: number): string {
  const thanksgiving = calculateThanksgiving(year);
  // Thanksgiving is Thursday, so Wednesday is 1 day before
  const wednesday = new Date(thanksgiving);
  wednesday.setDate(thanksgiving.getDate() - 1);
  return formatDate(wednesday);
}

/**
 * Get all excluded week Wednesdays for a given year.
 * Returns array of YYYY-MM-DD strings representing the Wednesday of each excluded week.
 */
export function getExcludedWeeksForYear(year: number): Array<{ wednesday: string; reason: string }> {
  const excludedWeeks: Array<{ wednesday: string; reason: string }> = [];

  // Thanksgiving week is ALWAYS excluded
  excludedWeeks.push({
    wednesday: getThanksgivingWeekWednesday(year),
    reason: 'Thanksgiving week',
  });

  // Memorial Day week is ALWAYS excluded
  const memorialDay = calculateMemorialDay(year);
  const memorialDayWednesday = getWednesdayOfWeek(memorialDay);
  excludedWeeks.push({
    wednesday: formatDate(memorialDayWednesday),
    reason: 'Memorial Day week',
  });

  // Add all always-excluded holiday weeks
  for (const holiday of ALWAYS_EXCLUDED_HOLIDAYS) {
    const holidayDate = new Date(year, holiday.month - 1, holiday.day);
    const wednesday = getWednesdayOfWeek(holidayDate);
    const wednesdayStr = formatDate(wednesday);

    // Don't add duplicates (e.g., if Christmas and New Year's fall in same week)
    if (!excludedWeeks.some((w) => w.wednesday === wednesdayStr)) {
      excludedWeeks.push({
        wednesday: wednesdayStr,
        reason: holiday.name,
      });
    }
  }

  return excludedWeeks;
}

/**
 * Get all excluded week Wednesdays for a date range.
 * Useful for filtering statistics queries.
 */
export function getExcludedWeeksInRange(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const allExcludedWeeks: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearExclusions = getExcludedWeeksForYear(year);
    for (const exclusion of yearExclusions) {
      const wednesdayDate = parseDate(exclusion.wednesday);
      if (wednesdayDate >= start && wednesdayDate <= end) {
        allExcludedWeeks.push(exclusion.wednesday);
      }
    }
  }

  return allExcludedWeeks;
}

/**
 * Check if a specific date falls within an excluded collection week.
 * The date can be any day - we'll find which collection week it belongs to.
 */
export function isInExcludedWeek(dateStr: string): { excluded: boolean; reason?: string } {
  const date = parseDate(dateStr);
  const year = date.getFullYear();
  const wednesday = getWednesdayOfWeek(date);
  const wednesdayStr = formatDate(wednesday);

  const excludedWeeks = getExcludedWeeksForYear(year);
  const match = excludedWeeks.find(w => w.wednesday === wednesdayStr);

  if (match) {
    return { excluded: true, reason: match.reason };
  }

  return { excluded: false };
}

/**
 * Filter an array of collection records to exclude no-collection weeks.
 * Assumes records have a `collectionDate` field in YYYY-MM-DD format.
 */
export function filterExcludedWeeks<T extends { collectionDate: string }>(
  records: T[]
): T[] {
  return records.filter(record => !isInExcludedWeek(record.collectionDate).excluded);
}

/**
 * Get a SQL-compatible list of excluded week date ranges for use in queries.
 * Returns array of { start: string, end: string } representing Wed-Tue ranges.
 */
export function getExcludedWeekRanges(startDate: string, endDate: string): Array<{ start: string; end: string; reason: string }> {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const ranges: Array<{ start: string; end: string; reason: string }> = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearExclusions = getExcludedWeeksForYear(year);
    for (const exclusion of yearExclusions) {
      const wednesday = parseDate(exclusion.wednesday);

      // Calculate Tuesday (end of collection week) - 6 days after Wednesday
      const tuesday = new Date(wednesday);
      tuesday.setDate(wednesday.getDate() + 6);

      // Only include if the week overlaps with our date range
      if (tuesday >= start && wednesday <= end) {
        ranges.push({
          start: exclusion.wednesday,
          end: formatDate(tuesday),
          reason: exclusion.reason
        });
      }
    }
  }

  return ranges;
}

/**
 * Get the number of excluded weeks in a given month/year.
 * Useful for calculating adjusted monthly averages.
 */
export function getExcludedWeeksInMonth(year: number, month: number): Array<{ wednesday: string; reason: string }> {
  const excludedWeeks = getExcludedWeeksForYear(year);

  return excludedWeeks.filter(week => {
    const wednesday = parseDate(week.wednesday);
    // Check if the Wednesday falls in this month
    return wednesday.getFullYear() === year && wednesday.getMonth() + 1 === month;
  });
}

/**
 * Get the number of collection weeks in a given month, excluding holiday weeks.
 * A month typically has 4-5 Wednesdays, minus any excluded weeks.
 */
export function getActiveCollectionWeeksInMonth(year: number, month: number): number {
  // Count Wednesdays in the month
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0); // Last day of the month

  let wednesdayCount = 0;
  const current = new Date(firstDay);

  while (current <= lastDay) {
    if (current.getDay() === 3) { // Wednesday
      wednesdayCount++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Subtract excluded weeks
  const excludedInMonth = getExcludedWeeksInMonth(year, month);

  return Math.max(0, wednesdayCount - excludedInMonth.length);
}

// Export for debugging/admin purposes
export function listAllExcludedWeeks(startYear: number, endYear: number): void {
  console.log('Excluded Collection Weeks:');
  console.log('==========================');

  for (let year = startYear; year <= endYear; year++) {
    console.log(`\n${year}:`);
    const weeks = getExcludedWeeksForYear(year);
    for (const week of weeks) {
      const tuesday = new Date(parseDate(week.wednesday));
      tuesday.setDate(tuesday.getDate() + 6);
      console.log(`  ${week.wednesday} to ${formatDate(tuesday)}: ${week.reason}`);
    }
  }
}
