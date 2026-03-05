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
import { Clock, ExternalLink, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest } from '@shared/schema';

interface PendingEvent {
  event: EventRequest;
  daysSinceToolkitSent: number;
}

type DaysFilter = '3days' | '5days' | 'all';

export function ToolkitSentPendingDialog() {
  const [open, setOpen] = useState(false);
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('3days');

  const { data: allRequests = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
  });

  const now = new Date();

  const calculateDaysSince = (date: Date | string | null): number => {
    if (!date) return 0;
    const sentDate = new Date(date);
    const diffMs = now.getTime() - sentDate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const pendingEvents: PendingEvent[] = allRequests
    .filter((request) => {
      // Must be in_process status
      if (request.status !== 'in_process') return false;

      // Must have toolkit sent
      if (!request.toolkitSent || !request.toolkitSentDate) return false;

      // Calculate days since toolkit sent
      const daysSince = calculateDaysSince(request.toolkitSentDate);

      // Apply days filter
      if (daysFilter === '3days') {
        return daysSince >= 3;
      } else if (daysFilter === '5days') {
        return daysSince >= 5;
      }
      // 'all' shows everything >= 1 day
      return daysSince >= 1;
    })
    .map((request) => ({
      event: request,
      daysSinceToolkitSent: calculateDaysSince(request.toolkitSentDate),
    }))
    .sort((a, b) => {
      // Sort by days since toolkit sent - oldest first
      return b.daysSinceToolkitSent - a.daysSinceToolkitSent;
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
      if (isNaN(date.getTime())) return 'No date';

      return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'No date';
    }
  };

  const scrollToEvent = (eventId: number) => {
    const element = document.getElementById(`event-card-${eventId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-[#FBAD3F]', 'ring-offset-2');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-[#FBAD3F]', 'ring-offset-2');
      }, 2000);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="premium-btn-outline border-[#FBAD3F] text-[#FBAD3F] hover:bg-[#FBAD3F]/10 hover:border-[#FBAD3F]"
          data-testid="button-toolkit-sent-pending"
        >
          <Clock className="w-4 h-4" aria-hidden="true" />
          Toolkit Sent - Awaiting Schedule ({pendingEvents.length})
        </button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#007E8C]/10 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[#236383] text-xl">
            <Mail className="w-5 h-5 text-[#FBAD3F]" aria-hidden="true" />
            In-Process Events with Toolkit Sent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 border-b border-[#007E8C]/10 pb-4 pt-4">
          <p className="text-sm text-gray-600">
            These events had the toolkit sent but haven't been scheduled yet
          </p>

          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#236383]">Days since sent:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={daysFilter === '3days' ? 'default' : 'outline'}
                onClick={() => setDaysFilter('3days')}
                className={daysFilter === '3days' ? 'bg-[#FBAD3F] hover:bg-[#FBAD3F]/90 text-white' : 'border-[#FBAD3F]/30 text-[#FBAD3F] hover:bg-[#FBAD3F]/5'}
                data-testid="filter-3days"
              >
                3+ Days
              </Button>
              <Button
                size="sm"
                variant={daysFilter === '5days' ? 'default' : 'outline'}
                onClick={() => setDaysFilter('5days')}
                className={daysFilter === '5days' ? 'bg-[#FBAD3F] hover:bg-[#FBAD3F]/90 text-white' : 'border-[#FBAD3F]/30 text-[#FBAD3F] hover:bg-[#FBAD3F]/5'}
                data-testid="filter-5days"
              >
                5+ Days
              </Button>
              <Button
                size="sm"
                variant={daysFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setDaysFilter('all')}
                className={daysFilter === 'all' ? 'bg-[#FBAD3F] hover:bg-[#FBAD3F]/90 text-white' : 'border-[#FBAD3F]/30 text-[#FBAD3F] hover:bg-[#FBAD3F]/5'}
                data-testid="filter-all-pending"
              >
                All (1+ Day)
              </Button>
            </div>
          </div>
        </div>

        {pendingEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm mt-1">
              No in-process events with toolkit sent more than {daysFilter === '3days' ? '3' : daysFilter === '5days' ? '5' : '1'} day{daysFilter === 'all' ? '' : 's'} ago.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              The following {pendingEvents.length} event{pendingEvents.length === 1 ? '' : 's'} may need follow-up to complete scheduling:
            </p>

            <div className="space-y-3">
              {pendingEvents.map(({ event, daysSinceToolkitSent }) => (
                <div
                  key={event.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  data-testid={`pending-toolkit-item-${event.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-[#236383] truncate">
                          {event.organizationName || 'Unnamed Organization'}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            daysSinceToolkitSent >= 7
                              ? 'bg-[#A31C41]/10 text-[#A31C41] border border-[#A31C41]/30 font-medium'
                              : daysSinceToolkitSent >= 5
                              ? 'bg-[#FBAD3F]/10 text-[#FBAD3F] border border-[#FBAD3F]/30 font-medium'
                              : 'bg-[#FBAD3F]/5 text-[#FBAD3F] border border-[#FBAD3F]/20 font-medium'
                          }
                        >
                          {daysSinceToolkitSent} day{daysSinceToolkitSent === 1 ? '' : 's'} ago
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
                          <span className="font-medium">Requested Date:</span>{' '}
                          {formatEventDate(event.desiredEventDate)}
                        </div>
                        <div>
                          <span className="font-medium">Toolkit Sent:</span>{' '}
                          {formatEventDate(event.toolkitSentDate)}
                        </div>
                        {event.email && (
                          <div>
                            <span className="font-medium">Contact:</span>{' '}
                            <a href={`mailto:${event.email}`} className="text-blue-600 hover:underline">
                              {event.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => scrollToEvent(event.id)}
                      className="shrink-0 text-[#007E8C] hover:text-[#236383] hover:bg-[#007E8C]/5"
                      data-testid={`button-view-pending-${event.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-1" aria-hidden="true" />
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
