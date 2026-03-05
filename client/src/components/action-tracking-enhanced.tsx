import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Building,
  FileText,
  Mail,
  Phone,
  Car,
  Mic,
  UserCheck,
  Bell,
  Filter,
  X,
} from 'lucide-react';
import { format, isValid, subDays, subMonths } from 'date-fns';
import { logger } from '@/lib/logger';

interface Project {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  assigneeIds: string[];
  supportPeopleIds: string[];
  dueDate?: string;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTask {
  id: number;
  projectId: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeIds: string[];
  dueDate?: string;
  createdAt: string;
  project?: {
    title: string;
    category: string;
  };
}

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  organizationName: string;
  status: string;
  assignedTo?: string;
  desiredEventDate?: string;
  createdAt: string;
  communicationMethod?: string;
  contactedAt?: string;
  assignmentType?: string[];
  followUpNeeded?: boolean;
  followUpReason?: string;
  driverDetails?: string;
  speakerDetails?: string;
  tspContact?: string;
  tspContactAssigned?: string;
  additionalTspContacts?: string;
  customTspContact?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  eventStartTime?: string;
  eventEndTime?: string;
  pickupTime?: string;
  sandwichTypes?: string;
}

const ActionTracking = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('projects');
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Filter states for each tab
  const [projectPriority, setProjectPriority] = useState<string>('all');
  const [projectStatus, setProjectStatus] = useState<string>('all');
  const [projectCategory, setProjectCategory] = useState<string>('all');
  
  const [taskPriority, setTaskPriority] = useState<string>('all');
  const [taskStatus, setTaskStatus] = useState<string>('all');
  
  const [eventAssignmentType, setEventAssignmentType] = useState<string>('all');
  const [eventFollowUpOnly, setEventFollowUpOnly] = useState<boolean>(false);
  const [eventStatus, setEventStatus] = useState<string>('all');
  
  const [completedEventAssignmentType, setCompletedEventAssignmentType] = useState<string>('all');
  const [completedEventDateRange, setCompletedEventDateRange] = useState<string>('all');

  // Navigation functions
  const navigateToProject = (projectId: number) => {
    setLocation(`/dashboard?section=projects&view=detail&id=${projectId}`);
  };

  const navigateToEventPlanning = (eventId?: number) => {
    if (eventId) {
      // Find the event to determine which tab to navigate to
      const event = events.find((e) => e.id === eventId);
      let tab = 'new'; // default

      if (event) {
        if (event.status === 'completed') {
          tab = 'completed';
        } else if (event.status === 'scheduled') {
          tab = 'scheduled';
        } else if (event.status === 'in_process') {
          tab = 'in_process';
        } else if (event.status === 'declined') {
          tab = 'declined';
        } else {
          tab = 'new'; // new, contact_completed, etc.
        }
      }

      setLocation(
        `/dashboard?section=event-requests&tab=${tab}&eventId=${eventId}`
      );
    } else {
      setLocation(`/dashboard?section=event-requests`);
    }
  };

  // Fetch dashboard data (same source as dashboard widget)
  const { data: dashboardData, refetch: refetchDashboard } = useQuery<{
    projects: any[];
    tasks: any[];
    events: any[];
    messages: any[];
    counts: {
      projects: number;
      tasks: number;
      events: number;
      messages: number;
    };
  }>({
    queryKey: ['/api/me/dashboard'],
  });

  // Extract data from dashboard response
  const projects = dashboardData?.projects || [];
  const tasks = dashboardData?.tasks || [];
  const events = dashboardData?.events || [];
  
  // For compatibility with existing code, create refetchEvents that refetches dashboard
  const refetchEvents = refetchDashboard;

  // Mutation for marking follow-ups as complete
  const followUpMutation = useMutation({
    mutationFn: async ({
      eventId,
      followUpType,
      notes,
    }: {
      eventId: number;
      followUpType: 'one_day' | 'one_month';
      notes?: string;
    }) => {
      return apiRequest(`/api/event-requests/${eventId}/follow-up`, 'PATCH', {
        followUpType,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/me/dashboard'],
      });
      toast({
        title: 'Follow-up marked complete',
        description: 'The follow-up has been successfully marked as completed.',
      });
      refetchEvents();
    },
    onError: (error) => {
      logger.error('Error marking follow-up complete:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark follow-up as complete. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleFollowUpComplete = async (
    eventId: number,
    followUpType: 'one_day' | 'one_month'
  ) => {
    followUpMutation.mutate({ eventId, followUpType });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-brand-primary-light text-brand-primary-dark';
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'tabled':
        return 'bg-purple-100 text-purple-800';
      case 'contact_completed':
        return 'bg-teal-100 text-teal-800';
      case 'scheduled':
        return 'bg-indigo-100 text-indigo-800';
      case 'new':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy') : '';
    } catch {
      return '';
    }
  };

  // Get unique values for filter dropdowns
  const uniqueProjectCategories = useMemo(() => {
    const categories = new Set(projects.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }, [projects]);

  const uniqueProjectStatuses = useMemo(() => {
    const statuses = new Set(projects.map(p => p.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [projects]);

  const uniqueTaskStatuses = useMemo(() => {
    const statuses = new Set(tasks.map(t => t.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [tasks]);

  const uniqueEventStatuses = useMemo(() => {
    const activeEventsData = events.filter(e => e.status !== 'completed');
    const statuses = new Set(activeEventsData.map(e => e.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [events]);

  // Clear all filters
  const clearAllFilters = () => {
    setProjectPriority('all');
    setProjectStatus('all');
    setProjectCategory('all');
    setTaskPriority('all');
    setTaskStatus('all');
    setEventAssignmentType('all');
    setEventFollowUpOnly(false);
    setEventStatus('all');
    setCompletedEventAssignmentType('all');
    setCompletedEventDateRange('all');
  };

  // Count active filters per tab
  const activeProjectFilters = [projectPriority, projectStatus, projectCategory].filter(f => f !== 'all').length;
  const activeTaskFilters = [taskPriority, taskStatus].filter(f => f !== 'all').length;
  const activeEventFilters = [eventAssignmentType, eventStatus].filter(f => f !== 'all').length + (eventFollowUpOnly ? 1 : 0);
  const activeCompletedEventFilters = [completedEventAssignmentType, completedEventDateRange].filter(f => f !== 'all').length;

  // Apply search and filters to projects
  const filteredProjects = projects.filter((project) => {
    // Search filter
    const matchesSearch =
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Priority filter
    const matchesPriority = projectPriority === 'all' || project.priority === projectPriority;
    
    // Status filter
    const matchesStatus = projectStatus === 'all' || project.status === projectStatus;
    
    // Category filter
    const matchesCategory = projectCategory === 'all' || project.category === projectCategory;
    
    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  });

  // Apply search and filters to tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.project?.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Priority filter
    const matchesPriority = taskPriority === 'all' || task.priority === taskPriority;
    
    // Status filter
    const matchesStatus = taskStatus === 'all' || task.status === taskStatus;
    
    return matchesSearch && matchesPriority && matchesStatus;
  });

  // Apply search and filters to events
  const filteredEvents = events.filter((event) => {
    // Search filter
    const matchesSearch =
      (event.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (event.organizationName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Separate and filter active events
  const activeEvents = filteredEvents.filter((event) => {
    if (event.status === 'completed') return false;
    
    // Assignment Type filter
    const matchesAssignmentType =
      eventAssignmentType === 'all' ||
      (event.assignmentType && event.assignmentType.includes(eventAssignmentType));
    
    // Follow-up Only filter
    const matchesFollowUp = !eventFollowUpOnly || event.followUpNeeded;
    
    // Status filter
    const matchesStatus = eventStatus === 'all' || event.status === eventStatus;
    
    return matchesAssignmentType && matchesFollowUp && matchesStatus;
  });

  // Filter completed events
  const completedEvents = filteredEvents.filter((event) => {
    if (event.status !== 'completed') return false;
    
    // Assignment Type filter
    const matchesAssignmentType =
      completedEventAssignmentType === 'all' ||
      (event.assignmentType && event.assignmentType.includes(completedEventAssignmentType));
    
    // Date Range filter
    let matchesDateRange = true;
    if (completedEventDateRange !== 'all' && event.desiredEventDate) {
      const eventDate = new Date(event.desiredEventDate);
      const now = new Date();
      
      if (completedEventDateRange === '30days') {
        matchesDateRange = eventDate >= subDays(now, 30);
      } else if (completedEventDateRange === '3months') {
        matchesDateRange = eventDate >= subMonths(now, 3);
      }
    }
    
    return matchesAssignmentType && matchesDateRange;
  });

  // Priority order for active events (follow-ups first)
  const sortedActiveEvents = [...activeEvents].sort((a, b) => {
    // Follow-ups first
    if (a.followUpNeeded && !b.followUpNeeded) return -1;
    if (!a.followUpNeeded && b.followUpNeeded) return 1;

    // Then by event date
    if (a.desiredEventDate && b.desiredEventDate) {
      return (
        new Date(a.desiredEventDate).getTime() -
        new Date(b.desiredEventDate).getTime()
      );
    }

    return 0;
  });

  // Sort completed events by event date (most recent first)
  const sortedCompletedEvents = [...completedEvents].sort((a, b) => {
    if (a.desiredEventDate && b.desiredEventDate) {
      return (
        new Date(b.desiredEventDate).getTime() -
        new Date(a.desiredEventDate).getTime()
      );
    }
    return 0;
  });

  return (
    <div className="w-full max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Action Board</h2>
        <p className="text-gray-600">
          Track your assigned projects, tasks, and event responsibilities
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search projects, tasks, and events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-actions"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6 bg-gray-50 border-gray-200" data-testid="action-filters">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Filters</span>
              {(activeProjectFilters > 0 || activeTaskFilters > 0 || activeEventFilters > 0 || activeCompletedEventFilters > 0) && (
                <Badge variant="outline" className="bg-brand-primary-light text-brand-primary-dark">
                  {activeTab === 'projects' && activeProjectFilters > 0 && `${activeProjectFilters} active`}
                  {activeTab === 'tasks' && activeTaskFilters > 0 && `${activeTaskFilters} active`}
                  {activeTab === 'events' && activeEventFilters > 0 && `${activeEventFilters} active`}
                  {activeTab === 'completed-events' && activeCompletedEventFilters > 0 && `${activeCompletedEventFilters} active`}
                </Badge>
              )}
            </div>
            {(activeProjectFilters > 0 || activeTaskFilters > 0 || activeEventFilters > 0 || activeCompletedEventFilters > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-gray-600 hover:text-gray-900"
                data-testid="button-clear-filters"
              >
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>

          {/* Projects Filters */}
          {activeTab === 'projects' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="project-priority" className="text-xs text-gray-600 mb-1">Priority</Label>
                <Select value={projectPriority} onValueChange={setProjectPriority}>
                  <SelectTrigger id="project-priority" data-testid="select-project-priority">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="project-status" className="text-xs text-gray-600 mb-1">Status</Label>
                <Select value={projectStatus} onValueChange={setProjectStatus}>
                  <SelectTrigger id="project-status" data-testid="select-project-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueProjectStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="project-category" className="text-xs text-gray-600 mb-1">Category</Label>
                <Select value={projectCategory} onValueChange={setProjectCategory}>
                  <SelectTrigger id="project-category" data-testid="select-project-category">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueProjectCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Tasks Filters */}
          {activeTab === 'tasks' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-priority" className="text-xs text-gray-600 mb-1">Priority</Label>
                <Select value={taskPriority} onValueChange={setTaskPriority}>
                  <SelectTrigger id="task-priority" data-testid="select-task-priority">
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-status" className="text-xs text-gray-600 mb-1">Status</Label>
                <Select value={taskStatus} onValueChange={setTaskStatus}>
                  <SelectTrigger id="task-status" data-testid="select-task-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueTaskStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Active Events Filters */}
          {activeTab === 'events' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="event-assignment" className="text-xs text-gray-600 mb-1">Assignment Type</Label>
                <Select value={eventAssignmentType} onValueChange={setEventAssignmentType}>
                  <SelectTrigger id="event-assignment" data-testid="select-event-assignment">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Driver">Driver</SelectItem>
                    <SelectItem value="Speaker">Speaker</SelectItem>
                    <SelectItem value="TSP Contact">TSP Contact</SelectItem>
                    <SelectItem value="Direct Assignment">Direct Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="event-status" className="text-xs text-gray-600 mb-1">Status</Label>
                <Select value={eventStatus} onValueChange={setEventStatus}>
                  <SelectTrigger id="event-status" data-testid="select-event-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {uniqueEventStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    id="follow-up-only"
                    checked={eventFollowUpOnly}
                    onCheckedChange={setEventFollowUpOnly}
                    data-testid="switch-follow-up-only"
                  />
                  <Label htmlFor="follow-up-only" className="text-sm cursor-pointer">
                    Follow-ups Only
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Completed Events Filters */}
          {activeTab === 'completed-events' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="completed-assignment" className="text-xs text-gray-600 mb-1">Assignment Type</Label>
                <Select value={completedEventAssignmentType} onValueChange={setCompletedEventAssignmentType}>
                  <SelectTrigger id="completed-assignment" data-testid="select-completed-assignment">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Driver">Driver</SelectItem>
                    <SelectItem value="Speaker">Speaker</SelectItem>
                    <SelectItem value="TSP Contact">TSP Contact</SelectItem>
                    <SelectItem value="Direct Assignment">Direct Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="completed-date-range" className="text-xs text-gray-600 mb-1">Date Range</Label>
                <Select value={completedEventDateRange} onValueChange={setCompletedEventDateRange}>
                  <SelectTrigger id="completed-date-range" data-testid="select-completed-date-range">
                    <SelectValue placeholder="All Time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="30days">Last 30 Days</SelectItem>
                    <SelectItem value="3months">Last 3 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="projects" className="flex items-center gap-1 text-xs sm:text-sm">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">Projects ({filteredProjects.length})</span>
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1 text-xs sm:text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Tasks ({filteredTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="events"
            className="flex items-center gap-1 text-xs sm:text-sm relative"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">Active Events ({sortedActiveEvents.length})</span>
            {sortedActiveEvents.some((e) => e.followUpNeeded) && (
              <Bell className="w-3 h-3 text-yellow-600 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="completed-events"
            className="flex items-center gap-1 text-xs sm:text-sm"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Completed Events ({sortedCompletedEvents.length})</span>
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="projects" className="space-y-4 m-0">
            {filteredProjects.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-gray-500">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">
                      No assigned projects found
                    </p>
                    <p className="text-sm">
                      Projects assigned to you will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="action-list">
                {filteredProjects.map((project) => (
                  <Card
                    key={project.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigateToProject(project.id)}
                    data-testid="task-card"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-gray-900">
                            {project.title}
                          </CardTitle>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {project.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className={getPriorityColor(project.priority)}>
                            {project.priority}
                          </Badge>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            <span>{project.category}</span>
                          </div>
                          {project.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due {formatDate(project.dueDate)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Created {formatDate(project.createdAt)}</span>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-700">
                          {project.progressPercentage}% complete
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 m-0">
            {filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-gray-500">
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">
                      No assigned tasks found
                    </p>
                    <p className="text-sm">
                      Tasks assigned to you will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="task-list">
                {filteredTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigateToProject(task.projectId)}
                    data-testid="task-card"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-gray-900">
                            {task.title}
                          </CardTitle>
                          {task.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          {task.project && (
                            <p className="text-xs text-teal-600 mt-2 font-medium">
                              Project: {task.project.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {task.project && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              <span>{task.project.category}</span>
                            </div>
                          )}
                          {task.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>Due {formatDate(task.dueDate)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Created {formatDate(task.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="space-y-4 m-0">
            {sortedActiveEvents.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-gray-500">
                  <div className="text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">
                      No active event requests found
                    </p>
                    <p className="text-sm">
                      Active events where you are assigned as contact, driver,
                      or speaker will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="action-list">
                {sortedActiveEvents.map((event) => (
                  <Card
                    key={event.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${
                      event.followUpNeeded ? 'ring-2 ring-yellow-200' : ''
                    }`}
                    onClick={() => navigateToEventPlanning(event.id)}
                    data-testid="action-item"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-gray-900">
                            {event.firstName} {event.lastName}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            <Building className="w-4 h-4 inline mr-1" />
                            {event.organizationName}
                          </p>
                          {event.assignmentType &&
                            event.assignmentType.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {event.assignmentType.map((type, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs bg-teal-50 text-teal-700 border-teal-200"
                                  >
                                    {type === 'TSP Contact' && (
                                      <UserCheck className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Driver' && (
                                      <Car className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Speaker' && (
                                      <Mic className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Direct Assignment' && (
                                      <User className="w-3 h-3 mr-1" />
                                    )}
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className={getStatusColor(event.status)}>
                            {event.status.replace('_', ' ')}
                          </Badge>
                          {event.contactedAt && (
                            <Badge className="bg-green-100 text-green-800">
                              Contacted
                            </Badge>
                          )}
                          {event.followUpNeeded && (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              <Bell className="w-3 h-3 mr-1" />
                              Follow-up Due
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {event.desiredEventDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Event {formatDate(event.desiredEventDate)}
                              </span>
                            </div>
                          )}
                          {event.communicationMethod && (
                            <div className="flex items-center gap-1">
                              {event.communicationMethod.includes('email') ? (
                                <Mail className="w-4 h-4" />
                              ) : (
                                <Phone className="w-4 h-4" />
                              )}
                              <span>{event.communicationMethod}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Created {formatDate(event.createdAt)}</span>
                          </div>
                        </div>
                        {event.followUpNeeded && (
                          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800">
                                  {event.followUpReason}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                className="bg-yellow-600 hover:bg-yellow-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFollowUpComplete(
                                    event.id,
                                    event.followUpReason?.includes('1-day')
                                      ? 'one_day'
                                      : 'one_month'
                                  );
                                }}
                                disabled={followUpMutation.isPending}
                              >
                                {followUpMutation.isPending
                                  ? 'Marking...'
                                  : 'Mark Complete'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed-events" className="space-y-4 m-0">
            {sortedCompletedEvents.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-gray-500">
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">
                      No completed events found
                    </p>
                    <p className="text-sm">
                      Completed events where you were assigned as contact,
                      driver, or speaker will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4" data-testid="action-list">
                {sortedCompletedEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="hover:shadow-md transition-shadow cursor-pointer opacity-75"
                    onClick={() => navigateToEventPlanning(event.id)}
                    data-testid="action-item"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-semibold text-gray-700">
                            {event.firstName} {event.lastName}
                          </CardTitle>
                          <p className="text-sm text-gray-500 mt-1">
                            <Building className="w-4 h-4 inline mr-1" />
                            {event.organizationName}
                          </p>
                          {event.assignmentType &&
                            event.assignmentType.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {event.assignmentType.map((type, index) => (
                                  <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs bg-gray-50 text-gray-600 border-gray-200"
                                  >
                                    {type === 'TSP Contact' && (
                                      <UserCheck className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Driver' && (
                                      <Car className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Speaker' && (
                                      <Mic className="w-3 h-3 mr-1" />
                                    )}
                                    {type === 'Direct Assignment' && (
                                      <User className="w-3 h-3 mr-1" />
                                    )}
                                    {type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className="bg-green-100 text-green-800">
                            Completed
                          </Badge>
                          {event.contactedAt && (
                            <Badge className="bg-gray-100 text-gray-600">
                              Contacted
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {event.desiredEventDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              <span>
                                Event {formatDate(event.desiredEventDate)}
                              </span>
                            </div>
                          )}
                          {event.communicationMethod && (
                            <div className="flex items-center gap-1">
                              {event.communicationMethod.includes('email') ? (
                                <Mail className="w-4 h-4" />
                              ) : (
                                <Phone className="w-4 h-4" />
                              )}
                              <span>{event.communicationMethod}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Created {formatDate(event.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ActionTracking;
