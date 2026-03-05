import React, { useState, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { parseCollectionDate } from '@/lib/analytics-utils';
import { REGULAR_THURSDAY_CAPACITY, SPECIAL_PLACEMENT_HIGH_THRESHOLD } from '@/lib/sandwich-utils';
import { getWeekStart } from '@/lib/week-planning-utils';

interface SandwichCollection {
  id: number;
  collectionDate: string;
  individualSandwiches: number;
  groupCollections?: Array<{
    id?: number;
    name: string;
    count: number;
    // Backward compatibility fields
    groupName?: string;
    sandwichCount?: number;
  }>;
}

interface EventRequest {
  id: number;
  desiredEventDate: string;
  estimatedSandwichCount: number;
  status: string;
  eventName?: string;
  organizationName?: string;
}

interface DayPlan {
  date: Date;
  dayName: string;
  dayOfWeek: number;
  collections: SandwichCollection[];
  events: EventRequest[];
  totalSandwiches: number;
  isRegularDistribution: boolean; // Wednesday feeds into Thursday regular
}

interface WeekOutlookModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialWeekStart?: Date;
}

/**
 * WeekOutlookModal displays a modal with a week-by-week outlook of sandwich collections and event requests.
 * The week is defined as Friday to Thursday, to align with business requirements.
 * It aggregates sandwich counts, distinguishes between regular distribution and special placements,
 * and uses capacity thresholds to indicate status.
 *
 * @param {WeekOutlookModalProps} props - The modal props.
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {() => void} props.onClose - Function to close the modal.
 * @param {Date} [props.initialWeekStart] - Optional initial week start date.
 */
export default function WeekOutlookModal({ isOpen, onClose, initialWeekStart }: WeekOutlookModalProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    initialWeekStart ? getWeekStart(initialWeekStart) : getWeekStart(today)
  );

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

  // Calculate week data
  const weekData = useMemo(() => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Create day plans for the week (Fri, Sat, Sun, Mon, Tue, Wed, Thu)
    const dayPlans: DayPlan[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const dayOfWeek = date.getDay();

      // Filter collections for this day
      const dayCollections = collections.filter((c) => {
        const collectionDate = parseCollectionDate(c.collectionDate);
        return collectionDate.toDateString() === date.toDateString();
      });

      // Filter events for this day
      const dayEvents = (eventRequests || []).filter((event) => {
        if (!event.desiredEventDate) return false;
        if (!['in_process', 'scheduled', 'completed'].includes(event.status)) return false;
        const eventDate = new Date(event.desiredEventDate);
        return eventDate.toDateString() === date.toDateString();
      });

      // Calculate total sandwiches for this day
      const collectionTotal = dayCollections.reduce((sum, c) => {
        const groupTotal = (Array.isArray(c.groupCollections) ? c.groupCollections : [])
          .reduce((gsum, g) => gsum + (g.count || g.sandwichCount || 0), 0);
        return sum + groupTotal;
      }, 0);

      const eventTotal = dayEvents.reduce((sum, e) => sum + (e.estimatedSandwichCount || 0), 0);

      dayPlans.push({
        date,
        dayName: dayNames[dayOfWeek],
        dayOfWeek,
        collections: dayCollections,
        events: dayEvents,
        totalSandwiches: collectionTotal + eventTotal,
        isRegularDistribution: dayOfWeek === 3, // Wednesday
      });
    }

    return dayPlans;
  }, [currentWeekStart, collections, eventRequests, today]);

  // Calculate totals
  const regularDistributionTotal = weekData
    .filter(d => d.isRegularDistribution)
    .reduce((sum, d) => sum + d.totalSandwiches, 0);

  const specialPlacementTotal = weekData
    .filter(d => !d.isRegularDistribution)
    .reduce((sum, d) => sum + d.totalSandwiches, 0);

  const weekTotal = regularDistributionTotal + specialPlacementTotal;

  // Calculate weekly average for context
  const weeklyAverage = useMemo(() => {
    const weekMap = new Map<string, number>();

    collections.forEach((c) => {
      const date = parseCollectionDate(c.collectionDate);
      const dayOfWeek = date.getDay();
      const daysFromFriday = (dayOfWeek + 2) % 7;
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysFromFriday);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];

      const individual = Number(c.individualSandwiches || 0);
      const group = (Array.isArray(c.groupCollections) ? c.groupCollections : [])
        .reduce((sum, g) => sum + (g.count || g.sandwichCount || 0), 0);
      const total = individual + group;

      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + total);
    });

    const weeklyTotals = Array.from(weekMap.values());
    return weeklyTotals.length > 0
      ? Math.round(weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.length)
      : 0;
  }, [collections]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(today));
  };

  if (!isOpen) return null;

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(currentWeekStart.getDate() + 6);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const placementStatus = () => {
    if (weekTotal === 0) return { status: 'none', message: 'No group events planned this week' };

    const regularOverage = Math.max(0, regularDistributionTotal - REGULAR_THURSDAY_CAPACITY);

    if (regularDistributionTotal > REGULAR_THURSDAY_CAPACITY && specialPlacementTotal > 0) {
      return {
        status: 'critical',
        message: `High volume: ${regularOverage.toLocaleString()} sandwiches over Thursday capacity AND ${specialPlacementTotal.toLocaleString()} needing special placement`,
      };
    } else if (regularDistributionTotal > REGULAR_THURSDAY_CAPACITY) {
      return {
        status: 'warning',
        message: `${regularOverage.toLocaleString()} sandwiches over Thursday capacity - need additional distribution`,
      };
    } else if (specialPlacementTotal > SPECIAL_PLACEMENT_HIGH_THRESHOLD) {
      return {
        status: 'warning',
        message: `${specialPlacementTotal.toLocaleString()} sandwiches need special placement outside Thursday distribution`,
      };
    } else if (specialPlacementTotal > 0) {
      return {
        status: 'info',
        message: `${specialPlacementTotal.toLocaleString()} sandwiches need special placement - manageable volume`,
      };
    } else {
      return {
        status: 'good',
        message: 'All group events on Wednesday - will flow to Thursday regular distribution',
      };
    }
  };

  const status = placementStatus();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Week Outlook & Planning</h2>
            <p className="text-sm text-gray-600 mt-1">
              Plan group event distribution and placement
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Week Navigation */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-gray-50">
          <button
            onClick={() => navigateWeek('prev')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Week
          </button>

          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {formatDate(currentWeekStart)} - {formatDate(weekEnd)}
              </div>
              <button
                onClick={goToToday}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to current week
              </button>
            </div>
          </div>

          <button
            onClick={() => navigateWeek('next')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Next Week
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-800 mb-1">Total Planned</div>
              <div className="text-2xl font-bold text-blue-900">
                {weekTotal.toLocaleString()}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                sandwiches from group events
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-800 mb-1">Regular Distribution</div>
              <div className="text-2xl font-bold text-green-900">
                {regularDistributionTotal.toLocaleString()}
              </div>
              <div className="text-xs text-green-700 mt-1">
                Wednesday events → Thursday distribution
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="text-sm font-medium text-amber-800 mb-1">Special Placement</div>
              <div className="text-2xl font-bold text-amber-900">
                {specialPlacementTotal.toLocaleString()}
              </div>
              <div className="text-xs text-amber-700 mt-1">
                Other days - need recipient coordination
              </div>
            </div>
          </div>

          {/* Status Alert */}
          <div
            className={`rounded-lg p-4 mb-6 flex items-start gap-3 ${
              status.status === 'critical'
                ? 'bg-red-50 border border-red-200'
                : status.status === 'warning'
                ? 'bg-amber-50 border border-amber-200'
                : status.status === 'good'
                ? 'bg-green-50 border border-green-200'
                : status.status === 'info'
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            {status.status === 'critical' || status.status === 'warning' ? (
              <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                status.status === 'critical' ? 'text-red-600' : 'text-amber-600'
              }`} />
            ) : status.status === 'good' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-blue-600" />
            )}
            <div>
              <div className={`font-semibold ${
                status.status === 'critical'
                  ? 'text-red-900'
                  : status.status === 'warning'
                  ? 'text-amber-900'
                  : status.status === 'good'
                  ? 'text-green-900'
                  : status.status === 'info'
                  ? 'text-blue-900'
                  : 'text-gray-900'
              }`}>
                {status.status === 'critical' ? 'Critical Planning Needed' :
                 status.status === 'warning' ? 'Action Required' :
                 status.status === 'good' ? 'On Track' : 'Planning Note'}
              </div>
              <div className={`text-sm mt-1 ${
                status.status === 'critical'
                  ? 'text-red-800'
                  : status.status === 'warning'
                  ? 'text-amber-800'
                  : status.status === 'good'
                  ? 'text-green-800'
                  : status.status === 'info'
                  ? 'text-blue-800'
                  : 'text-gray-800'
              }`}>
                {status.message}
              </div>
              {weeklyAverage > 0 && (
                <div className="text-xs mt-2 text-gray-600">
                  Weekly average: {weeklyAverage.toLocaleString()} sandwiches
                  {weekTotal > 0 && ` (${Math.round((weekTotal / weeklyAverage) * 100)}% from group events)`}
                </div>
              )}
            </div>
          </div>

          {/* Day-by-Day Breakdown */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Day-by-Day Breakdown</h3>
            <div className="space-y-3">
              {weekData.map((day, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    day.totalSandwiches > 0
                      ? day.isRegularDistribution
                        ? 'border-green-300 bg-green-50'
                        : 'border-amber-300 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-gray-900">
                        {day.dayName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {formatDate(day.date)}
                      </div>
                      {day.isRegularDistribution && day.totalSandwiches > 0 && (
                        <span className="text-xs font-medium bg-green-200 text-green-800 px-2 py-1 rounded">
                          Regular Distribution
                        </span>
                      )}
                      {!day.isRegularDistribution && day.totalSandwiches > 0 && (
                        <span className="text-xs font-medium bg-amber-200 text-amber-800 px-2 py-1 rounded">
                          Special Placement Needed
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {day.totalSandwiches > 0 ? day.totalSandwiches.toLocaleString() : '-'}
                    </div>
                  </div>

                  {day.totalSandwiches > 0 && (
                    <div className="space-y-2 mt-3">
                      {day.collections.map((collection) => (
                        <div key={collection.id} className="text-sm pl-3 border-l-2 border-gray-300">
                          {collection.groupCollections?.map((group, idx) => (
                            <div key={idx} className="text-gray-700">
                              • <span className="font-medium">{group.name || group.groupName}</span>: {(group.count || group.sandwichCount || 0).toLocaleString()} sandwiches
                            </div>
                          ))}
                        </div>
                      ))}
                      {day.events.map((event) => (
                        <div key={event.id} className="text-sm pl-3 border-l-2 border-blue-300">
                          <div className="text-gray-700">
                            • <span className="font-medium">{event.eventName || event.organizationName || 'Scheduled Event'}</span>: {event.estimatedSandwichCount.toLocaleString()} sandwiches (est.)
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Planning Tips */}
          {weekTotal > 0 && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Planning Tips</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {regularDistributionTotal > REGULAR_THURSDAY_CAPACITY && (
                  <li>• Consider splitting Wednesday collections or adding distribution locations for Thursday</li>
                )}
                {specialPlacementTotal > 0 && (
                  <li>• Coordinate with recipients for non-Thursday delivery: {specialPlacementTotal.toLocaleString()} sandwiches need placement</li>
                )}
                {weeklyAverage > 0 && weekTotal > weeklyAverage * 0.8 && (
                  <li>• Group events meeting ~{Math.round((weekTotal / weeklyAverage) * 100)}% of weekly goal - focus less on individual recruitment</li>
                )}
                {regularDistributionTotal > 0 && specialPlacementTotal === 0 && (
                  <li>• All group events align with Thursday distribution - no special coordination needed</li>
                )}
              </ul>
            </div>
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
