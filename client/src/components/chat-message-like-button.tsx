import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface ChatMessageLike {
  id: number;
  messageId: number;
  userId: string;
  userName: string;
  likedAt: string;
}

interface ChatMessageLikeButtonProps {
  messageId: number | string;
  className?: string;
}

export function ChatMessageLikeButton({
  messageId,
  className = '',
}: ChatMessageLikeButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Convert messageId to number for API consistency
  const numericMessageId = Number(messageId);

  // Debug logging
  logger.log('ChatMessageLikeButton rendered:', {
    messageId,
    numericMessageId,
    user: user?.id,
  });

  // Don't render if user is not available
  if (!user || !user.id) {
    return null;
  }

  // Fetch likes for this chat message
  const { data: likes = [], isLoading } = useQuery({
    queryKey: ['chat-message-likes', numericMessageId],
    queryFn: () =>
      apiRequest('GET', `/api/chat-messages/${numericMessageId}/likes`),
    staleTime: 30000, // 30 seconds
  });

  const hasUserLiked = (likes || []).some(
    (like: ChatMessageLike) => like.userId === user.id
  );
  const likeCount = likes?.length || 0;

  // Like/unlike mutation for chat messages
  const likeMutation = useMutation({
    mutationFn: async () => {
      if (hasUserLiked) {
        return apiRequest(
          'DELETE',
          `/api/chat-messages/${numericMessageId}/like`
        );
      } else {
        return apiRequest(
          'POST',
          `/api/chat-messages/${numericMessageId}/like`
        );
      }
    },
    onSuccess: () => {
      // Invalidate and refetch likes
      queryClient.invalidateQueries({
        queryKey: ['chat-message-likes', numericMessageId],
      });
    },
    onError: (error) => {
      logger.error('Error toggling chat message like:', error);
    },
  });

  const handleLikeToggle = () => {
    if (!user) return;
    likeMutation.mutate();
  };

  // Create tooltip content showing who liked the message
  const tooltipContent = () => {
    if (likeCount === 0) {
      return 'Be the first to like this message';
    } else if (likeCount === 1) {
      return `Liked by ${likes?.[0]?.userName || 'Someone'}`;
    } else if (likeCount === 2) {
      return `Liked by ${likes?.[0]?.userName || 'Someone'} and ${
        likes?.[1]?.userName || 'Someone'
      }`;
    } else {
      const firstTwo = (likes || [])
        .slice(0, 2)
        .map((like: ChatMessageLike) => like.userName)
        .join(', ');
      const remaining = likeCount - 2;
      return `Liked by ${firstTwo} and ${remaining} other${
        remaining > 1 ? 's' : ''
      }`;
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <Heart className="w-4 h-4 text-gray-300" />
      </div>
    );
  }

  // Show the button always if liked, or on hover if not liked
  const shouldShow = likeCount > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLikeToggle}
            disabled={likeMutation.isPending || !user}
            className={`h-6 px-2 py-1 transition-all duration-200 ${className} ${
              shouldShow ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <Heart
              className={`w-4 h-4 mr-1 transition-colors ${
                hasUserLiked
                  ? 'text-red-500 fill-red-500'
                  : 'text-gray-400 hover:text-red-400'
              }`}
            />
            {likeCount > 0 && (
              <span
                className={`text-xs font-medium ${
                  hasUserLiked ? 'text-red-500' : 'text-gray-600'
                }`}
              >
                {likeCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{tooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
