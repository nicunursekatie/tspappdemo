/**
 * Application Constants
 *
 * Centralized configuration for hardcoded values that were previously scattered
 * throughout the codebase. This makes it easier to adjust settings and maintain
 * consistency.
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limits for external API calls (in milliseconds)
 */
export const RATE_LIMITS = {
  /** Google Geocoding API - allows 50 req/sec, we use 200ms to be safe */
  GOOGLE_GEOCODING: 200,
  /** OpenStreetMap Nominatim - requires max 1 req/sec */
  OPENSTREETMAP: 1100,
  /** OpenAI API - general rate limit delay */
  OPENAI: 200,
} as const;

// ============================================================================
// GEOCODING
// ============================================================================

/**
 * Default region for geocoding queries when no region is specified
 * This organization primarily operates in Georgia, USA
 */
export const GEOCODING_DEFAULTS = {
  /** Default region to append to addresses without state info */
  DEFAULT_REGION: 'Georgia, USA',
  /** Regex pattern to detect if address already has Georgia/GA */
  GEORGIA_PATTERN: /,\s*(GA|Georgia)/i,
  /** Regex pattern to detect if address already has USA */
  USA_PATTERN: /USA|United States/i,
} as const;

/**
 * Append default region to an address if it doesn't already have region info
 */
export function normalizeAddressForGeocoding(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return trimmed;

  // If address already has Georgia or USA, return as-is
  if (
    GEOCODING_DEFAULTS.GEORGIA_PATTERN.test(trimmed) ||
    GEOCODING_DEFAULTS.USA_PATTERN.test(trimmed)
  ) {
    return trimmed;
  }

  return `${trimmed}, ${GEOCODING_DEFAULTS.DEFAULT_REGION}`;
}

// ============================================================================
// URLs AND HOSTS
// ============================================================================

/**
 * Get the application base URL for links in emails, etc.
 */
export function getAppBaseUrl(req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  // First try environment variable
  if (process.env.CLIENT_URL) {
    return process.env.CLIENT_URL;
  }

  // Try Replit dev domain
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // Try to get from request
  if (req?.get) {
    const host = req.get('host');
    if (host && host !== 'localhost:5000') {
      const protocol = req.protocol || 'https';
      return `${protocol}://${host}`;
    }
  }

  // Default fallback
  return process.env.NODE_ENV === 'production'
    ? 'https://app.example.com' // Should be set via CLIENT_URL in production
    : 'http://localhost:5000';
}

/**
 * Default host fallback when request host is not available
 */
export const DEFAULT_HOST = 'localhost:5000';

// ============================================================================
// DATA CUTOFF DATES
// ============================================================================

/**
 * Historical data cutoff dates
 * Used to filter legacy data from certain imports/queries
 */
export const DATA_CUTOFFS = {
  /** Scott's collection data ends on this date */
  SCOTT_DATA_CUTOFF: '2025-08-06',
} as const;

// ============================================================================
// SECURITY / AUTH
// ============================================================================

/**
 * Password reset token expiry (in hours)
 */
export const PASSWORD_RESET_EXPIRY_HOURS = 1;

/**
 * Password reset token expiry (in milliseconds)
 */
export const PASSWORD_RESET_EXPIRY_MS = PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000;

// ============================================================================
// API TIMEOUTS
// ============================================================================

/**
 * Default timeout for external API calls (in milliseconds)
 */
export const API_TIMEOUTS = {
  /** Default timeout for geocoding requests */
  GEOCODING: 10000,
  /** Default timeout for AI/LLM requests */
  AI_REQUEST: 30000,
  /** Default timeout for email sending */
  EMAIL: 15000,
} as const;
