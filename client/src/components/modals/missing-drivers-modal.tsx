import { useState } from 'react';
import { Calendar, Car, AlertCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { EventRequest } from '@shared/schema';
import { AssignmentDialog } from '@/components/event-requests/dialogs/AssignmentDialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

interface MissingDriversModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventRequest[];
}

export default function MissingDriversModal({
  open,
  onOpenChange,
  events,
}: MissingDriversModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventRequest | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);

  // Mutation to assign drivers
  const assignDriversMutation = useMutation({
    mutationFn: async ({ eventId, driverIds }: { eventId: number; driverIds: string[] }) => {
      const response = await fetch(`/api/event-requests/${eventId}/assign-drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverIds }),
      });
      if (!response.ok) throw new Error('Failed to assign drivers');
      return response.json();
    },
    onSuccess: () => {
      invalidateEventRequestQueries(queryClient);
      toast({
        title: 'Success',
        description: 'Drivers assigned successfully',
      });
      setAssignmentDialogOpen(false);
      setSelectedDrivers([]);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to assign drivers',
        variant: 'destructive',
      });
    },
  });

  const handleAssignDrivers = (driverIds: string[]) => {
    if (selectedEvent) {
      assignDriversMutation.mutate({
        eventId: selectedEvent.id,
        driverIds,
      });
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDriversNeeded = (event: EventRequest) => {
    const needed = event.driversNeeded || 0;
    // Include van driver and DHL van in total assigned count
    const assigned = (event.assignedDriverIds || []).length +
                    (event.assignedVanDriverId ? 1 : 0) +
                    (event.isDhlVan ? 1 : 0);
    return Math.max(0, needed - assigned);
  };

  // Sort events by date (earliest first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.scheduledEventDate || a.desiredEventDate || 0).getTime();
    const dateB = new Date(b.scheduledEventDate || b.desiredEventDate || 0).getTime();
    return dateA - dateB;
  });

  const totalDriversNeeded = events.reduce((sum, event) => sum + getDriversNeeded(event), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-2xl">
            <AlertCircle className="text-amber-500 mr-2 w-6 h-6" />
            Events Missing Driver Assignments
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            {events.length} event{events.length !== 1 ? 's' : ''} need {totalDriversNeeded} driver{totalDriversNeeded !== 1 ? 's' : ''} assigned
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const driversNeeded = getDriversNeeded(event);
              // Include van driver and DHL van in assigned count for display
              const assignedCount = (event.assignedDriverIds || []).length +
                                   (event.assignedVanDriverId ? 1 : 0) +
                                   (event.isDhlVan ? 1 : 0);
              const totalNeeded = event.driversNeeded || 0;

              return (
                <Card key={event.id} className="border-2 border-amber-200">
                  <CardContent className="pt-6">
                    {/* Event Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          {event.organizationName || 'Unknown Organization'}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">
                            {formatDate(event.scheduledEventDate || event.desiredEventDate)}
                          </span>
                        </div>
                        {event.eventAddress && (
                          <p className="text-sm text-gray-600">{event.eventAddress}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                          {event.estimatedSandwichCount?.toLocaleString()} sandwiches
                        </Badge>
                        <Badge variant="outline" className="text-gray-700">
                          {event.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Driver Status */}
                    <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Car className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-amber-900">Driver Status</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-amber-900">{assignedCount}</span>
                          <span className="text-gray-600"> / </span>
                          <span className="font-bold text-gray-900">{totalNeeded}</span>
                          <span className="text-gray-600"> assigned</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-amber-700">
                          <strong>{driversNeeded}</strong> more driver{driversNeeded !== 1 ? 's' : ''} needed
                        </p>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            setSelectedDrivers(event.assignedDriverIds || []);
                            setAssignmentDialogOpen(true);
                          }}
                          className="bg-brand-primary hover:bg-brand-primary/90"
                        >
                          <Car className="w-4 h-4 mr-1" />
                          Assign Drivers
                        </Button>
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {event.eventStartTime && (
                        <div>
                          <span className="font-medium text-gray-700">Start Time:</span>
                          <span className="text-gray-900 ml-2">{event.eventStartTime}</span>
                        </div>
                      )}
                      {event.eventEndTime && (
                        <div>
                          <span className="font-medium text-gray-700">End Time:</span>
                          <span className="text-gray-900 ml-2">{event.eventEndTime}</span>
                        </div>
                      )}
                      {event.firstName && (
                        <div>
                          <span className="font-medium text-gray-700">Contact:</span>
                          <span className="text-gray-900 ml-2">
                            {event.firstName} {event.lastName}
                          </span>
                        </div>
                      )}
                      {event.phone && (
                        <div>
                          <span className="font-medium text-gray-700">Phone:</span>
                          <span className="text-gray-900 ml-2">{event.phone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 mt-4 border-t bg-white flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Assignment Dialog */}
      {selectedEvent && (
        <AssignmentDialog
          isOpen={assignmentDialogOpen}
          onClose={() => {
            setAssignmentDialogOpen(false);
            setSelectedEvent(null);
            setSelectedDrivers([]);
          }}
          assignmentType="driver"
          selectedAssignees={selectedDrivers}
          setSelectedAssignees={setSelectedDrivers}
          onAssign={handleAssignDrivers}
        />
      )}
    </Dialog>
  );
}
