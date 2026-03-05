import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStreamChatUnread } from '@/hooks/useStreamChatUnread';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Hash } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Component that shows a welcome notification when users log in
 * informing them about any unread messages in chat rooms, DMs, or group chats
 */
export function LoginMessageNotifier() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { totalUnread, roomsUnread, dmsUnread, groupsUnread, roomDetails } = useStreamChatUnread();
  const hasShownNotification = useRef(false);
  const previousUserId = useRef<string | null>(null);
  const checkTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.id) {
      // Reset when user logs out
      if (previousUserId.current) {
        hasShownNotification.current = false;
        previousUserId.current = null;
      }
      if (checkTimer.current) {
        clearTimeout(checkTimer.current);
        checkTimer.current = null;
      }
      return;
    }

    // Detect if this is a new login (user ID changed)
    const isNewLogin = previousUserId.current !== user.id;
    
    if (isNewLogin) {
      // New user logged in - reset notification state
      hasShownNotification.current = false;
      previousUserId.current = user.id;
      
      // Clear any existing timer
      if (checkTimer.current) {
        clearTimeout(checkTimer.current);
      }

      // Wait a bit for Stream Chat to initialize and load unread counts
      checkTimer.current = setTimeout(() => {
        // Only show notification if there are unread messages and we haven't shown it yet
        if (!hasShownNotification.current && totalUnread > 0) {
          hasShownNotification.current = true;
          
          // Build the message based on what types of unread messages exist
          const parts: string[] = [];
          if (roomsUnread > 0) {
            if (roomDetails.length > 0) {
              // Show specific room names (up to 3, then "and X more")
              const roomNames = roomDetails.slice(0, 3).map(r => r.name);
              const remaining = roomDetails.length - 3;
              let roomText = roomNames.join(', ');
              if (remaining > 0) {
                roomText += ` and ${remaining} more`;
              }
              parts.push(`New messages in ${roomText}`);
            } else {
              parts.push(`${roomsUnread} unread message${roomsUnread !== 1 ? 's' : ''} in team rooms`);
            }
          }
          if (dmsUnread > 0) {
            parts.push(`${dmsUnread} unread direct message${dmsUnread !== 1 ? 's' : ''}`);
          }
          if (groupsUnread > 0) {
            parts.push(`${groupsUnread} unread message${groupsUnread !== 1 ? 's' : ''} in group chats`);
          }

          const description = parts.length > 0
            ? parts.join('. ')
            : `${totalUnread} unread message${totalUnread !== 1 ? 's' : ''}`;

          toast({
            title: (
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-teal-600" />
                <span>Welcome back! You have new messages</span>
              </div>
            ) as any,
            description: (
              <div className="space-y-2">
                <p className="text-sm">{description}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      window.location.href = '/dashboard?section=chat';
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
                  >
                    <Hash className="w-3 h-3" />
                    Open Chat
                  </button>
                </div>
              </div>
            ) as any,
            duration: 8000, // 8 seconds
          });

          logger.log('[LoginMessageNotifier] Shown welcome notification with unread counts:', {
            totalUnread,
            roomsUnread,
            dmsUnread,
            groupsUnread,
            roomDetails: roomDetails.map(r => `${r.name} (${r.unread})`),
          });
        }
        
        checkTimer.current = null;
      }, 3000); // Wait 3 seconds after login for Stream Chat to load
    }

    return () => {
      if (checkTimer.current) {
        clearTimeout(checkTimer.current);
        checkTimer.current = null;
      }
    };
  }, [user?.id, totalUnread, roomsUnread, dmsUnread, groupsUnread, roomDetails, toast]);

  // This component doesn't render anything visible - it only manages toast notifications
  return null;
}
