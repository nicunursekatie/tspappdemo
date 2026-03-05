import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Building,
  User,
  Mail,
  Phone,
  Calendar,
  Users,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  UserCheck,
  Edit,
} from 'lucide-react';
import { formatDateForDisplay } from '@/lib/date-utils';
import { logger } from '@/lib/logger';
import { StandardFilterBar } from '@/components/ui/standard-filter-bar';

interface Group {
  name: string;
  category?: string | null;
  schoolClassification?: string | null;
  isReligious?: boolean;
  contacts: Array<{
    name: string;
    email?: string;
    status?: string;
    latestRequestDate?: string;
    totalRequests?: number;
    hasHostedEvent?: boolean;
    eventDate?: string | null;
  }>;
  totalRequests: number;
  lastRequestDate: string;
  hasHostedEvent: boolean;
}

interface OrganizationContact {
  organizationName: string;
  contactName: string;
  email?: string;
  phone?: string;
  department?: string;
  category?: string | null;
  schoolClassification?: string | null;
  isReligious?: boolean;
  latestRequestDate: string;
  latestActivityDate: string;
  totalRequests: number;
  status:
    | 'new'
    | 'contacted'
    | 'completed'
    | 'scheduled'
    | 'past'
    | 'declined'
    | 'postponed'
    | 'cancelled'
    | 'contact_completed'
    | 'in_process';
  hasHostedEvent: boolean;
  eventDate?: string | null;
  totalSandwiches?: number;
  actualSandwichTotal?: number;
  actualEventCount?: number;
  eventFrequency?: string | null;
  latestCollectionDate?: string | null;
  tspContact?: string | null;
  tspContactAssigned?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  pastEvents?: Array<{ date: string; sandwichCount: number }>;
}

interface GroupCatalogProps {
  onNavigateToEventPlanning?: () => void;
}

// Helper function to get category display label
const getCategoryLabel = (category: string | null | undefined): string => {
  if (!category) return 'Uncategorized';
  const labels: Record<string, string> = {
    school: 'School',
    church_faith: 'Church/Faith',
    club: 'Club',
    neighborhood: 'Neighborhood',
    large_corp: 'Corporation',
    small_medium_corp: 'Small Business',
    other: 'Other',
  };
  return labels[category] || category;
};

// Helper function to get category badge color
const getCategoryBadgeColor = (category: string | null | undefined): string => {
  if (!category) return 'bg-gray-100 text-gray-700';
  const colors: Record<string, string> = {
    school: 'bg-blue-100 text-blue-700',
    church_faith: 'bg-purple-100 text-purple-700',
    club: 'bg-green-100 text-green-700',
    neighborhood: 'bg-yellow-100 text-yellow-700',
    large_corp: 'bg-orange-100 text-orange-700',
    small_medium_corp: 'bg-teal-100 text-teal-700',
    other: 'bg-gray-100 text-gray-700',
  };
  return colors[category] || 'bg-gray-100 text-gray-700';
};

export default function GroupCatalog({
  onNavigateToEventPlanning,
}: GroupCatalogProps = {}) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('groupName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Consolidated filter state
  const [filters, setFilters] = useState({
    status: ['contacted', 'scheduled', 'completed', 'declined', 'past'] as string[],
    category: [] as string[],
    dateRange: {} as { from?: Date; to?: Date },
    hostedEvents: [] as string[], // 'hosted', 'not-hosted'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [selectedOrganization, setSelectedOrganization] =
    useState<OrganizationContact | null>(null);
  const [showEventDetailsDialog, setShowEventDetailsDialog] = useState(false);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [loadingEventDetails, setLoadingEventDetails] = useState(false);
  const [organizationDetails, setOrganizationDetails] = useState<any>(null);
  const [loadingOrganizationDetails, setLoadingOrganizationDetails] =
    useState(false);
  const [showContactDetailsModal, setShowContactDetailsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<OrganizationContact | null>(null);

  // Fetch groups data
  const {
    data: groupsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/groups-catalog'],
    queryFn: async () => {
      logger.log('🔄 Groups catalog fetching data from API...');
      const response = await fetch('/api/groups-catalog');
      if (!response.ok) throw new Error('Failed to fetch groups');
      const data = await response.json();
      logger.log('✅ Groups catalog received data:', data);
      return data;
    },
    // Use global defaults (5 min staleTime) - invalidateQueries handles refetch on mutations
  });

  // Function to fetch complete event details
  const fetchEventDetails = async (organization: OrganizationContact) => {
    setLoadingEventDetails(true);
    try {
      const response = await fetch(
        `/api/event-requests/details/${encodeURIComponent(
          organization.organizationName
        )}/${encodeURIComponent(organization.contactName)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch event details');
      }
      const details = await response.json();
      setEventDetails(details);
    } catch (error) {
      logger.error('Error fetching event details:', error);
      setEventDetails(null);
    } finally {
      setLoadingEventDetails(false);
    }
  };

  // Function to fetch complete organization details
  const fetchOrganizationDetails = async (organizationName: string) => {
    setLoadingOrganizationDetails(true);
    try {
      const response = await fetch(
        `/api/groups-catalog/details/${encodeURIComponent(organizationName)}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch organization details');
      }
      const details = await response.json();
      setOrganizationDetails(details);
      setShowEventDetailsDialog(true);
    } catch (error) {
      logger.error('Error fetching organization details:', error);
      setOrganizationDetails(null);
    } finally {
      setLoadingOrganizationDetails(false);
    }
  };

  // Function to navigate to event request for editing
  const handleEditEventRequest = (eventId: number) => {
    // Close the dialog
    setShowEventDetailsDialog(false);
    // Navigate to event requests page with the event ID
    setLocation(`/event-requests?eventId=${eventId}`);
  };

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'in_process':
        return 'bg-brand-primary-light text-brand-primary-dark border-brand-primary-border';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'past':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Extract and flatten groups from response
  const rawGroups = groupsResponse?.groups || [];

  // Create category lookup map by organization name
  const organizationCategoryMap = new Map<string, { category: string | null, schoolClassification: string | null, isReligious: boolean }>();
  rawGroups.forEach((org: any) => {
    organizationCategoryMap.set(org.name, {
      category: org.category || null,
      schoolClassification: org.schoolClassification || null,
      isReligious: org.isReligious || false,
    });
  });

  // Convert to flat structure and separate active vs historical organizations
  // Combine departments and contacts but deduplicate by unique key
  const allContactsAndDepartments = rawGroups.flatMap((org: any) => {
    const contacts = org.departments || org.contacts || [];
    return contacts.map((contact: any) => ({
      organizationName: org.name,
      contactName: contact.contactName || contact.name,
      email: contact.email,
      department: contact.department,
      latestRequestDate: contact.latestRequestDate || org.lastRequestDate,
      latestActivityDate:
        contact.latestActivityDate ||
        contact.latestRequestDate ||
        org.lastRequestDate,
      totalRequests: contact.totalRequests || 1,
      status: contact.status || 'new',
      hasHostedEvent: contact.hasHostedEvent || org.hasHostedEvent,
      eventDate: contact.eventDate || null,
      totalSandwiches: contact.totalSandwiches || 0,
      actualSandwichTotal: contact.actualSandwichTotal || 0,
      actualEventCount: contact.actualEventCount || 0,
      eventFrequency: contact.eventFrequency || null,
      latestCollectionDate: contact.latestCollectionDate || null,
      tspContact: contact.tspContact || null,
      tspContactAssigned: contact.tspContactAssigned || null,
      assignedTo: contact.assignedTo || null,
      assignedToName: contact.assignedToName || null,
      category: org.category || null,
      schoolClassification: org.schoolClassification || null,
      isReligious: org.isReligious || false,
    }));
  });

  // Deduplicate by creating unique key from organization + contact + email
  const uniqueOrganizationsMap = new Map<string, OrganizationContact>();
  allContactsAndDepartments.forEach((org: any) => {
    const uniqueKey = `${org.organizationName}|${org.contactName}|${org.email || 'no-email'}`;
    if (!uniqueOrganizationsMap.has(uniqueKey)) {
      uniqueOrganizationsMap.set(uniqueKey, org);
    }
  });

  const allOrganizations: OrganizationContact[] = Array.from(uniqueOrganizationsMap.values());

  // Filter all organizations uniformly (no separation between active/historical)
  const filteredActiveGroups = allOrganizations.filter((org) => {
    const matchesSearch =
      (org.organizationName && org.organizationName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.contactName && org.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.email && org.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (org.department && org.department.toLowerCase().includes(searchTerm.toLowerCase()));

    // Category filter - empty array means show all categories
    const orgCategory = org.category || null;
    const matchesCategory = filters.category.length === 0 || filters.category.includes(orgCategory || '');

    // For organizations without email/status (from collections only), only apply search and category filter
    if (!org.email || org.contactName === 'Historical Organization' || org.contactName === 'Collection Logged Only') {
      return matchesSearch && matchesCategory;
    }

    // For organizations with event requests, apply all filters
    const matchesStatus = filters.status.length === 0 || filters.status.includes(org.status);

    // Use event date for filtering (when the event actually happened), not activity date (when it was created)
    const eventDate = org.eventDate ? new Date(org.eventDate) : null;
    const matchesDateStart = !filters.dateRange.from || !eventDate || eventDate >= filters.dateRange.from;
    const matchesDateEnd = !filters.dateRange.to || !eventDate || eventDate <= filters.dateRange.to;

    // Hosted events filter
    const matchesHosted = filters.hostedEvents.length === 0 ||
      (filters.hostedEvents.includes('hosted') && org.hasHostedEvent) ||
      (filters.hostedEvents.includes('not-hosted') && !org.hasHostedEvent);

    return matchesSearch && matchesCategory && matchesStatus && matchesDateStart && matchesDateEnd && matchesHosted;
  });

  // Group entries by group name
  interface GroupInfo {
    groupName: string;
    departments: OrganizationContact[];
    totalRequests: number;
    totalDepartments: number;
    hasHostedEvent: boolean;
    latestRequestDate: string;
    latestActivityDate: string;
  }

  // Process active organizations into groups
  const activeGroupInfo: GroupInfo[] = Array.from(
    filteredActiveGroups
      .reduce((groups: Map<string, GroupInfo>, org) => {
        const orgName = org.organizationName || 'Unknown Organization';

        if (!groups.has(orgName)) {
          groups.set(orgName, {
            groupName: orgName,
            departments: [],
            totalRequests: 0,
            totalDepartments: 0,
            hasHostedEvent: false,
            latestRequestDate: org.latestRequestDate,
            latestActivityDate: org.latestActivityDate,
          });
        }

        const group = groups.get(orgName)!;
        group.departments.push(org);
        group.totalRequests += org.totalRequests;
        group.hasHostedEvent = group.hasHostedEvent || org.hasHostedEvent;

        // Update latest request date
        if (
          new Date(org.latestRequestDate) > new Date(group.latestRequestDate)
        ) {
          group.latestRequestDate = org.latestRequestDate;
        }

        // Update latest activity date
        if (
          new Date(org.latestActivityDate) > new Date(group.latestActivityDate)
        ) {
          group.latestActivityDate = org.latestActivityDate;
        }

        return groups;
      }, new Map())
      .values()
  );

  // Sort groups by organization name or latest activity date
  const sortedActiveGroups = activeGroupInfo.sort((a, b) => {
    if (sortBy === 'groupName') {
      const aName = a.groupName || '';
      const bName = b.groupName || '';
      return sortOrder === 'desc'
        ? bName.localeCompare(aName)
        : aName.localeCompare(bName);
    }

    if (sortBy === 'category') {
      const aInfo = organizationCategoryMap.get(a.groupName);
      const bInfo = organizationCategoryMap.get(b.groupName);
      const aCategory = getCategoryLabel(aInfo?.category);
      const bCategory = getCategoryLabel(bInfo?.category);
      return sortOrder === 'desc'
        ? bCategory.localeCompare(aCategory)
        : aCategory.localeCompare(bCategory);
    }

    // Default sort by latest activity date (includes both requests and collections)
    const aDate = new Date(a.latestActivityDate).getTime();
    const bDate = new Date(b.latestActivityDate).getTime();
    return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
  });

  // Sort departments within each group
  sortedActiveGroups.forEach((group) => {
    group.departments.sort((a, b) => {
      if (sortBy === 'eventDate') {
        const aDate = a.eventDate
          ? new Date(a.eventDate).getTime()
          : sortOrder === 'desc'
            ? -Infinity
            : Infinity;
        const bDate = b.eventDate
          ? new Date(b.eventDate).getTime()
          : sortOrder === 'desc'
            ? -Infinity
            : Infinity;
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
      }

      if (sortBy === 'totalRequests') {
        return sortOrder === 'desc'
          ? b.totalRequests - a.totalRequests
          : a.totalRequests - b.totalRequests;
      }

      if (sortBy === 'category') {
        const aCategory = getCategoryLabel(a.category);
        const bCategory = getCategoryLabel(b.category);
        return sortOrder === 'desc'
          ? bCategory.localeCompare(aCategory)
          : aCategory.localeCompare(bCategory);
      }

      // Sort by contact name or department
      const aValue = a.department || a.contactName;
      const bValue = b.department || b.contactName;
      return sortOrder === 'desc'
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue);
    });

    group.totalDepartments = group.departments.length;
  });

  // Pagination logic for active groups
  const totalActiveItems = sortedActiveGroups.length;
  const totalActivePages = Math.ceil(totalActiveItems / itemsPerPage);
  
  // Debug logging
  logger.log('🔍 Pagination Debug:', {
    totalActiveItems,
    totalActivePages,
    itemsPerPage,
    currentPage,
    shouldShowPagination: totalActiveItems > 0 && totalActivePages > 1
  });
  const activeStartIndex = (currentPage - 1) * itemsPerPage;
  const activeEndIndex = activeStartIndex + itemsPerPage;
  const paginatedActiveGroups = Array.isArray(sortedActiveGroups)
    ? sortedActiveGroups.slice(activeStartIndex, activeEndIndex)
    : [];

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters, sortBy, sortOrder]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new':
        return 'New Request';
      case 'contacted':
        return 'Contacted';
      case 'in_process':
        return 'In Process';
      case 'contact_completed':
        return 'Event Complete';
      case 'scheduled':
        return 'Upcoming Event';
      case 'completed':
        return 'Completed';
      case 'past':
        return 'Past Event';
      case 'declined':
        return 'Event Postponed';
      default:
        return 'Unknown';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <Badge className="bg-gradient-to-r from-teal-100 to-cyan-200 text-teal-800 border border-teal-300 shadow-sm">
            New Request
          </Badge>
        );
      case 'contacted':
        return (
          <Badge className="bg-gradient-to-r from-emerald-100 to-teal-200 text-teal-700 border border-teal-300 shadow-sm">
            Contacted
          </Badge>
        );
      case 'in_process':
        return (
          <Badge className="bg-gradient-to-r from-blue-100 to-indigo-200 text-brand-primary-dark border border-brand-primary-border-strong shadow-sm">
            In Process
          </Badge>
        );
      case 'contact_completed':
        return (
          <Badge className="bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border border-orange-300 shadow-sm">
            Event Complete
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge className="bg-gradient-to-r from-yellow-100 to-orange-200 text-yellow-800 border border-yellow-300 shadow-sm">
            Upcoming Event
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-gradient-to-r from-green-100 to-emerald-200 text-green-800 border border-green-300 shadow-sm">
            Completed
          </Badge>
        );
      case 'past':
        return (
          <Badge className="bg-gradient-to-r from-gray-100 to-slate-200 text-gray-700 border border-gray-300 shadow-sm">
            Past Event
          </Badge>
        );
      case 'declined':
        return (
          <Badge
            className="text-white border-2 font-bold shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #A31C41 0%, #8B1538 100%)',
              borderColor: '#A31C41',
            }}
          >
            🚫 EVENT POSTPONED
          </Badge>
        );
      default:
        return null; // Remove confusing "Unknown" badges
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-200 shadow-sm">
            <Building className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
            <p className="text-gray-600">Loading organization contacts...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 bg-gray-200 animate-pulse rounded-lg"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load organizations catalog</p>
          <p className="text-sm text-gray-500 mt-2">
            {(error as Error).message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-100">
          <Building className="w-6 h-6 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups Catalog</h1>
          <p className="text-gray-600">
            Directory of all organizations we've worked with from event requests
          </p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white rounded-lg border p-4 shadow-sm">
        <StandardFilterBar
          searchPlaceholder="Search organizations, contacts, emails, departments..."
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          filters={[
            {
              id: 'status',
              label: 'Status',
              type: 'multi-select',
              options: [
                { value: 'new', label: 'New Requests', count: allOrganizations.filter(o => o.status === 'new').length },
                { value: 'in_process', label: 'In Process', count: allOrganizations.filter(o => o.status === 'in_process').length },
                { value: 'contacted', label: 'Contacted', count: allOrganizations.filter(o => o.status === 'contacted').length },
                { value: 'scheduled', label: 'Upcoming Events', count: allOrganizations.filter(o => o.status === 'scheduled').length },
                { value: 'completed', label: 'Completed', count: allOrganizations.filter(o => o.status === 'completed').length },
                { value: 'declined', label: 'Declined', count: allOrganizations.filter(o => o.status === 'declined').length },
                { value: 'postponed', label: 'Postponed', count: allOrganizations.filter(o => o.status === 'postponed').length },
                { value: 'cancelled', label: 'Cancelled', count: allOrganizations.filter(o => o.status === 'cancelled').length },
                { value: 'past', label: 'Past Events', count: allOrganizations.filter(o => o.status === 'past').length },
              ],
            },
            {
              id: 'category',
              label: 'Category',
              type: 'multi-select',
              options: [
                { value: 'school', label: 'School', count: allOrganizations.filter(o => o.category === 'school').length },
                { value: 'church_faith', label: 'Church/Faith', count: allOrganizations.filter(o => o.category === 'church_faith').length },
                { value: 'club', label: 'Club', count: allOrganizations.filter(o => o.category === 'club').length },
                { value: 'neighborhood', label: 'Neighborhood', count: allOrganizations.filter(o => o.category === 'neighborhood').length },
                { value: 'large_corp', label: 'Corporation', count: allOrganizations.filter(o => o.category === 'large_corp').length },
                { value: 'small_medium_corp', label: 'Small Business', count: allOrganizations.filter(o => o.category === 'small_medium_corp').length },
                { value: 'other', label: 'Other', count: allOrganizations.filter(o => o.category === 'other').length },
              ],
            },
            {
              id: 'hostedEvents',
              label: 'Event History',
              type: 'tags',
              options: [
                { value: 'hosted', label: 'Has Hosted', count: allOrganizations.filter(o => o.hasHostedEvent).length },
                { value: 'not-hosted', label: 'Never Hosted', count: allOrganizations.filter(o => !o.hasHostedEvent).length },
              ],
            },
            {
              id: 'dateRange',
              label: 'Event Date Range',
              type: 'date-range',
              placeholder: 'Filter by event date',
            },
          ]}
          filterValues={filters}
          onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
          showActiveFilters
          onClearAll={() => {
            setSearchTerm('');
            setFilters({
              status: [],
              category: [],
              dateRange: {},
              hostedEvents: [],
            });
          }}
        />

        {/* Sort Controls */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-gray-600">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="groupName">Group Name</option>
              <option value="contactName">Contact Name</option>
              <option value="eventDate">Event Date</option>
              <option value="totalRequests">Total Requests</option>
              <option value="category">Category</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mt-4 pt-3 border-t">
          <small className="text-gray-600">
            Showing {activeStartIndex + 1}-
            {Math.min(activeEndIndex, totalActiveItems)} of {totalActiveItems}{' '}
            organizations
          </small>
        </div>
      </div>

      {/* Organizations Display */}
      {totalActiveItems === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No organizations found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || filters.status.length < 9
              ? 'Try adjusting your search or filters'
              : 'Event requests will populate this directory'}
          </p>
        </div>
      ) : (
        <>
          {/* Status Filter - Multi-select */}
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Filter className="w-4 h-4 mr-2" />
                  {statusFilter.length === 0
                    ? 'No statuses selected'
                    : statusFilter.length === 9
                    ? 'All Statuses'
                    : `${statusFilter.length} status${statusFilter.length > 1 ? 'es' : ''} selected`}
                  <ChevronDown className="w-4 h-4 ml-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <div className="font-medium text-sm mb-2">Filter by Status</div>
                  {[
                    { value: 'new', label: 'New Requests' },
                    { value: 'in_process', label: 'In Process' },
                    { value: 'contacted', label: 'Contacted' },
                    { value: 'scheduled', label: 'Upcoming Events' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'declined', label: 'Declined' },
                    { value: 'postponed', label: 'Postponed' },
                    { value: 'cancelled', label: 'Cancelled' },
                    { value: 'past', label: 'Past Events' },
                  ].map((status) => (
                    <div key={status.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={status.value}
                        checked={statusFilter.includes(status.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setStatusFilter([...statusFilter, status.value]);
                          } else {
                            setStatusFilter(statusFilter.filter((s) => s !== status.value));
                          }
                        }}
                      />
                      <label
                        htmlFor={status.value}
                        className="text-sm cursor-pointer"
                      >
                        {status.label}
                      </label>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setStatusFilter(['new', 'in_process', 'contacted', 'scheduled', 'completed', 'declined', 'postponed', 'cancelled', 'past'])}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setStatusFilter([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Category Filter - Multi-select */}
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Filter className="w-4 h-4 mr-2" />
                  {categoryFilter.length === 0
                    ? 'All Categories'
                    : `${categoryFilter.length} categor${categoryFilter.length > 1 ? 'ies' : 'y'} selected`}
                  <ChevronDown className="w-4 h-4 ml-auto" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-2">
                  <div className="font-medium text-sm mb-2">Filter by Category</div>
                  {[
                    { value: 'school', label: 'School' },
                    { value: 'church_faith', label: 'Church/Faith' },
                    { value: 'club', label: 'Club' },
                    { value: 'neighborhood', label: 'Neighborhood' },
                    { value: 'large_corp', label: 'Corporation' },
                    { value: 'small_medium_corp', label: 'Small Business' },
                    { value: 'other', label: 'Other' },
                  ].map((category) => (
                    <div key={category.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.value}`}
                        checked={categoryFilter.includes(category.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCategoryFilter([...categoryFilter, category.value]);
                          } else {
                            setCategoryFilter(categoryFilter.filter((c) => c !== category.value));
                          }
                        }}
                      />
                      <label
                        htmlFor={`category-${category.value}`}
                        className="text-sm cursor-pointer"
                      >
                        {category.label}
                      </label>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setCategoryFilter(['school', 'church_faith', 'club', 'neighborhood', 'large_corp', 'small_medium_corp', 'other'])}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setCategoryFilter([])}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date Range Filters */}
          <div className="md:col-span-1">
            <Input
              type="date"
              placeholder="From date"
              value={dateFilterStart}
              onChange={(e) => setDateFilterStart(e.target.value)}
              className="w-full"
              data-testid="date-filter-start"
            />
          </div>
          <div className="md:col-span-1">
            <Input
              type="date"
              placeholder="To date"
              value={dateFilterEnd}
              onChange={(e) => setDateFilterEnd(e.target.value)}
              className="w-full"
              data-testid="date-filter-end"
            />
          </div>
        </div>

        {/* Second Row: Sort and Clear Filters */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mt-4">
          {/* Sort */}
          <div className="md:col-span-2 flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groupName">Group</SelectItem>
                <SelectItem value="contactName">Contact Name</SelectItem>
                <SelectItem value="eventDate">Event Date</SelectItem>
                <SelectItem value="totalRequests">Total Requests</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>

          {/* Clear Date Filters */}
          {(dateFilterStart || dateFilterEnd) && (
            <div className="md:col-span-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFilterStart('');
                  setDateFilterEnd('');
                }}
                className="w-full"
                data-testid="clear-date-filters"
              >
                Clear Date Filters
              </Button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="mt-4 pt-3 border-t flex justify-between items-center">
          <small className="text-gray-600">
            Showing {activeStartIndex + 1}-
            {Math.min(activeEndIndex, totalActiveItems)} of {totalActiveItems}{' '}
            organizations
          </small>
          <div className="flex items-center gap-2">
            <small className="text-gray-600">Items per page:</small>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Organizations Display */}
      {totalActiveItems === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No organizations found</p>
          <p className="text-sm text-gray-500 mt-2">
            {searchTerm || statusFilter.length < 9
              ? 'Try adjusting your search or filters'
              : 'Event requests will populate this directory'}
          </p>
        </div>
      ) : (
        <>
          {/* Active Organizations Section */}
          {totalActiveItems > 0 && (
            <div className="space-y-8">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-200">
                  <Calendar className="w-5 h-5 text-teal-700" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Active Organizations
                </h2>
                <Badge className="bg-teal-100 text-teal-700">
                  {totalActiveItems} organizations
                </Badge>
              </div>

              {/* Organization Grouped Layout - All Events and Departments Displayed */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedActiveGroups.map((group, groupIndex) => (
                  <div
                    key={`group-${group.groupName}-${groupIndex}`}
                    className="bg-gradient-to-br from-white via-gray-50 to-slate-100 rounded-lg border border-gray-200 p-4 shadow-sm"
                  >
                    {/* Organization Header */}
                    <div className="mb-4 pb-3 border-b border-gray-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <Building
                          className="w-6 h-6"
                          style={{ color: '#236383' }}
                        />
                        <h2 className="text-xl font-bold text-gray-900 truncate">
                          {group.groupName}
                        </h2>
                        {(() => {
                          const orgInfo = organizationCategoryMap.get(group.groupName);
                          const category = orgInfo?.category;
                          return category ? (
                            <Badge className={getCategoryBadgeColor(category)}>
                              {getCategoryLabel(category)}
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="flex items-center space-x-1">
                          <Users className="w-4 h-4" />
                          <span>
                            {group.totalDepartments}{' '}
                            {group.totalDepartments === 1
                              ? 'contact'
                              : 'depts'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Group Departments by Department Name */}
                    {(() => {
                      // Group departments by department name to show related events together
                      const departmentGroups = new Map();
                      
                      group.departments.forEach((org) => {
                        const deptName = org.department || 'General';
                        if (!departmentGroups.has(deptName)) {
                          departmentGroups.set(deptName, []);
                        }
                        departmentGroups.get(deptName).push(org);
                      });

                      return Array.from(departmentGroups.entries()).map(([deptName, deptEvents], deptIndex) => (
                        <div 
                          key={`dept-${deptName}-${deptIndex}`} 
                          className={`mb-4 ${deptName !== 'General' ? 'p-3 bg-purple-50/50 border-2 border-purple-200 rounded-lg' : ''}`}
                        >
                          {/* Department Header - Only show for non-General departments */}
                          {deptName !== 'General' && (
                            <div className="mb-3 pb-2 border-b border-purple-300">
                              <div className="flex items-center space-x-2">
                                <Building className="w-5 h-5 text-purple-600" />
                                <h3 className="text-base font-semibold text-purple-900 truncate">
                                  {deptName}
                                </h3>
                                <Badge className="bg-purple-200 text-purple-800 text-sm font-semibold">
                                  {deptEvents.length} event{deptEvents.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </div>
                          )}

                          {/* Events Grid for this Department */}
                          <div className="space-y-2">
                            {/* Show only first 3 events to prevent cards from being too tall */}
                            {deptEvents.slice(0, 3).map((org: OrganizationContact, index: number) => (
                              <Card
                                key={`${org.organizationName}-${org.contactName}-${index}`}
                                className={`hover:shadow-lg transition-all duration-300 border-l-4 w-full ${
                                  org.status === 'declined'
                                    ? 'border-l-4 border-2 shadow-xl'
                                    : 'bg-gradient-to-br from-white to-orange-50 border-l-4'
                                }`}
                                style={
                                  org.status === 'declined'
                                    ? {
                                        background:
                                          'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                                        borderLeftColor: '#A31C41',
                                        borderColor: '#A31C41',
                                      }
                                    : { borderLeftColor: '#FBAD3F' }
                                }
                              >
                                <CardHeader className="pb-3 px-4 pt-4">
                                  {/* Department Name and Event Date - Top of Card */}
                                  <div className="mb-4 pb-3 border-b border-gray-200">
                                    {org.department && org.department !== 'General' && (
                                      <div className="flex items-center space-x-2 mb-2">
                                        <Building className="w-5 h-5 text-purple-600" />
                                        <h4 className="text-base font-semibold text-gray-800 truncate">
                                          {org.department}
                                        </h4>
                                      </div>
                                    )}
                                    {/* Event Date */}
                                    {org.eventDate ? (
                                      <div className="flex items-center space-x-2 text-base text-gray-700">
                                        <Calendar className="w-5 h-5 text-teal-600" />
                                        <span className="font-semibold">
                                          {formatDateForDisplay(org.eventDate)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center space-x-2 text-base text-gray-500">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                        <span>No date specified</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Contact Information */}
                                  <div className="space-y-2 mb-3">
                                    <div className="flex items-center space-x-2 text-base">
                                      <User className="w-5 h-5 text-teal-600" />
                                      <button
                                        onClick={() => {
                                          setSelectedContact(org);
                                          setShowContactDetailsModal(true);
                                        }}
                                        className="font-medium text-gray-900 hover:text-teal-600 truncate transition-colors underline decoration-dotted underline-offset-2"
                                        data-testid={`button-contact-${org.organizationName}-${org.contactName}`}
                                      >
                                        {org.contactName}
                                      </button>
                                    </div>
                                    {org.email && (
                                      <div className="flex items-center space-x-2 text-sm">
                                        <Mail className="w-4 h-4 text-teal-500" />
                                        <span className="text-teal-700 hover:text-teal-800 truncate">
                                          {org.email}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Status and Metrics */}
                                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-3 border border-orange-200 rounded text-sm mt-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Badge
                                          className={getStatusBadgeColor(org.status)}
                                          variant="outline"
                                        >
                                          {getStatusText(org.status)}
                                        </Badge>
                                        {org.category && (
                                          <Badge className={getCategoryBadgeColor(org.category)}>
                                            {getCategoryLabel(org.category)}
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-gray-600 font-medium">
                                        {org.totalRequests} {org.totalRequests === 1 ? 'request' : 'requests'}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-lg">🥪</span>
                                        <span className="font-semibold text-orange-700 text-base">
                                          {org.actualSandwichTotal || org.totalSandwiches || 0}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-lg">📦</span>
                                        <span className="font-semibold text-brand-primary text-base">
                                          {org.actualEventCount || (org.hasHostedEvent ? 1 : 0)} event{(org.actualEventCount || (org.hasHostedEvent ? 1 : 0)) !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    </div>

                                    {/* TSP Contact Display */}
                                    {(() => {
                                      let tspContactName = null;

                                      if (org.assignedToName && org.assignedToName.trim() &&
                                          !org.assignedToName.includes('@') &&
                                          !org.assignedToName.match(/^[a-f0-9-]{8,}$/i)) {
                                        tspContactName = org.assignedToName;
                                      } else if (org.tspContactAssigned && org.tspContactAssigned.trim()) {
                                        tspContactName = org.tspContactAssigned;
                                      } else if (org.tspContact && org.tspContact.trim()) {
                                        tspContactName = org.tspContact;
                                      }

                                      return tspContactName ? (
                                        <div className="flex items-center space-x-1.5 text-sm mt-2 pt-2 border-t border-orange-300">
                                          <UserCheck className="w-4 h-4 text-purple-500" />
                                          <span className="text-purple-700 font-medium truncate">
                                            TSP: {tspContactName}
                                          </span>
                                        </div>
                                      ) : null;
                                    })()}

                                    {/* Past Events List - Compact */}
                                    {org.pastEvents && org.pastEvents.length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-orange-300">
                                        <div className="text-sm font-semibold text-gray-700 mb-2">
                                          Past Events:
                                        </div>
                                        <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                          {org.pastEvents.map((event, idx) => (
                                            <div
                                              key={idx}
                                              className="flex items-center justify-between bg-white/60 px-2 py-1 rounded"
                                            >
                                              <div className="flex items-center space-x-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                                <span className="text-gray-700 text-xs">
                                                  {formatDateForDisplay(event.date)}
                                                </span>
                                              </div>
                                              <div className="flex items-center space-x-1.5">
                                                <span className="font-semibold text-orange-700 text-xs">
                                                  {event.sandwichCount}
                                                </span>
                                                <img
                                                  src="/attached_assets/LOGOS/sandwich logo.png"
                                                  alt="sandwich"
                                                  className="w-3.5 h-3.5 object-contain"
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardHeader>

                                <CardContent className="pt-0 px-4 pb-4">
                                  {/* View Complete History Button */}
                                  <Button
                                    onClick={() => {
                                      setSelectedOrganization(org);
                                      setOrganizationDetails(null);
                                      fetchOrganizationDetails(org.organizationName);
                                    }}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-sm bg-brand-orange hover:bg-brand-orange/90 text-white border-brand-orange hover:border-brand-orange/90 py-2"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-1.5" />
                                    View Complete History
                                  </Button>
                                </CardContent>
                              </Card>
                            ))}
                            {/* Show indicator if there are more events */}
                            {deptEvents.length > 3 && (
                              <div className="text-center py-2 px-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded border border-orange-200">
                                <p className="text-sm text-gray-600 font-medium">
                                  + {deptEvents.length - 3} more event{deptEvents.length - 3 !== 1 ? 's' : ''} (click "View History" to see all)
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                ))}
              </div>

                {/* REMOVED: Single-department organizations are now integrated above in the main loop */}
                {(() => {
                  // DISABLED: Single-department organizations are now integrated above
                  return null;
                  
                  const singleDepartmentGroups = paginatedActiveGroups.filter(group => group.totalDepartments === 1);
                  
                  if (singleDepartmentGroups.length === 0) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-emerald-200">
                          <Users className="w-5 h-5 text-green-700" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Single-Department Organizations
                        </h3>
                        <Badge className="bg-green-100 text-green-700">
                          {singleDepartmentGroups.length} organizations
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {singleDepartmentGroups.map((group, groupIndex) => {
                        const org = group.departments[0]; // Single department
                        return (
                          <Card
                            key={`single-${group.groupName}-${groupIndex}`}
                            className={`hover:shadow-lg transition-all duration-300 border-l-4 ${
                              org.status === 'declined'
                                ? 'border-l-4 border-2 shadow-xl'
                                : 'bg-gradient-to-br from-white to-orange-50 border-l-4'
                            }`}
                            style={
                              org.status === 'declined'
                                ? {
                                    background:
                                      'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
                                    borderLeftColor: '#A31C41',
                                    borderColor: '#A31C41',
                                  }
                                : { borderLeftColor: '#FBAD3F' }
                            }
                          >
                            <CardHeader className="pb-3">
                              {/* Organization Header - Compact */}
                              <div className="flex items-center space-x-2 mb-3">
                                <Building
                                  className="w-4 h-4 flex-shrink-0"
                                  style={{ color: '#236383' }}
                                />
                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                  {group.groupName}
                                </h3>
                              </div>

                              {/* Main headline with org name and date */}
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    {org.department && (
                                      <h4 className="text-base font-semibold text-gray-800 leading-tight">
                                        {org.department}
                                      </h4>
                                    )}
                                    {/* Event Date - Compact */}
                                    {org.eventDate ? (
                                      <div
                                        className="flex items-center mt-1 text-sm font-semibold"
                                        style={{ color: '#FBAD3F' }}
                                      >
                                        <Calendar className="w-4 h-4 mr-1" />
                                        <span className="truncate">
                                          {formatDateForDisplay(org.eventDate)}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center mt-1 text-xs text-gray-500">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        <span>No date specified</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Contact Info - Compact */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1 text-xs text-gray-600">
                                    <User className="w-3 h-3" />
                                    <span className="font-medium truncate">
                                      {org.contactName}
                                    </span>
                                  </div>
                                  {org.email && (
                                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                                      <Mail className="w-3 h-3" />
                                      <span className="truncate">{org.email}</span>
                                    </div>
                                  )}
                                  {/* TSP Contact Display - Compact */}
                                  {(() => {
                                    let tspContactName = null;
                                    
                                    if (org.assignedToName && org.assignedToName.trim() && 
                                        !org.assignedToName.includes('@') && 
                                        !org.assignedToName.match(/^[a-f0-9-]{8,}$/i)) {
                                      tspContactName = org.assignedToName;
                                    } else if (org.tspContactAssigned && org.tspContactAssigned.trim()) {
                                      tspContactName = org.tspContactAssigned;
                                    } else if (org.tspContact && org.tspContact.trim()) {
                                      tspContactName = org.tspContact;
                                    }
                                    
                                    return tspContactName ? (
                                      <div className="flex items-center space-x-1 text-xs">
                                        <UserCheck className="w-3 h-3 text-purple-500" />
                                        <span className="text-purple-700 font-medium truncate">
                                          TSP: {tspContactName}
                                        </span>
                                      </div>
                                    ) : null;
                                  })()}
                                </div>

                                {/* Compact Key Metrics */}
                                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-2 border border-orange-200 rounded text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge
                                      className={getStatusBadgeColor(org.status)}
                                      variant="outline"
                                    >
                                      {getStatusText(org.status)}
                                    </Badge>
                                    <span className="text-gray-500">
                                      {org.totalRequests} request{org.totalRequests !== 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-1">
                                      <span>🥪</span>
                                      <span className="font-semibold text-orange-700">
                                        {org.actualSandwichTotal || org.totalSandwiches || 0}
                                      </span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <span>📦</span>
                                          <span className="font-semibold text-brand-primary">
                                            {org.actualEventCount || (org.hasHostedEvent ? 1 : 0)} event{(org.actualEventCount || (org.hasHostedEvent ? 1 : 0)) !== 1 ? 's' : ''}
                                          </span>
                                    </div>
                                  </div>

                                  {/* Past Events List - Compact */}
                                  {org.pastEvents && org.pastEvents.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-orange-300">
                                      <div className="text-xs font-semibold text-gray-700 mb-1">
                                        Past Events:
                                      </div>
                                      <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {org.pastEvents.map((event, idx) => (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between bg-white/60 px-1.5 py-0.5 rounded"
                                          >
                                            <div className="flex items-center space-x-1">
                                              <Calendar className="w-2.5 h-2.5 text-teal-600" />
                                              <span className="text-gray-700" style={{ fontSize: '10px' }}>
                                                {formatDateForDisplay(event.date)}
                                              </span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                              <span className="font-semibold text-orange-700" style={{ fontSize: '10px' }}>
                                                {event.sandwichCount}
                                              </span>
                                              <img 
                                                src="/attached_assets/LOGOS/sandwich logo.png" 
                                                alt="sandwich" 
                                                className="w-2.5 h-2.5 object-contain"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardHeader>

                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                {/* Compact Contact Information */}
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-1 text-sm">
                                    <User className="w-4 h-4 text-teal-600" />
                                    <button
                                      onClick={() => {
                                        setSelectedContact(org);
                                        setShowContactDetailsModal(true);
                                      }}
                                      className="font-medium text-gray-900 hover:text-teal-600 truncate transition-colors underline decoration-dotted underline-offset-2"
                                      data-testid={`button-contact-${org.organizationName}`}
                                    >
                                      {org.contactName}
                                    </button>
                                  </div>
                                  {org.email && (
                                    <div className="flex items-center space-x-1 text-xs">
                                      <Mail className="w-3 h-3 text-teal-500" />
                                      <a
                                        href={`mailto:${org.email}`}
                                        className="text-teal-700 hover:text-teal-900 truncate hover:underline transition-colors"
                                        data-testid={`link-email-${org.email}`}
                                      >
                                        {org.email}
                                      </a>
                                    </div>
                                  )}
                                </div>

                                {/* Compact View History Button */}
                                <Button
                                  onClick={() => {
                                    setSelectedOrganization(org);
                                    setOrganizationDetails(null);
                                    fetchOrganizationDetails(org.organizationName);
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs bg-brand-orange hover:bg-brand-orange/90 text-white border-brand-orange hover:border-brand-orange/90 py-1"
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View History
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      </div>
                    </div>
                  );
                })()}
              </div>
          )}

          {/* Pagination Controls - Only for Active Organizations */}
          {totalActiveItems > 0 && totalActivePages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border p-4 shadow-sm mt-6">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalActivePages}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalActivePages, 5) }, (_, i) => {
                    let pageNum;
                    if (totalActivePages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalActivePages - 2) {
                      pageNum = totalActivePages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalActivePages))}
                  disabled={currentPage === totalActivePages}
                  className="h-8"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="12">12</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="48">48</SelectItem>
                <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </>
      )}


      {/* Organization History Dialog */}
      <Dialog
        open={showEventDetailsDialog}
        onOpenChange={setShowEventDetailsDialog}
      >
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Organization History:{' '}
              {organizationDetails?.organizationName ||
                selectedOrganization?.organizationName}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Complete event history and analytics
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {loadingOrganizationDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <span className="ml-2 text-gray-600 dark:text-gray-400">
                  Loading organization details...
                </span>
              </div>
            ) : organizationDetails ? (
              <div className="space-y-6">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-brand-primary dark:text-blue-400">
                        {organizationDetails.summary.totalEvents}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Total Events
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {organizationDetails.summary.completedEvents}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Completed
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {organizationDetails.summary.totalActualSandwiches.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Sandwiches Made
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {organizationDetails.summary.eventFrequency ||
                          'First Time'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Frequency
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contacts */}
                {organizationDetails.contacts &&
                  organizationDetails.contacts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Organization Contacts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {organizationDetails.contacts.map(
                            (contact: any, index: number) => (
                              <div
                                key={index}
                                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                              >
                                <div className="font-semibold">
                                  {contact.name}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {contact.email && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Mail className="w-3 h-3" />
                                      {contact.email}
                                    </div>
                                  )}
                                  {contact.phone && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Phone className="w-3 h-3" />
                                      {contact.phone}
                                    </div>
                                  )}
                                  {contact.department && (
                                    <div className="text-xs mt-1 text-brand-primary dark:text-blue-400">
                                      {contact.department}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Event History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Event History ({organizationDetails.events.length} events)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {organizationDetails.events.map(
                        (event: any, index: number) => (
                          <div
                            key={index}
                            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-primary-border-strong dark:hover:border-brand-primary transition-colors"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                                    {formatDateForDisplay(event.date)}
                                  </div>
                                  <Badge
                                    className={
                                      event.type === 'sandwich_collection'
                                        ? 'bg-green-100 text-green-800 border-green-200'
                                        : 'bg-brand-primary-light text-brand-primary-dark border-brand-primary-border'
                                    }
                                  >
                                    {event.type === 'sandwich_collection'
                                      ? 'Collection'
                                      : 'Request'}
                                  </Badge>
                                  {getStatusBadge(event.status)}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      Contact
                                    </div>
                                    <div className="text-gray-900 dark:text-gray-100">
                                      {event.contactName}
                                    </div>
                                    {event.email && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400">
                                        {event.email}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      Sandwiches
                                    </div>
                                    <div className="text-gray-900 dark:text-gray-100">
                                      {event.actualSandwiches > 0
                                        ? `${event.actualSandwiches.toLocaleString()} made`
                                        : event.estimatedSandwiches > 0
                                          ? `${event.estimatedSandwiches.toLocaleString()} estimated`
                                          : 'Not specified'}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      Details
                                    </div>
                                    <div className="text-gray-900 dark:text-gray-100">
                                      {event.department && (
                                        <div>Dept: {event.department}</div>
                                      )}
                                      {event.hostName && (
                                        <div>Host: {event.hostName}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {event.notes && (
                                  <div className="mt-2 text-sm text-gray-900 dark:text-gray-100 italic">
                                    {event.notes}
                                  </div>
                                )}
                              </div>

                              {/* Edit button for event requests */}
                              {event.type === 'event_request' && event.id && (
                                <div className="ml-4 flex-shrink-0">
                                  <Button
                                    onClick={() => handleEditEventRequest(event.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-brand-primary hover:bg-brand-primary hover:text-white"
                                    data-testid={`button-edit-event-${event.id}`}
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Request
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}

                      {organizationDetails.events.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          No events found for this organization
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No organization details available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Details Modal */}
      <Dialog open={showContactDetailsModal} onOpenChange={setShowContactDetailsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading text-brand-primary">
              Contact Information
            </DialogTitle>
            <DialogDescription>
              Complete contact details for this organization
            </DialogDescription>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4 mt-4">
              {/* Organization Name */}
              <div className="border-b pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="w-5 h-5 text-brand-primary" />
                  <h3 className="font-semibold text-gray-900">
                    {selectedContact.organizationName}
                  </h3>
                </div>
                {selectedContact.department && (
                  <p className="text-sm text-gray-600 ml-7">
                    Department: {selectedContact.department}
                  </p>
                )}
              </div>

              {/* Contact Details */}
              <div className="space-y-3">
                {/* Contact Name */}
                <div className="flex items-start gap-2">
                  <User className="w-5 h-5 text-teal-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Contact Name</p>
                    <p className="font-medium text-gray-900">{selectedContact.contactName}</p>
                  </div>
                </div>

                {/* Email */}
                {selectedContact.email && (
                  <div className="flex items-start gap-2">
                    <Mail className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Email Address</p>
                      <a
                        href={`mailto:${selectedContact.email}`}
                        className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
                        data-testid={`link-modal-email-${selectedContact.email}`}
                      >
                        {selectedContact.email}
                      </a>
                    </div>
                  </div>
                )}

                {/* Phone */}
                {selectedContact.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Phone Number</p>
                      <a
                        href={`tel:${selectedContact.phone}`}
                        className="font-medium text-teal-700 hover:text-teal-900 hover:underline"
                        data-testid={`link-modal-phone-${selectedContact.phone}`}
                      >
                        {selectedContact.phone}
                      </a>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-teal-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Current Status</p>
                    <div className="mt-1">{getStatusBadge(selectedContact.status)}</div>
                  </div>
                </div>

                {/* Latest Activity */}
                {selectedContact.latestActivityDate && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Latest Activity</p>
                      <p className="font-medium text-gray-900">
                        {formatDateForDisplay(selectedContact.latestActivityDate.toString())}
                      </p>
                    </div>
                  </div>
                )}

                {/* Event Date */}
                {selectedContact.eventDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Event Date</p>
                      <p className="font-medium text-gray-900">
                        {formatDateForDisplay(selectedContact.eventDate)}
                      </p>
                    </div>
                  </div>
                )}

                {/* TSP Contact */}
                {selectedContact.tspContactAssigned && (
                  <div className="flex items-start gap-2">
                    <UserCheck className="w-5 h-5 text-teal-600 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">TSP Contact</p>
                      <p className="font-medium text-gray-900">
                        {selectedContact.tspContactAssigned}
                      </p>
                    </div>
                  </div>
                )}

                {/* Statistics */}
                {(selectedContact.actualEventCount || selectedContact.totalRequests) && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-gray-600 mb-2">Event History</p>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedContact.actualEventCount && selectedContact.actualEventCount > 0 && (
                        <div>
                          <p className="text-2xl font-bold text-brand-primary">
                            {selectedContact.actualEventCount}
                          </p>
                          <p className="text-xs text-gray-600">
                            Completed Event{selectedContact.actualEventCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                      {selectedContact.totalRequests > 0 && (
                        <div>
                          <p className="text-2xl font-bold text-brand-secondary">
                            {selectedContact.totalRequests}
                          </p>
                          <p className="text-xs text-gray-600">
                            Total Request{selectedContact.totalRequests !== 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Past Events */}
                {selectedContact.pastEvents && selectedContact.pastEvents.length > 0 && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm text-gray-600 mb-2">Past Collection Events</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {selectedContact.pastEvents.map((event, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-teal-600" />
                            <span>{formatDateForDisplay(event.date)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-orange-700">
                              {event.sandwichCount}
                            </span>
                            <img 
                              src="/attached_assets/LOGOS/sandwich logo.png" 
                              alt="sandwich" 
                              className="w-4 h-4 object-contain"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
