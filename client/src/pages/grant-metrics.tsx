import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { isInExcludedWeek } from '@/lib/excluded-weeks';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  TrendingUp,
  Heart,
  Users,
  Calendar,
  Award,
  Trophy,
  Target,
  MapPin,
  Clock,
  Zap,
  Star,
  BarChart3,
  Building2,
  Shield,
  DollarSign,
  UserCheck,
  Rocket,
  AlertTriangle,
  Mail,
  Download,
  FileText,
  HandHeart,
  PieChartIcon,
  TrendingDown,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { calculateTotalSandwiches, calculateGroupSandwiches, parseCollectionDate } from '@/lib/analytics-utils';
import { logger } from '@/lib/logger';
import { FloatingAIChat } from '@/components/floating-ai-chat';

export default function GrantMetrics() {
  const { trackView } = useActivityTracker();
  const [yearType, setYearType] = useState<'fiscal' | 'calendar'>(() => {
    const saved = localStorage.getItem('grantMetricsYearType');
    return (saved === 'fiscal' || saved === 'calendar') ? saved : 'fiscal';
  });
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  // Persist yearType to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('grantMetricsYearType', yearType);
  }, [yearType]);

  useEffect(() => {
    trackView(
      'Analytics',
      'Analytics',
      'Grant Metrics',
      'User accessed grant metrics page'
    );
  }, [trackView]);

  // Fetch collections data - use high limit to ensure we get all records
  const { data: collectionsData } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=10000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - grant metrics need reasonable freshness
  });

  const collections = collectionsData?.collections || [];
  const totalCollectionsInDB = collectionsData?.pagination?.total || 0;

  // WARNING: Check if we're hitting the limit
  if (collections.length >= 10000) {
    logger.warn('⚠️ HITTING API LIMIT: Received 10,000 collections but there may be more in the database!');
    logger.warn('Total in DB:', totalCollectionsInDB);
  }

  if (typeof window !== "undefined") {
    (window as any).__collections = collections;
  }

  // Note: hybridStats removed - collection log is the source of truth
  // Scott's Excel was a reference that stopped being updated in August 2025

  // Fetch stats  
  const { data: stats } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    staleTime: 2 * 60 * 1000, // 2 minutes - grant metrics need reasonable freshness
  });

  // Fetch recipients data
  const { data: recipientsData } = useQuery({
    queryKey: ['/api/recipients'],
    queryFn: async () => {
      const response = await fetch('/api/recipients', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch recipients');
      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch event requests data (completed events)
  const { data: eventRequestsData } = useQuery({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
    staleTime: 60000,
  });

  // Hardcoded host count (actual database has 34 active hosts)
  const totalHosts = 34;

  // Process recipients data
  const recipients = recipientsData || [];
  const activeRecipients = recipients.filter((r: any) => r.status === 'active');

  // Process event requests data
  const eventRequests = eventRequestsData || [];
  const completedEvents = eventRequests.filter((e: any) => e.status === 'completed');

  // Calculate REAL recipient metrics
  const calculateRecipientMetrics = () => {
    const byFocusArea: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    activeRecipients.forEach((r: any) => {
      if (r.focusArea) {
        byFocusArea[r.focusArea] = (byFocusArea[r.focusArea] || 0) + 1;
      }
      if (r.region) {
        byRegion[r.region] = (byRegion[r.region] || 0) + 1;
      }
    });

    const totalWeeklyCapacity = activeRecipients.reduce(
      (sum: number, r: any) => sum + (r.weeklyEstimate || r.estimatedSandwiches || 0),
      0
    );

    const contractsSigned = activeRecipients.filter((r: any) => r.contractSigned).length;

    return {
      total: activeRecipients.length,
      byFocusArea,
      byRegion,
      totalWeeklyCapacity,
      contractsSigned,
      contractSignedPercentage: activeRecipients.length > 0
        ? Math.round((contractsSigned / activeRecipients.length) * 100)
        : 0,
    };
  };

  // Calculate REAL event participation metrics from event requests
  const calculateEventMetrics = () => {
    // Filter for events within selected time period if applicable
    let eventsToAnalyze = completedEvents;

    if (selectedFiscalYear !== 'all') {
      const selectedYear = parseInt(selectedFiscalYear);
      eventsToAnalyze = eventsToAnalyze.filter((e: any) => {
        if (!e.scheduledEventDate && !e.desiredEventDate) return false;
        const eventDate = new Date(e.scheduledEventDate || e.desiredEventDate);
        if (Number.isNaN(eventDate.getTime())) return false;

        const year = eventDate.getFullYear();
        const month = eventDate.getMonth();

        if (yearType === 'fiscal') {
          // Fiscal year logic: July-June
          if (month >= 6) { // July-December
            return year === selectedYear;
          } else { // January-June
            return year === selectedYear + 1;
          }
        } else {
          // Calendar year logic: January-December
          return year === selectedYear;
        }
      });
    }

    const totalEvents = eventsToAnalyze.length;
    const totalActualAttendance = eventsToAnalyze.reduce(
      (sum: number, e: any) => sum + (e.actualAttendance || e.estimatedAttendance || 0),
      0
    );
    const eventRequestSandwiches = eventsToAnalyze.reduce(
      (sum: number, e: any) => sum + (e.actualSandwichCount || e.estimatedSandwichCount || 0),
      0
    );

    // Include historical "Groups" location data NOT linked to event requests
    // These are from when group collections were classified as a "location" rather than events
    let historicalGroupsToAnalyze = collections.filter((c: any) => 
      c.hostName === 'Groups' && !c.eventRequestId
    );

    // Apply same year filtering to historical collections
    if (selectedFiscalYear !== 'all') {
      const selectedYear = parseInt(selectedFiscalYear);
      historicalGroupsToAnalyze = historicalGroupsToAnalyze.filter((c: any) => {
        if (!c.collectionDate) return false;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return false;
        const year = date.getFullYear();
        const month = date.getMonth();

        if (yearType === 'fiscal') {
          if (month >= 6) return year === selectedYear;
          else return year === selectedYear + 1;
        } else {
          return year === selectedYear;
        }
      });
    }

    const historicalGroupSandwiches = historicalGroupsToAnalyze.reduce(
      (sum: number, c: any) => sum + calculateGroupSandwiches(c),
      0
    );

    // Total includes both event_requests and historical "Groups" location collections
    const totalActualSandwiches = eventRequestSandwiches + historicalGroupSandwiches;

    logger.log('=== HISTORICAL GROUPS DEBUG ===');
    logger.log('Historical Groups collections (not linked):', historicalGroupsToAnalyze.length);
    logger.log('Historical Groups sandwiches:', historicalGroupSandwiches);
    logger.log('Event request sandwiches:', eventRequestSandwiches);
    logger.log('Combined total:', totalActualSandwiches);

    // Debug logging
    logger.log('=== EVENT METRICS DEBUG ===');
    logger.log('Total completed events:', completedEvents.length);
    logger.log('Events to analyze (after filtering):', eventsToAnalyze.length);
    logger.log('Total sandwiches calculated:', totalActualSandwiches);
    logger.log('Sample events:', eventsToAnalyze.slice(0, 5).map((e: any) => ({
      id: e.id,
      org: e.organizationName,
      actual: e.actualSandwichCount,
      estimated: e.estimatedSandwichCount,
      used: e.actualSandwichCount || e.estimatedSandwichCount || 0
    })));

    // Get unique organizations
    const uniqueOrgs = new Set(
      eventsToAnalyze.map((e: any) => e.organizationName).filter(Boolean)
    );

    // DEBUG: Log unique org count
    logger.log('=== UNIQUE ORGS DEBUG ===');
    logger.log('Completed events total:', completedEvents.length);
    logger.log('Events to analyze:', eventsToAnalyze.length);
    logger.log('Unique organizations count:', uniqueOrgs.size);
    logger.log('First 10 orgs:', Array.from(uniqueOrgs).slice(0, 10));

    // Calculate events with social media posts
    const socialMediaPosts = eventsToAnalyze.filter(
      (e: any) => e.socialMediaPostCompleted
    ).length;

    return {
      totalEvents,
      totalActualAttendance,
      totalActualSandwiches,
      uniqueOrganizations: uniqueOrgs.size,
      socialMediaPostsCompleted: socialMediaPosts,
      avgAttendeesPerEvent: totalEvents > 0 ? Math.round(totalActualAttendance / totalEvents) : 0,
      avgSandwichesPerEvent: totalEvents > 0 ? Math.round(totalActualSandwiches / totalEvents) : 0,
    };
  };

  const recipientMetrics = calculateRecipientMetrics();
  const eventMetrics = calculateEventMetrics();

  // Filter collections by fiscal/calendar year and quarter
  const getFilteredCollections = () => {
    if (!Array.isArray(collections)) return [];

    let filtered = collections;

    if (selectedFiscalYear !== 'all') {
      const selectedYear = parseInt(selectedFiscalYear);
      filtered = filtered.filter((c: any) => {
        if (!c.collectionDate) return false;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return false;
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11

        if (yearType === 'fiscal') {
          // Fiscal year runs July 1 - June 30
          if (month >= 6) { // July-December
            return year === selectedYear;
          } else { // January-June
            return year === selectedYear + 1;
          }
        } else {
          // Calendar year runs January 1 - December 31
          return year === selectedYear;
        }
      });
    }

    if (selectedQuarter !== 'all' && selectedFiscalYear !== 'all') {
      const selectedYear = parseInt(selectedFiscalYear);
      const quarter = parseInt(selectedQuarter);
      filtered = filtered.filter((c: any) => {
        if (!c.collectionDate) return false;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return false;
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11

        let collectionQuarter = 0;
        let collectionYear = year;

        if (yearType === 'fiscal') {
          // Fiscal quarters: Q1: July-Sept, Q2: Oct-Dec, Q3: Jan-Mar, Q4: Apr-Jun
          if (month >= 6 && month <= 8) { // July-Sept
            collectionQuarter = 1;
          } else if (month >= 9 && month <= 11) { // Oct-Dec
            collectionQuarter = 2;
          } else if (month >= 0 && month <= 2) { // Jan-Mar
            collectionQuarter = 3;
            collectionYear = year - 1;
          } else { // Apr-Jun
            collectionQuarter = 4;
            collectionYear = year - 1;
          }
        } else {
          // Calendar quarters: Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
          if (month >= 0 && month <= 2) { // Jan-Mar
            collectionQuarter = 1;
          } else if (month >= 3 && month <= 5) { // Apr-Jun
            collectionQuarter = 2;
          } else if (month >= 6 && month <= 8) { // Jul-Sep
            collectionQuarter = 3;
          } else { // Oct-Dec
            collectionQuarter = 4;
          }
        }

        return collectionYear === selectedYear && collectionQuarter === quarter;
      });
    }

    return filtered;
  };

  const filteredCollections = getFilteredCollections();

  // Calculate volunteer hours based on conservative estimates
  const calculateVolunteerMetrics = (collectionsToAnalyze: any[]) => {
    // Conservative estimates:
    // - Individual sandwich makers: 20 min (0.33 hours) per person
    // - Group builds: 1.5 hours average per participant
    // - Hosts: 2.5 hours per collection event
    // - Administrative/coordination: 3 hours per event

    const individualEvents = collectionsToAnalyze.filter((c: any) => c.individualSandwiches > 0).length;
    const groupEvents = collectionsToAnalyze.filter((c: any) => {
      const groupSandwiches = calculateGroupSandwiches(c);
      return groupSandwiches > 0;
    }).length;

    const totalEvents = collectionsToAnalyze.length;

    // Estimate participants based on sandwiches made
    // Avg person makes ~8-12 sandwiches, use 10 as conservative estimate
    const totalSandwiches = collectionsToAnalyze.reduce((sum: number, c: any) => sum + calculateTotalSandwiches(c), 0);
    const estimatedParticipants = Math.round(totalSandwiches / 10);

    // Calculate hours
    const makingHours = estimatedParticipants * 0.33; // 20 min per person
    const hostHours = totalEvents * 2.5; // Host coordination
    const adminHours = totalEvents * 3; // Administrative overhead
    const driverHours = totalEvents * 1.5; // Driver/logistics

    const totalVolunteerHours = Math.round(makingHours + hostHours + adminHours + driverHours);

    // IRS values volunteer time at $33.49/hour (2024 rate)
    const economicValue = Math.round(totalVolunteerHours * 33.49);

    return {
      estimatedParticipants,
      totalVolunteerHours,
      economicValue,
      avgHoursPerEvent: Math.round(totalVolunteerHours / Math.max(totalEvents, 1)),
    };
  };

  // Calculate cost efficiency metrics
  const calculateCostMetrics = (collectionsToAnalyze: any[]) => {
    const totalSandwiches = collectionsToAnalyze.reduce((sum: number, c: any) => sum + calculateTotalSandwiches(c), 0);

    // Industry estimates:
    // - Cost per sandwich (ingredients): $1.40-$1.48
    // - Cost per person served (1 sandwich): same
    // - With volunteer labor valued: add ~$3.35 per sandwich (20 min @ $33.49/hr / 10 sandwiches)

    const costPerSandwich = 1.44; // Average ingredient cost
    const totalFoodValue = Math.round(totalSandwiches * costPerSandwich);

    return {
      totalSandwiches,
      costPerSandwich,
      totalFoodValue,
      costPerPerson: costPerSandwich, // 1 sandwich per person served
    };
  };

  // Calculate quarterly breakdown
  const getQuarterlyBreakdown = (collectionsToAnalyze: any[]) => {
    const quarterlyData: Record<string, { sandwiches: number; events: number; quarter: string }> = {};

    collectionsToAnalyze.forEach((c: any) => {
      if (!c.collectionDate) return;
      const date = parseCollectionDate(c.collectionDate);
      if (Number.isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = date.getMonth();

      let quarter = '';
      let fy = year;

      if (month >= 6 && month <= 8) {
        quarter = `FY${year} Q1 (Jul-Sep)`;
      } else if (month >= 9 && month <= 11) {
        quarter = `FY${year} Q2 (Oct-Dec)`;
      } else if (month >= 0 && month <= 2) {
        fy = year - 1;
        quarter = `FY${fy} Q3 (Jan-Mar)`;
      } else {
        fy = year - 1;
        quarter = `FY${fy} Q4 (Apr-Jun)`;
      }

      if (!quarterlyData[quarter]) {
        quarterlyData[quarter] = { sandwiches: 0, events: 0, quarter };
      }

      quarterlyData[quarter].sandwiches += calculateTotalSandwiches(c);
      quarterlyData[quarter].events += 1;
    });

    return Object.values(quarterlyData).sort((a, b) => a.quarter.localeCompare(b.quarter));
  };

  // Calculate impressive metrics
  const calculateGrantMetrics = () => {
    if (!Array.isArray(collections) || collections.length === 0) {
      return {
        totalSandwiches: 0,
        totalCollections: 0,
        uniqueHosts: 0,
        yearTotals: {} as Record<number, number>,
        peakYear: { year: 2024, total: 0 },
        peakMonth: { month: '', total: 0, year: 0 },
        longestStreak: 0,
        avgPerCollection: 0,
        topHost: { name: '', total: 0 },
        growthRate: 0,
        weeklyAverage: 0,
        overallGrowthMultiplier: 0,
        monthlyData: {} as Record<string, number>,
      };
    }

    const hostData: Record<string, number> = {};
    const monthlyData: Record<string, number> = {};
    const weeklyData: Record<string, number> = {};
    const uniqueHostsSet = new Set<string>();

    // Calculate yearly totals from actual collection log data (source of truth)
    const yearTotals: Record<number, number> = {};

    collections.forEach((collection: any) => {
      const hostName = collection.hostName || 'Unknown';

      const total = calculateTotalSandwiches(collection);

      uniqueHostsSet.add(hostName);
      hostData[hostName] = (hostData[hostName] || 0) + total;

      if (collection.collectionDate) {
        const date = parseCollectionDate(collection.collectionDate);
        if (!Number.isNaN(date.getTime())) {
          const year = date.getFullYear();
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          // Calculate week key (week starting Monday)
          const monday = new Date(date);
          const day = monday.getDay();
          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
          monday.setDate(diff);
          monday.setHours(0, 0, 0, 0);
          const weekKey = monday.toISOString().split('T')[0];

          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + total;
          weeklyData[weekKey] = (weeklyData[weekKey] || 0) + total;

          // Always calculate from actual collections (source of truth)
          if (!yearTotals[year]) {
            yearTotals[year] = 0;
          }
          yearTotals[year] += total;
        }
      }
    });

    // Find peak year
    const peakYear = Object.entries(yearTotals)
      .reduce((max, [year, total]) => total > max.total ? { year: parseInt(year), total } : max, { year: 2024, total: 0 });

    // Find peak month
    const peakMonthEntry = Object.entries(monthlyData)
      .reduce((max, [month, total]) => total > max.total ? { month, total } : max, { month: '', total: 0 });

    const [peakYear2, peakMonthNum] = peakMonthEntry.month.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const peakMonth = {
      month: peakMonthEntry.month ? `${monthNames[parseInt(peakMonthNum) - 1]} ${peakYear2}` : '',
      total: peakMonthEntry.total,
      year: parseInt(peakYear2) || 0,
    };

    // Find top host (exclude "Groups" and "Unknown" as they're data collection artifacts)
    const topHostEntry = Object.entries(hostData)
      .filter(([name]) => name !== 'Groups' && name !== 'Unknown')
      .reduce((max, [name, total]) => total > max.total ? { name, total } : max, { name: '', total: 0 });

    // Calculate growth rate (2023 to 2024)
    const growthRate = yearTotals[2023] > 0
      ? ((yearTotals[2024] - yearTotals[2023]) / yearTotals[2023]) * 100
      : 0;

    // Calculate weekly average from last 4 complete weeks (more representative of current production)
    // Excluding no-collection weeks like Thanksgiving, Christmas, etc.
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - (4 * 7));

    const recentWeeks = Object.entries(weeklyData)
      .filter(([weekKey]) => {
        const weekDate = new Date(weekKey);
        if (weekDate < fourWeeksAgo) return false;
        // Exclude current incomplete week (if weekKey is this week's Monday)
        const thisMonday = new Date(now);
        const dayOfWeek = thisMonday.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        thisMonday.setDate(thisMonday.getDate() - daysFromMonday);
        thisMonday.setHours(0, 0, 0, 0);
        if (weekDate.toISOString().split('T')[0] === thisMonday.toISOString().split('T')[0]) {
          return false; // Skip current incomplete week
        }
        // weekKey is Monday - convert to Wednesday to check exclusion (add 2 days)
        const wednesday = new Date(weekDate);
        wednesday.setDate(weekDate.getDate() + 2);
        const wednesdayStr = `${wednesday.getFullYear()}-${String(wednesday.getMonth() + 1).padStart(2, '0')}-${String(wednesday.getDate()).padStart(2, '0')}`;
        return !isInExcludedWeek(wednesdayStr).excluded;
      })
      .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending (most recent first)
      .slice(0, 4) // Take the 4 most recent complete weeks
      .map(([, total]) => total);

    const weeklyAverage = recentWeeks.length > 0
      ? Math.round(recentWeeks.reduce((sum, total) => sum + total, 0) / recentWeeks.length)
      : 0;

    // Calculate overall growth multiplier (from earliest year to most recent)
    const years = Object.keys(yearTotals).map(y => parseInt(y)).sort();
    const earliestYear = years[0];
    const latestYear = years[years.length - 1];

    const overallGrowthMultiplier = yearTotals[earliestYear] > 0
      ? Math.round((yearTotals[latestYear] / yearTotals[earliestYear]) * 10) / 10
      : 0;

    // Calculate total sandwiches from the actual data
    const totalSandwiches = Object.values(yearTotals).reduce((sum, total) => sum + total, 0);
    const avgPerCollection = collections.length > 0 ? Math.round(totalSandwiches / collections.length) : 0;

    return {
      totalSandwiches,
      totalCollections: collections.length,
      uniqueHosts: uniqueHostsSet.size,
      yearTotals,
      peakYear,
      peakMonth,
      avgPerCollection,
      topHost: topHostEntry,
      growthRate,
      weeklyAverage,
      overallGrowthMultiplier,
      monthlyData,
    };
  };

  // Calculate metrics for filtered data (respects fiscal year/quarter selection)
  const filteredVolunteerMetrics = calculateVolunteerMetrics(filteredCollections);
  const filteredCostMetrics = calculateCostMetrics(filteredCollections);
  const filteredQuarterlyBreakdown = getQuarterlyBreakdown(filteredCollections);

  // Calculate ALL-TIME metrics for the hero stats and growth charts (always show full history)
  const allTimeCollections = collections;
  const metrics = calculateGrantMetrics();
  const allTimeVolunteerMetrics = calculateVolunteerMetrics(allTimeCollections);
  const allTimeCostMetrics = calculateCostMetrics(allTimeCollections);

  // Get available years from data (fiscal or calendar)
  const availableFiscalYears = Array.from(
    new Set(
      collections.map((c: any) => {
        if (!c.collectionDate) return null;
        const date = parseCollectionDate(c.collectionDate);
        if (Number.isNaN(date.getTime())) return null;
        const year = date.getFullYear();

        if (yearType === 'fiscal') {
          const month = date.getMonth();
          // If July-Dec, fiscal year starts that year. If Jan-Jun, fiscal year started previous year
          return month >= 6 ? year : year - 1;
        } else {
          // Calendar year - just return the year
          return year;
        }
      }).filter(Boolean)
    )
  ).sort((a: any, b: any) => b - a);

  // Debug 2025 data calculation
  logger.log('=== 2025 DATA DEBUG ===');
  logger.log('Total collections received from API:', collections.length);
  logger.log('Total collections in database (from pagination):', totalCollectionsInDB);
  if (collections.length < totalCollectionsInDB) {
    logger.warn('⚠️ WARNING: Not all collections loaded! Missing', totalCollectionsInDB - collections.length, 'records');
  }

  const year2025Collections = collections.filter((c: any) =>
    c.collectionDate && c.collectionDate.startsWith('2025')
  );

  logger.log('2025 Collections Count:', year2025Collections.length);
  logger.log('2025 Year Total from yearTotals:', metrics.yearTotals[2025]);

  const manual2025Total = year2025Collections.reduce((sum: number, c: any) =>
    sum + calculateTotalSandwiches(c), 0
  );
  logger.log('2025 Manually Calculated Total:', manual2025Total);

  // Check for duplicate IDs in 2025 data
  const allIds = collections.map((c: any) => c.id);
  const duplicateIds = allIds.filter((id: any, index: number) => allIds.indexOf(id) !== index);
  logger.log('Duplicate IDs in ALL collections:', duplicateIds.length > 0 ? duplicateIds : 'None');

  const year2025Ids = year2025Collections.map((c: any) => c.id);
  const duplicate2025Ids = year2025Ids.filter((id: any, index: number) => year2025Ids.indexOf(id) !== index);
  logger.log('Duplicate IDs in 2025:', duplicate2025Ids.length > 0 ? duplicate2025Ids : 'None');

  // Sample some 2025 records to check calculation
  logger.log('Sample 2025 Collections (first 5):', year2025Collections.slice(0, 5).map((c: any) => ({
    id: c.id,
    date: c.collectionDate,
    individual: c.individualSandwiches,
    group1: c.group1Count,
    group2: c.group2Count,
    groupCollections: c.groupCollections,
    calculated: calculateTotalSandwiches(c),
    hostName: c.hostName,
  })));
  logger.log('=======================');

  // Prepare year-over-year chart data - ONLY COMPLETE YEARS
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11

  // Get all years from data and sort
  const allYears = Object.keys(metrics.yearTotals)
    .map(y => parseInt(y))
    .filter(y => !isNaN(y))
    .sort((a, b) => a - b);

  // Only include complete years (exclude current year if we're not in December yet)
  const completeYears = allYears.filter(year => {
    if (year < currentYear) return true; // Past years are complete
    if (year === currentYear && currentMonth === 11) return true; // Current year in December
    return false; // Don't include incomplete current year
  });

  // Prepare chart data from complete years only
  const yearChartData = completeYears.map(year => ({
    year: year.toString(),
    sandwiches: metrics.yearTotals[year] || 0,
  }));

  // Calculate year-over-year growth percentages for annotations
  const yearGrowthData = yearChartData.map((data, index) => {
    if (index === 0) return { ...data, growth: null };
    const prevYear = yearChartData[index - 1];
    const growth = prevYear.sandwiches > 0
      ? Math.round(((data.sandwiches - prevYear.sandwiches) / prevYear.sandwiches) * 100)
      : 0;
    return { ...data, growth };
  });

  return (
    <div className="bg-gradient-to-br from-[#E8F4F8] to-[#F0F9FB] p-6 rounded-lg">
      <div className="max-w-7xl mx-auto">
        <PageBreadcrumbs segments={[
          { label: 'Analytics & Reports' },
          { label: 'Grant Metrics' }
        ]} />

        {/* Hero Section - Impact First with Sustainability Story */}
        <div className="mb-8 bg-gradient-to-r from-[#236383] to-[#007e8c] rounded-2xl p-8 text-white shadow-xl">
          {/* Lead with Impact + Consistency */}
          <div className="text-center mb-8">
            <div className="text-5xl md:text-7xl font-black text-[#fbad3f] mb-2">2.3 Million</div>
            <div className="text-xl md:text-2xl font-semibold text-white/90 mb-2">
              sandwiches delivered over <span className="text-[#fbad3f] font-bold">291 consecutive weeks</span>
            </div>
            <div className="text-base md:text-lg text-white/70">
              Every single week since April 2020. No exceptions.
            </div>
          </div>

          {/* Key Stats Grid - Capacity First, Then People */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#fbad3f]">10,000+</div>
              <div className="text-sm md:text-base text-white/90 mt-1">Weekly baseline (up from 1,000 in 2020)</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#fbad3f]">35</div>
              <div className="text-sm md:text-base text-white/90 mt-1">Collection sites across Metro Atlanta</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#fbad3f]">4,000+</div>
              <div className="text-sm md:text-base text-white/90 mt-1">Volunteers powering the network</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-[#fbad3f]">70+</div>
              <div className="text-sm md:text-base text-white/90 mt-1">Partner organizations served weekly</div>
            </div>
          </div>

          {/* Our Story */}
          <div className="max-w-4xl mx-auto space-y-4 text-center">
            <p className="text-lg md:text-xl leading-relaxed">
              Our journey began in mid-2020, when the COVID-19 pandemic profoundly impacted countless lives.
              Even as the urgency of COVID has eased, housing costs, inflation, and systemic inequities
              force many families into impossible choices between food and other basic needs.
            </p>
            <p className="text-base md:text-lg leading-relaxed text-white/90">
              Through a network of dedicated volunteers, we create and deliver fresh, homemade sandwiches
              to individuals in need. We believe in the transformative power of community, compassion, and kindness —
              and in the fundamental right of every person to access nourishing food.
            </p>
            <p className="text-xl md:text-2xl font-semibold mt-6 text-[#47b3cb]">
              Fighting food insecurity. Fostering a spirit of service. Building a stronger community.
            </p>
          </div>
        </div>

        {/* Header with Filter Controls */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Grant Metrics & Impact Showcase
              </h1>
              <p className="text-lg text-gray-600">
                Highlighting our community impact for donors, grants, and partnerships
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => window.print()}
              >
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Fiscal Year and Quarter Filters */}
          <Card className="bg-white/80 backdrop-blur border-[#236383]/20">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Year Type Toggle */}
                <div className="flex items-center gap-4 pb-3 border-b border-gray-200">
                  <Calendar className="w-5 h-5 text-[#236383]" />
                  <span className="font-semibold text-gray-700">Year Type:</span>
                  <RadioGroup
                    value={yearType}
                    onValueChange={(value: 'fiscal' | 'calendar') => {
                      setYearType(value);
                      setSelectedFiscalYear('all');
                      setSelectedQuarter('all');
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fiscal" id="fiscal" />
                      <Label htmlFor="fiscal" className="cursor-pointer">Fiscal Year</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="calendar" id="calendar" />
                      <Label htmlFor="calendar" className="cursor-pointer">Calendar Year</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Year and Quarter Selectors */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <span className="font-semibold text-gray-700">Reporting Period:</span>

                  <div className="flex flex-col sm:flex-row gap-3 flex-1">
                    <Select value={selectedFiscalYear} onValueChange={(value) => {
                      setSelectedFiscalYear(value);
                      if (value === 'all') setSelectedQuarter('all');
                    }}>
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder={yearType === 'fiscal' ? 'Select Fiscal Year' : 'Select Calendar Year'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {availableFiscalYears.map((year: any) => (
                          <SelectItem key={year} value={year.toString()}>
                            {yearType === 'fiscal'
                              ? `FY ${year} (Jul ${year} - Jun ${year + 1})`
                              : `${year}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedQuarter}
                      onValueChange={setSelectedQuarter}
                      disabled={selectedFiscalYear === 'all'}
                    >
                      <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Select Quarter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Quarters</SelectItem>
                        {yearType === 'fiscal' ? (
                          <>
                            <SelectItem value="1">Q1 (Jul-Sep)</SelectItem>
                            <SelectItem value="2">Q2 (Oct-Dec)</SelectItem>
                            <SelectItem value="3">Q3 (Jan-Mar)</SelectItem>
                            <SelectItem value="4">Q4 (Apr-Jun)</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="1">Q1 (Jan-Mar)</SelectItem>
                            <SelectItem value="2">Q2 (Apr-Jun)</SelectItem>
                            <SelectItem value="3">Q3 (Jul-Sep)</SelectItem>
                            <SelectItem value="4">Q4 (Oct-Dec)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <Badge variant="outline" className="bg-[#236383]/10 text-[#236383] border-[#236383]/30">
                    {selectedFiscalYear === 'all'
                      ? 'Showing All-Time Data'
                      : selectedQuarter === 'all'
                      ? (yearType === 'fiscal' ? `FY ${selectedFiscalYear}` : `${selectedFiscalYear}`)
                      : (yearType === 'fiscal' ? `FY ${selectedFiscalYear} Q${selectedQuarter}` : `${selectedFiscalYear} Q${selectedQuarter}`)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Hero Stats - The Big Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-[#236383] to-[#1a4d63] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Trophy className="w-6 h-6 mr-3" />
                Total Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {metrics.totalSandwiches.toLocaleString()}
              </div>
              <p className="text-white/90 text-base font-medium">
                Sandwiches distributed to community members in need
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#007E8C] to-[#006170] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Award className="w-6 h-6 mr-3" />
                Peak Year
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {metrics.peakYear.total.toLocaleString()}
              </div>
              <p className="text-white/90 text-base font-medium">
                Sandwiches in {metrics.peakYear.year} - our best year yet
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#FBAD3F] to-[#e89a2c] text-white border-0 shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-bold flex items-center">
                <Building2 className="w-6 h-6 mr-3" />
                Host Locations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-black mb-2">
                {totalHosts}
              </div>
              <p className="text-white/90 text-base font-medium">
                Active collection sites across Metro Atlanta
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Achievement Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-2 border-[#FBAD3F] shadow-lg">
            <CardHeader className="bg-[#FEF4E0]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <Star className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                Record-Breaking Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#236383]">
                <Calendar className="w-8 h-8 text-[#236383] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Peak Month</h3>
                  <p className="text-2xl font-black text-[#236383] my-1">
                    {metrics.peakMonth.total.toLocaleString()} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    {metrics.peakMonth.month} - our highest monthly total
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#47B3CB]">
                <Target className="w-8 h-8 text-[#47B3CB] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Average Per Collection</h3>
                  <p className="text-2xl font-black text-[#47B3CB] my-1">
                    {metrics.avgPerCollection} sandwiches
                  </p>
                  <p className="text-sm text-gray-600">
                    Consistent high-quality output per event
                  </p>
                </div>
              </div>

              {metrics.growthRate > 0 && (
                <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#007E8C]">
                  <TrendingUp className="w-8 h-8 text-[#007E8C] flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Year-Over-Year Growth</h3>
                    <p className="text-2xl font-black text-[#007E8C] my-1">
                      +{metrics.growthRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">
                      2023 to 2024 - demonstrating sustained impact
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4 p-4 bg-white rounded-lg border-l-4 border-[#A31C41]">
                <Shield className="w-8 h-8 text-[#A31C41] flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Crisis Response</h3>
                  <p className="text-2xl font-black text-[#A31C41] my-1">
                    14,023 sandwiches
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    Mobilized during Hurricane Helene (October 2024)
                  </p>
                  <p className="text-sm font-semibold text-[#007E8C]">
                    2-3x surge capacity within one week
                  </p>
                  <p className="text-xs text-gray-500 italic mt-1">
                    Proven disaster infrastructure, not just routine food distribution
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How We Do It: The Volunteer Network */}
          <Card className="border-2 border-[#A31C41] shadow-lg">
            <CardHeader className="bg-[#FCE4E6]">
              <CardTitle className="flex items-center text-[#A31C41]">
                <Users className="w-5 h-5 mr-2 text-[#A31C41]" />
                How We Do It: The Volunteer Network
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="text-center p-6 bg-gradient-to-br from-[#A31C41] to-[#8a1636] rounded-xl text-white">
                <div className="font-black mb-1 text-[28px]">
                  291 Consecutive Weeks
                </div>
                <p className="text-white/90 text-sm mb-4">of service — no gaps, no exceptions</p>

                {/* Visual separator line */}
                <div className="w-16 h-0.5 bg-white/30 mx-auto mb-4"></div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-black text-[24px]">4,000+</div>
                    <p className="text-white/90 text-xs">volunteers</p>
                  </div>
                  <div>
                    <div className="font-black text-[24px]">{metrics.avgPerCollection}</div>
                    <p className="text-white/90 text-xs">per collection</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#A31C41]/30">
                <h3 className="font-semibold text-gray-900 mb-3">Why This Model Works</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Zero paid staff for collections — 100% volunteer-powered</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Distributed network enables rapid response and 24/7 coverage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Geographic diversity reaches hungry people across Metro Atlanta</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#A31C41] flex-shrink-0 mt-0.5" />
                    <span>Crisis-ready: proven 3x surge capacity (Hurricane Helene)</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Year-over-Year Growth Chart - COMPLETE YEARS ONLY */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <BarChart3 className="w-6 h-6 mr-2 text-brand-primary" />
              Year-Over-Year Impact Growth (Complete Years)
            </CardTitle>
            <CardDescription>
              Demonstrating sustained and growing community impact {currentYear === 2025 && currentMonth < 11 && '(2025 excluded - year in progress)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={yearChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="year" />
                  <YAxis
                    tickFormatter={(value) => value.toLocaleString()}
                    label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toLocaleString(), 'Sandwiches']}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #ccc',
                      borderRadius: '8px',
                      padding: '10px'
                    }}
                  />
                  <Bar dataKey="sandwiches" fill="#236383" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Year-over-Year Growth Summary */}
            <div className="bg-gradient-to-r from-[#E8F4F8] to-white p-5 rounded-lg border border-[#236383]/20">
              <h3 className="font-bold text-gray-900 mb-3">Year-Over-Year Growth Rates</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {yearGrowthData.map((data, index) => (
                  <div key={data.year} className="text-center">
                    <div className="text-lg font-bold text-[#236383]">{data.year}</div>
                    <div className="text-2xl font-black text-gray-900 mb-1">
                      {data.sandwiches.toLocaleString()}
                    </div>
                    {data.growth !== null && (
                      <Badge
                        className={`${
                          data.growth > 0
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : data.growth < 0
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        {data.growth > 0 ? '+' : ''}{data.growth}% YoY
                      </Badge>
                    )}
                    {index === 0 && (
                      <div className="text-xs text-gray-500 mt-1">Baseline</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Year Status (if incomplete) */}
            {currentYear > Math.max(...completeYears) && metrics.yearTotals[currentYear] && (
              <div className="mt-4 p-4 bg-gradient-to-r from-[#FEF4E0] to-white rounded-lg border border-[#FBAD3F]/30">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#FBAD3F] shrink-0 mt-1" />
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{currentYear} In Progress</h4>
                    <p className="text-sm text-gray-700">
                      Current year: <strong>{(metrics.yearTotals[currentYear] || 0).toLocaleString()} sandwiches</strong> so far
                      {completeYears.length > 0 && ` (on pace for ${Math.round((metrics.yearTotals[currentYear] || 0) / ((currentMonth + 1) / 12)).toLocaleString()})`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      * Excluded from chart above to show only complete years for fair comparison
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Strategic Milestones & Infrastructure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Distributed Network */}
          <Card className="border-2 border-[#007E8C] shadow-lg">
            <CardHeader className="bg-[#E0F2F1]">
              <CardTitle className="flex items-center text-[#007E8C]">
                <Building2 className="w-5 h-5 mr-2" />
                Distributed Network
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-[#007E8C] mb-1">
                    35 sites
                  </div>
                  <p className="text-sm text-gray-600">
                    Collection locations across Metro Atlanta
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-2xl font-bold text-[#236383] mb-1">
                    70+ partners
                  </div>
                  <p className="text-sm text-gray-600">
                    Organizations receiving deliveries weekly
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Built-in redundancy: if one area struggles, others compensate
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Volunteer Power */}
          <Card className="border-2 border-[#FBAD3F] shadow-lg">
            <CardHeader className="bg-[#FEF4E0]">
              <CardTitle className="flex items-center text-[#FBAD3F]">
                <UserCheck className="w-5 h-5 mr-2" />
                Volunteer Network
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-black text-[#FBAD3F] mb-1">
                    4,000+
                  </div>
                  <p className="text-sm text-gray-600">
                    Active members in private volunteer community
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <div className="text-2xl font-bold text-[#47B3CB] mb-1">
                    5,350+
                  </div>
                  <p className="text-sm text-gray-600">
                    Newsletter recipients staying informed
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 italic">
                    Volunteers consistently engaged for 3+ years
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Remarkable Growth Story */}
        <Card className="mb-8 bg-gradient-to-r from-[#47B3CB]/10 to-[#236383]/10 border-2 border-[#47B3CB]">
          <CardContent className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <Rocket className="w-10 h-10 text-[#236383] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Exponential Growth with Strategic Sustainability
                </h2>
                <p className="text-gray-600">
                  From pandemic response to community infrastructure in 5 years
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-4 rounded-lg border border-[#236383]/20">
                <div className="text-sm text-gray-600 mb-1">April 2020 (Start)</div>
                <div className="text-3xl font-black text-[#236383]">317</div>
                <div className="text-xs text-gray-500">sandwiches</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#A31C41]/20">
                <div className="text-sm text-gray-600 mb-1">Peak Week (Nov 2023)</div>
                <div className="text-3xl font-black text-[#A31C41]">38,828</div>
                <div className="text-xs text-gray-500">sandwiches</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#007E8C]/20">
                <div className="text-sm text-gray-600 mb-1">Weekly Avg (Recent)</div>
                <div className="text-3xl font-black text-[#007E8C]">
                  {metrics.weeklyAverage > 0 ? metrics.weeklyAverage.toLocaleString() : '8-10K'}
                </div>
                <div className="text-xs text-gray-500">sandwiches/week</div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-[#FBAD3F]/20">
                <div className="text-sm text-gray-600 mb-1">Overall Growth</div>
                <div className="text-3xl font-black text-[#FBAD3F]">
                  {metrics.overallGrowthMultiplier > 0 ? `${metrics.overallGrowthMultiplier}x` : '107x'}
                </div>
                <div className="text-xs text-gray-500">since inception</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inflation Resilience Callout */}
        <Card className="mb-8 bg-gradient-to-r from-[#236383] to-[#007e8c] text-white shadow-xl border-0">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0 text-center md:text-left">
                <div className="text-4xl md:text-5xl font-black text-[#fbad3f]">+26%</div>
                <div className="text-sm text-white/80">food price inflation<br />since 2022</div>
              </div>
              <div className="flex-grow">
                <h3 className="text-xl font-bold mb-2">Real Growth Despite Rising Costs</h3>
                <p className="text-white/90">
                  Food prices have increased 26%+ since 2022. Despite this, we've grown from <strong className="text-[#fbad3f]">440,371 sandwiches</strong> (2022)
                  to <strong className="text-[#fbad3f]">526,083</strong> (2025) — representing <strong className="text-[#fbad3f]">41% real growth</strong> in
                  volunteer effort and community contribution.
                </p>
              </div>
              <div className="flex-shrink-0 text-center md:text-right">
                <div className="text-4xl md:text-5xl font-black text-[#fbad3f]">526K</div>
                <div className="text-sm text-white/80">sandwiches in 2025<br />(peak year)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What Makes This Infrastructure Revolutionary */}
        <Card className="mb-8 border-2 border-[#A31C41] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#A31C41] to-[#8a1636] text-white">
            <CardTitle className="flex items-center text-xl">
              <Zap className="w-6 h-6 mr-2" />
              What Makes This Infrastructure Revolutionary
            </CardTitle>
            <CardDescription className="text-white/90">
              For funders evaluating systems-change, replication potential, and disaster preparedness
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">100% Volunteer-Powered</div>
                <p className="text-sm text-gray-700">
                  Zero paid staff for collections. Built entirely on volunteer coordination and community trust.
                </p>
              </div>
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">Weekly Consistency</div>
                <p className="text-sm text-gray-700">
                  291 consecutive weeks of service. No gaps. No exceptions. Institutional-grade reliability.
                </p>
              </div>
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">Crisis-Ready</div>
                <p className="text-sm text-gray-700">
                  Proven 3x surge capacity during Hurricane Helene — mobilized without external support.
                </p>
              </div>
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">Inflation-Resilient</div>
                <p className="text-sm text-gray-700">
                  41% real growth despite 26% food cost increases since 2022. Volunteers absorbed the extra effort.
                </p>
              </div>
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">Dual Collection Model</div>
                <p className="text-sm text-gray-700">
                  Scalable via both individuals and organizations — 1,113 sandwiches per collection average.
                </p>
              </div>
              <div className="p-4 bg-[#FCE4E6] rounded-lg border border-[#A31C41]/20">
                <div className="font-bold text-[#A31C41] mb-2">Replicable Framework</div>
                <p className="text-sm text-gray-700">
                  Proven model that can be adapted for other cities facing food insecurity challenges.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Economic Impact */}
        <Card className="mb-8 border-2 border-[#007E8C] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#007E8C] to-[#236383] text-white">
            <CardTitle className="flex items-center text-xl">
              <DollarSign className="w-6 h-6 mr-2" />
              Economic & Financial Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              The hidden value behind the sandwiches
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  $1.2-2M
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Annual food value delivered to community
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  At $1.40-$1.48 per sandwich
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <div className="text-4xl font-black text-[#236383] mb-2">
                  $500-2K
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Corporate team building investment per event
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Companies make 2,000-5,000 sandwiches
                </p>
              </div>

              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <div className="text-4xl font-black text-[#FBAD3F] mb-2">
                  ServSafe
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Certified team members ensuring safety
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Professional food safety standards
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GRANT-SPECIFIC SECTIONS */}

        {/* Volunteer Engagement & Economic Value - INTERACTIVE */}
        <Card className="mb-8 border-2 border-[#FBAD3F] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#FBAD3F] to-[#e89a2c] text-white">
            <CardTitle className="flex items-center text-xl">
              <HandHeart className="w-6 h-6 mr-2" />
              Volunteer Engagement & Economic Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating community mobilization and in-kind value {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <Users className="w-8 h-8 mx-auto mb-2 text-[#FBAD3F]" />
                <div className="text-3xl font-black text-[#FBAD3F] mb-1">
                  {filteredVolunteerMetrics.estimatedParticipants.toLocaleString()}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Est. volunteer participants
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on collection data
                </p>
              </div>

              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <Clock className="w-8 h-8 mx-auto mb-2 text-[#007E8C]" />
                <div className="text-3xl font-black text-[#007E8C] mb-1">
                  {filteredVolunteerMetrics.totalVolunteerHours.toLocaleString()}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Est. volunteer hours
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Conservative estimate
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-[#236383]" />
                <div className="text-3xl font-black text-[#236383] mb-1">
                  ${(filteredVolunteerMetrics.economicValue / 1000).toFixed(0)}K
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Economic value (IRS rate)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  @$33.49/hour (2024)
                </p>
              </div>

              <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                <Activity className="w-8 h-8 mx-auto mb-2 text-[#A31C41]" />
                <div className="text-3xl font-black text-[#A31C41] mb-1">
                  {filteredVolunteerMetrics.avgHoursPerEvent}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Total volunteer hours per event
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  All participants combined
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                How We Calculate Volunteer Hours (Conservative Methodology)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#FBAD3F]/20 text-[#FBAD3F] border-[#FBAD3F]/30 shrink-0">
                    Making
                  </Badge>
                  <span>20 min per participant (0.33 hrs × ~10 sandwiches/person)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30 shrink-0">
                    Hosting
                  </Badge>
                  <span>2.5 hours per collection event (setup, coordination, cleanup)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#236383]/20 text-[#236383] border-[#236383]/30 shrink-0">
                    Logistics
                  </Badge>
                  <span>1.5 hours per event (driving, delivery, returns)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#A31C41]/20 text-[#A31C41] border-[#A31C41]/30 shrink-0">
                    Admin
                  </Badge>
                  <span>3 hours per event (coordination, communication, tracking)</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-3 italic">
                * All estimates use conservative industry standards to ensure defensible grant reporting
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Cost Efficiency & Financial Metrics - INTERACTIVE */}
        <Card className="mb-8 border-2 border-[#007E8C] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#007E8C] to-[#236383] text-white">
            <CardTitle className="flex items-center text-xl">
              <DollarSign className="w-6 h-6 mr-2" />
              Cost Efficiency & Financial Impact
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating value delivered to community {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center p-4 bg-[#E0F2F1] rounded-lg">
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  ${filteredCostMetrics.costPerSandwich.toFixed(2)}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Cost per sandwich
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Ingredients only
                </p>
              </div>

              <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                <div className="text-4xl font-black text-[#236383] mb-2">
                  ${filteredCostMetrics.costPerPerson.toFixed(2)}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Cost per person served
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Direct food cost
                </p>
              </div>

              <div className="text-center p-4 bg-[#FEF4E0] rounded-lg">
                <div className="text-4xl font-black text-[#FBAD3F] mb-2">
                  ${filteredCostMetrics.totalFoodValue >= 1000000
                    ? (filteredCostMetrics.totalFoodValue / 1000000).toFixed(2) + 'M'
                    : (filteredCostMetrics.totalFoodValue / 1000).toFixed(0) + 'K'}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Total food value delivered
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Selected period
                </p>
              </div>

              <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                <div className="text-4xl font-black text-[#A31C41] mb-2">
                  ${((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) >= 1000000
                    ? ((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) / 1000000).toFixed(2) + 'M'
                    : ((filteredVolunteerMetrics.economicValue + filteredCostMetrics.totalFoodValue) / 1000).toFixed(0) + 'K')}
                </div>
                <p className="text-sm text-gray-700 font-medium">
                  Total community value
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Food + volunteer hours
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#E0F2F1] to-white p-5 rounded-lg border border-[#007E8C]/30">
              <h3 className="font-bold text-gray-900 mb-3">Why This Matters for Funders</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#007E8C] flex items-center justify-center text-white font-bold shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Exceptional Cost Efficiency</p>
                    <p className="text-sm text-gray-600">
                      At ${filteredCostMetrics.costPerPerson.toFixed(2)}/person, we deliver dignified food assistance at a fraction of traditional meal program costs ($8-15/meal)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#236383] flex items-center justify-center text-white font-bold shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Volunteer Force Multiplier</p>
                    <p className="text-sm text-gray-600">
                      Every $1 in grants leverages ${((filteredVolunteerMetrics.economicValue / Math.max(filteredCostMetrics.totalFoodValue, 1))).toFixed(1)} in volunteer economic value
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FBAD3F] flex items-center justify-center text-white font-bold shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Proven Sustainability</p>
                    <p className="text-sm text-gray-600">
                      Operating continuously since April 2020 with consistent growth, not a one-time initiative
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#A31C41] flex items-center justify-center text-white font-bold shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Community Ownership</p>
                    <p className="text-sm text-gray-600">
                      {filteredVolunteerMetrics.estimatedParticipants.toLocaleString()}+ participants means deep community buy-in and resilience
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quarterly Reporting Breakdown - INTERACTIVE */}
        {filteredQuarterlyBreakdown.length > 0 && (
          <Card className="mb-8 border-2 border-[#47B3CB] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#47B3CB] to-[#236383] text-white">
              <CardTitle className="flex items-center text-xl">
                <Calendar className="w-6 h-6 mr-2" />
                Quarterly Performance Breakdown
              </CardTitle>
              <CardDescription className="text-white/90">
                For grant reporting and compliance {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear}${selectedQuarter !== 'all' ? ` Q${selectedQuarter}` : ''})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredQuarterlyBreakdown.slice(-12).map((quarter) => (
                  <div
                    key={quarter.quarter}
                    className="p-4 bg-gradient-to-br from-white to-[#E8F4F8] rounded-lg border border-[#47B3CB]/30 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-[#47B3CB]/20 text-[#47B3CB] border-[#47B3CB]/30">
                        {quarter.quarter}
                      </Badge>
                      <BarChart3 className="w-5 h-5 text-[#236383]" />
                    </div>
                    <div className="text-3xl font-black text-[#236383] mb-1">
                      {quarter.sandwiches.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600 mb-1">sandwiches distributed</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Building2 className="w-3 h-3" />
                      {quarter.events} collection events
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Geographic Reach & Demographics */}
        <Card className="mb-8 border-2 border-[#A31C41] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#A31C41] to-[#8a1636] text-white">
            <CardTitle className="flex items-center text-xl">
              <MapPin className="w-6 h-6 mr-2" />
              Geographic Reach & Communities Served
            </CardTitle>
            <CardDescription className="text-white/90">
              Demonstrating diversity and accessibility
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-[#A31C41]" />
                  Service Area
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-[#FCE4E6] rounded-lg">
                    <div className="font-semibold text-gray-900 mb-1">Metro Atlanta Coverage</div>
                    <div className="text-sm text-gray-700">
                      <strong>35 collection sites</strong> across Fulton, DeKalb, Gwinnett, and Cobb counties
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-[#A31C41]/20">
                    <div className="font-semibold text-gray-900 mb-1">Strategic Distribution</div>
                    <div className="text-sm text-gray-700">
                      <strong>70+ partner organizations</strong> receiving weekly deliveries in high-need zip codes
                    </div>
                  </div>
                  <div className="p-3 bg-[#FCE4E6] rounded-lg">
                    <div className="font-semibold text-gray-900 mb-1">Expansion</div>
                    <div className="text-sm text-gray-700">
                      Extended operations to <strong>Athens-Clarke County</strong> in 2024
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-[#A31C41]" />
                  Diverse Communities Served
                </h3>
                <div className="bg-gradient-to-br from-white to-[#FCE4E6] p-5 rounded-lg border border-[#A31C41]/20">
                  <p className="text-sm text-gray-700 mb-4">
                    Our distribution network serves diverse populations across Metro Atlanta:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Black communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Latino communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>AAPI communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>White communities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Housed individuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Unhoused individuals</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Seniors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Children & families</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Veterans</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>LGBTQ+ community</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Trafficking survivors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#A31C41]"></div>
                      <span>Recovery programs</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-4 italic">
                    Distribution partners serve their communities directly, ensuring cultural competence and dignity
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partnership & Collaboration Strength - NOW WITH REAL DATA! */}
        <Card className="mb-8 border-2 border-[#47B3CB] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#47B3CB] to-[#007E8C] text-white">
            <CardTitle className="flex items-center text-xl">
              <Building2 className="w-6 h-6 mr-2" />
              Partnership & Collaboration Network
            </CardTitle>
            <CardDescription className="text-white/90">
              Evidence of community integration and collaboration (LIVE DATA from database)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center p-6 bg-gradient-to-br from-[#47B3CB]/10 to-white rounded-lg border border-[#47B3CB]/30">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-[#47B3CB]" />
                <div className="text-4xl font-black text-[#47B3CB] mb-2">
                  {recipientMetrics.total}
                </div>
                <p className="font-medium text-gray-900">Active Recipient Partners</p>
                <p className="text-sm text-gray-600 mt-2">
                  Organizations in database
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-[#007E8C]/10 to-white rounded-lg border border-[#007E8C]/30">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-[#007E8C]" />
                <div className="text-4xl font-black text-[#007E8C] mb-2">
                  {totalHosts}
                </div>
                <p className="font-medium text-gray-900">Host Locations</p>
                <p className="text-sm text-gray-600 mt-2">
                  Active collection sites
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-br from-[#236383]/10 to-white rounded-lg border border-[#236383]/30">
                <Users className="w-12 h-12 mx-auto mb-3 text-[#236383]" />
                <div className="text-4xl font-black text-[#236383] mb-2">
                  {eventMetrics.uniqueOrganizations}
                </div>
                <p className="font-medium text-gray-900">Event Organizations</p>
                <p className="text-sm text-gray-600 mt-2">
                  Unique organizations with completed events
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Focus Areas Breakdown */}
              <div className="bg-gradient-to-r from-white to-[#E8F4F8] p-5 rounded-lg border border-[#47B3CB]/30">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-[#47B3CB]" />
                  Recipients by Focus Area (Database)
                </h3>
                <div className="space-y-2">
                  {Object.entries(recipientMetrics.byFocusArea)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([area, count]) => (
                      <div key={area} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 capitalize">{area}</span>
                        <Badge className="bg-[#47B3CB]/20 text-[#47B3CB] border-[#47B3CB]/30">
                          {count} orgs
                        </Badge>
                      </div>
                    ))}
                  {Object.keys(recipientMetrics.byFocusArea).length === 0 && (
                    <p className="text-sm text-gray-500 italic">Focus areas being categorized...</p>
                  )}
                </div>
              </div>

              {/* Geographic Distribution */}
              <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                  Recipients by Region (Database)
                </h3>
                <div className="space-y-2">
                  {Object.entries(recipientMetrics.byRegion)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([region, count]) => (
                      <div key={region} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{region}</span>
                        <Badge className="bg-[#FBAD3F]/20 text-[#FBAD3F] border-[#FBAD3F]/30">
                          {count} orgs
                        </Badge>
                      </div>
                    ))}
                  {Object.keys(recipientMetrics.byRegion).length === 0 && (
                    <p className="text-sm text-gray-500 italic">Regional data being collected...</p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#E0F2F1] to-white p-5 rounded-lg border border-[#007E8C]/30">
              <h3 className="font-bold text-gray-900 mb-3">Weekly Distribution Capacity</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-black text-[#007E8C]">
                    {recipientMetrics.totalWeeklyCapacity.toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Estimated weekly sandwich capacity across all {recipientMetrics.total} recipient partners
                  </p>
                </div>
                <BarChart3 className="w-16 h-16 text-[#007E8C]/30" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group Events Impact - REAL DATA */}
        {eventMetrics.totalEvents > 0 && (
          <Card className="mb-8 border-2 border-[#236383] shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
              <CardTitle className="flex items-center text-xl">
                <Users className="w-6 h-6 mr-2" />
                Group Events & Community Engagement
              </CardTitle>
              <CardDescription className="text-white/90">
                Tracked event participation from database {selectedFiscalYear !== 'all' && `(FY ${selectedFiscalYear})`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="text-center p-4 bg-[#E8F4F8] rounded-lg">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-[#236383]" />
                  <div className="text-3xl font-black text-[#236383] mb-1">
                    {eventMetrics.totalEvents}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Completed group events
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tracked in database
                  </p>
                </div>

                <div className="text-center p-4 bg-[#FCE4E6] rounded-lg">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-[#A31C41]" />
                  <div className="text-3xl font-black text-[#A31C41] mb-1">
                    {eventMetrics.uniqueOrganizations}
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    Unique organizations
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Hosted events
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-white to-[#E8F4F8] p-5 rounded-lg border border-[#236383]/30">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Trophy className="w-5 h-5 mr-2 text-[#236383]" />
                    Sandwiches from Group Events
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-black text-[#236383]">
                        {eventMetrics.totalActualSandwiches.toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Sandwiches made at group events
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Avg {eventMetrics.avgSandwichesPerEvent} per event
                      </p>
                    </div>
                    <Award className="w-16 h-16 text-[#236383]/20" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-white to-[#FEF4E0] p-5 rounded-lg border border-[#FBAD3F]/30">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <Star className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                    Social Media Engagement
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-black text-[#FBAD3F]">
                        {eventMetrics.socialMediaPostsCompleted}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Organizations shared posts
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {eventMetrics.totalEvents > 0
                          ? Math.round((eventMetrics.socialMediaPostsCompleted / eventMetrics.totalEvents) * 100)
                          : 0}% engagement rate
                      </p>
                    </div>
                    <Mail className="w-16 h-16 text-[#FBAD3F]/20" />
                  </div>
                </div>
              </div>

              <div className="mt-6 p-5 bg-gradient-to-br from-[#236383]/10 to-white rounded-lg border border-[#236383]/30">
                <h3 className="font-bold text-gray-900 mb-3">Why Group Events Matter</h3>
                <p className="text-sm text-gray-700 mb-3">
                  Group events transform sandwich-making into community building experiences, creating lasting partnerships with:
                </p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Corporations:</strong> Team building events that serve the community</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Faith Communities:</strong> Service projects connecting members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Schools:</strong> Student engagement and civic education</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-[#236383] shrink-0 mt-0.5" />
                    <span><strong>Community Groups:</strong> Volunteer mobilization at scale</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Capacity Building & Organizational Development */}
        <Card className="mb-8 border-2 border-[#FBAD3F] shadow-lg">
          <CardHeader className="bg-gradient-to-r from-[#FBAD3F] to-[#e89a2c] text-white">
            <CardTitle className="flex items-center text-xl">
              <Rocket className="w-6 h-6 mr-2" />
              Capacity Building & Infrastructure Development
            </CardTitle>
            <CardDescription className="text-white/90">
              Strategic investments for sustainable growth
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-[#FEF4E0] to-white p-5 rounded-lg border-l-4 border-[#FBAD3F]">
                <div className="flex items-start gap-4">
                  <UserCheck className="w-8 h-8 text-[#FBAD3F] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Executive Leadership (Achieved)</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Status:</strong> Full-time Executive Director hired September 2025 to manage operations, fundraising, and strategic partnerships
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Impact:</strong> Professional leadership now in place after scaling to 107x our founding capacity — enabling structured growth, grant pursuit, and operational efficiency
                    </p>
                    <Badge className="bg-green-100 text-green-700 border-green-300">
                      Hired Sept 2025
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-white to-[#E0F2F1] p-5 rounded-lg border-l-4 border-[#007E8C]">
                <div className="flex items-start gap-4">
                  <Activity className="w-8 h-8 text-[#007E8C] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Logistics Infrastructure</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Need:</strong> Additional refrigerated van for expanded distribution capacity
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Impact:</strong> Enable simultaneous routes, reduce volunteer burden, improve crisis response time
                    </p>
                    <Badge className="bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30">
                      Est. Cost: $35K-50K (one-time)
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#E8F4F8] to-white p-5 rounded-lg border-l-4 border-[#236383]">
                <div className="flex items-start gap-4">
                  <Shield className="w-8 h-8 text-[#236383] shrink-0 mt-1" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-2">Technology & Systems</h3>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Current:</strong> Custom-built platform for collection tracking, volunteer coordination, and impact reporting
                    </p>
                    <p className="text-sm text-gray-700 mb-2">
                      <strong>Future Need:</strong> Mobile app for real-time volunteer coordination and automated route optimization
                    </p>
                    <Badge className="bg-[#236383]/20 text-[#236383] border-[#236383]/30">
                      Est. Cost: $15K-25K (development)
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-5 bg-gradient-to-br from-[#FBAD3F]/10 to-white rounded-lg border border-[#FBAD3F]/30">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <Target className="w-5 h-5 mr-2 text-[#FBAD3F]" />
                Why These Investments Matter
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                The Sandwich Project has grown 107x since inception while maintaining volunteer-led operations.
                These strategic investments will:
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Sustainability:</strong> Reduce burnout risk and ensure continuity beyond founding volunteers
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Scale:</strong> Current infrastructure at capacity - investments enable 2-3x growth
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-[#FBAD3F] shrink-0 mt-0.5" />
                  <span>
                    <strong>Impact:</strong> Professional leadership unlocks corporate partnerships, larger grants, and strategic expansion
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Impact Statement - Print Summary */}
        <Card className="bg-gradient-to-br from-[#236383] to-[#007E8C] text-white shadow-xl border-0">
          <CardContent className="p-8">
            {/* Lead with Impact + Consistency */}
            <div className="text-center mb-6">
              <div className="text-5xl font-black text-[#fbad3f] mb-2">
                {metrics.totalSandwiches.toLocaleString()}
              </div>
              <h2 className="text-2xl font-bold">
                sandwiches delivered over 291 consecutive weeks
              </h2>
              <p className="text-white/80 mt-1">Every single week since April 2020. No exceptions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
              <div className="text-center">
                <div className="text-4xl font-black mb-2">10,000+</div>
                <p className="text-white/90 font-medium">Weekly baseline (up from 1,000)</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-2">35</div>
                <p className="text-white/90 font-medium">Collection sites</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-2">4,000+</div>
                <p className="text-white/90 font-medium">Volunteers</p>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black mb-2">70+</div>
                <p className="text-white/90 font-medium">Partner orgs served weekly</p>
              </div>
            </div>
            <div className="mt-8 p-6 bg-white/10 rounded-lg backdrop-blur-sm space-y-4">
              <p className="text-lg leading-relaxed">
                Our journey began in mid-2020, when the COVID-19 pandemic profoundly impacted countless lives.
                Even as the urgency of COVID has eased, housing costs, inflation, and systemic inequities
                force many families into impossible choices between food and other basic needs.
              </p>
              <p className="text-lg leading-relaxed">
                Through a network of dedicated volunteers, we create and deliver fresh, homemade sandwiches
                to individuals in need. We believe in the transformative power of community, compassion, and kindness —
                and in the fundamental right of every person to access nourishing food.
              </p>
              <p className="text-lg leading-relaxed font-semibold">
                Fighting food insecurity. Fostering a spirit of service. Building a stronger community.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="collections"
        title="Grant Metrics Assistant"
        subtitle="Ask about impact metrics and data"
        contextData={{
          currentView: 'grant-metrics',
          filters: {
            yearType,
            selectedYear: selectedFiscalYear,
            selectedQuarter,
          },
          summaryStats: {
            totalCollections: collections.length,
            totalSandwiches: stats?.totalSandwiches || 0,
            activeHosts: stats?.totalHosts || 0,
            uniqueGroups: stats?.uniqueGroups || 0,
          },
        }}
        getFullContext={() => ({
          rawData: collections.map((c: any) => ({
            id: c.id,
            hostName: c.hostName,
            collectionDate: c.collectionDate,
            individualSandwiches: c.individualSandwiches,
            group1Name: c.group1Name,
            group1Count: c.group1Count,
            group2Name: c.group2Name,
            group2Count: c.group2Count,
            groupCollections: c.groupCollections,
            totalSandwiches: calculateTotalSandwiches(c),
          })),
        })}
        suggestedQuestions={[
          "What are our key impact metrics?",
          "Show me year-over-year growth",
          "How many sandwiches this fiscal year?",
          "What's our total sandwich count?",
          "How many active hosts do we have?",
          "What metrics can I use for grants?",
        ]}
      />
    </div>
  );
}