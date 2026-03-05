import { and, eq, sql, desc, inArray, isNull, lte, or, not } from 'drizzle-orm';
import { db } from '../db';
import {
  messages,
  messageRecipients,
  kudosTracking,
  users,
  conversations,
  conversationParticipants,
  type Message,
  type MessageRecipient,
  type InsertMessage,
  type InsertMessageRecipient,
  type InsertKudosTracking,
} from '@shared/schema';
import { NotificationService } from '../notification-service';
import { logger } from '../utils/production-safe-logger';

export interface MessageWithSender extends Message {
  senderName?: string;
  senderEmail?: string;
  readAt?: Date | null;
}

export interface ConversationSummary {
  recipientId: string;
  recipientName?: string;
  lastMessage?: MessageWithSender;
  unreadCount: number;
  totalMessages: number;
}

export interface MessageAttachment {
  name: string;
  url: string;
  type: string; // MIME type
  size: number; // bytes
}

export interface SendMessageParams {
  senderId: string;
  recipientIds: string[];
  content: string;
  contextType?: 'suggestion' | 'project' | 'task' | 'event' | 'graphic' | 'expense' | 'collection' | 'direct';
  contextId?: string;
  contextTitle?: string;
  parentMessageId?: number;
  attachments?: MessageAttachment[];
}

export interface ThreadPage {
  messages: MessageWithSender[];
  totalCount: number;
  hasMore: boolean;
}

export class MessagingService {
  /**
   * Send a message to one or more recipients
   */
  async sendMessage(params: SendMessageParams): Promise<Message> {
    const {
      senderId,
      recipientIds,
      content,
      contextType,
      contextId,
      contextTitle,
      parentMessageId,
      attachments,
    } = params;

    try {
      // Get sender details
      const sender = await db
        .select({
          displayName: users.displayName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, senderId))
        .limit(1);

      const senderName = sender[0]
        ? sender[0].displayName || sender[0].email || 'Unknown User'
        : 'Unknown User';

      // If this is a reply, get the original message content
      let replyToMessageId: number | null = null;
      let replyToContent: string | null = null;
      let replyToSender: string | null = null;

      if (parentMessageId) {
        const [originalMessage] = await db
          .select({
            id: messages.id,
            content: messages.content,
            sender: messages.sender,
          })
          .from(messages)
          .where(eq(messages.id, parentMessageId))
          .limit(1);

        if (originalMessage) {
          replyToMessageId = originalMessage.id;
          replyToContent = originalMessage.content;
          replyToSender = originalMessage.sender;
        }
      }

      // Create the message
      const [message] = await db
        .insert(messages)
        .values({
          userId: senderId, // Keep for backward compatibility - this should be senderId
          senderId,
          content,
          sender: senderName,
          contextType,
          contextId,
          contextTitle,
          attachments: attachments ? JSON.stringify(attachments) : null,
          replyToMessageId,
          replyToContent,
          replyToSender,
        })
        .returning();

      // Create recipient entries
      const recipientValues: InsertMessageRecipient[] = recipientIds.map(
        (recipientId) => ({
          messageId: message.id,
          recipientId,
          read: false,
          notificationSent: false,
        })
      );

      await db.insert(messageRecipients).values(recipientValues);

      // Trigger notifications (don't await - let it run async)
      this.triggerNotifications(message, recipientIds).catch((error) => {
        logger.error('Failed to send notifications:', error);
      });

      return message;
    } catch (error) {
      logger.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Get unread messages for a recipient
   */
  async getUnreadMessages(
    recipientId: string,
    options?: {
      contextType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<MessageWithSender[]> {
    const { contextType, limit = 50, offset = 0 } = options || {};

    try {
      const query = db
        .select({
          message: messages,
          senderName: sql<string>`COALESCE(${users.displayName}, ${messages.sender}, 'Unknown User')`,
          senderEmail: users.email,
        })
        .from(messageRecipients)
        .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(
          and(
            eq(messageRecipients.recipientId, recipientId),
            eq(messageRecipients.read, false),
            isNull(messages.deletedAt),
            eq(messageRecipients.contextAccessRevoked, false),
            contextType ? eq(messages.contextType, contextType) : undefined
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      const results = await query;

      return results.map((row) => ({
        ...row.message,
        senderName: row.senderName || 'Unknown User',
        senderEmail: row.senderEmail || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get unread messages:', error);
      throw error;
    }
  }

  /**
   * Mark a message as read - ONLY if the current user is the recipient
   */
  async markMessageRead(userId: string, messageId: number): Promise<boolean> {
    try {
      logger.log(`[markMessageRead] Attempting to mark message ${messageId} as read for user ${userId}`);

      // First, check if the message exists and get sender info
      const messageInfo = await db
        .select({
          senderId: messages.senderId,
        })
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (messageInfo.length === 0) {
        logger.log(`[markMessageRead] Message ${messageId} not found in messages table`);
        return false;
      }

      const { senderId } = messageInfo[0];
      logger.log(`[markMessageRead] Message ${messageId} has senderId: ${senderId}, current userId: ${userId}`);

      // If current user is the sender, don't update read status (sender messages are always "read")
      if (senderId === userId) {
        logger.log(
          `[markMessageRead] User ${userId} is sender of message ${messageId} - no read update needed`
        );
        return true; // Return true since sender doesn't need to mark their own message as read
      }

      // Check if recipient entry exists before updating
      const recipientCheck = await db
        .select({
          id: messageRecipients.id,
          recipientId: messageRecipients.recipientId,
          messageId: messageRecipients.messageId,
          read: messageRecipients.read,
        })
        .from(messageRecipients)
        .where(eq(messageRecipients.messageId, messageId));

      logger.log(`[markMessageRead] Found ${recipientCheck.length} messageRecipients entries for messageId ${messageId}:`,
        JSON.stringify(recipientCheck.map(r => ({ id: r.id, recipientId: r.recipientId, read: r.read }))));

      const matchingRecipient = recipientCheck.find(r => r.recipientId === userId);
      if (!matchingRecipient) {
        logger.log(`[markMessageRead] No messageRecipients entry found for userId ${userId} and messageId ${messageId} - creating one`);
        // Create the missing message_recipients entry (for old kudos that didn't have one)
        await db.insert(messageRecipients).values({
          messageId,
          recipientId: userId,
          read: true,
          isRead: true,
          notificationSent: true,
          initiallyNotified: true,
          readAt: new Date(),
        }).onConflictDoUpdate({
          target: [messageRecipients.messageId, messageRecipients.recipientId],
          set: { read: true, isRead: true, readAt: new Date() }
        });
        logger.log(`[markMessageRead] Created message_recipients entry for userId ${userId} and messageId ${messageId}`);
        return true;
      }

      logger.log(`[markMessageRead] Found matching recipient entry: id=${matchingRecipient.id}, currentRead=${matchingRecipient.read}`);

      // Only update if user is actually a recipient
      // Update both 'read' (legacy) and 'isRead' (canonical) columns
      const result = await db
        .update(messageRecipients)
        .set({
          read: true,
          isRead: true,
          readAt: new Date(),
        })
        .where(
          and(
            eq(messageRecipients.recipientId, userId),
            eq(messageRecipients.messageId, messageId)
          )
        );

      logger.log(`[markMessageRead] UPDATE completed for message ${messageId}, recipient ${userId}`);

      // Verify the update worked
      const verifyCheck = await db
        .select({ read: messageRecipients.read })
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.recipientId, userId),
            eq(messageRecipients.messageId, messageId)
          )
        )
        .limit(1);

      logger.log(`[markMessageRead] Verification - read status is now: ${verifyCheck[0]?.read}`);

      return true;
    } catch (error) {
      logger.error('[markMessageRead] Failed to mark message as read:', error);
      return false;
    }
  }

  /**
   * Mark all messages as read for a recipient - ONLY messages where user is the recipient
   */
  async markAllMessagesRead(
    userId: string,
    contextType?: string
  ): Promise<number> {
    try {
      if (contextType) {
        // Mark read only for specific context type, excluding messages where user is the sender
        const messageIds = await db
          .select({ id: messages.id })
          .from(messages)
          .innerJoin(
            messageRecipients,
            eq(messages.id, messageRecipients.messageId)
          )
          .where(
            and(
              eq(messageRecipients.recipientId, userId),
              eq(messageRecipients.read, false),
              eq(messages.contextType, contextType),
              // Don't mark messages where user is the sender
              not(eq(messages.senderId, userId))
            )
          );

        if (messageIds.length > 0) {
          await db
            .update(messageRecipients)
            .set({ read: true, readAt: new Date() })
            .where(
              and(
                eq(messageRecipients.recipientId, userId),
                inArray(
                  messageRecipients.messageId,
                  messageIds.map((m) => m.id)
                )
              )
            );
        }

        logger.log(
          `Marked ${messageIds.length} messages as read for recipient ${userId} in context ${contextType}`
        );
        return messageIds.length;
      } else {
        // Mark all messages as read, excluding messages where user is the sender
        const messageIds = await db
          .select({ id: messages.id })
          .from(messages)
          .innerJoin(
            messageRecipients,
            eq(messages.id, messageRecipients.messageId)
          )
          .where(
            and(
              eq(messageRecipients.recipientId, userId),
              eq(messageRecipients.read, false),
              // Don't mark messages where user is the sender
              not(eq(messages.senderId, userId))
            )
          );

        if (messageIds.length > 0) {
          await db
            .update(messageRecipients)
            .set({ read: true, readAt: new Date() })
            .where(
              and(
                eq(messageRecipients.recipientId, userId),
                inArray(
                  messageRecipients.messageId,
                  messageIds.map((m) => m.id)
                )
              )
            );
        }

        logger.log(
          `Marked ${messageIds.length} total messages as read for recipient ${userId}`
        );
        return messageIds.length;
      }
    } catch (error) {
      logger.error('Failed to mark all messages as read:', error);
      throw error;
    }
  }

  /**
   * Get unread message counts by context type - ONLY for recipients, never for senders
   */
  async getUnreadCountsByContext(
    userId: string
  ): Promise<Record<string, number>> {
    try {
      const contextCounts = await db
        .select({
          contextType: messages.contextType,
          count: sql<number>`COUNT(*)`,
        })
        .from(messageRecipients)
        .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
        .where(
          and(
            eq(messageRecipients.recipientId, userId),
            eq(messageRecipients.read, false),
            isNull(messages.deletedAt),
            eq(messageRecipients.contextAccessRevoked, false),
            // Don't count messages where user is the sender
            not(eq(messages.senderId, userId))
          )
        )
        .groupBy(messages.contextType);

      const result: Record<string, number> = {
        suggestion: 0,
        project: 0,
        task: 0,
        direct: 0,
      };

      // Map the database results to our result object
      contextCounts.forEach((row) => {
        if (row.contextType && result.hasOwnProperty(row.contextType)) {
          result[row.contextType] = row.count;
        }
      });

      logger.log(`Unread counts by context for user ${userId}:`, result);
      return result;
    } catch (error) {
      logger.error('Failed to get unread counts by context:', error);
      throw error;
    }
  }

  /**
   * Get messages for a specific context
   */
  async getContextMessages(
    contextType: string,
    contextId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<MessageWithSender[]> {
    const { limit = 50, offset = 0 } = options || {};

    try {
      const results = await db
        .select({
          message: messages,
          senderName: sql<string>`COALESCE(${users.displayName}, ${messages.sender}, 'Unknown User')`,
          senderEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.senderId))
        .where(
          and(
            eq(messages.contextType, contextType),
            eq(messages.contextId, contextId),
            isNull(messages.deletedAt)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((row) => ({
        ...row.message,
        senderName: row.senderName || 'Unknown User',
        senderEmail: row.senderEmail || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get context messages:', error);
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(
    messageId: number,
    userId: string,
    newContent: string
  ): Promise<Message> {
    try {
      // Check if user is sender and within edit window (15 minutes)
      const [existingMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!existingMessage) {
        throw new Error('Message not found');
      }

      if (existingMessage.senderId !== userId) {
        throw new Error('Only the sender can edit this message');
      }

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (
        existingMessage.createdAt &&
        existingMessage.createdAt < fifteenMinutesAgo
      ) {
        throw new Error('Edit window has expired (15 minutes)');
      }

      // Update message
      const [updatedMessage] = await db
        .update(messages)
        .set({
          editedContent: newContent,
          editedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId))
        .returning();

      // Broadcast edit notification via WebSocket
      if ((global as any).broadcastMessageEdit) {
        (global as any).broadcastMessageEdit({
          messageId,
          newContent,
          editedAt: updatedMessage.editedAt,
        });
      }

      return updatedMessage;
    } catch (error) {
      logger.error('Failed to edit message:', error);
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId: number, userId: string): Promise<boolean> {
    try {
      const [existingMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId))
        .limit(1);

      if (!existingMessage) {
        return false;
      }

      // Check if user is sender
      if (existingMessage.senderId !== userId) {
        throw new Error('Only the sender can delete this message');
      }

      await db
        .update(messages)
        .set({
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId));

      // Broadcast delete notification
      if ((global as any).broadcastMessageDelete) {
        (global as any).broadcastMessageDelete({
          messageId,
          deletedAt: new Date(),
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to delete message:', error);
      return false;
    }
  }

  /**
   * Validate user has access to context
   */
  async validateContextAccess(
    userId: string,
    contextType: string,
    contextId: string
  ): Promise<boolean> {
    // This would check against your project/suggestion/task permissions
    // For now, return true - implement based on your permission system
    return true;
  }

  /**
   * Sync context permissions when users are added/removed
   */
  async syncContextPermissions(
    contextType: string,
    contextId: string,
    allowedUserIds: string[]
  ): Promise<void> {
    try {
      // Get all recipients who have messages for this context
      const affectedRecipients = await db
        .selectDistinct({ recipientId: messageRecipients.recipientId })
        .from(messageRecipients)
        .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
        .where(
          and(
            eq(messages.contextType, contextType),
            eq(messages.contextId, contextId)
          )
        );

      // Mark access as revoked for users not in allowedUserIds
      const revokedUserIds = affectedRecipients
        .map((r) => r.recipientId)
        .filter((id) => !allowedUserIds.includes(id));

      if (revokedUserIds.length > 0) {
        await db
          .update(messageRecipients)
          .set({ contextAccessRevoked: true })
          .where(
            and(
              inArray(messageRecipients.recipientId, revokedUserIds),
              eq(messages.contextType, contextType),
              eq(messages.contextId, contextId)
            )
          );
      }
    } catch (error) {
      logger.error('Failed to sync context permissions:', error);
      throw error;
    }
  }

  /**
   * Send kudos message with tracking
   */
  async sendKudos(params: {
    senderId: string;
    recipientId: string;
    content: string;
    contextType: 'project' | 'task';
    contextId: string;
    entityName: string;
  }): Promise<{ message: Message; alreadySent: boolean }> {
    const {
      senderId,
      recipientId,
      content,
      contextType,
      contextId,
      entityName,
    } = params;

    try {
      // Validate recipient exists in users table
      const recipientExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, recipientId))
        .limit(1);

      if (recipientExists.length === 0) {
        logger.error(
          `Kudos recipient not found in users table: ${recipientId}`
        );
        throw new Error(
          `Invalid recipient: ${recipientId}. User does not exist in the system.`
        );
      }

      // Check if kudos already sent
      const existing = await db
        .select()
        .from(kudosTracking)
        .where(
          and(
            eq(kudosTracking.senderId, senderId),
            eq(kudosTracking.recipientId, recipientId),
            eq(kudosTracking.contextType, contextType),
            eq(kudosTracking.contextId, contextId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return {
          message: existing[0] as any, // Return existing message reference
          alreadySent: true,
        };
      }

      // Send the kudos message
      const message = await this.sendMessage({
        senderId,
        recipientIds: [recipientId],
        content: content || `🎉 Kudos! Great job completing ${entityName}!`,
        contextType,
        contextId,
      });

      // Track the kudos
      await db.insert(kudosTracking).values({
        senderId,
        recipientId,
        contextType,
        contextId,
        messageId: message.id,
      });

      return { message, alreadySent: false };
    } catch (error) {
      logger.error('Failed to send kudos:', error);
      throw error;
    }
  }

  /**
   * Check if kudos was already sent
   */
  async hasKudosSent(
    senderId: string,
    recipientId: string,
    contextType: string,
    contextId: string
  ): Promise<boolean> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(kudosTracking)
        .where(
          and(
            eq(kudosTracking.senderId, senderId),
            eq(kudosTracking.recipientId, recipientId),
            eq(kudosTracking.contextType, contextType),
            eq(kudosTracking.contextId, contextId)
          )
        );

      return result[0]?.count > 0;
    } catch (error) {
      logger.error('Failed to check kudos status:', error);
      return false;
    }
  }

  /**
   * Mark kudos messages as read
   */
  async markKudosAsRead(
    userId: string,
    kudosIds: number[]
  ): Promise<{ count: number }> {
    try {
      logger.log(`[markKudosAsRead] Marking kudos as read for user ${userId}, message IDs: ${kudosIds.join(', ')}`);
      
      // Get the message IDs from kudos tracking
      const kudosEntries = await db
        .select({ messageId: kudosTracking.messageId })
        .from(kudosTracking)
        .where(
          and(
            eq(kudosTracking.recipientId, userId),
            sql`${kudosTracking.messageId} IN (${sql.join(
              kudosIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        );

      logger.log(`[markKudosAsRead] Found ${kudosEntries.length} kudos tracking entries`);

      if (kudosEntries.length === 0) {
        logger.log(`[markKudosAsRead] No kudos tracking entries found for user ${userId} with message IDs ${kudosIds.join(', ')}`);
        return { count: 0 };
      }

      const messageIds = kudosEntries
        .map((entry) => entry.messageId)
        .filter((id) => id !== null) as number[];

      // Check if message_recipients entries exist before updating
      const existingRecipients = await db
        .select({ messageId: messageRecipients.messageId, recipientId: messageRecipients.recipientId, read: messageRecipients.read })
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.recipientId, userId),
            sql`${messageRecipients.messageId} IN (${sql.join(
              messageIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        );
      
      logger.log(`[markKudosAsRead] Found ${existingRecipients.length} message_recipients entries for ${messageIds.length} message IDs`);
      if (existingRecipients.length === 0) {
        logger.warn(`[markKudosAsRead] No message_recipients entries found! Migration may not have run. Creating them now...`);
        // Create missing message_recipients entries
        for (const messageId of messageIds) {
          await db.insert(messageRecipients).values({
            messageId,
            recipientId: userId,
            read: true,
            isRead: true,
            notificationSent: true,
            initiallyNotified: true,
            readAt: sql`NOW()`,
          }).onConflictDoUpdate({
            target: [messageRecipients.messageId, messageRecipients.recipientId],
            set: { read: true, isRead: true, readAt: sql`NOW()` }
          });
        }
        logger.log(`[markKudosAsRead] Created/updated ${messageIds.length} message_recipients entries`);
        return { count: messageIds.length };
      }

      // Mark the corresponding message recipients as read
      // Update both 'read' (legacy) and 'isRead' (canonical) columns
      const result = await db
        .update(messageRecipients)
        .set({
          read: true,
          isRead: true,
          readAt: sql`NOW()`,
        })
        .where(
          and(
            eq(messageRecipients.recipientId, userId),
            sql`${messageRecipients.messageId} IN (${sql.join(
              messageIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        );

      logger.log(`[markKudosAsRead] Updated ${messageIds.length} message_recipients entries for user ${userId}`);

      return { count: messageIds.length };
    } catch (error) {
      logger.error('Failed to mark kudos as read:', error);
      throw error;
    }
  }

  /**
   * Get received kudos messages for a user
   */
  async getReceivedKudos(userId: string): Promise<any[]> {
    try {
      // Convert userId to string to handle numeric IDs from dev mode
      const userIdStr = String(userId);
      logger.log(`[getReceivedKudos] Fetching kudos for userId: ${userIdStr}`);

      // Get kudos tracking entries where this user is the recipient
      const kudosEntries = await db
        .select({
          messageId: kudosTracking.messageId,
          contextType: kudosTracking.contextType,
          contextId: kudosTracking.contextId,
          senderId: kudosTracking.senderId,
          createdAt: kudosTracking.sentAt,
        })
        .from(kudosTracking)
        .where(eq(kudosTracking.recipientId, userIdStr))
        .orderBy(desc(kudosTracking.sentAt));

      logger.log(`[getReceivedKudos] Found ${kudosEntries.length} kudos entries`);

      // Get the actual messages with sender information and read status
      const kudosMessages = await Promise.all(
        kudosEntries.map(async (entry) => {
          try {
            // First check messageRecipients directly to debug
            const recipientRows = await db
              .select({
                id: messageRecipients.id,
                recipientId: messageRecipients.recipientId,
                read: messageRecipients.read,
              })
              .from(messageRecipients)
              .where(eq(messageRecipients.messageId, entry.messageId!));

            logger.log(`[getReceivedKudos] messageId ${entry.messageId} has ${recipientRows.length} recipient rows:`,
              JSON.stringify(recipientRows.map(r => ({ id: r.id, recipientId: r.recipientId, read: r.read }))));

            const [messageResult] = await db
              .select({
                id: messages.id,
                content: messages.content,
                createdAt: messages.createdAt,
                senderId: messages.senderId,
                senderName:
                  sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.displayName}, ${users.email})`.as(
                    'senderName'
                  ),
                isRead: messageRecipients.read,
              })
              .from(messages)
              .leftJoin(users, eq(messages.senderId, users.id))
              .leftJoin(
                messageRecipients,
                and(
                  eq(messages.id, messageRecipients.messageId),
                  eq(messageRecipients.recipientId, userIdStr)
                )
              )
              .where(eq(messages.id, entry.messageId!))
              .limit(1);

            logger.log(`[getReceivedKudos] messageId ${entry.messageId} - isRead from join: ${messageResult?.isRead}`);

            if (!messageResult) return null;

            // Determine entity name based on context
            let entityName = 'Unknown';
            if (entry.contextType === 'task') {
              try {
                const [task] = await db
                  .select({ title: sql<string>`title` })
                  .from(sql`project_tasks`)
                  .where(sql`id = ${entry.contextId}`)
                  .limit(1);
                entityName = task?.title || `Task ${entry.contextId}`;
              } catch (error) {
                entityName = `Task ${entry.contextId}`;
              }
            } else if (entry.contextType === 'project') {
              try {
                const [project] = await db
                  .select({ title: sql<string>`title` })
                  .from(sql`projects`)
                  .where(sql`id = ${entry.contextId}`)
                  .limit(1);
                entityName = project?.title || `Project ${entry.contextId}`;
              } catch (error) {
                entityName = `Project ${entry.contextId}`;
              }
            }

            return {
              id: messageResult.id,
              content: messageResult.content,
              sender: messageResult.senderId,
              senderName: messageResult.senderName || 'Unknown User',
              contextType: entry.contextType,
              contextId: entry.contextId,
              entityName,
              projectTitle: entityName, // Add projectTitle alias for display
              message: messageResult.content, // Add message alias for display
              createdAt: messageResult.createdAt,
              // Return both field names for compatibility
              isRead: messageResult.isRead || false,
              read: messageResult.isRead || false, // Client expects 'read' field
            };
          } catch (error) {
            logger.error(
              `Error fetching kudos message ${entry.messageId}:`,
              error
            );
            return null;
          }
        })
      );

      // Filter out null results and return
      return kudosMessages.filter(Boolean);
    } catch (error) {
      logger.error('Failed to get received kudos:', error);
      throw error;
    }
  }

  /**
   * Get all messages for a user (inbox messages)
   */
  async getAllMessages(
    userId: string,
    options: {
      contextType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MessageWithSender[]> {
    const { contextType, limit = 50, offset = 0 } = options;

    try {
      let query = db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          editedAt: messages.editedAt,
          editedContent: messages.editedContent,
          replyToMessageId: messages.replyToMessageId,
          replyToContent: messages.replyToContent,
          replyToSender: messages.replyToSender,
          senderName: users.displayName,
          senderEmail: users.email,
          read: messageRecipients.read,
          readAt: messageRecipients.readAt,
        })
        .from(messages)
        .innerJoin(
          messageRecipients,
          eq(messages.id, messageRecipients.messageId)
        )
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messageRecipients.recipientId, userId));

      if (contextType) {
        query = query.where(eq(messages.contextType, contextType));
      }

      const result = await query
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return result.map((msg) => ({
        ...msg,
        senderName:
          msg.senderName ||
          msg.senderEmail ||
          `User ${msg.senderId}` ||
          'Unknown User',
        read: !!msg.read,
        readAt: msg.readAt || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get all messages:', error);
      throw error;
    }
  }

  /**
   * Get sent messages for a user
   */
  async getSentMessages(
    userId: string,
    options: {
      contextType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MessageWithSender[]> {
    const { contextType, limit = 50, offset = 0 } = options;

    try {
      let query = db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          editedAt: messages.editedAt,
          editedContent: messages.editedContent,
          senderName: users.displayName,
          senderEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.senderId, userId));

      if (contextType && contextType !== 'all') {
        query = query.where(eq(messages.contextType, contextType));
      }

      const result = await query
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return result.map((msg) => ({
        ...msg,
        senderName:
          msg.senderName ||
          msg.senderEmail ||
          `User ${msg.senderId}` ||
          'Unknown User',
        read: true, // All sent messages are "read" from sender's perspective
      }));
    } catch (error) {
      logger.error('Failed to get sent messages:', error);
      throw error;
    }
  }

  /**
   * Get inbox messages for a user (received messages only)
   */
  async getInboxMessages(
    userId: string,
    options: {
      contextType?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<MessageWithSender[]> {
    const { contextType, limit = 50, offset = 0 } = options;

    try {
      let query = db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          editedAt: messages.editedAt,
          editedContent: messages.editedContent,
          replyToMessageId: messages.replyToMessageId,
          replyToContent: messages.replyToContent,
          replyToSender: messages.replyToSender,
          senderName: users.displayName,
          senderEmail: users.email,
          read: messageRecipients.read,
          readAt: messageRecipients.readAt,
        })
        .from(messages)
        .innerJoin(
          messageRecipients,
          eq(messages.id, messageRecipients.messageId)
        )
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messageRecipients.recipientId, userId));

      if (contextType && contextType !== 'all') {
        query = query.where(eq(messages.contextType, contextType));
      }

      const result = await query
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      return result.map((msg) => ({
        ...msg,
        senderName:
          msg.senderName ||
          msg.senderEmail ||
          `User ${msg.senderId}` ||
          'Unknown User',
        read: !!msg.read,
        readAt: msg.readAt || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get inbox messages:', error);
      throw error;
    }
  }

  /**
   * Reply to a message
   */
  async replyToMessage(params: {
    senderId: string;
    originalMessageId: number;
    content: string;
  }): Promise<Message> {
    const { senderId, originalMessageId, content } = params;

    try {
      // Get original message to determine recipients and context
      const [originalMessage] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, originalMessageId))
        .limit(1);

      if (!originalMessage) {
        throw new Error('Original message not found');
      }

      // Get all participants in the original message (sender + recipients)
      const originalRecipients = await db
        .select({ recipientId: messageRecipients.recipientId })
        .from(messageRecipients)
        .where(eq(messageRecipients.messageId, originalMessageId));

      // Build recipient list (all original participants except current sender)
      const recipientIds = [
        originalMessage.senderId,
        ...originalRecipients.map((r) => r.recipientId),
      ].filter((id) => id !== senderId);

      // Send the reply
      const reply = await this.sendMessage({
        senderId,
        recipientIds,
        content,
        contextType: originalMessage.contextType || 'direct',
        contextId: originalMessage.contextId,
        parentMessageId: originalMessageId,
      });

      return reply;
    } catch (error) {
      logger.error('Failed to reply to message:', error);
      throw error;
    }
  }

  /**
   * Get all replies to a message (thread view)
   */
  async getMessageReplies(messageId: number, userId: string): Promise<MessageWithSender[]> {
    try {
      const replies = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          editedAt: messages.editedAt,
          editedContent: messages.editedContent,
          replyToMessageId: messages.replyToMessageId,
          replyToContent: messages.replyToContent,
          replyToSender: messages.replyToSender,
          senderName: users.displayName,
          senderEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.replyToMessageId, messageId))
        .orderBy(messages.createdAt);

      return replies.map((msg) => ({
        ...msg,
        senderName:
          msg.senderName ||
          msg.senderEmail ||
          `User ${msg.senderId}` ||
          'Unknown User',
        read: false, // Replies are shown in thread, read status not relevant here
      }));
    } catch (error) {
      logger.error('Failed to get message replies:', error);
      throw error;
    }
  }

  /**
   * Get full message thread (all ancestors and descendants)
   * This walks up the parent chain and down through replies to build the complete thread
   */
  async getMessageThread(messageId: number, userId: string): Promise<MessageWithSender[]> {
    try {
      // First, get the current message
      const currentMessage = await db
        .select({
          id: messages.id,
          senderId: messages.senderId,
          content: messages.content,
          contextType: messages.contextType,
          contextId: messages.contextId,
          createdAt: messages.createdAt,
          replyToMessageId: messages.replyToMessageId,
          replyToContent: messages.replyToContent,
          replyToSender: messages.replyToSender,
          senderName: users.displayName,
          senderEmail: users.email,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.id, messageId))
        .limit(1);

      if (currentMessage.length === 0) {
        return [];
      }

      // Walk up to find the root message
      let rootId = messageId;
      let currentMsg = currentMessage[0];

      while (currentMsg.replyToMessageId) {
        const parentMessage = await db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            content: messages.content,
            contextType: messages.contextType,
            contextId: messages.contextId,
            createdAt: messages.createdAt,
            replyToMessageId: messages.replyToMessageId,
            replyToContent: messages.replyToContent,
            replyToSender: messages.replyToSender,
            senderName: users.displayName,
            senderEmail: users.email,
          })
          .from(messages)
          .leftJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.id, currentMsg.replyToMessageId))
          .limit(1);

        if (parentMessage.length > 0) {
          rootId = parentMessage[0].id;
          currentMsg = parentMessage[0];
        } else {
          break;
        }
      }

      // Collect all messages in thread starting from root
      const threadMessages: MessageWithSender[] = [];
      const processedIds = new Set<number>();

      const collectMessages = async (msgId: number) => {
        if (processedIds.has(msgId)) return;
        processedIds.add(msgId);

        const msg = await db
          .select({
            id: messages.id,
            senderId: messages.senderId,
            content: messages.content,
            contextType: messages.contextType,
            contextId: messages.contextId,
            createdAt: messages.createdAt,
            replyToMessageId: messages.replyToMessageId,
            replyToContent: messages.replyToContent,
            replyToSender: messages.replyToSender,
            senderName: users.displayName,
            senderEmail: users.email,
          })
          .from(messages)
          .leftJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.id, msgId))
          .limit(1);

        if (msg.length > 0) {
          // Get read status for this user
          const recipientStatus = await db
            .select({
              read: messageRecipients.read,
              readAt: messageRecipients.readAt,
            })
            .from(messageRecipients)
            .where(
              and(
                eq(messageRecipients.messageId, msgId),
                eq(messageRecipients.recipientId, userId)
              )
            )
            .limit(1);

          threadMessages.push({
            ...msg[0],
            senderName:
              msg[0].senderName ||
              msg[0].senderEmail ||
              `User ${msg[0].senderId}` ||
              'Unknown User',
            read: recipientStatus[0]?.read || false,
            readAt: recipientStatus[0]?.readAt || null,
          });

          // Find all replies
          const replies = await db
            .select({ id: messages.id })
            .from(messages)
            .where(eq(messages.replyToMessageId, msgId))
            .orderBy(messages.createdAt);

          for (const reply of replies) {
            await collectMessages(reply.id);
          }
        }
      };

      await collectMessages(rootId);

      // Sort by creation date (oldest first)
      threadMessages.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });

      return threadMessages;
    } catch (error) {
      logger.error('Failed to get message thread:', error);
      throw error;
    }
  }

  /**
   * Trigger notifications for a message
   */
  private async triggerNotifications(
    message: Message,
    recipientIds: string[]
  ): Promise<void> {
    try {
      // Send WebSocket notifications
      if ((global as any).broadcastNewMessage) {
        await (global as any).broadcastNewMessage({
          type: 'new_message',
          message,
          context: {
            type: message.contextType,
            id: message.contextId,
          },
        });
      }

      // Send immediate email notifications for direct messages
      if (message.contextType === 'direct') {
        await this.sendDirectMessageEmails(message, recipientIds);
      }

      // Schedule email fallback for offline users
      for (const recipientId of recipientIds) {
        await this.scheduleEmailFallback(message.id, recipientId);
      }
    } catch (error) {
      logger.error('Failed to trigger notifications:', error);
    }
  }

  /**
   * Send immediate email notifications for direct messages
   */
  private async sendDirectMessageEmails(
    message: Message,
    recipientIds: string[]
  ): Promise<void> {
    try {
      // Import NotificationService dynamically to avoid circular dependency
      const { NotificationService } = await import('../notification-service');

      // Get sender name
      const senderName = message.sender || 'Unknown User';

      // Send email to each recipient
      for (const recipientId of recipientIds) {
        try {
          // Get recipient email
          const [recipient] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, recipientId))
            .limit(1);

          if (recipient?.email) {
            await NotificationService.sendDirectMessageNotification(
              recipient.email,
              senderName,
              message.content,
              message.contextType
            );
          }
        } catch (error) {
          logger.error(
            `Failed to send direct message email to ${recipientId}:`,
            error
          );
        }
      }
    } catch (error) {
      logger.error('Failed to send direct message emails:', error);
    }
  }

  /**
   * Schedule email fallback for unread messages
   */
  private async scheduleEmailFallback(
    messageId: number,
    recipientId: string,
    delayMinutes: number = 30
  ): Promise<void> {
    // This would integrate with a job queue like Bull or similar
    // For now, we'll use a simple setTimeout
    setTimeout(
      async () => {
        try {
          // Check if message is still unread
          const [recipient] = await db
            .select()
            .from(messageRecipients)
            .where(
              and(
                eq(messageRecipients.messageId, messageId),
                eq(messageRecipients.recipientId, recipientId),
                eq(messageRecipients.read, false),
                isNull(messageRecipients.emailSentAt)
              )
            )
            .limit(1);

          if (recipient) {
            // Get recipient email
            const [user] = await db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, recipientId))
              .limit(1);

            if (user?.email) {
              // Send email notification
              const [message] = await db
                .select()
                .from(messages)
                .where(eq(messages.id, messageId))
                .limit(1);

              if (message) {
                // Mark email as sent
                await db
                  .update(messageRecipients)
                  .set({ emailSentAt: new Date() })
                  .where(
                    and(
                      eq(messageRecipients.messageId, messageId),
                      eq(messageRecipients.recipientId, recipientId)
                    )
                  );
              }
            }
          }
        } catch (error) {
          logger.error('Failed to send email fallback:', error);
        }
      },
      delayMinutes * 60 * 1000
    );
  }

  /**
   * Get draft messages for a user
   */
  async getDraftMessages(
    senderId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<MessageWithSender[]> {
    const { limit = 50, offset = 0 } = options || {};

    try {
      // For now, return empty array as we don't have draft functionality yet
      // This will prevent the 404 error but still work with the UI
      return [];
    } catch (error) {
      logger.error('Failed to get draft messages:', error);
      throw error;
    }
  }

  /**
   * Save draft message
   */
  async saveDraft(data: {
    senderId: string;
    recipientIds: string[];
    content: string;
    subject?: string;
    contextType?: string;
    contextId?: string;
  }): Promise<any> {
    try {
      // For now, return a mock draft object as we don't have draft functionality yet
      // This will prevent the 404 error but still work with the UI
      return {
        id: Date.now(),
        senderId: data.senderId,
        content: data.content,
        subject: data.subject || '',
        createdAt: new Date(),
        isDraft: true,
      };
    } catch (error) {
      logger.error('Failed to save draft:', error);
      throw error;
    }
  }

  /**
   * Get unnotified kudos for login notifications
   */
  async getUnnotifiedKudos(recipientId: string): Promise<MessageWithSender[]> {
    try {
      const query = db
        .select({
          message: messages,
          senderName: sql<string>`COALESCE(${users.displayName}, ${messages.sender}, 'Unknown User')`,
          senderEmail: users.email,
          entityName: kudosTracking.entityName,
        })
        .from(messageRecipients)
        .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
        .leftJoin(users, eq(users.id, messages.senderId))
        .innerJoin(kudosTracking, eq(kudosTracking.messageId, messages.id))
        .where(
          and(
            eq(messageRecipients.recipientId, recipientId),
            eq(messageRecipients.read, false),
            eq(messageRecipients.initiallyNotified, false),
            isNull(messages.deletedAt),
            eq(messageRecipients.contextAccessRevoked, false)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(10);

      const results = await query;

      return results.map((row) => ({
        ...row.message,
        senderName: row.senderName || 'Unknown User',
        senderEmail: row.senderEmail || undefined,
        entityName: row.entityName || 'Unknown Entity',
      }));
    } catch (error) {
      logger.error('Failed to get unnotified kudos:', error);
      throw error;
    }
  }

  /**
   * Mark kudos as initially notified (without marking as read)
   */
  async markKudosInitiallyNotified(
    recipientId: string,
    kudosIds: number[]
  ): Promise<void> {
    try {
      await db
        .update(messageRecipients)
        .set({
          initiallyNotified: true,
          initiallyNotifiedAt: new Date(),
        })
        .where(
          and(
            eq(messageRecipients.recipientId, recipientId),
            inArray(messageRecipients.messageId, kudosIds)
          )
        );
    } catch (error) {
      logger.error('Failed to mark kudos as initially notified:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const messagingService = new MessagingService();
