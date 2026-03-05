import { logger } from '../../middleware/logger';
import type { IStorage } from '../../storage';
import { WebSocket } from 'ws';
import { logger } from '../../utils/production-safe-logger';

// Task Management Service
// Business logic for task operations including assignment notifications and sync

export interface ITaskService {
  // Task assignment and notification
  handleTaskAssignment(
    taskId: number,
    newAssigneeIds: string[],
    originalAssigneeIds: string[],
    taskTitle: string,
    storage: IStorage
  ): Promise<void>;

  // Task update with external sync
  updateTaskWithSync(
    taskId: number,
    updates: any,
    storage: IStorage
  ): Promise<any>;

  // WebSocket broadcasting for task assignments
  broadcastTaskAssignment(
    userId: string,
    notificationData: any,
    connectedClients: Map<string, WebSocket[]>
  ): void;
}

export class TaskService implements ITaskService {
  /**
   * Handle new task assignments by creating notifications and broadcasting
   */
  async handleTaskAssignment(
    taskId: number,
    newAssigneeIds: string[],
    originalAssigneeIds: string[],
    taskTitle: string,
    storage: IStorage
  ): Promise<void> {
    const actualNewAssignees = newAssigneeIds.filter(
      (id) => id && id.trim() && !originalAssigneeIds.includes(id)
    );

    if (actualNewAssignees.length === 0) {
      return;
    }

    for (const assigneeId of actualNewAssignees) {
      try {
        // Create notification in database
        const notification = await storage.createNotification({
          userId: assigneeId,
          type: 'task_assignment',
          priority: 'medium',
          title: 'New Task Assignment',
          message: `You have been assigned to task: ${taskTitle}`,
          category: 'tasks',
          relatedType: 'task',
          relatedId: taskId,
          actionUrl: '/tasks',
          actionText: 'View Task',
        });

        // Emit WebSocket notification if available
        if (typeof (global as any).broadcastTaskAssignment === 'function') {
          (global as any).broadcastTaskAssignment(assigneeId, {
            type: 'task_assignment',
            message: 'You have been assigned a new task',
            taskId: taskId,
            taskTitle: taskTitle,
            notificationId: notification.id,
          });
        }
      } catch (notificationError) {
        logger.error(
          `Error creating notification for user ${assigneeId}:`,
          notificationError
        );
        // Don't fail task update if notification fails
      }
    }
  }

  /**
   * Update task and trigger external sync (Google Sheets)
   */
  async updateTaskWithSync(
    taskId: number,
    updates: any,
    storage: IStorage
  ): Promise<any> {
    const task = await storage.updateProjectTask(taskId, updates);

    if (!task) {
      throw new Error('Task not found');
    }

    // Trigger Google Sheets sync after task status change
    try {
      const { triggerGoogleSheetsSync } = await import(
        '../../google-sheets-sync'
      );
      logger.log('Triggering Google Sheets sync after task status update...');
      setImmediate(() => {
        triggerGoogleSheetsSync().catch((error) => {
          logger.error('Google Sheets sync failed after task update:', error);
        });
      });
    } catch (syncError) {
      logger.error('Error triggering Google Sheets sync:', syncError);
      // Don't fail the task update if sync fails
    }

    return task;
  }

  /**
   * Broadcast task assignment notifications via WebSocket
   */
  broadcastTaskAssignment(
    userId: string,
    notificationData: any,
    connectedClients: Map<string, WebSocket[]>
  ): void {
    try {
      logger.log(
        `Broadcasting task assignment notification to user: ${userId}`
      );
      const userClients = connectedClients.get(userId);

      if (userClients) {
        let sentCount = 0;
        userClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            logger.log(
              'Sending task assignment notification to client:',
              notificationData
            );
            client.send(
              JSON.stringify({
                type: 'notification',
                data: notificationData,
              })
            );
            sentCount++;
          }
        });
        logger.log(
          `Sent task assignment notification to ${sentCount} clients for user ${userId}`
        );
      } else {
        logger.log(`No connected clients found for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error broadcasting task assignment notification:', error);
    }
  }
}

export const taskService = new TaskService();
