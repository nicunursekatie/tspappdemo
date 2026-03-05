import { Calendar, Megaphone, AlertCircle } from 'lucide-react';
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

interface MissingSpeakersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventRequest[];
  onAssignSpeakers?: (eventId: number) => void;
}

export default function MissingSpeakersModal({
  open,
  onOpenChange,
  events,
  onAssignSpeakers,
}: MissingSpeakersModalProps) {
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

  const getSpeakersNeeded = (event: EventRequest) => {
    const needed = event.speakersNeeded || 0;
    const assigned = (event.assignedSpeakerIds || []).length;
    return needed - assigned;
  };

  // Sort events by date (earliest first)
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = new Date(a.scheduledEventDate || a.desiredEventDate || 0).getTime();
    const dateB = new Date(b.scheduledEventDate || b.desiredEventDate || 0).getTime();
    return dateA - dateB;
  });

  const totalSpeakersNeeded = events.reduce((sum, event) => sum + getSpeakersNeeded(event), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-2xl">
            <AlertCircle className="text-amber-500 mr-2 w-6 h-6" />
            Events Missing Speaker Assignments
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            {events.length} event{events.length !== 1 ? 's' : ''} need {totalSpeakersNeeded} speaker{totalSpeakersNeeded !== 1 ? 's' : ''} assigned
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-4">
            {sortedEvents.map((event) => {
              const speakersNeeded = getSpeakersNeeded(event);
              const assignedCount = (event.assignedSpeakerIds || []).length;
              const totalNeeded = event.speakersNeeded || 0;

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

                    {/* Speaker Status */}
                    <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Megaphone className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-amber-900">Speaker Status</span>
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
                          <strong>{speakersNeeded}</strong> more speaker{speakersNeeded !== 1 ? 's' : ''} needed
                        </p>
                        {onAssignSpeakers && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignSpeakers(event.id);
                              onOpenChange(false);
                            }}
                            className="bg-brand-primary hover:bg-brand-primary/90"
                          >
                            <Megaphone className="w-4 h-4 mr-1" />
                            Assign Speakers
                          </Button>
                        )}
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

                    {/* Speaker Context */}
                    {event.estimatedSandwichCount && event.estimatedSandwichCount >= 500 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <strong>Large Event:</strong> Speaker is important for presenting TSP mission and recruiting future volunteers at events this size.
                        </p>
                      </div>
                    )}
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
    </Dialog>
  );
}
