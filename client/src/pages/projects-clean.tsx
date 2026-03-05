import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCelebration } from '@/components/celebration-toast';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import {
  Plus,
  Circle,
  Play,
  CheckCircle2,
  Archive,
  Settings,
  Edit,
  Trash2,
  User,
  Calendar,
  ArrowRight,
  Filter,
  Square,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Project, InsertProject } from '@shared/schema';
import SendKudosButton from '@/components/send-kudos-button';
import { ProjectAssigneeSelector } from '@/components/project-assignee-selector';
import sandwichLogo from '@assets/LOGOS/Copy of TSP_transparent.png';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import { logger } from '@/lib/logger';
import { FloatingAIChat } from '@/components/floating-ai-chat';

// Component to display assignee email
function AssigneeEmail({ assigneeId }: { assigneeId: string | number }) {
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
    retry: false,
  });

  const user = (users || []).find((u: any) => u.id === assigneeId.toString());

  if (!user?.email) return null;

  return <span className="text-xs text-gray-400 truncate">{user.email}</span>;
}

export default function ProjectsClean() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { celebration, triggerCelebration, hideCelebration } = useCelebration();
  const queryClient = useQueryClient();
  const { track } = useOnboardingTracker();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [projectTypeFilter, setProjectTypeFilter] = useState('all'); // all, meeting, internal

  const [newProject, setNewProject] = useState<Partial<InsertProject>>({
    title: '',
    description: '',
    status: 'waiting',
    priority: 'medium',
    category: 'technology',
    assigneeName: '',
    assigneeIds: [],
    dueDate: '',
    startDate: '',
    estimatedHours: 0,
    actualHours: 0,
    budget: '',
    isMeetingProject: false,
  });

  // Fetch all projects
  const {
    data: allProjects = [],
    isLoading,
    refetch,
  } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    staleTime: 3 * 60 * 1000, // 3 minutes - projects need reasonable freshness for collaborative updates
    refetchOnWindowFocus: true, // Refetch when user returns to see updates from other team members
  });

  // Fetch archived projects data
  const { data: archivedProjects = [], isLoading: archiveLoading } = useQuery({
    queryKey: ['/api/projects/archived'],
  });

  // Fetch standalone tasks (one-off tasks not attached to projects)
  const { data: standaloneTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/projects/standalone-tasks'],
    staleTime: 3 * 60 * 1000, // 3 minutes
    refetchOnWindowFocus: true,
  });

  // Track that user has viewed projects page
  useEffect(() => {
    track('view_projects');
  }, []);

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: async (projectData: Partial<InsertProject>) => {
      return await apiRequest('POST', '/api/projects', projectData);
    },
    onSuccess: (data) => {
      // Force immediate cache refresh
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      refetch(); // Manual refetch to ensure immediate update
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: 'Project created successfully!',
        description: `"${data.title}" has been added to your projects.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create project.',
        variant: 'destructive',
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({
      id,
      ...projectData
    }: { id: number } & Partial<InsertProject>) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, projectData);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project updated successfully!',
        description: `"${data.title}" has been updated.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update project.',
        variant: 'destructive',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project deleted successfully!',
        description: 'The project has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete project.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setNewProject({
      title: '',
      description: '',
      status: 'waiting',
      priority: 'medium',
      category: 'technology',
      assigneeName: '',
      dueDate: '',
      startDate: '',
      estimatedHours: 0,
      actualHours: 0,
      budget: '',
      isMeetingProject: false,
      reviewInNextMeeting: false,
    });
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProject.title?.trim()) {
      const projectWithCreator = {
        ...newProject,
        createdBy: (user as any)?.id || '',
        createdByName: (user as any)?.firstName
          ? `${(user as any).firstName} ${(user as any).lastName || ''}`.trim()
          : (user as any)?.email || '',
        // If it's a meeting project, mark it for potential sync but don't assign googleSheetRowId yet
        // The googleSheetRowId will be assigned when it's actually synced to the sheet
        reviewInNextMeeting: newProject.isMeetingProject || false,
      };
      createProjectMutation.mutate(projectWithCreator);
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setShowEditDialog(true);
  };

  const handleUpdateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      const { id, assigneeIds, ...projectData } = editingProject;
      updateProjectMutation.mutate({
        id,
        ...projectData,
        assigneeIds: assigneeIds ? JSON.stringify(assigneeIds) : undefined,
      });
      setShowEditDialog(false);
      setEditingProject(null);
    }
  };

  const handleDeleteProject = (projectId: number) => {
    deleteProjectMutation.mutate(projectId);
  };

  const handleMarkComplete = (projectId: number, projectTitle: string) => {
    if (confirm(`Mark "${projectTitle}" as completed?`)) {
      updateProjectMutation.mutate({ id: projectId, status: 'completed' });
      toast({
        title: '🎉 Project completed!',
        description: `"${projectTitle}" has been marked as completed.`,
      });
      triggerCelebration('🎉');
    }
  };

  const filterProjectsByStatus = (status: string) => {
    let filtered = allProjects;

    // Filter by status
    if (status === 'active') {
      // Show all projects that are not tabled, completed, or archived
      // This includes: in_progress, waiting, pending, blocked, etc.
      filtered = filtered.filter(
        (project: Project) =>
          project.status !== 'tabled' &&
          project.status !== 'completed' &&
          project.status !== 'archived'
      );
    } else if (status === 'archived') {
      // For archived tab, get from the archived projects endpoint
      filtered = archivedProjects;
    } else {
      // For specific status (tabled, completed), filter exactly
      filtered = filtered.filter(
        (project: Project) => project.status === status
      );
    }

    // Filter by project type
    if (projectTypeFilter === 'meeting') {
      filtered = filtered.filter(
        (project: Project) => project.googleSheetRowId
      );
    } else if (projectTypeFilter === 'internal') {
      filtered = filtered.filter(
        (project: Project) => !project.googleSheetRowId
      );
    }

    return filtered;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-brand-orange';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technology':
        return '💻';
      case 'events':
        return '📅';
      case 'grants':
        return '💰';
      case 'outreach':
        return '🤝';
      case 'marketing':
        return '📢';
      case 'operations':
        return '⚙️';
      case 'community':
        return '👥';
      case 'fundraising':
        return '💵';
      case 'event':
        return '🎉';
      default:
        return '📁';
    }
  };

  const canEditProject = (user: any, project: Project) => {
    return hasPermission(user, PERMISSIONS.PROJECTS_EDIT_ALL);
  };

  const canDeleteProject = (user: any, project: Project) => {
    return hasPermission(user, PERMISSIONS.PROJECTS_DELETE_ALL);
  };

  const renderProjectCard = (project: Project) => (
    <Card
      key={project.id}
      className="hover:shadow-md transition-all duration-200 cursor-pointer border border-gray-200 bg-white"
      onClick={() => {
        logger.log('🎯 Project card clicked:', project.id, project.title);
        setLocation(`/projects/${project.id}`);
        logger.log('🚀 setLocation called with:', `/projects/${project.id}`);
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 flex items-start gap-3">
            {/* Project Type Badge */}
            {project.googleSheetRowId ? (
              <Badge
                variant="outline"
                className="bg-brand-primary-lighter text-brand-primary border-brand-primary-border text-xs"
              >
                📊 Meeting
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 text-xs"
              >
                🏢 Internal
              </Badge>
            )}

            {canEditProject(user, project) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (project.status !== 'completed') {
                    handleMarkComplete(project.id, project.title);
                  }
                }}
                className="h-5 w-5 p-0 hover:bg-brand-orange/10 flex-shrink-0 mt-1"
                title={
                  project.status === 'completed'
                    ? 'Completed'
                    : 'Mark as Complete'
                }
              >
                {project.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Square className="h-5 w-5 text-gray-400 hover:text-brand-orange" />
                )}
              </Button>
            )}
          </div>
        </div>
        <CardTitle className="font-semibold text-brand-primary font-roboto text-lg mb-2 break-words leading-tight">
          {project.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-4">
        <div className="flex flex-wrap gap-2 mb-2">
                <Badge
                  className={`${getPriorityColor(
                    project.priority
                  )} text-white text-xs font-roboto`}
                >
                  {project.priority} priority
                </Badge>
                <Badge className="bg-brand-orange text-white border-brand-orange text-xs font-roboto">
                  {project.status === 'in_progress'
                    ? 'active'
                    : project.status?.replace('_', ' ') || 'waiting'}
                </Badge>
                {project.category && (
                  <Badge className="bg-brand-primary text-white text-xs font-roboto">
                    {getCategoryIcon(project.category)} {project.category}
                  </Badge>
                )}
        </div>

        {canEditProject(user, project) && (
          <div className="flex gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                    className="h-8 w-8 p-0 hover:bg-brand-orange/10"
                  >
                    <Settings className="h-4 w-4 text-brand-orange" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2 text-brand-orange" />
                    Edit Project
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ConfirmationDialog
                    trigger={
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Project
                      </DropdownMenuItem>
                    }
                    title="Delete Project"
                    description={`Are you sure you want to delete "${project.title}"? This action cannot be undone.`}
                    confirmText="Delete Project"
                    cancelText="Cancel"
                    onConfirm={() => handleDeleteProject(project.id)}
                    variant="destructive"
                  />
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {project.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2 font-roboto">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500 font-roboto">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <User className="w-4 h-4 text-brand-orange flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="truncate">
                {project.assigneeName || 'Unassigned'}
              </span>
              {project.assigneeId && (
                <AssigneeEmail assigneeId={project.assigneeId} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Calendar className="w-4 h-4 text-brand-orange" />
            <span>
              {project.dueDate
                ? (() => {
                    // Timezone-safe date parsing
                    const dateStr = project.dueDate;
                    let date: Date;
                    if (
                      dateStr.match(/^\d{4}-\d{2}-\d{2}T00:00:00(\.\d{3})?Z?$/)
                    ) {
                      const parts = dateStr.split('T');
                      const dateOnly = parts.length > 0 ? parts[0] : dateStr;
                      date = new Date(dateOnly + 'T12:00:00');
                    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                      date = new Date(dateStr + 'T12:00:00');
                    } else {
                      date = new Date(dateStr);
                    }
                    return isNaN(date.getTime())
                      ? 'Invalid date'
                      : date.toLocaleDateString();
                  })()
                : 'No date'}
            </span>
          </div>
        </div>

        {/* Kudos Button for Completed Projects */}
        {project.status === 'completed' && (
          <div
            className="mt-3 pt-3 border-t border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-2">
              {/* Handle new format with assigneeIds array */}
              {(project as any).assigneeIds &&
                (project as any).assigneeIds.length > 0 &&
                (project as any).assigneeIds.map(
                  (assigneeId: string, index: number) => {
                    // Parse assigneeNames string to array if it's a comma-separated string
                    let assigneeName = `Team Member ${index + 1}`;
                    if ((project as any).assigneeNames) {
                      if (typeof (project as any).assigneeNames === 'string') {
                        const assigneeNamesStr = (
                          project as any
                        ).assigneeNames.trim();

                        // If the string contains commas, split by comma
                        if (assigneeNamesStr.includes(',')) {
                          const nameArray = assigneeNamesStr
                            .split(',')
                            .map((name: string) => name.trim());
                          assigneeName =
                            nameArray[index] || `Team Member ${index + 1}`;
                        }
                        // If no commas but multiple assignees, it might be a single name for all
                        else if ((project as any).assigneeIds.length === 1) {
                          // Single assignee with single name
                          assigneeName = assigneeNamesStr;
                        } else {
                          // Multiple assignees but only one name - this is the problematic case
                          // Don't split the name by characters, use the full name for the first assignee
                          if (index === 0) {
                            assigneeName = assigneeNamesStr;
                          } else {
                            assigneeName = `Team Member ${index + 1}`;
                          }
                        }
                      } else if (
                        Array.isArray((project as any).assigneeNames)
                      ) {
                        // Handle array format
                        assigneeName =
                          (project as any).assigneeNames[index] ||
                          `Team Member ${index + 1}`;
                      }
                    }

                    return (
                      <SendKudosButton
                        key={`${project.id}-${assigneeId}`}
                        recipientId={assigneeId}
                        recipientName={assigneeName}
                        contextType="project"
                        contextId={project.id.toString()}
                        contextTitle={project.title}
                        size="sm"
                        variant="outline"
                      />
                    );
                  }
                )}

              {/* Handle legacy format with single assignee */}
              {(!(project as any).assigneeIds ||
                (project as any).assigneeIds.length === 0) &&
                project.assigneeId &&
                project.assigneeName && (
                  <SendKudosButton
                    recipientId={project.assigneeId.toString()}
                    recipientName={project.assigneeName}
                    contextType="project"
                    contextId={project.id.toString()}
                    contextTitle={project.title}
                    size="sm"
                    variant="outline"
                  />
                )}

              {/* Show warning for legacy assignments without proper user IDs */}
              {(!(project as any).assigneeIds ||
                (project as any).assigneeIds.length === 0) &&
                !project.assigneeId &&
                project.assigneeName && (
                  <div className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                    ⚠️ Legacy assignment: {project.assigneeName}
                  </div>
                )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const projects = filterProjectsByStatus(activeTab);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 font-roboto">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header with TSP Styling */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img
              src={sandwichLogo}
              alt="The Sandwich Project Logo"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-2xl font-bold text-brand-primary font-roboto">
                Project Management
              </h1>
              <p className="text-gray-600 font-roboto">
                Organize and track all team projects
              </p>
            </div>
          </div>
          {hasPermission(user, PERMISSIONS.PROJECTS_ADD) && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white font-roboto font-medium shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          )}
        </div>

        {/* Project Type Filter */}
        <div className="flex gap-2 mb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectTypeFilter('all')}
            className={`transition-all ${
              projectTypeFilter === 'all'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            All Projects
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectTypeFilter('meeting')}
            className={`transition-all ${
              projectTypeFilter === 'meeting'
                ? 'bg-brand-primary text-white hover:bg-brand-primary'
                : 'text-brand-primary hover:text-brand-primary hover:bg-brand-primary-lighter'
            }`}
          >
            📊 Meeting Projects (
            {allProjects.filter((p) => p.googleSheetRowId).length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectTypeFilter('internal')}
            className={`transition-all ${
              projectTypeFilter === 'internal'
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
          >
            🏢 Internal Projects (
            {allProjects.filter((p) => !p.googleSheetRowId).length})
          </Button>
        </div>
      </div>

      {/* Clean Status Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1">
          <Button
            variant="ghost"
            onClick={() => setActiveTab('tabled')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'tabled'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            <Circle className="w-4 h-4 mr-2" />
            Tabled (
            {allProjects.filter((p) => p.status === 'tabled').length})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('active')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            <Play className="w-4 h-4 mr-2" />
            Active (
            {allProjects.filter((p) => p.status === 'in_progress').length})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('completed')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Completed (
            {allProjects.filter((p) => p.status === 'completed').length})
          </Button>

          <Button
            variant="ghost"
            onClick={() => setActiveTab('archived')}
            className={`font-roboto font-medium transition-all ${
              activeTab === 'archived'
                ? 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                : 'text-brand-primary hover:text-brand-primary-dark hover:bg-brand-primary/5'
            }`}
          >
            <Archive className="w-4 h-4 mr-2" />
            Archived (
            {Array.isArray(archivedProjects) ? archivedProjects.length : 0})
          </Button>
        </div>
      </div>

      {/* Projects List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(projects || []).length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-brand-primary/30 mb-4">
              {activeTab === 'tabled' && (
                <Circle className="w-12 h-12 mx-auto" />
              )}
              {activeTab === 'active' && <Play className="w-12 h-12 mx-auto" />}
              {activeTab === 'completed' && (
                <CheckCircle2 className="w-12 h-12 mx-auto" />
              )}
              {activeTab === 'archived' && (
                <Archive className="w-12 h-12 mx-auto" />
              )}
            </div>
            <h3 className="text-lg font-medium text-brand-primary font-roboto mb-2">
              No {activeTab.replace('_', ' ')} Projects
            </h3>
            <p className="text-gray-600 font-roboto">
              {activeTab === 'tabled' &&
                'All projects are currently assigned or completed.'}
              {activeTab === 'active' &&
                'No projects are currently in progress.'}
              {activeTab === 'completed' &&
                'Completed projects will appear here.'}
              {activeTab === 'archived' &&
                'Archived projects will appear here.'}
            </p>
          </div>
        ) : (
          projects.map(renderProjectCard)
        )}
      </div>

      {/* One-Off Tasks Section (standalone tasks not attached to projects) */}
      {activeTab === 'active' && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-brand-primary font-roboto">
              One-Off Tasks
            </h2>
            <span className="text-sm text-gray-600 font-roboto">
              {tasksLoading ? 'Loading...' : `${standaloneTasks.filter((t: any) => t.status !== 'completed' && t.status !== 'archived').length} active`}
            </span>
          </div>
          {tasksLoading ? (
            <div className="text-center py-8 text-gray-600 font-roboto">
              Loading tasks...
            </div>
          ) : standaloneTasks.filter((t: any) => t.status !== 'completed' && t.status !== 'archived').length === 0 ? (
            <div className="text-center py-8 text-gray-500 font-roboto bg-white rounded-lg border border-gray-200">
              No one-off tasks. Tasks converted from the holding zone will appear here.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {standaloneTasks
                .filter((t: any) => t.status !== 'completed' && t.status !== 'archived')
                .map((task: any) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-brand-primary font-roboto text-lg">
                        {task.title}
                      </h3>
                      <Badge
                        variant={
                          task.priority === 'high'
                            ? 'destructive'
                            : task.priority === 'medium'
                            ? 'default'
                            : 'secondary'
                        }
                        className="ml-2"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-gray-600 text-sm mb-3 font-roboto line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-roboto">
                        Status: {task.status || 'pending'}
                      </span>
                      {task.dueDate && (
                        <span className="font-roboto">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {task.assigneeNames && task.assigneeNames.length > 0 && (
                      <div className="mt-2 text-xs text-gray-600 font-roboto">
                        Assigned to: {Array.isArray(task.assigneeNames) ? task.assigneeNames.join(', ') : task.assigneeNames}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-brand-primary font-roboto">
              Create New Project
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-roboto">
                Project Title
              </Label>
              <Input
                id="title"
                placeholder="Enter project title"
                value={newProject.title}
                onChange={(e) =>
                  setNewProject({ ...newProject, title: e.target.value })
                }
                className="font-roboto"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-roboto">
                Description
              </Label>
              <Textarea
                id="description"
                placeholder="Project description"
                value={newProject.description || ''}
                onChange={(e) =>
                  setNewProject({ ...newProject, description: e.target.value })
                }
                className="font-roboto"
                rows={3}
              />
            </div>

            {/* Project Type Selection */}
            <div className="space-y-2">
              <Label className="font-roboto">Project Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="projectType"
                    checked={!newProject.isMeetingProject}
                    onChange={() =>
                      setNewProject({ ...newProject, isMeetingProject: false })
                    }
                    className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <span className="text-sm font-roboto">
                    🏢 Internal Project
                  </span>
                  <span className="text-xs text-gray-500">(Database only)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="projectType"
                    checked={newProject.isMeetingProject}
                    onChange={() =>
                      setNewProject({ ...newProject, isMeetingProject: true })
                    }
                    className="w-4 h-4 text-brand-primary border-gray-300 focus:ring-brand-primary-muted"
                  />
                  <span className="text-sm font-roboto">
                    📊 Meeting Project
                  </span>
                  <span className="text-xs text-gray-500">
                    (Syncs with Google Sheets)
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority" className="font-roboto">
                  Priority
                </Label>
                <Select
                  value={newProject.priority}
                  onValueChange={(value) =>
                    setNewProject({ ...newProject, priority: value })
                  }
                >
                  <SelectTrigger className="font-roboto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="font-roboto">
                  Category
                </Label>
                <Select
                  value={newProject.category}
                  onValueChange={(value) =>
                    setNewProject({ ...newProject, category: value })
                  }
                >
                  <SelectTrigger className="font-roboto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="community">Community</SelectItem>
                    <SelectItem value="fundraising">Fundraising</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <ProjectAssigneeSelector
                  label="Project Owner"
                  value={newProject.assigneeName || ''}
                  onChange={(assigneeName) => {
                    setNewProject({
                      ...newProject,
                      assigneeName,
                    });
                  }}
                  placeholder="Select or enter project owner"
                  multiple={false}
                />
              </div>
              <div className="space-y-2">
                <ProjectAssigneeSelector
                  label="Support People"
                  value={newProject.supportPeople || ''}
                  onChange={(supportPeople) => {
                    setNewProject({
                      ...newProject,
                      supportPeople,
                    });
                  }}
                  placeholder="Select or enter support people"
                  multiple={true}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate" className="font-roboto">
                Due Date
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={newProject.dueDate || ''}
                onChange={(e) =>
                  setNewProject({ ...newProject, dueDate: e.target.value })
                }
                className="font-roboto"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                className="font-roboto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-brand-orange hover:bg-brand-orange-dark text-white font-roboto"
                disabled={createProjectMutation.isPending}
              >
                {createProjectMutation.isPending
                  ? 'Creating...'
                  : 'Create Project'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog - Comprehensive Form */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-brand-primary font-roboto">
              Edit Project
            </DialogTitle>
            <p className="text-sm text-gray-600 font-roboto">
              Update project details and assignments
            </p>
          </DialogHeader>

          {editingProject && (
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleUpdateProject} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Label htmlFor="edit-project-title" className="font-roboto">
                      Title
                    </Label>
                    <Input
                      id="edit-project-title"
                      value={editingProject.title}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          title: e.target.value,
                        })
                      }
                      className="font-roboto"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label
                      htmlFor="edit-project-description"
                      className="font-roboto"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="edit-project-description"
                      value={editingProject.description || ''}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          description: e.target.value,
                        })
                      }
                      className="font-roboto"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-status"
                      className="font-roboto"
                    >
                      Status
                    </Label>
                    <Select
                      value={editingProject.status}
                      onValueChange={(value) =>
                        setEditingProject({ ...editingProject, status: value })
                      }
                    >
                      <SelectTrigger className="font-roboto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tabled">Tabled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="waiting">Waiting</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-priority"
                      className="font-roboto"
                    >
                      Priority
                    </Label>
                    <Select
                      value={editingProject.priority}
                      onValueChange={(value) =>
                        setEditingProject({
                          ...editingProject,
                          priority: value,
                        })
                      }
                    >
                      <SelectTrigger className="font-roboto">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-category"
                      className="font-roboto"
                    >
                      Category
                    </Label>
                    <Select
                      value={editingProject.category || 'technology'}
                      onValueChange={(value) =>
                        setEditingProject({
                          ...editingProject,
                          category: value,
                        })
                      }
                    >
                      <SelectTrigger className="font-roboto">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">💻 Tech</SelectItem>
                        <SelectItem value="events">📅 Events</SelectItem>
                        <SelectItem value="grants">💰 Grants</SelectItem>
                        <SelectItem value="outreach">🤝 Outreach</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-1">
                    <ProjectAssigneeSelector
                      value={editingProject.assigneeName || ''}
                      onChange={(value) =>
                        setEditingProject({
                          ...editingProject,
                          assigneeName: value,
                        })
                      }
                      label="Project Owner"
                      placeholder="Select or enter project owner"
                      className="font-roboto"
                      multiple={false}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <ProjectAssigneeSelector
                      value={editingProject.supportPeople || ''}
                      onChange={(value) =>
                        setEditingProject({
                          ...editingProject,
                          supportPeople: value,
                        })
                      }
                      label="Support People"
                      placeholder="Select or enter support people"
                      className="font-roboto"
                      multiple={true}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-due-date"
                      className="font-roboto"
                    >
                      Due Date
                    </Label>
                    <Input
                      id="edit-project-due-date"
                      type="date"
                      value={
                        editingProject.dueDate
                          ? editingProject.dueDate.split('T')[0]
                          : ''
                      }
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          dueDate: e.target.value,
                        })
                      }
                      className="font-roboto"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-budget"
                      className="font-roboto"
                    >
                      Budget
                    </Label>
                    <Input
                      id="edit-project-budget"
                      type="text"
                      value={editingProject.budget || ''}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          budget: e.target.value,
                        })
                      }
                      className="font-roboto"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="edit-project-estimated-hours"
                      className="font-roboto"
                    >
                      Estimated Hours
                    </Label>
                    <Input
                      id="edit-project-estimated-hours"
                      type="number"
                      value={editingProject.estimatedHours || ''}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          estimatedHours: Number(e.target.value),
                        })
                      }
                      className="font-roboto"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                    className="font-roboto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-brand-orange hover:bg-brand-orange-dark text-white font-roboto"
                    disabled={updateProjectMutation.isPending}
                  >
                    {updateProjectMutation.isPending
                      ? 'Updating...'
                      : 'Update Project'}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="projects"
        title="Projects Assistant"
        subtitle="Ask about projects and tasks"
        contextData={{
          currentView: activeTab,
          filters: {
            activeTab,
            projectTypeFilter,
          },
          summaryStats: {
            totalProjects: allProjects.length,
            activeProjects: allProjects.filter(p => p.status !== 'completed' && p.status !== 'archived').length,
            inProgress: allProjects.filter(p => p.status === 'in-progress').length,
            waiting: allProjects.filter(p => p.status === 'waiting').length,
            completed: allProjects.filter(p => p.status === 'completed').length,
            highPriority: allProjects.filter(p => p.priority === 'high' || p.priority === 'critical').length,
          },
        }}
        getFullContext={() => ({
          rawData: allProjects.map(p => ({
            id: p.id,
            title: p.title,
            status: p.status,
            priority: p.priority,
            category: p.category,
            description: p.description,
            dueDate: p.dueDate,
            assigneeId: p.assigneeId,
            projectType: p.projectType,
          })),
          selectedItem: editingProject ? {
            title: editingProject.title,
            status: editingProject.status,
            priority: editingProject.priority,
            category: editingProject.category,
            description: editingProject.description,
            dueDate: editingProject.dueDate,
          } : undefined,
        })}
        suggestedQuestions={[
          "What projects are in progress?",
          "How many projects are high priority?",
          "Show me overdue projects",
          "What projects are waiting?",
          "What projects need attention?",
          "Show projects by status",
        ]}
      />
    </div>
  );
}
