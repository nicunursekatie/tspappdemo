import React, { useState, useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import { useEventAssignments } from '../hooks/useEventAssignments';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, MapPin, Users, Phone, Mail, User, Info, Sandwich, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { EventRequest } from '@shared/schema';
import { parseSandwichTypes } from '@/lib/sandwich-utils';
import { EventCalendarView } from '@/components/event-calendar-view';
import { VolunteerOpportunitiesMap } from './VolunteerOpportunitiesMap';

export const VolunteerOpportunitiesTab: React.FC = () => {
  const { user } = useAuth();
  const { eventRequests } = useEventRequestContext();
  const {
    handleSelfSignup,
    canSelfSignup,
    resolveUserName,
  } = useEventAssignments();

  const [roleFilter, setRoleFilter] = useState<'all' | 'speaker' | 'volunteer' | 'driver'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'calendar' | 'map'>('card');

  // Helper to calculate unfilled needs for an event
  const getUnfilledNeeds = (request: EventRequest) => {
    // Speakers: count needed vs assigned (using speakerDetails object)
    const speakersNeededCount = request.speakersNeeded ?? 0;
    const speakersAssignedCount = Object.keys(request.speakerDetails || {}).length;
    const needsSpeaker = speakersNeededCount > speakersAssignedCount;

    // Volunteers: count needed vs assigned (using assignedVolunteerIds array)
    const volunteersNeededCount = request.volunteersNeeded ?? 0;
    const volunteersAssignedCount = request.assignedVolunteerIds?.length || 0;
    const needsVolunteer = volunteersNeededCount > volunteersAssignedCount;

    // Drivers: count needed vs assigned (using assignedDriverIds array + van driver)
    const driversNeededCount = request.driversNeeded ?? 0;
    const driversAssignedCount = (request.assignedDriverIds?.length || 0) + (request.assignedVanDriverId ? 1 : 0) + (request.isDhlVan ? 1 : 0);
    const needsDriver = driversNeededCount > driversAssignedCount;

    return { needsSpeaker, needsVolunteer, needsDriver };
  };

  // Filter events that need volunteers, speakers, or drivers (all scheduled events, regardless of current tab/pagination/search)
  const opportunities = useMemo(() => {
    const needs = eventRequests
      .filter((request: EventRequest) => request.status === 'scheduled')
      .filter((request: EventRequest) => {
        const { needsSpeaker, needsVolunteer, needsDriver } = getUnfilledNeeds(request);

        // Filter by role selection
        if (roleFilter === 'speaker' && !needsSpeaker) return false;
        if (roleFilter === 'volunteer' && !needsVolunteer) return false;
        if (roleFilter === 'driver' && !needsDriver) return false;

        // Show if any role is needed and unfilled
        return needsSpeaker || needsVolunteer || needsDriver;
      })
      // Sort by scheduled date (ascending), fallback to desired date
      .sort((a: EventRequest, b: EventRequest) => {
        const dateA = a.scheduledEventDate || a.desiredEventDate;
        const dateB = b.scheduledEventDate || b.desiredEventDate;
        const timeA = dateA ? new Date(dateA).getTime() : 0;
        const timeB = dateB ? new Date(dateB).getTime() : 0;
        return timeA - timeB;
      });

    return needs;
  }, [eventRequests, roleFilter]);

  const formatEventDate = (request: EventRequest) => {
    const date = request.scheduledEventDate || request.desiredEventDate;
    if (!date) return 'Date TBD';
    try {
      return format(new Date(date), 'EEEE, MMMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatEventTime = (request: EventRequest) => {
    if (!request.eventTime) return 'Time TBD';
    return request.eventTime;
  };

  const getSandwichSummary = (request: EventRequest) => {
    if (!request.sandwichTypes) return 'Not specified';
    const types = parseSandwichTypes(request.sandwichTypes);
    const total = types.reduce((sum, type) => sum + type.quantity, 0);

    // If only one type, just show "200 deli"
    if (types.length === 1) {
      return `${types[0].quantity} ${types[0].type}`;
    }

    // If multiple types, show breakdown with total: "100 deli, 100 veggie (200 total)"
    return `${types.map(t => `${t.quantity} ${t.type}`).join(', ')} (${total} total)`;
  };

  return (
    <div className="space-y-6 max-w-full">
      {/* View Mode and Role Filter */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* View Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-semibold text-gray-700 whitespace-nowrap">View:</span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              onClick={() => setViewMode('card')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'card' ? { backgroundColor: '#007E8C' } : {}}
            >
              <LayoutGrid className="w-5 h-5 mr-2" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              onClick={() => setViewMode('calendar')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'calendar' ? { backgroundColor: '#007E8C' } : {}}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              onClick={() => setViewMode('map')}
              size="default"
              className="text-base px-4 py-5"
              style={viewMode === 'map' ? { backgroundColor: '#007E8C' } : {}}
            >
              <MapIcon className="w-5 h-5 mr-2" />
              Map
            </Button>
          </div>
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-base font-semibold text-gray-700 whitespace-nowrap">Filter by role:</span>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={roleFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('all')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'all' ? { backgroundColor: '#007E8C' } : {}}
            >
              All Roles ({opportunities.length})
            </Button>
            <Button
              variant={roleFilter === 'speaker' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('speaker')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'speaker' ? { backgroundColor: '#007E8C' } : {}}
            >
              Speaker Needed
            </Button>
            <Button
              variant={roleFilter === 'volunteer' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('volunteer')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'volunteer' ? { backgroundColor: '#007E8C' } : {}}
            >
              Volunteer Needed
            </Button>
            <Button
              variant={roleFilter === 'driver' ? 'default' : 'outline'}
              onClick={() => setRoleFilter('driver')}
              size="default"
              className="text-base px-4 py-5"
              style={roleFilter === 'driver' ? { backgroundColor: '#007E8C' } : {}}
            >
              Driver Needed
            </Button>
          </div>
        </div>
      </div>

      {/* Conditional View Rendering */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-lg p-4">
          <EventCalendarView
            events={opportunities}
            filterByNeeds={true}
            onEventClick={(event) => {
              // Scroll to card in card view
              setViewMode('card');
              setTimeout(() => {
                const cardElement = document.querySelector(`[data-event-id="${event.id}"]`);
                if (cardElement) {
                  cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }}
          />
        </div>
      ) : viewMode === 'map' ? (
        <div className="bg-white rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}>
          <VolunteerOpportunitiesMap
            events={opportunities}
            onEventClick={(event) => {
              // Scroll to card in card view
              setViewMode('card');
              setTimeout(() => {
                const cardElement = document.querySelector(`[data-event-id="${event.id}"]`);
                if (cardElement) {
                  cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }}
          />
        </div>
      ) : opportunities.length === 0 ? (
        <Card className="bg-gray-50">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-16 w-16 text-gray-400 mb-6" />
            <p className="text-xl text-gray-600 font-semibold mb-3">
              {roleFilter === 'all'
                ? 'No volunteer opportunities available at this time'
                : `No ${roleFilter} opportunities available at this time`}
            </p>
            <p className="text-base text-gray-500 mt-2">
              All scheduled events have their roles filled. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {opportunities.map((request: EventRequest) => {
            // Use helper to get unfilled needs
            const { needsSpeaker, needsVolunteer, needsDriver } = getUnfilledNeeds(request);

            // Check if current user is already signed up
            const speakerDetails = request.speakerDetails || {};
            const isSpeakerSignedUp = user?.id ? Object.keys(speakerDetails).includes(user.id) : false;
            const isVolunteerSignedUp = user?.id ? (request.assignedVolunteerIds || []).includes(user.id) : false;
            const isDriverSignedUp = user?.id ? (
              (request.assignedDriverIds || []).includes(user.id) ||
              request.assignedVanDriverId === user.id
            ) : false;

            return (
              <Card
                key={request.id}
                data-event-id={request.id}
                className="hover:shadow-lg transition-shadow border-2 max-w-full overflow-hidden"
                style={{ borderColor: '#007E8C', backgroundColor: '#f0f9fa' }}
              >
                <CardContent className="p-8 space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b-4" style={{ borderColor: '#007E8C' }}>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-3xl font-bold leading-tight break-words" style={{ color: '#1A2332' }}>
                        {request.organizationName}
                        {request.department && (
                          <span className="text-xl text-gray-600 font-medium ml-3">
                            &bull; {request.department}
                          </span>
                        )}
                      </h3>

                      {/* Roles Needed */}
                      <div className="flex gap-3 flex-wrap mt-4">
                        {needsSpeaker && (
                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-base px-4 py-2 font-semibold">
                            Speaker Needed
                          </Badge>
                        )}
                        {needsVolunteer && (
                          <Badge className="bg-green-600 text-white hover:bg-green-700 text-base px-4 py-2 font-semibold">
                            Volunteer Needed
                          </Badge>
                        )}
                        {needsDriver && (
                          <Badge className="bg-purple-600 text-white hover:bg-purple-700 text-base px-4 py-2 font-semibold">
                            Driver Needed
                          </Badge>
                        )}
                        {request.isConfirmed && (
                          <Badge style={{ backgroundColor: '#007E8C' }} className="text-white text-base px-4 py-2 font-semibold">
                            ✓ Date Confirmed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Event Details - Prominent */}
                  <div className="space-y-5 p-6 rounded-lg border-3" style={{ backgroundColor: 'white', borderColor: '#007E8C' }}>
                    <div className="flex items-start gap-4">
                      <Calendar className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                      <div>
                        <div className="font-bold text-xl leading-tight" style={{ color: '#1A2332' }}>
                          {formatEventDate(request)}
                        </div>
                        <div className="text-gray-700 font-semibold text-lg mt-1">
                          {formatEventTime(request)}
                        </div>
                      </div>
                    </div>

                    {request.location && (
                      <div className="flex items-start gap-4">
                        <MapPin className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                        <div className="text-gray-900 font-semibold text-lg break-words">{request.location}</div>
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      <Sandwich className="h-7 w-7 mt-1 flex-shrink-0" style={{ color: '#007E8C' }} />
                      <div className="text-gray-900 font-semibold text-lg break-words">{getSandwichSummary(request)}</div>
                    </div>
                  </div>

                  {/* Two Column Layout for Contact and Planning Notes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 min-w-0">
                    {/* Contact Info */}
                    <div className="space-y-3 text-gray-700 p-5 bg-white rounded-lg border-2 border-gray-300 min-w-0">
                      <div className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                        <User className="h-6 w-6" />
                        Contact Info
                      </div>
                      {request.name && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{request.name}</span>
                        </div>
                      )}
                      {request.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 flex-shrink-0" />
                          <a
                            href={`mailto:${request.email}`}
                            className="hover:underline text-base font-medium break-all"
                            style={{ color: '#007E8C' }}
                          >
                            {request.email}
                          </a>
                        </div>
                      )}
                      {request.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 flex-shrink-0" />
                          <a
                            href={`tel:${request.phone}`}
                            className="hover:underline text-lg font-semibold"
                            style={{ color: '#007E8C' }}
                          >
                            {request.phone}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Planning Notes */}
                    {request.planningNotes && (
                      <div className="space-y-3 p-5 rounded-lg border-2 min-w-0" style={{ backgroundColor: '#e6f4f6', borderColor: '#007E8C' }}>
                        <div className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                          <Info className="h-6 w-6" style={{ color: '#007E8C' }} />
                          Planning Notes
                        </div>
                        <div className="text-gray-800 whitespace-pre-wrap break-words text-base leading-relaxed font-medium">
                          {request.planningNotes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Up Actions - Large, Prominent Buttons - Only show if there are unfilled needs */}
                  {(needsSpeaker || needsVolunteer || needsDriver) && (
                    <div className="flex gap-4 pt-6 border-t-4 flex-wrap" style={{ borderColor: '#007E8C' }}>
                      {needsSpeaker && (
                        <Button
                          onClick={() => handleSelfSignup(request.id, 'speaker')}
                          disabled={isSpeakerSignedUp || !canSelfSignup(request, 'speaker')}
                          className="flex-1 text-xl py-8 font-bold rounded-lg min-w-[200px]"
                          style={
                            isSpeakerSignedUp
                              ? { backgroundColor: '#e0e0e0', color: '#666' }
                              : { backgroundColor: '#007E8C', color: 'white' }
                          }
                        >
                          {isSpeakerSignedUp ? (
                            <>✓ You're signed up as Speaker</>
                          ) : (
                            <>Sign Up as Speaker</>
                          )}
                        </Button>
                      )}
                      {needsVolunteer && (
                        <Button
                          onClick={() => handleSelfSignup(request.id, 'volunteer')}
                          disabled={isVolunteerSignedUp || !canSelfSignup(request, 'volunteer')}
                          className="flex-1 text-xl py-8 font-bold rounded-lg min-w-[200px]"
                          style={
                            isVolunteerSignedUp
                              ? { backgroundColor: '#e0e0e0', color: '#666' }
                              : { backgroundColor: '#007E8C', color: 'white' }
                          }
                        >
                          {isVolunteerSignedUp ? (
                            <>✓ You're signed up as Volunteer</>
                          ) : (
                            <>Sign Up as Volunteer</>
                          )}
                        </Button>
                      )}
                      {needsDriver && (
                        <Button
                          onClick={() => handleSelfSignup(request.id, 'driver')}
                          disabled={isDriverSignedUp || !canSelfSignup(request, 'driver')}
                          className="flex-1 text-xl py-8 font-bold rounded-lg min-w-[200px]"
                          style={
                            isDriverSignedUp
                              ? { backgroundColor: '#e0e0e0', color: '#666' }
                              : { backgroundColor: '#007E8C', color: 'white' }
                          }
                        >
                          {isDriverSignedUp ? (
                            <>✓ You're signed up as Driver</>
                          ) : (
                            <>Sign Up as Driver</>
                          )}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Show who is currently assigned (if anyone) */}
                  {(Object.keys(speakerDetails).length > 0 ||
                    (request.assignedVolunteerIds?.length || 0) > 0 ||
                    (request.assignedDriverIds?.length || 0) > 0 ||
                    request.assignedVanDriverId) && (
                    <div className="text-base text-gray-700 pt-4 border-t-2 border-gray-300 bg-gray-50 p-5 rounded-lg">
                      <div className="flex gap-6 flex-wrap">
                        {Object.keys(speakerDetails).length > 0 && (
                          <div>
                            <span className="font-bold text-lg">Speakers:</span>{' '}
                            <span className="font-semibold text-lg">
                              {Object.keys(speakerDetails).map(id => resolveUserName(id)).join(', ')}
                            </span>
                          </div>
                        )}
                        {(request.assignedVolunteerIds?.length || 0) > 0 && (
                          <div>
                            <span className="font-bold text-lg">Volunteers:</span>{' '}
                            <span className="font-semibold text-lg">
                              {request.assignedVolunteerIds?.map(id => resolveUserName(id)).join(', ')}
                            </span>
                          </div>
                        )}
                        {((request.assignedDriverIds?.length || 0) > 0 || request.assignedVanDriverId) && (
                          <div>
                            <span className="font-bold text-lg">Drivers:</span>{' '}
                            <span className="font-semibold text-lg">
                              {[
                                ...(request.assignedDriverIds || []).map(id => resolveUserName(id)),
                        ...(request.assignedVanDriverId ? [resolveUserName(request.assignedVanDriverId) + ' (Van)'] : []),
                        ...(request.isDhlVan ? ['DHL Van'] : [])
                              ].join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
