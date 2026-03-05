import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Car,
  Mic2,
  Users,
  CheckCircle2,
  ArrowRight,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { parseDateOnly } from '@shared/date-utils';

interface UpcomingDeadline {
  id: number;
  organizationName: string;
  eventDate: string;
  status: string;
  needsDriver: boolean;
  needsSpeaker: boolean;
  needsVolunteer: boolean;
  isToday: boolean;
}

interface OperationalStats {
  thisWeekEventsCount: number;
  eventsNeedingDrivers: number;
  eventsNeedingSpeakers: number;
  eventsNeedingVolunteers: number;
  totalDriversNeeded: number;
  totalSpeakersNeeded: number;
  totalVolunteersNeeded: number;
  lastWeekCompletionRate: number | null;
  lastWeekCompleted: number;
  lastWeekTotal: number;
  upcomingDeadlines: UpcomingDeadline[];
  todayEventsCount: number;
  tomorrowEventsCount: number;
  activeEventsCount: number;
  statusCounts: {
    new: number;
    in_process: number;
    scheduled: number;
    rescheduled: number;
  };
}

interface OperationalOverviewProps {
  onNavigate: (section: string) => void;
}

export default function OperationalOverview({ onNavigate }: OperationalOverviewProps) {
  const { data: stats, isLoading, error } = useQuery<OperationalStats>({
    queryKey: ['/api/event-requests/operational-stats'],
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  });

  const formatDate = (dateString: string) => {
    try {
      const date = parseDateOnly(dateString);
      return date && isValid(date) ? format(date, 'EEE, MMM d') : '';
    } catch {
      return '';
    }
  };

  if (error) {
    return null; // Silently fail if user doesn't have permission
  }

  if (isLoading) {
    return (
      <div className="mx-4 mb-8">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  // Check if there are urgent items: events today that still need staffing
  const hasUrgentItems = stats.upcomingDeadlines.some(
    d => d.isToday && (d.needsDriver || d.needsSpeaker || d.needsVolunteer)
  );

  return (
    <div className="mx-4 mb-8">
      <div className="premium-card-elevated p-6" style={{ borderTop: '4px solid #007E8C' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-teal rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="premium-text-h4 text-brand-primary">Operational Overview</h3>
              <p className="premium-text-body-sm text-gray-600">What needs attention right now</p>
            </div>
          </div>
          {hasUrgentItems && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertCircle className="w-3 h-3 mr-1" />
              Attention Needed
            </Badge>
          )}
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* This Week's Events */}
          <div
            className="bg-white rounded-lg p-4 border border-gray-200 hover:border-brand-primary cursor-pointer transition-all"
            onClick={() => onNavigate('event-requests')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <span className="text-sm font-medium text-gray-600">This Week</span>
            </div>
            <div className="text-2xl font-bold text-brand-primary">{stats.thisWeekEventsCount}</div>
            <div className="text-xs text-gray-500">events scheduled</div>
          </div>

          {/* Events Needing Drivers */}
          <div
            className={`bg-white rounded-lg p-4 border cursor-pointer transition-all ${
              stats.eventsNeedingDrivers > 0
                ? 'border-red-300 hover:border-red-500 bg-red-50'
                : 'border-gray-200 hover:border-brand-primary'
            }`}
            onClick={() => onNavigate('event-requests')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Car className={`w-5 h-5 ${stats.eventsNeedingDrivers > 0 ? 'text-red-500' : 'text-brand-orange'}`} />
              <span className="text-sm font-medium text-gray-600">Need Drivers</span>
            </div>
            <div className={`text-2xl font-bold ${stats.eventsNeedingDrivers > 0 ? 'text-red-600' : 'text-brand-orange'}`}>
              {stats.eventsNeedingDrivers}
            </div>
            <div className="text-xs text-gray-500">events</div>
          </div>

          {/* Events Needing Speakers */}
          <div
            className={`bg-white rounded-lg p-4 border cursor-pointer transition-all ${
              stats.eventsNeedingSpeakers > 0
                ? 'border-amber-300 hover:border-amber-500 bg-amber-50'
                : 'border-gray-200 hover:border-brand-primary'
            }`}
            onClick={() => onNavigate('event-requests')}
          >
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className={`w-5 h-5 ${stats.eventsNeedingSpeakers > 0 ? 'text-amber-500' : 'text-brand-light-blue'}`} />
              <span className="text-sm font-medium text-gray-600">Need Speakers</span>
            </div>
            <div className={`text-2xl font-bold ${stats.eventsNeedingSpeakers > 0 ? 'text-amber-600' : 'text-brand-light-blue'}`}>
              {stats.eventsNeedingSpeakers}
            </div>
            <div className="text-xs text-gray-500">events</div>
          </div>

          {/* Completion Rate */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Last Week</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {stats.lastWeekCompletionRate !== null ? `${stats.lastWeekCompletionRate}%` : 'N/A'}
            </div>
            <div className="text-xs text-gray-500">
              {stats.lastWeekTotal > 0
                ? `${stats.lastWeekCompleted}/${stats.lastWeekTotal} completed`
                : 'no events'
              }
            </div>
          </div>
        </div>

        {/* Staffing Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staffing Needs Across All Active Events
          </h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalSpeakersNeeded > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              }`}>
                <Mic2 className="w-4 h-4 mr-1" />
                {stats.totalSpeakersNeeded} speaker{stats.totalSpeakersNeeded !== 1 ? 's' : ''} needed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalDriversNeeded > 0 ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
              }`}>
                <Car className="w-4 h-4 mr-1" />
                {stats.totalDriversNeeded} driver{stats.totalDriversNeeded !== 1 ? 's' : ''} needed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                stats.totalVolunteersNeeded > 0 ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              }`}>
                <Users className="w-4 h-4 mr-1" />
                {stats.totalVolunteersNeeded} volunteer{stats.totalVolunteersNeeded !== 1 ? 's' : ''} needed
              </span>
            </div>
          </div>
        </div>

        {/* Upcoming Deadlines */}
        {stats.upcomingDeadlines.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Upcoming Deadlines
              {stats.todayEventsCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {stats.todayEventsCount} TODAY
                </Badge>
              )}
            </h4>
            <div className="space-y-2">
              {stats.upcomingDeadlines.slice(0, 5).map((deadline) => (
                <div
                  key={deadline.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg cursor-pointer transition-all gap-2 bg-white border border-gray-200 hover:border-brand-primary"
                  onClick={() => onNavigate('event-requests')}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Calendar className="w-5 h-5 text-brand-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{deadline.organizationName}</div>
                      <div className="text-sm text-gray-500">
                        {deadline.isToday ? 'Today' : 'Tomorrow'} - {formatDate(deadline.eventDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pl-8 sm:pl-0">
                    {deadline.needsDriver && (
                      <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">
                        <Car className="w-3 h-3 mr-1" />
                        Driver
                      </Badge>
                    )}
                    {deadline.needsSpeaker && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 text-xs">
                        <Mic2 className="w-3 h-3 mr-1" />
                        Speaker
                      </Badge>
                    )}
                    {deadline.needsVolunteer && (
                      <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50 text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        Volunteer
                      </Badge>
                    )}
                    <ArrowRight className="w-4 h-4 text-gray-400 hidden sm:block" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => onNavigate('event-requests')}
            className="bg-brand-primary hover:bg-brand-primary-dark"
          >
            <Calendar className="w-4 h-4 mr-2" />
            View All Events
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('drivers')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            <Car className="w-4 h-4 mr-2" />
            Assign Drivers
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('volunteer-hub')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            <Users className="w-4 h-4 mr-2" />
            Volunteer Hub
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigate('collections')}
            className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
          >
            Log Collection Data
          </Button>
        </div>
      </div>
    </div>
  );
}
