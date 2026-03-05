import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import {
  MapPin, Search, AlertCircle, Phone, Mail, Building2, List, ChevronRight, ChevronLeft,
  Users, Package, Loader2, X, Navigation, ExternalLink
} from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PageBreadcrumbs } from '@/components/page-breadcrumbs';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useResourcePermissions } from '@/hooks/useResourcePermissions';
import { useToast } from '@/hooks/use-toast';
import { PermissionDenied } from '@/components/permission-denied';
import type { Recipient } from '@shared/schema';

// Fix Leaflet default marker icon issue in bundled apps
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
// Red marker for highlighted hosts
const highlightedHostIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Orange marker for highlighted recipients (stands out from purple)
const highlightedRecipientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Blue marker for hosts
const hostIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Purple marker for recipients
const recipientIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Green marker for searched address
const searchIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Haversine formula for distance calculation (returns miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map controller component to handle zoom/pan and open popups
function MapController({
  center,
  zoom,
  selectedId,
  flyKey,
  markerRefs
}: {
  center: [number, number] | null;
  zoom: number;
  selectedId: string | null;
  flyKey: number;
  markerRefs: React.MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!center || !map) return;

    try {
      map.flyTo(center, zoom, { duration: 0.5 });

      // After the map finishes moving, open the popup for the selected marker
      if (selectedId) {
        setTimeout(() => {
          const marker = markerRefs.current.get(selectedId);
          if (marker) {
            marker.openPopup();
          }
        }, 600);
      }
    } catch (error) {
      console.warn('Map interaction error:', error);
    }
  }, [flyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// Auto-fit map bounds to show all host markers on initial load
function FitBoundsOnLoad({ hosts }: { hosts: HostContactMapData[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (hasFitted.current || hosts.length === 0) return;

    const points: [number, number][] = [];
    hosts.forEach(h => {
      const lat = parseFloat(String(h.latitude));
      const lng = parseFloat(String(h.longitude));
      if (!isNaN(lat) && !isNaN(lng)) points.push([lat, lng]);
    });

    if (points.length === 0) return;

    const avgLat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const avgLng = points.reduce((s, p) => s + p[1], 0) / points.length;
    const nearby = points.filter(p =>
      Math.abs(p[0] - avgLat) < 1.5 && Math.abs(p[1] - avgLng) < 1.5
    );
    const finalPoints = nearby.length > 0 ? nearby : points;

    if (finalPoints.length > 1) {
      const bounds = L.latLngBounds(finalPoints);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    } else {
      map.setView(finalPoints[0], 11);
    }
    hasFitted.current = true;
  }, [hosts, map]);

  return null;
}

// Map click handler
function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({
    click: () => {
      onMapClick();
    },
  });
  return null;
}


interface HostContactMapData {
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

interface SearchedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export default function LocationsMapView() {
  const { toast } = useToast();
  const { trackView } = useActivityTracker();
  const [searchTerm, setSearchTerm] = useState('');
  const [addressSearchTerm, setAddressSearchTerm] = useState('');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('hosts');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [showHosts, setShowHosts] = useState(true);
  const [showRecipients, setShowRecipients] = useState(true);
  const [searchedLocation, setSearchedLocation] = useState<SearchedLocation | null>(null);
  const [flyKey, setFlyKey] = useState(0);

  // Refs for marker instances to enable programmatic popup opening
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    trackView(
      'Maps',
      'Maps',
      'Locations Map',
      'User accessed combined locations map'
    );
  }, [trackView]);

  // Check permissions
  const { canView: canViewHosts } = useResourcePermissions('HOSTS');
  const { canView: canViewRecipients } = useResourcePermissions('RECIPIENTS');

  // Fetch host contacts with coordinates
  const { data: hosts = [], isLoading: hostsLoading } = useQuery<HostContactMapData[]>({
    queryKey: ['/api/hosts/map'],
    enabled: canViewHosts,
  });

  // Fetch recipients
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    enabled: canViewRecipients,
  });

  // Geocode address mutation
  const geocodeMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await fetch('/api/event-map/geocode-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to geocode address');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setSearchedLocation({
        address: addressSearchTerm,
        latitude: data.latitude,
        longitude: data.longitude,
      });
      setMapCenter([data.latitude, data.longitude]);
      setMapZoom(14);
      setSelectedId(null); // Clear any previously selected recipient/host
      setFlyKey(k => k + 1);
      toast({
        title: 'Address found',
        description: `Located: ${addressSearchTerm}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Address not found',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter recipients with coordinates (include active or those without a status set)
  const recipientsWithCoords = useMemo(() => {
    return recipients.filter(r => {
      // Must have coordinates
      if (!r.latitude || !r.longitude) return false;
      // Include if status is 'active', 'Active', or not set (null/undefined)
      const status = r.status?.toLowerCase();
      return !status || status === 'active';
    });
  }, [recipients]);

  // Filter hosts based on search and add distance if searching address
  const filteredHosts = useMemo(() => {
    let result = hosts;

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(contact =>
        contact.contactName.toLowerCase().includes(search) ||
        contact.hostLocationName.toLowerCase().includes(search) ||
        contact.address?.toLowerCase().includes(search)
      );
    }

    // Add distances and sort if there's a searched location
    if (searchedLocation) {
      return result
        .map(h => ({
          ...h,
          distance: calculateDistance(
            searchedLocation.latitude,
            searchedLocation.longitude,
            parseFloat(h.latitude),
            parseFloat(h.longitude)
          )
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    return result.map(h => ({ ...h, distance: undefined as number | undefined }));
  }, [hosts, searchTerm, searchedLocation]);

  // Filter recipients based on search and add distance if searching address
  const filteredRecipients = useMemo(() => {
    let result = recipientsWithCoords;

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(search) ||
        r.address?.toLowerCase().includes(search) ||
        r.region?.toLowerCase().includes(search)
      );
    }

    // Add distances and sort if there's a searched location
    if (searchedLocation) {
      return result
        .map(r => ({
          ...r,
          distance: calculateDistance(
            searchedLocation.latitude,
            searchedLocation.longitude,
            parseFloat(r.latitude as string),
            parseFloat(r.longitude as string)
          )
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    return result.map(r => ({ ...r, distance: undefined as number | undefined }));
  }, [recipientsWithCoords, searchTerm, searchedLocation]);

  // Atlanta metro center — all our hosts are in the greater Atlanta area
  const initialMapCenter: [number, number] = [33.88, -84.35];

  // Handle host click — fly to pin and open popup
  const handleHostClick = (contact: HostContactMapData) => {
    const lat = parseFloat(contact.latitude);
    const lng = parseFloat(contact.longitude);
    setSelectedId(`host-${contact.id}`);
    setMapCenter([lat, lng]);
    setMapZoom(15);
    setFlyKey(k => k + 1);
  };

  // Handle recipient click — fly to pin and open popup
  const handleRecipientClick = (recipient: Recipient) => {
    if (!recipient.latitude || !recipient.longitude) return;
    const lat = parseFloat(recipient.latitude as string);
    const lng = parseFloat(recipient.longitude as string);
    setSelectedId(`recipient-${recipient.id}`);
    setMapCenter([lat, lng]);
    setMapZoom(15);
    setFlyKey(k => k + 1);
  };

  // Handle address search
  const handleAddressSearch = () => {
    if (!addressSearchTerm.trim()) return;
    geocodeMutation.mutate(addressSearchTerm.trim());
  };

  // Clear search
  const clearSearch = () => {
    setSearchedLocation(null);
    setAddressSearchTerm('');
  };

  const isLoading = hostsLoading || recipientsLoading;
  const hasNoData = hosts.length === 0 && recipientsWithCoords.length === 0;

  // Permission check - need at least one
  if (!canViewHosts && !canViewRecipients) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md mx-4">
          <PermissionDenied
            action="view locations on the route map"
            requiredPermission="HOSTS_VIEW or RECIPIENTS_VIEW"
            variant="card"
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
            </div>
          </div>
        </div>
        <div className="flex-1 relative">
          <Skeleton className="absolute inset-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full max-h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto">
          <PageBreadcrumbs segments={[
            { label: 'Operations' },
            { label: 'Locations Map' }
          ]} />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-100">
                <MapPin className="w-5 h-5 text-[#007E8C]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Locations Map</h1>
                <p className="text-xs text-gray-600">
                  {showHosts ? hosts.length : 0} hosts, {showRecipients ? recipientsWithCoords.length : 0} recipients shown
                </p>
              </div>
            </div>

            {/* Address Search - prominently placed */}
            <div className="flex-1 max-w-md">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search any address..."
                    value={addressSearchTerm}
                    onChange={(e) => setAddressSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                    className="pl-10 h-9"
                  />
                </div>
                <Button
                  onClick={handleAddressSearch}
                  disabled={geocodeMutation.isPending || !addressSearchTerm.trim()}
                  size="sm"
                  className="h-9"
                >
                  {geocodeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                </Button>
                {searchedLocation && (
                  <Button variant="ghost" size="sm" onClick={clearSearch} className="h-9 px-2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Visibility toggles */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-hosts"
                  checked={showHosts}
                  onCheckedChange={(checked) => setShowHosts(checked === true)}
                />
                <Label htmlFor="show-hosts" className="text-sm flex items-center gap-1 cursor-pointer">
                  <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                  Hosts
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-recipients"
                  checked={showRecipients}
                  onCheckedChange={(checked) => setShowRecipients(checked === true)}
                />
                <Label htmlFor="show-recipients" className="text-sm flex items-center gap-1 cursor-pointer">
                  <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                  Recipients
                </Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Side Panel + Map */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Side Panel */}
        <div
          className={`
            ${isPanelOpen ? 'w-96' : 'w-0'}
            transition-all duration-300 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden
          `}
        >
          {isPanelOpen && (
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSearchTerm(''); }} className="flex flex-col h-full overflow-hidden">
              {/* Searched Location Info - show at top when search is active */}
              {searchedLocation && (
                <div className="p-3 bg-green-50 border-b border-green-200 flex-shrink-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-green-800 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        Searched Location
                      </div>
                      <div className="text-sm text-green-700 mt-1 truncate">{searchedLocation.address}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearSearch} className="h-6 w-6 p-0 text-green-700 hover:text-green-900 hover:bg-green-100">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <TabsList className="grid w-full grid-cols-2 m-2 mr-4 flex-shrink-0">
                <TabsTrigger value="hosts" className="text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  Hosts ({filteredHosts.length})
                </TabsTrigger>
                <TabsTrigger value="recipients" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  Recipients ({filteredRecipients.length})
                </TabsTrigger>
              </TabsList>

              {/* Hosts Tab */}
              <TabsContent value="hosts" forceMount className={`flex-1 flex flex-col overflow-hidden m-0 min-h-0 ${activeTab !== 'hosts' ? 'hidden' : ''}`}>
                <div className="p-3 border-b flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search hosts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-1.5 space-y-0.5">
                    {filteredHosts.map(contact => (
                      <div
                        key={contact.id}
                        className={`cursor-pointer hover:bg-gray-50 transition-all px-2 py-1.5 rounded-md border ${
                          selectedId === `host-${contact.id}` ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' : 'border-gray-100'
                        }`}
                        onClick={() => handleHostClick(contact)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-sm truncate leading-tight">{contact.contactName}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{contact.hostLocationName}</span>
                              {contact.role && <span className="text-gray-400">· {contact.role}</span>}
                            </div>
                          </div>
                          {contact.distance !== undefined && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {contact.distance.toFixed(1)} mi
                            </Badge>
                          )}
                        </div>
                        {contact.address && (
                          <div className="text-xs text-gray-400 truncate leading-tight">📍 {contact.address}</div>
                        )}
                      </div>
                    ))}
                    {filteredHosts.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No hosts found</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Recipients Tab */}
              <TabsContent value="recipients" forceMount className={`flex-1 flex flex-col overflow-hidden m-0 min-h-0 ${activeTab !== 'recipients' ? 'hidden' : ''}`}>
                <div className="p-3 border-b flex-shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search recipients..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-9"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-1.5 space-y-0.5">
                    {filteredRecipients.map(recipient => (
                      <Card
                        key={recipient.id}
                        className={`cursor-pointer hover:shadow-md transition-all ${
                          selectedId === `recipient-${recipient.id}` ? 'ring-2 ring-purple-500 bg-purple-50' : ''
                        }`}
                        onClick={() => handleRecipientClick(recipient)}
                      >
                        <CardContent className="px-2 py-1.5">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 text-sm">{recipient.name}</div>
                              {recipient.region && (
                                <Badge variant="outline" className="text-xs mt-1">{recipient.region}</Badge>
                              )}
                            </div>
                            {recipient.distance !== undefined && (
                              <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                                {recipient.distance.toFixed(1)} mi
                              </Badge>
                            )}
                          </div>
                          {recipient.address && (
                            <div className="text-xs text-gray-500 mt-1 truncate">📍 {recipient.address}</div>
                          )}
                          {recipient.estimatedWeeklySandwiches && (
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              ~{recipient.estimatedWeeklySandwiches} sandwiches/week
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {filteredRecipients.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No recipients found</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Toggle Panel Button */}
        <Button
          variant="outline"
          size="sm"
          className="absolute top-1/2 transform -translate-y-1/2 z-[1000] rounded-r-lg rounded-l-none shadow-md transition-all duration-300"
          style={{ left: isPanelOpen ? '384px' : '0' }}
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          {isPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>

        {/* Map */}
        <div className="flex-1 relative min-h-0 min-w-0">
          <MapContainer
            center={initialMapCenter}
            zoom={11}
            className="absolute inset-0"
          >
            <MapController center={mapCenter} zoom={mapZoom} selectedId={selectedId} flyKey={flyKey} markerRefs={markerRefs} />
            <FitBoundsOnLoad hosts={filteredHosts} />
            <MapClickHandler onMapClick={() => setSelectedId(null)} />
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* Host Markers */}
            {showHosts && filteredHosts.map(contact => (
              <Marker
                key={`host-${contact.id}`}
                position={[parseFloat(contact.latitude), parseFloat(contact.longitude)]}
                icon={selectedId === `host-${contact.id}` ? highlightedHostIcon : hostIcon}
                ref={(ref) => {
                  if (ref) {
                    markerRefs.current.set(`host-${contact.id}`, ref);
                  }
                }}
                eventHandlers={{
                  click: () => setSelectedId(`host-${contact.id}`),
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <div className="font-semibold text-blue-600 mb-1">{contact.contactName}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      <Building2 className="inline w-3 h-3 mr-1" />
                      {contact.hostLocationName}
                    </div>
                    {contact.role && (
                      <Badge variant="outline" className="mb-2 text-xs">{contact.role}</Badge>
                    )}
                    {contact.address && (
                      <div className="text-xs text-gray-600 mb-2">{contact.address}</div>
                    )}
                    <div className="space-y-1 pt-2 border-t border-gray-200">
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Phone className="w-3 h-3" />
                          <a href={`tel:${contact.phone}`} className="hover:text-blue-600">{contact.phone}</a>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Mail className="w-3 h-3" />
                          <a href={`mailto:${contact.email}`} className="hover:text-blue-600">{contact.email}</a>
                        </div>
                      )}
                    </div>
                    {searchedLocation && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(searchedLocation.address)}&destination=${encodeURIComponent(contact.address || `${contact.latitude},${contact.longitude}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-2 pt-2 border-t border-gray-200"
                      >
                        <Navigation className="w-3 h-3" />
                        Get Directions
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Recipient Markers */}
            {showRecipients && filteredRecipients.map(recipient => (
              <Marker
                key={`recipient-${recipient.id}`}
                position={[parseFloat(recipient.latitude as string), parseFloat(recipient.longitude as string)]}
                icon={selectedId === `recipient-${recipient.id}` ? highlightedRecipientIcon : recipientIcon}
                ref={(ref) => {
                  if (ref) {
                    markerRefs.current.set(`recipient-${recipient.id}`, ref);
                  }
                }}
                eventHandlers={{
                  click: () => setSelectedId(`recipient-${recipient.id}`),
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[180px]">
                    <div className="font-semibold text-purple-600 mb-1">{recipient.name}</div>
                    {recipient.region && (
                      <Badge variant="outline" className="mb-2 text-xs">{recipient.region}</Badge>
                    )}
                    {recipient.address && (
                      <div className="text-xs text-gray-600 mb-2">{recipient.address}</div>
                    )}
                    {recipient.estimatedWeeklySandwiches && (
                      <div className="text-xs text-gray-600 mb-2">
                        <Package className="inline w-3 h-3 mr-1" />
                        ~{recipient.estimatedWeeklySandwiches} sandwiches/week
                      </div>
                    )}
                    {recipient.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-600 pt-2 border-t border-gray-200">
                        <Phone className="w-3 h-3" />
                        <a href={`tel:${recipient.phone}`} className="hover:text-purple-600">{recipient.phone}</a>
                      </div>
                    )}
                    {searchedLocation && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(searchedLocation.address)}&destination=${encodeURIComponent(recipient.address || `${recipient.latitude},${recipient.longitude}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium mt-2 pt-2 border-t border-gray-200"
                      >
                        <Navigation className="w-3 h-3" />
                        Get Directions
                        <ExternalLink className="w-3 h-3 ml-auto" />
                      </a>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Searched Location Marker */}
            {searchedLocation && (
              <Marker
                position={[searchedLocation.latitude, searchedLocation.longitude]}
                icon={searchIcon}
              >
                <Popup>
                  <div className="p-2">
                    <div className="font-semibold text-green-600 mb-1">Searched Location</div>
                    <div className="text-sm text-gray-600">{searchedLocation.address}</div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 border">
            <div className="text-xs font-semibold text-gray-700 mb-2">Legend</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span>Hosts ({hosts.length})</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                <span>Recipients ({recipientsWithCoords.length})</span>
              </div>
              {searchedLocation && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  <span>Search Result</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
