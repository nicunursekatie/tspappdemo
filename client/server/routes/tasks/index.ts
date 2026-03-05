import { Router, type Response } from 'express';
import { createErrorHandler } from '../../middleware';
import { insertTaskCompletionSchema } from '@shared/schema';
import { storage } from '../../storage-wrapper';
import { taskService } from '../../services/tasks/index';
import { logger } from '../../utils/production-safe-logger';
// REFACTOR: Import new assignment service for dual-write
import { taskAssignmentService } from '../../services/assignments';
import type { AuthenticatedRequest } from '../../types/express';

// Create task routes router
const tasksRouter = Router();

// Error handling for this module (standard middleware applied at mount level)
const errorHandler = createErrorHandler('tasks');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// PATCH /:id - Update task
tasksRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const updates = req.body;
    const user = getUser(req);

    logger.log(`Task PATCH request - Task ID: ${taskId}`);
    logger.log('Updates payload:', updates);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get original task to compare assignees
    const originalTask = await storage.getProjectTask(taskId);

    // Update task using service layer
    const task = await taskService.updateTaskWithSync(taskId, updates, storage);

    // Handle new assignee notifications using service layer
    if (updates.assigneeIds && Array.isArray(updates.assigneeIds)) {
      const originalAssigneeIds = originalTask?.assigneeIds || [];
      await taskService.handleTaskAssignment(
        taskId,
        updates.assigneeIds,
        originalAssigneeIds,
        task.title,
        storage
      );
    }

    // REFACTOR: Dual-write to task_assignments table
    if (updates.assigneeIds !== undefined) {
      try {
        // Build assignments from assigneeIds and assigneeNames
        const assigneeIds = updates.assigneeIds || [];
        const assigneeNames = updates.assigneeNames || [];

        const assignments = assigneeIds.map((userId: string, index: number) => ({
          userId,
          userName: assigneeNames[index] || 'Unknown',
          role: 'assignee' as const,
        }));

        await taskAssignmentService.replaceTaskAssignments(
          taskId,
          assignments,
          user.id
        );
        logger.log(`Synced ${assignments.length} task assignments for task ${taskId}`);
      } catch (syncError) {
        logger.error('Failed to sync task assignments:', syncError);
        // Don't fail the task update if assignment sync fails
      }
    }

    logger.log(`Task ${taskId} updated successfully`);
    res.json(task);
  } catch (error) {
    logger.error('Error updating project task:', error);
    logger.error('Failed to update task', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /:id - Delete task
tasksRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = parseInt(req.params.id);
    const user = getUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const success = await storage.deleteProjectTask(taskId);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting project task:', error);
    logger.error('Failed to delete task', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /:taskId/complete - Complete a task
tasksRouter.post(
  '/:taskId/complete',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);
      const { notes } = req.body;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is assigned to this task or has admin privileges
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const assigneeIds = task.assigneeIds || [];
      const isAssignee = assigneeIds.includes(user.id);
      
      // Check admin/permission capabilities
      const has = (p: string) => user.permissions?.includes(p) === true;
      const isAdmin = user.role === 'admin' || has('admin');
      const canCompleteAny = isAdmin || has('tasks:complete:any');
      
      if (!isAssignee && !canCompleteAny) {
        return res
          .status(403)
          .json({ error: 'You are not assigned to this task' });
      }

      // Admin override path - directly complete the task
      if (!isAssignee && canCompleteAny) {
        await storage.updateTaskStatus(taskId, 'completed');
        
        // Audit log the override
        logger.info('Admin override task completion', {
          taskId,
          taskTitle: task.title,
          adminUser: user.id,
          adminEmail: user.email,
          role: user.role,
          notes: notes || 'Completed during agenda planning',
          action: 'task.complete.override'
        });

        const completions = await storage.getTaskCompletions(taskId);
        return res.json({
          completion: null,
          isFullyCompleted: true,
          totalCompletions: completions.length,
          totalAssignees: assigneeIds.length,
          overridden: true,
          message: 'Task completed by admin override'
        });
      }

      // Add completion record
      const completionData = insertTaskCompletionSchema.parse({
        taskId: taskId,
        userId: user.id,
        userName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email,
        notes: notes,
      });

      const completion = await storage.createTaskCompletion(completionData);

      // Check completion status
      const allCompletions = await storage.getTaskCompletions(taskId);
      const isFullyCompleted = allCompletions.length >= assigneeIds.length;

      // If all users completed, update task status
      if (isFullyCompleted && task.status !== 'completed') {
        await storage.updateTaskStatus(taskId, 'completed');
      }

      res.json({
        completion: completion,
        isFullyCompleted,
        totalCompletions: allCompletions.length,
        totalAssignees: assigneeIds.length,
      });
    } catch (error) {
      logger.error('Error completing task:', error);
      logger.error('Failed to complete task', error);
      res.status(500).json({ error: 'Failed to complete task' });
    }
  }
);

// DELETE /:taskId/complete - Remove task completion
tasksRouter.delete(
  '/:taskId/complete',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Remove completion record
      const success = await storage.removeTaskCompletion(taskId, user.id);
      if (!success) {
        return res.status(404).json({ error: 'Completion not found' });
      }

      // Update task status back to in_progress if it was completed
      const task = await storage.getTaskById(taskId);
      if (task?.status === 'completed') {
        await storage.updateTaskStatus(taskId, 'in_progress');
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Error removing completion:', error);
      logger.error('Failed to remove task completion', error);
      res.status(500).json({ error: 'Failed to remove completion' });
    }
  }
);

// GET /:taskId/completions - Get task completions
tasksRouter.get(
  '/:taskId/completions',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      logger.error('Error fetching completions:', error);
      logger.error('Failed to fetch task completions', error);
      res.status(500).json({ error: 'Failed to fetch completions' });
    }
  }
);

// POST /:taskId/assignments - Add assignment to task
tasksRouter.post(
  '/:taskId/assignments',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      const { userId, userName, role } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({
          error: 'Missing required fields: userId and userName are required'
        });
      }

      const assignmentRole = role || 'assignee';
      if (assignmentRole !== 'assignee' && assignmentRole !== 'reviewer') {
        return res.status(400).json({
          error: 'Invalid role. Must be either "assignee" or "reviewer"'
        });
      }

      const assignment = await taskAssignmentService.addAssignment(
        taskId,
        userId,
        assignmentRole,
        user.id
      );

      logger.log('Successfully added task assignment', {
        taskId,
        userId,
        role: assignmentRole,
        addedBy: user.id
      });

      res.status(201).json(assignment);
    } catch (error) {
      logger.error('Failed to add task assignment:', error);
      res.status(500).json({ error: 'Failed to add task assignment' });
    }
  }
);

// DELETE /:taskId/assignments/:userId - Remove assignment from task
tasksRouter.delete(
  '/:taskId/assignments/:userId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { userId } = req.params;
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const success = await taskAssignmentService.removeAssignment(taskId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Assignment not found' });
      }

      logger.log('Successfully removed task assignment', {
        taskId,
        userId,
        removedBy: user.id
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to remove task assignment:', error);
      res.status(500).json({ error: 'Failed to remove task assignment' });
    }
  }
);

// GET /:taskId/assignments - Get all assignments for a task
tasksRouter.get(
  '/:taskId/assignments',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);

      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      const assignments = await taskAssignmentService.getTaskAssignments(taskId);

      logger.log('Successfully fetched task assignments', {
        taskId,
        count: assignments.length
      });

      res.json(assignments);
    } catch (error) {
      logger.error('Failed to fetch task assignments:', error);
      res.status(500).json({ error: 'Failed to fetch task assignments' });
    }
  }
);

// ============================================================================
// SUBTASK ROUTES
// ============================================================================

// GET /:taskId/subtasks - Get all subtasks for a parent task
tasksRouter.get(
  '/:taskId/subtasks',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parentTaskId = parseInt(req.params.taskId);

      if (isNaN(parentTaskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      const subtasks = await storage.getSubtasks(parentTaskId);

      logger.log('Successfully fetched subtasks', {
        parentTaskId,
        count: subtasks.length
      });

      res.json(subtasks);
    } catch (error) {
      logger.error('Failed to fetch subtasks:', error);
      res.status(500).json({ error: 'Failed to fetch subtasks' });
    }
  }
);

// POST /:taskId/subtasks - Create a subtask for a parent task
tasksRouter.post(
  '/:taskId/subtasks',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parentTaskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(parentTaskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      // Get parent task to inherit project ID
      const parentTask = await storage.getTaskById(parentTaskId);
      if (!parentTask) {
        return res.status(404).json({ error: 'Parent task not found' });
      }

      const { title, description, priority, dueDate, assigneeIds, assigneeNames } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const subtask = await storage.createSubtask({
        parentTaskId,
        projectId: parentTask.projectId,
        title,
        description,
        priority: priority || 'medium',
        dueDate,
        assigneeIds,
        assigneeNames,
      });

      logger.log('Successfully created subtask', {
        subtaskId: subtask.id,
        parentTaskId,
        title
      });

      res.status(201).json(subtask);
    } catch (error) {
      logger.error('Failed to create subtask:', error);
      res.status(500).json({ error: 'Failed to create subtask' });
    }
  }
);

// POST /:taskId/promote-to-todo - Promote a subtask to the to-do list
tasksRouter.post(
  '/:taskId/promote-to-todo',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      // Get the task
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update task to be promoted to to-do list
      const updatedTask = await storage.promoteTaskToTodo(taskId);

      logger.log('Successfully promoted task to to-do list', {
        taskId,
        title: task.title
      });

      res.json(updatedTask);
    } catch (error) {
      logger.error('Failed to promote task to to-do:', error);
      res.status(500).json({ error: 'Failed to promote task to to-do list' });
    }
  }
);

// DELETE /:taskId/promote-to-todo - Remove task from to-do list (demote)
tasksRouter.delete(
  '/:taskId/promote-to-todo',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (isNaN(taskId)) {
        return res.status(400).json({ error: 'Invalid task ID' });
      }

      // Update task to remove from to-do list
      const updatedTask = await storage.demoteTaskFromTodo(taskId);

      logger.log('Successfully removed task from to-do list', { taskId });

      res.json(updatedTask);
    } catch (error) {
      logger.error('Failed to demote task from to-do:', error);
      res.status(500).json({ error: 'Failed to remove task from to-do list' });
    }
  }
);

// GET /promoted-to-todo - Get all tasks promoted to to-do list
tasksRouter.get(
  '/promoted-to-todo',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tasks = await storage.getTasksPromotedToTodo();

      logger.log('Successfully fetched tasks promoted to to-do', {
        count: tasks.length
      });

      res.json(tasks);
    } catch (error) {
      // Return empty array if column doesn't exist yet
      if (error instanceof Error && (error.message.includes('does not exist') || error.message.includes('column'))) {
        return res.json([]);
      }
      logger.error('Failed to fetch promoted tasks:', error);
      res.status(500).json({ error: 'Failed to fetch promoted tasks' });
    }
  }
);

// Apply error handling middleware
tasksRouter.use(errorHandler);

export default tasksRouter;
