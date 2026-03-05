import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, Calendar as CalendarIcon2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { FloatingAIChat } from '@/components/floating-ai-chat';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  backgroundColor?: string;
  foregroundColor?: string;
}

export default function GoogleCalendarAvailability() {
  const { trackView, trackClick } = useActivityTracker();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [eventFilter, setEventFilter] = useState<'all' | 'unavailability' | 'events'>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Helper to get initials from event summary
  const getInitials = (summary: string): string => {
    const words = summary.trim().split(/\s+/);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return summary.substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    trackView(
      'Availability',
      'Availability',
      'Google Calendar Availability',
      'User accessed Google Calendar availability'
    );
  }, [trackView]);

  // Calculate month boundaries
  const monthStart = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return date;
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return date;
  }, [currentDate]);

  // Calculate week boundaries
  const weekStart = useMemo(() => {
    const today = new Date(currentDate);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }, [currentDate]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  // Determine which date range to use
  const dateStart = viewMode === 'week' ? weekStart : monthStart;
  const dateEnd = viewMode === 'week' ? weekEnd : monthEnd;

  // Fetch events for the current view
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google-calendar/events', dateStart.toISOString(), dateEnd.toISOString()],
    queryFn: async () => {
      return await apiRequest('GET', `/api/google-calendar/events?startDate=${dateStart.toISOString()}&endDate=${dateEnd.toISOString()}`);
    },
  });

  // Filter events based on selected filter
  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return events;
    
    const lowerKeywords = ['unavailable', 'unavail', 'out of town', 'away', 'vacation', 'travel'];
    
    return events.filter(event => {
      const summary = (event.summary || '').toLowerCase();
      const isUnavailability = lowerKeywords.some(keyword => summary.includes(keyword));
      
      if (eventFilter === 'unavailability') {
        return isUnavailability;
      } else if (eventFilter === 'events') {
        return !isUnavailability;
      }
      
      return true;
    });
  }, [events, eventFilter]);

  // Navigate months/weeks
  const goToPrevious = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    if (viewMode === 'week') {
      // Week view: show 7 days starting from week start
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const today = new Date();
        days.push({
          date,
          isCurrentMonth: true,
        });
      }
      return days;
    }

    // Month view: existing logic
    const days = [];
    const firstDayOfMonth = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    // Previous month's trailing days
    const prevMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
    const prevMonthDays = prevMonthEnd.getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
        isCurrentMonth: true,
      });
    }

    // Next month's leading days
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate, monthStart, monthEnd, weekStart, viewMode]);

  // Get events for a specific day (including multi-day events that span this day)
  const getEventsForDay = (date: Date) => {
    return filteredEvents.filter(event => {
      const isAllDay = !!event.start.date;
      const startDateStr = event.start.date || event.start.dateTime?.split('T')[0];
      const endDateStr = event.end.date || event.end.dateTime?.split('T')[0];

      if (!startDateStr) return false;

      // Parse start date
      const startParts = startDateStr.split('-');
      const startYear = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]) - 1;
      const startDay = parseInt(startParts[2]);

      // Parse end date (if exists)
      const endParts = endDateStr?.split('-');
      const endYear = endParts ? parseInt(endParts[0]) : startYear;
      const endMonth = endParts ? parseInt(endParts[1]) - 1 : startMonth;
      const endDay = endParts ? parseInt(endParts[2]) : startDay;

      const checkYear = date.getFullYear();
      const checkMonth = date.getMonth();
      const checkDay = date.getDate();

      // Create date objects for comparison
      const startDate = new Date(startYear, startMonth, startDay);
      let endDate = new Date(endYear, endMonth, endDay);

      // For timed events (not all-day), the end date is inclusive (same day)
      // For all-day events, the end date is exclusive (next day)
      if (!isAllDay) {
        // For timed events, if start and end are on same day, still show it on that day
        // Add 1 day to make comparison work
        endDate = new Date(endYear, endMonth, endDay + 1);
      }

      const checkDate = new Date(checkYear, checkMonth, checkDay);

      return checkDate >= startDate && checkDate < endDate;
    });
  };

  // Helper to check if an event spans multiple days
  const isMultiDayEvent = (event: CalendarEvent | null) => {
    if (!event || !event.start || !event.end) return false;
    const startDateStr = event.start.date || event.start.dateTime?.split('T')[0];
    const endDateStr = event.end.date || event.end.dateTime?.split('T')[0];

    if (!startDateStr || !endDateStr) return false;

    // Parse dates manually to avoid timezone issues
    const startParts = startDateStr.split('-');
    const endParts = endDateStr.split('-');

    const startYear = parseInt(startParts[0]);
    const startMonth = parseInt(startParts[1]);
    const startDay = parseInt(startParts[2]);

    const endYear = parseInt(endParts[0]);
    const endMonth = parseInt(endParts[1]);
    const endDay = parseInt(endParts[2]);

    // Compare dates - if end date is different from start date, it's multi-day
    // Note: Google Calendar end dates for all-day events are exclusive (day after last day)
    if (endYear !== startYear) return true;
    if (endMonth !== startMonth) return true;
    return endDay > startDay + 1; // More than 1 day difference (accounting for exclusive end)
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date().toDateString();
  
  // Format week range for display
  const weekRange = useMemo(() => {
    if (viewMode === 'month') return monthYear;
    const weekEndDisplay = new Date(weekEnd);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDisplay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [viewMode, monthYear, weekStart, weekEnd]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                TSP Volunteer Availability
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Live view with event colors from Google Calendar
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[150px] text-center">
              {weekRange}
            </span>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* View Mode Toggle & Filters */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">View:</span>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              <Clock className="w-4 h-4 mr-1" />
              Week
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              <CalendarIcon2 className="w-4 h-4 mr-1" />
              Month
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Filter:</span>
            <Button
              variant={eventFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEventFilter('all')}
            >
              All
            </Button>
            <Button
              variant={eventFilter === 'unavailability' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEventFilter('unavailability')}
            >
              <Eye className="w-4 h-4 mr-1" />
              Unavailability
            </Button>
            <Button
              variant={eventFilter === 'events' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEventFilter('events')}
            >
              <CalendarIcon2 className="w-4 h-4 mr-1" />
              Events
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dayEvents = getEventsForDay(day.date);
              const isToday = day.date.toDateString() === today;

              return (
                <div
                  key={index}
                  className={`${viewMode === 'week' ? 'min-h-[200px]' : 'min-h-[120px]'} border-r border-b border-slate-200 dark:border-slate-700 p-2 ${
                    !day.isCurrentMonth ? 'bg-slate-50 dark:bg-slate-900' : ''
                  } ${isToday ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
                >
                  <div className={`text-sm mb-1 ${
                    !day.isCurrentMonth ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                  } ${isToday ? 'font-bold text-blue-600 dark:text-blue-400' : ''}`}>
                    {day.date.getDate()}
                  </div>

                  {/* Events for this day */}
                  <div className="space-y-1">
                    {dayEvents.map((event, eventIndex) => {
                      const isMultiDay = isMultiDayEvent(event);
                      return (
                        <button
                          key={event.id || eventIndex}
                          onClick={() => setSelectedEvent(event)}
                          className="w-full text-left text-xs px-1.5 sm:px-2 py-1 rounded font-medium cursor-pointer hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: event.backgroundColor || '#a4bdfc',
                            color: event.foregroundColor || '#1d1d1d',
                          }}
                          title={`${event.summary}${isMultiDay ? ' (Multi-day event)' : ''}${event.description ? '\n' + event.description : ''}`}
                        >
                          {/* Show initials on mobile, full text on desktop */}
                          <span className="sm:hidden">
                            {isMultiDay && '→ '}
                            {getInitials(event.summary)}
                          </span>
                          <span className="hidden sm:inline truncate block">
                            {isMultiDay && '→ '}
                            {event.summary}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {isLoading ? 'Loading events...' : `Showing ${filteredEvents.length} of ${events.length} events with their original Google Calendar colors`}
          </span>
        </div>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle 
              className="text-base sm:text-lg"
              style={{ color: selectedEvent?.foregroundColor || '#1d1d1d' }}
            >
              {selectedEvent?.summary}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              <span>
                {selectedEvent?.start.dateTime 
                  ? new Date(selectedEvent.start.dateTime).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : selectedEvent?.start.date
                    ? new Date(selectedEvent.start.date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      }) + ' (All day)'
                    : 'Time not set'
                }
                {selectedEvent?.end.dateTime && selectedEvent.start.dateTime && 
                  selectedEvent.end.dateTime.split('T')[0] === selectedEvent.start.dateTime.split('T')[0] && (
                    <> - {new Date(selectedEvent.end.dateTime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    })}</>
                  )
                }
              </span>
            </div>
            {selectedEvent?.description && (
              <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                {selectedEvent.description}
              </div>
            )}
            {isMultiDayEvent(selectedEvent) && (
              <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                This is a multi-day event
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="volunteer-calendar"
        title="Availability Assistant"
        subtitle="Ask about volunteer availability"
        contextData={{
          currentView: viewMode,
          filters: {
            eventFilter,
            currentMonth: currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          },
          summaryStats: {
            totalEvents: events.length,
            filteredEvents: filteredEvents.length,
          },
        }}
        getFullContext={() => ({
          rawData: filteredEvents.map(event => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            startDate: event.start.dateTime || event.start.date,
            endDate: event.end.dateTime || event.end.date,
          })),
        })}
        suggestedQuestions={[
          "Who is unavailable this week?",
          "What events are scheduled for this month?",
          "When are most volunteers unavailable?",
          "Show me upcoming unavailability",
        ]}
      />
    </div>
  );
}
