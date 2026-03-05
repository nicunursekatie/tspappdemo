import { useState, useEffect, useCallback } from 'react';
import { StreamChat } from 'stream-chat';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface RoomUnreadDetail {
  id: string;
  name: string;
  unread: number;
}

interface StreamChatUnreadCounts {
  totalUnread: number;
  roomsUnread: number;
  dmsUnread: number;
  groupsUnread: number;
  roomDetails: RoomUnreadDetail[];
}

let globalClient: StreamChat | null = null;
let globalUnreadCounts: StreamChatUnreadCounts = {
  totalUnread: 0,
  roomsUnread: 0,
  dmsUnread: 0,
  groupsUnread: 0,
  roomDetails: [],
};
let listeners: Set<(counts: StreamChatUnreadCounts) => void> = new Set();

// Notify all listeners when counts change
function notifyListeners() {
  listeners.forEach(listener => listener({ ...globalUnreadCounts }));
}

// Track if initialization is in progress to prevent race conditions
let initializationPromise: Promise<StreamChat | null> | null = null;

// Initialize Stream Chat client and track unread counts globally
async function initializeStreamChat(user: any): Promise<StreamChat | null> {
  // Return existing client if already initialized
  if (globalClient) return globalClient;

  // If initialization is already in progress, wait for it
  if (initializationPromise) return initializationPromise;

  // Start initialization
  initializationPromise = (async () => {
    try {
      const response = await fetch('/api/stream/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        logger.warn('Failed to get Stream credentials for unread tracking');
        return null;
      }

      const { apiKey, userToken, streamUserId } = await response.json();

      const client = StreamChat.getInstance(apiKey);

      // Only connect if not already connected (prevents duplicate connectUser calls)
      if (!client.userID) {
        await client.connectUser(
          {
            id: streamUserId,
            name: user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.email,
          } as any,
          userToken
        );
      }

      globalClient = client;

      // Calculate initial unread counts
      await updateUnreadCounts(client, streamUserId);

      // Listen for new messages to update unread counts
      client.on('message.new', async (event) => {
        if (event.user?.id !== streamUserId) {
          // New message from someone else, update counts
          await updateUnreadCounts(client, streamUserId);
        }
      });

      // Listen for message read events
      client.on('message.read', async () => {
        await updateUnreadCounts(client, streamUserId);
      });

      // Listen for channel updates
      client.on('notification.message_new', async () => {
        await updateUnreadCounts(client, streamUserId);
      });

      client.on('notification.mark_read', async () => {
        await updateUnreadCounts(client, streamUserId);
      });

      return client;
    } catch (error) {
      logger.error('Failed to initialize Stream Chat for unread tracking:', error);
      initializationPromise = null; // Reset so it can be retried
      return null;
    }
  })();

  return initializationPromise;
}

// Update unread counts from Stream Chat
async function updateUnreadCounts(client: StreamChat, streamUserId: string) {
  try {
    let roomsUnread = 0;
    let dmsUnread = 0;
    let groupsUnread = 0;

    // Query team channels (rooms)
    const teamChannels = await client.queryChannels(
      { type: 'team', members: { $in: [streamUserId] } },
      {},
      { limit: 30 }
    );

    const roomDetails: RoomUnreadDetail[] = [];
    for (const channel of teamChannels) {
      const unread = channel.countUnread();
      roomsUnread += unread;
      if (unread > 0) {
        roomDetails.push({
          id: channel.id || '',
          name: ((channel.data as any)?.name as string) || channel.id || 'Chat Room',
          unread,
        });
      }
    }

    // Query DM channels (2 members)
    const dmChannels = await client.queryChannels(
      { type: 'messaging', members: { $in: [streamUserId] }, member_count: 2 },
      {},
      { limit: 30 }
    );

    for (const channel of dmChannels) {
      const unread = channel.countUnread();
      dmsUnread += unread;
    }

    // Query group channels (3+ members)
    const groupChannels = await client.queryChannels(
      { type: 'messaging', members: { $in: [streamUserId] }, member_count: { $gt: 2 } },
      {},
      { limit: 30 }
    );

    for (const channel of groupChannels) {
      const unread = channel.countUnread();
      groupsUnread += unread;
    }

    globalUnreadCounts = {
      totalUnread: roomsUnread + dmsUnread + groupsUnread,
      roomsUnread,
      dmsUnread,
      groupsUnread,
      roomDetails,
    };

    notifyListeners();
  } catch (error) {
    logger.error('Failed to update Stream Chat unread counts:', error);
  }
}

/**
 * Hook to get Stream Chat unread message counts
 * This is separate from the custom messaging system
 */
export function useStreamChatUnread() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<StreamChatUnreadCounts>(globalUnreadCounts);

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to updates
    const listener = (counts: StreamChatUnreadCounts) => {
      setUnreadCounts(counts);
    };
    listeners.add(listener);

    // Initialize if not already done
    initializeStreamChat(user);

    return () => {
      listeners.delete(listener);
    };
  }, [user?.id]);

  // Force refresh counts
  const refreshCounts = useCallback(async () => {
    if (globalClient && user?.id) {
      const streamUserId = `user_${user.id}`;
      await updateUnreadCounts(globalClient, streamUserId);
    }
  }, [user?.id]);

  return {
    ...unreadCounts,
    refreshCounts,
  };
}

/**
 * Mark a specific channel as read
 */
export async function markStreamChannelAsRead(channelId: string, channelType: string = 'messaging') {
  if (!globalClient) return;

  try {
    const channel = globalClient.channel(channelType, channelId);
    await channel.markRead();
  } catch (error) {
    logger.error('Failed to mark Stream channel as read:', error);
  }
}
