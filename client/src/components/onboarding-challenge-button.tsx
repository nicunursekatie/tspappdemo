import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import OnboardingChallenge from './onboarding-challenge';
import { ButtonTooltip } from '@/components/ui/button-tooltip';

interface UserStats {
  totalPoints: number;
  completedChallenges: number;
  totalChallenges: number;
  completionPercentage: number;
}

export default function OnboardingChallengeButton({
  onNavigate,
}: {
  onNavigate?: (section: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: stats } = useQuery<UserStats>({
    queryKey: ['/api/onboarding/stats'],
    queryFn: () => apiRequest('GET', '/api/onboarding/stats'),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (reduced from 30 seconds)
  });

  const isComplete = stats?.completionPercentage === 100;
  const hasIncompleteItems =
    stats && stats.completedChallenges < stats.totalChallenges;

  return (
    <>
      <ButtonTooltip explanation="Complete challenges to explore the app and earn points! Click on any challenge to be guided there!">
        <Button
          onClick={() => setIsOpen(true)}
          className={`relative ${
            isComplete
              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600'
              : hasIncompleteItems
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 animate-pulse'
                : 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700'
          } text-white shadow-lg`}
          size="sm"
        >
          <Trophy className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Challenges</span>
          {stats && (
            <Badge
              variant="secondary"
              className="ml-2 bg-white/20 text-white hover:bg-white/30"
            >
              {stats.completedChallenges}/{stats.totalChallenges}
            </Badge>
          )}
          {hasIncompleteItems && (
            <Sparkles className="h-3 w-3 ml-1 animate-pulse" />
          )}
        </Button>
      </ButtonTooltip>

      <OnboardingChallenge
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
}
