import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project, InsertProject, ProjectTask } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

const TABLED_STATUSES: Array<Project['status']> = ['tabled', 'waiting'];

type ActiveTabType = 'tabled' | 'in_progress' | 'completed' | 'archived' | 'standalone_tasks';

interface ProjectContextValue {
  // Projects data
  projects: Project[];
  archivedProjects: Project[];
  standaloneTasks: ProjectTask[];
  isLoading: boolean;

  // Filter states
  activeTab: ActiveTabType;
  setActiveTab: (tab: ActiveTabType) => void;
  projectTypeFilter: 'all' | 'meeting' | 'internal';
  setProjectTypeFilter: (filter: 'all' | 'meeting' | 'internal') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Dialog states
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
  showEditDialog: boolean;
  setShowEditDialog: (show: boolean) => void;

  // Selected/Editing project
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  editingProject: Project | null;
  setEditingProject: (project: Project | null) => void;

  // New project form state
  newProject: Partial<InsertProject>;
  setNewProject: (project: Partial<InsertProject>) => void;
  resetNewProject: () => void;

  // Filtered projects getter
  getFilteredProjects: () => Project[];
  getProjectsByStatus: (status: string) => Project[];

  // Stats
  projectStats: {
    tabledAndWaiting: number;
    inProgress: number;
    completed: number;
    archived: number;
    meeting: number;
    internal: number;
    standaloneTasks: number;
  };

  // Standalone task helpers
  getFilteredStandaloneTasks: () => ProjectTask[];
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
};

interface ProjectProviderProps {
  children: ReactNode;
}

const initialNewProject: Partial<InsertProject> = {
  title: '',
  description: '',
  status: 'tabled',
  priority: 'medium',
  category: 'technology',
  assigneeName: '',
  assigneeIds: [],
  supportPeople: '',
  supportPeopleIds: [],
  dueDate: '',
  startDate: '',
  estimatedHours: 0,
  actualHours: 0,
  budget: '',
  isMeetingProject: false,
  reviewInNextMeeting: false,
};

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  // Core state
  const [activeTab, setActiveTab] = useState<ActiveTabType>('in_progress');
  const [projectTypeFilter, setProjectTypeFilter] = useState<'all' | 'meeting' | 'internal'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [newProject, setNewProject] = useState<Partial<InsertProject>>(initialNewProject);

  // Fetch active projects
  const { data: activeProjects = [], isLoading: activeLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    staleTime: 3 * 60 * 1000, // 3 minutes - projects need reasonable freshness for collaborative updates
    refetchOnWindowFocus: true, // Refetch when user returns to see updates from other team members
  });

  // Fetch archived projects
  const { data: archivedProjects = [], isLoading: archiveLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects/archived'],
  });

  // Fetch standalone tasks (tasks not tied to any project)
  const { data: standaloneTasks = [], isLoading: standaloneLoading } = useQuery<ProjectTask[]>({
    queryKey: ['/api/projects/standalone-tasks'],
    staleTime: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const isLoading = activeLoading || archiveLoading || standaloneLoading;

  // Combine projects based on active tab
  const projects = activeTab === 'archived' ? archivedProjects : activeProjects;

  // Filter projects by status
  const getProjectsByStatus = (status: string): Project[] => {
    let filtered = projects;

    // Apply status filter
    if (status === 'active') {
      // Show all non-archived projects
      filtered = activeProjects;
    } else if (status === 'archived') {
      filtered = archivedProjects;
    } else if (status === 'tabled') {
      filtered = activeProjects.filter((p) => TABLED_STATUSES.includes(p.status));
    } else {
      filtered = activeProjects.filter((p) => p.status === status);
    }

    // Apply type filter
    if (projectTypeFilter === 'meeting') {
      filtered = filtered.filter(p => p.googleSheetRowId);
    } else if (projectTypeFilter === 'internal') {
      filtered = filtered.filter(p => !p.googleSheetRowId);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.assigneeName?.toLowerCase().includes(query) ||
        p.category?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // Get filtered projects based on current filters
  const getFilteredProjects = (): Project[] => {
    if (activeTab === 'archived') {
      return getProjectsByStatus('archived');
    }
    if (activeTab === 'standalone_tasks') {
      return []; // Return empty for projects when viewing standalone tasks
    }
    return getProjectsByStatus(activeTab);
  };

  // Get filtered standalone tasks
  const getFilteredStandaloneTasks = (): ProjectTask[] => {
    let filtered = standaloneTasks;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.assigneeName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // Calculate stats
  const projectStats = {
    tabledAndWaiting: activeProjects.filter((p) => TABLED_STATUSES.includes(p.status)).length,
    inProgress: activeProjects.filter((p) => p.status === 'in_progress').length,
    completed: activeProjects.filter((p) => p.status === 'completed').length,
    archived: archivedProjects.length,
    meeting: activeProjects.filter((p) => p.googleSheetRowId).length,
    internal: activeProjects.filter((p) => !p.googleSheetRowId).length,
    standaloneTasks: standaloneTasks.filter((t) => t.status !== 'completed').length,
  };

  // Reset new project form
  const resetNewProject = () => {
    setNewProject(initialNewProject);
  };

  useEffect(() => {
    const handleOpenCreate = () => {
      resetNewProject();
      setShowCreateDialog(true);
    };

    window.addEventListener('openProjectCreateDialog', handleOpenCreate);
    return () => {
      window.removeEventListener('openProjectCreateDialog', handleOpenCreate);
    };
  }, [resetNewProject, setShowCreateDialog]);

  const value: ProjectContextValue = {
    // Data
    projects,
    archivedProjects,
    standaloneTasks,
    isLoading,

    // Filters
    activeTab,
    setActiveTab,
    projectTypeFilter,
    setProjectTypeFilter,
    searchQuery,
    setSearchQuery,

    // Dialogs
    showCreateDialog,
    setShowCreateDialog,
    showEditDialog,
    setShowEditDialog,

    // Selected/Editing
    selectedProject,
    setSelectedProject,
    editingProject,
    setEditingProject,

    // Form
    newProject,
    setNewProject,
    resetNewProject,

    // Helpers
    getFilteredProjects,
    getProjectsByStatus,
    getFilteredStandaloneTasks,

    // Stats
    projectStats,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};