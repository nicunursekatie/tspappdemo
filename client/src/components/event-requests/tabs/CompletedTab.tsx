import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { CompletedCard } from '../cards/CompletedCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const CompletedTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const {
    handleStatusChange,
    resolveUserName,
    openAssignmentDialog,
    openEditAssignmentDialog,
    handleRemoveAssignment,
    handleSelfSignup,
    canSelfSignup,
    isUserSignedUp,
  } = useEventAssignments();

  const {
    isLoading,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
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
  } = useEventRequestContext();

  const completedRequests = filterRequestsByStatus('completed') || [];

  const handleExport = async () => {
    if (completedRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no completed events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(completedRequests, 'completed');
      toast({
        title: 'Export complete',
        description: `Exported ${completedRequests.length} completed event${completedRequests.length !== 1 ? 's' : ''} to Excel.`,
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
      {/* Header with count and export button */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${completedRequests.length} completed event${completedRequests.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={completedRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <EventListSkeleton count={5} />
        ) : completedRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No completed events
          </div>
        ) : (
        completedRequests.map((request) => (
          <CompletedCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onEdit={() => {
              setSelectedEventRequest(request);
              setIsEditing(true);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (
                window.confirm(
                  'Are you sure you want to delete this completed event? This action cannot be undone.'
                )
              ) {
                deleteEventRequestMutation.mutate(request.id, {
                  onSuccess: () => {
                    toast({
                      title: 'Deleted',
                      description: 'The completed event was deleted.',
                    });
                  },
                  onError: (err: unknown) => {
                    toast({
                      variant: 'destructive',
                      title: 'Delete failed',
                      description:
                        err instanceof Error ? err.message : 'Unknown error',
                    });
                  },
                });
              }
            }}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onFollowUp1Day={() => {
              setSelectedEventRequest(request);
              setShowOneDayFollowUpDialog(true);
            }}
            onFollowUp1Month={() => {
              setSelectedEventRequest(request);
              setShowOneMonthFollowUpDialog(true);
            }}
            onViewCollectionLog={() => {
              setCollectionLogEventRequest(request);
              setShowCollectionLog(true);
            }}
            onReschedule={() => {
              if (
                window.confirm(
                  'Do you want to reopen this event and move it back to Scheduled? (This is for data entry corrections.)'
                )
              ) {
                handleStatusChange(request.id, 'scheduled');
              }
            }}
            onAssignTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onEditTspContact={() => {
              setTspContactEventRequest(request);
              setShowTspContactAssignmentDialog(true);
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
            openAssignmentDialog={(type, isVanDriver) => openAssignmentDialog(request.id, type, isVanDriver)}
            openEditAssignmentDialog={(type, personId) => openEditAssignmentDialog(request.id, type, personId)}
            handleRemoveAssignment={(type, personId) => handleRemoveAssignment(personId, type, request.id)}
            handleSelfSignup={(type) => handleSelfSignup(request.id, type)}
            canSelfSignup={canSelfSignup}
            isUserSignedUp={isUserSignedUp}
          />
        ))
        )}
      </div>
    </>
  );
};
