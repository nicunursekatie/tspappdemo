import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { Heart, Star, Trophy, Sparkles, Target } from 'lucide-react';
import { useUserActivityTracking } from '@/hooks/useUserActivityTracking';
import { logger } from '@/lib/logger';

interface SendKudosButtonProps {
  recipientId: string;
  recipientName: string;
  contextType: 'project' | 'task';
  contextId: string;
  contextTitle: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'secondary' | 'outline';
  iconOnly?: boolean; // New prop for icon-only display
}

export default function SendKudosButton({
  recipientId,
  recipientName,
  contextType,
  contextId,
  contextTitle,
  className = '',
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
}: SendKudosButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trackKudosSent } = useUserActivityTracking();
  const [hasSentKudos, setHasSentKudos] = useState(false);

  // Check if kudos already sent when component mounts
  useEffect(() => {
    const checkKudosStatus = async () => {
      if (!user || !recipientId || !contextType || !contextId) return;

      try {
        const response = await fetch(
          `/api/messaging/kudos/check?recipientId=${recipientId}&contextType=${contextType}&contextId=${contextId}`,
          {
            credentials: 'include',
          }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.sent) {
            setHasSentKudos(true);
          }
        }
      } catch (error) {
        // Silently fail - worst case user gets a 409 error when clicking
      }
    };

    checkKudosStatus();
  }, [user, recipientId, contextType, contextId]);

  // Don't render if recipientId is empty or invalid
  if (!recipientId || !recipientId.trim()) {
    logger.warn('SendKudosButton: Not rendering due to empty recipientId', {
      recipientId,
      recipientName,
      contextType,
      contextId,
      contextTitle,
    });
    return null;
  }

  // Don't render if no user or trying to send kudos to yourself
  if (!user || (user as any)?.id === recipientId) {
    return null;
  }

  // Don't render if user doesn't have permission to send kudos
  if (!hasPermission(user as any, PERMISSIONS.KUDOS_SEND)) {
    logger.warn('SendKudosButton: User lacks KUDOS_SEND permission', {
      user: user ? { id: (user as any).id, email: (user as any).email } : null,
      KUDOS_SEND: PERMISSIONS.KUDOS_SEND,
    });
    return null;
  }

  const sendKudosMutation = useMutation({
    mutationFn: async () => {
      const kudosMessage = generateKudosMessage(
        recipientName,
        contextType,
        contextTitle
      );

      // Debug logging
      logger.log('SendKudosButton mutation data:', {
        recipientId,
        recipientName,
        contextType,
        contextId,
        entityName: contextTitle,
        content: kudosMessage,
      });

      if (!recipientId || !recipientId.trim()) {
        logger.error('SendKudosButton: Empty recipientId detected', {
          recipientId,
          recipientName,
          contextType,
          contextId,
          contextTitle,
        });
        throw new Error(`Cannot send kudos: recipient ID is empty`);
      }

      return await apiRequest('POST', '/api/messaging/kudos/send', {
        recipientId,
        contextType,
        contextId,
        entityName: contextTitle,
        content: kudosMessage,
      });
    },
    onSuccess: () => {
      setHasSentKudos(true);
      queryClient.invalidateQueries({ queryKey: ['/api/messaging/kudos'] });
      queryClient.invalidateQueries({
        queryKey: ['/api/messaging/kudos/received'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/message-notifications/unread-counts'],
      });
      toast({
        description: `Kudos sent to ${recipientName}!`,
        duration: 3000,
      });

      // Track the kudos send event
      trackKudosSent(recipientName, contextTitle);
    },
    onError: (error: any) => {
      // Check if it's a 409 error (kudos already sent)
      if (error?.response?.status === 409 || error?.status === 409) {
        setHasSentKudos(true);
        // Don't show error toast for duplicate kudos - just silently update the UI
      } else {
        const errorMessage =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to send kudos';
        toast({
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
  });

  const generateKudosMessage = (name: string, type: string, title: string) => {
    const messages = [
      `🎉 Fantastic work on ${title}, ${name}! Your dedication really shows.`,
      `⭐ Great job completing ${title}! Thanks for your excellent contribution.`,
      `🏆 Outstanding work on ${title}, ${name}! Keep up the amazing effort.`,
      `✨ Excellent completion of ${title}! Your work makes a real difference.`,
      `🎯 Awesome job with ${title}, ${name}! Thanks for being such a valuable team member.`,
      `🌟 Brilliant work on ${title}! Your contribution is truly appreciated.`,
      `🚀 Amazing job completing ${title}, ${name}! Your effort doesn't go unnoticed.`,
      `💫 Wonderful work on ${title}! Thanks for your commitment to excellence.`,
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getRandomIcon = () => {
    const icons = [Heart, Star, Trophy, Sparkles, Target];
    const IconComponent = icons[Math.floor(Math.random() * icons.length)];
    return <IconComponent className="h-3 w-3" />;
  };

  if (!user || (user as any).id === recipientId) {
    return null; // Don't show kudos button for yourself
  }

  if (hasSentKudos) {
    if (iconOnly) {
      return (
        <Button
          disabled
          size={size}
          variant="outline"
          className={`gap-1 ${className}`}
          title="Kudos already sent"
        >
          <Heart className="h-3 w-3 fill-red-400 text-red-400" />
        </Button>
      );
    }
    return (
      <Badge variant="secondary" className={`gap-1 ${className}`}>
        <Heart className="h-3 w-3 fill-red-400 text-red-400" />
        Kudos Sent
      </Badge>
    );
  }

  return (
    <Button
      onClick={() => sendKudosMutation.mutate()}
      disabled={sendKudosMutation.isPending}
      size={size}
      variant={variant}
      className={`gap-1 ${className}`}
      title={iconOnly ? `Send kudos to ${recipientName}` : undefined}
    >
      {sendKudosMutation.isPending ? (
        <>
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
          {!iconOnly && 'Sending...'}
        </>
      ) : (
        <>
          {getRandomIcon()}
          {!iconOnly && `Send Kudos to ${recipientName}`}
        </>
      )}
    </Button>
  );
}
