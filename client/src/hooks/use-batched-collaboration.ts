/**
 * useBatchedCollaboration - Batch-fetch collaboration data for multiple events
 * 
 * This hook reduces N+1 API calls by fetching comments and locks for all
 * visible events in a single request instead of individual requests per event.
 * 
 * @example
 * ```tsx
 * function EventList({ events }) {
 *   const eventIds = events.map(e => e.id);
 *   const { data, isLoading } = useBatchedCollaboration(eventIds);
 * 
 *   return (
 *     <>
 *       {events.map(event => (
 *         <EventCard
 *           key={event.id}
 *           event={event}
 *           comments={data?.[event.id]?.comments || []}
 *           locks={data?.[event.id]?.locks || []}
 *         />
 *       ))}
 *     </>
 *   );
 * }
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { EventCollaborationComment, EventFieldLock } from '@shared/schema';

export interface BatchedCollaborationData {
  comments: EventCollaborationComment[];
  locks: EventFieldLock[];
}

export interface BatchedCollaborationResult {
  [eventId: number]: BatchedCollaborationData;
}

export interface UseBatchedCollaborationReturn {
  data: BatchedCollaborationResult | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useBatchedCollaboration(
  eventIds: number[],
  options?: { enabled?: boolean }
): UseBatchedCollaborationReturn {
  const enabled = options?.enabled !== false && eventIds.length > 0;
  
  const sortedIds = [...eventIds].sort((a, b) => a - b);
  const queryKey = ['/api/event-requests/collaboration/bulk', sortedIds.join(',')];

  const { data, isLoading, error, refetch } = useQuery<{ data: BatchedCollaborationResult }>({
    queryKey,
    queryFn: async () => {
      if (sortedIds.length === 0) {
        return { data: {} };
      }
      return await apiRequest('POST', '/api/event-requests/collaboration/bulk', {
        eventRequestIds: sortedIds,
      });
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return {
    data: data?.data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

export function getEventCollaboration(
  batchedData: BatchedCollaborationResult | undefined,
  eventId: number
): BatchedCollaborationData {
  return batchedData?.[eventId] || { comments: [], locks: [] };
}
