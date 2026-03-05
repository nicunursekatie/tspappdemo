import { useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';

export interface DatePopulationInfo {
  scheduledCount: number;
  inProcessCount: number;
  // Whether there are no scheduled or in-process events (open date)
  isOpen: boolean;
}

// Normalize date to YYYY-MM-DD string for comparison
const normalizeDate = (dateInput: string | Date | null | undefined): string | null => {
  if (!dateInput) return null;

  const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  // Extract just the date part (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

interface DateCounts {
  scheduled: number;
  inProcess: number;
}

/**
 * Hook to get date population information for event cards
 * Returns a function to check any date's population
 * Only counts scheduled and in_process events (ignores new requests)
 */
export function useDatePopulation() {
  const { eventRequests } = useEventRequestContext();

  // Pre-compute date population map for efficiency
  const datePopulationMap = useMemo(() => {
    const map = new Map<string, DateCounts>();

    for (const event of eventRequests) {
      const status = event.status || '';

      // Only count scheduled and in_process events
      if (status !== 'scheduled' && status !== 'in_process') continue;

      // Use scheduledEventDate if available, otherwise desiredEventDate
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      const normalizedDate = normalizeDate(eventDate);

      if (!normalizedDate) continue;

      const current = map.get(normalizedDate) || { scheduled: 0, inProcess: 0 };

      if (status === 'scheduled') {
        current.scheduled += 1;
      } else if (status === 'in_process') {
        current.inProcess += 1;
      }

      map.set(normalizedDate, current);
    }

    return map;
  }, [eventRequests]);

  /**
   * Get population info for a specific date
   * @param date - Date string or Date object
   * @param excludeEventId - Optional event ID to exclude from count (useful when showing warning on the event's own card)
   */
  const getDatePopulation = (
    date: string | Date | null | undefined,
    excludeEventId?: number
  ): DatePopulationInfo => {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return {
        scheduledCount: 0,
        inProcessCount: 0,
        isOpen: true,
      };
    }

    // Get base counts from the map
    let { scheduled, inProcess } = datePopulationMap.get(normalizedDate) || {
      scheduled: 0,
      inProcess: 0,
    };

    // If excluding an event (e.g., don't count the current event when showing its own warning)
    if (excludeEventId) {
      const excludedEvent = eventRequests.find((e) => e.id === excludeEventId);
      if (excludedEvent) {
        const excludedDate = normalizeDate(
          excludedEvent.scheduledEventDate || excludedEvent.desiredEventDate
        );
        if (excludedDate === normalizedDate) {
          if (excludedEvent.status === 'scheduled') {
            scheduled = Math.max(0, scheduled - 1);
          } else if (excludedEvent.status === 'in_process') {
            inProcess = Math.max(0, inProcess - 1);
          }
        }
      }
    }

    return {
      scheduledCount: scheduled,
      inProcessCount: inProcess,
      isOpen: scheduled === 0 && inProcess === 0,
    };
  };

  return { getDatePopulation, datePopulationMap };
}
