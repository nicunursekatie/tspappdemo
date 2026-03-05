import * as React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Trophy, X, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { logger } from '@/lib/logger';

interface UnnotifiedKudos {
  id: number;
  content: string;
  senderName: string;
  entityName: string;
  contextType: 'task' | 'project';
  createdAt: string;
}

interface KudosToast {
  id: number;
  message: string;
  senderName: string;
  entityName: string;
  contextType: 'task' | 'project';
  createdAt: string;
}

export function KudosLoginNotifier() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasShownNotifications, setHasShownNotifications] = React.useState(false);
  const [activeToasts, setActiveToasts] = React.useState<KudosToast[]>([]);

  const { data: unnotifiedKudos = [], isLoading } = useQuery<UnnotifiedKudos[]>(
    {
      queryKey: ['/api/messaging/kudos/unnotified'],
      enabled: !!user && !hasShownNotifications,
      staleTime: 1 * 60 * 1000, // 1 minute - notifications need reasonable freshness but not aggressive refetching
    }
  );

  // Ensure unnotifiedKudos is always an array to prevent slice errors
  const safeUnnotifiedKudos: UnnotifiedKudos[] = Array.isArray(unnotifiedKudos) ? unnotifiedKudos : [];

  // Mutation to mark kudos as initially notified
  const markInitiallyNotifiedMutation = useMutation({
    mutationFn: async (kudosIds: number[]) => {
      return apiRequest('POST', '/api/messaging/kudos/mark-initial-notified', {
        kudosIds,
      });
    },
    onSuccess: () => {
      // Invalidate notification count queries to update the bell icon
      queryClient.invalidateQueries({
        queryKey: ['/api/message-notifications/unread-counts'],
      });
    },
    onError: (error) => {
      logger.error('Failed to mark kudos as initially notified:', error);
    },
  });

  // Handle showing notifications when unnotified kudos are fetched
  React.useEffect(() => {
    if (
      !user ||
      !safeUnnotifiedKudos ||
      safeUnnotifiedKudos.length === 0 ||
      hasShownNotifications ||
      isLoading
    ) {
      return;
    }

    // Prepare kudos for toast display
    const maxToasts = 3;
    const kudosToDisplay = safeUnnotifiedKudos.slice(0, maxToasts);
    const remainingCount = Math.max(0, safeUnnotifiedKudos.length - maxToasts);

    // Show individual toasts for the first few kudos
    kudosToDisplay.forEach((kudos, index) => {
      setTimeout(() => {
        const toastKudos: KudosToast = {
          id: kudos.id,
          message: kudos.content,
          senderName: kudos.senderName,
          entityName: kudos.entityName,
          contextType: kudos.contextType,
          createdAt: kudos.createdAt,
        };

        setActiveToasts((prev) => [...prev, toastKudos]);
        showKudosToast(toastKudos);
      }, index * 800); // Stagger toasts by 800ms
    });

    // Show summary toast if there are more kudos
    if (remainingCount > 0) {
      setTimeout(() => {
        showSummaryToast(remainingCount, safeUnnotifiedKudos.length);
      }, kudosToDisplay.length * 800);
    }

    // Mark all kudos as initially notified
    if (safeUnnotifiedKudos.length > 0) {
      const kudosIds = safeUnnotifiedKudos.map((k) => k.id);
      setTimeout(() => {
        markInitiallyNotifiedMutation.mutate(kudosIds);
      }, 1000); // Wait 1 second before marking as notified
    }

    setHasShownNotifications(true);
  }, [safeUnnotifiedKudos, user, hasShownNotifications, isLoading]);

  const showKudosToast = (kudos: KudosToast) => {
    const timeAgo = formatDistanceToNow(new Date(kudos.createdAt), {
      addSuffix: true,
    });

    toast({
      title: (
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span>Kudos from {kudos.senderName}</span>
        </div>
      ) as any,
      description: (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            For {kudos.contextType}: <strong>{kudos.entityName}</strong>
          </p>
          <p className="text-sm">{kudos.message}</p>
          <p className="text-xs text-gray-500">{timeAgo}</p>
          <div className="flex gap-2 mt-3">
            <button
              data-testid={`kudos-toast-view-inbox-${kudos.id}`}
              onClick={() => handleViewInInbox()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
            >
              <Eye className="w-3 h-3" />
              View in Inbox
            </button>
            <button
              data-testid={`kudos-toast-dismiss-${kudos.id}`}
              onClick={() => handleDismissToast(kudos.id)}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
          </div>
        </div>
      ) as any,
      duration: 15000, // 15 seconds
    });
  };

  const showSummaryToast = (remainingCount: number, totalCount: number) => {
    toast({
      title: (
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <span>More Kudos Received!</span>
        </div>
      ) as any,
      description: (
        <div className="space-y-2">
          <p className="text-sm">
            You have <strong>{remainingCount}</strong> more kudos waiting for
            you!
          </p>
          <p className="text-xs text-gray-500">Total: {totalCount} new kudos</p>
          <div className="flex gap-2 mt-3">
            <button
              data-testid="kudos-toast-summary-view-inbox"
              onClick={() => handleViewInInbox()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
            >
              <Eye className="w-3 h-3" />
              View All in Inbox
            </button>
            <button
              data-testid="kudos-toast-summary-dismiss"
              onClick={() => handleDismissSummary()}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <X className="w-3 h-3" />
              Dismiss
            </button>
          </div>
        </div>
      ) as any,
      duration: 20000, // 20 seconds
    });
  };

  const handleViewInInbox = () => {
    // Navigate to the main inbox where kudos should be visible
    window.location.hash = '#/dashboard?section=gmail-inbox';
  };

  const handleDismissToast = (kudosId: number) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== kudosId));
    // Toast will auto-dismiss, no additional action needed
  };

  const handleDismissSummary = () => {
    // Summary toast will auto-dismiss, no additional action needed
  };

  // This component doesn't render anything visible - it only manages toast notifications
  return null;
}
