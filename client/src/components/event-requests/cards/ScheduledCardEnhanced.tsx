import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEventQueries } from '../hooks/useEventQueries';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Clock,
  Package,
  MapPin,
  Building,
  Building2,
  Edit2,
  Save,
  X,
  Trash2,
  Calendar,
  Users,
  Car,
  Truck,
  Megaphone,
  UserPlus,
  Phone,
  Mail,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  FileText,
  MessageSquare,
  Loader2,
  Sparkles,
  Plus,
  Check,
  HelpCircle,
} from 'lucide-react';
import {
  formatTime12Hour,
  formatTimeForInput,
  formatEventDate,
} from '@/components/event-requests/utils';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
  SANDWICH_TYPES,
  statusOptions,
} from '@/components/event-requests/constants';
import {
  parseSandwichTypes,
  formatSandwichTypesDisplay,
} from '@/lib/sandwich-utils';
import type { EventRequest } from '@shared/schema';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import { getMissingIntakeInfo } from '@/lib/event-request-validation';
import { EventRequestAuditLog } from '@/components/event-request-audit-log';
import { MessageComposer } from '@/components/message-composer';
import { MlkDayBadge } from '@/components/event-requests/MlkDayBadge';
import { RefrigerationWarningBadge } from '@/components/event-requests/RefrigerationWarningBadge';
import { SendEventDetailsSMSDialog } from '../dialogs/SendEventDetailsSMSDialog';
import { SendCorrectionSMSDialog } from '../dialogs/SendCorrectionSMSDialog';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { CommentThread } from '@/components/collaboration';
import { useToast } from '@/hooks/use-toast';
import { addEventToGoogleSheet, formatDateForGoogleSheet } from '@/lib/google-sheets-api';
import { Sheet } from 'lucide-react';
import { invalidateEventRequestQueries } from '@/lib/queryClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PreEventFlagsBanner, PreEventFlagsDialog } from '@/components/pre-event-flags';
import { Flag } from 'lucide-react';
import { ProposeToSheetButton } from '@/components/propose-to-sheet-button';
import { InlineRecipientAllocationEditor } from '../InlineRecipientAllocationEditor';
import { useReturningOrganization } from '@/hooks/use-returning-organization';
import { RefreshCw } from 'lucide-react';
import type { RecipientAllocation } from '../RecipientAllocationEditor';

interface ScheduledCardEnhancedProps {
  request: EventRequest;
  editingField: string | null;
  editingValue: string;
  isEditingThisCard: boolean;
  inlineSandwichMode: 'total' | 'types' | 'range';
  inlineTotalCount: number;
  inlineSandwichTypes: Array<{ type: string; quantity: number }>;
  inlineRangeMin: number;
  inlineRangeMax: number;
  inlineRangeType: string;
  isSaving?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onContact: () => void;
  onAssignTspContact: () => void;
  onEditTspContact: () => void;
  onLogContact: () => void;
  onFollowUp: () => void;
  onReschedule: () => void;
  onAiIntakeAssist?: () => void;
  startEditing: (field: string, value: string) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  setEditingValue: (value: string) => void;
  tempIsConfirmed: boolean;
  setTempIsConfirmed: (value: boolean) => void;
  quickToggleBoolean: (field: 'isConfirmed' | 'addedToOfficialSheet', value: boolean) => void;
  setInlineSandwichMode: (mode: 'total' | 'types' | 'range') => void;
  setInlineTotalCount: (count: number) => void;
  setInlineRangeMin: (count: number) => void;
  setInlineRangeMax: (count: number) => void;
  setInlineRangeType: (type: string) => void;
  addInlineSandwichType: () => void;
  updateInlineSandwichType: (index: number, field: 'type' | 'quantity', value: string | number) => void;
  removeInlineSandwichType: (index: number) => void;
  resolveUserName: (id: string) => string;
  resolveRecipientName?: (id: string) => string;
  openAssignmentDialog: (type: 'driver' | 'speaker' | 'volunteer', isVanDriver?: boolean) => void;
  handleRemoveAssignment: (type: 'driver' | 'speaker' | 'volunteer', personId: string) => void;
  canEdit?: boolean;
  // Next Action handlers
  onAddNextAction?: () => void;
  onEditNextAction?: () => void;
  onCompleteNextAction?: () => void;
}

const parsePostgresArray = (arr: unknown): string[] => {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr.map(String).filter((item) => item && item.trim());
  if (typeof arr === 'string') {
    if (arr === '{}' || arr === '') return [];
    const cleaned = arr.replace(/^{|}$/g, '');
    if (!cleaned) return [];
    return cleaned.split(',').map((item) => item.trim()).filter((item) => item);
  }
  return [];
};

const extractCustomName = (id: string): string => {
  if (!id || typeof id !== 'string') return '';
  if (id.startsWith('custom-')) {
    const parts = id.split('-');
    if (parts.length >= 3) {
      const nameParts = parts.slice(2);
      return nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
    }
    return 'Custom Volunteer';
  }
  return ''; // Return empty string so resolveUserName gets called
};

export const ScheduledCardEnhanced: React.FC<ScheduledCardEnhancedProps> = ({
  request,
  editingField,
  editingValue,
  isEditingThisCard,
  inlineSandwichMode,
  inlineTotalCount,
  inlineSandwichTypes,
  inlineRangeMin,
  inlineRangeMax,
  inlineRangeType,
  isSaving = false,
  onEdit,
  onDelete,
  onContact,
  onAssignTspContact,
  onEditTspContact,
  onLogContact,
  onFollowUp,
  onReschedule,
  onAiIntakeAssist,
  startEditing,
  saveEdit,
  cancelEdit,
  setEditingValue,
  tempIsConfirmed,
  setTempIsConfirmed,
  quickToggleBoolean,
  setInlineSandwichMode,
  setInlineTotalCount,
  setInlineRangeMin,
  setInlineRangeMax,
  setInlineRangeType,
  addInlineSandwichType,
  updateInlineSandwichType,
  removeInlineSandwichType,
  resolveUserName,
  resolveRecipientName,
  openAssignmentDialog,
  handleRemoveAssignment,
  canEdit = true,
  onAddNextAction,
  onEditNextAction,
  onCompleteNextAction,
}) => {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showNotesAndRequirements, setShowNotesAndRequirements] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showSendSmsDialog, setShowSendSmsDialog] = useState(false);
  const [showSendCorrectionDialog, setShowSendCorrectionDialog] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showPreEventFollowUpDialog, setShowPreEventFollowUpDialog] = useState(false);
  const [showAllocationEditor, setShowAllocationEditor] = useState(false);
  const [preEventFollowUpNotes, setPreEventFollowUpNotes] = useState('');
  const [showFlagsDialog, setShowFlagsDialog] = useState(false);

  const { user } = useAuth();
  const canSendSMS = user && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_SEND_SMS);
  const canEditTspContact = user && hasPermission(user, PERMISSIONS.EVENT_REQUESTS_EDIT_TSP_CONTACT);

  // Collaboration hook for comments
  const collaboration = useEventCollaboration(request.id);

  // Check if this organization is returning (has past events) and if the contact is the same
  // Contact matching requires email OR (name + phone) to prevent false positives from same names
  const contactFullName = [request.firstName, request.lastName].filter(Boolean).join(' ') || null;
  const { data: returningOrgData } = useReturningOrganization(
    request.organizationName,
    request.id,
    request.email,
    contactFullName,
    request.phone,        // contactPhone - used with name for secondary matching
    request.department,   // department - used for umbrella org matching (churches, scouts)
    request.status === 'scheduled'
  );

  // Check if there's any communication/notes content to show
  // Safely check if contactAttemptsLog is an array with items
  const hasContactAttempts = Array.isArray(request.contactAttemptsLog) && request.contactAttemptsLog.length > 0;
  const hasCommunicationContent = !!(
    hasContactAttempts ||
    (request.unresponsiveNotes && !hasContactAttempts) ||
    request.followUpNotes ||
    request.distributionNotes ||
    request.duplicateNotes ||
    request.socialMediaPostNotes
  );

  // Default to collapsed when there's no content
  const [showCommunicationNotes, setShowCommunicationNotes] = useState(hasCommunicationContent);
  const [addingAllTimes, setAddingAllTimes] = useState(false);
  const [tempStartTime, setTempStartTime] = useState('');
  const [tempEndTime, setTempEndTime] = useState('');
  const [tempPickupTime, setTempPickupTime] = useState('');
  const [tempOvernightHolding, setTempOvernightHolding] = useState('');
  const [isExportingToSheet, setIsExportingToSheet] = useState(false);

  // State for recording actual/final sandwich count
  const [isEditingActualCount, setIsEditingActualCount] = useState(false);
  const [actualCountMode, setActualCountMode] = useState<'simple' | 'detailed'>('simple');
  const [actualCountSimple, setActualCountSimple] = useState('');
  const [actualCountTypes, setActualCountTypes] = useState<Record<string, number>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for updating event request fields
  const updateFieldsMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const response = await fetch(`/api/event-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to update event request');
      }

      return response.json();
    },
    onSuccess: () => {
      invalidateEventRequestQueries(queryClient);
      setAddingAllTimes(false);
      setTempStartTime('');
      setTempEndTime('');
      setTempPickupTime('');
    },
  });

  const toggleDhlVan = (value: boolean) => {
    const payload: Record<string, unknown> = { isDhlVan: value };
    if (value) {
      payload.vanDriverNeeded = true;
      payload.assignedVanDriverId = null;
      // Default to no additional regular drivers when van is enabled
      payload.driversNeeded = 0;
    }
    updateFieldsMutation.mutate(payload);
  };

  // Use shared reference data from useEventQueries (eliminates duplicate API calls)
  const {
    hostContacts,
    hostContactsLoading: isLoadingHostContacts,
    recipients,
    hosts: hostLocations,
  } = useEventQueries();

  const resolveLocalRecipientName = (recipientId: string): string => {
    // Handle custom entries with format "custom-timestamp-Name" or "custom:Name"
    if (recipientId.startsWith('custom-') || recipientId.startsWith('custom:')) {
      // Extract just the name part from formats like:
      // - "custom-1761977247368-David" -> "David"
      // - "custom:David" -> "David"
      const parts = recipientId.split('-');
      if (parts.length >= 3) {
        // Format: custom-timestamp-Name
        return parts.slice(2).join('-'); // Handle names with dashes
      } else if (recipientId.includes(':')) {
        // Format: custom:Name
        return recipientId.split(':')[1];
      }
      return recipientId.replace('custom-', '').replace('custom:', '');
    }

    if (recipientId.includes(':')) {
      const [type, ...rest] = recipientId.split(':');
      const value = rest.join(':');

      if (!isNaN(Number(value))) {
        const numId = Number(value);

        if (type === 'host') {
          console.log(`resolveLocalRecipientName: Looking for host ID ${numId} in ${hostContacts.length} contacts`);
          const hostContact = hostContacts.find(hc => hc.id === numId);
          if (hostContact) {
            console.log(`resolveLocalRecipientName: Found host contact:`, hostContact);
            // Prefer displayName (includes host location), then name, then hostLocationName
            if (hostContact.displayName) {
              return hostContact.displayName;
            }
            if (hostContact.name) {
              return hostContact.name;
            }
            if (hostContact.hostLocationName) {
              return hostContact.hostLocationName;
            }
          }
          console.log(`resolveLocalRecipientName: Host contact ${numId} not found, checking host locations`);
          const hostLocation = hostLocations.find(h => h.id === numId);
          if (hostLocation) {
            console.log(`resolveLocalRecipientName: Found host location:`, hostLocation);
            return hostLocation.name;
          }
          // If host not found, return a helpful message instead of just the ID
          console.warn(`resolveLocalRecipientName: Host ${numId} not found in either contacts or locations! Available IDs:`, hostContacts.map(h => h.id));
          return `Host ID ${numId}`;
        } else if (type === 'recipient') {
          // Check recipients first
          const recipient = recipients.find(r => r.id === numId);
          if (recipient) return recipient.name;

          // Fallback: check host contacts (in case data was mislabeled)
          console.log(`resolveLocalRecipientName: Recipient ${numId} not found, checking hosts as fallback`);
          const hostContact = hostContacts.find(hc => hc.id === numId);
          if (hostContact) {
            if (hostContact.displayName) return hostContact.displayName;
            if (hostContact.name) return hostContact.name;
            if (hostContact.hostLocationName) return hostContact.hostLocationName;
          }

          // Fallback: check host locations
          const hostLocation = hostLocations.find(h => h.id === numId);
          if (hostLocation) return hostLocation.name;

          // If not found anywhere, return a helpful message
          return `Recipient ID ${numId}`;
        }
      }
      return value;
    }

    // Handle plain numeric IDs (legacy format without "host:" prefix)
    if (!isNaN(Number(recipientId))) {
      const numId = Number(recipientId);
      // Check host contacts first (more specific), then locations, then recipients
      const hostContact = hostContacts.find(h => h.id === numId);
      if (hostContact) {
        // Prefer displayName (includes host location), then name, then hostLocationName
        if (hostContact.displayName) {
          return hostContact.displayName;
        }
        if (hostContact.name) {
          return hostContact.name;
        }
        if (hostContact.hostLocationName) {
          return hostContact.hostLocationName;
        }
      }
      const hostLocation = hostLocations.find(h => h.id === numId);
      if (hostLocation) return hostLocation.name;
      const recipient = recipients.find(r => r.id === numId);
      if (recipient) return recipient.name;
      // If not found anywhere, return a helpful message
      return `ID ${numId}`;
    }

    return recipientId;
  };

  // Use the prop if provided, otherwise use local implementation
  const getRecipientName = resolveRecipientName || resolveLocalRecipientName;

  // Get display date
  const displayDate = request.scheduledEventDate || request.desiredEventDate;
  const dateInfo = displayDate ? formatEventDate(displayDate.toString()) : null;

  // Calculate follow-up reminder status
  // Show indicator when event is 2 weeks prior if scheduled more than 3 weeks ahead, or 1 week prior ideally
  const followUpStatus = (() => {
    if (!displayDate || request.status !== 'scheduled') return null;
    
    try {
      const eventDate = new Date(displayDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      eventDate.setHours(0, 0, 0, 0);
      
      const daysUntilEvent = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Check when event was scheduled (use statusChangedAt or createdAt as fallback)
      const scheduledAt = request.statusChangedAt ? new Date(request.statusChangedAt) : (request.createdAt ? new Date(request.createdAt) : null);
      const daysSinceScheduled = scheduledAt ? Math.round((today.getTime() - scheduledAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
      
      // If scheduled more than 3 weeks (21 days) ahead and we're now 2 weeks (14 days) prior
      if (daysSinceScheduled !== null && daysSinceScheduled >= 21 && daysUntilEvent === 14) {
        return { type: '2weeks', daysUntil: daysUntilEvent };
      }
      
      // If 1 week (7 days) prior
      if (daysUntilEvent === 7) {
        return { type: '1week', daysUntil: daysUntilEvent };
      }
      
      return null;
    } catch {
      return null;
    }
  })();

  // Calculate staffing
  const driverAssigned = parsePostgresArray(request.assignedDriverIds).length + (request.assignedVanDriverId ? 1 : 0) + (request.isDhlVan ? 1 : 0);
  const speakerAssigned = Object.keys(request.speakerDetails || {}).length;
  const volunteerAssigned = parsePostgresArray(request.assignedVolunteerIds).length;
  const driverNeeded = request.driversNeeded || 0;
  const speakerNeeded = request.speakersNeeded || 0;
  const volunteerNeeded = request.volunteersNeeded || 0;
  const totalAssigned = driverAssigned + speakerAssigned + volunteerAssigned;
  const totalNeeded = driverNeeded + speakerNeeded + volunteerNeeded;
  const staffingComplete = totalAssigned >= totalNeeded && totalNeeded > 0;

  // Check if event is within next 7 days (for urgent staffing badge color)
  // Note: displayDate is already defined above
  const isWithin7Days = (() => {
    if (!displayDate) return false;
    // Parse as local date to avoid timezone issues
    const dateStr = displayDate.toString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return eventDate <= sevenDaysFromNow && eventDate >= today;
  })();

  // Staffing badge colors - red (#A31C41) if within 7 days, gold (#FBAD3F) otherwise
  const staffingBadgeColors = isWithin7Days
    ? 'bg-[#A31C41] text-white border border-[#A31C41]'
    : 'bg-[#FBAD3F] text-white border border-[#FBAD3F]';

  // Sandwich info
  const hasRange = request.estimatedSandwichCountMin && request.estimatedSandwichCountMax;
  let sandwichInfo;
  if (hasRange) {
    const rangeType = request.estimatedSandwichRangeType;
    const typeLabel = rangeType ? SANDWICH_TYPES.find(t => t.value === rangeType)?.label : null;
    sandwichInfo = `${request.estimatedSandwichCountMin}-${request.estimatedSandwichCountMax}${typeLabel ? ` ${typeLabel}` : ''}`;
  } else {
    sandwichInfo = formatSandwichTypesDisplay(request.sandwichTypes, request.estimatedSandwichCount ?? undefined);
  }

  // Compact sandwich count for the header badge (prevents long type strings from overflowing the card)
  const sandwichCountBadgeText = (() => {
    if (hasRange) {
      return `${request.estimatedSandwichCountMin}-${request.estimatedSandwichCountMax}`;
    }
    if (typeof request.estimatedSandwichCount === 'number' && request.estimatedSandwichCount > 0) {
      return `${request.estimatedSandwichCount}`;
    }
    const parsedTypes = parseSandwichTypes(request.sandwichTypes);
    const totalFromTypes =
      parsedTypes?.reduce((sum, t) => sum + (typeof t.quantity === 'number' ? t.quantity : 0), 0) ?? 0;
    return totalFromTypes > 0 ? `${totalFromTypes}` : 'TBD';
  })();

  // TSP Contact display (was lost in redesign; show under Event Details / Sandwiches)
  const tspContactDisplay = useMemo(() => {
    const custom = (request.customTspContact || '').trim();
    if (custom) return custom;
    if (request.tspContactAssigned) return resolveUserName(request.tspContactAssigned);
    if (request.tspContact) return resolveUserName(request.tspContact);
    return null;
  }, [request.customTspContact, request.tspContactAssigned, request.tspContact, resolveUserName]);

  const missingInfo = getMissingIntakeInfo(request);

  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  };

  let dateFieldToEdit = 'desiredEventDate';
  let dateLabel = 'Requested Date';
  if (request.scheduledEventDate) {
    dateFieldToEdit = 'scheduledEventDate';
    dateLabel = request.status === 'completed' ? 'Event Date' : 'Scheduled Date';
  }

  // Handler to export event to Google Sheet
  const handleExportToGoogleSheet = async () => {
    const eventDate = request.scheduledEventDate || request.desiredEventDate;
    if (!eventDate) {
      toast({
        title: 'Missing Date',
        description: 'Cannot export event without a date.',
        variant: 'destructive',
      });
      return;
    }

    if (!request.organizationName) {
      toast({
        title: 'Missing Organization Name',
        description: 'Cannot export event without an organization name.',
        variant: 'destructive',
      });
      return;
    }

    setIsExportingToSheet(true);

    try {
      // Build staffing string in the format the spreadsheet expects:
      // D = driver needed, D: Name = driver assigned
      // S = speaker needed, S: Name = speaker assigned
      // V = volunteer needed, V: Name = volunteer assigned
      // VD = van driver needed, VD: Name = van driver assigned
      const staffingParts: string[] = [];

      // Drivers
      const assignedDriverIds = parsePostgresArray(request.assignedDriverIds);
      const driversNeededCount = request.driversNeeded || 0;
      assignedDriverIds.forEach(id => {
        const isCustom = id.startsWith('custom-');
        const idLooksLikeName = id &&
          !id.startsWith('user_') && !id.startsWith('driver_') && !id.startsWith('driver-') &&
          !id.startsWith('custom-') && !id.startsWith('host-contact-') &&
          !/^\d+$/.test(id) && id.includes(' ');
        const resolvedName = resolveUserName(id);
        const name = isCustom
          ? extractCustomName(id)
          : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
        staffingParts.push(name ? `D: ${name}` : 'D');
      });
      // Add unfilled driver slots - include van driver and DHL van in fulfilled count
      const totalDriversAssigned = assignedDriverIds.length +
                                   (request.assignedVanDriverId ? 1 : 0) +
                                   (request.isDhlVan ? 1 : 0);
      const unfilledDrivers = Math.max(0, driversNeededCount - totalDriversAssigned);
      for (let i = 0; i < unfilledDrivers; i++) {
        staffingParts.push('D');
      }

      // Van Driver (separate from regular drivers)
      if (request.assignedVanDriverId) {
        const name = resolveUserName(request.assignedVanDriverId);
        staffingParts.push(name ? `VD: ${name}` : 'VD');
      } else if (request.vanDriverNeeded) {
        staffingParts.push('VD');
      }

      // Speakers
      const speakerDetails = request.speakerDetails as Record<string, { name?: string }> | null;
      const assignedSpeakerIds = speakerDetails ? Object.keys(speakerDetails) : [];
      const speakersNeededCount = request.speakersNeeded || 0;
      assignedSpeakerIds.forEach(id => {
        const detailName = speakerDetails?.[id]?.name;
        const customName = extractCustomName(id);
        const userName = resolveUserName(id);
        const name = detailName || customName || userName;
        staffingParts.push(name ? `S: ${name}` : 'S');
      });
      // Add unfilled speaker slots
      const unfilledSpeakers = Math.max(0, speakersNeededCount - assignedSpeakerIds.length);
      for (let i = 0; i < unfilledSpeakers; i++) {
        staffingParts.push('S');
      }

      // Volunteers
      const assignedVolunteerIds = parsePostgresArray(request.assignedVolunteerIds);
      const volunteersNeededCount = request.volunteersNeeded || 0;
      assignedVolunteerIds.forEach(id => {
        const isCustom = id.startsWith('custom-');
        const idLooksLikeName = id &&
          !id.startsWith('user_') && !id.startsWith('driver_') && !id.startsWith('volunteer_') &&
          !id.startsWith('volunteer-') && !id.startsWith('custom-') && !id.startsWith('host-contact-') &&
          !/^\d+$/.test(id) && id.includes(' ');
        const resolvedName = resolveUserName(id);
        const name = isCustom
          ? extractCustomName(id)
          : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
        staffingParts.push(name ? `V: ${name}` : 'V');
      });
      // Add unfilled volunteer slots
      const unfilledVolunteers = Math.max(0, volunteersNeededCount - assignedVolunteerIds.length);
      for (let i = 0; i < unfilledVolunteers; i++) {
        staffingParts.push('V');
      }

      // Build details from various notes (planning notes go here)
      const detailParts: string[] = [];
      if (request.planningNotes) detailParts.push(request.planningNotes);
      if (request.schedulingNotes) detailParts.push(request.schedulingNotes);
      if (request.specialRequirements) detailParts.push(request.specialRequirements);
      if (request.distributionNotes) detailParts.push(request.distributionNotes);

      // Determine sandwich type (Deli or PBJ) and calculate total from sandwichTypes if needed
      let sandwichTypeStr = '';
      let sandwichTotal = request.estimatedSandwichCount || 0;
      const parsedTypes = parseSandwichTypes(request.sandwichTypes);
      if (parsedTypes && parsedTypes.length > 0) {
        // Filter out unknown types and format type names nicely
        const validTypes = parsedTypes.filter(t => t.type.toLowerCase() !== 'unknown' && t.quantity > 0);
        sandwichTypeStr = validTypes.map(t => {
          // Format type name: capitalize first letter, handle special cases
          const typeName = t.type.toLowerCase();
          if (typeName === 'pbj' || typeName === 'pb&j') return 'PB&J';
          if (typeName === 'deli') return 'Deli';
          return t.type.charAt(0).toUpperCase() + t.type.slice(1);
        }).join(', ');
        // Calculate total from sandwichTypes
        const typesTotal = validTypes.reduce((sum, t) => sum + (t.quantity || 0), 0);
        // Use the larger of estimatedSandwichCount or calculated total
        if (typesTotal > sandwichTotal) {
          sandwichTotal = typesTotal;
        }
      }

      // Get TSP contact name - check multiple possible fields
      let tspContactName = request.customTspContact || '';
      if (!tspContactName && request.tspContactAssigned) {
        tspContactName = resolveUserName(request.tspContactAssigned);
      }
      if (!tspContactName && request.tspContact) {
        tspContactName = resolveUserName(request.tspContact);
      }

      // Get recipient/host info
      const recipientIds = parsePostgresArray(request.assignedRecipientIds);
      const recipientNames = recipientIds.map(id => getRecipientName(id)).filter(Boolean).join(', ');

      // Determine van booked status with AM/PM based on event start time
      let vanBookedStatus = '';
      if (request.isDhlVan) {
        vanBookedStatus = 'DHL Van';
      } else if (request.assignedVanDriverId || request.customVanDriverName) {
        // Van is booked - determine AM/PM/All Day from event start time
        if (request.eventStartTime) {
          // Parse time string (could be "14:00", "2:00 PM", etc.)
          const timeStr = request.eventStartTime;
          let hour = 0;

          // Try parsing HH:MM format
          const match24 = timeStr.match(/^(\d{1,2}):(\d{2})/);
          if (match24) {
            hour = parseInt(match24[1], 10);
          }
          // Check for PM indicator in 12-hour format
          if (timeStr.toLowerCase().includes('pm') && hour < 12) {
            hour += 12;
          } else if (timeStr.toLowerCase().includes('am') && hour === 12) {
            hour = 0;
          }

          vanBookedStatus = hour < 12 ? 'AM' : 'PM';
        } else {
          // No start time specified
          vanBookedStatus = 'All Day';
        }
      } else if (request.vanDriverNeeded) {
        vanBookedStatus = 'Needed';
      } else if (request.selfTransport) {
        vanBookedStatus = 'Self Transport';
      }

      // Build the payload for Google Sheets
      const sheetPayload = {
        // Required
        date: formatDateForGoogleSheet(eventDate),
        groupName: request.organizationName,
        // Timing
        startTime: request.eventStartTime ? formatTime12Hour(request.eventStartTime) : '',
        endTime: request.eventEndTime ? formatTime12Hour(request.eventEndTime) : '',
        pickupTime: request.pickupTime ? formatTime12Hour(request.pickupTime) : '',
        // Details
        details: detailParts.join(' | '),
        socialPost: request.socialMediaPostNotes || '',
        staffing: staffingParts.join(', '),
        estimate: sandwichTotal ? String(sandwichTotal) : '',
        sandwichType: sandwichTypeStr,
        // Contact info - use submitter contact fields
        contactName: [request.firstName, request.lastName].filter(Boolean).join(' ') || '',
        contactEmail: request.email || '',
        contactPhone: request.phone || '',
        tspContact: tspContactName,
        // Location
        address: request.eventAddress || '',
        vanBooked: vanBookedStatus,
        // Notes
        notes: request.followUpNotes || '',
        additionalNotes: request.duplicateNotes || '',
        waitingOn: '',
        recipientHost: recipientNames,
      };

      // Debug logging - show exactly what's being sent to Google Sheets
      console.log('=== GOOGLE SHEETS PAYLOAD ===');
      console.log('estimate (Column J):', sheetPayload.estimate);
      console.log('sandwichType (Column K):', sheetPayload.sandwichType);
      console.log('tspContact (Column Q):', sheetPayload.tspContact);
      console.log('vanBooked (Column S):', sheetPayload.vanBooked);
      console.log('Full payload:', sheetPayload);

      const result = await addEventToGoogleSheet(sheetPayload);

      if (result.success) {
        toast({
          title: 'Added to Google Sheet',
          description: result.message,
        });
        // Mark as added to official sheet
        if (!request.addedToOfficialSheet) {
          quickToggleBoolean('addedToOfficialSheet', false);
        }
      } else {
        toast({
          title: 'Export Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Export Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsExportingToSheet(false);
    }
  };

  // Handlers for recording actual/final sandwich count
  const startEditingActualCount = () => {
    const currentCount = (request as any).actualSandwichCount || 0;
    const currentTypes = (request as any).actualSandwichTypes;

    if (currentTypes && Array.isArray(currentTypes) && currentTypes.length > 0) {
      const typeMap: Record<string, number> = {};
      currentTypes.forEach((item: { type?: string; quantity?: number }) => {
        if (item.type && item.quantity) {
          typeMap[item.type.toLowerCase()] = item.quantity;
        }
      });
      setActualCountTypes(typeMap);
      setActualCountMode('detailed');
    } else {
      setActualCountSimple(currentCount > 0 ? currentCount.toString() : '');
      setActualCountMode('simple');
    }
    setIsEditingActualCount(true);
  };

  const saveActualCount = () => {
    const todayDate = new Date().toISOString();

    if (actualCountMode === 'simple') {
      const count = parseInt(actualCountSimple, 10);
      if (isNaN(count) || count < 0) {
        toast({
          title: 'Invalid count',
          description: 'Please enter a valid positive number.',
          variant: 'destructive',
        });
        return;
      }

      updateFieldsMutation.mutate({
        actualSandwichCount: count,
        actualSandwichCountRecordedDate: todayDate,
        actualSandwichCountRecordedBy: user?.id?.toString() || null,
      }, {
        onSuccess: () => {
          setIsEditingActualCount(false);
          setActualCountSimple('');
          toast({
            title: 'Final count recorded',
            description: `Recorded ${count} sandwiches for this event.`,
          });
        }
      });
    } else {
      const types: Array<{ type: string; quantity: number }> = [];
      let total = 0;

      Object.entries(actualCountTypes).forEach(([type, count]) => {
        if (count && count > 0) {
          types.push({ type, quantity: count });
          total += count;
        }
      });

      if (total === 0) {
        toast({
          title: 'Invalid count',
          description: 'Please enter at least one sandwich type with a count.',
          variant: 'destructive',
        });
        return;
      }

      updateFieldsMutation.mutate({
        actualSandwichCount: total,
        actualSandwichTypes: types,
        actualSandwichCountRecordedDate: todayDate,
        actualSandwichCountRecordedBy: user?.id?.toString() || null,
      }, {
        onSuccess: () => {
          setIsEditingActualCount(false);
          setActualCountTypes({});
          toast({
            title: 'Final count recorded',
            description: `Recorded ${total} sandwiches for this event.`,
          });
        }
      });
    }
  };

  const cancelActualCountEdit = () => {
    setIsEditingActualCount(false);
    setActualCountSimple('');
    setActualCountTypes({});
  };

  return (
    <Card 
      className="w-full bg-[#E4EFF6] border-l-[4px] shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.10)] transition-all border-[#D8DEE2] rounded-xl"
      style={{ borderLeftColor: '#236383' }}
    >
      <CardContent className="p-3">
        {/* Pre-Event Flags Banner */}
        {request.preEventFlags && Array.isArray(request.preEventFlags) && request.preEventFlags.length > 0 && (
          <PreEventFlagsBanner
            flags={request.preEventFlags}
            eventId={request.id}
            eventName={request.organizationName || 'Event'}
            compact={false}
          />
        )}
        
        {/* Header Row - Organization & Status */}
        <div className="flex flex-col gap-2 mb-3 pb-3 border-b-2 border-[#236383]/40">
          {/* Top: Date + Organization Name */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            {/* Organization Name */}
            <div className="min-w-0 flex-1">
              {isEditingThisCard && editingField === 'organizationName' ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-9 text-lg sm:text-xl font-bold w-full sm:w-64"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={saveEdit} className="h-8 w-8 p-0">
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <h2
                  className={`text-lg sm:text-xl font-bold text-[#236383] break-words ${canEdit ? 'cursor-pointer hover:text-[#007E8C] group' : ''}`}
                  onClick={() => canEdit && startEditing('organizationName', request.organizationName || '')}
                >
                  {request.organizationName}
                  {request.department && <span className="text-[#236383]/70 font-medium"> • {request.department}</span>}
                  {canEdit && <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />}
                </h2>
              )}
              {/* Returning Organization Indicator */}
              {returningOrgData?.isReturning && (() => {
                const eventDate = returningOrgData.mostRecentEvent?.eventDate ? new Date(returningOrgData.mostRecentEvent.eventDate) : null;
                const collectionDate = returningOrgData.mostRecentCollection?.dateCollected ? new Date(returningOrgData.mostRecentCollection.dateCollected) : null;
                const lastDate = eventDate && collectionDate
                  ? (eventDate > collectionDate ? eventDate : collectionDate)
                  : eventDate || collectionDate;
                const lastDateLabel = lastDate && !isNaN(lastDate.getTime())
                  ? lastDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : null;
                return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={`whitespace-nowrap cursor-help mt-1 ${
                        returningOrgData.isReturningContact
                          ? 'bg-purple-50 text-purple-700 border-purple-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Returning Org
                      {lastDateLabel && (
                        <span className="ml-1 text-xs opacity-80">&middot; Last: {lastDateLabel}</span>
                      )}
                      {returningOrgData.isReturningContact
                        ? <span className="ml-1 text-xs opacity-80">&middot; Same Contact</span>
                        : <span className="ml-1 text-xs opacity-80">&middot; New Contact</span>
                      }
                      {returningOrgData.pastEventCount > 0 && (
                        <span className="ml-1 text-xs opacity-80">
                          ({returningOrgData.pastEventCount} past event{returningOrgData.pastEventCount !== 1 ? 's' : ''})
                        </span>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">This organization has worked with us before!</p>
                      {returningOrgData.pastEventCount > 0 && (
                        <p className="text-sm">
                          {returningOrgData.pastEventCount} previous event{returningOrgData.pastEventCount !== 1 ? 's' : ''} on file
                        </p>
                      )}
                      {returningOrgData.collectionCount > 0 && (
                        <p className="text-sm">
                          {returningOrgData.collectionCount} sandwich collection{returningOrgData.collectionCount !== 1 ? 's' : ''} recorded
                        </p>
                      )}
                      {returningOrgData.mostRecentEvent && (
                        <p className="text-xs text-muted-foreground">
                          Most recent: {returningOrgData.mostRecentEvent.eventDate
                            ? new Date(returningOrgData.mostRecentEvent.eventDate).toLocaleDateString()
                            : 'Date unknown'}
                          {returningOrgData.mostRecentEvent.status && ` (${returningOrgData.mostRecentEvent.status})`}
                        </p>
                      )}
                      {returningOrgData.pastDepartments && returningOrgData.pastDepartments.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Past department{returningOrgData.pastDepartments.length !== 1 ? 's' : ''}: {returningOrgData.pastDepartments.join(', ')}
                        </p>
                      )}
                      {returningOrgData.isReturningContact ? (
                        <p className="text-xs text-purple-600 font-medium mt-2">
                          Same contact as a previous event &mdash; personalize your outreach!
                        </p>
                      ) : (
                        <div className="mt-2">
                          {returningOrgData.pastContactName && (
                            <p className="text-xs text-muted-foreground">
                              Past contact: {returningOrgData.pastContactName}
                            </p>
                          )}
                          <p className="text-xs text-amber-600 font-medium">
                            New contact for this org &mdash; treat as a first-time outreach
                          </p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
                );
              })()}
              {/* New Department Indicator */}
              {returningOrgData?.isReturning && request.department && returningOrgData.pastDepartments && returningOrgData.pastDepartments.length > 0 && !returningOrgData.pastDepartments.some(
                d => d === (request.department || '').trim().replace(/\s+/g, ' ').toLowerCase()
              ) && (
                <Badge
                  variant="outline"
                  className="whitespace-nowrap bg-blue-50 text-blue-700 border-blue-300 mt-1"
                >
                  New Department
                </Badge>
              )}
              {/* Rescheduled from postponement indicator */}
              {request.wasPostponed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="whitespace-nowrap bg-amber-50 text-amber-700 border-amber-300 mt-1 cursor-help"
                    >
                      <History className="w-3 h-3 mr-1" />
                      Rescheduled
                      {request.postponementCount && request.postponementCount > 1 && ` (${request.postponementCount}x)`}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-medium">This event was previously postponed and rescheduled</p>
                      {request.originalScheduledDate && (
                        <p className="text-sm">
                          Originally scheduled: {new Date(request.originalScheduledDate).toLocaleDateString()}
                        </p>
                      )}
                      {request.postponementReason && (
                        <p className="text-sm">
                          Reason: {request.postponementReason}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Partner Organizations - inline on same row */}
              {request.partnerOrganizations && Array.isArray(request.partnerOrganizations) && request.partnerOrganizations.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-1">
                  <span className="text-[#236383]/60 text-sm sm:text-base">Partner:</span>
                  {request.partnerOrganizations.map((partner, index) => (
                    <span
                      key={index}
                      className={`text-base sm:text-lg text-[#236383]/80 font-medium ${canEdit ? 'cursor-pointer hover:text-[#007E8C]' : ''}`}
                      onClick={() =>
                        canEdit &&
                        startEditing(
                          `partnerOrg_${index}`,
                          JSON.stringify({ name: partner.name || '', department: partner.department || '' })
                        )
                      }
                    >
                      {partner.name}
                      {partner.department && ` • ${partner.department}`}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Address - moved from Event Details */}
              {isEditingThisCard && editingField === 'eventAddress' ? (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <MapPin className="w-5 h-5 shrink-0 text-[#007E8C]" />
                  <Input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    placeholder="Enter event address"
                    className="h-9 text-base flex-1 min-w-[200px] max-w-md"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Button size="sm" onClick={saveEdit} aria-label="Save address">
                    <Save className="w-3 h-3" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100" aria-label="Cancel editing">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : request.eventAddress ? (
                <div className="flex items-start gap-2 mt-2">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-[#007E8C]" />
                  <a
                    href={`https://maps.google.com/maps?q=${encodeURIComponent(request.eventAddress)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg sm:text-xl font-bold text-[#007E8C] hover:text-[#007E8C]/80 underline break-words"
                  >
                    {request.eventAddress}
                  </a>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('eventAddress', request.eventAddress || '')}
                      className="text-[#007E8C] hover:bg-[#007E8C]/10 h-6 px-2"
                      aria-label="Edit address"
                    >
                      <Edit2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ) : canEdit ? (
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="w-5 h-5 shrink-0 text-gray-400" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing('eventAddress', '')}
                    className="text-[#007E8C] border-[#007E8C]/30 hover:bg-[#007E8C]/10 h-7 px-3"
                  >
                    <Plus className="w-3 h-3 mr-1" aria-hidden="true" />
                    Add Address
                  </Button>
                </div>
              ) : null}
            </div>

            {/* Date Display */}
            <div className="flex items-center shrink-0">
              {isEditingThisCard && editingField === dateFieldToEdit ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Input
                    type="date"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    className="h-8 bg-white text-gray-900 border-[#007E8C]/20"
                  />
                  <Button size="sm" onClick={saveEdit} aria-label="Save date">
                    <Save className="w-3 h-3" aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100" aria-label="Cancel editing">
                    <X className="w-3 h-3" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#007E8C]" />
                  <span className="text-base sm:text-lg md:text-xl font-bold text-[#47B3CB]">
                    {dateInfo ? dateInfo.text : <span className="text-gray-600 font-medium text-sm">No date</span>}
                  </span>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(dateFieldToEdit, formatDateForInput(displayDate?.toString() || ''))}
                      className="text-[#007E8C] hover:bg-[#007E8C]/10 h-6 px-1 transition-colors"
                      aria-label="Edit date"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Rescheduled Badge */}
          {request.status === 'rescheduled' && request.originalScheduledDate && (
            <div className="mb-1">
              <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium">
                <RefreshCw className="w-3 h-3 mr-1" />
                Rescheduled from {new Date(request.originalScheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Badge>
            </div>
          )}

          {/* Status Badges */}
          <div className="flex flex-wrap items-center gap-1 xs:gap-1.5 sm:gap-2 min-w-0">
            <Badge
              onClick={(e) => { e.stopPropagation(); canEdit && quickToggleBoolean('isConfirmed', request.isConfirmed); }}
              className={`cursor-pointer hover:opacity-80 transition-opacity text-xs sm:text-sm font-medium ${
                request.isConfirmed
                  ? 'bg-gradient-to-br from-[#007E8C] to-[#47B3CB] text-white border border-[#007E8C]'
                  : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500'
              }`}
            >
              {request.isConfirmed ? 'Date Confirmed' : 'Date Pending'}
            </Badge>

            <Badge
              onClick={(e) => { e.stopPropagation(); canEdit && quickToggleBoolean('addedToOfficialSheet', request.addedToOfficialSheet); }}
              className={`cursor-pointer hover:opacity-80 transition-opacity text-xs sm:text-sm font-medium ${
                request.addedToOfficialSheet
                  ? 'bg-gradient-to-br from-[#236383] to-[#007E8C] text-white border border-[#236383]'
                  : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-gray-500'
              }`}
            >
              {request.addedToOfficialSheet
                ? `On Calendar${request.addedToOfficialSheetAt ? ` · ${new Date(request.addedToOfficialSheetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`
                : 'Not on Calendar'}
            </Badge>

            {request.isMlkDayEvent && <MlkDayBadge />}

            {/* Corporate Badge */}
            {(request as any).isCorporatePriority && (
              <Badge className="bg-gradient-to-br from-[#B8860B] to-[#DAA520] text-white text-xs sm:text-sm font-medium flex items-center gap-1">
                <Building className="w-3 h-3" />
                <span className="hidden sm:inline">Corporate</span>
                <span className="sm:hidden">Corp</span>
              </Badge>
            )}

            <RefrigerationWarningBadge
              sandwichTypes={request.sandwichTypes}
              hasRefrigeration={request.hasRefrigeration}
              className="text-xs sm:text-sm"
            />

            {/* Sandwich count badge */}
            <Badge
              className="bg-[#FBAD3F] text-white border border-[#FBAD3F] text-xs sm:text-sm font-medium flex items-center gap-1 min-w-0 max-w-full"
              title={sandwichInfo}
            >
              <span aria-hidden="true">🥪</span>
              <span className="min-w-0 truncate">{sandwichCountBadgeText}</span>
              <span className="hidden sm:inline opacity-90">&nbsp;sandwiches</span>
            </Badge>

            {/* Attendance badge - show when attendance is set */}
            {(request.attendanceAdults || request.attendanceTeens || request.attendanceKids) && (
              <Badge
                className="bg-[#007E8C] text-white border border-[#007E8C] text-xs sm:text-sm font-medium flex items-center gap-1"
                title={`${request.attendanceAdults || 0} adults, ${request.attendanceTeens || 0} teens, ${request.attendanceKids || 0} kids`}
              >
                <Users className="w-3 h-3" />
                <span>{(request.attendanceAdults || 0) + (request.attendanceTeens || 0) + (request.attendanceKids || 0)}</span>
                <span className="hidden sm:inline opacity-90">attending</span>
              </Badge>
            )}

            {/* Self-transport badge */}
            {request.selfTransport && (
              <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] text-xs sm:text-sm font-medium flex items-center gap-1">
                <Car className="w-3 h-3" />
                <span className="hidden sm:inline">Driving Own</span>
                <span className="sm:hidden">Self</span>
              </Badge>
            )}

            {/* Overnight holding badge */}
            {request.overnightHoldingLocation && (
              <Badge className="bg-[#236383] text-white border border-[#236383] text-xs sm:text-sm font-medium flex items-center gap-1">
                <span>🌙</span>
                <span className="hidden sm:inline">Holding Overnight</span>
                <span className="sm:hidden">O/N</span>
              </Badge>
            )}

            {request.externalId && request.externalId.startsWith('manual-') && (
              <Badge className="bg-[#FBAD3F] text-white border border-[#FBAD3F] text-xs sm:text-sm font-medium">
                <FileText className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Manual Entry</span>
                <span className="sm:hidden">Manual</span>
              </Badge>
            )}

            {/* Only show staffing badges if NOT self-transport */}
            {!request.selfTransport && (
              <>
                {staffingComplete ? (
                  <Badge className="bg-gradient-to-br from-[#47B3CB] to-[#007E8C] text-white border border-[#47B3CB] text-xs sm:text-sm font-medium">
                    Fully Staffed
                  </Badge>
                ) : (
                  <>
                    {/* Show regular driver needs only if NOT a van driver event (van takes precedence) */}
                    {driverNeeded > driverAssigned && !request.vanDriverNeeded && (
                      <Badge className={`${staffingBadgeColors} text-xs sm:text-sm font-medium`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {driverNeeded - driverAssigned} driver{driverNeeded - driverAssigned > 1 ? 's' : ''} needed
                      </Badge>
                    )}
                    {/* Show Van badge when van driver is needed but not yet assigned */}
                    {request.vanDriverNeeded && !request.assignedVanDriverId && !request.isDhlVan && (
                      <Badge className={`${staffingBadgeColors} text-xs sm:text-sm font-medium`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Van needed
                      </Badge>
                    )}
                    {speakerNeeded > speakerAssigned && (
                      <Badge className={`${staffingBadgeColors} text-xs sm:text-sm font-medium`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {speakerNeeded - speakerAssigned} speaker{speakerNeeded - speakerAssigned > 1 ? 's' : ''} needed
                      </Badge>
                    )}
                    {volunteerNeeded > volunteerAssigned && (
                      <Badge className={`${staffingBadgeColors} text-xs sm:text-sm font-medium`}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {volunteerNeeded - volunteerAssigned} volunteer{volunteerNeeded - volunteerAssigned > 1 ? 's' : ''} needed
                      </Badge>
                    )}
                  </>
                )}

                {request.assignedVanDriverId && (
                  <Badge className="bg-[#007E8C] text-white border border-[#007E8C] text-xs sm:text-sm font-medium">
                    🚐 Van
                  </Badge>
                )}

                {request.isDhlVan && (
                  <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-medium">
                    🚚 DHL Van
                  </Badge>
                )}
              </>
            )}

            {missingInfo.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-gradient-to-br from-[#A31C41] to-[#8B1538] text-white border border-[#A31C41] text-xs sm:text-sm font-medium animate-pulse cursor-help">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Missing: {missingInfo.join(', ')}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-medium mb-1">Missing Information:</p>
                  <ul className="list-disc list-inside text-sm">
                    {missingInfo.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Add department/partner buttons - hidden on mobile, shown on hover on desktop */}
          {canEdit && (
            <div className="hidden sm:flex items-center gap-2 mt-1">
              {!request.department && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1 text-[#236383]/50 hover:text-[#007E8C] hover:bg-[#007E8C]/10 rounded transition-colors text-xs"
                      onClick={() => startEditing('department', '')}
                    >
                      <Building2 className="w-3 h-3 inline mr-1" />
                      Add dept
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add department</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {(!request.partnerOrganizations || request.partnerOrganizations.length === 0) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1 text-[#236383]/50 hover:text-[#007E8C] hover:bg-[#007E8C]/10 rounded transition-colors text-xs"
                      onClick={() => {
                        startEditing('partnerOrganizations', JSON.stringify([{ name: '', department: '', role: 'partner' }]));
                      }}
                    >
                      <Users className="w-3 h-3 inline mr-1" />
                      Add partner
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add partner organization</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Partner/Department editing modals */}
        {isEditingThisCard && editingField === 'department' && (
          <div className="flex items-center gap-2 mb-3">
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="h-8 text-base w-48"
              autoFocus
              placeholder="Department"
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
            <Button size="sm" variant="ghost" onClick={saveEdit} className="h-7 w-7 p-0">
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        {isEditingThisCard && editingField?.startsWith('partnerOrg_') && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {(() => {
              const index = parseInt(editingField.split('_')[1]);
              const partner = request.partnerOrganizations?.[index];
              let parsed = { name: partner?.name || '', department: partner?.department || '' };
              try {
                const maybeParsed = JSON.parse(editingValue || '{}');
                if (maybeParsed && typeof maybeParsed === 'object') {
                  parsed = {
                    name: (maybeParsed as any).name ?? parsed.name,
                    department: (maybeParsed as any).department ?? parsed.department,
                  };
                }
              } catch {
                // ignore
              }
              return (
                <>
                  <Input
                    value={parsed.name}
                    onChange={(e) =>
                      setEditingValue(JSON.stringify({ name: e.target.value, department: parsed.department }))
                    }
                    className="h-8 text-base w-40 sm:w-48"
                    autoFocus
                    placeholder="Partner name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Input
                    value={parsed.department || ''}
                    onChange={(e) =>
                      setEditingValue(JSON.stringify({ name: parsed.name, department: e.target.value }))
                    }
                    className="h-8 text-base w-32 sm:w-40"
                    placeholder="Dept (optional)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={saveEdit} className="h-7 w-7 p-0">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              );
            })()}
          </div>
        )}
        {isEditingThisCard && editingField === 'partnerOrganizations' && (!request.partnerOrganizations || request.partnerOrganizations.length === 0) && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {(() => {
              let parsed = { name: '', department: '' };
              try {
                const arr = JSON.parse(editingValue || '[]');
                if (Array.isArray(arr) && arr.length > 0) {
                  parsed = { name: arr[0]?.name || '', department: arr[0]?.department || '' };
                }
              } catch {
                // ignore
              }
              return (
                <>
                  <Input
                    value={parsed.name}
                    onChange={(e) => setEditingValue(JSON.stringify([{ name: e.target.value, department: parsed.department, role: 'partner' }]))}
                    className="h-8 text-base w-40 sm:w-48"
                    autoFocus
                    placeholder="Partner name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Input
                    value={parsed.department}
                    onChange={(e) => setEditingValue(JSON.stringify([{ name: parsed.name, department: e.target.value, role: 'partner' }]))}
                    className="h-8 text-base w-32 sm:w-40"
                    placeholder="Dept (optional)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={saveEdit} className="h-7 w-7 p-0">
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              );
            })()}
          </div>
        )}

        {/* Action Buttons Section */}
        <TooltipProvider>
          <div className="mb-3">
            <div className="flex gap-2">
              {/* Message - always visible */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setShowMessageDialog(true)}
                    variant="ghost"
                    className="text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10"
                    aria-label="Message about this event"
                  >
                    <MessageSquare className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Message about this event</p>
                </TooltipContent>
              </Tooltip>

              {/* Propose to Planning Sheet */}
              <ProposeToSheetButton
                eventId={request.id}
                organizationName={request.organizationName || 'Unknown'}
              />

              {canEdit && (
                <>
                  {canSendSMS && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => setShowSendSmsDialog(true)}
                            variant="ghost"
                            className="text-[#236383] hover:text-[#236383] hover:bg-[#236383]/10"
                            aria-label="Send event details via SMS"
                            data-testid="button-send-sms-card"
                          >
                            <Phone className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send event details via SMS</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => setShowSendCorrectionDialog(true)}
                            variant="ghost"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-100"
                            aria-label="Send correction SMS"
                            data-testid="button-send-correction-card"
                          >
                            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send correction SMS</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={onEdit} variant="ghost" aria-label="Edit event">
                        <Edit2 className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit event</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <ConfirmationDialog
                          trigger={
                            <Button size="sm" variant="ghost" className="text-[#A31C41] hover:text-[#A31C41] hover:bg-[#A31C41]/10" aria-label="Delete event">
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          }
                          title="Delete Event"
                          description={`Delete ${request.organizationName}?`}
                          confirmText="Delete"
                          onConfirm={onDelete}
                          variant="destructive"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Delete event</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </TooltipProvider>

        {/* Next Action - Prominent display for intake tracking */}
        {request.nextAction ? (
          <div className="mb-4 p-3 bg-amber-50 border-2 border-amber-300 rounded-lg">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">Next Action:</span>
                  <span className="ml-2 text-amber-900 font-medium">{request.nextAction}</span>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {onEditNextAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onEditNextAction}
                    className="h-7 w-7 p-0 text-amber-700 hover:bg-amber-100"
                    title="Edit action"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {onCompleteNextAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCompleteNextAction}
                    className="h-7 w-7 p-0 text-green-600 hover:bg-green-100"
                    title="Complete action"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : onAddNextAction && (
          <div className="mb-4 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={onAddNextAction}
              className="h-7 text-xs text-amber-700 hover:bg-amber-50"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Action
            </Button>
          </div>
        )}

        {/* Main Info Section - 3 Column Grid - responsive at all widths */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 lg:items-start">
          {/* Column 1: Event Details */}
          <div className="flex flex-col h-full">
            {/* Event Details Card */}
            <div className="bg-white rounded-lg p-4 border-l-4 border-[#47B3CB] border-t border-r border-b border-[#47B3CB]/20 shadow-md flex-1">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-[#47B3CB]" aria-hidden="true" />
                Event Details
              </h3>
              <div className="space-y-3">
            {/* Times Row with Add Times button */}
            <div className="space-y-3">
              {/* Time fields - stacked layout when editing, grid when not */}
              {addingAllTimes ? (
                /* Stacked layout when editing all times */
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[#236383] text-sm uppercase font-semibold w-16">Start</span>
                    <Input
                      type="time"
                      value={tempStartTime}
                      onChange={(e) => setTempStartTime(e.target.value)}
                      className="h-10 bg-white text-gray-900 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20 px-3 w-32"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#236383] text-sm uppercase font-semibold w-16">End</span>
                    <Input
                      type="time"
                      value={tempEndTime}
                      onChange={(e) => setTempEndTime(e.target.value)}
                      className="h-10 bg-white text-gray-900 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20 px-3 w-32"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-700 text-sm uppercase font-semibold w-16">Pickup</span>
                    <Input
                      type="time"
                      value={tempPickupTime}
                      onChange={(e) => setTempPickupTime(e.target.value)}
                      className="h-10 bg-white text-gray-900 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20 px-3 w-32"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const updates: Record<string, string> = {};
                        const existingPickupTime = request.pickupDateTime
                          ? formatTimeForInput(new Date(request.pickupDateTime).toTimeString().slice(0, 5))
                          : (request.pickupTime ? formatTimeForInput(request.pickupTime) : '');
                        if (tempStartTime && tempStartTime !== formatTimeForInput(request.eventStartTime || '')) {
                          updates.eventStartTime = tempStartTime;
                        }
                        if (tempEndTime && tempEndTime !== formatTimeForInput(request.eventEndTime || '')) {
                          updates.eventEndTime = tempEndTime;
                        }
                        if (tempPickupTime && tempPickupTime !== existingPickupTime) {
                          updates.pickupTime = tempPickupTime;
                        }
                        if (Object.keys(updates).length > 0) {
                          updateFieldsMutation.mutate(updates);
                        } else {
                          setAddingAllTimes(false);
                        }
                      }}
                      className="h-9 px-4 text-sm"
                      disabled={updateFieldsMutation.isPending}
                      aria-label="Save all times"
                    >
                      <Save className="w-4 h-4 mr-2" aria-hidden="true" />
                      {updateFieldsMutation.isPending ? 'Saving...' : 'Save All'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingAllTimes(false);
                        setTempStartTime('');
                        setTempEndTime('');
                        setTempPickupTime('');
                      }}
                      className="text-gray-600 hover:bg-gray-100 h-9 px-4 text-sm"
                      aria-label="Cancel"
                    >
                      <X className="w-4 h-4 mr-2" aria-hidden="true" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                /* Compact layout when viewing - inline on mobile */
                <div className="flex flex-col gap-3">
                  {/* Mobile: Compact inline times */}
                  <div className="sm:hidden">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#236383]" />
                        <span 
                          className="font-bold text-[#236383] cursor-pointer" 
                          onClick={() => canEdit && startEditing('eventStartTime', formatTimeForInput(request.eventStartTime || ''))}
                        >
                          {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : '—'}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span 
                          className="font-bold text-[#236383] cursor-pointer"
                          onClick={() => canEdit && startEditing('eventEndTime', formatTimeForInput(request.eventEndTime || ''))}
                        >
                          {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600">
                        <span className="text-xs uppercase font-medium">Pickup:</span>
                        <span 
                          className="font-bold text-gray-900 cursor-pointer"
                          onClick={() => canEdit && startEditing('pickupDateTime', request.pickupDateTime?.toString() || '')}
                        >
                          {request.pickupDateTime 
                            ? formatTime12Hour(new Date(request.pickupDateTime).toTimeString().slice(0, 5))
                            : request.pickupTime 
                              ? formatTime12Hour(request.pickupTime)
                              : '—'}
                        </span>
                      </div>
                      {/* Attendance on mobile */}
                      {(request.attendanceAdults || request.attendanceTeens || request.attendanceKids) && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-bold text-gray-900">
                            {(request.attendanceAdults || 0) + (request.attendanceTeens || 0) + (request.attendanceKids || 0)}
                          </span>
                          <span className="text-xs">attending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop: Original grid layout */}
                  <div className="hidden sm:flex flex-row items-start justify-between gap-4">
                    <div className="grid grid-cols-3 gap-3 text-sm flex-1">
                      {/* Start Time */}
                      <div>
                        <div className="text-[#236383] text-sm uppercase font-semibold mb-1">Start</div>
                        {isEditingThisCard && editingField === 'eventStartTime' ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              type="time"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-10 bg-white text-gray-900 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20 px-3"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit} className="h-8 px-3 text-sm" aria-label="Save">
                                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-3 text-gray-600 hover:bg-gray-100 text-sm" aria-label="Cancel">
                                <X className="w-4 h-4 mr-1" aria-hidden="true" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-base font-bold group cursor-pointer text-[#236383] py-1" onClick={() => canEdit && startEditing('eventStartTime', formatTimeForInput(request.eventStartTime || ''))}>
                            {request.eventStartTime ? formatTime12Hour(request.eventStartTime) : <span className="text-gray-600 font-medium">Not set</span>}
                          </div>
                        )}
                      </div>

                      {/* End Time */}
                      <div>
                        <div className="text-[#236383] text-sm uppercase font-semibold mb-1">End</div>
                        {isEditingThisCard && editingField === 'eventEndTime' ? (
                          <div className="flex flex-col gap-2">
                            <Input
                              type="time"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="h-10 bg-white text-gray-900 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20 px-3"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEdit} className="h-8 px-3 text-sm" aria-label="Save">
                                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-3 text-gray-600 hover:bg-gray-100 text-sm" aria-label="Cancel">
                                <X className="w-4 h-4 mr-1" aria-hidden="true" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-base font-bold group cursor-pointer text-[#236383] py-1" onClick={() => canEdit && startEditing('eventEndTime', formatTimeForInput(request.eventEndTime || ''))}>
                            {request.eventEndTime ? formatTime12Hour(request.eventEndTime) : <span className="text-gray-600 font-medium">Not set</span>}
                          </div>
                        )}
                      </div>

                    {/* Pickup Time */}
                    <div>
                      <div className="text-gray-700 text-sm uppercase font-semibold mb-1">Pickup</div>
                      {isEditingThisCard && editingField === 'pickupDateTime' ? (
                        <div className="flex flex-col gap-2">
                          <DateTimePicker
                            value={editingValue}
                            onChange={setEditingValue}
                            className="h-10 text-base border-[#007E8C]/30 focus:border-[#007E8C] focus:ring-2 focus:ring-[#007E8C]/20"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} className="h-8 px-3 text-sm" aria-label="Save">
                              <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-3 text-gray-600 hover:bg-gray-100 text-sm" aria-label="Cancel">
                              <X className="w-4 h-4 mr-1" aria-hidden="true" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-base font-bold group cursor-pointer text-gray-900 flex items-center gap-2 flex-wrap" onClick={() => canEdit && startEditing('pickupDateTime', request.pickupDateTime?.toString() || '')}>
                            {(() => {
                              // Check if overnight holding is set and use overnight pickup time if available
                              // Overnight pickup is always next day
                              if (request.overnightHoldingLocation && request.overnightPickupTime) {
                                const timeStr = formatTime12Hour(request.overnightPickupTime);
                                // Calculate next day date from event date
                                const nextDayDate = displayDate ? (() => {
                                  const dateStr = displayDate.toString().split('T')[0];
                                  const [year, month, day] = dateStr.split('-').map(Number);
                                  const eventDate = new Date(year, month - 1, day);
                                  const nextDay = new Date(eventDate);
                                  nextDay.setDate(nextDay.getDate() + 1);
                                  return nextDay.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  });
                                })() : null;
                                return (
                                  <>
                                    <span>{timeStr}</span>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 px-2 py-0.5">
                                      Next Day {nextDayDate ? `(${nextDayDate})` : ''}
                                    </Badge>
                                  </>
                                );
                              }
                              
                              // Use pickupDateTime if set
                              if (request.pickupDateTime) {
                                const pickupDate = new Date(request.pickupDateTime);
                                const eventDate = displayDate ? (() => {
                                  const dateStr = displayDate.toString().split('T')[0];
                                  const [year, month, day] = dateStr.split('-').map(Number);
                                  return new Date(year, month - 1, day);
                                })() : null;
                                
                                // Check if pickup is the next day after event
                                const isNextDay = eventDate ? (() => {
                                  const pickupDateOnly = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
                                  const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                                  const diffDays = Math.round((pickupDateOnly.getTime() - eventDateOnly.getTime()) / (1000 * 60 * 60 * 24));
                                  return diffDays === 1;
                                })() : false;
                                
                                const timeStr = formatTime12Hour(new Date(request.pickupDateTime).toTimeString().slice(0, 5));
                                
                                // If it's the next day, show indicator
                                if (isNextDay) {
                                  // Format the pickup date
                                  const nextDayDateStr = pickupDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  });
                                  return (
                                    <>
                                      <span>{timeStr}</span>
                                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold whitespace-nowrap shrink-0 px-2 py-0.5">
                                        Next Day ({nextDayDateStr})
                                      </Badge>
                                    </>
                                  );
                                }
                                
                                return <span>{timeStr}</span>;
                              }
                              
                              // Fall back to pickupTime
                              return request.pickupTime ? formatTime12Hour(request.pickupTime) : <span className="text-gray-600 font-medium">Not set</span>;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>

                  {/* Add Times button - only show when not editing and times are missing */}
                  {canEdit && (!request.eventStartTime || !request.eventEndTime || (!request.pickupDateTime && !request.pickupTime)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-[#007E8C]/10 hover:bg-[#007E8C]/20 text-[#007E8C] border-[#007E8C]/30 whitespace-nowrap px-3 h-9 text-sm mt-4"
                      onClick={() => {
                        setTempStartTime(formatTimeForInput(request.eventStartTime || ''));
                        setTempEndTime(formatTimeForInput(request.eventEndTime || ''));
                        setTempPickupTime(request.pickupDateTime ? formatTimeForInput(new Date(request.pickupDateTime).toTimeString().slice(0, 5)) : (request.pickupTime ? formatTimeForInput(request.pickupTime) : ''));
                        setAddingAllTimes(true);
                      }}
                      title="Set all time fields at once"
                    >
                      <Clock className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Recipient Logistics - moved from Column 3 */}
            {((request.assignedRecipientIds && request.assignedRecipientIds.length > 0) || request.recipientsCount || request.overnightHoldingLocation || (isEditingThisCard && editingField === 'assignedRecipientIds')) ? (
              <div className="bg-gradient-to-r from-[#FBAD3F]/40 to-[#FBAD3F]/25 rounded-lg p-4 border-l-4 border-[#FBAD3F] border-t border-r border-b border-[#FBAD3F]/20 shadow-md mt-3">
                <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#FBAD3F]" aria-hidden="true" />
                  Recipient Logistics
                </h3>
                
                <div className="space-y-4">
                  {/* Recipients */}
                  {(request.assignedRecipientIds && request.assignedRecipientIds.length > 0) || (isEditingThisCard && editingField === 'assignedRecipientIds') ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase text-gray-600 font-medium">Recipients</span>
                        {canEdit && !isEditingThisCard && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setTempOvernightHolding(request.overnightHoldingLocation || '');
                              startEditing('assignedRecipientIds', JSON.stringify(request.assignedRecipientIds || []));
                            }}
                            className="h-5 px-1.5 text-[#007E8C] hover:bg-[#007E8C]/10"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {isEditingThisCard && editingField === 'assignedRecipientIds' ? (
                        <div className="space-y-2">
                          <MultiRecipientSelector
                            value={(() => {
                              try {
                                return JSON.parse(editingValue || '[]');
                              } catch {
                                return request.assignedRecipientIds || [];
                              }
                            })()}
                            onChange={(value) => setEditingValue(JSON.stringify(value))}
                            placeholder="Select recipient organizations..."
                            data-testid="assigned-recipients-editor"
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              value={tempOvernightHolding}
                              onChange={(e) => setTempOvernightHolding(e.target.value)}
                              placeholder="Overnight holding location (optional)"
                              className="flex-1 bg-white text-gray-900"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const updates: Record<string, any> = {};
                                try {
                                  const newRecipients = JSON.parse(editingValue || '[]');
                                  if (JSON.stringify(newRecipients) !== JSON.stringify(request.assignedRecipientIds || [])) {
                                    updates.assignedRecipientIds = newRecipients;
                                  }
                                } catch {
                                  // ignore
                                }
                                if (tempOvernightHolding !== request.overnightHoldingLocation) {
                                  updates.overnightHoldingLocation = tempOvernightHolding || null;
                                }
                                updateFieldsMutation.mutate(updates, {
                                  onSuccess: () => {
                                    cancelEdit();
                                  },
                                });
                              }}
                              disabled={updateFieldsMutation.isPending}
                            >
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : showAllocationEditor ? (
                        <InlineRecipientAllocationEditor
                          eventId={request.id}
                          assignedRecipientIds={parsePostgresArray(request.assignedRecipientIds)}
                          currentAllocations={request.recipientAllocations as RecipientAllocation[] | null | undefined}
                          estimatedSandwichCount={request.estimatedTotalSandwiches || request.sandwichCount}
                          resolveRecipientName={(id) => ({
                            name: getRecipientName ? getRecipientName(id) : id,
                            type: 'recipient'
                          })}
                          onCancel={() => setShowAllocationEditor(false)}
                          onSave={() => setShowAllocationEditor(false)}
                        />
                      ) : (
                        <div className="space-y-1">
                          {parsePostgresArray(request.assignedRecipientIds).map((id) => {
                            // Find allocation for this recipient
                            const allocations = request.recipientAllocations as RecipientAllocation[] | null | undefined;
                            const allocation = allocations?.find(a => a.recipientId === id);
                            return (
                              <div key={id} className="bg-white/60 rounded px-3 py-1.5 border border-[#FBAD3F]/30 flex items-center justify-between">
                                <span className="text-base font-semibold text-gray-900">
                                  {getRecipientName ? getRecipientName(id) : id}
                                </span>
                                {allocation && allocation.sandwichCount > 0 && (
                                  <Badge variant="outline" className="bg-white text-[#236383] border-[#236383]/30 text-xs">
                                    {allocation.sandwichCount} sandwiches
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                          {/* Button to edit allocations */}
                          {canEdit && parsePostgresArray(request.assignedRecipientIds).length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setShowAllocationEditor(true)}
                              className="w-full h-7 mt-2 text-[#007E8C] hover:bg-[#007E8C]/10 border border-dashed border-[#007E8C]/30"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              {(request.recipientAllocations as RecipientAllocation[] | null | undefined)?.some(a => a.sandwichCount > 0)
                                ? 'Edit Allocations'
                                : 'Set Sandwich Allocations'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Overnight Holding */}
                  {request.overnightHoldingLocation && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase text-gray-600 font-medium">Overnight Holding</span>
                        {canEdit && !isEditingThisCard && editingField !== 'overnightHoldingLocation' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('overnightHoldingLocation', request.overnightHoldingLocation || '')}
                            className="h-5 px-1.5 text-[#007E8C] hover:bg-[#007E8C]/10"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {isEditingThisCard && editingField === 'overnightHoldingLocation' ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            placeholder="Overnight holding location"
                            className="bg-white text-gray-900"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900" title={request.overnightHoldingLocation || undefined}>
                          {request.overnightHoldingLocation}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Next-Day Pickup Time */}
                  {request.overnightHoldingLocation && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs uppercase text-gray-600 font-medium">Next-Day Pickup Time</span>
                        {canEdit && !(isEditingThisCard && editingField === 'overnightPickupTime') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing('overnightPickupTime', formatTimeForInput(request.overnightPickupTime || ''))}
                            className="h-5 px-1.5 text-[#007E8C] hover:bg-[#007E8C]/10"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      {isEditingThisCard && editingField === 'overnightPickupTime' ? (
                        <div className="flex flex-col gap-2">
                          <Input
                            type="time"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="bg-white text-gray-900"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit}>
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-gray-900">
                          {request.overnightPickupTime ? formatTime12Hour(request.overnightPickupTime) : <span className="text-gray-500 italic">Not set</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : canEdit ? (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase text-gray-600 font-medium">Recipient Logistics</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-[#FBAD3F]/20 text-[#B8871F] border-[#FBAD3F] text-xs py-0.5 px-2">
                    Not set
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTempOvernightHolding(request.overnightHoldingLocation || '');
                      startEditing('assignedRecipientIds', JSON.stringify(request.assignedRecipientIds || []));
                    }}
                    className="h-5 px-2 text-[#007E8C] text-xs"
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Set
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Sandwiches - inside Event Details container, after Recipient Logistics */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-200 mt-3">
              <Package className="w-5 h-5 shrink-0" />
              {isEditingThisCard && editingField === 'sandwichTypes' ? (
                <div className="flex-1 bg-white/10 rounded p-2 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'total' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('total')}
                      className="h-7"
                    >
                      Exact
                    </Button>
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'range' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('range')}
                      className="h-7"
                    >
                      Range
                    </Button>
                    <Button
                      size="sm"
                      variant={inlineSandwichMode === 'types' ? 'default' : 'outline'}
                      onClick={() => setInlineSandwichMode('types')}
                      className="h-7"
                    >
                      By Type
                    </Button>
                  </div>

                  {inlineSandwichMode === 'total' && (
                    <Input
                      type="number"
                      value={inlineTotalCount}
                      onChange={(e) => setInlineTotalCount(parseInt(e.target.value) || 0)}
                      placeholder="Total count"
                      className="bg-white text-gray-900"
                    />
                  )}

                  {inlineSandwichMode === 'range' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={inlineRangeMin}
                          onChange={(e) => setInlineRangeMin(parseInt(e.target.value) || 0)}
                          placeholder="Min"
                          className="w-24 bg-white text-gray-900"
                        />
                        <span className="text-white self-center">to</span>
                        <Input
                          type="number"
                          value={inlineRangeMax}
                          onChange={(e) => setInlineRangeMax(parseInt(e.target.value) || 0)}
                          placeholder="Max"
                          className="w-24 bg-white text-gray-900"
                        />
                      </div>
                      <Select value={inlineRangeType || undefined} onValueChange={setInlineRangeType}>
                        <SelectTrigger className="bg-white text-gray-900">
                          <SelectValue placeholder="Type (optional)" />
                        </SelectTrigger>
                        <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                          {SANDWICH_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {inlineSandwichMode === 'types' && (
                    <div className="space-y-2">
                      {inlineSandwichTypes.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Select
                            value={item.type}
                            onValueChange={(value) => updateInlineSandwichType(index, 'type', value)}
                          >
                            <SelectTrigger className="bg-white text-gray-900">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={5}>
                              {SANDWICH_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateInlineSandwichType(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-20 bg-white text-gray-900"
                          />
                          <Button size="sm" variant="ghost" onClick={() => removeInlineSandwichType(index)} className="text-white" aria-label="Remove sandwich type">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ))}
                      <Button size="sm" onClick={addInlineSandwichType} variant="outline" className="w-full">
                        + Add Type
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={saveEdit} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" /> Save
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-white hover:bg-white/20">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 group flex items-center gap-2">
                  <Badge className="bg-[#FBAD3F] text-white text-lg font-bold px-3 py-1.5 border-2 border-[#FBAD3F] shadow-sm flex items-center gap-2">
                    <span className="text-xl">🥪</span>
                    <span>{sandwichInfo}</span>
                  </Badge>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('sandwichTypes', '')}
                      className="text-[#236383] hover:bg-[#236383]/10 h-6 px-2 transition-colors"
                      aria-label="Edit sandwich types"
                    >
                      <Edit2 className="w-3 h-3" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Record Final Sandwich Count - for day-of recording before event completes */}
            <div className="flex items-center gap-2 pt-3 border-t border-gray-200 mt-3">
              <Check className="w-5 h-5 shrink-0 text-green-600" aria-hidden="true" />
              {isEditingActualCount ? (
                <div className="flex-1 bg-green-50 rounded p-3 space-y-2 border border-green-200">
                  <div className="text-xs uppercase text-green-700 font-semibold">Record Final Count</div>
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      variant={actualCountMode === 'simple' ? 'default' : 'outline'}
                      onClick={() => setActualCountMode('simple')}
                      className="h-7"
                    >
                      Total
                    </Button>
                    <Button
                      size="sm"
                      variant={actualCountMode === 'detailed' ? 'default' : 'outline'}
                      onClick={() => setActualCountMode('detailed')}
                      className="h-7"
                    >
                      By Type
                    </Button>
                  </div>

                  {actualCountMode === 'simple' && (
                    <Input
                      type="number"
                      value={actualCountSimple}
                      onChange={(e) => setActualCountSimple(e.target.value)}
                      placeholder="Enter final sandwich count"
                      className="bg-white"
                    />
                  )}

                  {actualCountMode === 'detailed' && (
                    <div className="space-y-2">
                      {SANDWICH_TYPES.map((type) => (
                        <div key={type.value} className="flex items-center gap-2">
                          <span className="text-sm w-24">{type.label}</span>
                          <Input
                            type="number"
                            value={actualCountTypes[type.value] || ''}
                            onChange={(e) => setActualCountTypes(prev => ({
                              ...prev,
                              [type.value]: parseInt(e.target.value) || 0
                            }))}
                            placeholder="0"
                            className="w-20 bg-white"
                          />
                        </div>
                      ))}
                      <div className="text-sm font-semibold text-green-700 pt-1">
                        Total: {Object.values(actualCountTypes).reduce((sum, n) => sum + (n || 0), 0)}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={saveActualCount} disabled={updateFieldsMutation.isPending}>
                      {updateFieldsMutation.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3 mr-1" /> Save Final Count
                        </>
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelActualCountEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase text-gray-600 font-medium">Final Count</div>
                      <div className="text-sm font-semibold">
                        {(request as any).actualSandwichCount ? (
                          <span className="text-green-700">
                            {(request as any).actualSandwichCount} sandwiches recorded
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Not yet recorded</span>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={startEditingActualCount}
                        className="h-7 px-3 text-xs border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        {(request as any).actualSandwichCount ? 'Edit' : 'Record Final Count'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TSP Contact - show below sandwiches (matches internal terminology + layout) */}
            {tspContactDisplay && (
              <div className="flex items-center gap-2 pt-3">
                <UserPlus className="w-5 h-5 shrink-0 text-[#236383]" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase text-gray-600 font-medium">TSP Contact</div>
                  <div className="text-sm font-semibold text-gray-900 truncate" title={tspContactDisplay}>
                    {tspContactDisplay}
                  </div>
                </div>
                {canEditTspContact && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onEditTspContact}
                    className="h-7 px-2 text-[#007E8C] hover:bg-[#007E8C]/10"
                    aria-label="Edit TSP contact"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            )}
              </div>
            </div>
          </div>

          {/* Column 2: Team Assignments */}
          <div className="flex flex-col h-full lg:order-2">
            <div className="bg-white rounded-lg p-4 border-l-4 border-[#47B3CB] border-t border-r border-b border-[#47B3CB]/20 shadow-md flex-1">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#236383]" aria-hidden="true" />
                Team Assignments
              </h3>
              <div className="space-y-3">
                {/* Drivers */}
                {request.selfTransport ? (
                  // Organization is transporting sandwiches themselves
                  <div className="flex items-center justify-between py-1 pb-3 border-b border-gray-200">
                    <Badge variant="outline" className="bg-[#FBAD3F]/20 text-[#D68319] border-[#FBAD3F] font-semibold text-sm py-1.5 px-3">
                      <Car className="w-4 h-4 mr-1.5" />
                      Organization Self-Transport
                    </Badge>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          // Clear self-transport and set drivers needed
                          startEditing('selfTransport', 'false');
                          setTimeout(() => saveEdit(), 0);
                        }}
                        className="h-5 px-2 text-[#007E8C] text-xs"
                      >
                        <Edit2 className="w-3 h-3 mr-0.5" />
                        Change
                      </Button>
                    )}
                  </div>
                ) : (driverNeeded > 0 || request.vanDriverNeeded || request.assignedVanDriverId || request.isDhlVan || (isEditingThisCard && editingField === 'driversNeeded')) ? (
                  <div className="pb-3 border-b border-gray-200 space-y-3">
                    {/* Van Driver Section - Show if vanDriverNeeded is true OR van driver is already assigned */}
                    {(request.vanDriverNeeded || request.assignedVanDriverId || request.isDhlVan) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                            <Truck className="w-5 h-5 text-amber-600" />
                            Van Driver
                            {request.assignedVanDriverId || request.isDhlVan ? ' (Assigned)' : ' (Needed)'}
                          </span>
                          {canEdit && !request.assignedVanDriverId && !request.isDhlVan && (
                            <Button 
                              size="sm" 
                              onClick={() => {
                                // Open assignment dialog for van driver
                                openAssignmentDialog('driver', true);
                              }} 
                              className="h-7 bg-amber-600 hover:bg-amber-700 text-white" 
                              aria-label="Assign van driver"
                            >
                              <Truck className="w-3 h-3" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          {request.assignedVanDriverId && (
                            <div className="flex items-start gap-2 bg-[#007E8C]/20 rounded px-3 py-1.5 border-2 border-[#007E8C]/40 min-w-0">
                              <span className="text-base font-bold text-[#007E8C] flex-1 min-w-0 break-words leading-tight">
                                {resolveUserName(request.assignedVanDriverId)} 🚐 (Van)
                              </span>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('driver', request.assignedVanDriverId!)}
                                  className="h-5 w-5 p-0 text-red-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {request.isDhlVan && (
                            <div className="flex items-start gap-2 bg-amber-100 rounded px-3 py-1.5 border-2 border-amber-300 min-w-0">
                              <span className="text-base font-bold text-amber-900 flex-1 min-w-0 break-words leading-tight">
                                DHL Van 🚚
                              </span>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleDhlVan(false)}
                                  className="h-5 w-5 p-0 text-red-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                          {request.vanDriverNeeded && !request.assignedVanDriverId && !request.isDhlVan && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-medium">
                              <Truck className="w-3 h-3 mr-1" />Van driver needed
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Regular Drivers Section - Show if driversNeeded > 0 */}
                    {(driverNeeded > 0 || (isEditingThisCard && editingField === 'driversNeeded')) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          {isEditingThisCard && editingField === 'driversNeeded' ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Car className="w-4 h-4 text-[#236383]" />
                              <Input
                                type="number"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="h-7 w-16 text-sm"
                                min="0"
                                placeholder="0"
                              />
                              <span className="text-sm text-[#236383]">needed</span>
                              <Button size="sm" onClick={saveEdit} className="h-6 px-2" aria-label="Save">
                                <Save className="w-3 h-3" aria-hidden="true" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                                <X className="w-3 h-3" aria-hidden="true" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                                <Car className="w-5 h-5" />
                                {driverNeeded > 0 ? `Drivers (${parsePostgresArray(request.assignedDriverIds).length}/${driverNeeded})` : 'Drivers'}
                              </span>
                              {canEdit && driverNeeded > 0 && (
                                <Button 
                                  size="sm" 
                                  onClick={() => openAssignmentDialog('driver')} 
                                  className="h-7"
                                  aria-label="Add driver"
                                >
                                  <UserPlus className="w-3 h-3" aria-hidden="true" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                        <div className="space-y-1">
                          {parsePostgresArray(request.assignedDriverIds).map((id) => {
                            const isCustom = id.startsWith('custom-');
                            // Check if the ID itself looks like a human name (not a system ID)
                            const idLooksLikeName = id &&
                              !id.startsWith('user_') &&
                              !id.startsWith('driver_') &&
                              !id.startsWith('driver-') &&
                              !id.startsWith('custom-') &&
                              !id.startsWith('host-contact-') &&
                              !/^\d+$/.test(id) &&
                              id.includes(' ');
                            const resolvedName = resolveUserName(id);
                            const displayName = isCustom
                              ? extractCustomName(id)
                              : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
                            return (
                            <div key={id} className="flex items-start gap-2 bg-[#47B3CB]/20 rounded px-3 py-1.5 border border-[#47B3CB]/30 min-w-0">
                              <span className="text-base font-bold text-[#236383] flex-1 min-w-0 break-words leading-tight">{displayName}</span>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('driver', id)}
                                  className="h-5 w-5 p-0 text-red-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            );
                          })}
                          {parsePostgresArray(request.assignedDriverIds).length === 0 && driverNeeded > 0 && parsePostgresArray(request.tentativeDriverIds).length === 0 && (
                            <Badge variant="outline" className="bg-[#236383]/20 text-[#236383] border-[#236383] font-medium">
                              <Car className="w-3 h-3 mr-1" />None assigned
                            </Badge>
                          )}
                          {/* Tentative Drivers */}
                          {parsePostgresArray(request.tentativeDriverIds).map((id) => {
                            const isCustom = id.startsWith('custom-');
                            const idLooksLikeName = id &&
                              !id.startsWith('user_') &&
                              !id.startsWith('driver_') &&
                              !id.startsWith('driver-') &&
                              !id.startsWith('custom-') &&
                              !id.startsWith('host-contact-') &&
                              !/^\d+$/.test(id) &&
                              id.includes(' ');
                            const resolvedName = resolveUserName(id);
                            const displayName = isCustom
                              ? extractCustomName(id)
                              : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
                            return (
                            <div key={`tentative-${id}`} className="flex items-start gap-2 bg-amber-100 rounded px-3 py-1.5 border border-amber-300 min-w-0">
                              <span className="text-base font-bold text-amber-700 flex-1 min-w-0 break-words leading-tight flex items-center gap-1">
                                <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                {displayName}
                                <span className="text-xs text-amber-500">(tentative)</span>
                              </span>
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('driver', id)}
                                  className="h-5 w-5 p-0 text-red-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : canEdit ? (
                  <div className="flex items-center justify-end py-0.5 gap-1 pb-3 border-b border-gray-200">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing('driversNeeded', '1')}
                      className="h-5 px-2 text-[#007E8C] text-xs"
                    >
                      <Car className="w-3 h-3 mr-0.5" />
                      Add Driver Need
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        startEditing('selfTransport', 'true');
                        setTimeout(() => saveEdit(), 0);
                      }}
                      className="h-5 px-2 text-[#D68319] text-xs"
                      title="Organization will transport sandwiches themselves"
                    >
                      <Car className="w-3 h-3 mr-0.5" />
                      Self-Transport
                    </Button>
                  </div>
                ) : null}

                {/* Speakers */}
                {(speakerNeeded > 0 || (isEditingThisCard && editingField === 'speakersNeeded')) ? (
                  <div className="pb-3 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      {isEditingThisCard && editingField === 'speakersNeeded' ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Megaphone className="w-4 h-4 text-[#236383]" />
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-7 w-16 text-sm"
                            min="0"
                            placeholder="0"
                          />
                          <span className="text-sm text-[#236383]">needed</span>
                          <Button size="sm" onClick={saveEdit} className="h-6 px-2" aria-label="Save">
                            <Save className="w-3 h-3" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                            <Megaphone className="w-5 h-5" />
                            Speakers ({speakerAssigned}/{speakerNeeded})
                          </span>
                          {canEdit && (
                            <Button size="sm" onClick={() => openAssignmentDialog('speaker')} className="h-7" aria-label="Add speaker">
                              <UserPlus className="w-3 h-3" aria-hidden="true" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-1">
                      {Object.keys(request.speakerDetails || {}).map((id) => {
                        const detailName = (request.speakerDetails as any)?.[id]?.name;
                        const customName = extractCustomName(id);
                        const userName = resolveUserName(id);
                        // Try getRecipientName for host-contact IDs
                        const recipientName = id.startsWith('host-contact-') && getRecipientName
                          ? getRecipientName(id)
                          : null;
                        // Check if detailName is actually just the ID (common with host-contact and custom IDs)
                        const isDetailNameJustId = detailName === id ||
                          detailName?.startsWith('host-contact-') ||
                          detailName?.startsWith('custom-');

                        // Check if the ID itself looks like a human name (not a system ID)
                        // System IDs: user_xxx, driver_xxx, custom-xxx, host-contact-xxx, numeric, etc.
                        const idLooksLikeName = id &&
                          !id.startsWith('user_') &&
                          !id.startsWith('driver_') &&
                          !id.startsWith('admin_') &&
                          !id.startsWith('committee_') &&
                          !id.startsWith('volunteer_') &&
                          !id.startsWith('custom-') &&
                          !id.startsWith('host-contact-') &&
                          !/^\d+$/.test(id) &&
                          id.includes(' '); // Names typically have spaces

                        // Prioritize: detail name > custom extracted name > recipient name > resolved user name > ID as name (if looks like name) > fallback
                        const displayName = (detailName && !isDetailNameJustId && !/^\d+$/.test(detailName))
                          ? detailName
                          : customName || recipientName || (userName !== id ? userName : (idLooksLikeName ? id : detailName || 'Unknown Speaker'));
                        const isUnknown = displayName === 'Unknown Speaker';
                        const editingFieldKey = `speaker-name-${id}`;
                        const isEditing = isEditingThisCard && editingField === editingFieldKey;
                        
                        return (
                          <div key={id} className="flex items-start gap-2 bg-[#47B3CB]/20 rounded px-3 py-1.5 border border-[#47B3CB]/30 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Input
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const updatedSpeakerDetails = {
                                        ...(request.speakerDetails || {}),
                                        [id]: {
                                          ...((request.speakerDetails as any)?.[id] || {}),
                                          name: editingValue.trim() || null,
                                        },
                                      };
                                      updateFieldsMutation.mutate({ speakerDetails: updatedSpeakerDetails });
                                      cancelEdit();
                                    } else if (e.key === 'Escape') {
                                      cancelEdit();
                                    }
                                  }}
                                  autoFocus
                                  className="h-8 text-base font-bold text-[#236383] flex-1 min-w-0"
                                  placeholder="Speaker name"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const updatedSpeakerDetails = {
                                      ...(request.speakerDetails || {}),
                                      [id]: {
                                        ...((request.speakerDetails as any)?.[id] || {}),
                                        name: editingValue.trim() || null,
                                      },
                                    };
                                    updateFieldsMutation.mutate({ speakerDetails: updatedSpeakerDetails });
                                    cancelEdit();
                                  }}
                                  className="h-6 px-2 text-green-600 shrink-0"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEdit}
                                  className="h-6 px-2 text-gray-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span 
                                  className="text-base font-bold text-[#236383] flex-1 min-w-0 break-words leading-tight cursor-pointer hover:underline"
                                  onClick={() => canEdit && startEditing(editingFieldKey, displayName)}
                                  title={canEdit ? "Click to edit speaker name" : undefined}
                                >
                                  {displayName}
                                  {isUnknown && (
                                    <span className="text-xs font-normal text-gray-500 ml-1" title={`Speaker ID: ${id}`}>
                                      (ID: {id})
                                    </span>
                                  )}
                                </span>
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRemoveAssignment('speaker', id)}
                                    className="h-5 w-5 p-0 text-red-600 shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                      {speakerAssigned === 0 && parsePostgresArray(request.tentativeSpeakerIds).length === 0 && <Badge variant="outline" className="bg-[#FBAD3F]/15 text-[#B8871F] border-[#FBAD3F]/40 font-medium"><Megaphone className="w-3 h-3 mr-1" />None assigned</Badge>}
                      {/* Tentative Speakers */}
                      {parsePostgresArray(request.tentativeSpeakerIds).map((id) => {
                        const isCustom = id.startsWith('custom-');
                        const idLooksLikeName = id &&
                          !id.startsWith('user_') &&
                          !id.startsWith('driver_') &&
                          !id.startsWith('custom-') &&
                          !id.startsWith('host-contact-') &&
                          !/^\d+$/.test(id) &&
                          id.includes(' ');
                        const resolvedName = resolveUserName(id);
                        const displayName = isCustom
                          ? extractCustomName(id)
                          : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
                        return (
                        <div key={`tentative-${id}`} className="flex items-start gap-2 bg-amber-100 rounded px-3 py-1.5 border border-amber-300 min-w-0">
                          <span className="text-base font-bold text-amber-700 flex-1 min-w-0 break-words leading-tight flex items-center gap-1">
                            <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            {displayName}
                            <span className="text-xs text-amber-500">(tentative)</span>
                          </span>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveAssignment('speaker', id)}
                              className="h-5 w-5 p-0 text-red-600 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ) : canEdit ? (
                  <div className="flex items-center justify-end py-0.5 pb-3 border-b border-gray-200">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('speakersNeeded', '1')}
                          className="h-5 w-5 p-0 text-[#007E8C]"
                        >
                          <Megaphone className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add speaker need</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}

                {/* Volunteers */}
                {(volunteerNeeded > 0 || (isEditingThisCard && editingField === 'volunteersNeeded')) ? (
                  <div className="pb-3 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      {isEditingThisCard && editingField === 'volunteersNeeded' ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Users className="w-4 h-4 text-[#236383]" />
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="h-7 w-16 text-sm"
                            min="0"
                            placeholder="0"
                          />
                          <span className="text-sm text-[#236383]">needed</span>
                          <Button size="sm" onClick={saveEdit} className="h-6 px-2" aria-label="Save">
                            <Save className="w-3 h-3" aria-hidden="true" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 px-2" aria-label="Cancel">
                            <X className="w-3 h-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-base font-bold text-gray-900 flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Users className="w-5 h-5" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Volunteers</p>
                              </TooltipContent>
                            </Tooltip>
                            Volunteers ({volunteerAssigned}/{volunteerNeeded})
                          </span>
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" onClick={() => openAssignmentDialog('volunteer')} className="h-7" aria-label="Add volunteer">
                                  <UserPlus className="w-3 h-3" aria-hidden="true" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Assign volunteers</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-1">
                      {parsePostgresArray(request.assignedVolunteerIds).map((id) => {
                        const isCustom = id.startsWith('custom-');
                        // Check if the ID itself looks like a human name (not a system ID)
                        const idLooksLikeName = id &&
                          !id.startsWith('user_') &&
                          !id.startsWith('driver_') &&
                          !id.startsWith('volunteer_') &&
                          !id.startsWith('volunteer-') &&
                          !id.startsWith('custom-') &&
                          !id.startsWith('host-contact-') &&
                          !/^\d+$/.test(id) &&
                          id.includes(' ');
                        const resolvedName = resolveUserName(id);
                        const displayName = isCustom
                          ? extractCustomName(id)
                          : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
                        return (
                        <div key={id} className="flex items-start gap-2 bg-[#47B3CB]/20 rounded px-3 py-1.5 border border-[#47B3CB]/30 min-w-0">
                          <span className="text-base font-bold text-[#236383] flex-1 min-w-0 break-words leading-tight">{displayName}</span>
                          {canEdit && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveAssignment('volunteer', id)}
                                  className="h-5 w-5 p-0 text-red-600 shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove volunteer assignment</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        );
                      })}
                      {volunteerAssigned === 0 && parsePostgresArray(request.tentativeVolunteerIds).length === 0 && <Badge variant="outline" className="bg-[#47B3CB]/15 text-[#236383] border-[#47B3CB]/40 font-medium"><Users className="w-3 h-3 mr-1" />None assigned</Badge>}
                      {/* Tentative Volunteers */}
                      {parsePostgresArray(request.tentativeVolunteerIds).map((id) => {
                        const isCustom = id.startsWith('custom-');
                        const idLooksLikeName = id &&
                          !id.startsWith('user_') &&
                          !id.startsWith('driver_') &&
                          !id.startsWith('volunteer_') &&
                          !id.startsWith('volunteer-') &&
                          !id.startsWith('custom-') &&
                          !id.startsWith('host-contact-') &&
                          !/^\d+$/.test(id) &&
                          id.includes(' ');
                        const resolvedName = resolveUserName(id);
                        const displayName = isCustom
                          ? extractCustomName(id)
                          : (resolvedName !== id ? resolvedName : (idLooksLikeName ? id : resolvedName));
                        return (
                        <div key={`tentative-${id}`} className="flex items-start gap-2 bg-amber-100 rounded px-3 py-1.5 border border-amber-300 min-w-0">
                          <span className="text-base font-bold text-amber-700 flex-1 min-w-0 break-words leading-tight flex items-center gap-1">
                            <HelpCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            {displayName}
                            <span className="text-xs text-amber-500">(tentative)</span>
                          </span>
                          {canEdit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveAssignment('volunteer', id)}
                              className="h-5 w-5 p-0 text-red-600 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                ) : canEdit ? (
                  <div className="flex items-center justify-end py-0.5 pb-3 border-b border-gray-200">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing('volunteersNeeded', '1')}
                          className="h-5 px-2 text-[#007E8C] text-xs"
                        >
                          <Users className="w-3 h-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Add volunteer need</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : null}

                {/* Attendance */}
                <div className="flex items-start gap-2 pb-3 border-b border-gray-200">
                  <Users className="w-5 h-5 shrink-0 mt-0.5" />
                  {isEditingThisCard && editingField === 'attendanceBreakdown' ? (
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-1 xs:grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-gray-300 block mb-1">Adults</label>
                          <Input
                            type="number"
                            value={editingValue.split(',')[0] || ''}
                            onChange={(e) => {
                              const parts = editingValue.split(',');
                              parts[0] = e.target.value;
                              setEditingValue(parts.join(','));
                            }}
                            className="h-8 w-full bg-white text-gray-900"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-300 block mb-1">Teens</label>
                          <Input
                            type="number"
                            value={editingValue.split(',')[1] || ''}
                            onChange={(e) => {
                              const parts = editingValue.split(',');
                              parts[1] = e.target.value;
                              setEditingValue(parts.join(','));
                            }}
                            className="h-8 w-full bg-white text-gray-900"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-300 block mb-1">Kids</label>
                          <Input
                            type="number"
                            value={editingValue.split(',')[2] || ''}
                            onChange={(e) => {
                              const parts = editingValue.split(',');
                              parts[2] = e.target.value;
                              setEditingValue(parts.join(','));
                            }}
                            className="h-8 w-full bg-white text-gray-900"
                            placeholder="0"
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-gray-600 hover:bg-gray-100">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 group cursor-pointer" onClick={() => canEdit && startEditing('attendanceBreakdown', `${request.attendanceAdults || ''},${request.attendanceTeens || ''},${request.attendanceKids || ''}`)}>
                      <div className="text-base font-semibold">
                        {(request.attendanceAdults || request.attendanceTeens || request.attendanceKids) ? (
                          <div className="flex flex-wrap gap-2">
                            {request.attendanceAdults ? <span>{request.attendanceAdults} adults</span> : null}
                            {request.attendanceTeens ? <span>{request.attendanceTeens} teens</span> : null}
                            {request.attendanceKids ? <span>{request.attendanceKids} kids</span> : null}
                            <span className="text-gray-300">
                              ({(request.attendanceAdults || 0) + (request.attendanceTeens || 0) + (request.attendanceKids || 0)} total)
                            </span>
                          </div>
                        ) : request.estimatedAttendance ? (
                          `${request.estimatedAttendance} people expected`
                        ) : (
                          <span className="text-gray-600 font-medium">No attendance set</span>
                        )}
                      </div>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); startEditing('attendanceBreakdown', `${request.attendanceAdults || ''},${request.attendanceTeens || ''},${request.attendanceKids || ''}`); }}
                          className="text-white hover:bg-white/20 h-6 px-2 transition-colors"
                          aria-label="Edit attendance"
                        >
                          <Edit2 className="w-3 h-3" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Event Organizer & Recipient Logistics */}
          <div className="flex flex-col gap-4 h-full lg:order-3">
            {/* Event Organizer */}
            <div className="bg-white rounded-lg p-4 border-l-4 border-[#47B3CB] border-t border-r border-b border-[#47B3CB]/20 shadow-md">
              <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383] pb-2 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#47B3CB]" aria-hidden="true" />
                Event Organizer
              </h3>
              <div className="space-y-2 text-sm text-gray-900">
                {(request.firstName || request.lastName) && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="text-base font-semibold">
                      {request.firstName} {request.lastName}
                    </span>
                  </div>
                )}
                {request.email && (
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${request.email}`} className="hover:underline break-all min-w-0">
                      {request.email}
                    </a>
                  </div>
                )}
                {request.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    <a href={`tel:${request.phone}`} className="hover:underline">
                      {request.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
            {/* Recipient Logistics moved to Column 1, right after times row */}
          </div>
        </div>

        {/* Scheduling Notes - Always Visible */}
        {request.schedulingNotes && (
          <div className="bg-gradient-to-r from-green-50 to-green-50/50 rounded-lg p-4 mb-4 border-l-4 border-green-500 border-t border-r border-b border-green-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-green-600" />
                <h3 className="text-sm uppercase font-bold tracking-wide text-green-700">
                  Scheduling Notes
                </h3>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing('schedulingNotes', request.schedulingNotes || '')}
                  className="h-6 px-2 text-green-700 hover:text-green-800 hover:bg-green-100"
                  aria-label="Edit scheduling notes"
                >
                  <Edit2 className="w-3 h-3" aria-hidden="true" />
                </Button>
              )}
            </div>
            {isEditingThisCard && editingField === 'schedulingNotes' ? (
              <div className="space-y-2">
                <textarea
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded text-sm min-h-[100px] text-gray-900 bg-white"
                  placeholder="Add scheduling notes..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit}>
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-2 border-green-400 whitespace-pre-wrap">
                {request.schedulingNotes}
              </p>
            )}
          </div>
        )}

        {/* Notes & Requirements Section */}
        {(request.message ||
          request.planningNotes ||
          request.additionalRequirements ||
          request.volunteerNotes ||
          request.driverNotes ||
          request.vanDriverNotes ||
          request.followUpNotes ||
          request.distributionNotes ||
          request.duplicateNotes ||
          request.unresponsiveNotes ||
          request.socialMediaPostNotes) && (
          <div className="bg-gradient-to-r from-[#236383]/30 to-[#236383]/15 rounded-lg p-4 mb-4 border-l-4 border-[#236383] border-t border-r border-b border-[#236383]/20 shadow-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotesAndRequirements(!showNotesAndRequirements)}
              className="w-full justify-between text-[#236383] hover:text-[#236383] hover:bg-[#236383]/10 font-medium p-0 h-auto mb-0"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#236383]" />
                <h3 className="text-sm uppercase font-bold tracking-wide text-[#236383]">
                  Notes & Requirements
                </h3>
              </div>
              {showNotesAndRequirements ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
            </Button>
            {showNotesAndRequirements && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto mt-3">
              {request.message && (
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium mb-1 text-gray-900">Original Request Message:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-[#007E8C] whitespace-pre-wrap">
                    {request.message}
                  </p>
                </div>
              )}
              {request.additionalRequirements && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Special Requirements:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400 whitespace-pre-wrap">
                    {request.additionalRequirements}
                  </p>
                </div>
              )}
              {request.planningNotes && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Planning Notes:</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditing('planningNotes', request.planningNotes || '')}
                        className="h-6 px-2"
                        aria-label="Edit planning notes"
                      >
                        <Edit2 className="w-3 h-3" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {isEditingThisCard && editingField === 'planningNotes' ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded text-sm min-h-[100px] text-gray-900 bg-white"
                        placeholder="Add planning notes..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 bg-gradient-to-r from-[#47B3CB]/30 to-[#47B3CB]/15 p-3 rounded border-l-4 border-[#47B3CB] border-t border-r border-b border-[#47B3CB]/20 whitespace-pre-wrap">
                      {request.planningNotes}
                    </p>
                  )}
                </div>
              )}
              {request.volunteerNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Volunteer Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-purple-400 whitespace-pre-wrap">
                    {request.volunteerNotes}
                  </p>
                </div>
              )}
              {request.driverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-[#007E8C] whitespace-pre-wrap">
                    {request.driverNotes}
                  </p>
                </div>
              )}
              {request.vanDriverNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Van Driver Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-red-400 whitespace-pre-wrap">
                    {request.vanDriverNotes}
                  </p>
                </div>
              )}
              {request.followUpNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Follow-up Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-yellow-400 whitespace-pre-wrap">
                    {request.followUpNotes}
                  </p>
                </div>
              )}
              {request.distributionNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Distribution Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-teal-400 whitespace-pre-wrap">
                    {request.distributionNotes}
                  </p>
                </div>
              )}
              {/* Duplicate check notes hidden - runs in background only */}
              {request.unresponsiveNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Contact Attempts Logged:</p>
                  <p className="text-sm text-gray-700 bg-gradient-to-r from-[#A31C41]/30 to-[#A31C41]/15 p-3 rounded border-l-4 border-[#A31C41]">
                    {request.unresponsiveNotes}
                  </p>
                </div>
              )}
              {request.socialMediaPostNotes && (
                <div>
                  <p className="text-sm font-medium mb-1 text-gray-900">Social Media Notes:</p>
                  <p className="text-sm text-gray-700 bg-white p-3 rounded border-l-4 border-indigo-400">
                    {request.socialMediaPostNotes}
                  </p>
                </div>
              )}
              </div>
            )}
          </div>
        )}


        {/* Action Buttons Row */}
        <div className="flex flex-wrap gap-2 mb-4 pt-4 border-t-2 border-[#007E8C]/10">
          <Button
            onClick={onContact}
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact Organizer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onLogContact}
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Log Contact
          </Button>
          {onAiIntakeAssist && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAiIntakeAssist}
              className="border-purple-500/30 text-purple-600 hover:bg-purple-50"
              data-testid="button-ai-intake-check"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              AI Intake Check
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onReschedule}>
            Reschedule
          </Button>
          <Button size="sm" onClick={onFollowUp}>
            Follow Up
          </Button>

          {!(request.tspContact || request.customTspContact) && canEditTspContact && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAssignTspContact}
              className="border-[#FBAD3F]/30 text-[#FBAD3F] hover:bg-[#FBAD3F]/10"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Assign TSP Contact
            </Button>
          )}

          {/* Propose to Planning Sheet button */}
          <ProposeToSheetButton
            eventId={request.id}
            organizationName={request.organizationName || 'Unknown'}
            variant="outline"
            size="sm"
            className="border-blue-500/30"
          />
        </div>

        {/* Team Comments Section */}
        {request.id && (
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(!showComments)}
                className="flex-1 justify-between text-gray-700 hover:text-gray-700 hover:bg-gray-50 font-medium p-2 h-auto"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                  <h3 className="text-sm font-semibold">Team Comments</h3>
                  {collaboration.comments && collaboration.comments.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {collaboration.comments.length}
                    </Badge>
                  )}
                </div>
                {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>

            {showComments && (
              <div className="mt-3 max-h-[500px]">
                <CommentThread
                  comments={collaboration.comments || []}
                  currentUserId={user?.id || ''}
                  currentUserName={user?.fullName || user?.email || ''}
                  eventId={request.id}
                  onAddComment={collaboration.addComment}
                  onEditComment={collaboration.updateComment}
                  onDeleteComment={collaboration.deleteComment}
                  isLoading={collaboration.commentsLoading || false}
                />
              </div>
            )}
          </div>
        )}

        {/* Pre-Event Flags Button */}
        <div className="border-t-2 border-[#007E8C]/10 pt-4 mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowFlagsDialog(true);
              }}
              className="flex-1 justify-between text-[#236383] hover:text-[#236383] hover:bg-[#007E8C]/5 font-medium"
              type="button"
            >
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4" aria-hidden="true" />
                <span>Pre-Event Flags</span>
                {request.preEventFlags && Array.isArray(request.preEventFlags) && 
                 request.preEventFlags.filter((f: any) => !f.resolvedAt).length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {request.preEventFlags.filter((f: any) => !f.resolvedAt).length}
                  </Badge>
                )}
              </div>
            </Button>
          </div>
        </div>

        {/* Activity History Toggle */}
        <div className="border-t-2 border-[#007E8C]/10 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowAuditLog(!showAuditLog);
            }}
            className="w-full justify-between text-[#236383] hover:text-[#236383] hover:bg-[#007E8C]/5 font-medium"
            type="button"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" aria-hidden="true" />
              Activity History
            </div>
            {showAuditLog ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
          </Button>
        </div>

        {showAuditLog && (
          <div className="mt-4 pt-4 border-t-2 border-[#007E8C]/10">
            <EventRequestAuditLog
              eventId={request.id?.toString()}
              showFilters={false}
              compact={true}
            />
          </div>
        )}
      </CardContent>

      {/* Message Composer Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message About Event: {request.organizationName}</DialogTitle>
          </DialogHeader>
          <MessageComposer
            contextType="event"
            contextId={request.id.toString()}
            contextTitle={`${request.organizationName} event${displayDate ? ` on ${formatEventDate(displayDate.toString())}` : ''}`}
            onSent={() => setShowMessageDialog(false)}
            onCancel={() => setShowMessageDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Send Event Details via SMS Dialog */}
      <SendEventDetailsSMSDialog
        isOpen={showSendSmsDialog}
        onClose={() => setShowSendSmsDialog(false)}
        eventRequest={request}
      />

      {/* Send Correction SMS Dialog */}
      <SendCorrectionSMSDialog
        isOpen={showSendCorrectionDialog}
        onClose={() => setShowSendCorrectionDialog(false)}
        eventRequest={request}
      />

      {/* Pre-Event Flags Dialog */}
      <PreEventFlagsDialog
        flags={request.preEventFlags || []}
        eventId={request.id}
        eventName={request.organizationName || 'Event'}
        isOpen={showFlagsDialog}
        onClose={() => setShowFlagsDialog(false)}
      />
    </Card>
  );
};