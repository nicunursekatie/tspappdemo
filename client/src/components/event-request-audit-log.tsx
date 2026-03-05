import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Shield,
  Clock,
  User,
  FileText,
  Mail,
  Phone,
  UserCheck,
  Trash2,
  Edit,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  Calendar,
  Activity,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { usePageSession } from '@/hooks/usePageSession';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { logger } from '@/lib/logger';

interface AuditLogEntry {
  id: number;
  action: string;
  eventId: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  organizationName: string;
  contactName: string;
  actionDescription: string;
  details: any;
  statusChange: string | null;
  followUpMethod: string | null;
  oldData: any;
  newData: any;
  changeDescription: string;
}

interface EventRequestAuditLogProps {
  eventId?: string;
  showFilters?: boolean;
  compact?: boolean;
}

export function EventRequestAuditLog({
  eventId,
  showFilters = true,
  compact = false,
}: EventRequestAuditLogProps) {
  const { user: currentUser } = useAuth();
  // If viewing a specific event, show all history by default (use a large number like 8760 = 1 year)
  // If viewing general audit log, show last week by default (more useful for admin panel)
  const [timeFilter, setTimeFilter] = useState(eventId ? '8760' : '168');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({});
  const { trackClick, trackFilter, trackSearch } = useActivityTracker();

  // Track page session with meaningful context and duration
  usePageSession({
    section: 'Event Requests',
    page: 'Audit Log',
    itemDescription: eventId ? `Event #${eventId}` : 'All Events',
    itemId: eventId || undefined,
    context: {
      viewType: eventId ? 'single-event' : 'all-events',
      timeFilter,
    },
  });

  // Check permissions
  if (!hasPermission(currentUser, PERMISSIONS.EVENT_REQUESTS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="audit-log-access-denied">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-sub-heading text-gray-900">Access Restricted</CardTitle>
            <CardDescription className="text-base text-gray-600 leading-relaxed">
              You don't have permission to view event request audit logs. Contact an
              administrator if you need access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch all users to map IDs to names
  const { data: allUsers } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const users = await response.json();
      
      // Build user name cache
      const cache: Record<string, string> = {};
      users.forEach((user: any) => {
        const displayName = user.displayName || 
                          `${user.firstName || ''} ${user.lastName || ''}`.trim() || 
                          user.email?.split('@')[0] || 
                          'Unknown User';
        cache[user.id] = displayName;
      });
      setUserNameCache(cache);
      
      return users;
    },
    enabled: hasPermission(currentUser, PERMISSIONS.EVENT_REQUESTS_VIEW),
  });

  // Fetch audit logs
  const {
    data: auditLogs,
    isLoading,
    refetch,
  } = useQuery<AuditLogEntry[]>({
    queryKey: [
      '/api/event-requests/audit-logs',
      timeFilter,
      actionFilter,
      userFilter,
      eventId,
    ],
    enabled: hasPermission(currentUser, PERMISSIONS.EVENT_REQUESTS_VIEW),
    queryFn: async () => {
      const params = new URLSearchParams({
        hours: timeFilter,
        limit: '100',
        offset: '0',
      });

      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (userFilter !== 'all') params.append('userId', userFilter);
      if (eventId) params.append('eventId', eventId);

      const response = await fetch(`/api/event-requests/audit-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      const data = await response.json();
      return data.logs || []; // Extract the logs array from the response
    },
    refetchInterval: eventId ? undefined : 3 * 60 * 1000, // 3 minutes for general view (reduced from 30 seconds for cost optimization)
  });

  // Get unique users for filter
  const uniqueUsers = React.useMemo(() => {
    if (!auditLogs) return [];
    const users = new Map();
    auditLogs.forEach((log) => {
      if (log.userId && log.userEmail) {
        users.set(log.userId, { id: log.userId, email: log.userEmail });
      }
    });
    return Array.from(users.values());
  }, [auditLogs]);

  // Filter logs by search term
  const filteredLogs = React.useMemo(() => {
    if (!auditLogs) return [];
    if (!searchTerm) return auditLogs;

    const term = searchTerm.toLowerCase();
    return auditLogs.filter(
      (log) =>
        log.organizationName.toLowerCase().includes(term) ||
        log.contactName.toLowerCase().includes(term) ||
        log.userEmail.toLowerCase().includes(term) ||
        log.actionDescription.toLowerCase().includes(term)
    );
  }, [auditLogs, searchTerm]);

  const getActionIcon = (action: string) => {
    const iconClass = "h-5 w-5";
    switch (action) {
      case 'CREATE':
        return <Plus className={iconClass} />;
      case 'PRIMARY_CONTACT_COMPLETED':
        return <UserCheck className={iconClass} />;
      case 'EVENT_DETAILS_UPDATED':
      case 'EVENT_REQUEST_CHANGE':
      case 'UPDATE':
        return <Edit className={iconClass} />;
      case 'STATUS_CHANGED':
      case 'EVENT_SCHEDULED':
        return <RefreshCw className={iconClass} />;
      case 'FOLLOW_UP_RECORDED':
        return <Mail className={iconClass} />;
      case 'MARKED_UNRESPONSIVE':
        return <AlertTriangle className={iconClass} />;
      case 'DELETE':
        return <Trash2 className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'PRIMARY_CONTACT_COMPLETED':
        return 'bg-brand-primary-lighter text-brand-primary border-brand-primary-border';
      case 'EVENT_DETAILS_UPDATED':
      case 'UPDATE':
      case 'EVENT_REQUEST_CHANGE':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'STATUS_CHANGED':
      case 'EVENT_SCHEDULED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'FOLLOW_UP_RECORDED':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'MARKED_UNRESPONSIVE':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'DELETE':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'EVENT_REQUEST_SIGNIFICANT_CHANGE':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  // Helper function to convert technical field names to human-readable labels
  const getHumanReadableFieldName = (fieldName: string): string => {
    const fieldMapping: Record<string, string> = {
      // Contact Information
      'contactName': 'Contact Name',
      'contactEmail': 'Contact Email',
      'contactPhone': 'Contact Phone',
      'organizationName': 'Organization',
      'organizationType': 'Organization Type',
      'websiteUrl': 'Website URL',
      
      // Event Details
      'eventStartTime': 'Event Start Time',
      'eventEndTime': 'Event End Time',
      'eventDate': 'Event Date',
      'eventTime': 'Event Time',
      'setupTime': 'Setup Time',
      'cleanupTime': 'Cleanup Time',
      'eventDuration': 'Event Duration',
      'expectedAttendance': 'Expected Attendance',
      'actualAttendance': 'Actual Attendance',
      'eventDescription': 'Event Description',
      'eventPurpose': 'Event Purpose',
      'eventType': 'Event Type',
      'eventCategory': 'Event Category',
      'eventTitle': 'Event Title',
      'eventName': 'Event Name',
      
      // Location
      'location': 'Location',
      'eventLocation': 'Event Location',
      'address': 'Address',
      'streetAddress': 'Street Address',
      'city': 'City',
      'state': 'State',
      'zipCode': 'ZIP Code',
      'country': 'Country',
      'venue': 'Venue',
      'room': 'Room',
      'floor': 'Floor',
      
      // Status and Tracking
      'status': 'Status',
      'eventStatus': 'Event Status',
      'followUpRequired': 'Follow-up Required',
      'followUpDate': 'Follow-up Date',
      'followUpMethod': 'Follow-up Method',
      'followUpNotes': 'Follow-up Notes',
      'priority': 'Priority',
      'urgency': 'Urgency',
      'completed': 'Completed',
      'approved': 'Approved',
      'confirmed': 'Confirmed',
      'cancelled': 'Cancelled',
      'postponed': 'Postponed',
      
      // Requirements
      'specialRequirements': 'Special Requirements',
      'dietaryRestrictions': 'Dietary Restrictions',
      'accessibilityNeeds': 'Accessibility Needs',
      'equipmentNeeded': 'Equipment Needed',
      'setupInstructions': 'Setup Instructions',
      'deliveryInstructions': 'Delivery Instructions',
      'parkingInstructions': 'Parking Instructions',
      
      // Logistics
      'sandwichCount': 'Sandwich Count',
      'sandwichType': 'Sandwich Type',
      'mealCount': 'Meal Count',
      'beverageCount': 'Beverage Count',
      'additionalItems': 'Additional Items',
      'budget': 'Budget',
      'cost': 'Cost',
      'estimatedCost': 'Estimated Cost',
      'actualCost': 'Actual Cost',
      
      // Communications
      'communicationPreference': 'Communication Preference',
      'alternateContact': 'Alternate Contact',
      'emergencyContact': 'Emergency Contact',
      'notificationSettings': 'Notification Settings',
      
      // Timestamps
      'createdAt': 'Created Date',
      'updatedAt': 'Last Modified',
      'submittedAt': 'Submitted Date',
      'completedAt': 'Completed Date',
      'scheduledAt': 'Scheduled Date',
      'lastContactedAt': 'Last Contacted',
      
      // Technical fields
      'userId': 'User',
      'eventId': 'Event ID',
      'requestId': 'Request ID',
      'organizationId': 'Organization ID',
      'submittedBy': 'Submitted By',
      'assignedTo': 'Assigned To',
      'modifiedBy': 'Modified By',
      'tspContact': 'TSP Contact',
      'tspContactAssigned': 'TSP Contact',
      'tspContactAssignedDate': 'TSP Contact Assigned Date',
      'additionalTspContacts': 'Additional TSP Contacts',
      'toolkitSent': 'Toolkit Sent',
      'toolkitSentDate': 'Toolkit Sent Date',
      'toolkitStatus': 'Toolkit Status',
      'toolkitSentBy': 'Toolkit Sent By',
      
      // Boolean flags
      'isPublic': 'Public Event',
      'isRecurring': 'Recurring Event',
      'requiresApproval': 'Requires Approval',
      'hasSpecialNeeds': 'Has Special Needs',
      'isUrgent': 'Urgent',
      'hasContactedOrganization': 'Organization Contacted',
      'isPrimaryContactCompleted': 'Primary Contact Completed',
      'isEventDetailsConfirmed': 'Event Details Confirmed',
      'isMarkedUnresponsive': 'Marked as Unresponsive',
      'hasFollowUpScheduled': 'Follow-up Scheduled',
      'isReadyForDelivery': 'Ready for Delivery',
      'isDelivered': 'Delivered',
      'hasPhotoUpload': 'Photo Uploaded',
      'hasFeedback': 'Feedback Provided',
      'emailVerified': 'Email Verified',
      'phoneVerified': 'Phone Verified'
    };
    
    // Return mapped name or format the original field name
    return fieldMapping[fieldName] || formatFieldName(fieldName);
  };
  
  // Helper function to format field names when not in mapping
  const formatFieldName = (fieldName: string): string => {
    return fieldName
      .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };
  
  // Helper function to format values based on type and content
  const formatValue = (value: any, fieldName?: string): string => {
    if (value === null || value === undefined) {
      return '(not set)';
    }
    
    // Handle empty strings
    if (value === '') {
      return '(empty)';
    }
    
    // Convert to string for processing
    const stringValue = String(value);
    
    // Fields that are numeric counters and should NEVER be formatted as dates
    // (even if their names contain date-like substrings like "Attempts" containing "At")
    const numericCounterFields = [
      'contactattempts', 'contact attempts', 'attempts',
      'count', 'quantity', 'total', 'number'
    ];
    const fieldNameLower = fieldName?.toLowerCase() || '';
    const isNumericCounter = numericCounterFields.some(f => fieldNameLower.includes(f));
    
    // Check if this looks like a user ID and convert to name
    if (stringValue.startsWith('user_') && stringValue.includes('_')) {
      // This is a user ID - convert to name
      const userName = userNameCache[stringValue];
      if (userName) {
        return userName;
      }
      // If not in cache, try to make it more readable
      return 'User (loading...)';
    }
    
    // Also check if field name suggests it's a user field
    if (fieldName && (
      fieldName.toLowerCase().includes('tspcontact') ||
      fieldName.toLowerCase().includes('assignedto') ||
      fieldName.toLowerCase().includes('userid') ||
      fieldName.toLowerCase().includes('assignee') ||
      fieldName === 'tspContact' ||
      fieldName === 'Tsp Contact' ||
      fieldName === 'TSP Contact'
    )) {
      // Try to get user name from cache
      const userName = userNameCache[stringValue];
      if (userName) {
        return userName;
      }
    }
    
    // Handle boolean values
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle string representations of booleans
    if (stringValue.toLowerCase() === 'true') {
      return 'Yes';
    }
    if (stringValue.toLowerCase() === 'false') {
      return 'No';
    }
    
    // Handle dates and times (but NOT numeric counter fields like "Contact Attempts")
    if (!isNumericCounter && fieldName && (fieldName.includes('Time') || fieldName.includes('Date') || fieldName.includes('At'))) {
      try {
        // Try parsing as ISO date first
        if (stringValue.includes('T') || stringValue.includes('-')) {
          const date = parseISO(stringValue);
          if (isValid(date)) {
            return format(date, 'MMMM d, yyyy \'at\' h:mm a');
          }
        }
        
        // Try parsing as regular date (but only if it looks like a date string, not a number)
        if (!/^\d+$/.test(stringValue)) {
          const date = new Date(stringValue);
          if (isValid(date) && !isNaN(date.getTime())) {
            return format(date, 'MMMM d, yyyy \'at\' h:mm a');
          }
        }
      } catch (error) {
        // If date parsing fails, fall through to other formatting
      }
    }
    
    // Handle phone numbers (basic formatting)
    if (fieldName && fieldName.toLowerCase().includes('phone')) {
      const cleaned = stringValue.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
      }
      if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
      }
      return stringValue; // Return original if not standard format
    }
    
    // Handle email addresses (just return as-is, they're already formatted)
    if (fieldName && fieldName.toLowerCase().includes('email')) {
      return stringValue;
    }
    
    // Handle URLs
    if (fieldName && (fieldName.toLowerCase().includes('url') || fieldName.toLowerCase().includes('website'))) {
      if (!stringValue.startsWith('http')) {
        return `https://${stringValue}`;
      }
      return stringValue;
    }
    
    // Handle numeric values with context
    if (!isNaN(Number(stringValue)) && stringValue !== '') {
      const num = Number(stringValue);
      
      // Handle counts and quantities
      if (fieldName && (fieldName.toLowerCase().includes('count') || 
                       fieldName.toLowerCase().includes('attendance') ||
                       fieldName.toLowerCase().includes('quantity'))) {
        return num === 1 ? '1 person' : `${num} people`;
      }
      
      // Handle monetary values
      if (fieldName && (fieldName.toLowerCase().includes('cost') || 
                       fieldName.toLowerCase().includes('budget') ||
                       fieldName.toLowerCase().includes('price'))) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(num);
      }
      
      // Return formatted number for other numeric fields
      return new Intl.NumberFormat('en-US').format(num);
    }
    
    // Handle long text (truncate if necessary)
    if (stringValue.length > 100) {
      return `${stringValue.substring(0, 97)}...`;
    }
    
    // Default: return the string value
    return stringValue;
  };
  
  // Helper function to convert action names to human-readable format
  const getHumanReadableActionName = (action: string): string => {
    const actionMapping: Record<string, string> = {
      'CREATE': 'Created',
      'UPDATE': 'Updated',
      'PRIMARY_CONTACT_COMPLETED': 'Contact Made',
      'EVENT_DETAILS_UPDATED': 'Details Updated',
      'STATUS_CHANGED': 'Status Changed',
      'EVENT_SCHEDULED': 'Event Scheduled',
      'FOLLOW_UP_RECORDED': 'Follow-up Added',
      'MARKED_UNRESPONSIVE': 'Marked Unresponsive',
      'DELETE': 'Deleted',
      'APPROVED': 'Approved',
      'REJECTED': 'Rejected',
      'CANCELLED': 'Cancelled',
      'COMPLETED': 'Completed',
      'ASSIGNED': 'Assigned',
      'UNASSIGNED': 'Unassigned',
      'REOPENED': 'Reopened',
      'ARCHIVED': 'Archived',
      // Simplify technical action types
      'EVENT_REQUEST_CHANGE': 'Updated',
      'EVENT_REQUEST_SIGNIFICANT_CHANGE': 'Updated',
      'TSP_CONTACT_ASSIGNED': 'Assignment',
      'TSP_CONTACT_REMOVED': 'Assignment',
      'REAL_TIME_UPDATE': 'Updated'
    };

    // If not in mapping, clean up the action name
    if (!actionMapping[action]) {
      return action
        .replace(/_/g, ' ')
        .replace(/EVENT REQUEST/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    return actionMapping[action];
  };

  // Helper function to render field changes from structured _auditMetadata or fallback to changeDescription
  const renderFieldChanges = (log: AuditLogEntry) => {
    // First, try to use structured data from _auditMetadata.changes (NEW enhanced format)
    try {
      if (log.newData || log.oldData) {
        let metadataChanges: any[] = [];
        
        // Try to extract structured changes from newData or oldData
        if (log.newData) {
          const newDataParsed = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
          metadataChanges = newDataParsed?._auditMetadata?.changes || [];
        }
        
        if (metadataChanges.length === 0 && log.oldData) {
          const oldDataParsed = typeof log.oldData === 'string' ? JSON.parse(log.oldData) : log.oldData;
          metadataChanges = oldDataParsed?._auditMetadata?.changes || [];
        }

        // If we have structured changes, render them properly
        if (metadataChanges.length > 0) {
          return (
            <div className="mt-3">
              <div className="text-sm font-medium text-gray-700 mb-2">What Changed:</div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
              {metadataChanges.map((change: any, index: number) => {
                // Get human-readable field name
                const fieldName = change.fieldDisplayName || getHumanReadableFieldName(change.field || change.fieldName || 'Unknown Field');
                
                // Format old and new values
                const oldValueFormatted = formatValue(change.oldValue, fieldName);
                const newValueFormatted = formatValue(change.newValue, fieldName);
                
                // For cleaner display, check if this is a CREATE operation (no old value or old value is "Not set")
                const isCreate = change.oldValue === null ||
                                change.oldValue === undefined ||
                                oldValueFormatted === 'Not set' ||
                                oldValueFormatted === '(not set)';

                return (
                  <div key={index} className="flex items-start text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-l-teal-500">
                    <Edit className="h-4 w-4 mr-3 mt-0.5 text-orange-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 mb-2">
                        {fieldName}
                      </div>
                      <div className="space-y-1">
                        {!isCreate && (
                          <div className="flex items-center text-xs text-gray-600">
                            <span className="font-medium mr-2">Previous:</span>
                            <span className="px-2 py-1 bg-red-50 text-red-700 rounded border border-red-200 line-through">
                              {oldValueFormatted}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center text-xs">
                          <span className="font-medium mr-2 text-gray-600">
                            {isCreate ? 'Set to:' : 'Updated to:'}
                          </span>
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-200 font-medium">
                            {newValueFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          );
        }
      }
    } catch (error) {
      logger.warn('Failed to parse structured audit metadata:', error);
    }

    // Fallback: If we have a changeDescription from the enhanced AuditLogger but no structured data
    if (log.changeDescription && log.changeDescription !== log.actionDescription) {
      return (
        <div className="mt-3">
          <div className="text-sm font-medium text-gray-700 mb-2">What Changed:</div>
          <div className="flex items-start text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-l-teal-500">
            <Edit className="h-4 w-4 mr-3 mt-0.5 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <span className="text-gray-800 leading-relaxed">{log.changeDescription}</span>
            </div>
          </div>
        </div>
      );
    }

    // Fallback to legacy details display
    if (log.details?.updatedFields) {
      return (
        <div className="mt-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Fields Updated:</div>
          <div className="flex items-start text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-l-blue-500">
            <Edit className="h-4 w-4 mr-3 mt-0.5 text-orange-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex flex-wrap gap-2">
                {log.details.updatedFields.map((fieldName: string, index: number) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 text-xs bg-brand-primary-light text-brand-primary rounded border border-brand-primary-border font-medium"
                  >
                    {getHumanReadableFieldName(fieldName)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleRefresh = async () => {
    logger.log('🔄 Refresh button clicked');
    trackClick(
      'Refresh Audit Log',
      'Audit',
      'Event Requests',
      'Manual refresh of audit log data'
    );
    try {
      logger.log('📡 Triggering refetch...');
      // Use refetch directly from the query hook
      await refetch();
      logger.log('✅ Refetch complete');
    } catch (error) {
      logger.error('❌ Refetch error:', error);
    }
  };

  const handleFilterChange = (type: string, value: string) => {
    switch (type) {
      case 'time':
        setTimeFilter(value);
        trackFilter('Time Filter', value, 'Audit', 'Event Requests');
        break;
      case 'action':
        setActionFilter(value);
        trackFilter('Action Filter', value, 'Audit', 'Event Requests');
        break;
      case 'user':
        setUserFilter(value);
        trackFilter('User Filter', value, 'Audit', 'Event Requests');
        break;
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      trackSearch(value, 'Audit', 'Event Requests');
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full shadow-lg" data-testid="audit-log-loading">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-3 text-xl font-sub-heading text-gray-900">
            <Shield className="h-6 w-6 text-teal-600" />
            Loading Audit Log...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded-md w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded-md w-1/2"></div>
            <div className="h-6 bg-gray-200 rounded-md w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full shadow-lg" data-testid="audit-log">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-teal-600" />
            <div>
              <h1 className="text-2xl font-sub-heading text-gray-900">Event Request Audit Log</h1>
              {eventId && (
                <Badge variant="outline" className="mt-1 text-teal-700 border-teal-300 bg-teal-50">
                  Event #{eventId}
                </Badge>
              )}
            </div>
          </div>
          <Button 
            onClick={handleRefresh} 
            className="btn-tsp-primary"
            data-testid="button-refresh-audit-log"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
        <CardDescription className="text-base text-gray-600 leading-relaxed">
          Complete tracking of all changes made to event requests - who did what and when
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {showFilters && (
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full md:w-auto flex items-center gap-2 text-base"
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4" />
                Filters
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="space-y-4 mt-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search by organization, contact, user, or action..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 text-base h-12"
                  data-testid="input-search-audit-log"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Range
                  </label>
                  <Select
                    value={timeFilter}
                    onValueChange={(value) => handleFilterChange('time', value)}
                  >
                    <SelectTrigger className="h-12 text-base" data-testid="select-time-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last Hour</SelectItem>
                      <SelectItem value="24">Last 24h</SelectItem>
                      <SelectItem value="72">Last 3 days</SelectItem>
                      <SelectItem value="168">Last Week</SelectItem>
                      <SelectItem value="720">Last Month</SelectItem>
                      <SelectItem value="0">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Action Type
                  </label>
                  <Select
                    value={actionFilter}
                    onValueChange={(value) => handleFilterChange('action', value)}
                  >
                    <SelectTrigger className="h-12 text-base" data-testid="select-action-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="CREATE">Create Request</SelectItem>
                      <SelectItem value="PRIMARY_CONTACT_COMPLETED">Contact Completed</SelectItem>
                      <SelectItem value="EVENT_DETAILS_UPDATED">Details Updated</SelectItem>
                      <SelectItem value="STATUS_CHANGED">Status Changed</SelectItem>
                      <SelectItem value="FOLLOW_UP_RECORDED">Follow-up Recorded</SelectItem>
                      <SelectItem value="MARKED_UNRESPONSIVE">Marked Unresponsive</SelectItem>
                      <SelectItem value="DELETE">Deleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {uniqueUsers.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User
                    </label>
                    <Select
                      value={userFilter}
                      onValueChange={(value) => handleFilterChange('user', value)}
                    >
                      <SelectTrigger className="h-12 text-base" data-testid="select-user-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {uniqueUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Results Summary */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <span className="text-base font-medium text-gray-700">
            {filteredLogs.length}{' '}
            {filteredLogs.length === 1 ? 'entry' : 'entries'} found
          </span>
          {searchTerm && (
            <Button
              variant="ghost"
              onClick={() => handleSearch('')}
              className="text-teal-600 hover:text-teal-700"
              data-testid="button-clear-search"
            >
              Clear search
            </Button>
          )}
        </div>

        {/* Audit Log Entries */}
        <ScrollArea className={compact ? 'h-96' : 'h-[600px]'} data-testid="audit-log-entries">
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No audit entries found</p>
                <p className="text-base">Try adjusting your search criteria or time range</p>
              </div>
            ) : (
              filteredLogs.map((log, index) => (
                <Card key={log.id} className="shadow-sm hover:shadow-md transition-shadow" data-testid={`audit-entry-${log.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Action Badge - More Compact */}
                      <div className={`inline-flex items-center px-2 py-1 rounded-md border ${getActionStyle(log.action)} flex-shrink-0 max-w-[150px]`}>
                        {getActionIcon(log.action)}
                        <span className="ml-1 font-medium text-[11px] truncate">
                          {getHumanReadableActionName(log.action)}
                        </span>
                      </div>

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">
                              {log.organizationName} - {log.contactName}
                            </h3>
                            {log.eventId && (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs text-teal-700 border-teal-300 bg-teal-50">
                                  Event #{log.eventId}
                                </Badge>
                                {log.statusChange && (
                                  <Badge variant="outline" className="text-xs text-purple-700 border-purple-300 bg-purple-50">
                                    {log.statusChange}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 space-x-4 flex-shrink-0">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              <span>{userNameCache[log.userId] || log.userEmail}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>
                                {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Primary description - only show if we have a meaningful one */}
                        {(() => {
                          // Filter out technical/raw field descriptions that contain internal field names
                          const internalFieldPatterns = [
                            'externalId:',
                            'googleSheetRowId:',
                            'createdBy:',
                            'lastSyncedAt:',
                            'duplicateCheckDate:',
                            'organizationExists:',
                            'geocodedAt:',
                          ];

                          const description = log.changeDescription;

                          // Don't show if it's empty or contains internal field patterns
                          if (!description) return null;

                          const hasInternalFields = internalFieldPatterns.some(pattern =>
                            description.includes(pattern)
                          );

                          // Match technical/raw dump format: "field: Not set → value, field2: Not set → value2, ..."
                          const rawDumpRegex = /^(\w+): Not set → [^,]+(, \w+: Not set → [^,]+)*$/;
                          const looksLikeRawDump = rawDumpRegex.test(description);

                          if (hasInternalFields || looksLikeRawDump) {
                            return null;
                          }

                          return (
                            <p className="text-base text-gray-700 mb-3 leading-relaxed">
                              {description}
                            </p>
                          );
                        })()}

                        {/* Field Changes Display */}
                        {renderFieldChanges(log)}

                        {/* Enhanced Follow-up Context Display */}
                        {(() => {
                          // Try to get follow-up context from _auditActionContext
                          let followUpContext: any = {};
                          try {
                            if (log.newData) {
                              const newDataParsed = typeof log.newData === 'string' ? JSON.parse(log.newData) : log.newData;
                              followUpContext = newDataParsed?._auditActionContext || {};
                            }
                          } catch (error) {
                            logger.warn('Failed to parse audit action context:', error);
                          }
                          
                          const hasFollowUpData = log.statusChange || log.followUpMethod || followUpContext.followUpMethod;
                          
                          if (hasFollowUpData) {
                            return (
                              <div className="mt-4 p-3 bg-brand-primary-lighter rounded-lg">
                                <div className="text-sm font-medium text-gray-700 mb-2">Additional Context:</div>
                                <div className="space-y-2">
                                  {log.statusChange && (
                                    <div className="flex items-center text-sm text-brand-primary">
                                      <RefreshCw className="h-4 w-4 mr-2" />
                                      Status: {log.statusChange}
                                    </div>
                                  )}
                                  {(log.followUpMethod || followUpContext.followUpMethod) && (
                                    <div className="flex items-center text-sm text-green-700">
                                      <Mail className="h-4 w-4 mr-2" />
                                      Method: {log.followUpMethod || followUpContext.followUpMethod}
                                    </div>
                                  )}
                                  {followUpContext.followUpAction && (
                                    <div className="flex items-center text-sm text-brand-primary">
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      Action: {followUpContext.followUpAction}
                                    </div>
                                  )}
                                  {followUpContext.notes && (
                                    <div className="flex items-start text-sm text-gray-700">
                                      <FileText className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                      <span>{followUpContext.notes}</span>
                                    </div>
                                  )}
                                  {followUpContext.updatedEmail && (
                                    <div className="flex items-center text-sm text-purple-700">
                                      <Mail className="h-4 w-4 mr-2" />
                                      Updated Email: {followUpContext.updatedEmail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}