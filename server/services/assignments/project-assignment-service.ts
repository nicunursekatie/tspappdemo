import { db } from '../../db';
import {
  projectAssignments,
  type ProjectAssignment,
  type InsertProjectAssignment,
  users,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface AssignmentUser {
  userId: string;
  userName: string;
  role: 'owner' | 'support';
}

export interface IProjectAssignmentService {
  // Get assignments for a project
  getProjectAssignments(projectId: number): Promise<ProjectAssignment[]>;

  // Get projects for a user
  getUserProjects(userId: string): Promise<ProjectAssignment[]>;

  // Add assignment
  addAssignment(
    projectId: number,
    userId: string,
    role: 'owner' | 'support',
    addedBy?: string
  ): Promise<ProjectAssignment>;

  // Add multiple assignments at once
  addMultipleAssignments(
    projectId: number,
    assignments: AssignmentUser[],
    addedBy?: string
  ): Promise<ProjectAssignment[]>;

  // Remove assignment
  removeAssignment(projectId: number, userId: string): Promise<boolean>;

  // Update assignment role
  updateAssignmentRole(
    projectId: number,
    userId: string,
    newRole: 'owner' | 'support'
  ): Promise<ProjectAssignment | null>;

  // Get owners for a project
  getProjectOwners(projectId: number): Promise<ProjectAssignment[]>;

  // Get support people for a project
  getProjectSupport(projectId: number): Promise<ProjectAssignment[]>;

  // Check if user is assigned to project
  isUserAssigned(projectId: number, userId: string): Promise<boolean>;

  // Replace all assignments for a project
  replaceProjectAssignments(
    projectId: number,
    assignments: AssignmentUser[],
    addedBy?: string
  ): Promise<ProjectAssignment[]>;
}

export class ProjectAssignmentService implements IProjectAssignmentService {
  /**
   * Get all assignments for a project
   */
  async getProjectAssignments(projectId: number): Promise<ProjectAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.projectId, projectId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching project assignments:', error);
      throw new Error('Failed to fetch project assignments');
    }
  }

  /**
   * Get all projects a user is assigned to
   */
  async getUserProjects(userId: string): Promise<ProjectAssignment[]> {
    try {
      const assignments = await db
        .select()
        .from(projectAssignments)
        .where(eq(projectAssignments.userId, userId));

      return assignments;
    } catch (error) {
      logger.error('Error fetching user projects:', error);
      throw new Error('Failed to fetch user projects');
    }
  }

  /**
   * Add a single assignment
   */
  async addAssignment(
    projectId: number,
    userId: string,
    role: 'owner' | 'support',
    addedBy?: string
  ): Promise<ProjectAssignment> {
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
        .insert(projectAssignments)
        .values({
          projectId,
          userId,
          userName,
          role,
          addedBy,
        })
        .returning();

      logger.info(`Added ${role} assignment for user ${userId} to project ${projectId}`);
      return assignment;
    } catch (error) {
      logger.error('Error adding project assignment:', error);
      throw new Error('Failed to add project assignment');
    }
  }

  /**
   * Add multiple assignments at once
   */
  async addMultipleAssignments(
    projectId: number,
    assignments: AssignmentUser[],
    addedBy?: string
  ): Promise<ProjectAssignment[]> {
    try {
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        projectId,
        userId: a.userId,
        userName: a.userName,
        role: a.role,
        addedBy,
      }));

      const results = await db
        .insert(projectAssignments)
        .values(values)
        .returning();

      logger.info(`Added ${results.length} assignments to project ${projectId}`);
      return results;
    } catch (error) {
      logger.error('Error adding multiple project assignments:', error);
      throw new Error('Failed to add project assignments');
    }
  }

  /**
   * Remove an assignment
   */
  async removeAssignment(projectId: number, userId: string): Promise<boolean> {
    try {
      const result = await db
        .delete(projectAssignments)
        .where(
          and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.userId, userId)
          )
        );

      logger.info(`Removed assignment for user ${userId} from project ${projectId}`);
      return true;
    } catch (error) {
      logger.error('Error removing project assignment:', error);
      throw new Error('Failed to remove project assignment');
    }
  }

  /**
   * Update assignment role (owner <-> support)
   */
  async updateAssignmentRole(
    projectId: number,
    userId: string,
    newRole: 'owner' | 'support'
  ): Promise<ProjectAssignment | null> {
    try {
      const [updated] = await db
        .update(projectAssignments)
        .set({ role: newRole })
        .where(
          and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.userId, userId)
          )
        )
        .returning();

      logger.info(`Updated assignment role for user ${userId} on project ${projectId} to ${newRole}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating assignment role:', error);
      throw new Error('Failed to update assignment role');
    }
  }

  /**
   * Get only owners for a project
   */
  async getProjectOwners(projectId: number): Promise<ProjectAssignment[]> {
    try {
      const owners = await db
        .select()
        .from(projectAssignments)
        .where(
          and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.role, 'owner')
          )
        );

      return owners;
    } catch (error) {
      logger.error('Error fetching project owners:', error);
      throw new Error('Failed to fetch project owners');
    }
  }

  /**
   * Get only support people for a project
   */
  async getProjectSupport(projectId: number): Promise<ProjectAssignment[]> {
    try {
      const support = await db
        .select()
        .from(projectAssignments)
        .where(
          and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.role, 'support')
          )
        );

      return support;
    } catch (error) {
      logger.error('Error fetching project support:', error);
      throw new Error('Failed to fetch project support');
    }
  }

  /**
   * Check if a user is assigned to a project (any role)
   */
  async isUserAssigned(projectId: number, userId: string): Promise<boolean> {
    try {
      const [assignment] = await db
        .select()
        .from(projectAssignments)
        .where(
          and(
            eq(projectAssignments.projectId, projectId),
            eq(projectAssignments.userId, userId)
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
   * Replace all assignments for a project (atomic operation)
   * Useful when updating project assignments from frontend
   */
  async replaceProjectAssignments(
    projectId: number,
    assignments: AssignmentUser[],
    addedBy?: string
  ): Promise<ProjectAssignment[]> {
    try {
      // Delete existing assignments
      await db
        .delete(projectAssignments)
        .where(eq(projectAssignments.projectId, projectId));

      // Add new assignments
      if (assignments.length === 0) {
        return [];
      }

      const values = assignments.map(a => ({
        projectId,
        userId: a.userId,
        userName: a.userName,
        role: a.role,
        addedBy,
      }));

      const results = await db
        .insert(projectAssignments)
        .values(values)
        .returning();

      logger.info(`Replaced all assignments for project ${projectId} with ${results.length} new assignments`);
      return results;
    } catch (error) {
      logger.error('Error replacing project assignments:', error);
      throw new Error('Failed to replace project assignments');
    }
  }
}
