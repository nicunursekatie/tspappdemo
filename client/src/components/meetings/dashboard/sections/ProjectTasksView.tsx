import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatDateForDisplay } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Check } from 'lucide-react';
import { formatStatusText, getStatusBadgeProps } from '../utils/status';

interface ProjectTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  assigneeName?: string;
  dueDate?: string;
  priority: string;
}

interface ProjectTasksViewProps {
  projectId: number;
}

// Status utility functions are now imported from utils/status.ts

export function ProjectTasksView({ projectId }: ProjectTasksViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: tasks = [], isLoading } = useQuery<ProjectTask[]>({
    queryKey: ['/api/projects', projectId, 'tasks'],
    enabled: !!projectId,
    // Use global defaults (5 min staleTime) - proper cache invalidation after mutations
  });

  // Mutation for marking tasks as complete
  const markTaskCompleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest('POST', `/api/tasks/${taskId}/complete`, {
        notes: 'Task marked complete during agenda planning',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
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

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading tasks...</div>;
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-3">
        No tasks yet. Add tasks to track project progress.
      </div>
    );
  }

  return (
    <div>
      <Label className="text-sm font-medium text-gray-700 mb-2 block">
        Project Tasks ({Array.isArray(tasks) ? tasks.length : 0})
      </Label>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {Array.isArray(tasks) &&
          tasks.map((task: ProjectTask) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    {...getStatusBadgeProps(task.status)}
                    className={`text-xs ${
                      getStatusBadgeProps(task.status).className
                    }`}
                    style={getStatusBadgeProps(task.status).style}
                  >
                    {formatStatusText(task.status)}
                  </Badge>
                  <span className="font-medium">{task.title}</span>
                </div>
                {task.assigneeName && (
                  <div className="text-gray-600 mt-1">
                    Assigned: {task.assigneeName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <div className="text-gray-500 text-xs">
                    Due: {formatDateForDisplay(task.dueDate)}
                  </div>
                )}
                {task.status !== 'completed' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    onClick={() => markTaskCompleteMutation.mutate(task.id)}
                    disabled={markTaskCompleteMutation.isPending}
                    data-testid={`button-complete-task-${task.id}`}
                  >
                    {markTaskCompleteMutation.isPending ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}