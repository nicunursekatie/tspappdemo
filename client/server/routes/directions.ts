import { Router } from 'express';
import { logger } from '../utils/production-safe-logger';

const router = Router();

interface DirectionsRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  departureTime?: string; // ISO timestamp or 'now'
}

interface DirectionsResponse {
  distance: number; // meters
  duration: number; // seconds (without traffic)
  durationInTraffic: number | null; // seconds (with traffic, if available)
  polyline: string; // encoded polyline
  coordinates: [number, number][]; // decoded [lat, lng] pairs for Leaflet
}

/**
 * Decode Google's encoded polyline format to coordinates
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * POST /api/directions
 * Get driving directions with traffic data from Google Maps Directions API
 *
 * Falls back to OSRM if Google API key is not configured
 */
router.post('/', async (req, res) => {
  try {
    const { origin, destination, departureTime }: DirectionsRequest = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      return res.status(400).json({ error: 'Origin and destination coordinates required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    // If no Google API key, fall back to OSRM
    if (!apiKey) {
      logger.log('No GOOGLE_MAPS_API_KEY configured, falling back to OSRM');
      return await fetchFromOSRM(origin, destination, res);
    }

    // Build Google Directions API URL
    const params = new URLSearchParams({
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode: 'driving',
      key: apiKey,
    });

    // Add departure time for traffic data
    // 'now' uses current time, or pass a Unix timestamp
    if (departureTime === 'now') {
      params.set('departure_time', 'now');
    } else if (departureTime) {
      // Convert ISO timestamp to Unix timestamp
      const timestamp = Math.floor(new Date(departureTime).getTime() / 1000);
      params.set('departure_time', timestamp.toString());
    } else {
      // Default to 'now' for real-time traffic
      params.set('departure_time', 'now');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      logger.error(`Google Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`);

      // Fall back to OSRM on error
      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        logger.warn('Falling back to OSRM due to Google API error');
        return await fetchFromOSRM(origin, destination, res);
      }

      return res.status(400).json({
        error: 'Directions request failed',
        details: data.error_message || data.status
      });
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode the polyline for map display
    const coordinates = decodePolyline(route.overview_polyline.points);

    const result: DirectionsResponse = {
      distance: leg.distance.value, // meters
      duration: leg.duration.value, // seconds (without traffic)
      durationInTraffic: leg.duration_in_traffic?.value || null, // seconds (with traffic)
      polyline: route.overview_polyline.points,
      coordinates,
    };

    res.json(result);
  } catch (error) {
    logger.error('Error fetching directions:', error);
    res.status(500).json({
      error: 'Failed to fetch directions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fallback to OSRM when Google API is not available
 */
async function fetchFromOSRM(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  res: any
) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      return res.status(400).json({ error: 'OSRM routing failed' });
    }

    const route = data.routes[0];

    // OSRM returns coordinates as [lng, lat], convert to [lat, lng] for Leaflet
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    const result: DirectionsResponse = {
      distance: route.distance, // meters
      duration: route.duration, // seconds
      durationInTraffic: null, // OSRM doesn't provide traffic data
      polyline: '', // OSRM uses GeoJSON, not encoded polyline
      coordinates,
    };

    res.json(result);
  } catch (error) {
    logger.error('OSRM fallback failed:', error);
    res.status(500).json({
      error: 'Failed to fetch directions from OSRM',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export default router;
