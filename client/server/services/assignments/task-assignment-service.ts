import { db } from '../../db';
import {
  taskAssignments,
  type TaskAssignment,
  type InsertTaskAssignment,
  users,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface TaskAssignmentUser {
  userId: string;
  userName: string;
  role?: 'assignee' | 'reviewer';
}

export interface ITaskAssignmentService {
  // Get assignments for a task
  getTaskAssignments(taskId: number): Promise<TaskAssignment[]>;

  // Get tasks for a user
  getUserTasks(userId: string): Promise<TaskAssignment[]>;

  // Add assignment
  addAssignment(
    taskId: number,
    userId: string,
    role?: 'assignee' | 'reviewer',
    addedBy?: string
  ): Promise<TaskAssignment>;

  // Add multiple assignments at once
  addMultipleAssignments(
    taskId: number,
    assignments: TaskAssignmentUser[],
    addedBy?: string
  ): Promise<TaskAssignment[]>;

  // Remove assignment
  removeAssignment(taskId: number, userId: string): Promise<boolean>;

  // Update assignment role
  updateAssignmentRole(
    taskId: number,
    userId: string,
    newRole: 'assignee' | 'reviewer'
  ): Promise<TaskAssignment | null>;

  // Check if user is assigned to task
  isUserAssigned(taskId: number, userId: string): Promise<boolean>;

  // Replace all assignments for a task
  replaceTaskAssignments(
    taskId: number,
    assignments: TaskAssignmentUser[],
    addedBy?: string
  ): Promise<TaskAssignment[]>;
}

export class TaskAssignmentService implements ITaskAssignmentService {
  /**
   * Get all assignments for a task
   */
  async getTaskAssignments(taskId: number): Promise<TaskAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(taskAssignments)
        .where(eq(taskAssignments.taskId, taskId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching task assignments:', error);
      throw new Error('Failed to fetch task assignments');
    }
  }

  /**
   * Get all tasks a user is assigned to
   */
  async getUserTasks(userId: string): Promise<TaskAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(taskAssignments)
        .where(eq(taskAssignments.userId, userId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching user tasks:', error);
      throw new Error('Failed to fetch user tasks');
    }
  }

  /**
   * Add a single assignment
   */
  async addAssignment(
    taskId: number,
    userId: string,
    role: 'assignee' | 'reviewer' = 'assignee',
    addedBy?: string
  ): Promise<TaskAssignment> {
    try {
      // Look up user's display name
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const userName = user[0]?.displayName ||
                       (user[0]?.firstName && user[0]?.lastName
                         ? `${user[0].firstName} ${user[0].lastName}`
                         : user[0]?.email || 'Unknown User');

      const [assignment] = await db
        .insert(taskAssignments)
        .values({
          taskId,
          userId,
          userName,
          role,
          addedBy,
        })
        .returning();

      logger.info(`Added ${role} assignment for user ${userId} to task ${taskId}`);
      return assignment;
    } catch (error) {
      logger.error('Error adding task assignment:', error);
      throw new Error('Failed to add task assignment');
    }
  }

  /**
   * Add multiple assignments at once
   */
  async addMultipleAssignments(
    taskId: number,
    assignments: TaskAssignmentUser[],
    addedBy?: string
  ): Promise<TaskAssignment[]> {
    try {
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        taskId,
        userId: a.userId,
        userName: a.userName,
        role: a.role || ('assignee' as const),
        addedBy,
      }));

      const results = await db
        .insert(taskAssignments)
        .values(values)
        .returning();

      logger.info(`Added ${results.length} assignments to task ${taskId}`);
      return results;
    } catch (error) {
      logger.error('Error adding multiple task assignments:', error);
      throw new Error('Failed to add task assignments');
    }
  }

  /**
   * Remove an assignment
   */
  async removeAssignment(taskId: number, userId: string): Promise<boolean> {
    try {
      await db
        .delete(taskAssignments)
        .where(
          and(
            eq(taskAssignments.taskId, taskId),
            eq(taskAssignments.userId, userId)
          )
        );

      logger.info(`Removed assignment for user ${userId} from task ${taskId}`);
      return true;
    } catch (error) {
      logger.error('Error removing task assignment:', error);
      throw new Error('Failed to remove task assignment');
    }
  }

  /**
   * Update assignment role (assignee <-> reviewer)
   */
  async updateAssignmentRole(
    taskId: number,
    userId: string,
    newRole: 'assignee' | 'reviewer'
  ): Promise<TaskAssignment | null> {
    try {
      const [updated] = await db
        .update(taskAssignments)
        .set({ role: newRole })
        .where(
          and(
            eq(taskAssignments.taskId, taskId),
            eq(taskAssignments.userId, userId)
          )
        )
        .returning();

      logger.info(`Updated assignment role for user ${userId} on task ${taskId} to ${newRole}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating assignment role:', error);
      throw new Error('Failed to update assignment role');
    }
  }

  /**
   * Check if a user is assigned to a task (any role)
   */
  async isUserAssigned(taskId: number, userId: string): Promise<boolean> {
    try {
      const [assignment] = await db
        .select()
        .from(taskAssignments)
        .where(
          and(
            eq(taskAssignments.taskId, taskId),
            eq(taskAssignments.userId, userId)
          )
        )
        .limit(1);

      return !!assignment;
    } catch (error) {
      logger.error('Error checking user assignment:', error);
      return false;
    }
  }

  /**
   * Replace all assignments for a task (atomic operation)
   */
  async replaceTaskAssignments(
    taskId: number,
    assignments: TaskAssignmentUser[],
    addedBy?: string
  ): Promise<TaskAssignment[]> {
    try {
      // Delete existing assignments
      await db
        .delete(taskAssignments)
        .where(eq(taskAssignments.taskId, taskId));

      // Add new assignments
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        taskId,
        userId: a.userId,
        userName: a.userName,
        role: a.role || ('assignee' as const),
        addedBy,
      }));

      const results = await db
        .insert(taskAssignments)
        .values(values)
        .returning();

      logger.info(`Replaced all assignments for task ${taskId} with ${results.length} new assignments`);
      return results;
    } catch (error) {
      logger.error('Error replacing task assignments:', error);
      throw new Error('Failed to replace task assignments');
    }
  }
}
