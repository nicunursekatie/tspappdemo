import { and, eq, sql, desc, inArray, isNull, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  activities,
  activityParticipants,
  activityReactions,
  activityAttachments,
  users,
  type Activity,
  type ActivityParticipant,
  type ActivityReaction,
  type ActivityAttachment,
  type InsertActivity,
  type InsertActivityParticipant,
  type InsertActivityReaction,
  type InsertActivityAttachment,
} from '@shared/schema';
import { logger } from '../../utils/production-safe-logger';

export interface ActivityWithDetails extends Activity {
  creatorName?: string;
  creatorEmail?: string;
  participants?: ActivityParticipant[];
  reactions?: ActivityReaction[];
  attachments?: ActivityAttachment[];
  replyCount?: number;
  unreadCount?: number;
}

export interface CreateActivityParams {
  id?: string; // Optional UUID from client
  type: string;
  title: string;
  content?: string;
  createdBy: string;
  assignedTo?: string[];
  status?: string;
  priority?: string;
  parentId?: string; // For replies/threading
  rootId?: string; // Root of thread
  contextType?: string;
  contextId?: string;
  metadata?: Record<string, any>;
  skipNotifications?: boolean; // For historical data migration
}

export interface UpdateActivityParams {
  title?: string;
  content?: string;
  assignedTo?: string[];
  status?: string;
  priority?: string;
  metadata?: Record<string, any>;
}

export interface GetActivitiesFilters {
  type?: string[];
  contextType?: string;
  contextId?: string;
  userId?: string; // Filter by creator or assignee
  status?: string[];
  includeDeleted?: boolean;
  parentId?: string | null; // null = root activities only
  rootId?: string; // Get all activities in a thread (including nested)
  limit?: number;
  offset?: number;
}

export interface ActivityThread {
  root: ActivityWithDetails;
  replies: ActivityWithDetails[];
  totalReplies: number;
}

export class ActivityService {
  /**
   * Create a new activity (task, event, message, etc.)
   */
  async createActivity(params: CreateActivityParams): Promise<Activity> {
    const {
      id,
      type,
      title,
      content,
      createdBy,
      assignedTo = [],
      status,
      priority,
      parentId,
      rootId,
      contextType,
      contextId,
      metadata = {},
      skipNotifications = false,
    } = params;

    try {
      // Generate ID if not provided
      const activityId = id || this.generateId();

      // If this is a reply, determine the rootId
      let finalRootId = rootId;
      if (parentId && !rootId) {
        // Get parent's rootId, or use parent as root if it has no root
        const parent = await db
          .select({ rootId: activities.rootId, id: activities.id })
          .from(activities)
          .where(eq(activities.id, parentId))
          .limit(1);

        if (parent.length > 0) {
          finalRootId = parent[0].rootId || parent[0].id;
        }
      }

      // Create the activity
      const [activity] = await db
        .insert(activities)
        .values({
          id: activityId,
          type,
          title,
          content,
          createdBy,
          assignedTo: assignedTo as any,
          status,
          priority,
          parentId,
          rootId: finalRootId,
          contextType,
          contextId,
          metadata: metadata as any,
        })
        .returning();

      // If this is a reply, update parent's thread count and last activity
      if (parentId) {
        await this.updateThreadMetrics(finalRootId || parentId);
      }

      // Add creator as participant
      await this.addParticipant(activityId, createdBy, 'creator');

      // Add assignees as participants
      for (const userId of assignedTo) {
        if (userId !== createdBy) {
          await this.addParticipant(activityId, userId, 'assignee');
        }
      }

      logger.log(`Activity created: ${activityId} (type: ${type})`);
      return activity;
    } catch (error) {
      logger.error('Error creating activity:', error);
      throw error;
    }
  }

  /**
   * Get activities with filters
   */
  async getActivities(
    filters: GetActivitiesFilters
  ): Promise<ActivityWithDetails[]> {
    try {
      const {
        type,
        contextType,
        contextId,
        userId,
        status,
        includeDeleted = false,
        parentId,
        rootId,
        limit = 50,
        offset = 0,
      } = filters;

      // Build where conditions
      const conditions: any[] = [];

      if (type && type.length > 0) {
        conditions.push(inArray(activities.type, type));
      }

      if (contextType) {
        conditions.push(eq(activities.contextType, contextType));
      }

      if (contextId) {
        conditions.push(eq(activities.contextId, contextId));
      }

      if (userId) {
        // User is either creator or assignee
        conditions.push(
          or(
            eq(activities.createdBy, userId),
            sql`${activities.assignedTo}::jsonb @> ${JSON.stringify([userId])}::jsonb`
          )
        );
      }

      if (status && status.length > 0) {
        conditions.push(inArray(activities.status, status as any));
      }

      if (!includeDeleted) {
        conditions.push(eq(activities.isDeleted, false));
      }

      if (parentId !== undefined) {
        if (parentId === null) {
          // Get root activities only
          conditions.push(isNull(activities.parentId));
        } else {
          // Get replies to specific activity
          conditions.push(eq(activities.parentId, parentId));
        }
      }

      if (rootId) {
        // Get all activities in a thread (including nested replies)
        conditions.push(eq(activities.rootId, rootId));
      }

      // Query activities
      const results = await db
        .select({
          activity: activities,
          creatorName: users.displayName,
          creatorEmail: users.email,
        })
        .from(activities)
        .leftJoin(users, eq(activities.createdBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(activities.lastActivityAt))
        .limit(limit)
        .offset(offset);

      // Transform results
      return results.map((r) => ({
        ...r.activity,
        creatorName: r.creatorName || undefined,
        creatorEmail: r.creatorEmail || undefined,
      }));
    } catch (error) {
      logger.error('Error getting activities:', error);
      throw error;
    }
  }

  /**
   * Get a single activity by ID with full details
   */
  async getActivityById(
    activityId: string,
    userId?: string
  ): Promise<ActivityWithDetails | null> {
    try {
      const result = await db
        .select({
          activity: activities,
          creatorName: users.displayName,
          creatorEmail: users.email,
        })
        .from(activities)
        .leftJoin(users, eq(activities.createdBy, users.id))
        .where(eq(activities.id, activityId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const activity = {
        ...result[0].activity,
        creatorName: result[0].creatorName || undefined,
        creatorEmail: result[0].creatorEmail || undefined,
      };

      // Get participants
      activity.participants = await this.getParticipants(activityId);

      // Get reactions
      activity.reactions = await this.getReactions(activityId);

      // Get attachments
      activity.attachments = await this.getAttachments(activityId);

      // Mark as read for this user
      if (userId) {
        await this.markAsRead(activityId, userId);
      }

      return activity;
    } catch (error) {
      logger.error('Error getting activity by ID:', error);
      throw error;
    }
  }

  /**
   * Get full activity thread (root + all replies)
   */
  async getActivityThread(rootId: string, userId?: string): Promise<ActivityThread> {
    try {
      // Get root activity
      const root = await this.getActivityById(rootId, userId);

      if (!root) {
        throw new Error('Activity not found');
      }

      // Get all replies (including nested) by querying rootId
      const allActivities = await this.getActivities({
        rootId: rootId,
        includeDeleted: false,
        limit: 1000, // High limit for threads
      });

      // Filter out the root activity itself from replies
      const replies = allActivities.filter(activity => activity.id !== rootId);

      // Mark all as read for this user
      if (userId) {
        for (const reply of replies) {
          await this.markAsRead(reply.id, userId);
        }
      }

      return {
        root,
        replies,
        totalReplies: replies.length,
      };
    } catch (error) {
      logger.error('Error getting activity thread:', error);
      throw error;
    }
  }

  /**
   * Update an activity
   */
  async updateActivity(
    activityId: string,
    updates: UpdateActivityParams
  ): Promise<Activity> {
    try {
      // Filter out undefined values
      const updateData: any = {
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

      const [activity] = await db
        .update(activities)
        .set(updateData)
        .where(eq(activities.id, activityId))
        .returning();

      logger.log(`Activity updated: ${activityId}`);
      return activity;
    } catch (error) {
      logger.error('Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Soft delete an activity
   */
  async deleteActivity(activityId: string): Promise<void> {
    try {
      await db
        .update(activities)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(activities.id, activityId));

      logger.log(`Activity soft deleted: ${activityId}`);
    } catch (error) {
      logger.error('Error deleting activity:', error);
      throw error;
    }
  }

  /**
   * Add a participant to an activity
   */
  async addParticipant(
    activityId: string,
    userId: string,
    role: string
  ): Promise<void> {
    try {
      // Check if participant already exists with this role
      const existing = await db
        .select()
        .from(activityParticipants)
        .where(
          and(
            eq(activityParticipants.activityId, activityId),
            eq(activityParticipants.userId, userId),
            eq(activityParticipants.role, role)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(activityParticipants).values({
          activityId,
          userId,
          role,
        });
      }
    } catch (error) {
      logger.error('Error adding participant:', error);
      throw error;
    }
  }

  /**
   * Get participants for an activity
   */
  async getParticipants(activityId: string): Promise<ActivityParticipant[]> {
    try {
      return await db
        .select()
        .from(activityParticipants)
        .where(eq(activityParticipants.activityId, activityId));
    } catch (error) {
      logger.error('Error getting participants:', error);
      throw error;
    }
  }

  /**
   * Mark activity as read for a user
   */
  async markAsRead(activityId: string, userId: string): Promise<void> {
    try {
      await db
        .update(activityParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(activityParticipants.activityId, activityId),
            eq(activityParticipants.userId, userId)
          )
        );
    } catch (error) {
      logger.error('Error marking as read:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Add a reaction to an activity
   */
  async addReaction(
    activityId: string,
    userId: string,
    reactionType: string
  ): Promise<void> {
    try {
      // Check if reaction already exists
      const existing = await db
        .select()
        .from(activityReactions)
        .where(
          and(
            eq(activityReactions.activityId, activityId),
            eq(activityReactions.userId, userId),
            eq(activityReactions.reactionType, reactionType)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(activityReactions).values({
          activityId,
          userId,
          reactionType,
        });
      }
    } catch (error) {
      logger.error('Error adding reaction:', error);
      throw error;
    }
  }

  /**
   * Remove a reaction from an activity
   */
  async removeReaction(
    activityId: string,
    userId: string,
    reactionType: string
  ): Promise<void> {
    try {
      await db
        .delete(activityReactions)
        .where(
          and(
            eq(activityReactions.activityId, activityId),
            eq(activityReactions.userId, userId),
            eq(activityReactions.reactionType, reactionType)
          )
        );
    } catch (error) {
      logger.error('Error removing reaction:', error);
      throw error;
    }
  }

  /**
   * Get reactions for an activity
   */
  async getReactions(activityId: string): Promise<ActivityReaction[]> {
    try {
      return await db
        .select()
        .from(activityReactions)
        .where(eq(activityReactions.activityId, activityId));
    } catch (error) {
      logger.error('Error getting reactions:', error);
      throw error;
    }
  }

  /**
   * Get attachments for an activity
   */
  async getAttachments(activityId: string): Promise<ActivityAttachment[]> {
    try {
      return await db
        .select()
        .from(activityAttachments)
        .where(eq(activityAttachments.activityId, activityId));
    } catch (error) {
      logger.error('Error getting attachments:', error);
      throw error;
    }
  }

  /**
   * Add an attachment to an activity
   */
  async addAttachment(params: {
    activityId: string;
    fileUrl: string;
    fileType?: string;
    fileName: string;
    fileSize?: number;
    uploadedBy: string;
  }): Promise<ActivityAttachment> {
    try {
      const [attachment] = await db
        .insert(activityAttachments)
        .values(params)
        .returning();

      return attachment;
    } catch (error) {
      logger.error('Error adding attachment:', error);
      throw error;
    }
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(activityParticipants)
        .innerJoin(
          activities,
          eq(activityParticipants.activityId, activities.id)
        )
        .where(
          and(
            eq(activityParticipants.userId, userId),
            or(
              isNull(activityParticipants.lastReadAt),
              sql`${activityParticipants.lastReadAt} < ${activities.lastActivityAt}`
            ),
            eq(activities.isDeleted, false)
          )
        );

      return result[0]?.count || 0;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Update thread metrics (thread count and last activity time)
   * Called when a reply is added
   */
  private async updateThreadMetrics(rootId: string): Promise<void> {
    try {
      // Count ALL replies in thread (including nested replies)
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(activities)
        .where(
          and(
            eq(activities.rootId, rootId),
            eq(activities.isDeleted, false)
          )
        );

      const threadCount = result[0]?.count || 0;

      // Update root activity
      await db
        .update(activities)
        .set({
          threadCount,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(activities.id, rootId));
    } catch (error) {
      logger.error('Error updating thread metrics:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Generate a UUID for activity ID
   */
  private generateId(): string {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

export const activityService = new ActivityService();
