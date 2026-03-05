import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface AddFlagParams {
  eventId: number;
  type: 'critical' | 'important' | 'attention';
  message: string;
  dueDate?: string | null;
}

interface ResolveFlagParams {
  eventId: number;
  flagId: string;
}

/**
 * Standardized mutations for pre-event flags.
 *
 * This hook follows the established data fetching pattern:
 * 1. Uses React Query's useMutation for all mutations
 * 2. Invalidates relevant queries on success via invalidateEventRequestQueries
 * 3. Shows toast notifications for success/error states
 * 4. Returns isPending for loading states
 *
 * Usage:
 * ```tsx
 * const { addFlagMutation, resolveFlagMutation } = usePreEventFlagMutations();
 *
 * // Add a flag
 * addFlagMutation.mutate({ eventId: 123, type: 'critical', message: 'Needs attention!' });
 *
 * // Resolve a flag
 * resolveFlagMutation.mutate({ eventId: 123, flagId: 'flag-uuid' });
 * ```
 */
export function usePreEventFlagMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const addFlagMutation = useMutation({
    mutationFn: async ({ eventId, type, message, dueDate }: AddFlagParams) => {
      const response = await fetch(`/api/event-requests/${eventId}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          message,
          dueDate,
          createdBy: user?.id,
          createdByName: user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.email || 'Unknown',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add flag');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Flag added',
        description: 'Pre-event flag has been added to this event.',
      });
      invalidateEventRequestQueries(queryClient);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add flag. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const resolveFlagMutation = useMutation({
    mutationFn: async ({ eventId, flagId }: ResolveFlagParams) => {
      const response = await fetch(`/api/event-requests/${eventId}/flags/${flagId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          resolvedBy: user?.id,
          resolvedByName: user?.firstName && user?.lastName
            ? `${user.firstName} ${user.lastName}`
            : user?.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve flag');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Flag resolved',
        description: 'The pre-event flag has been marked as resolved.',
      });
      invalidateEventRequestQueries(queryClient);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to resolve flag. Please try again.',
        variant: 'destructive',
      });
    },
  });

  return {
    addFlagMutation,
    resolveFlagMutation,
  };
}
