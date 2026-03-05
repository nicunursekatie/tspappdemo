/**
 * Event Conflict Warnings Component
 *
 * Displays scheduling conflict warnings for events.
 * Warns about but doesn't prevent event creation.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { AlertTriangle, AlertCircle, Calendar, Truck, User, Building, Mic, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface ConflictWarning {
  type: 'van_conflict' | 'high_volume_day' | 'driver_conflict' | 'recipient_conflict' | 'time_overlap' | 'speaker_conflict' | 'pickup_conflict';
  severity: 'warning' | 'critical';
  message: string;
  conflictingEventId?: number;
  conflictingEventName?: string;
  conflictingEventTime?: string;
  details?: Record<string, any>;
}

interface ConflictCheckResult {
  hasConflicts: boolean;
  warnings: ConflictWarning[];
  summary: string;
}

interface EventConflictWarningsProps {
  eventId?: number;
  scheduledEventDate?: Date | string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  pickupTime?: string | null;
  vanDriverNeeded?: boolean | null;
  selfTransport?: boolean | null;
  assignedVanDriverId?: string | null;
  assignedSpeakerIds?: string[] | null;
  assignedRecipientIds?: string[] | null;
  organizationName?: string | null;
  enabled?: boolean;
  // Legacy props for backwards compatibility
  vanBooked?: string | null;
  driverName?: string | null;
  recipientId?: number | null;
}

const getWarningIcon = (type: ConflictWarning['type']) => {
  switch (type) {
    case 'van_conflict':
      return <Truck className="h-4 w-4" />;
    case 'driver_conflict':
      return <User className="h-4 w-4" />;
    case 'high_volume_day':
      return <Calendar className="h-4 w-4" />;
    case 'recipient_conflict':
      return <Building className="h-4 w-4" />;
    case 'speaker_conflict':
      return <Mic className="h-4 w-4" />;
    case 'pickup_conflict':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

const getWarningLabel = (type: ConflictWarning['type']) => {
  switch (type) {
    case 'van_conflict':
      return 'Van Conflict';
    case 'driver_conflict':
      return 'Driver Conflict';
    case 'high_volume_day':
      return 'Busy Day';
    case 'recipient_conflict':
      return 'Recipient Conflict';
    case 'speaker_conflict':
      return 'Speaker Conflict';
    case 'pickup_conflict':
      return 'Pickup Timing';
    default:
      return 'Conflict';
  }
};

export function EventConflictWarnings({
  eventId,
  scheduledEventDate,
  eventStartTime,
  eventEndTime,
  pickupTime,
  vanDriverNeeded,
  selfTransport,
  assignedVanDriverId,
  assignedSpeakerIds,
  assignedRecipientIds,
  organizationName,
  enabled = true,
  // Legacy props
  vanBooked,
  driverName,
  recipientId,
}: EventConflictWarningsProps) {
  // Only check conflicts if we have a scheduled date
  const hasDate = !!scheduledEventDate;

  const { data: conflicts, isLoading, error } = useQuery({
    queryKey: [
      'event-conflicts',
      eventId,
      scheduledEventDate?.toString(),
      eventStartTime,
      eventEndTime,
      pickupTime,
      vanDriverNeeded,
      selfTransport,
      assignedVanDriverId,
      JSON.stringify(assignedSpeakerIds),
      JSON.stringify(assignedRecipientIds),
      // Legacy fields for cache key
      vanBooked,
      driverName,
      recipientId,
    ],
    queryFn: async (): Promise<ConflictCheckResult> => {
      const response = await apiRequest('POST', '/api/event-requests/check-conflicts', {
        id: eventId,
        scheduledEventDate: scheduledEventDate
          ? (typeof scheduledEventDate === 'string' ? scheduledEventDate : scheduledEventDate.toISOString())
          : null,
        eventStartTime,
        eventEndTime,
        pickupTime,
        vanDriverNeeded,
        selfTransport,
        assignedVanDriverId,
        assignedSpeakerIds,
        assignedRecipientIds,
        organizationName,
        // Pass legacy fields for backwards compatibility
        vanBooked,
        driverName,
        recipientId,
      });
      return response;
    },
    enabled: enabled && hasDate,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  // Don't show anything if no date or disabled
  if (!enabled || !hasDate) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Error state - don't block user, just log
  if (error) {
    console.error('Error checking conflicts:', error);
    return null;
  }

  // No conflicts
  if (!conflicts?.hasConflicts || conflicts.warnings.length === 0) {
    return null;
  }

  // Group warnings by severity
  const criticalWarnings = conflicts.warnings.filter(w => w.severity === 'critical');
  const regularWarnings = conflicts.warnings.filter(w => w.severity === 'warning');

  return (
    <div className="space-y-3">
      {/* Critical warnings */}
      {criticalWarnings.length > 0 && (
        <Alert variant="destructive" className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            <span>Scheduling Conflicts Detected</span>
            <Badge variant="destructive" className="text-xs">
              {criticalWarnings.length} Critical
            </Badge>
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-2">
              {criticalWarnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  {getWarningIcon(warning.type)}
                  <div>
                    <span className="font-medium">{getWarningLabel(warning.type)}:</span>{' '}
                    {warning.message}
                    {warning.conflictingEventId && (
                      <span className="text-xs text-muted-foreground ml-1">
                        (Event #{warning.conflictingEventId})
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              These conflicts may cause logistical issues. Please review before proceeding.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Regular warnings */}
      {regularWarnings.length > 0 && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="flex items-center gap-2 text-yellow-800">
            <span>Heads Up</span>
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
              {regularWarnings.length} Notice{regularWarnings.length > 1 ? 's' : ''}
            </Badge>
          </AlertTitle>
          <AlertDescription className="text-yellow-800">
            <ul className="mt-2 space-y-2">
              {regularWarnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  {getWarningIcon(warning.type)}
                  <div>
                    <span className="font-medium">{getWarningLabel(warning.type)}:</span>{' '}
                    {warning.message}
                  </div>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/**
 * Hook to check event conflicts programmatically
 */
export function useEventConflicts(eventData: EventConflictWarningsProps) {
  const hasDate = !!eventData.scheduledEventDate;

  return useQuery({
    queryKey: [
      'event-conflicts',
      eventData.eventId,
      eventData.scheduledEventDate?.toString(),
      eventData.eventStartTime,
      eventData.eventEndTime,
      eventData.pickupTime,
      eventData.vanDriverNeeded,
      eventData.selfTransport,
      eventData.assignedVanDriverId,
      JSON.stringify(eventData.assignedSpeakerIds),
      JSON.stringify(eventData.assignedRecipientIds),
      // Legacy fields
      eventData.vanBooked,
      eventData.driverName,
      eventData.recipientId,
    ],
    queryFn: async (): Promise<ConflictCheckResult> => {
      const response = await apiRequest('POST', '/api/event-requests/check-conflicts', {
        id: eventData.eventId,
        scheduledEventDate: eventData.scheduledEventDate
          ? (typeof eventData.scheduledEventDate === 'string'
              ? eventData.scheduledEventDate
              : eventData.scheduledEventDate.toISOString())
          : null,
        eventStartTime: eventData.eventStartTime,
        eventEndTime: eventData.eventEndTime,
        pickupTime: eventData.pickupTime,
        vanDriverNeeded: eventData.vanDriverNeeded,
        selfTransport: eventData.selfTransport,
        assignedVanDriverId: eventData.assignedVanDriverId,
        assignedSpeakerIds: eventData.assignedSpeakerIds,
        assignedRecipientIds: eventData.assignedRecipientIds,
        organizationName: eventData.organizationName,
        // Legacy fields for backwards compatibility
        vanBooked: eventData.vanBooked,
        driverName: eventData.driverName,
        recipientId: eventData.recipientId,
      });
      return response;
    },
    enabled: hasDate && eventData.enabled !== false,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}
