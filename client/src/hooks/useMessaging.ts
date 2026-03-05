import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { getOrCreateSocket, isSocketConnected } from '@/lib/socket-singleton';
import { logger } from '@/lib/logger';

interface UnreadCounts {
  general: number;
  committee: number;
  hosts: number;
  drivers: number;
  recipients: number;
  core_team: number;
  direct: number;
  groups: number;
  kudos: number;
  total: number;
  // Add context-specific counts
  suggestion: number;
  project: number;
  task: number;
}

interface Message {
  id: number;
  senderId: string;
  content: string;
  sender?: string;
  senderName?: string;
  senderEmail?: string;
  contextType?: string;
  contextId?: string;
  editedAt?: string;
  editedContent?: string;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface SendMessageParams {
  recipientIds: string[];
  content: string;
  contextType?: 'suggestion' | 'project' | 'task' | 'event' | 'graphic' | 'expense' | 'collection' | 'direct';
  contextId?: string;
  contextTitle?: string;
  parentMessageId?: number;
}

export function useMessaging() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [connected, setConnected] = useState(false);
  const socketInitialized = useRef(false);

  // Type guard for user object
  const isValidUser = (u: any): u is { id: string; email: string } => {
    return u && typeof u === 'object' && 'id' in u && 'email' in u;
  };


  // Get unread message counts
  const {
    data: unreadCounts = {
      general: 0,
      committee: 0,
      hosts: 0,
      drivers: 0,
      recipients: 0,
      core_team: 0,
      direct: 0,
      groups: 0,
      kudos: 0,
      total: 0,
      suggestion: 0,
      project: 0,
      task: 0,
    } as UnreadCounts,
    refetch: refetchUnreadCounts,
  } = useQuery({
    queryKey: [
      '/api/message-notifications/unread-counts',
      isValidUser(user) ? user.id : null,
    ],
    queryFn: async () => {
      if (!isValidUser(user))
        return {
          general: 0,
          committee: 0,
          hosts: 0,
          drivers: 0,
          recipients: 0,
          core_team: 0,
          direct: 0,
          groups: 0,
          kudos: 0,
          total: 0,
          suggestion: 0,
          project: 0,
          task: 0,
        };
      try {
        const response = await apiRequest(
          'GET',
          '/api/message-notifications/unread-counts'
        );
        // Add context-specific counts
        const contextCounts = await apiRequest(
          'GET',
          '/api/messaging/unread?groupByContext=true'
        );
        return {
          ...response,
          suggestion: (contextCounts && contextCounts.suggestion) || 0,
          project: (contextCounts && contextCounts.project) || 0,
          task: (contextCounts && contextCounts.task) || 0,
        };
      } catch (error) {
        logger.warn('Unread counts fetch failed:', error);
        return {
          general: 0,
          committee: 0,
          hosts: 0,
          drivers: 0,
          recipients: 0,
          core_team: 0,
          direct: 0,
          groups: 0,
          kudos: 0,
          total: 0,
          suggestion: 0,
          project: 0,
          task: 0,
        };
      }
    },
    enabled: isValidUser(user),
    staleTime: 120000, // Data remains fresh for 2 minutes
    gcTime: 300000,
    refetchInterval: 120000, // Refetch every 2 minutes (reduced from 30 seconds)
  });

  // Get unread messages
  const { data: unreadMessages = [], refetch: refetchUnreadMessages } =
    useQuery({
      queryKey: ['/api/messaging/unread', isValidUser(user) ? user.id : null],
      queryFn: async () => {
        if (!isValidUser(user)) return [];
        const response = await apiRequest('GET', '/api/messaging/unread');
        return response.messages || [];
      },
      enabled: isValidUser(user),
    });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (params: SendMessageParams) => {
      return await apiRequest('POST', '/api/messaging/send', params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
      toast({ description: 'Message sent successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  // Mark message as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return await apiRequest('POST', `/api/messaging/${messageId}/read`);
    },
    onSuccess: () => {
      refetchUnreadCounts();
      refetchUnreadMessages();
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
    },
  });

  // Mark all messages as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async (contextType?: string) => {
      return await apiRequest('POST', '/api/messaging/mark-all-read', {
        contextType,
      });
    },
    onSuccess: () => {
      refetchUnreadCounts();
      refetchUnreadMessages();
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
      toast({ description: 'All messages marked as read' });
    },
  });

  // Listen for notification refresh events (from chat mark-as-read)
  useEffect(() => {
    const handleNotificationRefresh = () => {
      logger.log(
        'Notification refresh event received in useMessaging hook - refetching counts'
      );
      refetchUnreadCounts();
    };

    window.addEventListener('notificationRefresh', handleNotificationRefresh);

    return () => {
      window.removeEventListener(
        'notificationRefresh',
        handleNotificationRefresh
      );
    };
  }, [refetchUnreadCounts]);

  // Setup Socket.IO connection for real-time messaging updates
  useEffect(() => {
    if (!isValidUser(user)) return;
    if (socketInitialized.current) return;

    logger.log('[Messaging] Setting up Socket.IO for user:', user.id);
    socketInitialized.current = true;
    
    const socket = getOrCreateSocket();
    
    const handleConnect = () => {
      logger.log('[Messaging] Socket.IO connected');
      setConnected(true);
      socket.emit('join-messaging-channel', { userId: user.id });
    };

    const handleDisconnect = () => {
      logger.log('[Messaging] Socket.IO disconnected');
      setConnected(false);
    };

    const handleNewMessage = (data: any) => {
      logger.log('[Messaging] New message received:', data);
      refetchUnreadCounts();
      refetchUnreadMessages();
      toast({
        title: 'New message',
        description: data.sender || 'You have a new message',
      });
    };

    const handleMessageEdited = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
    };

    const handleMessageDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messaging'] });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socketInitialized.current = false;
    };
  }, [user?.id, refetchUnreadCounts, refetchUnreadMessages, queryClient, toast]);

  // Send a message
  const sendMessage = useCallback(
    async (params: SendMessageParams) => {
      if (!isValidUser(user)) {
        toast({
          title: 'Not authenticated',
          description: 'Please log in to send messages',
          variant: 'destructive',
        });
        return;
      }

      return await sendMessageMutation.mutateAsync(params);
    },
    [isValidUser(user) ? user.id : null, sendMessageMutation, toast]
  );

  // Mark message as read
  const markAsRead = useCallback(
    async (messageId: number) => {
      return await markAsReadMutation.mutateAsync(messageId);
    },
    [markAsReadMutation]
  );

  // Mark all messages as read
  const markAllAsRead = useCallback(
    async (contextType?: string) => {
      return await markAllAsReadMutation.mutateAsync(contextType);
    },
    [markAllAsReadMutation]
  );

  // Get messages for a specific context
  const getContextMessages = useCallback(
    async (contextType: string, contextId: string) => {
      try {
        const response = await apiRequest(
          'GET',
          `/api/messaging/context/${contextType}/${contextId}`
        );
        return response.messages || [];
      } catch (error) {
        logger.error('Failed to fetch context messages:', error);
        return [];
      }
    },
    []
  );

  return {
    // Data
    unreadCounts,
    unreadMessages,
    totalUnread:
      unreadCounts.total +
      unreadCounts.suggestion +
      unreadCounts.project +
      unreadCounts.task,

    // Actions
    sendMessage,
    markAsRead,
    markAllAsRead,
    getContextMessages,
    refetchUnreadCounts,
    refetchUnreadMessages,

    // Status
    isConnected: connected,
    isSending: sendMessageMutation.isPending,
  };
}
