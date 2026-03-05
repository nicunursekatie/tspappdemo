import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { StalledCard } from '../cards/StalledCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const StalledTab: React.FC = () => {
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
    setShowDeclineDialog,
    setReasonDialogEventRequest,
  } = useEventRequestContext();

  const stalledRequests = filterRequestsByStatus('stalled');

  const handleExport = async () => {
    if (stalledRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no stalled events to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(stalledRequests, 'stalled');
      toast({
        title: 'Export complete',
        description: `Exported ${stalledRequests.length} stalled event${stalledRequests.length !== 1 ? 's' : ''} to Excel.`,
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
          {isLoading ? 'Loading...' : `${stalledRequests.length} stalled event${stalledRequests.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={stalledRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Info banner explaining stalled status */}
      <div className="mb-4 px-4">
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-sm text-gray-700">
          <strong>Stalled events</strong> are requests where we have not received any response after multiple outreach attempts.
          These are kept in limbo for periodic follow-up (every few months). If the organizer officially declines, move them to Declined.
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : stalledRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No stalled events
          </div>
        ) : (
          stalledRequests.map((request) => (
          <StalledCard
            key={request.id}
            request={request}
            resolveUserName={resolveUserName}
            onView={() => {
              setSelectedEventRequest(request);
              setIsEditing(false);
              setShowEventDetails(true);
            }}
            onDelete={() => {
              if (window.confirm('Are you sure you want to permanently delete this stalled event?')) {
                deleteEventRequestMutation.mutate(request.id);
              }
            }}
            onContact={() => {
              setContactEventRequest(request);
              setShowContactOrganizerDialog(true);
            }}
            onCall={() => handleCall(request)}
            onReactivate={() => {
              if (window.confirm('The organizer responded! Move this event back to In Process?')) {
                handleStatusChange(request.id, 'in_process');
                toast({
                  title: 'Event reactivated',
                  description: 'Great news! The event request has been moved back to In Process.',
                });
              }
            }}
            onLogContact={() => {
              setLogContactEventRequest(request);
              setShowLogContactDialog(true);
            }}
            onDecline={async () => {
              const result = await handleStatusChange(request.id, 'declined');
              if (result === 'needs_reason') {
                setReasonDialogEventRequest(request);
                setShowDeclineDialog(true);
              }
            }}
          />
          ))
        )}
      </div>
    </>
  );
};
