import React, { useState } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import { NewRequestCard } from '../cards/NewRequestCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const NewRequestsTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { confirm, ConfirmationDialogComponent } = useConfirmation();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation, updateEventRequestMutation, toggleCorporatePriorityMutation } = useEventMutations();
  const { handleStatusChange } = useEventAssignments();

  // Inline editing state
  const [editingNewRequestId, setEditingNewRequestId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [tempIsConfirmed, setTempIsConfirmed] = useState(false);

  const {
    isLoading,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setSchedulingEventRequest,
    setShowSchedulingDialog,
    setShowScheduleCallDialog,
    setToolkitEventRequest,
    setShowToolkitSentDialog,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowTspContactAssignmentDialog,
    setTspContactEventRequest,
    setShowLogContactDialog,
    setLogContactEventRequest,
    setShowAiDateSuggestionDialog,
    setAiSuggestionEventRequest,
    setShowAiIntakeAssistantDialog,
    setAiIntakeAssistantEventRequest,
    setShowIntakeCallDialog,
    setIntakeCallEventRequest,
    setShowNextActionDialog,
    setNextActionEventRequest,
    setNextActionMode,
    setShowDeclineDialog,
    setReasonDialogEventRequest,
    setShowNonEventDialog,
    setNonEventDialogEventRequest,
  } = useEventRequestContext();

  const newRequests = filterRequestsByStatus('new');

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

  // Inline editing functions
  const startEditing = (id: number, field: string, currentValue: string) => {
    setEditingNewRequestId(id);
    setEditingField(field);
    setEditingValue(currentValue || '');

    // When editing a date field, also load the current confirmation status
    if (field === 'desiredEventDate' || field === 'scheduledEventDate') {
      const eventRequest = newRequests.find(req => req.id === id);
      if (eventRequest) {
        setTempIsConfirmed(eventRequest.isConfirmed || false);
      }
    }
  };

  const saveEdit = () => {
    if (editingNewRequestId && editingField) {
      // Define the actual save logic
      const performSave = () => {
        if (editingField === 'isConfirmed') {
          // Special handling for boolean toggles
          const boolValue = editingValue === 'true';
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: { [editingField]: boolValue },
          });
        } else if (editingField === 'desiredEventDate' || editingField === 'scheduledEventDate') {
          // When saving a date field, also save the confirmation status if needed
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: {
              [editingField]: editingValue,
              isConfirmed: tempIsConfirmed,
            },
          });
        } else if (editingField === 'partnerOrganizations' || editingField.startsWith('partnerOrg_')) {
          // Special handling for partner organizations
          let partnerOrgs: Array<{ name: string; department?: string; role?: string }>;
          
          if (editingField.startsWith('partnerOrg_')) {
            // Editing a single partner organization (name + optional department)
            const index = parseInt(editingField.split('_')[1]);
            const currentEvent = eventRequests.find(r => r.id === editingNewRequestId);
            const currentPartners = Array.isArray(currentEvent?.partnerOrganizations) 
              ? (currentEvent.partnerOrganizations as any[]) 
              : [];
            partnerOrgs = [...currentPartners];

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
              // ignore parse errors
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
            id: editingNewRequestId,
            data: { partnerOrganizations: partnerOrgs.length > 0 ? partnerOrgs : [] },
          });
        } else {
          // Default handling for other fields
          updateEventRequestMutation.mutate({
            id: editingNewRequestId,
            data: { [editingField]: editingValue },
          });
        }
      };

      // Always show confirmation for inline edits
      const fieldName = editingField.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase());
      confirm(
        `Update ${fieldName}`,
        `Are you sure you want to update ${fieldName}?`,
        () => {
          performSave();
          // Reset editing state
          setEditingNewRequestId(null);
          setEditingField(null);
          setEditingValue('');
        },
        'default',
        () => {
          // Reset editing state on cancel
          setEditingNewRequestId(null);
          setEditingField(null);
          setEditingValue('');
        }
      );
    }
  };

  const cancelEdit = () => {
    setEditingNewRequestId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const handleExport = async () => {
    if (newRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no new requests to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(newRequests, 'new');
      toast({
        title: 'Export complete',
        description: `Exported ${newRequests.length} new request${newRequests.length !== 1 ? 's' : ''} to Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export requests. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Header with count and export button */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${newRequests.length} new request${newRequests.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={newRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {isLoading ? (
        <EventListSkeleton count={3} />
      ) : newRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No new event requests
        </div>
      ) : (
        <div className="space-y-4">
          {newRequests.map((request) => (
            <NewRequestCard
              key={request.id}
              request={request}
              canEdit={true}
              canDelete={true}
              onEdit={() => {
                setSelectedEventRequest(request);
                setIsEditing(true);
                setShowEventDetails(true);
              }}
              onDelete={() => deleteEventRequestMutation.mutate(request.id)}
              onCall={() => handleCall(request)}
              onIntakeCall={() => {
                setIntakeCallEventRequest(request);
                setShowIntakeCallDialog(true);
              }}
              onContact={() => {
                setContactEventRequest(request);
                setShowContactOrganizerDialog(true);
              }}
              onToolkit={() => {
                setSelectedEventRequest(request);
                setToolkitEventRequest(request);
                setShowToolkitSentDialog(true);
              }}
              onScheduleCall={() => {
                setSelectedEventRequest(request);
                setShowScheduleCallDialog(true);
              }}
              onAssignTspContact={() => {
                setTspContactEventRequest(request);
                setShowTspContactAssignmentDialog(true);
              }}
              onEditTspContact={() => {
                setTspContactEventRequest(request);
                setShowTspContactAssignmentDialog(true);
              }}
              onApprove={() => handleStatusChange(request.id, 'in_process')}
              onDecline={async () => {
                const result = await handleStatusChange(request.id, 'declined');
                if (result === 'needs_reason') {
                  setReasonDialogEventRequest(request);
                  setShowDeclineDialog(true);
                }
              }}
              onNonEvent={async () => {
                const result = await handleStatusChange(request.id, 'non_event');
                if (result === 'needs_reason') {
                  setNonEventDialogEventRequest(request);
                  setShowNonEventDialog(true);
                }
              }}
              onLogContact={() => {
                setLogContactEventRequest(request);
                setShowLogContactDialog(true);
              }}
              onAiSuggest={() => {
                setAiSuggestionEventRequest(request);
                setShowAiDateSuggestionDialog(true);
              }}
              onAiIntakeAssist={() => {
                setAiIntakeAssistantEventRequest(request);
                setShowAiIntakeAssistantDialog(true);
              }}
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
              onToggleCorporatePriority={(isCorporatePriority) => {
                toggleCorporatePriorityMutation.mutate({
                  id: request.id,
                  isCorporatePriority
                });
              }}
              // Inline editing props
              startEditing={(field, value) => startEditing(request.id, field, value)}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              setEditingValue={setEditingValue}
              isEditingThisCard={editingNewRequestId === request.id}
              editingField={editingField || ''}
              editingValue={editingValue}
              tempIsConfirmed={tempIsConfirmed}
            />
          ))}
        </div>
      )}
      {ConfirmationDialogComponent}
    </>
  );
};
