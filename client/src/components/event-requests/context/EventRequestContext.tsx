import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest, EventVolunteer } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';
import { getEventRequestDefaults } from '@shared/role-view-defaults';
import { logger } from '@/lib/logger';
import { useLocation } from 'wouter';
import { buildEventRequestsListQuery } from '../lib/eventRequestsListQuery';

interface EventRequestContextType {
  // Event requests data
  eventRequests: EventRequest[];
  isLoading: boolean;
  isPlaceholderData?: boolean;
  quickFilter: 'week' | 'today' | 'needsDriver' | 'needsVan' | 'corporatePriority' | null;
  setQuickFilter: (filter: 'week' | 'today' | 'needsDriver' | 'needsVan' | 'corporatePriority' | null) => void;

  // View state
  viewMode: 'list' | 'calendar';
  setViewMode: (mode: 'list' | 'calendar') => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedSearchQuery: string;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  myAssignmentsStatusFilter: string[];
  setMyAssignmentsStatusFilter: (statuses: string[]) => void;
  confirmationFilter: 'all' | 'confirmed' | 'requested';
  setConfirmationFilter: (filter: 'all' | 'confirmed' | 'requested') => void;
  sortBy: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc';
  setSortBy: (sort: any) => void;

  // Pagination
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;

  // Selected event and editing
  selectedEventRequest: EventRequest | null;
  setSelectedEventRequest: (event: EventRequest | null) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;

  // Dialog visibility states
  showEventDetails: boolean;
  setShowEventDetails: (show: boolean) => void;
  showEventDetailsPreview: boolean;
  setShowEventDetailsPreview: (show: boolean) => void;
  showSchedulingDialog: boolean;
  setShowSchedulingDialog: (show: boolean) => void;
  showToolkitSentDialog: boolean;
  setShowToolkitSentDialog: (show: boolean) => void;
  showScheduleCallDialog: boolean;
  setShowScheduleCallDialog: (show: boolean) => void;
  showOneDayFollowUpDialog: boolean;
  setShowOneDayFollowUpDialog: (show: boolean) => void;
  showOneMonthFollowUpDialog: boolean;
  setShowOneMonthFollowUpDialog: (show: boolean) => void;
  showContactOrganizerDialog: boolean;
  setShowContactOrganizerDialog: (show: boolean) => void;
  showCollectionLog: boolean;
  setShowCollectionLog: (show: boolean) => void;
  showAssignmentDialog: boolean;
  setShowAssignmentDialog: (show: boolean) => void;
  showTspContactAssignmentDialog: boolean;
  setShowTspContactAssignmentDialog: (show: boolean) => void;
  showSandwichPlanningModal: boolean;
  setShowSandwichPlanningModal: (show: boolean) => void;
  showStaffingPlanningModal: boolean;
  setShowStaffingPlanningModal: (show: boolean) => void;
  showLogContactDialog: boolean;
  setShowLogContactDialog: (show: boolean) => void;
  showEditContactDialog: boolean;
  setShowEditContactDialog: (show: boolean) => void;
  showAiDateSuggestionDialog: boolean;
  setShowAiDateSuggestionDialog: (show: boolean) => void;
  showAiIntakeAssistantDialog: boolean;
  setShowAiIntakeAssistantDialog: (show: boolean) => void;
  showPostponementDialog: boolean;
  setShowPostponementDialog: (show: boolean) => void;
  showIntakeCallDialog: boolean;
  setShowIntakeCallDialog: (show: boolean) => void;
  showDeclineDialog: boolean;
  setShowDeclineDialog: (show: boolean) => void;
  showCancelDialog: boolean;
  setShowCancelDialog: (show: boolean) => void;
  showNonEventDialog: boolean;
  setShowNonEventDialog: (show: boolean) => void;
  showRescheduleDialog: boolean;
  setShowRescheduleDialog: (show: boolean) => void;

  // Event being acted upon
  schedulingEventRequest: EventRequest | null;
  setSchedulingEventRequest: (event: EventRequest | null) => void;
  toolkitEventRequest: EventRequest | null;
  setToolkitEventRequest: (event: EventRequest | null) => void;
  collectionLogEventRequest: EventRequest | null;
  setCollectionLogEventRequest: (event: EventRequest | null) => void;
  contactEventRequest: EventRequest | null;
  setContactEventRequest: (event: EventRequest | null) => void;
  tspContactEventRequest: EventRequest | null;
  setTspContactEventRequest: (event: EventRequest | null) => void;
  logContactEventRequest: EventRequest | null;
  setLogContactEventRequest: (event: EventRequest | null) => void;
  editContactEventRequest: EventRequest | null;
  setEditContactEventRequest: (event: EventRequest | null) => void;
  editContactAttemptData: any | null;
  setEditContactAttemptData: (data: any | null) => void;
  aiSuggestionEventRequest: EventRequest | null;
  setAiSuggestionEventRequest: (event: EventRequest | null) => void;
  aiIntakeAssistantEventRequest: EventRequest | null;
  setAiIntakeAssistantEventRequest: (event: EventRequest | null) => void;
  postponementEventRequest: EventRequest | null;
  setPostponementEventRequest: (event: EventRequest | null) => void;
  intakeCallEventRequest: EventRequest | null;
  setIntakeCallEventRequest: (event: EventRequest | null) => void;
  reasonDialogEventRequest: EventRequest | null;
  setReasonDialogEventRequest: (event: EventRequest | null) => void;
  nonEventDialogEventRequest: EventRequest | null;
  setNonEventDialogEventRequest: (event: EventRequest | null) => void;
  rescheduleDialogEventRequest: EventRequest | null;
  setRescheduleDialogEventRequest: (event: EventRequest | null) => void;
  showNextActionDialog: boolean;
  setShowNextActionDialog: (show: boolean) => void;
  nextActionEventRequest: EventRequest | null;
  setNextActionEventRequest: (event: EventRequest | null) => void;
  nextActionMode: 'add' | 'edit' | 'complete';
  setNextActionMode: (mode: 'add' | 'edit' | 'complete') => void;

  // Assignment state
  assignmentType: 'driver' | 'speaker' | 'volunteer' | null;
  setAssignmentType: (type: 'driver' | 'speaker' | 'volunteer' | null) => void;
  assignmentEventId: number | null;
  setAssignmentEventId: (id: number | null) => void;
  selectedAssignees: string[];
  setSelectedAssignees: (assignees: string[]) => void;
  isEditingAssignment: boolean;
  setIsEditingAssignment: (editing: boolean) => void;
  editingAssignmentPersonId: string | null;
  setEditingAssignmentPersonId: (id: string | null) => void;
  isVanDriverAssignment: boolean;
  setIsVanDriverAssignment: (isVan: boolean) => void;

  // Schedule call state
  scheduleCallDate: string;
  setScheduleCallDate: (date: string) => void;
  scheduleCallTime: string;
  setScheduleCallTime: (time: string) => void;

  // Follow-up notes
  followUpNotes: string;
  setFollowUpNotes: (notes: string) => void;

  // Inline editing state for scheduled events
  editingScheduledId: number | null;
  setEditingScheduledId: (id: number | null) => void;
  editingField: string | null;
  setEditingField: (field: string | null) => void;
  editingValue: string;
  setEditingValue: (value: string) => void;

  // Inline sandwich editing states
  inlineSandwichMode: 'total' | 'types' | 'range';
  setInlineSandwichMode: (mode: 'total' | 'types' | 'range') => void;
  inlineTotalCount: number;
  setInlineTotalCount: (count: number) => void;
  inlineSandwichTypes: Array<{type: string, quantity: number}>;
  setInlineSandwichTypes: (types: Array<{type: string, quantity: number}>) => void;
  inlineRangeMin: number;
  setInlineRangeMin: (value: number) => void;
  inlineRangeMax: number;
  setInlineRangeMax: (value: number) => void;
  inlineRangeType: string;
  setInlineRangeType: (value: string) => void;

  // Modal sandwich editing states
  modalSandwichMode: 'total' | 'types';
  setModalSandwichMode: (mode: 'total' | 'types') => void;
  modalTotalCount: number;
  setModalTotalCount: (count: number) => void;
  modalSandwichTypes: Array<{type: string, quantity: number}>;
  setModalSandwichTypes: (types: Array<{type: string, quantity: number}>) => void;

  // Completed event inline editing
  editingCompletedId: number | null;
  setEditingCompletedId: (id: number | null) => void;
  completedEdit: any;
  setCompletedEdit: (edit: any) => void;

  // Custom person data for assignment
  customPersonData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    vanCapable: boolean;
  };
  setCustomPersonData: (data: any) => void;

  // Computed data
  requestsByStatus: Record<string, EventRequest[]>;
  statusCounts: {
    all: number;
    new: number;
    in_process: number;
    scheduled: number;
    rescheduled: number;
    completed: number;
    declined: number;
    postponed: number;
    cancelled: number;
    non_event: number;
    standby: number;
    stalled: number;
    my_assignments: number;
  };
  statusCountsLoading: boolean;
}

const EventRequestContext = createContext<EventRequestContextType | null>(null);

export const useEventRequestContext = () => {
  const context = useContext(EventRequestContext);
  if (!context) {
    throw new Error('useEventRequestContext must be used within EventRequestProvider');
  }
  return context;
};

interface EventRequestProviderProps {
  children: ReactNode;
  initialTab?: string | null;
  initialEventId?: number;
}

export const EventRequestProvider: React.FC<EventRequestProviderProps> = ({
  children,
  initialTab,
  initialEventId
}) => {
  // Get current user for assignment checking
  const { user } = useAuth();
  const [location] = useLocation();

  // Get role-based defaults for this user
  const roleDefaults = useMemo(() => {
    if (!user?.role) {
      return getEventRequestDefaults('viewer'); // Default fallback
    }
    return getEventRequestDefaults(user.role, user.id);
  }, [user?.role, user?.id]);

  // Quick filter state for special date ranges (This Week, Today, etc.)
  const [quickFilter, setQuickFilter] = useState<'week' | 'today' | 'needsDriver' | 'needsVan' | 'corporatePriority' | null>(null);

  // View state - use role-based defaults if no initialTab provided
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  // Default to 'new' tab if no initialTab is provided, otherwise use initialTab or role default
  const getDefaultTab = () => {
    if (initialTab && ['new', 'in_process', 'scheduled', 'completed', 'declined', 'postponed', 'standby', 'stalled', 'my_assignments', 'admin_overview', 'planning'].includes(initialTab)) {
      return initialTab;
    }
    // Default to 'new' for event requests when no tab is specified
    return 'new';
  };
  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Build list query key + URL in one place (also used by Dashboard prefetch)
  const { queryKey: listQueryKey, listUrl: listQueryUrl, fullUrl: fullQueryUrl } = useMemo(
    () => buildEventRequestsListQuery(activeTab, quickFilter),
    [activeTab, quickFilter]
  );

  // Reset quickFilter when activeTab changes to something incompatible
  useEffect(() => {
    if (quickFilter && !['scheduled', 'new', 'in_process'].includes(activeTab)) {
      setQuickFilter(null);
    }
  }, [activeTab, quickFilter]);

  // Fetch event requests with filtering and stale-while-revalidate
  // Uses lightweight /list endpoint for better performance
  const { data: eventRequests = [], isLoading, isPlaceholderData } = useQuery<EventRequest[]>({
    queryKey: listQueryKey,
    queryFn: async () => {
      const response = await fetch(listQueryUrl, {
        credentials: 'include',
      });
      if (!response.ok) {
        // Fallback to full endpoint if list endpoint fails
        logger.warn('List endpoint failed, falling back to full endpoint');
        const fallbackResponse = await fetch(fullQueryUrl, {
          credentials: 'include',
        });
        if (!fallbackResponse.ok) throw new Error('Failed to fetch event requests');
        return fallbackResponse.json();
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - balance between freshness and performance
    refetchOnWindowFocus: false, // Disable auto-refetch to reduce server load - users can manually refresh if needed
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes before garbage collection
    placeholderData: (previousData) => previousData, // Stale-while-revalidate: show old data while fetching
  });

  // Fetch status counts separately (for tab badges)
  const { data: serverStatusCounts, isLoading: statusCountsLoading } = useQuery<{
    all: number;
    new: number;
    in_process: number;
    scheduled: number;
    rescheduled: number;
    completed: number;
    declined: number;
    postponed: number;
    cancelled: number;
    non_event: number;
    standby: number;
    stalled: number;
    my_assignments: number;
  }>({
    queryKey: ['/api/event-requests/status-counts'],
    queryFn: async () => {
      const response = await fetch('/api/event-requests/status-counts', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch status counts');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - refresh counts more frequently
    gcTime: 5 * 60 * 1000,
  });

  // Fetch event volunteers data for assignment checking
  const { data: eventVolunteers = [] } = useQuery<EventVolunteer[]>({
    queryKey: ['/api/event-requests/my-volunteers'],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
  });

  // Update activeTab when initialTab prop changes (for navigation)
  useEffect(() => {
    const validTabs = ['all', 'new', 'in_process', 'scheduled', 'completed', 'declined', 'postponed', 'standby', 'stalled', 'my_assignments', 'admin_overview', 'planning'];
    if (initialTab && validTabs.includes(initialTab)) {
      logger.log('[EventRequestContext] Setting activeTab from initialTab:', initialTab);
      setActiveTab(initialTab);
    } else if (!initialTab) {
      // Reset to 'new' when initialTab is cleared/null (but only if we're not already on a valid tab)
      if (!validTabs.includes(activeTab)) {
        logger.log('[EventRequestContext] Resetting activeTab to new (initialTab is null)');
        setActiveTab('new');
      }
    }
  }, [initialTab]);

  // Also listen to URL changes directly in case the component doesn't remount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabFromUrl = urlParams.get('tab');
    const sectionFromUrl = urlParams.get('section');
    const validTabs = ['all', 'new', 'in_process', 'scheduled', 'completed', 'declined', 'postponed', 'standby', 'stalled', 'my_assignments', 'admin_overview', 'planning'];

    // Only update if we're on the event-requests section and there's a valid tab in the URL
    if (sectionFromUrl === 'event-requests' && tabFromUrl && validTabs.includes(tabFromUrl)) {
      logger.log('[EventRequestContext] URL changed, updating activeTab from URL:', tabFromUrl, 'current activeTab:', activeTab);
      if (activeTab !== tabFromUrl) {
        setActiveTab(tabFromUrl);
      }
    } else if (sectionFromUrl === 'event-requests' && !tabFromUrl && !validTabs.includes(activeTab)) {
      // If we're on event-requests but no tab in URL and current tab is invalid, default to 'new'
      logger.log('[EventRequestContext] No tab in URL, defaulting to new');
      setActiveTab('new');
    }
  }, [location, activeTab]);
  const [myAssignmentsStatusFilter, setMyAssignmentsStatusFilter] = useState<string[]>(['new', 'in_process', 'scheduled']);
  const [confirmationFilter, setConfirmationFilter] = useState<'all' | 'confirmed' | 'requested'>(roleDefaults.defaultConfirmationFilter);
  const [sortBy, setSortBy] = useState<'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc'>(roleDefaults.defaultSort);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(roleDefaults.itemsPerPage);

  // Selected event and editing
  const [selectedEventRequest, setSelectedEventRequest] = useState<EventRequest | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Dialog visibility states
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showEventDetailsPreview, setShowEventDetailsPreview] = useState(false);
  const [showSchedulingDialog, setShowSchedulingDialog] = useState(false);
  const [showToolkitSentDialog, setShowToolkitSentDialog] = useState(false);
  const [showScheduleCallDialog, setShowScheduleCallDialog] = useState(false);
  const [showOneDayFollowUpDialog, setShowOneDayFollowUpDialog] = useState(false);
  const [showOneMonthFollowUpDialog, setShowOneMonthFollowUpDialog] = useState(false);
  const [showContactOrganizerDialog, setShowContactOrganizerDialog] = useState(false);
  const [showCollectionLog, setShowCollectionLog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showTspContactAssignmentDialog, setShowTspContactAssignmentDialog] = useState(false);
  const [showSandwichPlanningModal, setShowSandwichPlanningModal] = useState(false);
  const [showStaffingPlanningModal, setShowStaffingPlanningModal] = useState(false);
  const [showLogContactDialog, setShowLogContactDialog] = useState(false);
  const [showEditContactDialog, setShowEditContactDialog] = useState(false);
  const [showAiDateSuggestionDialog, setShowAiDateSuggestionDialog] = useState(false);
  const [showAiIntakeAssistantDialog, setShowAiIntakeAssistantDialog] = useState(false);
  const [showPostponementDialog, setShowPostponementDialog] = useState(false);
  const [showIntakeCallDialog, setShowIntakeCallDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showNonEventDialog, setShowNonEventDialog] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);

  // Event being acted upon
  const [schedulingEventRequest, setSchedulingEventRequest] = useState<EventRequest | null>(null);
  const [toolkitEventRequest, setToolkitEventRequest] = useState<EventRequest | null>(null);
  const [collectionLogEventRequest, setCollectionLogEventRequest] = useState<EventRequest | null>(null);
  const [contactEventRequest, setContactEventRequest] = useState<EventRequest | null>(null);
  const [tspContactEventRequest, setTspContactEventRequest] = useState<EventRequest | null>(null);
  const [logContactEventRequest, setLogContactEventRequest] = useState<EventRequest | null>(null);
  const [editContactEventRequest, setEditContactEventRequest] = useState<EventRequest | null>(null);
  const [editContactAttemptData, setEditContactAttemptData] = useState<any | null>(null);
  const [aiSuggestionEventRequest, setAiSuggestionEventRequest] = useState<EventRequest | null>(null);
  const [aiIntakeAssistantEventRequest, setAiIntakeAssistantEventRequest] = useState<EventRequest | null>(null);
  const [postponementEventRequest, setPostponementEventRequest] = useState<EventRequest | null>(null);
  const [intakeCallEventRequest, setIntakeCallEventRequest] = useState<EventRequest | null>(null);
  const [reasonDialogEventRequest, setReasonDialogEventRequest] = useState<EventRequest | null>(null);
  const [nonEventDialogEventRequest, setNonEventDialogEventRequest] = useState<EventRequest | null>(null);
  const [rescheduleDialogEventRequest, setRescheduleDialogEventRequest] = useState<EventRequest | null>(null);
  const [showNextActionDialog, setShowNextActionDialog] = useState(false);
  const [nextActionEventRequest, setNextActionEventRequest] = useState<EventRequest | null>(null);
  const [nextActionMode, setNextActionMode] = useState<'add' | 'edit' | 'complete'>('add');

  // Assignment state
  const [assignmentType, setAssignmentType] = useState<'driver' | 'speaker' | 'volunteer' | null>(null);
  const [assignmentEventId, setAssignmentEventId] = useState<number | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentPersonId, setEditingAssignmentPersonId] = useState<string | null>(null);
  const [isVanDriverAssignment, setIsVanDriverAssignment] = useState(false);

  // Schedule call state
  const [scheduleCallDate, setScheduleCallDate] = useState('');
  const [scheduleCallTime, setScheduleCallTime] = useState('');

  // Follow-up notes
  const [followUpNotes, setFollowUpNotes] = useState('');

  // Inline editing state
  const [editingScheduledId, setEditingScheduledId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Inline sandwich editing
  const [inlineSandwichMode, setInlineSandwichMode] = useState<'total' | 'types' | 'range'>('total');
  const [inlineTotalCount, setInlineTotalCount] = useState(0);
  const [inlineSandwichTypes, setInlineSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);
  const [inlineRangeMin, setInlineRangeMin] = useState(0);
  const [inlineRangeMax, setInlineRangeMax] = useState(0);
  const [inlineRangeType, setInlineRangeType] = useState('');

  // Modal sandwich editing
  const [modalSandwichMode, setModalSandwichMode] = useState<'total' | 'types'>('total');
  const [modalTotalCount, setModalTotalCount] = useState(0);
  const [modalSandwichTypes, setModalSandwichTypes] = useState<Array<{type: string, quantity: number}>>([]);

  // Completed event editing
  const [editingCompletedId, setEditingCompletedId] = useState<number | null>(null);
  const [completedEdit, setCompletedEdit] = useState<any>({});

  // Custom person data
  const [customPersonData, setCustomPersonData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vanCapable: false,
  });

  // Group requests by status
  const requestsByStatus = useMemo(() => {
    const groups = eventRequests.reduce((acc: any, request: EventRequest) => {
      if (!acc[request.status]) {
        acc[request.status] = [];
      }
      acc[request.status].push(request);
      return acc;
    }, {});

    // Sort each group by newest first
    Object.keys(groups).forEach((status) => {
      groups[status].sort(
        (a: EventRequest, b: EventRequest) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return groups;
  }, [eventRequests]);

  // Helper function to check if current user is assigned to an event
  const isUserAssignedToEvent = useCallback((request: EventRequest): boolean => {
    if (!user?.id) return false;

    // Check TSP Contact assignment (check both tspContactAssigned and tspContact columns)
    if (request.tspContactAssigned === user.id || request.tspContact === user.id) {
      return true;
    }

    // Check additional TSP contacts (parity with server + useEventFilters)
    if (request.additionalContact1 === user.id || request.additionalContact2 === user.id) {
      return true;
    }

    // Check driver assignment in driverDetails JSONB field
    if (request.driverDetails) {
      try {
        const driverDetails = typeof request.driverDetails === 'string' 
          ? JSON.parse(request.driverDetails) 
          : request.driverDetails;
        
        // Driver assignments are stored as keys in the driverDetails object
        // Example: {"351": {"name": "Gary Munder", "assignedBy": "admin_..."}}
        // The user.id should match one of the keys (351, not the assignedBy)
        if (driverDetails && typeof driverDetails === 'object' && !Array.isArray(driverDetails)) {
          const driverKeys = Object.keys(driverDetails);
          if (driverKeys.some(key => key === user.id || key === user.id.toString())) {
            return true;
          }
        }
      } catch (e) {
        // If parsing fails, continue with other checks
      }
    }

    // Check speaker assignment in speakerDetails JSONB field
    if (request.speakerDetails) {
      try {
        const speakerDetails = typeof request.speakerDetails === 'string' 
          ? JSON.parse(request.speakerDetails) 
          : request.speakerDetails;
        
        // Speaker assignments are stored as keys in the speakerDetails object
        if (speakerDetails && typeof speakerDetails === 'object' && !Array.isArray(speakerDetails)) {
          const speakerKeys = Object.keys(speakerDetails);
          if (speakerKeys.some(key => key === user.id || key === user.id.toString())) {
            return true;
          }
        }
      } catch (e) {
        // If parsing fails, continue with other checks
      }
    }

    // Check event volunteers assignment (driver, speaker, general)
    const userVolunteerAssignment = eventVolunteers.find(volunteer => 
      volunteer.eventRequestId === request.id && 
      volunteer.volunteerUserId === user.id
    );
    
    if (userVolunteerAssignment) {
      return true;
    }

    return false;
  }, [user?.id, eventVolunteers]);

  // Use server-side status counts for accurate tab badges
  // IMPORTANT: Always prefer serverStatusCounts over fallback since eventRequests is filtered by active tab
  // The statusCountsLoading flag is passed to RequestFilters so formatCount can show '...' while loading
  const statusCounts = {
    all: serverStatusCounts?.all ?? 0,
    new: serverStatusCounts?.new ?? 0,
    in_process: serverStatusCounts?.in_process ?? 0,
    scheduled: serverStatusCounts?.scheduled ?? 0,
    rescheduled: serverStatusCounts?.rescheduled ?? 0,
    completed: serverStatusCounts?.completed ?? 0,
    declined: serverStatusCounts?.declined ?? 0,
    postponed: serverStatusCounts?.postponed ?? 0,
    cancelled: serverStatusCounts?.cancelled ?? 0,
    non_event: serverStatusCounts?.non_event ?? 0,
    standby: serverStatusCounts?.standby ?? 0,
    stalled: serverStatusCounts?.stalled ?? 0,
    // my_assignments count is calculated server-side to include TSP contacts, drivers, speakers
    my_assignments: serverStatusCounts?.my_assignments ?? 0,
  };

  // Sync state with role defaults when user loads (handles async user fetch)
  // Only applies defaults if no explicit initialTab was provided (respects URL navigation)
  useEffect(() => {
    if (!initialTab) {
      setActiveTab(roleDefaults.defaultTab);
      setConfirmationFilter(roleDefaults.defaultConfirmationFilter);
      setSortBy(roleDefaults.defaultSort);
      setItemsPerPage(roleDefaults.itemsPerPage);
    }
  }, [roleDefaults.defaultTab, roleDefaults.defaultConfirmationFilter, roleDefaults.defaultSort, roleDefaults.itemsPerPage, initialTab]);

  // Synchronize statusFilter with activeTab (only for status-based tabs)
  useEffect(() => {
    // Only sync statusFilter for tabs that correspond to status values
    if (['all', 'new', 'in_process', 'scheduled', 'completed', 'declined', 'postponed', 'standby', 'stalled', 'my_assignments'].includes(activeTab)) {
      setStatusFilter(activeTab);
    }
    // For admin_overview and planning tabs, don't change statusFilter
  }, [activeTab]);

  // Auto-sort by appropriate default for each tab (only when tab changes)
  // This provides smart defaults but user can still override
  useEffect(() => {
    if (activeTab === 'all') {
      setSortBy('event_date_asc');
    } else if (activeTab === 'new') {
      setSortBy('created_date_desc');
    } else if (activeTab === 'scheduled' || activeTab === 'in_process' || activeTab === 'my_assignments') {
      // For scheduled and my_assignments, show upcoming events first
      setSortBy('event_date_asc');
    } else if (activeTab === 'completed') {
      setSortBy('organization_asc');
    }
  }, [activeTab]);

  // Debounce search query to improve performance (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter, sortBy]);

  // Track if we've already handled the initial event to prevent reopening
  const [hasHandledInitialEvent, setHasHandledInitialEvent] = useState(false);

  // Handle initial event ID - auto-open event details if specified
  useEffect(() => {
    if (initialTab && ['new', 'in_process', 'scheduled', 'completed', 'declined', 'postponed', 'standby', 'stalled', 'my_assignments', 'admin_overview', 'planning'].includes(initialTab)) {
      setActiveTab(initialTab);
    }

    if (initialEventId && eventRequests.length > 0 && !hasHandledInitialEvent) {
      const targetEvent = eventRequests.find(req => req.id === initialEventId);
      if (targetEvent) {
        setSelectedEventRequest(targetEvent);
        setShowEventDetails(true);
        setIsEditing(false);
        setHasHandledInitialEvent(true); // Mark as handled to prevent reopening

        if (!initialTab) {
          if (targetEvent.status === 'completed') {
            setActiveTab('completed');
          } else if (targetEvent.status === 'scheduled') {
            setActiveTab('scheduled');
          } else if (targetEvent.status === 'in_process') {
            setActiveTab('in_process');
          } else if (targetEvent.status === 'standby') {
            setActiveTab('standby');
          } else if (targetEvent.status === 'stalled') {
            setActiveTab('stalled');
          } else if (targetEvent.status === 'declined' || targetEvent.status === 'postponed' || targetEvent.status === 'cancelled') {
            setActiveTab('declined');
          } else {
            setActiveTab('new');
          }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [initialTab, initialEventId, eventRequests, hasHandledInitialEvent]);

  // Memoize context value to prevent unnecessary re-renders of consumers.
  // Setter functions from useState are guaranteed stable and excluded from dependencies.
  const value: EventRequestContextType = useMemo(() => ({
    // Data
    eventRequests,
    isLoading,
    isPlaceholderData,
    quickFilter,
    setQuickFilter,
    requestsByStatus,
    statusCounts,
    statusCountsLoading,

    // View state
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    statusFilter,
    setStatusFilter,
    myAssignmentsStatusFilter,
    setMyAssignmentsStatusFilter,
    confirmationFilter,
    setConfirmationFilter,
    sortBy,
    setSortBy,

    // Pagination
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,

    // Selected event
    selectedEventRequest,
    setSelectedEventRequest,
    isEditing,
    setIsEditing,

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
    showAssignmentDialog,
    setShowAssignmentDialog,
    showTspContactAssignmentDialog,
    setShowTspContactAssignmentDialog,
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

    // Event references
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
    showNextActionDialog,
    setShowNextActionDialog,
    nextActionEventRequest,
    setNextActionEventRequest,
    nextActionMode,
    setNextActionMode,

    // Assignment
    assignmentType,
    setAssignmentType,
    assignmentEventId,
    setAssignmentEventId,
    selectedAssignees,
    setSelectedAssignees,
    isEditingAssignment,
    setIsEditingAssignment,
    editingAssignmentPersonId,
    setEditingAssignmentPersonId,
    isVanDriverAssignment,
    setIsVanDriverAssignment,

    // Schedule call
    scheduleCallDate,
    setScheduleCallDate,
    scheduleCallTime,
    setScheduleCallTime,

    // Follow-up
    followUpNotes,
    setFollowUpNotes,

    // Inline editing
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,

    // Sandwich editing
    inlineSandwichMode,
    setInlineSandwichMode,
    inlineTotalCount,
    setInlineTotalCount,
    inlineSandwichTypes,
    setInlineSandwichTypes,
    inlineRangeMin,
    setInlineRangeMin,
    inlineRangeMax,
    setInlineRangeMax,
    inlineRangeType,
    setInlineRangeType,
    modalSandwichMode,
    setModalSandwichMode,
    modalTotalCount,
    setModalTotalCount,
    modalSandwichTypes,
    setModalSandwichTypes,

    // Completed editing
    editingCompletedId,
    setEditingCompletedId,
    completedEdit,
    setCompletedEdit,

    // Custom person
    customPersonData,
    setCustomPersonData,
  }), [
    // Query results
    eventRequests, isLoading, isPlaceholderData, statusCountsLoading,
    // Computed values
    requestsByStatus, statusCounts,
    // View state
    quickFilter, viewMode, activeTab, searchQuery, debouncedSearchQuery,
    statusFilter, myAssignmentsStatusFilter, confirmationFilter, sortBy,
    // Pagination
    currentPage, itemsPerPage,
    // Selected/editing
    selectedEventRequest, isEditing,
    // Dialog visibility (19 booleans)
    showEventDetails, showSchedulingDialog, showToolkitSentDialog, showScheduleCallDialog,
    showOneDayFollowUpDialog, showOneMonthFollowUpDialog, showContactOrganizerDialog,
    showCollectionLog, showAssignmentDialog, showTspContactAssignmentDialog,
    showSandwichPlanningModal, showStaffingPlanningModal, showLogContactDialog,
    showEditContactDialog, showAiDateSuggestionDialog, showAiIntakeAssistantDialog,
    showPostponementDialog, showIntakeCallDialog, showNextActionDialog, showNonEventDialog, showRescheduleDialog,
    // Event references (13)
    schedulingEventRequest, toolkitEventRequest, collectionLogEventRequest,
    contactEventRequest, tspContactEventRequest, logContactEventRequest,
    editContactEventRequest, editContactAttemptData, aiSuggestionEventRequest,
    aiIntakeAssistantEventRequest, postponementEventRequest, intakeCallEventRequest,
    nextActionEventRequest, nextActionMode, nonEventDialogEventRequest, rescheduleDialogEventRequest,
    // Assignment state (6)
    assignmentType, assignmentEventId, selectedAssignees, isEditingAssignment, editingAssignmentPersonId, isVanDriverAssignment,
    // Schedule call & follow-up (3)
    scheduleCallDate, scheduleCallTime, followUpNotes,
    // Inline editing (3)
    editingScheduledId, editingField, editingValue,
    // Sandwich editing (11)
    inlineSandwichMode, inlineTotalCount, inlineSandwichTypes, inlineRangeMin,
    inlineRangeMax, inlineRangeType, modalSandwichMode, modalTotalCount, modalSandwichTypes,
    // Completed editing (2)
    editingCompletedId, completedEdit,
    // Custom person (1)
    customPersonData,
    // Note: All set* functions are excluded - useState setters are guaranteed stable
  ]);

  return (
    <EventRequestContext.Provider value={value}>
      {children}
    </EventRequestContext.Provider>
  );
};