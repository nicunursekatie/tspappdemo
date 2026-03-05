import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ListTodo,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Subtask {
  id: number;
  parentTaskId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  promotedToTodo: boolean;
  dueDate?: string;
  assigneeIds?: string[];
  assigneeNames?: string[];
}

interface SubtaskSectionProps {
  parentTaskId: number;
  projectId: number;
  canEdit?: boolean;
}

export function SubtaskSection({ parentTaskId, projectId, canEdit = true }: SubtaskSectionProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState({
    title: '',
    description: '',
    priority: 'medium',
  });

  // Fetch subtasks for this parent task
  const { data: subtasks = [], isLoading } = useQuery<Subtask[]>({
    queryKey: ['/api/tasks', parentTaskId, 'subtasks'],
    queryFn: async () => {
      const response = await fetch(`/api/tasks/${parentTaskId}/subtasks`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch subtasks');
      return response.json();
    },
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; priority: string }) => {
      return apiRequest('POST', `/api/tasks/${parentTaskId}/subtasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', parentTaskId, 'subtasks'] });
      setIsAddDialogOpen(false);
      setNewSubtask({ title: '', description: '', priority: 'medium' });
      toast({
        title: 'Subtask created',
        description: 'The subtask has been added successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create subtask.',
        variant: 'destructive',
      });
    },
  });

  // Toggle subtask status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ subtaskId, newStatus }: { subtaskId: number; newStatus: string }) => {
      return apiRequest('PATCH', `/api/tasks/${subtaskId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', parentTaskId, 'subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update subtask status.',
        variant: 'destructive',
      });
    },
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: number) => {
      return apiRequest('DELETE', `/api/tasks/${subtaskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', parentTaskId, 'subtasks'] });
      toast({
        title: 'Subtask deleted',
        description: 'The subtask has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete subtask.',
        variant: 'destructive',
      });
    },
  });

  // Promote to to-do mutation
  const promoteToTodoMutation = useMutation({
    mutationFn: async ({ subtaskId, promote }: { subtaskId: number; promote: boolean }) => {
      if (promote) {
        return apiRequest('POST', `/api/tasks/${subtaskId}/promote-to-todo`);
      } else {
        return apiRequest('DELETE', `/api/tasks/${subtaskId}/promote-to-todo`);
      }
    },
    onSuccess: (_, { promote }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', parentTaskId, 'subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/promoted-to-todo'] });
      toast({
        title: promote ? 'Added to To-Do List' : 'Removed from To-Do List',
        description: promote
          ? 'This subtask now appears on your to-do list.'
          : 'This subtask has been removed from your to-do list.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update to-do list status.',
        variant: 'destructive',
      });
    },
  });

  const handleCreateSubtask = () => {
    if (!newSubtask.title.trim()) {
      toast({
        title: 'Error',
        description: 'Subtask title is required.',
        variant: 'destructive',
      });
      return;
    }
    createSubtaskMutation.mutate(newSubtask);
  };

  const completedCount = subtasks.filter((s) => s.status === 'completed').length;
  const totalCount = subtasks.length;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      {/* Header with expand/collapse and add button */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <ListTodo className="h-4 w-4" />
          <span>Subtasks</span>
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {completedCount}/{totalCount}
            </Badge>
          )}
        </button>
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Subtask
          </Button>
        )}
      </div>

      {/* Subtasks list */}
      {isExpanded && (
        <div className="space-y-2 ml-6">
          {isLoading ? (
            <div className="text-sm text-gray-500">Loading subtasks...</div>
          ) : subtasks.length === 0 ? (
            <div className="text-sm text-gray-500 italic">No subtasks yet</div>
          ) : (
            subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={cn(
                  'flex items-center gap-3 p-2 rounded-md border',
                  subtask.status === 'completed'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                )}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={subtask.status === 'completed'}
                  onCheckedChange={(checked) => {
                    toggleStatusMutation.mutate({
                      subtaskId: subtask.id,
                      newStatus: checked ? 'completed' : 'pending',
                    });
                  }}
                  disabled={!canEdit}
                />

                {/* Title and info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-sm',
                        subtask.status === 'completed' && 'line-through text-gray-500'
                      )}
                    >
                      {subtask.title}
                    </span>
                    <Badge className={cn('text-xs', getPriorityColor(subtask.priority))}>
                      {subtask.priority}
                    </Badge>
                    {subtask.promotedToTodo && (
                      <Badge className="text-xs bg-teal-100 text-teal-800 border-teal-200">
                        On To-Do
                      </Badge>
                    )}
                  </div>
                  {subtask.description && (
                    <p className="text-xs text-gray-500 truncate">{subtask.description}</p>
                  )}
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="flex items-center gap-1">
                    {/* Promote to to-do button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        promoteToTodoMutation.mutate({
                          subtaskId: subtask.id,
                          promote: !subtask.promotedToTodo,
                        });
                      }}
                      className={cn(
                        'p-1 h-auto',
                        subtask.promotedToTodo
                          ? 'text-teal-600 hover:text-teal-700'
                          : 'text-gray-400 hover:text-teal-600'
                      )}
                      title={
                        subtask.promotedToTodo
                          ? 'Remove from To-Do List'
                          : 'Add to To-Do List'
                      }
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>

                    {/* Delete button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Delete this subtask?')) {
                          deleteSubtaskMutation.mutate(subtask.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-1 h-auto"
                      title="Delete subtask"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Subtask Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Subtask</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Title *</label>
              <Input
                value={newSubtask.title}
                onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })}
                placeholder="Enter subtask title"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={newSubtask.description}
                onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Priority</label>
              <Select
                value={newSubtask.priority}
                onValueChange={(value) => setNewSubtask({ ...newSubtask, priority: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubtask}
              disabled={createSubtaskMutation.isPending}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {createSubtaskMutation.isPending ? 'Creating...' : 'Create Subtask'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubtaskSection;
