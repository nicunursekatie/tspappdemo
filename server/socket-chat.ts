import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { storage } from './storage';
import { EmailNotificationService } from './services/email-notification-service';
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getSocketCorsConfig } from './config/cors';
import { logger } from './utils/production-safe-logger';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  channel: string;
  room: string; // Add room for client compatibility
  edited?: boolean;
}

interface ConnectedUser {
  id: string;
  userName: string;
  channels: string[];
}

// Module-level variable to store Socket.IO instance
let socketInstance: SocketServer | null = null;

/**
 * Get the Socket.IO instance (for emitting events from routes)
 * Returns null if Socket.IO hasn't been initialized yet
 */
export function getSocketInstance(): SocketServer | null {
  return socketInstance;
}

/**
 * Emit a messaging event to a specific user
 * Use this to send real-time message updates (new, edited, deleted)
 */
export function emitMessagingEvent(userId: string, eventType: 'new_message' | 'message_edited' | 'message_deleted', data: any): void {
  if (!socketInstance) {
    logger.warn('Socket.IO not initialized, cannot emit messaging event');
    return;
  }

  const messagingChannel = `messaging:${userId}`;
  socketInstance.to(messagingChannel).emit(eventType, data);
  logger.log(`Emitted ${eventType} to ${messagingChannel}`);
}

/**
 * Emit an event request update to all connected clients
 * Use this to broadcast new/updated event requests for real-time UI updates
 */
export function emitEventRequestUpdate(eventType: 'event_request_created' | 'event_request_updated' | 'event_request_deleted', data: any): void {
  if (!socketInstance) {
    logger.warn('Socket.IO not initialized, cannot emit event request update');
    return;
  }

  // Broadcast to all connected clients
  socketInstance.emit(eventType, data);
  logger.log(`Emitted ${eventType} to all clients`);
}

export function setupSocketChat(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: getSocketCorsConfig(),
    path: '/socket.io/',
    // Start with polling for reliability through proxies, then upgrade to websocket
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    // Increase timeouts for production stability
    pingTimeout: 60000,
    pingInterval: 25000,
    // Allow upgrade after initial polling connection
    allowUpgrades: true,
  });

  // Store instance for access from routes
  socketInstance = io;

  logger.log('✓ Socket.IO server initialized on /socket.io/ with secure CORS');

  // Store active users
  const activeUsers = new Map<string, ConnectedUser>();

  io.on('connection', (socket) => {
    logger.log(`✅ Socket.IO client connected: ${socket.id}`);

    // Send available rooms to connected client
    socket.on('get-rooms', () => {
      const availableRooms = [
        { id: 'general', name: 'General Chat' },
        { id: 'core-team', name: 'Core Team' },
        { id: 'grants-committee', name: 'Grants Committee' },
        { id: 'events-committee', name: 'Events Committee' },
        { id: 'board-chat', name: 'Board Chat' },
        { id: 'web-committee', name: 'Web Committee' },
        { id: 'volunteer-management', name: 'Volunteer Management' },
        { id: 'host', name: 'Host Chat' },
        { id: 'driver', name: 'Driver Chat' },
        { id: 'recipient', name: 'Recipient Chat' },
      ];
      socket.emit('rooms', { available: availableRooms });
    });

    // Handle joining a channel
    socket.on(
      'join-channel',
      async (data: { channel: string; userId: string; userName: string }) => {
        try {
          const { channel, userId, userName } = data;

          // Check if this user was already tracked (reconnect or joining additional channel)
          const existingUser = activeUsers.get(socket.id);
          const wasAlreadyOnline = existingUser ||
            Array.from(activeUsers.values()).some(u => u.id === userId);

          // Store user info
          activeUsers.set(socket.id, {
            id: userId,
            userName,
            channels: existingUser
              ? [...new Set([...existingUser.channels, channel])]
              : [channel],
          });

          // Join the channel
          socket.join(channel);

          logger.log(
            `User ${userName} (${userId}) joined channel: ${channel}`
          );

          // Update lastActiveAt in the database so the HTTP /api/users/online endpoint
          // reflects this user as online immediately (not just after next heartbeat)
          try {
            await storage.updateUserLastActive(userId);
          } catch (err) {
            logger.error('Error updating lastActiveAt on channel join:', err);
          }

          // Load and send message history (latest 50 messages in reverse chronological order)
          try {
            const messageHistory = await storage.getChatMessages(channel, 50);
            // Convert database timestamps to proper Date objects and reverse to send oldest first
            const formattedMessages = messageHistory
              .map((msg) => ({
                ...msg,
                timestamp: new Date(msg.createdAt),
                room: msg.channel, // Add room property for client compatibility
              }))
              .reverse();
            socket.emit('message-history', {
              room: channel,
              messages: formattedMessages,
            });

            // Auto-mark all messages in this channel as read for the joining user
            try {
              await storage.markChannelMessagesAsRead(userId, channel);
              logger.log(
                `Marked all messages in ${channel} as read for user ${userId}`
              );
            } catch (markReadError) {
              logger.error('Error marking messages as read:', markReadError);
            }
          } catch (error) {
            logger.error('Error loading message history:', error);
            socket.emit('message-history', []);
          }

          // Send confirmation
          socket.emit('joined-channel', { channel, userName });

          // Only broadcast user-online for genuinely new connections (not reconnects
          // or additional channel joins) to avoid repeated toast notifications
          if (!wasAlreadyOnline) {
            io.emit('user-online', {
              id: userId,
              userName,
              timestamp: new Date().toISOString(),
            });
            logger.log(`Broadcasted user-online event for ${userName} (${userId})`);
          } else {
            logger.log(`Skipped user-online broadcast for ${userName} (${userId}) - already online`);
          }
        } catch (error) {
          logger.error('Error joining channel:', error);
          socket.emit('error', { message: 'Failed to join channel' });
        }
      }
    );

    // Handle getting list of all online users
    socket.on('get-online-users', () => {
      try {
        const onlineUsersList = Array.from(activeUsers.values()).map((user) => ({
          id: user.id,
          userName: user.userName,
        }));
        socket.emit('online-users-list', onlineUsersList);
        logger.log(`Sent online users list: ${onlineUsersList.length} users`);
      } catch (error) {
        logger.error('Error getting online users:', error);
        socket.emit('online-users-list', []);
      }
    });

    // Handle joining notification channel (for real-time notification updates)
    socket.on(
      'join-notification-channel',
      async (data: { userId: string; userName: string }) => {
        try {
          const { userId, userName } = data;

          // Join user-specific notification channel
          const notificationChannel = `notifications:${userId}`;
          socket.join(notificationChannel);

          logger.log(
            `User ${userName} (${userId}) joined notification channel: ${notificationChannel}`
          );

          // Send confirmation
          socket.emit('joined-notification-channel', { userId });
        } catch (error) {
          logger.error('Error joining notification channel:', error);
          socket.emit('error', { message: 'Failed to join notification channel' });
        }
      }
    );

    // Handle joining messaging channel (for real-time direct message updates)
    socket.on(
      'join-messaging-channel',
      async (data: { userId: string }) => {
        try {
          const { userId } = data;

          // Join user-specific messaging channel
          const messagingChannel = `messaging:${userId}`;
          socket.join(messagingChannel);

          logger.log(`User ${userId} joined messaging channel: ${messagingChannel}`);

          // Send confirmation
          socket.emit('joined-messaging-channel', { userId });
        } catch (error) {
          logger.error('Error joining messaging channel:', error);
          socket.emit('error', { message: 'Failed to join messaging channel' });
        }
      }
    );

    // Handle sending messages
    socket.on(
      'send-message',
      async ({ channel, content }: { channel: string; content: string }) => {
        try {
          const user = activeUsers.get(socket.id);
          if (!user) {
            socket.emit('error', { message: 'User not found' });
            return;
          }

          // Save message to database
          const savedMessage = await storage.createChatMessage({
            channel,
            userId: user.id,
            userName: user.userName,
            content,
          });

          const message: ChatMessage = {
            id: savedMessage.id.toString(),
            userId: user.id,
            userName: user.userName,
            content,
            timestamp: savedMessage.createdAt,
            channel,
            room: channel, // Add room property for client compatibility
          };

          // Broadcast to all users in the channel
          io.to(channel).emit('new-message', message);

          // Trigger notification system for new messages
          if ((global as any).broadcastNewMessage) {
            (global as any).broadcastNewMessage({
              type: 'notification',
              message: 'New chat message received',
              userId: user.id,
              channel: channel,
            });
          }

          // Process mentions and send email notifications
          try {
            // Get sender's email for notifications
            const senderDetails = await db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);

            const senderEmail =
              senderDetails[0]?.email || 'unknown@example.com';

            // Process message for mentions and send notifications
            await EmailNotificationService.processChatMessage(
              content,
              user.id,
              user.userName,
              senderEmail,
              channel,
              savedMessage.id
            );
          } catch (notificationError) {
            logger.error(
              'Error processing chat mention notifications:',
              notificationError
            );
            // Don't fail the message send if notifications fail
          }

          logger.log(
            `Message saved and sent to ${channel} by ${user.userName}: ${content}`
          );
        } catch (error) {
          logger.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      }
    );

    // Handle message editing
    socket.on(
      'edit-message',
      async ({
        messageId,
        newContent,
      }: {
        messageId: number;
        newContent: string;
      }) => {
        try {
          const user = activeUsers.get(socket.id);
          if (!user) {
            socket.emit('error', { message: 'User not found' });
            return;
          }

          // Get the message to verify ownership
          // Get all messages from all channels to find the specific one
          const allChannels = [
            'general',
            'core-team',
            'committee',
            'host',
            'driver',
            'recipient',
          ];
          let messageToEdit = null;

          for (const channel of allChannels) {
            const channelMessages = await storage.getChatMessages(
              channel,
              1000
            );
            messageToEdit = channelMessages.find(
              (msg) => msg.id === messageId || msg.id === messageId.toString()
            );
            if (messageToEdit) break;
          }

          if (!messageToEdit) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          if (messageToEdit.userId !== user.id) {
            socket.emit('error', {
              message: 'You can only edit your own messages',
            });
            return;
          }

          // Update the message in database
          await storage.updateChatMessage(messageId, { content: newContent });

          const updatedMessage: ChatMessage = {
            id: messageId.toString(),
            userId: user.id,
            userName: user.userName,
            content: newContent,
            timestamp: new Date(),
            channel: messageToEdit.channel,
            room: messageToEdit.channel,
            edited: true,
          };

          // Broadcast the updated message to all users in the channel
          io.to(messageToEdit.channel).emit('message-edited', updatedMessage);

          logger.log(
            `Message ${messageId} edited by ${user.userName} in ${messageToEdit.channel}`
          );
        } catch (error) {
          logger.error('Error editing message:', error);
          socket.emit('error', { message: 'Failed to edit message' });
        }
      }
    );

    // Handle message deletion
    socket.on(
      'delete-message',
      async ({ messageId }: { messageId: number }) => {
        try {
          const user = activeUsers.get(socket.id);
          if (!user) {
            socket.emit('error', { message: 'User not found' });
            return;
          }

          // Get the message to verify ownership or admin rights
          // Get all messages from all channels to find the specific one
          const allChannels = [
            'general',
            'core-team',
            'committee',
            'host',
            'driver',
            'recipient',
          ];
          let messageToDelete = null;

          for (const channel of allChannels) {
            const channelMessages = await storage.getChatMessages(
              channel,
              1000
            );
            messageToDelete = channelMessages.find(
              (msg) => msg.id === messageId || msg.id === messageId.toString()
            );
            if (messageToDelete) break;
          }

          if (!messageToDelete) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          // Allow deletion if user owns the message or is admin
          const isOwner = messageToDelete.userId === user.id;
          // Check for admin permissions - expand this based on your auth system
          const isAdmin =
            user.id === 'admin@sandwich.project' ||
            user.userName.toLowerCase().includes('admin') ||
            user.id === 'user_1751071509329_mrkw2z95z'; // Katie's admin account

          if (!isOwner && !isAdmin) {
            socket.emit('error', {
              message: 'You can only delete your own messages',
            });
            return;
          }

          // Delete the message from database
          await storage.deleteChatMessage(messageId);

          // Broadcast the deletion to all users in the channel
          io.to(messageToDelete.channel).emit('message-deleted', {
            messageId,
            deletedBy: user.userName,
          });

          logger.log(
            `Message ${messageId} deleted by ${user.userName} in ${messageToDelete.channel}`
          );
        } catch (error) {
          logger.error('Error deleting message:', error);
          socket.emit('error', { message: 'Failed to delete message' });
        }
      }
    );

    // Get history for a channel
    socket.on('get-history', async (channel: string) => {
      try {
        const messageHistory = await storage.getChatMessages(channel, 50);
        const formattedMessages = messageHistory
          .map((msg) => ({
            ...msg,
            timestamp: new Date(msg.createdAt),
            room: msg.channel,
          }))
          .reverse();
        socket.emit('message-history', {
          room: channel,
          messages: formattedMessages,
        });
        logger.log(
          `Sent message history for ${channel}: ${formattedMessages.length} messages`
        );
      } catch (error) {
        logger.error('Error loading message history:', error);
        socket.emit('message-history', { room: channel, messages: [] });
      }
    });

    // Handle leaving a channel
    socket.on(
      'leave-channel',
      (data: { channel: string; userId: string; userName: string }) => {
        const { channel, userName } = data;
        socket.leave(channel);
        logger.log(`User ${userName} left channel: ${channel}`);
      }
    );

    // ========================================================================
    // UNIFIED ACTIVITIES SYSTEM - Socket.IO Events
    // ========================================================================

    /**
     * Subscribe to activity updates
     * Join a room for real-time updates on a specific activity or context
     */
    socket.on('activity:subscribe', (data: { activityId?: string; contextType?: string; contextId?: string }) => {
      try {
        const { activityId, contextType, contextId } = data;

        if (activityId) {
          // Subscribe to specific activity (for thread views)
          socket.join(`activity:${activityId}`);
          logger.log(`Socket ${socket.id} subscribed to activity: ${activityId}`);
        }

        if (contextType && contextId) {
          // Subscribe to all activities in a context (e.g., all tasks in a project)
          const contextRoom = `context:${contextType}:${contextId}`;
          socket.join(contextRoom);
          logger.log(`Socket ${socket.id} subscribed to context: ${contextRoom}`);
        }
      } catch (error) {
        logger.error('Error subscribing to activity:', error);
      }
    });

    /**
     * Unsubscribe from activity updates
     */
    socket.on('activity:unsubscribe', (data: { activityId?: string; contextType?: string; contextId?: string }) => {
      try {
        const { activityId, contextType, contextId } = data;

        if (activityId) {
          socket.leave(`activity:${activityId}`);
          logger.log(`Socket ${socket.id} unsubscribed from activity: ${activityId}`);
        }

        if (contextType && contextId) {
          socket.leave(`context:${contextType}:${contextId}`);
          logger.log(`Socket ${socket.id} unsubscribed from context: ${contextType}:${contextId}`);
        }
      } catch (error) {
        logger.error('Error unsubscribing from activity:', error);
      }
    });

    /**
     * Activity created event (emitted from server-side only)
     * Clients subscribe to this via activity:subscribe
     */
    // Note: This is emitted from the backend API routes, not from client events
    // Example usage in routes/activities.ts:
    //   io.to(`context:${contextType}:${contextId}`).emit('activity:created', activity);

    /**
     * Activity updated event (emitted from server-side only)
     */
    // Example usage:
    //   io.to(`activity:${activityId}`).emit('activity:updated', updatedActivity);

    /**
     * Activity reply event (emitted from server-side only)
     */
    // Example usage:
    //   io.to(`activity:${rootId}`).emit('activity:reply', reply);

    /**
     * Activity reaction event (emitted from server-side only)
     */
    // Example usage:
    //   io.to(`activity:${activityId}`).emit('activity:reaction', { activityId, userId, reactionType });

    /**
     * Typing indicator for activity threads (optional future feature)
     */
    socket.on('activity:typing', (data: { activityId: string; userName: string }) => {
      try {
        const { activityId, userName } = data;
        socket.to(`activity:${activityId}`).emit('activity:user-typing', {
          activityId,
          userName,
        });
      } catch (error) {
        logger.error('Error broadcasting typing indicator:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Get user info BEFORE deleting from activeUsers for the offline broadcast
      const disconnectedUser = activeUsers.get(socket.id);
      
      // Delete from activeUsers
      activeUsers.delete(socket.id);
      logger.log(`Socket disconnected: ${socket.id}`);

      // Broadcast user-offline event only if no other connections exist for this user
      // (prevents false offline events when a user has multiple tabs open)
      if (disconnectedUser) {
        const hasOtherConnections = Array.from(activeUsers.values()).some(
          u => u.id === disconnectedUser.id
        );
        if (!hasOtherConnections) {
          io.emit('user-offline', {
            id: disconnectedUser.id,
            userName: disconnectedUser.userName,
            timestamp: new Date().toISOString(),
          });
          logger.log(`Broadcasted user-offline event for ${disconnectedUser.userName} (${disconnectedUser.id})`);
        } else {
          logger.log(`Skipped user-offline broadcast for ${disconnectedUser.userName} (${disconnectedUser.id}) - still has other connections`);
        }
      }
    });
  });

  return io;
}
