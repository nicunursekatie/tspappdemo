import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Search,
  UserCheck,
  UserX,
  List,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';

import type { AvailabilitySlot } from '@shared/schema';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  profileImageUrl?: string;
  role: string;
}

type QuickFilter = 'today' | 'this-week' | 'next-week' | 'this-month';
type ViewMode = 'list' | 'calendar';

type CalendarEventAssignment = {
  id: number;
  userId: string | null;
  name: string;
  role: string;
  status: string;
};

type CalendarEvent = {
  id: number;
  title: string;
  organizationName: string | null;
  scheduledEventDate: string;
  startTime: string | null;
  endTime: string | null;
  eventAddress: string | null;
  status: string;
  volunteers: CalendarEventAssignment[];
};

export default function TeamAvailability() {
  const { trackView, trackSearch, trackFilter } = useActivityTracker();
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date(), { weekStartsOn: 0 }));
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 0 }));

  useEffect(() => {
    trackView(
      'Availability',
      'Availability',
      'Team Availability',
      'User accessed team availability page'
    );
  }, [trackView]);

  // Fetch all users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users/basic'],
  });

  // Fetch availability slots for date range
  const { data: slots = [], isLoading: slotsLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: [
      '/api/availability',
      {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      },
    ],
  });

  // Fetch scheduled events with volunteer assignments for the range
  const { data: events = [], isLoading: eventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: [
      '/api/availability/events',
      {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
      return apiRequest('GET', `/api/availability/events?${params.toString()}`);
    },
  });

  const isLoading = usersLoading || slotsLoading || eventsLoading;

  // Apply quick filters
  const handleQuickFilter = (filter: QuickFilter) => {
    const today = new Date();
    
    switch (filter) {
      case 'today':
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case 'this-week':
        setStartDate(startOfWeek(today, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case 'next-week':
        const nextWeek = addWeeks(today, 1);
        setStartDate(startOfWeek(nextWeek, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(nextWeek, { weekStartsOn: 1 }));
        break;
      case 'this-month':
        setStartDate(startOfMonth(today));
        setEndDate(endOfMonth(today));
        break;
    }
  };

  // Combine user data with availability data
  const userAvailability = useMemo(() => {
    return users.map(user => {
      const userSlots = slots.filter(slot => slot.userId === user.id);
      const availableSlots = userSlots.filter(slot => slot.status === 'available');
      const unavailableSlots = userSlots.filter(slot => slot.status === 'unavailable');
      
      return {
        user,
        slots: userSlots,
        availableSlots,
        unavailableSlots,
        hasAvailability: userSlots.length > 0,
      };
    });
  }, [users, slots]);

  // Filter and sort by user name
  const filteredAndSortedUsers = useMemo(() => {
    let filtered = userAvailability;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(({ user }) => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
        const displayName = (user.displayName || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        return (
          fullName.includes(query) ||
          displayName.includes(query) ||
          email.includes(query)
        );
      });
    }

    // Sort by user name
    return filtered.sort((a, b) => {
      const nameA = a.user.displayName || `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email;
      const nameB = b.user.displayName || `${b.user.displayName || ''} ${b.user.lastName || ''}`.trim() || b.user.email;
      return nameA.localeCompare(nameB);
    });
  }, [userAvailability, searchQuery]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const totalMembers = users.length;
    const availableMembers = new Set(
      slots.filter(slot => slot.status === 'available').map(slot => slot.userId)
    ).size;
    const unavailableMembers = new Set(
      slots.filter(slot => slot.status === 'unavailable').map(slot => slot.userId)
    ).size;

    return {
      totalMembers,
      availableMembers,
      unavailableMembers,
    };
  }, [users, slots]);

  // Group events by date for rendering alongside availability
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      if (!event.scheduledEventDate) return;
      // Parse date string directly without timezone conversion
      // scheduledEventDate comes as "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS..."
      const dateStr = String(event.scheduledEventDate);
      const dateKey = dateStr.split('T')[0]; // Extract just the date portion
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(event);
    });
    Object.values(grouped).forEach((list) =>
      list.sort(
        (a, b) =>
          String(a.scheduledEventDate).localeCompare(String(b.scheduledEventDate))
      )
    );
    return grouped;
  }, [events]);

  // Generate week days for calendar view
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(calendarWeekStart, i));
    }
    return days;
  }, [calendarWeekStart]);

  // Calendar navigation functions
  const goToPreviousWeek = () => {
    const newStart = addDays(calendarWeekStart, -7);
    setCalendarWeekStart(newStart);
    setStartDate(newStart);
    setEndDate(endOfWeek(newStart, { weekStartsOn: 0 }));
  };

  const goToNextWeek = () => {
    const newStart = addDays(calendarWeekStart, 7);
    setCalendarWeekStart(newStart);
    setStartDate(newStart);
    setEndDate(endOfWeek(newStart, { weekStartsOn: 0 }));
  };

  const goToToday = () => {
    const today = startOfWeek(new Date(), { weekStartsOn: 0 });
    setCalendarWeekStart(today);
    setStartDate(today);
    setEndDate(endOfWeek(today, { weekStartsOn: 0 }));
  };

  // Get slots and events for a specific day
  const getSlotsForDay = (day: Date) => {
    return slots.filter(slot => {
      const slotStart = new Date(slot.startAt);
      const slotEnd = new Date(slot.endAt);
      return isSameDay(slotStart, day) || isSameDay(slotEnd, day) ||
        isWithinInterval(day, { start: slotStart, end: slotEnd });
    });
  };

  const getEventsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDate[dateKey] || [];
  };

  const getUserDisplayName = (user: User) => {
    if (user.displayName) return user.displayName;
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email;
  };

  if (isLoading) {
    return <LoadingState text="Loading team availability..." size="lg" />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Back Button Header */}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="page-title">
          Team Time Off & Unavailability
        </h1>
        <p className="text-gray-600" data-testid="page-description">
          Track team member time off and unavailability across selected date ranges
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <UserX className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Members On Time Off</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="stat-unavailable">
                {stats.unavailableMembers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Available Members</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-available">
                {stats.availableMembers}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Team Members</p>
              <p className="text-2xl font-bold text-gray-900" data-testid="stat-total">
                {stats.totalMembers}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* View Mode Toggle + Filters */}
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          {/* View Toggle and Title */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {viewMode === 'calendar' ? 'Calendar View' : 'Date Range Filter'}
            </h2>
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Calendar
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List
              </Button>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            /* Calendar View Navigation */
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-lg font-medium text-gray-900">
                {format(calendarWeekStart, 'MMMM d')} - {format(addDays(calendarWeekStart, 6), 'MMMM d, yyyy')}
              </div>
              {/* Search in Calendar View */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          ) : (
            /* List View Filters */
            <>
              {/* Date Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date
                  </label>
                  <DateTimePicker
                    date={startDate}
                    setDate={(date) => date && setStartDate(date)}
                    showTime={false}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date
                  </label>
                  <DateTimePicker
                    date={endDate}
                    setDate={(date) => date && setEndDate(date)}
                    showTime={false}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              {/* Quick Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quick Filters
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFilter('today')}
                    data-testid="button-filter-today"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFilter('this-week')}
                    data-testid="button-filter-this-week"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFilter('next-week')}
                    data-testid="button-filter-next-week"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    Next Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickFilter('this-month')}
                    data-testid="button-filter-this-month"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    This Month
                  </Button>
                </div>
              </div>

              {/* Search Bar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search by Name
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search team members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Showing availability from{' '}
                <span className="font-semibold" data-testid="text-date-range">
                  {format(startDate, 'MMM dd, yyyy')} to {format(endDate, 'MMM dd, yyyy')}
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Card className="p-6 mb-6">
          {/* Week Header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={`text-center p-2 font-semibold text-sm ${
                  isSameDay(day, new Date())
                    ? 'bg-blue-100 text-blue-800 rounded-t-lg'
                    : 'text-gray-700'
                }`}
              >
                <div>{format(day, 'EEE')}</div>
                <div className={`text-lg ${isSameDay(day, new Date()) ? 'text-blue-800' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 min-h-[500px]">
            {weekDays.map((day) => {
              const daySlots = getSlotsForDay(day);
              const dayEvents = getEventsForDay(day);
              const unavailableSlots = daySlots.filter(s => s.status === 'unavailable');
              const availableSlots = daySlots.filter(s => s.status === 'available');

              // Group slots by user for display
              const slotsByUser = new Map<string, { user: User | undefined; slots: typeof daySlots }>();
              daySlots.forEach(slot => {
                const user = users.find(u => u.id === slot.userId);
                if (!slotsByUser.has(slot.userId)) {
                  slotsByUser.set(slot.userId, { user, slots: [] });
                }
                slotsByUser.get(slot.userId)!.slots.push(slot);
              });

              // Filter by search query
              const filteredSlotsByUser = searchQuery
                ? Array.from(slotsByUser.entries()).filter(([_, { user }]) => {
                    if (!user) return false;
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
                    const displayName = (user.displayName || '').toLowerCase();
                    const email = (user.email || '').toLowerCase();
                    const query = searchQuery.toLowerCase();
                    return fullName.includes(query) || displayName.includes(query) || email.includes(query);
                  })
                : Array.from(slotsByUser.entries());

              return (
                <div
                  key={day.toISOString()}
                  className={`border rounded-lg p-2 min-h-[400px] ${
                    isSameDay(day, new Date())
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Events Section */}
                  {dayEvents.length > 0 && (
                    <div className="mb-3">
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="bg-purple-100 border border-purple-300 rounded p-1.5 mb-1 text-xs"
                        >
                          <div className="font-semibold text-purple-900 truncate">
                            {event.organizationName || event.title || 'Event'}
                          </div>
                          <div className="text-purple-700 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {event.startTime || 'TBD'}
                          </div>
                          {event.volunteers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {event.volunteers.slice(0, 3).map((vol) => (
                                <span
                                  key={vol.id}
                                  className="bg-purple-200 text-purple-800 px-1 py-0.5 rounded text-[10px]"
                                  title={`${vol.name} (${vol.role})`}
                                >
                                  {vol.name.split(' ')[0]}
                                </span>
                              ))}
                              {event.volunteers.length > 3 && (
                                <span className="text-purple-600 text-[10px]">
                                  +{event.volunteers.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time Off / Unavailability Section */}
                  {filteredSlotsByUser.length > 0 ? (
                    <div className="space-y-1">
                      {filteredSlotsByUser.map(([userId, { user, slots: userSlots }]) => {
                        const userUnavailable = userSlots.filter(s => s.status === 'unavailable');
                        const userAvailable = userSlots.filter(s => s.status === 'available');

                        if (userUnavailable.length === 0 && userAvailable.length === 0) return null;

                        return (
                          <div key={userId}>
                            {/* Unavailable (Time Off) */}
                            {userUnavailable.map((slot) => (
                              <div
                                key={slot.id}
                                className="bg-orange-100 border border-orange-300 rounded p-1.5 mb-1 text-xs"
                              >
                                <div className="font-semibold text-orange-900 truncate flex items-center gap-1">
                                  <UserX className="h-3 w-3" />
                                  {user ? getUserDisplayName(user) : 'Unknown'}
                                </div>
                                <div className="text-orange-700 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(slot.startAt), 'h:mm a')} - {format(new Date(slot.endAt), 'h:mm a')}
                                </div>
                                {slot.notes && (
                                  <div className="text-orange-600 text-[10px] mt-0.5 truncate" title={slot.notes}>
                                    {slot.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                            {/* Available */}
                            {userAvailable.map((slot) => (
                              <div
                                key={slot.id}
                                className="bg-green-50 border border-green-200 rounded p-1.5 mb-1 text-xs"
                              >
                                <div className="font-medium text-green-800 truncate flex items-center gap-1">
                                  <UserCheck className="h-3 w-3" />
                                  {user ? getUserDisplayName(user) : 'Unknown'}
                                </div>
                                <div className="text-green-600 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(slot.startAt), 'h:mm a')} - {format(new Date(slot.endAt), 'h:mm a')}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    dayEvents.length === 0 && (
                      <div className="text-gray-400 text-xs text-center mt-4">
                        No entries
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
              <span className="text-gray-600">Time Off / Unavailable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
              <span className="text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
              <span className="text-gray-600">Scheduled Event</span>
            </div>
          </div>
        </Card>
      )}

      {/* List View - Availability List */}
      {viewMode === 'list' && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Team Time Off Schedule
          </h2>

        {filteredAndSortedUsers.length === 0 ? (
          <div className="text-center py-12" data-testid="empty-state">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery
                ? 'No team members found matching your search'
                : 'No team members found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedUsers.map(({ user, slots, availableSlots, unavailableSlots, hasAvailability }) => (
              <div
                key={user.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                data-testid={`user-card-${user.id}`}
              >
                <div className="flex items-start gap-4">
                  {/* User Avatar/Photo */}
                  <div className="flex-shrink-0">
                    {user.profileImageUrl ? (
                      <img
                        src={user.profileImageUrl}
                        alt={getUserDisplayName(user)}
                        className="h-12 w-12 rounded-full object-cover"
                        data-testid={`img-avatar-${user.id}`}
                      />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center"
                        data-testid={`avatar-placeholder-${user.id}`}
                      >
                        <span className="text-blue-600 font-semibold text-lg">
                          {getUserDisplayName(user).charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* User Info and Availability */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3
                        className="text-lg font-semibold text-gray-900"
                        data-testid={`text-username-${user.id}`}
                      >
                        {getUserDisplayName(user)}
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-xs"
                        data-testid={`badge-role-${user.id}`}
                      >
                        {user.role}
                      </Badge>
                    </div>

                    {!hasAvailability ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <CalendarIcon className="h-4 w-4" />
                        <span className="text-sm" data-testid={`text-no-availability-${user.id}`}>
                          No availability set
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Unavailable Slots (shown first for prominence) */}
                        {unavailableSlots.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                className="bg-orange-100 text-orange-800 border-orange-300 font-semibold"
                                data-testid={`badge-unavailable-count-${user.id}`}
                              >
                                Time Off ({unavailableSlots.length})
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {unavailableSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-start gap-2 text-sm bg-orange-50 p-2 rounded border border-orange-300 font-medium"
                                  data-testid={`slot-unavailable-${slot.id}`}
                                >
                                  <Clock className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-gray-900 font-semibold">
                                      {format(new Date(slot.startAt), 'MMM dd, yyyy h:mm a')} -{' '}
                                      {format(new Date(slot.endAt), 'h:mm a')}
                                    </div>
                                    {slot.notes && (
                                      <div
                                        className="text-gray-700 mt-1"
                                        data-testid={`text-notes-${slot.id}`}
                                      >
                                        {slot.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Available Slots (shown second) */}
                        {availableSlots.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                className="bg-gray-100 text-gray-700 border-gray-300"
                                data-testid={`badge-available-count-${user.id}`}
                              >
                                Available ({availableSlots.length})
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              {availableSlots.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="flex items-start gap-2 text-sm bg-gray-50 p-2 rounded border border-gray-200"
                                  data-testid={`slot-available-${slot.id}`}
                                >
                                  <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-gray-700">
                                      {format(new Date(slot.startAt), 'MMM dd, yyyy h:mm a')} -{' '}
                                      {format(new Date(slot.endAt), 'h:mm a')}
                                    </div>
                                    {slot.notes && (
                                      <div
                                        className="text-gray-500 mt-1 text-xs"
                                        data-testid={`text-notes-${slot.id}`}
                                      >
                                        {slot.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </Card>
      )}

      {/* Scheduled Events with Assignments - Only show in list view */}
      {viewMode === 'list' && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Scheduled Events & Assignments</h2>
              <p className="text-gray-600">
                Who is assigned to events in the selected date range.
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {events.length} event{events.length === 1 ? '' : 's'}
            </Badge>
          </div>

          {Object.keys(eventsByDate).length === 0 ? (
            <Card className="p-4">
              <p className="text-gray-600">No scheduled events in this range.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {Object.entries(eventsByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateKey, dateEvents]) => (
                  <Card key={dateKey} className="p-4">
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {dateEvents.map((event) => {
                        const startTime =
                          event.startTime ||
                          (event.scheduledEventDate
                            ? format(new Date(event.scheduledEventDate), 'p')
                            : null);
                        const endTime =
                          event.endTime ||
                          (event.scheduledEventDate
                            ? format(new Date(event.scheduledEventDate), 'p')
                            : null);

                        return (
                          <div
                            key={event.id}
                            className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <div className="text-sm text-gray-600">
                                  {event.organizationName || 'Event'}
                                </div>
                                <div className="text-lg font-semibold text-gray-900">
                                  {event.title || 'Event'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {startTime
                                    ? `${startTime}${
                                        endTime && endTime !== startTime ? ` – ${endTime}` : ''
                                      }`
                                    : 'Time TBD'}
                                </div>
                                {event.eventAddress && (
                                  <div className="text-sm text-gray-500">{event.eventAddress}</div>
                                )}
                              </div>
                              <Badge variant="secondary" className="w-fit">
                                {event.status}
                              </Badge>
                            </div>
                            <div className="mt-3">
                              <div className="text-sm font-medium text-gray-800 mb-1">
                                Assigned team
                              </div>
                              {event.volunteers.length === 0 ? (
                                <div className="text-sm text-gray-500">No assignments yet.</div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {event.volunteers.map((volunteer) => (
                                    <Badge key={volunteer.id} variant="outline" className="text-sm">
                                      {volunteer.name}
                                      <span className="ml-1 text-gray-500">
                                        ({volunteer.role}, {volunteer.status})
                                      </span>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
