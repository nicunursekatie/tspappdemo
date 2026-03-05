import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMeetingTasks, type MeetingTask } from '../hooks/useMeetingTasks';
import { formatDateForDisplay } from '@/lib/date-utils';
import {
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  ListTodo,
  Trash2,
  Edit3,
} from 'lucide-react';
import type { QueryClient } from '@tanstack/react-query';
import type { Project } from '../hooks/useProjects';

type ToastFunction = (props: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

interface TasksFromNotesTabProps {
  allProjects: Project[];
  handleSendToAgenda?: (projectId: number, noteContent?: string) => void;
  queryClient: QueryClient;
  toast: ToastFunction;
}

export function TasksFromNotesTab({
  allProjects,
  handleSendToAgenda,
  queryClient,
  toast,
}: TasksFromNotesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const {
    tasks,
    tasksLoading,
    markTaskCompleteMutation,
    updateTaskMutation,
    deleteTaskMutation,
  } = useMeetingTasks();

  // Group tasks by project
  const projectsWithTasks = useMemo(() => {
    // Group tasks by projectId
    const grouped = tasks.reduce((acc, task) => {
      if (!acc[task.projectId]) {
        acc[task.projectId] = [];
      }
      acc[task.projectId].push(task);
      return acc;
    }, {} as Record<number, MeetingTask[]>);

    // Convert to array and add project info
    return Object.entries(grouped).map(([projectId, projectTasks]) => {
      const project = allProjects.find(p => p.id === parseInt(projectId));
      return {
        projectId: parseInt(projectId),
        projectTitle: project?.title || 'Unknown Project',
        projectStatus: project?.status || 'unknown',
        tasks: projectTasks,
      };
    });
  }, [tasks, allProjects]);

  // Apply filters
  const filteredProjects = useMemo(() => {
    return projectsWithTasks
      .map(project => ({
        ...project,
        tasks: project.tasks.filter(task => {
          // Search filter
          const searchLower = searchQuery.toLowerCase();
          const matchesSearch =
            !searchQuery ||
            task.title.toLowerCase().includes(searchLower) ||
            task.description?.toLowerCase().includes(searchLower) ||
            project.projectTitle.toLowerCase().includes(searchLower);

          // Status filter
          const matchesStatus =
            statusFilter === 'all' || task.status === statusFilter;

          // Priority filter
          const matchesPriority =
            priorityFilter === 'all' || task.priority === priorityFilter;

          return matchesSearch && matchesStatus && matchesPriority;
        }),
      }))
      .filter(project => project.tasks.length > 0); // Only show projects with matching tasks
  }, [projectsWithTasks, searchQuery, statusFilter, priorityFilter]);

  const handleUseInAgenda = (projectId: number) => {
    if (!handleSendToAgenda) return;

    const projectExists = allProjects.some(p => p.id === projectId);

    if (!projectExists) {
      toast({
        title: 'Project Not Found',
        description: 'This project has been archived or deleted.',
        variant: 'destructive',
      });
      return;
    }

    // Send project to agenda without note content
    // The tasks are already linked to the project
    handleSendToAgenda(projectId);
    toast({
      title: 'Added to Agenda',
      description: 'Project and its tasks have been added to the agenda.',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'done':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'blocked':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (tasksLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredProjects.length === 0) {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks or projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <ListTodo className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600 mb-2">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks from meeting notes yet'}
            </p>
            <p className="text-sm text-gray-500">
              Convert meeting notes to tasks to see them here
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tasks or projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Project Cards with Tasks */}
      <div className="space-y-4">
        {filteredProjects.map((project) => (
          <Card key={project.projectId} className="overflow-hidden">
            <CardHeader className="bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">
                  {project.projectTitle}
                </CardTitle>
                {handleSendToAgenda && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUseInAgenda(project.projectId)}
                    className="text-teal-600 border-teal-200 hover:bg-teal-50"
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    Use in Next Agenda
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <ListTodo className="w-4 h-4" />
                <span>{project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}</span>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {project.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {task.assigneeName && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {task.assigneeName}
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateForDisplay(task.dueDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {task.status !== 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markTaskCompleteMutation.mutate(task.id)}
                          disabled={markTaskCompleteMutation.isPending}
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          title="Mark as complete"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        disabled={deleteTaskMutation.isPending}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
