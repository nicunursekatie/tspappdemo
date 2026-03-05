import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import {
  Trophy,
  Star,
  CheckCircle2,
  Circle,
  MessageCircle,
  Eye,
  Mail,
  FileText,
  Link,
  Users,
  PlusCircle,
  Heart,
  Briefcase,
  Calendar,
  TrendingUp,
  Award,
  Zap,
  X,
  ArrowRight,
  AlertCircle,
  StickyNote,
  ListTodo,
  Sandwich,
  Receipt,
  Gift,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Challenge {
  id: number;
  actionKey: string;
  title: string;
  description: string | null;
  category: string;
  points: number;
  icon: string | null;
  order: number;
  promotion: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
}

interface UserStats {
  totalPoints: number;
  completedChallenges: number;
  totalChallenges: number;
  completionPercentage: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  completedChallenges: number;
  rank: number;
}

const iconMap: Record<string, any> = {
  MessageCircle,
  Eye,
  Mail,
  FileText,
  Link,
  Users,
  PlusCircle,
  Heart,
  Briefcase,
  Calendar,
  StickyNote,
  ListTodo,
  Sandwich,
  Receipt,
  Gift,
};

const categoryColors: Record<string, string> = {
  communication: 'bg-blue-100 text-blue-700 border-blue-200',
  documentation: 'bg-purple-100 text-purple-700 border-purple-200',
  team: 'bg-green-100 text-green-700 border-green-200',
  productivity: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  operations: 'bg-orange-100 text-orange-700 border-orange-200',
  strategic: 'bg-pink-100 text-pink-700 border-pink-200',
  // Legacy categories for backward compatibility
  documents: 'bg-purple-100 text-purple-700 border-purple-200',
  projects: 'bg-pink-100 text-pink-700 border-pink-200',
};

const categoryIcons: Record<string, any> = {
  communication: MessageCircle,
  documentation: FileText,
  team: Users,
  productivity: ListTodo,
  operations: Sandwich,
  strategic: Briefcase,
  // Legacy categories for backward compatibility
  documents: FileText,
  projects: Briefcase,
};

// Navigation mapping for each challenge
const challengeNavigation: Record<string, { section: string; instructions: string }> = {
  chat_first_message: {
    section: 'chat',
    instructions: 'Open Team Chat and send a message in any channel you have access to.',
  },
  chat_read_messages: {
    section: 'chat',
    instructions: 'Open Team Chat to view messages from your team.',
  },
  inbox_send_email: {
    section: 'gmail-inbox',
    instructions: 'Go to your Inbox and compose a new message to a team member.',
  },
  view_resources: {
    section: 'resources',
    instructions: 'Visit the Resources page to explore important documents, templates, and tools.',
  },
  view_quick_tools: {
    section: 'important-links',
    instructions: 'Check out Quick Tools for helpful links and resources.',
  },
  view_wishlist: {
    section: 'wishlist',
    instructions: 'Visit the Amazon Wishlist page to see items we need.',
  },
  view_holding_zone: {
    section: 'team-board',
    instructions: 'Visit the TSP Holding Zone to see what your team is working on.',
  },
  post_holding_zone: {
    section: 'team-board',
    instructions: 'Go to the TSP Holding Zone and create a new post (task, note, or idea).',
  },
  like_holding_zone_post: {
    section: 'team-board',
    instructions: 'Visit the TSP Holding Zone and like a post from a team member.',
  },
  view_my_actions: {
    section: 'my-actions',
    instructions: 'Navigate to My Actions to see your assigned tasks and to-dos.',
  },
  set_availability: {
    section: 'my-availability',
    instructions: 'Go to My Availability and update your schedule to let the team know when you\'re available.',
  },
  submit_collection_log: {
    section: 'collections',
    instructions: 'Navigate to Collections Log and submit an entry to record your sandwich collection.',
  },
  view_event_requests: {
    section: 'event-requests',
    instructions: 'Check the Event Requests page to see upcoming events and requests.',
  },
  view_expenses: {
    section: 'expenses',
    instructions: 'Visit Expenses & Receipts to learn how to track and submit expenses.',
  },
  view_projects: {
    section: 'projects',
    instructions: 'Navigate to the Projects page to see active initiatives.',
  },
  view_meetings: {
    section: 'meetings',
    instructions: 'Check the Meetings page to view notes and agendas.',
  },
  // Legacy mappings for backward compatibility
  view_important_documents: {
    section: 'resources',
    instructions: 'Visit the Resources page to explore important documents, templates, and tools.',
  },
  view_important_links: {
    section: 'important-links',
    instructions: 'Check out Quick Tools for helpful links and resources.',
  },
  view_team_board: {
    section: 'team-board',
    instructions: 'Visit the TSP Holding Zone to see what your team is working on.',
  },
  post_team_board: {
    section: 'team-board',
    instructions: 'Go to the TSP Holding Zone and create a new post (task, note, or idea).',
  },
  like_team_board_post: {
    section: 'team-board',
    instructions: 'Visit the TSP Holding Zone and like a post from a team member.',
  },
};

export default function OnboardingChallenge({
  isOpen,
  onClose,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (section: string) => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('challenges');

  const { data: challenges = [], isLoading: challengesLoading, error: challengesError, refetch: refetchChallenges } = useQuery<Challenge[]>({
    queryKey: ['/api/onboarding/challenges'],
    queryFn: () => apiRequest('GET', '/api/onboarding/challenges'),
    enabled: isOpen,
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<UserStats>({
    queryKey: ['/api/onboarding/stats'],
    queryFn: () => apiRequest('GET', '/api/onboarding/stats'),
    enabled: isOpen,
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading, error: leaderboardError } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/onboarding/leaderboard'],
    queryFn: () => apiRequest('GET', '/api/onboarding/leaderboard?limit=100'),
    enabled: isOpen,
  });

  // Debug logging
  logger.log('OnboardingChallenge:', {
    challenges: challenges?.length,
    stats,
    leaderboard: leaderboard?.length,
    challengesLoading,
    statsLoading,
    leaderboardLoading,
    challengesError,
    statsError,
    leaderboardError
  });

  const groupedChallenges = challenges.reduce((acc, challenge) => {
    if (!acc[challenge.category]) {
      acc[challenge.category] = [];
    }
    acc[challenge.category].push(challenge);
    return acc;
  }, {} as Record<string, Challenge[]>);

  const renderChallengeIcon = (iconName: string | null, isCompleted: boolean) => {
    const IconComponent = iconName ? iconMap[iconName] : Circle;
    return IconComponent ? (
      <IconComponent
        className={`h-5 w-5 ${
          isCompleted ? 'text-green-600' : 'text-gray-400'
        }`}
      />
    ) : (
      <Circle className="h-5 w-5 text-gray-400" />
    );
  };

  const handleChallengeClick = (challenge: Challenge) => {
    if (challenge.isCompleted) {
      toast({
        title: 'Already Completed!',
        description: `You completed this challenge on ${new Date(challenge.completedAt!).toLocaleDateString()}`,
      });
      return;
    }

    const nav = challengeNavigation[challenge.actionKey];
    if (!nav) {
      toast({
        title: 'Challenge Info',
        description: challenge.description || challenge.title,
      });
      return;
    }

    // Show instructions before navigating
    toast({
      title: '📍 Let\'s do it!',
      description: nav.instructions,
      duration: 6000,
    });

    // Navigate if callback provided
    if (onNavigate) {
      setTimeout(() => {
        onNavigate(nav.section);
        onClose(); // Close the dialog after navigating
      }, 500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-lg">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">
                  Onboarding Challenge
                </DialogTitle>
                <DialogDescription>
                  Explore features and earn points!
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Loading State */}
        {(challengesLoading || statsLoading) && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading challenges...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {(challengesError || statsError) && (
          <div className="p-8 text-center">
            <div className="text-red-500 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto mb-2" />
              <p className="font-semibold">Unable to load challenges</p>
              <p className="text-sm text-gray-600 mt-2">
                {challengesError instanceof Error ? challengesError.message : 'Please try again later'}
              </p>
            </div>
            <Button onClick={() => refetchChallenges()} variant="outline">
              Retry
            </Button>
          </div>
        )}

        {/* Stats Summary */}
        {!challengesLoading && !statsLoading && stats && (
          <div className="grid grid-cols-3 gap-4 my-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 p-2 rounded-lg">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-900">
                      {stats.totalPoints}
                    </p>
                    <p className="text-sm text-blue-700">Points</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 p-2 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-900">
                      {stats.completedChallenges}/{stats.totalChallenges}
                    </p>
                    <p className="text-sm text-green-700">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-500 p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-900">
                      {stats.completionPercentage}%
                    </p>
                    <p className="text-sm text-purple-700">Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!challengesLoading && !statsLoading && !challengesError && !statsError && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="challenges">
                <Zap className="h-4 w-4 mr-2" />
                Challenges
              </TabsTrigger>
              <TabsTrigger value="leaderboard">
                <Award className="h-4 w-4 mr-2" />
                Leaderboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="challenges" className="flex-1 min-h-0">
              {challenges.length === 0 ? (
                <div className="flex items-center justify-center p-8 text-gray-500">
                  <div className="text-center">
                    <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p className="font-semibold">No challenges available</p>
                    <p className="text-sm mt-2">Check back soon for new challenges!</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {Object.entries(groupedChallenges).map(([category, categoryChallenges]) => {
                  const CategoryIcon = categoryIcons[category] || Circle;
                  const completedCount = categoryChallenges.filter(c => c.isCompleted).length;

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <CategoryIcon className="h-5 w-5 text-gray-700" />
                        <h3 className="text-lg font-semibold capitalize text-gray-900">
                          {category}
                        </h3>
                        <Badge variant="outline" className="ml-auto">
                          {completedCount}/{categoryChallenges.length}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {categoryChallenges.map((challenge) => (
                          <Card
                            key={challenge.id}
                            onClick={() => handleChallengeClick(challenge)}
                            className={`transition-all cursor-pointer relative ${
                              challenge.isCompleted
                                ? 'bg-green-50 border-green-200'
                                : challenge.promotion
                                ? 'hover:shadow-lg hover:border-[#FBAD3F] hover:bg-yellow-50 ring-2 ring-[#FBAD3F]/30'
                                : 'hover:shadow-md hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            {challenge.promotion && !challenge.isCompleted && (
                              <div className="absolute -top-2 -right-2 z-10">
                                <Badge className="bg-gradient-to-r from-[#FBAD3F] to-yellow-500 text-white font-bold px-3 py-1 shadow-lg animate-pulse">
                                  {challenge.promotion}
                                </Badge>
                              </div>
                            )}
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="mt-1">
                                  {challenge.isCompleted ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                                  ) : (
                                    renderChallengeIcon(challenge.icon, false)
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-1">
                                    <h4
                                      className={`font-semibold ${
                                        challenge.isCompleted
                                          ? 'text-green-900'
                                          : 'text-gray-900'
                                      }`}
                                    >
                                      {challenge.title}
                                    </h4>
                                    <Badge
                                      variant={challenge.isCompleted ? 'default' : 'secondary'}
                                      className={`ml-2 ${
                                        challenge.isCompleted
                                          ? 'bg-green-600 hover:bg-green-700'
                                          : challenge.promotion
                                          ? 'bg-[#FBAD3F] text-white hover:bg-[#FBAD3F]/90'
                                          : ''
                                      }`}
                                    >
                                      +{challenge.points} pts
                                    </Badge>
                                  </div>
                                  {challenge.description && (
                                    <p className="text-sm text-gray-600">
                                      {challenge.description}
                                    </p>
                                  )}
                                  {challenge.isCompleted && challenge.completedAt && (
                                    <p className="text-xs text-green-600 mt-2">
                                      ✓ Completed{' '}
                                      {new Date(challenge.completedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                  {!challenge.isCompleted && challengeNavigation[challenge.actionKey] && (
                                    <div className="flex items-center gap-1 mt-2 text-xs text-blue-600 font-medium">
                                      <span>Click to navigate</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="leaderboard" className="flex-1 min-h-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <Card
                    key={entry.userId}
                    className={`${
                      entry.rank === 1
                        ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-300'
                        : entry.rank === 2
                        ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300'
                        : entry.rank === 3
                        ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300'
                        : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-lg">
                          {entry.rank === 1 && '🥇'}
                          {entry.rank === 2 && '🥈'}
                          {entry.rank === 3 && '🥉'}
                          {entry.rank > 3 && entry.rank}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {entry.userName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {entry.completedChallenges} challenges completed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-amber-600">
                            {entry.totalPoints}
                          </p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        )}

        {/* Progress Bar */}
        {!challengesLoading && !statsLoading && stats && (
          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Overall Progress
              </span>
              <span className="text-sm font-bold text-amber-600">
                {stats.completionPercentage}%
              </span>
            </div>
            <Progress value={stats.completionPercentage} className="h-2" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
