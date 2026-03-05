import { Router, Response } from 'express';
import { db } from '../db';
import { instantMessages, instantMessageLikes, users } from '@shared/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated } from '../auth';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/production-safe-logger';
import { getSocketInstance } from '../socket-chat';
import { transformMessageForApi, createErrorResponse } from '@shared/types';

const router = Router();

// Get conversation with a specific user
router.get('/:userId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const otherUserId = req.params.userId;

    // Get all messages between current user and the other user
    const messages = await db
      .select()
      .from(instantMessages)
      .where(
        or(
          and(
            eq(instantMessages.senderId, currentUser.id),
            eq(instantMessages.recipientId, otherUserId)
          ),
          and(
            eq(instantMessages.senderId, otherUserId),
            eq(instantMessages.recipientId, currentUser.id)
          )
        )
      )
      .orderBy(instantMessages.createdAt)
      .limit(100);

    // Mark messages from the other user as read
    await db
      .update(instantMessages)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(instantMessages.senderId, otherUserId),
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      );

    // Transform messages to use canonical field names (isRead instead of read)
    const transformedMessages = messages.map((msg) => transformMessageForApi(msg));
    res.json(transformedMessages);
  } catch (error) {
    logger.error('[Instant Messages] Error fetching conversation:', error);
    res.status(500).json(createErrorResponse('Failed to fetch conversation', 'INTERNAL_ERROR'));
  }
});

// Send a new instant message
router.post('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, content } = req.body;

    if (!recipientId || !content?.trim()) {
      return res.status(400).json({ message: 'recipientId and content are required' });
    }

    // Get sender's display name
    const senderName =
      currentUser.displayName ||
      `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
      currentUser.email ||
      'Unknown User';

    // Insert the message
    const [newMessage] = await db
      .insert(instantMessages)
      .values({
        senderId: currentUser.id,
        senderName,
        recipientId,
        content: content.trim(),
        read: false,
      })
      .returning();

    logger.log(`[Instant Messages] Message sent from ${currentUser.id} to ${recipientId}`);

    // Transform to canonical field names (isRead instead of read)
    const transformedMessage = transformMessageForApi(newMessage);

    // Emit to recipient via Socket.IO for real-time delivery
    const io = getSocketInstance();
    if (io) {
      // Emit to recipient's messaging channel
      io.to(`messaging:${recipientId}`).emit('instant_message', transformedMessage);
      // Also emit to sender's messaging channel (for multi-device sync)
      io.to(`messaging:${currentUser.id}`).emit('instant_message', transformedMessage);
    }

    res.status(201).json(transformedMessage);
  } catch (error) {
    logger.error('[Instant Messages] Error sending message:', error);
    res.status(500).json(createErrorResponse('Failed to send message', 'INTERNAL_ERROR'));
  }
});

// Mark messages from a user as read
router.post('/:userId/read', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const otherUserId = req.params.userId;

    await db
      .update(instantMessages)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(instantMessages.senderId, otherUserId),
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      );

    res.json({ success: true });
  } catch (error) {
    logger.error('[Instant Messages] Error marking messages as read:', error);
    res.status(500).json(createErrorResponse('Failed to mark messages as read', 'INTERNAL_ERROR'));
  }
});

// Get unread count for instant messages
router.get('/unread/count', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const unreadMessages = await db
      .select()
      .from(instantMessages)
      .where(
        and(
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      )
      .orderBy(desc(instantMessages.createdAt));

    // Group by sender to get count per conversation
    const countBySender = unreadMessages.reduce((acc, msg) => {
      acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: unreadMessages.length,
      bySender: countBySender,
      messages: unreadMessages, // Include messages for polling fallback
    });
  } catch (error) {
    logger.error('[Instant Messages] Error getting unread count:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Get recent conversations (list of users you've chatted with)
router.get('/conversations/recent', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get distinct users this user has conversed with
    const sentMessages = await db
      .selectDistinct({ recipientId: instantMessages.recipientId })
      .from(instantMessages)
      .where(eq(instantMessages.senderId, currentUser.id));

    const receivedMessages = await db
      .selectDistinct({ senderId: instantMessages.senderId })
      .from(instantMessages)
      .where(eq(instantMessages.recipientId, currentUser.id));

    // Combine unique user IDs
    const userIds = new Set([
      ...sentMessages.map(m => m.recipientId),
      ...receivedMessages.map(m => m.senderId),
    ]);

    // Get user details for each conversation partner
    const conversationPartners = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const [user] = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            displayName: users.displayName,
            email: users.email,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) return null;

        // Get last message and unread count
        const [lastMessage] = await db
          .select()
          .from(instantMessages)
          .where(
            or(
              and(
                eq(instantMessages.senderId, currentUser.id),
                eq(instantMessages.recipientId, userId)
              ),
              and(
                eq(instantMessages.senderId, userId),
                eq(instantMessages.recipientId, currentUser.id)
              )
            )
          )
          .orderBy(desc(instantMessages.createdAt))
          .limit(1);

        const unreadMessages = await db
          .select()
          .from(instantMessages)
          .where(
            and(
              eq(instantMessages.senderId, userId),
              eq(instantMessages.recipientId, currentUser.id),
              eq(instantMessages.read, false)
            )
          );

        return {
          user,
          lastMessage,
          unreadCount: unreadMessages.length,
        };
      })
    );

    // Filter out nulls and sort by last message time
    const validConversations = conversationPartners
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.createdAt!).getTime() - new Date(a.lastMessage.createdAt!).getTime();
      });

    res.json(validConversations);
  } catch (error) {
    logger.error('[Instant Messages] Error getting recent conversations:', error);
    res.status(500).json({ message: 'Failed to get recent conversations' });
  }
});

// Like/react to a message
router.post('/:messageId/like', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);
    const { emoji = '❤️' } = req.body;

    if (isNaN(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    // Verify message exists
    const [message] = await db
      .select()
      .from(instantMessages)
      .where(eq(instantMessages.id, messageId))
      .limit(1);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Get user's display name
    const userName =
      currentUser.displayName ||
      `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
      currentUser.email ||
      'Unknown User';

    // Insert like (will fail silently if already liked due to unique constraint)
    const [like] = await db
      .insert(instantMessageLikes)
      .values({
        messageId,
        userId: currentUser.id,
        userName,
        emoji,
      })
      .onConflictDoNothing()
      .returning();

    if (!like) {
      // Already liked - return existing like count
      const likes = await db
        .select()
        .from(instantMessageLikes)
        .where(eq(instantMessageLikes.messageId, messageId));

      return res.json({
        liked: true,
        alreadyLiked: true,
        likes,
        likeCount: likes.length,
      });
    }

    // Get all likes for this message
    const likes = await db
      .select()
      .from(instantMessageLikes)
      .where(eq(instantMessageLikes.messageId, messageId));

    logger.log(`[Instant Messages] Message ${messageId} liked by ${currentUser.id}`);

    // Emit real-time update via Socket.IO
    const io = getSocketInstance();
    if (io) {
      // Notify both sender and recipient of the message about the like
      io.to(`messaging:${message.senderId}`).emit('instant_message_like', {
        messageId,
        like,
        likes,
        likeCount: likes.length,
      });
      io.to(`messaging:${message.recipientId}`).emit('instant_message_like', {
        messageId,
        like,
        likes,
        likeCount: likes.length,
      });
    }

    res.status(201).json({
      liked: true,
      like,
      likes,
      likeCount: likes.length,
    });
  } catch (error) {
    logger.error('[Instant Messages] Error liking message:', error);
    res.status(500).json({ message: 'Failed to like message' });
  }
});

// Unlike/remove reaction from a message
router.delete('/:messageId/like', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);
    const { emoji = '❤️' } = req.body;

    if (isNaN(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    // Get the message for socket notification
    const [message] = await db
      .select()
      .from(instantMessages)
      .where(eq(instantMessages.id, messageId))
      .limit(1);

    // Delete the like
    const result = await db
      .delete(instantMessageLikes)
      .where(
        and(
          eq(instantMessageLikes.messageId, messageId),
          eq(instantMessageLikes.userId, currentUser.id),
          eq(instantMessageLikes.emoji, emoji)
        )
      );

    // Get remaining likes
    const likes = await db
      .select()
      .from(instantMessageLikes)
      .where(eq(instantMessageLikes.messageId, messageId));

    logger.log(`[Instant Messages] Message ${messageId} unliked by ${currentUser.id}`);

    // Emit real-time update via Socket.IO
    if (message) {
      const io = getSocketInstance();
      if (io) {
        io.to(`messaging:${message.senderId}`).emit('instant_message_unlike', {
          messageId,
          userId: currentUser.id,
          emoji,
          likes,
          likeCount: likes.length,
        });
        io.to(`messaging:${message.recipientId}`).emit('instant_message_unlike', {
          messageId,
          userId: currentUser.id,
          emoji,
          likes,
          likeCount: likes.length,
        });
      }
    }

    res.json({
      unliked: true,
      likes,
      likeCount: likes.length,
    });
  } catch (error) {
    logger.error('[Instant Messages] Error unliking message:', error);
    res.status(500).json({ message: 'Failed to unlike message' });
  }
});

// Get likes for a message
router.get('/:messageId/likes', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const messageId = parseInt(req.params.messageId);

    if (isNaN(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    const likes = await db
      .select()
      .from(instantMessageLikes)
      .where(eq(instantMessageLikes.messageId, messageId))
      .orderBy(instantMessageLikes.createdAt);

    res.json({
      likes,
      likeCount: likes.length,
    });
  } catch (error) {
    logger.error('[Instant Messages] Error fetching likes:', error);
    res.status(500).json({ message: 'Failed to fetch likes' });
  }
});

export default router;
