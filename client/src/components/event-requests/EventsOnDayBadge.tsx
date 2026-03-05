/**
 * Events On Day Badge Component
 * 
 * Shows a badge indicating how many events are scheduled/pending for a given date.
 * Used on NEW and IN_PROCESS cards to give visibility into scheduling conflicts.
 */

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EventsOnDayBadgeProps {
  date: Date | string | null | undefined;
  currentEventId?: number;
  className?: string;
}

interface DateConflictResult {
  vanConflicts: Array<{ event1: any; event2: any }>;
  driverConflicts: Array<{ driver: string; events: any[] }>;
  highVolume: boolean;
  eventCount: number;
}

export function EventsOnDayBadge({ date, currentEventId, className = '' }: EventsOnDayBadgeProps) {
  const dateStr = date 
    ? (typeof date === 'string' ? date.split('T')[0] : date.toISOString().split('T')[0])
    : null;

  const { data, isLoading } = useQuery<DateConflictResult>({
    queryKey: ['events-on-day', dateStr],
    queryFn: async () => {
      const response = await fetch(`/api/event-requests/conflicts-for-date?date=${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json();
    },
    enabled: !!dateStr,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  if (!dateStr || isLoading) return null;
  if (!data || data.eventCount === 0) return null;

  const count = data.eventCount;
  const isHighVolume = data.highVolume;
  const hasVanConflicts = data.vanConflicts.length > 0;

  const getBadgeVariant = () => {
    if (hasVanConflicts) return 'destructive';
    if (isHighVolume || count >= 3) return 'secondary';
    return 'outline';
  };

  const getBadgeClasses = () => {
    if (hasVanConflicts) return 'bg-red-100 text-red-700 border-red-300';
    if (isHighVolume || count >= 3) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-blue-50 text-blue-600 border-blue-200';
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getBadgeVariant()} 
            className={`text-xs flex items-center gap-1 cursor-help ${getBadgeClasses()} ${className}`}
          >
            {hasVanConflicts ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Calendar className="h-3 w-3" />
            )}
            {count} event{count !== 1 ? 's' : ''} on this day
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="text-sm">
            <p className="font-medium mb-1">
              {count} event{count !== 1 ? 's' : ''} on {formatDate(dateStr)}
            </p>
            {hasVanConflicts && (
              <p className="text-red-600 text-xs">
                Van already booked - check availability
              </p>
            )}
            {isHighVolume && !hasVanConflicts && (
              <p className="text-amber-600 text-xs">
                High volume day - coordinate scheduling
              </p>
            )}
            {count > 0 && count < 3 && !hasVanConflicts && (
              <p className="text-muted-foreground text-xs">
                Other events scheduled - review for conflicts
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
