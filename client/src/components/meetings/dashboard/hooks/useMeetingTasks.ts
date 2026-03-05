import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

export interface MeetingTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assigneeName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithTasks {
  projectId: number;
  projectTitle: string;
  tasks: MeetingTask[];
}

/**
 * Hook to fetch and manage tasks created from meeting notes
 * Groups tasks by project for display in the Notes tab
 */
export function useMeetingTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all project tasks
  // We filter for tasks created from meeting notes by checking the description
  const tasksQuery = useQuery<MeetingTask[]>({
    queryKey: ['/api/tasks/from-meeting-notes'],
    queryFn: async () => {
      try {
        // Fetch all projects first
        const projects = await apiRequest('GET', '/api/projects');

        // Fetch tasks for each project
        const allTasksPromises = projects.map((project: any) =>
          apiRequest('GET', `/api/projects/${project.id}/tasks`)
            .then((tasks: any[]) =>
              tasks.map(task => ({
                ...task,
                projectId: project.id,
              }))
            )
            .catch(error => {
              logger.warn(`Failed to fetch tasks for project ${project.id}:`, error);
              return [];
            })
        );

        const allTasksArrays = await Promise.all(allTasksPromises);
        const allTasks = allTasksArrays.flat();

        // Filter for tasks created from meeting notes
        // These tasks have descriptions containing "Created from meeting note"
        const meetingTasks = allTasks.filter((task: any) =>
          task.description &&
          (task.description.includes('Created from meeting note') ||
           task.description.includes('Meeting Discussion Notes') ||
           task.description.includes('Meeting Decisions to Implement'))
        );

        logger.log('[useMeetingTasks] Fetched meeting tasks:', meetingTasks.length);
        return meetingTasks;
      } catch (error) {
        logger.error('[useMeetingTasks] Failed to fetch meeting tasks:', error);
        return [];
      }
    },
  });

  // Mark task as complete
  const markTaskCompleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/complete`, {
        notes: 'Task marked complete from meeting notes view',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/from-meeting-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Task Completed',
        description: 'Task has been marked as complete',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Complete Task',
        description: error?.message || 'Failed to mark task as complete',
        variant: 'destructive',
      });
    },
  });

  // Update task
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: number; updates: Partial<MeetingTask> }) => {
      return await apiRequest('PATCH', `/api/tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/from-meeting-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Task Updated',
        description: 'Task has been updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Update Task',
        description: error?.message || 'Failed to update task',
        variant: 'destructive',
      });
    },
  });

  // Delete task
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('DELETE', `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/from-meeting-notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Task Deleted',
        description: 'Task has been deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Delete Task',
        description: error?.message || 'Failed to delete task',
        variant: 'destructive',
      });
    },
  });

  return {
    tasks: tasksQuery.data || [],
    tasksLoading: tasksQuery.isLoading,
    tasksError: tasksQuery.error,
    markTaskCompleteMutation,
    updateTaskMutation,
    deleteTaskMutation,
  };
}
