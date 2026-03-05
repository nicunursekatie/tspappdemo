import { db } from '../../db';
import {
  meetingProjects,
  type MeetingProject,
  type InsertMeetingProject,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/production-safe-logger';

export interface MeetingProjectData {
  meetingId: number;
  projectId: number;
  discussionPoints?: string;
  questionsToAddress?: string;
  discussionSummary?: string;
  decisionsReached?: string;
  status?: 'planned' | 'discussed' | 'tabled' | 'deferred';
  includeInAgenda?: boolean;
  agendaOrder?: number;
  section?: 'urgent' | 'old_business' | 'new_business' | 'housekeeping';
  addedBy?: string;
}

export interface IMeetingProjectService {
  // Get projects in a meeting
  getMeetingProjects(meetingId: number): Promise<MeetingProject[]>;

  // Get meetings for a project
  getProjectMeetings(projectId: number): Promise<MeetingProject[]>;

  // Add project to meeting
  addProjectToMeeting(data: MeetingProjectData): Promise<MeetingProject>;

  // Remove project from meeting
  removeProjectFromMeeting(meetingId: number, projectId: number): Promise<boolean>;

  // Update meeting-project relationship
  updateMeetingProject(
    meetingId: number,
    projectId: number,
    updates: Partial<MeetingProjectData>
  ): Promise<MeetingProject | null>;

  // Get specific meeting-project relationship
  getMeetingProject(meetingId: number, projectId: number): Promise<MeetingProject | null>;

  // Update discussion points (pre-meeting)
  updateDiscussionPoints(
    meetingId: number,
    projectId: number,
    discussionPoints: string,
    questionsToAddress?: string
  ): Promise<MeetingProject | null>;

  // Update discussion summary (post-meeting)
  updateDiscussionSummary(
    meetingId: number,
    projectId: number,
    discussionSummary: string,
    decisionsReached?: string
  ): Promise<MeetingProject | null>;

  // Mark as discussed
  markAsDiscussed(meetingId: number, projectId: number): Promise<MeetingProject | null>;

  // Update status (planned, discussed, tabled, deferred)
  updateStatus(
    meetingId: number,
    projectId: number,
    status: 'planned' | 'discussed' | 'tabled' | 'deferred'
  ): Promise<MeetingProject | null>;

  // Update agenda order
  updateAgendaOrder(
    meetingId: number,
    projectId: number,
    agendaOrder: number
  ): Promise<MeetingProject | null>;

  // Batch update agenda order for multiple projects
  updateMultipleAgendaOrders(
    meetingId: number,
    orders: Array<{ projectId: number; agendaOrder: number }>
  ): Promise<MeetingProject[]>;
}

export class MeetingProjectService implements IMeetingProjectService {
  /**
   * Get all projects in a meeting
   */
  async getMeetingProjects(meetingId: number): Promise<MeetingProject[]> {
    try {
      const projects = await db
        .select()
        .from(meetingProjects)
        .where(eq(meetingProjects.meetingId, meetingId))
        .orderBy(meetingProjects.agendaOrder);

      return projects;
    } catch (error) {
      logger.error('Error fetching meeting projects:', error);
      throw new Error('Failed to fetch meeting projects');
    }
  }

  /**
   * Get all meetings for a project
   */
  async getProjectMeetings(projectId: number): Promise<MeetingProject[]> {
    try {
      const meetings = await db
        .select()
        .from(meetingProjects)
        .where(eq(meetingProjects.projectId, projectId))
        .orderBy(meetingProjects.addedAt);

      return meetings;
    } catch (error) {
      logger.error('Error fetching project meetings:', error);
      throw new Error('Failed to fetch project meetings');
    }
  }

  /**
   * Add a project to a meeting
   */
  async addProjectToMeeting(data: MeetingProjectData): Promise<MeetingProject> {
    try {
      const [meetingProject] = await db
        .insert(meetingProjects)
        .values({
          meetingId: data.meetingId,
          projectId: data.projectId,
          discussionPoints: data.discussionPoints,
          questionsToAddress: data.questionsToAddress,
          status: data.status || 'planned',
          includeInAgenda: data.includeInAgenda ?? true,
          agendaOrder: data.agendaOrder,
          section: data.section,
          addedBy: data.addedBy,
        })
        .returning();

      logger.info(`Added project ${data.projectId} to meeting ${data.meetingId}`);
      return meetingProject;
    } catch (error) {
      logger.error('Error adding project to meeting:', error);
      throw new Error('Failed to add project to meeting');
    }
  }

  /**
   * Remove a project from a meeting
   */
  async removeProjectFromMeeting(meetingId: number, projectId: number): Promise<boolean> {
    try {
      await db
        .delete(meetingProjects)
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        );

      logger.info(`Removed project ${projectId} from meeting ${meetingId}`);
      return true;
    } catch (error) {
      logger.error('Error removing project from meeting:', error);
      throw new Error('Failed to remove project from meeting');
    }
  }

  /**
   * Update meeting-project relationship
   */
  async updateMeetingProject(
    meetingId: number,
    projectId: number,
    updates: Partial<MeetingProjectData>
  ): Promise<MeetingProject | null> {
    try {
      const [updated] = await db
        .update(meetingProjects)
        .set(updates)
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Updated meeting-project relationship for meeting ${meetingId}, project ${projectId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating meeting-project relationship:', error);
      throw new Error('Failed to update meeting-project relationship');
    }
  }

  /**
   * Get specific meeting-project relationship
   */
  async getMeetingProject(meetingId: number, projectId: number): Promise<MeetingProject | null> {
    try {
      const [meetingProject] = await db
        .select()
        .from(meetingProjects)
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .limit(1);

      return meetingProject || null;
    } catch (error) {
      logger.error('Error fetching meeting-project relationship:', error);
      throw new Error('Failed to fetch meeting-project relationship');
    }
  }

  /**
   * Update discussion points (pre-meeting planning)
   */
  async updateDiscussionPoints(
    meetingId: number,
    projectId: number,
    discussionPoints: string,
    questionsToAddress?: string
  ): Promise<MeetingProject | null> {
    try {
      const [updated] = await db
        .update(meetingProjects)
        .set({
          discussionPoints,
          questionsToAddress,
        })
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Updated discussion points for project ${projectId} in meeting ${meetingId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating discussion points:', error);
      throw new Error('Failed to update discussion points');
    }
  }

  /**
   * Update discussion summary (post-meeting outcomes)
   */
  async updateDiscussionSummary(
    meetingId: number,
    projectId: number,
    discussionSummary: string,
    decisionsReached?: string
  ): Promise<MeetingProject | null> {
    try {
      const [updated] = await db
        .update(meetingProjects)
        .set({
          discussionSummary,
          decisionsReached,
          discussedAt: new Date(),
        })
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Updated discussion summary for project ${projectId} in meeting ${meetingId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating discussion summary:', error);
      throw new Error('Failed to update discussion summary');
    }
  }

  /**
   * Mark project as discussed in meeting
   */
  async markAsDiscussed(meetingId: number, projectId: number): Promise<MeetingProject | null> {
    try {
      const [updated] = await db
        .update(meetingProjects)
        .set({
          status: 'discussed',
          discussedAt: new Date(),
        })
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Marked project ${projectId} as discussed in meeting ${meetingId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error marking project as discussed:', error);
      throw new Error('Failed to mark project as discussed');
    }
  }

  /**
   * Update status (planned, discussed, tabled, deferred)
   */
  async updateStatus(
    meetingId: number,
    projectId: number,
    status: 'planned' | 'discussed' | 'tabled' | 'deferred'
  ): Promise<MeetingProject | null> {
    try {
      const updateData: any = { status };

      // If marking as discussed, set discussedAt timestamp
      if (status === 'discussed') {
        updateData.discussedAt = new Date();
      }

      const [updated] = await db
        .update(meetingProjects)
        .set(updateData)
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Updated status to ${status} for project ${projectId} in meeting ${meetingId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating status:', error);
      throw new Error('Failed to update status');
    }
  }

  /**
   * Update agenda order for a project
   */
  async updateAgendaOrder(
    meetingId: number,
    projectId: number,
    agendaOrder: number
  ): Promise<MeetingProject | null> {
    try {
      const [updated] = await db
        .update(meetingProjects)
        .set({ agendaOrder })
        .where(
          and(
            eq(meetingProjects.meetingId, meetingId),
            eq(meetingProjects.projectId, projectId)
          )
        )
        .returning();

      logger.info(`Updated agenda order to ${agendaOrder} for project ${projectId} in meeting ${meetingId}`);
      return updated || null;
    } catch (error) {
      logger.error('Error updating agenda order:', error);
      throw new Error('Failed to update agenda order');
    }
  }

  /**
   * Batch update agenda order for multiple projects
   */
  async updateMultipleAgendaOrders(
    meetingId: number,
    orders: Array<{ projectId: number; agendaOrder: number }>
  ): Promise<MeetingProject[]> {
    try {
      const results: MeetingProject[] = [];

      // Use a transaction to batch the updates
      await db.transaction(async (trx) => {
        for (const { projectId, agendaOrder } of orders) {
          const [updated] = await trx
            .update(meetingProjects)
            .set({ agendaOrder })
            .where(
              and(
                eq(meetingProjects.meetingId, meetingId),
                eq(meetingProjects.projectId, projectId)
              )
            )
            .returning();

          if (updated) {
            results.push(updated);
          }
        }
      });

      logger.info(`Updated agenda orders for ${results.length} projects in meeting ${meetingId}`);
      return results;
    } catch (error) {
      logger.error('Error updating multiple agenda orders:', error);
      throw new Error('Failed to update multiple agenda orders');
    }
  }
}
