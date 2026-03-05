import type { IStorage } from '../../storage';
import {
  insertProjectSchema,
  insertProjectTaskSchema,
  insertTaskCompletionSchema,
  type projects,
  type archivedProjects,
  type projectTasks,
  type taskCompletions,
  users,
} from '@shared/schema';
import { isProjectOwnerOrAssignee } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import type { z } from 'zod';
import { logger } from '../../utils/production-safe-logger';
import { NotificationService } from '../../notification-service';
import { db } from '../../db';
import { inArray } from 'drizzle-orm';
// REFACTOR: Import new assignment service for dual-write
import { projectAssignmentService } from '../assignments';

// Types
export type Project = typeof projects.$inferSelect;
export type ArchivedProject = typeof archivedProjects.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type TaskCompletion = typeof taskCompletions.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;
export type InsertTaskCompletion = z.infer<typeof insertTaskCompletionSchema>;

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
}

export interface ProjectPermissionContext {
  user: User;
  project?: Project;
  isAgendaUpdate?: boolean;
}

export interface ProjectCreationData {
  data: any;
  user: User;
}

export interface ProjectUpdateData {
  id: number;
  updates: any;
  user: User;
}

export interface TaskCompletionData {
  taskId: number;
  user: User;
  notes?: string;
}

export interface IProjectService {
  // Project CRUD operations
  getAllProjects(): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | null>;
  getArchivedProjects(): Promise<ArchivedProject[]>;
  createProject(data: ProjectCreationData): Promise<Project>;
  updateProject(data: ProjectUpdateData): Promise<Project | null>;
  deleteProject(id: number, user: User): Promise<boolean>;
  claimProject(id: number, assigneeName?: string): Promise<Project | null>;
  archiveProject(id: number, user: User): Promise<boolean>;

  // Task management
  getProjectTasks(projectId: number): Promise<ProjectTask[]>;
  createProjectTask(
    projectId: number,
    taskData: any,
    user: User
  ): Promise<ProjectTask>;
  completeTask(data: TaskCompletionData): Promise<{
    completion: TaskCompletion;
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }>;
  uncompleteTask(
    taskId: number,
    user: User
  ): Promise<{
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }>;
  getTaskCompletions(taskId: number): Promise<TaskCompletion[]>;

  // Permission validation
  validateProjectPermissions(
    context: ProjectPermissionContext
  ): Promise<boolean>;
  validateCreatePermissions(user: User): boolean;
  validateDeletePermissions(user: User, project: Project): boolean;
  validateArchivePermissions(user: User): boolean;

  // Data sanitization and validation
  sanitizeProjectData(data: any): any;
  sanitizeProjectUpdates(updates: any): any;
}

export class ProjectService implements IProjectService {
  constructor(private storage: IStorage) {}

  async getAllProjects(): Promise<Project[]> {
    return this.storage.getAllProjects();
  }

  async getProjectById(id: number): Promise<Project | null> {
    const project = await this.storage.getProject(id);
    return project || null;
  }

  async getArchivedProjects(): Promise<ArchivedProject[]> {
    return this.storage.getArchivedProjects();
  }

  async createProject({ data, user }: ProjectCreationData): Promise<Project> {
    // Validate permissions
    if (!this.validateCreatePermissions(user)) {
      throw new Error('Permission denied. You cannot create projects.');
    }

    // Sanitize and validate data
    const sanitizedData = this.sanitizeProjectData(data);

    const projectData = insertProjectSchema.parse({
      ...sanitizedData,
      createdBy: user.id,
      createdByName: user.firstName
        ? `${user.firstName} ${user.lastName || ''}`.trim()
        : user.email,
    });

    const createdProject = await this.storage.createProject(projectData);

    // REFACTOR: Dual-write to project_assignments table
    try {
      await this.syncProjectAssignments(createdProject, user.id);
    } catch (error) {
      logger.error('Failed to sync project assignments on create', error);
      // Don't fail the whole operation if assignment sync fails
    }

    return createdProject;
  }

  async updateProject({
    id,
    updates,
    user,
  }: ProjectUpdateData): Promise<Project | null> {
    logger.info(`[ProjectService.updateProject] Attempting to update project ${id}`);

    // Get existing project for permission checks
    const existingProject = await this.storage.getProject(id);
    if (!existingProject) {
      logger.error(`[ProjectService.updateProject] Project ${id} not found in storage`);
      return null;
    }

    logger.info(`[ProjectService.updateProject] Found project ${id}:`, {
      title: existingProject.title,
      currentOwner: existingProject.assigneeName,
    });

    // Check if this is an agenda update (special permissions)
    const isAgendaUpdate =
      updates.reviewInNextMeeting !== undefined &&
      Object.keys(updates).length === 1;

    // Validate permissions
    const permissionContext = {
      user,
      project: existingProject,
      isAgendaUpdate,
    };
    const hasValidPermission =
      await this.validateProjectPermissions(permissionContext);
    if (!hasValidPermission) {
      const message = isAgendaUpdate
        ? 'Permission denied. You need meeting management permissions to send projects to agenda.'
        : 'Permission denied. You can only edit your own projects or need admin privileges.';
      throw new Error(message);
    }

    // Sanitize updates
    const validUpdates = this.sanitizeProjectUpdates(updates);

    const updatedProject = await this.storage.updateProject(id, validUpdates);

    // Check if assignment changed and send email notifications
    if (updates.assigneeIds && updatedProject) {
      const oldAssigneeIds = existingProject.assigneeIds || [];
      const newAssigneeIds = updates.assigneeIds;

      // Find newly assigned users (those not previously assigned)
      const newlyAssignedUserIds = newAssigneeIds.filter(
        (userId: string) => !oldAssigneeIds.includes(userId)
      );

      // Send email notifications to newly assigned users
      if (newlyAssignedUserIds.length > 0) {
        try {
          // Fetch email addresses for newly assigned users
          const assignedUsers = await db
            .select({ email: users.email, preferredEmail: users.preferredEmail })
            .from(users)
            .where(inArray(users.id, newlyAssignedUserIds));

          const assigneeEmails = assignedUsers
            .map((u) => u.preferredEmail || u.email)
            .filter((email): email is string => email !== null);

          if (assigneeEmails.length > 0) {
            const assignerName =
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email;

            // Send notifications asynchronously (don't block the response)
            NotificationService.sendProjectAssignmentNotification(
              String(id),
              updatedProject.title,
              assigneeEmails,
              assignerName
            ).catch((error) => {
              logger.error('Failed to send project assignment notification', error);
            });

            logger.info('Project assignment notifications queued', {
              projectId: id,
              newlyAssignedCount: newlyAssignedUserIds.length,
            });
          }
        } catch (error) {
          logger.error('Failed to send project assignment notifications', error);
          // Don't fail the update if notification fails
        }
      }
    }

    // Handle Google Sheets sync for support people updates
    if (updates.supportPeople !== undefined && updatedProject) {
      this.triggerGoogleSheetsSync();
    }

    // REFACTOR: Dual-write to project_assignments table
    if (updatedProject) {
      try {
        await this.syncProjectAssignments(updatedProject, user.id);
      } catch (error) {
        logger.error('Failed to sync project assignments on update', error);
        // Don't fail the whole operation if assignment sync fails
      }
    }

    return updatedProject || null;
  }

  async deleteProject(id: number, user: User): Promise<boolean> {
    // Get project for ownership check
    const existingProject = await this.storage.getProject(id);
    if (!existingProject) {
      return false;
    }

    // Validate permissions
    if (!this.validateDeletePermissions(user, existingProject)) {
      throw new Error(
        'Permission denied. You can only delete your own projects or need admin privileges.'
      );
    }

    return this.storage.deleteProject(id);
  }

  async claimProject(
    id: number,
    assigneeName?: string
  ): Promise<Project | null> {
    const updatedProject = await this.storage.updateProject(id, {
      status: 'in_progress',
      assigneeName: assigneeName || 'You',
    });

    return updatedProject || null;
  }

  async archiveProject(id: number, user: User): Promise<boolean> {
    // Validate permissions
    if (!this.validateArchivePermissions(user)) {
      throw new Error(
        'Permission denied. Admin privileges required to archive projects.'
      );
    }

    // Check if project exists
    const project = await this.storage.getProject(id);
    if (!project) {
      throw new Error('Project not found');
    }

    // If project is not completed, mark it as completed first
    if (project.status !== 'completed') {
      await this.storage.updateProject(id, { 
        status: 'completed',
        completionDate: new Date().toISOString()
      });
    }

    const userFullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return this.storage.archiveProject(id, user.id, userFullName);
  }

  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return this.storage.getProjectTasks(projectId);
  }

  async createProjectTask(
    projectId: number,
    taskData: any,
    user: User
  ): Promise<ProjectTask> {
    // Check permissions for task creation - use project editing permissions
    if (
      !user.permissions?.includes('PROJECTS_EDIT_ALL') &&
      !user.permissions?.includes('PROJECTS_EDIT_OWN') &&
      !user.permissions?.includes('PROJECTS_ADD') &&
      !user.permissions?.includes('edit_all_projects') &&
      !user.permissions?.includes('manage_projects') &&
      user.role !== 'admin' &&
      user.role !== 'super_admin'
    ) {
      throw new Error('Permission denied. You cannot create tasks.');
    }

    const sanitizedTaskData = insertProjectTaskSchema.parse({
      ...taskData,
      projectId,
      createdBy: user.id,
    });

    return this.storage.createProjectTask(sanitizedTaskData);
  }

  async completeTask({ taskId, user, notes }: TaskCompletionData): Promise<{
    completion: TaskCompletion;
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }> {
    // Check if user is assigned to this task
    const task = await this.storage.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const assigneeIds = task.assigneeIds || [];
    if (!assigneeIds.includes(user.id)) {
      throw new Error('You are not assigned to this task');
    }

    // Create completion record
    const completionData = insertTaskCompletionSchema.parse({
      taskId: taskId,
      userId: user.id,
      userName:
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email,
      notes: notes,
    });

    const completion = await this.storage.createTaskCompletion(completionData);

    // Check completion status
    const allCompletions = await this.storage.getTaskCompletions(taskId);
    const isFullyCompleted = allCompletions.length >= assigneeIds.length;

    // If all users completed, update task status
    if (isFullyCompleted && task.status !== 'completed') {
      await this.storage.updateTaskStatus(taskId, 'completed');
    }

    return {
      completion,
      isFullyCompleted,
      totalCompletions: allCompletions.length,
      totalAssignees: assigneeIds.length,
    };
  }

  async uncompleteTask(
    taskId: number,
    user: User
  ): Promise<{
    isFullyCompleted: boolean;
    totalCompletions: number;
    totalAssignees: number;
  }> {
    // Get task info for assignee validation
    const task = await this.storage.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const assigneeIds = task.assigneeIds || [];
    if (!assigneeIds.includes(user.id)) {
      throw new Error('You are not assigned to this task');
    }

    // Remove completion
    const removed = await this.storage.removeTaskCompletion(taskId, user.id);
    if (!removed) {
      throw new Error('No completion found to remove');
    }

    // Check completion status after removal
    const allCompletions = await this.storage.getTaskCompletions(taskId);
    const isFullyCompleted = allCompletions.length >= assigneeIds.length;

    // If no longer fully completed, update task status
    if (!isFullyCompleted && task.status === 'completed') {
      await this.storage.updateTaskStatus(taskId, 'in_progress');
    }

    return {
      isFullyCompleted,
      totalCompletions: allCompletions.length,
      totalAssignees: assigneeIds.length,
    };
  }

  async getTaskCompletions(taskId: number): Promise<TaskCompletion[]> {
    return this.storage.getTaskCompletions(taskId);
  }

  async validateProjectPermissions({
    user,
    project,
    isAgendaUpdate,
  }: ProjectPermissionContext): Promise<boolean> {
    // Check for admin roles first (most efficient)
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }

    if (isAgendaUpdate) {
      // For agenda updates, only need MEETINGS_MANAGE permission
      return hasPermission(user, 'MEETINGS_MANAGE');
    }

    // For regular project updates
    const canEditAll =
      hasPermission(user, 'PROJECTS_EDIT_ALL') ||
      hasPermission(user, 'MANAGE_ALL_PROJECTS');

    if (canEditAll) {
      return true;
    }

    const hasOwnLevelPermission =
      hasPermission(user, 'PROJECTS_EDIT_OWN') ||
      hasPermission(user, 'PROJECTS_ADD');
    const isOwnerOrAssignee = project
      ? isProjectOwnerOrAssignee(user, project)
      : false;

    return hasOwnLevelPermission && isOwnerOrAssignee;
  }

  validateCreatePermissions(user: User): boolean {
    return (
      user.permissions?.includes('PROJECTS_ADD') ||
      user.permissions?.includes('PROJECTS_EDIT_ALL') ||
      user.permissions?.includes('ADMIN_ACCESS') ||
      // Legacy permission names for backward compatibility
      user.permissions?.includes('create_projects') ||
      user.permissions?.includes('edit_all_projects') ||
      user.permissions?.includes('manage_projects') ||
      false
    );
  }

  validateDeletePermissions(user: User, project: Project): boolean {
    const canDeleteAll =
      user.permissions?.includes('PROJECTS_DELETE_ALL') ||
      user.role === 'admin' ||
      user.role === 'super_admin';

    const canDeleteOwn = Boolean(
      user.permissions?.includes('PROJECTS_DELETE_OWN') &&
        project.createdBy === user.id
    );

    return canDeleteAll || canDeleteOwn;
  }

  validateArchivePermissions(user: User): boolean {
    return (
      user.permissions?.includes('manage_projects') ||
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      false
    );
  }

  sanitizeProjectData(data: any): any {
    const sanitized = { ...data };

    // Convert empty strings to null for numeric fields
    if (sanitized.estimatedHours === '') sanitized.estimatedHours = null;
    if (sanitized.actualHours === '') sanitized.actualHours = null;
    if (sanitized.dueDate === '') sanitized.dueDate = null;
    if (sanitized.startDate === '') sanitized.startDate = null;
    if (sanitized.budget === '') sanitized.budget = null;

    return sanitized;
  }

  sanitizeProjectUpdates(updates: any): any {
    logger.info('[sanitizeProjectUpdates] Input updates:', updates);

    // Filter out fields that shouldn't be updated directly
    const {
      id,
      createdAt,
      updatedAt,
      created_at,
      updated_at,
      createdBy,
      created_by,
      createdByName,
      created_by_name,
      ...validUpdates
    } = updates;

    logger.info('[sanitizeProjectUpdates] After filtering system fields:', validUpdates);

    // Convert date strings to Date objects for timestamp fields
    // These fields are timestamp type in the database
    const timestampFields = [
      'lastSyncedAt',
      'lastPulledFromSheetAt',
      'lastPushedToSheetAt'
    ];

    for (const field of timestampFields) {
      if (validUpdates[field] !== undefined && validUpdates[field] !== null) {
        if (typeof validUpdates[field] === 'string' && validUpdates[field]) {
          try {
            // Handle both ISO strings and common date formats
            const dateValue = validUpdates[field];
            let parsedDate;

            // Check if it's already a valid ISO string
            if (dateValue.includes('T') || dateValue.includes('Z')) {
              parsedDate = new Date(dateValue);
            } else if (dateValue.includes('/')) {
              // Handle MM/DD/YYYY or M/D/YYYY format
              const parts = dateValue.split('/');
              if (parts.length === 3) {
                const month = parseInt(parts[0], 10);
                const day = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                parsedDate = new Date(year, month - 1, day);
              } else {
                parsedDate = new Date(dateValue);
              }
            } else {
              parsedDate = new Date(dateValue);
            }

            // Only set if the date is valid
            if (!isNaN(parsedDate.getTime())) {
              validUpdates[field] = parsedDate;
            } else {
              // Remove invalid date to prevent errors
              delete validUpdates[field];
            }
          } catch (error) {
            // Remove field if date parsing fails
            logger.error(`Failed to parse date for field ${field}:`, error);
            delete validUpdates[field];
          }
        } else if (validUpdates[field] instanceof Date) {
          // Already a Date object, keep it
        } else {
          // Invalid value, remove it
          delete validUpdates[field];
        }
      }
    }

    // Note: These fields are stored as text/string in the database, so don't convert them
    // dueDate, startDate, completionDate, lastDiscussedDate - all remain as strings

    logger.info('[sanitizeProjectUpdates] Final valid updates:', validUpdates);

    // Guard against empty updates - this prevents SQL syntax errors
    if (Object.keys(validUpdates).length === 0) {
      logger.warn('[sanitizeProjectUpdates] No valid fields to update! This will cause a SQL error.');
    }

    return validUpdates;
  }

  /**
   * REFACTOR: Sync project assignments to the new project_assignments table
   * This is called after creating or updating a project to maintain dual-write
   */
  private async syncProjectAssignments(project: Project, addedBy: string): Promise<void> {
    // Build assignment list from project data
    const assignments: Array<{ userId: string; userName: string; role: 'owner' | 'support' }> = [];

    // Add owner if present (from ownerId or fallback to assigneeId)
    const ownerId = project.ownerId || project.assigneeId;
    const ownerName = project.ownerName || project.assigneeName;
    if (ownerId) {
      assignments.push({
        userId: String(ownerId),
        userName: ownerName || 'Unknown',
        role: 'owner',
      });
    }

    // Add additional owners from assigneeIds (if not already added as ownerId)
    if (project.assigneeIds && Array.isArray(project.assigneeIds)) {
      const assigneeNames = project.assigneeNames
        ? (typeof project.assigneeNames === 'string'
            ? project.assigneeNames.split(',').map((n: string) => n.trim())
            : project.assigneeNames)
        : [];

      (project.assigneeIds as any[]).forEach((userId: any, index: number) => {
        const userIdStr = String(userId);
        // Don't add if already added as owner
        if (userIdStr !== String(ownerId)) {
          assignments.push({
            userId: userIdStr,
            userName: assigneeNames[index] || 'Unknown',
            role: 'owner',
          });
        }
      });
    }

    // Add support people from supportPeopleIds
    if (project.supportPeopleIds && Array.isArray(project.supportPeopleIds)) {
      const supportNames = project.supportPeople
        ? (typeof project.supportPeople === 'string'
            ? project.supportPeople.split(',').map((n: string) => n.trim())
            : [])
        : [];

      (project.supportPeopleIds as any[]).forEach((userId: any, index: number) => {
        assignments.push({
          userId: String(userId),
          userName: supportNames[index] || 'Unknown',
          role: 'support',
        });
      });
    }

    // Replace all assignments atomically
    if (assignments.length > 0) {
      await projectAssignmentService.replaceProjectAssignments(
        project.id,
        assignments,
        addedBy
      );
      logger.info(`Synced ${assignments.length} assignments for project ${project.id}`);
    } else {
      // No assignments - clear the table
      await projectAssignmentService.replaceProjectAssignments(project.id, [], addedBy);
      logger.info(`Cleared assignments for project ${project.id}`);
    }
  }

  private triggerGoogleSheetsSync(): void {
    // Auto-sync to Google Sheets if supportPeople was updated (async, non-blocking)
    setImmediate(async () => {
      try {
        const { getGoogleSheetsSyncService } = await import(
          '../../google-sheets-sync'
        );
        const syncService = getGoogleSheetsSyncService(this.storage);
        await syncService.syncToGoogleSheets();
        logger.log(
          'Projects synced to Google Sheets successfully (background)'
        );
      } catch (syncError) {
        logger.error(
          'Failed to sync to Google Sheets (background):',
          syncError
        );
      }
    });
  }
}

// Factory function for creating project service instance
export function createProjectService(storage: IStorage): ProjectService {
  return new ProjectService(storage);
}
