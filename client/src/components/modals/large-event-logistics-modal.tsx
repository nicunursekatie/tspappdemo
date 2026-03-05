import { Calendar, MapPin, Users, Truck, Megaphone, Package, AlertCircle, Clock } from 'lucide-react';
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
import { parseCollectionDate } from '@/lib/analytics-utils';

interface LargeEventLogisticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventRequest[];
}

export default function LargeEventLogisticsModal({
  open,
  onOpenChange,
  events,
}: LargeEventLogisticsModalProps) {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Not set';
    const d = typeof date === 'string' ? parseCollectionDate(date) : date;
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDayOfWeek = (date: Date | string | null | undefined) => {
    if (!date) return null;
    const d = typeof date === 'string' ? parseCollectionDate(date) : date;
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getEventScale = (event: EventRequest) => {
    const count = event.estimatedSandwichCount || 0;
    if (count >= 1000) return 'very-large';
    if (count >= 500) return 'large';
    return 'medium';
  };

  const needsPlacement = (event: EventRequest) => {
    const dayOfWeek = getDayOfWeek(event.scheduledEventDate || event.desiredEventDate);
    if (!dayOfWeek) return null; // Unknown - no valid date
    return dayOfWeek !== 'Wednesday' && dayOfWeek !== 'Thursday';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center text-2xl">
            <AlertCircle className="text-amber-500 mr-2 w-6 h-6" />
            Large Event Logistics Review
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Events with 500+ sandwiches require additional planning and coordination
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6">
            {events.map((event) => {
              const eventScale = getEventScale(event);
              const requiresPlacement = needsPlacement(event);

              return (
                <Card key={event.id} className="border-2 border-amber-200">
                  <CardContent className="pt-6">
                    {/* Event Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {event.organizationName || 'Unknown Organization'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                            {event.estimatedSandwichCount?.toLocaleString()} sandwiches
                          </Badge>
                          <Badge variant="outline" className="text-gray-700">
                            {event.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Event Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Event Date</p>
                          <p className="text-sm text-gray-900">
                            {formatDate(event.scheduledEventDate || event.desiredEventDate)}
                          </p>
                        </div>
                      </div>

                      {event.eventAddress && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Location</p>
                            <p className="text-sm text-gray-900">{event.eventAddress}</p>
                          </div>
                        </div>
                      )}

                      {(event.volunteerCount || event.adultCount || event.childrenCount) && (
                        <div className="flex items-start gap-2">
                          <Users className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Expected Attendees</p>
                            <p className="text-sm text-gray-900">
                              {event.volunteerCount ||
                                `${event.adultCount || 0} adults, ${event.childrenCount || 0} children`}
                            </p>
                          </div>
                        </div>
                      )}

                      {event.eventStartTime && (
                        <div className="flex items-start gap-2">
                          <Clock className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-700">Event Time</p>
                            <p className="text-sm text-gray-900">
                              {event.eventStartTime}
                              {event.eventEndTime && ` - ${event.eventEndTime}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logistics Requirements */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold text-gray-900 mb-3">Logistics Requirements</h4>
                      <div className="space-y-3">
                        {/* Speaker Status */}
                        {event.speakersNeeded && event.speakersNeeded > 0 ? (
                          event.assignedSpeakerIds && event.assignedSpeakerIds.length >= event.speakersNeeded ? (
                            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                              <Megaphone className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-green-900">✓ Speaker Assigned</p>
                                <p className="text-sm text-green-700">
                                  {event.assignedSpeakerIds.length} speaker{event.assignedSpeakerIds.length !== 1 ? 's' : ''} assigned for this event.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
                              <Megaphone className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-900">⚠️ Speaker Assignment Needed</p>
                                <p className="text-sm text-amber-700">
                                  Need {event.speakersNeeded} speaker{event.speakersNeeded !== 1 ? 's' : ''} for this event.
                                  {event.assignedSpeakerIds && event.assignedSpeakerIds.length > 0
                                    ? ` ${event.assignedSpeakerIds.length} assigned, ${event.speakersNeeded - event.assignedSpeakerIds.length} still needed.`
                                    : ' Ideally Juliet should be assigned.'}
                                </p>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <Megaphone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-blue-900">Speaker Recommended</p>
                              <p className="text-sm text-blue-700">
                                Large events typically benefit from a speaker to present TSP mission. Consider adding speaker requirement.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Driver/Van Status */}
                        {(() => {
                          // Include van driver and DHL van in total assigned count
                          const totalDriversAssigned = (event.assignedDriverIds?.length || 0) +
                                                       (event.assignedVanDriverId ? 1 : 0) +
                                                       (event.isDhlVan ? 1 : 0);
                          const driversNeeded = event.driversNeeded || 0;
                          const driversFulfilled = totalDriversAssigned >= driversNeeded;
                          const driversStillNeeded = Math.max(0, driversNeeded - totalDriversAssigned);

                          if (driversNeeded > 0) {
                            if (driversFulfilled) {
                              return (
                                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                                  <Truck className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="font-medium text-green-900">✓ Driver(s) Assigned</p>
                                    <p className="text-sm text-green-700">
                                      {totalDriversAssigned} driver{totalDriversAssigned !== 1 ? 's' : ''} assigned for transportation.
                                      {event.assignedVanDriverId && ' (includes van driver)'}
                                      {event.isDhlVan && ' (includes DHL van)'}
                                    </p>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
                                  <Truck className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1">
                                    <p className="font-medium text-amber-900">⚠️ Driver Assignment Needed</p>
                                    <p className="text-sm text-amber-700">
                                      Need {driversNeeded} driver{driversNeeded !== 1 ? 's' : ''} for this event.
                                      {totalDriversAssigned > 0
                                        ? ` ${totalDriversAssigned} assigned, ${driversStillNeeded} still needed.`
                                        : ' Van likely required for transportation.'}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                          }
                          return (
                            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                              <Truck className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="font-medium text-purple-900">Van/Driver Likely Needed</p>
                                <p className="text-sm text-purple-700">
                                  With {event.estimatedSandwichCount?.toLocaleString()} sandwiches,
                                  transportation will likely be required. Consider adding driver requirement.
                                </p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Sandwich Placement */}
                        {requiresPlacement === true && (
                          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border-2 border-red-200">
                            <Package className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-red-900">⚠️ Recipient Organization Placement Required</p>
                              <p className="text-sm text-red-700">
                                Event is on <strong>{getDayOfWeek(event.scheduledEventDate || event.desiredEventDate)}</strong> (not Wednesday/Thursday).
                                These {event.estimatedSandwichCount?.toLocaleString()} sandwiches <strong>cannot be absorbed into regular
                                Wednesday collection/Thursday distribution workflow</strong>. Must coordinate placement with a recipient
                                organization in advance.
                              </p>
                            </div>
                          </div>
                        )}

                        {requiresPlacement === false && (
                          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <Package className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-green-900">Regular Collection Day - No Special Placement Needed</p>
                              <p className="text-sm text-green-700">
                                Event is on <strong>{getDayOfWeek(event.scheduledEventDate || event.desiredEventDate)}</strong>.
                                These {event.estimatedSandwichCount?.toLocaleString()} sandwiches can be absorbed into the regular
                                Wednesday collection/Thursday distribution workflow. Verify capacity with regular recipients.
                              </p>
                            </div>
                          </div>
                        )}

                        {requiresPlacement === null && (
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <Package className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">Event Date Needed</p>
                              <p className="text-sm text-gray-700">
                                Set an event date to determine sandwich placement requirements. Events on non-collection days
                                (not Wednesday/Thursday) will need coordination with a recipient organization.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Supplies & Ingredients Communication */}
                        {event.status === 'scheduled' ? (
                          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <Package className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-green-900">✓ Supplies Communication Complete</p>
                              <p className="text-sm text-green-700">
                                Event is scheduled. Organization has been briefed on purchasing supplies (bread, meats, condiments, bags, gloves)
                                and venue setup requirements for {event.estimatedSandwichCount?.toLocaleString()} sandwiches.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border-2 border-amber-200">
                            <Package className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="font-medium text-amber-900">⚠️ Supplies Communication Needed</p>
                              <p className="text-sm text-amber-700">
                                {eventScale === 'very-large' ? (
                                  <>
                                    <strong>Very Large Event ({event.estimatedSandwichCount?.toLocaleString()} sandwiches):</strong> Organization
                                    must purchase supplies (bread, meats, condiments, bags, gloves). Communicate requirements for adequate
                                    storage/prep space and table/counter space at venue.
                                  </>
                                ) : (
                                  <>
                                    <strong>Large Event ({event.estimatedSandwichCount?.toLocaleString()} sandwiches):</strong> Ensure contact
                                    understands they must purchase supplies (bread, meats, condiments, bags, gloves) and confirm venue has
                                    adequate table/counter space for sandwich-making stations.
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Additional Notes */}
                        {(event.planningNotes || event.additionalRequirements || event.contactCompletionNotes) && (
                          <div className="border-t pt-3 mt-3">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Additional Notes</h5>
                            <div className="space-y-1 text-sm text-gray-600">
                              {event.planningNotes && (
                                <p><span className="font-medium">Planning:</span> {event.planningNotes}</p>
                              )}
                              {event.additionalRequirements && (
                                <p><span className="font-medium">Requirements:</span> {event.additionalRequirements}</p>
                              )}
                              {event.contactCompletionNotes && (
                                <p><span className="font-medium">Contact Notes:</span> {event.contactCompletionNotes}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact Information */}
                    {(event.firstName || event.email || event.phone) && (
                      <div className="border-t pt-4 mt-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Contact Information</h4>
                        <div className="text-sm text-gray-600 space-y-1">
                          {(event.firstName || event.lastName) && (
                            <p><span className="font-medium">Name:</span> {event.firstName} {event.lastName}</p>
                          )}
                          {event.email && (
                            <p><span className="font-medium">Email:</span> {event.email}</p>
                          )}
                          {event.phone && (
                            <p><span className="font-medium">Phone:</span> {event.phone}</p>
                          )}
                        </div>
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
          <Button
            onClick={() => {
              // Navigate to event requests page
              window.location.href = '/event-requests';
            }}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            Go to Event Requests
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
