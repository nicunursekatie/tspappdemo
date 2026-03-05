import { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Calendar,
  XCircle,
  UserCheck,
  Star,
  Pause,
  BarChart3,
  ClipboardList,
  LayoutList,
  Hourglass,
  AlertCircle,
  Ban,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { X, Sparkles } from 'lucide-react';

interface RequestFiltersProps {
  // Search and filter states
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
  confirmationFilter: 'all' | 'confirmed' | 'requested';
  onConfirmationFilterChange: (filter: 'all' | 'confirmed' | 'requested') => void;
  sortBy: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc';
  onSortByChange: (sort: 'event_date_desc' | 'event_date_asc' | 'organization_asc' | 'organization_desc' | 'created_date_desc' | 'created_date_asc') => void;

  // Tab state
  activeTab: string;
  onActiveTabChange: (tab: string) => void;

  // Pagination state
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;

  // Status counts for tab badges
  statusCounts: {
    all: number;
    new: number;
    in_process: number;
    scheduled: number;
    completed: number;
    declined: number;
    postponed: number;
    cancelled: number;
    standby: number;
    stalled: number;
    my_assignments: number;
  };
  statusCountsLoading?: boolean;

  // Content for each tab
  children: {
    all: ReactNode;
    new: ReactNode;
    in_process: ReactNode;
    scheduled: ReactNode;
    completed: ReactNode;
    declined: ReactNode;
    postponed: ReactNode;
    standby: ReactNode;
    stalled: ReactNode;
    my_assignments: ReactNode;
    admin_overview?: ReactNode;
    planning?: ReactNode;
  };

  // Pagination info
  totalItems: number;
  totalPages: number;

  // Feature discovery
  showAdminOverviewTip?: boolean;
  showSpreadsheetTip?: boolean;
  onDismissAdminOverviewTip?: () => void;
  onDismissSpreadsheetTip?: () => void;
}

export default function RequestFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  confirmationFilter,
  onConfirmationFilterChange,
  sortBy,
  onSortByChange,
  activeTab,
  onActiveTabChange,
  currentPage,
  onCurrentPageChange,
  itemsPerPage,
  onItemsPerPageChange,
  statusCounts,
  statusCountsLoading,
  children,
  totalItems,
  totalPages,
  showAdminOverviewTip,
  showSpreadsheetTip,
  onDismissAdminOverviewTip,
  onDismissSpreadsheetTip,
}: RequestFiltersProps) {
  const { user } = useAuth();

  // Helper to format count display - shows loading indicator when counts are loading
  const formatCount = (count: number | undefined): string => {
    if (statusCountsLoading) return '...';
    return count !== undefined ? String(count) : '';
  };

  // Support both old and new permission strings for backward compatibility
  const hasAdminOverviewPermission = user?.permissions?.includes(PERMISSIONS.EVENT_REQUESTS_VIEW_ADMIN_OVERVIEW) ||
    user?.permissions?.includes('view_admin_overview') ||
    user?.role === 'super_admin';

  // Tab configuration with icons and labels
  const tabConfig = [];

  // Add admin overview tab first if user has permission
  if (hasAdminOverviewPermission && children.admin_overview) {
    tabConfig.push({
      value: 'admin_overview',
      label: 'Admin Overview',
      shortLabel: 'Admin',
      icon: BarChart3,
    });
  }

  // Add planning tab if user has permission
  if (hasAdminOverviewPermission && children.planning) {
    tabConfig.push({
      value: 'planning',
      label: 'Planning',
      shortLabel: 'Planning',
      icon: ClipboardList,
    });
  }

  // Add remaining tabs
  tabConfig.push(
    {
      value: 'my_assignments',
      label: 'My Assignments',
      shortLabel: 'Mine',
      icon: UserCheck,
      count: statusCounts.my_assignments,
    },
    {
      value: 'all',
      label: 'All',
      shortLabel: 'All',
      icon: LayoutList,
      count: statusCounts.all,
    },
    {
      value: 'new',
      label: 'New',
      shortLabel: 'New',
      icon: Star,
      count: statusCounts.new,
      hasNotification: statusCounts.new > 0,
    },
    {
      value: 'in_process',
      label: 'In Process',
      shortLabel: 'Process',
      icon: Clock,
      count: statusCounts.in_process,
    },
    {
      value: 'scheduled',
      label: 'Scheduled',
      shortLabel: 'Scheduled',
      icon: Calendar,
      count: statusCounts.scheduled + statusCounts.rescheduled,
    },
    {
      value: 'rescheduled',
      label: 'Rescheduled',
      shortLabel: 'Resched',
      icon: RefreshCw,
      count: statusCounts.rescheduled,
    },
    {
      value: 'completed',
      label: 'Completed',
      shortLabel: 'Done',
      icon: CheckCircle,
      count: statusCounts.completed,
    },
    {
      value: 'declined',
      label: 'Declined/Cancelled',
      shortLabel: 'D/C',
      icon: XCircle,
      count: statusCounts.declined + statusCounts.cancelled,
    },
    {
      value: 'postponed',
      label: 'Postponed',
      shortLabel: 'Postponed',
      icon: Pause,
      count: statusCounts.postponed,
    },
    {
      value: 'standby',
      label: 'Standby',
      shortLabel: 'Standby',
      icon: Hourglass,
      count: statusCounts.standby,
    },
    {
      value: 'stalled',
      label: 'Stalled',
      shortLabel: 'Stalled',
      icon: AlertCircle,
      count: statusCounts.stalled,
    },
    {
      value: 'non_event',
      label: 'Non-Event',
      shortLabel: 'N/E',
      icon: Ban,
      count: statusCounts.non_event,
    }
  );

  // Get current tab info for mobile selector
  const currentTab = tabConfig.find(tab => tab.value === activeTab);

  return (
    <div className="space-y-6">
      {/* Search - Always visible */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#007E8C] w-4 h-4" />
        <Input
          id="event-requests-search"
          placeholder="Search by organization, name, email, date, location, TSP contact, or volunteer..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 w-full"
          data-testid="input-search-requests"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#007E8C] hover:text-[#004f57] font-semibold"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile: Compact filters in a single row with labels */}
      <div className="md:hidden flex gap-2">
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-500 mb-1 block">Status</label>
          <Select value={activeTab} onValueChange={onActiveTabChange}>
            <SelectTrigger className="h-9 text-sm">
              <div className="flex items-center space-x-1.5 truncate">
                {currentTab && (
                  <>
                    <currentTab.icon className="w-3.5 h-3.5 text-[#007E8C] flex-shrink-0" />
                    <span className="truncate">{currentTab.shortLabel}</span>
                    {currentTab.count !== undefined && <span className="text-gray-500 text-xs">({formatCount(currentTab.count)})</span>}
                  </>
                )}
              </div>
            </SelectTrigger>
            <SelectContent className="mobile-select-content">
              {tabConfig.map((tab) => (
                <SelectItem key={tab.value} value={tab.value} className="mobile-select-item">
                  <div className="flex items-center space-x-2">
                    <tab.icon className="w-4 h-4 text-[#007E8C]" />
                    <span>{tab.label}</span>
                    {tab.count !== undefined && <span className="text-gray-500">({formatCount(tab.count)})</span>}
                    {tab.hasNotification && !statusCountsLoading && (
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 flex-shrink-0">
          <label className="text-xs text-gray-500 mb-1 block">Filter</label>
          <Select
            value={confirmationFilter}
            onValueChange={(value: any) => onConfirmationFilterChange(value)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="requested">Requested</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-32 flex-shrink-0">
          <label className="text-xs text-gray-500 mb-1 block">Sort</label>
          <Select
            value={sortBy}
            onValueChange={(value: any) => onSortByChange(value)}
          >
            <SelectTrigger className="h-9 text-sm" data-testid="sort-select-trigger">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="z-[100]" position="popper" sideOffset={5}>
              <SelectItem value="created_date_desc">Newest</SelectItem>
              <SelectItem value="created_date_asc">Oldest</SelectItem>
              <SelectItem value="event_date_desc">Recent Event</SelectItem>
              <SelectItem value="event_date_asc">Oldest Event</SelectItem>
              <SelectItem value="organization_asc">Org A-Z</SelectItem>
              <SelectItem value="organization_desc">Org Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop: Filters in a row */}
      <div className="hidden md:flex gap-4">
        <Select
          value={confirmationFilter}
          onValueChange={(value: any) => onConfirmationFilterChange(value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by..." />
          </SelectTrigger>
          <SelectContent className="z-[100]" position="popper" sideOffset={5}>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sortBy}
          onValueChange={(value: any) => onSortByChange(value)}
        >
          <SelectTrigger className="w-56" data-testid="sort-select-trigger-desktop">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent className="z-[100]" position="popper" sideOffset={5}>
            <SelectItem value="created_date_desc">Submission Date (Most Recent First)</SelectItem>
            <SelectItem value="created_date_asc">Submission Date (Oldest First)</SelectItem>
            <SelectItem value="event_date_desc">Event Date (Most Recent)</SelectItem>
            <SelectItem value="event_date_asc">Event Date (Oldest)</SelectItem>
            <SelectItem value="organization_asc">Organization A-Z</SelectItem>
            <SelectItem value="organization_desc">Organization Z-A</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Traditional Tabs - Hidden on mobile */}
      <div className="hidden md:block">
        <Tabs value={activeTab} onValueChange={onActiveTabChange} className="space-y-4">
          <div className="w-full overflow-x-auto pb-1">
            <TabsList className="inline-flex w-auto min-w-full gap-1">
              {tabConfig.map((tab) => {
                const showAdminTip = tab.value === 'admin_overview' && showAdminOverviewTip;
                const showScheduledTip = tab.value === 'scheduled' && showSpreadsheetTip;
                const showTip = showAdminTip || showScheduledTip;

                const TabTriggerContent = (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative text-xs lg:text-sm whitespace-nowrap px-2 lg:px-4"
                    data-testid={tab.value === 'my_assignments' ? 'tab-my-assignments' : undefined}
                    data-tour={tab.value === 'my_assignments' ? 'my-assignments-tab' : undefined}
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <tab.icon className="w-3 h-3 flex-shrink-0" />
                      <span className="hidden lg:inline">{tab.label}</span>
                      <span className="lg:hidden">{tab.shortLabel}</span>
                      {tab.count !== undefined && <span className="text-xs opacity-70">({formatCount(tab.count)})</span>}
                      {showTip && <Sparkles className="w-3 h-3 text-[#FBAD3F] animate-pulse" />}
                    </div>
                    {tab.hasNotification && !statusCountsLoading && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </TabsTrigger>
                );

                if (!showTip) {
                  return TabTriggerContent;
                }

                return (
                  <TooltipProvider key={tab.value}>
                    <Tooltip open={showTip} delayDuration={0}>
                      <TooltipTrigger asChild>
                        {TabTriggerContent}
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs bg-white border-[#FBAD3F] shadow-lg">
                        <div className="flex items-start gap-2 p-2">
                          <Sparkles className="w-4 h-4 text-[#FBAD3F] flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold text-sm mb-1" style={{ color: '#236383' }}>
                              {showAdminTip ? 'New: Admin Overview' : 'New: Spreadsheet View'}
                            </p>
                            <p className="text-xs text-slate-600">
                              {showAdminTip
                                ? 'View all TSP contact assignments and workload distribution at a glance!'
                                : 'Switch to spreadsheet view in the Scheduled tab for a compact table layout.'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 hover:bg-slate-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (showAdminTip) onDismissAdminOverviewTip?.();
                              if (showScheduledTip) onDismissSpreadsheetTip?.();
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* Top Pagination - Shown on all screen sizes when there are multiple pages */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalItems} total)
            </span>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCurrentPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-previous-page-top"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCurrentPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="button-next-page-top"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content - Shown on all screen sizes */}
      <div className="space-y-4">
        {children[activeTab as keyof typeof children] || (
          <div className="text-center py-8 text-gray-500">
            Tab content not found. Please select a valid tab.
          </div>
        )}
      </div>

      {/* Bottom Pagination - Shown on all screen sizes when there are multiple pages */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t mr-16 sm:mr-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Items per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalItems} total)
            </span>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCurrentPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCurrentPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
