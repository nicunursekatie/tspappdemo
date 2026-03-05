import React from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventFilters } from '../hooks/useEventFilters';
import { useEventMutations } from '../hooks/useEventMutations';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useToast } from '@/hooks/use-toast';
import { NonEventCard } from '../cards/NonEventCard';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportEventRequestsToExcel } from '@/lib/excel-export';
import { EventListSkeleton } from '../EventCardSkeleton';

export const NonEventTab: React.FC = () => {
  const { toast } = useToast();
  const { filterRequestsByStatus } = useEventFilters();
  const { deleteEventRequestMutation } = useEventMutations();
  const { resolveUserName } = useEventAssignments();

  const {
    isLoading,
    setSelectedEventRequest,
    setIsEditing,
    setShowEventDetails,
  } = useEventRequestContext();

  const nonEventRequests = filterRequestsByStatus('non_event');

  const handleExport = async () => {
    if (nonEventRequests.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no non-event requests to export.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await exportEventRequestsToExcel(nonEventRequests, 'non_event');
      toast({
        title: 'Export complete',
        description: `Exported ${nonEventRequests.length} non-event request${nonEventRequests.length !== 1 ? 's' : ''} to Excel.`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="text-sm text-gray-600">
          {isLoading ? 'Loading...' : `${nonEventRequests.length} non-event request${nonEventRequests.length !== 1 ? 's' : ''}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={nonEventRequests.length === 0}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : nonEventRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No non-event requests
          </div>
        ) : (
          nonEventRequests.map((request) => (
            <NonEventCard
              key={request.id}
              request={request}
              resolveUserName={resolveUserName}
              onView={() => {
                setSelectedEventRequest(request);
                setIsEditing(false);
                setShowEventDetails(true);
              }}
              onDelete={() => {
                if (window.confirm('Are you sure you want to permanently delete this non-event?')) {
                  deleteEventRequestMutation.mutate(request.id);
                }
              }}
            />
          ))
        )}
      </div>
    </>
  );
};
