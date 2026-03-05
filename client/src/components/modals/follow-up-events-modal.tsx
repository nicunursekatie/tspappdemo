import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Calendar, MapPin, Users, Phone, Mail } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { EventRequest } from '@shared/schema';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

interface FollowUpEventsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventRequest[];
  followUpType: '1day' | '1month';
}

export default function FollowUpEventsModal({
  open,
  onOpenChange,
  events,
  followUpType,
}: FollowUpEventsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [completedFollowUps, setCompletedFollowUps] = useState<Set<number>>(new Set());

  const markFollowUpMutation = useMutation({
    mutationFn: async ({ eventId, type }: { eventId: number; type: '1day' | '1month' }) => {
      const fieldName = type === '1day' ? 'followUpOneDayCompleted' : 'followUpOneMonthCompleted';
      const response = await fetch(`/api/event-requests/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: true }),
      });
      if (!response.ok) throw new Error('Failed to mark follow-up as completed');
      return response.json();
    },
    onSuccess: (_, variables) => {
      setCompletedFollowUps(prev => new Set(prev).add(variables.eventId));
      invalidateEventRequestQueries(queryClient);
      toast({
        title: 'Follow-up marked complete',
        description: `${followUpType === '1day' ? '1-day' : '30-day'} follow-up has been completed.`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to mark follow-up as completed',
        variant: 'destructive',
      });
    },
  });

  const handleMarkComplete = (eventId: number) => {
    markFollowUpMutation.mutate({ eventId, type: followUpType });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const title = followUpType === '1day'
    ? 'Events Needing 1-Day Follow-Up'
    : 'Events Needing 30-Day Follow-Up';

  const description = followUpType === '1day'
    ? 'Contact these organizations within 24 hours of their event to gather feedback and build relationships.'
    : 'Follow up with these organizations 30 days after their event to discuss repeat opportunities and long-term partnerships.';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-brand-primary">
            {title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>All follow-ups are complete!</p>
            </div>
          ) : (
            events.map((event) => {
              const isCompleted = completedFollowUps.has(event.id);
              return (
                <Card
                  key={event.id}
                  className={`${isCompleted ? 'opacity-50 bg-gray-50' : ''}`}
                >
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-4">
                      <div className="flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-base sm:text-lg font-semibold text-brand-primary">
                            {event.organizationName}
                          </h3>
                          {isCompleted && (
                            <Badge className="bg-green-100 text-green-800">
                              ✓ Completed
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          {event.desiredEventDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>Event: {formatDate(event.desiredEventDate)}</span>
                            </div>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          {event.estimatedAttendees && (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>{event.estimatedAttendees} attendees</span>
                            </div>
                          )}
                          {event.actualSandwichCount || event.estimatedSandwichCount ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {event.actualSandwichCount || event.estimatedSandwichCount} sandwiches
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {event.contactPhone || event.contactEmail ? (
                          <div className="mt-3 pt-3 border-t space-y-1">
                            {event.contactPhone && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <a
                                  href={`tel:${event.contactPhone}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {event.contactPhone}
                                </a>
                              </div>
                            )}
                            {event.contactEmail && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <a
                                  href={`mailto:${event.contactEmail}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {event.contactEmail}
                                </a>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <Button
                        onClick={() => handleMarkComplete(event.id)}
                        disabled={isCompleted || markFollowUpMutation.isPending}
                        variant={isCompleted ? 'outline' : 'default'}
                        className="w-full sm:w-auto sm:ml-4 shrink-0"
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Completed
                          </>
                        ) : markFollowUpMutation.isPending ? (
                          'Marking...'
                        ) : (
                          'Mark Complete'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="mt-6 pt-4 border-t">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-brand-primary mb-2">
              {followUpType === '1day' ? '1-Day Follow-Up Tips' : '30-Day Follow-Up Tips'}
            </h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {followUpType === '1day' ? (
                <>
                  <li>• Thank them for hosting and ask how the event went</li>
                  <li>• Request photos or testimonials while the event is fresh</li>
                  <li>• Address any immediate concerns or feedback</li>
                  <li>• Ask if they'd be interested in hosting again</li>
                </>
              ) : (
                <>
                  <li>• Check in on long-term impact and community response</li>
                  <li>• Discuss opportunities for recurring events or partnerships</li>
                  <li>• Share success metrics from their event</li>
                  <li>• Explore ways to expand their involvement</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
