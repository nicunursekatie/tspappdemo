import * as React from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronDown,
  Plus,
  Trash2,
  Users,
  MessageSquare,
  Edit,
  User,
  Calendar,
  MapPin,
  Sandwich,
  Car,
  FileText,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import type { EventRequest } from '@shared/schema';
import { VALID_STATUS_TRANSITIONS, STATUS_DEFINITIONS } from './constants';
import type { EventStatus } from '@shared/event-status-workflow';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { getPickupDateTimeForInput, parsePostgresArray } from './utils';
import { RecipientSelector } from '@/components/ui/recipient-selector';
import { MultiRecipientSelector } from '@/components/ui/multi-recipient-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { logger } from '@/lib/logger';
import { useAuth } from '@/hooks/useAuth';
import { useEventCollaboration } from '@/hooks/use-event-collaboration';
import { PresenceAvatars, FieldLockIndicator } from '@/components/collaboration';
import { EventConflictWarnings } from './EventConflictWarnings';
import { RefrigerationWarningAlert } from './RefrigerationWarningBadge';
import {
  ContactInfoSection,
  BackupContactSection,
  CompletedEventSection,
  SandwichPlanningSection,
  ResourceRequirementsSection,
  type EventFormData,
} from './form-sections';
import { FIELD_MAPPINGS, isUiOnlyField } from './fieldConfig';

/**
 * Intelligent merge of cached form data with current server data.
 *
 * This function preserves:
 * 1. User's intentional changes (cached value differs from original cached server value)
 * 2. Server updates (current server value differs from original cached server value)
 *
 * When both user and server changed the same field (conflict), server wins
 * but we track these conflicts for user notification.
 *
 * @param cachedFormData - Form data saved to localStorage
 * @param originalServerData - Server data at time of caching (also saved to localStorage)
 * @param currentServerData - Current server data (freshly loaded)
 * @returns { mergedData, conflicts, serverUpdates }
 */
function intelligentMergeFormData(
  cachedFormData: Record<string, any>,
  originalServerData: Record<string, any> | null | undefined,
  currentServerData: Record<string, any>
): {
  mergedData: Record<string, any>;
  conflicts: string[];
  serverUpdates: string[];
  userChangesPreserved: string[];
} {
  const mergedData: Record<string, any> = { ...currentServerData };
  const conflicts: string[] = [];
  const serverUpdates: string[] = [];
  const userChangesPreserved: string[] = [];

  // If we don't have original server data, fall back to using cached data
  // (for backwards compatibility with old cache format)
  if (!originalServerData) {
    logger.log('⚠️ No original server data in cache - using cached form data directly');
    // Guard: status must never be empty — fall back to server's current status
    if (!cachedFormData.status) {
      cachedFormData.status = currentServerData.status || 'new';
      logger.log('🛡️ Fixed empty status in cached form data, using:', cachedFormData.status);
    }
    return {
      mergedData: cachedFormData,
      conflicts: [],
      serverUpdates: [],
      userChangesPreserved: Object.keys(cachedFormData),
    };
  }

  // Helper to compare values (handles null/undefined/empty string equivalence)
  const valuesEqual = (a: any, b: any): boolean => {
    // Normalize null/undefined/empty string to null for comparison
    const normalizeValue = (v: any) => {
      if (v === null || v === undefined || v === '') return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    };
    return normalizeValue(a) === normalizeValue(b);
  };

  // Process each field in the cached form data
  for (const key of Object.keys(cachedFormData)) {
    const cachedValue = cachedFormData[key];
    const originalValue = originalServerData[key];
    const currentValue = currentServerData[key];

    const userChangedField = !valuesEqual(cachedValue, originalValue);
    const serverChangedField = !valuesEqual(currentValue, originalValue);

    if (userChangedField && serverChangedField) {
      // CONFLICT: Both user and server changed this field
      // Server wins, but track the conflict
      conflicts.push(key);
      mergedData[key] = currentValue;
      logger.log(`🔀 Conflict on "${key}": user had "${cachedValue}", server has "${currentValue}" - using server value`);
    } else if (userChangedField) {
      // User changed this field, server didn't - preserve user's change
      userChangesPreserved.push(key);
      mergedData[key] = cachedValue;
      logger.log(`✏️ Preserving user change on "${key}": "${cachedValue}"`);
    } else if (serverChangedField) {
      // Server changed this field, user didn't - use server's update
      serverUpdates.push(key);
      mergedData[key] = currentValue;
      logger.log(`📥 Using server update on "${key}": "${currentValue}"`);
    }
    // If neither changed, currentServerData already has the right value
  }

  // Guard: status must never be empty after merge — fall back to server value
  if (!mergedData.status) {
    mergedData.status = currentServerData.status || 'new';
    logger.log('🛡️ Fixed empty status after merge, using:', mergedData.status);
  }

  return { mergedData, conflicts, serverUpdates, userChangesPreserved };
}

/**
 * Build form data object from an EventRequest.
 * This is used both for initial form population and for intelligent merge.
 */
function buildFormDataFromEventRequest(
  eventRequest: EventRequest | null,
  formatDateForInput: (date: any) => string,
  getPickupDateTimeForInput: (pickupDateTime: any, pickupTime: any, eventDate: string) => string,
  parsePostgresArray: (value: any) => string[]
): Record<string, any> {
  // Parse sandwich types
  const existingSandwichTypes = eventRequest?.sandwichTypes ?
    (typeof eventRequest?.sandwichTypes === 'string' ?
      JSON.parse(eventRequest.sandwichTypes) : eventRequest?.sandwichTypes) : [];
  const totalCount = eventRequest?.estimatedSandwichCount || 0;
  const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ?
    (typeof eventRequest?.actualSandwichTypes === 'string' ?
      JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];

  return {
    eventDate: eventRequest ? formatDateForInput(eventRequest.desiredEventDate) : '',
    dateFlexible: eventRequest?.dateFlexible ?? null, // null = unknown, true = flexible, false = fixed
    backupDates: (eventRequest as any)?.backupDates?.map((d: string) => formatDateForInput(d)) || [],
    eventStartTime: eventRequest?.eventStartTime || '',
    eventEndTime: eventRequest?.eventEndTime || '',
    pickupTime: eventRequest?.pickupTime || '',
    pickupDateTime: getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate)),
    pickupDate: (() => {
      const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
      return pickupDT ? pickupDT.split('T')[0] : '';
    })(),
    pickupTimeSeparate: (() => {
      const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
      return pickupDT ? pickupDT.split('T')[1]?.substring(0, 5) : '';
    })(),
    eventAddress: eventRequest?.eventAddress || '',
    deliveryDestination: eventRequest?.deliveryDestination || '',
    holdingOvernight: !!(eventRequest?.overnightHoldingLocation),
    overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
    overnightPickupTime: eventRequest?.overnightPickupTime || '',
    sandwichTypes: existingSandwichTypes,
    hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
    driversNeeded: eventRequest?.driversNeeded || 0,
    selfTransport: eventRequest?.selfTransport || false,
    vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
    speakersNeeded: eventRequest?.speakersNeeded || 0,
    volunteersNeeded: eventRequest?.volunteersNeeded || 0,
    tspContact: eventRequest?.tspContact || '',
    customTspContact: (eventRequest as any)?.customTspContact || '',
    message: (eventRequest as any)?.message || '',
    schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
    planningNotes: (eventRequest as any)?.planningNotes || '',
    nextAction: (eventRequest as any)?.nextAction || '',
    driverInstructions: (eventRequest as any)?.driverInstructions || '',
    volunteerInstructions: (eventRequest as any)?.volunteerInstructions || '',
    speakerInstructions: (eventRequest as any)?.speakerInstructions || '',
    totalSandwichCount: totalCount,
    estimatedSandwichCountMin: (eventRequest as any)?.estimatedSandwichCountMin || 0,
    estimatedSandwichCountMax: (eventRequest as any)?.estimatedSandwichCountMax || 0,
    rangeSandwichType: (eventRequest as any)?.estimatedSandwichRangeType || '',
    volunteerCount: (eventRequest as any)?.volunteerCount || 0,
    estimatedAttendance: (eventRequest as any)?.estimatedAttendance || 0,
    adultCount: (eventRequest as any)?.adultCount || 0,
    childrenCount: (eventRequest as any)?.childrenCount || 0,
    kidsAgeRange: (eventRequest as any)?.kidsAgeRange || '',
    firstName: eventRequest?.firstName || '',
    lastName: eventRequest?.lastName || '',
    email: eventRequest?.email || '',
    phone: eventRequest?.phone || '',
    organizationName: eventRequest?.organizationName || '',
    department: eventRequest?.department || '',
    organizationCategory: (eventRequest as any)?.organizationCategory || '',
    schoolClassification: (eventRequest as any)?.schoolClassification || '',
    backupContactFirstName: (eventRequest as any)?.backupContactFirstName || '',
    backupContactLastName: (eventRequest as any)?.backupContactLastName || '',
    backupContactEmail: (eventRequest as any)?.backupContactEmail || '',
    backupContactPhone: (eventRequest as any)?.backupContactPhone || '',
    backupContactRole: (eventRequest as any)?.backupContactRole || '',
    previouslyHosted: (eventRequest as any)?.previouslyHosted || 'i_dont_know',
    speakerAudienceType: (eventRequest as any)?.speakerAudienceType || '',
    speakerDuration: (eventRequest as any)?.speakerDuration || '',
    deliveryTimeWindow: (eventRequest as any)?.deliveryTimeWindow || '',
    deliveryParkingAccess: (eventRequest as any)?.deliveryParkingAccess || '',
    assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
    isDhlVan: (eventRequest as any)?.isDhlVan || false,
    status: eventRequest?.status || 'new',
    toolkitSent: eventRequest?.toolkitSent || false,
    toolkitSentDate: eventRequest?.toolkitSentDate ? formatDateForInput(eventRequest.toolkitSentDate) : '',
    toolkitStatus: eventRequest?.toolkitStatus || 'not_sent',
    isCorporatePriority: (eventRequest as any)?.isCorporatePriority || false,
    standbyExpectedDate: (eventRequest as any)?.standbyExpectedDate ? formatDateForInput((eventRequest as any).standbyExpectedDate) : '',
    socialMediaPostRequested: (eventRequest as any)?.socialMediaPostRequested || false,
    socialMediaPostRequestedDate: (eventRequest as any)?.socialMediaPostRequestedDate ? formatDateForInput((eventRequest as any).socialMediaPostRequestedDate) : '',
    socialMediaPostCompleted: (eventRequest as any)?.socialMediaPostCompleted || false,
    socialMediaPostCompletedDate: (eventRequest as any)?.socialMediaPostCompletedDate ? formatDateForInput((eventRequest as any).socialMediaPostCompletedDate) : '',
    socialMediaPostNotes: (eventRequest as any)?.socialMediaPostNotes || '',
    actualSandwichCount: (eventRequest as any)?.actualSandwichCount || 0,
    actualSandwichTypes: existingActualSandwichTypes,
    actualSandwichCountRecordedDate: (eventRequest as any)?.actualSandwichCountRecordedDate ? formatDateForInput((eventRequest as any).actualSandwichCountRecordedDate) : '',
    actualSandwichCountRecordedBy: (eventRequest as any)?.actualSandwichCountRecordedBy || '',
    followUpOneDayCompleted: (eventRequest as any)?.followUpOneDayCompleted || false,
    followUpOneDayDate: (eventRequest as any)?.followUpOneDayDate ? formatDateForInput((eventRequest as any).followUpOneDayDate) : '',
    followUpOneMonthCompleted: (eventRequest as any)?.followUpOneMonthCompleted || false,
    followUpOneMonthDate: (eventRequest as any)?.followUpOneMonthDate ? formatDateForInput((eventRequest as any).followUpOneMonthDate) : '',
    followUpNotes: (eventRequest as any)?.followUpNotes || '',
    assignedRecipientIds: parsePostgresArray((eventRequest as any)?.assignedRecipientIds),
  };
}

// Event Scheduling Form Component
interface EventSchedulingFormProps {
  eventRequest: EventRequest | null;
  isVisible?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onScheduled?: () => void;
  onEventScheduled?: () => void;
  onDelete?: (eventRequestId: number) => void;
  mode?: 'schedule' | 'edit' | 'create';
}

const EventSchedulingForm: React.FC<EventSchedulingFormProps> = ({
  eventRequest,
  isVisible,
  isOpen,
  onClose,
  onScheduled,
  onEventScheduled,
  onDelete,
  mode = 'schedule',
}) => {
  const dialogOpen = isVisible || isOpen || false;
  const onSuccessCallback = onScheduled || onEventScheduled || (() => {});
  const [formData, setFormData] = useState({
    eventDate: '',
    backupDates: [] as string[],
    eventStartTime: '',
    eventEndTime: '',
    pickupTime: '',
    pickupDateTime: '',
    pickupDate: '',
    pickupTimeSeparate: '',
    eventAddress: '',
    deliveryDestination: '',
    holdingOvernight: false,
    overnightHoldingLocation: '',
    overnightPickupTime: '',
    sandwichTypes: [] as Array<{type: string, quantity: number}>,
    hasRefrigeration: '',
    driversNeeded: 0,
    selfTransport: false,
    vanDriverNeeded: false,
    assignedVanDriverId: '',
    isDhlVan: false,
    speakersNeeded: 0,
    volunteersNeeded: 0,
    tspContact: '',
    customTspContact: '',
    message: '',
    schedulingNotes: '',
    planningNotes: '',
    nextAction: '',
    driverInstructions: '',
    volunteerInstructions: '',
    speakerInstructions: '',
    totalSandwichCount: 0,
    estimatedSandwichCountMin: 0,
    estimatedSandwichCountMax: 0,
    rangeSandwichType: '',
    volunteerCount: 0,
    estimatedAttendance: 0,
    adultCount: 0,
    childrenCount: 0,
    kidsAgeRange: '',
    status: 'new',
    toolkitSent: false,
    toolkitSentDate: '',
    toolkitStatus: 'not_sent',
    // Completed event tracking fields
    socialMediaPostRequested: false,
    socialMediaPostRequestedDate: '',
    socialMediaPostCompleted: false,
    socialMediaPostCompletedDate: '',
    socialMediaPostNotes: '',
    actualSandwichCount: 0,
    actualSandwichTypes: [] as Array<{type: string, quantity: number}>,
    actualSandwichCountRecordedDate: '',
    actualSandwichCountRecordedBy: '',
    followUpOneDayCompleted: false,
    followUpOneDayDate: '',
    followUpOneMonthCompleted: false,
    followUpOneMonthDate: '',
    followUpNotes: '',
    assignedRecipientIds: [] as string[],
    // Manual entry source tracking
    manualEntrySource: '',
    // Contact information fields
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organizationName: '',
    department: '',
    organizationCategory: '',
    schoolClassification: '',
    // Backup contact fields
    backupContactFirstName: '',
    backupContactLastName: '',
    backupContactEmail: '',
    backupContactPhone: '',
    backupContactRole: '',
    // Previously hosted flag
    previouslyHosted: 'i_dont_know',
    // Speaker details (conditional fields when speakers > 0)
    speakerAudienceType: '',
    speakerDuration: '',
    // Delivery details for overnight holding
    deliveryTimeWindow: '',
    deliveryParkingAccess: '',
    // Corporate priority
    isCorporatePriority: false,
    // Standby follow-up
    standbyExpectedDate: '',
  });

  const [sandwichMode, setSandwichMode] = useState<'total' | 'range' | 'types'>('total');
  const [actualSandwichMode, setActualSandwichMode] = useState<'total' | 'types'>('total');
  const [attendeeMode, setAttendeeMode] = useState<'total' | 'breakdown'>('total');
  
  // Track when form data has been properly initialized from eventRequest
  // This prevents race condition where form submits before useEffect populates data
  const [formInitialized, setFormInitialized] = useState(false);
  
  // Store original form data to detect changes and preserve existing data
  const originalFormDataRef = useRef<typeof formData | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showBackupContactInfo, setShowBackupContactInfo] = useState(false);
  const [showCompletedDetails, setShowCompletedDetails] = useState(false);
  const [showDateConfirmation, setShowDateConfirmation] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState('');
  const [isMessageEditable, setIsMessageEditable] = useState(false);
  const [showVanConflictDialog, setShowVanConflictDialog] = useState(false);
  const [vanConflictDetails, setVanConflictDetails] = useState<{
    conflictingEvents: Array<{ id: number; name: string; time?: string }>;
    acknowledged: boolean;
  } | null>(null);
  const [showSpeakerWarningDialog, setShowSpeakerWarningDialog] = useState(false);
  const [vanConflictChecked, setVanConflictChecked] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showStandbyFollowUpDialog, setShowStandbyFollowUpDialog] = useState(false);
  const [standbyFollowUpDate, setStandbyFollowUpDate] = useState('');
  const [standbyFollowUpMode, setStandbyFollowUpMode] = useState<'specific' | 'one_week'>('one_week');
  // Ref to distinguish "save action clicked" from "dialog dismissed" in onOpenChange.
  // State can't be used here because React batches the updates, so isSubmitting wouldn't
  // be true yet when onOpenChange reads it in the same event cycle.
  const standbySaveClickedRef = useRef(false);
  const [showCorporatePriorityConfirmDialog, setShowCorporatePriorityConfirmDialog] = useState(false);
  const [hasRecoveredData, setHasRecoveredData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  
  // Check if current user can remove corporate priority (only Katie and Christine)
  const canRemoveCorporatePriority = useMemo(() => {
    const allowedEmails = [
      'admin@sandwich.project',
      'katielong2316@gmail.com',
      'katie@thesandwichproject.org',
      'christine@thesandwichproject.org'
    ];
    const userEmail = currentUser?.email?.toLowerCase();
    return userEmail && allowedEmails.includes(userEmail);
  }, [currentUser?.email]);

  // Auto-save key based on event ID (or 'new' for create mode)
  const getAutoSaveKey = useCallback(() => {
    const eventId = eventRequest?.id || 'new';
    return `tsp-event-form-autosave-${eventId}`;
  }, [eventRequest?.id]);

  // Clear auto-saved data for current event
  const clearAutoSave = useCallback(() => {
    // CRITICAL: Cancel any pending auto-save timeout to prevent race condition
    // where auto-save fires AFTER we clear, re-creating the localStorage entry
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    try {
      localStorage.removeItem(getAutoSaveKey());
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [getAutoSaveKey]);

  // Save form data to localStorage with debounce
  // CRITICAL: Also save the original server values so we can perform intelligent merge on recovery
  const saveToLocalStorage = useCallback(() => {
    if (!formInitialized) return;
    try {
      const saveData = {
        formData,
        sandwichMode,
        actualSandwichMode,
        attendeeMode,
        savedAt: new Date().toISOString(),
        eventId: eventRequest?.id || null,
        // Store original server values at time of caching for intelligent merge
        originalServerData: originalFormDataRef.current,
      };
      localStorage.setItem(getAutoSaveKey(), JSON.stringify(saveData));
    } catch (e) {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }, [formData, sandwichMode, actualSandwichMode, attendeeMode, formInitialized, getAutoSaveKey, eventRequest?.id]);

  // Track whether to skip recovery on next initialization
  const skipRecoveryRef = useRef(false);
  
  // Discard recovered data and reload from server
  const discardRecoveredData = useCallback(() => {
    // Clear auto-saved data
    clearAutoSave();
    setHasRecoveredData(false);
    
    // Set flag to skip recovery on re-init
    skipRecoveryRef.current = true;
    
    // Close and reopen triggers re-initialization without recovery
    // Since we can't easily trigger useEffect again, we'll manually reload from eventRequest
    if (!eventRequest) return;
    
    // Parse sandwich types from server
    const existingSandwichTypes = eventRequest?.sandwichTypes ? 
      (typeof eventRequest?.sandwichTypes === 'string' ? 
        JSON.parse(eventRequest.sandwichTypes) : eventRequest?.sandwichTypes) : [];
    const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
    const hasRangeData = (eventRequest as any)?.estimatedSandwichCountMin && (eventRequest as any)?.estimatedSandwichCountMax;
    const totalCount = eventRequest?.estimatedSandwichCount || 0;
    const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ? 
      (typeof eventRequest?.actualSandwichTypes === 'string' ? 
        JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];
    const hasActualTypesData = Array.isArray(existingActualSandwichTypes) && existingActualSandwichTypes.length > 0;

    setFormData({
      eventDate: formatDateForInput(eventRequest.desiredEventDate),
      backupDates: (eventRequest as any)?.backupDates?.map((d: string) => formatDateForInput(d)) || [],
      eventStartTime: eventRequest?.eventStartTime || '',
      eventEndTime: eventRequest?.eventEndTime || '',
      pickupTime: eventRequest?.pickupTime || '',
      pickupDateTime: getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate)),
      pickupDate: (() => {
        const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
        return pickupDT ? pickupDT.split('T')[0] : '';
      })(),
      pickupTimeSeparate: (() => {
        const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
        return pickupDT ? pickupDT.split('T')[1]?.substring(0, 5) : '';
      })(),
      eventAddress: eventRequest?.eventAddress || '',
      deliveryDestination: eventRequest?.deliveryDestination || '',
      holdingOvernight: !!(eventRequest?.overnightHoldingLocation),
      overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
      overnightPickupTime: eventRequest?.overnightPickupTime || '',
      sandwichTypes: existingSandwichTypes,
      hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
      driversNeeded: eventRequest?.driversNeeded || 0,
      selfTransport: eventRequest?.selfTransport || false,
      vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
      speakersNeeded: eventRequest?.speakersNeeded || 0,
      volunteersNeeded: eventRequest?.volunteersNeeded || 0,
      tspContact: eventRequest?.tspContact || '',
      customTspContact: (eventRequest as any)?.customTspContact || '',
      message: (eventRequest as any)?.message || '',
      schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
      planningNotes: (eventRequest as any)?.planningNotes || '',
      nextAction: (eventRequest as any)?.nextAction || '',
      driverInstructions: (eventRequest as any)?.driverInstructions || '',
      volunteerInstructions: (eventRequest as any)?.volunteerInstructions || '',
      speakerInstructions: (eventRequest as any)?.speakerInstructions || '',
      totalSandwichCount: totalCount,
      estimatedSandwichCountMin: (eventRequest as any)?.estimatedSandwichCountMin || 0,
      estimatedSandwichCountMax: (eventRequest as any)?.estimatedSandwichCountMax || 0,
      rangeSandwichType: (eventRequest as any)?.estimatedSandwichRangeType || '',
      volunteerCount: (eventRequest as any)?.volunteerCount || 0,
      estimatedAttendance: (eventRequest as any)?.estimatedAttendance || 0,
      adultCount: (eventRequest as any)?.adultCount || 0,
      childrenCount: (eventRequest as any)?.childrenCount || 0,
      firstName: eventRequest?.firstName || '',
      lastName: eventRequest?.lastName || '',
      email: eventRequest?.email || '',
      phone: eventRequest?.phone || '',
      organizationName: eventRequest?.organizationName || '',
      department: eventRequest?.department || '',
      organizationCategory: (eventRequest as any)?.organizationCategory || '',
      schoolClassification: (eventRequest as any)?.schoolClassification || '',
      backupContactFirstName: (eventRequest as any)?.backupContactFirstName || '',
      backupContactLastName: (eventRequest as any)?.backupContactLastName || '',
      backupContactEmail: (eventRequest as any)?.backupContactEmail || '',
      backupContactPhone: (eventRequest as any)?.backupContactPhone || '',
      backupContactRole: (eventRequest as any)?.backupContactRole || '',
      previouslyHosted: (eventRequest as any)?.previouslyHosted || 'i_dont_know',
      speakerAudienceType: (eventRequest as any)?.speakerAudienceType || '',
      speakerDuration: (eventRequest as any)?.speakerDuration || '',
      deliveryTimeWindow: (eventRequest as any)?.deliveryTimeWindow || '',
      deliveryParkingAccess: (eventRequest as any)?.deliveryParkingAccess || '',
      assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
      isDhlVan: (eventRequest as any)?.isDhlVan || false,
      status: eventRequest?.status || 'new',
      toolkitSent: eventRequest?.toolkitSent || false,
      toolkitSentDate: eventRequest?.toolkitSentDate ? formatDateForInput(eventRequest.toolkitSentDate) : '',
      toolkitStatus: eventRequest?.toolkitStatus || 'not_sent',
      isCorporatePriority: (eventRequest as any)?.isCorporatePriority || false,
      standbyExpectedDate: (eventRequest as any)?.standbyExpectedDate ? formatDateForInput((eventRequest as any).standbyExpectedDate) : '',
      socialMediaPostRequested: (eventRequest as any)?.socialMediaPostRequested || false,
      socialMediaPostRequestedDate: (eventRequest as any)?.socialMediaPostRequestedDate ? formatDateForInput((eventRequest as any).socialMediaPostRequestedDate) : '',
      socialMediaPostCompleted: (eventRequest as any)?.socialMediaPostCompleted || false,
      socialMediaPostCompletedDate: (eventRequest as any)?.socialMediaPostCompletedDate ? formatDateForInput((eventRequest as any).socialMediaPostCompletedDate) : '',
      socialMediaPostNotes: (eventRequest as any)?.socialMediaPostNotes || '',
      actualSandwichCount: (eventRequest as any)?.actualSandwichCount || 0,
      actualSandwichTypes: existingActualSandwichTypes,
      actualSandwichCountRecordedDate: (eventRequest as any)?.actualSandwichCountRecordedDate ? formatDateForInput((eventRequest as any).actualSandwichCountRecordedDate) : '',
      actualSandwichCountRecordedBy: (eventRequest as any)?.actualSandwichCountRecordedBy || '',
      followUpOneDayCompleted: (eventRequest as any)?.followUpOneDayCompleted || false,
      followUpOneDayDate: (eventRequest as any)?.followUpOneDayDate ? formatDateForInput((eventRequest as any).followUpOneDayDate) : '',
      followUpOneMonthCompleted: (eventRequest as any)?.followUpOneMonthCompleted || false,
      followUpOneMonthDate: (eventRequest as any)?.followUpOneMonthDate ? formatDateForInput((eventRequest as any).followUpOneMonthDate) : '',
      followUpNotes: (eventRequest as any)?.followUpNotes || '',
      assignedRecipientIds: parsePostgresArray((eventRequest as any)?.assignedRecipientIds),
    });
    
    setSandwichMode(hasTypesData ? 'types' : hasRangeData ? 'range' : 'total');
    setActualSandwichMode(hasActualTypesData ? 'types' : 'total');
    const hasAttendeeBreakdown = ((eventRequest as any)?.adultCount || 0) > 0 || ((eventRequest as any)?.childrenCount || 0) > 0;
    setAttendeeMode(hasAttendeeBreakdown ? 'breakdown' : 'total');
    setShowCompletedDetails(eventRequest?.status === 'completed');
    
    // Update originalFormDataRef to match server data for proper change detection
    originalFormDataRef.current = {
      eventDate: formatDateForInput(eventRequest.desiredEventDate),
      backupDates: (eventRequest as any)?.backupDates?.map((d: string) => formatDateForInput(d)) || [],
      eventStartTime: eventRequest?.eventStartTime || '',
      eventEndTime: eventRequest?.eventEndTime || '',
      pickupTime: eventRequest?.pickupTime || '',
      pickupDateTime: getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate)),
      pickupDate: (() => {
        const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
        return pickupDT ? pickupDT.split('T')[0] : '';
      })(),
      pickupTimeSeparate: (() => {
        const pickupDT = getPickupDateTimeForInput((eventRequest as any)?.pickupDateTime, eventRequest?.pickupTime, formatDateForInput(eventRequest?.desiredEventDate));
        return pickupDT ? pickupDT.split('T')[1]?.substring(0, 5) : '';
      })(),
      eventAddress: eventRequest?.eventAddress || '',
      deliveryDestination: eventRequest?.deliveryDestination || '',
      holdingOvernight: !!(eventRequest?.overnightHoldingLocation),
      overnightHoldingLocation: eventRequest?.overnightHoldingLocation || '',
      overnightPickupTime: eventRequest?.overnightPickupTime || '',
      sandwichTypes: existingSandwichTypes,
      hasRefrigeration: eventRequest?.hasRefrigeration?.toString() || '',
      driversNeeded: eventRequest?.driversNeeded || 0,
      selfTransport: eventRequest?.selfTransport || false,
      vanDriverNeeded: eventRequest?.vanDriverNeeded || false,
      speakersNeeded: eventRequest?.speakersNeeded || 0,
      volunteersNeeded: eventRequest?.volunteersNeeded || 0,
      tspContact: eventRequest?.tspContact || '',
      customTspContact: (eventRequest as any)?.customTspContact || '',
      message: (eventRequest as any)?.message || '',
      schedulingNotes: (eventRequest as any)?.schedulingNotes || '',
      planningNotes: (eventRequest as any)?.planningNotes || '',
      nextAction: (eventRequest as any)?.nextAction || '',
      driverInstructions: (eventRequest as any)?.driverInstructions || '',
      volunteerInstructions: (eventRequest as any)?.volunteerInstructions || '',
      speakerInstructions: (eventRequest as any)?.speakerInstructions || '',
      totalSandwichCount: totalCount,
      estimatedSandwichCountMin: (eventRequest as any)?.estimatedSandwichCountMin || 0,
      estimatedSandwichCountMax: (eventRequest as any)?.estimatedSandwichCountMax || 0,
      rangeSandwichType: (eventRequest as any)?.estimatedSandwichRangeType || '',
      volunteerCount: (eventRequest as any)?.volunteerCount || 0,
      estimatedAttendance: (eventRequest as any)?.estimatedAttendance || 0,
      adultCount: (eventRequest as any)?.adultCount || 0,
      childrenCount: (eventRequest as any)?.childrenCount || 0,
      firstName: eventRequest?.firstName || '',
      lastName: eventRequest?.lastName || '',
      email: eventRequest?.email || '',
      phone: eventRequest?.phone || '',
      organizationName: eventRequest?.organizationName || '',
      department: eventRequest?.department || '',
      organizationCategory: (eventRequest as any)?.organizationCategory || '',
      schoolClassification: (eventRequest as any)?.schoolClassification || '',
      backupContactFirstName: (eventRequest as any)?.backupContactFirstName || '',
      backupContactLastName: (eventRequest as any)?.backupContactLastName || '',
      backupContactEmail: (eventRequest as any)?.backupContactEmail || '',
      backupContactPhone: (eventRequest as any)?.backupContactPhone || '',
      backupContactRole: (eventRequest as any)?.backupContactRole || '',
      previouslyHosted: (eventRequest as any)?.previouslyHosted || 'i_dont_know',
      speakerAudienceType: (eventRequest as any)?.speakerAudienceType || '',
      speakerDuration: (eventRequest as any)?.speakerDuration || '',
      deliveryTimeWindow: (eventRequest as any)?.deliveryTimeWindow || '',
      deliveryParkingAccess: (eventRequest as any)?.deliveryParkingAccess || '',
      assignedVanDriverId: eventRequest?.assignedVanDriverId || '',
      isDhlVan: (eventRequest as any)?.isDhlVan || false,
      status: eventRequest?.status || 'new',
      toolkitSent: eventRequest?.toolkitSent || false,
      toolkitSentDate: eventRequest?.toolkitSentDate ? formatDateForInput(eventRequest.toolkitSentDate) : '',
      toolkitStatus: eventRequest?.toolkitStatus || 'not_sent',
      isCorporatePriority: (eventRequest as any)?.isCorporatePriority || false,
      standbyExpectedDate: (eventRequest as any)?.standbyExpectedDate ? formatDateForInput((eventRequest as any).standbyExpectedDate) : '',
      socialMediaPostRequested: (eventRequest as any)?.socialMediaPostRequested || false,
      socialMediaPostRequestedDate: (eventRequest as any)?.socialMediaPostRequestedDate ? formatDateForInput((eventRequest as any).socialMediaPostRequestedDate) : '',
      socialMediaPostCompleted: (eventRequest as any)?.socialMediaPostCompleted || false,
      socialMediaPostCompletedDate: (eventRequest as any)?.socialMediaPostCompletedDate ? formatDateForInput((eventRequest as any).socialMediaPostCompletedDate) : '',
      socialMediaPostNotes: (eventRequest as any)?.socialMediaPostNotes || '',
      actualSandwichCount: (eventRequest as any)?.actualSandwichCount || 0,
      actualSandwichTypes: existingActualSandwichTypes,
      actualSandwichCountRecordedDate: (eventRequest as any)?.actualSandwichCountRecordedDate ? formatDateForInput((eventRequest as any).actualSandwichCountRecordedDate) : '',
      actualSandwichCountRecordedBy: (eventRequest as any)?.actualSandwichCountRecordedBy || '',
      followUpOneDayCompleted: (eventRequest as any)?.followUpOneDayCompleted || false,
      followUpOneDayDate: (eventRequest as any)?.followUpOneDayDate ? formatDateForInput((eventRequest as any).followUpOneDayDate) : '',
      followUpOneMonthCompleted: (eventRequest as any)?.followUpOneMonthCompleted || false,
      followUpOneMonthDate: (eventRequest as any)?.followUpOneMonthDate ? formatDateForInput((eventRequest as any).followUpOneMonthDate) : '',
      followUpNotes: (eventRequest as any)?.followUpNotes || '',
      assignedRecipientIds: parsePostgresArray((eventRequest as any)?.assignedRecipientIds),
    };
    
    // Ensure form remains initialized for auto-save to continue working
    setFormInitialized(true);
    
    toast({
      title: 'Changes discarded',
      description: 'Form has been reset to the last saved version.',
    });
  }, [eventRequest, clearAutoSave, toast]);

  // Auto-save effect - debounce saves to localStorage when form data changes
  useEffect(() => {
    // CRITICAL: Don't auto-save if we're submitting or dialog is closed
    if (!dialogOpen || !formInitialized || isSubmitting) return;

    // Clear any pending save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Debounce save - wait 1 second after last change
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Double-check we're still not submitting when timeout fires
      if (!isSubmitting) {
        saveToLocalStorage();
      }
    }, 1000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [dialogOpen, formInitialized, formData, sandwichMode, actualSandwichMode, attendeeMode, saveToLocalStorage, isSubmitting]);

  // Initialize collaboration hook only for existing events (not in create mode)
  // Pass null for new events - the hook safely handles this by disabling collaboration features
  const collaboration = useEventCollaboration(eventRequest?.id ?? null);
  const isCollaborationEnabled = eventRequest && eventRequest.id;

  // Fetch users for TSP contact selection
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 10 * 60 * 1000,
  });

  // Fetch van-approved drivers
  const { data: vanDrivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
    select: (drivers) => drivers.filter(driver => driver.vanApproved),
    staleTime: 10 * 60 * 1000,
  });

  // Helper function to format date for input (YYYY-MM-DD format to avoid timezone issues)
  const formatDateForInput = (date: any) => {
    if (!date) return '';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Helper function to serialize date for backend
  // Send bare YYYY-MM-DD so parseDateOnly uses its safe local-noon path
  // (appending T00:00:00.000Z would hit the unsafe UTC path and shift dates near timezone boundaries)
  const serializeDateToISO = (dateString: string) => {
    if (!dateString) return null;
    // Extract just the YYYY-MM-DD portion in case it already has a time component
    const dateOnly = dateString.split('T')[0];
    return dateOnly;
  };

  // Initialize form with existing data when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      // CRITICAL: Reset formInitialized immediately when starting to load new data
      // This prevents race condition when switching between events while dialog stays mounted
      setFormInitialized(false);
      setHasRecoveredData(false);
      
      // Use local variable since state update is async
      let recoveredFromStorage = false;
      // Track merged original data for intelligent merge recovery
      let mergedOriginalFormDataRef: Record<string, any> | null = null;

      // Check for auto-saved data first (unless explicitly skipping recovery)
      const shouldSkipRecovery = skipRecoveryRef.current;
      skipRecoveryRef.current = false; // Reset the flag
      
      try {
        const savedDataStr = !shouldSkipRecovery ? localStorage.getItem(getAutoSaveKey()) : null;
        if (savedDataStr) {
          const savedData = JSON.parse(savedDataStr);
          // Verify saved data is for this event (or both are new events)
          const savedEventId = savedData.eventId;
          const currentEventId = eventRequest?.id || null;

          if (savedEventId === currentEventId) {
            // Check if saved data is less than 24 hours old
            const savedAt = new Date(savedData.savedAt);
            const now = new Date();
            const hoursSinceSave = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);

            // CRITICAL FIX: Check if the saved status differs from the server status
            // If the status has changed on the server (e.g., event was scheduled successfully),
            // discard the stale auto-save data to prevent showing outdated status
            const savedStatus = savedData.formData?.status;
            const serverStatus = eventRequest?.status;
            const statusMismatch = savedStatus && serverStatus && savedStatus !== serverStatus;

            if (statusMismatch) {
              // Status changed on server - discard stale auto-save
              logger.log('🗑️ Auto-save status mismatch - discarding stale data', {
                savedStatus,
                serverStatus,
                eventId: currentEventId,
              });
              clearAutoSave();
            } else if (hoursSinceSave < 24) {
              // INTELLIGENT MERGE: Combine cached user changes with server updates
              // Build current server data
              const currentServerData = buildFormDataFromEventRequest(
                eventRequest,
                formatDateForInput,
                getPickupDateTimeForInput,
                parsePostgresArray
              );

              // Perform intelligent merge
              const { mergedData, conflicts, serverUpdates, userChangesPreserved } = intelligentMergeFormData(
                savedData.formData,
                savedData.originalServerData, // May be undefined for old cache format
                currentServerData
              );

              // Apply merged data
              setFormData(mergedData as any);
              if (savedData.sandwichMode) setSandwichMode(savedData.sandwichMode);
              if (savedData.actualSandwichMode) setActualSandwichMode(savedData.actualSandwichMode);
              if (savedData.attendeeMode) setAttendeeMode(savedData.attendeeMode);
              setHasRecoveredData(true);
              recoveredFromStorage = true;

              // Also update originalFormDataRef to the merged result
              // This ensures hasChanged() compares against the correct baseline
              mergedOriginalFormDataRef = mergedData;

              // Auto-expand completed details if needed
              setShowCompletedDetails(mergedData.status === 'completed');

              // Show appropriate toast notification based on merge results
              if (conflicts.length > 0) {
                toast({
                  title: '⚠️ Changes merged with conflicts',
                  description: `Your changes were recovered, but ${conflicts.length} field(s) were updated by others and will use the server values: ${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''}`,
                  duration: 10000,
                });
              } else if (serverUpdates.length > 0 && userChangesPreserved.length > 0) {
                toast({
                  title: '✓ Changes merged successfully',
                  description: `Your ${userChangesPreserved.length} unsaved change(s) were preserved, and ${serverUpdates.length} server update(s) were applied.`,
                  duration: 6000,
                });
              } else if (userChangesPreserved.length > 0) {
                toast({
                  title: 'Form data recovered',
                  description: 'Your unsaved changes have been restored. Click "Discard" to start fresh.',
                });
              }

              logger.log('📋 Intelligent merge complete', {
                userChangesPreserved: userChangesPreserved.length,
                serverUpdates: serverUpdates.length,
                conflicts: conflicts.length,
              });

              // Mark form as initialized after recovery - originalFormDataRef is set below
              // via the mergedOriginalFormDataRef path, so it's safe to set this here.
            } else {
              // Clear old auto-save data
              clearAutoSave();
            }
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
      
      // Parse sandwich types from server for originalFormDataRef
      const existingSandwichTypes = eventRequest?.sandwichTypes ? 
        (typeof eventRequest?.sandwichTypes === 'string' ? 
          JSON.parse(eventRequest.sandwichTypes) : eventRequest?.sandwichTypes) : [];
      const hasTypesData = Array.isArray(existingSandwichTypes) && existingSandwichTypes.length > 0;
      const hasRangeData = (eventRequest as any)?.estimatedSandwichCountMin && (eventRequest as any)?.estimatedSandwichCountMax;
      const totalCount = eventRequest?.estimatedSandwichCount || 0;
      const existingActualSandwichTypes = eventRequest?.actualSandwichTypes ? 
        (typeof eventRequest?.actualSandwichTypes === 'string' ? 
          JSON.parse(eventRequest.actualSandwichTypes) : eventRequest?.actualSandwichTypes) : [];
      const hasActualTypesData = Array.isArray(existingActualSandwichTypes) && existingActualSandwichTypes.length > 0;
      
      // If no recovered data, populate from eventRequest using the helper function
      if (!recoveredFromStorage) {
        const serverFormData = buildFormDataFromEventRequest(
          eventRequest,
          formatDateForInput,
          getPickupDateTimeForInput,
          parsePostgresArray
        );
        setFormData(serverFormData as any);

        // Set mode based on existing data
        setSandwichMode(hasTypesData ? 'types' : hasRangeData ? 'range' : 'total');
        setActualSandwichMode(hasActualTypesData ? 'types' : 'total');

        // Set attendee mode based on whether adult/children breakdown exists
        const hasAttendeeBreakdown = ((eventRequest as any)?.adultCount || 0) > 0 || ((eventRequest as any)?.childrenCount || 0) > 0;
        setAttendeeMode(hasAttendeeBreakdown ? 'breakdown' : 'total');

        // Auto-expand Completed Event Details section if event is completed
        setShowCompletedDetails(eventRequest?.status === 'completed');
      }
      
      // Store original form data to detect changes later (preserve existing data)
      // CRITICAL FIX: When we recovered from localStorage with intelligent merge,
      // use the merged data as the baseline for change detection.
      // Otherwise, use fresh server data.
      //
      // NOTE: originalFormDataRef is a ref (not state), so it updates synchronously.
      // We set it BEFORE setFormInitialized(true) to ensure the form submission
      // handler always sees a valid originalFormDataRef when formInitialized is true.
      // React 18 auto-batches state updates, so the formData + formInitialized
      // updates are applied together in the same render.
      if (mergedOriginalFormDataRef) {
        // Use the merged data as baseline - this ensures hasChanged() compares
        // against what the user is actually seeing in the form
        originalFormDataRef.current = mergedOriginalFormDataRef as typeof formData;
        logger.log('📋 Using merged data as originalFormDataRef baseline');
      } else {
        // No merge happened - use fresh server data
        originalFormDataRef.current = buildFormDataFromEventRequest(
          eventRequest,
          formatDateForInput,
          getPickupDateTimeForInput,
          parsePostgresArray
        ) as typeof formData;
      }
      // Mark form as initialized AFTER original data is stored
      // This prevents race condition where form submits before useEffect populates data
      setFormInitialized(true);
    } else {
      // Dialog closed - reset initialization state
      setFormInitialized(false);
    }
  }, [isVisible, isOpen, eventRequest, mode, getAutoSaveKey, clearAutoSave, toast]);

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      // Include optimistic locking version to detect concurrent edits
      const payload = { ...data };
      if (eventRequest?.updatedAt) {
        payload._expectedVersion = eventRequest.updatedAt;
      }
      return apiRequest('PATCH', `/api/event-requests/${id}`, payload);
    },
    // Allow React Query to retry transient failures (uses global mutation retry config)
    networkMode: 'always',
    onSuccess: async (updatedEvent: any) => {
      // Reset submitting flag
      setIsSubmitting(false);

      logger.log('✅ UPDATE MUTATION SUCCESS', {
        eventId: updatedEvent?.id,
        oldStatus: eventRequest?.status,
        newStatus: updatedEvent?.status,
        mode,
      });

      // CRITICAL: Verify the status actually changed in the response
      if (mode === 'schedule' && updatedEvent?.status !== 'scheduled') {
        logger.error('❌ STATUS UPDATE FAILED!', {
          expectedStatus: 'scheduled',
          actualStatus: updatedEvent?.status,
          eventId: updatedEvent?.id,
          updatedEvent,
        });
        toast({
          title: 'Warning',
          description: `Event status may not have updated correctly. Expected 'scheduled' but got '${updatedEvent?.status}'. Please refresh and check.`,
          variant: 'destructive',
          duration: 10000,
        });
      } else if (mode === 'schedule') {
        logger.info('✅ Status update confirmed in response:', updatedEvent?.status);
      }

      // Clear auto-saved data on successful submission
      clearAutoSave();
      setHasRecoveredData(false);

      const isEditMode = mode === 'edit';
      const orgName = eventRequest?.organizationName || formData.organizationName || 'Event';
      toast({
        title: isEditMode ? '✓ Changes Saved Successfully' : '✓ Event Scheduled Successfully',
        description: isEditMode
          ? `Your changes to "${orgName}" have been saved to the database.`
          : `"${orgName}" has been scheduled and saved.`,
        duration: 8000,
      });
      // Await invalidation so the list reflects the saved changes before dialog closes
      logger.log('🔄 Invalidating event request queries...');
      await invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: (error: any) => {
      // Reset submitting flag
      setIsSubmitting(false);

      logger.error('Update event request error:', error);

      // Extract detailed error message from ApiError
      const serverMessage = error?.data?.message || error?.message;

      // Check for specific error types
      const isNotFound = error?.status === 404 ||
                        serverMessage?.includes('not found');

      const isConflict = error?.status === 409 ||
                        error?.code?.includes('CONFLICT');

      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');

      const isEditMode = mode === 'edit';
      const orgName = eventRequest?.organizationName || formData.organizationName || 'this event';

      let errorTitle = 'Save Failed';
      let errorDescription = isEditMode ? 'Failed to update event.' : 'Failed to schedule event.';

      if (isConflict) {
        errorTitle = 'Edit Conflict';
        // Force an immediate local save so the user's changes are preserved
        saveToLocalStorage();
        errorDescription = 'This event was modified by another user while you were editing. Please close the form and reopen it to see the latest data. Your changes have been saved locally and will be recovered when you reopen.';
        // Refresh the data so the list shows the latest version
        invalidateEventRequestQueries(queryClient);
      } else if (isNotFound) {
        errorTitle = 'Event Not Found';
        errorDescription = 'The event request was not found. It may have been deleted. Please refresh the page and try again.';
      } else if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = `Could not save changes to "${orgName}". Please check your internet connection and try again. Your changes are saved locally and can be recovered.`;
      } else if (serverMessage) {
        errorDescription = serverMessage;
      } else {
        errorDescription = `Failed to save changes to "${orgName}". Please try again. If the problem persists, your changes are saved locally.`;
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  const createEventRequestMutation = useMutation({
    mutationFn: (data: any) => {
      logger.log('🚀 CREATE MUTATION: Sending data:', data);
      return apiRequest('POST', '/api/event-requests', data);
    },
    networkMode: 'always',
    onSuccess: async (response) => {
      logger.log('✅ CREATE MUTATION SUCCESS: Response:', response);
      // Clear auto-saved data on successful submission
      clearAutoSave();
      setHasRecoveredData(false);

      const orgName = formData.organizationName || 'New event';
      toast({
        title: '✓ Event Created Successfully',
        description: `"${orgName}" has been created and saved to the database.`,
        duration: 8000,
      });
      // Await invalidation so the list shows the new event before dialog closes
      await invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: (error: any) => {
      logger.error('❌ CREATE MUTATION ERROR:', error);

      const serverMessage = error?.data?.message || error?.message;

      // Check for network/timeout errors
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');

      const orgName = formData.organizationName || 'this event';

      let errorTitle = 'Creation Failed';
      let errorDescription = serverMessage || `Failed to create "${orgName}". Please try again.`;
      
      if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = `Could not create "${orgName}". Please check your internet connection and try again. Your form data is saved locally.`;
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: () => {
      toast({
        title: 'Event deleted successfully',
        description: 'The event request has been deleted.',
      });
      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
      onSuccessCallback();
      onClose();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete event.',
        variant: 'destructive',
      });
    },
  });

  // Helper to check if event likely needs van based on user's criteria
  const eventLikelyNeedsVan = (): boolean => {
    // Check if van driver is explicitly needed
    if ((formData.vanDriverNeeded || formData.isDhlVan) && !formData.selfTransport) return true;

    // Check if sandwich count > 500 (implies van needed)
    const sandwichCount = sandwichMode === 'total'
      ? formData.totalSandwichCount
      : sandwichMode === 'range'
        ? (formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0)
        : formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
    if (sandwichCount > 500) return true;
    const notes = `${formData.schedulingNotes || ''} ${formData.planningNotes || ''}`.toLowerCase();
    if (/\bvan\b/.test(notes) && !notes.includes('van-approved') && !notes.includes('van approved')) {
      return true;
    }

    return false;
  };

  // Check for van conflicts before submission
  const checkVanConflicts = async (): Promise<boolean> => {
    if (!formData.eventDate || !eventLikelyNeedsVan()) return true; // No check needed
    
    try {
      const response = await fetch(`/api/event-requests/conflicts-for-date?date=${formData.eventDate}`);
      if (!response.ok) return true; // Allow submission if check fails
      
      const data = await response.json();
      
      if (data.vanConflicts && data.vanConflicts.length > 0) {
        // There are van conflicts - show as a toast so it's visible even after form closes
        const conflictingEvents = data.vanConflicts.flatMap((c: any) => [
          { id: c.event1?.id, name: c.event1?.organizationName, time: c.event1?.eventStartTime },
          { id: c.event2?.id, name: c.event2?.organizationName, time: c.event2?.eventStartTime },
        ]).filter((e: any) => e.id !== eventRequest?.id);
        
        // Remove duplicates
        const uniqueEvents = Array.from(new Map(conflictingEvents.map((e: any) => [e.id, e])).values());
        
        if (uniqueEvents.length > 0) {
          const conflictNames = uniqueEvents
            .map((e: any) => e.name + (e.time ? ` at ${e.time}` : ''))
            .join(', ');
          toast({
            title: 'Van Availability Notice',
            description: `The van may already be assigned to: ${conflictNames}. Please verify van availability when coordinating logistics.`,
            duration: 12000,
          });
          return false;
        }
      }
      
      return true; // No conflicts, proceed
    } catch (error) {
      console.error('Error checking van conflicts:', error);
      return true; // Allow submission if check fails
    }
  };

  const performSubmit = async (skipSpeakerWarning = false, fieldOverrides?: Record<string, any>) => {
    // CRITICAL: Set submitting flag to prevent auto-save from running
    setIsSubmitting(true);
    // Also clear any pending auto-save immediately
    clearAutoSave();

    // DEBUG: Direct console.log for production debugging
    console.log('🚀 [PROD DEBUG] PERFORM SUBMIT CALLED', {
      eventRequestId: eventRequest?.id,
      mode,
      formInitialized,
    });

    logger.log('🚀 PERFORM SUBMIT CALLED', {
      eventRequestId: eventRequest?.id,
      mode,
      formInitialized,
      skipSpeakerWarning,
      eventRequestExists: !!eventRequest,
    });

    // CRITICAL: Prevent submission if form is not initialized
    // This prevents race condition where form submits with empty default values
    // before useEffect populates data from eventRequest
    if (eventRequest && !formInitialized) {
      console.error('❌ [PROD DEBUG] Form submission blocked: form not initialized');
      logger.error('❌ Form submission blocked: form not initialized yet', {
        eventRequestId: eventRequest.id,
        formInitialized,
      });
      setIsSubmitting(false); // Reset flag since we're returning early
      toast({
        title: 'Please wait',
        description: 'Form is still loading. Please try again in a moment.',
        variant: 'destructive',
      });
      return;
    }

    console.log('✅ [PROD DEBUG] Form initialized check passed');
    logger.log('✅ Form initialized check passed');
    
    // Warning: Events with >500 sandwiches usually need a speaker
    let totalRelevantSandwiches = 0;
    
    // Check sandwich types mode
    if (sandwichMode === 'types' && formData.sandwichTypes && formData.sandwichTypes.length > 0) {
      totalRelevantSandwiches = formData.sandwichTypes
        .filter((item: { type: string; quantity: number }) => {
          const typeLower = item.type.toLowerCase();
          // Check for deli (includes deli_turkey, deli_ham, etc.), turkey (standalone), or unknown
          return (
            typeLower === 'deli' ||
            typeLower.includes('deli') ||
            typeLower === 'turkey' ||
            typeLower === 'deli_turkey' ||
            typeLower === 'unknown'
          );
        })
        .reduce((sum: number, item: { type: string; quantity: number }) => sum + item.quantity, 0);
    } else if (sandwichMode === 'total' && formData.totalSandwichCount > 500) {
      // If using total mode and >500, we can't determine types, so check if speakers are needed
      // This is a conservative check - we'll warn if total >500
      totalRelevantSandwiches = formData.totalSandwichCount;
    } else if (sandwichMode === 'range') {
      // For range mode, check the max value
      const maxCount = formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0;
      if (maxCount > 500) {
        // Can't determine types in range mode, so conservatively warn if max >500
        totalRelevantSandwiches = maxCount;
      }
    }
    
    // Show warning dialog if event has >500 sandwiches and no speakers, but allow proceeding
    if (!skipSpeakerWarning && totalRelevantSandwiches > 500 && formData.speakersNeeded < 1) {
      logger.log('⚠️ Speaker warning dialog triggered', {
        totalRelevantSandwiches,
        speakersNeeded: formData.speakersNeeded,
      });
      setShowSpeakerWarningDialog(true);
      return; // Stop submission until user responds
    }
    
    logger.log('✅ Speaker warning check passed');

    // Require manual entry source for new event creation
    if (isCreateMode && !formData.manualEntrySource) {
      alert('Please select where this request came from before submitting.');
      setIsSubmitting(false);
      // Auto-expand contact section so the field is visible
      setShowContactInfo(true);
      return;
    }

    // Construct data explicitly without client-only fields
    const eventData: any = {
      // Only change status to 'scheduled' when in schedule mode (for updates)
      ...(eventRequest && mode === 'schedule' ? { status: 'scheduled' } : {}),
      // For new events (create mode), use the status from form data
      ...(!eventRequest ? { status: formData.status || 'new' } : {}),
      // For edit mode, include the status from form data (with fallback to prevent empty status)
      ...(eventRequest && mode === 'edit' ? { status: formData.status || eventRequest.status || 'new' } : {}),
      // Serialize date properly to avoid timezone issues
      desiredEventDate: serializeDateToISO(formData.eventDate),
      dateFlexible: formData.dateFlexible, // null = unknown, true = flexible, false = fixed
      backupDates: formData.backupDates.filter(d => d).map(d => serializeDateToISO(d)),
      // If status is scheduled, also set scheduledEventDate
      ...(formData.status === 'scheduled' ? { scheduledEventDate: serializeDateToISO(formData.eventDate) } : {}),
      eventStartTime: formData.eventStartTime || null,
      eventEndTime: formData.eventEndTime || null,
      pickupTime: formData.pickupTime || null,
      pickupDateTime: (() => {
        // Combine pickupDate and pickupTimeSeparate into pickupDateTime if both are set
        if (formData.pickupDate && formData.pickupTimeSeparate) {
          return `${formData.pickupDate}T${formData.pickupTimeSeparate}`;
        }
        // Otherwise use the existing pickupDateTime value
        return formData.pickupDateTime || null;
      })(),
      eventAddress: formData.eventAddress || null,
      deliveryDestination: formData.deliveryDestination || null,
      overnightHoldingLocation: formData.overnightHoldingLocation || null,
      overnightPickupTime: formData.overnightPickupTime || null,
      hasRefrigeration: formData.hasRefrigeration === 'true' ? true :
                        formData.hasRefrigeration === 'false' ? false : null,
      driversNeeded: formData.selfTransport ? 0 : (parseInt(formData.driversNeeded?.toString() || '0') || 0),
      selfTransport: formData.selfTransport || false,
      vanDriverNeeded: formData.selfTransport ? false : ((formData.vanDriverNeeded || false) || formData.isDhlVan),
      speakersNeeded: parseInt(formData.speakersNeeded?.toString() || '0') || 0,
      volunteersNeeded: parseInt(formData.volunteersNeeded?.toString() || '0') || 0,
      estimatedAttendance: parseInt(formData.estimatedAttendance?.toString() || '0') || null,
      tspContact: formData.tspContact || null,
      customTspContact: formData.customTspContact?.trim() || null,
      message: formData.message || null,
      schedulingNotes: formData.schedulingNotes || null,
      planningNotes: formData.planningNotes || null,
      nextAction: formData.nextAction || null,
      // Volunteer/Driver/Speaker instructions (included in reminder notifications)
      driverInstructions: formData.driverInstructions || null,
      volunteerInstructions: formData.volunteerInstructions || null,
      speakerInstructions: formData.speakerInstructions || null,
      // Manual entry source tracking
      manualEntrySource: formData.manualEntrySource || null,
      // Contact information fields
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      email: formData.email || null,
      phone: formData.phone || null,
      organizationName: formData.organizationName || null,
      department: formData.department || null,
      organizationCategory: formData.organizationCategory || null,
      schoolClassification: formData.schoolClassification || null,
      // Backup contact fields
      backupContactFirstName: formData.backupContactFirstName || null,
      backupContactLastName: formData.backupContactLastName || null,
      backupContactEmail: formData.backupContactEmail || null,
      backupContactPhone: formData.backupContactPhone || null,
      backupContactRole: formData.backupContactRole || null,
      // Previously hosted flag
      previouslyHosted: formData.previouslyHosted || null,
      // Speaker details
      speakerAudienceType: formData.speakerAudienceType || null,
      speakerDuration: formData.speakerDuration || null,
      // Delivery details for overnight holding
      deliveryTimeWindow: formData.deliveryTimeWindow || null,
      deliveryParkingAccess: formData.deliveryParkingAccess || null,
      // Van driver assignment
      assignedVanDriverId: formData.isDhlVan
        ? null
        : (formData.assignedVanDriverId && formData.assignedVanDriverId !== 'none')
          ? formData.assignedVanDriverId
          : null,
      isDhlVan: formData.selfTransport ? false : !!formData.isDhlVan,
      // Toolkit information
      toolkitSent: formData.toolkitSent || false,
      toolkitStatus: formData.toolkitStatus || null,
      toolkitSentDate: serializeDateToISO(formData.toolkitSentDate),
      // Corporate priority
      isCorporatePriority: formData.isCorporatePriority || false,
      // Standby follow-up date -- use override if provided (from dialog handler
      // where state may not have flushed yet), otherwise read from formData
      standbyExpectedDate: (() => {
        const date = fieldOverrides?.standbyExpectedDate || formData.standbyExpectedDate;
        return formData.status === 'standby' && date
          ? new Date(date).toISOString()
          : null;
      })(),
    };

    // Handle sandwich data based on mode
    if (sandwichMode === 'total') {
      eventData.estimatedSandwichCount = formData.totalSandwichCount;
      eventData.sandwichTypes = null; // Clear specific types when using total mode
      eventData.estimatedSandwichCountMin = null;
      eventData.estimatedSandwichCountMax = null;
    } else if (sandwichMode === 'range') {
      eventData.estimatedSandwichCountMin = formData.estimatedSandwichCountMin || null;
      eventData.estimatedSandwichCountMax = formData.estimatedSandwichCountMax || null;
      eventData.estimatedSandwichRangeType = formData.rangeSandwichType || null;
      eventData.estimatedSandwichCount = null; // Clear exact count when using range
      eventData.sandwichTypes = null;
    } else {
      eventData.sandwichTypes = JSON.stringify(formData.sandwichTypes);
      eventData.estimatedSandwichCount = formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
      eventData.estimatedSandwichCountMin = null;
      eventData.estimatedSandwichCountMax = null;
    }

    // Include volunteer/attendee counts
    eventData.volunteerCount = formData.volunteerCount || 0;
    eventData.adultCount = formData.adultCount || 0;
    eventData.childrenCount = formData.childrenCount || 0;
    eventData.kidsAgeRange = formData.kidsAgeRange || null;

    // Include completed event tracking fields
    eventData.socialMediaPostRequested = formData.socialMediaPostRequested;
    eventData.socialMediaPostRequestedDate = serializeDateToISO(formData.socialMediaPostRequestedDate);
    eventData.socialMediaPostCompleted = formData.socialMediaPostCompleted;
    eventData.socialMediaPostCompletedDate = serializeDateToISO(formData.socialMediaPostCompletedDate);
    eventData.socialMediaPostNotes = formData.socialMediaPostNotes || null;
    
    // Handle actual sandwich data based on mode
    if (actualSandwichMode === 'total') {
      eventData.actualSandwichCount = formData.actualSandwichCount;
      eventData.actualSandwichTypes = null;
    } else {
      eventData.actualSandwichTypes = JSON.stringify(formData.actualSandwichTypes);
      eventData.actualSandwichCount = formData.actualSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
    }
    eventData.actualSandwichCountRecordedDate = serializeDateToISO(formData.actualSandwichCountRecordedDate);
    eventData.actualSandwichCountRecordedBy = formData.actualSandwichCountRecordedBy || null;
    
    eventData.followUpOneDayCompleted = formData.followUpOneDayCompleted;
    eventData.followUpOneDayDate = serializeDateToISO(formData.followUpOneDayDate);
    eventData.followUpOneMonthCompleted = formData.followUpOneMonthCompleted;
    eventData.followUpOneMonthDate = serializeDateToISO(formData.followUpOneMonthDate);
    eventData.followUpNotes = formData.followUpNotes || null;
    
    // Include assigned recipient IDs
    eventData.assignedRecipientIds = formData.assignedRecipientIds || [];

    logger.log('📋 FORM SUBMIT DEBUG:');
    logger.log('  - eventRequest exists?', !!eventRequest);
    logger.log('  - eventRequest.id:', eventRequest?.id);
    logger.log('  - mode:', mode);
    logger.log('  - isCreateMode:', isCreateMode);
    logger.log('  - eventData being sent:', eventData);

    if (eventRequest) {
      if (!eventRequest.id) {
        logger.error('❌ Event request object exists but has no ID');
        toast({
          title: 'Error',
          description: 'Event request ID is missing. Please refresh the page and try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      
      // CRITICAL: Only send fields that have actually changed from original values
      // This prevents overwriting existing data with null/empty values when user
      // only modified a few fields (e.g., just changing status)
      const filteredEventData: any = {};
      const original = originalFormDataRef.current;

      // Safety check: ensure originalFormDataRef was properly initialized
      // This should never happen if formInitialized check passed, but adds defense-in-depth
      if (!original) {
        logger.error('❌ originalFormDataRef.current is null - this indicates a race condition');
        toast({
          title: 'Please wait',
          description: 'Form is still initializing. Please try again.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
      
      // Status change always needs to be sent (core operation)
      if (eventData.status !== undefined) {
        filteredEventData.status = eventData.status;
      }
      
      // For schedule mode, always send scheduledEventDate when it exists
      if (mode === 'schedule' && eventData.scheduledEventDate !== undefined) {
        filteredEventData.scheduledEventDate = eventData.scheduledEventDate;
      }
      
      // Helper to normalize date strings for comparison
      // originalFormDataRef stores YYYY-MM-DD but eventData has ISO format
      const normalizeDateForCompare = (value: any): string | null => {
        if (!value) return null;
        if (typeof value !== 'string') return String(value);
        // Extract YYYY-MM-DD from ISO string or use as-is
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : value;
      };
      
      // Helper to check if a value has meaningfully changed
      const hasChanged = (key: string, newValue: any) => {
        if (!original) return true; // No original to compare, send everything
        const originalValue = (original as any)[key];
        
        // Handle array comparison (including date arrays like backupDates)
        if (Array.isArray(newValue) && Array.isArray(originalValue)) {
          // Normalize date strings in arrays before comparison
          const normalizedNew = newValue.map(v => normalizeDateForCompare(v));
          const normalizedOrig = originalValue.map(v => normalizeDateForCompare(v));
          return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOrig);
        }
        
        // Handle date fields specifically - compare normalized dates
        const dateFields = ['desiredEventDate', 'eventDate', 'scheduledEventDate', 'toolkitSentDate',
          'socialMediaPostRequestedDate', 'socialMediaPostCompletedDate', 'actualSandwichCountRecordedDate',
          'followUpOneDayDate', 'followUpOneMonthDate'];
        if (dateFields.includes(key)) {
          return normalizeDateForCompare(newValue) !== normalizeDateForCompare(originalValue);
        }
        
        // Handle null/empty string equivalence (both mean "no value")
        const normalizedNew = newValue === '' || newValue === null ? null : newValue;
        const normalizedOrig = originalValue === '' || originalValue === null ? null : originalValue;
        
        return normalizedNew !== normalizedOrig;
      };
      
      // Include only fields that have actually changed
      Object.keys(eventData).forEach(key => {
        if (key === 'status' || key === 'scheduledEventDate') return; // Already handled
        
        // Map eventData keys to formData keys where they differ
        // CRITICAL: Use centralized field mapping from fieldConfig.ts
        const formDataKey = (FIELD_MAPPINGS.serverToClient as Record<string, string>)[key] || key;
        
        if (hasChanged(formDataKey, eventData[key])) {
          filteredEventData[key] = eventData[key];
        }
      });
      
      logger.log('🔄 Calling UPDATE mutation for event ID:', eventRequest.id);
      logger.log('  - Filtered data (changed fields only):', filteredEventData);
      logger.log('  - Changed fields count:', Object.keys(filteredEventData).length);

      // In edit mode, if no fields changed, notify the user instead of sending an empty update
      if (mode === 'edit' && Object.keys(filteredEventData).length === 0) {
        logger.log('ℹ️ No fields changed in edit mode - nothing to save');
        setIsSubmitting(false);
        toast({
          description: 'No changes detected. Make a change and try saving again.',
        });
        return;
      }

      // CRITICAL: In schedule mode, always ensure status is 'scheduled' and scheduledEventDate is set
      // This prevents cases where the form filters out the status change incorrectly
      if (mode === 'schedule') {
        logger.log('📅 Schedule mode detected - forcing status and date');
        filteredEventData.status = 'scheduled';
        if (eventData.scheduledEventDate) {
          filteredEventData.scheduledEventDate = eventData.scheduledEventDate;
        } else if (eventData.desiredEventDate) {
          // If scheduledEventDate wasn't set but desiredEventDate exists, use it
          filteredEventData.scheduledEventDate = eventData.desiredEventDate;
        }
        logger.log('  - Schedule mode: Forcing status=scheduled and scheduledEventDate:', filteredEventData.scheduledEventDate);
      }
      
      // Ensure we have at least the status change if we're in schedule mode
      if (mode === 'schedule' && Object.keys(filteredEventData).length === 0) {
        logger.error('⚠️ CRITICAL: Filtered data is empty in schedule mode! Adding status anyway.');
        filteredEventData.status = 'scheduled';
        if (eventData.scheduledEventDate || eventData.desiredEventDate) {
          filteredEventData.scheduledEventDate = eventData.scheduledEventDate || eventData.desiredEventDate;
        }
      }
      
      logger.log('🔴 FINAL DATA BEING SENT:', {
        eventId: eventRequest.id,
        mode,
        data: filteredEventData,
        keys: Object.keys(filteredEventData),
        hasStatus: 'status' in filteredEventData,
        statusValue: filteredEventData.status,
      });
      
      // Update existing event request with only changed fields
      try {
        console.log('🔴 [PROD DEBUG] CALLING MUTATION NOW...', {
          id: eventRequest.id,
          status: filteredEventData.status,
          keys: Object.keys(filteredEventData),
        });
        logger.log('🔴 CALLING MUTATION NOW...');
        updateEventRequestMutation.mutate({
          id: eventRequest.id,
          data: filteredEventData,
        });
        console.log('✅ [PROD DEBUG] Mutation called successfully');
        logger.log('✅ Mutation called successfully');
      } catch (error) {
        console.error('❌ [PROD DEBUG] ERROR CALLING MUTATION:', error);
        logger.error('❌ ERROR CALLING MUTATION:', error);
        throw error;
      }
    } else {
      console.log('➕ [PROD DEBUG] Calling CREATE mutation for new event');
      logger.log('➕ Calling CREATE mutation for new event');
      // Create new event request
      createEventRequestMutation.mutate(eventData);
    }
  };

  // Handle status changes that require reason dialogs
  const handleStatusChange = (newStatus: EventStatus) => {
    const oldStatus = eventRequest?.status;
    
    // If changing to cancelled, declined, or postponed, show a warning
    // TODO: Wire these status changes to open the appropriate reason dialog
    // For now, we just warn the user and allow the change through the form
    if (newStatus === 'cancelled' || newStatus === 'declined' || newStatus === 'postponed' || newStatus === 'non_event' || newStatus === 'rescheduled') {
      const statusLabel = STATUS_DEFINITIONS[newStatus]?.label || newStatus;
      toast({
        title: `Status Change Requires Documentation`,
        description: `When saving, please ensure you've documented the reason for changing to ${statusLabel} in the notes field.`,
        duration: 6000,
      });
    }
    
    setFormData(prev => ({ ...prev, status: newStatus }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // DEBUG: Direct console.log for production debugging (logger is disabled in prod)
    console.log('📝 [PROD DEBUG] HANDLE SUBMIT CALLED', {
      eventRequestId: eventRequest?.id,
      mode,
      formDataEventDate: formData.eventDate,
    });

    logger.log('📝 HANDLE SUBMIT CALLED', {
      eventRequestId: eventRequest?.id,
      mode,
      formDataEventDate: formData.eventDate,
      vanConflictChecked,
    });

    // Check for van conflicts if event needs van and hasn't been checked yet
    // NOTE: This is a non-blocking warning — the save always proceeds regardless
    if (eventLikelyNeedsVan() && !vanConflictChecked) {
      console.log('⚠️ [PROD DEBUG] Van conflict check triggered (non-blocking)');
      logger.log('⚠️ Van conflict check triggered (non-blocking)');
      // Run the check in the background — show warning dialog if conflicts found,
      // but do NOT block the save regardless of the result
      checkVanConflicts()
        .then(noConflicts => {
          setVanConflictChecked(true);
          if (!noConflicts) {
            console.log('⚠️ [PROD DEBUG] Van conflicts found - showing informational warning');
            logger.log('⚠️ Van conflicts found - showing informational warning (save still proceeding)');
          }
        })
        .catch((error) => {
          logger.error('Van conflict check failed', { error });
          setVanConflictChecked(true); // Mark as checked even if it failed to avoid re-triggering
          // Don't block save or show error to user since this is non-critical
        });
    }

    // Check if status is changing to standby - prompt for follow-up date
    const originalStatus = eventRequest?.status || 'new';
    const isChangingToStandby = formData.status === 'standby' && originalStatus !== 'standby';
    if (isChangingToStandby && !formData.standbyExpectedDate) {
      console.log('⚠️ [PROD DEBUG] Status changing to standby - showing follow-up dialog');
      logger.log('⚠️ Status changing to standby - showing follow-up dialog');
      // Set default to one week from now
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      setStandbyFollowUpDate(oneWeekFromNow.toISOString().split('T')[0]);
      setStandbyFollowUpMode('one_week');
      setShowStandbyFollowUpDialog(true);
      return; // Wait for user to set follow-up date
    }

    // All checks passed, proceed with submission
    console.log('✅ [PROD DEBUG] All pre-submit checks passed - calling performSubmit');
    logger.log('✅ All pre-submit checks passed - calling performSubmit');
    await performSubmit(false);
  };

  // Note: Sandwich type handlers have been moved to SandwichPlanningSection component
  // Note: Actual sandwich type handlers have been moved to CompletedEventSection component

  // Handle date change confirmation
  const handleDateChangeConfirmation = () => {
    setFormData(prev => ({ ...prev, eventDate: pendingDateChange }));
    setShowDateConfirmation(false);
    setPendingDateChange('');
  };

  const handleDateChangeCancellation = () => {
    setShowDateConfirmation(false);
  };

  // For create mode, we can work with null eventRequest
  const isCreateMode = mode === 'create' || !eventRequest;

  // Auto-expand contact info section in create mode so the required source field is visible
  useEffect(() => {
    if (isCreateMode) {
      setShowContactInfo(true);
    }
  }, [isCreateMode]);

  // Handle real-time field updates from other users
  useEffect(() => {
    if (!isCollaborationEnabled || !collaboration) return;

    const cleanup = collaboration.onFieldUpdate?.((fieldName, value, version) => {
      logger.log(`[EventSchedulingForm] Field ${fieldName} updated by another user:`, value);

      // Validate critical fields before applying — never allow empty status
      if (fieldName === 'status' && !value) {
        logger.warn(`[EventSchedulingForm] Rejected empty status from collaboration update`);
        return;
      }

      // Update formData with the new value from another user
      setFormData(prev => ({
        ...prev,
        [fieldName]: value,
      }));

      // Show toast notification
      toast({
        title: 'Field Updated',
        description: `${fieldName} was updated by another user.`,
      });
    });

    return cleanup;
  }, [isCollaborationEnabled, collaboration, toast]);

  // Field locking handlers
  const handleFieldFocus = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    
    try {
      await collaboration.acquireFieldLock?.(fieldName);
      logger.log(`[EventSchedulingForm] Acquired lock for field: ${fieldName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[EventSchedulingForm] Failed to acquire lock for ${fieldName}:`, err);
      
      // Only show "locked by another user" toast if it's actually a lock conflict
      // Connection errors and timeouts should not be presented as lock conflicts
      const isLockConflict = err.message?.includes('locked by') || err.message?.includes('Field is locked');
      
      if (isLockConflict) {
        toast({
          title: 'Field Locked',
          description: err.message || 'This field is currently being edited by another user.',
          variant: 'destructive',
        });
      } else {
        // Connection or timeout error - log but don't show disruptive toast
        logger.warn(`[EventSchedulingForm] Lock acquisition failed (connection issue): ${err.message}`);
      }
    }
  }, [isCollaborationEnabled, collaboration, toast]);

  const handleFieldBlur = useCallback(async (fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return;
    
    try {
      await collaboration.releaseFieldLock?.(fieldName);
      logger.log(`[EventSchedulingForm] Released lock for field: ${fieldName}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[EventSchedulingForm] Failed to release lock for ${fieldName}:`, err);
    }
  }, [isCollaborationEnabled, collaboration]);

  const isFieldLockedByOther = useCallback((fieldName: string): boolean => {
    if (!isCollaborationEnabled || !collaboration || !currentUser) return false;
    return collaboration.isFieldLockedByOther?.(fieldName, currentUser.id) || false;
  }, [isCollaborationEnabled, collaboration, currentUser]);

  const getFieldLock = useCallback((fieldName: string) => {
    if (!isCollaborationEnabled || !collaboration) return null;
    return collaboration.locks?.get(fieldName) || null;
  }, [isCollaborationEnabled, collaboration]);

  // Cleanup: release all field locks when dialog closes or component unmounts
  useEffect(() => {
    return () => {
      if (!isCollaborationEnabled || !collaboration?.locks || !currentUser) {
        return;
      }

      // Release any locks held by the current user when leaving
      const releasePromises: Promise<void>[] = [];

      collaboration.locks.forEach((lock, fieldName) => {
        if (lock.lockedBy === currentUser.id) {
          const releasePromise = (
            collaboration.releaseFieldLock?.(fieldName) ?? Promise.resolve()
          )
            .then(() => {
              logger.log(
                `[EventSchedulingForm] Cleanup: Released lock for field: ${fieldName}`
              );
            })
            .catch((error) => {
              logger.error(
                `[EventSchedulingForm] Cleanup: Failed to release lock for ${fieldName}:`,
                error
              );
            });

          releasePromises.push(releasePromise);
        }
      });

      if (releasePromises.length > 0) {
        // Fire-and-forget with error handling; React does not await cleanup promises
        Promise.all(releasePromises).catch((error) => {
          logger.error('Failed to release field locks during cleanup', { error });
          // Don't show user error since component is unmounting
        });
      }
    };
  }, [isCollaborationEnabled, collaboration, currentUser]);

  // Section completion tracking for progress indicator
  const sectionStatus = {
    contact: !!(formData.firstName || formData.lastName || formData.email || formData.phone),
    schedule: !!(formData.eventDate),
    delivery: !!(formData.eventAddress || (formData.assignedRecipientIds && formData.assignedRecipientIds.length > 0)),
    sandwiches: !!(formData.totalSandwichCount > 0 || (formData.sandwichTypes && formData.sandwichTypes.length > 0) || formData.estimatedSandwichCountMin > 0),
    resources: !!(formData.driversNeeded > 0 || formData.speakersNeeded > 0 || formData.volunteersNeeded > 0 || formData.selfTransport),
    notes: !!(formData.schedulingNotes || formData.planningNotes || formData.nextAction),
  };
  const completedSections = Object.values(sectionStatus).filter(Boolean).length;
  const totalSections = Object.keys(sectionStatus).length;

  // Debug logging for render errors
  try {
    console.log('[EventSchedulingForm] Rendering with:', {
      eventRequestId: eventRequest?.id,
      organizationName: eventRequest?.organizationName,
      mode,
      dialogOpen,
      formInitialized,
    });
  } catch (err) {
    console.error('[EventSchedulingForm] Error during render preparation:', err);
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={onClose} modal={false}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-[#236383]">
              {isCreateMode ? 'Create New Event' : `${mode === 'edit' ? 'Edit Event Details:' : 'Schedule Event:'} ${eventRequest?.organizationName}`}
            </DialogTitle>
            {isCollaborationEnabled && currentUser && (
              <div className="flex items-center gap-2" data-testid="presence-avatars-container">
                <PresenceAvatars 
                  users={collaboration.presentUsers || []} 
                  currentUserId={currentUser.id} 
                />
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6">
          {/* Auto-save Recovery Banner */}
          {hasRecoveredData && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between mb-4" data-testid="autosave-recovery-banner">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  Unsaved changes were recovered from your previous session.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={discardRecoveredData}
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
                data-testid="discard-recovered-data-btn"
              >
                Discard
              </Button>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="bg-slate-50 rounded-lg p-3 border mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#236383]">Form Progress</span>
              <span className="text-sm text-gray-600">{completedSections} of {totalSections} sections</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#47B3CB] h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedSections / totalSections) * 100}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" id="event-scheduling-form">
          {/* Contact Information Section - Extracted Component */}
          <ContactInfoSection
            formData={formData as EventFormData}
            setFormData={setFormData}
            isExpanded={showContactInfo}
            onToggle={() => setShowContactInfo(!showContactInfo)}
            isComplete={sectionStatus.contact}
            isCreateMode={isCreateMode}
          />

          {/* Backup Contact Information Section - Extracted Component */}
          <BackupContactSection
            formData={formData as EventFormData}
            setFormData={setFormData}
            isExpanded={showBackupContactInfo}
            onToggle={() => setShowBackupContactInfo(!showBackupContactInfo)}
          />

          {/* Status — defensive fallback: prefer server status over hardcoded 'new' to avoid silently resetting status */}
          {(() => {
            const effectiveStatus = formData.status || eventRequest?.status || 'new';
            return (
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={effectiveStatus} onValueChange={handleStatusChange}>
              <SelectTrigger data-testid="select-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                {/* Current status is always shown */}
                <SelectItem value={effectiveStatus}>
                  {STATUS_DEFINITIONS[effectiveStatus as EventStatus]?.label || effectiveStatus} (Current)
                </SelectItem>
                {/* Only show valid transitions from current status */}
                {(VALID_STATUS_TRANSITIONS[effectiveStatus as EventStatus] || [])
                  .filter(s => s !== effectiveStatus)
                  .map(status => (
                    <SelectItem key={status} value={status}>
                      {STATUS_DEFINITIONS[status]?.label || status}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {effectiveStatus && STATUS_DEFINITIONS[effectiveStatus as EventStatus] && (
              <p className="text-xs text-gray-500 mt-1">
                {STATUS_DEFINITIONS[effectiveStatus as EventStatus].definition}
              </p>
            )}
          </div>
            );
          })()}

          {/* Corporate Priority */}
          <div className={`flex items-center space-x-3 p-3 rounded-lg border ${
            (eventRequest as any)?.isCorporatePriority && !canRemoveCorporatePriority
              ? 'bg-amber-100/70 border-amber-300'
              : 'bg-amber-50/50'
          }`}>
            <input
              type="checkbox"
              id="isCorporatePriority"
              checked={formData.isCorporatePriority}
              onChange={(e) => {
                // If trying to enable corporate priority, show confirmation dialog
                if (e.target.checked && !formData.isCorporatePriority) {
                  setShowCorporatePriorityConfirmDialog(true);
                } else {
                  // Disabling - let it through (server will verify permissions)
                  setFormData(prev => ({ ...prev, isCorporatePriority: e.target.checked }));
                }
              }}
              disabled={(eventRequest as any)?.isCorporatePriority && !canRemoveCorporatePriority}
              className={`h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 ${
                (eventRequest as any)?.isCorporatePriority && !canRemoveCorporatePriority
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
            />
            <div>
              <Label htmlFor="isCorporatePriority" className={`text-amber-900 font-medium ${
                (eventRequest as any)?.isCorporatePriority && !canRemoveCorporatePriority
                  ? 'cursor-not-allowed'
                  : 'cursor-pointer'
              }`}>
                Corporate Priority Event
              </Label>
              <p className="text-xs text-amber-700">
                {(eventRequest as any)?.isCorporatePriority && !canRemoveCorporatePriority
                  ? 'Only Christine and Katie can remove the corporate priority flag.'
                  : 'Mark this as a corporate priority event requiring immediate attention and core team member attendance.'}
              </p>
            </div>
          </div>

          {/* Corporate Priority Confirmation Dialog */}
          <AlertDialog open={showCorporatePriorityConfirmDialog} onOpenChange={setShowCorporatePriorityConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-amber-800">Mark as Corporate Priority?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    This will flag <strong>{eventRequest?.organizationName}</strong> as a Corporate Priority event.
                  </p>
                  <p>Corporate priority events:</p>
                  <ul className="list-disc list-inside ml-2 text-sm">
                    <li>Trigger strict follow-up protocols</li>
                    <li>Send notifications to Katie and Christine</li>
                    <li>Require a core team member to attend</li>
                    <li>Can only be unmarked by Katie or Christine</li>
                  </ul>
                  <p className="font-medium pt-2">Are you sure this event should be marked as Corporate Priority?</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowCorporatePriorityConfirmDialog(false)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setFormData(prev => ({ ...prev, isCorporatePriority: true }));
                    setShowCorporatePriorityConfirmDialog(false);
                  }}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Yes, Mark as Corporate Priority
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Toolkit Status Section */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold">Toolkit Status</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="toolkitStatus">Toolkit Status</Label>
                <Select value={formData.toolkitStatus} onValueChange={(value) => setFormData(prev => ({ ...prev, toolkitStatus: value }))}>
                  <SelectTrigger data-testid="select-toolkit-status">
                    <SelectValue placeholder="Select toolkit status" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                    <SelectItem value="not_sent">Not Sent</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="received_confirmed">Received Confirmed</SelectItem>
                    <SelectItem value="not_needed">Not Needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="toolkitSentDate">Toolkit Sent Date</Label>
                <Input
                  id="toolkitSentDate"
                  type="date"
                  value={formData.toolkitSentDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, toolkitSentDate: e.target.value }))}
                  disabled={formData.toolkitStatus === 'not_sent' || formData.toolkitStatus === 'not_needed'}
                  data-testid="input-toolkit-sent-date"
                />
              </div>
            </div>
          </div>

          {/* Event Schedule */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <Calendar className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Event Schedule</span>
              {sectionStatus.schedule && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>

            {/* Conflict Warnings */}
            <EventConflictWarnings
              eventId={eventRequest?.id}
              scheduledEventDate={formData.eventDate || null}
              eventStartTime={formData.eventStartTime || null}
              eventEndTime={formData.eventEndTime || null}
              pickupTime={formData.pickupTime || null}
              vanDriverNeeded={formData.vanDriverNeeded}
              selfTransport={formData.selfTransport}
              assignedVanDriverId={formData.assignedVanDriverId || null}
              assignedSpeakerIds={(eventRequest as any)?.assignedSpeakerIds || null}
              assignedRecipientIds={formData.assignedRecipientIds || null}
              organizationName={formData.organizationName || eventRequest?.organizationName || null}
              enabled={!!formData.eventDate}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="eventDate">Event Date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={formData.eventDate}
                  onChange={(e) => {
                    // Always update the display value immediately (no confirmation on keystroke)
                    setFormData(prev => ({ ...prev, eventDate: e.target.value }));
                    // Reset van conflict check when date changes
                    setVanConflictChecked(false);
                  }}
                  onBlur={(e) => {
                    const newDate = e.target.value;
                    // Only check for confirmation when user finishes editing (onBlur)
                    if (eventRequest?.status === 'scheduled' &&
                        formatDateForInput(eventRequest.desiredEventDate) !== newDate &&
                        formatDateForInput(eventRequest.desiredEventDate) !== '' &&
                        newDate !== formatDateForInput(eventRequest.desiredEventDate)) {
                      setPendingDateChange(newDate);
                      setShowDateConfirmation(true);
                    }
                  }}
                  data-testid="input-event-date"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Label className="text-sm font-normal text-gray-600">
                    Date flexibility:
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.dateFlexible === null ? "default" : "outline"}
                      className={`h-7 px-2 text-xs ${formData.dateFlexible === null ? 'bg-gray-500 hover:bg-gray-600' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, dateFlexible: null }))}
                    >
                      Unknown
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.dateFlexible === true ? "default" : "outline"}
                      className={`h-7 px-2 text-xs ${formData.dateFlexible === true ? 'bg-green-600 hover:bg-green-700' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, dateFlexible: true }))}
                    >
                      Flexible
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={formData.dateFlexible === false ? "default" : "outline"}
                      className={`h-7 px-2 text-xs ${formData.dateFlexible === false ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => setFormData(prev => ({ ...prev, dateFlexible: false }))}
                    >
                      Fixed
                    </Button>
                  </div>
                </div>
              </div>

              {/* Backup Dates */}
              <div className="md:col-span-2 lg:col-span-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Backup Dates (Optional)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          backupDates: [...prev.backupDates, '']
                        }));
                      }}
                      className="h-7 text-xs"
                    >
                      + Add Backup Date
                    </Button>
                  </div>
                  {formData.backupDates && formData.backupDates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {formData.backupDates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={date}
                            onChange={(e) => {
                              const newBackupDates = [...(formData.backupDates || [])];
                              newBackupDates[index] = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                backupDates: newBackupDates
                              }));
                            }}
                            placeholder="Select backup date"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                backupDates: (prev.backupDates || []).filter((_, i) => i !== index)
                              }));
                            }}
                            className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!formData.backupDates || formData.backupDates.length === 0) && (
                    <p className="text-xs text-gray-500">
                      Add alternate dates if the primary event date is not available
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="eventStartTime">Start Time</Label>
                <Input
                  id="eventStartTime"
                  type="time"
                  value={formData.eventStartTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, eventStartTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="eventEndTime">End Time</Label>
                <Input
                  id="eventEndTime"
                  type="time"
                  value={formData.eventEndTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, eventEndTime: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="pickupDate">Pickup Date</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={formData.pickupDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      pickupDate: newDate,
                      // Combine date and time into pickupDateTime
                      pickupDateTime: newDate && prev.pickupTimeSeparate ? `${newDate}T${prev.pickupTimeSeparate}` : '',
                      pickupTime: ''
                    }));
                  }}
                  min={formData.eventDate || undefined}
                  data-testid="pickup-date-input"
                />
              </div>
              <div>
                <Label htmlFor="pickupTimeSeparate">Pickup Time</Label>
                <Input
                  id="pickupTimeSeparate"
                  type="time"
                  value={formData.pickupTimeSeparate}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    setFormData(prev => {
                      // Validate: if pickup date is same as event date, time must be after event end time
                      let validatedTime = newTime;
                      if (prev.pickupDate === formData.eventDate && formData.eventEndTime && newTime) {
                        if (newTime <= formData.eventEndTime) {
                          // Time is before or equal to end time - keep the change but could show warning
                          validatedTime = newTime;
                        }
                      }
                      return { 
                        ...prev, 
                        pickupTimeSeparate: validatedTime,
                        // Combine date and time into pickupDateTime
                        pickupDateTime: prev.pickupDate && validatedTime ? `${prev.pickupDate}T${validatedTime}` : '',
                        pickupTime: ''
                      };
                    });
                  }}
                  min={formData.pickupDate === formData.eventDate && formData.eventEndTime ? formData.eventEndTime : undefined}
                  data-testid="pickup-time-input"
                />
                {formData.pickupDate === formData.eventDate &&
                 formData.eventEndTime &&
                 formData.pickupTimeSeparate &&
                 formData.pickupTimeSeparate < formData.eventEndTime && (
                  <p className="text-xs text-amber-600 mt-1">
                    Note: Pickup time is before event ends ({formData.eventEndTime})
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <Label htmlFor="eventAddress">Event Address</Label>
            <Input
              id="eventAddress"
              value={formData.eventAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, eventAddress: e.target.value }))}
              placeholder="Enter the event location address"
            />
          </div>

          {/* Delivery Destinations */}
          <div className="space-y-4">
            <div className="p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
              <p className="text-sm text-brand-primary mb-2 font-medium">
                📍 Delivery Options: You can specify either a direct delivery destination, or an overnight holding location with a final destination.
              </p>
            </div>

            {/* Overnight Holding Checkbox */}
            <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <input
                type="checkbox"
                id="holdingOvernight"
                checked={formData.holdingOvernight}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => ({ 
                    ...prev, 
                    holdingOvernight: checked,
                    // Clear overnight fields if unchecking
                    ...(checked ? {} : {
                      overnightHoldingLocation: '',
                      overnightPickupTime: '',
                      deliveryTimeWindow: '',
                      deliveryParkingAccess: ''
                    })
                  }));
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                data-testid="checkbox-holding-overnight"
              />
              <Label htmlFor="holdingOvernight" className="text-sm font-medium text-blue-900 cursor-pointer">
                🌙 This group will hold sandwiches overnight
              </Label>
            </div>

            {/* Overnight Holding Location (shows when checkbox is checked) */}
            {formData.holdingOvernight && (
              <div className="space-y-2">
                <Label htmlFor="overnightHoldingLocation">
                  Overnight Holding Location
                </Label>
                <Input
                  id="overnightHoldingLocation"
                  value={formData.overnightHoldingLocation}
                  onChange={(e) => setFormData(prev => ({ ...prev, overnightHoldingLocation: e.target.value }))}
                  placeholder="Location where sandwiches will be stored overnight (e.g., church, community center)"
                  data-testid="input-overnight-location"
                />
                {formData.overnightHoldingLocation && (
                <div className="ml-4 mt-2 space-y-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900">Next-Day Delivery Details</h4>
                  <div>
                    <Label htmlFor="overnightPickupTime">Pickup Time from Overnight Location</Label>
                    <Input
                      id="overnightPickupTime"
                      type="time"
                      value={formData.overnightPickupTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, overnightPickupTime: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryTimeWindow">Delivery Time Window</Label>
                    <Input
                      id="deliveryTimeWindow"
                      type="text"
                      value={formData.deliveryTimeWindow || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliveryTimeWindow: e.target.value }))}
                      placeholder="e.g., 11:00 AM - 12:00 PM"
                    />
                  </div>
                  <div>
                    <Label htmlFor="deliveryParkingAccess">Parking/Access Details</Label>
                    <Textarea
                      id="deliveryParkingAccess"
                      value={formData.deliveryParkingAccess || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, deliveryParkingAccess: e.target.value }))}
                      placeholder="e.g., Park in rear lot, use loading dock entrance"
                      rows={2}
                    />
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Final Delivery Destination - Multiple Recipients */}
            <div>
              <Label htmlFor="deliveryDestination">
                {formData.overnightHoldingLocation ? '📍 Final Delivery Destinations' : '📍 Delivery Destinations'}
              </Label>
              <p className="text-sm text-gray-500 mb-2">
                Select one or more recipient organizations where the sandwiches will be delivered
              </p>
              <MultiRecipientSelector
                value={formData.assignedRecipientIds}
                onChange={(ids) => setFormData(prev => ({ ...prev, assignedRecipientIds: ids }))}
                placeholder={formData.overnightHoldingLocation
                  ? "Select recipient organizations for final delivery..."
                  : "Select recipient organizations..."}
                data-testid="delivery-destination-multi-selector"
              />
            </div>
          </div>

          {/* Sandwich Planning - Extracted Component */}
          <SandwichPlanningSection
            formData={formData as EventFormData}
            setFormData={setFormData}
            sandwichMode={sandwichMode}
            setSandwichMode={setSandwichMode}
            isComplete={sectionStatus.sandwiches}
          />

          {/* Volunteer/Attendee Count (Optional) */}
          <div className="space-y-3">
            <Label># of Attendees (Optional)</Label>

            {/* Mode Selector */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={attendeeMode === 'total' ? 'default' : 'outline'}
                onClick={() => setAttendeeMode('total')}
                className="text-xs"
              >
                Total Count
              </Button>
              <Button
                type="button"
                size="sm"
                variant={attendeeMode === 'breakdown' ? 'default' : 'outline'}
                onClick={() => setAttendeeMode('breakdown')}
                className="text-xs"
              >
                Adults & Children
              </Button>
            </div>

            {/* Total Count Mode */}
            {attendeeMode === 'total' && (
              <div>
                <Label htmlFor="estimatedAttendance">Estimated Attendance</Label>
                <Input
                  id="estimatedAttendance"
                  type="number"
                  value={formData.estimatedAttendance}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedAttendance: parseInt(e.target.value) || 0, volunteerCount: parseInt(e.target.value) || 0, adultCount: 0, childrenCount: 0 }))}
                  placeholder="Enter estimated number of attendees"
                  min="0"
                  className="w-40"
                  data-testid="input-estimated-attendance"
                />
              </div>
            )}

            {/* Breakdown Mode */}
            {attendeeMode === 'breakdown' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="adultCount">Adults</Label>
                  <Input
                    id="adultCount"
                    type="number"
                    value={formData.adultCount || 0}
                    onChange={(e) => {
                      const adults = parseInt(e.target.value) || 0;
                      const children = formData.childrenCount || 0;
                      setFormData(prev => ({
                        ...prev,
                        adultCount: adults,
                        volunteerCount: adults + children,
                        estimatedAttendance: adults + children
                      }));
                    }}
                    placeholder="# of adults"
                    min="0"
                    className="w-32"
                    data-testid="input-adult-count"
                  />
                </div>
                <div>
                  <Label htmlFor="childrenCount">Children</Label>
                  <Input
                    id="childrenCount"
                    type="number"
                    value={formData.childrenCount || 0}
                    onChange={(e) => {
                      const children = parseInt(e.target.value) || 0;
                      const adults = formData.adultCount || 0;
                      setFormData(prev => ({
                        ...prev,
                        childrenCount: children,
                        volunteerCount: adults + children,
                        estimatedAttendance: adults + children
                      }));
                    }}
                    placeholder="# of children"
                    min="0"
                    className="w-32"
                    data-testid="input-children-count"
                  />
                </div>
              </div>
            )}

            {/* Kids Age Range - show when there are children participating */}
            {(formData.childrenCount > 0 || formData.kidsAgeRange) && (
              <div className="mt-3">
                <Label htmlFor="kidsAgeRange">Kids Age Range</Label>
                <Input
                  id="kidsAgeRange"
                  type="text"
                  value={formData.kidsAgeRange || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, kidsAgeRange: e.target.value }))}
                  placeholder="e.g., 5-12, Elementary school, Middle school"
                  className="w-64"
                  data-testid="input-kids-age-range"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Age range of children participating (e.g., "5-12", "Elementary school")
                </p>
              </div>
            )}

            <p className="text-sm text-[#236383]">
              Optional: Estimate how many people will attend this event.
            </p>
          </div>

          {/* Refrigeration */}
          <div>
            <Label htmlFor="hasRefrigeration">Refrigeration Available?</Label>
            <Select value={formData.hasRefrigeration} onValueChange={(value) => setFormData(prev => ({ ...prev, hasRefrigeration: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select refrigeration status" />
              </SelectTrigger>
              <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>

            {/* Show refrigeration warning/info based on status and sandwich types */}
            <RefrigerationWarningAlert
              sandwichTypes={formData.sandwichTypes}
              hasRefrigeration={
                formData.hasRefrigeration === 'true' ? true :
                formData.hasRefrigeration === 'false' ? false : null
              }
              className="mt-2"
            />
          </div>

          {/* Resource Requirements - Extracted Component */}
          <ResourceRequirementsSection
            formData={formData as EventFormData}
            setFormData={setFormData}
            vanDrivers={vanDrivers}
            isComplete={sectionStatus.resources}
          />

          {/* TSP Contact Assignment */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="tspContact">TSP Contact Assignment</Label>
              {isCollaborationEnabled && isFieldLockedByOther('tspContact') && (
                <FieldLockIndicator 
                  lockedBy={getFieldLock('tspContact')?.lockedByName || 'Another user'} 
                  expiresAt={getFieldLock('tspContact')?.expiresAt}
                  data-testid="field-lock-tsp-contact"
                />
              )}
            </div>
            <Tabs 
              value={formData.customTspContact?.trim() ? 'custom' : 'user'} 
              onValueChange={(value) => {
                if (value === 'custom') {
                  setFormData(prev => ({ ...prev, tspContact: '', customTspContact: prev.customTspContact || '' }));
                } else {
                  setFormData(prev => ({ ...prev, customTspContact: '', tspContact: prev.tspContact || '' }));
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2 mb-3">
                <TabsTrigger value="user" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Select User
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Custom Contact
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="space-y-2">
                <Select 
                  value={formData.tspContact} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tspContact: value, customTspContact: '' }))}
                  disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
                >
                  <SelectTrigger
                    onFocus={() => handleFieldFocus('tspContact')}
                    onBlur={() => handleFieldBlur('tspContact')}
                    data-testid="select-tsp-contact"
                  >
                    <SelectValue placeholder="Select TSP contact" />
                  </SelectTrigger>
                  <SelectContent className="z-[200]" position="popper" sideOffset={5}>
                    {users.filter((user) => user.id).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : user.email} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              
              <TabsContent value="custom" className="space-y-2">
                <Textarea
                  id="customTspContact"
                  value={formData.customTspContact}
                  onChange={(e) => setFormData(prev => ({ ...prev, customTspContact: e.target.value, tspContact: '' }))}
                  onFocus={() => handleFieldFocus('tspContact')}
                  onBlur={() => handleFieldBlur('tspContact')}
                  placeholder="Enter custom TSP contact information (e.g., John Smith - john.smith@email.com - (555) 123-4567)"
                  className="min-h-[100px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
                  data-testid="textarea-custom-tsp-contact"
                />
                <p className="text-xs text-gray-500">
                  Use this for contacts not in the system. Enter name, email, phone, or other relevant information.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Contact Attempts History Section */}
          {eventRequest && (eventRequest.contactAttempts > 0 || eventRequest.unresponsiveNotes) && (
            <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                Contact Attempts History
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="bg-white px-3 py-1 rounded border border-blue-300">
                    <span className="font-medium text-blue-900">Total Attempts:</span>{' '}
                    <span className="text-blue-700 font-bold">{eventRequest.contactAttempts || 0}</span>
                  </div>
                  {eventRequest.lastContactAttempt && (
                    <div className="bg-white px-3 py-1 rounded border border-blue-300">
                      <span className="font-medium text-blue-900">Last Attempt:</span>{' '}
                      <span className="text-blue-700">
                        {new Date(eventRequest.lastContactAttempt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                  )}
                  {eventRequest.contactMethod && (
                    <div className="bg-white px-3 py-1 rounded border border-blue-300">
                      <span className="font-medium text-blue-900">Method:</span>{' '}
                      <span className="text-blue-700 capitalize">{eventRequest.contactMethod}</span>
                    </div>
                  )}
                </div>
                {eventRequest.unresponsiveNotes && (
                  <div className="bg-white p-3 rounded border border-blue-300">
                    <p className="text-sm font-medium text-blue-900 mb-1">Attempt Log:</p>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {eventRequest.unresponsiveNotes}
                    </div>
                  </div>
                )}
                {eventRequest.isUnresponsive && (
                  <div className="bg-yellow-100 border border-yellow-400 rounded p-2 flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-800">Marked as Unresponsive</p>
                      {eventRequest.unresponsiveReason && (
                        <p className="text-sm text-yellow-700">Reason: {eventRequest.unresponsiveReason}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes & Requirements Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-3 pb-2 border-b">
              <FileText className="w-5 h-5 text-[#236383]" />
              <span className="text-lg font-semibold text-[#236383]">Notes & Requirements</span>
              {sectionStatus.notes && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            </div>
            <div>
              {/* Initial Request Message */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="message">Initial Request Message</Label>
                  {!isMessageEditable && formData.message && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsMessageEditable(true)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Edit
                    </Button>
                  )}
                </div>
                {isMessageEditable ? (
                  <div className="space-y-2">
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Original request message from the organizer"
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsMessageEditable(false)}
                        className="bg-[#47B3CB] hover:bg-[#47B3CB]/80 text-white"
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsMessageEditable(false);
                          // Reset to original value from eventRequest
                          setFormData(prev => ({ ...prev, message: (eventRequest as any)?.message || '' }));
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-primary-lighter p-3 rounded border-l-4 border-brand-primary-border text-sm text-gray-700">
                    {formData.message || 'No initial message recorded'}
                  </div>
                )}
              </div>

              {/* Next Action - Prominent field for intake tracking */}
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="nextAction" className="text-amber-800 font-semibold">Next Action</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('nextAction') && (
                    <FieldLockIndicator
                      lockedBy={getFieldLock('nextAction')?.lockedByName || 'Another user'}
                      expiresAt={getFieldLock('nextAction')?.expiresAt}
                      data-testid="field-lock-next-action"
                    />
                  )}
                </div>
                <p className="text-sm text-amber-700 mb-2">What needs to happen next for this event? (e.g., "Waiting for callback", "Need to confirm date", "Follow up on van availability")</p>
                <Input
                  id="nextAction"
                  value={formData.nextAction}
                  onChange={(e) => setFormData(prev => ({ ...prev, nextAction: e.target.value }))}
                  onFocus={() => handleFieldFocus('nextAction')}
                  onBlur={() => handleFieldBlur('nextAction')}
                  placeholder="Enter the next action needed..."
                  className="bg-white border-amber-300 focus:border-amber-500"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('nextAction')}
                  data-testid="input-next-action"
                />
              </div>

              {/* Scheduling Notes */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="schedulingNotes">Scheduling Notes</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('schedulingNotes') && (
                    <FieldLockIndicator
                      lockedBy={getFieldLock('schedulingNotes')?.lockedByName || 'Another user'}
                      expiresAt={getFieldLock('schedulingNotes')?.expiresAt}
                      data-testid="field-lock-scheduling-notes"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">Notes added while the event is being processed</p>
                <Textarea
                  id="schedulingNotes"
                  value={formData.schedulingNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, schedulingNotes: e.target.value }))}
                  onFocus={() => handleFieldFocus('schedulingNotes')}
                  onBlur={() => handleFieldBlur('schedulingNotes')}
                  placeholder="Add notes about scheduling, coordination, or processing status"
                  className="min-h-[80px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('schedulingNotes')}
                  data-testid="textarea-scheduling-notes"
                />
              </div>

              {/* Planning Notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Label htmlFor="planningNotes">Planning Notes</Label>
                  {isCollaborationEnabled && isFieldLockedByOther('planningNotes') && (
                    <FieldLockIndicator
                      lockedBy={getFieldLock('planningNotes')?.lockedByName || 'Another user'}
                      expiresAt={getFieldLock('planningNotes')?.expiresAt}
                      data-testid="field-lock-planning-notes"
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 mb-2">Notes for when the event is scheduled or being planned</p>
                <Textarea
                  id="planningNotes"
                  value={formData.planningNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, planningNotes: e.target.value }))}
                  onFocus={() => handleFieldFocus('planningNotes')}
                  onBlur={() => handleFieldBlur('planningNotes')}
                  placeholder="Add planning notes, logistics, or post-scheduling information"
                  className="min-h-[80px]"
                  disabled={isCollaborationEnabled && isFieldLockedByOther('planningNotes')}
                  data-testid="textarea-planning-notes"
                />
              </div>
            </div>
          </div>

          {/* Volunteer/Driver/Speaker Instructions Section */}
          <div className="space-y-4 border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-indigo-50">
            <div className="flex items-center gap-3 pb-2 border-b border-purple-200">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <span className="text-lg font-semibold text-purple-800">Event Instructions for Volunteers</span>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Sent in reminder texts/emails</span>
            </div>
            <p className="text-sm text-purple-700">
              These instructions will be automatically included in reminder notifications sent to assigned drivers, volunteers, and speakers before the event.
            </p>

            {/* Driver Instructions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="driverInstructions" className="text-purple-800 font-medium">Driver Instructions</Label>
              </div>
              <Textarea
                id="driverInstructions"
                value={formData.driverInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, driverInstructions: e.target.value }))}
                placeholder="Special instructions for drivers (e.g., parking location, entrance to use, who to ask for, delivery notes)"
                className="min-h-[80px] border-purple-200 focus:border-purple-400"
                data-testid="textarea-driver-instructions"
              />
            </div>

            {/* Volunteer Instructions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="volunteerInstructions" className="text-purple-800 font-medium">Volunteer Instructions</Label>
              </div>
              <Textarea
                id="volunteerInstructions"
                value={formData.volunteerInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, volunteerInstructions: e.target.value }))}
                placeholder="Special instructions for general volunteers (e.g., what to bring, where to meet, tasks to help with)"
                className="min-h-[80px] border-purple-200 focus:border-purple-400"
                data-testid="textarea-volunteer-instructions"
              />
            </div>

            {/* Speaker Instructions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="speakerInstructions" className="text-purple-800 font-medium">Speaker Instructions</Label>
              </div>
              <Textarea
                id="speakerInstructions"
                value={formData.speakerInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, speakerInstructions: e.target.value }))}
                placeholder="Special instructions for speakers (e.g., audience details, presentation format, time allotted, topics to cover)"
                className="min-h-[80px] border-purple-200 focus:border-purple-400"
                data-testid="textarea-speaker-instructions"
              />
            </div>
          </div>

          {/* Completed Event Details Section - Extracted Component */}
          <CompletedEventSection
            formData={formData as EventFormData}
            setFormData={setFormData}
            isExpanded={showCompletedDetails}
            onToggle={() => setShowCompletedDetails(!showCompletedDetails)}
            actualSandwichMode={actualSandwichMode}
            setActualSandwichMode={setActualSandwichMode}
          />

        </form>
        </div>

        {/* Sticky Footer - Action Buttons */}
        <div className="flex-shrink-0 flex justify-between px-4 sm:px-6 py-4 border-t bg-white">
          <div>
            {/* Delete button - only show for existing events in edit mode */}
            {eventRequest && mode === 'edit' && (
              <Button
                type="button"
                variant="outline"
                className="border-[#A31C41] text-[#A31C41] hover:bg-[#A31C41] hover:text-white"
                onClick={() => setShowDeleteConfirmation(true)}
                disabled={deleteEventRequestMutation.isPending}
                data-testid="button-delete-event"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleteEventRequestMutation.isPending ? 'Deleting...' : 'Delete Event'}
              </Button>
            )}
          </div>
          
          <div className="flex space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="event-scheduling-form"
              className="text-white"
              style={{ backgroundColor: '#236383' }}
              disabled={updateEventRequestMutation.isPending || createEventRequestMutation.isPending}
              data-testid="button-submit"
            >
              {(updateEventRequestMutation.isPending || createEventRequestMutation.isPending)
                ? (mode === 'edit' ? 'Saving...' : 'Scheduling...') 
                : (mode === 'edit' ? 'Save Changes' : 'Schedule Event')}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Date Change Confirmation Dialog */}
      <AlertDialog open={showDateConfirmation} onOpenChange={setShowDateConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Date Change</AlertDialogTitle>
            <AlertDialogDescription>
              This event is already scheduled. Changing the date may affect logistics, notifications, and volunteer assignments. 
              Are you sure you want to change the event date?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDateChangeCancellation}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDateChangeConfirmation}
              className="bg-[#236383] hover:bg-[#1a4e68]"
            >
              Yes, Change Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Van Conflict Warning Dialog */}
      <AlertDialog open={showVanConflictDialog} onOpenChange={(open) => {
        // If dialog is being dismissed (Escape key, overlay click), reset isSubmitting
        // so the save button isn't permanently disabled
        if (!open) {
          setShowVanConflictDialog(false);
          setVanConflictChecked(false);
          setIsSubmitting(false);
        }
      }}>

        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Van Availability Notice
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Your changes have been saved. As a heads-up, the van may already be assigned to another event on this date:
              </p>
              {vanConflictDetails && (
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {vanConflictDetails.conflictingEvents.map((event, i) => (
                    <li key={event.id || i}>
                      <strong>{event.name}</strong>
                      {event.time && <span className="text-muted-foreground"> at {event.time}</span>}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-sm">
                Please verify van availability when coordinating logistics.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowVanConflictDialog(false);
              setVanConflictChecked(false);
              setIsSubmitting(false);
            }}>
              Go Back & Check
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                setShowVanConflictDialog(false);
                setVanConflictChecked(true);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              OK, Got It
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Speaker Warning Dialog */}
      <AlertDialog open={showSpeakerWarningDialog} onOpenChange={(open) => {
        if (!open) {
          setShowSpeakerWarningDialog(false);
          setIsSubmitting(false);
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              Speaker Recommendation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                We usually send a speaker to events making more than 500 sandwiches. Are you sure this event doesn't need one?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowSpeakerWarningDialog(false);
              setIsSubmitting(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setShowSpeakerWarningDialog(false);
                // Proceed with submission even without a speaker
                await performSubmit(true);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Continue Without Speaker
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Standby Follow-Up Date Dialog */}
      <AlertDialog open={showStandbyFollowUpDialog} onOpenChange={(open) => {
        if (!open) {
          setShowStandbyFollowUpDialog(false);
          // Only reset status if the dialog was dismissed (Escape/overlay click),
          // NOT when closed by the save action. We use a ref (not state) because
          // Radix fires onOpenChange synchronously and React batches state updates,
          // so isSubmitting wouldn't be readable yet in the same event cycle.
          if (!standbySaveClickedRef.current) {
            setFormData(prev => ({ ...prev, status: eventRequest?.status || 'new' }));
            setIsSubmitting(false);
          }
          standbySaveClickedRef.current = false;
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              Set Follow-Up Reminder
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                You're moving this event to <span className="font-semibold text-amber-600">Standby</span>.
              </p>
              <p>
                Did the contact request to be contacted on a specific date, or should we send a reminder in one week?
              </p>

              <div className="space-y-3 mt-4">
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="standbyFollowUpMode"
                    value="one_week"
                    checked={standbyFollowUpMode === 'one_week'}
                    onChange={() => {
                      setStandbyFollowUpMode('one_week');
                      const oneWeekFromNow = new Date();
                      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
                      setStandbyFollowUpDate(oneWeekFromNow.toISOString().split('T')[0]);
                    }}
                    className="h-4 w-4 text-amber-600"
                  />
                  <div>
                    <span className="font-medium">Reminder in one week</span>
                    <p className="text-sm text-gray-500">Default follow-up timing</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="standbyFollowUpMode"
                    value="specific"
                    checked={standbyFollowUpMode === 'specific'}
                    onChange={() => setStandbyFollowUpMode('specific')}
                    className="h-4 w-4 text-amber-600 mt-1"
                  />
                  <div className="flex-1">
                    <span className="font-medium">Contact requested a specific date</span>
                    <Input
                      type="date"
                      value={standbyFollowUpMode === 'specific' ? standbyFollowUpDate : ''}
                      onChange={(e) => setStandbyFollowUpDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      disabled={standbyFollowUpMode !== 'specific'}
                      className="mt-2"
                      onClick={() => setStandbyFollowUpMode('specific')}
                    />
                  </div>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // Signal to onOpenChange that this is a save, not a dismissal
                standbySaveClickedRef.current = true;
                // Update state for consistency (auto-save, re-render)
                setFormData(prev => ({ ...prev, standbyExpectedDate: standbyFollowUpDate }));
                setShowStandbyFollowUpDialog(false);
                // Pass the date directly to performSubmit via fieldOverrides so it
                // doesn't depend on the async state update having flushed yet.
                await performSubmit(false, { standbyExpectedDate: standbyFollowUpDate });
              }}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!standbyFollowUpDate}
            >
              Set Reminder & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmation} onOpenChange={setShowDeleteConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event Request</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event request for{' '}
              <span className="font-semibold">{eventRequest?.organizationName}</span>?
              {eventRequest?.scheduledEventDate && (
                <> This event is scheduled for {new Date(eventRequest.scheduledEventDate).toLocaleDateString()}.</>
              )}
              <br /><br />
              <span className="text-red-600 font-medium">This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirmation(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (eventRequest) {
                  if (onDelete) {
                    onDelete(eventRequest.id);
                  } else {
                    deleteEventRequestMutation.mutate(eventRequest.id);
                  }
                  setShowDeleteConfirmation(false);
                }
              }}
              className="bg-[#A31C41] hover:bg-[#8a1837]"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default EventSchedulingForm;
