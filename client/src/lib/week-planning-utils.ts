import { parseCollectionDate, getWeekStartFriday } from '@/lib/analytics-utils';

// Re-export the getWeekStart function from analytics-utils for consistency
export const getWeekStart = getWeekStartFriday;

/**
 * Calculate Wednesday vs special placement totals from collections and events
 * 
 * @param collections - Array of collections to process
 * @param events - Array of events to process
 * @returns Object containing wednesdayTotal and specialPlacementTotal
 */
export function calculatePlacementTotals(
  collections: Array<{
    collectionDate: string;
    groupCollections?: Array<{
      count?: number;
      sandwichCount?: number;
    }>;
  }>,
  events: Array<{
    desiredEventDate: string;
    estimatedSandwichCount: number;
  }>
): { wednesdayTotal: number; specialPlacementTotal: number } {
  let wednesdayTotal = 0;
  let specialPlacementTotal = 0;

  collections.forEach((c) => {
    const date = parseCollectionDate(c.collectionDate);
    const groupTotal = (Array.isArray(c.groupCollections) ? c.groupCollections : [])
      .reduce((gsum, g) => gsum + (g.count || g.sandwichCount || 0), 0);

    if (date.getDay() === 3) { // Wednesday
      wednesdayTotal += groupTotal;
    } else {
      specialPlacementTotal += groupTotal;
    }
  });

  events.forEach((event) => {
    const eventDate = new Date(event.desiredEventDate);
    const eventTotal = event.estimatedSandwichCount || 0;

    if (eventDate.getDay() === 3) { // Wednesday
      wednesdayTotal += eventTotal;
    } else {
      specialPlacementTotal += eventTotal;
    }
  });

  return { wednesdayTotal, specialPlacementTotal };
}
