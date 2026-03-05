import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, invalidateEventRequestQueries } from '@/lib/queryClient';
import { useEventRequestContext } from '../context/EventRequestContext';
import { logger } from '@/lib/logger';

export const useEventMutations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    selectedEventRequest,
    setSelectedEventRequest,
    setShowEventDetails,
    setIsEditing,
    setShowToolkitSentDialog,
    setToolkitEventRequest,
    setShowScheduleCallDialog,
    setScheduleCallDate,
    setScheduleCallTime,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setFollowUpNotes,
    setEditingScheduledId,
    setEditingField,
    setEditingValue,
  } = useEventRequestContext();

  const deleteEventRequestMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/event-requests/${id}`),
    onSuccess: async (_, deletedId) => {
      const { dismiss } = toast({
        title: 'Event request deleted',
        description: 'Click Undo to restore',
        duration: 10000,
        action: (
          <button
            onClick={async () => {
              try {
                await apiRequest('POST', `/api/event-requests/${deletedId}/restore`);
                await invalidateEventRequestQueries(queryClient);
                dismiss();
                toast({
                  title: 'Event request restored',
                  description: 'The event request has been successfully restored.',
                });
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to restore event request.',
                  variant: 'destructive',
                });
              }
            }}
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Undo
          </button>
        ),
      });
      await invalidateEventRequestQueries(queryClient);
      setShowEventDetails(false);
      setSelectedEventRequest(null);
    },
    onError: (error: any) => {
      const errorMessage = error?.data?.message || error?.message || 'Failed to delete event request.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const updateEventRequestMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => {
      logger.log('=== UPDATE MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Data being sent:', JSON.stringify(data, null, 2));

      // Include optimistic locking version if we have the selected event's updatedAt
      // This prevents silent overwrites when two users edit the same event.
      // _skipVersionCheck bypasses this for additive-only updates (e.g. contact logs)
      // where two users saving simultaneously cannot produce a conflict.
      const { _skipVersionCheck, ...rest } = data;
      const payload = { ...rest };
      if (!_skipVersionCheck && selectedEventRequest?.updatedAt) {
        payload._expectedVersion = selectedEventRequest.updatedAt;
      }

      return apiRequest('PATCH', `/api/event-requests/${id}`, payload);
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== UPDATE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);
      logger.log('Variables:', variables);

      const orgName = updatedEvent?.organizationName || 'Event';
      toast({
        title: '✓ Changes Saved Successfully',
        description: `Your changes to "${orgName}" have been saved to the database.`,
        duration: 8000,
      });

      // Await query invalidation so the UI has fresh data before we close the dialog
      await invalidateEventRequestQueries(queryClient);

      setShowEventDetails(false);
      setSelectedEventRequest(null);
      setIsEditing(false);

      // Clear inline editing state as well
      setEditingScheduledId(null);
      setEditingField(null);
      setEditingValue('');
    },
    onError: (error: any) => {
      logger.error('Update event request error:', error);

      // Check for network/timeout errors
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');

      // Check for optimistic locking conflict (409)
      const isConflict = error?.status === 409 || error?.code?.includes('CONFLICT');

      let errorTitle = 'Save Failed';

      // Extract detailed error message from server response (ApiError.data)
      const serverMessage = error?.data?.message ||
                           error?.message ||
                           error?.details;

      // Check for missing fields info from server
      const missingFields = error?.data?.missingFields;

      let errorDescription = serverMessage || 'Failed to update event request. Please check your data and try again.';

      // If server provided missing fields, include them in the message
      if (missingFields && Array.isArray(missingFields) && missingFields.length > 0) {
        errorDescription = `${serverMessage || 'Missing required fields:'} ${missingFields.join(', ')}`;
      }

      if (isConflict) {
        errorTitle = 'Edit Conflict';
        errorDescription = 'This event was modified by another user. The page will refresh with the latest data.';
        // Refresh the data so the user sees the latest version
        invalidateEventRequestQueries(queryClient);
      } else if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = 'Could not save changes. Please check your internet connection and try again.';
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
    mutationFn: async (data: any) => {
      logger.log('=== CREATE EVENT MUTATION STARTED ===');
      logger.log('Data being sent:', JSON.stringify(data, null, 2));
      const result = await apiRequest('POST', '/api/event-requests', data);
      logger.log('=== CREATE EVENT API RESPONSE ===');
      logger.log('Response:', result);
      return result;
    },
    onSuccess: async (data) => {
      logger.log('=== CREATE EVENT SUCCESS HANDLER ===');
      logger.log('Created event:', data);

      const orgName = data?.organizationName || 'New event';
      toast({
        title: '✓ Event Created Successfully',
        description: `"${orgName}" has been created and saved to the database.`,
        duration: 8000,
      });

      // Await query invalidation so the list reflects the new event
      await invalidateEventRequestQueries(queryClient);

      setShowEventDetails(false);
      setSelectedEventRequest(null);
      setIsEditing(false);
    },
    onError: (error: any) => {
      logger.error('Create event request error:', error);

      // Check for network/timeout errors
      const isNetworkError = error?.message?.includes('Failed to fetch') ||
                            error?.message?.includes('Request timeout') ||
                            error?.code?.includes('NETWORK_ERROR');

      let errorTitle = 'Creation Failed';
      let errorDescription = error?.data?.message || error?.message || 'Failed to create event request. Please check your data and try again.';

      if (isNetworkError) {
        errorTitle = 'Connection Error';
        errorDescription = 'Could not create event. Please check your internet connection and try again.';
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: 'destructive',
        duration: 10000,
      });
    },
  });

  const markToolkitSentMutation = useMutation({
    mutationFn: ({
      id,
      toolkitSentDate,
      contactAttempt,
    }: {
      id: number;
      toolkitSentDate: string;
      contactAttempt?: {
        method: string;
        outcome: string;
        notes?: string;
      };
    }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/toolkit-sent`, {
        toolkitSentDate,
        contactAttempt,
      }),
    onSuccess: async (updatedEvent, variables) => {
      const message = variables.contactAttempt
        ? 'Toolkit marked as sent and phone call logged.'
        : 'Event status updated to "In Process".';
      toast({
        title: 'Toolkit marked as sent',
        description: message,
      });
      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after toolkit sent:', error);
        }
      }

      setShowToolkitSentDialog(false);
      setToolkitEventRequest(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to mark toolkit as sent.',
        variant: 'destructive',
      });
    },
  });

  const scheduleCallMutation = useMutation({
    mutationFn: ({
      id,
      scheduledCallDate,
    }: {
      id: number;
      scheduledCallDate: string;
    }) =>
      apiRequest('PATCH', `/api/event-requests/${id}/schedule-call`, {
        scheduledCallDate,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Call scheduled',
        description: 'Call has been scheduled successfully.',
      });

      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after call scheduled:', error);
        }
      }

      setShowScheduleCallDialog(false);
      setScheduleCallDate('');
      setScheduleCallTime('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to schedule call.',
        variant: 'destructive',
      });
    },
  });

  const updateScheduledFieldMutation = useMutation({
    mutationFn: ({
      id,
      field,
      value,
    }: {
      id: number;
      field: string;
      value: any;
    }) => apiRequest('PATCH', `/api/event-requests/${id}`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      // Cancel outgoing fetches so we can optimistically update
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests'] });
      await queryClient.cancelQueries({ queryKey: ['/api/event-requests', 'v2'] });

      const patchList = (data: any) => {
        if (!data) return data;
        const patchArray = (arr: any[]) =>
          arr.map((item) => (item?.id === id ? { ...item, [field]: value } : item));

        if (Array.isArray(data)) return patchArray(data);
        if (Array.isArray(data?.requests)) return { ...data, requests: patchArray(data.requests) };
        if (Array.isArray(data?.items)) return { ...data, items: patchArray(data.items) };
        return data;
      };

      const previousV1 = queryClient.getQueryData(['/api/event-requests']);
      const previousV2 = queryClient.getQueryData(['/api/event-requests', 'v2']);

      queryClient.setQueryData(['/api/event-requests'], (data) => patchList(data));
      queryClient.setQueryData(['/api/event-requests', 'v2'], (data) => patchList(data));

      return { previousV1, previousV2 };
    },
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: 'Field updated',
        description: 'Event field has been updated successfully.',
      });

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after field update:', error);
        }
      }

      setEditingScheduledId(null);
      setEditingField(null);
      setEditingValue('');
    },
    onError: (_error, _vars, context) => {
      // Roll back optimistic update
      if (context?.previousV1) {
        queryClient.setQueryData(['/api/event-requests'], context.previousV1);
      }
      if (context?.previousV2) {
        queryClient.setQueryData(['/api/event-requests', 'v2'], context.previousV2);
      }
      toast({
        title: 'Error',
        description: 'Failed to update field.',
        variant: 'destructive',
      });
    },
    // Refetch once in onSettled (covers both success and error paths).
    // Removed duplicate invalidation that was in onSuccess.
    onSettled: () => {
      invalidateEventRequestQueries(queryClient);
    },
  });

  const oneDayFollowUpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        followUpOneDayCompleted: true,
        followUpOneDayDate: new Date().toISOString(),
        followUpNotes: notes,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: '1-day follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after 1-day follow-up:', error);
        }
      }

      setShowOneDayFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    },
  });

  const oneMonthFollowUpMutation = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        followUpOneMonthCompleted: true,
        followUpOneMonthDate: new Date().toISOString(),
        followUpNotes: notes,
      }),
    onSuccess: async (updatedEvent, variables) => {
      toast({
        title: '1-month follow-up completed',
        description: 'Follow-up has been marked as completed.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data after 1-month follow-up:', error);
        }
      }

      setShowOneMonthFollowUpDialog(false);
      setFollowUpNotes('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to complete follow-up.',
        variant: 'destructive',
      });
    },
  });

  const rescheduleEventMutation = useMutation({
    mutationFn: ({ id, newDate, previousDate }: { id: number; newDate: Date; previousDate?: string | null }) =>
      apiRequest('PATCH', `/api/event-requests/${id}`, {
        scheduledEventDate: newDate.toISOString(),
      }),
    onSuccess: (_, variables) => {
      const { id, newDate, previousDate } = variables;
      const newDateStr = newDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const prevDateStr = previousDate
        ? new Date(previousDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

      // Show toast with undo action if we have a previous date
      if (previousDate) {
        const { dismiss } = toast({
          title: 'Event rescheduled',
          description: `Date changed to ${newDateStr}. Click Undo to restore.`,
          duration: 10000,
          action: (
            <button
              onClick={async () => {
                try {
                  await apiRequest('PATCH', `/api/event-requests/${id}`, {
                    scheduledEventDate: previousDate,
                  });
                  invalidateEventRequestQueries(queryClient);
                  dismiss();
                  toast({
                    title: 'Date restored',
                    description: `Event date restored to ${prevDateStr}.`,
                  });
                } catch (error) {
                  toast({
                    title: 'Restore failed',
                    description: 'Failed to restore event date.',
                    variant: 'destructive',
                  });
                }
              }}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              Undo
            </button>
          ),
        });
      } else {
        toast({
          title: 'Event rescheduled',
          description: `The event date has been set to ${newDateStr}.`,
        });
      }

      // Invalidate all event request queries to refresh UI
      invalidateEventRequestQueries(queryClient);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.data?.message || error?.message || 'Failed to reschedule event.',
        variant: 'destructive',
      });
    },
  });

  // Recipient assignment mutation - uses the specific recipients endpoint
  const assignRecipientsMutation = useMutation({
    mutationFn: ({ id, assignedRecipientIds, recipientAllocations }: {
      id: number;
      assignedRecipientIds?: string[];
      recipientAllocations?: Array<{
        recipientId: string;
        recipientName: string;
        sandwichCount: number;
        sandwichType?: string;
        notes?: string;
      }>;
    }) => {
      logger.log('=== RECIPIENT ASSIGNMENT MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Recipient IDs:', assignedRecipientIds);
      logger.log('Recipient Allocations:', recipientAllocations);
      return apiRequest('PATCH', `/api/event-requests/${id}/recipients`, { assignedRecipientIds, recipientAllocations });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== RECIPIENT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      toast({
        title: 'Recipients assigned',
        description: 'Recipients have been successfully assigned to this event.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== RECIPIENT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign recipients',
        description: error?.data?.message || error?.message || 'There was an error assigning recipients to this event.',
        variant: 'destructive',
      });
    },
  });

  // TSP contact assignment mutation - uses the specific tsp-contact endpoint
  const assignTspContactMutation = useMutation({
    mutationFn: ({ id, tspContact, customTspContact }: { id: number; tspContact?: string | null; customTspContact?: string | null }) => {
      logger.log('=== TSP CONTACT ASSIGNMENT MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('TSP Contact:', tspContact);
      logger.log('Custom TSP Contact:', customTspContact);
      return apiRequest('PATCH', `/api/event-requests/${id}/tsp-contact`, { tspContact, customTspContact });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== TSP CONTACT ASSIGNMENT SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const description = variables.tspContact
        ? 'TSP contact has been successfully assigned and notified via email.'
        : 'Custom TSP contact has been successfully assigned.';

      toast({
        title: 'TSP contact assigned',
        description,
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== TSP CONTACT ASSIGNMENT ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to assign TSP contact',
        description: error?.data?.message || error?.message || 'There was an error assigning the TSP contact to this event.',
        variant: 'destructive',
      });
    },
  });

  // Corporate priority toggle mutation
  const toggleCorporatePriorityMutation = useMutation({
    mutationFn: ({ id, isCorporatePriority, coreTeamMemberNotes }: {
      id: number;
      isCorporatePriority: boolean;
      coreTeamMemberNotes?: string;
    }) => {
      logger.log('=== CORPORATE PRIORITY TOGGLE MUTATION ===');
      logger.log('Event ID:', id);
      logger.log('Corporate Priority:', isCorporatePriority);
      return apiRequest('PATCH', `/api/event-requests/${id}/corporate-priority`, {
        isCorporatePriority,
        coreTeamMemberNotes
      });
    },
    onSuccess: async (updatedEvent, variables) => {
      logger.log('=== CORPORATE PRIORITY TOGGLE SUCCESS ===');
      logger.log('Updated event:', updatedEvent);

      const action = variables.isCorporatePriority ? 'marked as' : 'removed from';
      toast({
        title: `Event ${action} Corporate Priority`,
        description: variables.isCorporatePriority
          ? 'Christine and Katie have been notified. This event requires immediate attention and core team member assignment.'
          : 'This event is no longer marked as corporate priority.',
      });

      invalidateEventRequestQueries(queryClient);

      if (selectedEventRequest && selectedEventRequest.id === variables.id) {
        try {
          const freshEventData = await apiRequest('GET', `/api/event-requests/${variables.id}`);
          setSelectedEventRequest(freshEventData);
        } catch (error) {
          logger.error('Failed to fetch updated event data:', error);
        }
      }
    },
    onError: (error: any) => {
      logger.error('=== CORPORATE PRIORITY TOGGLE ERROR ===');
      logger.error(error);

      toast({
        title: 'Failed to update corporate priority',
        description: error?.data?.message || error?.message || 'There was an error updating the corporate priority status.',
        variant: 'destructive',
      });
    },
  });

  return {
    deleteEventRequestMutation,
    updateEventRequestMutation,
    createEventRequestMutation,
    markToolkitSentMutation,
    scheduleCallMutation,
    updateScheduledFieldMutation,
    oneDayFollowUpMutation,
    oneMonthFollowUpMutation,
    rescheduleEventMutation,
    assignRecipientsMutation,
    assignTspContactMutation,
    toggleCorporatePriorityMutation,
  };
};
