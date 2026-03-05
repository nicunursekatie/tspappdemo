import { useQuery } from '@tanstack/react-query';
import { Users, Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateShort } from '@/lib/date-utils';
import { getVolunteerCount, getTotalDriverCount, getSpeakerCount } from '@/lib/assignment-utils';
import type { EventRequest } from '@shared/schema';

interface VolunteerOpportunitiesSpotlightProps {
  onNavigate: (section: string) => void;
}

interface UnfilledNeeds {
  needsSpeaker: boolean;
  needsVolunteer: boolean;
  needsDriver: boolean;
  speakersNeeded: number;
  volunteersNeeded: number;
  driversNeeded: number;
}

const getUnfilledNeeds = (request: EventRequest): UnfilledNeeds => {
  const speakersNeededCount = request.speakersNeeded ?? 0;
  const speakersAssignedCount = getSpeakerCount(request);
  const needsSpeaker = speakersNeededCount > speakersAssignedCount;
  const speakersNeeded = Math.max(0, speakersNeededCount - speakersAssignedCount);

  const volunteersNeededCount = request.volunteersNeeded ?? 0;
  const volunteersAssignedCount = getVolunteerCount(request);
  const needsVolunteer = volunteersNeededCount > volunteersAssignedCount;
  const volunteersNeeded = Math.max(0, volunteersNeededCount - volunteersAssignedCount);

  const driversNeededCount = request.driversNeeded ?? 0;
  const driversAssignedCount = getTotalDriverCount(request);
  const needsDriver = driversNeededCount > driversAssignedCount;
  const driversNeeded = Math.max(0, driversNeededCount - driversAssignedCount);

  return { needsSpeaker, needsVolunteer, needsDriver, speakersNeeded, volunteersNeeded, driversNeeded };
};

export function VolunteerOpportunitiesSpotlight({ onNavigate }: VolunteerOpportunitiesSpotlightProps) {
  const { data: eventRequests = [], isLoading } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests'],
    staleTime: 60 * 1000,
  });

  const opportunities = eventRequests
    .filter((request) => request.status === 'scheduled')
    .filter((request) => {
      const { needsSpeaker, needsVolunteer, needsDriver } = getUnfilledNeeds(request);
      return needsSpeaker || needsVolunteer || needsDriver;
    })
    .sort((a, b) => {
      const dateA = a.scheduledEventDate || a.desiredEventDate;
      const dateB = b.scheduledEventDate || b.desiredEventDate;
      const timeA = dateA ? new Date(dateA).getTime() : Infinity;
      const timeB = dateB ? new Date(dateB).getTime() : Infinity;
      return timeA - timeB;
    })
    .slice(0, 3);

  const formatEventDate = (request: EventRequest) => {
    const date = request.scheduledEventDate || request.desiredEventDate;
    return formatDateShort(date);
  };

  if (isLoading) {
    return (
      <div className="premium-card-elevated p-6 mx-4 mb-8 animate-pulse" style={{ borderTop: '4px solid #007E8C' }}>
        <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
        <div className="space-y-3">
          <div className="h-20 bg-gray-100 rounded"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <div className="premium-card-elevated p-6 mx-4 mb-8" style={{ borderTop: '4px solid #007E8C' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#007E8C] rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="premium-text-h3 text-[#007E8C] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FBAD3F]" />
              Volunteer Opportunities
            </h3>
            <p className="premium-text-body-sm text-gray-600">
              Upcoming events that need your help
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('event-requests')}
          className="premium-btn-outline text-sm hidden sm:flex"
          data-testid="button-view-all-opportunities"
        >
          View All
          <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="space-y-3">
        {opportunities.map((event) => {
          const needs = getUnfilledNeeds(event);
          return (
            <Card
              key={event.id}
              className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-[#007E8C]"
              onClick={() => onNavigate('event-requests')}
              data-testid={`opportunity-card-${event.id}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#236383] truncate">
                      {event.organizationName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatEventDate(event)}
                      </span>
                      {event.address && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{event.address.split(',')[0]}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {needs.needsSpeaker && (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                        {needs.speakersNeeded} Speaker{needs.speakersNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                    {needs.needsVolunteer && (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                        {needs.volunteersNeeded} Volunteer{needs.volunteersNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                    {needs.needsDriver && (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">
                        {needs.driversNeeded} Driver{needs.driversNeeded > 1 ? 's' : ''} Needed
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {opportunities.length < eventRequests.filter(r => r.status === 'scheduled' && (getUnfilledNeeds(r).needsSpeaker || getUnfilledNeeds(r).needsVolunteer || getUnfilledNeeds(r).needsDriver)).length
            ? `Showing ${opportunities.length} of ${eventRequests.filter(r => r.status === 'scheduled' && (getUnfilledNeeds(r).needsSpeaker || getUnfilledNeeds(r).needsVolunteer || getUnfilledNeeds(r).needsDriver)).length} opportunities`
            : `${opportunities.length} upcoming opportunity${opportunities.length !== 1 ? 'ies' : 'y'}`}
        </p>
        <button
          onClick={() => onNavigate('event-requests')}
          className="premium-btn-primary text-sm sm:hidden"
          data-testid="button-view-all-opportunities-mobile"
        >
          View All Opportunities
        </button>
      </div>
    </div>
  );
}
