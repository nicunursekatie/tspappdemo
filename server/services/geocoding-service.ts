import { logger } from '../utils/production-safe-logger';
import {
  RATE_LIMITS,
  GEOCODING_DEFAULTS,
  normalizeAddressForGeocoding,
} from '../config/constants';

/**
 * Geocoding service using OpenStreetMap's Nominatim API
 * Free tier with usage limits - be respectful with rate limiting
 */

interface GeocodeResult {
  latitude: string;
  longitude: string;
  displayName?: string;
}

/**
 * Sleep utility for rate limiting
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Geocode an address or location string to coordinates
 * Uses Nominatim (OpenStreetMap) geocoding API
 *
 * @param location - Address or location string (e.g., "Alpharetta, GA" or "North Atlanta")
 * @returns Coordinates or null if geocoding fails
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location || location.trim().length === 0) {
    return null;
  }

  try {
    // Add default region to location queries that don't already have state info
    // Uses centralized config for consistency across the application
    const searchQuery = normalizeAddressForGeocoding(location);

    // Respect Nominatim's usage policy: 1 request per second maximum
    // Add a small delay to avoid hitting rate limits
    await sleep(RATE_LIMITS.OPENSTREETMAP);

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'us'); // Limit to USA for better accuracy

    logger.info('Geocoding location', { location, searchQuery });

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
      },
    });

    if (!response.ok) {
      logger.warn('Geocoding API request failed', {
        status: response.status,
        location,
      });
      return null;
    }

    const results = await response.json();

    if (!Array.isArray(results) || results.length === 0) {
      logger.warn('No geocoding results found', { location });
      return null;
    }

    const result = results[0];

    logger.info('Geocoding successful', {
      location,
      latitude: result.lat,
      longitude: result.lon,
      displayName: result.display_name,
    });

    return {
      latitude: result.lat,
      longitude: result.lon,
      displayName: result.display_name,
    };
  } catch (error) {
    logger.error('Geocoding error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      location,
    });
    return null;
  }
}

/**
 * Batch geocode multiple locations with proper rate limiting
 * @param locations - Array of location strings
 * @returns Array of results (null for failed geocoding)
 */
export async function batchGeocodeLocations(
  locations: string[]
): Promise<(GeocodeResult | null)[]> {
  const results: (GeocodeResult | null)[] = [];

  for (const location of locations) {
    const result = await geocodeLocation(location);
    results.push(result);
  }

  return results;
}
