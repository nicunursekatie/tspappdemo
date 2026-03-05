import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface NotificationActionEvent {
  notificationId: number;
  actionType: string;
  actionStatus: 'success' | 'failed';
  userId: string;
  result?: any;
}

interface NotificationCreatedEvent {
  notification: any;
  priority: string;
}

export function useNotificationSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Use current origin for Socket.IO connection
    const socketUrl = window.location.origin;
    logger.log('[NotificationSocket] Connecting to:', socketUrl);

    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'], // Try polling first, then upgrade
      upgrade: true,
      timeout: 30000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on('connect', () => {
      logger.log('[NotificationSocket] ✅ Connected');
      setConnected(true);

      // Join user-specific notification channel
      newSocket.emit('join-notification-channel', {
        userId: user.id,
        userName: user.firstName || user.email,
      });
    });

    newSocket.on('disconnect', () => {
      logger.log('[NotificationSocket] ❌ Disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      logger.error('[NotificationSocket] Connection error:', error);
      setConnected(false);
    });

    // Listen for notification action completed events
    newSocket.on('notification-action-completed', (data: NotificationActionEvent) => {
      logger.log('[NotificationSocket] Action completed:', data);

      // Invalidate queries to refresh the notification list
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });

      // If the action was on the current user's notification, the UI will auto-update
    });

    // Listen for new notification events
    newSocket.on('notification-created', (data: NotificationCreatedEvent) => {
      logger.log('[NotificationSocket] New notification:', data);

      // Invalidate queries to show the new notification
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    });

    // Listen for notification updates (read, archived, etc.)
    newSocket.on('notification-updated', (data: { notificationId: number; changes: any }) => {
      logger.log('[NotificationSocket] Notification updated:', data);

      // Invalidate queries to reflect changes
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    });

    // Listen for notification_update (emitted by Stream Chat webhook when a new chat message creates/updates an in-app notification)
    newSocket.on('notification_update', (data: { type?: string; channelId?: string; channelName?: string }) => {
      logger.log('[NotificationSocket] Notification update (e.g. new chat message):', data);

      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      logger.log('[NotificationSocket] Disconnecting...');
      newSocket.disconnect();
    };
  }, [user]);

  return {
    socket,
    connected,
  };
}
