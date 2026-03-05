import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Sandwich,
  Car,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { EventRequest } from '@shared/schema';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import sandwichLogo from '@assets/LOGOS/Copy of TSP_transparent.png';

interface AttentionItem {
  id: number;
  organizationName: string;
  eventDate?: string;
  tspContact?: string;
  daysSinceContact?: number;
  missingFields?: string[];
  missingPostEvent?: string[];
}

// Helper to get start of current week (Monday)
const getWeekStart = (): Date => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Helper to get end of current week (Sunday)
const getWeekEnd = (): Date => {
  const monday = getWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

// Helper to check if a date is within this week
const isThisWeek = (dateInput: string | Date | null | undefined): boolean => {
  if (!dateInput) return false;
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd();
  return date >= weekStart && date <= weekEnd;
};

// Helper to check if date is within next N days
const isWithinDays = (dateInput: string | Date | null | undefined, days: number): boolean => {
  if (!dateInput) return false;
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= futureDate;
};

// Collapsible section component
const CollapsibleSection: React.FC<{
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, count, icon, color, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`border rounded-lg overflow-hidden ${color}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-opacity-80 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-semibold text-gray-900">{title}</span>
          <Badge variant="secondary" className="ml-2">
            {count}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {isOpen && <div className="border-t p-4 bg-white">{children}</div>}
    </div>
  );
};

// Summary card component
const SummaryCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
  subtitle?: string;
}> = ({ title, value, icon, color, onClick, subtitle }) => (
  <Card
    className={`cursor-pointer hover:shadow-lg transition-shadow ${color}`}
    onClick={onClick}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-l-4', 'bg').replace('border-', 'bg-')}/20`}>
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Date range options for request volume
const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '180', label: 'Last 6 Months' },
  { value: '365', label: 'Last Year' },
];

export default function EventOperationalDashboard() {
  const [, setLocation] = useLocation();
  const [volumeDateRange, setVolumeDateRange] = useState<string>('30');

  // Fetch all event requests
  const { data: events = [], isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
    staleTime: 60 * 1000, // 1 minute - dashboard needs fresh data
    refetchOnWindowFocus: true,
  });

  // Fetch users for TSP contact names
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Helper to get user name by ID
  const getUserName = (userId: string | null | undefined): string => {
    if (!userId) return 'Unassigned';
    const user = users.find((u) => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown';
  };

  // Calculate this week's metrics
  const thisWeekMetrics = useMemo(() => {
    const scheduledEvents = events.filter(
      (e) => e.status === 'scheduled' && isThisWeek(e.scheduledEventDate || e.desiredEventDate)
    );

    const eventsCount = scheduledEvents.length;
    const sandwichesExpected = scheduledEvents.reduce(
      (sum, e) => sum + (e.estimatedSandwichCount || 0),
      0
    );

    // Drivers needed: events where total assigned drivers < drivers needed
    // Include van driver and DHL van in the total assigned count
    const driversNeeded = scheduledEvents.filter((e) => {
      if (!e.driversNeeded || e.driversNeeded <= 0) return false;
      if (e.driversArranged || e.selfTransport) return false;

      const totalAssigned = (e.assignedDriverIds?.length || 0) +
                           (e.assignedVanDriverId ? 1 : 0) +
                           (e.isDhlVan ? 1 : 0);
      return totalAssigned < e.driversNeeded;
    }).length;

    // Volunteers needed: events where volunteers needed > volunteers assigned
    const volunteersNeeded = scheduledEvents.filter((e) => {
      const needed = e.volunteersNeeded || 0;
      const assigned = e.assignedVolunteerIds?.length || 0;
      return needed > 0 && assigned < needed;
    }).length;

    return { eventsCount, sandwichesExpected, driversNeeded, volunteersNeeded };
  }, [events]);

  // Calculate attention needed items
  const attentionItems = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Stalled intakes: in_process status with no recent contact
    const stalledIntakes: AttentionItem[] = events
      .filter((e) => {
        if (e.status !== 'in_process') return false;
        const lastContact = e.lastContactAttempt || e.contactedAt || e.createdAt;
        if (!lastContact) return true;
        const contactDate = new Date(lastContact);
        return contactDate < sevenDaysAgo;
      })
      .map((e) => {
        const lastContact = e.lastContactAttempt || e.contactedAt || e.createdAt;
        const daysSince = lastContact
          ? Math.floor((now.getTime() - new Date(lastContact).getTime()) / (1000 * 60 * 60 * 24))
          : 999;
        return {
          id: e.id,
          organizationName: e.organizationName || 'Unknown',
          tspContact: getUserName(e.tspContactAssigned || e.tspContact),
          daysSinceContact: daysSince,
        };
      })
      .sort((a, b) => (b.daysSinceContact || 0) - (a.daysSinceContact || 0));

    // Incomplete scheduled events: missing critical fields within 14 days
    const incompleteScheduled: AttentionItem[] = events
      .filter((e) => {
        if (e.status !== 'scheduled') return false;
        const eventDate = e.scheduledEventDate || e.desiredEventDate;
        if (!isWithinDays(eventDate, 14)) return false;

        // Check for missing fields
        const missing: string[] = [];
        if (!e.eventAddress && !e.deliveryDestination) missing.push('Address');
        if (!e.estimatedSandwichCount) missing.push('Sandwich count');
        if ((e.driversNeeded && e.driversNeeded > 0) && !e.driversArranged && !e.selfTransport) {
          // Include van driver and DHL van in total assigned count
          const totalDriversAssigned = (e.assignedDriverIds?.length || 0) +
                                       (e.assignedVanDriverId ? 1 : 0) +
                                       (e.isDhlVan ? 1 : 0);
          if (totalDriversAssigned < e.driversNeeded) {
            missing.push('Driver');
          }
        }
        if ((e.speakersNeeded && e.speakersNeeded > 0) && !e.eventStartTime) {
          missing.push('Event start time');
        }

        return missing.length > 0;
      })
      .map((e) => {
        const missing: string[] = [];
        if (!e.eventAddress && !e.deliveryDestination) missing.push('Address');
        if (!e.estimatedSandwichCount) missing.push('Sandwich count');
        if ((e.driversNeeded && e.driversNeeded > 0) && !e.driversArranged && !e.selfTransport) {
          // Include van driver and DHL van in total assigned count
          const totalDriversAssigned = (e.assignedDriverIds?.length || 0) +
                                       (e.assignedVanDriverId ? 1 : 0) +
                                       (e.isDhlVan ? 1 : 0);
          if (totalDriversAssigned < e.driversNeeded) {
            missing.push('Driver');
          }
        }
        if ((e.speakersNeeded && e.speakersNeeded > 0) && !e.eventStartTime) {
          missing.push('Event start time');
        }

        return {
          id: e.id,
          organizationName: e.organizationName || 'Unknown',
          eventDate: e.scheduledEventDate || e.desiredEventDate
            ? new Date(e.scheduledEventDate || e.desiredEventDate!).toLocaleDateString()
            : 'TBD',
          missingFields: missing,
        };
      })
      .sort((a, b) => {
        const dateA = a.eventDate ? new Date(a.eventDate) : new Date('9999-12-31');
        const dateB = b.eventDate ? new Date(b.eventDate) : new Date('9999-12-31');
        return dateA.getTime() - dateB.getTime();
      });

    // Post-event follow-up needed: completed events missing social media or final count
    const postEventFollowUp: AttentionItem[] = events
      .filter((e) => {
        if (e.status !== 'completed') return false;
        const missing: string[] = [];
        if (!e.socialMediaPostCompleted) missing.push('Social media post');
        if (!e.actualSandwichCount) missing.push('Final sandwich count');
        return missing.length > 0;
      })
      .map((e) => {
        const missing: string[] = [];
        if (!e.socialMediaPostCompleted) missing.push('Social media post');
        if (!e.actualSandwichCount) missing.push('Final sandwich count');

        return {
          id: e.id,
          organizationName: e.organizationName || 'Unknown',
          eventDate: e.scheduledEventDate || e.desiredEventDate
            ? new Date(e.scheduledEventDate || e.desiredEventDate!).toLocaleDateString()
            : 'Unknown',
          missingPostEvent: missing,
        };
      })
      .sort((a, b) => {
        // Most recent first
        const dateA = a.eventDate ? new Date(a.eventDate) : new Date('1900-01-01');
        const dateB = b.eventDate ? new Date(b.eventDate) : new Date('1900-01-01');
        return dateB.getTime() - dateA.getTime();
      });

    return { stalledIntakes, incompleteScheduled, postEventFollowUp };
  }, [events, users]);

  // Calculate request volume for selected date range
  // Uses createdAt which reflects when the form was submitted to Google Sheets
  const requestVolumeData = useMemo(() => {
    const now = new Date();
    const days = parseInt(volumeDateRange, 10);
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

    // Determine grouping strategy based on range
    // For shorter ranges (7 days), group by day
    // For medium ranges (30-90 days), group by week
    // For longer ranges (180-365 days), group by month
    const groupByDay = days <= 14;
    const groupByMonth = days > 90;

    const groupedData: Record<string, number> = {};
    const previousPeriodCount = { count: 0 };

    events.forEach((e) => {
      const createdDate = e.createdAt ? new Date(e.createdAt) : null;
      if (!createdDate) return;

      // Count for previous period (for comparison)
      if (createdDate >= previousPeriodStart && createdDate < periodStart) {
        previousPeriodCount.count++;
      }

      // Current period - group appropriately
      if (createdDate >= periodStart) {
        let groupKey: string;
        
        if (groupByDay) {
          // Group by day
          groupKey = createdDate.toISOString().split('T')[0];
        } else if (groupByMonth) {
          // Group by month
          const monthStart = new Date(createdDate.getFullYear(), createdDate.getMonth(), 1);
          groupKey = monthStart.toISOString().split('T')[0];
        } else {
          // Group by week
          const weekStart = new Date(createdDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          groupKey = weekStart.toISOString().split('T')[0];
        }
        
        groupedData[groupKey] = (groupedData[groupKey] || 0) + 1;
      }
    });

    const currentCount = Object.values(groupedData).reduce((sum, count) => sum + count, 0);
    const percentChange =
      previousPeriodCount.count > 0
        ? Math.round(((currentCount - previousPeriodCount.count) / previousPeriodCount.count) * 100)
        : 0;

    const chartData = Object.entries(groupedData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, count]) => {
        const date = new Date(dateKey);
        let label: string;
        
        if (groupByDay) {
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (groupByMonth) {
          label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        } else {
          label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        return {
          week: label,
          requests: count,
        };
      });

    // Get the label for the selected range
    const rangeLabel = DATE_RANGE_OPTIONS.find(opt => opt.value === volumeDateRange)?.label || 'Selected Period';

    return { chartData, currentCount, percentChange, rangeLabel };
  }, [events, volumeDateRange]);

  // Navigation handler
  const navigateToEventRequests = (filter?: string) => {
    if (filter) {
      setLocation(`/event-requests?filter=${filter}`);
    } else {
      setLocation('/event-requests');
    }
  };

  const navigateToEvent = (eventId: number) => {
    setLocation(`/dashboard?section=event-requests&eventId=${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={sandwichLogo} alt="TSP Logo" className="w-10 h-10" />
          <div>
            <h1 className="text-2xl font-bold text-brand-primary font-roboto">
              Event Operations Dashboard
            </h1>
            <p className="text-gray-600 font-roboto">
              Real-time snapshot of event request status
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigateToEventRequests()}
          className="bg-brand-primary hover:bg-brand-primary-dark"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          View All Events
        </Button>
      </div>

      {/* Section 1: This Week at a Glance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-primary" />
          This Week at a Glance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Events This Week"
            value={thisWeekMetrics.eventsCount}
            icon={<Calendar className="w-6 h-6 text-blue-600" />}
            color="border-l-4 border-blue-500 bg-white"
            onClick={() => navigateToEventRequests('this-week')}
            subtitle="Scheduled events"
          />
          <SummaryCard
            title="Sandwiches Expected"
            value={thisWeekMetrics.sandwichesExpected.toLocaleString()}
            icon={<Sandwich className="w-6 h-6 text-orange-600" />}
            color="border-l-4 border-orange-500 bg-white"
            onClick={() => navigateToEventRequests('this-week')}
            subtitle="Total estimated"
          />
          <SummaryCard
            title="Drivers Needed"
            value={thisWeekMetrics.driversNeeded}
            icon={<Car className="w-6 h-6 text-red-600" />}
            color="border-l-4 border-red-500 bg-white"
            onClick={() => navigateToEventRequests('needs-driver')}
            subtitle="Events without drivers"
          />
          <SummaryCard
            title="Volunteers Needed"
            value={thisWeekMetrics.volunteersNeeded}
            icon={<Users className="w-6 h-6 text-purple-600" />}
            color="border-l-4 border-purple-500 bg-white"
            onClick={() => navigateToEventRequests('needs-volunteers')}
            subtitle="Events needing help"
          />
        </div>
      </div>

      {/* Section 2: Attention Needed */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Attention Needed
        </h2>
        <div className="space-y-3">
          {/* Stalled Intakes */}
          <CollapsibleSection
            title="Stalled Intakes"
            count={attentionItems.stalledIntakes.length}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            color="bg-amber-50 border-amber-200"
            defaultOpen={attentionItems.stalledIntakes.length > 0 && attentionItems.stalledIntakes.length <= 5}
          >
            {attentionItems.stalledIntakes.length === 0 ? (
              <p className="text-gray-500 text-sm">No stalled intakes - great job!</p>
            ) : (
              <div className="space-y-2">
                {attentionItems.stalledIntakes.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigateToEvent(item.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.organizationName}</p>
                      <p className="text-sm text-gray-500">
                        TSP Contact: {item.tspContact}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {item.daysSinceContact} days since contact
                    </Badge>
                  </div>
                ))}
                {attentionItems.stalledIntakes.length > 10 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{attentionItems.stalledIntakes.length - 10} more...
                  </p>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Incomplete Scheduled Events */}
          <CollapsibleSection
            title="Incomplete Scheduled Events"
            count={attentionItems.incompleteScheduled.length}
            icon={<AlertCircle className="w-5 h-5 text-orange-600" />}
            color="bg-orange-50 border-orange-200"
            defaultOpen={attentionItems.incompleteScheduled.length > 0 && attentionItems.incompleteScheduled.length <= 5}
          >
            {attentionItems.incompleteScheduled.length === 0 ? (
              <p className="text-gray-500 text-sm">All scheduled events are complete!</p>
            ) : (
              <div className="space-y-2">
                {attentionItems.incompleteScheduled.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigateToEvent(item.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.organizationName}</p>
                      <p className="text-sm text-gray-500">Event: {item.eventDate}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.missingFields?.map((field) => (
                        <Badge key={field} variant="outline" className="text-orange-700 border-orange-300">
                          Missing: {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {attentionItems.incompleteScheduled.length > 10 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{attentionItems.incompleteScheduled.length - 10} more...
                  </p>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Post-Event Follow-up Needed */}
          <CollapsibleSection
            title="Post-Event Follow-up Needed"
            count={attentionItems.postEventFollowUp.length}
            icon={<CheckCircle2 className="w-5 h-5 text-teal-600" />}
            color="bg-teal-50 border-teal-200"
            defaultOpen={attentionItems.postEventFollowUp.length > 0 && attentionItems.postEventFollowUp.length <= 5}
          >
            {attentionItems.postEventFollowUp.length === 0 ? (
              <p className="text-gray-500 text-sm">All completed events have follow-up data!</p>
            ) : (
              <div className="space-y-2">
                {attentionItems.postEventFollowUp.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                    onClick={() => navigateToEvent(item.id)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.organizationName}</p>
                      <p className="text-sm text-gray-500">Completed: {item.eventDate}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.missingPostEvent?.map((field) => (
                        <Badge key={field} variant="outline" className="text-teal-700 border-teal-300">
                          Needs: {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {attentionItems.postEventFollowUp.length > 10 && (
                  <p className="text-sm text-gray-500 text-center pt-2">
                    +{attentionItems.postEventFollowUp.length - 10} more...
                  </p>
                )}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* Section 3: Request Volume */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" />
            Request Volume
          </h2>
          <Select value={volumeDateRange} onValueChange={setVolumeDateRange}>
            <SelectTrigger className="w-[160px]" data-testid="select-date-range">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} data-testid={`date-range-${option.value}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {requestVolumeData.currentCount}
                </p>
                <p className="text-sm text-gray-500">New requests</p>
              </div>
              {requestVolumeData.percentChange !== 0 && (
                <Badge
                  variant={requestVolumeData.percentChange > 0 ? 'default' : 'secondary'}
                  className={
                    requestVolumeData.percentChange > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {requestVolumeData.percentChange > 0 ? '+' : ''}
                  {requestVolumeData.percentChange}% vs previous period
                </Badge>
              )}
            </div>
            {requestVolumeData.chartData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={requestVolumeData.chartData}>
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="requests"
                      stroke="#007E8C"
                      strokeWidth={2}
                      dot={{ fill: '#007E8C', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No request data available for the {requestVolumeData.rangeLabel.toLowerCase()}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-4 text-center">
              Based on form submission dates from Google Sheets
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
