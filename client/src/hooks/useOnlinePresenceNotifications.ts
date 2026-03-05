import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { io, Socket } from 'socket.io-client';
import { logger } from '@/lib/logger';

interface OnlineUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  lastActiveAt: string | null;
}

interface WebSocketOnlineUser {
  id: string;
  userName: string;
}

interface UserOnlineEvent {
  id: string;
  userName: string;
  timestamp: string;
}

interface UserOfflineEvent {
  id: string;
  userName: string;
  timestamp: string;
}

function getDisplayName(user: OnlineUser): string {
  if (user.displayName) return user.displayName;
  if (user.firstName && user.lastName)
    return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'Someone';
}

export function useOnlinePresenceNotifications() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const previousOnlineIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsOnlineUsers, setWsOnlineUsers] = useState<Map<string, WebSocketOnlineUser>>(new Map());

  // Send heartbeat to mark user as active
  const sendHeartbeat = useCallback(async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/users/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // Silently ignore heartbeat errors
    }
  }, [currentUser]);

  // Send heartbeat every 2 minutes to keep user marked as active
  useEffect(() => {
    if (!currentUser) return;

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval for subsequent heartbeats
    const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(heartbeatInterval);
  }, [currentUser, sendHeartbeat]);

  // WebSocket connection for real-time presence updates
  useEffect(() => {
    if (!currentUser) return;

    const socketUrl = window.location.origin;
    logger.log('[OnlinePresence] Connecting WebSocket to:', socketUrl);

    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      upgrade: true,
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      logger.log('[OnlinePresence] ✅ WebSocket connected');
      setWsConnected(true);

      // Join a presence channel to register this user and trigger user-online broadcast
      const userName = currentUser.firstName || currentUser.email || 'Anonymous';
      newSocket.emit('join-channel', {
        channel: 'presence',
        userId: String(currentUser.id),
        userName: userName,
      });

      // Request current online users list
      newSocket.emit('get-online-users');
    });

    newSocket.on('disconnect', () => {
      logger.log('[OnlinePresence] ❌ WebSocket disconnected');
      setWsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      logger.error('[OnlinePresence] Connection error:', error);
      setWsConnected(false);
    });

    // Handle initial online users list
    newSocket.on('online-users-list', (users: WebSocketOnlineUser[]) => {
      logger.log('[OnlinePresence] Received online users list:', users.length);
      const userMap = new Map<string, WebSocketOnlineUser>();
      users.forEach((u) => userMap.set(u.id, u));
      setWsOnlineUsers(userMap);
      
      // Initialize previousOnlineIdsRef with current users to avoid notifications on connect
      if (isFirstLoadRef.current) {
        previousOnlineIdsRef.current = new Set(users.map((u) => u.id));
      }
    });

    // Handle user coming online - show toast notification immediately
    newSocket.on('user-online', (data: UserOnlineEvent) => {
      logger.log('[OnlinePresence] User online:', data.userName, data.id);

      // Add to local state
      setWsOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.set(data.id, { id: data.id, userName: data.userName });
        return updated;
      });

      // Show toast notification if not the current user and not first load
      if (data.id !== String(currentUser.id) && !isFirstLoadRef.current) {
        // Check if this user wasn't already in our previous set (truly new)
        if (!previousOnlineIdsRef.current.has(data.id)) {
          toast({
            title: `${data.userName} is now online`,
            description: 'A team member just signed in',
            duration: 4000,
          });
        }
      }

      // Update previous IDs
      previousOnlineIdsRef.current.add(data.id);

      // Invalidate the online users query with a small delay to ensure DB commit completes
      // This fixes the race condition where the dropdown queries before the database
      // updateUserLastActive() transaction commits on the server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/users/online'] });
      }, 250); // 250ms delay allows DB write to complete
    });

    // Handle user going offline
    newSocket.on('user-offline', (data: UserOfflineEvent) => {
      logger.log('[OnlinePresence] User offline:', data.userName, data.id);

      // Remove from local state
      setWsOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.delete(data.id);
        return updated;
      });

      // Remove from previous IDs
      previousOnlineIdsRef.current.delete(data.id);

      // Invalidate the online users query with a small delay for consistency
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/users/online'] });
      }, 250);
    });

    setSocket(newSocket);

    return () => {
      logger.log('[OnlinePresence] Cleaning up WebSocket');
      newSocket.disconnect();
      setSocket(null);
      setWsConnected(false);
    };
  }, [currentUser, toast, queryClient]);

  // Fallback polling - reduced to 5 minutes since WebSocket handles real-time updates
  const { data: polledOnlineUsers = [] } = useQuery<OnlineUser[]>({
    queryKey: ['/api/users/online'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/online');
      return Array.isArray(response) ? response : [];
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes fallback polling (was 30 seconds)
    enabled: !!currentUser,
  });

  // Handle fallback polling notifications (only if WebSocket is not connected)
  useEffect(() => {
    if (!currentUser || polledOnlineUsers.length === 0) return;

    // If WebSocket is connected, skip polling-based notifications
    if (wsConnected) {
      // Just update the first load flag if needed
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        previousOnlineIdsRef.current = new Set(polledOnlineUsers.map((u) => u.id));
      }
      return;
    }

    const currentOnlineIds = new Set(polledOnlineUsers.map((u) => u.id));

    // Skip notifications on first load
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousOnlineIdsRef.current = currentOnlineIds;
      return;
    }

    // Find new users who weren't online before (fallback when WebSocket is down)
    const newUsers = polledOnlineUsers.filter(
      (user) =>
        user.id !== String(currentUser.id) && !previousOnlineIdsRef.current.has(user.id)
    );

    // Show toast for each new user (limit to avoid spam)
    if (newUsers.length > 0) {
      if (newUsers.length === 1) {
        toast({
          title: `${getDisplayName(newUsers[0])} is now online`,
          description: 'A team member just signed in',
          duration: 4000,
        });
      } else if (newUsers.length <= 3) {
        const names = newUsers.map((u) => getDisplayName(u)).join(', ');
        toast({
          title: `${names} are now online`,
          description: `${newUsers.length} team members just signed in`,
          duration: 4000,
        });
      } else {
        toast({
          title: `${newUsers.length} people came online`,
          description: `${getDisplayName(newUsers[0])} and ${newUsers.length - 1} others just signed in`,
          duration: 4000,
        });
      }
    }

    // Update previous state
    previousOnlineIdsRef.current = currentOnlineIds;
  }, [polledOnlineUsers, currentUser, toast, wsConnected]);

  // Return combined online users - prefer polled data for full user info, supplemented by WebSocket
  return { 
    onlineUsers: polledOnlineUsers,
    wsConnected,
    wsOnlineUserCount: wsOnlineUsers.size,
  };
}
