import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { DeclinedCard } from '../cards/DeclinedCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const DeclinedTab: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { handleStatusChange, resolveUserName } = useEventAssignments();

  const {
    isLoading,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
    setShowContactOrganizerDialog,
    setContactEventRequest,
    setShowLogContactDialog,
    setLogContactEventRequest,
  } = useEventRequestContext();

  const declinedRequests = filterRequestsByStatus('declined');
  const cancelledRequests = filterRequestsByStatus('cancelled');
  const allDeclinedOrCancelled = [...declinedRequests, ...cancelledRequests];

  const handleExport = async () => {
    if (allDeclinedOrCancelled.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no declined or cancelled events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(allDeclinedOrCancelled, 'declined');
      toast({
        title: 'Export complete',
        description: `Exported ${allDeclinedOrCancelled.length} declined/cancelled event${allDeclinedOrCancelled.length !== 1 ? 's' : ''} to Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export events. Please try again.',
        variant: 'destructive',
      });
    }
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

  return (
    <>
      {/* Header with count and export button */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${allDeclinedOrCancelled.length} declined/cancelled event${allDeclinedOrCancelled.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={allDeclinedOrCancelled.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="space-y-6">
        {isLoading ? (
        <EventListSkeleton count={3} />
      ) : declinedRequests.length === 0 && cancelledRequests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No declined or cancelled events
        </div>
      ) : (
        <>
          {/* Declined Events Section */}
          {declinedRequests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-red-200">
                <h3 className="text-lg font-semibold text-red-700">Declined Events</h3>
                <span className="text-sm text-gray-500">({declinedRequests.length})</span>
              </div>
              {declinedRequests.map((request) => (
                <DeclinedCard
                  key={request.id}
                  request={request}
                  resolveUserName={resolveUserName}
                  onView={() => {
                    setSelectedEventRequest(request);
                    setIsEditing(false);
                    setShowEventDetails(true);
                  }}
                  onDelete={() => {
                    if (window.confirm('Are you sure you want to permanently delete this declined event?')) {
                      deleteEventRequestMutation.mutate(request.id);
                    }
                  }}
                  onContact={() => {
                    setContactEventRequest(request);
                    setShowContactOrganizerDialog(true);
                  }}
                  onCall={() => handleCall(request)}
                  onReactivate={() => {
                    if (window.confirm('Do you want to reactivate this event request?')) {
                      handleStatusChange(request.id, 'new');
                      toast({
                        title: 'Event reactivated',
                        description: 'The event request has been moved back to New Requests.',
                      });
                    }
                  }}
                  onLogContact={() => {
                    setLogContactEventRequest(request);
                    setShowLogContactDialog(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* Cancelled Events Section */}
          {cancelledRequests.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-gray-300">
                <h3 className="text-lg font-semibold text-gray-700">Cancelled Events</h3>
                <span className="text-sm text-gray-500">({cancelledRequests.length})</span>
              </div>
              {cancelledRequests.map((request) => (
                <DeclinedCard
                  key={request.id}
                  request={request}
                  resolveUserName={resolveUserName}
                  onView={() => {
                    setSelectedEventRequest(request);
                    setIsEditing(false);
                    setShowEventDetails(true);
                  }}
                  onDelete={() => {
                    if (window.confirm('Are you sure you want to permanently delete this cancelled event?')) {
                      deleteEventRequestMutation.mutate(request.id);
                    }
                  }}
                  onContact={() => {
                    setContactEventRequest(request);
                    setShowContactOrganizerDialog(true);
                  }}
                  onCall={() => handleCall(request)}
                  onReactivate={() => {
                    if (window.confirm('Do you want to reactivate this event request?')) {
                      handleStatusChange(request.id, 'new');
                      toast({
                        title: 'Event reactivated',
                        description: 'The event request has been moved back to New Requests.',
                      });
                    }
                  }}
                  onLogContact={() => {
                    setLogContactEventRequest(request);
                    setShowLogContactDialog(true);
                  }}
                />
              ))}
            </div>
          )}
        </>
        )}
      </div>
    </>
  );
};