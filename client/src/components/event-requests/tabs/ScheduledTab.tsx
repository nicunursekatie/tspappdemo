import React, { useState, useEffect, useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAnalytics } from '@/hooks/useAnalytics';
import { ScheduledCardEnhanced } from '../cards/ScheduledCardEnhanced';
import { RescheduleDialog } from '../dialogs/RescheduleDialog';
import { parseSandwichTypes, stringifySandwichTypes } from '@/lib/sandwich-utils';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import type { EventRequest } from '@shared/schema';
import { ScheduledSpreadsheetView } from '../views/ScheduledSpreadsheetView';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Table2, Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { BatchedCollaborationProvider } from '@/contexts/batched-collaboration-context';
import { EventListSkeleton } from '../EventCardSkeleton';

export const ScheduledTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { trackEvent, trackButtonClick } = useAnalytics();
  const { confirm, ConfirmationDialogComponent } = useConfirmation();
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleRequest, setRescheduleRequest] = useState<EventRequest | null>(null);

  // Default to card view for all devices
  const [viewMode, setViewMode] = useState<'card' | 'spreadsheet'>(() => {
    return 'card';
  });
  const [viewStartTime, setViewStartTime] = useState<number>(Date.now());

  // State for confirmation checkbox when editing dates
  const [tempIsConfirmed, setTempIsConfirmed] = useState(false);

  // Track when user first lands on scheduled tab
  useEffect(() => {
    trackEvent('scheduled_tab_viewed', {
      default_view: 'card',
      is_default: true,
      is_mobile: isMobile,
      timestamp: new Date().toISOString(),
    });
    setViewStartTime(Date.now());
  }, [trackEvent, isMobile]);

  // Track view mode changes and time spent in each view
  const handleViewModeChange = (newMode: 'card' | 'spreadsheet') => {
    const timeSpent = Date.now() - viewStartTime;

    // Track time spent in previous view
    trackEvent('view_mode_duration', {
      view_mode: viewMode,
      duration_seconds: Math.round(timeSpent / 1000),
      switched_to: newMode,
    });

    // Track the switch
    trackEvent('view_mode_changed', {
      from: viewMode,
      to: newMode,
      tab: 'scheduled',
      timestamp: new Date().toISOString(),
    });

    trackButtonClick(`switch_to_${newMode}_view`, 'event_requests_scheduled_tab');

    setViewMode(newMode);
    setViewStartTime(Date.now());
  };

  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation, updateScheduledFieldMutation, rescheduleEventMutation } = useEventMutations();
  const {
    handleStatusChange,
    openAssignmentDialog,
    openEditAssignmentDialog,
    handleRemoveAssignment,
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
    resolveUserName,
    resolveRecipientName,
  } = useEventAssignments();

  const {
    eventRequests,
    isLoading,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setSchedulingEventRequest,
    setShowSchedulingDialog,
    setShowCollectionLog,
    setCollectionLogEventRequest,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowOneDayFollowUpDialog,
    setShowOneMonthFollowUpDialog,
    setTspContactEventRequest,
    setShowTspContactAssignmentDialog,
    setShowLogContactDialog,
    setLogContactEventRequest,
    setShowAiIntakeAssistantDialog,
    setAiIntakeAssistantEventRequest,
    // Next Action dialog state
    setShowNextActionDialog,
    setNextActionEventRequest,
    setNextActionMode,

    // Inline editing states - IMPORTANT for scheduled tab
    editingScheduledId,
    setEditingScheduledId,
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
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
  } = useEventRequestContext();

  // Include both 'scheduled' and 'rescheduled' events on the Scheduled tab
  const scheduledOnly = filterRequestsByStatus('scheduled');
  const rescheduledOnly = filterRequestsByStatus('rescheduled');
  const scheduledRequests = [...scheduledOnly, ...rescheduledOnly];

  // Memoize event IDs for batched collaboration data fetching
  const scheduledEventIds = useMemo(
    () => scheduledRequests.map(r => r.id),
    [scheduledRequests]
  );

  // Inline editing functions - SPECIFIC to scheduled tab
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingScheduledId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    // When editing a date field, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        setTempIsConfirmed(eventRequest.isConfirmed || false);
      }
    }

    // Special handling for sandwich types
    if (field === 'sandwichTypes') {
      const eventRequest = eventRequests.find(req => req.id === id);
      if (eventRequest) {
        const existingSandwichTypes = parseSandwichTypes(eventRequest.sandwichTypes) || [];
        const hasTypesData = existingSandwichTypes.length > 0;
        const hasRangeData = (eventRequest as any).estimatedSandwichCountMin && (eventRequest as any).estimatedSandwichCountMax;
        const totalCount = eventRequest.estimatedSandwichCount || 0;

        setInlineSandwichMode(hasTypesData ? 'types' : hasRangeData ? 'range' : 'total');
        setInlineTotalCount(totalCount);
        setInlineSandwichTypes(hasTypesData ? existingSandwichTypes : []);

        // Set range values if range data exists
        if (hasRangeData) {
          setInlineRangeMin((eventRequest as any).estimatedSandwichCountMin || 0);
          setInlineRangeMax((eventRequest as any).estimatedSandwichCountMax || 0);
          setInlineRangeType((eventRequest as any).estimatedSandwichRangeType || '');
        }
      }
    }
  };

  const saveEdit = () => {
    if (editingScheduledId && editingField) {
      // Define the actual save logic
      const performSave = () => {

      // Special handling for sandwich types
      if (editingField === 'sandwichTypes') {
        const updateData: any = {};

        if (inlineSandwichMode === 'total') {
          updateData.estimatedSandwichCount = inlineTotalCount;
          updateData.sandwichTypes = null;
          updateData.estimatedSandwichCountMin = null;
          updateData.estimatedSandwichCountMax = null;
          updateData.estimatedSandwichRangeType = null;
        } else if (inlineSandwichMode === 'range') {
          updateData.estimatedSandwichCountMin = inlineRangeMin;
          updateData.estimatedSandwichCountMax = inlineRangeMax;
          updateData.estimatedSandwichRangeType = inlineRangeType || null;
          updateData.estimatedSandwichCount = null;
          updateData.sandwichTypes = null;
        } else {
          updateData.sandwichTypes = stringifySandwichTypes(inlineSandwichTypes);
          updateData.estimatedSandwichCount = inlineSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
          updateData.estimatedSandwichCountMin = null;
          updateData.estimatedSandwichCountMax = null;
          updateData.estimatedSandwichRangeType = null;
        }

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: updateData,
        });
      } else if (editingField === 'hasRefrigeration') {
        // Special handling for refrigeration
        let refrigerationValue: boolean | null;
        if (editingValue === 'true') {
          refrigerationValue = true;
        } else if (editingValue === 'false') {
          refrigerationValue = false;
        } else {
          refrigerationValue = null;
        }

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { hasRefrigeration: refrigerationValue },
        });
      } else if (editingField === 'isConfirmed' || editingField === 'addedToOfficialSheet' || editingField === 'selfTransport') {
        // Special handling for boolean toggles
        const boolValue = editingValue === 'true';
        const updateData: any = { [editingField]: boolValue };

        // When setting selfTransport to true, clear driversNeeded
        if (editingField === 'selfTransport' && boolValue) {
          updateData.driversNeeded = 0;
        }

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: updateData,
        });
      } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
        // When saving a date field, also save the confirmation status
        // Completed events are always confirmed
        const eventRequest = eventRequests.find(r => r.id === editingScheduledId);
        const isCompleted = eventRequest?.status === 'completed';

        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: {
            [editingField]: editingValue,
            isConfirmed: isCompleted ? true : tempIsConfirmed
          },
        });
      } else if (editingField === 'assignedRecipientIds') {
        // Special handling for assignedRecipientIds - parse JSON string to array
        const recipientIds = JSON.parse(editingValue);
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { assignedRecipientIds: recipientIds },
        });
      } else if (editingField === 'attendanceBreakdown') {
        // Special handling for attendance breakdown - parse comma-separated values
        const [adults, teens, kids] = editingValue.split(',').map(v => {
          const parsed = parseInt(v);
          return isNaN(parsed) ? null : parsed;
        });
        const total = (adults || 0) + (teens || 0) + (kids || 0);
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: {
            attendanceAdults: adults,
            attendanceTeens: teens,
            attendanceKids: kids,
            estimatedAttendance: total > 0 ? total : null,
          },
        });
      } else if (editingField === 'partnerOrganizations' || editingField.startsWith('partnerOrg_')) {
        // Special handling for partner organizations
        let partnerOrgs: Array<{ name: string; department?: string; role?: string }>;
        
        if (editingField.startsWith('partnerOrg_')) {
          // Editing a single partner organization (name + optional department)
          const index = parseInt(editingField.split('_')[1]);
          const currentEvent = eventRequests.find(r => r.id === editingScheduledId);
          const currentPartners = Array.isArray(currentEvent?.partnerOrganizations) 
            ? (currentEvent.partnerOrganizations as any[]) 
            : [];
          partnerOrgs = [...currentPartners];

          // Parse combined payload if provided as JSON (name/department)
          let parsed = { name: editingValue?.trim?.() || '', department: '' };
          try {
            const maybe = JSON.parse(editingValue);
            if (maybe && typeof maybe === 'object') {
              parsed = {
                name: (maybe as any).name?.toString().trim() || '',
                department: (maybe as any).department?.toString() || '',
              };
            }
          } catch {
            // ignore parse errors, fallback to trimmed string as name
          }

          const target = partnerOrgs[index] || {};
          const updated = {
            ...target,
            name: parsed.name || target.name || '',
            department: parsed.department ?? target.department ?? '',
            role: target.role || 'partner',
          };

          if (partnerOrgs[index]) {
            partnerOrgs[index] = updated;
          } else if (updated.name) {
            partnerOrgs.push(updated);
          }
        } else {
          // Editing the full array
          try {
            partnerOrgs = JSON.parse(editingValue);
          } catch {
            partnerOrgs = [];
          }
        }
        
        // Filter out empty partners (where name is empty or just whitespace)
        partnerOrgs = partnerOrgs.filter(p => p && p.name && p.name.trim() !== '');
        
        // Ensure each partner has a role
        partnerOrgs = partnerOrgs.map(p => ({
          ...p,
          role: p.role || 'partner'
        }));
        
        // Send the update - use empty array instead of null to ensure it's saved
        updateEventRequestMutation.mutate({
          id: editingScheduledId,
          data: { partnerOrganizations: partnerOrgs.length > 0 ? partnerOrgs : [] },
        });
      } else {
        // Regular field update
        const numericFields = ['driversNeeded', 'speakersNeeded', 'volunteersNeeded'];
        const valueToSend = numericFields.includes(editingField)
          ? (editingValue === '' ? null : Number(editingValue))
          : editingValue;
        updateScheduledFieldMutation.mutate({
          id: editingScheduledId,
          field: editingField,
          value: valueToSend as any,
        });
      }
      };

      // Check if this is a critical field that requires confirmation
      const criticalFields = ['eventStartTime', 'eventEndTime', 'pickupTime', 'pickupDateTime', 'overnightPickupTime', 'eventAddress', 'overnightHoldingLocation', 'deliveryDestination', 'hasRefrigeration', 'driversNeeded', 'volunteersNeeded'];

      if (criticalFields.includes(editingField)) {
        const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
        confirm(
          `Update ${fieldName}`,
          `Are you sure you want to update ${fieldName}? This will change the event details and may affect planning.`,
          () => {
            performSave();
            cancelEdit();
          },
          'default',
          () => {
            // Cancel callback: reset editing state
            cancelEdit();
          }
        );
      } else {
        // For non-critical fields, save directly
        performSave();
        cancelEdit();
      }
    }
  };

  const cancelEdit = () => {
    setEditingScheduledId(null);
    setEditingField(null);
    setEditingValue('');
    setInlineSandwichMode('total');
    setInlineTotalCount(0);
    setInlineSandwichTypes([]);
  };

  // Batch save function for saving multiple time fields at once (used by TimeDialogContent)
  const saveTimes = (requestId: number, data: { eventStartTime?: string; eventEndTime?: string; pickupDateTime?: string }) => {
    updateEventRequestMutation.mutate({
      id: requestId,
      data,
    });
    cancelEdit();
  };

  const addInlineSandwichType = () => {
    setInlineSandwichTypes(prev => [...prev, { type: 'turkey', quantity: 0 }]);
  };

  const updateInlineSandwichType = (index: number, field: 'type' | 'quantity', value: string | number) => {
    setInlineSandwichTypes(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeInlineSandwichType = (index: number) => {
    setInlineSandwichTypes(prev => prev.filter((_, i) => i !== index));
  };

  const quickToggleBoolean = (id: number, field: 'isConfirmed' | 'addedToOfficialSheet', currentValue: boolean) => {
    const data: Record<string, any> = { [field]: !currentValue };
    // Track when the event was added to the official sheet
    if (field === 'addedToOfficialSheet') {
      data.addedToOfficialSheetAt = !currentValue ? new Date().toISOString() : null;
    }
    updateEventRequestMutation.mutate({ id, data });
  };

  const handleCall = (request: any) => {
    const phoneNumber = request.phone;

    if (isMobile) {
      window.location.href = `tel:${phoneNumber}`;
    } else {
      navigator.clipboard.writeText(phoneNumber || '').then(() => {
        toast({
          title: 'Phone number copied!',
          description: `${phoneNumber} has been copied to your clipboard.`,
        });
      }).catch(() => {
        toast({
          title: 'Failed to copy',
          description: 'Please copy manually: ' + phoneNumber,
          variant: 'destructive',
        });
      });
    }
  };

  const handleReschedule = (request: EventRequest) => {
    setRescheduleRequest(request);
    setShowRescheduleDialog(true);
  };

  const performReschedule = async (eventId: number, data: {
    status: string;
    scheduledEventDate: string;
    originalScheduledDate?: string | Date | null;
    postponementNotes?: string;
  }) => {
    await updateEventRequestMutation.mutateAsync({ id: eventId, data });
    setShowRescheduleDialog(false);
    setRescheduleRequest(null);
  };

  const handleExport = async () => {
    if (scheduledRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no scheduled events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(scheduledRequests, 'scheduled');
      toast({
        title: 'Export complete',
        description: `Exported ${scheduledRequests.length} scheduled event${scheduledRequests.length !== 1 ? 's' : ''} to Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export events. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* View Toggle - Always visible on scheduled tab */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${scheduledRequests.length} scheduled event${scheduledRequests.length !== 1 ? 's' : ''}`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={scheduledRequests.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            variant={viewMode === 'card' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('card')}
            className="flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Card View
          </Button>
          <Button
            variant={viewMode === 'spreadsheet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('spreadsheet')}
            className="flex items-center gap-2"
          >
            <Table2 className="h-4 w-4" />
            Spreadsheet View
          </Button>
        </div>
      </div>

      {viewMode === 'spreadsheet' ? (
        <ScheduledSpreadsheetView
          onEventDateClick={(event) => {
            setSelectedEventRequest(event);
            trackEvent('scheduled_tab_view_mode_toggle', {
              view_mode: 'card',
              previous_mode: 'spreadsheet',
              source: 'spreadsheet_event_click',
              event_id: event.id,
            });
            setViewMode('card');
            // Scroll to the card after React has rendered the card view
            setTimeout(() => {
              const cardElement = document.querySelector(`[data-event-id="${event.id}"]`);
              if (cardElement) {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                // If card not found, try again after a longer delay
                setTimeout(() => {
                  const retryElement = document.querySelector(`[data-event-id="${event.id}"]`);
                  if (retryElement) {
                    retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }, 200);
              }
            }, 150);
          }}
          openAssignmentDialog={openAssignmentDialog}
        />
      ) : isLoading ? (
        <EventListSkeleton count={5} />
      ) : scheduledRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No scheduled events
        </div>
      ) : (
        <BatchedCollaborationProvider eventIds={scheduledEventIds}>
          <div className="space-y-4 max-w-7xl mx-auto px-4">
            {scheduledRequests.map((request) => (
              <div key={request.id} className="w-full" data-event-id={request.id}>
                <ScheduledCardEnhanced
                request={request}
                editingField={editingField}
                editingValue={editingValue}
                isEditingThisCard={editingScheduledId === request.id}
                inlineSandwichMode={inlineSandwichMode}
                inlineTotalCount={inlineTotalCount}
                inlineSandwichTypes={inlineSandwichTypes}
                inlineRangeMin={inlineRangeMin}
                inlineRangeMax={inlineRangeMax}
                inlineRangeType={inlineRangeType}
                isSaving={updateEventRequestMutation.isPending || updateScheduledFieldMutation.isPending}
                onEdit={() => {
                  setSelectedEventRequest(request);
                  setIsEditing(true);
                  setShowEventDetails(true);
                }}
                onDelete={() => deleteEventRequestMutation.mutate(request.id)}
                onContact={() => {
                  setContactEventRequest(request);
                  setShowContactOrganizerDialog(true);
                }}
                onLogContact={() => {
                  setLogContactEventRequest(request);
                  setShowLogContactDialog(true);
                }}
                onFollowUp={() => {
                  setShowOneDayFollowUpDialog(true);
                }}
                onReschedule={() => {
                  setRescheduleRequest(request);
                  setShowRescheduleDialog(true);
                }}
                onAssignTspContact={() => {
                  setTspContactEventRequest(request);
                  setShowTspContactAssignmentDialog(true);
                }}
                onEditTspContact={() => {
                  setTspContactEventRequest(request);
                  setShowTspContactAssignmentDialog(true);
                }}
                onAiIntakeAssist={() => {
                  setAiIntakeAssistantEventRequest(request);
                  setShowAiIntakeAssistantDialog(true);
                }}
                startEditing={(field, value) => startEditing(request.id, field, value)}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                setEditingValue={setEditingValue}
                saveTimes={(data) => saveTimes(request.id, data)}
                tempIsConfirmed={tempIsConfirmed}
                setTempIsConfirmed={setTempIsConfirmed}
                quickToggleBoolean={(field, value) => quickToggleBoolean(request.id, field, value)}
                setInlineSandwichMode={setInlineSandwichMode}
                setInlineTotalCount={setInlineTotalCount}
                setInlineRangeMin={setInlineRangeMin}
                setInlineRangeMax={setInlineRangeMax}
                setInlineRangeType={setInlineRangeType}
                addInlineSandwichType={addInlineSandwichType}
                updateInlineSandwichType={updateInlineSandwichType}
                removeInlineSandwichType={removeInlineSandwichType}
                resolveUserName={resolveUserName}
                resolveRecipientName={resolveRecipientName}
                openAssignmentDialog={(type, isVanDriver) => openAssignmentDialog(request.id, type, isVanDriver)}
                handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
                canEdit={true}
                onAddNextAction={() => {
                  setNextActionEventRequest(request);
                  setNextActionMode('add');
                  setShowNextActionDialog(true);
                }}
                onEditNextAction={() => {
                  setNextActionEventRequest(request);
                  setNextActionMode('edit');
                  setShowNextActionDialog(true);
                }}
                onCompleteNextAction={() => {
                  setNextActionEventRequest(request);
                  setNextActionMode('complete');
                  setShowNextActionDialog(true);
                }}
              />
              </div>
            ))}
          </div>
        </BatchedCollaborationProvider>
      )}

      {/* Floating Action Button for Quick View Toggle */}
      {scheduledRequests.length > 0 && !isMobile && (
        <button
          onClick={() => {
            const newMode = viewMode === 'spreadsheet' ? 'card' : 'spreadsheet';
            trackEvent('scheduled_tab_view_mode_toggle', {
              view_mode: newMode,
              previous_mode: viewMode,
              source: 'floating_action_button',
            });
            setViewMode(newMode);
          }}
          className="fixed bottom-24 right-24 z-40 bg-[#007E8C] text-white p-4 rounded-full shadow-lg hover:bg-[#005f6b] transition-all duration-200 hover:scale-110 active:scale-95 flex items-center gap-2"
          title={viewMode === 'spreadsheet' ? 'Switch to Card View' : 'Switch to Spreadsheet View'}
          aria-label={viewMode === 'spreadsheet' ? 'Switch to Card View' : 'Switch to Spreadsheet View'}
        >
          {viewMode === 'spreadsheet' ? (
            <LayoutGrid className="h-5 w-5" />
          ) : (
            <Table2 className="h-5 w-5" />
          )}
        </button>
      )}

    <RescheduleDialog
      isOpen={showRescheduleDialog}
      onClose={() => {
        setShowRescheduleDialog(false);
        setRescheduleRequest(null);
      }}
      request={rescheduleRequest}
      onConfirm={performReschedule}
    />
    {ConfirmationDialogComponent}
  </>
  );
};
