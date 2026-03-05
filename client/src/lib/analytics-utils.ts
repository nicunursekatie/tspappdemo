import type { SandwichCollection, Host } from '@shared/schema';
import { logger } from '@/lib/logger';
import { isInExcludedWeek } from '@/lib/excluded-weeks';
import type { HybridStats, CollectionsStats } from '@/hooks/useCollectionsData';

/**
 * Parse a collection date string and ensure YYYY-MM-DD values are treated as local time.
 */
export function parseCollectionDate(dateStr: string): Date {
  if (!dateStr) {
    return new Date(NaN);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00`);
  }

  return new Date(dateStr);
}

/**
 * Standardized group sandwiches calculation for consistent analytics across all components.
 * This function ensures all frontend components use the same logic as the backend stats endpoint.
 *
 * Priority:
 * 1. Use groupCollections JSONB array if available and non-empty
 * 2. Fallback to legacy group1Count + group2Count for older records
 */
export function calculateGroupSandwiches(
  collection: SandwichCollection
): number {
  // Primary: Use groupCollections JSONB array if available and non-empty
  if (
    collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0
  ) {
    return collection.groupCollections.reduce((sum, group) => {
      // Handle both 'count' and 'sandwichCount' field names for backward compatibility
      const count = Number(group.count || (group as any).sandwichCount || 0);
      return sum + count;
    }, 0);
  }

  // Handle string-encoded JSON (if data comes from API as string)
  if (
    collection.groupCollections &&
    typeof collection.groupCollections === 'string' &&
    collection.groupCollections !== '' &&
    collection.groupCollections !== '[]'
  ) {
    try {
      const groupData = JSON.parse(collection.groupCollections);
      if (Array.isArray(groupData) && groupData.length > 0) {
        return groupData.reduce((sum, group) => {
          const count = Number(group.count || group.sandwichCount || 0);
          return sum + count;
        }, 0);
      }
    } catch (e) {
      logger.log('Error parsing groupCollections JSON:', e);
      // Fall through to legacy calculation
    }
  }

  // Fallback: Use legacy group1Count + group2Count for older records
  const group1Count = Number((collection as any).group1Count || 0);
  const group2Count = Number((collection as any).group2Count || 0);
  return group1Count + group2Count;
}

/**
 * Calculate total sandwiches (individual + group) for a collection
 */
export function calculateTotalSandwiches(
  collection: SandwichCollection
): number {
  const individual = Number(collection.individualSandwiches || 0);
  const group = calculateGroupSandwiches(collection);
  return individual + group;
}

/**
 * Calculate the Friday start of the week for a given date.
 * Weeks run Friday to Thursday (with Thursday being distribution day).
 *
 * @param date - Any date within the week
 * @returns The Friday that starts that week
 */
export function getWeekStartFriday(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);

  const day = weekStart.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Calculate days to subtract to get to the previous or current Friday
  // Friday=0 days, Saturday=1 day, Sunday=2 days, Monday=3 days, ..., Thursday=6 days
  const daysFromFriday = (day + 2) % 7; // Convert to days since last Friday

  weekStart.setDate(weekStart.getDate() - daysFromFriday);
  return weekStart;
}

/**
 * Calculate the Thursday end of the week for a given Friday start date.
 *
 * @param fridayStart - The Friday start of the week
 * @returns The Thursday that ends that week
 */
export function getWeekEndThursday(fridayStart: Date): Date {
  const weekEnd = new Date(fridayStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Friday + 6 days = Thursday
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Check if a week is complete (we've passed Thursday).
 *
 * @param fridayStart - The Friday start of the week
 * @param referenceDate - The current date (defaults to now)
 * @returns true if the week is complete (past Thursday), false if in progress
 */
export function isWeekComplete(fridayStart: Date, referenceDate: Date = new Date()): boolean {
  const thursday = getWeekEndThursday(fridayStart);
  return referenceDate > thursday;
}

/**
 * Calculate weekly data buckets from collections for accurate weekly analytics.
 * Weeks run Friday to Thursday (with Thursday being distribution day).
 */
export function calculateWeeklyData(collections: SandwichCollection[]): Array<{
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
  isComplete: boolean;
}> {
  const weeklyData: Record<
    string,
    {
      weekStartDate: string;
      weekEndDate: string;
      weekLabel: string;
      fridayStart: Date;
      totalSandwiches: number;
      totalCollections: number;
      hosts: Set<string>;
    }
  > = {};

  collections.forEach((collection) => {
    if (!collection.collectionDate) return;

    const date = parseCollectionDate(collection.collectionDate);

    // Calculate week start (Friday)
    const fridayStart = getWeekStartFriday(date);
    const thursdayEnd = getWeekEndThursday(fridayStart);

    const weekKey = fridayStart.toISOString().split('T')[0]; // YYYY-MM-DD format
    const weekLabel = `${fridayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${thursdayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStartDate: weekKey,
        weekEndDate: thursdayEnd.toISOString().split('T')[0],
        weekLabel,
        fridayStart,
        totalSandwiches: 0,
        totalCollections: 0,
        hosts: new Set(),
      };
    }

    const totalSandwiches = calculateTotalSandwiches(collection);
    weeklyData[weekKey].totalSandwiches += totalSandwiches;
    weeklyData[weekKey].totalCollections += 1;

    if (collection.hostName) {
      weeklyData[weekKey].hosts.add(collection.hostName);
    }
  });

  return Object.values(weeklyData)
    .map((week) => ({
      weekStartDate: week.weekStartDate,
      weekEndDate: week.weekEndDate,
      weekLabel: week.weekLabel,
      totalSandwiches: week.totalSandwiches,
      totalCollections: week.totalCollections,
      uniqueHosts: week.hosts.size,
      isComplete: isWeekComplete(week.fridayStart),
    }))
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
}

/**
 * Get the record week (best performing week) from collections data
 */
export function getRecordWeek(collections: SandwichCollection[]): {
  total: number;
  weekLabel: string;
} {
  const weeklyData = calculateWeeklyData(collections);

  if (weeklyData.length === 0) {
    return { total: 0, weekLabel: 'No data' };
  }

  const recordWeek = weeklyData.reduce((best, week) =>
    week.totalSandwiches > best.totalSandwiches ? week : best
  );

  return {
    total: recordWeek.totalSandwiches,
    weekLabel: recordWeek.weekLabel,
  };
}

/**
 * Calculate actual average weekly sandwiches from collections data.
 * Only includes complete weeks (past Thursday) to avoid skewing the average.
 * Excludes no-collection weeks (Thanksgiving, holidays on Wed/Thu).
 */
export function calculateActualWeeklyAverage(
  collections: SandwichCollection[]
): number {
  const weeklyData = calculateWeeklyData(collections);

  // Filter to only complete weeks and exclude no-collection weeks (Thanksgiving, holidays)
  const activeWeeks = weeklyData.filter(week => {
    if (!week.isComplete) return false;
    // Check if this is an excluded week (uses Wednesday of the week)
    // weekStartDate is Friday, so we need to go back 2 days to get Wednesday
    const fridayDate = new Date(week.weekStartDate + 'T12:00:00');
    const wednesdayDate = new Date(fridayDate);
    wednesdayDate.setDate(fridayDate.getDate() - 2);
    const wednesdayStr = wednesdayDate.toISOString().split('T')[0];
    return !isInExcludedWeek(wednesdayStr).excluded;
  });

  if (activeWeeks.length === 0) return 0;

  const totalSandwiches = activeWeeks.reduce(
    (sum, week) => sum + week.totalSandwiches,
    0
  );
  return Math.round(totalSandwiches / activeWeeks.length);
}

// ============================================================================
// SANDWICH TYPE BREAKDOWN FUNCTIONS
// ============================================================================

/**
 * Type breakdown structure for sandwich analytics
 */
export interface TypeBreakdown {
  deli: number;
  turkey: number;
  ham: number;
  pbj: number;
  total: number;
}

/**
 * Calculate individual sandwich type breakdown for a collection.
 * 
 * Returns breakdown of individual sandwiches by type (deli, turkey, ham, pbj).
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with deli, turkey, ham, pbj counts and total
 */
export function calculateIndividualTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  const deli = Number(collection.individualDeli || 0);
  const turkey = Number(collection.individualTurkey || 0);
  const ham = Number(collection.individualHam || 0);
  const pbj = Number(collection.individualPbj || 0);
  
  return {
    deli,
    turkey,
    ham,
    pbj,
    total: deli + turkey + ham + pbj,
  };
}

/**
 * Calculate group sandwich type breakdown for a collection.
 * 
 * Aggregates type data from all groups in the collection's groupCollections array.
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with deli, turkey, ham, pbj counts and total
 */
export function calculateGroupTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  let deli = 0;
  let turkey = 0;
  let ham = 0;
  let pbj = 0;

  // Primary: Use groupCollections JSONB array if available and non-empty
  if (
    collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0
  ) {
    collection.groupCollections.forEach((group) => {
      deli += Number(group.deli || 0);
      turkey += Number(group.turkey || 0);
      ham += Number(group.ham || 0);
      pbj += Number(group.pbj || 0);
    });
    
    return {
      deli,
      turkey,
      ham,
      pbj,
      total: deli + turkey + ham + pbj,
    };
  }

  // Handle string-encoded JSON (if data comes from API as string)
  if (
    collection.groupCollections &&
    typeof collection.groupCollections === 'string' &&
    collection.groupCollections !== '' &&
    collection.groupCollections !== '[]'
  ) {
    try {
      const groupData = JSON.parse(collection.groupCollections);
      if (Array.isArray(groupData) && groupData.length > 0) {
        groupData.forEach((group) => {
          deli += Number(group.deli || 0);
          turkey += Number(group.turkey || 0);
          ham += Number(group.ham || 0);
          pbj += Number(group.pbj || 0);
        });
      }
    } catch (e) {
      logger.log('Error parsing groupCollections JSON for type breakdown:', e);
      // Return zeros on error
    }
  }

  return {
    deli,
    turkey,
    ham,
    pbj,
    total: deli + turkey + ham + pbj,
  };
}

/**
 * Calculate total sandwich type breakdown for a collection.
 * 
 * Combines individual and group type data to provide complete breakdown.
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with combined deli, turkey, ham, pbj counts and total
 */
export function calculateTotalTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  const individualBreakdown = calculateIndividualTypeBreakdown(collection);
  const groupBreakdown = calculateGroupTypeBreakdown(collection);

  return {
    deli: individualBreakdown.deli + groupBreakdown.deli,
    turkey: individualBreakdown.turkey + groupBreakdown.turkey,
    ham: individualBreakdown.ham + groupBreakdown.ham,
    pbj: individualBreakdown.pbj + groupBreakdown.pbj,
    total: individualBreakdown.total + groupBreakdown.total,
  };
}

/**
 * Aggregate sandwich type breakdown across multiple collections.
 * 
 * Sums type data across all collections in the dataset to provide organization-wide totals.
 * Backward compatible - handles collections without type data gracefully.
 * 
 * @param collections - Array of sandwich collections to aggregate
 * @returns Type breakdown with total deli, turkey, ham, pbj counts across all collections
 */
export function aggregateTypeBreakdownAcrossCollections(
  collections: SandwichCollection[]
): TypeBreakdown {
  let totalDeli = 0;
  let totalTurkey = 0;
  let totalHam = 0;
  let totalPbj = 0;

  collections.forEach((collection) => {
    const breakdown = calculateTotalTypeBreakdown(collection);
    totalDeli += breakdown.deli;
    totalTurkey += breakdown.turkey;
    totalHam += breakdown.ham;
    totalPbj += breakdown.pbj;
  });

  return {
    deli: totalDeli,
    turkey: totalTurkey,
    ham: totalHam,
    pbj: totalPbj,
    total: totalDeli + totalTurkey + totalHam + totalPbj,
  };
}

// ============================================================================
// YEARLY BREAKDOWN FUNCTIONS
// ============================================================================

/**
 * Yearly total structure for analytics
 */
export interface YearlyTotal {
  year: number;
  totalSandwiches: number;
  totalCollections: number;
  isPeakYear?: boolean;
  isIncomplete?: boolean;
}

/**
 * Calculate yearly breakdown from collections data.
 *
 * Groups collections by year and calculates total sandwiches per year.
 * Uses the same calculation logic as the backend stats endpoint.
 *
 * @param collections - Array of sandwich collections to analyze
 * @returns Array of yearly totals sorted by year (newest first)
 */
export function calculateYearlyBreakdown(
  collections: SandwichCollection[]
): YearlyTotal[] {
  const yearlyData: Record<number, { sandwiches: number; count: number }> = {};

  collections.forEach((collection) => {
    if (!collection.collectionDate) return;

    // Parse date and extract year
    const date = parseCollectionDate(collection.collectionDate);
    const year = date.getFullYear();

    // Skip invalid years
    if (isNaN(year) || year < 2000 || year > 2100) return;

    // Calculate total sandwiches for this collection
    const individual = Number(collection.individualSandwiches || 0);
    const groupTotal = calculateGroupSandwiches(collection);
    const collectionTotal = individual + groupTotal;

    // Initialize year if not exists
    if (!yearlyData[year]) {
      yearlyData[year] = { sandwiches: 0, count: 0 };
    }

    // Add to yearly total
    yearlyData[year].sandwiches += collectionTotal;
    yearlyData[year].count += 1;
  });

  // Convert to array and sort by year (newest first)
  const yearlyTotals: YearlyTotal[] = Object.entries(yearlyData)
    .map(([yearStr, data]) => {
      const year = parseInt(yearStr);
      return {
        year,
        totalSandwiches: data.sandwiches,
        totalCollections: data.count,
      };
    })
    .sort((a, b) => b.year - a.year);

  // Mark peak year(s) (highest sandwich count, handle ties)
  if (yearlyTotals.length > 0) {
    const maxSandwiches = Math.max(...yearlyTotals.map(y => y.totalSandwiches));
    if (maxSandwiches > 0) {
      yearlyTotals.forEach(y => {
        if (y.totalSandwiches === maxSandwiches) {
          y.isPeakYear = true;
        }
      });
    }
  }

  // Mark current year as incomplete
  const currentYear = new Date().getFullYear();
  const currentYearData = yearlyTotals.find(y => y.year === currentYear);
  if (currentYearData) {
    currentYearData.isIncomplete = true;
  }

  return yearlyTotals;
}

// ============================================================================
// CHART DATA PROCESSING FUNCTIONS
// ============================================================================

export type DateRangeFilter = '3months' | '6months' | '1year' | 'all';
export type ChartViewType = 'daily' | 'weekly' | 'monthly';

export interface ChartDataPoint {
  period: string;
  sandwiches: number;
  collections: number;
  hosts: number;
  [key: string]: string | number; // Allow 'week' or 'month' keys
}

/**
 * Process collection data for time-based chart visualizations.
 * Groups collections by week or month based on chartView.
 */
export function processCollectionDataForChart(
  collections: SandwichCollection[],
  dateRange: DateRangeFilter,
  chartView: ChartViewType
): ChartDataPoint[] {
  if (!Array.isArray(collections) || collections.length === 0) {
    return [];
  }

  // Calculate date cutoff based on selected range
  const now = new Date();
  let cutoffDate: Date | null = null;

  switch (dateRange) {
    case '3months':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6months':
      cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case '1year':
      cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    case 'all':
      cutoffDate = null;
      break;
  }

  // Filter collections by date range
  const filteredCollections = cutoffDate
    ? collections.filter((collection) => {
        if (!collection.collectionDate) return false;
        const date = parseCollectionDate(collection.collectionDate);
        return !Number.isNaN(date.getTime()) && date >= cutoffDate;
      })
    : collections;

  const timeData: Record<string, {
    period: string;
    sandwiches: number;
    collections: number;
    hosts: Set<string>;
  }> = {};

  filteredCollections.forEach((collection) => {
    const collectionDate = collection.collectionDate;
    if (collectionDate) {
      const date = parseCollectionDate(collectionDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      let periodKey: string;

      if (chartView === 'weekly') {
        // Group by week (starting Monday)
        const weekStart = new Date(date);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        periodKey = `Week of ${weekStart.getFullYear()}-${String(
          weekStart.getMonth() + 1
        ).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      } else {
        // Group by month
        periodKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, '0')}`;
      }

      if (!timeData[periodKey]) {
        timeData[periodKey] = {
          period: periodKey,
          sandwiches: 0,
          collections: 0,
          hosts: new Set(),
        };
      }

      const totalSandwiches = calculateTotalSandwiches(collection);
      timeData[periodKey].sandwiches += totalSandwiches;
      timeData[periodKey].collections += 1;

      if (collection.hostName) {
        timeData[periodKey].hosts.add(collection.hostName);
      }
    }
  });

  return Object.values(timeData)
    .map((item) => ({
      [chartView === 'weekly' ? 'week' : 'month']: item.period,
      period: item.period,
      sandwiches: item.sandwiches,
      collections: item.collections,
      hosts: item.hosts.size,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ============================================================================
// HOST PERFORMANCE FUNCTIONS
// ============================================================================

export interface HostPerformance {
  name: string;
  totalSandwiches: number;
  totalCollections: number;
  avgPerCollection: number;
}

/**
 * Calculate host performance metrics from collections.
 * Returns top 10 hosts sorted by total sandwiches.
 */
export function calculateHostPerformance(
  collections: SandwichCollection[],
  limit: number = 10
): HostPerformance[] {
  if (!Array.isArray(collections) || collections.length === 0) {
    return [];
  }

  const hostData: Record<string, {
    name: string;
    totalSandwiches: number;
    totalCollections: number;
  }> = {};

  collections.forEach((collection) => {
    const hostName = collection.hostName || 'Unknown';

    if (!hostData[hostName]) {
      hostData[hostName] = {
        name: hostName,
        totalSandwiches: 0,
        totalCollections: 0,
      };
    }

    const totalSandwiches = calculateTotalSandwiches(collection);
    hostData[hostName].totalSandwiches += totalSandwiches;
    hostData[hostName].totalCollections += 1;
  });

  return Object.values(hostData)
    .map((host) => ({
      ...host,
      avgPerCollection:
        host.totalCollections > 0
          ? Math.round(host.totalSandwiches / host.totalCollections)
          : 0,
    }))
    .sort((a, b) => b.totalSandwiches - a.totalSandwiches)
    .slice(0, limit);
}

// ============================================================================
// TREND ANALYSIS FUNCTIONS
// ============================================================================

export interface TrendInfo {
  status: string;
  percentage: number;
  description: string;
  change?: number;
}

export interface TrendAnalysis {
  recentTrend: TrendInfo;
  seasonalContext: TrendInfo;
}

/**
 * Calculate dynamic trend analysis from collection data.
 * Compares recent 4 weeks vs previous 4 weeks, and seasonal patterns.
 */
export function calculateTrendAnalysis(
  collections: SandwichCollection[]
): TrendAnalysis {
  if (!Array.isArray(collections) || collections.length === 0) {
    return {
      recentTrend: { status: 'Loading...', percentage: 0, description: 'Analyzing data...' },
      seasonalContext: { status: 'Loading...', percentage: 0, description: 'Calculating patterns...' }
    };
  }

  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - (4 * 7 * 24 * 60 * 60 * 1000));
  const eightWeeksAgo = new Date(now.getTime() - (8 * 7 * 24 * 60 * 60 * 1000));

  // Recent trend (last 4 weeks vs previous 4 weeks)
  const recentCollections = collections.filter(c => {
    if (!c.collectionDate) return false;
    const date = parseCollectionDate(c.collectionDate);
    const time = date.getTime();
    return time >= fourWeeksAgo.getTime() && time <= now.getTime();
  });

  const previousCollections = collections.filter(c => {
    if (!c.collectionDate) return false;
    const date = parseCollectionDate(c.collectionDate);
    const time = date.getTime();
    return time >= eightWeeksAgo.getTime() && time < fourWeeksAgo.getTime();
  });

  const recentTotal = recentCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);
  const previousTotal = previousCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);

  const trendChange = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0;

  let trendStatus = 'Steady';
  let trendPercentage = 75;
  let trendDescription = 'Consistent weekly collection performance';

  const clampedTrendChange = Math.max(-100, Math.min(100, trendChange));

  if (trendChange > 15) {
    trendStatus = 'Growing';
    trendPercentage = Math.min(85, 75 + (clampedTrendChange * 0.2));
    trendDescription = 'Strong upward collection trend';
  } else if (trendChange < -15) {
    trendStatus = 'Declining';
    trendPercentage = Math.max(60, 75 + (clampedTrendChange * 0.2));
    trendDescription = 'Collections below recent average';
  } else if (Math.abs(trendChange) <= 5) {
    trendStatus = 'Steady';
    trendPercentage = 75;
    trendDescription = 'Consistent weekly collection performance';
  }

  trendPercentage = Math.max(0, Math.min(100, trendPercentage));

  // Seasonal context
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthCollections = collections.filter(c => {
    if (!c.collectionDate) return false;
    const date = parseCollectionDate(c.collectionDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyTotalsByYear: Record<number, number> = {};

  collections.forEach(c => {
    if (!c.collectionDate) return;
    const date = parseCollectionDate(c.collectionDate);
    if (date.getMonth() === currentMonth && date.getFullYear() < currentYear) {
      const year = date.getFullYear();
      if (!monthlyTotalsByYear[year]) {
        monthlyTotalsByYear[year] = 0;
      }
      monthlyTotalsByYear[year] += calculateTotalSandwiches(c);
    }
  });

  const currentMonthTotal = currentMonthCollections.reduce((sum, c) => sum + calculateTotalSandwiches(c), 0);
  const yearlyTotals = Object.values(monthlyTotalsByYear);
  const avgSameMonth = yearlyTotals.length > 0 ?
    yearlyTotals.reduce((sum, total) => sum + total, 0) / yearlyTotals.length : 0;

  const monthNames = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
  const seasonName = monthNames[currentMonth];

  let seasonalPercentage = 70;
  let seasonalDescription = `Tracking ${seasonName.toLowerCase()} collection patterns`;

  if (avgSameMonth > 0) {
    const seasonalChange = ((currentMonthTotal - avgSameMonth) / avgSameMonth) * 100;
    const clampedChange = Math.max(-100, Math.min(100, seasonalChange));

    if (seasonalChange > 10) {
      seasonalPercentage = Math.min(85, 70 + (clampedChange * 0.3));
      seasonalDescription = `Strong ${seasonName.toLowerCase()} performance vs historical average`;
    } else if (seasonalChange < -10) {
      seasonalPercentage = Math.max(55, 70 + (clampedChange * 0.3));
      seasonalDescription = `Below average for ${seasonName.toLowerCase()} season`;
    }

    seasonalPercentage = Math.max(0, Math.min(100, seasonalPercentage));
  }

  return {
    recentTrend: {
      status: trendStatus,
      percentage: trendPercentage,
      description: trendDescription,
      change: trendChange
    },
    seasonalContext: {
      status: `${seasonName} Activity`,
      percentage: seasonalPercentage,
      description: seasonalDescription
    }
  };
}

// ============================================================================
// IMPACT METRICS FUNCTIONS
// ============================================================================

export interface ImpactMetrics {
  totalSandwiches: number;
  year2023Total: number;
  year2024Total: number;
  year2025YTD: number;
  totalCollections: number;
  uniqueHosts: number;
  currentMonthTotal: number;
  currentMonthCollections: number;
}

/**
 * Calculate impact metrics combining hybrid stats and collection data.
 * Uses authoritative data when available, falls back to collection log.
 */
export function calculateImpactMetrics(
  collections: SandwichCollection[],
  hybridStats: HybridStats | null,
  stats: CollectionsStats | null,
  activeHostCount: number = 34
): ImpactMetrics {
  // Use hybrid stats total (authoritative data through 8/6/2025 + collection log after)
  const totalSandwiches = hybridStats?.total || stats?.completeTotalSandwiches || 0;
  const totalCollections = collections?.length || 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  let currentMonthTotal = 0;
  let currentMonthCollections = 0;

  // Use authoritative yearly totals from hybrid stats if available
  const yearTotals: Record<number, number> = {
    2023: 0,
    2024: 0,
    2025: 0,
  };

  if (hybridStats?.byYear) {
    Object.entries(hybridStats.byYear).forEach(([year, data]) => {
      const y = parseInt(year);
      if (yearTotals[y] !== undefined) {
        yearTotals[y] = data?.sandwiches ?? 0;
      }
    });
  } else {
    // Fallback to calculating from collections if hybrid stats not available
    if (Array.isArray(collections)) {
      collections.forEach((collection) => {
        if (collection.collectionDate) {
          const date = parseCollectionDate(collection.collectionDate);
          if (Number.isNaN(date.getTime())) return;
          const year = date.getFullYear();
          const collectionTotal = calculateTotalSandwiches(collection);

          if (yearTotals[year] !== undefined) {
            yearTotals[year] += collectionTotal;
          }
        }
      });
    }
  }

  // Calculate current month totals (always from collections for real-time data)
  if (Array.isArray(collections)) {
    collections.forEach((collection) => {
      if (collection.collectionDate) {
        const date = parseCollectionDate(collection.collectionDate);
        if (Number.isNaN(date.getTime())) return;
        const year = date.getFullYear();
        const month = date.getMonth();
        const collectionTotal = calculateTotalSandwiches(collection);

        if (year === currentYear && month === currentMonth) {
          currentMonthTotal += collectionTotal;
          currentMonthCollections += 1;
        }
      }
    });
  }

  return {
    totalSandwiches,
    year2023Total: yearTotals[2023],
    year2024Total: yearTotals[2024],
    year2025YTD: yearTotals[2025],
    totalCollections,
    uniqueHosts: activeHostCount,
    currentMonthTotal,
    currentMonthCollections,
  };
}
