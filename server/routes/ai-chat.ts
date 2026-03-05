import { Router, type Response } from 'express';
import { db } from '../db';
import { logger } from '../middleware/logger';
import OpenAI from 'openai';
import { userActivityLogs, authoritativeWeeklyCollections } from '@shared/schema';
import { sql, desc, and, gte } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../types/express';

export const aiChatRouter = Router();

// Helper to get OpenAI client
function getOpenAIClient(): OpenAI {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

// Helper to convert Date to YYYY-MM-DD string for timezone-safe comparison
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format event date for display
function formatEventDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return 'TBD';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Helper to calculate sandwich count from collection
function getCollectionSandwichCount(collection: any): number {
  let total = 0;
  total += collection.individualSandwiches || 0;

  const hasGroupCollections = collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0;

  if (hasGroupCollections) {
    total += collection.groupCollections.reduce(
      (sum: number, group: any) => sum + (Number(group.count) || Number(group.sandwichCount) || 0), 0
    );
  } else {
    total += collection.group1Count || 0;
    total += collection.group2Count || 0;
  }
  return total;
}

// Helper function to fetch and format historical collection data for AI context
// This provides the authoritative historical trends that enable seasonal analysis
async function getHistoricalCollectionsContext(): Promise<string> {
  try {
    const authoritativeData = await db.select().from(authoritativeWeeklyCollections);

    if (authoritativeData.length === 0) {
      return '';
    }

    // Group by week of year to identify seasonal patterns
    const weeklyPatterns: Record<number, { totalSandwiches: number; weekCount: number; years: Set<number> }> = {};
    const yearlyTotals: Record<number, number> = {};
    const locationTotals: Record<string, number> = {};

    authoritativeData.forEach(record => {
      // Weekly patterns (for seasonality analysis)
      const weekNum = record.weekOfYear;
      if (!weeklyPatterns[weekNum]) {
        weeklyPatterns[weekNum] = { totalSandwiches: 0, weekCount: 0, years: new Set() };
      }
      weeklyPatterns[weekNum].totalSandwiches += record.sandwiches;
      weeklyPatterns[weekNum].weekCount++;
      weeklyPatterns[weekNum].years.add(record.year);

      // Yearly totals
      if (!yearlyTotals[record.year]) {
        yearlyTotals[record.year] = 0;
      }
      yearlyTotals[record.year] += record.sandwiches;

      // Location totals
      if (!locationTotals[record.location]) {
        locationTotals[record.location] = 0;
      }
      locationTotals[record.location] += record.sandwiches;
    });

    // Calculate average sandwiches per week for each week of year
    const weeklyAverages = Object.entries(weeklyPatterns)
      .map(([week, data]) => ({
        week: parseInt(week),
        avgSandwiches: Math.round(data.totalSandwiches / data.weekCount),
        yearsOfData: data.years.size
      }))
      .sort((a, b) => a.week - b.week);

    // Find historically low and high weeks
    const sortedByAvg = [...weeklyAverages].sort((a, b) => a.avgSandwiches - b.avgSandwiches);
    const lowWeeks = sortedByAvg.slice(0, 10);
    const highWeeks = sortedByAvg.slice(-10).reverse();

    return `

### Historical Data (Authoritative Source: 2020-2025)
This is verified historical data from Scott's tracking system, providing accurate trend analysis.

#### Yearly Totals (Verified)
${Object.entries(yearlyTotals)
  .sort(([a], [b]) => parseInt(a) - parseInt(b))
  .map(([year, total]) => `- ${year}: ${total.toLocaleString()} sandwiches`)
  .join('\n')}

#### Weekly Seasonal Patterns (Historical Averages by Week of Year)
These are the average sandwiches collected per week, based on ${Math.max(...weeklyAverages.map(w => w.yearsOfData))} years of data:

**Historically LOW collection weeks (prepare for reduced volume):**
${lowWeeks.map(w => `- Week ${w.week}: avg ${w.avgSandwiches.toLocaleString()} sandwiches (based on ${w.yearsOfData} years)`).join('\n')}

**Historically HIGH collection weeks (expect increased volume):**
${highWeeks.map(w => `- Week ${w.week}: avg ${w.avgSandwiches.toLocaleString()} sandwiches (based on ${w.yearsOfData} years)`).join('\n')}

#### Top Host Locations (All-Time Historical)
${Object.entries(locationTotals)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 15)
  .map(([location, total]) => `- ${location}: ${total.toLocaleString()} sandwiches`)
  .join('\n')}

Note: Week numbers follow ISO standard (Week 1 starts first week of January). Use this historical data to predict seasonal trends and identify which upcoming weeks are typically low or high for collections.
`;
  } catch (err) {
    logger.warn('Could not fetch authoritative historical data for AI context', { error: err });
    return '';
  }
}

// Format raw data from component into AI-readable context
// This is the preferred path - components pass their actual displayed data
function formatRawDataForAI(contextType: string, contextData: Record<string, any>): string {
  const { rawData, summaryStats, filters, selectedItem, currentView } = contextData;

  let context = `## ${getContextTitle(contextType)} Data\n\n`;

  // Add current view/filter context
  if (currentView) {
    context += `**Current View:** ${currentView}\n`;
  }
  if (filters && Object.keys(filters).length > 0) {
    context += `**Active Filters:** ${JSON.stringify(filters)}\n`;
  }
  if (selectedItem) {
    context += `**Currently Selected:** ${JSON.stringify(selectedItem)}\n`;
  }
  context += '\n';

  // Add summary stats if provided
  if (summaryStats) {
    context += `### Summary Statistics\n`;
    for (const [key, value] of Object.entries(summaryStats)) {
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      if (typeof value === 'object' && value !== null) {
        context += `- ${formattedKey}:\n`;
        for (const [subKey, subValue] of Object.entries(value)) {
          context += `  - ${subKey}: ${subValue}\n`;
        }
      } else {
        context += `- ${formattedKey}: ${value}\n`;
      }
    }
    context += '\n';
  }

  // Format raw data based on context type
  if (rawData) {
    if (Array.isArray(rawData)) {
      context += `### Data (${rawData.length} items)\n`;

      // Limit to prevent token overflow - take sample for large datasets
      const sampleSize = 100;
      const items = rawData.length > sampleSize
        ? rawData.slice(0, sampleSize)
        : rawData;

      if (rawData.length > sampleSize) {
        context += `(Showing first ${sampleSize} of ${rawData.length} items)\n\n`;
      }

      // Format each item
      items.forEach((item: any, index: number) => {
        context += formatDataItem(item, contextType, index);
      });
    } else if (typeof rawData === 'object') {
      context += `### Data\n`;
      context += JSON.stringify(rawData, null, 2);
    }
  }

  return context;
}

// Get display title for context type
function getContextTitle(contextType: string): string {
  const titles: Record<string, string> = {
    'collections': 'Sandwich Collections',
    'events': 'Event Requests',
    'organizations': 'Groups Catalog',
    'holding-zone': 'Holding Zone',
    'network': 'TSP Network',
    'projects': 'Projects',
    'meetings': 'Meetings',
    'resources': 'Resources',
    'links': 'Important Links',
    'dashboard': 'Dashboard',
    'volunteer-calendar': 'Volunteer Calendar',
    'impact-reports': 'Impact Reports',
    'users': 'User Management',
    'general': 'Platform',
  };
  return titles[contextType] || 'Data';
}

// Format individual data item for AI context
function formatDataItem(item: any, contextType: string, index: number): string {
  // Skip null/undefined items
  if (!item) return '';

  // For groups/organizations catalog
  if (contextType === 'organizations') {
    const name = item.organizationName || item.name || item.groupName || 'Unknown';
    const status = item.status || '';
    const events = item.eventCount || item.totalRequests || 0;
    const sandwiches = item.actualSandwichTotal || item.sandwichCount || 0;
    const category = item.category || '';
    const hasHosted = item.hasHostedEvent ? 'Yes' : 'No';

    return `${index + 1}. **${name}**${category ? ` [${category}]` : ''} - Status: ${status}, Events: ${events}, Sandwiches: ${sandwiches.toLocaleString()}, Has Hosted: ${hasHosted}\n`;
  }

  // For event requests
  if (contextType === 'events') {
    const org = item.organizationName || 'Unknown';
    const status = item.status || '';
    const dateInput = item.scheduledEventDate || item.desiredEventDate;
    const date = formatEventDate(dateInput);
    const sandwiches = item.estimatedSandwichCount || item.actualSandwichCount || 0;

    return `${index + 1}. **${org}** - Date: ${date}, Status: ${status}, Sandwiches: ${sandwiches}\n`;
  }

  // For collections
  if (contextType === 'collections') {
    const host = item.hostName || 'Unknown';
    const date = item.collectionDate || '';
    const count = getCollectionSandwichCount(item);

    // Aggregate sandwich type breakdown (individual + groupCollections) for PBJ/deli/turkey/ham percentage questions
    let deli = item.individualDeli ?? 0;
    let turkey = item.individualTurkey ?? 0;
    let ham = item.individualHam ?? 0;
    let pbj = item.individualPbj ?? 0;
    let generic = item.individualGeneric ?? 0;
    if (item.groupCollections && Array.isArray(item.groupCollections)) {
      item.groupCollections.forEach((group: any) => {
        deli += group.deli ?? 0;
        turkey += group.turkey ?? 0;
        ham += group.ham ?? 0;
        pbj += group.pbj ?? 0;
        generic += group.generic ?? 0;
      });
    }
    const typeParts: string[] = [];
    if (deli > 0) typeParts.push(`deli: ${deli}`);
    if (turkey > 0) typeParts.push(`turkey: ${turkey}`);
    if (ham > 0) typeParts.push(`ham: ${ham}`);
    if (pbj > 0) typeParts.push(`pbj: ${pbj}`);
    if (generic > 0) typeParts.push(`generic: ${generic}`);
    const typeStr = typeParts.length > 0 ? ` | Types: ${typeParts.join(', ')}` : '';

    return `${index + 1}. **${host}** - Date: ${date}, Sandwiches: ${count}${typeStr}\n`;
  }

  // For projects
  if (contextType === 'projects') {
    const title = item.title || 'Untitled';
    const status = item.status || '';
    const priority = item.priority || '';

    return `${index + 1}. **${title}** - Status: ${status}, Priority: ${priority}\n`;
  }

  // For holding zone items
  if (contextType === 'holding-zone') {
    const content = item.content || item.title || 'No content';
    const type = item.type || '';
    const status = item.status || '';

    return `${index + 1}. [${type}] **${content.substring(0, 100)}**${content.length > 100 ? '...' : ''} - Status: ${status}\n`;
  }

  // For users
  if (contextType === 'users') {
    const name = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.email || 'Unknown';
    const role = item.role || 'unknown';
    const status = item.isActive ? 'Active' : 'Inactive';
    const email = item.email || 'No email';
    const lastLogin = item.lastLogin ? new Date(item.lastLogin).toLocaleDateString() : 'Never';

    return `${index + 1}. **${name}** (${email}) - Role: ${role}, Status: ${status}, Last Login: ${lastLogin}\n`;
  }

  // Default: show key fields
  const keyFields = ['name', 'title', 'status', 'type', 'date', 'count'];
  const relevantFields = Object.entries(item)
    .filter(([key]) => keyFields.some(kf => key.toLowerCase().includes(kf)))
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  return `${index + 1}. ${relevantFields || JSON.stringify(item).substring(0, 200)}\n`;
}

// Build context for collections
async function buildCollectionsContext(contextData?: Record<string, any>): Promise<string> {
  const allCollections = await db.query.sandwichCollections.findMany();

  // Filter out deleted collections
  let collections = allCollections.filter(c => !c.deletedAt);

  // Build component-specific context section
  let componentContext = '';

  // Apply filters from contextData if provided
  if (contextData) {
    // Date range filtering
    if (contextData.dateRange?.start || contextData.dateRange?.end) {
      const startDate = contextData.dateRange.start ? new Date(contextData.dateRange.start) : null;
      const endDate = contextData.dateRange.end ? new Date(contextData.dateRange.end) : null;

      collections = collections.filter(c => {
        if (!c.collectionDate) return false;
        const collectionDate = new Date(c.collectionDate + 'T12:00:00');
        if (startDate && collectionDate < startDate) return false;
        if (endDate && collectionDate > endDate) return false;
        return true;
      });

      componentContext += `\n### Current View Filters\n`;
      componentContext += `- Date Range: ${startDate?.toLocaleDateString() || 'Any'} to ${endDate?.toLocaleDateString() || 'Any'}\n`;
    }

    // Host filtering
    if (contextData.selectedHost) {
      collections = collections.filter(c => c.hostName === contextData.selectedHost);
      componentContext += `- Filtered by Host: ${contextData.selectedHost}\n`;
    }

    // Year type (fiscal vs calendar) for grant metrics
    const yearType = contextData.yearType || 'calendar';
    if (contextData.yearType) {
      componentContext += `- Year Type: ${contextData.yearType}\n`;
    }

    // Selected year - actually filter the data
    if (contextData.selectedYear && contextData.selectedYear !== 'all') {
      const selectedYear = parseInt(contextData.selectedYear);
      if (!isNaN(selectedYear)) {
        collections = collections.filter(c => {
          if (!c.collectionDate) return false;
          const collectionDate = new Date(c.collectionDate + 'T12:00:00');

          if (yearType === 'fiscal') {
            // Fiscal year runs July 1 to June 30
            // FY2024 = July 1, 2023 - June 30, 2024
            const month = collectionDate.getMonth(); // 0-11
            const calYear = collectionDate.getFullYear();
            const fiscalYear = month >= 6 ? calYear + 1 : calYear; // July+ is next fiscal year
            return fiscalYear === selectedYear;
          } else {
            // Calendar year
            return collectionDate.getFullYear() === selectedYear;
          }
        });
        componentContext += `- Selected Year: ${contextData.selectedYear}\n`;
      }
    }

    // Selected quarter - actually filter the data
    if (contextData.selectedQuarter && contextData.selectedQuarter !== 'all') {
      const quarter = contextData.selectedQuarter; // e.g., 'Q1', 'Q2', 'Q3', 'Q4'
      const quarterNum = parseInt(quarter.replace('Q', ''));

      if (!isNaN(quarterNum) && quarterNum >= 1 && quarterNum <= 4) {
        collections = collections.filter(c => {
          if (!c.collectionDate) return false;
          const collectionDate = new Date(c.collectionDate + 'T12:00:00');
          const month = collectionDate.getMonth(); // 0-11

          if (yearType === 'fiscal') {
            // Fiscal quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
            const fiscalQuarter = month >= 6 ? Math.floor((month - 6) / 3) + 1 : Math.floor((month + 6) / 3) + 1;
            return fiscalQuarter === quarterNum;
          } else {
            // Calendar quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
            const calendarQuarter = Math.floor(month / 3) + 1;
            return calendarQuarter === quarterNum;
          }
        });
        componentContext += `- Selected Quarter: ${contextData.selectedQuarter}\n`;
      }
    }

    // Current view/tab
    if (contextData.currentView || contextData.activeTab) {
      componentContext += `- Current View: ${contextData.currentView || contextData.activeTab}\n`;
    }

    // Any raw data the component wants to share
    if (contextData.rawData) {
      componentContext += `\n### Component-Specific Data\n`;
      componentContext += typeof contextData.rawData === 'string'
        ? contextData.rawData
        : JSON.stringify(contextData.rawData, null, 2);
      componentContext += '\n';
    }

    // Summary stats from the component
    if (contextData.summaryStats) {
      componentContext += `\n### Current Summary (from component)\n`;
      Object.entries(contextData.summaryStats).forEach(([key, value]) => {
        componentContext += `- ${key}: ${value}\n`;
      });
    }
  }

  // Calculate metrics
  let totalSandwiches = 0;
  const hostStats: Record<string, { collections: number; sandwiches: number }> = {};
  const monthlyStats: Record<string, { collections: number; sandwiches: number }> = {};
  const dayOfWeekStats: Record<string, { collections: number; sandwiches: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  collections.forEach(c => {
    const sandwichCount = getCollectionSandwichCount(c);
    totalSandwiches += sandwichCount;

    // Host stats
    const hostName = c.hostName || 'Unknown';
    if (!hostStats[hostName]) {
      hostStats[hostName] = { collections: 0, sandwiches: 0 };
    }
    hostStats[hostName].collections++;
    hostStats[hostName].sandwiches += sandwichCount;

    // Monthly stats
    if (c.collectionDate) {
      const date = new Date(c.collectionDate + 'T12:00:00');
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { collections: 0, sandwiches: 0 };
      }
      monthlyStats[monthKey].collections++;
      monthlyStats[monthKey].sandwiches += sandwichCount;

      // Day of week stats
      const dayName = dayNames[date.getDay()];
      if (!dayOfWeekStats[dayName]) {
        dayOfWeekStats[dayName] = { collections: 0, sandwiches: 0 };
      }
      dayOfWeekStats[dayName].collections++;
      dayOfWeekStats[dayName].sandwiches += sandwichCount;
    }
  });

  // Average collection size
  const avgCollectionSize = collections.length > 0
    ? Math.round(totalSandwiches / collections.length)
    : 0;

  // Recent months for trend analysis (last 6 months)
  const recentMonths = Object.entries(monthlyStats)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .reverse();

  // Fetch authoritative historical data for complete context
  // This is Scott's verified data from 2020-2024 and 2025 through Aug 6
  let historicalContext = '';
  try {
    const authoritativeData = await db.select().from(authoritativeWeeklyCollections);

    if (authoritativeData.length > 0) {
      // Group by week of year to identify seasonal patterns
      const weeklyPatterns: Record<number, { totalSandwiches: number; weekCount: number; years: Set<number> }> = {};
      const yearlyTotals: Record<number, number> = {};
      const locationTotals: Record<string, number> = {};

      authoritativeData.forEach(record => {
        // Weekly patterns (for seasonality analysis)
        const weekNum = record.weekOfYear;
        if (!weeklyPatterns[weekNum]) {
          weeklyPatterns[weekNum] = { totalSandwiches: 0, weekCount: 0, years: new Set() };
        }
        weeklyPatterns[weekNum].totalSandwiches += record.sandwiches;
        weeklyPatterns[weekNum].weekCount++;
        weeklyPatterns[weekNum].years.add(record.year);

        // Yearly totals
        if (!yearlyTotals[record.year]) {
          yearlyTotals[record.year] = 0;
        }
        yearlyTotals[record.year] += record.sandwiches;

        // Location totals
        if (!locationTotals[record.location]) {
          locationTotals[record.location] = 0;
        }
        locationTotals[record.location] += record.sandwiches;
      });

      // Calculate average sandwiches per week for each week of year
      const weeklyAverages = Object.entries(weeklyPatterns)
        .map(([week, data]) => ({
          week: parseInt(week),
          avgSandwiches: Math.round(data.totalSandwiches / data.weekCount),
          yearsOfData: data.years.size
        }))
        .sort((a, b) => a.week - b.week);

      // Find historically low and high weeks
      const sortedByAvg = [...weeklyAverages].sort((a, b) => a.avgSandwiches - b.avgSandwiches);
      const lowWeeks = sortedByAvg.slice(0, 10);
      const highWeeks = sortedByAvg.slice(-10).reverse();

      historicalContext = `

### Historical Data (Authoritative Source: 2020-2025)
This is verified historical data from Scott's tracking system, providing accurate trend analysis.

#### Yearly Totals (Verified)
${Object.entries(yearlyTotals)
  .sort(([a], [b]) => parseInt(a) - parseInt(b))
  .map(([year, total]) => `- ${year}: ${total.toLocaleString()} sandwiches`)
  .join('\n')}

#### Weekly Seasonal Patterns (Historical Averages by Week of Year)
These are the average sandwiches collected per week, based on ${Math.max(...weeklyAverages.map(w => w.yearsOfData))} years of data:

**Historically LOW collection weeks (prepare for reduced volume):**
${lowWeeks.map(w => `- Week ${w.week}: avg ${w.avgSandwiches.toLocaleString()} sandwiches (based on ${w.yearsOfData} years)`).join('\n')}

**Historically HIGH collection weeks (expect increased volume):**
${highWeeks.map(w => `- Week ${w.week}: avg ${w.avgSandwiches.toLocaleString()} sandwiches (based on ${w.yearsOfData} years)`).join('\n')}

#### Top Host Locations (All-Time Historical)
${Object.entries(locationTotals)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 15)
  .map(([location, total]) => `- ${location}: ${total.toLocaleString()} sandwiches`)
  .join('\n')}

Note: Week numbers follow ISO standard (Week 1 starts first week of January). Use this historical data to predict seasonal trends and identify which upcoming weeks are typically low or high for collections.
`;
    }
  } catch (err) {
    logger.warn('Could not fetch authoritative historical data for AI context', { error: err });
  }

  return `
## Sandwich Collection Data Summary
${componentContext}
### Current Collection Log Metrics
- Total Collections in Log: ${collections.length}
- Total Sandwiches in Log: ${totalSandwiches.toLocaleString()}
- Average Sandwiches Per Collection: ${avgCollectionSize}
- Number of Active Host Locations: ${Object.keys(hostStats).length}

### Collections by Month (Recent 6 Months from Collection Log)
${recentMonths.map(([month, stats]) => `- ${month}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`).join('\n')}

### All-Time Monthly Data (from Collection Log)
${Object.entries(monthlyStats)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([month, stats]) => `- ${month}: ${stats.collections} collections, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}
${historicalContext}
Note: Individual sandwich collections are typically logged on Wednesday or Thursday (weekly collection day is Wednesday). Day-of-week analysis is not meaningful for individual collections.
`;
}

// Helper to check missing critical info for an event
function getEventMissingInfo(event: any): string[] {
  const missing: string[] = [];

  // Check for contact info (email OR phone)
  if (!event.email && !event.phone) {
    missing.push('Contact Info');
  }

  // Check for sandwich count
  const hasSandwichCount =
    (event.estimatedSandwichCount && event.estimatedSandwichCount > 0) ||
    (event.estimatedSandwichCountMin && event.estimatedSandwichCountMin > 0) ||
    (event.estimatedSandwichCountMax && event.estimatedSandwichCountMax > 0);

  if (!hasSandwichCount) {
    missing.push('Sandwich Info');
  }

  // Check for address (skip if org is delivering themselves)
  const organizationDelivering =
    (!event.driversNeeded || event.driversNeeded === 0) && !event.vanDriverNeeded;

  if (!organizationDelivering) {
    const hasAddress =
      (event.eventAddress && event.eventAddress.trim() !== '') ||
      (event.deliveryDestination && event.deliveryDestination.trim() !== '') ||
      (event.overnightHoldingLocation && event.overnightHoldingLocation.trim() !== '');

    if (!hasAddress) {
      missing.push('Address');
    }
  }

  // If speakers needed, check for event start time
  if (event.speakersNeeded && event.speakersNeeded > 0 && !event.eventStartTime) {
    missing.push('Event Start Time');
  }

  return missing;
}

// Build context for events
async function buildEventsContext(contextData?: Record<string, any>): Promise<string> {
  let allEvents = await db.query.eventRequests.findMany();

  // Build component-specific context section
  let componentContext = '';

  // Apply filters from contextData if provided
  if (contextData) {
    // Status filtering
    if (contextData.statusFilter && contextData.statusFilter !== 'all') {
      allEvents = allEvents.filter(e => e.status === contextData.statusFilter);
      componentContext += `\n### Current View Filters\n`;
      componentContext += `- Status Filter: ${contextData.statusFilter}\n`;
    }

    // Date range filtering
    if (contextData.dateRange?.start || contextData.dateRange?.end) {
      const startDate = contextData.dateRange.start ? new Date(contextData.dateRange.start) : null;
      const endDate = contextData.dateRange.end ? new Date(contextData.dateRange.end) : null;

      allEvents = allEvents.filter(e => {
        const eventDate = e.scheduledEventDate || e.desiredEventDate;
        if (!eventDate) return false;
        const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      });

      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Date Range: ${startDate?.toLocaleDateString() || 'Any'} to ${endDate?.toLocaleDateString() || 'Any'}\n`;
    }

    // Category filtering
    if (contextData.categoryFilter) {
      allEvents = allEvents.filter(e => e.organizationCategory === contextData.categoryFilter);
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Category: ${contextData.categoryFilter}\n`;
    }

    // Confirmation filter
    if (contextData.confirmationFilter && contextData.confirmationFilter !== 'all') {
      if (contextData.confirmationFilter === 'confirmed') {
        allEvents = allEvents.filter(e => e.isConfirmed === true);
      } else if (contextData.confirmationFilter === 'unconfirmed') {
        allEvents = allEvents.filter(e => e.isConfirmed !== true);
      }
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Confirmation Filter: ${contextData.confirmationFilter}\n`;
    }

    // Current tab/view
    if (contextData.activeTab || contextData.currentView) {
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Active Tab: ${contextData.activeTab || contextData.currentView}\n`;
    }

    // Currently selected event
    if (contextData.selectedEvent) {
      componentContext += `\n### Currently Selected Event\n`;
      const event = contextData.selectedEvent;
      componentContext += `- Organization: ${event.organizationName || 'Unknown'}\n`;
      componentContext += `- Status: ${event.status || 'Unknown'}\n`;
      componentContext += `- Date: ${event.scheduledEventDate || event.desiredEventDate || 'TBD'}\n`;
      componentContext += `- Sandwiches: ${event.estimatedSandwichCount || event.actualSandwichCount || 'Not specified'}\n`;
      if (event.notes) componentContext += `- Notes: ${event.notes}\n`;
    }

    // Any raw data the component wants to share
    if (contextData.rawData) {
      componentContext += `\n### Component-Specific Data\n`;
      componentContext += typeof contextData.rawData === 'string'
        ? contextData.rawData
        : JSON.stringify(contextData.rawData, null, 2);
      componentContext += '\n';
    }

    // Summary stats from the component
    if (contextData.summaryStats) {
      componentContext += `\n### Current Summary (from component)\n`;
      Object.entries(contextData.summaryStats).forEach(([key, value]) => {
        componentContext += `- ${key}: ${value}\n`;
      });
    }
  }

  // Calculate metrics
  const categoryStats: Record<string, { events: number; sandwiches: number }> = {};
  const monthlyStats: Record<string, { events: number; sandwiches: number }> = {};
  const statusCounts: Record<string, number> = {};
  let totalSandwiches = 0;

  // Track events needing attention with DETAILS
  const eventsWithMissingInfoList: { name: string; date: string; missing: string[] }[] = [];
  const unconfirmedScheduledList: { name: string; date: string; sandwiches: number; address: string }[] = [];
  const needsOneDayFollowUpList: { name: string; date: string }[] = [];
  const needsOneMonthFollowUpList: { name: string; date: string }[] = [];
  const stalledInProcessList: { name: string; daysSinceContact: number; tspContact: string }[] = [];
  const newRequestsList: { name: string; date: string; sandwiches: number; category: string }[] = [];
  const inProcessList: { name: string; desiredDate: string; sandwiches: number }[] = [];

  const missingInfoBreakdown: Record<string, number> = {};

  // Get upcoming events at various time horizons
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let upcomingNext7Days = 0;
  let upcomingNext14Days = 0;
  let upcomingNext30Days = 0;

  // Track upcoming events with details
  const upcomingEventsList: { name: string; date: string; status: string; sandwiches: number; confirmed: boolean; address: string }[] = [];

  // Track date range of all events
  let earliestEventDate: Date | null = null;
  let latestEventDate: Date | null = null;

  allEvents.forEach(e => {
    const sandwichCount = e.actualSandwichCount || e.estimatedSandwichCount || 0;
    totalSandwiches += sandwichCount;

    // Track date range
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    if (eventDate) {
      const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
      if (!earliestEventDate || date < earliestEventDate) {
        earliestEventDate = date;
      }
      if (!latestEventDate || date > latestEventDate) {
        latestEventDate = date;
      }
    }

    // Category stats
    const category = e.organizationCategory || 'other';
    if (!categoryStats[category]) {
      categoryStats[category] = { events: 0, sandwiches: 0 };
    }
    categoryStats[category].events++;
    categoryStats[category].sandwiches += sandwichCount;

    // Monthly stats (reuse eventDate from date range tracking above)
    if (eventDate) {
      const date = eventDate instanceof Date ? eventDate : new Date(eventDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = { events: 0, sandwiches: 0 };
      }
      monthlyStats[monthKey].events++;
      monthlyStats[monthKey].sandwiches += sandwichCount;

      // Check upcoming events at various time horizons (scheduled or in_process only)
      if (date >= now && (e.status === 'scheduled' || e.status === 'in_process')) {
        if (date <= sevenDaysOut) {
          upcomingNext7Days++;
        }
        if (date <= fourteenDaysOut) {
          upcomingNext14Days++;
        }
        if (date <= thirtyDaysOut) {
          upcomingNext30Days++;
          // Add to detailed list for 30-day events
          upcomingEventsList.push({
            name: e.organizationName || 'Unknown',
            date: formatEventDate(date),
            status: e.status,
            sandwiches: sandwichCount,
            confirmed: e.isConfirmed || false,
            address: e.eventAddress || e.deliveryDestination || 'No address'
          });
        }
      }
    }

    // Status counts
    const status = e.status || 'unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    // Track new requests with details
    if (e.status === 'new') {
      newRequestsList.push({
        name: e.organizationName || 'Unknown',
        date: formatEventDate(e.desiredEventDate),
        sandwiches: sandwichCount,
        category: e.organizationCategory || 'other'
      });
    }

    // Track in_process events
    if (e.status === 'in_process') {
      inProcessList.push({
        name: e.organizationName || 'Unknown',
        desiredDate: formatEventDate(e.desiredEventDate),
        sandwiches: sandwichCount
      });

      // Check if stalled (no contact in 7+ days)
      const lastContact = e.lastContactAttempt || e.contactedAt || e.createdAt;
      if (lastContact) {
        const contactDate = new Date(lastContact);
        if (contactDate < sevenDaysAgo) {
          const daysSince = Math.floor((now.getTime() - contactDate.getTime()) / (1000 * 60 * 60 * 24));
          stalledInProcessList.push({
            name: e.organizationName || 'Unknown',
            daysSinceContact: daysSince,
            tspContact: e.tspContactAssigned || e.tspContact || 'Unassigned'
          });
        }
      }
    }

    // Check for missing critical info (only for active events) WITH DETAILS
    if (e.status === 'in_process' || e.status === 'scheduled' || e.status === 'new') {
      const missingInfo = getEventMissingInfo(e);
      if (missingInfo.length > 0) {
        eventsWithMissingInfoList.push({
          name: e.organizationName || 'Unknown',
          date: formatEventDate(e.scheduledEventDate || e.desiredEventDate),
          missing: missingInfo
        });
        missingInfo.forEach(item => {
          missingInfoBreakdown[item] = (missingInfoBreakdown[item] || 0) + 1;
        });
      }
    }

    // Check for unconfirmed scheduled events WITH DETAILS
    if (e.status === 'scheduled' && !e.isConfirmed) {
      unconfirmedScheduledList.push({
        name: e.organizationName || 'Unknown',
        date: formatEventDate(e.scheduledEventDate || e.desiredEventDate),
        sandwiches: sandwichCount,
        address: e.eventAddress || e.deliveryDestination || 'No address'
      });
    }

    // Check for completed events needing follow-ups WITH DETAILS
    if (e.status === 'completed') {
      const completedDate = formatEventDate(e.scheduledEventDate || e.desiredEventDate);
      if (!e.followUpOneDayCompleted) {
        needsOneDayFollowUpList.push({
          name: e.organizationName || 'Unknown',
          date: completedDate
        });
      }
      if (e.followUpOneDayCompleted && !e.followUpOneMonthCompleted) {
        needsOneMonthFollowUpList.push({
          name: e.organizationName || 'Unknown',
          date: completedDate
        });
      }
    }
  });

  // Sort lists
  upcomingEventsList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  stalledInProcessList.sort((a, b) => b.daysSinceContact - a.daysSinceContact);

  // Format date range string
  const dateRangeStr = earliestEventDate && latestEventDate
    ? `${formatEventDate(earliestEventDate)} to ${formatEventDate(latestEventDate)}`
    : 'No dates available';

  return `
## Event Data Summary
${componentContext}
### Overall Metrics
- Total Events: ${allEvents.length}
- Total Sandwiches: ${totalSandwiches.toLocaleString()}
- Average Per Event: ${allEvents.length > 0 ? Math.round(totalSandwiches / allEvents.length) : 0}
- **Data Time Period: ${dateRangeStr}** (This is the date range spanning all events in the system, from earliest to latest event date)

### Events by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### Upcoming Events (Next 30 Days): ${upcomingNext30Days} total
- Next 7 Days: ${upcomingNext7Days} events
- Next 14 Days: ${upcomingNext14Days} events
- Next 30 Days: ${upcomingNext30Days} events

${upcomingEventsList.length > 0 ? `**Upcoming Event Details:**
${upcomingEventsList.slice(0, 20).map(e => `- ${e.date}: ${e.name} | ${e.status} | ${e.confirmed ? 'CONFIRMED' : 'Pending confirmation'} | ~${e.sandwiches} sandwiches | ${e.address}`).join('\n')}` : ''}

### New Requests: ${newRequestsList.length}
${newRequestsList.length > 0 ? newRequestsList.slice(0, 10).map(e => `- ${e.name} | Desired: ${e.date} | ~${e.sandwiches} sandwiches | ${e.category}`).join('\n') : 'None'}

### In Process: ${inProcessList.length}
${inProcessList.length > 0 ? inProcessList.slice(0, 10).map(e => `- ${e.name} | Desired: ${e.desiredDate} | ~${e.sandwiches} sandwiches`).join('\n') : 'None'}

### Stalled Intakes (No contact in 7+ days): ${stalledInProcessList.length}
${stalledInProcessList.length > 0 ? stalledInProcessList.slice(0, 10).map(e => `- ${e.name} | ${e.daysSinceContact} days since contact | TSP: ${e.tspContact}`).join('\n') : 'None - great job!'}

### Scheduled Events Pending Confirmation: ${unconfirmedScheduledList.length}
${unconfirmedScheduledList.length > 0 ? unconfirmedScheduledList.map(e => `- ${e.name} | ${e.date} | ~${e.sandwiches} sandwiches | ${e.address}`).join('\n') : 'None - all confirmed!'}

### Events Missing Critical Info: ${eventsWithMissingInfoList.length}
${Object.entries(missingInfoBreakdown).length > 0 ? Object.entries(missingInfoBreakdown).map(([item, count]) => `  - Missing ${item}: ${count}`).join('\n') : '  - None'}
${eventsWithMissingInfoList.length > 0 ? `\n**Details:**\n${eventsWithMissingInfoList.slice(0, 15).map(e => `- ${e.name} (${e.date}): Missing ${e.missing.join(', ')}`).join('\n')}` : ''}

### Follow-up Needed
- Completed Events Needing 1-Day Follow-Up: ${needsOneDayFollowUpList.length}
${needsOneDayFollowUpList.length > 0 ? needsOneDayFollowUpList.slice(0, 10).map(e => `  - ${e.name} (${e.date})`).join('\n') : '  None'}
- Completed Events Needing 1-Month Follow-Up: ${needsOneMonthFollowUpList.length}
${needsOneMonthFollowUpList.length > 0 ? needsOneMonthFollowUpList.slice(0, 10).map(e => `  - ${e.name} (${e.date})`).join('\n') : '  None'}

### Events by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1].events - a[1].events)
  .map(([category, stats]) => `- ${category}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}

### Events by Month (Recent)
${Object.entries(monthlyStats)
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 6)
  .map(([month, stats]) => `- ${month}: ${stats.events} events, ${stats.sandwiches.toLocaleString()} sandwiches`)
  .join('\n')}
`;
}

// Build context for general platform help
async function buildGeneralContext(): Promise<string> {
  // Get high-level stats for general context
  const allCollections = await db.query.sandwichCollections.findMany();
  const collections = allCollections.filter(c => !c.deletedAt);
  const allEvents = await db.query.eventRequests.findMany();

  let totalSandwiches = 0;
  collections.forEach(c => {
    totalSandwiches += getCollectionSandwichCount(c);
  });

  const uniqueHosts = new Set(collections.map(c => c.hostName).filter(Boolean));

  return `
## The Sandwich Project Platform Overview

### Quick Stats
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Number of Collections: ${collections.length}
- Active Host Locations: ${uniqueHosts.size}
- Total Event Requests: ${allEvents.length}

### Platform Features
The platform includes:
- **Collection Log**: Track weekly sandwich collections from host locations
- **Event Requests**: Manage requests for sandwich events from organizations
- **TSP Network**: Manage hosts, drivers, volunteers, and recipients
- **Projects**: Track ongoing projects and tasks
- **Meetings**: Schedule and manage committee meetings with agendas
- **Analytics**: View trends and metrics for collections and events
- **Grant Metrics**: Access data for grant applications and reporting
- **Resources**: Access training materials and important documents
- **Holding Zone**: Capture ideas and tasks before they become projects

### Weekly Collection Schedule
- Wednesday is the standard weekly collection day
- Collections are typically logged on Wednesday or Thursday
`;
}

// Build context for Holding Zone (Team Board)
async function buildHoldingZoneContext(contextData?: Record<string, any>): Promise<string> {
  let items = await db.query.teamBoardItems.findMany();

  // Build component-specific context section
  let componentContext = '';

  if (contextData) {
    // Status filtering
    if (contextData.statusFilter && contextData.statusFilter !== 'all') {
      items = items.filter(i => i.status === contextData.statusFilter);
      componentContext += `\n### Current View Filters\n`;
      componentContext += `- Status Filter: ${contextData.statusFilter}\n`;
    }

    // Type filtering
    if (contextData.typeFilter && contextData.typeFilter !== 'all') {
      items = items.filter(i => i.type === contextData.typeFilter);
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Type Filter: ${contextData.typeFilter}\n`;
    }

    // Currently selected item
    if (contextData.selectedItem) {
      componentContext += `\n### Currently Selected Item\n`;
      componentContext += `- Content: ${contextData.selectedItem.content}\n`;
      componentContext += `- Type: ${contextData.selectedItem.type}\n`;
      componentContext += `- Status: ${contextData.selectedItem.status}\n`;
      if (contextData.selectedItem.isUrgent) componentContext += `- URGENT\n`;
    }

    // Active tab/view
    if (contextData.activeTab) {
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Active Tab: ${contextData.activeTab}\n`;
    }

    // Summary stats from the component
    if (contextData.summaryStats) {
      componentContext += `\n### Current Summary (from component)\n`;
      Object.entries(contextData.summaryStats).forEach(([key, value]) => {
        componentContext += `- ${key}: ${value}\n`;
      });
    }

    // Raw data from component
    if (contextData.rawData) {
      componentContext += `\n### Component-Specific Data\n`;
      componentContext += typeof contextData.rawData === 'string'
        ? contextData.rawData
        : JSON.stringify(contextData.rawData, null, 2);
      componentContext += '\n';
    }
  }

  // Calculate metrics
  const statusCounts: Record<string, number> = { open: 0, done: 0 };
  const typeCounts: Record<string, number> = { task: 0, note: 0, idea: 0 };
  const urgentCount = items.filter(i => i.isUrgent).length;

  items.forEach(item => {
    const status = item.status === 'done' ? 'done' : 'open';
    statusCounts[status]++;
    typeCounts[item.type || 'task']++;
  });

  const recentItems = items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return `
## Holding Zone Data Summary
${componentContext}
### Current Items Overview
- Total Items: ${items.length}
- Open Items: ${statusCounts.open}
- Completed Items: ${statusCounts.done}
- Urgent Items: ${urgentCount}

### Items by Type
- Tasks: ${typeCounts.task}
- Notes: ${typeCounts.note}
- Ideas: ${typeCounts.idea}

### Recent Items (Last 10)
${recentItems.map(item => `- [${item.type}] ${item.content?.substring(0, 50)}${item.content && item.content.length > 50 ? '...' : ''} (${item.status})`).join('\n')}

### About the Holding Zone
The Holding Zone is a collaborative space where team members can:
- Capture quick tasks, notes, and ideas
- Assign items to team members
- Mark items as urgent
- Track completion status
- Add comments and collaborate on items
`;
}

// Build context for TSP Network
async function buildNetworkContext(contextData?: Record<string, any>): Promise<string> {
  const hosts = await db.query.hosts.findMany();
  const drivers = await db.query.drivers.findMany();
  const volunteers = await db.query.volunteers.findMany();
  const recipients = await db.query.recipients.findMany();

  // Build component-specific context section
  let componentContext = '';

  if (contextData) {
    // Current tab/view
    if (contextData.activeTab || contextData.currentView) {
      componentContext += `\n### Current View\n`;
      componentContext += `- Active Tab: ${contextData.activeTab || contextData.currentView}\n`;
    }

    // Currently selected entity
    if (contextData.selectedHost) {
      componentContext += `\n### Currently Selected Host\n`;
      componentContext += `- Name: ${contextData.selectedHost.name}\n`;
      componentContext += `- Address: ${contextData.selectedHost.address || 'Not specified'}\n`;
      componentContext += `- Status: ${contextData.selectedHost.isActive ? 'Active' : 'Inactive'}\n`;
    }

    if (contextData.selectedDriver) {
      componentContext += `\n### Currently Selected Driver\n`;
      componentContext += `- Name: ${contextData.selectedDriver.name}\n`;
      componentContext += `- Status: ${contextData.selectedDriver.isActive ? 'Active' : 'Inactive'}\n`;
    }

    if (contextData.selectedVolunteer) {
      componentContext += `\n### Currently Selected Volunteer\n`;
      componentContext += `- Name: ${contextData.selectedVolunteer.name}\n`;
    }

    if (contextData.selectedRecipient) {
      componentContext += `\n### Currently Selected Recipient\n`;
      componentContext += `- Name: ${contextData.selectedRecipient.name}\n`;
    }

    // Raw data from component
    if (contextData.rawData) {
      componentContext += `\n### Component-Specific Data\n`;
      componentContext += typeof contextData.rawData === 'string'
        ? contextData.rawData
        : JSON.stringify(contextData.rawData, null, 2);
      componentContext += '\n';
    }
  }

  const activeHosts = hosts.filter(h => h.isActive !== false).length;
  const activeDrivers = drivers.filter(d => d.isActive !== false).length;
  const activeVolunteers = volunteers.filter(v => v.isActive !== false).length;
  const activeRecipients = recipients.filter(r => r.isActive !== false).length;

  return `
## TSP Network Data Summary
${componentContext}
### Network Overview
- Total Hosts: ${hosts.length} (${activeHosts} active)
- Total Drivers: ${drivers.length} (${activeDrivers} active)
- Total Volunteers: ${volunteers.length} (${activeVolunteers} active)
- Total Recipients: ${recipients.length} (${activeRecipients} active)

### About the TSP Network
The TSP Network manages all the people and organizations involved in The Sandwich Project:
- **Hosts**: Locations where sandwiches are made (homes, churches, businesses)
- **Drivers**: People who pick up and deliver sandwiches
- **Volunteers**: Team members who help with various tasks
- **Recipients**: Organizations that receive sandwiches for distribution

### Key Functions
- Track contact information and availability
- Manage active/inactive status
- Record notes and special requirements
- Coordinate scheduling and routes
`;
}

// Build context for Projects
async function buildProjectsContext(contextData?: Record<string, any>): Promise<string> {
  let projects = await db.query.projects.findMany();

  // Build component-specific context section
  let componentContext = '';

  if (contextData) {
    // Status filtering
    if (contextData.statusFilter && contextData.statusFilter !== 'all') {
      projects = projects.filter(p => p.status === contextData.statusFilter);
      componentContext += `\n### Current View Filters\n`;
      componentContext += `- Status Filter: ${contextData.statusFilter}\n`;
    }

    // Priority filtering
    if (contextData.priorityFilter && contextData.priorityFilter !== 'all') {
      projects = projects.filter(p => p.priority === contextData.priorityFilter);
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Priority Filter: ${contextData.priorityFilter}\n`;
    }

    // Category filtering
    if (contextData.categoryFilter && contextData.categoryFilter !== 'all') {
      projects = projects.filter(p => p.category === contextData.categoryFilter);
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Category Filter: ${contextData.categoryFilter}\n`;
    }

    // Project type filtering (meeting vs internal projects)
    if (contextData.projectTypeFilter && contextData.projectTypeFilter !== 'all') {
      if (contextData.projectTypeFilter === 'meeting') {
        projects = projects.filter(p => p.googleSheetRowId != null);
      } else if (contextData.projectTypeFilter === 'internal') {
        projects = projects.filter(p => p.googleSheetRowId == null);
      }
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Project Type: ${contextData.projectTypeFilter}\n`;
    }

    // Active tab/view
    if (contextData.activeTab) {
      if (!componentContext.includes('Current View Filters')) {
        componentContext += `\n### Current View Filters\n`;
      }
      componentContext += `- Active Tab: ${contextData.activeTab}\n`;
    }

    // Currently selected project
    if (contextData.selectedProject) {
      componentContext += `\n### Currently Selected Project\n`;
      const proj = contextData.selectedProject;
      componentContext += `- Title: ${proj.title || proj.name}\n`;
      componentContext += `- Status: ${proj.status}\n`;
      componentContext += `- Priority: ${proj.priority}\n`;
      if (proj.description) componentContext += `- Description: ${proj.description}\n`;
      if (proj.dueDate) componentContext += `- Due Date: ${proj.dueDate}\n`;
    }

    // Summary stats from the component
    if (contextData.summaryStats) {
      componentContext += `\n### Current Summary (from component)\n`;
      Object.entries(contextData.summaryStats).forEach(([key, value]) => {
        componentContext += `- ${key}: ${value}\n`;
      });
    }

    // Raw data from component
    if (contextData.rawData) {
      componentContext += `\n### Component-Specific Data\n`;
      componentContext += typeof contextData.rawData === 'string'
        ? contextData.rawData
        : JSON.stringify(contextData.rawData, null, 2);
      componentContext += '\n';
    }
  }

  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};

  projects.forEach(p => {
    statusCounts[p.status || 'waiting'] = (statusCounts[p.status || 'waiting'] || 0) + 1;
    priorityCounts[p.priority || 'medium'] = (priorityCounts[p.priority || 'medium'] || 0) + 1;
    if (p.category) {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }
  });

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'archived');

  return `
## Projects Data Summary
${componentContext}
### Overview
- Total Projects: ${projects.length}
- Active Projects: ${activeProjects.length}

### Projects by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n')}

### Projects by Priority
${Object.entries(priorityCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([priority, count]) => `- ${priority}: ${count}`)
  .join('\n')}

### Projects by Category
${Object.entries(categoryCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n')}

### About Projects
Projects help track ongoing initiatives for The Sandwich Project:
- Set priority levels (low, medium, high, urgent)
- Track status (waiting, in-progress, completed, archived)
- Assign team members
- Set due dates and track progress
- Categorize by type (technology, operations, outreach, etc.)
`;
}

// Build context for Meetings
async function buildMeetingsContext(contextData?: Record<string, any>): Promise<string> {
  const meetings = await db.query.meetings.findMany();
  const agendaItems = await db.query.agendaItems.findMany();

  // Sort meetings by date
  const upcomingMeetings = meetings
    .filter(m => new Date(m.scheduledDate) >= new Date())
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, 5);

  const recentMeetings = meetings
    .filter(m => new Date(m.scheduledDate) < new Date())
    .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
    .slice(0, 5);

  return `
## Meetings Data Summary

### Overview
- Total Meetings Scheduled: ${meetings.length}
- Total Agenda Items: ${agendaItems.length}

### Upcoming Meetings
${upcomingMeetings.length > 0
  ? upcomingMeetings.map(m => `- ${m.title} (${new Date(m.scheduledDate).toLocaleDateString()})`).join('\n')
  : '- No upcoming meetings scheduled'}

### Recent Meetings
${recentMeetings.length > 0
  ? recentMeetings.map(m => `- ${m.title} (${new Date(m.scheduledDate).toLocaleDateString()})`).join('\n')
  : '- No recent meetings'}

### About Meetings
The meeting dashboard helps manage committee meetings:
- Schedule meetings with dates and times
- Create and manage agenda items
- Track action items from meetings
- Record meeting notes and minutes
- Compile agendas for distribution
`;
}

// Build context for Resources
async function buildResourcesContext(contextData?: Record<string, any>): Promise<string> {
  const resources = await db.query.resources.findMany();

  const categoryStats: Record<string, number> = {};
  const typeStats: Record<string, number> = {};

  resources.forEach(r => {
    if (r.category) {
      categoryStats[r.category] = (categoryStats[r.category] || 0) + 1;
    }
    if (r.resourceType) {
      typeStats[r.resourceType] = (typeStats[r.resourceType] || 0) + 1;
    }
  });

  return `
## Resources Data Summary

### Overview
- Total Resources: ${resources.length}

### Resources by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n') || '- No categories defined'}

### Resources by Type
${Object.entries(typeStats)
  .sort((a, b) => b[1] - a[1])
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n') || '- No types defined'}

### About Resources
Resources is a library of documents and materials for The Sandwich Project:
- Training materials and guides
- Forms and templates
- Policy documents
- How-to guides and procedures
- Links to external resources
`;
}

// Build context for Organizations (Groups Catalog)
// Data comes from event requests and sandwich collections, NOT the organizations table
async function buildOrganizationsContext(contextData?: Record<string, any>): Promise<string> {
  try {
    const events = await db.query.eventRequests.findMany();
    const collections = await db.query.sandwichCollections.findMany();

    // Build unique organizations from event requests
    const orgDataMap = new Map<string, {
      name: string;
      eventCount: number;
      sandwichCount: number;
      hasHostedEvent: boolean;
      latestEventDate: Date | null;
      statuses: Set<string>;
    }>();

    // Process event requests
    events.forEach(e => {
      const orgName = e.organizationName?.trim();
      if (!orgName) return;

      if (!orgDataMap.has(orgName)) {
        orgDataMap.set(orgName, {
          name: orgName,
          eventCount: 0,
          sandwichCount: 0,
          hasHostedEvent: false,
          latestEventDate: null,
          statuses: new Set(),
        });
      }

      const org = orgDataMap.get(orgName)!;
      org.eventCount += 1;
      org.sandwichCount += (e.actualSandwichCount || e.estimatedSandwichCount || 0);

      if (e.status) {
        org.statuses.add(e.status);
      }

      if (e.status === 'completed' || e.status === 'contact_completed') {
        org.hasHostedEvent = true;
      }

      const eventDate = e.scheduledEventDate || e.desiredEventDate;
      if (eventDate) {
        const date = new Date(eventDate);
        if (!org.latestEventDate || date > org.latestEventDate) {
          org.latestEventDate = date;
        }
      }
    });

    // Process sandwich collections to find additional organizations
    collections.forEach(c => {
      const processOrgFromCollection = (orgName: string, count: number) => {
        if (!orgName || orgName === 'Group' || orgName === 'Groups' || !orgName.trim()) return;

        const cleanName = orgName.trim();
        if (!orgDataMap.has(cleanName)) {
          orgDataMap.set(cleanName, {
            name: cleanName,
            eventCount: 0,
            sandwichCount: 0,
            hasHostedEvent: true, // If in collections, they hosted
            latestEventDate: c.collectionDate ? new Date(c.collectionDate) : null,
            statuses: new Set(['completed']),
          });
        }

        const org = orgDataMap.get(cleanName)!;
        org.sandwichCount += (count || 0);
        org.hasHostedEvent = true;
      };

      // Check legacy group fields
      if (c.group1Name && c.group1Count) {
        processOrgFromCollection(c.group1Name, c.group1Count);
      }
      if (c.group2Name && c.group2Count) {
        processOrgFromCollection(c.group2Name, c.group2Count);
      }

      // Check JSON group collections
      if (c.groupCollections && Array.isArray(c.groupCollections)) {
        c.groupCollections.forEach((group: any) => {
          if (group.name && group.count) {
            processOrgFromCollection(group.name, group.count);
          }
        });
      }
    });

    // Convert to array and calculate stats
    const allOrgs = Array.from(orgDataMap.values());
    const totalOrganizations = allOrgs.length;
    const orgsWithEvents = allOrgs.filter(o => o.hasHostedEvent).length;
    const orgsWithoutEvents = totalOrganizations - orgsWithEvents;

    // Count by status
    const statusCounts: Record<string, number> = {};
    allOrgs.forEach(org => {
      org.statuses.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
    });

    // Top organizations by event count
    const topOrgsByEvents = allOrgs
      .filter(o => o.eventCount > 0)
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10)
      .map(o => `- ${o.name}: ${o.eventCount} events, ${o.sandwichCount.toLocaleString()} sandwiches`);

    // Top organizations by sandwich count
    const topOrgsBySandwiches = allOrgs
      .filter(o => o.sandwichCount > 0)
      .sort((a, b) => b.sandwichCount - a.sandwichCount)
      .slice(0, 10)
      .map(o => `- ${o.name}: ${o.sandwichCount.toLocaleString()} sandwiches`);

    // Recent organizations (by latest event date)
    const recentOrgs = allOrgs
      .filter(o => o.latestEventDate)
      .sort((a, b) => (b.latestEventDate?.getTime() || 0) - (a.latestEventDate?.getTime() || 0))
      .slice(0, 10)
      .map(o => `- ${o.name} (${o.latestEventDate?.toLocaleDateString() || 'unknown date'})`);

    // Full organization list for reference (limited to avoid token limits)
    const orgList = allOrgs
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50)
      .map(o => `- ${o.name}${o.eventCount > 0 ? ` - ${o.eventCount} events` : ''}${o.sandwichCount > 0 ? `, ${o.sandwichCount.toLocaleString()} sandwiches` : ''}`);

    // Use contextData from the component if available
    const componentStats = contextData?.summaryStats;

    return `
## Groups Catalog Data Summary

### Overview
- Total Groups/Organizations in Catalog: ${componentStats?.totalOrganizations || totalOrganizations}
- Total Contact Entries: ${componentStats?.totalContacts || totalOrganizations}
- Groups that have Hosted Events: ${componentStats?.organizationsWithEvents || orgsWithEvents}
- Groups without Events Yet: ${componentStats?.organizationsWithoutEvents || orgsWithoutEvents}

### Groups by Status
${Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .map(([status, count]) => `- ${status}: ${count}`)
  .join('\n') || '- No status data available'}

${componentStats?.categoryCounts ? `### Groups by Category
${Object.entries(componentStats.categoryCounts)
  .sort((a, b) => (b[1] as number) - (a[1] as number))
  .map(([category, count]) => `- ${category || 'uncategorized'}: ${count}`)
  .join('\n')}` : ''}

### Top Groups by Event Count
${topOrgsByEvents.join('\n') || '- No events recorded'}

### Top Groups by Sandwich Count
${topOrgsBySandwiches.join('\n') || '- No sandwich data'}

### Recently Active Groups
${recentOrgs.join('\n') || '- No recent activity'}

### Groups Directory (first 50 alphabetically)
${orgList.join('\n')}

### About This Data
The Groups Catalog tracks all partner organizations that work with The Sandwich Project for sandwich-making events, including schools, churches, businesses, nonprofits, and community organizations. Data is derived from event requests and sandwich collection logs.
`;
  } catch (error) {
    logger.error('Error building organizations context', { error });
    return `
## Groups Catalog Data Summary
Error loading groups data. Please try again.
`;
  }
}


// Build context for Important Links
async function buildLinksContext(contextData?: Record<string, any>): Promise<string> {
  const links = await db.query.driveLinks.findMany();

  const categoryStats: Record<string, number> = {};
  links.forEach(link => {
    const category = link.category || 'general';
    categoryStats[category] = (categoryStats[category] || 0) + 1;
  });

  return `
## Important Links Data Summary

### Overview
- Total Links: ${links.length}

### Links by Category
${Object.entries(categoryStats)
  .sort((a, b) => b[1] - a[1])
  .map(([category, count]) => `- ${category}: ${count}`)
  .join('\n') || '- No categories defined'}

### About Important Links
Important Links is a quick-access hub for frequently used resources:
- Google Drive folders and documents
- External tools and platforms
- Key websites and portals
- Shared team resources
`;
}

// Build context for Volunteer Calendar
async function buildVolunteerCalendarContext(): Promise<string> {
  try {
    // Get events for the next 30 days
    const now = new Date();
    const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch calendar events from Google Calendar API
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });
    const calendar = google.calendar({ version: 'v3', auth });

    let events: any[] = [];
    try {
      const response = await calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        timeMin: now.toISOString(),
        timeMax: thirtyDaysOut.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });
      events = response.data.items || [];
    } catch (calError) {
      logger.warn('Could not fetch Google Calendar events for AI context', { error: calError });
    }

    // Categorize events
    const unavailabilityKeywords = ['unavailable', 'unavail', 'out of town', 'away', 'vacation', 'travel', 'pto', 'off'];
    const unavailabilityEvents: any[] = [];
    const otherEvents: any[] = [];

    events.forEach(event => {
      const summary = (event.summary || '').toLowerCase();
      const isUnavailability = unavailabilityKeywords.some(keyword => summary.includes(keyword));

      if (isUnavailability) {
        unavailabilityEvents.push(event);
      } else {
        otherEvents.push(event);
      }
    });

    // Group unavailability by person (extract name from event summary if possible)
    const unavailabilityByPerson: Record<string, string[]> = {};
    unavailabilityEvents.forEach(event => {
      const summary = event.summary || 'Unknown';
      // Try to extract person name (often format is "Name - Unavailable" or "Name OOO")
      const personMatch = summary.match(/^([^-–]+)/);
      const person = personMatch ? personMatch[1].trim() : 'Team Member';

      const startDate = event.start?.date || event.start?.dateTime?.split('T')[0] || 'TBD';
      const endDate = event.end?.date || event.end?.dateTime?.split('T')[0] || startDate;

      if (!unavailabilityByPerson[person]) {
        unavailabilityByPerson[person] = [];
      }
      unavailabilityByPerson[person].push(`${startDate} to ${endDate}`);
    });

    // Format upcoming events
    const upcomingEventsList = otherEvents.slice(0, 15).map(event => {
      const startDate = event.start?.date || event.start?.dateTime?.split('T')[0] || 'TBD';
      return `- ${event.summary || 'Untitled'} (${startDate})`;
    });

    return `
## Volunteer Calendar Data Summary

### Overview (Next 30 Days)
- Total Calendar Events: ${events.length}
- Unavailability Events: ${unavailabilityEvents.length}
- Other Events: ${otherEvents.length}

### Upcoming Unavailability
${Object.entries(unavailabilityByPerson)
  .map(([person, dates]) => `- ${person}: ${dates.join(', ')}`)
  .join('\n') || '- No unavailability marked'}

### Upcoming Events (Next 15)
${upcomingEventsList.join('\n') || '- No upcoming events'}

### About the Volunteer Calendar
The Volunteer Calendar shows team availability pulled from Google Calendar:
- Unavailability entries (vacations, PTO, travel)
- Team events and meetings
- Color-coded by Google Calendar categories
- Helps coordinate scheduling around team availability
`;
  } catch (error) {
    logger.error('Error building volunteer calendar context', { error });
    return `
## Volunteer Calendar Data Summary
Unable to load calendar data. The calendar shows volunteer availability from Google Calendar.
`;
  }
}

// Build context for Dashboard
async function buildDashboardContext(contextData?: Record<string, any>): Promise<string> {
  // Combine key metrics from across the platform
  const collections = (await db.query.sandwichCollections.findMany()).filter(c => !c.deletedAt);
  const events = await db.query.eventRequests.findMany();
  const projects = await db.query.projects.findMany();
  const teamBoardItems = await db.query.teamBoardItems.findMany();

  let totalSandwiches = 0;
  collections.forEach(c => {
    totalSandwiches += getCollectionSandwichCount(c);
  });

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'archived').length;
  const openItems = teamBoardItems.filter(i => i.status === 'open').length;
  const upcomingEvents = events.filter(e => {
    const eventDate = e.scheduledEventDate || e.desiredEventDate;
    return eventDate && new Date(eventDate) >= new Date();
  }).length;

  return `
## Dashboard Data Summary

### Quick Stats
- Total Sandwiches Collected: ${totalSandwiches.toLocaleString()}
- Total Collections: ${collections.length}
- Total Events: ${events.length}
- Upcoming Events: ${upcomingEvents}
- Active Projects: ${activeProjects}
- Open Holding Zone Items: ${openItems}

### About the Dashboard
The Dashboard provides an overview of The Sandwich Project's activities:
- Quick access to key metrics
- Recent activity summaries
- Navigation to all platform features
- Announcements and updates
`;
}

// Build context for User Management - analyzes user activity patterns
async function buildUsersContext(contextData?: Record<string, any>): Promise<string> {
  try {
    const days = 30; // Look at last 30 days of activity
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    // Get all users
    const users = await db.query.users.findMany();
    const activeUsers = users.filter(u => u.isActive !== false).length;

    // Get top sections users visit (what they do when they come into the app)
    const topSections = await db
      .select({
        section: userActivityLogs.section,
        actionCount: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(userActivityLogs.section)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get top actions (what actions users take most frequently)
    const topActions = await db
      .select({
        action: userActivityLogs.action,
        actionCount: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(userActivityLogs.action)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get top features (specific features users interact with)
    const topFeatures = await db
      .select({
        feature: userActivityLogs.feature,
        usageCount: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(and(
        gte(userActivityLogs.createdAt, dateThreshold),
        sql`${userActivityLogs.feature} IS NOT NULL`
      ))
      .groupBy(userActivityLogs.feature)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get most visited pages
    const topPages = await db
      .select({
        page: userActivityLogs.page,
        visitCount: sql<number>`count(*)::int`,
        uniqueUsers: sql<number>`count(distinct ${userActivityLogs.userId})::int`
      })
      .from(userActivityLogs)
      .where(and(
        gte(userActivityLogs.createdAt, dateThreshold),
        sql`${userActivityLogs.page} IS NOT NULL`
      ))
      .groupBy(userActivityLogs.page)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get activity by time of day (when users are most active)
    const activityByHour = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})::int`,
        actionCount: sql<number>`count(*)::int`
      })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold))
      .groupBy(sql`EXTRACT(HOUR FROM ${userActivityLogs.createdAt})`)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    // Get total activity stats
    const totalActivityResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold));
    
    const totalActions = totalActivityResult[0]?.count || 0;

    const uniqueActiveUsersResult = await db
      .select({ count: sql<number>`count(distinct ${userActivityLogs.userId})::int` })
      .from(userActivityLogs)
      .where(gte(userActivityLogs.createdAt, dateThreshold));
    
    const uniqueActiveUsers = uniqueActiveUsersResult[0]?.count || 0;

    // Format sections list
    const sectionsList = topSections.length > 0
      ? topSections.map(s => `- **${s.section}**: ${s.actionCount.toLocaleString()} actions by ${s.uniqueUsers} users`)
      : ['- No section data available'];

    // Format actions list
    const actionsList = topActions.length > 0
      ? topActions.map(a => `- **${a.action}**: ${a.actionCount.toLocaleString()} times by ${a.uniqueUsers} users`)
      : ['- No action data available'];

    // Format features list
    const featuresList = topFeatures.length > 0
      ? topFeatures.map(f => `- **${f.feature}**: ${f.usageCount.toLocaleString()} uses by ${f.uniqueUsers} users`)
      : ['- No feature data available'];

    // Format pages list
    const pagesList = topPages.length > 0
      ? topPages.map(p => `- **${p.page}**: ${p.visitCount.toLocaleString()} visits by ${p.uniqueUsers} users`)
      : ['- No page data available'];

    // Format peak hours
    const peakHoursList = activityByHour.length > 0
      ? activityByHour.map(h => {
          const hour12 = h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour;
          const ampm = h.hour < 12 ? 'AM' : 'PM';
          return `- **${hour12}:00 ${ampm}**: ${h.actionCount.toLocaleString()} actions`;
        })
      : ['- No time data available'];

    return `
## User Management & Activity Data Summary

### User Overview
- Total Users: ${users.length}
- Active Users: ${activeUsers}
- Users Active in Last ${days} Days: ${uniqueActiveUsers}
- Total Actions in Last ${days} Days: ${totalActions.toLocaleString()}
- Average Actions per Active User: ${uniqueActiveUsers > 0 ? Math.round(totalActions / uniqueActiveUsers) : 0}

### What Users Do When They Come Into the App (Top Sections)
These are the main areas of the platform users visit most frequently:
${sectionsList.join('\n')}

### Most Common User Actions
These are the actions users take most often:
${actionsList.join('\n')}

### Most Used Features
These are the specific features users interact with most:
${featuresList.join('\n')}

### Most Visited Pages
These are the specific pages users visit most:
${pagesList.join('\n')}

### Peak Activity Times
When users are most active during the day:
${peakHoursList.join('\n')}

### About User Activity
This data shows what users typically do when they use The Sandwich Project platform:
- Sections show the main areas users navigate to (Dashboard, Event Requests, Collections, etc.)
- Actions show what users do (PAGE_VIEW, FORM_SUBMIT, SEARCH, etc.)
- Features show specific functionality users interact with
- Pages show the exact routes users visit
- Activity times help understand when users are most engaged
`;
  } catch (error) {
    logger.error('Error building users context', { error });
    return `
## User Management & Activity Data Summary
Error loading user activity data. Please try again.
`;
  }
}

// Get system prompt for context type
function getSystemPrompt(contextType: string, dataSummary: string): string {
  const baseRules = `
TODAY'S DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

COMMUNICATION STYLE:
- Be warm, helpful, and conversational - you're a friendly colleague, not a formal system
- If you make a mistake or misunderstand something, acknowledge it openly: "Oh, I see what you mean - let me look at that again" or "You're right, I misread that"
- If you're uncertain about something, say so honestly: "I'm not entirely sure about this, but..." or "Let me double-check that..."
- When corrected, respond graciously: "Thanks for catching that!" or "Good point, I missed that"
- Avoid defensive language - don't over-explain or justify errors, just correct them and move on

DATA GUIDELINES:
- Work with the data provided below. If something isn't in the data, just let the user know naturally: "I don't see that in the current data" rather than formal disclaimers
- Sandwich type breakdown (deli, turkey, ham, pbj, generic) is tracked when available - use it for questions like "what percentage were PBJ?" or "how many deli vs pbj?"
- Avoid comparing or ranking hosts against each other - TSP values all contributors equally
- Wednesday is the standard weekly collection day, with most logged Wednesday or Thursday
- Use today's date (shown above) as your reference point
- Date ranges and monthly breakdowns are included in the data summary - check there for time period questions

CHARTS:
When the user asks for a chart or visualization, respond with a JSON block:
\`\`\`chart
{
  "type": "bar" | "line" | "pie",
  "title": "Chart Title",
  "data": [{ "name": "Label", "value": 123 }, ...],
  "xKey": "name",
  "yKey": "value",
  "description": "Brief explanation of what this shows"
}
\`\`\`

Keep responses concise and helpful. Focus on what's useful to the user.
`;

  const contextDescriptions: Record<string, string> = {
    collections: `You're helping with The Sandwich Project's collection log - tracking when sandwiches were collected and how many.
Collections come from hosts (individuals or groups) who organize sandwich-making sessions.
Focus on overall totals and trends rather than comparing individual hosts.

SANDWICH TYPES: When the data includes type breakdown (deli, turkey, ham, pbj, generic), you can answer questions like "what percentage were PBJ?" or "how many deli vs pbj?" by summing the type counts across collections and calculating percentages. Filter by collectionDate year when the user asks about a specific year (e.g., 2025).`,

    events: `You're helping with The Sandwich Project's event management - tracking organizations requesting sandwich-making events, scheduling, and categories.
Focus on overall trends rather than comparing organizations.

IMPORTANT for sandwich counting and weekly totals:
- Include BOTH "scheduled" AND "in_process" status events - they're all upcoming events that need sandwiches
- When someone asks "how many sandwiches this week" or "scheduled events this week", include ALL events with dates in that range regardless of status (scheduled, in_process)
- The sandwich planning widget counts scheduled + in_process + completed events for the week
- Be flexible with date formats: "12/1" = "Dec 1" = "December 1" all mean the same date
- If your count doesn't match what the user is seeing, double-check you're including in_process events too`,

    'impact-reports': `You're helping with The Sandwich Project's impact reporting - looking at the overall impact including events, collections, and sandwich distribution.
Focus on overall impact and growth rather than comparing hosts or organizations.`,

    'general': `You're here to help with The Sandwich Project platform - managing sandwich collections, events, volunteers, and organizational data.
If someone asks about specific data, point them to the right section of the platform.`,

    'holding-zone': `You're helping with the Holding Zone - a collaborative space where team members capture tasks, notes, and ideas before they become formal projects.
Help users manage items, check on task status, and organize their workflow.`,

    'network': `You're helping with the TSP Network - the people and organizations involved with The Sandwich Project: hosts (where sandwiches are made), drivers (who deliver), volunteers (who help), and recipients (who receive sandwiches).
Help users find information about participants and understand the network.`,

    'projects': `You're helping with project management - tracking ongoing initiatives with priorities, statuses, categories, and team assignments.
Help users understand project status and what's being worked on.`,

    'meetings': `You're helping with meeting management - scheduling committee meetings, managing agendas, and tracking action items.
Help users find meeting info and understand upcoming schedules.`,

    'resources': `You're helping with the resource library - training materials, guides, forms, templates, and procedures.
Help users find what they're looking for.`,

    'organizations': `You're helping with the organization catalog - groups that partner with TSP for sandwich-making events.
Help users understand the organization database and event relationships.`,

    'links': `You're helping with important links - quick access to frequently used documents and external resources.
Help users find and navigate to what they need.`,

    'volunteer-calendar': `You're helping with the Volunteer Availability Calendar - showing team availability from Google Calendar, including vacations, PTO, and unavailability.
Help users figure out who's available when and coordinate scheduling.`,

    'dashboard': `You're helping with the dashboard - an overview of all platform activities and key metrics.
Help users understand the overall status and find what they're looking for.`,

    'users': `You're helping with user management and understanding user behavior patterns in The Sandwich Project platform.
You have access to user activity logs that show what users do when they come into the app - which sections they visit, what actions they take, which features they use, and when they're most active.
Help answer questions about user behavior, activity patterns, and what users typically do in the platform.`,
  };

  const contextDesc = contextDescriptions[contextType] || contextDescriptions['general'];

  return `${contextDesc}

${baseRules}

CURRENT DATA (this is the ONLY data you should reference):
${dataSummary}`;
}

// POST /api/ai-chat - Universal AI chat endpoint
aiChatRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { message, contextType = 'collections', contextData, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    logger.info('AI chat request', { userId: req.user.id, contextType, messageLength: message.length });

    // PRIORITY: If component passes raw data, format it directly instead of querying DB
    // This ensures AI sees the same data the component displays
    let dataSummary: string;

    if (contextData?.rawData) {
      // Component provided its actual data - use it directly
      dataSummary = formatRawDataForAI(contextType, contextData);
      logger.info('Using component-provided raw data for AI context', { contextType });

      // For collections context, also append historical data for trend analysis
      if (contextType === 'collections' || contextType === 'impact-reports') {
        const historicalData = await getHistoricalCollectionsContext();
        dataSummary += historicalData;
        logger.info('Appended historical collections data to AI context');
      }
    } else {
      // Fallback: Build context from database (legacy behavior)
      logger.info('No raw data provided, falling back to database query', { contextType });
      switch (contextType) {
      case 'collections':
        dataSummary = await buildCollectionsContext(contextData);
        break;
      case 'events':
        dataSummary = await buildEventsContext(contextData);
        break;
      case 'impact-reports':
        // For impact reports, combine both
        const collectionsData = await buildCollectionsContext(contextData);
        const eventsData = await buildEventsContext(contextData);
        dataSummary = `${collectionsData}\n\n${eventsData}`;
        break;
      case 'holding-zone':
        dataSummary = await buildHoldingZoneContext(contextData);
        break;
      case 'network':
        dataSummary = await buildNetworkContext(contextData);
        break;
      case 'projects':
        dataSummary = await buildProjectsContext(contextData);
        break;
      case 'meetings':
        dataSummary = await buildMeetingsContext(contextData);
        break;
      case 'resources':
        dataSummary = await buildResourcesContext(contextData);
        break;
      case 'organizations':
        dataSummary = await buildOrganizationsContext(contextData);
        break;
      case 'links':
        dataSummary = await buildLinksContext(contextData);
        break;
      case 'volunteer-calendar':
        dataSummary = await buildVolunteerCalendarContext();
        break;
      case 'dashboard':
        dataSummary = await buildDashboardContext(contextData);
        break;
      case 'users':
        dataSummary = await buildUsersContext(contextData);
        break;
      case 'general':
        dataSummary = await buildGeneralContext();
        break;
      default:
        dataSummary = await buildGeneralContext();
      }
    }

    const systemPrompt = getSystemPrompt(contextType, dataSummary);

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const aiResponse = completion.choices[0].message.content || 'I apologize, but I was unable to generate a response.';

    // Parse any chart data from the response
    let chartData = null;
    const chartMatch = aiResponse.match(/```chart\n([\s\S]*?)\n```/);
    if (chartMatch) {
      try {
        chartData = JSON.parse(chartMatch[1]);
      } catch (e) {
        logger.warn('Failed to parse chart data from AI response');
      }
    }

    // Clean response (remove chart JSON block for display)
    const cleanedResponse = aiResponse.replace(/```chart\n[\s\S]*?\n```/g, '').trim();

    res.json({
      response: cleanedResponse,
      chart: chartData,
      contextType,
    });

  } catch (error) {
    logger.error('Error in AI chat', { error });
    res.status(500).json({
      error: 'Failed to process AI chat request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
