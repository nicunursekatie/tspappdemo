import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Tooltip } from 'react-leaflet';
import { useLocation } from 'wouter';

import {
  MapPin, Calendar, Package, Phone, AlertCircle,
  ChevronRight, ChevronLeft, RefreshCw, Clock, Truck,
  Users, Copy, Check, Building2, Heart, Edit2, Save, Loader2,
  ChevronUp, ChevronDown, X, Maximize2, Minimize2, List, ExternalLink,
  Navigation, Home, Target, User, Megaphone, EyeOff
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePageSession } from '@/hooks/usePageSession';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import type { UserForPermissions } from '@shared/types';
import { Input } from '@/components/ui/input';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { format, addWeeks, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';
import {
  getDriverIds, getDriverCount, getTotalDriverCount, hasDriver,
  getSpeakerIds, getSpeakerCount,
  getVolunteerIds, getVolunteerCount
} from '@/lib/assignment-utils';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EventEditDialog } from '@/components/event-requests/dialogs/EventEditDialog';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Override Leaflet's default divIcon styles that hide custom SVG markers
// Leaflet adds background: #fff and border which covers our SVG icons
const customMarkerStyles = `
  .custom-marker.leaflet-div-icon {
    background: transparent !important;
    border: none !important;
  }
  .driver-marker.leaflet-div-icon,
  .volunteer-marker.leaflet-div-icon,
  .event-marker.leaflet-div-icon {
    background: transparent !important;
    border: none !important;
  }
`;

// Inject custom marker styles
if (typeof document !== 'undefined') {
  const styleId = 'driver-planning-marker-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = customMarkerStyles;
    document.head.appendChild(styleEl);
  }
}

// Helper function to parse date strings as local dates
const parseLocalDate = (dateString: string): Date => {
  if (!dateString) return new Date();

  // Extract just the date part (YYYY-MM-DD) from any format
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  // Create date at local midnight (not UTC midnight)
  return new Date(year, month - 1, day);
};

// Haversine formula for accurate distance calculation between coordinates
const calculateDistanceInMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const R = 3959; // Earth's radius in miles

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Types
interface EventMapData {
  id: number;
  organizationName: string | null;
  organizationCategory: string | null;
  department: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  eventAddress: string;
  latitude: string | null;
  longitude: string | null;
  desiredEventDate: string | null;
  scheduledEventDate: string | null;
  status: string;
  estimatedSandwichCount: number | null;
  tspContactAssigned: string | null;
  tspContact: string | null;
  customTspContact: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  driversNeeded: number | null;
  assignedDriverIds: string[] | null;
  assignedRecipientIds: string[] | null;
  tentativeDriverIds: string[] | null;
  speakersNeeded?: number | null;
  assignedSpeakerIds?: string[] | null;
  volunteersNeeded?: number | null;
  assignedVolunteerIds?: string[] | null;
  // JSONB detail fields (source of truth for assignments)
  driverDetails?: Record<string, any> | null;
  speakerDetails?: Record<string, any> | null;
  volunteerDetails?: Record<string, any> | null;
  sandwichTypes: { type: string; quantity: number }[] | null;
  pickupTime: string | null;
  pickupTimeWindow: string | null;
  selfTransport: boolean | null;
  vanDriverNeeded: boolean | null;
  assignedVanDriverId: string | null;
  isDhlVan?: boolean | null;
}

interface Driver {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  vehicleType: string | null;
  vanApproved: boolean | null;
  isActive: boolean | null;
  availability: string | null;
  area: string | null;
  zone: string | null;
  hostLocation: string | null;
  routeDescription: string | null;
  homeAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  geocodedAt: string | null;
}

type DriverSource = 'driver' | 'host' | 'volunteer';

interface DriverCandidate {
  id: string; // source-prefixed id (e.g., driver-1, host-2, volunteer-3)
  source: DriverSource;
  name: string;
  email: string | null;
  phone: string | null;
  latitude: string;
  longitude: string;
  area?: string | null;
  zone?: string | null;
  routeDescription?: string | null;
  homeAddress?: string | null;
  availability?: string | null;
  vehicleType?: string | null;
  vanApproved?: boolean | null;
  hostLocation?: string | null;
}

interface HostContact {
  id: number;
  contactName: string;
  role: string;
  hostLocationName: string;
  address: string | null;
  latitude: string;
  longitude: string;
  email: string | null;
  phone: string | null;
}

interface RecipientMapData {
  id: number;
  name: string;
  address: string | null;
  region: string | null;
  latitude: string;
  longitude: string;
  estimatedSandwiches: number | null;
  collectionDay: string | null;
  collectionTime: string | null;
  focusAreas: string[] | null;
  contactPersonName: string | null;
  phone: string | null;
}

// Custom marker icons with different shapes
// Events: Teardrop/pin shape using divIcon for consistent rendering
const createEventIcon = (color: string) => {
  const html = `
    <div style="
      position: relative;
      width: 25px;
      height: 41px;
    ">
      <svg viewBox="0 0 25 41" width="25" height="41" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="12.5" cy="12.5" r="5" fill="white"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker event-marker',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
  });
};

// Hosts: Circle shape
const createHostIcon = (color: string) => {
  const size = 20;
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Recipients: Square shape
const createRecipientIcon = (color: string) => {
  const size = 20;
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 3px solid white;
      border-radius: 2px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transform: rotate(45deg);
    "></div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Drivers: Triangle shape using SVG for proper rendering
const createDriverIcon = (color: string) => {
  const size = 24;
  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
    ">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L22 20H2L12 2Z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="12" cy="14" r="3" fill="white"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker driver-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

// Host+Driver combo: Circle with inner triangle (for people who are both hosts and drivers)
const createHostDriverIcon = (hostColor: string, driverColor: string) => {
  const size = 26;
  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
    ">
      <svg viewBox="0 0 26 26" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <!-- Outer circle (host) -->
        <circle cx="13" cy="13" r="11" fill="${hostColor}" stroke="white" stroke-width="2"/>
        <!-- Inner triangle (driver) -->
        <path d="M13 6L19 18H7L13 6Z" fill="${driverColor}" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker host-driver-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Volunteers/Speakers: Star shape
const createVolunteerIcon = (color: string) => {
  const size = 22;
  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
    ">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker volunteer-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Team Members: Rounded square
const createTeamMemberIcon = (color: string) => {
  const size = 20;
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 5px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
  `;
  return L.divIcon({
    html,
    className: 'custom-marker team-member-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
};

// Color mappings
const colors = {
  event: '#3388ff',      // Blue
  selectedEvent: '#ff0000', // Red
  host: '#2ecc71',       // Green
  hostFocused: '#ff9500', // Orange
  recipient: '#9b59b6',  // Violet/Purple
  recipientFocused: '#ff9500', // Orange
  volunteer: '#8b5cf6',  // Purple/violet for volunteers/speakers
  driver: '#f1c40f',     // Yellow
  customLocation: '#ea580c', // Orange for custom/quick lookup locations
  teamMember: '#e74c3c', // Coral/red for team members
};

const eventIcon = createEventIcon(colors.event);
const selectedEventIcon = createEventIcon(colors.selectedEvent);
const customLocationIcon = createEventIcon(colors.customLocation); // Orange pin for custom locations
const hostIcon = createHostIcon(colors.host);
const hostFocusedIcon = createHostIcon(colors.hostFocused);
const recipientIcon = createRecipientIcon(colors.recipient);
const recipientFocusedIcon = createRecipientIcon(colors.recipientFocused);
const driverIcon = createDriverIcon(colors.driver);
const hostDriverIcon = createHostDriverIcon(colors.host, colors.driver); // Combined icon for host+driver
const volunteerIcon = createVolunteerIcon(colors.volunteer);
const teamMemberIcon = createTeamMemberIcon(colors.teamMember);

// Format time to 12-hour format
const formatTime12Hour = (time: string | null): string => {
  if (!time) return '';
  try {
    // Handle both 24-hour format (e.g., "11:00") and 12-hour format (e.g., "11:00 AM")
    // Remove any existing AM/PM and whitespace
    const cleanTime = time.trim().toUpperCase().replace(/\s*(AM|PM)\s*/i, '');
    const [hoursStr, minutesStr] = cleanTime.split(':');
    
    if (!hoursStr || !minutesStr) {
      console.error('Failed to parse time (invalid format):', time);
      return time; // Return original if we can't parse
    }
    
    // Parse minutes (may have trailing characters)
    const minutes = parseInt(minutesStr.trim().split(/\s+/)[0], 10);
    let hours = parseInt(hoursStr.trim(), 10);
    
    // If original time had AM/PM, preserve it
    const hasAM = /AM/i.test(time);
    const hasPM = /PM/i.test(time);
    
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      console.error('Failed to parse time (NaN):', time);
      return time; // Return original if we can't parse
    }
    
    // If input was already 12-hour format, use it as-is
    if (hasAM || hasPM) {
      // Adjust hours if PM and not 12
      if (hasPM && hours !== 12) {
        hours += 12;
      } else if (hasAM && hours === 12) {
        hours = 0;
      }
    }
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    console.error('Failed to parse time:', time, error);
    return time || 'Invalid time';
  }
};

// Extract city from address
const extractCityFromAddress = (address: string | null): string | null => {
  if (!address) return null;
  // Common patterns: "123 Main St, Atlanta, GA 30301" or "123 Main St, Atlanta GA 30301"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // City is usually the second-to-last part before state/zip
    const cityPart = parts[parts.length - 2];
    // Remove any numbers (zip codes that might be attached)
    return cityPart.replace(/\d+/g, '').trim();
  }
  return null;
};

/**
 * City abbreviation mappings for location matching.
 * Maps full city names (lowercase) to an array of common abbreviations.
 * Used by locationMatchesCity() to match driver locations to event cities
 * when users enter abbreviated or shorthand location names.
 */
const CITY_ABBREVIATIONS: Record<string, string[]> = {
  'sandy springs': ['ss'],
  'alpharetta': ['alpha'],
  // Add more as needed
};

// Check if a location string matches a city (including abbreviations)
const locationMatchesCity = (location: string, city: string): boolean => {
  const locLower = location.toLowerCase();
  const cityLower = city.toLowerCase();
  
  // Direct match
  if (locLower.includes(cityLower) || cityLower.includes(locLower)) {
    return true;
  }
  
  // Check abbreviations for the city
  const cityAbbrevs = CITY_ABBREVIATIONS[cityLower] || [];
  if (cityAbbrevs.some(abbrev => locLower.includes(abbrev))) {
    return true;
  }
  
  // Check if location is an abbreviation that matches the city
  for (const [fullName, abbrevs] of Object.entries(CITY_ABBREVIATIONS)) {
    if (abbrevs.some(abbrev => locLower.includes(abbrev)) && cityLower.includes(fullName)) {
      return true;
    }
    if (locLower.includes(fullName) && abbrevs.some(abbrev => cityLower.includes(abbrev))) {
      return true;
    }
  }
  
  return false;
};

// Check if driver location matches event area
const doesDriverMatchEventArea = (driver: Driver, eventAddress: string | null): boolean => {
  if (!eventAddress) return false;

  const eventCity = extractCityFromAddress(eventAddress);
  if (!eventCity) return false;

  // Check all driver location fields
  const driverLocations = [
    driver.hostLocation,
    driver.area,
    driver.zone,
    driver.routeDescription,
    driver.homeAddress
  ].filter(Boolean) as string[];

  // Check if any driver location matches the event city
  return driverLocations.some(loc => locationMatchesCity(loc, eventCity));
};

// Type for focused map item (host, recipient, or driver)
interface FocusedMapItem {
  type: 'host' | 'recipient' | 'driver' | 'speaker';
  id: number | string;
  latitude: string;
  longitude: string;
  name?: string; // For display in the route info
}

// Type for driving route between event and focused item
interface DrivingRoute {
  coordinates: [number, number][];
  distance: number; // in meters
  duration: number; // in seconds (without traffic)
  durationInTraffic: number | null; // in seconds (with traffic, if available)
  fromEvent: { lat: number; lng: number };
  toItem: { lat: number; lng: number; type: 'host' | 'recipient' | 'driver' | 'speaker'; id: number | string };
}

// Type for selected driver/destination for trip planning
// "Selected" = confirmed for the trip (not just previewed)
// User flow: Preview (click to see distance) -> Select (confirm for trip) -> Unselect (remove from trip)
interface SelectedDriver {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
}

interface SelectedDestination {
  type: 'host' | 'recipient';
  id: number;
  name: string;
  latitude: string;
  longitude: string;
}

// Type for full trip route (driver -> event -> destination)
interface FullTripRoute {
  // Leg 1: Driver home to event
  leg1: {
    coordinates: [number, number][];
    distance: number;
    duration: number;
    durationInTraffic: number | null;
  };
  // Leg 2: Event to destination
  leg2: {
    coordinates: [number, number][];
    distance: number;
    duration: number;
    durationInTraffic: number | null;
  };
  // For map display
  driverLocation: { lat: number; lng: number };
  eventLocation: { lat: number; lng: number };
  destinationLocation: { lat: number; lng: number };
}

// Fetch driving route with traffic data from server API (uses Google Maps Directions API)
// departureTime can be 'now', an ISO timestamp, or undefined (defaults to 'now')
async function fetchDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  departureTime?: string,
  signal?: AbortSignal
): Promise<{ coordinates: [number, number][]; distance: number; duration: number; durationInTraffic: number | null } | null> {
  try {
    // Call our server-side API which uses Google Maps Directions API (with traffic)
    // Falls back to OSRM if Google API key is not configured
    const response = await fetch('/api/directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: { lat: fromLat, lng: fromLng },
        destination: { lat: toLat, lng: toLng },
        departureTime: departureTime || 'now', // Use predictive traffic for future events
      }),
      signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.coordinates || data.coordinates.length === 0) return null;

    return {
      coordinates: data.coordinates,
      distance: data.distance,
      duration: data.duration,
      durationInTraffic: data.durationInTraffic,
    };
  } catch (error) {
    // Don't log abort errors - they're expected when cancelling requests
    if (error instanceof Error && error.name === 'AbortError') {
      return null;
    }
    console.error('Failed to fetch driving route:', error);
    return null;
  }
}

// Helper to calculate the driver's departure time from event date and pickup time
// This is used for predictive traffic based on when the driver would actually leave
function getEventDepartureTime(event: EventMapData | null): string {
  if (!event) return 'now';

  // Use scheduled date, falling back to desired date
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  if (!eventDate) return 'now';

  // Use pickup time if available, otherwise use event start time
  const timeStr = event.pickupTime || event.eventStartTime;

  try {
    // Parse the date (YYYY-MM-DD format)
    const [year, month, day] = eventDate.split('-').map(Number);

    // If we have a time, use it; otherwise default to 8am (typical pickup time)
    let hours = 8;
    let minutes = 0;
    if (timeStr) {
      const timeParts = timeStr.split(':');
      hours = parseInt(timeParts[0], 10) || 8;
      minutes = parseInt(timeParts[1], 10) || 0;
    }

    // Create the departure date/time
    const departureDate = new Date(year, month - 1, day, hours, minutes);

    // If the date is in the past, use 'now' for current traffic
    if (departureDate < new Date()) {
      return 'now';
    }

    return departureDate.toISOString();
  } catch {
    return 'now';
  }
}

// Helper to format duration with traffic info
function formatDuration(duration: number, durationInTraffic: number | null): { text: string; hasTraffic: boolean; trafficDelay: number | null } {
  const baseMinutes = Math.round(duration / 60);

  if (durationInTraffic !== null && durationInTraffic > duration) {
    const trafficMinutes = Math.round(durationInTraffic / 60);
    const delayMinutes = trafficMinutes - baseMinutes;
    return {
      text: `${trafficMinutes}`,
      hasTraffic: true,
      trafficDelay: delayMinutes,
    };
  }

  return {
    text: `${baseMinutes}`,
    hasTraffic: false,
    trafficDelay: null,
  };
}

// Component to center map on selected event or focused item
function MapController({
  selectedEvent,
  events,
  focusedItem,
  nearbyHosts,
  nearbyRecipients,
  designatedRecipients,
  drivingRoute,
  fullTripRoute,
}: {
  selectedEvent: EventMapData | null;
  events: EventMapData[];
  focusedItem: FocusedMapItem | null;
  nearbyHosts: { latitude: string; longitude: string }[];
  nearbyRecipients: { latitude: string; longitude: string }[];
  designatedRecipients: { latitude: string; longitude: string }[];
  drivingRoute: DrivingRoute | null;
  fullTripRoute: FullTripRoute | null;
}) {
  const map = useMap();

  // Close popups when focused item is cleared
  useEffect(() => {
    if (!focusedItem) {
      map.closePopup();
    }
  }, [focusedItem, map]);

  // Handle full trip route - fit bounds to show all three points (driver, event, destination)
  useEffect(() => {
    if (fullTripRoute) {
      const allCoords = [
        ...fullTripRoute.leg1.coordinates,
        ...fullTripRoute.leg2.coordinates,
      ];
      if (allCoords.length > 0) {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }
  }, [fullTripRoute, map]);

  // Handle driving route - fit bounds to show both endpoints
  useEffect(() => {
    if (!fullTripRoute && drivingRoute && drivingRoute.coordinates.length > 0) {
      const bounds = L.latLngBounds(drivingRoute.coordinates);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [drivingRoute, fullTripRoute, map]);

  // Handle focused item when no route (fallback behavior)
  useEffect(() => {
    // Only pan to focused item if there's no driving route or full trip being shown
    if (!drivingRoute && !fullTripRoute && focusedItem?.latitude && focusedItem?.longitude) {
      map.setView(
        [parseFloat(focusedItem.latitude), parseFloat(focusedItem.longitude)],
        15,
        { animate: true }
      );
    }
  }, [focusedItem, drivingRoute, fullTripRoute, map]);

  // Center on selected event with bounds that include at least one host and one recipient
  const selectedEventId = selectedEvent?.id;
  useEffect(() => {
    if (selectedEvent?.latitude && selectedEvent?.longitude) {
      const points: [number, number][] = [
        [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)]
      ];

      // Add closest host if available
      if (nearbyHosts.length > 0) {
        points.push([
          parseFloat(nearbyHosts[0].latitude),
          parseFloat(nearbyHosts[0].longitude)
        ]);
      }

      // Add designated recipient if available, otherwise add closest recipient
      if (designatedRecipients.length > 0) {
        points.push([
          parseFloat(designatedRecipients[0].latitude),
          parseFloat(designatedRecipients[0].longitude)
        ]);
      } else if (nearbyRecipients.length > 0) {
        points.push([
          parseFloat(nearbyRecipients[0].latitude),
          parseFloat(nearbyRecipients[0].longitude)
        ]);
      }

      if (points.length > 1) {
        // Compute zoom that includes event + closest host + closest recipient, but keep the event centered
        const bounds = L.latLngBounds(points);
        const zoomForBounds = Math.min(map.getBoundsZoom(bounds, false, L.point(60, 60)), 14);
        map.setView(
          [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)],
          zoomForBounds,
          { animate: true }
        );
      } else {
        // Fallback to just centering on event if no hosts/recipients
        map.setView(
          [parseFloat(selectedEvent.latitude), parseFloat(selectedEvent.longitude)],
          14,
          { animate: true }
        );
      }
    }
  }, [
    selectedEventId,
    selectedEvent?.latitude,
    selectedEvent?.longitude,
    nearbyHosts,
    nearbyRecipients,
    designatedRecipients,
    map
  ]);

  // Fit bounds to all events on initial load (when no event selected)
  useEffect(() => {
    if (!selectedEvent && events.length > 0) {
      const validEvents = events.filter(e => e.latitude && e.longitude);
      if (validEvents.length > 0) {
        const bounds = L.latLngBounds(
          validEvents.map(e => [parseFloat(e.latitude!), parseFloat(e.longitude!)])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedEvent, events, map]);

  return null;
}

function MapResizeObserver() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') {
      map.invalidateSize();
      return;
    }

    let frame: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize();
        frame = null;
      });
    });

    observer.observe(container);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

// Generate SMS message for driver outreach
type SMSDriver = { id: string | number; name: string; phone?: string | null };

const generateDriverSMS = (event: EventMapData, driver: SMSDriver): string => {
  const eventDate = event.scheduledEventDate || event.desiredEventDate;
  const formattedDate = eventDate ? format(parseLocalDate(eventDate), 'EEEE, MMMM d') : 'TBD';
  const time = event.pickupTime || event.eventStartTime;
  const formattedTime = time ? formatTime12Hour(time) : 'TBD';
  const location = event.eventAddress || 'TBD';
  const sandwichCount = event.estimatedSandwichCount || 'TBD';
  const firstName = driver.name?.split(' ')[0] || 'there';

  return `Hi ${firstName}! We have a sandwich event coming up and would love your help! 🥪

📅 ${formattedDate}
⏰ Pickup around ${formattedTime}
📍 ${location}
🥪 ~${sandwichCount} sandwiches

Would you be available to help with delivery? Let me know and I'll send you the details!

Thanks so much!
- The Sandwich Project Team`;
};

export default function DriverPlanningDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Track page session for activity logging
  usePageSession({
    section: 'Driver Planning',
    page: 'Driver Planning Map',
    context: { userRole: user?.role },
  });

  const [selectedEvent, setSelectedEvent] = useState<EventMapData | null>(null);
  const [weeksAhead, setWeeksAhead] = useState<string>('all');
  const [copiedDriverId, setCopiedDriverId] = useState<string | number | null>(null);
  const [focusedItem, setFocusedItem] = useState<FocusedMapItem | null>(null);
  const [drivingRoute, setDrivingRoute] = useState<DrivingRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const routeAbortControllerRef = useRef<AbortController | null>(null);

  // Trip planning selections (driver + destination)
  const [selectedDriver, setSelectedDriver] = useState<SelectedDriver | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<SelectedDestination | null>(null);
  const [fullTripRoute, setFullTripRoute] = useState<FullTripRoute | null>(null);
  const [isLoadingFullTrip, setIsLoadingFullTrip] = useState(false);
  const [showAllHosts, setShowAllHosts] = useState(false);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [showAllNearbyDrivers, setShowAllNearbyDrivers] = useState(false);
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'details' | null>(null);
  const [mobileFullscreenMap, setMobileFullscreenMap] = useState(false);
  const [mobileEventsCollapsed, setMobileEventsCollapsed] = useState(false);
  const [showOnlyUnmetStaffing, setShowOnlyUnmetStaffing] = useState(true);
  const [showPendingEvents, setShowPendingEvents] = useState(false);
  const [geocodingEventId, setGeocodingEventId] = useState<number | null>(null);
  const [showVolunteersSpeakers, setShowVolunteersSpeakers] = useState(false);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [tripPlanningCollapsed, setTripPlanningCollapsed] = useState(false);

  // Quick Location Lookup state
  const [customLocation, setCustomLocation] = useState<{
    address: string;
    latitude: string;
    longitude: string;
  } | null>(null);
  const [showQuickLookup, setShowQuickLookup] = useState(false);
  const [quickLookupAddress, setQuickLookupAddress] = useState('');
  const [isGeocodingQuickLookup, setIsGeocodingQuickLookup] = useState(false);

  // Helper to clear trip planning selections when switching events
  const clearTripPlanningState = () => {
    setSelectedDriver(null);
    setSelectedDestination(null);
    setFullTripRoute(null);
    setDrivingRoute(null);
    setFocusedItem(null);
  };

  // Check if user has edit permission
  const canEditEvents = user && hasPermission(user as UserForPermissions, PERMISSIONS.EVENT_REQUESTS_EDIT);

  // Effective selected event: either custom location (as virtual event) or real selected event
  // This allows the quick location lookup to reuse all the nearby entity calculations
  // NOTE: Must be defined before handleItemClick which references it
  const effectiveSelectedEvent = useMemo((): EventMapData | null => {
    if (customLocation) {
      return {
        id: -1,
        organizationName: customLocation.address,
        organizationCategory: null,
        department: null,
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        eventAddress: customLocation.address,
        latitude: customLocation.latitude,
        longitude: customLocation.longitude,
        desiredEventDate: null,
        scheduledEventDate: null,
        status: 'custom',
        estimatedSandwichCount: null,
        tspContactAssigned: null,
        tspContact: null,
        customTspContact: null,
        eventStartTime: null,
        eventEndTime: null,
        driversNeeded: null,
        assignedDriverIds: null,
        assignedRecipientIds: null,
        tentativeDriverIds: null,
        speakersNeeded: null,
        assignedSpeakerIds: null,
        volunteersNeeded: null,
        assignedVolunteerIds: null,
        driverDetails: null,
        speakerDetails: null,
        volunteerDetails: null,
        sandwichTypes: null,
        pickupTime: null,
        pickupTimeWindow: null,
        selfTransport: null,
        vanDriverNeeded: null,
        assignedVanDriverId: null,
        isDhlVan: null,
      };
    }
    return selectedEvent;
  }, [customLocation, selectedEvent]);

  // Handle clicking on a host/recipient to show driving route from selected event
  const handleItemClick = async (item: FocusedMapItem) => {
    // Toggle off if clicking the same item again
    if (focusedItem?.type === item.type && focusedItem?.id === item.id) {
      setFocusedItem(null);
      setDrivingRoute(null);
      return;
    }

    setFocusedItem(item);

    // Only fetch route if we have a selected event or custom location with coordinates
    if (!effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) {
      setDrivingRoute(null);
      return;
    }

    // Cancel any in-flight route request
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    routeAbortControllerRef.current = abortController;

    setIsLoadingRoute(true);
    try {
      const departureTime = getEventDepartureTime(effectiveSelectedEvent);
      const routeData = await fetchDrivingRoute(
        parseFloat(effectiveSelectedEvent.latitude),
        parseFloat(effectiveSelectedEvent.longitude),
        parseFloat(item.latitude),
        parseFloat(item.longitude),
        departureTime,
        abortController.signal
      );

      // Check if this request was aborted (another request took over)
      if (abortController.signal.aborted) {
        return;
      }

      if (routeData) {
        setDrivingRoute({
          coordinates: routeData.coordinates,
          distance: routeData.distance,
          duration: routeData.duration,
          durationInTraffic: routeData.durationInTraffic,
          fromEvent: {
            lat: parseFloat(effectiveSelectedEvent.latitude),
            lng: parseFloat(effectiveSelectedEvent.longitude),
          },
          toItem: {
            lat: parseFloat(item.latitude),
            lng: parseFloat(item.longitude),
            type: item.type,
            id: item.id,
          },
        });
      } else {
        // Fallback: clear route if fetch failed
        setDrivingRoute(null);
      }
    } catch (error) {
      // Don't update state if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      console.error('Error fetching route:', error);
      setDrivingRoute(null);
    } finally {
      // Only clear loading if this is still the active request
      if (!abortController.signal.aborted) {
        setIsLoadingRoute(false);
      }
    }
  };

  // Clear route when event selection changes
  useEffect(() => {
    // Cancel any in-flight route request
    if (routeAbortControllerRef.current) {
      routeAbortControllerRef.current.abort();
      routeAbortControllerRef.current = null;
    }
    setDrivingRoute(null);
    setFocusedItem(null);
    setIsLoadingRoute(false);
    // Clear trip selections when event changes - they'll be repopulated by the next effect
    setSelectedDriver(null);
    setSelectedDestination(null);
    setFullTripRoute(null);
  }, [selectedEvent?.id]);

  // Fetch driver-to-event route when only driver is selected (no destination yet)
  // This shows the route from driver's home to the event/custom location
  useEffect(() => {
    if (!selectedDriver || selectedDestination || !effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) {
      // Don't fetch if: no driver, or destination is set (full trip will handle it), or no event coords
      return;
    }

    const fetchDriverToEventRoute = async () => {
      setIsLoadingRoute(true);
      try {
        const eventLat = parseFloat(effectiveSelectedEvent.latitude!);
        const eventLng = parseFloat(effectiveSelectedEvent.longitude!);
        const departureTime = getEventDepartureTime(effectiveSelectedEvent);

        const routeData = await fetchDrivingRoute(
          parseFloat(selectedDriver.latitude),
          parseFloat(selectedDriver.longitude),
          eventLat,
          eventLng,
          departureTime
        );

        if (routeData) {
          setDrivingRoute({
            coordinates: routeData.coordinates,
            distance: routeData.distance,
            duration: routeData.duration,
            durationInTraffic: routeData.durationInTraffic,
            fromEvent: {
              lat: parseFloat(selectedDriver.latitude),
              lng: parseFloat(selectedDriver.longitude),
            },
            toItem: {
              lat: eventLat,
              lng: eventLng,
              type: 'driver',
              id: selectedDriver.id,
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch driver-to-event route:', error);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchDriverToEventRoute();
  }, [selectedDriver, selectedDestination, effectiveSelectedEvent?.latitude, effectiveSelectedEvent?.longitude]);

  // Fetch full trip route when both driver and destination are selected
  useEffect(() => {
    if (!selectedDriver || !selectedDestination || !effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) {
      setFullTripRoute(null);
      return;
    }

    const fetchFullTrip = async () => {
      setIsLoadingFullTrip(true);
      try {
        // We already checked these exist in the condition above
        const eventLat = parseFloat(effectiveSelectedEvent.latitude!);
        const eventLng = parseFloat(effectiveSelectedEvent.longitude!);
        const departureTime = getEventDepartureTime(effectiveSelectedEvent);

        // Fetch leg 1: Driver home -> Event (using predictive traffic for event time)
        const leg1 = await fetchDrivingRoute(
          parseFloat(selectedDriver.latitude),
          parseFloat(selectedDriver.longitude),
          eventLat,
          eventLng,
          departureTime
        );

        // Fetch leg 2: Event -> Destination (after the event, so add ~1 hour to departure time)
        // For simplicity, we use the same departure time - traffic patterns are similar
        const leg2 = await fetchDrivingRoute(
          eventLat,
          eventLng,
          parseFloat(selectedDestination.latitude),
          parseFloat(selectedDestination.longitude),
          departureTime
        );

        if (leg1 && leg2) {
          setFullTripRoute({
            leg1: {
              coordinates: leg1.coordinates,
              distance: leg1.distance,
              duration: leg1.duration,
              durationInTraffic: leg1.durationInTraffic,
            },
            leg2: {
              coordinates: leg2.coordinates,
              distance: leg2.distance,
              duration: leg2.duration,
              durationInTraffic: leg2.durationInTraffic,
            },
            driverLocation: {
              lat: parseFloat(selectedDriver.latitude),
              lng: parseFloat(selectedDriver.longitude),
            },
            eventLocation: {
              lat: eventLat,
              lng: eventLng,
            },
            destinationLocation: {
              lat: parseFloat(selectedDestination.latitude),
              lng: parseFloat(selectedDestination.longitude),
            },
          });
          // Clear single route when full trip is shown
          setDrivingRoute(null);
        }
      } catch (error) {
        console.error('Error fetching full trip route:', error);
      } finally {
        setIsLoadingFullTrip(false);
      }
    };

    fetchFullTrip();
  }, [selectedDriver, selectedDestination, effectiveSelectedEvent?.latitude, effectiveSelectedEvent?.longitude]);

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Record<string, any> }) => {
      const response = await fetch(`/api/event-requests/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error('Failed to update event');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-map'] });
      toast({ title: 'Event updated', description: 'Changes saved successfully' });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Could not save changes', variant: 'destructive' });
    },
  });

  // Assign driver to event (supports tentative assignments)
  const assignDriverMutation = useMutation({
    mutationFn: async ({ eventId, driverId, currentAssigned, currentTentative, tentative }: {
      eventId: number;
      driverId: string;
      currentAssigned: string[];
      currentTentative?: string[];
      tentative?: boolean;
    }) => {
      const assignedSet = new Set(currentAssigned);
      const tentativeSet = new Set(currentTentative || []);

      if (tentative) {
        // Add to tentative, remove from confirmed if present
        tentativeSet.add(driverId);
        assignedSet.delete(driverId);
      } else {
        // Add to confirmed, remove from tentative if present
        assignedSet.add(driverId);
        tentativeSet.delete(driverId);
      }

      const assignedDriverIds = Array.from(assignedSet);
      const tentativeDriverIds = Array.from(tentativeSet);

      const response = await fetch(`/api/event-requests/${eventId}/drivers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedDriverIds, tentativeDriverIds }),
      });
      if (!response.ok) throw new Error('Failed to assign driver');
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.tentative ? 'Driver marked tentative' : 'Driver assigned',
        description: variables.tentative
          ? 'Driver has been marked as tentative (?) for this event.'
          : 'Driver has been confirmed for this event.',
      });
      // Refresh events and update selected event locally
      queryClient.invalidateQueries();
      setSelectedEvent((prev) => (prev ? {
        ...prev,
        assignedDriverIds: data.assignedDriverIds || [],
        tentativeDriverIds: data.tentativeDriverIds || []
      } : prev));
    },
    onError: () => {
      toast({
        title: 'Assign failed',
        description: 'Could not assign the driver. Please try again.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setAssigningDriverId(null);
    },
  });

  // Open edit dialog
  const openEditDialog = () => {
    if (!selectedEvent) return;
    setEditDialogOpen(true);
  };

  // Geocode event mutation
  const geocodeEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const response = await fetch(`/api/event-map/geocode/${eventId}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to geocode event');
      }
      return response.json();
    },
    onSuccess: (_data, _eventId) => {
      toast({
        title: 'Event geocoded',
        description: 'The event location has been added to the map.',
      });
      // Refetch events to get updated coordinates
      refetchEvents();
      setGeocodingEventId(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Geocoding failed',
        description: error.message || 'Could not geocode the event address. Please check the address in the event details.',
        variant: 'destructive',
      });
      setGeocodingEventId(null);
    },
  });

  const handleGeocodeEvent = (e: React.MouseEvent, eventId: number) => {
    e.stopPropagation(); // Prevent card selection
    setGeocodingEventId(eventId);
    geocodeEventMutation.mutate(eventId);
  };

  // Fetch events
  const { data: allEvents = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery<EventMapData[]>({
    queryKey: ['/api/event-map'],
    queryFn: async () => {
      const response = await fetch('/api/event-map');
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 60000, // Refetch every 60 seconds to catch new events
  });

  // Fetch drivers
  const { data: drivers = [], isLoading: driversLoading } = useQuery<Driver[]>({
    queryKey: ['/api/drivers'],
    queryFn: async () => {
      const response = await fetch('/api/drivers');
      if (!response.ok) throw new Error('Failed to fetch drivers');
      return response.json();
    },
  });

  // Fetch volunteers (for speaker/volunteer layer on map)
  const { data: volunteers = [] } = useQuery<Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    homeAddress: string | null;
    latitude: string | null;
    longitude: string | null;
    isSpeaker: boolean;
    isDriver: boolean;
    isActive: boolean;
    availability: string | null;
  }>>({
    queryKey: ['/api/volunteers'],
    queryFn: async () => {
      const response = await fetch('/api/volunteers');
      if (!response.ok) throw new Error('Failed to fetch volunteers');
      return response.json();
    },
    staleTime: 300000, // Also used for name resolution in assignment labels
  });

  // Fetch basic users for resolving user IDs (for assigned staff / assigned drivers that are user IDs)
  const { data: usersBasic = [] } = useQuery<Array<{ id: string; displayName?: string; firstName?: string; lastName?: string; email?: string }>>({
    queryKey: ['/api/users/basic'],
    queryFn: async () => {
      const response = await fetch('/api/users/basic');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    staleTime: 300000,
  });

  // Fetch driver candidates (drivers + hosts + volunteers flagged as drivers)
  const { data: driverCandidates = [], isLoading: driverCandidatesLoading } = useQuery<DriverCandidate[]>({
    queryKey: ['/api/drivers/driver-candidates'],
    queryFn: async () => {
      const response = await fetch('/api/drivers/driver-candidates');
      if (!response.ok) throw new Error('Failed to fetch driver candidates');
      return response.json();
    },
  });

  // Fetch host contacts with coordinates (from the hosts/map endpoint)
  const { data: hostContacts = [] } = useQuery<HostContact[]>({
    queryKey: ['/api/hosts/map'],
    queryFn: async () => {
      const response = await fetch('/api/hosts/map');
      if (!response.ok) throw new Error('Failed to fetch host contacts');
      return response.json();
    },
  });

  // Fetch recipients with coordinates for map display
  const { data: recipientMapData = [] } = useQuery<RecipientMapData[]>({
    queryKey: ['/api/recipients/map'],
    queryFn: async () => {
      const response = await fetch('/api/recipients/map');
      if (!response.ok) throw new Error('Failed to fetch recipients for map');
      return response.json();
    },
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchInterval: 60000, // Refetch every 60 seconds to catch newly geocoded recipients
  });

  // Fetch ALL recipients for name lookup (including those without coordinates)
  const { data: allRecipients = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['/api/recipients'],
    queryFn: async () => {
      const response = await fetch('/api/recipients');
      if (!response.ok) throw new Error('Failed to fetch all recipients');
      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes - this is just for name lookup
  });

  // Fetch team members with geocoded addresses for map display
  const { data: teamMembersMap = [] } = useQuery<Array<{
    id: string;
    name: string;
    email: string | null;
    phoneNumber: string | null;
    address: string;
    latitude: string;
    longitude: string;
    role: string;
  }>>({
    queryKey: ['/api/users/map'],
    queryFn: async () => {
      const response = await fetch('/api/users/map');
      if (!response.ok) throw new Error('Failed to fetch team members for map');
      return response.json();
    },
    staleTime: 300000,
  });

  const usersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of usersBasic) {
      const name = (u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id || '').trim();
      if (u.id && name) map.set(u.id, name);
    }
    return map;
  }, [usersBasic]);

  const parsePostgresArrayLike = (arr: unknown): string[] => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof arr === 'string') {
      if (arr === '{}' || arr === '') return [];
      const cleaned = arr.replace(/^{|}$/g, '');
      if (!cleaned) return [];
      return cleaned.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
  };

  const extractCustomName = (id: string): string => {
    if (!id || typeof id !== 'string') return '';
    if (id.startsWith('custom-')) {
      const parts = id.split('-');
      if (parts.length >= 3) {
        const nameParts = parts.slice(2);
        return nameParts.join('-').replace(/-/g, ' ').trim() || 'Custom Volunteer';
      }
      return 'Custom Volunteer';
    }
    if (id.startsWith('custom:')) {
      return id.replace('custom:', '').trim();
    }
    return '';
  };

  const extractNumericId = (raw: string): number | null => {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    if (value.includes(':')) {
      const tail = value.split(':').pop();
      if (tail && /^\d+$/.test(tail)) return Number(tail);
    }
    if (value.includes('_')) {
      const tail = value.split('_').pop();
      if (tail && /^\d+$/.test(tail)) return Number(tail);
    }
    if (value.includes('-')) {
      const tail = value.split('-').pop();
      if (tail && /^\d+$/.test(tail)) return Number(tail);
    }
    return null;
  };

  const stripRecipientPrefix = (raw: string): string => {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('custom:')) return value.replace('custom:', '').trim();
    if (value.startsWith('custom-')) return value.replace(/^custom-/, '').replace(/-/g, ' ').trim();
    if (value.includes(':')) {
      const [type, ...rest] = value.split(':');
      if (['recipient', 'host', 'host-contact'].includes(type)) {
        return rest.join(':').trim();
      }
    }
    if (value.startsWith('recipient-') || value.startsWith('recipient_')) {
      return value.replace(/^recipient[-_]/, '').trim();
    }
    return value;
  };

  const normalizeRecipientToken = (raw: string): string => {
    const stripped = stripRecipientPrefix(raw);
    if (!stripped) return '';
    if (/^\d+$/.test(stripped)) return '';
    return stripped.trim().toLowerCase();
  };

  const normalizeDriverIdVariants = (raw: string): string[] => {
    const base = String(raw || '').trim();
    if (!base) return [];
    const variants = new Set<string>([base]);
    if (base.startsWith('driver_')) {
      variants.add(`driver-${base.slice('driver_'.length)}`);
      variants.add(base.slice('driver_'.length));
    }
    if (base.startsWith('driver:')) {
      const tail = base.slice('driver:'.length);
      variants.add(`driver-${tail}`);
      variants.add(tail);
    }
    if (base.startsWith('user_')) {
      variants.add(base.slice('user_'.length));
    }
    if (base.startsWith('user:')) {
      variants.add(base.slice('user:'.length));
    }
    if (base.startsWith('admin_')) {
      variants.add(base.slice('admin_'.length));
    }
    if (base.startsWith('admin:')) {
      variants.add(base.slice('admin:'.length));
    }
    if (base.startsWith('committee_')) {
      variants.add(base.slice('committee_'.length));
    }
    if (base.startsWith('committee:')) {
      variants.add(base.slice('committee:'.length));
    }
    if (base.startsWith('volunteer_')) {
      variants.add(`volunteer-${base.slice('volunteer_'.length)}`);
      variants.add(base.slice('volunteer_'.length));
    }
    if (base.startsWith('volunteer:')) {
      const tail = base.slice('volunteer:'.length);
      variants.add(`volunteer-${tail}`);
      variants.add(tail);
    }
    if (base.startsWith('speaker_')) {
      variants.add(`speaker-${base.slice('speaker_'.length)}`);
      variants.add(base.slice('speaker_'.length));
    }
    if (base.startsWith('speaker:')) {
      const tail = base.slice('speaker:'.length);
      variants.add(`speaker-${tail}`);
      variants.add(tail);
    }
    if (base.includes('_')) {
      const tail = base.split('_').pop();
      if (tail) {
        variants.add(tail);
        variants.add(`driver-${tail}`);
      }
    }
    if (base.includes('-')) {
      const tail = base.split('-').pop();
      if (tail) variants.add(tail);
    }
    return Array.from(variants);
  };

  // Comprehensive person name resolver used across all assignment label functions.
  // Checks every data source so that IDs like "host-contact-4" always resolve to a real name.
  const resolvePersonName = (id: string): string => {
    if (!id || typeof id !== 'string') return '';
    const trimmed = id.trim();
    if (!trimmed) return '';

    // 1) custom name formats (custom-YYYY-MM-DD-FirstName-LastName or custom:Name)
    const custom = extractCustomName(trimmed);
    if (custom) return custom;

    // 2) host=contact-X or host-contact-X -> host contacts table
    if (trimmed.startsWith('host=contact-') || trimmed.startsWith('host-contact-')) {
      const contactId = trimmed.replace(/^host[=-]contact-/, '');
      const hostContact = hostContacts.find(h => String(h.id) === contactId);
      if (hostContact?.contactName) return hostContact.contactName;
    }

    // 3) user IDs via variants (Clerk user IDs, prefixed IDs)
    const variants = normalizeDriverIdVariants(trimmed);
    for (const variant of variants) {
      const userName = usersById.get(variant);
      if (userName) return userName;
    }

    // 4) driver candidate IDs (driver-12 / host-3 / volunteer-9)
    for (const variant of variants) {
      const candidate = driverCandidates.find(c => c.id === variant);
      if (candidate?.name) return candidate.name;
    }

    // 5) numeric ID -> drivers table
    const numericId = extractNumericId(trimmed);
    if (numericId !== null) {
      const numericStr = String(numericId);
      const driver = drivers.find(d => String(d.id) === numericStr);
      if (driver?.name) return driver.name;
      // Also try as driver candidate
      const asCandidate = driverCandidates.find(c => c.id === `driver-${numericStr}`);
      if (asCandidate?.name) return asCandidate.name;
      // Try as user ID
      const userName = usersById.get(numericStr);
      if (userName) return userName;
      // Try as volunteer
      const volunteer = volunteers.find(v => String(v.id) === numericStr);
      if (volunteer?.name) return volunteer.name;
    }

    // 6) prefixed numeric IDs (e.g. volunteer-5, speaker-3)
    for (const variant of variants) {
      const tail = variant.includes('-') ? variant.split('-').pop() : null;
      if (tail && /^\d+$/.test(tail)) {
        const driver = drivers.find(d => String(d.id) === tail);
        if (driver?.name) return driver.name;
        const volunteer = volunteers.find(v => String(v.id) === tail);
        if (volunteer?.name) return volunteer.name;
      }
    }

    // Never return raw IDs - return empty string so they get filtered out
    return trimmed;
  };

  // Keep resolveUserName as alias for backwards compat within this file
  const resolveUserName = resolvePersonName;

  // Filter events to upcoming scheduled events within selected weeks
  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    const showAllEvents = weeksAhead === 'all';
    const endDate = showAllEvents ? null : endOfDay(addWeeks(today, parseInt(weeksAhead)));

    return allEvents
      .filter(event => {
        // Status filter - scheduled always included, new/in_process when toggled
        const status = (event.status || '').toLowerCase();
        const isScheduled = status === 'scheduled' || status === 'rescheduled';
        const isNewOrInProcess = status === 'new' || status === 'in_process';
        if (!isScheduled && !(showPendingEvents && isNewOrInProcess)) return false;

        // Must have a date
        const dateStr = event.scheduledEventDate || event.desiredEventDate;
        if (!dateStr) return false;

        // If showing all events, just check it's today or future
        const eventDate = parseLocalDate(dateStr);
        if (showAllEvents) {
          return eventDate >= today;
        }
        return isWithinInterval(eventDate, { start: today, end: endDate! });
      })
      .sort((a, b) => {
        const dateA = parseLocalDate(a.scheduledEventDate || a.desiredEventDate!);
        const dateB = parseLocalDate(b.scheduledEventDate || b.desiredEventDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [allEvents, weeksAhead, showPendingEvents]);

  // Sync selectedEvent with latest data when events are refetched
  // This ensures the UI shows updated data after edits
  // We use selectedEvent?.id (not full object) intentionally to avoid re-running when we update it ourselves
  const selectedEventId = selectedEvent?.id;
  useEffect(() => {
    if (selectedEventId && allEvents.length > 0) {
      const updatedEvent = allEvents.find(e => e.id === selectedEventId);
      if (updatedEvent) {
        setSelectedEvent(prev => {
          // Only update if the data actually changed
          if (!prev || JSON.stringify(updatedEvent) !== JSON.stringify(prev)) {
            return updatedEvent;
          }
          return prev;
        });
      }
    }
  }, [allEvents, selectedEventId]);

  // Map-safe subset: only events with coordinates
  const upcomingEventsWithCoords = useMemo(() => {
    return upcomingEvents.filter((e) => {
      const lat = (e.latitude || '').trim();
      const lng = (e.longitude || '').trim();
      if (!lat || !lng) return false;
      const latNum = Number.parseFloat(lat);
      const lngNum = Number.parseFloat(lng);
      return Number.isFinite(latNum) && Number.isFinite(lngNum);
    });
  }, [upcomingEvents]);

  // When an event is selected, only show events on the same date on the map
  const eventsToShowOnMap = useMemo(() => {
    if (!selectedEvent) {
      // No event selected - show all events
      return upcomingEventsWithCoords;
    }

    // Get the selected event's date
    const selectedDate = selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate;
    if (!selectedDate) {
      // If selected event has no date, just show that event
      return upcomingEventsWithCoords.filter(e => e.id === selectedEvent.id);
    }

    // Filter to only events on the same date as the selected event
    return upcomingEventsWithCoords.filter(event => {
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      return eventDate === selectedDate;
    });
  }, [upcomingEventsWithCoords, selectedEvent]);

  // Filter events based on staffing needs toggle
  const events = useMemo(() => {
    if (!showOnlyUnmetStaffing) return upcomingEvents;

    return upcomingEvents.filter(event => {
      // Skip self-transport events - they don't need TSP drivers
      if (event.selfTransport) return false;

      // Only consider events with explicit driver requirements
      const driversNeeded = event.driversNeeded || 0;

      // If no driver requirement configured, don't show as needing drivers
      if (driversNeeded === 0) return false;

      // Count ALL assigned drivers including van drivers
      const driversAssigned = getTotalDriverCount(event);

      return driversAssigned < driversNeeded;
    });
  }, [upcomingEvents, showOnlyUnmetStaffing]);

  // Count of events with unmet staffing needs
  const unmetStaffingCount = useMemo(() => {
    return upcomingEvents.filter(event => {
      // Skip self-transport events
      if (event.selfTransport) return false;

      // Only count events with explicit driver requirements
      const driversNeeded = event.driversNeeded || 0;

      if (driversNeeded === 0) return false;

      // Count ALL assigned drivers including van drivers
      const driversAssigned = getTotalDriverCount(event);

      return driversAssigned < driversNeeded;
    }).length;
  }, [upcomingEvents]);

  // Get active drivers
  const activeDrivers = useMemo(() => {
    return drivers.filter(d => d.isActive);
  }, [drivers]);

  // Get nearest driver candidates (drivers + hosts + volunteers) to the selected/custom location (by distance)
  // Only exclude drivers who are explicitly busy or off-duty
  // Note: Uses effectiveSelectedEvent which can be either a real event or custom location
  const nearbyDriversAll = useMemo(() => {
    if (!effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) return [];

    const eventLat = parseFloat(effectiveSelectedEvent.latitude);
    const eventLng = parseFloat(effectiveSelectedEvent.longitude);

    return driverCandidates
      .filter((c) => c.latitude && c.longitude && c.availability !== 'busy' && c.availability !== 'off-duty')
      .map((driver) => {
        const distance = calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(driver.latitude),
          parseFloat(driver.longitude)
        );
        return { driver, distance };
      })
      .sort((a, b) => a.distance - b.distance);
  }, [driverCandidates, effectiveSelectedEvent]);


  // Get suggested drivers for selected event - exclude busy/off-duty drivers
  const suggestedDrivers = useMemo(() => {
    if (!effectiveSelectedEvent) return [];

    return activeDrivers
      .filter(driver => {
        // Exclude drivers who are busy or off-duty
        if (driver.availability === 'busy' || driver.availability === 'off-duty') return false;

        // Check if driver has any location info at all
        const hasLocation = driver.hostLocation || driver.area || driver.zone || driver.routeDescription || driver.homeAddress;
        if (!hasLocation) return false;

        // Check if driver matches event area
        return doesDriverMatchEventArea(driver, effectiveSelectedEvent.eventAddress);
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [effectiveSelectedEvent, activeDrivers]);

  // Get drivers without location data
  const driversWithoutLocation = useMemo(() => {
    return activeDrivers.filter(driver =>
      !driver.hostLocation && !driver.area && !driver.zone && !driver.routeDescription && !driver.homeAddress
    );
  }, [activeDrivers]);

  // Get drivers with addresses but missing geocoding (have address but no coordinates)
  const driversNeedingGeocoding = useMemo(() => {
    return activeDrivers.filter(driver =>
      (driver.homeAddress || driver.address) && (!driver.latitude || !driver.longitude)
    );
  }, [activeDrivers]);

  // Handle quick location lookup geocoding
  const handleQuickLookup = async () => {
    if (!quickLookupAddress.trim()) return;

    setIsGeocodingQuickLookup(true);
    try {
      const response = await fetch('/api/event-map/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: quickLookupAddress.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast({
          title: 'Geocoding failed',
          description: data.details || data.error || 'Could not find that address',
          variant: 'destructive',
        });
        return;
      }

      // Clear any selected event and set custom location
      setSelectedEvent(null);
      clearTripPlanningState();
      setCustomLocation({
        address: data.address || quickLookupAddress.trim(),
        latitude: String(data.latitude),
        longitude: String(data.longitude),
      });
      setShowQuickLookup(false);

      toast({
        title: 'Location found',
        description: `Showing nearby hosts, recipients, and drivers for "${data.address || quickLookupAddress}"`,
      });
    } catch (error) {
      console.error('Quick lookup error:', error);
      toast({
        title: 'Geocoding failed',
        description: 'An error occurred while looking up the address',
        variant: 'destructive',
      });
    } finally {
      setIsGeocodingQuickLookup(false);
    }
  };

  // Clear custom location
  const clearCustomLocation = () => {
    setCustomLocation(null);
    setQuickLookupAddress('');
    clearTripPlanningState();
  };

  // Handle selecting an event (clears custom location if set)
  const handleSelectEvent = (event: EventMapData) => {
    if (selectedEvent?.id !== event.id) {
      clearTripPlanningState();
    }
    // Clear custom location when selecting a real event
    if (customLocation) {
      setCustomLocation(null);
      setQuickLookupAddress('');
    }
    setSelectedEvent(event);
  };

  // Get nearby host contacts near the selected/custom location (show individual contacts, not locations)
  // Dynamically expands search radius if not enough hosts found nearby
  const nearbyHosts = useMemo(() => {
    if (!effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) return [];

    const eventLat = parseFloat(effectiveSelectedEvent.latitude);
    const eventLng = parseFloat(effectiveSelectedEvent.longitude);

    const hostsWithDistance = hostContacts
      .filter(contact => contact.latitude && contact.longitude)
      .map(contact => ({
        id: contact.id,
        contactName: contact.contactName,
        hostLocationName: contact.hostLocationName,
        latitude: contact.latitude,
        longitude: contact.longitude,
        distance: calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(contact.latitude),
          parseFloat(contact.longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    // Try progressively larger radii until we have at least 3 hosts (or run out of options)
    const radii = [10, 20, 35, 50];
    for (const radius of radii) {
      const hostsInRadius = hostsWithDistance.filter(h => h.distance < radius);
      if (hostsInRadius.length >= 3) {
        return hostsInRadius.slice(0, 10);
      }
    }

    // If still not enough, just return whatever we have (sorted by distance)
    return hostsWithDistance.slice(0, 10);
  }, [effectiveSelectedEvent, hostContacts]);

  // Get nearby recipients (delivery locations) near the selected/custom location
  // Dynamically expands search radius if not enough recipients found nearby
  // All recipients with distance, sorted by distance (used for map markers — no limit)
  const allRecipientsWithDistance = useMemo(() => {
    if (!effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) return [];

    const eventLat = parseFloat(effectiveSelectedEvent.latitude);
    const eventLng = parseFloat(effectiveSelectedEvent.longitude);

    return recipientMapData
      .filter(recipient => recipient.latitude && recipient.longitude)
      .map(recipient => ({
        ...recipient,
        distance: calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(recipient.latitude),
          parseFloat(recipient.longitude)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [effectiveSelectedEvent, recipientMapData]);

  // Nearby recipients for the sidebar list (limited set, expandable)
  const nearbyRecipients = useMemo(() => {
    if (allRecipientsWithDistance.length === 0) return [];

    // Try progressively larger radii until we have at least 3 recipients (or run out of options)
    const radii = [15, 25, 40, 60];
    for (const radius of radii) {
      const recipientsInRadius = allRecipientsWithDistance.filter(r => r.distance < radius);
      if (recipientsInRadius.length >= 3) {
        return recipientsInRadius;
      }
    }

    // If still not enough, just return all (sorted by distance)
    return allRecipientsWithDistance;
  }, [allRecipientsWithDistance]);

  // Designated recipient(s) explicitly assigned on the event (if any)
  const designatedRecipients = useMemo(() => {
    const assigned = parsePostgresArrayLike(selectedEvent?.assignedRecipientIds);
    if (!selectedEvent || assigned.length === 0) return [];

    const numericIds = assigned
      .map((v) => extractNumericId(v))
      .filter((n): n is number => Number.isFinite(n));

    const normalizedNames = assigned
      .map((v) => normalizeRecipientToken(v))
      .filter((v) => v.length > 0);

    const matches = recipientMapData.filter((r) => {
      if (!r.latitude || !r.longitude) return false;
      if (numericIds.length > 0 && numericIds.includes(r.id)) return true;
      if (normalizedNames.length > 0) {
        const name = (r.name || '').trim().toLowerCase();
        return normalizedNames.some((n) => n === name);
      }
      return false;
    });

    return matches;
  }, [selectedEvent, recipientMapData]);

  const nonDesignatedNearbyRecipients = useMemo(() => {
    // For custom locations, show all nearby recipients (no designated ones)
    if (!effectiveSelectedEvent) return [];
    if (designatedRecipients.length === 0) return nearbyRecipients;
    const designatedIds = new Set(designatedRecipients.map((r) => r.id));
    return nearbyRecipients.filter((r) => !designatedIds.has(r.id));
  }, [effectiveSelectedEvent, designatedRecipients, nearbyRecipients]);

  // All non-designated recipients for the map (no limit — shows every recipient with coordinates)
  const allNonDesignatedRecipients = useMemo(() => {
    if (!effectiveSelectedEvent) return [];
    if (designatedRecipients.length === 0) return allRecipientsWithDistance;
    const designatedIds = new Set(designatedRecipients.map((r) => r.id));
    return allRecipientsWithDistance.filter((r) => !designatedIds.has(r.id));
  }, [effectiveSelectedEvent, designatedRecipients, allRecipientsWithDistance]);

  // All speakers near the selected event (volunteers with isSpeaker=true that have coordinates)
  const nearbySpeakers = useMemo(() => {
    if (!effectiveSelectedEvent?.latitude || !effectiveSelectedEvent?.longitude) return [];

    const eventLat = parseFloat(effectiveSelectedEvent.latitude);
    const eventLng = parseFloat(effectiveSelectedEvent.longitude);

    // Get IDs of speakers already assigned to this event
    const assignedIds = new Set(
      getSpeakerIds(effectiveSelectedEvent).map(id => {
        const strId = String(id);
        return strId.replace(/^(volunteer-|speaker-)/, '');
      })
    );

    const speakersWithDistance = volunteers
      .filter(v => v.isSpeaker && v.isActive && v.latitude && v.longitude)
      .map(v => ({
        id: v.id,
        name: v.name,
        phone: v.phone,
        latitude: v.latitude!,
        longitude: v.longitude!,
        isAssigned: assignedIds.has(String(v.id)),
        distance: calculateDistanceInMiles(
          eventLat,
          eventLng,
          parseFloat(v.latitude!),
          parseFloat(v.longitude!)
        ),
      }))
      .sort((a, b) => {
        // Assigned speakers first, then by distance
        if (a.isAssigned && !b.isAssigned) return -1;
        if (!a.isAssigned && b.isAssigned) return 1;
        return a.distance - b.distance;
      });

    // Try progressively larger radii until we have at least 3 speakers (or run out of options)
    const radii = [15, 30, 50, 75];
    for (const radius of radii) {
      const speakersInRadius = speakersWithDistance.filter(s => s.distance < radius || s.isAssigned);
      if (speakersInRadius.length >= 3) {
        return speakersInRadius.slice(0, 10);
      }
    }

    // If still not enough, just return whatever we have (sorted by distance)
    return speakersWithDistance.slice(0, 10);
  }, [effectiveSelectedEvent, volunteers]);

  // Assigned driver(s) explicitly assigned on the event (if any)
  // Returns full DriverCandidate objects for drivers with valid coordinates
  const assignedDrivers = useMemo(() => {
    const assignedIds = selectedEvent ? getDriverIds(selectedEvent) : [];
    if (!selectedEvent || assignedIds.length === 0) return [];

    const candidateById = new Map(driverCandidates.map((c) => [c.id, c]));
    const driverByNumericId = new Map(activeDrivers.map((d) => [String(d.id), d]));
    const hostContactById = new Map(hostContacts.map((h) => [String(h.id), h]));

    const matches: DriverCandidate[] = [];
    for (const raw of assignedIds) {
      const id = String(raw).trim();
      if (!id) continue;

      let candidate: DriverCandidate | undefined;
      const variants = normalizeDriverIdVariants(id);

      // 1) host=contact-X format (host contact assigned as driver)
      // Use normalized ID format `host-{id}` to match API driver-candidates endpoint
      if (id.startsWith('host=contact-')) {
        const contactId = id.replace('host=contact-', '');
        const hostContact = hostContactById.get(contactId);
        if (hostContact && hostContact.latitude && hostContact.longitude) {
          candidate = {
            id: `host-${contactId}`,
            source: 'host',
            name: hostContact.contactName,
            email: hostContact.email,
            phone: hostContact.phone,
            latitude: hostContact.latitude,
            longitude: hostContact.longitude,
            hostLocation: hostContact.hostLocationName,
          };
        }
      }

      // 2) host-contact-X format (alternate host contact reference)
      // Use normalized ID format `host-{id}` to match API driver-candidates endpoint
      if (!candidate && id.startsWith('host-contact-')) {
        const contactId = id.replace('host-contact-', '');
        const hostContact = hostContactById.get(contactId);
        if (hostContact && hostContact.latitude && hostContact.longitude) {
          candidate = {
            id: `host-${contactId}`,
            source: 'host',
            name: hostContact.contactName,
            email: hostContact.email,
            phone: hostContact.phone,
            latitude: hostContact.latitude,
            longitude: hostContact.longitude,
            hostLocation: hostContact.hostLocationName,
          };
        }
      }

      // 3) driver candidate IDs (driver-12 / host-3 / volunteer-9)
      if (!candidate) {
        for (const variant of variants) {
          candidate = candidateById.get(variant);
          if (candidate) break;
        }
      }

      // 4) numeric IDs (plain "12") -> try driver-{id}
      if (!candidate) {
        const numericId = extractNumericId(id);
        if (numericId !== null) {
          const numericStr = String(numericId);
          candidate = candidateById.get(`driver-${numericStr}`);
          if (!candidate) {
            const driver = driverByNumericId.get(numericStr);
            if (driver && driver.latitude && driver.longitude) {
              candidate = {
                id: `driver-${driver.id}`,
                source: 'driver',
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
                latitude: driver.latitude,
                longitude: driver.longitude,
                area: driver.area,
                vanApproved: driver.vanApproved,
                vehicleType: driver.vehicleType,
                hostLocation: driver.hostLocation,
              };
            }
          }
        }
      }

      // 5) prefixed numeric IDs -> extract tail and lookup
      if (!candidate) {
        for (const variant of variants) {
          if (!variant.includes('-')) continue;
          const tail = variant.split('-').pop();
          if (tail && /^\d+$/.test(tail)) {
            const driver = driverByNumericId.get(tail);
            if (driver && driver.latitude && driver.longitude) {
              candidate = {
                id: `driver-${driver.id}`,
                source: 'driver',
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
                latitude: driver.latitude,
                longitude: driver.longitude,
                area: driver.area,
                vanApproved: driver.vanApproved,
                vehicleType: driver.vehicleType,
                hostLocation: driver.hostLocation,
              };
            }
          }
          if (candidate) break;
        }
      }

      // Only include if we found a valid candidate with coordinates
      if (candidate && candidate.latitude && candidate.longitude) {
        matches.push(candidate);
      }
    }

    return matches;
  }, [selectedEvent, driverCandidates, activeDrivers, hostContacts]);

  // Filtered nearbyDrivers excluding already-assigned drivers (to avoid duplication in the UI)
  // Also filter to only van-approved drivers when vanDriverNeeded is true
  const nearbyDrivers = useMemo(() => {
    const assignedIds = new Set(assignedDrivers.map(d => d.id));
    const vanNeeded = effectiveSelectedEvent?.vanDriverNeeded;
    return nearbyDriversAll.filter(({ driver }) => {
      // Exclude already-assigned drivers
      if (assignedIds.has(driver.id)) return false;
      // If van driver needed, only show van-approved drivers
      if (vanNeeded && !driver.vanApproved) return false;
      return true;
    });
  }, [nearbyDriversAll, assignedDrivers, effectiveSelectedEvent?.vanDriverNeeded]);

  const driverSearchTerm = driverSearch.trim().toLowerCase();
  const driverSearchResults = useMemo(() => {
    if (!driverSearchTerm) return null;
    const assignedIds = new Set(assignedDrivers.map(d => d.id));
    const vanNeeded = effectiveSelectedEvent?.vanDriverNeeded;
    return nearbyDriversAll.filter(({ driver }) => {
      if (assignedIds.has(driver.id)) return false;
      if (vanNeeded && !driver.vanApproved) return false;
      const haystack = [
        driver.name,
        driver.hostLocation,
        driver.area,
        driver.routeDescription,
        driver.homeAddress,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(driverSearchTerm);
    });
  }, [driverSearchTerm, assignedDrivers, nearbyDriversAll, effectiveSelectedEvent?.vanDriverNeeded]);

  // Compute volunteers/speakers assigned to visible events with geocoded locations
  // Shows volunteers that are assigned to ANY visible event (not just selected)
  const volunteersWithLocations = useMemo(() => {
    if (!showVolunteersSpeakers || volunteers.length === 0) return [];

    // Collect all assigned volunteer/speaker IDs from ALL visible events
    const assignedVolunteerIds = new Set<string>();
    const volunteerToEvents = new Map<string, { eventId: number; eventName: string; role: 'speaker' | 'volunteer' }[]>();

    for (const event of events) {
      // Get speaker IDs from speakerDetails or assignedSpeakerIds
      const speakerIds = getSpeakerIds(event);
      for (const id of speakerIds) {
        const strId = String(id);
        // Extract numeric ID if it's a prefixed ID like "volunteer-123"
        const numericId = strId.replace(/^(volunteer-|speaker-)/, '');
        assignedVolunteerIds.add(numericId);
        if (!volunteerToEvents.has(numericId)) {
          volunteerToEvents.set(numericId, []);
        }
        volunteerToEvents.get(numericId)!.push({
          eventId: event.id,
          eventName: event.organizationName || 'Unknown',
          role: 'speaker',
        });
      }

      // Get volunteer IDs from volunteerDetails or assignedVolunteerIds
      const volunteerIds = getVolunteerIds(event);
      for (const id of volunteerIds) {
        const strId = String(id);
        const numericId = strId.replace(/^(volunteer-|speaker-)/, '');
        assignedVolunteerIds.add(numericId);
        if (!volunteerToEvents.has(numericId)) {
          volunteerToEvents.set(numericId, []);
        }
        // Avoid duplicate entries if someone is both speaker and volunteer
        const existing = volunteerToEvents.get(numericId)!;
        if (!existing.some(e => e.eventId === event.id && e.role === 'volunteer')) {
          existing.push({
            eventId: event.id,
            eventName: event.organizationName || 'Unknown',
            role: 'volunteer',
          });
        }
      }
    }

    // Filter to volunteers that have coordinates and are assigned to events
    return volunteers
      .filter(v => {
        if (!v.latitude || !v.longitude) return false;
        if (!v.isActive) return false;
        return assignedVolunteerIds.has(String(v.id));
      })
      .map(v => ({
        ...v,
        assignedEvents: volunteerToEvents.get(String(v.id)) || [],
      }));
  }, [showVolunteersSpeakers, volunteers, events]);

  // Team members to show on map (filtered to exclude users already shown as drivers/volunteers/hosts)
  const teamMembersForMap = useMemo(() => {
    if (!showTeamMembers || teamMembersMap.length === 0) return [];

    // Build sets of IDs already shown on the map via other layers
    const driverCandidateUserIds = new Set<string>();
    for (const c of driverCandidates) {
      // Driver candidates have IDs like "driver-5", "host-3", "volunteer-9"
      // but the underlying user ID might be different. We'll match by name/email instead.
      if (c.email) driverCandidateUserIds.add(c.email.toLowerCase());
    }
    const volunteerEmails = new Set(volunteers.filter(v => v.email).map(v => v.email!.toLowerCase()));
    const hostContactEmails = new Set(hostContacts.filter(h => h.email).map(h => h.email!.toLowerCase()));

    return teamMembersMap.filter(member => {
      if (!member.latitude || !member.longitude) return false;
      const email = member.email?.toLowerCase();
      if (!email) return true; // No email to dedup on, show them
      // Skip if already showing as driver candidate, volunteer, or host contact
      return !driverCandidateUserIds.has(email) && !volunteerEmails.has(email) && !hostContactEmails.has(email);
    });
  }, [showTeamMembers, teamMembersMap, driverCandidates, volunteers, hostContacts]);

  // Track whether we've auto-populated for the current event
  const lastAutoPopulatedEventId = useRef<number | null>(null);

  // Refs to access current memo values inside timeout without adding them to dependencies
  const assignedDriversRef = useRef(assignedDrivers);
  const designatedRecipientsRef = useRef(designatedRecipients);
  assignedDriversRef.current = assignedDrivers;
  designatedRecipientsRef.current = designatedRecipients;

  // Auto-populate trip planning with pre-assigned driver/recipient when event is selected
  // Depends on selectedEvent.id and driver data being loaded
  useEffect(() => {
    if (!selectedEvent) {
      lastAutoPopulatedEventId.current = null;
      return;
    }

    // Wait for driver candidates to load before auto-populating
    if (driverCandidatesLoading) {
      return;
    }

    // Only auto-populate once per event selection
    if (lastAutoPopulatedEventId.current === selectedEvent.id) {
      return;
    }
    lastAutoPopulatedEventId.current = selectedEvent.id;

    // Wait for memos to settle, then populate using refs for current values
    const timeout = setTimeout(() => {
      const currentAssignedDrivers = assignedDriversRef.current;
      const currentDesignatedRecipients = designatedRecipientsRef.current;

      // Auto-populate driver if there are assigned drivers with coordinates
      // Select the first one to show the route immediately
      if (currentAssignedDrivers.length >= 1) {
        const driver = currentAssignedDrivers[0];
        setSelectedDriver({
          id: driver.id,
          name: driver.name,
          latitude: driver.latitude,
          longitude: driver.longitude,
        });
      }

      // Auto-populate destination if there's exactly one designated recipient with coordinates
      if (currentDesignatedRecipients.length === 1) {
        const recipient = currentDesignatedRecipients[0];
        setSelectedDestination({
          type: 'recipient',
          id: recipient.id,
          name: recipient.name || 'Recipient',
          latitude: recipient.latitude!,
          longitude: recipient.longitude!,
        });
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [selectedEvent?.id, driverCandidatesLoading]);

  const getTspContactLabel = (event: EventMapData): string | null => {
    const parts = [event.customTspContact, event.tspContactAssigned, event.tspContact]
      .map((v) => (v || '').trim())
      .filter(Boolean)
      .map((v) => {
        // Always try to resolve user name - the function handles the lookup and falls back gracefully
        const resolved = resolveUserName(v);
        // If resolved is the same as the raw ID and looks like a user ID, keep trying via usersById
        if (resolved === v) {
          // Check if it's a user ID format and try to get the name
          const userName = usersById.get(v);
          if (userName) return userName;
        }
        return resolved;
      });
    if (parts.length === 0) return null;
    // De-dupe while preserving order
    return Array.from(new Set(parts)).join(' • ');
  };

  const getAssignedDriversLabel = (event: EventMapData): string | null => {
    const ids = getDriverIds(event);
    if (ids.length === 0) return null;
    const labels = ids.map(raw => resolvePersonName(String(raw))).filter(Boolean);
    const deduped = Array.from(new Set(labels));
    return deduped.length > 0 ? deduped.join(', ') : null;
  };

  const getAssignedSpeakersLabel = (event: EventMapData): string | null => {
    const ids = getSpeakerIds(event);
    if (ids.length === 0) return null;
    const labels = ids.map(raw => resolvePersonName(String(raw))).filter(Boolean);
    const deduped = Array.from(new Set(labels));
    return deduped.length > 0 ? deduped.join(', ') : null;
  };

  const getAssignedVolunteersLabel = (event: EventMapData): string | null => {
    const ids = getVolunteerIds(event);
    if (ids.length === 0) return null;
    const labels = ids.map(raw => resolvePersonName(String(raw))).filter(Boolean);
    const deduped = Array.from(new Set(labels));
    return deduped.length > 0 ? deduped.join(', ') : null;
  };

  const getDesignatedRecipientLabel = (event: EventMapData): string | null => {
    const assigned = parsePostgresArrayLike(event.assignedRecipientIds);
    if (assigned.length === 0) return null;

    const names = assigned
      .map((raw) => {
        const numericId = extractNumericId(raw);
        if (numericId !== null) {
          // First check recipientMapData (has coordinates)
          const recipient = recipientMapData.find((r) => r.id === numericId);
          if (recipient?.name) return recipient.name;
          // Then check allRecipients (includes those without coordinates)
          const allRecipient = allRecipients.find((r) => r.id === numericId);
          if (allRecipient?.name) return allRecipient.name;
        }
        const normalizedName = normalizeRecipientToken(raw);
        if (normalizedName) {
          const match = recipientMapData.find((r) => (r.name || '').trim().toLowerCase() === normalizedName);
          if (match?.name) return match.name;
          // Also check allRecipients for name match
          const allMatch = allRecipients.find((r) => (r.name || '').trim().toLowerCase() === normalizedName);
          if (allMatch?.name) return allMatch.name;
        }
        return stripRecipientPrefix(raw);
      })
      .filter(Boolean);

    const deduped = Array.from(new Set(names));
    return deduped.length > 0 ? deduped.join(', ') : null;
  };

  // Copy SMS to clipboard
  const copyDriverSMS = async (driver: SMSDriver) => {
    if (!selectedEvent) return;

    const sms = generateDriverSMS(selectedEvent, driver);
    try {
      await navigator.clipboard.writeText(sms);
      setCopiedDriverId(driver.id);
      toast({
        title: 'Copied!',
        description: `SMS message for ${driver.name} copied to clipboard`,
      });
      setTimeout(() => setCopiedDriverId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast({
        title: 'Copy failed',
        description: 'Unable to copy to clipboard. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Map center
  const mapCenter: [number, number] = useMemo(() => {
    if (upcomingEventsWithCoords.length === 0) return [33.7490, -84.3880]; // Atlanta default

    const avgLat = upcomingEventsWithCoords.reduce((sum, e) => sum + parseFloat(e.latitude!), 0) / upcomingEventsWithCoords.length;
    const avgLng = upcomingEventsWithCoords.reduce((sum, e) => sum + parseFloat(e.longitude!), 0) / upcomingEventsWithCoords.length;

    return [avgLat, avgLng];
  }, [upcomingEventsWithCoords]);

  const isLoading = eventsLoading || driversLoading || driverCandidatesLoading;

  if (isLoading) {
    return (
      <div className="h-[calc(100dvh-140px)] lg:h-[calc(100dvh-80px)] min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
          <Skeleton className="h-6 w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-140px)] lg:h-[calc(100dvh-80px)] min-h-[400px] flex flex-col">
      {/* Header - Desktop */}
      <div className="flex-shrink-0 p-4 bg-white border-b hidden lg:block">
        <PageBreadcrumbs
          segments={[
            { label: 'Event Planning', href: '/dashboard?section=event-requests' },
            { label: 'Driver Planning' }
          ]}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007E8C] to-[#005f6b] flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Driver Planning</h1>
              <p className="text-sm text-gray-600">
                {unmetStaffingCount} event{unmetStaffingCount !== 1 ? 's' : ''} needing drivers ({upcomingEvents.length} total upcoming)
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchEvents()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Header - Mobile/Tablet */}
      <div className="flex-shrink-0 p-3 bg-white border-b lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007E8C] to-[#005f6b] flex items-center justify-center flex-shrink-0">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate">Driver Planning</h1>
              <p className="text-xs text-gray-600">
                {unmetStaffingCount} needing drivers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={weeksAhead} onValueChange={setWeeksAhead}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All upcoming</SelectItem>
                <SelectItem value="1">Next week</SelectItem>
                <SelectItem value="2">Next 2 weeks</SelectItem>
                <SelectItem value="4">Next month</SelectItem>
                <SelectItem value="8">Next 2 months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetchEvents()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Desktop 3-Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 hidden lg:flex overflow-hidden">
        {/* Left Panel - Event List */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
        <div className="h-full border-r bg-gray-50 flex flex-col" data-testid="driver-planning-events-list" onClick={() => setFocusedItem(null)}>
          <div className="p-3 border-b bg-white space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#007E8C]" />
                Events ({events.length}{showOnlyUnmetStaffing ? ` of ${upcomingEvents.length}` : ''})
              </h2>
              {/* Date range filter - moved here for visibility */}
              <Select value={weeksAhead} onValueChange={setWeeksAhead}>
                <SelectTrigger className="w-[120px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All upcoming</SelectItem>
                  <SelectItem value="1">Next week</SelectItem>
                  <SelectItem value="2">Next 2 weeks</SelectItem>
                  <SelectItem value="4">Next month</SelectItem>
                  <SelectItem value="8">Next 2 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnmetStaffing}
                onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Only show events needing drivers</span>
              {showOnlyUnmetStaffing && unmetStaffingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {unmetStaffingCount}
                </Badge>
              )}
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showPendingEvents}
                onChange={(e) => setShowPendingEvents(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Include pending/new requests</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showVolunteersSpeakers}
                onChange={(e) => setShowVolunteersSpeakers(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-600"
              />
              <span className="text-gray-600">Show speakers/volunteers on map</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showTeamMembers}
                onChange={(e) => setShowTeamMembers(e.target.checked)}
                className="rounded border-gray-300 text-red-500 focus:ring-red-500"
              />
              <span className="text-gray-600">Show team members on map</span>
              {showTeamMembers && teamMembersForMap.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                  {teamMembersForMap.length}
                </Badge>
              )}
            </label>

            {/* Quick Location Lookup */}
            <div className="pt-2 border-t border-gray-200">
              {!showQuickLookup && !customLocation ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickLookup(true)}
                  className="w-full text-xs h-7 border-dashed border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  Quick Location Lookup
                </Button>
              ) : customLocation ? (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase text-orange-600 font-semibold">Custom Location</div>
                      <div className="text-xs font-medium text-gray-900 truncate" title={customLocation.address}>
                        {customLocation.address}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCustomLocation}
                      className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <Input
                      type="text"
                      placeholder="Enter address or place name..."
                      value={quickLookupAddress}
                      onChange={(e) => setQuickLookupAddress(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickLookup()}
                      className="h-7 text-xs flex-1"
                      disabled={isGeocodingQuickLookup}
                    />
                    <Button
                      size="sm"
                      onClick={handleQuickLookup}
                      disabled={!quickLookupAddress.trim() || isGeocodingQuickLookup}
                      className="h-7 px-2 bg-orange-600 hover:bg-orange-700"
                    >
                      {isGeocodingQuickLookup ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowQuickLookup(false);
                      setQuickLookupAddress('');
                    }}
                    className="w-full h-6 text-[10px] text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const eventDate = event.scheduledEventDate || event.desiredEventDate;
                const regularDriversAssigned = getDriverCount(event);
                const driversTentative = event.tentativeDriverIds?.length || 0;
                const driversNeeded = event.driversNeeded || 0;
                const speakersNeeded = event.speakersNeeded || 0;
                const speakersAssigned = getSpeakerCount(event);
                const volunteersNeeded = event.volunteersNeeded || 0;
                const volunteersAssigned = getVolunteerCount(event);
                // Has driver requirement if: driversNeeded > 0, or vanDriverNeeded, or drivers are already assigned
                const hasDriverRequirement = driversNeeded > 0 || event.vanDriverNeeded || regularDriversAssigned > 0 || !!event.assignedVanDriverId;

                // Count ALL assigned drivers including van drivers for status calculation
                const totalDriversAssigned = getTotalDriverCount(event);
                // Check if all driver needs are fulfilled (both regular drivers AND van driver if needed)
                const driversFulfilled = totalDriversAssigned >= driversNeeded &&
                                        (!event.vanDriverNeeded || !!event.assignedVanDriverId || !!event.isDhlVan);

                return (
                  <Card
                    key={event.id}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                        : 'hover:shadow-md hover:bg-white'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedEvent(null);
                      } else {
                        handleSelectEvent(event);
                      }
                      setShowAllHosts(false);
                      setShowAllRecipients(false);
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                            {event.organizationName || 'Unknown Organization'}
                          </h3>
                          {(() => {
                            const status = (event.status || '').toLowerCase();
                            if (status === 'new') return (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 flex-shrink-0">New</Badge>
                            );
                            if (status === 'in_process') return (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-700 bg-blue-50 flex-shrink-0">In Process</Badge>
                            );
                            return null;
                          })()}
                        </div>
                        <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-700">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="font-medium">
                          {eventDate ? format(parseLocalDate(eventDate), 'EEE, MMM d') : 'No date'}
                        </span>
                        {event.eventStartTime && (
                          <span className="text-gray-500">
                            at {formatTime12Hour(event.eventStartTime)}
                          </span>
                        )}
                      </div>

                      {/* Sandwich count and types - only show if > 0 */}
                      {event.estimatedSandwichCount && event.estimatedSandwichCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Package className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className={event.estimatedSandwichCount > 400 ? 'font-semibold' : ''} style={event.estimatedSandwichCount > 400 ? { color: '#a31c41' } : undefined}>
                            ~{event.estimatedSandwichCount} sandwiches
                            {event.sandwichTypes && event.sandwichTypes.length > 0 && (
                              <span className="text-gray-500 font-normal ml-1">
                                ({event.sandwichTypes.map(t => `${t.quantity} ${t.type}`).join(', ')})
                              </span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Location */}
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="line-clamp-1">{extractCityFromAddress(event.eventAddress) || event.eventAddress}</span>
                      </div>

                      {/* Driver status - only show if event has driver requirements */}
                      <div className="flex items-center gap-2">
                        {event.selfTransport ? (
                          <Badge variant="secondary" className="text-xs">
                            Self-transport
                          </Badge>
                        ) : hasDriverRequirement ? (
                          <Badge
                            variant={driversFulfilled ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            <Truck className="w-3 h-3 mr-1" />
                            {event.vanDriverNeeded ? (
                              // Van driver requirement - show van driver status
                              (() => {
                                const vanDriverAssigned = (event.assignedVanDriverId ? 1 : 0) + (event.isDhlVan ? 1 : 0);
                                const totalAssigned = regularDriversAssigned + vanDriverAssigned;
                                const totalNeeded = driversNeeded + 1; // +1 for van driver
                                return (
                                  <>
                                    {totalAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{totalNeeded} {driversNeeded > 0 ? 'drivers+van' : 'Van'}
                                    {vanDriverAssigned === 0 && ' needed'}
                                    {event.isDhlVan && ' (DHL)'}
                                  </>
                                );
                              })()
                            ) : driversNeeded > 0 ? (
                              // Regular drivers only
                              <>
                                {totalDriversAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{driversNeeded} drivers
                              </>
                            ) : (
                              // No driver requirements but has assigned drivers
                              <>
                                {totalDriversAssigned} drivers assigned
                              </>
                            )}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            No driver requirement
                          </Badge>
                        )}
                        {/* Speakers - only show if needed > 0 */}
                        {speakersNeeded > 0 && (
                          <Badge
                            variant={speakersAssigned < speakersNeeded ? 'destructive' : 'default'}
                            className="text-xs"
                            title={getAssignedSpeakersLabel(event) ? `Speakers: ${getAssignedSpeakersLabel(event)}` : undefined}
                          >
                            <Megaphone className="w-3 h-3 mr-1" />
                            {`${speakersAssigned}/${speakersNeeded} spk`}
                          </Badge>
                        )}
                        {/* Volunteers - only show if needed > 0 */}
                        {volunteersNeeded > 0 && (
                          <Badge
                            variant={volunteersAssigned < volunteersNeeded ? 'destructive' : 'default'}
                            className="text-xs"
                            title={getAssignedVolunteersLabel(event) ? `Volunteers: ${getAssignedVolunteersLabel(event)}` : undefined}
                          >
                            <Users className="w-3 h-3 mr-1" />
                            {`${volunteersAssigned}/${volunteersNeeded} vol`}
                          </Badge>
                        )}
                        {(!event.latitude || !event.longitude) && (
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-gray-100"
                            onClick={(e) => handleGeocodeEvent(e, event.id)}
                            title="Click to geocode this event's address"
                          >
                            {geocodingEventId === event.id ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Geocoding...
                              </>
                            ) : (
                              'Needs geocode'
                            )}
                          </Badge>
                        )}
                      </div>

                    {/* Expanded details on selected card */}
                    {isSelected && (
                      <div className="pt-2 border-t border-gray-100 space-y-1">
                        <div className="text-[11px] text-gray-700">
                          <span className="font-semibold">Staffing:</span>{' '}
                          <span className="text-gray-600">
                            Drivers {totalDriversAssigned}/{driversNeeded || 0}
                            {event.vanDriverNeeded && !event.isDhlVan && ` • Van ${event.assignedVanDriverId ? 'assigned' : 'needed'}`}
                            {event.isDhlVan && ' • DHL van'}
                            {speakersNeeded > 0 && ` • Speakers ${speakersAssigned}/${speakersNeeded}`}
                            {volunteersNeeded > 0 && ` • Volunteers ${volunteersAssigned}/${volunteersNeeded}`}
                          </span>
                        </div>
                        {getTspContactLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">TSP Contact:</span>{' '}
                            <span className="text-gray-600">{getTspContactLabel(event)}</span>
                          </div>
                        )}
                        {getAssignedDriversLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Assigned drivers:</span>{' '}
                            <span className="text-gray-600">{getAssignedDriversLabel(event)}</span>
                          </div>
                        )}
                        {event.assignedVanDriverId && !event.isDhlVan && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Van driver:</span>{' '}
                            <span className="text-gray-600">{getAssignedDriversLabel({ ...event, assignedDriverIds: [event.assignedVanDriverId] } as any)}</span>
                          </div>
                        )}
                        {getAssignedSpeakersLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Speakers:</span>{' '}
                            <span className="text-gray-600">{getAssignedSpeakersLabel(event)}</span>
                          </div>
                        )}
                        {getAssignedVolunteersLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Volunteers:</span>{' '}
                            <span className="text-gray-600">{getAssignedVolunteersLabel(event)}</span>
                          </div>
                        )}
                        {getDesignatedRecipientLabel(event) && (
                          <div className="text-[11px] text-gray-700">
                            <span className="font-semibold">Recipient:</span>{' '}
                            <span className="text-gray-600">{getDesignatedRecipientLabel(event)}</span>
                          </div>
                        )}
                        {!getTspContactLabel(event) && !getAssignedDriversLabel(event) && !getAssignedSpeakersLabel(event) && !getAssignedVolunteersLabel(event) && !getDesignatedRecipientLabel(event) && (
                          <div className="text-[11px] text-gray-500">
                            No assignments yet.
                          </div>
                        )}
                        {canEditEvents && (
                          <div className="pt-1 mt-1 border-t border-gray-100 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto min-h-0 text-xs text-[#007E8C] hover:text-[#007E8C] hover:bg-[#007E8C]/10 px-1 py-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                // Open edit dialog for this event (it's already selected since this only shows when isSelected)
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Edit Event
                            </Button>
                            {event.eventAddress && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto min-h-0 text-xs text-gray-500 hover:text-[#007E8C] hover:bg-[#007E8C]/10 px-1 py-0.5"
                                onClick={(e) => handleGeocodeEvent(e, event.id)}
                                disabled={geocodingEventId === event.id}
                              >
                                {geocodingEventId === event.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                {event.latitude && event.longitude ? 'Re-geocode' : 'Geocode'}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </Card>
                );
              })}

              {events.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {showOnlyUnmetStaffing && upcomingEvents.length > 0
                      ? 'All events have drivers assigned!'
                      : 'No scheduled events in this period'}
                  </p>
                  {showOnlyUnmetStaffing && upcomingEvents.length > 0 && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowOnlyUnmetStaffing(false)}
                      className="text-[#007E8C] mt-2"
                    >
                      Show all {upcomingEvents.length} events
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Map */}
        <ResizablePanel defaultSize={55} minSize={30}>
        <div className="h-full flex flex-col" data-testid="driver-planning-map">
          <div className="relative flex-1">
          <MapContainer
            center={mapCenter}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
            <MapController
              selectedEvent={effectiveSelectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
              drivingRoute={drivingRoute}
              fullTripRoute={fullTripRoute}
            />
            <MapResizeObserver />

            {/* Event markers - when an event is selected, only show events on the same date */}
            {/* Only show permanent labels for selected event; others show labels on hover */}
            {eventsToShowOnMap.map((event) => {
              const eventDate = event.scheduledEventDate || event.desiredEventDate;
              const formattedDate = eventDate ? format(parseLocalDate(eventDate), 'M/d') : '';
              const isSelected = selectedEvent?.id === event.id;
              return (
                <Marker
                  key={event.id}
                  position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                  icon={isSelected ? selectedEventIcon : eventIcon}
                  eventHandlers={{
                    click: () => handleSelectEvent(event)
                  }}
                >
                  <Tooltip
                    permanent={isSelected}
                    direction="top"
                    offset={[0, -35]}
                    className={isSelected
                      ? "!bg-[#007E8C] !border-[#007E8C] !text-white !text-[11px] !font-semibold !px-2 !py-1 !rounded !shadow-md"
                      : "!bg-white !border-gray-300 !text-gray-800 !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                    }
                  >
                    <span className="truncate max-w-[120px] block">
                      {event.organizationName || 'Event'}{formattedDate ? ` · ${formattedDate}` : ''}
                    </span>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-semibold">{event.organizationName}</h3>
                      <p className="text-sm text-gray-600">{event.eventAddress}</p>
                      {event.estimatedSandwichCount && event.estimatedSandwichCount > 0 && (
                        <p className="text-sm" style={event.estimatedSandwichCount > 400 ? { color: '#a31c41', fontWeight: 600 } : undefined}>
                          ~{event.estimatedSandwichCount} sandwiches
                          {event.sandwichTypes && event.sandwichTypes.length > 0 && (
                            <span className="text-gray-500 font-normal block text-xs">
                              {event.sandwichTypes.map(t => `${t.quantity} ${t.type}`).join(', ')}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Custom location marker (for quick lookup) */}
            {customLocation && (
              <Marker
                key="custom-location"
                position={[parseFloat(customLocation.latitude), parseFloat(customLocation.longitude)]}
                icon={customLocationIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -35]}
                  className="!bg-orange-600/90 !border-orange-600 !text-white !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                >
                  <span className="truncate max-w-[120px] block">
                    {customLocation.address}
                  </span>
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="text-[10px] uppercase text-orange-600 font-semibold">Quick Lookup Location</div>
                    <h3 className="font-semibold">{customLocation.address}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Use this to view nearby hosts, recipients, and drivers
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Nearby host markers when event or custom location selected */}
            {effectiveSelectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
                eventHandlers={{
                  click: () => handleItemClick({
                    type: 'host',
                    id: host.id,
                    latitude: host.latitude,
                    longitude: host.longitude,
                    name: host.contactName || host.hostLocationName
                  })
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-green-50 !border-green-300 !text-green-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {host.contactName || host.hostLocationName}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700">{host.contactName}</h3>
                    <p className="text-xs text-gray-600">{host.hostLocationName}</p>
                    <p className="text-xs text-gray-500 mt-1">{host.distance.toFixed(1)} miles away</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Assigned recipient markers when event selected */}
            {effectiveSelectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
                eventHandlers={{
                  click: () => handleItemClick({
                    type: 'recipient',
                    id: recipient.id,
                    latitude: recipient.latitude,
                    longitude: recipient.longitude,
                    name: recipient.name
                  })
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Assigned Recipient</div>
                    <h3 className="font-semibold text-purple-700">{recipient.name}</h3>
                    {recipient.address && (
                      <p className="text-xs text-gray-600">{recipient.address}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* All recipient markers on map when event or custom location selected */}
            {effectiveSelectedEvent && allNonDesignatedRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
                eventHandlers={{
                  click: () => handleItemClick({
                    type: 'recipient',
                    id: recipient.id,
                    latitude: recipient.latitude,
                    longitude: recipient.longitude,
                    name: recipient.name
                  })
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-purple-700">{recipient.name}</h3>
                    {recipient.address && (
                      <p className="text-xs text-gray-600">{recipient.address}</p>
                    )}
                    {recipient.estimatedSandwiches && (
                      <p className="text-xs mt-1">Needs ~{recipient.estimatedSandwiches} sandwiches</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">{recipient.distance.toFixed(1)} miles away</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Selected driver marker - show on map when a driver is selected for trip planning */}
            {selectedDriver && selectedDriver.latitude && selectedDriver.longitude && (
              <Marker
                key={`selected-driver-${selectedDriver.id}`}
                position={[parseFloat(selectedDriver.latitude), parseFloat(selectedDriver.longitude)]}
                icon={driverIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-yellow-100 !border-yellow-400 !text-yellow-900 !text-xs !font-semibold !px-2 !py-1 !rounded !shadow-md"
                >
                  {selectedDriver.name} (Selected)
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-yellow-700 text-sm flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {selectedDriver.name}
                    </h3>
                    <p className="text-xs text-green-600 mt-1">Selected for trip planning</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Nearby driver markers (triangles) when event or custom location selected */}
            {/* Show drivers and volunteers (who are flagged as drivers), not hosts - hosts show as green circles */}
            {effectiveSelectedEvent && nearbyDriversAll
              .filter(({ driver }) => driver.latitude && driver.longitude && driver.id !== selectedDriver?.id && (driver.source === 'driver' || driver.source === 'volunteer'))
              .slice(0, 15)
              .map(({ driver, distance }) => (
              <Marker
                key={`driver-${driver.id}`}
                position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]}
                icon={driverIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-yellow-50 !border-yellow-300 !text-yellow-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {driver.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-yellow-700 text-sm flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {driver.name}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {driver.hostLocation || driver.homeAddress || 'Driver location'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{distance.toFixed(1)} miles away</p>
                    {driver.vanApproved && (
                      <p className="text-xs text-green-600 mt-1">Van Approved</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Driving route polyline (single leg preview) */}
            {drivingRoute && drivingRoute.coordinates.length > 0 && !fullTripRoute && (
              <Polyline
                positions={drivingRoute.coordinates}
                pathOptions={{
                  color: '#2563eb',
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '10, 10',
                }}
              />
            )}

            {/* Full trip route polylines (when both driver and destination are selected) */}
            {fullTripRoute && (
              <>
                {/* Leg 1: Driver home -> Event (dashed yellow/orange) */}
                <Polyline
                  positions={fullTripRoute.leg1.coordinates}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '10, 6',
                  }}
                />
                {/* Leg 2: Event -> Destination (solid purple) */}
                <Polyline
                  positions={fullTripRoute.leg2.coordinates}
                  pathOptions={{
                    color: '#9333ea',
                    weight: 5,
                    opacity: 0.9,
                  }}
                />
              </>
            )}

            {/* Show volunteers/speakers assigned to visible events when toggle is on */}
            {showVolunteersSpeakers && volunteersWithLocations.map((volunteer) => (
              <Marker
                key={`volunteer-${volunteer.id}`}
                position={[parseFloat(volunteer.latitude!), parseFloat(volunteer.longitude!)]}
                icon={volunteerIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {volunteer.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-purple-700 text-sm flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      {volunteer.name}
                      {volunteer.isSpeaker && <span className="text-purple-400 text-[11px]">(Speaker)</span>}
                    </h3>
                    {volunteer.homeAddress && (
                      <p className="text-xs text-gray-600">{volunteer.homeAddress}</p>
                    )}
                    {volunteer.phone && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {volunteer.phone}
                      </p>
                    )}
                    {volunteer.assignedEvents.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-200">
                        <p className="text-xs text-purple-600 font-medium">Assigned to:</p>
                        <ul className="text-xs text-gray-600 mt-1">
                          {volunteer.assignedEvents.map((evt, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: evt.role === 'speaker' ? colors.volunteer : '#a78bfa' }} />
                              {evt.eventName} ({evt.role})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Show team members with addresses on map when toggle is on */}
            {showTeamMembers && teamMembersForMap.map((member) => (
              <Marker
                key={`team-member-${member.id}`}
                position={[parseFloat(member.latitude), parseFloat(member.longitude)]}
                icon={teamMemberIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-red-50 !border-red-300 !text-red-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {member.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-red-700 text-sm flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {member.name}
                      <span className="text-red-400 text-[11px]">({member.role})</span>
                    </h3>
                    {member.address && (
                      <p className="text-xs text-gray-600">{member.address}</p>
                    )}
                    {member.phoneNumber && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {member.phoneNumber}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Partial selection info box - shows when driver OR destination is selected (but not both) */}
          {((selectedDriver && !selectedDestination) || (!selectedDriver && selectedDestination)) && !fullTripRoute && (
            <div className={`hidden bg-white rounded-xl shadow-lg z-[1000] transition-all duration-200 ${tripPlanningCollapsed ? 'w-auto' : 'min-w-[280px] p-4'}`}>
              {tripPlanningCollapsed ? (
                /* Collapsed state - just show a small expand button */
                <button
                  onClick={() => setTripPlanningCollapsed(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                  title="Expand trip planning"
                >
                  <Target className="w-4 h-4 text-[#007E8C]" />
                  <span>Trip Planning</span>
                  <ChevronUp className="w-4 h-4" />
                </button>
              ) : (
                /* Expanded state */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">Trip Planning</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setTripPlanningCollapsed(true)}
                        className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                        title="Minimize"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          // Check if driver/destination are pre-assigned - only clear what wasn't pre-assigned
                          const driverIsAssigned = selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id));
                          const destIsAssigned = selectedDestination && selectedDestination.type === 'recipient' &&
                            designatedRecipients.some(r => r.id === selectedDestination.id);

                          // Keep pre-assigned items, clear the rest
                          if (!driverIsAssigned) setSelectedDriver(null);
                          if (!destIsAssigned) setSelectedDestination(null);
                          setDrivingRoute(null);
                          setFocusedItem(null);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded"
                        title="Clear selections"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Selected Driver */}
                  {selectedDriver && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-yellow-400" />
                        <span className="font-medium">Driver Selected</span>
                      </div>
                      <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-gray-800">{selectedDriver.name}</span>
                          {assignedDrivers.some(d => String(d.id) === String(selectedDriver.id)) && (
                            <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                              Assigned
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedDriver(null)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Unselect driver"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

              {/* Selected Destination */}
              {selectedDestination && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                    {selectedDestination.type === 'host' ? (
                      <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm" />
                    ) : (
                      <div className="w-3 h-3 bg-purple-500 border border-white shadow-sm rotate-45" style={{ borderRadius: '1px' }} />
                    )}
                    <span className="font-medium">{selectedDestination.type === 'host' ? 'Host' : 'Recipient'} Selected</span>
                  </div>
                  <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-gray-800">{selectedDestination.name}</span>
                      {selectedDestination.type === 'recipient' && designatedRecipients.some(r => r.id === selectedDestination.id) && (
                        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          Assigned
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedDestination(null)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Unselect destination"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Route preview info - show when previewing a potential destination */}
              {drivingRoute && focusedItem && (
                <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-xs text-blue-700 mb-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span className="font-medium">Route to {focusedItem.name}</span>
                    {drivingRoute.durationInTraffic && (
                      <span className="text-[9px] text-green-600 ml-auto">✓ Traffic</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-medium text-gray-800">{(drivingRoute.distance / 1609.34).toFixed(1)} mi</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-medium text-gray-800">
                      {(() => {
                        const dur = formatDuration(drivingRoute.duration, drivingRoute.durationInTraffic);
                        return dur.hasTraffic ? (
                          <span className="flex items-center gap-1">
                            {dur.text} min
                            {dur.trafficDelay && dur.trafficDelay > 0 && (
                              <span className="text-[10px] text-red-500" title="Traffic delay">+{dur.trafficDelay}</span>
                            )}
                          </span>
                        ) : `~${dur.text} min`;
                      })()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Select this previewed item as the destination
                      if ((focusedItem.type === 'host' || focusedItem.type === 'recipient') && focusedItem.name) {
                        setSelectedDestination({
                          type: focusedItem.type,
                          id: typeof focusedItem.id === 'number' ? focusedItem.id : parseInt(String(focusedItem.id), 10),
                          name: focusedItem.name,
                          latitude: focusedItem.latitude,
                          longitude: focusedItem.longitude,
                        });
                        setDrivingRoute(null);
                        setFocusedItem(null);
                      }
                    }}
                    className="mt-2 w-full px-2 py-1.5 text-xs font-medium text-white bg-[#007E8C] hover:bg-[#006b77] rounded transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Select as Destination
                  </button>
                </div>
              )}

              {/* Driver-to-event route info - show when driver is selected but no destination yet */}
              {drivingRoute && selectedDriver && !selectedDestination && !focusedItem && (
                <div className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center gap-2 text-xs text-amber-700 mb-1">
                    <Navigation className="w-3.5 h-3.5" />
                    <span className="font-medium">Driver → Event</span>
                    {drivingRoute.durationInTraffic && (
                      <span className="text-[9px] text-green-600 ml-auto">✓ Traffic</span>
                    )}
                  </div>
                  <div className="flex gap-2 text-sm">
                    <span className="font-medium text-gray-800">{(drivingRoute.distance / 1609.34).toFixed(1)} mi</span>
                    <span className="text-gray-400">·</span>
                    <span className="font-medium text-gray-800">
                      {(() => {
                        const dur = formatDuration(drivingRoute.duration, drivingRoute.durationInTraffic);
                        return dur.hasTraffic ? (
                          <span className="flex items-center gap-1">
                            {dur.text} min
                            {dur.trafficDelay && dur.trafficDelay > 0 && (
                              <span className="text-[10px] text-red-500" title="Traffic delay">+{dur.trafficDelay}</span>
                            )}
                          </span>
                        ) : `~${dur.text} min`;
                      })()}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Select a destination below to see full trip</p>
                </div>
              )}

              {/* Prompt for missing selection */}
              <div className="border-t pt-3 mt-1">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 text-[#007E8C]" />
                  {!selectedDriver && <span>Select a <strong>driver</strong> from the sidebar to complete the trip</span>}
                  {!selectedDestination && !drivingRoute && <span>Click a <strong>host or recipient</strong> from the sidebar to preview, then select</span>}
                  {!selectedDestination && drivingRoute && <span>Click <strong>Select as Destination</strong> above, or preview another option</span>}
                </div>
              </div>

              {/* Hide/Show route toggle for assigned drivers */}
              {selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id)) && drivingRoute && (
                <button
                  onClick={() => setDrivingRoute(null)}
                  className="w-full mt-3 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <EyeOff className="w-4 h-4" />
                  Hide Driver's Route
                </button>
              )}

              <button
                onClick={() => {
                  // Check if driver/destination are pre-assigned - only clear what wasn't pre-assigned
                  const driverIsAssigned = selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id));
                  const destIsAssigned = selectedDestination && selectedDestination.type === 'recipient' &&
                    designatedRecipients.some(r => r.id === selectedDestination.id);

                  // Keep pre-assigned items, clear the rest
                  if (!driverIsAssigned) setSelectedDriver(null);
                  if (!destIsAssigned) setSelectedDestination(null);
                  // Only clear driving route if driver is NOT assigned
                  if (!driverIsAssigned) setDrivingRoute(null);
                  setFocusedItem(null);
                }}
                className="w-full mt-3 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear Selection
              </button>
                </>
              )}
            </div>
          )}

          {/* Single route info box - shows when previewing a route (no full trip, no partial selection) */}
          {drivingRoute && !fullTripRoute && !selectedDriver && !selectedDestination && (
            <div className="hidden bg-white rounded-xl shadow-lg p-4 z-[1000] min-w-[220px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800">Route Preview</span>
                <button
                  onClick={() => {
                    setDrivingRoute(null);
                    setFocusedItem(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                  title="Close route"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-2.5">
                  <Truck className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-medium text-gray-800">{(drivingRoute.distance / 1609.34).toFixed(1)} miles</span>
                </div>
                <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-2.5">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-base font-medium text-gray-800">
                    {(() => {
                      const dur = formatDuration(drivingRoute.duration, drivingRoute.durationInTraffic);
                      return dur.hasTraffic ? (
                        <span className="flex items-center gap-1">
                          {dur.text} min drive
                          {dur.trafficDelay && dur.trafficDelay > 0 && (
                            <span className="text-xs text-red-500" title="Traffic delay">(+{dur.trafficDelay} traffic)</span>
                          )}
                        </span>
                      ) : `${dur.text} min drive`;
                    })()}
                  </span>
                </div>
                {drivingRoute.durationInTraffic && (
                  <div className="text-xs text-green-600 text-center">✓ Includes traffic estimate</div>
                )}
              </div>
              {isLoadingRoute && (
                <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading route...
                </div>
              )}

              {/* Select button for previewed item (not for speakers - they're informational only) */}
              {focusedItem && focusedItem.type !== 'speaker' && (
                <button
                  onClick={() => {
                    if (focusedItem.type === 'driver') {
                      setSelectedDriver({
                        id: String(focusedItem.id),
                        name: focusedItem.name || 'Driver',
                        latitude: focusedItem.latitude,
                        longitude: focusedItem.longitude,
                      });
                    } else if (focusedItem.type === 'host' || focusedItem.type === 'recipient') {
                      setSelectedDestination({
                        type: focusedItem.type,
                        id: focusedItem.id as number,
                        name: focusedItem.name || (focusedItem.type === 'host' ? 'Host' : 'Recipient'),
                        latitude: focusedItem.latitude,
                        longitude: focusedItem.longitude,
                      });
                    }
                    setDrivingRoute(null);
                    setFocusedItem(null);
                  }}
                  className="w-full mt-3 px-3 py-2 text-sm font-medium text-white bg-[#007E8C] hover:bg-[#006670] rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Select {focusedItem.type === 'driver' ? 'Driver' : 'Destination'}
                </button>
              )}

              <button
                onClick={() => {
                  setDrivingRoute(null);
                  setFocusedItem(null);
                }}
                className="w-full mt-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          )}

          </div>

          <div className="border-t bg-white px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="bg-white rounded-lg shadow-sm border p-3 inline-block" data-testid="driver-planning-legend">
                <div className="text-xs font-semibold mb-2">Legend</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 12 18" className="w-3 h-4" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" fill="#3388ff" stroke="white" strokeWidth="0.5"/>
                    </svg>
                    <span>Event</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 12 18" className="w-3 h-4" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" fill="#ff0000" stroke="white" strokeWidth="0.5"/>
                    </svg>
                    <span>Selected Event</span>
                  </div>
                  {effectiveSelectedEvent && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm" />
                        <span>Host (circle)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-purple-500 border border-white shadow-sm rotate-45" style={{ borderRadius: '1px' }} />
                        <span>Recipient (diamond)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-yellow-400" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />
                        <span>Driver (triangle)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 26 26" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="13" cy="13" r="11" fill="#2ecc71" stroke="white" strokeWidth="2"/>
                          <path d="M13 6L19 18H7L13 6Z" fill="#f1c40f" stroke="white" strokeWidth="1.5"/>
                        </svg>
                        <span>Host+Driver</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-gray-200 mt-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500 border border-white shadow-sm" />
                        <span>Selected = orange</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {fullTripRoute && selectedDriver && selectedDestination && (
                <div className="bg-white rounded-xl shadow-sm border p-4 min-w-[280px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">Full Trip Route</span>
                    <button
                      onClick={() => {
                        // Check if driver/destination are pre-assigned - only clear what wasn't pre-assigned
                        const driverIsAssigned = selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id));
                        const destIsAssigned = selectedDestination && selectedDestination.type === 'recipient' &&
                          designatedRecipients.some(r => r.id === selectedDestination.id);

                        // Keep pre-assigned items, clear the rest
                        if (!driverIsAssigned) setSelectedDriver(null);
                        if (!destIsAssigned) setSelectedDestination(null);
                        setFullTripRoute(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                      title="Clear non-assigned selections"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Leg 1: Driver to Event */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                      <Home className="w-3.5 h-3.5 text-amber-600" />
                      <span className="font-medium">{selectedDriver.name}</span>
                      <Navigation className="w-3 h-3 text-gray-400" />
                      <span>Event</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-2.5 py-1.5 flex-1">
                        <Truck className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-gray-700">{(fullTripRoute.leg1.distance / 1609.34).toFixed(1)} mi</span>
                      </div>
                      <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-2.5 py-1.5 flex-1">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {(() => {
                            const dur = formatDuration(fullTripRoute.leg1.duration, fullTripRoute.leg1.durationInTraffic);
                            return dur.hasTraffic ? (
                              <span className="flex items-center gap-1">
                                {dur.text} min
                                <span className="text-[10px] text-red-500" title="Traffic delay">+{dur.trafficDelay}</span>
                              </span>
                            ) : `~${dur.text} min`;
                          })()}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 italic">
                      {fullTripRoute.leg1.durationInTraffic ? 'Traffic estimate for event time' : 'Estimate from driver\'s home'}
                    </div>
                  </div>

                  {/* Leg 2: Event to Destination */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 text-purple-600" />
                      <span>Event</span>
                      <Navigation className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{selectedDestination.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-2.5 py-1.5 flex-1">
                        <Truck className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">{(fullTripRoute.leg2.distance / 1609.34).toFixed(1)} mi</span>
                      </div>
                      <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-2.5 py-1.5 flex-1">
                        <Clock className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {(() => {
                            const dur = formatDuration(fullTripRoute.leg2.duration, fullTripRoute.leg2.durationInTraffic);
                            return dur.hasTraffic ? (
                              <span className="flex items-center gap-1">
                                {dur.text} min
                                <span className="text-[10px] text-red-500" title="Traffic delay">+{dur.trafficDelay}</span>
                              </span>
                            ) : `~${dur.text} min`;
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total trip:</span>
                      <span className="font-semibold text-gray-800">
                        {((fullTripRoute.leg1.distance + fullTripRoute.leg2.distance) / 1609.34).toFixed(1)} mi,{' '}
                        {(() => {
                          const totalDuration = fullTripRoute.leg1.duration + fullTripRoute.leg2.duration;
                          const totalTrafficDuration = (fullTripRoute.leg1.durationInTraffic || fullTripRoute.leg1.duration) +
                                                       (fullTripRoute.leg2.durationInTraffic || fullTripRoute.leg2.duration);
                          const hasTraffic = fullTripRoute.leg1.durationInTraffic || fullTripRoute.leg2.durationInTraffic;
                          if (hasTraffic && totalTrafficDuration > totalDuration) {
                            return `${Math.round(totalTrafficDuration / 60)} min`;
                          }
                          return `~${Math.round(totalDuration / 60)} min`;
                        })()}
                      </span>
                    </div>
                    {(fullTripRoute.leg1.durationInTraffic || fullTripRoute.leg2.durationInTraffic) && (
                      <div className="text-[10px] text-green-600 mt-0.5 text-right">✓ Includes traffic estimate</div>
                    )}
                  </div>

                  {isLoadingFullTrip && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Calculating routes...
                    </div>
                  )}

                  <button
                    onClick={() => {
                      // Check if driver/destination are pre-assigned - only clear what wasn't pre-assigned
                      const driverIsAssigned = selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id));
                      const destIsAssigned = selectedDestination && selectedDestination.type === 'recipient' &&
                        designatedRecipients.some(r => r.id === selectedDestination.id);

                      // Keep pre-assigned items, clear the rest
                      if (!driverIsAssigned) setSelectedDriver(null);
                      if (!destIsAssigned) setSelectedDestination(null);
                      setFullTripRoute(null);
                    }}
                    className="w-full mt-3 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Clear Trip
                  </button>
                </div>
              )}

              {((selectedDriver && !selectedDestination) || (!selectedDriver && selectedDestination)) && !fullTripRoute && (
                <div className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${tripPlanningCollapsed ? 'p-2 w-auto' : 'min-w-[280px] p-4'}`}>
                  {tripPlanningCollapsed ? (
                    /* Collapsed state - just show a small expand button */
                    <button
                      onClick={() => setTripPlanningCollapsed(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
                      title="Expand trip planning"
                    >
                      <Target className="w-4 h-4 text-[#007E8C]" />
                      <span>Trip Planning</span>
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  ) : (
                    /* Expanded state */
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-800">Trip Planning</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setTripPlanningCollapsed(true)}
                            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                            title="Minimize"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              // Check if driver/destination are pre-assigned - only clear what wasn't pre-assigned
                              const driverIsAssigned = selectedDriver && assignedDrivers.some(d => String(d.id) === String(selectedDriver.id));
                              const destIsAssigned = selectedDestination && selectedDestination.type === 'recipient' &&
                                designatedRecipients.some(r => r.id === selectedDestination.id);

                              // Keep pre-assigned items, clear the rest
                              if (!driverIsAssigned) setSelectedDriver(null);
                              if (!destIsAssigned) setSelectedDestination(null);
                              setDrivingRoute(null);
                              setFocusedItem(null);
                            }}
                            className="text-gray-400 hover:text-red-500 p-1 hover:bg-gray-100 rounded"
                            title="Clear selections"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Selected Driver */}
                      {selectedDriver && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-yellow-400" />
                            <span className="font-medium">Driver Selected</span>
                          </div>
                          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-amber-600" />
                              <span className="text-sm font-medium text-gray-800">{selectedDriver.name}</span>
                              {assignedDrivers.some(d => String(d.id) === String(selectedDriver.id)) && (
                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                  Assigned
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedDriver(null)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Unselect driver"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Selected Destination */}
                      {selectedDestination && (
                        <div className="mb-3">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                            <div className="w-2.5 h-2.5 bg-purple-500 rotate-45" style={{ borderRadius: '1px' }} />
                            <span className="font-medium">Destination Selected</span>
                          </div>
                          <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-purple-600" />
                              <span className="text-sm font-medium text-gray-800">{selectedDestination.name}</span>
                              {selectedDestination.type === 'recipient' &&
                                designatedRecipients.some(r => r.id === selectedDestination.id) && (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Designated
                                  </span>
                              )}
                            </div>
                            <button
                              onClick={() => setSelectedDestination(null)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              title="Unselect destination"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Route Preview */}
                      {drivingRoute && (
                        <div className="bg-blue-50 rounded-lg p-3 mb-3">
                          <div className="text-xs text-blue-700 font-medium mb-1">Route Preview</div>
                          <div className="flex gap-3 text-sm">
                            <span className="flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              {(drivingRoute.distance / 1609.34).toFixed(1)} mi
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                              {(() => {
                                const dur = formatDuration(drivingRoute.duration, drivingRoute.durationInTraffic);
                                return dur.hasTraffic ? (
                                  <span className="flex items-center gap-1">
                                    {dur.text} min
                                    {dur.trafficDelay && dur.trafficDelay > 0 && (
                                      <span className="text-[10px] text-red-500">+{dur.trafficDelay}</span>
                                    )}
                                  </span>
                                ) : `~${dur.text} min`;
                              })()}
                            </span>
                          </div>
                          {drivingRoute.durationInTraffic && (
                            <div className="text-[10px] text-green-600 mt-1">✓ Includes traffic estimate</div>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        {selectedDriver && !selectedDestination && 'Select a destination to see full trip route.'}
                        {!selectedDriver && selectedDestination && 'Select a driver to see full trip route.'}
                      </div>
                    </>
                  )}
                </div>
              )}

              {drivingRoute && !fullTripRoute && !selectedDriver && !selectedDestination && (
                <div className="bg-white rounded-xl shadow-sm border p-4 min-w-[220px]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-800">Route Preview</span>
                    <button
                      onClick={() => {
                        setDrivingRoute(null);
                        setFocusedItem(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                      title="Close route"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-2.5">
                      <Truck className="w-5 h-5 text-blue-600" />
                      <span className="text-base font-medium text-gray-800">{(drivingRoute.distance / 1609.34).toFixed(1)} miles</span>
                    </div>
                    <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-2.5">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="text-base font-medium text-gray-800">
                        {(() => {
                          const dur = formatDuration(drivingRoute.duration, drivingRoute.durationInTraffic);
                          return dur.hasTraffic ? (
                            <span className="flex items-center gap-1">
                              {dur.text} min drive
                              {dur.trafficDelay && dur.trafficDelay > 0 && (
                                <span className="text-xs text-red-500" title="Traffic delay">(+{dur.trafficDelay} traffic)</span>
                              )}
                            </span>
                          ) : `${dur.text} min drive`;
                        })()}
                      </span>
                    </div>
                    {drivingRoute.durationInTraffic && (
                      <div className="text-xs text-green-600 text-center">✓ Includes traffic estimate</div>
                    )}
                  </div>
                  {isLoadingRoute && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading route...
                    </div>
                  )}

                  {/* Select button for previewed item (not for speakers) */}
                  {focusedItem && focusedItem.type !== 'speaker' && (
                    <button
                      onClick={() => {
                        if (focusedItem.type === 'driver') {
                          setSelectedDriver({
                            id: String(focusedItem.id),
                            name: focusedItem.name || 'Driver',
                            latitude: focusedItem.latitude,
                            longitude: focusedItem.longitude,
                          });
                        } else if (focusedItem.type === 'host' || focusedItem.type === 'recipient') {
                          setSelectedDestination({
                            type: focusedItem.type,
                            id: focusedItem.id as number,
                            name: focusedItem.name || (focusedItem.type === 'host' ? 'Host' : 'Recipient'),
                            latitude: focusedItem.latitude,
                            longitude: focusedItem.longitude,
                          });
                        }
                        setDrivingRoute(null);
                        setFocusedItem(null);
                      }}
                      className="w-full mt-3 px-3 py-2 text-sm font-medium text-white bg-[#007E8C] hover:bg-[#006670] rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Select {focusedItem.type === 'driver' ? 'Driver' : 'Destination'}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setDrivingRoute(null);
                      setFocusedItem(null);
                    }}
                    className="w-full mt-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Close Preview
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel - Event People (Hosts, Recipients, Speakers, Drivers) */}
        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
        <div className="h-full border-l bg-gray-50 flex flex-col" onClick={() => setFocusedItem(null)}>
          <div className="p-3 border-b bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#007E8C]" />
                {effectiveSelectedEvent ? 'Event People' : 'Select an Event'}
              </h2>
              {selectedEvent && canEditEvents && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openEditDialog}
                  className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                  title="Edit event details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {effectiveSelectedEvent && (
              <p className="text-xs text-gray-600 mt-1">
                For: {effectiveSelectedEvent.organizationName}
              </p>
            )}
          </div>

          <ScrollArea className="flex-1">
            {!effectiveSelectedEvent ? (
              <div className="p-6 text-center text-gray-500">
                <Truck className="w-16 h-16 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">No event selected</p>
                <p className="text-xs mt-1">Click an event from the list or use Quick Location Lookup to see nearby drivers and hosts</p>
              </div>
            ) : (
              <div className="p-3 space-y-4">
                {/* Trip Planning Panel - Shows when driver or destination is selected */}
                {(selectedDriver || selectedDestination) && (
                  <div className="bg-gradient-to-r from-[#007E8C]/10 to-[#007E8C]/5 rounded-lg p-3 border border-[#007E8C]/20">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-[#007E8C] uppercase tracking-wide flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        Trip Planning
                      </h3>
                      {(selectedDriver && selectedDestination) && (
                        <span className="text-[10px] text-[#007E8C] font-medium bg-[#007E8C]/10 px-2 py-0.5 rounded-full">
                          Full trip shown
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Selected Driver */}
                      {selectedDriver ? (
                        <div className="flex items-center justify-between bg-white rounded-md px-2.5 py-2 shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-yellow-400" />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-500 uppercase">Driver</span>
                                {assignedDrivers.some(d => d.id === selectedDriver.id) && (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-800 -mt-0.5">{selectedDriver.name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedDriver(null)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Unselect driver"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-white/50 rounded-md px-2.5 py-2 border border-dashed border-gray-300">
                          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-gray-300" />
                          <span className="text-xs text-gray-400 italic">
                            {assignedDrivers.length > 0
                              ? `${assignedDrivers.length} driver${assignedDrivers.length > 1 ? 's' : ''} assigned - select one to preview`
                              : 'No driver selected - preview then select one'}
                          </span>
                        </div>
                      )}

                      {/* Selected Destination */}
                      {selectedDestination ? (
                        <div className="flex items-center justify-between bg-white rounded-md px-2.5 py-2 shadow-sm">
                          <div className="flex items-center gap-2">
                            {selectedDestination.type === 'host' ? (
                              <div className="w-3 h-3 rounded-full bg-green-500 border border-white shadow-sm" />
                            ) : (
                              <div className="w-3 h-3 bg-purple-500 border border-white shadow-sm rotate-45" style={{ borderRadius: '1px' }} />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-gray-500 uppercase">
                                  {selectedDestination.type === 'host' ? 'Host' : 'Recipient'}
                                </span>
                                {selectedDestination.type === 'recipient' && designatedRecipients.some(r => r.id === selectedDestination.id) && (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-800 -mt-0.5">{selectedDestination.name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedDestination(null)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title="Unselect destination"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-white/50 rounded-md px-2.5 py-2 border border-dashed border-gray-300">
                          <div className="w-3 h-3 bg-gray-300 border border-white shadow-sm rotate-45" style={{ borderRadius: '1px' }} />
                          <span className="text-xs text-gray-400 italic">
                            {designatedRecipients.length > 0
                              ? `${designatedRecipients.length} recipient${designatedRecipients.length > 1 ? 's' : ''} assigned - select one to preview`
                              : 'No destination selected - preview then select one'}
                          </span>
                        </div>
                      )}
                    </div>

                    {isLoadingFullTrip && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-[#007E8C]">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Calculating full trip route...
                      </div>
                    )}
                  </div>
                )}

                {driverSearchResults && driverSearchResults.length === 0 && (
                  <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                    No drivers match your search.
                  </div>
                )}

                {/* Nearby Hosts - Show first and always visible */}
                <div data-testid="driver-planning-nearby-hosts">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-green-600" />
                      Nearby Hosts
                    </h3>
                    <span className="text-[9px] text-gray-400 italic" title="Click to preview driving route">distances are direct</span>
                  </div>
                  {nearbyHosts.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllHosts ? nearbyHosts : nearbyHosts.slice(0, 3)).map((host) => (
                        <div
                          key={host.id}
                          className={`flex items-stretch text-xs border rounded transition-colors ${
                            selectedDestination?.type === 'host' && selectedDestination?.id === host.id
                              ? 'bg-[#007E8C]/10 border-[#007E8C] ring-2 ring-[#007E8C]/30'
                              : focusedItem?.type === 'host' && focusedItem?.id === host.id
                                ? 'bg-green-100 border-green-400'
                                : 'bg-green-50 border-green-200 hover:bg-green-100'
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick({
                                type: 'host',
                                id: host.id,
                                latitude: host.latitude,
                                longitude: host.longitude,
                                name: host.contactName || host.hostLocationName
                              });
                            }}
                            className="flex-1 text-left p-2"
                            data-testid={`host-locate-${host.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-green-600" />
                                <span className="font-medium">{host.contactName}</span>
                              </div>
                              <span className="text-green-700">{host.distance.toFixed(1)} mi</span>
                            </div>
                            <div className="text-gray-500 pl-5 mt-0.5 text-[10px]">
                              {host.hostLocationName}
                            </div>
                          </button>
                          {/* Select button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clear preview route when making a selection
                              setDrivingRoute(null);
                              setFocusedItem(null);
                              if (selectedDestination?.type === 'host' && selectedDestination?.id === host.id) {
                                setSelectedDestination(null);
                              } else {
                                setSelectedDestination({
                                  type: 'host',
                                  id: host.id,
                                  name: host.contactName || host.hostLocationName,
                                  latitude: host.latitude,
                                  longitude: host.longitude,
                                });
                              }
                            }}
                            className={`px-2 flex items-center justify-center border-l transition-colors ${
                              selectedDestination?.type === 'host' && selectedDestination?.id === host.id
                                ? 'bg-[#007E8C] text-white border-[#007E8C]'
                                : 'bg-green-100 text-green-700 border-green-200 hover:bg-[#007E8C] hover:text-white hover:border-[#007E8C]'
                            }`}
                            title={selectedDestination?.type === 'host' && selectedDestination?.id === host.id ? 'Unselect destination' : 'Select as destination'}
                          >
                            {selectedDestination?.type === 'host' && selectedDestination?.id === host.id ? (
                              <X className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                      {nearbyHosts.length > 3 && (
                        <button
                          onClick={() => setShowAllHosts(!showAllHosts)}
                          className="w-full text-xs text-green-700 hover:text-green-900 font-medium py-1"
                        >
                          {showAllHosts ? 'Show less' : `View ${nearbyHosts.length - 3} more hosts`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No hosts with map coordinates found nearby.
                      <br />
                      <span className="text-gray-400">Add coordinates in Host Management to see them here.</span>
                    </div>
                  )}
                </div>

                {/* Nearby Recipients - Delivery locations */}
                <div data-testid="driver-planning-nearby-recipients">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <Heart className="w-4 h-4 text-purple-600" />
                      Nearby Recipients
                    </h3>
                    <span className="text-[9px] text-gray-400 italic" title="Click to preview driving route">click for driving distance</span>
                  </div>
                  {designatedRecipients.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[11px] font-semibold text-gray-700 mb-1">Assigned recipient</div>
                      <div className="space-y-1">
                        {designatedRecipients.map((recipient) => (
                          <div
                            key={`designated-recipient-sidebar-${recipient.id}`}
                            className={`flex items-stretch text-xs border rounded transition-colors ${
                              selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id
                                ? 'bg-[#007E8C]/10 border-[#007E8C] ring-2 ring-[#007E8C]/30'
                                : focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                                  ? 'bg-purple-100 border-purple-400'
                                  : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                            }`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick({
                                  type: 'recipient',
                                  id: recipient.id,
                                  latitude: recipient.latitude,
                                  longitude: recipient.longitude,
                                  name: recipient.name
                                });
                              }}
                              className="flex-1 text-left p-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-purple-600" />
                                  <span className="font-medium">{recipient.name}</span>
                                </div>
                                <span className="text-purple-700">Assigned</span>
                              </div>
                              {recipient.address && (
                                <div className="text-gray-500 pl-5 mt-0.5 text-[10px] line-clamp-1">
                                  {recipient.address}
                                </div>
                              )}
                            </button>
                            {/* Select button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Clear preview route when making a selection
                                setDrivingRoute(null);
                                setFocusedItem(null);
                                if (selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id) {
                                  setSelectedDestination(null);
                                } else {
                                  setSelectedDestination({
                                    type: 'recipient',
                                    id: recipient.id,
                                    name: recipient.name,
                                    latitude: recipient.latitude,
                                    longitude: recipient.longitude,
                                  });
                                }
                              }}
                              className={`px-2 flex items-center justify-center border-l transition-colors ${
                                selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id
                                  ? 'bg-[#007E8C] text-white border-[#007E8C]'
                                  : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-[#007E8C] hover:text-white hover:border-[#007E8C]'
                              }`}
                              title={selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id ? 'Unselect destination' : 'Select as destination'}
                            >
                              {selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id ? (
                                <X className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {nearbyRecipients.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllRecipients ? nonDesignatedNearbyRecipients : nonDesignatedNearbyRecipients.slice(0, 3)).map((recipient) => (
                        <div
                          key={recipient.id}
                          className={`flex items-stretch text-xs border rounded transition-colors ${
                            selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id
                              ? 'bg-[#007E8C]/10 border-[#007E8C] ring-2 ring-[#007E8C]/30'
                              : focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                                ? 'bg-purple-100 border-purple-400'
                                : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick({
                                type: 'recipient',
                                id: recipient.id,
                                latitude: recipient.latitude,
                                longitude: recipient.longitude,
                                name: recipient.name
                              });
                            }}
                            className="flex-1 text-left p-2"
                            data-testid={`recipient-locate-${recipient.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                                <span className="font-medium">{recipient.name}</span>
                              </div>
                              <span className="text-purple-700">{recipient.distance.toFixed(1)} mi</span>
                            </div>
                            {recipient.estimatedSandwiches && (
                              <div className="mt-1 text-gray-600 pl-5">
                                Needs ~{recipient.estimatedSandwiches} sandwiches
                              </div>
                            )}
                            {recipient.region && (
                              <div className="mt-0.5 text-gray-500 pl-5 text-[10px]">
                                {recipient.region}
                              </div>
                            )}
                          </button>
                          {/* Select button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Clear preview route when making a selection
                              setDrivingRoute(null);
                              setFocusedItem(null);
                              if (selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id) {
                                setSelectedDestination(null);
                              } else {
                                setSelectedDestination({
                                  type: 'recipient',
                                  id: recipient.id,
                                  name: recipient.name,
                                  latitude: recipient.latitude,
                                  longitude: recipient.longitude,
                                });
                              }
                            }}
                            className={`px-2 flex items-center justify-center border-l transition-colors ${
                              selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id
                                ? 'bg-[#007E8C] text-white border-[#007E8C]'
                                : 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-[#007E8C] hover:text-white hover:border-[#007E8C]'
                            }`}
                            title={selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id ? 'Unselect destination' : 'Select as destination'}
                          >
                            {selectedDestination?.type === 'recipient' && selectedDestination?.id === recipient.id ? (
                              <X className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ))}
                      {nonDesignatedNearbyRecipients.length > 3 && (
                        <button
                          onClick={() => setShowAllRecipients(!showAllRecipients)}
                          className="w-full text-xs text-purple-700 hover:text-purple-900 font-medium py-1"
                        >
                          {showAllRecipients ? 'Show less' : `View ${nonDesignatedNearbyRecipients.length - 3} more recipients`}
                        </button>
                      )}
                    </div>
                  ) : recipientMapData.length === 0 ? (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No recipients with map coordinates yet.
                      <br />
                      <span className="text-gray-400">Run geocoding backfill or add addresses to recipients.</span>
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No recipients within 15 miles of this event.
                    </div>
                  )}
                </div>

                {/* Nearby Speakers */}
                <div data-testid="driver-planning-nearby-speakers">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-indigo-600" />
                      Nearby Speakers
                    </h3>
                    <span className="text-[9px] text-gray-400 italic" title="Click to preview driving route">click for driving distance</span>
                  </div>
                  {nearbySpeakers.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllSpeakers ? nearbySpeakers : nearbySpeakers.slice(0, 3)).map((speaker) => (
                        <div
                          key={`speaker-${speaker.id}`}
                          className={`flex items-stretch text-xs border rounded transition-colors ${
                            focusedItem?.type === 'speaker' && focusedItem?.id === speaker.id
                              ? 'bg-indigo-100 border-indigo-400'
                              : speaker.isAssigned
                                ? 'bg-indigo-100 border-indigo-300 hover:bg-indigo-200'
                                : 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick({
                                type: 'speaker',
                                id: speaker.id,
                                latitude: speaker.latitude,
                                longitude: speaker.longitude,
                                name: speaker.name
                              });
                            }}
                            className="flex-1 text-left p-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Megaphone className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="font-medium">{speaker.name}</span>
                                {speaker.isAssigned && (
                                  <span className="text-[9px] bg-indigo-200 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Assigned
                                  </span>
                                )}
                              </div>
                              <span className="text-indigo-700">{speaker.distance.toFixed(1)} mi</span>
                            </div>
                            {speaker.phone && (
                              <div className="text-gray-500 pl-5 mt-0.5 text-[10px] flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {speaker.phone}
                              </div>
                            )}
                          </button>
                        </div>
                      ))}
                      {nearbySpeakers.length > 3 && (
                        <button
                          onClick={() => setShowAllSpeakers(!showAllSpeakers)}
                          className="w-full text-xs text-indigo-700 hover:text-indigo-900 font-medium py-1"
                        >
                          {showAllSpeakers ? 'Show less' : `View ${nearbySpeakers.length - 3} more speakers`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-gray-100 rounded text-gray-500 text-center">
                      No speakers with map coordinates nearby.
                    </div>
                  )}
                </div>

                {/* Driver Search */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Find a driver</div>
                  <Input
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    placeholder="Search drivers by name or location..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Assigned Drivers - Show first if any */}
                {assignedDrivers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Assigned Driver{assignedDrivers.length > 1 ? 's' : ''}
                    </h3>
                    {assignedDrivers.map((driver) => (
                      <Card
                        key={`assigned-${driver.id}`}
                        className={`p-3 transition-colors border-green-200 bg-green-50 ${
                          selectedDriver?.id === driver.id
                            ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/10'
                            : focusedItem?.type === 'driver' && focusedItem?.id === driver.id
                              ? 'ring-2 ring-orange-400 bg-orange-50'
                              : 'hover:bg-green-100 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDrivingRoute(null);
                              setFocusedItem(null);
                              const isCurrentlySelected = selectedDriver && String(selectedDriver.id) === String(driver.id);
                              if (isCurrentlySelected) {
                                setSelectedDriver(null);
                              } else {
                                setSelectedDriver({
                                  id: String(driver.id),
                                  name: driver.name,
                                  latitude: driver.latitude,
                                  longitude: driver.longitude,
                                });
                              }
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                              selectedDriver && String(selectedDriver.id) === String(driver.id)
                                ? 'bg-[#007E8C] text-white'
                                : 'bg-green-600 text-white hover:bg-[#007E8C]'
                            }`}
                            title={selectedDriver && String(selectedDriver.id) === String(driver.id) ? 'Unselect driver' : 'Select driver for trip'}
                          >
                            {selectedDriver && String(selectedDriver.id) === String(driver.id) ? (
                              <>
                                <X className="w-3 h-3" />
                                Selected
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Select Driver
                              </>
                            )}
                          </button>
                          <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                            Assigned
                          </span>
                        </div>
                        <button
                          className="w-full text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick({
                              type: 'driver',
                              id: driver.id,
                              latitude: driver.latitude,
                              longitude: driver.longitude,
                              name: driver.name
                            });
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm">{driver.name}</h4>
                              {driver.hostLocation && (
                                <p className="text-xs text-gray-500">{driver.hostLocation}</p>
                              )}
                              {driver.phone && (
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                  <Phone className="w-3 h-3" />
                                  {driver.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Suggested Drivers - Other nearby options */}
                {((driverSearchResults && driverSearchResults.length > 0) || nearbyDrivers.length > 0) && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      {driverSearchResults
                        ? `Search results (${driverSearchResults.length})`
                        : assignedDrivers.length > 0
                          ? 'Other nearby drivers'
                          : 'Closest drivers'}
                      {selectedEvent?.vanDriverNeeded && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Van Approved Only</span>
                      )}
                    </h3>
                    {(showAllNearbyDrivers ? (driverSearchResults || nearbyDrivers) : (driverSearchResults || nearbyDrivers).slice(0, 5)).map(({ driver, distance }) => (
                      <Card
                        key={driver.id}
                        className={`p-3 transition-colors ${
                          selectedDriver?.id === driver.id
                            ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/10'
                            : focusedItem?.type === 'driver' && focusedItem?.id === driver.id
                              ? 'ring-2 ring-orange-400 bg-orange-50'
                              : 'hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        {/* Select button for driver */}
                        <div className="flex items-start gap-2 mb-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              // Clear preview route when making a selection
                              setDrivingRoute(null);
                              setFocusedItem(null);
                              // Use String() for consistent comparison
                              const isCurrentlySelected = selectedDriver && String(selectedDriver.id) === String(driver.id);
                              if (isCurrentlySelected) {
                                setSelectedDriver(null);
                              } else {
                                setSelectedDriver({
                                  id: String(driver.id),
                                  name: driver.name,
                                  latitude: driver.latitude,
                                  longitude: driver.longitude,
                                });
                              }
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                              selectedDriver && String(selectedDriver.id) === String(driver.id)
                                ? 'bg-[#007E8C] text-white'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-[#007E8C] hover:text-white'
                            }`}
                            title={selectedDriver && String(selectedDriver.id) === String(driver.id) ? 'Unselect driver' : 'Select driver for trip'}
                          >
                            {selectedDriver && String(selectedDriver.id) === String(driver.id) ? (
                              <>
                                <X className="w-3 h-3" />
                                Selected
                              </>
                            ) : (
                              <>
                                <Check className="w-3 h-3" />
                                Select Driver
                              </>
                            )}
                          </button>
                        </div>
                        <button
                          className="w-full text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleItemClick({
                              type: 'driver',
                              id: driver.id,
                              latitude: driver.latitude,
                              longitude: driver.longitude,
                              name: driver.name
                            });
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium text-sm flex items-center gap-1.5">
                                {driver.name}
                                {assignedDrivers.some(d => d.id === driver.id) && (
                                  <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                    Assigned
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {driver.hostLocation || driver.area || driver.routeDescription || extractCityFromAddress(driver.homeAddress) || 'No location'}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-1">{distance.toFixed(1)} miles away</p>
                            </div>
                            <Badge
                              variant={driver.source === 'driver' ? 'default' : driver.source === 'host' ? 'outline' : 'secondary'}
                              className="text-xs"
                            >
                              {driver.source === 'driver' ? 'Driver' : driver.source === 'host' ? 'Host' : 'Volunteer'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                            {driver.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {driver.phone}
                              </span>
                            )}
                            {driver.vehicleType && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                {driver.vehicleType}
                                {driver.vanApproved && ' (Van OK)'}
                              </span>
                            )}
                          </div>
                        </button>
                        {selectedEvent && (
                          <div className="flex gap-1 mt-3">
                            {/* Tentative assignment button */}
                            <Button
                              size="sm"
                              variant={selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'default' : 'outline'}
                              className="flex-1 text-xs"
                              disabled={assigningDriverId === driver.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: getDriverIds(selectedEvent),
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: true,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <span className="mr-1 font-bold">?</span>
                              )}
                              {selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'Tentative' : 'Maybe'}
                            </Button>
                            {/* Confirmed assignment button */}
                            <Button
                              size="sm"
                              className="flex-1 text-xs"
                              disabled={assigningDriverId === driver.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: getDriverIds(selectedEvent),
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: false,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              {hasDriver(selectedEvent, String(driver.id)) ? 'Confirmed' : 'Confirm'}
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}
                    {(driverSearchResults || nearbyDrivers).length > 5 && (
                      <button
                        onClick={() => setShowAllNearbyDrivers(!showAllNearbyDrivers)}
                        className="w-full text-xs text-purple-700 hover:text-purple-900 font-medium py-1"
                      >
                        {showAllNearbyDrivers
                          ? 'Show top 5'
                          : `View ${(driverSearchResults || nearbyDrivers).length - 5} more drivers`}
                      </button>
                    )}
                  </div>
                )}


                {/* Drivers needing geocoding (have address but no coordinates) */}
                {driversNeedingGeocoding.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {driversNeedingGeocoding.length} drivers need geocoding
                      </h4>
                      <p className="text-xs text-blue-700 mt-1">
                        These drivers have addresses but haven't been geocoded yet. Run batch geocode in Driver Management.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs p-0 h-auto mt-2 text-blue-800"
                        onClick={() => window.location.href = '/dashboard?section=drivers'}
                      >
                        Go to Driver Management →
                      </Button>
                    </div>
                  </div>
                )}

                {/* Drivers needing location data */}
                {driversWithoutLocation.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {driversWithoutLocation.length} drivers need location data
                      </h4>
                      <p className="text-xs text-amber-700 mt-1">
                        Add area/location info to these drivers to see them in suggestions.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs p-0 h-auto mt-2 text-amber-800"
                        onClick={() => window.location.href = '/dashboard?section=drivers'}
                      >
                        Go to Driver Management →
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </ScrollArea>
        </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Main Content - Tablet 2-Panel Layout (md to lg) */}
      <div className="flex-1 hidden md:flex lg:hidden overflow-hidden">
        {/* Left Panel - Event List */}
        <div className="w-72 border-r bg-gray-50 flex flex-col" data-testid="driver-planning-events-list-tablet">
          <div className="p-3 border-b bg-white space-y-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-[#007E8C]" />
              Events ({events.length}{showOnlyUnmetStaffing ? ` of ${upcomingEvents.length}` : ''})
            </h2>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyUnmetStaffing}
                onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
              />
              <span className="text-gray-600">Needing drivers only</span>
            </label>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {events.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                const eventDate = event.scheduledEventDate || event.desiredEventDate;
                const driversAssigned = getDriverCount(event);
                const driversTentative = event.tentativeDriverIds?.length || 0;
                const driversNeeded = event.driversNeeded || 0;
                // Has driver requirement if: driversNeeded > 0, or vanDriverNeeded, or drivers are already assigned
                const hasDriverRequirement = driversNeeded > 0 || event.vanDriverNeeded || driversAssigned > 0 || !!event.assignedVanDriverId;
                const driversFulfilled =
                  getTotalDriverCount(event) >= driversNeeded &&
                  (!event.vanDriverNeeded || !!event.assignedVanDriverId || !!event.isDhlVan);

                return (
                  <Card
                    key={event.id}
                    className={`p-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-[#007E8C] bg-[#007E8C]/5'
                        : 'hover:shadow-md hover:bg-white'
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedEvent(null);
                      } else {
                        handleSelectEvent(event);
                      }
                      setShowAllHosts(false);
                      setShowAllRecipients(false);
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-xs text-gray-900 line-clamp-1">
                          {event.organizationName || 'Unknown'}
                        </h3>
                        {(() => {
                          const status = (event.status || '').toLowerCase();
                          if (status === 'new') return (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 text-amber-700 bg-amber-50 flex-shrink-0">New</Badge>
                          );
                          if (status === 'in_process') return (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400 text-blue-700 bg-blue-50 flex-shrink-0">In Process</Badge>
                          );
                          return null;
                        })()}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {eventDate ? format(parseLocalDate(eventDate), 'MMM d') : 'No date'}
                      </div>
                      {event.selfTransport ? (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Self
                        </Badge>
                      ) : hasDriverRequirement ? (
                        (() => {
                          const vanDriverAssigned = (event.assignedVanDriverId ? 1 : 0) + (event.isDhlVan ? 1 : 0);
                          const totalAssigned = driversAssigned + vanDriverAssigned;
                          const totalNeeded = event.vanDriverNeeded ? driversNeeded + 1 : driversNeeded;
                          const isFulfilled = totalAssigned >= totalNeeded;
                          return (
                            <Badge
                              variant={isFulfilled ? 'default' : 'destructive'}
                              className="text-[10px] px-1 py-0"
                            >
                              {totalAssigned}{driversTentative > 0 && <span className="text-amber-300">+{driversTentative}?</span>}/{totalNeeded}
                              {event.vanDriverNeeded && (event.isDhlVan ? '+DHL' : (event.assignedVanDriverId ? '+Van' : '!'))}
                            </Badge>
                          );
                        })()
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-400">
                          No req
                        </Badge>
                      )}
                      {isSelected && (
                        <div className="pt-2 border-t border-gray-100 space-y-1">
                          {getTspContactLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">TSP Contact:</span>{' '}
                              <span className="text-gray-600">{getTspContactLabel(event)}</span>
                            </div>
                          )}
                          {getAssignedDriversLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">Assigned drivers:</span>{' '}
                              <span className="text-gray-600">{getAssignedDriversLabel(event)}</span>
                            </div>
                          )}
                          {getDesignatedRecipientLabel(event) && (
                            <div className="text-[11px] text-gray-700">
                              <span className="font-semibold">Recipient:</span>{' '}
                              <span className="text-gray-600">{getDesignatedRecipientLabel(event)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              {events.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">
                    {showOnlyUnmetStaffing && upcomingEvents.length > 0
                      ? 'All staffed!'
                      : 'No events'}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Map + Details overlay */}
        <div className="flex-1 relative" data-testid="driver-planning-map-tablet">
          <MapContainer
            center={mapCenter}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
            <MapController
              selectedEvent={effectiveSelectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
              drivingRoute={drivingRoute}
              fullTripRoute={fullTripRoute}
            />
            <MapResizeObserver />
            {/* Only show permanent labels for selected event; others show labels on hover */}
            {eventsToShowOnMap.map((event) => {
              const eventDate = event.scheduledEventDate || event.desiredEventDate;
              const formattedDate = eventDate ? format(parseLocalDate(eventDate), 'M/d') : '';
              const isSelected = selectedEvent?.id === event.id;
              return (
                <Marker
                  key={event.id}
                  position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                  icon={isSelected ? selectedEventIcon : eventIcon}
                  eventHandlers={{
                    click: () => handleSelectEvent(event)
                  }}
                >
                  <Tooltip
                    permanent={isSelected}
                    direction="top"
                    offset={[0, -35]}
                    className={isSelected
                      ? "!bg-[#007E8C] !border-[#007E8C] !text-white !text-[11px] !font-semibold !px-2 !py-1 !rounded !shadow-md"
                      : "!bg-white !border-gray-300 !text-gray-800 !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                    }
                  >
                    <span className="truncate max-w-[120px] block">
                      {event.organizationName || 'Event'}{formattedDate ? ` · ${formattedDate}` : ''}
                    </span>
                  </Tooltip>
                  <Popup>
                    <div className="p-2 min-w-[180px]">
                      <h3 className="font-semibold text-sm">{event.organizationName}</h3>
                      <p className="text-xs text-gray-600">{event.eventAddress}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {/* Custom location marker (tablet view) */}
            {customLocation && (
              <Marker
                key="custom-location-tablet"
                position={[parseFloat(customLocation.latitude), parseFloat(customLocation.longitude)]}
                icon={customLocationIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -35]}
                  className="!bg-orange-600/90 !border-orange-600 !text-white !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                >
                  {customLocation.address}
                </Tooltip>
              </Marker>
            )}
            {effectiveSelectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-green-50 !border-green-300 !text-green-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {host.contactName || host.hostLocationName}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700 text-sm">{host.contactName}</h3>
                    <p className="text-xs text-gray-500">{host.distance.toFixed(1)} mi away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {effectiveSelectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Assigned Recipient</div>
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                  </div>
                </Popup>
              </Marker>
            ))}

            {selectedEvent && allNonDesignatedRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                    <p className="text-xs text-gray-500">{recipient.distance.toFixed(1)} mi away</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* Selected driver marker - show on map when a driver is selected for trip planning */}
            {selectedDriver && selectedDriver.latitude && selectedDriver.longitude && (
              <Marker
                key={`selected-driver-${selectedDriver.id}`}
                position={[parseFloat(selectedDriver.latitude), parseFloat(selectedDriver.longitude)]}
                icon={driverIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-yellow-100 !border-yellow-400 !text-yellow-900 !text-xs !font-semibold !px-2 !py-1 !rounded !shadow-md"
                >
                  {selectedDriver.name} (Selected)
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-yellow-700 text-sm flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {selectedDriver.name}
                    </h3>
                    <p className="text-xs text-green-600 mt-1">Selected for trip planning</p>
                  </div>
                </Popup>
              </Marker>
            )}
            {/* Show driver candidates with geocoded coordinates (drivers + volunteers, not hosts) */}
            {/* Hosts show as green circles via nearbyHosts */}
            {driverCandidates
              .filter((driver) => driver.latitude && driver.longitude && (driver.source === 'driver' || driver.source === 'volunteer'))
              .map((driver) => (
              <Marker
                key={`driver-${driver.id}`}
                position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]}
                icon={driverIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-yellow-50 !border-yellow-300 !text-yellow-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {driver.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-yellow-700 text-sm flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      {driver.name} <span className="text-gray-400 text-[11px]">({driver.source})</span>
                    </h3>
                    <p className="text-xs text-gray-600">
                      {driver.hostLocation || 'Driver location'}
                    </p>
                    {driver.phone && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {driver.phone}
                      </p>
                    )}
                    {driver.vanApproved && (
                      <p className="text-xs text-green-600 mt-1">Van Approved</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            {/* Show volunteers/speakers assigned to visible events when toggle is on */}
            {showVolunteersSpeakers && volunteersWithLocations.map((volunteer) => (
              <Marker
                key={`volunteer-${volunteer.id}`}
                position={[parseFloat(volunteer.latitude!), parseFloat(volunteer.longitude!)]}
                icon={volunteerIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {volunteer.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-purple-700 text-sm flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      {volunteer.name}
                      {volunteer.isSpeaker && <span className="text-purple-400 text-[11px]">(Speaker)</span>}
                    </h3>
                    {volunteer.homeAddress && (
                      <p className="text-xs text-gray-600">{volunteer.homeAddress}</p>
                    )}
                    {volunteer.phone && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {volunteer.phone}
                      </p>
                    )}
                    {volunteer.assignedEvents.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-purple-200">
                        <p className="text-xs text-purple-600 font-medium">Assigned to:</p>
                        <ul className="text-xs text-gray-600 mt-1">
                          {volunteer.assignedEvents.map((evt, i) => (
                            <li key={i} className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: evt.role === 'speaker' ? colors.volunteer : '#a78bfa' }} />
                              {evt.eventName} ({evt.role})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Show team members with addresses on map when toggle is on */}
            {showTeamMembers && teamMembersForMap.map((member) => (
              <Marker
                key={`team-member-${member.id}`}
                position={[parseFloat(member.latitude), parseFloat(member.longitude)]}
                icon={teamMemberIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-red-50 !border-red-300 !text-red-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {member.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-red-700 text-sm flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {member.name}
                      <span className="text-red-400 text-[11px]">({member.role})</span>
                    </h3>
                    {member.address && (
                      <p className="text-xs text-gray-600">{member.address}</p>
                    )}
                    {member.phoneNumber && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {member.phoneNumber}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Tablet Details Panel - Bottom overlay when event selected */}
          {selectedEvent && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t shadow-lg max-h-[40%] overflow-y-auto z-[1000]">
              <div className="p-3 border-b sticky top-0 bg-white flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedEvent.organizationName}</h3>
                  <p className="text-xs text-gray-500">{extractCityFromAddress(selectedEvent.eventAddress)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedEvent(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-3 space-y-3">
                {/* Nearby Hosts */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-green-600" />
                    Nearby Hosts ({nearbyHosts.length})
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {nearbyHosts.slice(0, 5).map((host) => (
                      <div key={host.id} className="flex-shrink-0 text-xs p-2 bg-green-50 border border-green-200 rounded min-w-[120px]">
                        <div className="font-medium">{host.contactName}</div>
                        <div className="text-green-700">{host.distance.toFixed(1)} mi</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Nearby Recipients */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-purple-600" />
                    Nearby Recipients ({nearbyRecipients.length}{allRecipientsWithDistance.length > nearbyRecipients.length ? ` of ${allRecipientsWithDistance.length}` : ''})
                  </h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {nearbyRecipients.slice(0, 5).map((recipient) => (
                      <div key={recipient.id} className="flex-shrink-0 text-xs p-2 bg-purple-50 border border-purple-200 rounded min-w-[120px]">
                        <div className="font-medium">{recipient.name}</div>
                        <div className="text-purple-700">{recipient.distance.toFixed(1)} mi</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Suggested Drivers */}
                {suggestedDrivers.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-[#007E8C]" />
                      Suggested Drivers ({suggestedDrivers.length})
                    </h4>
                    <div className="space-y-2">
                      {suggestedDrivers.slice(0, 3).map((driver) => (
                        <div key={driver.id} className="text-xs p-2 bg-gray-50 border rounded flex items-center justify-between">
                          <div>
                            <div className="font-medium">{driver.name}</div>
                            <div className="text-gray-500">{driver.phone}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => copyDriverSMS(driver)}
                          >
                            {copiedDriverId === driver.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Mobile Layout (< md) */}
      <div className="flex-1 md:hidden flex flex-col" data-testid="driver-planning-mobile">
        {/* Map - Expands to full screen when mobileFullscreenMap is true */}
        <div
          className={`relative transition-all duration-300 ${
            mobileFullscreenMap
              ? 'h-[calc(100dvh-60px)]'
              : mobileEventsCollapsed
                ? 'h-[calc(100dvh-120px)]'
                : 'h-[55dvh] min-h-[280px]'
          }`}
        >
          <MapContainer
            center={mapCenter}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
            />
            <MapController
              selectedEvent={effectiveSelectedEvent}
              events={upcomingEventsWithCoords}
              focusedItem={focusedItem}
              nearbyHosts={nearbyHosts}
              nearbyRecipients={nearbyRecipients}
              designatedRecipients={designatedRecipients}
              drivingRoute={drivingRoute}
              fullTripRoute={fullTripRoute}
            />
            <MapResizeObserver />
            {/* Only show permanent labels for selected event; others show labels on hover */}
            {eventsToShowOnMap.map((event) => {
              const eventDate = event.scheduledEventDate || event.desiredEventDate;
              const formattedDate = eventDate ? format(parseLocalDate(eventDate), 'M/d') : '';
              const isSelected = selectedEvent?.id === event.id;
              return (
                <Marker
                  key={event.id}
                  position={[parseFloat(event.latitude!), parseFloat(event.longitude!)]}
                  icon={isSelected ? selectedEventIcon : eventIcon}
                  eventHandlers={{
                    click: () => {
                      handleSelectEvent(event);
                      // Expand events list to show details (don't use Sheet overlay)
                      setMobileEventsCollapsed(false);
                      setMobileFullscreenMap(false);
                    }
                  }}
                >
                  <Tooltip
                    permanent={isSelected}
                    direction="top"
                    offset={[0, -35]}
                    className={isSelected
                      ? "!bg-[#007E8C] !border-[#007E8C] !text-white !text-[11px] !font-semibold !px-2 !py-1 !rounded !shadow-md"
                      : "!bg-white !border-gray-300 !text-gray-800 !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                    }
                  >
                    <span className="truncate max-w-[100px] block">
                      {event.organizationName || 'Event'}{formattedDate ? ` · ${formattedDate}` : ''}
                    </span>
                  </Tooltip>
                  <Popup>
                    <div className="p-2">
                      <h3 className="font-semibold text-sm">{event.organizationName}</h3>
                      <p className="text-xs text-gray-600">{event.eventAddress}</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {/* Custom location marker (mobile view) */}
            {customLocation && (
              <Marker
                key="custom-location-mobile"
                position={[parseFloat(customLocation.latitude), parseFloat(customLocation.longitude)]}
                icon={customLocationIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -35]}
                  className="!bg-orange-600/90 !border-orange-600 !text-white !text-[10px] !font-medium !px-1.5 !py-0.5 !rounded !shadow-sm"
                >
                  {customLocation.address}
                </Tooltip>
              </Marker>
            )}
            {effectiveSelectedEvent && nearbyHosts.map((host) => (
              <Marker
                key={`host-${host.id}`}
                position={[parseFloat(host.latitude), parseFloat(host.longitude)]}
                icon={focusedItem?.type === 'host' && focusedItem?.id === host.id ? hostFocusedIcon : hostIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-green-50 !border-green-300 !text-green-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {host.contactName || host.hostLocationName}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-green-700 text-sm">{host.contactName}</h3>
                    <p className="text-xs">{host.distance.toFixed(1)} mi</p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {effectiveSelectedEvent && designatedRecipients.map((recipient) => (
              <Marker
                key={`designated-recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <div className="text-[10px] font-semibold text-purple-700 uppercase tracking-wide">Assigned Recipient</div>
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                  </div>
                </Popup>
              </Marker>
            ))}

            {selectedEvent && allNonDesignatedRecipients.map((recipient) => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude), parseFloat(recipient.longitude)]}
                icon={focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id ? recipientFocusedIcon : recipientIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {recipient.name}
                </Tooltip>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold text-purple-700 text-sm">{recipient.name}</h3>
                    <p className="text-xs">{recipient.distance.toFixed(1)} mi</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Selected driver marker - show on mobile map when a driver is selected */}
            {selectedDriver && selectedDriver.latitude && selectedDriver.longitude && (
              <Marker
                key={`selected-driver-${selectedDriver.id}`}
                position={[parseFloat(selectedDriver.latitude), parseFloat(selectedDriver.longitude)]}
                icon={driverIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-yellow-100 !border-yellow-400 !text-yellow-900 !text-xs !font-semibold !px-2 !py-1 !rounded !shadow-md"
                >
                  {selectedDriver.name} (Selected)
                </Tooltip>
              </Marker>
            )}

            {/* Show volunteers/speakers assigned to visible events when toggle is on */}
            {showVolunteersSpeakers && volunteersWithLocations.map((volunteer) => (
              <Marker
                key={`volunteer-${volunteer.id}`}
                position={[parseFloat(volunteer.latitude!), parseFloat(volunteer.longitude!)]}
                icon={volunteerIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-purple-50 !border-purple-300 !text-purple-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {volunteer.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <h3 className="font-semibold text-purple-700 text-sm flex items-center gap-1">
                      <Megaphone className="w-3 h-3" />
                      {volunteer.name}
                    </h3>
                    {volunteer.assignedEvents.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {volunteer.assignedEvents.map(e => e.eventName).join(', ')}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Show team members with addresses on map when toggle is on */}
            {showTeamMembers && teamMembersForMap.map((member) => (
              <Marker
                key={`team-member-${member.id}`}
                position={[parseFloat(member.latitude), parseFloat(member.longitude)]}
                icon={teamMemberIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  className="!bg-red-50 !border-red-300 !text-red-800 !text-xs !font-medium !px-2 !py-1 !rounded !shadow-sm"
                >
                  {member.name}
                </Tooltip>
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-red-700 text-sm flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {member.name}
                      <span className="text-red-400 text-[11px]">({member.role})</span>
                    </h3>
                    {member.address && (
                      <p className="text-xs text-gray-600">{member.address}</p>
                    )}
                    {member.phoneNumber && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {member.phoneNumber}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Mobile Map Controls - Top Right */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 z-[1000]">
            {/* Fullscreen Toggle Button */}
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 bg-white shadow-lg border"
              onClick={() => {
                setMobileFullscreenMap(!mobileFullscreenMap);
                if (!mobileFullscreenMap) {
                  setMobileEventsCollapsed(true);
                }
              }}
              data-testid="btn-toggle-fullscreen-map"
            >
              {mobileFullscreenMap ? (
                <Minimize2 className="w-5 h-5 text-gray-700" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-700" />
              )}
            </Button>
            
            {/* Show Events List Button - only visible in fullscreen mode */}
            {mobileFullscreenMap && (
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 bg-white shadow-lg border"
                onClick={() => {
                  setMobileFullscreenMap(false);
                  setMobileEventsCollapsed(false);
                }}
                data-testid="btn-show-events-list"
              >
                <List className="w-5 h-5 text-gray-700" />
              </Button>
            )}
          </div>

          {/* Mobile Legend - repositioned */}
          <div className="absolute top-3 left-3 bg-white rounded-lg shadow-lg p-2 z-[1000]">
            <div className="text-[10px] font-semibold mb-1">Legend</div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex items-center gap-1">
                <svg viewBox="0 0 12 18" className="w-2 h-3" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" fill="#3388ff" stroke="white" strokeWidth="0.5"/>
                </svg>
                <span>Event (pin)</span>
              </div>
              <div className="flex items-center gap-1">
                <svg viewBox="0 0 12 18" className="w-2 h-3" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 0C2.7 0 0 2.7 0 6c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" fill="#ff0000" stroke="white" strokeWidth="0.5"/>
                </svg>
                <span>Selected Event</span>
              </div>
              {selectedEvent && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 border border-white" />
                    <span>Host (circle)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-purple-500 border border-white rotate-45" style={{ borderRadius: '1px' }} />
                    <span>Recipient (diamond)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[7px] border-b-yellow-400" />
                    <span>Driver (triangle)</span>
                  </div>
                  <div className="flex items-center gap-1 pt-0.5 border-t border-gray-200 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-orange-500 border border-white" />
                    <span>Selected = orange</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Selected Event Quick Info - Bottom of map in fullscreen mode */}
          {mobileFullscreenMap && selectedEvent && (
            <div className="absolute bottom-4 left-3 right-3 bg-white rounded-lg shadow-lg p-3 z-[1000]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{selectedEvent.organizationName}</h4>
                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate
                        ? format(parseLocalDate(selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate!), 'EEE, MMM d')
                        : 'No date'}
                    </span>
                    {(() => {
                      const totalDrivers = getTotalDriverCount(selectedEvent);
                      const needed = selectedEvent.driversNeeded || 0;
                      const fulfilled = totalDrivers >= needed;
                      const tentative = selectedEvent.tentativeDriverIds?.length || 0;

                      if (selectedEvent.selfTransport) {
                        return <Badge variant="secondary" className="text-[10px] px-1.5">Self</Badge>;
                      }
                      if (needed > 0) {
                        return (
                          <Badge
                            variant={fulfilled ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5"
                          >
                            {totalDrivers}{tentative > 0 && <span className="text-amber-300">+{tentative}?</span>}/{needed}
                            {selectedEvent.isDhlVan
                              ? ' DHL'
                              : selectedEvent.assignedVanDriverId
                                ? ' van'
                                : ''}
                          </Badge>
                        );
                      }
                      return <Badge variant="outline" className="text-[10px] px-1.5 text-gray-400">No req</Badge>;
                    })()}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-9 px-3"
                  onClick={() => {
                    // Exit fullscreen and show event details inline
                    setMobileFullscreenMap(false);
                    setMobileEventsCollapsed(false);
                  }}
                  data-testid="btn-view-event-details"
                >
                  Details
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Events List - Hidden in fullscreen mode */}
        {!mobileFullscreenMap && (
          <div className={`bg-white border-t flex flex-col transition-all duration-300 ${
            mobileEventsCollapsed ? 'h-14' : 'flex-1 min-h-[280px]'
          }`}>
            {/* Collapsible Header */}
            <button
              className="p-3 border-b flex items-center justify-between w-full text-left"
              onClick={() => setMobileEventsCollapsed(!mobileEventsCollapsed)}
              data-testid="btn-toggle-events-panel"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {effectiveSelectedEvent ? (
                  <>
                    <Users className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <span className="font-semibold text-sm truncate">
                      {mobileEventsCollapsed
                        ? (effectiveSelectedEvent.organizationName?.substring(0, 20) || 'Location Details') + '...'
                        : (customLocation ? 'Location Details' : 'Event Details')
                      }
                    </span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5 text-[#007E8C] flex-shrink-0" />
                    <span className="font-semibold text-sm">Events ({events.length}{showOnlyUnmetStaffing ? `/${upcomingEvents.length}` : ''})</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!mobileEventsCollapsed && !effectiveSelectedEvent && (
                  <Select value={weeksAhead} onValueChange={setWeeksAhead}>
                    <SelectTrigger className="w-28 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All upcoming</SelectItem>
                      <SelectItem value="1">Next week</SelectItem>
                      <SelectItem value="2">Next 2 weeks</SelectItem>
                      <SelectItem value="4">Next month</SelectItem>
                      <SelectItem value="8">Next 2 months</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {mobileEventsCollapsed ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Filter Toggles - Only show when viewing events list (not event details) */}
            {!mobileEventsCollapsed && !effectiveSelectedEvent && (
              <div className="px-3 py-2 border-b bg-gray-50 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyUnmetStaffing}
                    onChange={(e) => setShowOnlyUnmetStaffing(e.target.checked)}
                    className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
                  />
                  <span className="text-gray-600">Only show events needing drivers</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPendingEvents}
                    onChange={(e) => setShowPendingEvents(e.target.checked)}
                    className="rounded border-gray-300 text-[#007E8C] focus:ring-[#007E8C]"
                  />
                  <span className="text-gray-600">Include pending/new requests</span>
                </label>
              </div>
            )}

            {/* Mobile Content Area - Either Events List OR Event Details */}
            {!mobileEventsCollapsed && (
              <ScrollArea className="flex-1">
                {/* Event Details View - When an event or custom location is selected */}
                {effectiveSelectedEvent ? (
                  <div className="p-3 space-y-4">
                    {/* Back Button & Header */}
                    <div className="flex items-center gap-3 pb-2 border-b">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-2"
                        onClick={() => {
                          setSelectedEvent(null);
                          setCustomLocation(null);
                          setShowAllHosts(false);
                          setShowAllRecipients(false);
                        }}
                      >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Events
                      </Button>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-gray-900 break-words">
                          {effectiveSelectedEvent.organizationName || (customLocation ? 'Custom Location' : 'Unknown Organization')}
                        </h3>
                      </div>
                      {canEditEvents && selectedEvent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 flex-shrink-0"
                          onClick={openEditDialog}
                          aria-label="Edit event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Event Info - Only show for real events, not custom locations */}
                    {selectedEvent && (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span>
                          {selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate
                            ? format(parseLocalDate(selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate!), 'EEEE, MMMM d, yyyy')
                            : 'No date'}
                        </span>
                      </div>
                      {selectedEvent.eventStartTime && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span>{formatTime12Hour(selectedEvent.eventStartTime)}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="break-words">{selectedEvent.eventAddress}</span>
                          {selectedEvent.eventAddress && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.eventAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[#007E8C] text-xs mt-1 underline"
                            >
                              Open in Google Maps
                            </a>
                          )}
                        </div>
                      </div>
                      {selectedEvent.estimatedSandwichCount && selectedEvent.estimatedSandwichCount > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <span className={selectedEvent.estimatedSandwichCount > 400 ? 'font-semibold' : ''} style={selectedEvent.estimatedSandwichCount > 400 ? { color: '#a31c41' } : undefined}>
                            ~{selectedEvent.estimatedSandwichCount} sandwiches
                            {selectedEvent.sandwichTypes && selectedEvent.sandwichTypes.length > 0 && (
                              <span className="text-gray-500 font-normal ml-1">
                                ({selectedEvent.sandwichTypes.map(t => `${t.quantity} ${t.type}`).join(', ')})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    )}

                    {/* Assignments - Only show for real events */}
                    {selectedEvent && (
                    <div className="bg-white rounded-lg border p-3 space-y-2">
                      <div className="text-sm font-semibold text-gray-700">Assignments</div>
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Staffing:</span>{' '}
                        Drivers {getTotalDriverCount(selectedEvent)}/{selectedEvent.driversNeeded || 0}
                        {(selectedEvent.speakersNeeded || 0) > 0 && ` • Speakers ${getSpeakerCount(selectedEvent)}/${selectedEvent.speakersNeeded || 0}`}
                        {(selectedEvent.volunteersNeeded || 0) > 0 && ` • Volunteers ${getVolunteerCount(selectedEvent)}/${selectedEvent.volunteersNeeded || 0}`}
                      </div>
                      {getTspContactLabel(selectedEvent) && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">TSP Contact:</span>{' '}
                          {getTspContactLabel(selectedEvent)}
                        </div>
                      )}
                      {getAssignedDriversLabel(selectedEvent) && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">Assigned drivers:</span>{' '}
                          {getAssignedDriversLabel(selectedEvent)}
                        </div>
                      )}
                      {selectedEvent.assignedVanDriverId && !selectedEvent.isDhlVan && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">Van driver:</span>{' '}
                          {(() => {
                            const vanDriverEvent: Parameters<typeof getAssignedDriversLabel>[0] = {
                              ...selectedEvent,
                              assignedDriverIds: [selectedEvent.assignedVanDriverId],
                            };
                            return getAssignedDriversLabel(vanDriverEvent);
                          })()}
                        </div>
                      )}
                      {getAssignedSpeakersLabel(selectedEvent) && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">Speakers:</span>{' '}
                          {getAssignedSpeakersLabel(selectedEvent)}
                        </div>
                      )}
                      {getAssignedVolunteersLabel(selectedEvent) && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">Volunteers:</span>{' '}
                          {getAssignedVolunteersLabel(selectedEvent)}
                        </div>
                      )}
                      {getDesignatedRecipientLabel(selectedEvent) && (
                        <div className="text-sm text-gray-700 break-words">
                          <span className="font-medium">Recipient:</span>{' '}
                          {getDesignatedRecipientLabel(selectedEvent)}
                        </div>
                      )}
                      {!getTspContactLabel(selectedEvent) &&
                        !getAssignedDriversLabel(selectedEvent) &&
                        !getAssignedSpeakersLabel(selectedEvent) &&
                        !getAssignedVolunteersLabel(selectedEvent) &&
                        !getDesignatedRecipientLabel(selectedEvent) &&
                        (!selectedEvent.assignedVanDriverId || selectedEvent.isDhlVan) && (
                        <div className="text-sm text-gray-500">No assignments yet.</div>
                      )}
                    </div>
                    )}

                    {/* Nearby Hosts */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-green-600" />
                        Nearby Hosts ({nearbyHosts.length})
                      </h3>
                      {nearbyHosts.length > 0 ? (
                        <div className="space-y-2">
                          {(showAllHosts ? nearbyHosts : nearbyHosts.slice(0, 3)).map((host) => (
                            <button
                              key={host.id}
                              onClick={() => {
                                handleItemClick({
                                  type: 'host',
                                  id: host.id,
                                  latitude: host.latitude,
                                  longitude: host.longitude,
                                  name: host.contactName || host.hostLocationName
                                });
                              }}
                              className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                                focusedItem?.type === 'host' && focusedItem?.id === host.id
                                  ? 'bg-green-100 border-green-400'
                                  : 'bg-green-50 border-green-200 hover:bg-green-100'
                              }`}
                              aria-label={`Focus on host ${host.contactName}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium break-words">{host.contactName}</span>
                                <span className="text-green-700 flex-shrink-0 ml-2">{host.distance.toFixed(1)} mi</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 break-words">{host.hostLocationName}</div>
                            </button>
                          ))}
                          {nearbyHosts.length > 3 && (
                            <button
                              onClick={() => setShowAllHosts(!showAllHosts)}
                              className="w-full text-sm text-green-700 font-medium py-2"
                              aria-label={showAllHosts ? 'Show fewer hosts' : `Show ${nearbyHosts.length - 3} more hosts`}
                            >
                              {showAllHosts ? 'Show less' : `View ${nearbyHosts.length - 3} more hosts`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby hosts found</p>
                      )}
                    </div>

                    {/* Nearby Recipients */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-purple-600" />
                        Nearby Recipients ({nearbyRecipients.length}{allRecipientsWithDistance.length > nearbyRecipients.length ? ` of ${allRecipientsWithDistance.length}` : ''})
                      </h3>
                      {nearbyRecipients.length > 0 ? (
                        <div className="space-y-2">
                          {(showAllRecipients ? nearbyRecipients : nearbyRecipients.slice(0, 3)).map((recipient) => (
                            <button
                              key={recipient.id}
                              onClick={() => {
                                handleItemClick({
                                  type: 'recipient',
                                  id: recipient.id,
                                  latitude: recipient.latitude,
                                  longitude: recipient.longitude,
                                  name: recipient.name
                                });
                              }}
                              className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                                focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                                  ? 'bg-purple-100 border-purple-400'
                                  : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                              }`}
                              aria-label={`Focus on recipient ${recipient.name}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium break-words">{recipient.name}</span>
                                <span className="text-purple-700 flex-shrink-0 ml-2">{recipient.distance.toFixed(1)} mi</span>
                              </div>
                              {recipient.estimatedSandwiches && (
                                <div className="text-xs text-gray-600 mt-1">
                                  Needs ~{recipient.estimatedSandwiches} sandwiches
                                </div>
                              )}
                            </button>
                          ))}
                          {nearbyRecipients.length > 3 && (
                            <button
                              onClick={() => setShowAllRecipients(!showAllRecipients)}
                              className="w-full text-sm text-purple-700 font-medium py-2"
                              aria-label={
                                showAllRecipients
                                  ? 'Show fewer recipients'
                                  : `Show ${nearbyRecipients.length - 3} more recipients`
                              }
                            >
                              {showAllRecipients ? 'Show less' : `View ${nearbyRecipients.length - 3} more recipients`}
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby recipients found</p>
                      )}
                    </div>

                    {/* Suggested Drivers */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-yellow-600" />
                        Suggested Drivers ({nearbyDrivers.length})
                      </h3>
                      {nearbyDrivers.length > 0 ? (
                        <div className="space-y-2">
                          {nearbyDrivers.slice(0, 5).map(({ driver, distance }) => (
                            <div
                              key={driver.id}
                              className="w-full text-left text-sm p-3 border rounded-lg bg-yellow-50 border-yellow-200"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium break-words">{driver.name}</span>
                                <span className="text-yellow-700 flex-shrink-0 ml-2">{distance.toFixed(1)} mi</span>
                              </div>
                              {/* Only show assignment buttons for real events, not custom locations */}
                              {selectedEvent && (
                              <div className="flex items-center gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant={selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'default' : 'outline'}
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    assignDriverMutation.mutate({
                                      eventId: selectedEvent.id,
                                      driverId: String(driver.id),
                                      currentAssigned: getDriverIds(selectedEvent),
                                      currentTentative: selectedEvent.tentativeDriverIds || [],
                                      tentative: true
                                    });
                                  }}
                                >
                                  {selectedEvent.tentativeDriverIds?.includes(String(driver.id)) ? 'Tentative' : 'Maybe'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={hasDriver(selectedEvent, String(driver.id)) ? 'default' : 'outline'}
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    assignDriverMutation.mutate({
                                      eventId: selectedEvent.id,
                                      driverId: String(driver.id),
                                      currentAssigned: getDriverIds(selectedEvent),
                                      currentTentative: selectedEvent.tentativeDriverIds || [],
                                      tentative: false
                                    });
                                  }}
                                >
                                  {hasDriver(selectedEvent, String(driver.id)) ? 'Confirmed' : 'Confirm'}
                                </Button>
                              </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby drivers found</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Events List View - When no event is selected */
                  <div className="p-3 space-y-2">
                    {events.map((event) => {
                      const eventDate = event.scheduledEventDate || event.desiredEventDate;
                      const driversAssigned = getDriverCount(event);
                      const driversTentative = event.tentativeDriverIds?.length || 0;
                      const driversNeeded = event.driversNeeded || 0;
                      const speakersNeeded = event.speakersNeeded || 0;
                      const speakersAssigned = getSpeakerCount(event);
                      const volunteersNeeded = event.volunteersNeeded || 0;
                      const volunteersAssigned = getVolunteerCount(event);
                      // Has driver requirement if: driversNeeded > 0, or vanDriverNeeded, or drivers are already assigned
                      const hasDriverRequirement = driversNeeded > 0 || event.vanDriverNeeded || driversAssigned > 0 || !!event.assignedVanDriverId;

                      return (
                        <Card
                          key={event.id}
                          className="p-3 cursor-pointer transition-all active:scale-[0.98] hover:shadow-md active:bg-gray-50"
                          onClick={() => {
                            handleSelectEvent(event);
                            setShowAllHosts(false);
                            setShowAllRecipients(false);
                          }}
                          data-testid={`event-card-${event.id}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <h3 className="font-medium text-sm text-gray-900 line-clamp-1">
                                  {event.organizationName || 'Unknown Organization'}
                                </h3>
                                {(() => {
                                  const status = (event.status || '').toLowerCase();
                                  if (status === 'new') return (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 bg-amber-50 flex-shrink-0">New</Badge>
                                  );
                                  if (status === 'in_process') return (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-400 text-blue-700 bg-blue-50 flex-shrink-0">In Process</Badge>
                                  );
                                  return null;
                                })()}
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-700">
                              <Calendar className="w-4 h-4 flex-shrink-0" />
                              <span className="font-medium">
                                {eventDate ? format(parseLocalDate(eventDate), 'EEE, MMM d') : 'No date'}
                              </span>
                              {event.eventStartTime && (
                                <span className="text-gray-500">
                                  at {formatTime12Hour(event.eventStartTime)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span className="line-clamp-1">{extractCityFromAddress(event.eventAddress) || event.eventAddress}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {event.selfTransport ? (
                                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                  Self-transport
                                </Badge>
                              ) : hasDriverRequirement ? (
                                (() => {
                                  // Calculate proper van driver counts
                                  const vanDriverAssigned = (event.assignedVanDriverId ? 1 : 0) + (event.isDhlVan ? 1 : 0);
                                  const totalAssigned = driversAssigned + vanDriverAssigned;
                                  const totalNeeded = event.vanDriverNeeded ? driversNeeded + 1 : driversNeeded;
                                  const isFulfilled = totalAssigned >= totalNeeded;
                                  
                                  return (
                                    <Badge
                                      variant={isFulfilled ? 'default' : 'destructive'}
                                      className="text-xs px-2 py-0.5"
                                    >
                                      <Truck className="w-3.5 h-3.5 mr-1" />
                                      {totalAssigned}/{totalNeeded} {event.vanDriverNeeded ? (driversNeeded > 0 ? 'drivers+van' : 'Van') : 'drivers'}
                                      {event.vanDriverNeeded && vanDriverAssigned === 0 && ' needed'}
                                      {event.isDhlVan && ' (DHL)'}
                                    </Badge>
                                  );
                                })()
                              ) : (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 text-gray-400">
                                  No driver requirement
                                </Badge>
                              )}
                              {/* Speakers - only show if needed > 0 */}
                              {speakersNeeded > 0 && (
                                <Badge
                                  variant={speakersAssigned < speakersNeeded ? 'destructive' : 'default'}
                                  className="text-xs px-2 py-0.5"
                                  title={getAssignedSpeakersLabel(event) ? `Speakers: ${getAssignedSpeakersLabel(event)}` : undefined}
                                >
                                  <Megaphone className="w-3.5 h-3.5 mr-1" />
                                  {`${speakersAssigned}/${speakersNeeded} spk`}
                                </Badge>
                              )}
                              {/* Volunteers - only show if needed > 0 */}
                              {volunteersNeeded > 0 && (
                                <Badge
                                  variant={volunteersAssigned < volunteersNeeded ? 'destructive' : 'default'}
                                  className="text-xs px-2 py-0.5"
                                  title={getAssignedVolunteersLabel(event) ? `Volunteers: ${getAssignedVolunteersLabel(event)}` : undefined}
                                >
                                  <Users className="w-3.5 h-3.5 mr-1" />
                                  {`${volunteersAssigned}/${volunteersNeeded} vol`}
                                </Badge>
                              )}
                              {event.estimatedSandwichCount && event.estimatedSandwichCount > 0 && (
                                <span className={`text-xs ${event.estimatedSandwichCount > 400 ? 'font-semibold' : 'text-gray-500'}`} style={event.estimatedSandwichCount > 400 ? { color: '#a31c41' } : undefined}>
                                  ~{event.estimatedSandwichCount} sandwiches
                                  {event.sandwichTypes && event.sandwichTypes.length > 0 && (
                                    <span className="text-gray-400 font-normal ml-1">
                                      ({event.sandwichTypes.map(t => `${t.quantity} ${t.type}`).join(', ')})
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    {events.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {showOnlyUnmetStaffing && upcomingEvents.length > 0
                            ? 'All events have drivers assigned!'
                            : 'No scheduled events in this period'}
                        </p>
                        {showOnlyUnmetStaffing && upcomingEvents.length > 0 && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => setShowOnlyUnmetStaffing(false)}
                            className="text-[#007E8C] mt-2"
                          >
                            Show all {upcomingEvents.length} events
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        )}
      </div>

      {/* Mobile Details Sheet */}
      <Sheet open={mobilePanel === 'details' && selectedEvent !== null} onOpenChange={(open) => setMobilePanel(open ? 'details' : null)}>
        <SheetContent side="bottom" className="h-[80vh] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#007E8C]" />
                <span className="truncate">{selectedEvent?.organizationName || 'Event Details'}</span>
              </div>
              {canEditEvents && selectedEvent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={openEditDialog}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(80vh-80px)]">
            {selectedEvent && (
              <div className="p-4 space-y-4">
                {/* Event Info */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span>
                      {selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate
                        ? format(parseLocalDate(selectedEvent.scheduledEventDate || selectedEvent.desiredEventDate!), 'EEEE, MMMM d, yyyy')
                        : 'No date'}
                    </span>
                  </div>
                  {selectedEvent.eventStartTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span>{formatTime12Hour(selectedEvent.eventStartTime)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span>{selectedEvent.eventAddress}</span>
                  </div>
                  {selectedEvent.estimatedSandwichCount && selectedEvent.estimatedSandwichCount > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-gray-500" />
                      <span className={selectedEvent.estimatedSandwichCount > 400 ? 'font-semibold' : ''} style={selectedEvent.estimatedSandwichCount > 400 ? { color: '#a31c41' } : undefined}>
                        ~{selectedEvent.estimatedSandwichCount} sandwiches
                        {selectedEvent.sandwichTypes && selectedEvent.sandwichTypes.length > 0 && (
                          <span className="text-gray-500 font-normal ml-1">
                            ({selectedEvent.sandwichTypes.map(t => `${t.quantity} ${t.type}`).join(', ')})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assignments */}
                <div className="bg-white rounded-lg border p-3 space-y-2">
                  <div className="text-sm font-semibold text-gray-700">Assignments</div>
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Staffing:</span>{' '}
                    Drivers {getTotalDriverCount(selectedEvent)}/{selectedEvent.driversNeeded || 0}
                    {(selectedEvent.speakersNeeded || 0) > 0 && ` • Speakers ${getSpeakerCount(selectedEvent)}/${selectedEvent.speakersNeeded || 0}`}
                    {(selectedEvent.volunteersNeeded || 0) > 0 && ` • Volunteers ${getVolunteerCount(selectedEvent)}/${selectedEvent.volunteersNeeded || 0}`}
                  </div>
                  {getTspContactLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">TSP Contact:</span>{' '}
                      {getTspContactLabel(selectedEvent)}
                    </div>
                  )}
                  {getAssignedDriversLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Assigned drivers:</span>{' '}
                      {getAssignedDriversLabel(selectedEvent)}
                    </div>
                  )}
                  {selectedEvent.assignedVanDriverId && !selectedEvent.isDhlVan && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Van driver:</span>{' '}
                      {(() => {
                        const vanDriverEvent: Parameters<typeof getAssignedDriversLabel>[0] = {
                          ...selectedEvent,
                          assignedDriverIds: [selectedEvent.assignedVanDriverId],
                        };
                        return getAssignedDriversLabel(vanDriverEvent);
                      })()}
                    </div>
                  )}
                  {getAssignedSpeakersLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Speakers:</span>{' '}
                      {getAssignedSpeakersLabel(selectedEvent)}
                    </div>
                  )}
                  {getAssignedVolunteersLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Volunteers:</span>{' '}
                      {getAssignedVolunteersLabel(selectedEvent)}
                    </div>
                  )}
                  {getDesignatedRecipientLabel(selectedEvent) && (
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Recipient:</span>{' '}
                      {getDesignatedRecipientLabel(selectedEvent)}
                    </div>
                  )}
                  {!getTspContactLabel(selectedEvent) &&
                    !getAssignedDriversLabel(selectedEvent) &&
                    !getAssignedSpeakersLabel(selectedEvent) &&
                    !getAssignedVolunteersLabel(selectedEvent) &&
                    !getDesignatedRecipientLabel(selectedEvent) && (
                    <div className="text-sm text-gray-500">No assignments yet.</div>
                  )}
                </div>

                {/* Nearby Hosts */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-green-600" />
                    Nearby Hosts ({nearbyHosts.length})
                  </h3>
                  {nearbyHosts.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllHosts ? nearbyHosts : nearbyHosts.slice(0, 3)).map((host) => (
                        <button
                          key={host.id}
                          onClick={() => {
                            handleItemClick({
                              type: 'host',
                              id: host.id,
                              latitude: host.latitude,
                              longitude: host.longitude,
                              name: host.contactName || host.hostLocationName
                            });
                            setMobilePanel(null);
                          }}
                          className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                            focusedItem?.type === 'host' && focusedItem?.id === host.id
                              ? 'bg-green-100 border-green-400'
                              : 'bg-green-50 border-green-200 hover:bg-green-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{host.contactName}</span>
                            <span className="text-green-700">{host.distance.toFixed(1)} mi</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{host.hostLocationName}</div>
                        </button>
                      ))}
                      {nearbyHosts.length > 3 && (
                        <button
                          onClick={() => setShowAllHosts(!showAllHosts)}
                          className="w-full text-sm text-green-700 font-medium py-2"
                        >
                          {showAllHosts ? 'Show less' : `View ${nearbyHosts.length - 3} more hosts`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby hosts found</p>
                  )}
                </div>

                {/* Nearby Recipients */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-purple-600" />
                    Nearby Recipients ({nearbyRecipients.length}{allRecipientsWithDistance.length > nearbyRecipients.length ? ` of ${allRecipientsWithDistance.length}` : ''})
                  </h3>
                  {nearbyRecipients.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllRecipients ? nearbyRecipients : nearbyRecipients.slice(0, 3)).map((recipient) => (
                        <button
                          key={recipient.id}
                          onClick={() => {
                            handleItemClick({
                              type: 'recipient',
                              id: recipient.id,
                              latitude: recipient.latitude,
                              longitude: recipient.longitude,
                              name: recipient.name
                            });
                            setMobilePanel(null);
                          }}
                          className={`w-full text-left text-sm p-3 border rounded-lg transition-colors ${
                            focusedItem?.type === 'recipient' && focusedItem?.id === recipient.id
                              ? 'bg-purple-100 border-purple-400'
                              : 'bg-purple-50 border-purple-200 hover:bg-purple-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{recipient.name}</span>
                            <span className="text-purple-700">{recipient.distance.toFixed(1)} mi</span>
                          </div>
                          {recipient.estimatedSandwiches && (
                            <div className="text-xs text-gray-600 mt-1">
                              Needs ~{recipient.estimatedSandwiches} sandwiches
                            </div>
                          )}
                        </button>
                      ))}
                      {nearbyRecipients.length > 3 && (
                        <button
                          onClick={() => setShowAllRecipients(!showAllRecipients)}
                          className="w-full text-sm text-purple-700 font-medium py-2"
                        >
                          {showAllRecipients ? 'Show less' : `View ${nearbyRecipients.length - 3} more recipients`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg">No nearby recipients found</p>
                  )}
                </div>

                {/* Assigned Drivers - Show first if any */}
                {assignedDrivers.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Assigned Driver{assignedDrivers.length > 1 ? 's' : ''}
                    </h3>
                    <div className="space-y-2">
                      {assignedDrivers.map((driver) => (
                        <Card
                          key={`assigned-mobile-${driver.id}`}
                          className="p-3 border-green-200 bg-green-50"
                        >
                          <button
                            className="w-full text-left"
                            onClick={() => {
                              handleItemClick({
                                type: 'driver',
                                id: driver.id,
                                latitude: driver.latitude,
                                longitude: driver.longitude,
                                name: driver.name
                              });
                              setMobilePanel(null);
                            }}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate flex items-center gap-2">
                                    {driver.name}
                                    <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                                      Assigned
                                    </span>
                                  </h4>
                                  <p className="text-xs text-gray-500 truncate">
                                    {driver.hostLocation || 'No location'}
                                  </p>
                                </div>
                              </div>
                              {driver.phone && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <Phone className="w-3 h-3" />
                                  {driver.phone}
                                </div>
                              )}
                            </div>
                          </button>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Driver Search */}
                <div className="mb-3 space-y-1">
                  <div className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Find a driver</div>
                  <Input
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    placeholder="Search drivers by name or location..."
                    className="h-8 text-xs"
                  />
                </div>

                {/* Nearby Drivers with Distance */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2 flex-wrap">
                    <Truck className="w-4 h-4 text-[#007E8C]" />
                    {driverSearchResults
                      ? `Search results (${driverSearchResults.length})`
                      : assignedDrivers.length > 0
                        ? `Other Nearby Drivers (${nearbyDrivers.length})`
                        : `Closest Drivers (${nearbyDrivers.length})`}
                    {selectedEvent?.vanDriverNeeded && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Van Approved Only</span>
                    )}
                  </h3>
                  {(driverSearchResults && driverSearchResults.length > 0) || nearbyDrivers.length > 0 ? (
                    <div className="space-y-2">
                      {(showAllNearbyDrivers ? (driverSearchResults || nearbyDrivers) : (driverSearchResults || nearbyDrivers).slice(0, 5)).map(({ driver, distance }) => (
                        <Card
                          key={driver.id}
                          className={`p-3 transition-colors ${
                            focusedItem?.type === 'driver' && focusedItem?.id === driver.id
                              ? 'ring-2 ring-orange-400 bg-orange-50'
                              : ''
                          }`}
                        >
                          <button
                            className="w-full text-left"
                            onClick={() => {
                              handleItemClick({
                                type: 'driver',
                                id: driver.id,
                                latitude: driver.latitude,
                                longitude: driver.longitude,
                                name: driver.name
                              });
                              setMobilePanel(null);
                            }}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{driver.name}</h4>
                                  <p className="text-xs text-gray-500 truncate">
                                    {driver.hostLocation || driver.area || driver.routeDescription || extractCityFromAddress(driver.homeAddress) || 'No location'}
                                  </p>
                                  <p className="text-[11px] text-[#007E8C] font-medium mt-1">
                                    {distance.toFixed(1)} miles away
                                  </p>
                                </div>
                                <Badge
                                  variant={driver.source === 'driver' ? 'default' : driver.source === 'host' ? 'outline' : 'secondary'}
                                  className="text-xs flex-shrink-0"
                                >
                                  {driver.source === 'driver' ? 'Driver' : driver.source === 'host' ? 'Host' : 'Volunteer'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                {driver.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {driver.phone}
                                  </span>
                                )}
                                {driver.vehicleType && (
                                  <span className="flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    {driver.vehicleType}
                                    {driver.vanApproved && ' (Van OK)'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyDriverSMS(driver);
                              }}
                            >
                              {copiedDriverId === driver.id ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 mr-1" />
                                  SMS
                                </>
                              )}
                            </Button>
                            {/* Tentative assignment button */}
                            <Button
                              size="sm"
                              variant={selectedEvent?.tentativeDriverIds?.includes(String(driver.id)) ? 'default' : 'outline'}
                              className="text-xs h-8"
                              disabled={assigningDriverId === driver.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: getDriverIds(selectedEvent),
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: true,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <span className="mr-1 font-bold">?</span>
                              )}
                              {selectedEvent?.tentativeDriverIds?.includes(String(driver.id)) ? 'Tentative' : 'Maybe'}
                            </Button>
                            {/* Confirmed assignment button */}
                            <Button
                              size="sm"
                              className="text-xs h-8"
                              disabled={assigningDriverId === driver.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectedEvent) return;
                                setAssigningDriverId(driver.id);
                                assignDriverMutation.mutate({
                                  eventId: selectedEvent.id,
                                  driverId: String(driver.id),
                                  currentAssigned: getDriverIds(selectedEvent),
                                  currentTentative: selectedEvent.tentativeDriverIds || [],
                                  tentative: false,
                                });
                              }}
                            >
                              {assigningDriverId === driver.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3 mr-1" />
                              )}
                              {selectedEvent && hasDriver(selectedEvent, String(driver.id)) ? 'Confirmed' : 'Confirm'}
                            </Button>
                          </div>
                        </Card>
                      ))}
                      {(driverSearchResults || nearbyDrivers).length > 5 && (
                        <button
                          onClick={() => setShowAllNearbyDrivers(!showAllNearbyDrivers)}
                          className="w-full text-sm text-[#007E8C] font-medium py-2"
                        >
                          {showAllNearbyDrivers
                            ? 'Show top 5'
                            : `View ${(driverSearchResults || nearbyDrivers).length - 5} more drivers`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 bg-gray-100 rounded-lg">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No drivers with location data found</p>
                      <p className="text-xs mt-1 text-gray-400">Add area/location to drivers to see suggestions</p>
                    </div>
                  )}
                </div>

                {driverSearchResults && driverSearchResults.length === 0 && (
                  <div className="text-sm text-gray-500 p-3 bg-gray-100 rounded-lg text-center">
                    No drivers match your search.
                  </div>
                )}

                {/* Drivers needing geocoding */}
                {driversNeedingGeocoding.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                    <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {driversNeedingGeocoding.length} drivers need geocoding
                    </h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Run batch geocode in Driver Management.
                    </p>
                  </div>
                )}

                {/* Drivers needing location */}
                {driversWithoutLocation.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {driversWithoutLocation.length} drivers need location data
                    </h4>
                    <p className="text-xs text-amber-700 mt-1">
                      Add area/location info to see more driver suggestions.
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Edit Event Dialog */}
      <EventEditDialog
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        event={selectedEvent as any}
        onSaved={() => {
          // Refresh event map data
          queryClient.invalidateQueries({ queryKey: ['/api/event-map'] });
        }}
      />
    </div>
  );
}
