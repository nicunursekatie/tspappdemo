import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Sandwich,
  Filter,
  AlertTriangle,
  Truck,
  EyeOff,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventRequest } from '@shared/schema';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEventAssignments } from '@/components/event-requests/hooks/useEventAssignments';
import { getUnfilledCounts } from '@/lib/assignment-utils';

interface EventCalendarViewProps {
  onEventClick?: (event: EventRequest) => void;
  events?: EventRequest[]; // Optional: pre-filtered events (e.g., only volunteer opportunities)
  filterByNeeds?: boolean; // If true, only show events that need speakers or volunteers
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new':
      return 'bg-brand-primary-light text-brand-primary-dark border-brand-primary-border-strong';
    case 'in_process':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'scheduled':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'completed':
      return 'bg-navy-100 text-navy-800 border-navy-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

// Helper function to calculate unfilled needs for an event using centralized utils
// Self-transport suppresses driver needs since the group handles their own transport
const getUnfilledNeeds = (event: EventRequest) => {
  const counts = getUnfilledCounts(event);
  const driversSuppressed = !!event.selfTransport;

  return {
    needsSpeaker: counts.speakersUnfilled > 0,
    needsVolunteer: counts.volunteersUnfilled > 0,
    needsDriver: !driversSuppressed && counts.driversUnfilled > 0,
    speakersUnfilled: counts.speakersUnfilled,
    volunteersUnfilled: counts.volunteersUnfilled,
    driversUnfilled: driversSuppressed ? 0 : counts.driversUnfilled,
  };
};

// Helper function to get assigned staff names for an event
const getAssignedStaffNames = (event: EventRequest, resolveUserName: (id: string | undefined) => string) => {
  const assigned = [];

  // Van driver
  if (event.assignedVanDriverId) {
    const name = resolveUserName(event.assignedVanDriverId);
    if (name && name !== 'Not assigned') {
      assigned.push({ type: 'van', name, icon: '🚐' });
    }
  }

  if (event.isDhlVan) {
    assigned.push({ type: 'van', name: 'DHL Van', icon: '🚚' });
  }

  // Drivers
  if (event.assignedDriverIds && Array.isArray(event.assignedDriverIds) && event.assignedDriverIds.length > 0) {
    event.assignedDriverIds.forEach((id) => {
      const name = resolveUserName(id);
      if (name && name !== 'Not assigned') {
        assigned.push({ type: 'driver', name, icon: '🚗' });
      }
    });
  }

  // Speakers
  if (event.assignedSpeakerIds && Array.isArray(event.assignedSpeakerIds) && event.assignedSpeakerIds.length > 0) {
    event.assignedSpeakerIds.forEach((id) => {
      const name = resolveUserName(id);
      if (name && name !== 'Not assigned') {
        assigned.push({ type: 'speaker', name, icon: '🎤' });
      }
    });
  }

  // Volunteers
  if (event.assignedVolunteerIds && Array.isArray(event.assignedVolunteerIds) && event.assignedVolunteerIds.length > 0) {
    event.assignedVolunteerIds.forEach((id) => {
      const name = resolveUserName(id);
      if (name && name !== 'Not assigned') {
        assigned.push({ type: 'volunteer', name, icon: '👥' });
      }
    });
  }

  return assigned;
};

// Helper function to get sandwich information for an event
const getSandwichInfo = (event: EventRequest) => {
  const sandwichInfo = [];

  // Check for estimated sandwich count
  if (event.estimatedSandwichCount && event.estimatedSandwichCount > 0) {
    sandwichInfo.push({
      icon: Sandwich,
      count: event.estimatedSandwichCount,
      color: 'text-[#fbad3f]',
      tooltip: `${event.estimatedSandwichCount} sandwiches estimated`,
    });
  }
  // Check for sandwich range (min-max)
  else if (
    (event as any).estimatedSandwichCountMin &&
    (event as any).estimatedSandwichCountMax
  ) {
    const min = (event as any).estimatedSandwichCountMin;
    const max = (event as any).estimatedSandwichCountMax;
    const rangeType = (event as any).estimatedSandwichRangeType;

    let rangeText = `${min}-${max}`;
    if (rangeType) {
      rangeText += ` ${rangeType}`;
    }

    sandwichInfo.push({
      icon: Sandwich,
      count: null,
      countText: rangeText,
      color: 'text-[#fbad3f]',
      tooltip: `${min}-${max} sandwiches estimated${rangeType ? ` (${rangeType})` : ''}`,
    });
  }

  // Check for actual sandwich count (for completed events)
  if (event.actualSandwichCount && event.actualSandwichCount > 0) {
    sandwichInfo.push({
      icon: Sandwich,
      count: event.actualSandwichCount,
      color: 'text-[#fbad3f]',
      tooltip: `${event.actualSandwichCount} sandwiches delivered`,
    });
  }

  // Check for sandwich types (if available)
  if (
    event.sandwichTypes &&
    Array.isArray(event.sandwichTypes) &&
    event.sandwichTypes.length > 0
  ) {
    const typesText = event.sandwichTypes
      .map((type) => `${type.quantity} ${type.type}`)
      .join(', ');
    sandwichInfo.push({
      icon: Sandwich,
      count: null,
      color: 'text-[#fbad3f]',
      tooltip: `Types: ${typesText}`,
      showTypes: true,
      types: event.sandwichTypes,
    });
  }

  return sandwichInfo;
};

// Helper function to parse time string to minutes since midnight
const parseTimeToMinutes = (timeStr: string | null | undefined): number | null => {
  if (!timeStr) return null;

  // Try parsing "HH:MM AM/PM" format
  const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = parseInt(amPmMatch[2], 10);
    const period = amPmMatch[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  return null;
};

// Helper function to format a time string to 12-hour AM/PM format
const formatTimeTo12Hour = (timeStr: string | null | undefined): string | null => {
  if (!timeStr) return null;

  // Already in AM/PM format — just return as-is
  if (/AM|PM/i.test(timeStr)) return timeStr;

  // Parse "HH:MM" (24-hour) format
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${hours}:${minutes} ${period}`;
  }

  return timeStr; // Return original if unparseable
};

// Helper function to check if two time ranges overlap
const timesOverlap = (
  start1: number | null,
  end1: number | null,
  start2: number | null,
  end2: number | null
): boolean => {
  if (start1 === null || end1 === null || start2 === null || end2 === null) {
    return true; // Conservative: assume overlap if we can't determine
  }
  return start1 < end2 && start2 < end1;
};

// Helper function to detect conflicts within a day's events
interface DayConflicts {
  hasConflicts: boolean;
  vanConflicts: number;
  driverConflicts: number;
  highVolume: boolean;
  tooltip: string;
}

const detectDayConflicts = (dayEvents: EventRequest[]): DayConflicts => {
  // Include new, in_process, scheduled, and rescheduled events for conflict detection
  const relevantEvents = dayEvents.filter(
    e => e.status === 'new' || e.status === 'in_process' || e.status === 'scheduled' || e.status === 'rescheduled'
  );
  // For van/driver conflicts, only check scheduled events (locked in dates)
  const scheduledEvents = dayEvents.filter(
    e => e.status === 'scheduled'
  );

  let vanConflicts = 0;
  let driverConflicts = 0;
  const tooltipParts: string[] = [];

  // Check for high volume day (count all relevant events including new and in-process)
  const highVolume = relevantEvents.length >= 3;
  if (highVolume) {
    const scheduledCount = scheduledEvents.length;
    const pendingCount = relevantEvents.length - scheduledCount;
    if (pendingCount > 0) {
      tooltipParts.push(`${scheduledCount} scheduled + ${pendingCount} pending = ${relevantEvents.length} events`);
    } else {
      tooltipParts.push(`${relevantEvents.length} events scheduled`);
    }
  }

  // Check each pair for conflicts
  for (let i = 0; i < scheduledEvents.length; i++) {
    const event1 = scheduledEvents[i];
    const start1 = parseTimeToMinutes(event1.eventStartTime);
    const end1 = parseTimeToMinutes(event1.eventEndTime);

    for (let j = i + 1; j < scheduledEvents.length; j++) {
      const event2 = scheduledEvents[j];
      const start2 = parseTimeToMinutes(event2.eventStartTime);
      const end2 = parseTimeToMinutes(event2.eventEndTime);

      const hasTimeOverlap = timesOverlap(start1, end1, start2, end2);

      // Check van conflict
      const event1NeedsVan = !event1.isDhlVan && (event1.assignedVanDriverId || (event1.vanBooked && event1.vanBooked.toLowerCase() !== 'no'));
      const event2NeedsVan = !event2.isDhlVan && (event2.assignedVanDriverId || (event2.vanBooked && event2.vanBooked.toLowerCase() !== 'no'));

      if (event1NeedsVan && event2NeedsVan && hasTimeOverlap) {
        vanConflicts++;
        if (vanConflicts === 1) {
          tooltipParts.push('Van conflict detected');
        }
      }

      // Check driver conflict
      if (event1.assignedVanDriverId && event2.assignedVanDriverId &&
          event1.assignedVanDriverId === event2.assignedVanDriverId && hasTimeOverlap) {
        driverConflicts++;
        if (driverConflicts === 1) {
          tooltipParts.push('Same driver assigned to multiple events');
        }
      }
    }
  }

  return {
    hasConflicts: vanConflicts > 0 || driverConflicts > 0 || highVolume,
    vanConflicts,
    driverConflicts,
    highVolume,
    tooltip: tooltipParts.join(' • ') || 'No conflicts',
  };
};

export function EventCalendarView({ onEventClick, events: providedEvents, filterByNeeds = false }: EventCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [statusFilters, setStatusFilters] = useState<string[]>([
    'new',
    'in_process',
    'scheduled',
    'completed',
    'cancelled',
  ]);
  const [hideCancelled, setHideCancelled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Track screen size for responsive event display
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get resolveUserName function for displaying assigned staff names
  const { resolveUserName } = useEventAssignments();

  // Fetch all event requests if not provided
  const { data: fetchedEvents = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
    enabled: !providedEvents, // Only fetch if events aren't provided
  });

  // Use provided events or fetched events
  const events = providedEvents || fetchedEvents;

  // Filter events by selected statuses and optionally by speaker/volunteer needs
  const filteredEvents = useMemo(() => {
    let filtered = events.filter((event) => statusFilters.includes(event.status));

    // Hide cancelled events when the toggle is active
    if (hideCancelled) {
      filtered = filtered.filter((event) => event.status !== 'cancelled');
    }

    // If filterByNeeds is true, only show events that need speakers or volunteers
    if (filterByNeeds) {
      filtered = filtered.filter((event) => {
        const needsSpeaker = !event.speakerId || event.speakerId === null || event.speakerId === '' ||
          (event.speakersNeeded && event.speakersNeeded > 0);
        const needsVolunteer = !event.volunteerId || event.volunteerId === null || event.volunteerId === '' ||
          (event.volunteersNeeded && event.volunteersNeeded > 0);
        return needsSpeaker || needsVolunteer;
      });
    }

    return filtered;
  }, [events, statusFilters, filterByNeeds, hideCancelled]);

  const toggleStatusFilter = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  // Get the first and last day of the current month
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const lastDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  // Calculate calendar grid (including days from previous/next month)
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const startDay = firstDayOfMonth.getDay(); // 0 = Sunday

    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(firstDayOfMonth);
      date.setDate(date.getDate() - (i + 1));
      days.push(date);
    }

    // Add days from current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(lastDayOfMonth);
      date.setDate(date.getDate() + i);
      days.push(date);
    }

    return days;
  }, [firstDayOfMonth, lastDayOfMonth, currentDate]);

  // Group events by date, sorting cancelled events to the bottom
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventRequest[]>();

    filteredEvents.forEach((event) => {
      // Use scheduledEventDate if available, otherwise use desiredEventDate
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      if (!eventDate) return;

      const dateStr = new Date(eventDate).toISOString().split('T')[0];
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr)!.push(event);
    });

    // Sort each date's events so cancelled events appear at the bottom
    grouped.forEach((events, dateStr) => {
      events.sort((a, b) => {
        const aIsCancelled = a.status === 'cancelled' ? 1 : 0;
        const bIsCancelled = b.status === 'cancelled' ? 1 : 0;
        return aIsCancelled - bIsCancelled;
      });
    });

    return grouped;
  }, [filteredEvents]);

  // Compute weekly sandwich summaries for the at-a-glance panel
  const weeklySandwichSummary = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Build weeks: each week is Sun-Sat within this month
    const weeks: { start: number; end: number; sandwiches: number; events: number }[] = [];
    let weekStart = 1;

    while (weekStart <= daysInMonth) {
      const startDate = new Date(year, month, weekStart);
      const dayOfWeek = startDate.getDay(); // 0=Sun
      // End of week = Saturday or end of month
      const daysUntilSat = 6 - dayOfWeek;
      const weekEnd = Math.min(weekStart + daysUntilSat, daysInMonth);

      let sandwiches = 0;
      let eventCount = 0;

      // Sum sandwiches from all non-cancelled events in this week
      for (let d = weekStart; d <= weekEnd; d++) {
        const dateStr = new Date(year, month, d).toISOString().split('T')[0];
        const dayEvts = eventsByDate.get(dateStr) || [];
        dayEvts.forEach((evt) => {
          if (evt.status === 'cancelled') return;
          eventCount++;
          if (evt.estimatedSandwichCount && evt.estimatedSandwichCount > 0) {
            sandwiches += evt.estimatedSandwichCount;
          } else if (evt.actualSandwichCount && evt.actualSandwichCount > 0) {
            sandwiches += evt.actualSandwichCount;
          }
        });
      }

      weeks.push({ start: weekStart, end: weekEnd, sandwiches, events: eventCount });
      weekStart = weekEnd + 1;
    }

    const totalSandwiches = weeks.reduce((sum, w) => sum + w.sandwiches, 0);
    return { weeks, totalSandwiches };
  }, [currentDate, eventsByDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const toggleDateExpansion = (dateKey: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  return (
    <TooltipProvider>
    <Card className="w-full">
      <CardHeader className="pb-2 sm:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-2xl">
            <CalendarIcon className="w-5 h-5 sm:w-7 sm:h-7" />
            Event Calendar
          </CardTitle>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Button
              variant={hideCancelled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setHideCancelled(!hideCancelled)}
              className={cn(
                'px-2 sm:px-3',
                hideCancelled && 'bg-red-600 hover:bg-red-700 text-white'
              )}
              title={hideCancelled ? 'Show cancelled events' : 'Hide cancelled events'}
            >
              {hideCancelled ? (
                <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              ) : (
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">
                {hideCancelled ? 'Cancelled Hidden' : 'Hide Cancelled'}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2 sm:px-3">
                  <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Filter Status</span>
                  {statusFilters.length < 5 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-[10px] sm:text-xs">
                      {statusFilters.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={statusFilters.includes('new')}
                  onCheckedChange={() => toggleStatusFilter('new')}
                >
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 mr-2">
                    New
                  </Badge>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilters.includes('in_process')}
                  onCheckedChange={() => toggleStatusFilter('in_process')}
                >
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mr-2">
                    In Process
                  </Badge>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilters.includes('scheduled')}
                  onCheckedChange={() => toggleStatusFilter('scheduled')}
                >
                  <Badge className="bg-green-100 text-green-800 border-green-300 mr-2">
                    Scheduled
                  </Badge>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilters.includes('completed')}
                  onCheckedChange={() => toggleStatusFilter('completed')}
                >
                  <Badge className="bg-teal-100 text-teal-800 border-teal-300 mr-2">
                    Completed
                  </Badge>
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={statusFilters.includes('cancelled')}
                  onCheckedChange={() => toggleStatusFilter('cancelled')}
                >
                  <Badge className="bg-red-100 text-red-800 border-red-300 mr-2">
                    Cancelled
                  </Badge>
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={goToToday} className="px-2 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousMonth} className="w-8 h-8 sm:w-10 sm:h-10" aria-label="Go to previous month">
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="flex-1 min-w-0 text-center font-bold text-sm sm:text-lg truncate px-1 sm:px-2">
              <span className="sm:hidden">{MONTH_NAMES[currentDate.getMonth()].slice(0, 3)} {currentDate.getFullYear()}</span>
              <span className="hidden sm:inline">{MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            </div>
            <Button variant="outline" size="icon" onClick={goToNextMonth} className="w-8 h-8 sm:w-10 sm:h-10" aria-label="Go to next month">
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {/* Legend - hidden on mobile */}
        <div className="hidden sm:block mb-6 pb-4 border-b space-y-4">
          {/* Status Legend */}
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm font-semibold text-gray-800">Status:</span>
            <Badge className="bg-brand-primary-light text-brand-primary-dark border-brand-primary-border-strong text-xs px-2 py-1">
              New
            </Badge>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs px-2 py-1">
              In Process
            </Badge>
            <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-2 py-1">
              Scheduled
            </Badge>
            <Badge className="bg-navy-100 text-navy-800 border-navy-300 text-xs px-2 py-1">
              Completed
            </Badge>
            <Badge className="bg-red-100 text-red-800 border-red-300 text-xs px-2 py-1">
              Cancelled
            </Badge>
          </div>

          {/* Unfilled Needs Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-semibold text-gray-800">
              Unfilled Needs:
            </span>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#1e40af' }}>
              Need Driver
            </span>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#7e22ce' }}>
              Need Speaker
            </span>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#15803d' }}>
              Need Volunteer
            </span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
              <span className="text-xs text-gray-700">Day has unfilled needs</span>
            </div>
          </div>

          {/* Sandwich Information Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-semibold text-gray-800">
              Sandwiches:
            </span>
            <div className="flex items-center gap-1.5">
              <Sandwich className="w-4 h-4 text-[#fbad3f]" />
              <span className="text-xs text-gray-700">Count & Types</span>
            </div>
          </div>

          {/* Conflict Indicators Legend */}
          <div className="flex flex-wrap gap-4 items-center">
            <span className="text-sm font-semibold text-gray-800">
              Scheduling Alerts:
            </span>
            <div className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-red-600" />
              <span className="text-xs text-gray-700">Van Conflict</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-red-600" />
              <span className="text-xs text-gray-700">Driver Conflict</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-xs text-gray-700">Busy Day (3+ events)</span>
            </div>
          </div>
        </div>

        {/* Month At-a-Glance Sandwich Summary */}
        <div className="hidden sm:block mb-4 rounded-lg overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a365d, #2c5282)' }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-white font-bold text-sm tracking-wide uppercase">
              {MONTH_NAMES[currentDate.getMonth()]} At-a-Glance
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-base font-extrabold" style={{ backgroundColor: '#fbad3f', color: '#1a365d' }}>
              {weeklySandwichSummary.totalSandwiches.toLocaleString()} sandwiches
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 px-4 pb-3">
            {weeklySandwichSummary.weeks.map((week, idx) => (
              <div key={idx} className="rounded-md px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <div className="text-white/70 text-[11px] font-medium">
                  Week {idx + 1}: {MONTH_NAMES[currentDate.getMonth()].slice(0, 3)} {week.start}-{week.end}
                </div>
                <div className="text-2xl font-extrabold" style={{ color: '#fbad3f' }}>
                  {week.sandwiches > 0 ? `${week.sandwiches.toLocaleString()}` : '0'}
                </div>
                <div className="text-white/50 text-[10px]">{week.events} events</div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {/* Day headers */}
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="p-1 sm:p-2 text-center font-semibold text-[10px] sm:text-sm text-gray-700 bg-gray-100 rounded"
            >
              <span className="sm:hidden">{day.charAt(0)}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((date, index) => {
            const dateKey = getDateKey(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurrentMonthDay = isCurrentMonth(date);
            const isTodayDay = isToday(date);
            const isExpanded = expandedDates.has(dateKey);
            const dayConflicts = detectDayConflicts(dayEvents);
            const isSaturday = index % 7 === 6;
            // Check if any event on this day has truly unfilled needs
            const dayHasUnfilledNeeds = dayEvents.some((evt) => {
              if (evt.status === 'cancelled' || evt.status === 'completed') return false;
              const needs = getUnfilledNeeds(evt);
              return needs.needsSpeaker || needs.needsVolunteer || needs.needsDriver;
            });
            // Calculate Saturday weekly sandwich totals
            const saturdaySandwichTotal = isSaturday ? (() => {
              let total = 0;
              for (let d = index - 6; d <= index; d++) {
                if (d < 0 || d >= calendarDays.length) continue;
                const dk = getDateKey(calendarDays[d]);
                const evts = eventsByDate.get(dk) || [];
                evts.forEach((evt) => {
                  if (evt.status === 'cancelled') return;
                  if (evt.estimatedSandwichCount && evt.estimatedSandwichCount > 0) {
                    total += evt.estimatedSandwichCount;
                  } else if (evt.actualSandwichCount && evt.actualSandwichCount > 0) {
                    total += evt.actualSandwichCount;
                  }
                });
              }
              return total;
            })() : 0;

            return (
              <div
                key={index}
                className={cn(
                  'min-h-[100px] sm:min-h-[140px] border rounded-md sm:rounded-lg p-1 sm:p-2',
                  isCurrentMonthDay
                    ? 'bg-white border-gray-200'
                    : 'bg-gray-50 border-gray-100',
                  isTodayDay && 'ring-2 ring-blue-500',
                  dayConflicts.vanConflicts > 0 && 'border-red-300 bg-red-50/50',
                  dayConflicts.highVolume && !dayConflicts.vanConflicts && 'border-yellow-300 bg-yellow-50/30',
                  isSaturday && 'border-b-[3px] border-b-[#1a365d]'
                )}
                style={dayHasUnfilledNeeds ? { border: '2px solid #ef4444' } : undefined}
              >
                {/* Date number and conflict indicator */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    {dayHasUnfilledNeeds && (
                      <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                    )}
                    <div
                      className={cn(
                        'text-sm font-semibold',
                        isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400',
                        isTodayDay &&
                          'bg-brand-primary-lighter text-white rounded-full w-6 h-6 flex items-center justify-center text-xs'
                      )}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                  {/* Conflict indicator with tooltip */}
                  {dayConflicts.hasConflicts && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'flex items-center gap-0.5 cursor-help',
                            dayConflicts.vanConflicts > 0 ? 'text-red-600' : 'text-yellow-600'
                          )}
                        >
                          {dayConflicts.vanConflicts > 0 && (
                            <Truck className="w-3.5 h-3.5" />
                          )}
                          {dayConflicts.driverConflicts > 0 && (
                            <Users className="w-3.5 h-3.5" />
                          )}
                          {dayConflicts.highVolume && (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[250px]">
                        <div className="space-y-1 text-xs">
                          <div className="font-semibold text-sm">Scheduling Alerts</div>
                          {dayConflicts.vanConflicts > 0 && (
                            <div className="flex items-center gap-1.5 text-red-600">
                              <Truck className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Van conflict - multiple events need the van</span>
                            </div>
                          )}
                          {dayConflicts.driverConflicts > 0 && (
                            <div className="flex items-center gap-1.5 text-red-600">
                              <Users className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Driver conflict - same driver assigned to overlapping events</span>
                            </div>
                          )}
                          {dayConflicts.highVolume && (
                            <div className="flex items-center gap-1.5 text-yellow-600">
                              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{dayConflicts.tooltip}</span>
                            </div>
                          )}
                          <div className="text-muted-foreground pt-1 border-t mt-1">
                            Consider suggesting alternate dates for new requests
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Events for this day - 2 on mobile, 3 on desktop */}
                <div className="space-y-0.5 sm:space-y-1">
                  {(isExpanded ? dayEvents : dayEvents.slice(0, isMobile ? 2 : 3)).map((event) => {
                    const sandwichInfo = getSandwichInfo(event);
                    const assignedStaff = getAssignedStaffNames(event, resolveUserName);
                    const unfilledNeeds = getUnfilledNeeds(event);
                    const hasSandwichData = !!(event.estimatedSandwichCount || event.actualSandwichCount ||
                      (event.sandwichTypes && Array.isArray(event.sandwichTypes) && event.sandwichTypes.length > 0));
                    const isDetailsPending = event.status === 'in_process' && !hasSandwichData;

                    return (
                      <button
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className={cn(
                          'w-full text-left text-[10px] sm:text-xs p-1 sm:p-1.5 rounded border hover:shadow-md transition-shadow',
                          getStatusColor(event.status),
                          event.status === 'cancelled' && 'opacity-50',
                          event.status === 'completed' && 'opacity-70',
                        )}
                        style={{
                          borderLeft: event.status === 'cancelled' ? '3px solid #ef4444'
                            : event.status === 'completed' ? '3px solid #9ca3af'
                            : event.status === 'scheduled' ? '3px solid #22c55e'
                            : event.status === 'in_process' ? '3px solid #f59e0b'
                            : undefined
                        }}
                        title={`${event.organizationName} - ${event.status}`}
                      >
                        {event.status === 'cancelled' && (
                          <div className="font-bold text-[9px] sm:text-[11px] uppercase tracking-wide text-red-900 bg-red-200/80 rounded px-1 py-0.5 mb-0.5 text-center">
                            Cancelled
                          </div>
                        )}
                        <div className={cn(
                          "font-semibold mb-0.5 sm:mb-1 text-[11px] sm:text-[14px] break-words leading-tight line-clamp-2",
                          event.status === 'cancelled' && 'line-through'
                        )}>
                          {event.organizationName}
                        </div>

                        {/* Unfilled needs text badges */}
                        {(unfilledNeeds.needsSpeaker || unfilledNeeds.needsVolunteer || unfilledNeeds.needsDriver) && (
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1 mb-0.5 sm:mb-1">
                            {unfilledNeeds.needsDriver && (
                              <span className="inline-block px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#1e40af' }}>
                                Need Driver
                              </span>
                            )}
                            {unfilledNeeds.needsSpeaker && (
                              <span className="inline-block px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#7e22ce' }}>
                                Need Speaker
                              </span>
                            )}
                            {unfilledNeeds.needsVolunteer && (
                              <span className="inline-block px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] font-bold uppercase text-white" style={{ backgroundColor: '#15803d' }}>
                                Need Volunteer
                              </span>
                            )}
                          </div>
                        )}

                        {/* Details pending badge for in-process events missing sandwich data */}
                        {isDetailsPending && (
                          <div
                            className="mt-0.5 sm:mt-1 inline-block rounded text-[8px] sm:text-[9px] font-bold uppercase"
                            style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px dashed #f59e0b', padding: '1px 4px' }}
                          >
                            Details Pending
                          </div>
                        )}

                        {/* Assigned staff names - hidden on mobile for space */}
                        {assignedStaff.length > 0 && (
                          <div className="hidden sm:block mt-1 space-y-0.5">
                            {assignedStaff.slice(0, 3).map((staff, idx) => (
                              <div key={idx} className="text-[10px] truncate flex items-center gap-1">
                                <span>{staff.icon}</span>
                                <span className="font-medium">{staff.name}</span>
                              </div>
                            ))}
                            {assignedStaff.length > 3 && (
                              <div className="text-[10px] opacity-75">+{assignedStaff.length - 3} more</div>
                            )}
                          </div>
                        )}

                        {/* Sandwich information - compact on mobile, detailed on desktop */}
                        {sandwichInfo.length > 0 && (
                          <div className="mt-0.5 sm:mt-1">
                            {/* Mobile: just icon + count */}
                            <div className="flex sm:hidden items-center gap-0.5">
                              <Sandwich className="w-3.5 h-3.5 text-[#fbad3f]" />
                              <span className="text-[10px] font-semibold">
                                {(sandwichInfo[0] as any).countText || sandwichInfo[0].count || ''}
                              </span>
                            </div>
                            {/* Desktop: full details */}
                            <div className="hidden sm:block">
                            {/* If we have sandwich types, show them with one icon */}
                            {sandwichInfo.some(info => info.showTypes) ? (
                              <div className="flex items-start gap-1">
                                <Sandwich className="w-5 h-5 text-[#fbad3f] flex-shrink-0" />
                                <div className="text-xs">
                                  {sandwichInfo.map((info, idx) => (
                                    info.showTypes && info.types ? (
                                      info.types.slice(0, 2).map((type, typeIdx) => {
                                        // Process sandwich type name - keep it short
                                        let displayType = type.type.toLowerCase().replace('sandwiches', '').replace('sandwich', '').trim();

                                        // Handle deli_turkey, deli_ham formats
                                        if (displayType === 'deli_turkey' || displayType === 'deli (turkey)') {
                                          displayType = 'turkey';
                                        } else if (displayType === 'deli_ham' || displayType === 'deli (ham)') {
                                          displayType = 'ham';
                                        } else if (displayType === 'deli_general' || displayType === 'deli (general)' || displayType === 'deli') {
                                          displayType = 'deli';
                                        } else if (displayType === 'pbj' || displayType === 'pb&j') {
                                          displayType = 'PB&J';
                                        } else {
                                          // Capitalize first letter
                                          displayType = displayType.charAt(0).toUpperCase() + displayType.slice(1);
                                        }

                                        return (
                                          <div key={`${idx}-${typeIdx}`} className="font-semibold truncate">
                                            {type.quantity} {displayType}
                                          </div>
                                        );
                                      })
                                    ) : null
                                  ))}
                                  {sandwichInfo.some(info => info.types && info.types.length > 2) && (
                                    <div className="text-[10px] opacity-75">+more</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Just show count if no types specified */
                              <div className="flex items-center gap-1">
                                <Sandwich className="w-5 h-5 text-[#fbad3f]" />
                                <span className="text-sm font-semibold">
                                  {(sandwichInfo[0] as any).countText || sandwichInfo[0].count}
                                </span>
                              </div>
                            )}
                            </div>
                          </div>
                        )}

                        {/* Event times with labels */}
                        {(event.eventStartTime || event.eventEndTime || event.pickupTime) && (
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                            {event.pickupTime && (
                              <div
                                className="inline-block rounded font-extrabold text-[9px] sm:text-[12px]"
                                style={{ color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fbbf24', padding: '1px 4px' }}
                              >
                                <span className="font-semibold text-[8px] sm:text-[10px] uppercase">Pickup </span>
                                {formatTimeTo12Hour(event.pickupTime)}
                              </div>
                            )}
                            {event.eventStartTime && (
                              <div
                                className="inline-block rounded font-extrabold text-[9px] sm:text-[12px]"
                                style={{ color: '#1e40af', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 4px' }}
                              >
                                <span className="font-semibold text-[8px] sm:text-[10px] uppercase">Start </span>
                                {formatTimeTo12Hour(event.eventStartTime)}
                              </div>
                            )}
                            {event.eventEndTime && (
                              <div
                                className="inline-block rounded font-extrabold text-[9px] sm:text-[12px]"
                                style={{ color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #86efac', padding: '1px 4px' }}
                              >
                                <span className="font-semibold text-[8px] sm:text-[10px] uppercase">End </span>
                                {formatTimeTo12Hour(event.eventEndTime)}
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {dayEvents.length > (isMobile ? 2 : 3) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDateExpansion(dateKey);
                      }}
                      className="text-[9px] sm:text-[10px] text-blue-600 hover:text-blue-800 text-center font-semibold mt-0.5 w-full hover:underline"
                    >
                      {isExpanded
                        ? 'Less'
                        : `+${dayEvents.length - (isMobile ? 2 : 3)} more`}
                    </button>
                  )}
                </div>
                {/* Saturday weekly sandwich total */}
                {isSaturday && saturdaySandwichTotal > 0 && (
                  <div
                    className="hidden sm:block mt-1 rounded text-sm font-extrabold text-center truncate"
                    style={{ background: 'linear-gradient(135deg, #92400e, #b45309)', color: '#fef3c7', padding: '4px 6px' }}
                  >
                    {saturdaySandwichTotal.toLocaleString()} / wk
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
