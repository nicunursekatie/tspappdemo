import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { PERMISSIONS } from '@shared/auth-utils';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import {
  EventRequestProvider,
  useEventRequestContext,
} from './context/EventRequestContext';
import { NewRequestsTab } from './tabs/NewRequestsTab';
import { InProcessTab } from './tabs/InProcessTab';
import { ScheduledTab } from './tabs/ScheduledTab';
import { CompletedTab } from './tabs/CompletedTab';
import { DeclinedTab } from './tabs/DeclinedTab';
import { PostponedTab } from './tabs/PostponedTab';
import { StandbyTab } from './tabs/StandbyTab';
import { StalledTab } from './tabs/StalledTab';
import { NonEventTab } from './tabs/NonEventTab';
import { RescheduledTab } from './tabs/RescheduledTab';
import { MyAssignmentsTab } from './tabs/MyAssignmentsTab';
import { AllEventsTab } from './tabs/AllEventsTab';
import { AdminOverviewTab } from './tabs/AdminOverviewTab';
import { PlanningTab } from './tabs/PlanningTab';
import { VolunteerOpportunitiesTab } from './tabs/VolunteerOpportunitiesTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Package, HelpCircle, Calendar, List, Sheet, X, Sparkles, RefreshCw, ArrowUp, Car, Truck, MapPin, Shield } from 'lucide-react';
import { FloatingAIChat } from '@/components/floating-ai-chat';
import { EventCalendarView } from '@/components/event-calendar-view';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from '@/components/ui/tooltip';

// Import existing components that we'll reuse
import RequestFilters from '@/components/event-requests/RequestFilters';
import EventSchedulingForm from '@/components/event-requests/EventSchedulingForm';
import EventCollectionLog from '@/components/event-requests/EventCollectionLog';
import ToolkitSentDialog from '@/components/event-requests/ToolkitSentDialog';
import FollowUpDialog from '@/components/event-requests/FollowUpDialog';
import { ScheduleCallDialog } from '@/components/event-requests/ScheduleCallDialog';
import ContactOrganizerDialog from '@/components/ContactOrganizerDialog';
import LogContactAttemptDialog from '@/components/LogContactAttemptDialog';
import EditContactAttemptDialog from '@/components/EditContactAttemptDialog';
import SandwichForecastWidget from '@/components/sandwich-forecast-widget';
import StaffingForecastWidget from '@/components/staffing-forecast-widget';

// Import hooks
import { useEventMutations } from './hooks/useEventMutations';
import { useEventQueries } from './hooks/useEventQueries';
import { useEventAssignments } from './hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useEventRequestSocket } from '@/hooks/useEventRequestSocket';

// Import dialogs
import { TspContactAssignmentDialog } from './dialogs/TspContactAssignmentDialog';
import { AssignmentDialog } from './dialogs/AssignmentDialog';
import { EventDetailsDialog } from './dialogs/EventDetailsDialog';
import { MissingInfoSummaryDialog } from './MissingInfoSummaryDialog';
import { ToolkitSentPendingDialog } from './ToolkitSentPendingDialog';
import { AiDateSuggestionDialog } from './dialogs/AiDateSuggestionDialog';
import { AiIntakeAssistantDialog } from './dialogs/AiIntakeAssistantDialog';
import { PostponementDialog } from './dialogs/PostponementDialog';
import { StatusReasonDialog } from './dialogs/StatusReasonDialog';
import { NonEventDialog } from './dialogs/NonEventDialog';
import { RescheduleDialog } from './dialogs/RescheduleDialog';
import IntakeCallDialog from './IntakeCallDialog';
import NextActionDialog from './NextActionDialog';
import { DashboardSummaryCards } from './DashboardSummaryCards';
import { StatusDefinitionsPanel } from './StatusDefinitionsPanel';
import { logger } from '@/lib/logger';
import { apiRequest, queryClient, invalidateEventRequestQueries } from '@/lib/queryClient';
import { getRoleViewDescription } from '@shared/role-view-defaults';
import { Info } from 'lucide-react';

// Main component that uses the context
const EventRequestsManagementContent: React.FC = () => {
  const { track } = useOnboardingTracker();

  // Enable real-time updates for event requests (e.g., from Google Sheets imports)
  useEventRequestSocket();

  // Track onboarding challenge on component mount
  useEffect(() => {
    track('view_event_requests');
  }, []);

  // Listen for focus-event-search event from command palette (Cmd+/)
  useEffect(() => {
    const handleFocusSearch = () => {
      const searchInput = document.getElementById('event-requests-search');
      if (searchInput) {
        searchInput.focus();
        // Scroll to top to make search visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('focus-event-search', handleFocusSearch);
    return () => window.removeEventListener('focus-event-search', handleFocusSearch);
  }, []);

  const {
    eventRequests,
    isLoading,
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    confirmationFilter,
    setConfirmationFilter,
    sortBy,
    setSortBy,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    statusCounts,
    statusCountsLoading,
    quickFilter,
    setQuickFilter,

    // Dialog states
    showEventDetails,
    setShowEventDetails,
    showEventDetailsPreview,
    setShowEventDetailsPreview,
    showSchedulingDialog,
    setShowSchedulingDialog,
    showToolkitSentDialog,
    setShowToolkitSentDialog,
    showScheduleCallDialog,
    setShowScheduleCallDialog,
    showOneDayFollowUpDialog,
    setShowOneDayFollowUpDialog,
    showOneMonthFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    showContactOrganizerDialog,
    setShowContactOrganizerDialog,
    showCollectionLog,
    setShowCollectionLog,
    showTspContactAssignmentDialog,
    setShowTspContactAssignmentDialog,
    showAssignmentDialog,
    setShowAssignmentDialog,
    showSandwichPlanningModal,
    setShowSandwichPlanningModal,
    showStaffingPlanningModal,
    setShowStaffingPlanningModal,
    showLogContactDialog,
    setShowLogContactDialog,
    showEditContactDialog,
    setShowEditContactDialog,
    showAiDateSuggestionDialog,
    setShowAiDateSuggestionDialog,
    showAiIntakeAssistantDialog,
    setShowAiIntakeAssistantDialog,
    showPostponementDialog,
    setShowPostponementDialog,
    showIntakeCallDialog,
    setShowIntakeCallDialog,
    showDeclineDialog,
    setShowDeclineDialog,
    showCancelDialog,
    setShowCancelDialog,
    showNonEventDialog,
    setShowNonEventDialog,
    showRescheduleDialog,
    setShowRescheduleDialog,
    showNextActionDialog,
    setShowNextActionDialog,
    nextActionEventRequest,
    setNextActionEventRequest,
    nextActionMode,
    setNextActionMode,

    // Assignment dialog state
    assignmentType,
    setAssignmentType,
    assignmentEventId,
    setAssignmentEventId,
    selectedAssignees,
    setSelectedAssignees,
    isVanDriverAssignment,
    setIsVanDriverAssignment,

    // Selected events
    selectedEventRequest,
    setSelectedEventRequest,
    isEditing,
    setIsEditing,
    schedulingEventRequest,
    setSchedulingEventRequest,
    toolkitEventRequest,
    setToolkitEventRequest,
    collectionLogEventRequest,
    setCollectionLogEventRequest,
    contactEventRequest,
    setContactEventRequest,
    tspContactEventRequest,
    setTspContactEventRequest,
    logContactEventRequest,
    setLogContactEventRequest,
    editContactEventRequest,
    setEditContactEventRequest,
    editContactAttemptData,
    setEditContactAttemptData,
    aiSuggestionEventRequest,
    setAiSuggestionEventRequest,
    aiIntakeAssistantEventRequest,
    setAiIntakeAssistantEventRequest,
    postponementEventRequest,
    setPostponementEventRequest,
    intakeCallEventRequest,
    setIntakeCallEventRequest,
    reasonDialogEventRequest,
    setReasonDialogEventRequest,
    nonEventDialogEventRequest,
    setNonEventDialogEventRequest,
    rescheduleDialogEventRequest,
    setRescheduleDialogEventRequest,

    // Other states
    scheduleCallDate,
    setScheduleCallDate,
    scheduleCallTime,
    setScheduleCallTime,
    followUpNotes,
    setFollowUpNotes,
  } = useEventRequestContext();

  // Fetch ALL active events (scheduled + in_process + rescheduled) for dashboard cards
  // This query is independent of the active tab, ensuring driver counts are always accurate
  const { data: allActiveEvents = [] } = useQuery({
    queryKey: ['/api/event-requests/list', 'active-events-for-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests/list?status=scheduled,in_process,rescheduled', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch active events');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const {
    markToolkitSentMutation,
    scheduleCallMutation,
    oneDayFollowUpMutation,
    assignRecipientsMutation,
    oneMonthFollowUpMutation,
    updateEventRequestMutation,
  } = useEventMutations();

  const { resolveUserName, resolveRecipientName } = useEventAssignments();

  const queryClient = useQueryClient();

  // Sync from Google Sheets mutation
  const syncFromSheetsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/event-requests/sync/from-sheets', {});
    },
    onSuccess: (result: any) => {
      toast({
        title: 'Sync Complete',
        description: result.message || `Synced: ${result.created || 0} created, ${result.updated || 0} skipped`,
      });
      // Refresh event requests
      invalidateEventRequestQueries(queryClient);
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error?.message || 'Failed to sync from Google Sheets',
        variant: 'destructive',
      });
    },
  });

  // Postpone event mutation (supports both postpone-to-status and immediate-reschedule)
  const postponeEventMutation = useMutation({
    mutationFn: async ({ eventId, data }: {
      eventId: number;
      data: {
        postponementReason: string;
        hasNewDate?: boolean;
        newScheduledDate?: string;
        tentativeNewDate?: string;
        postponementNotes?: string;
      };
    }) => {
      return apiRequest('POST', `/api/event-requests/${eventId}/postpone`, data);
    },
    onSuccess: (_, variables) => {
      const wasRescheduled = variables.data.hasNewDate && variables.data.newScheduledDate;
      toast({
        title: wasRescheduled ? 'Event rescheduled' : 'Event postponed',
        description: wasRescheduled
          ? 'The event has been rescheduled to the new date. The original date is preserved for reference.'
          : 'The event has been marked as postponed.',
      });
      invalidateEventRequestQueries(queryClient);
    },
    onError: (error: any) => {
      logger.error('Error postponing event:', error);
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to postpone event',
        variant: 'destructive',
      });
    },
  });

  const { users, drivers, hostsWithContacts } = useEventQueries();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const openManualEventRequest = useCallback(() => {
    setShowScheduleCallDialog(false);
    setShowOneDayFollowUpDialog(false);
    setShowOneMonthFollowUpDialog(false);
    setShowToolkitSentDialog(false);
    setSelectedEventRequest(null);
    setIsEditing(true);
    setShowEventDetails(true);
  }, [
    setShowScheduleCallDialog,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setShowToolkitSentDialog,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
  ]);

  useEffect(() => {
    const handleOpenCreate = () => {
      openManualEventRequest();
    };

    window.addEventListener('openEventRequestCreateDialog', handleOpenCreate);
    return () => {
      window.removeEventListener(
        'openEventRequestCreateDialog',
        handleOpenCreate
      );
    };
  }, [openManualEventRequest]);
  const { trackButtonClick, trackFormSubmit } = useAnalytics();

  // Track initial page load only once
  const hasLoggedInitialView = useRef(false);

  // Feature discovery state
  const [showAdminOverviewTip, setShowAdminOverviewTip] = React.useState(false);
  const [showSpreadsheetTip, setShowSpreadsheetTip] = React.useState(false);
  const [showFloatingTip, setShowFloatingTip] = React.useState(false);

  // Check if user has permission to sync event requests from Google Sheets
  const canSyncEvents = user?.permissions?.includes(PERMISSIONS.EVENT_REQUESTS_SYNC) ||
    user?.role === 'admin' || user?.role === 'super_admin';

  // Support both old and new permission strings for backward compatibility
  const hasAdminOverviewPermission = user?.permissions?.includes(PERMISSIONS.EVENT_REQUESTS_VIEW_ADMIN_OVERVIEW) ||
    user?.permissions?.includes('view_admin_overview') ||
    user?.role === 'super_admin';

  // Check if user has seen feature tips
  useEffect(() => {
    if (!user?.id) return;

    const adminOverviewKey = `feature-tip-admin-overview-${user.id}`;
    const spreadsheetKey = `feature-tip-spreadsheet-${user.id}`;
    const floatingButtonKey = `feature-tip-floating-button-${user.id}`;

    const adminOverviewSeen = localStorage.getItem(adminOverviewKey);
    const spreadsheetSeen = localStorage.getItem(spreadsheetKey);
    const floatingButtonSeen = localStorage.getItem(floatingButtonKey);

    // Show admin overview tip if user has permission and hasn't seen it more than 3 times
    if (hasAdminOverviewPermission) {
      const viewCount = parseInt(adminOverviewSeen || '0', 10);
      if (viewCount < 3) {
        setShowAdminOverviewTip(true);
        localStorage.setItem(adminOverviewKey, String(viewCount + 1));
      }
    }

    // Show floating button tip if user hasn't dismissed it
    const floatingButtonDismissed = floatingButtonSeen === 'dismissed';
    if (!floatingButtonDismissed && activeTab !== 'scheduled') {
      setShowFloatingTip(true);
    } else if (activeTab === 'scheduled') {
      // Hide floating tip when on scheduled tab
      setShowFloatingTip(false);
    }

    // Show spreadsheet tip if hasn't seen it more than 3 times
    const spreadsheetViewCount = parseInt(spreadsheetSeen || '0', 10);
    if (spreadsheetViewCount < 3) {
      setShowSpreadsheetTip(true);
      localStorage.setItem(spreadsheetKey, String(spreadsheetViewCount + 1));
    }
  }, [user?.id, hasAdminOverviewPermission, activeTab]);

  // Track initial page load with default tab (only once)
  useEffect(() => {
    if (user?.id && !hasLoggedInitialView.current) {
      hasLoggedInitialView.current = true;

      trackButtonClick('event_requests_page_loaded', 'event_requests');

      // Track which tab user lands on (now defaults to 'scheduled' for key roles)
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'event_requests_initial_view', {
          initial_tab: activeTab,
          user_role: user.role,
          is_new_default: activeTab === 'scheduled',
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, [user?.id, trackButtonClick, activeTab, user?.role]);

  // Track tab changes
  useEffect(() => {
    if (user?.id && activeTab) {
      trackButtonClick(`tab_${activeTab}_viewed`, 'event_requests');
    }
  }, [activeTab, user?.id]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // State for volunteer opportunities dialog
  const [showVolunteerOpportunities, setShowVolunteerOpportunities] = useState(false);

  // State for back to top button
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Track scroll position for back to top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 400px
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Memoize tab children to prevent recreation on every render
  const tabChildren = useMemo(() => {
    const tabs: any = {
      all: <AllEventsTab />,
      new: <NewRequestsTab />,
      in_process: <InProcessTab />,
      scheduled: <ScheduledTab />,
      completed: <CompletedTab />,
      declined: <DeclinedTab />,
      postponed: <PostponedTab />,
      standby: <StandbyTab />,
      stalled: <StalledTab />,
      non_event: <NonEventTab />,
      rescheduled: <RescheduledTab />,
      my_assignments: <MyAssignmentsTab />,
    };

    // Add admin overview tab for users with permission (support both old and new permission strings)
    if (user?.permissions?.includes(PERMISSIONS.EVENT_REQUESTS_VIEW_ADMIN_OVERVIEW) ||
        user?.permissions?.includes('view_admin_overview') ||
        user?.role === 'super_admin') {
      tabs.admin_overview = <AdminOverviewTab eventRequests={eventRequests} />;
    }

    // Add planning tab for users with admin overview permission (same permission)
    if (user?.permissions?.includes(PERMISSIONS.EVENT_REQUESTS_VIEW_ADMIN_OVERVIEW) ||
        user?.permissions?.includes('view_admin_overview') ||
        user?.role === 'super_admin') {
      tabs.planning = <PlanningTab eventRequests={eventRequests} />;
    }

    return tabs;
  }, [eventRequests, user?.role, user?.permissions]);

  const handleScheduleCall = () => {
    if (!selectedEventRequest || !scheduleCallDate) return;

    // Use provided time or default to start of day if no time specified
    const timeToUse = scheduleCallTime || '00:00';
    const combinedDateTime = new Date(
      `${scheduleCallDate}T${timeToUse}`
    ).toISOString();

    trackButtonClick('schedule_call', 'event_requests');
    scheduleCallMutation.mutate({
      id: selectedEventRequest.id,
      scheduledCallDate: combinedDateTime,
    });
  };

  // Handle postponement using standardized mutation pattern
  const handlePostpone = (eventId: number, data: {
    postponementReason: string;
    hasNewDate?: boolean;
    newScheduledDate?: string;
    tentativeNewDate?: string;
    postponementNotes?: string;
  }) => {
    trackButtonClick('postpone_event', 'event_requests');
    postponeEventMutation.mutate({ eventId, data });
  };

  // Handle floating button click to switch to scheduled + spreadsheet view
  const handleSwitchToSpreadsheet = () => {
    const previousTab = activeTab;
    setActiveTab('scheduled');

    // Track floating button usage with detailed context
    trackButtonClick('floating_spreadsheet_button', 'event_requests');

    // Track navigation from current tab to scheduled
    if (user) {
      const event = {
        feature: 'floating_spreadsheet_button',
        from_tab: previousTab,
        to_tab: 'scheduled',
        user_role: user.role,
        timestamp: new Date().toISOString(),
      };

      // Log to analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'spreadsheet_quick_access', event);
      }
    }
  };

  // Handle dismissing floating button tip
  const handleDismissFloatingTip = () => {
    if (!user?.id) return;
    const floatingButtonKey = `feature-tip-floating-button-${user.id}`;
    localStorage.setItem(floatingButtonKey, 'dismissed');
    setShowFloatingTip(false);

    // Track tip dismissal
    trackButtonClick('dismiss_floating_tip', 'event_requests');
  };

  if (isLoading) {
    return (
      <div className="space-y-4 premium-gradient-subtle min-h-screen p-2 sm:p-4">
        {/* Header skeleton */}
        <div className="premium-card p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
            {/* Tab skeleton */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-10 w-24 flex-shrink-0" />
              ))}
            </div>
            {/* Filter bar skeleton */}
            <div className="flex gap-2">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
        {/* Event cards skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="premium-card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate total for filters
  const totalItems = eventRequests.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <TooltipProvider>
      <div className="space-y-4 premium-gradient-subtle min-h-screen p-2 sm:p-4">
        {/* Header */}
        <div className="premium-card p-4 sm:p-6">
          <div className="space-y-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="premium-text-h1">Event Requests Management</h1>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-teal-600 hover:text-teal-800 transition-colors">
                        <HelpCircle className="w-5 h-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs premium-tooltip">
                      <p className="font-semibold mb-1">Event Requests Help</p>
                      <p className="text-sm">Track and manage all event requests from organizations. Use tabs to filter by status, assign TSP contacts, schedule events, and plan sandwich deliveries.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="premium-text-body text-brand-primary">
                  {isMobile ? 'Manage event requests' : 'Manage and track event requests from organizations'}
                </p>
              </div>
              
              {/* Primary action - always visible */}
              <button
                onClick={() => setShowVolunteerOpportunities(true)}
                className="premium-btn-primary flex-shrink-0"
                style={{ backgroundColor: '#007E8C' }}
              >
                <Users className="w-4 h-4" />
                {isMobile ? 'Volunteer' : 'Volunteer Opportunities'}
              </button>
            </div>
            
            {/* Action buttons row */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              {/* Admin actions */}
              {canSyncEvents && (
                <button
                  onClick={() => syncFromSheetsMutation.mutate()}
                  disabled={syncFromSheetsMutation.isPending}
                  className="premium-btn-outline text-sm"
                  title="Sync new event requests from Google Sheets (safe - won't create duplicates)"
                >
                  <RefreshCw className={`w-4 h-4 ${syncFromSheetsMutation.isPending ? 'animate-spin' : ''}`} />
                  {isMobile ? 'Sync' : 'Sync from Sheets'}
                </button>
              )}
              <button
                onClick={openManualEventRequest}
                className="premium-btn-outline text-sm"
                data-testid="button-add-manual-event"
              >
                <Plus className="w-4 h-4" />
                {isMobile ? 'Add' : 'Add Manual Event Request'}
              </button>
              
              {/* Separator */}
              <div className="hidden sm:block w-px h-6 bg-gray-200 mx-1" />
              
              {/* Status alert buttons */}
              <MissingInfoSummaryDialog />
              <ToolkitSentPendingDialog />
            </div>
          </div>
        </div>

        {/* Dashboard Summary Cards */}
        <DashboardSummaryCards
          eventRequests={allActiveEvents}
          statusCounts={statusCounts}
          isLoading={isLoading || statusCountsLoading}
        />

        {/* Role-customized view indicator */}
        {user?.role && user.role !== 'super_admin' && user.role !== 'admin' && (
          <div className="premium-card-flat p-3 border-l-4" style={{
            backgroundColor: 'rgba(0, 126, 140, 0.08)',
            borderLeftColor: '#007E8C'
          }}>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#007E8C' }} />
              <p className="text-sm" style={{ color: '#236383' }}>
                {getRoleViewDescription(user.role, 'events')}
              </p>
            </div>
          </div>
        )}

        {/* View Mode Toggle - Separate Row */}
        <div className="flex items-center justify-center">
          <div className="premium-card-flat flex items-center gap-1 p-1">
            <button
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'premium-btn-primary premium-btn-sm' : 'premium-btn-ghost premium-btn-sm'}
            >
              <List className="w-4 h-4" />
              {!isMobile && 'List View'}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={viewMode === 'calendar' ? 'premium-btn-primary premium-btn-sm' : 'premium-btn-ghost premium-btn-sm'}
            >
              <Calendar className="w-4 h-4" />
              {!isMobile && 'Calendar View'}
            </button>
          </div>
        </div>

        {/* View Content: Calendar or List */}
        {viewMode === 'calendar' ? (
          <EventCalendarView
            onEventClick={(event) => {
              setSelectedEventRequest(event);
              setShowEventDetailsPreview(true);
            }}
          />
        ) : (
          <>
            {/* Quick Filter Buttons */}
            <div className="mb-4 flex flex-wrap gap-2 px-4 sm:px-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('scheduled');
                  setSearchQuery('');
                  setQuickFilter(quickFilter === 'needsDriver' ? null : 'needsDriver');
                }}
                className={`${
                  quickFilter === 'needsDriver'
                    ? 'bg-[#236383] text-white border-[#236383] hover:bg-[#236383]/90'
                    : ''
                }`}
              >
                <Car className="w-4 h-4 mr-1.5" />
                Needs Driver
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('scheduled');
                  setSearchQuery('');
                  setQuickFilter(quickFilter === 'needsVan' ? null : 'needsVan');
                }}
                className={`${
                  quickFilter === 'needsVan'
                    ? 'bg-[#D68319] text-white border-[#D68319] hover:bg-[#D68319]/90'
                    : ''
                }`}
              >
                <Truck className="w-4 h-4 mr-1.5" />
                Needs Van
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('scheduled');
                  setSearchQuery('');
                  setQuickFilter(quickFilter === 'week' ? null : 'week');
                }}
                className={`${
                  quickFilter === 'week'
                    ? 'bg-[#007E8C] text-white border-[#007E8C] hover:bg-[#007E8C]/90'
                    : ''
                }`}
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('scheduled');
                  setSearchQuery('');
                  setQuickFilter(quickFilter === 'today' ? null : 'today');
                }}
                className={`${
                  quickFilter === 'today'
                    ? 'bg-[#007E8C] text-white border-[#007E8C] hover:bg-[#007E8C]/90'
                    : ''
                }`}
              >
                <Calendar className="w-4 h-4 mr-1.5" />
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setQuickFilter(quickFilter === 'corporatePriority' ? null : 'corporatePriority');
                }}
                className={`${
                  quickFilter === 'corporatePriority'
                    ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <Shield className="w-4 h-4 mr-1.5" />
                Corporate Priority
              </Button>
              <Link href="/driver-planning">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                >
                  <MapPin className="w-4 h-4 mr-1.5" />
                  Driver Planning Map
                </Button>
              </Link>
            </div>
            {/* Status Definitions Reference */}
            <StatusDefinitionsPanel />

            {/* Filters and Tabs */}
            <RequestFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            confirmationFilter={confirmationFilter}
            onConfirmationFilterChange={setConfirmationFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            activeTab={activeTab}
            onActiveTabChange={setActiveTab}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={setItemsPerPage}
            statusCounts={statusCounts}
            statusCountsLoading={statusCountsLoading}
            totalItems={totalItems}
            totalPages={totalPages}
            children={tabChildren}
            showAdminOverviewTip={showAdminOverviewTip}
            showSpreadsheetTip={showSpreadsheetTip}
            onDismissAdminOverviewTip={() => setShowAdminOverviewTip(false)}
            onDismissSpreadsheetTip={() => setShowSpreadsheetTip(false)}
          />
          </>
        )}

        {/* Event Details Preview Dialog */}
        <EventDetailsDialog
          event={selectedEventRequest}
          isOpen={showEventDetailsPreview}
          onClose={() => {
            setShowEventDetailsPreview(false);
            setSelectedEventRequest(null);
          }}
          onEdit={() => {
            setShowEventDetailsPreview(false);
            setShowEventDetails(true);
            setIsEditing(false);
          }}
          resolveUserName={resolveUserName}
          resolveRecipientName={resolveRecipientName}
        />

        {/* Event Details Edit Modal */}
        {showEventDetails && (selectedEventRequest || isEditing) && (
          <EventSchedulingForm
            eventRequest={selectedEventRequest}
            isOpen={showEventDetails}
            mode={selectedEventRequest ? 'edit' : 'create'}
            onClose={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
            onEventScheduled={() => {
              setShowEventDetails(false);
              setSelectedEventRequest(null);
              setIsEditing(false);
            }}
          />
        )}

        {/* Event Scheduling Dialog */}
        {showSchedulingDialog && schedulingEventRequest && (
          <EventSchedulingForm
            eventRequest={schedulingEventRequest}
            isOpen={showSchedulingDialog}
            onClose={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
            onEventScheduled={() => {
              setShowSchedulingDialog(false);
              setSchedulingEventRequest(null);
            }}
          />
        )}

        {/* Collection Log Dialog */}
        {/* Collection Log Dialog */}
        {showCollectionLog && collectionLogEventRequest && (
          <EventCollectionLog
            eventRequest={collectionLogEventRequest}
            isVisible={showCollectionLog}
            onClose={() => {
              setShowCollectionLog(false);
              setCollectionLogEventRequest(null);
            }}
          />
        )}

        {/* Toolkit Sent Dialog */}
        {showToolkitSentDialog && toolkitEventRequest && (
          <ToolkitSentDialog
            eventRequest={toolkitEventRequest}
            isOpen={showToolkitSentDialog}
            onClose={() => {
              setShowToolkitSentDialog(false);
              setToolkitEventRequest(null);
            }}
            onToolkitSent={(toolkitSentDate: string, contactAttempt?: { method: string; outcome: string; notes?: string }) => {
              if (toolkitEventRequest) {
                trackButtonClick('mark_toolkit_sent', 'event_requests');
                markToolkitSentMutation.mutate({
                  id: toolkitEventRequest.id,
                  toolkitSentDate,
                  contactAttempt,
                });
              }
            }}
            isLoading={markToolkitSentMutation.isPending}
          />
        )}

        {/* Schedule Call Dialog */}
        <ScheduleCallDialog
          isOpen={showScheduleCallDialog}
          onClose={() => setShowScheduleCallDialog(false)}
          eventRequest={selectedEventRequest}
          onCallScheduled={handleScheduleCall}
          isLoading={scheduleCallMutation.isPending}
          scheduleCallDate={scheduleCallDate}
          setScheduleCallDate={setScheduleCallDate}
          scheduleCallTime={scheduleCallTime}
          setScheduleCallTime={setScheduleCallTime}
        />

        {/* 1-Day Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneDayFollowUpDialog}
          onClose={() => {
            setShowOneDayFollowUpDialog(false);
            setFollowUpNotes(''); // Clear notes when dialog closes
          }}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              trackButtonClick('1day_followup', 'event_requests');
              oneDayFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneDayFollowUpMutation.isPending}
          followUpType="1-day"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* 1-Month Follow-up Dialog */}
        <FollowUpDialog
          isOpen={showOneMonthFollowUpDialog}
          onClose={() => {
            setShowOneMonthFollowUpDialog(false);
            setFollowUpNotes(''); // Clear notes when dialog closes
          }}
          eventRequest={selectedEventRequest}
          onFollowUpCompleted={(notes) => {
            if (selectedEventRequest) {
              trackButtonClick('1month_followup', 'event_requests');
              oneMonthFollowUpMutation.mutate({
                id: selectedEventRequest.id,
                notes,
              });
            }
          }}
          isLoading={oneMonthFollowUpMutation.isPending}
          followUpType="1-month"
          notes={followUpNotes}
          setNotes={setFollowUpNotes}
        />

        {/* Contact Organizer Dialog */}
        <ContactOrganizerDialog
          isOpen={showContactOrganizerDialog}
          onClose={() => {
            setShowContactOrganizerDialog(false);
            setContactEventRequest(null);
          }}
          eventRequest={contactEventRequest}
        />

        {/* Log Contact Attempt Dialog */}
        <LogContactAttemptDialog
          isOpen={showLogContactDialog}
          onClose={() => {
            setShowLogContactDialog(false);
            setLogContactEventRequest(null);
          }}
          eventRequest={logContactEventRequest}
          onLogContact={async (data) => {
            if (!logContactEventRequest) return;
            await updateEventRequestMutation.mutateAsync({
              id: logContactEventRequest.id,
              data: { ...data, _skipVersionCheck: true },
            });
          }}
        />

        {/* Edit Contact Attempt Dialog */}
        <EditContactAttemptDialog
          isOpen={showEditContactDialog}
          onClose={() => {
            setShowEditContactDialog(false);
            setEditContactEventRequest(null);
            setEditContactAttemptData(null);
          }}
          eventRequest={editContactEventRequest}
          contactAttempt={editContactAttemptData}
          onEditContact={async (data) => {
            if (!editContactEventRequest) return;
            await updateEventRequestMutation.mutateAsync({
              id: editContactEventRequest.id,
              data: { ...data, _skipVersionCheck: true },
            });
          }}
        />

        {/* AI Date Suggestion Dialog */}
        {aiSuggestionEventRequest && (
          <AiDateSuggestionDialog
            open={showAiDateSuggestionDialog}
            onClose={() => {
              setShowAiDateSuggestionDialog(false);
              setAiSuggestionEventRequest(null);
            }}
            eventRequest={aiSuggestionEventRequest}
            onSelectDate={(date) => {
              // Automatically open scheduling dialog with the recommended date
              setSchedulingEventRequest(aiSuggestionEventRequest);
              setShowSchedulingDialog(true);
              setShowAiDateSuggestionDialog(false);
              setAiSuggestionEventRequest(null);
            }}
          />
        )}

        {/* AI Intake Assistant Dialog */}
        {aiIntakeAssistantEventRequest && (
          <AiIntakeAssistantDialog
            open={showAiIntakeAssistantDialog}
            onClose={() => {
              setShowAiIntakeAssistantDialog(false);
              setAiIntakeAssistantEventRequest(null);
            }}
            eventRequest={aiIntakeAssistantEventRequest}
            onEditEvent={() => {
              // Open edit dialog
              setSelectedEventRequest(aiIntakeAssistantEventRequest);
              setIsEditing(true);
            }}
            onLogContact={() => {
              // Open log contact dialog
              setLogContactEventRequest(aiIntakeAssistantEventRequest);
              setShowLogContactDialog(true);
            }}
            onScheduleCall={() => {
              // Open contact organizer dialog for scheduling a call
              setSelectedEventRequest(aiIntakeAssistantEventRequest);
              setShowContactOrganizerDialog(true);
            }}
            onAddNote={() => {
              // Open edit dialog to add notes
              setSelectedEventRequest(aiIntakeAssistantEventRequest);
              setIsEditing(true);
            }}
          />
        )}

        {/* Postponement Dialog */}
        {postponementEventRequest && (
          <PostponementDialog
            isOpen={showPostponementDialog}
            onClose={() => {
              setShowPostponementDialog(false);
              setPostponementEventRequest(null);
            }}
            request={postponementEventRequest}
            onPostpone={handlePostpone}
          />
        )}

        {/* Decline Reason Dialog */}
        {reasonDialogEventRequest && showDeclineDialog && (
          <StatusReasonDialog
            isOpen={showDeclineDialog}
            onClose={() => {
              setShowDeclineDialog(false);
              setReasonDialogEventRequest(null);
            }}
            request={reasonDialogEventRequest}
            type="declined"
            onConfirm={async (eventId, data) => {
              await updateEventRequestMutation.mutateAsync({ id: eventId, data });
              setShowDeclineDialog(false);
              setReasonDialogEventRequest(null);
            }}
          />
        )}

        {/* Cancel Reason Dialog */}
        {reasonDialogEventRequest && showCancelDialog && (
          <StatusReasonDialog
            isOpen={showCancelDialog}
            onClose={() => {
              setShowCancelDialog(false);
              setReasonDialogEventRequest(null);
            }}
            request={reasonDialogEventRequest}
            type="cancelled"
            onConfirm={async (eventId, data) => {
              await updateEventRequestMutation.mutateAsync({ id: eventId, data });
              setShowCancelDialog(false);
              setReasonDialogEventRequest(null);
            }}
          />
        )}

        {/* Non-Event Dialog */}
        {nonEventDialogEventRequest && showNonEventDialog && (
          <NonEventDialog
            isOpen={showNonEventDialog}
            onClose={() => {
              setShowNonEventDialog(false);
              setNonEventDialogEventRequest(null);
            }}
            request={nonEventDialogEventRequest}
            onConfirm={async (eventId, data) => {
              await updateEventRequestMutation.mutateAsync({ id: eventId, data });
              setShowNonEventDialog(false);
              setNonEventDialogEventRequest(null);
            }}
          />
        )}

        {/* Reschedule Dialog */}
        {rescheduleDialogEventRequest && showRescheduleDialog && (
          <RescheduleDialog
            isOpen={showRescheduleDialog}
            onClose={() => {
              setShowRescheduleDialog(false);
              setRescheduleDialogEventRequest(null);
            }}
            request={rescheduleDialogEventRequest}
            onConfirm={async (eventId, data) => {
              await updateEventRequestMutation.mutateAsync({ id: eventId, data });
              setShowRescheduleDialog(false);
              setRescheduleDialogEventRequest(null);
            }}
          />
        )}

        {/* Intake Call Dialog */}
        {intakeCallEventRequest && (
          <IntakeCallDialog
            isOpen={showIntakeCallDialog}
            onClose={() => {
              setShowIntakeCallDialog(false);
              setIntakeCallEventRequest(null);
            }}
            eventRequest={intakeCallEventRequest}
            onCallComplete={() => {
              // Optionally update status to in_process after call
              if (intakeCallEventRequest) {
                updateEventRequestMutation.mutate({
                  id: intakeCallEventRequest.id,
                  data: { status: 'in_process' },
                });
              }
            }}
          />
        )}

        {/* Next Action Dialog */}
        {nextActionEventRequest && (
          <NextActionDialog
            isOpen={showNextActionDialog}
            onClose={() => {
              setShowNextActionDialog(false);
              setNextActionEventRequest(null);
              setNextActionMode('add');
            }}
            eventRequest={nextActionEventRequest}
            mode={nextActionMode}
            onActionSaved={() => {
              // Refresh event requests after action is saved
              invalidateEventRequestQueries(queryClient);
            }}
          />
        )}

        {/* TSP Contact Assignment Dialog */}
        <TspContactAssignmentDialog
          isOpen={showTspContactAssignmentDialog}
          onClose={() => {
            setShowTspContactAssignmentDialog(false);
            setTspContactEventRequest(null);
          }}
          eventRequestId={tspContactEventRequest?.id || 0}
          eventRequestTitle={tspContactEventRequest?.organizationName}
          currentTspContact={tspContactEventRequest?.tspContact || undefined}
          currentCustomTspContact={tspContactEventRequest?.customTspContact || undefined}
        />

        {/* General Assignment Dialog for Drivers/Speakers/Volunteers */}
        <AssignmentDialog
          isOpen={showAssignmentDialog}
          onClose={() => {
            setShowAssignmentDialog(false);
            setAssignmentType(null);
            setAssignmentEventId(null);
            setSelectedAssignees([]);
            setIsVanDriverAssignment(false);
          }}
          assignmentType={assignmentType}
          selectedAssignees={selectedAssignees}
          setSelectedAssignees={setSelectedAssignees}
          isVanDriverAssignment={isVanDriverAssignment}
          onAssign={async (assignees: string[], isTentative: boolean = false) => {
            if (!assignmentEventId || !assignmentType) return;

            // Prevent double submission
            if (updateEventRequestMutation.isPending) {
              logger.log('=== ASSIGNMENT SUBMIT BLOCKED (already pending) ===');
              return;
            }

            logger.log('=== ASSIGNMENT SUBMIT ===');
            logger.log('Event ID:', assignmentEventId);
            logger.log('Assignment Type:', assignmentType);
            logger.log('Selected Assignees:', assignees);
            logger.log('Is Tentative:', isTentative);
            logger.log('Available drivers:', (drivers ?? []).map((d: any) => ({ id: d.id, name: d.name })));
            logger.log('Available users:', (users ?? []).map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })));

            // Get the current event to preserve existing assignments
            const currentEvent = eventRequests.find(e => e.id === assignmentEventId);
            if (!currentEvent) {
              toast({
                title: 'Error',
                description: 'Event not found',
                variant: 'destructive',
              });
              return;
            }

            // Build the update data based on assignment type
            let updateData: any = {};

            if (assignmentType === 'driver') {
              // Helper to parse PostgreSQL arrays
              const parsePostgresArray = (arr: any): string[] => {
                if (!arr) return [];
                if (Array.isArray(arr)) return arr.map(String).filter((item) => item && item.trim());
                if (typeof arr === 'string') {
                  if (arr === '{}' || arr === '') return [];
                  const cleaned = arr.replace(/^{|}$/g, '');
                  if (!cleaned) return [];
                  if (cleaned.includes('"')) {
                    const matches = cleaned.match(/"[^"]*"|[^",]+/g);
                    return matches ? matches.map(item => item.replace(/"/g, '').trim()).filter(item => item) : [];
                  } else {
                    return cleaned.split(',').map(item => item.trim()).filter(item => item);
                  }
                }
                return [];
              };

              // Check if this is a van driver assignment using the flag from context
              // The flag is set when the van driver button is clicked
              const isVanDriver = isVanDriverAssignment;

              if (isVanDriver) {
                // Assign as van driver (van drivers can't be tentative for now)
                updateData.assignedVanDriverId = assignees[0];
                // Also set vanDriverNeeded to true if not already set
                if (!currentEvent.vanDriverNeeded) {
                  updateData.vanDriverNeeded = true;
                  // Default to no additional regular drivers when van driver is newly needed
                  updateData.driversNeeded = 0;
                }
              } else if (isTentative) {
                // Tentative driver assignment - add to tentativeDriverIds
                const existingTentativeDrivers = currentEvent.tentativeDriverIds || [];
                const allTentativeDriverIds = [...new Set([...existingTentativeDrivers, ...assignees])];
                updateData.tentativeDriverIds = allTentativeDriverIds;
              } else {
                // Regular driver assignment
                // Get existing drivers and merge with new ones
                const existingDrivers = currentEvent.assignedDriverIds || [];
                const existingDriverDetails = currentEvent.driverDetails || {};

                // Merge new drivers with existing ones (avoiding duplicates)
                const allDriverIds = [...new Set([...existingDrivers, ...assignees])];
                updateData.assignedDriverIds = allDriverIds;

                // Build driver details object, preserving existing details
                const driverDetails: any = { ...existingDriverDetails };
                allDriverIds.forEach(driverId => {
                  // Only add new details if they don't exist yet
                  if (!driverDetails[driverId]) {
                  // Check if it's a numeric driver ID
                  const isNumericId = /^\d+$/.test(driverId);

                  let driverName = driverId; // fallback to ID if name not found

                  if (isNumericId) {
                    // It's a traditional driver ID - look it up in the drivers array
                    const driver = (drivers ?? []).find((d: any) => d.id.toString() === driverId || d.id === parseInt(driverId));
                    if (driver) {
                      driverName = driver.name;
                      logger.log(`Found driver: ID=${driverId}, Name=${driver.name}`);
                    } else {
                      logger.warn(`Driver not found in loaded drivers: ID=${driverId}`);
                      // Keep the ID as-is, it will show as "Driver #350" in the UI
                    }
                  } else {
                    // It's a user ID - look it up in the users array
                    const foundUser = (users ?? []).find((u: any) => u.id === driverId);
                    if (foundUser) {
                      driverName = `${foundUser.firstName} ${foundUser.lastName}`.trim();
                    }
                  }

                    driverDetails[driverId] = {
                      name: driverName,
                      assignedAt: new Date().toISOString(),
                      assignedBy: user?.id || 'system'
                    };
                  }
                });
                updateData.driverDetails = driverDetails;
              }

            } else if (assignmentType === 'speaker') {
              if (isTentative) {
                // Tentative speaker assignment - add to tentativeSpeakerIds
                const existingTentativeSpeakers = currentEvent.tentativeSpeakerIds || [];
                const allTentativeSpeakerIds = [...new Set([...existingTentativeSpeakers, ...assignees])];
                updateData.tentativeSpeakerIds = allTentativeSpeakerIds;
              } else {
              // Get existing speakers and merge with new ones
              const existingSpeakers = currentEvent.assignedSpeakerIds || [];
              const existingSpeakerDetails = currentEvent.speakerDetails || {};

              // Merge new speakers with existing ones (avoiding duplicates)
              const allSpeakerIds = [...new Set([...existingSpeakers, ...assignees])];
              updateData.assignedSpeakerIds = allSpeakerIds;

              // Build speaker details object, preserving existing details
              const speakerDetails: any = { ...existingSpeakerDetails };
              const speakerAssignments: string[] = [];

              // Add details for all speakers (existing + new)
              allSpeakerIds.forEach(speakerId => {
                // Only add new details if they don't exist yet
                if (!speakerDetails[speakerId]) {
                  let name = speakerId; // Default fallback
                  
                  // Handle custom IDs (e.g., "custom-1762134226512-David")
                  if (speakerId.startsWith('custom-')) {
                    const parts = speakerId.split('-');
                    if (parts.length >= 3) {
                      const nameParts = parts.slice(2);
                      name = nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Speaker';
                    } else {
                      name = 'Custom Speaker';
                    }
                  }
                  // Handle host-contact IDs (e.g., "host-contact-4")
                  else if (speakerId.startsWith('host-contact-')) {
                    const contactId = parseInt(speakerId.replace('host-contact-', ''));
                    // Try to find in hostsWithContacts
                    let found = false;
                    if (hostsWithContacts && hostsWithContacts.length > 0) {
                      for (const host of hostsWithContacts) {
                        const contact = host.contacts?.find((c: any) => c.id === contactId);
                        if (contact) {
                          name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.name || contact.email || `Contact #${contactId}`;
                          found = true;
                          break;
                        }
                      }
                    }
                    if (!found) {
                      name = `Contact #${contactId}`;
                    }
                  }
                  // Handle regular user IDs
                  else {
                    const foundUser = (users ?? []).find((u: any) => u.id === speakerId);
                    if (foundUser) {
                      name = `${foundUser.firstName} ${foundUser.lastName}`.trim() || foundUser.displayName || speakerId;
                    }
                  }

                  speakerDetails[speakerId] = {
                    name: name,
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.id || 'system'
                  };
                }
                speakerAssignments.push(speakerDetails[speakerId].name || speakerId);
              });

              updateData.speakerDetails = speakerDetails;
              updateData.speakerAssignments = speakerAssignments;
              }

            } else if (assignmentType === 'volunteer') {
              if (isTentative) {
                // Tentative volunteer assignment - add to tentativeVolunteerIds
                const existingTentativeVolunteers = currentEvent.tentativeVolunteerIds || [];
                const allTentativeVolunteerIds = [...new Set([...existingTentativeVolunteers, ...assignees])];
                updateData.tentativeVolunteerIds = allTentativeVolunteerIds;
              } else {
              // Get existing volunteers and merge with new ones
              const existingVolunteers = currentEvent.assignedVolunteerIds || [];
              const existingVolunteerDetails = currentEvent.volunteerDetails || {};

              // Merge new volunteers with existing ones (avoiding duplicates)
              const allVolunteerIds = [...new Set([...existingVolunteers, ...assignees])];
              updateData.assignedVolunteerIds = allVolunteerIds;

              // Build volunteer details object, preserving existing details
              const volunteerDetails: any = { ...existingVolunteerDetails };
              const volunteerAssignments: string[] = [];

              // Add details for all volunteers (existing + new)
              allVolunteerIds.forEach(volunteerId => {
                // Only add new details if they don't exist yet
                if (!volunteerDetails[volunteerId]) {
                  let name = volunteerId; // Default fallback
                  
                  // Handle custom IDs (e.g., "custom-1762134226512-David")
                  if (volunteerId.startsWith('custom-')) {
                    const parts = volunteerId.split('-');
                    if (parts.length >= 3) {
                      const nameParts = parts.slice(2);
                      name = nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
                    } else {
                      name = 'Custom Volunteer';
                    }
                  }
                  // Handle host-contact IDs (e.g., "host-contact-4")
                  else if (volunteerId.startsWith('host-contact-')) {
                    const contactId = parseInt(volunteerId.replace('host-contact-', ''));
                    // Try to find in hostsWithContacts
                    let found = false;
                    if (hostsWithContacts && hostsWithContacts.length > 0) {
                      for (const host of hostsWithContacts) {
                        const contact = host.contacts?.find((c: any) => c.id === contactId);
                        if (contact) {
                          name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.name || contact.email || `Contact #${contactId}`;
                          found = true;
                          break;
                        }
                      }
                    }
                    if (!found) {
                      name = `Contact #${contactId}`;
                    }
                  }
                  // Handle regular user IDs
                  else {
                    const foundUser = (users ?? []).find((u: any) => u.id === volunteerId);
                    if (foundUser) {
                      name = `${foundUser.firstName} ${foundUser.lastName}`.trim() || foundUser.displayName || volunteerId;
                    }
                  }

                  volunteerDetails[volunteerId] = {
                    name: name,
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.id || 'system'
                  };
                }
                volunteerAssignments.push(volunteerDetails[volunteerId].name || volunteerId);
              });

              updateData.volunteerDetails = volunteerDetails;
              updateData.volunteerAssignments = volunteerAssignments;
              }
            }

            try {
              logger.log('Update data:', updateData);

              const result = await updateEventRequestMutation.mutateAsync({
                id: assignmentEventId,
                data: updateData,
              });

              logger.log('Update result:', result);

              // Close the dialog
              setShowAssignmentDialog(false);
              setAssignmentType(null);
              setAssignmentEventId(null);
              setSelectedAssignees([]);

              toast({
                title: 'Success',
                description: isTentative
                  ? `${assignmentType}s added as tentative (?)`
                  : `${assignmentType}s assigned successfully`,
              });
            } catch (error) {
              logger.error('Assignment error:', error);
              toast({
                title: 'Error',
                description: `Failed to assign ${assignmentType}s`,
                variant: 'destructive',
              });
            }
          }}
        />

        {/* Sandwich Planning Modal */}
        <Dialog
          open={showSandwichPlanningModal}
          onOpenChange={setShowSandwichPlanningModal}
        >
          <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Package className="w-6 h-6" />
                Weekly Sandwich Planning
              </DialogTitle>
              <DialogDescription>
                Plan sandwich production based on scheduled events. Monitor
                trends and adjust quantities based on demand patterns.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              <SandwichForecastWidget />

              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Sandwich Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>
                    • Plan sandwich types based on dietary restrictions and
                    preferences
                  </li>
                  <li>
                    • Factor in 10-15% extra sandwiches for unexpected attendees
                  </li>
                  <li>
                    • Coordinate with kitchen volunteers for preparation
                    schedules
                  </li>
                  <li>
                    • Check delivery addresses for any special requirements
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowSandwichPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
              >
                Close Sandwich Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Volunteer Opportunities Dialog */}
        <Dialog
          open={showVolunteerOpportunities}
          onOpenChange={setShowVolunteerOpportunities}
        >
          <DialogContent className="!w-[94vw] !max-w-[94vw] !h-[88vh] flex flex-col overflow-hidden p-0">
            <div className="px-8 pt-6 pb-4 flex-shrink-0">
              <DialogHeader>
                <DialogTitle className="text-3xl font-bold flex items-center gap-4 mb-2" style={{ color: '#007E8C' }}>
                  <Users className="w-8 h-8" />
                  Volunteer Opportunities
                </DialogTitle>
                <DialogDescription className="text-lg font-medium">
                  Sign up to speak or volunteer at upcoming events
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-8 pb-8">
              <VolunteerOpportunitiesTab />
            </div>
          </DialogContent>
        </Dialog>

        {/* Staffing Planning Modal */}
        <Dialog
          open={showStaffingPlanningModal}
          onOpenChange={setShowStaffingPlanningModal}
        >
          <DialogContent className="w-[95vw] max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-brand-primary flex items-center gap-3">
                <Users className="w-6 h-6" />
                Weekly Staffing Planning
              </DialogTitle>
              <DialogDescription>
                Coordinate drivers, speakers, and volunteers for scheduled
                events. Ensure all positions are filled before event dates.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              <StaffingForecastWidget />

              <div className="bg-[#e6f2f5] border border-[#007E8C]/30 rounded-lg p-4">
                <h4 className="font-semibold text-[#1A2332] mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Staffing Planning Tips
                </h4>
                <ul className="text-sm text-[#236383] space-y-1">
                  <li>
                    • Check driver assignments early - transportation is
                    critical
                  </li>
                  <li>
                    • Speaker assignments should be confirmed 1 week before
                    events
                  </li>
                  <li>
                    • Van drivers are needed for large events or special
                    delivery requirements
                  </li>
                  <li>
                    • Volunteers help with event setup and sandwich distribution
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button
                onClick={() => setShowStaffingPlanningModal(false)}
                className="text-white"
                style={{ backgroundColor: '#236383' }}
              >
                Close Staffing Planning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Back to Top Floating Button - Desktop only to avoid mobile crowding */}
        {showBackToTop && (
          <div className="hidden sm:block fixed bottom-6 left-6 z-50">
            <button
              onClick={scrollToTop}
              className="h-10 w-10 rounded-full shadow-lg bg-slate-600 hover:bg-slate-700 active:bg-slate-800 transition-all duration-200 flex items-center justify-center text-white hover:scale-105 active:scale-95"
              title="Back to Top"
              aria-label="Scroll back to top"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Floating Action Button for Spreadsheet View - Desktop only, hidden on mobile to avoid crowding */}
        {activeTab !== 'scheduled' && (
          <div className="hidden sm:block fixed bottom-6 right-6 z-50">
            <button
              onClick={handleSwitchToSpreadsheet}
              className="h-14 w-14 rounded-full shadow-xl bg-green-600 hover:bg-green-700 active:bg-green-800 transition-all duration-200 flex items-center justify-center text-white hover:scale-105 active:scale-95"
              title="Switch to Spreadsheet View"
              aria-label="Switch to Spreadsheet View"
            >
              <Sheet className="h-5 w-5" />
            </button>

            {/* Tooltip that appears on first few visits - desktop only */}
            {showFloatingTip && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-green-500 rounded-lg shadow-lg p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <button
                  onClick={handleDismissFloatingTip}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Dismiss tip"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-xs text-gray-900">
                      Spreadsheet View
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Click for table layout
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Assistant */}
        <FloatingAIChat
          contextType="events"
          title="Events Assistant"
          subtitle="Ask about event requests and scheduling"
          contextData={{
            currentView: activeTab,
            filters: {
              statusFilter,
              confirmationFilter,
              searchQuery,
            },
            summaryStats: (() => {
              // Calculate this week's events (Mon-Sun)
              const now = new Date();
              const dayOfWeek = now.getDay();
              const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              const monday = new Date(now);
              monday.setDate(now.getDate() + mondayOffset);
              monday.setHours(0, 0, 0, 0);
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 6);
              sunday.setHours(23, 59, 59, 999);

              const thisWeekEvents = eventRequests.filter(e => {
                const eventDate = e.scheduledEventDate || e.desiredEventDate;
                if (!eventDate) return false;
                const date = new Date(eventDate);
                return date >= monday && date <= sunday && ['scheduled', 'in_process'].includes(e.status);
              });

              const thisWeekSandwiches = thisWeekEvents.reduce((sum, e) =>
                sum + (e.estimatedSandwichCount || e.actualSandwichCount || 0), 0
              );

              return {
                totalEvents: eventRequests.length,
                scheduledEvents: eventRequests.filter(e => e.status === 'scheduled').length,
                inProcessEvents: eventRequests.filter(e => e.status === 'in_process').length,
                newRequests: eventRequests.filter(e => e.status === 'new').length,
                completedEvents: eventRequests.filter(e => e.status === 'completed').length,
                confirmedEvents: eventRequests.filter(e => e.isConfirmed).length,
                // Pre-calculated weekly stats so AI doesn't have to count from truncated data
                thisWeekDateRange: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                thisWeekEventCount: thisWeekEvents.length,
                thisWeekSandwichTotal: thisWeekSandwiches,
                thisWeekEventsList: thisWeekEvents.map(e => ({
                  name: e.organizationName,
                  date: new Date(e.scheduledEventDate || e.desiredEventDate!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                  sandwiches: e.estimatedSandwichCount || e.actualSandwichCount || 0,
                  status: e.status,
                })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
              };
            })(),
          }}
          getFullContext={() => ({
            rawData: eventRequests.map(e => ({
              id: e.id,
              organizationName: e.organizationName,
              status: e.status,
              scheduledEventDate: e.scheduledEventDate,
              desiredEventDate: e.desiredEventDate,
              estimatedSandwichCount: e.estimatedSandwichCount,
              actualSandwichCount: e.actualSandwichCount,
              isConfirmed: e.isConfirmed,
              category: e.category,
              eventStartTime: e.eventStartTime,
              eventEndTime: e.eventEndTime,
              driversNeeded: e.driversNeeded,
              speakersNeeded: e.speakersNeeded,
              volunteersNeeded: e.volunteersNeeded,
            })),
            selectedItem: selectedEventRequest ? {
              organizationName: selectedEventRequest.organizationName,
              status: selectedEventRequest.status,
              scheduledEventDate: selectedEventRequest.scheduledEventDate,
              desiredEventDate: selectedEventRequest.desiredEventDate,
              estimatedSandwichCount: selectedEventRequest.estimatedSandwichCount,
              isConfirmed: selectedEventRequest.isConfirmed,
            } : undefined,
          })}
          suggestedQuestions={[
            "How many events are scheduled this month?",
            "What events need follow-up?",
            "Show events by status",
            "Which events are pending confirmation?",
            "What's our total sandwich count for scheduled events?",
          ]}
        />
      </div>
    </TooltipProvider>
  );
};

// Main component with provider wrapper
export default function EventRequestsManagementV2({
  initialTab,
  initialEventId,
}: {
  initialTab?: string | null;
  initialEventId?: number;
} = {}) {
  return (
    <EventRequestProvider
      initialTab={initialTab}
      initialEventId={initialEventId}
    >
      <EventRequestsManagementContent />
    </EventRequestProvider>
  );
}
