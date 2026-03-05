import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { StandbyCard } from '../cards/StandbyCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const StandbyTab: React.FC = () => {
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

  const standbyRequests = filterRequestsByStatus('standby');

  const handleExport = async () => {
    if (standbyRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no standby events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(standbyRequests, 'standby');
      toast({
        title: 'Export complete',
        description: `Exported ${standbyRequests.length} standby event${standbyRequests.length !== 1 ? 's' : ''} to Excel.`,
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
          {isLoading ? 'Loading...' : `${standbyRequests.length} standby event${standbyRequests.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={standbyRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Info banner explaining standby status */}
      <div className="mb-4 px-4">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
          <strong>Standby events</strong> are waiting for the organizer to work out details on their end.
          Check back periodically to follow up, especially when expected response dates pass.
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : standbyRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No standby events
          </div>
        ) : (
          standbyRequests.map((request) => (
          <StandbyCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (window.confirm('Are you sure you want to permanently delete this standby event?')) {
                deleteEventRequestMutation.mutate(request.id);
              }
            }}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onCall={() => handleCall(request)}
            onReactivate={() => {
              if (window.confirm('Do you want to move this event back to In Process?')) {
                handleStatusChange(request.id, 'in_process');
                toast({
                  title: 'Event reactivated',
                  description: 'The event request has been moved to In Process.',
                });
              }
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
            onMoveToStalled={() => {
              if (window.confirm('Move this event to Stalled? This is for events where you have not received any response after multiple attempts.')) {
                handleStatusChange(request.id, 'stalled');
                toast({
                  title: 'Event moved to Stalled',
                  description: 'The event request has been marked as stalled due to no response.',
                });
              }
            }}
          />
          ))
        )}
      </div>
    </>
  );
};
