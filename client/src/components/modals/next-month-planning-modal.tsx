import React, { useMemo } from 'react';
import { X, TrendingUp, TrendingDown, Calendar, AlertCircle, CheckCircle, Target, Users, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { parseCollectionDate, calculateTotalSandwiches } from '@/lib/analytics-utils';
import type { SandwichCollection, EventRequest } from '@shared/schema';

interface NextMonthPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonthlyData {
  year: number;
  month: number;
  monthName: string;
  total: number;
  weekCount: number;
  avgPerWeek: number;
  eventCount: number;
  eventTotal: number;
  individualTotal: number;
}

interface MonthPattern {
  monthName: string;
  monthIndex: number;
  historicalData: MonthlyData[];
  averageTotal: number;
  averageWeekly: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  peakYear: number;
  peakTotal: number;
  lowYear: number;
  lowTotal: number;
  topOrganizations: Array<{ name: string; count: number; avgSize: number }>;
  commonChallenges: string[];
  opportunities: string[];
}

export default function NextMonthPlanningModal({ isOpen, onClose }: NextMonthPlanningModalProps) {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const nextMonthIndex = nextMonth.getMonth();
  const nextMonthName = nextMonth.toLocaleDateString('en-US', { month: 'long' });
  const nextMonthYear = nextMonth.getFullYear();

  // Fetch collections data
  const { data: collectionsData } = useQuery<{ collections: SandwichCollection[] }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch event requests
  const { data: eventRequests } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests?all=true');
      if (!response.ok) throw new Error('Failed to fetch event requests');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Analyze historical data for next month
  const monthPattern = useMemo((): MonthPattern | null => {
    if (!collections.length) return null;

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Group collections by year-month
    const monthlyData = new Map<string, MonthlyData>();

    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const year = date.getFullYear();
      const month = date.getMonth();

      // Only look at the same month from previous years
      if (month !== nextMonthIndex) return;

      const key = `${year}-${month}`;
      const existing = monthlyData.get(key) || {
        year,
        month,
        monthName: monthNames[month],
        total: 0,
        weekCount: 0,
        avgPerWeek: 0,
        eventCount: 0,
        eventTotal: 0,
        individualTotal: 0,
      };

      const total = calculateTotalSandwiches(c);
      const individual = Number(c.individualSandwiches || 0);
      const groupTotal = total - individual;

      existing.total += total;
      existing.individualTotal += individual;
      existing.eventTotal += groupTotal;

      monthlyData.set(key, existing);
    });

    // Get historical events for this month
    const historicalEvents = (eventRequests || []).filter((event) => {
      if (event.status !== 'completed') return false;
      if (!event.desiredEventDate) return false;
      const eventDate = new Date(event.desiredEventDate);
      return eventDate.getMonth() === nextMonthIndex;
    });

    // Count events per year-month
    historicalEvents.forEach((event) => {
      const eventDate = new Date(event.desiredEventDate!);
      const year = eventDate.getFullYear();
      const key = `${year}-${nextMonthIndex}`;
      const existing = monthlyData.get(key);
      if (existing) {
        existing.eventCount += 1;
      }
    });

    // Calculate weeks per month and average per week
    monthlyData.forEach((data, key) => {
      // Approximate weeks in a month
      data.weekCount = 4;
      data.avgPerWeek = Math.round(data.total / data.weekCount);
    });

    const historicalData = Array.from(monthlyData.values()).sort((a, b) => a.year - b.year);

    if (historicalData.length === 0) return null;

    // Calculate averages
    const averageTotal = Math.round(
      historicalData.reduce((sum, d) => sum + d.total, 0) / historicalData.length
    );
    const averageWeekly = Math.round(averageTotal / 4);

    // Calculate trend (compare most recent year to average of previous years)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    let trendPercent = 0;

    if (historicalData.length >= 2) {
      const mostRecent = historicalData[historicalData.length - 1];
      const previousAvg = historicalData
        .slice(0, -1)
        .reduce((sum, d) => sum + d.total, 0) / (historicalData.length - 1);

      trendPercent = Math.round(((mostRecent.total - previousAvg) / previousAvg) * 100);
      if (trendPercent > 10) trend = 'up';
      else if (trendPercent < -10) trend = 'down';
    }

    // Find peak and low years
    const peakData = historicalData.reduce((max, d) => d.total > max.total ? d : max, historicalData[0]);
    const lowData = historicalData.reduce((min, d) => d.total < min.total ? d : min, historicalData[0]);

    // Find top organizations that hosted events in this month
    const orgCounts = new Map<string, { count: number; totalSandwiches: number }>();
    historicalEvents.forEach((event) => {
      if (!event.organizationName) return;
      const existing = orgCounts.get(event.organizationName) || { count: 0, totalSandwiches: 0 };
      existing.count += 1;
      existing.totalSandwiches += event.actualSandwichCount || event.estimatedSandwichCount || 0;
      orgCounts.set(event.organizationName, existing);
    });

    const topOrganizations = Array.from(orgCounts.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgSize: Math.round(data.totalSandwiches / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generate insights based on data patterns
    const commonChallenges: string[] = [];
    const opportunities: string[] = [];

    // Seasonal patterns
    if (nextMonthIndex === 11 || nextMonthIndex === 0) { // Dec/Jan
      commonChallenges.push('Holiday schedules may reduce volunteer availability');
      opportunities.push('Corporate holiday giving events are popular');
    } else if (nextMonthIndex >= 5 && nextMonthIndex <= 7) { // Jun-Aug
      commonChallenges.push('Summer vacation season may reduce regular volunteers');
      opportunities.push('Summer camps and youth programs often want to participate');
    } else if (nextMonthIndex === 8) { // September
      opportunities.push('Back-to-school season: reach out to schools and universities');
    } else if (nextMonthIndex === 10) { // November
      opportunities.push('Thanksgiving season drives giving spirit - recruit early');
    }

    // Based on historical performance
    if (trend === 'down') {
      commonChallenges.push(`${nextMonthName} collections have been declining - extra outreach needed`);
    }
    if (averageWeekly < 8000) {
      opportunities.push('Below-average month historically - opportunity to exceed expectations');
    }
    if (topOrganizations.length > 0) {
      opportunities.push(`${topOrganizations.length} organizations have hosted in ${nextMonthName} before - consider re-engagement`);
    }

    return {
      monthName: nextMonthName,
      monthIndex: nextMonthIndex,
      historicalData,
      averageTotal,
      averageWeekly,
      trend,
      trendPercent,
      peakYear: peakData.year,
      peakTotal: peakData.total,
      lowYear: lowData.year,
      lowTotal: lowData.total,
      topOrganizations,
      commonChallenges,
      opportunities,
    };
  }, [collections, eventRequests, nextMonthIndex, nextMonthName]);

  // Get events already scheduled for next month
  const scheduledNextMonth = useMemo(() => {
    const nextMonthEnd = new Date(nextMonthYear, nextMonthIndex + 1, 0);

    return (eventRequests || []).filter((event) => {
      if (!['in_process', 'scheduled'].includes(event.status)) return false;
      if (!event.desiredEventDate) return false;
      const eventDate = new Date(event.desiredEventDate);
      return eventDate >= nextMonth && eventDate <= nextMonthEnd;
    });
  }, [eventRequests, nextMonth, nextMonthYear, nextMonthIndex]);

  const scheduledTotal = scheduledNextMonth.reduce(
    (sum, event) => sum + (event.estimatedSandwichCount || 0),
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex items-center justify-between bg-gradient-to-r from-blue-600 to-cyan-600">
          <div className="text-white">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              Plan Ahead: {nextMonthName} {nextMonthYear}
            </h2>
            <p className="text-white/80 text-sm mt-1">
              Historical patterns and insights to help you prepare
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!monthPattern ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600">No Historical Data</h3>
              <p className="text-gray-500 mt-2">
                We don't have data from previous {nextMonthName}s yet.
              </p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-800 mb-1">Historical Average</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {monthPattern.averageTotal.toLocaleString()}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    sandwiches in {nextMonthName}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-800 mb-1">Avg Weekly Target</div>
                  <div className="text-2xl font-bold text-green-900">
                    {monthPattern.averageWeekly.toLocaleString()}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    sandwiches per week
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-purple-800 mb-1">Already Scheduled</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {scheduledNextMonth.length}
                  </div>
                  <div className="text-xs text-purple-700 mt-1">
                    events ({scheduledTotal.toLocaleString()} sandwiches)
                  </div>
                </div>

                <div className={`border rounded-lg p-4 ${
                  monthPattern.trend === 'up'
                    ? 'bg-green-50 border-green-200'
                    : monthPattern.trend === 'down'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className={`text-sm font-medium mb-1 ${
                    monthPattern.trend === 'up' ? 'text-green-800' :
                    monthPattern.trend === 'down' ? 'text-red-800' : 'text-gray-800'
                  }`}>
                    Year-over-Year Trend
                  </div>
                  <div className={`text-2xl font-bold flex items-center gap-1 ${
                    monthPattern.trend === 'up' ? 'text-green-900' :
                    monthPattern.trend === 'down' ? 'text-red-900' : 'text-gray-900'
                  }`}>
                    {monthPattern.trend === 'up' ? (
                      <TrendingUp className="w-6 h-6" />
                    ) : monthPattern.trend === 'down' ? (
                      <TrendingDown className="w-6 h-6" />
                    ) : null}
                    {monthPattern.trendPercent > 0 ? '+' : ''}{monthPattern.trendPercent}%
                  </div>
                  <div className={`text-xs mt-1 ${
                    monthPattern.trend === 'up' ? 'text-green-700' :
                    monthPattern.trend === 'down' ? 'text-red-700' : 'text-gray-700'
                  }`}>
                    vs previous years
                  </div>
                </div>
              </div>

              {/* Progress Toward Target */}
              {monthPattern.averageTotal > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Progress Toward Historical Average</span>
                    <span className="text-sm font-bold text-gray-900">
                      {Math.round((scheduledTotal / monthPattern.averageTotal) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (scheduledTotal / monthPattern.averageTotal) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{scheduledTotal.toLocaleString()} scheduled</span>
                    <span>Target: {monthPattern.averageTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Historical Performance Chart */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Historical {nextMonthName} Performance
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  {monthPattern.historicalData.map((data) => (
                    <div key={data.year} className="flex items-center gap-3">
                      <div className="w-12 text-sm font-medium text-gray-600">{data.year}</div>
                      <div className="flex-1 relative">
                        <div className="w-full bg-gray-100 rounded-full h-6">
                          <div
                            className={`h-6 rounded-full flex items-center justify-end pr-2 ${
                              data.total === monthPattern.peakTotal
                                ? 'bg-green-500'
                                : data.total === monthPattern.lowTotal
                                ? 'bg-amber-400'
                                : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${Math.min(100, (data.total / monthPattern.peakTotal) * 100)}%`,
                              minWidth: '60px',
                            }}
                          >
                            <span className="text-xs font-medium text-white">
                              {data.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      {data.total === monthPattern.peakTotal && (
                        <span className="text-xs font-medium text-green-600">Peak</span>
                      )}
                      {data.total === monthPattern.lowTotal && monthPattern.historicalData.length > 1 && (
                        <span className="text-xs font-medium text-amber-600">Low</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Organizations That Have Hosted in This Month */}
              {monthPattern.topOrganizations.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-gray-600" />
                    Organizations Active in {nextMonthName} Previously
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 mb-3">
                      These organizations have hosted events in {nextMonthName} before - consider reaching out:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {monthPattern.topOrganizations.map((org, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                          <span className="font-medium text-gray-900">{org.name}</span>
                          <span className="text-sm text-gray-600">
                            {org.count} event{org.count !== 1 ? 's' : ''} • avg {org.avgSize.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Insights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Challenges */}
                {monthPattern.commonChallenges.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Potential Challenges
                    </h4>
                    <ul className="text-sm text-amber-800 space-y-1">
                      {monthPattern.commonChallenges.map((challenge, idx) => (
                        <li key={idx}>• {challenge}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Opportunities */}
                {monthPattern.opportunities.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Opportunities
                    </h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      {monthPattern.opportunities.map((opportunity, idx) => (
                        <li key={idx}>• {opportunity}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Items */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Recommended Actions for {nextMonthName}
                </h4>
                <div className="space-y-3">
                  {scheduledTotal < monthPattern.averageTotal * 0.5 && (
                    <div className="flex items-start gap-3 bg-white rounded-lg p-3">
                      <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">1</div>
                      <div>
                        <div className="font-medium text-gray-900">Schedule More Events</div>
                        <div className="text-sm text-gray-600">
                          Only {Math.round((scheduledTotal / monthPattern.averageTotal) * 100)}% of historical average scheduled.
                          Need ~{Math.round((monthPattern.averageTotal - scheduledTotal) / 200)} more events averaging 200 sandwiches.
                        </div>
                      </div>
                    </div>
                  )}
                  {monthPattern.topOrganizations.length > 0 && (
                    <div className="flex items-start gap-3 bg-white rounded-lg p-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                        {scheduledTotal < monthPattern.averageTotal * 0.5 ? '2' : '1'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Re-engage Past Hosts</div>
                        <div className="text-sm text-gray-600">
                          Contact {monthPattern.topOrganizations.slice(0, 3).map(o => o.name).join(', ')} -
                          they've hosted in {nextMonthName} before.
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 bg-white rounded-lg p-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold">
                      {scheduledTotal < monthPattern.averageTotal * 0.5
                        ? (monthPattern.topOrganizations.length > 0 ? '3' : '2')
                        : (monthPattern.topOrganizations.length > 0 ? '2' : '1')}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Set Weekly Targets</div>
                      <div className="text-sm text-gray-600">
                        Aim for {monthPattern.averageWeekly.toLocaleString()} sandwiches per week to match historical average.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
