import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TrackResult {
  success: boolean;
  points?: number;
  message?: string;
}

export function useOnboardingTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const trackMutation = useMutation({
    mutationFn: async ({
      actionKey,
      metadata,
    }: {
      actionKey: string;
      metadata?: Record<string, any>;
    }) => {
      return await apiRequest<TrackResult>(
        'POST',
        `/api/onboarding/track/${actionKey}`,
        { metadata }
      );
    },
    onSuccess: (data) => {
      if (data.success && data.points) {
        // Invalidate queries to refresh stats and challenges
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/challenges'] });
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/stats'] });
        queryClient.invalidateQueries({ queryKey: ['/api/onboarding/leaderboard'] });

        // Show celebration
        showCelebration(data.points, data.message || 'Challenge completed!');
      }
    },
    onError: (error: any) => {
      // Silently ignore "already completed" errors - these are expected
      if (error?.message?.includes('already completed')) {
        return;
      }
      // Log other errors but don't show to user (tracking is non-critical)
      console.debug('Onboarding tracking error:', error);
    },
  });

  const showCelebration = (points: number, message: string) => {
    // Show toast notification with celebration
    toast({
      title: '🎉 Challenge Completed!',
      description: `${message} — +${points} points earned! ✨`,
      duration: 5000,
    });
  };

  const track = (actionKey: string, metadata?: Record<string, any>) => {
    trackMutation.mutate({ actionKey, metadata });
  };

  return {
    track,
    isTracking: trackMutation.isPending,
  };
}
