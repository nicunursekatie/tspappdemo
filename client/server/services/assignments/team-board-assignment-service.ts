import { db } from '../../db';
import {
  teamBoardAssignments,
  type TeamBoardAssignment,
  type InsertTeamBoardAssignment,
  users,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface TeamBoardAssignmentUser {
  userId: string;
  userName: string;
}

export interface ITeamBoardAssignmentService {
  // Get assignments for a team board item
  getItemAssignments(itemId: number): Promise<TeamBoardAssignment[]>;

  // Get items for a user
  getUserItems(userId: string): Promise<TeamBoardAssignment[]>;

  // Add assignment
  addAssignment(itemId: number, userId: string): Promise<TeamBoardAssignment>;

  // Add multiple assignments at once
  addMultipleAssignments(
    itemId: number,
    assignments: TeamBoardAssignmentUser[]
  ): Promise<TeamBoardAssignment[]>;

  // Remove assignment
  removeAssignment(itemId: number, userId: string): Promise<boolean>;

  // Check if user is assigned to item
  isUserAssigned(itemId: number, userId: string): Promise<boolean>;

  // Replace all assignments for an item
  replaceItemAssignments(
    itemId: number,
    assignments: TeamBoardAssignmentUser[]
  ): Promise<TeamBoardAssignment[]>;
}

export class TeamBoardAssignmentService implements ITeamBoardAssignmentService {
  /**
   * Get all assignments for a team board item
   */
  async getItemAssignments(itemId: number): Promise<TeamBoardAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(teamBoardAssignments)
        .where(eq(teamBoardAssignments.itemId, itemId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching team board item assignments:', error);
      throw new Error('Failed to fetch team board item assignments');
    }
  }

  /**
   * Get all team board items a user is assigned to
   */
  async getUserItems(userId: string): Promise<TeamBoardAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(teamBoardAssignments)
        .where(eq(teamBoardAssignments.userId, userId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching user team board items:', error);
      throw new Error('Failed to fetch user team board items');
    }
  }

  /**
   * Add a single assignment
   */
  async addAssignment(
    itemId: number,
    userId: string
  ): Promise<TeamBoardAssignment> {
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
        .insert(teamBoardAssignments)
        .values({
          itemId,
          userId,
          userName,
        })
        .returning();

      logger.info(`Added assignment for user ${userId} to team board item ${itemId}`);
      return assignment;
    } catch (error) {
      logger.error('Error adding team board assignment:', error);
      throw new Error('Failed to add team board assignment');
    }
  }

  /**
   * Add multiple assignments at once
   */
  async addMultipleAssignments(
    itemId: number,
    assignments: TeamBoardAssignmentUser[]
  ): Promise<TeamBoardAssignment[]> {
    try {
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        itemId,
        userId: a.userId,
        userName: a.userName,
      }));

      const results = await db
        .insert(teamBoardAssignments)
        .values(values)
        .returning();

      logger.info(`Added ${results.length} assignments to team board item ${itemId}`);
      return results;
    } catch (error) {
      logger.error('Error adding multiple team board assignments:', error);
      throw new Error('Failed to add team board assignments');
    }
  }

  /**
   * Remove an assignment
   */
  async removeAssignment(itemId: number, userId: string): Promise<boolean> {
    try {
      await db
        .delete(teamBoardAssignments)
        .where(
          and(
            eq(teamBoardAssignments.itemId, itemId),
            eq(teamBoardAssignments.userId, userId)
          )
        );

      logger.info(`Removed assignment for user ${userId} from team board item ${itemId}`);
      return true;
    } catch (error) {
      logger.error('Error removing team board assignment:', error);
      throw new Error('Failed to remove team board assignment');
    }
  }

  /**
   * Check if a user is assigned to a team board item
   */
  async isUserAssigned(itemId: number, userId: string): Promise<boolean> {
    try {
      const [assignment] = await db
        .select()
        .from(teamBoardAssignments)
        .where(
          and(
            eq(teamBoardAssignments.itemId, itemId),
            eq(teamBoardAssignments.userId, userId)
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
   * Replace all assignments for a team board item (atomic operation)
   */
  async replaceItemAssignments(
    itemId: number,
    assignments: TeamBoardAssignmentUser[]
  ): Promise<TeamBoardAssignment[]> {
    try {
      // Delete existing assignments
      await db
        .delete(teamBoardAssignments)
        .where(eq(teamBoardAssignments.itemId, itemId));

      // Add new assignments
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        itemId,
        userId: a.userId,
        userName: a.userName,
      }));

      const results = await db
        .insert(teamBoardAssignments)
        .values(values)
        .returning();

      logger.info(`Replaced all assignments for team board item ${itemId} with ${results.length} new assignments`);
      return results;
    } catch (error) {
      logger.error('Error replacing team board assignments:', error);
      throw new Error('Failed to replace team board assignments');
    }
  }
}
