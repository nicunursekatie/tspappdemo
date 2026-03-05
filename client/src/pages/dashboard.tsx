import {
  Sandwich,
  LogOut,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  MessageSquare,
  Hash,
  Inbox,
  ClipboardList,
  FolderOpen,
  BarChart3,
  TrendingUp,
  Users,
  Car,
  Building2,
  FileText,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  UserCog,
  Lightbulb,
  AlertCircle,
  Trophy,
  Calculator,
  Calendar,
  Clock,
  Truck,
  FileImage,
  Gift,
  Copy,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import { useLocation, useRoute } from 'wouter';
// Using optimized SVG for faster loading
const sandwichLogo = '/sandwich-icon-optimized.svg';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useState, useMemo, Suspense } from 'react';
import * as React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePageSession } from '@/hooks/usePageSession';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { getEventRequestDefaults } from '@shared/role-view-defaults';
import { queryClient } from '@/lib/queryClient';
import { buildEventRequestsListQuery } from '@/components/event-requests/lib/eventRequestsListQuery';
import SimpleNav from '@/components/simple-nav';
import { NAV_ITEMS } from '@/nav.config';
import AnnouncementBanner from '@/components/announcement-banner';
import { useAnalytics } from '@/hooks/useAnalytics';
import EnhancedNotifications from '@/components/enhanced-notifications';
import { OnlineUsers } from '@/components/online-users';
import { useOnlinePresenceNotifications } from '@/hooks/useOnlinePresenceNotifications';
import { RealTimeKudosNotifier } from '@/components/real-time-kudos-notifier';
import { LoginMessageNotifier } from '@/components/login-message-notifier';
import { GuidedTour } from '@/components/GuidedTour';
import { ErrorBoundary } from '@/components/error-boundary';
import { DashboardNavigationProvider } from '@/contexts/dashboard-navigation-context';
import { TextIdeaAnnouncementModal } from '@/components/text-idea-announcement-modal';
import { MultiViewProvider, useMultiView } from '@/contexts/multi-view-context';
import { MultiViewContainer, MultiViewToolbar, FloatingViewsContainer } from '@/components/multi-view';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { DashboardBreadcrumbs } from '@/components/dashboard-breadcrumbs';
import { WhatsNewModal } from '@/components/whats-new-modal';
import { FloatingAIChat } from '@/components/floating-ai-chat';
import { ReviewerBanner } from '@/components/reviewer-banner';
import { CommandPalette, useCommandPalette } from '@/components/command-palette';

// Lazy load all page/section components with automatic retry on failure
const ProjectList = lazyWithRetry(() => import('@/components/project-list'));
const WeeklySandwichForm = lazyWithRetry(() => import('@/components/weekly-sandwich-form'));
// CommitteeChat removed - consolidated into StreamChatRooms (Team Chat)
const GoogleDriveLinks = lazyWithRetry(() => import('@/components/google-drive-links'));
const DashboardOverview = lazyWithRetry(() => import('@/components/dashboard-overview'));
const SandwichCollectionLog = lazyWithRetry(() => import('@/components/sandwich-collection-log'));
const RecipientsManagement = lazyWithRetry(() => import('@/components/recipients-management'));
const DriversManagement = lazyWithRetry(() => import('@/components/drivers-management-simple'));
const VolunteerManagement = lazyWithRetry(() => import('@/components/volunteer-management'));
const HostsManagement = lazyWithRetry(() => import('@/components/hosts-management-consolidated'));
const DocumentManagement = lazyWithRetry(() => import('@/components/document-management'));
const ImportantDocuments = lazyWithRetry(() => import('@/pages/important-documents'));
const BulkDataManager = lazyWithRetry(() => import('@/components/bulk-data-manager'));
const HostAnalytics = lazyWithRetry(() => import('@/components/host-analytics'));
const EnhancedMeetingDashboard = lazyWithRetry(() => import('@/components/enhanced-meeting-dashboard'));
const RoleDemo = lazyWithRetry(() => import('@/pages/role-demo'));
const ProjectsManagement = lazyWithRetry(() => import('@/components/projects'));
const ProjectDetailClean = lazyWithRetry(() => import('@/pages/project-detail-clean'));
const Analytics = lazyWithRetry(() => import('@/pages/analytics'));
const ImpactDashboard = lazyWithRetry(() => import('@/pages/impact-dashboard'));
const DataManagement = lazyWithRetry(() => import('@/pages/data-management'));
const PerformanceDashboard = lazyWithRetry(() => import('@/pages/performance-dashboard'));
const GrantMetrics = lazyWithRetry(() => import('@/pages/grant-metrics'));
const WeeklyCollectionsReport = lazyWithRetry(() => import('@/pages/weekly-collections-report'));
const GroupCollectionsViewer = lazyWithRetry(() => import('@/pages/group-collections-viewer'));
const UserManagementRedesigned = lazyWithRetry(() => import('@/components/user-management-redesigned'));
const UserProfile = lazyWithRetry(() => import('@/components/user-profile'));
const OnboardingAdmin = lazyWithRetry(() => import('@/pages/onboarding-admin'));
const WorkLogPage = lazyWithRetry(() => import('@/pages/work-log'));
const SuggestionsPortal = lazyWithRetry(() => import('@/pages/suggestions'));
const GoogleSheetsPage = lazyWithRetry(() => import('@/pages/google-sheets'));
const PlanningSheetProposalsPage = lazyWithRetry(() => import('@/pages/planning-sheet-proposals'));
const RealTimeMessages = lazyWithRetry(() => import('@/pages/real-time-messages'));
const GmailStyleInbox = lazyWithRetry(() => import('@/components/gmail-style-inbox'));
const MessagingInbox = lazyWithRetry(() => import('@/pages/messaging-inbox'));
const ToolkitTabs = lazyWithRetry(() => import('@/components/toolkit-tabs').then(m => ({ default: m.ToolkitTabs })));
const KudosInbox = lazyWithRetry(() => import('@/components/kudos-inbox').then(m => ({ default: m.KudosInbox })));
const StreamChatRooms = lazyWithRetry(() => import('@/components/stream-chat-rooms'));
const EventsViewer = lazyWithRetry(() => import('@/components/events-viewer'));
const SignUpGeniusViewer = lazyWithRetry(() => import('@/components/signup-genius-viewer'));
const DonationTracking = lazyWithRetry(() => import('@/components/donation-tracking'));
const WeeklyMonitoringDashboard = lazyWithRetry(() => import('@/components/weekly-monitoring-dashboard'));
const WishlistPage = lazyWithRetry(() => import('@/pages/wishlist'));
const HoldingZone = lazyWithRetry(() => import('@/pages/HoldingZone'));
const PromotionGraphics = lazyWithRetry(() => import('@/pages/promotion-graphics'));
const QuickSMSLinks = lazyWithRetry(() => import('@/pages/quick-sms-links'));
const CoolerTrackingPage = lazyWithRetry(() => import('@/pages/cooler-tracking'));
const EventRequestsManagement = lazyWithRetry(() => import('@/components/event-requests'));
const EventOperationalDashboard = lazyWithRetry(() => import('@/components/event-operational-dashboard'));
const EventRemindersManagement = lazyWithRetry(() => import('@/components/event-reminders-management'));
const GroupCatalog = lazyWithRetry(() => import('@/components/organizations-catalog'));
const GroupsInsightsDashboard = lazyWithRetry(() => import('@/components/groups-insights-dashboard'));
const EventContactsDirectory = lazyWithRetry(() => import('@/components/event-contacts-directory'));
const EventContactDetail = lazyWithRetry(() => import('@/pages/event-contact-detail'));
const ActionTracking = lazyWithRetry(() => import('@/components/action-tracking-enhanced'));
const LogosPage = lazyWithRetry(() => import('@/pages/logos'));
const ImportantLinks = lazyWithRetry(() => import('@/pages/important-links'));
const Resources = lazyWithRetry(() => import('@/pages/resources').then(m => ({ default: m.Resources })));
const AutoFormFiller = lazyWithRetry(() => import('@/pages/auto-form-filler').then(m => ({ default: m.AutoFormFiller })));
const EventRequestAuditLog = lazyWithRetry(() => import('@/components/event-request-audit-log').then(m => ({ default: m.EventRequestAuditLog })));
const HistoricalImport = lazyWithRetry(() => import('@/pages/historical-import'));
const MyAvailability = lazyWithRetry(() => import('@/pages/my-availability'));
const TeamAvailability = lazyWithRetry(() => import('@/pages/team-availability'));
const GoogleCalendarAvailability = lazyWithRetry(() => import('@/pages/google-calendar-availability'));
const RouteMapView = lazyWithRetry(() => import('@/pages/route-map'));
const EventMapView = lazyWithRetry(() => import('@/pages/event-map'));
const Help = lazyWithRetry(() => import('@/pages/Help'));
const ExpensesPage = lazyWithRetry(() => import('@/pages/ExpensesPage'));
const AdminSettings = lazyWithRetry(() => import('@/pages/admin-settings'));
const DesignSystemShowcase = lazyWithRetry(() => import('@/pages/design-system-showcase'));
const SmartSearchAdmin = lazyWithRetry(() => import('@/pages/smart-search-admin'));
const OrganizationsMerge = lazyWithRetry(() => import('@/pages/admin/organizations-merge'));
const GenerateServiceHours = lazyWithRetry(() => import('@/pages/generate-service-hours'));
const TSPNetwork = lazyWithRetry(() => import('@/pages/tsp-network'));
const EventImpactReports = lazyWithRetry(() => import('@/pages/event-impact-reports'));
const DriverPlanningDashboard = lazyWithRetry(() => import('@/pages/driver-planning'));
const VolunteerEventHub = lazyWithRetry(() => import('@/pages/volunteer-event-hub'));
const HostResources = lazyWithRetry(() => import('@/pages/host-resources'));
const YearlyCalendar = lazyWithRetry(() => import('@/pages/yearly-calendar'));
const Directory = lazyWithRetry(() => import('@/pages/directory'));

import sandwich_logo from '@assets/CMYK_PRINT_TSP-01_1749585167435.png';

import sandwich_20logo from '@assets/LOGOS/sandwich logo.png';
import { logger } from '@/lib/logger';

// Loading fallback component for lazy-loaded sections
const SectionLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading section...</p>
      <p className="text-xs text-muted-foreground/60 mt-2">This may take a moment on first load</p>
    </div>
  </div>
);

// Bridge component that sits inside MultiViewProvider and routes sidebar clicks
// to the currently focused panel instead of always the primary panel
function MultiViewSidebar({
  navigationItems,
  isCollapsed,
  onMobileClose,
  onTrackNavigation,
  dashboardSetActiveSection,
}: {
  navigationItems: typeof NAV_ITEMS;
  isCollapsed: boolean;
  onMobileClose: () => void;
  onTrackNavigation: (section: string, from: string) => void;
  dashboardSetActiveSection: (section: string) => void;
}) {
  const [location, setLocation] = useLocation();
  const { isMultiViewEnabled, activePanel, panels, navigateActivePanel } = useMultiView();

  // In multi-view mode, show the focused panel's section as the active highlight
  const effectiveActiveSection = React.useMemo(() => {
    if (isMultiViewEnabled && activePanel) {
      const focusedPanel = panels.find(p => p.id === activePanel);
      if (focusedPanel) return focusedPanel.section;
    }
    // Fall back to primary panel's section
    const primary = panels.find(p => p.id === 'primary');
    return primary?.section || 'dashboard';
  }, [isMultiViewEnabled, activePanel, panels]);

  const handleSectionChange = React.useCallback((section: string) => {
    logger.log('MultiViewSidebar navigation:', section, 'multiView:', isMultiViewEnabled, 'activePanel:', activePanel);

    // Track navigation
    onTrackNavigation(section, effectiveActiveSection);

    // Handle standalone routes (navigate away from dashboard)
    if (section === 'help') {
      setLocation('/help');
      onMobileClose();
      return;
    }

    if (isMultiViewEnabled) {
      // In multi-view: navigate the focused panel directly
      navigateActivePanel(section);
    } else {
      // Single view: use the dashboard-level state as before
      dashboardSetActiveSection(section);
    }

    onMobileClose();

    // Update URL for back button support (reflects the navigated section)
    const newUrl = section === 'dashboard'
      ? '/dashboard'
      : `/dashboard?section=${section}`;
    window.history.pushState({}, '', newUrl);
  }, [isMultiViewEnabled, activePanel, navigateActivePanel, dashboardSetActiveSection, effectiveActiveSection, onTrackNavigation, onMobileClose, setLocation]);

  return (
    <SimpleNav
      navigationItems={navigationItems}
      activeSection={effectiveActiveSection}
      onSectionChange={handleSectionChange}
      isCollapsed={isCollapsed}
    />
  );
}

export default function Dashboard({
  initialSection = 'dashboard',
}: {
  initialSection?: string;
}) {
  const [location, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedHost, setSelectedHost] = useState<string>('');

  // Helper function to get readable section/page names for activity tracking
  const getActivityContext = (section: string) => {
    const sectionMap: Record<string, { section: string; page: string }> = {
      'dashboard': { section: 'Dashboard', page: 'Main Dashboard' },
      'collections': { section: 'Collections', page: 'Collections Log' },
      'event-requests': { section: 'Event Planning', page: 'Event Requests' },
      'event-ops-dashboard': { section: 'Event Planning', page: 'Ops Dashboard' },
      'admin-overview': { section: 'Event Planning', page: 'Admin Overview' },
      'event-calendar': { section: 'Event Planning', page: 'Event Calendar' },
      'event-conflict-detection': { section: 'Event Planning', page: 'Conflict Detection' },
      'driver-planning': { section: 'Event Planning', page: 'Driver Planning' },
      'contacts-directory': { section: 'Contacts', page: 'Contacts Directory' },
      'organizations-directory': { section: 'Organizations', page: 'Organizations Directory' },
      'hosts-directory': { section: 'Hosts', page: 'Hosts Directory' },
      'host-stats': { section: 'Hosts', page: 'Host Statistics' },
      'all-locations': { section: 'Locations', page: 'All Locations' },
      'impact': { section: 'Analytics', page: 'Impact Dashboard' },
      'analytics': { section: 'Analytics', page: 'Analytics' },
      'reports': { section: 'Reports', page: 'Reports' },
      'expense-management': { section: 'Finance', page: 'Expense Management' },
      'chat': { section: 'Communication', page: 'Team Chat' },
      'gmail-inbox': { section: 'Communication', page: 'Gmail Inbox' },
      'announcements': { section: 'Communication', page: 'Announcements' },
      'project-list': { section: 'Projects', page: 'Project List' },
      'holding-zone': { section: 'Collections', page: 'Holding Zone' },
      'weekly-summary': { section: 'Collections', page: 'Weekly Summary' },
      'user-management': { section: 'Administration', page: 'User Management' },
      'role-management': { section: 'Administration', page: 'Role Management' },
      'settings': { section: 'Administration', page: 'Settings' },
      'kudos': { section: 'Recognition', page: 'Kudos' },
      'profile': { section: 'Profile', page: 'My Profile' },
      'help': { section: 'Help', page: 'Help Center' },
    };

    return sectionMap[section] || { section: 'Dashboard', page: section };
  };

  const activityContext = getActivityContext(activeSection);

  // Track page session for activity logging
  usePageSession({
    section: activityContext.section,
    page: activityContext.page,
    context: { currentSection: activeSection },
  });

  // Show toast notifications when other users come online
  useOnlinePresenceNotifications();

  // Command palette for quick navigation (Cmd+K)
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette();

  // Parse URL query parameters
  const urlParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      section: searchParams.get('section'),
      tab: searchParams.get('tab'),
      eventId: searchParams.get('eventId'),
      view: searchParams.get('view'),
      id: searchParams.get('id'),
    };
  }, [location]);

  // Listen to URL changes to update activeSection
  React.useEffect(() => {
    logger.log('Current URL location:', location);

    // Check for section in query parameters first
    if (urlParams.section) {
      logger.log('Setting activeSection from query parameter:', urlParams.section);
      
      // Handle special case for project detail view via query parameters
      if (urlParams.section === 'projects' && urlParams.view === 'detail' && urlParams.id) {
        const projectSection = `project-${urlParams.id}`;
        logger.log('Setting activeSection to project detail:', projectSection);
        setActiveSection(projectSection);
        return;
      }
      
      setActiveSection(urlParams.section);
      return;
    }

    // Extract section from URL path (strip query parameters)
    const pathWithoutQuery = location.split('?')[0];
    
    if (pathWithoutQuery.startsWith('/projects/')) {
      const parts = pathWithoutQuery.split('/projects/');
      const projectId = parts.length > 1 ? parts[1] : null;
      if (projectId) {
        const newSection = `project-${projectId}`;
        logger.log('Setting activeSection to project ID:', newSection);
        setActiveSection(newSection);
      }
    } else if (pathWithoutQuery.startsWith('/event-contact/')) {
      // Handle event contact detail route - keep section as 'event-contact-detail'
      // The EventContactDetail component will extract the ID from the URL
      logger.log('Setting activeSection to event-contact-detail');
      setActiveSection('event-contact-detail');
    } else {
      // Handle other sections - strip query parameters and leading slash
      const pathSection = pathWithoutQuery.substring(1) || 'dashboard';
      logger.log('Setting activeSection to:', pathSection);
      setActiveSection(pathSection);
    }
  }, [location, urlParams.section]);

  // Debug logging
  React.useEffect(() => {
    logger.log('Dashboard activeSection changed to:', activeSection);
  }, [activeSection]);

  // Enhanced setActiveSection with debugging and query param support
  const enhancedSetActiveSection = (section: string) => {
    logger.log('📍 Dashboard setActiveSection called with:', section);

    // Check if section includes query parameters
    if (section.includes('?')) {
      const [basePath, queryString] = section.split('?');
      setActiveSection(basePath);
      // Update URL with query parameters using window.history
      const newUrl = `${window.location.pathname}?section=${basePath}&${queryString}`;
      window.history.pushState({}, '', newUrl);
      // Force a location update to trigger effects
      setLocation(window.location.pathname + window.location.search);
    } else {
      setActiveSection(section);
    }
  };
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { user, isLoading } = useAuth();
  const { trackNavigation, trackButtonClick } = useAnalytics();

  // Prefetch event requests data for faster navigation.
  // IMPORTANT: Keep cache keys aligned with EventRequestContext so we actually reuse warmed cache.
  React.useEffect(() => {
    // Prefetch status counts (lightweight, always useful)
    queryClient.prefetchQuery({
      queryKey: ['/api/event-requests/status-counts'],
      queryFn: async () => {
        const response = await fetch('/api/event-requests/status-counts', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch status counts');
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

    // Prefetch the lightweight list for the user's role default tab.
    // (Admins default to 'scheduled', drivers/volunteers default to 'my_assignments', etc.)
    if (user?.role) {
      const defaults = getEventRequestDefaults(user.role, user.id);
      const { queryKey, listUrl } = buildEventRequestsListQuery(defaults.defaultTab, null);

      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const response = await fetch(listUrl, { credentials: 'include' });
          if (!response.ok) throw new Error('Failed to fetch event requests');
          return response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    }
  }, [user?.role, user?.id]);

  // Preload commonly used component chunks after initial render
  // This helps prevent "reload" errors by ensuring chunks are ready before navigation
  React.useEffect(() => {
    // Wait a bit for initial render to complete, then preload common sections
    const preloadTimeout = setTimeout(() => {
      // Preload the most commonly accessed sections in background
      // Using dynamic import directly (not the lazy wrapper) to just fetch the chunk
      const preloadImports = [
        () => import('@/components/dashboard-overview'),
        () => import('@/components/sandwich-collection-log'),
        () => import('@/components/event-requests'),
        () => import('@/components/stream-chat-rooms'),
        () => import('@/components/action-tracking-enhanced'),
        () => import('@/pages/my-availability'),
      ];

      // Load one at a time with small delays to avoid network congestion
      preloadImports.forEach((importFn, index) => {
        setTimeout(() => {
          importFn().catch(() => {
            // Silently ignore preload failures - the retry mechanism will handle it later
          });
        }, index * 200); // Stagger loads by 200ms each
      });
    }, 1000); // Wait 1 second after mount before preloading

    return () => clearTimeout(preloadTimeout);
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };


  const renderContent = (sectionOverride?: string) => {
    const rawSection = sectionOverride || activeSection;
    // Use base path for switch (strip query string) so panels with e.g. event-requests?tab=admin_overview render correctly
    const section = rawSection.includes('?') ? rawSection.split('?')[0] : rawSection;
    // Extract project ID from section if it's a project detail page
    const projectIdMatch = section.match(/^project-(\d+)$/);
    const projectId =
      projectIdMatch && projectIdMatch[1] ? parseInt(projectIdMatch[1]) : null;

    // Handle project detail pages
    if (projectId) {
      return <ProjectDetailClean projectId={projectId} />;
    }

    switch (section) {
      case 'dashboard':
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case 'collections':
        return <SandwichCollectionLog />;
      case 'events':
        return <EventsViewer />;
      case 'signup-genius':
        return <SignUpGeniusViewer />;
      case 'donation-tracking':
        return <DonationTracking />;
      case 'weekly-monitoring':
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">
                  Weekly Monitoring
                </h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Track weekly submission status and send email notifications
                  for missing data
                </p>
              </div>
            </div>
            <WeeklyMonitoringDashboard />
          </div>
        );
      case 'inventory-calculator':
        // Open the inventory calculator in a new tab and return to dashboard
        window.open(
          'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html',
          '_blank'
        );
        setActiveSection('dashboard');
        return <DashboardOverview onSectionChange={setActiveSection} />;
      case 'important-documents':
        return <ImportantDocuments />;
      case 'resources':
        return <Resources />;
      case 'auto-form-filler':
        return <AutoFormFiller />;
      case 'projects':
        logger.log('Rendering ProjectsManagement component');
        return <ProjectsManagement />;
      case 'real-time-messages':
        return <RealTimeMessages />;
      case 'messages':
        return <GmailStyleInbox />;
      case 'gmail-inbox':
        return <GmailStyleInbox />;
      case 'inbox':
        return <GmailStyleInbox />;
      case 'messaging-inbox':
        return <MessagingInbox />;
      case 'stream-messages':
        return <RealTimeMessages />;
      case 'chat':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-shrink-0 flex items-center gap-4 p-6 pb-2 border-b border-gray-200">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">Team Chat</h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Real-time communication with your team across different
                  channels
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <StreamChatRooms />
            </div>
          </div>
        );
      case 'kudos':
        return (
          <div className="space-y-6 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-yellow-100">
                <Trophy className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 break-words">Your Kudos</h1>
                <p className="text-sm sm:text-base text-gray-600 break-words">
                  Recognition received for your great work
                </p>
              </div>
            </div>
            <KudosInbox />
          </div>
        );
      case 'profile':
        return <UserProfile />;
      case 'meetings':
        return <EnhancedMeetingDashboard />;

      case 'toolkit':
        return <ToolkitTabs />;

      case 'documents':
      case 'document-management':
        return <DocumentManagement />;

      case 'tsp-network':
        return <TSPNetwork />;
      case 'hosts':
        return <HostsManagement />;
      case 'route-map':
      case 'recipient-map':
        // Both route-map and recipient-map now use the combined Locations Map
        return <RouteMapView />;
      case 'event-map':
        return <EventMapView />;
      case 'driver-planning':
        return <DriverPlanningDashboard />;
      case 'volunteer-hub':
        return <VolunteerEventHub />;
      case 'host-resources':
        return <HostResources />;
      case 'recipients':
        return <RecipientsManagement />;
      case 'drivers':
        return <DriversManagement />;
      case 'volunteers':
        return <VolunteerManagement />;
      case 'directory':
        return <Directory />;
      case 'event-requests':
        return (
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="max-w-md p-6 text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Event Requests Unavailable
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    There was an issue loading Event Requests. Other features are still available.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            }
          >
            <EventRequestsManagement
              initialTab={urlParams.tab}
              initialEventId={urlParams.eventId ? parseInt(urlParams.eventId) : undefined}
            />
          </ErrorBoundary>
        );
      case 'event-ops-dashboard':
        return <EventOperationalDashboard />;
      case 'event-reminders':
        return <EventRemindersManagement />;
      case 'historical-import':
        return <HistoricalImport />;
      case 'groups-catalog':
        return (
          <GroupCatalog
            onNavigateToEventPlanning={() => setActiveSection('event-requests')}
          />
        );
      case 'groups-insights':
        return <GroupsInsightsDashboard />;
      case 'event-contacts-directory':
        return <EventContactsDirectory />;
      case 'event-contact-detail':
        return <EventContactDetail />;
      case 'action-tracking':
        return <ActionTracking />;
      case 'my-actions':
        return <ActionTracking />;

      case 'wishlist':
        return <WishlistPage />;
      case 'team-board':
        return <HoldingZone />;
      case 'calendars':
        return <YearlyCalendar />;
      case 'yearly-calendar':
        return <YearlyCalendar />;
      case 'promotion':
        return <PromotionGraphics />;
      case 'quick-sms-links':
        return <QuickSMSLinks />;
      case 'cooler-tracking':
        return <CoolerTrackingPage />;
      case 'important-links':
        return <ImportantLinks />;
      case 'analytics':
        return (
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-lg sm:text-xl md:text-2xl font-main-heading text-primary break-words">
                Impact & Analytics Dashboard
              </h1>
              <p className="text-sm sm:text-base font-body text-muted-foreground break-words">
                Track community impact, collection trends, and host performance
              </p>
            </div>
            <Tabs defaultValue="impact" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10 bg-brand-primary/10 border-brand-primary/20">
                <TabsTrigger
                  value="impact"
                  className="text-xs sm:text-sm data-[state=active]:bg-brand-primary data-[state=active]:text-white text-brand-primary"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Impact Dashboard
                </TabsTrigger>
                <TabsTrigger
                  value="hosts"
                  className="text-xs sm:text-sm data-[state=active]:bg-brand-primary data-[state=active]:text-white text-[#646464]"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Host Analytics
                </TabsTrigger>
              </TabsList>
              <TabsContent value="impact" className="mt-6">
                <ImpactDashboard />
              </TabsContent>
              <TabsContent value="hosts" className="mt-6">
                <HostAnalytics
                  selectedHost={selectedHost}
                  onHostChange={setSelectedHost}
                />
              </TabsContent>
            </Tabs>
          </div>
        );
      case 'grant-metrics':
        return <GrantMetrics />;
      case 'event-impact-reports':
        return <EventImpactReports />;
      case 'weekly-collections-report':
        return <WeeklyCollectionsReport />;
      case 'group-collections':
        return <GroupCollectionsViewer />;
      case 'role-demo':
        return <RoleDemo />;
      case 'work-log':
        return <WorkLogPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'suggestions':
        return <SuggestionsPortal />;
      case 'google-sheets':
        return <GoogleSheetsPage />;
      case 'planning-sheet-proposals':
        return <PlanningSheetProposalsPage />;
      // Legacy 'committee' and 'committee-chat' routes redirect to Stream Chat
      case 'committee':
      case 'committee-chat':
        // Redirect to main Team Chat
        return <StreamChatRooms />;
      case 'my-availability':
        return <MyAvailability />;
      case 'team-availability':
        return <TeamAvailability />;
      case 'google-calendar-availability':
        return <GoogleCalendarAvailability />;
      case 'user-management':
        return <UserManagementRedesigned />;
      case 'onboarding-admin':
        return <OnboardingAdmin />;
      case 'admin':
        return <AdminSettings />;
      case 'help':
        return <Help />;
      case 'design-system':
        return <DesignSystemShowcase />;
      case 'smart-search-admin':
        return <SmartSearchAdmin />;
      case 'organizations-merge':
        return <OrganizationsMerge />;
      case 'generate-service-hours':
        return <GenerateServiceHours />;
      default:
        // Handle project detail pages
        if (projectId) {
          return <ProjectDetailClean projectId={projectId} />;
        }
        // Handle legacy project routes
        if (section.startsWith('project-')) {
          const legacyProjectId = parseInt(
            section.replace('project-', '')
          );
          if (!isNaN(legacyProjectId)) {
            return <ProjectDetailClean projectId={legacyProjectId} />;
          }
        }
        return <DashboardOverview onSectionChange={setActiveSection} />;
    }
  };

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // If not authenticated after loading, redirect or show error
  if (!user) {
    window.location.href = '/';
    return null;
  }

  return (
    <>
      {/* Real-Time Kudos Notifier */}
      <RealTimeKudosNotifier />
      <LoginMessageNotifier />
      <TextIdeaAnnouncementModal />
      <WhatsNewModal />

      {/* Command Palette for quick navigation (Cmd+K) */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />

      <DashboardNavigationProvider setActiveSection={enhancedSetActiveSection}>
        <MultiViewProvider initialSection={activeSection}>
        <div className="bg-gray-50 min-h-screen flex flex-col overflow-x-hidden safe-area-inset">
        {/* Reviewer Banner - shows for read-only reviewer accounts */}
        <ReviewerBanner />
        {/* Announcement Banner */}
        <AnnouncementBanner />
        
        {/* Top Header */}
        <div className="bg-brand-primary border-b border-brand-primary-dark shadow-md px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center mobile-header-fix min-h-[60px] sm:min-h-[70px] overflow-x-hidden max-w-full">
          <div className="flex items-center space-x-2 min-w-0 flex-shrink-0">
            {/* Mobile menu button - positioned first for easy access */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors touch-manipulation relative z-60"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <img
              src={sandwich_20logo}
              alt="Sandwich Logo"
              className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
              width="24"
              height="24"
            />
            <h1 className="text-base sm:text-lg font-semibold text-white hidden lg:block truncate">
              The Sandwich Project
            </h1>
            <h1 className="text-sm font-semibold text-white lg:hidden truncate">
              TSP
            </h1>
          </div>

          {/* Flexible spacer - min width to ensure buttons don't get pushed off */}
          <div className="flex-1 min-w-0" />

          {/* Right side container - optimized for tablets/mobile */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Compact user indicator for tablets - hidden on very small screens */}
            {user && (
              <div className="hidden xs:flex items-center gap-1 sm:gap-2 px-2 py-1.5 bg-white/15 rounded-lg border border-white/20 max-w-[100px] sm:max-w-[150px] md:max-w-none">
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white">
                    {(user as any)?.firstName?.charAt(0) ||
                      (user as any)?.email?.charAt(0) ||
                      'U'}
                  </span>
                </div>
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white truncate">
                    {(user as any)?.firstName
                      ? `${(user as any).firstName} ${
                          (user as any)?.lastName || ''
                        }`.trim()
                      : (user as any)?.email}
                  </span>
                  <span className="text-xs text-white/70 truncate">
                    {(user as any)?.email}
                  </span>
                </div>
                <div className="lg:hidden min-w-0 flex-1">
                  <span className="text-xs font-medium text-white truncate block">
                    {(user as any)?.firstName
                      ? `${(user as any).firstName}`
                      : (user as any)?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
              </div>
            )}

            {/* Header actions - organized into logical groups */}
            <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1 sm:gap-2 relative z-50 flex-shrink-0">
              
              {/* Group 1: Communication */}
              <div className="flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        logger.log('Team Chat button clicked');
                        trackButtonClick('chat', 'dashboard_header');
                        setActiveSection('chat');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                        activeSection === 'chat'
                          ? 'bg-white text-brand-primary shadow-sm'
                          : 'text-white/80 hover:bg-white/15 hover:text-white'
                      }`}
                      aria-label="Team Chat"
                    >
                      <Hash className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Team Chat</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        logger.log('Project Threads button clicked');
                        trackButtonClick('project-threads', 'dashboard_header');
                        setActiveSection('gmail-inbox');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                        activeSection === 'gmail-inbox'
                          ? 'bg-white text-brand-primary shadow-sm'
                          : 'text-white/80 hover:bg-white/15 hover:text-white'
                      }`}
                      aria-label="Project Threads"
                    >
                      <Inbox className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Project Threads</TooltipContent>
                </Tooltip>

                {/* Online users - hide on mobile */}
                <div className="hidden sm:block">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <OnlineUsers />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>Who's Online</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Group 2: Notifications */}
              <div className="flex items-center gap-0.5">
                {typeof window !== 'undefined' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <EnhancedNotifications user={user} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>Notifications</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* Group 3: Help & Navigation */}
              <div className="hidden sm:flex items-center gap-0.5 bg-white/10 rounded-lg p-0.5">
                {NAV_ITEMS.filter(item => item.topNav && (!item.permission || hasPermission(user, item.permission))).map(item => {
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            logger.log(`${item.label} button clicked`);
                            trackButtonClick(item.id, 'dashboard_header');
                            localStorage.setItem('navigation_update_2024_v2_seen', 'true');
                            if (item.href === 'help') {
                              setLocation('/help');
                            } else {
                              setActiveSection(item.href);
                              window.history.pushState({}, '', `/dashboard?section=${item.href}`);
                            }
                            setIsMobileMenuOpen(false);
                          }}
                          className={`p-2 rounded-md transition-colors ${
                            activeSection === item.href
                              ? 'bg-white text-brand-primary shadow-sm'
                              : 'text-white/80 hover:bg-white/15 hover:text-white'
                          }`}
                          aria-label={item.label}
                        >
                          {Icon && <Icon className="w-4 h-4" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={8}>{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Group 4: Account Menu */}
              <div className="flex items-center gap-0.5 sm:gap-1 pl-1 border-l border-white/20">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        trackButtonClick('profile', 'dashboard_header');
                        setActiveSection('profile');
                        window.history.pushState({}, '', '/dashboard?section=profile');
                        setIsMobileMenuOpen(false);
                      }}
                      className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                        activeSection === 'profile'
                          ? 'bg-white text-brand-primary shadow-sm'
                          : 'text-white/80 hover:bg-white/15 hover:text-white'
                      }`}
                      aria-label="Account Settings"
                    >
                      <UserCog className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>Account Settings</TooltipContent>
                </Tooltip>

                <button
                  onClick={async () => {
                    try {
                      trackButtonClick('logout', 'dashboard_header');
                      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                      queryClient.clear();
                      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
                      queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
                      window.location.href = '/login';
                    } catch (error) {
                      logger.error('Logout error:', error);
                      queryClient.clear();
                      window.location.href = '/login';
                    }
                  }}
                  className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 text-white/80 hover:text-red-200 rounded-md hover:bg-white/10 transition-colors text-sm font-medium"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            </div>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex flex-1 relative pt-[60px] md:pt-0">
          {/* Mobile overlay */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar */}
          <div
            className={`${
              isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            } md:translate-x-0 fixed md:relative z-50 ${
              isSidebarCollapsed ? 'w-16' : 'w-56 xs:w-64 sm:w-72'
            } bg-gradient-to-b from-white to-orange-50/30 border-r-2 border-amber-200 shadow-lg flex flex-col transition-all duration-300 ease-in-out h-full`}
          >
            {/* Collapse Toggle Button */}
            <div className="hidden md:flex justify-end p-2 border-b border-amber-200">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                aria-label={
                  isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                }
                title={isSidebarCollapsed ? 'Click to expand navigation menu' : 'Click to collapse navigation menu'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-amber-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-700 rotate-90" />
                )}
              </button>
            </div>

            {/* Simple Navigation with enhanced mobile scrolling */}
            <div className="flex-1 overflow-y-auto pb-6 touch-pan-y overscroll-auto">
              <MultiViewSidebar
                navigationItems={NAV_ITEMS}
                isCollapsed={isSidebarCollapsed}
                onMobileClose={() => setIsMobileMenuOpen(false)}
                onTrackNavigation={trackNavigation}
                dashboardSetActiveSection={setActiveSection}
              />

              {/* EIN Information - Always visible at bottom */}
              {!isSidebarCollapsed && (
                <div className="px-4 mt-6 pt-4 border-t border-amber-200 space-y-3">
                  <div className="bg-gradient-to-r from-teal-50 to-teal-100 border border-teal-200 rounded-lg px-3 py-2">
                    <div className="text-xs text-teal-700 font-medium uppercase tracking-wide">
                      Organization EIN
                    </div>
                    <div className="text-sm font-bold text-teal-900 font-mono">
                      87-0939484
                    </div>
                  </div>

                  {/* Amazon Wishlist Quick Access */}
                  <div className="bg-gradient-to-r from-[#FBAD3F]/10 to-[#FBAD3F]/20 border-2 border-[#FBAD3F] rounded-lg px-3 py-2.5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-[#FBAD3F]" />
                        <div className="text-xs text-[#FBAD3F] font-bold uppercase tracking-wide">
                          Amazon Wishlist
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <a
                        href="https://www.amazon.com/hz/wishlist/ls/XRSQ9EDIIIWV/ref=nav_wishlist_lists_4"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-[#FBAD3F] hover:bg-[#E89A2F] text-white text-xs font-medium px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
                        title="Open Amazon Wishlist"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open on Amazon
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText('https://www.amazon.com/hz/wishlist/ls/XRSQ9EDIIIWV/ref=nav_wishlist_lists_4');
                          } catch (err) {
                            logger.error('Copy failed:', err);
                          }
                        }}
                        className="bg-[#FBAD3F]/20 hover:bg-[#FBAD3F]/30 text-[#FBAD3F] px-2 py-1.5 rounded transition-colors"
                        title="Copy wishlist link to clipboard"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden w-full md:w-auto relative z-10 bg-[#F6F9FA] min-w-0 flex flex-col">
            {/* Multi-View Toolbar */}
            <MultiViewToolbar currentSection={activeSection} />

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
              <MultiViewContainer
                renderContent={(section) => {
                  // Determine the content wrapper based on section type
                  const isFullHeightSection = ['gmail-inbox', 'inbox', 'messages', 'chat', 'route-map', 'recipient-map'].includes(section);
                  const isDriverPlanning = section === 'driver-planning';

                  if (isFullHeightSection) {
                    return <div className="h-full overflow-hidden">{renderContent(section)}</div>;
                  }

                  if (isDriverPlanning) {
                    return (
                      <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden w-full max-w-full">
                        {renderContent(section)}
                      </div>
                    );
                  }

                  // Normal layout for other content
                  return (
                    <div className="h-full overflow-y-auto overflow-x-hidden w-full max-w-full">
                      <div className="w-full pb-20 min-h-full px-4 sm:px-6 pt-6">
                        <DashboardBreadcrumbs activeSection={section} />
                        {renderContent(section)}
                      </div>
                    </div>
                  );
                }}
                onSectionChange={(section, panelId) => {
                  // Update panel section when navigation happens within a panel
                  enhancedSetActiveSection(section);
                }}
              />
            </div>
          </div>
        </div>
        </div>

        {/* Guided Tour System */}
        <GuidedTour />

        {/* AI Assistant - Only show on sections that don't have their own AI chat */}
        {!['event-requests', 'event-ops-dashboard', 'collections', 'analytics', 'grant-metrics', 'weekly-monitoring', 'event-impact-reports', 'team-board', 'tsp-network', 'projects', 'resources', 'important-links', 'meetings', 'groups-catalog'].includes(activeSection) && (
          <FloatingAIChat
            contextType="dashboard"
            title="TSP Assistant"
            subtitle="Ask anything about the platform"
            suggestedQuestions={[
              "What can I do on this platform?",
              "How do I add a new collection?",
              "What reports are available?",
              "How do I manage volunteers?",
              "Show me recent activity",
              "What's the status of our projects?",
            ]}
          />
        )}

        {/* Floating Views Container for pop-out windows */}
        <FloatingViewsContainer renderContent={renderContent} />
        </MultiViewProvider>
      </DashboardNavigationProvider>
    </>
  );
}
