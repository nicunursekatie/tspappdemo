import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest } from '@shared/schema';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';

interface EventWithMissingInfo {
  event: EventRequest;
  missingItems: string[];
}

type DateRangeFilter = '1month' | '2months' | 'all';
type StatusFilter = 'both' | 'in_process' | 'scheduled';

export function MissingInfoSummaryDialog() {
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>('1month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('both');

  const { data: allRequests = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  // Helper to get the event date for filtering and sorting
  const getEventDate = (request: EventRequest): Date | null => {
    const dateValue = request.scheduledEventDate || request.desiredEventDate;
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  // Calculate date cutoffs
  const now = new Date();
  const oneMonthFromNow = new Date(now);
  oneMonthFromNow.setMonth(now.getMonth() + 1);
  const twoMonthsFromNow = new Date(now);
  twoMonthsFromNow.setMonth(now.getMonth() + 2);

  const eventsWithMissingInfo: EventWithMissingInfo[] = allRequests
    .filter((request) => {
      // Must have missing info
      if (getMissingIntakeInfo(request).length === 0) {
        return false;
      }

      // Apply status filter
      if (statusFilter === 'in_process' && request.status !== 'in_process') {
        return false;
      }
      if (statusFilter === 'scheduled' && request.status !== 'scheduled') {
        return false;
      }
      // For 'both', include both in_process and scheduled
      if (statusFilter === 'both' && request.status !== 'in_process' && request.status !== 'scheduled') {
        return false;
      }

      // Apply date filter
      const eventDate = getEventDate(request);
      if (!eventDate) return true; // Include events with no date

      if (dateFilter === '1month') {
        return eventDate <= oneMonthFromNow;
      } else if (dateFilter === '2months') {
        return eventDate <= twoMonthsFromNow;
      }
      return true; // 'all' includes everything
    })
    .map((request) => ({
      event: request,
      missingItems: getMissingIntakeInfo(request),
    }))
    .sort((a, b) => {
      // Sort by date - soonest first
      const dateA = getEventDate(a.event);
      const dateB = getEventDate(b.event);
      
      // Events without dates go to the end
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      return dateA.getTime() - dateB.getTime();
    });

  const formatEventDate = (dateValue: any) => {
    if (!dateValue) return 'No date';

    try {
      // Parse date-only strings at noon to avoid timezone edge cases
      let date: Date;
      if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        date = new Date(dateValue + 'T12:00:00');
      } else {
        date = new Date(dateValue);
      }

      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return 'No date';
      }

      // Format using Eastern Time to ensure consistent display
      return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      return 'No date';
    }
  };

  const scrollToEvent = (eventId: number) => {
    const element = document.getElementById(`event-card-${eventId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-teal-500', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-teal-500', 'ring-offset-2');
      }, 2000);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="premium-btn-outline border-red-600 text-red-700 hover:bg-red-50 hover:border-red-700"
          data-testid="button-missing-info-summary"
        >
          <AlertTriangle className="w-4 h-4" />
          Incomplete Events ({eventsWithMissingInfo.length})
        </button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Events with Missing Intake Information
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={statusFilter === 'both' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('both')}
                className={statusFilter === 'both' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                data-testid="filter-status-both"
              >
                Both
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'in_process' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('in_process')}
                className={statusFilter === 'in_process' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                data-testid="filter-status-in-process"
              >
                In Process
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'scheduled' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('scheduled')}
                className={statusFilter === 'scheduled' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                data-testid="filter-status-scheduled"
              >
                Scheduled
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={dateFilter === '1month' ? 'default' : 'outline'}
                onClick={() => setDateFilter('1month')}
                className={dateFilter === '1month' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                data-testid="filter-1month"
              >
                Next 30 Days
              </Button>
              <Button
                size="sm"
                variant={dateFilter === '2months' ? 'default' : 'outline'}
                onClick={() => setDateFilter('2months')}
                className={dateFilter === '2months' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                data-testid="filter-2months"
              >
                Next 60 Days
              </Button>
              <Button
                size="sm"
                variant={dateFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setDateFilter('all')}
                className={dateFilter === 'all' ? 'bg-teal-600 hover:bg-teal-700' : ''}
                data-testid="filter-all"
              >
                All Upcoming
              </Button>
            </div>
          </div>
        </div>

        {eventsWithMissingInfo.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm mt-1">
              No in-process or scheduled events have missing intake information.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following {eventsWithMissingInfo.length} event
              {eventsWithMissingInfo.length === 1 ? '' : 's'} need additional
              information to ensure proper planning and execution:
            </p>

            <div className="space-y-3">
              {eventsWithMissingInfo.map(({ event, missingItems }) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`missing-info-item-${event.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {event.organizationName || 'Unnamed Organization'}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            event.status === 'scheduled'
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-amber-50 text-amber-700 border-amber-300'
                          }
                        >
                          {event.status === 'scheduled'
                            ? 'Scheduled'
                            : 'In Process'}
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 mb-2 space-y-1">
                        {event.department && (
                          <div>
                            <span className="font-medium">Department:</span>{' '}
                            {event.department}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Date:</span>{' '}
                          {formatEventDate(
                            event.scheduledEventDate || event.desiredEventDate
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-700">
                          Missing Information:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-700">
                          {missingItems.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => scrollToEvent(event.id)}
                      className="shrink-0 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                      data-testid={`button-view-event-${event.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
