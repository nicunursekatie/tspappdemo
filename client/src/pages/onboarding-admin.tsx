import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Users, Award, Mail, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useActivityTracker } from '@/hooks/useActivityTracker';

interface UserProgress {
  userId: string;
  userName: string;
  email: string;
  role: string;
  totalPoints: number;
  completionCount: number;
}

export default function OnboardingAdmin() {
  const { trackView } = useActivityTracker();
  const { toast } = useToast();

  useEffect(() => {
    trackView(
      'Admin',
      'Admin',
      'Onboarding Admin',
      'User accessed onboarding admin page'
    );
  }, [trackView]);

  const { data: usersProgress = [], isLoading } = useQuery<UserProgress[]>({
    queryKey: ['/api/onboarding/admin/users-progress'],
  });

  const sendAnnouncementMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/onboarding/admin/send-announcement', {});
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Emails Sent!',
        description: `Successfully sent ${data.successCount} emails to active users.${data.failedCount > 0 ? ` ${data.failedCount} failed.` : ''}`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send announcement emails. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSendAnnouncement = () => {
    const confirmed = window.confirm(
      `This will send the onboarding challenge announcement email to ${totalUsers} active users.\n\nThe email emphasizes that challenges are optional, self-paced, and have zero pressure.\n\nDo you want to proceed?`
    );

    if (confirmed) {
      sendAnnouncementMutation.mutate();
    }
  };

  // Calculate stats
  const totalUsers = usersProgress.length;
  const usersWithProgress = usersProgress.filter(u => u.completionCount > 0).length;
  const avgChallengesCompleted = usersProgress.length > 0
    ? (usersProgress.reduce((sum, u) => sum + u.completionCount, 0) / usersProgress.length).toFixed(1)
    : 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary mb-2">
            Onboarding Challenge Progress
          </h1>
          <p className="text-gray-600">
            Track user engagement with onboarding challenges across the platform
          </p>
        </div>
        <Button
          onClick={handleSendAnnouncement}
          disabled={sendAnnouncementMutation.isPending}
          className="bg-brand-primary hover:bg-brand-primary-dark"
        >
          <Mail className="w-4 h-4 mr-2" />
          {sendAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement Email'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-primary rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-brand-primary">{totalUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Users with Progress</p>
                <p className="text-2xl font-bold text-green-600">{usersWithProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-orange rounded-lg flex items-center justify-center">
                <Award className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg. Challenges Completed</p>
                <p className="text-2xl font-bold text-brand-orange">{avgChallengesCompleted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
