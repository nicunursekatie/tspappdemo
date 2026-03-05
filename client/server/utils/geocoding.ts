import { logger } from './production-safe-logger';
import { RATE_LIMITS, normalizeAddressForGeocoding } from '../config/constants';

export type GeocodingResult = {
  latitude: string;
  longitude: string;
  source: 'google' | 'openstreetmap';
} | null;

export type GeocodingFailureReason =
  | 'no_address'
  | 'google_no_key'
  | 'google_http_error'
  | 'google_request_denied'
  | 'google_over_query_limit'
  | 'google_invalid_request'
  | 'google_zero_results'
  | 'google_unknown_error'
  | 'google_exception'
  | 'osm_http_error'
  | 'osm_zero_results'
  | 'osm_exception'
  | 'all_failed';

// Stores the last failure reason for diagnostic purposes
let lastFailureReason: GeocodingFailureReason | null = null;
let lastFailureDetail: string = '';

export function getLastGeocodingFailure(): { reason: GeocodingFailureReason | null; detail: string } {
  return { reason: lastFailureReason, detail: lastFailureDetail };
}

function setFailure(reason: GeocodingFailureReason, detail: string) {
  lastFailureReason = reason;
  lastFailureDetail = detail;
}

/**
 * Geocode using Google Geocoding API (primary - better at parsing typos and messy addresses)
 */
async function geocodeWithGoogle(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
    logger.warn('Google Geocoding API key not configured — set GOOGLE_GEOCODING_API_KEY env var');
    setFailure('google_no_key', 'GOOGLE_GEOCODING_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );

    if (!response.ok) {
      const detail = `HTTP ${response.status} ${response.statusText}`;
      logger.error(`Google Geocoding API HTTP error for "${address}": ${detail}`);
      setFailure('google_http_error', detail);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      logger.info(
        `Google Geocoding SUCCESS: "${address}" -> (${location.lat}, ${location.lng})`
      );
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    }

    // Map Google status to our failure reasons
    const statusMap: Record<string, GeocodingFailureReason> = {
      'REQUEST_DENIED': 'google_request_denied',
      'OVER_QUERY_LIMIT': 'google_over_query_limit',
      'INVALID_REQUEST': 'google_invalid_request',
      'ZERO_RESULTS': 'google_zero_results',
    };
    const failureReason = statusMap[data.status] || 'google_unknown_error';
    const detail = `Google returned "${data.status}"${data.error_message ? `: ${data.error_message}` : ''}`;

    logger.warn(`Google Geocoding FAILED for "${address}": ${detail}`);
    setFailure(failureReason, detail);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`Google Geocoding exception for "${address}": ${detail}`);
    setFailure('google_exception', detail);
    return null;
  }
}

/**
 * Geocode an address to latitude and longitude
 * Primary: Google Geocoding API (more accurate, handles address variations better)
 * Fallback: OpenStreetMap Nominatim API (free, when Google unavailable)
 *
 * @param address - Full address string to geocode
 * @returns Object with latitude, longitude, and source service, or null if failed
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  // Reset failure tracking for this call
  lastFailureReason = null;
  lastFailureDetail = '';

  if (!address || address.trim() === '') {
    setFailure('no_address', 'Empty or missing address');
    return null;
  }

  // Normalize address: append "Georgia, USA" if no state/region info present
  const normalizedAddress = normalizeAddressForGeocoding(address.trim());

  try {
    // Try Google first (more accurate, handles address variations better)
    logger.info(`Geocoding attempt: "${normalizedAddress}" (original: "${address}")`);
    const googleResult = await geocodeWithGoogle(normalizedAddress);

    if (googleResult) {
      return { ...googleResult, source: 'google' };
    }

    // Fallback to OpenStreetMap if Google fails or is not configured
    logger.info(`Falling back to OpenStreetMap for: "${normalizedAddress}"`);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
        },
      }
    );

    if (!response.ok) {
      const detail = `HTTP ${response.status} ${response.statusText}`;
      logger.error(`OpenStreetMap API error for "${normalizedAddress}": ${detail}`);
      setFailure('osm_http_error', detail);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      logger.info(
        `OpenStreetMap SUCCESS: "${address}" -> (${result.lat}, ${result.lon})`
      );
      return {
        latitude: result.lat,
        longitude: result.lon,
        source: 'openstreetmap',
      };
    }

    logger.warn(`OpenStreetMap returned 0 results for: "${normalizedAddress}"`);
    setFailure('all_failed', `Both Google and OpenStreetMap failed for "${normalizedAddress}"`);
    logger.error(`ALL GEOCODING FAILED for address: "${normalizedAddress}" (original: "${address}")`);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`Geocoding exception for "${normalizedAddress}": ${detail}`);
    setFailure('osm_exception', detail);
    return null;
  }
}

// Rate limits by service - use centralized config
const SERVICE_RATE_LIMITS = {
  google: RATE_LIMITS.GOOGLE_GEOCODING,
  openstreetmap: RATE_LIMITS.OPENSTREETMAP,
};

/**
 * Batch geocode multiple addresses with adaptive rate limiting
 * Adjusts delay based on which service was actually used for each request
 *
 * @param addresses - Array of address strings to geocode
 * @returns Array of geocoded results (null for failed geocoding)
 */
export async function geocodeAddresses(addresses: string[]): Promise<GeocodingResult[]> {
  const results: GeocodingResult[] = [];
  let lastSource: 'google' | 'openstreetmap' = 'google';

  for (let i = 0; i < addresses.length; i++) {
    const result = await geocodeAddress(addresses[i]);
    results.push(result);

    // Track which service was last attempted for rate limiting
    // If result exists, use its source. If null, OpenStreetMap was last attempted (as fallback)
    lastSource = result ? result.source : 'openstreetmap';

    // Rate limit between requests based on the service that was actually used
    if (i < addresses.length - 1) {
      const delayMs = SERVICE_RATE_LIMITS[lastSource];
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
