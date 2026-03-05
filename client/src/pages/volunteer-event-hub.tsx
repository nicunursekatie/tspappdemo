/**
 * Volunteer Event Hub
 *
 * A user-friendly interface for volunteers and speakers to browse and sign up
 * for events based on their calendar availability and location convenience.
 *
 * Features:
 * - Calendar view for date-based browsing
 * - Map view for location-based browsing
 * - Filter by role needed (speaker, volunteer, driver)
 * - Request to join events
 * - View own signups and status
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isAfter, startOfDay } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatTimeForDisplay } from '@/lib/date-utils';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Icons
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Mic,
  Car,
  ChevronLeft,
  ChevronRight,
  Building2,
  Sandwich,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  HandHeart,
  Filter,
  List,
  Map as MapIcon,
  CalendarDays,
  UserCheck,
  Info,
  Search,
  Navigation,
} from 'lucide-react';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Types
interface AvailableEvent {
  id: number;
  organizationName: string;
  organizationCategory: string | null;
  department: string | null;
  eventAddress: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
  scheduledEventDate: string | null;
  desiredEventDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  estimatedSandwichCount: number | null;
  status: string | null;
  speakersNeeded: number;
  speakersAssigned: number;
  speakersUnfilled: number;
  volunteersNeeded: number;
  volunteersAssigned: number;
  volunteersUnfilled: number;
  driversNeeded: number;
  driversAssigned: number;
  driversUnfilled: number;
  hasUnfilledNeeds: boolean;
  vanDriverNeeded: boolean;
  selfTransport: boolean | null;
  pickupTime: string | null;
  eventNotes: string | null;
}

interface MySignup {
  id: number;
  eventRequestId: number;
  role: string;
  status: string;
  notes: string | null;
  signedUpAt: string;
  event: {
    id: number;
    organizationName: string;
    scheduledEventDate: string | null;
    desiredEventDate: string | null;
    eventStartTime: string | null;
    eventEndTime: string | null;
    eventAddress: string;
    city: string | null;
    state: string | null;
    status: string;
  };
}

// Custom marker icons using brand colors
const createEventIcon = (needsSpeaker: boolean, needsVolunteer: boolean, needsDriver: boolean, isCompleted = false) => {
  let color = '#22c55e'; // Green for fully staffed
  if (isCompleted) color = '#9ca3af'; // Gray for completed
  else if (needsSpeaker) color = '#a31c41'; // Burgundy for speaker needed
  else if (needsDriver) color = '#236383'; // Dark teal for driver needed
  else if (needsVolunteer) color = '#007e8c'; // Primary teal for volunteer needed

  const html = `
    <div style="position: relative; width: 30px; height: 42px;">
      <svg viewBox="0 0 25 41" width="30" height="42" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-event-marker',
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -35],
  });
};

// Map center setter component
function MapCenterSetter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 10);
  }, [center, map]);
  return null;
}

// Haversine formula for distance between two coordinates in miles
const calculateDistanceMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Create a distinct icon for the user's location
const createUserLocationIcon = () => {
  const html = `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="width: 24px; height: 24px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
      <div style="position: absolute; top: -2px; left: -2px; width: 28px; height: 28px; border: 2px solid #3b82f6; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

// Brand colors: #236383 (dark teal), #47b3cb (light teal), #007e8c (primary teal), #a31c41 (burgundy), #fbad3f (gold)

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const config = {
    speaker: { label: 'Speaker', icon: Mic, className: 'bg-[#a31c41]/10 text-[#a31c41] border-[#a31c41]/30' },
    driver: { label: 'Driver', icon: Car, className: 'bg-[#236383]/10 text-[#236383] border-[#236383]/30' },
    general: { label: 'Volunteer', icon: UserCheck, className: 'bg-[#007e8c]/10 text-[#007e8c] border-[#007e8c]/30' },
  }[role] || { label: role, icon: Users, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1', config.className)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const config = {
    pending: { label: 'Pending Approval', className: 'bg-[#fbad3f]/10 text-[#fbad3f] border-[#fbad3f]/30' },
    confirmed: { label: 'Confirmed', className: 'bg-[#007e8c]/10 text-[#007e8c] border-[#007e8c]/30' },
    declined: { label: 'Declined', className: 'bg-[#a31c41]/10 text-[#a31c41] border-[#a31c41]/30' },
    assigned: { label: 'Assigned', className: 'bg-[#236383]/10 text-[#236383] border-[#236383]/30' },
  }[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200' };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Event card component
function EventCard({
  event,
  onSignup,
  existingSignup,
}: {
  event: AvailableEvent;
  onSignup: (eventId: number) => void;
  existingSignup?: MySignup;
}) {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseISO(eventDate), 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow border-l-4",
      event.status === 'completed' ? 'border-l-gray-400 opacity-80' : 'border-l-[#007e8c]'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{event.organizationName}</CardTitle>
            {event.department && (
              <CardDescription className="text-xs truncate">{event.department}</CardDescription>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {event.status === 'completed' && (
              <Badge className="bg-gray-200 text-gray-600 text-xs">Completed</Badge>
            )}
            {event.organizationCategory && (
              <Badge variant="secondary" className="text-xs bg-[#236383]/10 text-[#236383]">
                {event.organizationCategory}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 shrink-0 text-[#007e8c]" />
          <span>{formattedDate}</span>
        </div>
        {event.eventStartTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 shrink-0 text-[#007e8c]" />
            <span>
              {formatTimeForDisplay(event.eventStartTime)}
              {event.eventEndTime && ` - ${formatTimeForDisplay(event.eventEndTime)}`}
            </span>
          </div>
        )}

        {/* Location */}
        {event.eventAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-[#007e8c]" />
            <span className="break-words">
              {event.eventAddress}
              {event.city && `, ${event.city}`}
              {event.state && `, ${event.state}`}
            </span>
          </div>
        )}

        {/* Sandwich count */}
        {event.estimatedSandwichCount && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sandwich className="w-4 h-4 shrink-0 text-[#fbad3f]" />
            <span>{event.estimatedSandwichCount.toLocaleString()} sandwiches</span>
          </div>
        )}

        {/* Transportation info */}
        {(event.selfTransport !== null || event.pickupTime) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Car className="w-4 h-4 shrink-0 text-[#236383]" />
            <span>
              {event.selfTransport ? 'Self-transport' : event.pickupTime ? `Pickup at ${formatTimeForDisplay(event.pickupTime)}` : 'Transportation TBD'}
            </span>
          </div>
        )}

        {/* Event notes/description - key info for decision making */}
        {event.eventNotes && (
          <div className="bg-[#47b3cb]/10 rounded-lg p-3 text-sm">
            <p className="text-gray-700 line-clamp-3">{event.eventNotes}</p>
          </div>
        )}

        {/* Staffing roles */}
        <div className="space-y-1.5">
          {(event.speakersNeeded > 0 || event.speakersAssigned > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <Mic className="w-3.5 h-3.5 text-[#a31c41] shrink-0" />
              <span className="font-medium text-[#a31c41]">Speakers</span>
              <span className={`text-xs ${event.speakersUnfilled > 0 ? 'text-[#a31c41] font-semibold' : 'text-green-600'}`}>
                {event.speakersAssigned}/{event.speakersNeeded} filled
              </span>
              {event.speakersUnfilled > 0 && (
                <Badge className="bg-[#a31c41] text-white text-[10px] px-1.5 py-0">
                  {event.speakersUnfilled} needed
                </Badge>
              )}
            </div>
          )}
          {(event.volunteersNeeded > 0 || event.volunteersAssigned > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="w-3.5 h-3.5 text-[#007e8c] shrink-0" />
              <span className="font-medium text-[#007e8c]">Volunteers</span>
              <span className={`text-xs ${event.volunteersUnfilled > 0 ? 'text-[#007e8c] font-semibold' : 'text-green-600'}`}>
                {event.volunteersAssigned}/{event.volunteersNeeded} filled
              </span>
              {event.volunteersUnfilled > 0 && (
                <Badge className="bg-[#007e8c] text-white text-[10px] px-1.5 py-0">
                  {event.volunteersUnfilled} needed
                </Badge>
              )}
            </div>
          )}
          {(event.driversNeeded > 0 || event.driversAssigned > 0) && (
            <div className="flex items-center gap-2 text-sm">
              <Car className="w-3.5 h-3.5 text-[#236383] shrink-0" />
              <span className="font-medium text-[#236383]">Drivers</span>
              <span className={`text-xs ${event.driversUnfilled > 0 ? 'text-[#236383] font-semibold' : 'text-green-600'}`}>
                {event.driversAssigned}/{event.driversNeeded} filled
              </span>
              {event.driversUnfilled > 0 && (
                <Badge className="bg-[#236383] text-white text-[10px] px-1.5 py-0">
                  {event.driversUnfilled} needed
                </Badge>
              )}
            </div>
          )}
          {event.vanDriverNeeded && (
            <div className="flex items-center gap-2 text-sm">
              <Car className="w-3.5 h-3.5 text-[#fbad3f] shrink-0" />
              <span className="font-medium text-[#fbad3f]">Van Driver Needed</span>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="pt-2 border-t">
          {event.status === 'completed' ? (
            <p className="text-sm text-gray-500 text-center italic py-1">This event has been completed</p>
          ) : existingSignup ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#007e8c]" />
                <span className="text-sm text-muted-foreground">
                  Signed up as {existingSignup.role}
                </span>
              </div>
              <StatusBadge status={existingSignup.status} />
            </div>
          ) : (
            <Button
              className="w-full bg-[#007e8c] hover:bg-[#236383]"
              onClick={() => onSignup(event.id)}
            >
              <HandHeart className="w-4 h-4 mr-2" />
              {event.hasUnfilledNeeds ? 'Volunteer for this Event' : 'Sign Up to Help'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Signup dialog component
function SignupDialog({
  event,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  event: AvailableEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (roles: string[], notes: string) => void;
  isSubmitting: boolean;
}) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const availableRoles = useMemo(() => {
    if (!event) return [];

    const roles: Array<{
      value: 'speaker' | 'general' | 'driver';
      label: string;
      icon: typeof Mic;
      colorClass: string;
      borderClass: string;
      bgClass: string;
    }> = [];

    // Always show speaker role if event has any speaker need or assigned speakers
    if (event.speakersNeeded > 0 || event.speakersAssigned > 0) {
      roles.push({
        value: 'speaker',
        label: event.speakersUnfilled > 0
          ? `Speaker (${event.speakersUnfilled} needed)`
          : `Speaker (${event.speakersAssigned}/${event.speakersNeeded} filled — extra help welcome)`,
        icon: Mic,
        colorClass: 'text-[#a31c41]',
        borderClass: 'border-[#a31c41]/30',
        bgClass: 'bg-[#a31c41]/5',
      });
    }

    // Always show volunteer role
    roles.push({
      value: 'general',
      label: event.volunteersUnfilled > 0
        ? `General Volunteer (${event.volunteersUnfilled} needed)`
        : event.volunteersNeeded > 0
          ? `General Volunteer (${event.volunteersAssigned}/${event.volunteersNeeded} filled — extra help welcome)`
          : 'General Volunteer (extra help always welcome)',
      icon: UserCheck,
      colorClass: 'text-[#007e8c]',
      borderClass: 'border-[#007e8c]/30',
      bgClass: 'bg-[#007e8c]/5',
    });

    // Show driver role if event needs drivers
    if (event.driversNeeded > 0 || event.driversAssigned > 0) {
      roles.push({
        value: 'driver',
        label: event.driversUnfilled > 0
          ? `Driver (${event.driversUnfilled} needed)`
          : `Driver (${event.driversAssigned}/${event.driversNeeded} filled — extra help welcome)`,
        icon: Car,
        colorClass: 'text-[#236383]',
        borderClass: 'border-[#236383]/30',
        bgClass: 'bg-[#236383]/5',
      });
    }

    return roles;
  }, [event]);

  useEffect(() => {
    if (open && event) {
      const defaultRole = availableRoles[0]?.value;
      setSelectedRoles(defaultRole ? [defaultRole] : []);
      setNotes('');
    }
  }, [open, event, availableRoles]);

  if (!event) return null;

  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate
    ? format(parseISO(eventDate), 'EEEE, MMMM d, yyyy')
    : 'Date TBD';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Volunteer for Event</DialogTitle>
          <DialogDescription>
            Sign up to volunteer at {event.organizationName} on {formattedDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Role selection */}
          <div className="space-y-2">
            <Label>Select your role *</Label>
            {availableRoles.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No roles are currently available for this event.
              </div>
            ) : (
              <div className="space-y-2">
                {availableRoles.map((role) => {
                  const Icon = role.icon;
                  const isSelected = selectedRoles.includes(role.value);
                  return (
                    <Label
                      key={role.value}
                      htmlFor={`role-${role.value}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                        role.borderClass,
                        isSelected ? role.bgClass : 'bg-white'
                      )}
                    >
                      <Checkbox
                        id={`role-${role.value}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          setSelectedRoles((prev) => {
                            if (checked === true) {
                              return Array.from(new Set([...prev, role.value]));
                            }
                            return prev.filter((value) => value !== role.value);
                          });
                        }}
                      />
                      <Icon className={cn('w-4 h-4', role.colorClass)} />
                      <span className="text-sm text-gray-700">{role.label}</span>
                    </Label>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  You can choose more than one role.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special skills, availability notes, or questions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Info box */}
          <div className="bg-[#47b3cb]/10 border border-[#47b3cb]/30 rounded-lg p-3 text-sm text-[#236383]">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">What happens next?</p>
                <p className="text-[#236383]/80 mt-1">
                  A coordinator will review your signup and confirm your participation.
                  You'll receive an email notification once your signup is approved.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(selectedRoles, notes)}
            disabled={selectedRoles.length === 0 || isSubmitting}
            className="bg-[#007e8c] hover:bg-[#236383]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <HandHeart className="w-4 h-4 mr-2" />
                Submit Signup Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main component
export default function VolunteerEventHub() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View state
  const [view, setView] = useState<'calendar' | 'map' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: AvailableEvent[] } | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showOnlyNeeds, setShowOnlyNeeds] = useState(false); // Default to showing all events

  // User location for distance calculation on map
  const [userAddress, setUserAddress] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geocodingLoading, setGeocodingLoading] = useState(false);

  // Fetch available events
  const { data: events = [], isLoading: eventsLoading } = useQuery<AvailableEvent[]>({
    queryKey: ['/api/volunteer-hub/available-events', showOnlyNeeds],
    queryFn: async () => {
      const response = await fetch(`/api/volunteer-hub/available-events?needsOnly=${showOnlyNeeds}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  // Fetch user's signups
  const { data: mySignups = [], isLoading: signupsLoading } = useQuery<MySignup[]>({
    queryKey: ['/api/volunteer-hub/my-signups'],
    queryFn: async () => {
      const response = await fetch('/api/volunteer-hub/my-signups', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch signups');
      return response.json();
    },
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async ({ eventId, roles, notes }: { eventId: number; roles: string[]; notes: string }) => {
      const response = await fetch(`/api/volunteer-hub/signup/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles, notes }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign up');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Signup Submitted!',
        description: data.message || 'Your volunteer request has been submitted.',
      });
      setSignupDialogOpen(false);
      setSelectedEvent(null);
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/my-signups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/available-events'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Cancel signup mutation
  const cancelSignupMutation = useMutation({
    mutationFn: async (signupId: number) => {
      const response = await fetch(`/api/volunteer-hub/signup/${signupId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel signup');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Signup Cancelled',
        description: 'Your volunteer signup has been cancelled.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/volunteer-hub/my-signups'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cancel Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (roleFilter === 'speaker' && event.speakersUnfilled === 0) return false;
      if (roleFilter === 'volunteer' && event.volunteersUnfilled === 0) return false;
      if (roleFilter === 'driver' && event.driversUnfilled === 0) return false;
      return true;
    });
  }, [events, roleFilter]);

  // Calculate summary metrics for dashboard cards
  const summaryMetrics = useMemo(() => {
    const totalEvents = events.length;
    const eventsNeedingHelp = events.filter(e => e.hasUnfilledNeeds).length;
    const totalSpeakerOpenings = events.reduce((sum, e) => sum + e.speakersUnfilled, 0);
    const totalVolunteerOpenings = events.reduce((sum, e) => sum + e.volunteersUnfilled, 0);
    const totalDriverOpenings = events.reduce((sum, e) => sum + e.driversUnfilled, 0);
    const totalOpenings = totalSpeakerOpenings + totalVolunteerOpenings + totalDriverOpenings;

    return {
      totalEvents,
      eventsNeedingHelp,
      totalSpeakerOpenings,
      totalVolunteerOpenings,
      totalDriverOpenings,
      totalOpenings,
    };
  }, [events]);

  // Group events by date for calendar view
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, AvailableEvent[]> = {};
    filteredEvents.forEach(event => {
      const dateStr = event.scheduledEventDate || event.desiredEventDate;
      if (dateStr) {
        const key = dateStr.split('T')[0];
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(event);
      }
    });
    return grouped;
  }, [filteredEvents]);

  // Get existing signup for an event
  const getExistingSignup = (eventId: number) => {
    return mySignups.find(s => s.eventRequestId === eventId);
  };

  // Handle signup click
  // Geocode user address for distance calculation
  const handleGeocodeAddress = async () => {
    if (!userAddress.trim()) return;
    setGeocodingLoading(true);
    try {
      const res = await fetch('/api/event-map/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address: userAddress.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({
          title: 'Address not found',
          description: data.details || 'Could not find that address. Try a more specific address.',
          variant: 'destructive',
        });
        return;
      }
      const data = await res.json();
      setUserLocation({ lat: parseFloat(data.latitude), lng: parseFloat(data.longitude) });
      toast({ title: 'Location set', description: 'Showing distances from your address.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to look up address.', variant: 'destructive' });
    } finally {
      setGeocodingLoading(false);
    }
  };

  const handleSignupClick = (eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setSignupDialogOpen(true);
    }
  };

  // Handle signup submit
  const handleSignupSubmit = (roles: string[], notes: string) => {
    if (selectedEvent) {
      signupMutation.mutate({ eventId: selectedEvent.id, roles, notes });
    }
  };

  // Calendar navigation
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Add padding days for calendar grid
  const startPadding = monthStart.getDay();
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...calendarDays,
  ];

  // Map center (default to NYC area)
  const mapCenter: [number, number] = useMemo(() => {
    const eventsWithCoords = filteredEvents.filter(e => e.latitude && e.longitude);
    if (eventsWithCoords.length > 0) {
      const avgLat = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / eventsWithCoords.length;
      const avgLng = eventsWithCoords.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / eventsWithCoords.length;
      return [avgLat, avgLng];
    }
    return [40.7128, -74.006]; // Default to NYC
  }, [filteredEvents]);

  if (eventsLoading || signupsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <HandHeart className="w-7 h-7 text-[#007e8c]" />
              Volunteer Event Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse upcoming events and sign up to volunteer
            </p>
          </div>

          {/* My Signups Summary */}
          {mySignups.length > 0 && (
            <Card className="sm:w-auto">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="bg-[#007e8c]/10 p-2 rounded-full">
                    <Check className="w-5 h-5 text-[#007e8c]" />
                  </div>
                  <div>
                    <p className="font-medium">{mySignups.length} Active Signup{mySignups.length > 1 ? 's' : ''}</p>
                    <p className="text-sm text-muted-foreground">
                      {mySignups.filter(s => s.status === 'pending').length} pending approval
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Total Events */}
          <div className="bg-[#007e8c]/10 border border-[#007e8c]/20 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="text-[#007e8c] p-2 rounded-lg bg-white/50">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#007e8c]">
                  {summaryMetrics.totalEvents}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Upcoming Events
                </div>
              </div>
            </div>
          </div>

          {/* Drivers Needed */}
          <div className="bg-[#236383]/10 border border-[#236383]/20 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="text-[#236383] p-2 rounded-lg bg-white/50">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#236383]">
                  {summaryMetrics.totalDriverOpenings}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Drivers Needed
                </div>
              </div>
            </div>
          </div>

          {/* Speakers Needed */}
          <div className="bg-[#a31c41]/10 border border-[#a31c41]/20 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="text-[#a31c41] p-2 rounded-lg bg-white/50">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#a31c41]">
                  {summaryMetrics.totalSpeakerOpenings}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Speakers Needed
                </div>
              </div>
            </div>
          </div>

          {/* Total Volunteer Openings */}
          <div className="bg-[#fbad3f]/10 border border-[#fbad3f]/20 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="text-[#fbad3f] p-2 rounded-lg bg-white/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#fbad3f]">
                  {summaryMetrics.totalOpenings}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  Total Openings
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="speaker">Speakers Needed</SelectItem>
                <SelectItem value="volunteer">Volunteers Needed</SelectItem>
                <SelectItem value="driver">Drivers Needed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="showOnlyNeeds"
              checked={showOnlyNeeds}
              onCheckedChange={(checked) => setShowOnlyNeeds(checked === true)}
            />
            <Label htmlFor="showOnlyNeeds" className="text-sm cursor-pointer">
              Only show events that need help
            </Label>
          </div>

          <div className="flex-1" />

          <div className="flex rounded-lg border p-1">
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
              className="gap-1.5"
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </Button>
            <Button
              variant={view === 'map' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('map')}
              className="gap-1.5"
            >
              <MapIcon className="w-4 h-4" />
              Map
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="gap-1.5"
            >
              <List className="w-4 h-4" />
              List
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={view} className="space-y-4">
          {/* Calendar View */}
          <TabsContent value="calendar" className="mt-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                    <Button variant="outline" size="icon" onClick={prevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={nextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-muted-foreground/10 p-2 text-center text-sm font-medium">
                      {day}
                    </div>
                  ))}

                  {/* Calendar cells */}
                  {paddedDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="bg-background p-2 min-h-[100px]" />;
                    }

                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isToday = isSameDay(day, new Date());
                    const isPast = !isAfter(day, startOfDay(new Date())) && !isToday;

                    return (
                      <div
                        key={dateKey}
                        className={cn(
                          'bg-background p-2 min-h-[100px] border-t',
                          isPast && 'opacity-50',
                          isToday && 'ring-2 ring-inset ring-blue-500'
                        )}
                      >
                        <div className={cn(
                          'text-sm font-medium mb-1',
                          isToday && 'bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center'
                        )}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map(event => (
                            <Tooltip key={event.id}>
                              <TooltipTrigger asChild>
                                <button
                                  className={cn(
                                    'w-full text-left text-xs p-1 rounded truncate',
                                    event.status === 'completed'
                                      ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                      : event.speakersUnfilled > 0
                                        ? 'bg-[#a31c41]/10 text-[#a31c41] hover:bg-[#a31c41]/20'
                                        : event.driversUnfilled > 0
                                          ? 'bg-[#236383]/10 text-[#236383] hover:bg-[#236383]/20'
                                          : event.volunteersUnfilled > 0
                                            ? 'bg-[#007e8c]/10 text-[#007e8c] hover:bg-[#007e8c]/20'
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  )}
                                  onClick={() => handleSignupClick(event.id)}
                                >
                                  {event.organizationName}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs">
                                <p className="font-medium">{event.organizationName}</p>
                                {event.status === 'completed' && <p className="text-xs text-green-600 font-medium">Completed</p>}
                                {event.organizationCategory && <p className="text-xs text-muted-foreground">{event.organizationCategory}</p>}
                                {event.eventStartTime && <p className="text-xs mt-1">{formatTimeForDisplay(event.eventStartTime)}{event.eventEndTime && ` - ${formatTimeForDisplay(event.eventEndTime)}`}</p>}
                                {event.eventAddress && <p className="text-xs text-muted-foreground">{event.city || event.eventAddress}</p>}
                                {event.estimatedSandwichCount && <p className="text-xs mt-1">{event.estimatedSandwichCount.toLocaleString()} sandwiches</p>}
                                <div className="space-y-0.5 mt-1">
                                  {(event.speakersNeeded > 0 || event.speakersAssigned > 0) && (
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <Mic className="w-2.5 h-2.5 text-[#a31c41]" />
                                      <span className={event.speakersUnfilled > 0 ? 'text-[#a31c41] font-semibold' : 'text-green-600'}>
                                        Speakers {event.speakersAssigned}/{event.speakersNeeded}
                                      </span>
                                    </div>
                                  )}
                                  {(event.volunteersNeeded > 0 || event.volunteersAssigned > 0) && (
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <UserCheck className="w-2.5 h-2.5 text-[#007e8c]" />
                                      <span className={event.volunteersUnfilled > 0 ? 'text-[#007e8c] font-semibold' : 'text-green-600'}>
                                        Volunteers {event.volunteersAssigned}/{event.volunteersNeeded}
                                      </span>
                                    </div>
                                  )}
                                  {(event.driversNeeded > 0 || event.driversAssigned > 0) && (
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <Car className="w-2.5 h-2.5 text-[#236383]" />
                                      <span className={event.driversUnfilled > 0 ? 'text-[#236383] font-semibold' : 'text-green-600'}>
                                        Drivers {event.driversAssigned}/{event.driversNeeded}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                          {dayEvents.length > 3 && (
                            <button
                              className="text-xs text-[#007e8c] hover:text-[#236383] hover:underline text-center w-full cursor-pointer"
                              onClick={() => setSelectedDayEvents({ date: dateKey, events: dayEvents })}
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-[#a31c41]" />
                    <span>Speaker Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-[#007e8c]" />
                    <span>Volunteer Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-[#236383]" />
                    <span>Driver Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    <span>Fully Staffed <span className="text-muted-foreground">(extra help still welcome!)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gray-400" />
                    <span>Completed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Map View */}
          <TabsContent value="map" className="mt-0">
            <Card>
              <CardContent className="p-0">
                {/* Address search for distance */}
                <div className="p-4 border-b">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-[#236383] shrink-0" />
                    <span className="text-sm font-medium text-gray-700 shrink-0">Your location:</span>
                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder="Enter your address to see distances..."
                        value={userAddress}
                        onChange={(e) => setUserAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGeocodeAddress()}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={handleGeocodeAddress}
                        disabled={geocodingLoading || !userAddress.trim()}
                        className="bg-[#007e8c] hover:bg-[#236383] shrink-0"
                      >
                        {geocodingLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                      {userLocation && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setUserLocation(null); setUserAddress(''); }}
                          className="shrink-0 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  {userLocation && (
                    <p className="text-xs text-green-600 mt-1 ml-6">
                      <Check className="w-3 h-3 inline mr-1" />
                      Location set — distances shown in event popups
                    </p>
                  )}
                </div>

                <div className="h-[600px] rounded-lg overflow-hidden">
                  <MapContainer
                    center={userLocation ? [userLocation.lat, userLocation.lng] : mapCenter}
                    zoom={10}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapCenterSetter center={userLocation ? [userLocation.lat, userLocation.lng] : mapCenter} />

                    {/* User location marker */}
                    {userLocation && (
                      <Marker
                        position={[userLocation.lat, userLocation.lng]}
                        icon={createUserLocationIcon()}
                      >
                        <Popup>
                          <div className="text-sm font-medium">Your Location</div>
                          <div className="text-xs text-muted-foreground">{userAddress}</div>
                        </Popup>
                      </Marker>
                    )}

                    {filteredEvents
                      .filter(e => e.latitude && e.longitude)
                      .map(event => (
                        <Marker
                          key={event.id}
                          position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                          icon={createEventIcon(
                            event.speakersUnfilled > 0,
                            event.volunteersUnfilled > 0,
                            event.driversUnfilled > 0,
                            event.status === 'completed'
                          )}
                        >
                          <Popup>
                            <div className="min-w-[200px] space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{event.organizationName}</h3>
                                {event.status === 'completed' && (
                                  <Badge className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0">Completed</Badge>
                                )}
                              </div>
                              {event.scheduledEventDate && (
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(event.scheduledEventDate), 'MMM d, yyyy')}
                                  {event.eventStartTime && ` at ${formatTimeForDisplay(event.eventStartTime)}`}
                                </p>
                              )}
                              <p className="text-sm">{event.eventAddress}</p>
                              {userLocation && event.latitude && event.longitude && (
                                <p className="text-sm font-medium text-blue-600">
                                  <Navigation className="w-3 h-3 inline mr-1" />
                                  {calculateDistanceMiles(
                                    userLocation.lat, userLocation.lng,
                                    parseFloat(event.latitude), parseFloat(event.longitude)
                                  ).toFixed(1)} miles from you
                                </p>
                              )}

                              <div className="space-y-1">
                                {(event.speakersNeeded > 0 || event.speakersAssigned > 0) && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Mic className="w-3 h-3 text-[#a31c41] shrink-0" />
                                    <span className="font-medium">Speakers</span>
                                    <span className={event.speakersUnfilled > 0 ? 'text-[#a31c41] font-semibold' : 'text-green-600'}>
                                      {event.speakersAssigned}/{event.speakersNeeded}
                                    </span>
                                    {event.speakersUnfilled > 0 && (
                                      <Badge className="bg-[#a31c41] text-white text-[10px] px-1 py-0">{event.speakersUnfilled} needed</Badge>
                                    )}
                                  </div>
                                )}
                                {(event.volunteersNeeded > 0 || event.volunteersAssigned > 0) && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <UserCheck className="w-3 h-3 text-[#007e8c] shrink-0" />
                                    <span className="font-medium">Volunteers</span>
                                    <span className={event.volunteersUnfilled > 0 ? 'text-[#007e8c] font-semibold' : 'text-green-600'}>
                                      {event.volunteersAssigned}/{event.volunteersNeeded}
                                    </span>
                                    {event.volunteersUnfilled > 0 && (
                                      <Badge className="bg-[#007e8c] text-white text-[10px] px-1 py-0">{event.volunteersUnfilled} needed</Badge>
                                    )}
                                  </div>
                                )}
                                {(event.driversNeeded > 0 || event.driversAssigned > 0) && (
                                  <div className="flex items-center gap-1.5 text-xs">
                                    <Car className="w-3 h-3 text-[#236383] shrink-0" />
                                    <span className="font-medium">Drivers</span>
                                    <span className={event.driversUnfilled > 0 ? 'text-[#236383] font-semibold' : 'text-green-600'}>
                                      {event.driversAssigned}/{event.driversNeeded}
                                    </span>
                                    {event.driversUnfilled > 0 && (
                                      <Badge className="bg-[#236383] text-white text-[10px] px-1 py-0">{event.driversUnfilled} needed</Badge>
                                    )}
                                  </div>
                                )}
                              </div>

                              {event.status !== 'completed' ? (
                              <Button
                                size="sm"
                                className="w-full mt-2 bg-[#007e8c] hover:bg-[#236383]"
                                onClick={() => handleSignupClick(event.id)}
                              >
                                <HandHeart className="w-3 h-3 mr-1" />
                                Volunteer
                              </Button>
                              ) : (
                              <p className="text-xs text-gray-500 mt-2 text-center italic">This event has been completed</p>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>
                </div>

                {/* Map Legend */}
                <div className="p-4 border-t flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#a31c41]" />
                    <span>Speaker Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#007e8c]" />
                    <span>Volunteer Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-[#236383]" />
                    <span>Driver Needed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500" />
                    <span>Fully Staffed <span className="text-muted-foreground">(extra help still welcome!)</span></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-gray-400" />
                    <span>Completed</span>
                  </div>
                  {userLocation && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
                      <span>Your Location</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* List View */}
          <TabsContent value="list" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No Events Found</h3>
                    <p className="text-muted-foreground mt-1">
                      {showOnlyNeeds
                        ? 'All current events are fully staffed!'
                        : 'No upcoming events match your filters.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSignup={handleSignupClick}
                    existingSignup={getExistingSignup(event.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* My Signups Section */}
        {mySignups.length > 0 && (
          <Card className="border-t-4 border-t-[#007e8c]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#007e8c]" />
                My Volunteer Signups
              </CardTitle>
              <CardDescription>
                Events you've signed up to help with
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mySignups.map(signup => (
                  <div
                    key={signup.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{signup.event.organizationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {signup.event.scheduledEventDate
                            ? format(parseISO(signup.event.scheduledEventDate), 'MMM d, yyyy')
                            : 'Date TBD'}
                          {signup.event.eventStartTime && ` at ${formatTimeForDisplay(signup.event.eventStartTime)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RoleBadge role={signup.role} />
                      <StatusBadge status={signup.status} />
                      {signup.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelSignupMutation.mutate(signup.id)}
                          disabled={cancelSignupMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signup Dialog */}
        <SignupDialog
          event={selectedEvent}
          open={signupDialogOpen}
          onOpenChange={setSignupDialogOpen}
          onSubmit={handleSignupSubmit}
          isSubmitting={signupMutation.isPending}
        />

        {/* Day Events Dialog - shows all events for a selected day */}
        <Dialog open={!!selectedDayEvents} onOpenChange={(open) => !open && setSelectedDayEvents(null)}>
          <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Events on {selectedDayEvents?.date ? format(parseISO(selectedDayEvents.date), 'EEEE, MMMM d, yyyy') : ''}
              </DialogTitle>
              <DialogDescription>
                {selectedDayEvents?.events.length} event{selectedDayEvents?.events.length !== 1 ? 's' : ''} scheduled
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-3 py-2">
                {selectedDayEvents?.events.map(event => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border hover:border-[#007e8c] hover:bg-[#007e8c]/5 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedDayEvents(null);
                      handleSignupClick(event.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.organizationName}</p>
                        {event.department && (
                          <p className="text-xs text-muted-foreground truncate">{event.department}</p>
                        )}
                      </div>
                      {event.organizationCategory && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {event.organizationCategory}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {event.eventStartTime && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatTimeForDisplay(event.eventStartTime)}{event.eventEndTime && ` - ${formatTimeForDisplay(event.eventEndTime)}`}</span>
                        </div>
                      )}
                      {event.eventAddress && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate">{event.eventAddress}{event.city && `, ${event.city}`}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 mt-2">
                      {(event.speakersNeeded > 0 || event.speakersAssigned > 0) && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Mic className="w-3 h-3 text-[#a31c41]" />
                          <span className="font-medium text-[#a31c41]">Speakers</span>
                          <span className={event.speakersUnfilled > 0 ? 'text-[#a31c41] font-semibold' : 'text-green-600'}>
                            {event.speakersAssigned}/{event.speakersNeeded}
                          </span>
                          {event.speakersUnfilled > 0 && (
                            <Badge className="bg-[#a31c41] text-white text-[10px] px-1 py-0 h-4">{event.speakersUnfilled} needed</Badge>
                          )}
                        </div>
                      )}
                      {(event.volunteersNeeded > 0 || event.volunteersAssigned > 0) && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <UserCheck className="w-3 h-3 text-[#007e8c]" />
                          <span className="font-medium text-[#007e8c]">Volunteers</span>
                          <span className={event.volunteersUnfilled > 0 ? 'text-[#007e8c] font-semibold' : 'text-green-600'}>
                            {event.volunteersAssigned}/{event.volunteersNeeded}
                          </span>
                          {event.volunteersUnfilled > 0 && (
                            <Badge className="bg-[#007e8c] text-white text-[10px] px-1 py-0 h-4">{event.volunteersUnfilled} needed</Badge>
                          )}
                        </div>
                      )}
                      {(event.driversNeeded > 0 || event.driversAssigned > 0) && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Car className="w-3 h-3 text-[#236383]" />
                          <span className="font-medium text-[#236383]">Drivers</span>
                          <span className={event.driversUnfilled > 0 ? 'text-[#236383] font-semibold' : 'text-green-600'}>
                            {event.driversAssigned}/{event.driversNeeded}
                          </span>
                          {event.driversUnfilled > 0 && (
                            <Badge className="bg-[#236383] text-white text-[10px] px-1 py-0 h-4">{event.driversUnfilled} needed</Badge>
                          )}
                        </div>
                      )}
                      {event.vanDriverNeeded && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Car className="w-3 h-3 text-[#fbad3f]" />
                          <span className="font-medium text-[#fbad3f]">Van Driver Needed</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setSelectedDayEvents(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
