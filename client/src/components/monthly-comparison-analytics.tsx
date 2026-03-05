import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  MapPin,
  Clock,
  Target,
  Lightbulb,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Info,
} from 'lucide-react';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateGroupSandwiches,
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

interface MonthlyStats {
  month: string;
  year: number;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
  avgPerCollection: number;
  hostParticipation: Record<string, number>;
  weeklyDistribution: number[];
  individualCount: number;
  groupCount: number;
  groupEventCount: number;
  daysWithCollections: number;
}

export default function MonthlyComparisonAnalytics() {
  // Define months array at the top to avoid initialization errors
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const [compareYear, setCompareYear] = useState<number>(2025);

  // Default to current month and year - will be updated when data loads
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Fetch all collections data
  const { data: collectionsData, isLoading } = useQuery<{
    collections: SandwichCollection[];
  }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  const { data: hostsData } = useQuery({
    queryKey: ['/api/hosts'],
    queryFn: async () => {
      const response = await fetch('/api/hosts');
      if (!response.ok) throw new Error('Failed to fetch hosts');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Helper function to identify holidays in a given month/year
  const getHolidaysForMonth = (month: number, year: number) => {
    const holidays: Array<{
      name: string;
      type: 'federal' | 'jewish' | 'seasonal';
      description: string;
      impact: 'high' | 'medium' | 'low';
      color: string;
    }> = [];

    // Federal holidays by month (0-indexed)
    const federalHolidays: Record<number, Array<{name: string; description: string}>> = {
      0: [{ name: 'New Year\'s Day', description: 'Federal holiday affecting volunteering schedules' }],
      1: [{ name: 'Presidents\' Day', description: 'Federal holiday, potential impact on collections' }],
      4: [{ name: 'Memorial Day', description: 'Federal holiday marking start of summer season' }],
      6: [{ name: 'Independence Day', description: 'Major federal holiday with significant impact' }],
      8: [{ name: 'Labor Day', description: 'Federal holiday marking end of summer' }],
      10: [{ name: 'Thanksgiving', description: 'Major federal holiday with high impact on volunteering' }],
      11: [{ name: 'Christmas', description: 'Major federal holiday with extended impact period' }],
    };

    // Jewish holidays - approximate by year (these shift based on Hebrew calendar)
    // For accuracy, would need a proper Hebrew calendar library, but providing common patterns
    const jewishHolidays2024: Record<number, Array<{name: string; description: string}>> = {
      8: [
        { name: 'Rosh Hashanah', description: 'Jewish New Year - two-day observance, high community impact' },
        { name: 'Yom Kippur', description: 'Day of Atonement - most solemn Jewish holiday, highest impact' }
      ],
      9: [{ name: 'Sukkot', description: 'Feast of Tabernacles - week-long holiday period' }],
      11: [{ name: 'Hanukkah', description: 'Eight-day Festival of Lights' }],
    };

    const jewishHolidays2025: Record<number, Array<{name: string; description: string}>> = {
      8: [
        { name: 'Rosh Hashanah', description: 'Jewish New Year - two-day observance, high community impact' },
        { name: 'Yom Kippur', description: 'Day of Atonement - most solemn Jewish holiday, highest impact' }
      ],
      9: [{ name: 'Sukkot', description: 'Feast of Tabernacles - week-long holiday period' }],
      3: [{ name: 'Passover', description: 'Eight-day festival with significant community observance' }],
      11: [{ name: 'Hanukkah', description: 'Eight-day Festival of Lights' }],
    };

    const jewishHolidays2026: Record<number, Array<{name: string; description: string}>> = {
      8: [
        { name: 'Rosh Hashanah', description: 'Jewish New Year (Sep 11-13) - two-day observance, high community impact' },
        { name: 'Yom Kippur', description: 'Day of Atonement (Sep 20-21) - most solemn Jewish holiday, highest impact' }
      ],
      9: [{ name: 'Sukkot', description: 'Feast of Tabernacles (Sep 25 - Oct 2) - week-long holiday period' }],
      3: [{ name: 'Passover', description: 'Eight-day festival (Apr 1-9) with significant community observance' }],
      11: [{ name: 'Hanukkah', description: 'Eight-day Festival of Lights (Dec 4-12)' }],
    };

    const jewishHolidaysByYearMap: Record<number, Record<number, Array<{name: string; description: string}>>> = {
      2024: jewishHolidays2024,
      2025: jewishHolidays2025,
      2026: jewishHolidays2026,
    };

    // Add federal holidays
    if (federalHolidays[month]) {
      federalHolidays[month].forEach(holiday => {
        holidays.push({
          name: holiday.name,
          type: 'federal',
          description: holiday.description,
          impact: [10, 11].includes(month) ? 'high' : 'medium',
          color: 'amber',
        });
      });
    }

    // Add Jewish holidays (fall back to most recent year's data for future years)
    const jewishHolidaysByYear = jewishHolidaysByYearMap[year] || jewishHolidaysByYearMap[2026];
    if (jewishHolidaysByYear[month]) {
      jewishHolidaysByYear[month].forEach(holiday => {
        holidays.push({
          name: holiday.name,
          type: 'jewish',
          description: holiday.description,
          impact: holiday.name.includes('Yom Kippur') || holiday.name.includes('Rosh Hashanah') ? 'high' : 'medium',
          color: 'purple',
        });
      });
    }

    // Seasonal factors
    if ([5, 6, 7].includes(month)) {
      holidays.push({
        name: 'Summer Vacation Period',
        type: 'seasonal',
        description: 'Reduced volunteering due to summer vacations and travel',
        impact: 'medium',
        color: 'blue',
      });
    }
    if (month === 7) {
      holidays.push({
        name: 'Back-to-School Prep',
        type: 'seasonal',
        description: 'Late summer sees reduced volunteering as families prepare for school year',
        impact: 'low',
        color: 'indigo',
      });
    }

    return holidays;
  };

  // Process data for analytics
  const monthlyAnalytics = useMemo(() => {
    if (!collections?.length) return null;

    const monthlyStats: Record<string, MonthlyStats> = {};

    collections.forEach((collection) => {
      if (!collection.collectionDate) return;

      const date = parseCollectionDate(collection.collectionDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const year = date.getFullYear();
      const month = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month,
          year,
          totalSandwiches: 0,
          totalCollections: 0,
          uniqueHosts: 0,
          avgPerCollection: 0,
          hostParticipation: {},
          weeklyDistribution: [0, 0, 0, 0], // Week 1, 2, 3, 4+
          individualCount: 0,
          groupCount: 0,
          groupEventCount: 0,
          daysWithCollections: 0,
        };
      }

      const stats = monthlyStats[monthKey];

      // Calculate sandwich totals using standardized calculation
      const individualSandwiches = collection.individualSandwiches || 0;
      const groupSandwiches = calculateGroupSandwiches(collection);
      const totalSandwiches = calculateTotalSandwiches(collection);

      stats.totalSandwiches += totalSandwiches;
      stats.individualCount += individualSandwiches;
      stats.groupCount += groupSandwiches;
      stats.totalCollections += 1;

      // Track group event count - increment when collection has group participants
      if (groupSandwiches > 0) {
        stats.groupEventCount += 1;
      }

      // Track host participation
      const hostName = collection.hostName || 'Unknown';
      stats.hostParticipation[hostName] =
        (stats.hostParticipation[hostName] || 0) + totalSandwiches;

      // Weekly distribution within month
      const dayOfMonth = date.getDate();
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
      stats.weeklyDistribution[weekIndex] += totalSandwiches;
    });

    // Calculate derived metrics
    Object.values(monthlyStats).forEach((stats) => {
      stats.uniqueHosts = Object.keys(stats.hostParticipation).length;
      stats.avgPerCollection =
        stats.totalCollections > 0
          ? Math.round(stats.totalSandwiches / stats.totalCollections)
          : 0;
      stats.daysWithCollections = stats.totalCollections; // Approximation
    });

    return monthlyStats;
  }, [collections]);

  // Auto-select the most recent month with data when analytics load
  useMemo(() => {
    if (monthlyAnalytics && Object.keys(monthlyAnalytics).length > 0) {
      const availableMonths = Object.keys(monthlyAnalytics).sort();
      const mostRecentMonth = availableMonths[availableMonths.length - 1];
      
      if (mostRecentMonth) {
        const [year, month] = mostRecentMonth.split('-');
        const monthIndex = parseInt(month) - 1; // Convert to 0-based index
        const yearNum = parseInt(year);
        
        // Only update if current selection has no data
        const currentMonthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        if (!monthlyAnalytics[currentMonthKey]) {
          setSelectedYear(yearNum);
          setSelectedMonth(monthIndex);
        }
      }
    }
  }, [monthlyAnalytics, selectedYear, selectedMonth]);

  // Selected month analysis
  const selectedMonthAnalysis = useMemo(() => {
    if (!monthlyAnalytics) return null;

    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const selectedMonthData = monthlyAnalytics[monthKey];
    if (!selectedMonthData) return null;

    // Individual vs Group split for selected month (from already-computed monthly data)
    const individualSandwiches = selectedMonthData.individualCount;
    const groupSandwiches = selectedMonthData.groupCount;

    // Year-over-year comparison (same month last year)
    const prevYearMonthKey = `${selectedYear - 1}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const prevYearMonth = monthlyAnalytics[prevYearMonthKey];

    // Month-over-month comparison (previous month)
    const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevMonthYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    const prevMonthKey = `${prevMonthYear}-${String(prevMonth + 1).padStart(2, '0')}`;
    const previousMonth = monthlyAnalytics[prevMonthKey];

    // Check if we're in a partial month (current month and not yet complete)
    const today = new Date();
    const isCurrentMonth = selectedYear === today.getFullYear() && selectedMonth === today.getMonth();
    const dayOfMonth = today.getDate();
    const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const monthProgressRatio = isCurrentMonth ? dayOfMonth / daysInSelectedMonth : 1;

    // Calculate projected totals for current month if it's incomplete
    const projectedSelectedMonthTotal = isCurrentMonth
      ? Math.round(selectedMonthData.totalSandwiches / monthProgressRatio)
      : selectedMonthData.totalSandwiches;

    // For partial months, calculate SAME PERIOD last year (not full month)
    // This compares Jan 1-25, 2026 to Jan 1-25, 2025 (same day cutoff)
    let prevYearSamePeriodTotal = 0;
    if (isCurrentMonth && prevYearMonth) {
      // Filter previous year's collections to only include those through the same day
      collections.forEach((collection: any) => {
        if (!collection.collectionDate) return;
        const date = parseCollectionDate(collection.collectionDate);
        if (Number.isNaN(date.getTime())) return;
        
        // Check if this is in the same month last year AND within the same day range
        if (date.getFullYear() === selectedYear - 1 && 
            date.getMonth() === selectedMonth && 
            date.getDate() <= dayOfMonth) {
          prevYearSamePeriodTotal += calculateTotalSandwiches(collection);
        }
      });
    } else if (prevYearMonth) {
      // For complete months, use the full month total
      prevYearSamePeriodTotal = prevYearMonth.totalSandwiches;
    }

    // Calculate YoY using same-period comparison for partial months
    // This ensures we compare apples-to-apples: Jan 1-25 this year vs Jan 1-25 last year
    const yearOverYearChange = prevYearSamePeriodTotal > 0
      ? selectedMonthData.totalSandwiches - prevYearSamePeriodTotal
      : null;
    const yearOverYearPercent = prevYearSamePeriodTotal > 0
      ? ((selectedMonthData.totalSandwiches - prevYearSamePeriodTotal) /
          prevYearSamePeriodTotal) * 100
      : null;

    const monthOverMonthChange = previousMonth
      ? projectedSelectedMonthTotal - previousMonth.totalSandwiches
      : null;
    const monthOverMonthPercent = previousMonth
      ? ((projectedSelectedMonthTotal - previousMonth.totalSandwiches) /
          previousMonth.totalSandwiches) * 100
      : null;

    // Always prefer year-over-year comparison (same month last year)
    // MoM is only a fallback when no prior year data exists
    let useMoMComparison = false;
    let comparisonChange = yearOverYearChange;
    let comparisonPercent = yearOverYearPercent;
    let comparisonBase = prevYearMonth;
    let comparisonLabel = prevYearMonth
      ? (isCurrentMonth
          ? `${months[selectedMonth].substring(0, 3)} 1-${dayOfMonth}, ${selectedYear - 1}`
          : `${months[selectedMonth]} ${selectedYear - 1}`)
      : null;

    if (yearOverYearPercent === null && monthOverMonthPercent !== null) {
      // Only fall back to month-over-month when no year-over-year data exists
      useMoMComparison = true;
      comparisonChange = monthOverMonthChange;
      comparisonPercent = monthOverMonthPercent;
      comparisonBase = previousMonth;
      comparisonLabel = `${months[prevMonth]} ${prevMonthYear}`;
    }

    // Calculate rolling 3-month average (including selected month and 2 previous months)
    const last3MonthsData = Object.entries(monthlyAnalytics)
      .filter(([key, m]) => {
        const [year, month] = key.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        const selectedDate = new Date(selectedYear, selectedMonth);
        const threeMonthsBefore = new Date(selectedYear, selectedMonth - 2);
        return monthDate >= threeMonthsBefore && monthDate <= selectedDate;
      })
      .map(([_, m]) => m);

    const rolling3MonthAvg = last3MonthsData.length > 0
      ? Math.round(
          last3MonthsData.reduce((sum, m) => sum + m.totalSandwiches, 0) /
          last3MonthsData.length
        )
      : null;

    // Calculate average of last 6 months before selected month for reference
    const recentMonths = Object.entries(monthlyAnalytics)
      .filter(([key, m]) => {
        const [year, month] = key.split('-').map(Number);
        const monthDate = new Date(year, month - 1);
        const selectedDate = new Date(selectedYear, selectedMonth);
        const sixMonthsBefore = new Date(selectedYear, selectedMonth - 6);
        return monthDate >= sixMonthsBefore && monthDate < selectedDate;
      })
      .map(([_, m]) => m);

    const avgRecentMonth = recentMonths.length > 0
      ? recentMonths.reduce((sum, m) => sum + m.totalSandwiches, 0) / recentMonths.length
      : comparisonBase?.totalSandwiches || 0;

    // Calculate top months across all available data
    const topMonths = Object.entries(monthlyAnalytics)
      .map(([key, month]) => ({
        month: key,
        totalSandwiches: month.totalSandwiches,
      }))
      .sort((a, b) => b.totalSandwiches - a.totalSandwiches);

    return {
      selectedMonthData,
      prevYearMonth,
      previousMonth,
      recentMonths,
      avgRecentMonth,
      rolling3MonthAvg,
      topMonths,
      // Primary comparison (the less drastic one)
      comparisonType: useMoMComparison ? 'month-over-month' : 'year-over-year',
      comparisonLabel,
      comparisonChange,
      comparisonPercent,
      comparisonBase,
      // Also keep individual comparisons for reference
      yearOverYearChange,
      yearOverYearPercent,
      monthOverMonthChange,
      monthOverMonthPercent,
      shortfall: avgRecentMonth - projectedSelectedMonthTotal,
      shortfallPercent:
        avgRecentMonth > 0 ? ((avgRecentMonth - projectedSelectedMonthTotal) / avgRecentMonth) * 100 : 0,
      // Individual vs Group split
      individualSandwiches,
      groupSandwiches,
      // Partial month indicators
      isCurrentMonth,
      monthProgressRatio,
      projectedTotal: projectedSelectedMonthTotal,
      projectedSelectedMonthTotal,
      // Same-period comparison data (for partial months)
      prevYearSamePeriodTotal: isCurrentMonth ? prevYearSamePeriodTotal : (prevYearMonth?.totalSandwiches || 0),
    };
  }, [monthlyAnalytics, selectedMonth, selectedYear]);

  // Monthly trends chart data
  const monthlyTrends = useMemo(() => {
    if (!monthlyAnalytics) return [];

    return Object.entries(monthlyAnalytics)
      .filter(([key, m]) => m.year >= 2024)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB)) // Sort by YYYY-MM format
      .map(([key, m]) => {
        // Extract month name from full month string
        const monthName = m.month.split(' ')[0].substring(0, 3);
        return {
          month: monthName,
          year: m.year,
          sandwiches: m.totalSandwiches,
          collections: m.totalCollections,
          hosts: m.uniqueHosts,
          avgPerCollection: m.avgPerCollection,
        };
      });
  }, [monthlyAnalytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
          <p className="text-[#646464] text-lg">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!selectedMonthAnalysis) {
    const availableMonths = monthlyAnalytics ? Object.keys(monthlyAnalytics).sort() : [];
    const mostRecentMonth = availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : null;
    
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-brand-primary mb-2">
          No Data for Selected Month
        </h3>
        <p className="text-[#646464] mb-4">
          Unable to find collection data for {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </p>
        {mostRecentMonth && (
          <div className="bg-brand-primary-lighter border border-brand-primary-border rounded-lg p-4 max-w-md mx-auto">
            <p className="text-sm text-brand-primary-dark mb-2">
              <strong>Available data:</strong> We have collection data available for other months.
            </p>
            <p className="text-xs text-brand-primary-muted">
              Most recent data: {new Date(parseInt(mostRecentMonth.split('-')[0]), parseInt(mostRecentMonth.split('-')[1]) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
        <p className="text-sm text-gray-500 mt-4">
          Use the month/year selectors above to choose a month with available data.
        </p>
      </div>
    );
  }

  const selectedMonthName = new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const colors = [
    '#236383',
    '#FBAD3F',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
  ];

  // Generate year options
  const availableYears = Array.from(new Set(Object.keys(monthlyAnalytics || {}).map(key => parseInt(key.split('-')[0])))).sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Header with Impact Metrics */}
      <div className="bg-gradient-to-r from-brand-primary/10 to-brand-orange/10 p-6 rounded-lg border border-brand-primary/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-brand-primary mb-2">
              {selectedMonthName} Impact Report
            </h2>
            <p className="text-[#646464]">
              Community impact and collection metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-brand-primary/30 rounded-lg bg-white text-brand-primary font-medium"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-brand-primary/30 rounded-lg bg-white text-brand-primary font-medium"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Partial Month Banner */}
        {selectedMonthAnalysis.isCurrentMonth && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Viewing an incomplete month — {Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of {selectedMonthName} recorded so far
              </p>
              <p className="text-xs text-blue-600 mt-0.5">
                Totals shown are actuals to date. Comparisons use projected full-month estimates based on current pace.
              </p>
            </div>
          </div>
        )}

        {/* Primary Impact Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg border border-green-200 border-l-4 min-w-0 overflow-hidden">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">People Fed{selectedMonthAnalysis.isCurrentMonth ? ' (so far)' : ''}</div>
            <div className="text-2xl md:text-3xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()}
            </div>
            <p className="text-gray-500 mt-1 text-xs sm:text-sm truncate">
              {selectedMonthAnalysis.isCurrentMonth
                ? `On pace for ~${selectedMonthAnalysis.projectedTotal.toLocaleString()}`
                : 'Sandwiches collected'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-brand-primary-border border-l-4 min-w-0 overflow-hidden">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3 truncate">Individual vs Group Split{selectedMonthAnalysis.isCurrentMonth ? ' (to date)' : ''}</div>

            <div className="space-y-3">
              {/* Individual Row */}
              <div className="flex items-center justify-between bg-[#FBAD3F]/10 rounded-lg p-3 min-w-0 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-shrink">
                  <div className="w-3 h-3 bg-[#FBAD3F] rounded-full flex-shrink-0"></div>
                  <span className="text-sm font-medium text-gray-700 truncate">Individual</span>
                </div>
                <div className="text-lg md:text-xl font-bold text-brand-primary whitespace-nowrap flex-shrink-0 ml-2">
                  {selectedMonthAnalysis.individualSandwiches.toLocaleString()}
                </div>
              </div>

              {/* Group Row */}
              <div className="flex items-center justify-between bg-brand-primary-lighter rounded-lg p-3 min-w-0 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-shrink">
                  <div className="w-3 h-3 bg-[#236383] rounded-full flex-shrink-0"></div>
                  <span className="text-sm font-medium text-gray-700 truncate">Group Events</span>
                </div>
                <div className="text-lg md:text-xl font-bold text-brand-primary whitespace-nowrap flex-shrink-0 ml-2">
                  {selectedMonthAnalysis.groupSandwiches.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 min-w-0 overflow-hidden">
              <div className="text-center min-w-0">
                <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Total</div>
                <div className="text-base md:text-lg font-semibold text-gray-800 break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                  {(selectedMonthAnalysis.individualSandwiches + selectedMonthAnalysis.groupSandwiches).toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 truncate mt-1">Total sandwiches</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-purple-200 border-l-4 min-w-0 overflow-hidden">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">Collection Sites</div>
            <div className="text-2xl md:text-3xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              38
            </div>
            <p className="text-gray-500 mt-1 text-xs sm:text-sm truncate">{selectedMonthAnalysis.selectedMonthData.totalCollections} collections{selectedMonthAnalysis.isCurrentMonth ? ' so far' : ''} this month</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-orange-200 border-l-4 min-w-0 overflow-hidden">
            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">Avg per Collection</div>
            <div className="text-2xl md:text-3xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
              {selectedMonthAnalysis.selectedMonthData.avgPerCollection}
            </div>
            <p className="text-gray-500 mt-1 text-xs sm:text-sm truncate">Efficiency metric</p>
          </div>

          {selectedMonthAnalysis.rolling3MonthAvg && (
            <div className="bg-white p-4 rounded-lg border border-indigo-200 border-l-4 min-w-0 overflow-hidden">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">3-Month Trend</div>
              <div className="text-2xl md:text-3xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {selectedMonthAnalysis.rolling3MonthAvg.toLocaleString()}
              </div>
              <p className="text-gray-500 mt-1 text-xs sm:text-sm truncate">Rolling average</p>
            </div>
          )}
        </div>

        {/* Context Card */}
        <div className="bg-white/50 p-4 rounded-lg border border-gray-200 min-w-0 overflow-hidden">
          <div className="flex items-start gap-3 min-w-0">
            <Activity className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-gray-700 text-sm sm:text-base break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <span className="font-medium">Change from {selectedMonthAnalysis.comparisonLabel}:</span>
                {' '}
                {selectedMonthAnalysis.comparisonChange !== null ? (
                  <>
                    {Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} sandwiches
                    {' '}
                    <span className="text-gray-500">
                      ({selectedMonthAnalysis.comparisonChange > 0 ? '+' : ''}{selectedMonthAnalysis.comparisonPercent?.toFixed(1)}%)
                    </span>
                    {selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'year-over-year' && (
                      <span className="text-xs text-blue-600 ml-2">
                        • Same period YoY ({Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month)
                      </span>
                    )}
                    {selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'month-over-month' && (
                      <span className="text-xs text-blue-600 ml-2">
                        • Projected based on {Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month complete
                      </span>
                    )}
                  </>
                ) : (
                  'No comparison data available'
                )}
                {(() => {
                  const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                  if (holidays.length > 0) {
                    return (
                      <span className="text-gray-500">
                        {' '}• {holidays.length} holiday factor{holidays.length > 1 ? 's' : ''} this month may affect patterns
                      </span>
                    );
                  }
                  return null;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Analytics Sections - Flattened from tabs */}
      <div className="space-y-6">
        {/* Overview Section */}
        <div className="space-y-6">
          {/* Monthly Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Performance Trends
              </CardTitle>
              <CardDescription>
                {selectedMonthName} performance compared to recent months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyTrends}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#236383"
                      opacity={0.2}
                    />
                    <XAxis dataKey="month" stroke="#236383" fontSize={12} />
                    <YAxis
                      stroke="#236383"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        typeof value === 'number'
                          ? value.toLocaleString()
                          : value,
                        name === 'sandwiches'
                          ? 'Sandwiches'
                          : name === 'collections'
                            ? 'Collections'
                            : 'Hosts',
                      ]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${label} ${item.year}` : label;
                      }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #236383',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar
                      dataKey="sandwiches"
                      fill="#236383"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="collections"
                      stroke="#FBAD3F"
                      strokeWidth={3}
                      dot={{ fill: '#FBAD3F', strokeWidth: 2, r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm text-[#646464]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand-primary rounded"></div>
                    <span>Total Sandwiches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-brand-orange rounded"></div>
                    <span>Collections Count</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month Performance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {selectedMonthName} Performance Breakdown
              </CardTitle>
              <CardDescription>
                Collection types and participation metrics{selectedMonthAnalysis.isCurrentMonth ? ` — ${Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month complete` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-brand-primary-lighter rounded-lg border border-brand-primary-border min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">Total Sandwiches{selectedMonthAnalysis.isCurrentMonth ? ' (to date)' : ''}</div>
                  <div className="text-xl md:text-2xl font-bold text-brand-primary-darker break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()}
                  </div>
                  <div className="text-brand-primary-muted mt-1 text-sm sm:text-base truncate">
                    From {selectedMonthAnalysis.selectedMonthData.totalCollections} collections
                    {selectedMonthAnalysis.isCurrentMonth && ` (${Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month)`}
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200 min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">Individual Collections{selectedMonthAnalysis.isCurrentMonth ? ' (to date)' : ''}</div>
                  <div className="text-xl md:text-2xl font-bold text-green-900 break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {selectedMonthAnalysis.selectedMonthData.individualCount.toLocaleString()}
                  </div>
                  <div className="text-green-600 mt-1 text-sm sm:text-base truncate">
                    {selectedMonthAnalysis.selectedMonthData.totalSandwiches > 0
                      ? ((selectedMonthAnalysis.selectedMonthData.individualCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)
                      : '0.0'}% of total
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 min-w-0 overflow-hidden">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">Group Events{selectedMonthAnalysis.isCurrentMonth ? ' (to date)' : ''}</div>
                  <div className="text-xl md:text-2xl font-bold text-purple-900 break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    {selectedMonthAnalysis.selectedMonthData.groupCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-purple-600 mt-1 truncate">
                    {selectedMonthAnalysis.selectedMonthData.groupEventCount} events ({selectedMonthAnalysis.selectedMonthData.totalSandwiches > 0
                      ? ((selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)
                      : '0.0'}% of total)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Insights Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-6 w-6 text-brand-primary" />
            <h3 className="text-2xl font-bold text-brand-primary">Monthly Insights</h3>
          </div>
          {/* Monthly Trends Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Year-over-Year Comparison
              </CardTitle>
              <CardDescription>
                Comparing {selectedMonthName} {selectedYear} to {selectedMonthName} {selectedYear - 1}{selectedMonthAnalysis?.isCurrentMonth ? ' (same period)' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Primary Comparison
                    <Badge className="ml-2 text-xs">
                      {selectedMonthAnalysis.comparisonType === 'month-over-month' ? 'Month-over-Month' : 'Year-over-Year'}
                    </Badge>
                  </h4>
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="text-6xl font-bold text-brand-primary">
                        {selectedMonthAnalysis.comparisonPercent !== null
                          ? (selectedMonthAnalysis.comparisonPercent > 0 ? '+' : '') +
                            selectedMonthAnalysis.comparisonPercent.toFixed(1) + '%'
                          : 'N/A'}
                      </div>
                      <div className="text-lg text-gray-600">
                        {selectedMonthAnalysis.comparisonChange !== null
                          ? (selectedMonthAnalysis.comparisonChange > 0 ? '+' : '') +
                            selectedMonthAnalysis.comparisonChange.toLocaleString() + ' sandwiches'
                          : 'No comparison data'}
                      </div>
                      <div className="text-sm text-gray-500">
                        vs {selectedMonthAnalysis.comparisonLabel}
                        {selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'year-over-year' && (
                          <div className="text-xs text-blue-600 mt-1">
                            Same period comparison ({Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month)
                          </div>
                        )}
                        {selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'month-over-month' && (
                          <div className="text-xs text-blue-600 mt-1">
                            Projected ({Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% complete)
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Performance Analysis
                  </h4>
                  <div className="space-y-4">
                    {/* Primary comparison */}
                    {selectedMonthAnalysis.comparisonPercent !== null ? (
                      <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                          {selectedMonthAnalysis.comparisonChange! >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-gray-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-gray-600" />
                          )}
                          <span className="font-medium text-gray-800">
                            {selectedMonthAnalysis.comparisonType === 'month-over-month' ? 'Month-over-Month' : 'Year-over-Year'} Trend
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'month-over-month'
                            ? `At current pace, ${selectedMonthName} is projected to show a ${Math.abs(selectedMonthAnalysis.comparisonPercent).toFixed(1)}% ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'increase' : 'change'} compared to ${selectedMonthAnalysis.comparisonLabel}. That would be ${Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()} ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'more' : 'fewer'} sandwiches.`
                            : selectedMonthAnalysis.isCurrentMonth && selectedMonthAnalysis.comparisonType === 'year-over-year'
                              ? `Through ${months[selectedMonth].substring(0, 3)} ${new Date().getDate()}, ${selectedMonthName} shows a ${Math.abs(selectedMonthAnalysis.comparisonPercent).toFixed(1)}% ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'increase' : 'change'} compared to the same period in ${selectedMonthAnalysis.comparisonLabel}. That's ${Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()} ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'more' : 'fewer'} sandwiches.`
                              : `${selectedMonthName} shows a ${Math.abs(selectedMonthAnalysis.comparisonPercent).toFixed(1)}% ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'increase' : 'change'} compared to ${selectedMonthAnalysis.comparisonLabel}. This represents ${Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()} ${selectedMonthAnalysis.comparisonChange! >= 0 ? 'more' : 'fewer'} sandwiches.`}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-4 w-4 text-gray-600" />
                          <span className="font-medium text-gray-800">No Comparison Data</span>
                        </div>
                        <p className="text-sm text-gray-700">
                          No comparison data available for this month.
                        </p>
                      </div>
                    )}

                    {/* Alternative comparison info */}
                    {selectedMonthAnalysis.comparisonType === 'month-over-month' && selectedMonthAnalysis.yearOverYearPercent !== null && (
                      <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-3 w-3 text-brand-primary-muted" />
                          <span className="text-xs font-medium text-brand-primary-dark">
                            Alternative: Year-over-Year {selectedMonthAnalysis.isCurrentMonth && '(same period)'}
                          </span>
                        </div>
                        <p className="text-xs text-brand-primary">
                          vs {selectedMonthAnalysis.isCurrentMonth 
                            ? `${months[selectedMonth].substring(0, 3)} 1-${new Date().getDate()}, ${selectedYear - 1}` 
                            : `${months[selectedMonth]} ${selectedYear - 1}`}: {selectedMonthAnalysis.yearOverYearPercent > 0 ? '+' : ''}{selectedMonthAnalysis.yearOverYearPercent.toFixed(1)}%
                          ({Math.abs(selectedMonthAnalysis.yearOverYearChange!).toLocaleString()} sandwiches)
                        </p>
                      </div>
                    )}
                    {selectedMonthAnalysis.comparisonType === 'year-over-year' && selectedMonthAnalysis.monthOverMonthPercent !== null && (
                      <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity className="h-3 w-3 text-brand-primary-muted" />
                          <span className="text-xs font-medium text-brand-primary-dark">
                            Also: Month-over-Month{selectedMonthAnalysis.isCurrentMonth ? ' (projected)' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-brand-primary">
                          vs {months[selectedMonth === 0 ? 11 : selectedMonth - 1]} {selectedMonth === 0 ? selectedYear - 1 : selectedYear}: {selectedMonthAnalysis.monthOverMonthPercent > 0 ? '+' : ''}{selectedMonthAnalysis.monthOverMonthPercent.toFixed(1)}%
                          ({Math.abs(selectedMonthAnalysis.monthOverMonthChange!).toLocaleString()} sandwiches)
                        </p>
                      </div>
                    )}

                    <div className="text-center p-3 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-brand-primary">
                        {((selectedMonthAnalysis.selectedMonthData.groupEventCount / selectedMonthAnalysis.selectedMonthData.totalCollections) * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-gray-600">Events w/ Groups</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Holiday Impact Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Holiday Impact Analysis - {selectedMonthName}
              </CardTitle>
              <CardDescription>
                Analysis of how holidays and special events affected collection patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Identified Holidays & Events
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                      if (holidays.length === 0) {
                        return (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-gray-800">No Major Holidays</span>
                                <p className="text-sm text-gray-700 mt-1">
                                  {selectedMonthName} had no major holidays that typically impact collection schedules.
                                </p>
                              </div>
                              <Badge variant="outline" className="border-gray-300 text-gray-700">
                                Clear
                              </Badge>
                            </div>
                          </div>
                        );
                      }
                      return holidays.map((holiday, index) => (
                        <div
                          key={index}
                          className={`p-3 bg-${holiday.color}-50 border border-${holiday.color}-200 rounded-lg`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className={`font-medium text-${holiday.color}-800`}>{holiday.name}</span>
                              <p className={`text-sm text-${holiday.color}-700 mt-1`}>
                                {holiday.description}
                              </p>
                            </div>
                            <Badge variant="outline" className={`border-${holiday.color}-300 text-${holiday.color}-700`}>
                              {holiday.type === 'federal' ? 'Federal' : holiday.type === 'jewish' ? 'Jewish' : 'Seasonal'}
                            </Badge>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Impact Assessment
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                      const highImpactCount = holidays.filter(h => h.impact === 'high').length;
                      const mediumImpactCount = holidays.filter(h => h.impact === 'medium').length;
                      const jewishHolidayCount = holidays.filter(h => h.type === 'jewish').length;

                      return (
                        <>
                          <div className="text-center p-3 bg-gray-50 rounded min-w-0 overflow-hidden">
                            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Holiday Factors</div>
                            <div className="text-xl md:text-2xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                              {highImpactCount + mediumImpactCount}
                            </div>
                            <p className="text-sm text-gray-600 truncate mt-1">Identified</p>
                          </div>

                          {jewishHolidayCount > 0 && (
                            <div className="text-center p-3 bg-purple-50 border border-purple-200 rounded min-w-0 overflow-hidden">
                              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Jewish Holidays</div>
                              <div className="text-base md:text-lg font-bold text-purple-700 break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                {jewishHolidayCount}
                              </div>
                              <p className="text-xs text-purple-600 truncate mt-1">Significant community impact</p>
                            </div>
                          )}

                          <div className="text-center p-3 bg-gray-50 rounded min-w-0 overflow-hidden">
                            <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Lowest Week</div>
                            <div className="text-xl md:text-2xl font-bold text-brand-primary break-words overflow-hidden leading-tight" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                              {selectedMonthAnalysis.selectedMonthData.weeklyDistribution.reduce((min, current, index) =>
                                selectedMonthAnalysis.selectedMonthData.weeklyDistribution[min] > current ? index : min, 0) + 1}
                            </div>
                            <p className="text-sm text-gray-600 truncate mt-1">Performing week</p>
                          </div>

                          {highImpactCount > 0 && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-center">
                              <p className="text-xs text-amber-700">
                                ⚠️ {highImpactCount} high-impact holiday{highImpactCount > 1 ? 's' : ''} this month
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Group Events Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Group vs Individual Collections Analysis
              </CardTitle>
              <CardDescription>
                Breakdown of group events vs individual collections for {selectedMonthName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Collection Type Distribution
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: 'Group Events',
                              value: selectedMonthAnalysis.selectedMonthData.groupCount,
                              color: '#236383'
                            },
                            {
                              name: 'Individual Collections',
                              value: selectedMonthAnalysis.selectedMonthData.individualCount,
                              color: '#FBAD3F'
                            }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({name, percent}) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                          {[
                            { name: 'Group Events', value: selectedMonthAnalysis.selectedMonthData.groupCount, color: '#236383' },
                            { name: 'Individual Collections', value: selectedMonthAnalysis.selectedMonthData.individualCount, color: '#FBAD3F' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [value.toLocaleString(), 'Sandwiches']}
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #236383',
                            borderRadius: '8px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    Group Event Insights
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-brand-primary/10 rounded">
                        <div className="text-xl font-bold text-brand-primary">
                          {selectedMonthAnalysis.selectedMonthData.groupEventCount}
                        </div>
                        <p className="text-sm text-brand-primary">Group Events</p>
                      </div>
                      <div className="text-center p-3 bg-brand-orange/10 rounded">
                        <div className="text-xl font-bold text-brand-orange">
                          {selectedMonthAnalysis.selectedMonthData.groupCount.toLocaleString()}
                        </div>
                        <p className="text-sm text-brand-orange">Sandwiches from Groups</p>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
                      <h5 className="font-medium text-brand-primary-dark mb-2">Key Findings</h5>
                      <ul className="text-sm text-brand-primary space-y-1">
                        <li>• Group events average {selectedMonthAnalysis.selectedMonthData.groupEventCount > 0 ? Math.round(selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.groupEventCount) : 0} sandwiches per event</li>
                        <li>• Individual events average {selectedMonthAnalysis.selectedMonthData.individualCount > 0 ? Math.round(selectedMonthAnalysis.selectedMonthData.individualCount / collections.filter(c => {
                          if (!c.collectionDate) return false;
                          const date = parseCollectionDate(c.collectionDate);
                          if (Number.isNaN(date.getTime())) return false;
                          return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth && (c.individualSandwiches || 0) > 0;
                        }).length) : 0} sandwiches per event</li>
                        <li>• Group events represent {((selectedMonthAnalysis.selectedMonthData.groupEventCount / selectedMonthAnalysis.selectedMonthData.totalCollections) * 100).toFixed(1)}% of all events, but {((selectedMonthAnalysis.selectedMonthData.groupCount / selectedMonthAnalysis.selectedMonthData.totalSandwiches) * 100).toFixed(1)}% of sandwich volume</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month-Specific Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Actionable Insights & Recommendations
              </CardTitle>
              <CardDescription>
                Strategic recommendations based on {selectedMonthName} performance patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    🎯 Priority Actions
                  </h4>
                  <div className="space-y-3">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <h5 className="font-medium text-orange-800 mb-1">Immediate (This Month)</h5>
                      <p className="text-sm text-orange-700">
                        Focus on maintaining momentum with current collection hosts. Check the Weekly Monitoring dashboard for hosts who haven't reported collections this week.
                      </p>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <h5 className="font-medium text-amber-800 mb-1">Medium-term (Next 2-3 Months)</h5>
                      <p className="text-sm text-amber-700">
                        Continue growing both group events and individual collections. Look for successful engagement tactics that can be applied across both channels.
                      </p>
                    </div>

                    <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
                      <h5 className="font-medium text-brand-primary-dark mb-1">Long-term (Annual Planning)</h5>
                      <p className="text-sm text-brand-primary">
                        <strong>Scheduled off-weeks:</strong> Thanksgiving, Christmas, New Year's, Memorial Day, and Independence Day weeks have no collections. 
                        <strong className="ml-1">School breaks</strong> (winter, spring, summer) typically show reduced volunteer availability. 
                        Check the <a href="/yearly-calendar" className="underline hover:text-brand-primary-dark">TSP Yearly Calendar</a> for specific dates and plan outreach around these periods.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-brand-primary mb-3">
                    📊 Performance Patterns
                  </h4>
                  {(() => {
                    const data = selectedMonthAnalysis.selectedMonthData;
                    const groupPct = data.totalCollections > 0
                      ? (data.groupEventCount / data.totalCollections) * 100
                      : 0;
                    const groupEfficiency = groupPct >= 30 ? 'Strong' : groupPct >= 15 ? 'Moderate' : 'Low';
                    const groupEfficiencyColor = groupPct >= 30
                      ? 'bg-brand-primary-light text-brand-primary'
                      : groupPct >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

                    const shortfall = Math.round(selectedMonthAnalysis.shortfall);
                    const isAboveAvg = shortfall <= 0;
                    const growthLabel = isAboveAvg ? 'Above Average' : shortfall > 2000 ? 'Significant' : 'Moderate';
                    const growthColor = isAboveAvg
                      ? 'bg-green-100 text-green-700'
                      : shortfall > 2000 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

                    const trendPercent = selectedMonthAnalysis.comparisonPercent;
                    const trendLabel = trendPercent === null ? 'No Data'
                      : trendPercent >= 10 ? 'Strong Growth'
                      : trendPercent >= 0 ? 'Stable'
                      : trendPercent >= -10 ? 'Slight Decline' : 'Declining';
                    const trendColor = trendPercent === null ? 'bg-gray-100 text-gray-600'
                      : trendPercent >= 10 ? 'bg-green-100 text-green-700'
                      : trendPercent >= 0 ? 'bg-brand-primary-light text-brand-primary'
                      : trendPercent >= -10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium">Overall Trend</span>
                          <Badge className={trendColor}>{trendLabel}</Badge>
                        </div>

                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium">Group Event Share</span>
                          <Badge className={groupEfficiencyColor}>{groupEfficiency} ({groupPct.toFixed(0)}%)</Badge>
                        </div>

                        <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium">vs 6-Month Average{selectedMonthAnalysis.isCurrentMonth ? ' (projected)' : ''}</span>
                          <Badge className={growthColor}>{isAboveAvg ? `+${Math.abs(shortfall).toLocaleString()}` : `-${Math.abs(shortfall).toLocaleString()}`} sandwiches</Badge>
                        </div>

                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <h5 className="font-medium text-purple-800 mb-2">💡 {selectedMonthName} Takeaway</h5>
                          <p className="text-sm text-purple-700">
                            {selectedMonthAnalysis.isCurrentMonth
                              ? isAboveAvg
                                ? `At current pace, ${selectedMonthName} ${selectedYear} is projected to exceed the recent 6-month average by ~${Math.abs(shortfall).toLocaleString()} sandwiches (${Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of month complete). ${groupPct >= 20 ? 'Group events are contributing well — keep the momentum going.' : 'Growth is coming primarily from individual collections — scheduling group events this month could push results even higher.'}`
                                : data.totalSandwiches === 0
                                  ? `No collection data recorded yet for ${selectedMonthName} ${selectedYear}. Data may not have been entered yet.`
                                  : `With ${Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% of the month complete, ${selectedMonthName} ${selectedYear} has collected ${data.totalSandwiches.toLocaleString()} sandwiches. At current pace, the projected total is ~${selectedMonthAnalysis.projectedTotal.toLocaleString()}, which would be ${Math.abs(shortfall).toLocaleString()} below the recent average. ${groupPct < 20 ? 'Scheduling more group events this month could help close the gap.' : 'Maintaining group event participation will be key to closing the gap.'}`
                              : isAboveAvg
                                ? `${selectedMonthName} ${selectedYear} outperformed the recent 6-month average by ${Math.abs(shortfall).toLocaleString()} sandwiches. ${groupPct >= 20 ? 'Group events were a strong contributor — consider replicating this outreach approach in future months.' : 'Growth came primarily from individual collections — adding more group events could push results even higher.'}`
                                : data.totalSandwiches === 0
                                  ? `No collection data recorded for ${selectedMonthName} ${selectedYear}. This may be due to a seasonal break or data not yet being entered.`
                                  : `${selectedMonthName} ${selectedYear} collected ${data.totalSandwiches.toLocaleString()} sandwiches across ${data.totalCollections} collections. ${shortfall > 2000 ? `This was ${Math.abs(shortfall).toLocaleString()} below the recent average — ` : 'Slightly below average — '}${groupPct < 20 ? 'increasing group event outreach could help close the gap.' : 'maintaining strong group event participation will be key to recovery.'}`
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Collection Patterns Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-6 w-6 text-brand-primary" />
            <h3 className="text-2xl font-bold text-brand-primary">Collection Patterns</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Distribution ({selectedMonthName})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          week: 'Week 1',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[0],
                        },
                        {
                          week: 'Week 2',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[1],
                        },
                        {
                          week: 'Week 3',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[2],
                        },
                        {
                          week: 'Week 4+',
                          sandwiches:
                            selectedMonthAnalysis.selectedMonthData.weeklyDistribution[3],
                        },
                      ]}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#236383"
                        opacity={0.2}
                      />
                      <XAxis dataKey="week" stroke="#236383" fontSize={12} />
                      <YAxis stroke="#236383" fontSize={12} />
                      <Tooltip
                        formatter={(value) => [
                          Number(value).toLocaleString(),
                          'Sandwiches',
                        ]}
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #236383',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="sandwiches"
                        fill="#236383"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Collection Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: 'Individual',
                            value: selectedMonthAnalysis.selectedMonthData.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: selectedMonthAnalysis.selectedMonthData.groupCount,
                            color: '#FBAD3F',
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          {
                            name: 'Individual',
                            value: selectedMonthAnalysis.selectedMonthData.individualCount,
                            color: '#236383',
                          },
                          {
                            name: 'Group',
                            value: selectedMonthAnalysis.selectedMonthData.groupCount,
                            color: '#FBAD3F',
                          },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => Number(value).toLocaleString()}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contextual Insights Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-6 w-6 text-brand-primary" />
            <h3 className="text-2xl font-bold text-brand-primary">Contextual Insights</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Overview */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-brand-primary">
                  <Activity className="h-5 w-5" />
                  Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-brand-primary-lighter rounded">
                  <h4 className="font-semibold text-brand-primary-dark mb-1">
                    Comparison Analysis{selectedMonthAnalysis.isCurrentMonth ? ' (in progress)' : ''}
                  </h4>
                  <p className="text-sm text-brand-primary">
                    {selectedMonthAnalysis.comparisonChange !== null ? (
                      selectedMonthAnalysis.isCurrentMonth ? (
                        selectedMonthAnalysis.comparisonType === 'year-over-year' ? (
                          <>
                            Through {months[selectedMonth].substring(0, 3)} {new Date().getDate()}, {selectedMonthName} has collected{' '}
                            {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()} sandwiches —{' '}
                            {selectedMonthAnalysis.comparisonChange >= 0
                              ? `${Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} more`
                              : `${Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} fewer`}
                            {' '}than the same period last year ({Math.abs(Number(selectedMonthAnalysis.comparisonPercent?.toFixed(1)) || 0)}%
                            {selectedMonthAnalysis.comparisonChange >= 0 ? ' increase' : ' decrease'}).
                            {' '}At current pace, the projected monthly total is ~{selectedMonthAnalysis.projectedTotal.toLocaleString()} sandwiches.
                          </>
                        ) : (
                          <>
                            {selectedMonthName} is {Math.round(selectedMonthAnalysis.monthProgressRatio * 100)}% complete with{' '}
                            {selectedMonthAnalysis.selectedMonthData.totalSandwiches.toLocaleString()} sandwiches collected so far.
                            {' '}At current pace, the projected total (~{selectedMonthAnalysis.projectedTotal.toLocaleString()}) would be{' '}
                            {selectedMonthAnalysis.comparisonChange! >= 0
                              ? `${Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()} more`
                              : `${Math.abs(selectedMonthAnalysis.comparisonChange!).toLocaleString()} fewer`}
                            {' '}than {selectedMonthAnalysis.comparisonLabel} ({Math.abs(Number(selectedMonthAnalysis.comparisonPercent?.toFixed(1)) || 0)}%
                            {selectedMonthAnalysis.comparisonChange! >= 0 ? ' increase' : ' decrease'}).
                          </>
                        )
                      ) : (
                        selectedMonthAnalysis.comparisonChange < 0 ? (
                          <>
                            {selectedMonthName} collected{' '}
                            {Math.abs(selectedMonthAnalysis.comparisonChange).toLocaleString()} fewer
                            sandwiches ({Math.abs(Number(selectedMonthAnalysis.comparisonPercent?.toFixed(1)) || 0)}%
                            decrease) compared to {selectedMonthAnalysis.comparisonLabel}.
                          </>
                        ) : (
                          <>
                            {selectedMonthName} collected{' '}
                            {selectedMonthAnalysis.comparisonChange.toLocaleString()} more
                            sandwiches ({selectedMonthAnalysis.comparisonPercent?.toFixed(1)}%
                            increase) compared to {selectedMonthAnalysis.comparisonLabel}.
                          </>
                        )
                      )
                    ) : (
                      'No comparison data available.'
                    )}
                  </p>
                </div>

                {(() => {
                  const holidays = getHolidaysForMonth(selectedMonth, selectedYear);
                  if (holidays.length > 0) {
                    return (
                      <div className="p-3 bg-purple-50 rounded">
                        <h4 className="font-semibold text-purple-800 mb-1">
                          Holiday Impact
                        </h4>
                        <p className="text-sm text-purple-700">
                          {holidays.length} holiday factor{holidays.length > 1 ? 's' : ''} this month
                          {holidays.some(h => h.impact === 'high') ? ' including high-impact events' : ''}.
                          Consider scheduling adjustments for future planning.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </CardContent>
            </Card>

            {/* Actionable Recommendations */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Lightbulb className="h-5 w-5" />
                  Actionable Next Steps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const nextMonth = (selectedMonth + 1) % 12;
                  const nextMonthYear = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
                  const nextMonthName = months[nextMonth];

                  // Look up last year's data for the next month
                  const lastYearNextMonthKey = `${nextMonthYear - 1}-${String(nextMonth + 1).padStart(2, '0')}`;
                  const lastYearNextMonth = monthlyAnalytics ? monthlyAnalytics[lastYearNextMonthKey] : null;

                  // Two years ago for trend context
                  const twoYearsAgoKey = `${nextMonthYear - 2}-${String(nextMonth + 1).padStart(2, '0')}`;
                  const twoYearsAgoMonth = monthlyAnalytics ? monthlyAnalytics[twoYearsAgoKey] : null;

                  // Get holidays/seasonal factors for next month
                  const nextMonthHolidays = getHolidaysForMonth(nextMonth, nextMonthYear);

                  // Current month's data for trend context
                  const currentData = selectedMonthAnalysis?.selectedMonthData;
                  const avgRecent = selectedMonthAnalysis?.avgRecentMonth || 0;

                  // Calculate a suggested target
                  const lastYearTotal = lastYearNextMonth?.totalSandwiches || 0;
                  const suggestedTarget = lastYearTotal > 0
                    ? Math.round(lastYearTotal * 1.1) // 10% growth over last year
                    : avgRecent > 0
                      ? Math.round(avgRecent) // match recent average if no prior year data
                      : null;

                  // Group event insight
                  const lastYearGroupPct = lastYearNextMonth && lastYearNextMonth.totalSandwiches > 0
                    ? (lastYearNextMonth.groupCount / lastYearNextMonth.totalSandwiches) * 100
                    : null;
                  const currentGroupPct = currentData && currentData.totalSandwiches > 0
                    ? (currentData.groupCount / currentData.totalSandwiches) * 100
                    : null;

                  return (
                    <div className="space-y-3">
                      <div className="p-3 bg-brand-primary-lighter rounded">
                        <h4 className="font-semibold text-brand-primary-dark mb-2">
                          {nextMonthName} {nextMonthYear} Preview
                        </h4>

                        {/* Last year's benchmark */}
                        {lastYearNextMonth ? (
                          <div className="mb-3 p-2 bg-white/60 rounded">
                            <p className="text-sm font-medium text-brand-primary mb-1">
                              {nextMonthName} {nextMonthYear - 1} Benchmark
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div>
                                <div className="text-lg font-bold text-brand-primary">{lastYearNextMonth.totalSandwiches.toLocaleString()}</div>
                                <div className="text-xs text-gray-600">sandwiches</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-brand-primary">{lastYearNextMonth.totalCollections}</div>
                                <div className="text-xs text-gray-600">collections</div>
                              </div>
                              <div>
                                <div className="text-lg font-bold text-brand-primary">{lastYearNextMonth.groupEventCount}</div>
                                <div className="text-xs text-gray-600">group events</div>
                              </div>
                            </div>
                            {twoYearsAgoMonth && twoYearsAgoMonth.totalSandwiches > 0 && (
                              <p className="text-xs text-gray-500 mt-1">
                                {nextMonthName} {nextMonthYear - 2}: {twoYearsAgoMonth.totalSandwiches.toLocaleString()} sandwiches
                                ({lastYearTotal > twoYearsAgoMonth.totalSandwiches ? '+' : ''}{((lastYearTotal - twoYearsAgoMonth.totalSandwiches) / twoYearsAgoMonth.totalSandwiches * 100).toFixed(0)}% YoY)
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-brand-primary mb-2">
                            No {nextMonthName} data from previous years to benchmark against.
                          </p>
                        )}

                        {/* Suggested target */}
                        {suggestedTarget && (
                          <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded">
                            <p className="text-sm font-medium text-green-800">
                              Suggested Target: {suggestedTarget.toLocaleString()} sandwiches
                            </p>
                            <p className="text-xs text-green-700">
                              {lastYearTotal > 0
                                ? `Based on 10% growth over ${nextMonthName} ${nextMonthYear - 1}`
                                : 'Based on recent 6-month average'}
                            </p>
                          </div>
                        )}

                        {/* Group event recommendation */}
                        {currentGroupPct !== null && (
                          <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded">
                            <p className="text-sm font-medium text-purple-800 mb-1">Group Event Strategy</p>
                            <p className="text-xs text-purple-700">
                              {lastYearGroupPct !== null
                                ? `Last ${nextMonthName}, group events were ${lastYearGroupPct.toFixed(0)}% of volume. `
                                : ''}
                              {currentGroupPct >= 25
                                ? `Currently at ${currentGroupPct.toFixed(0)}% group share — maintain this momentum by scheduling group events early in the month.`
                                : `Currently at ${currentGroupPct.toFixed(0)}% group share — boosting group event outreach for ${nextMonthName} could significantly increase totals.`}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Holidays & seasonal factors */}
                      {nextMonthHolidays.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                          <h4 className="font-semibold text-amber-800 mb-2">
                            {nextMonthName} Factors to Consider
                          </h4>
                          <ul className="space-y-1">
                            {nextMonthHolidays.map((h, i) => (
                              <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                                <span className={`inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                                  h.impact === 'high' ? 'bg-red-400' : h.impact === 'medium' ? 'bg-amber-400' : 'bg-blue-400'
                                }`} />
                                <span><strong>{h.name}</strong> — {h.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
