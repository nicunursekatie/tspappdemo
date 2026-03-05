import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface Message {
  id: number;
  senderId: string;
  content: string;
  senderName?: string;
  senderEmail?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  deletedAt?: string;
}

/**
 * Lightweight hook to fetch messages for a specific event context.
 * Unlike useMessaging(), this hook does NOT create WebSocket connections
 * or set up notification handlers, making it safe to use in multiple
 * components without creating duplicate connections.
 * 
 * IMPORTANT: This hook is optimized to minimize API calls:
 * - Does NOT poll automatically (polling disabled by default)
 * - Only fetches on mount and when explicitly refetched
 * - Use refetch() to manually refresh messages when needed
 * 
 * For components that need real-time message updates, use the
 * Socket.IO messaging system instead.
 */
export function useEventMessages(eventId: string | undefined, options?: { enablePolling?: boolean }) {
  const enablePolling = options?.enablePolling ?? false;
  
  return useQuery<Message[]>({
    queryKey: ['event-messages', eventId],
    queryFn: async () => {
      if (!eventId) {
        return [];
      }

      try {
        const response = await apiRequest(
          'GET',
          `/api/messaging/context/event/${eventId}`
        );
        return response.messages || [];
      } catch (error) {
        // Only log if it's not an abort error (which happens during navigation)
        if (!(error instanceof Error && error.name === 'AbortError')) {
          logger.error('Failed to fetch event messages:', error);
        }
        return [];
      }
    },
    enabled: !!eventId,
    // Polling is disabled by default to prevent excessive API calls
    // Only enable for specific use cases that truly need real-time updates
    refetchInterval: enablePolling ? () => (document.hidden ? false : 120000) : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Disable automatic refetch on window focus
    staleTime: 60000, // Consider data stale after 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Only retry once on failure
    retryDelay: 5000, // Wait 5 seconds before retry
  });
}
