/**
 * Replit Twilio Connector
 * Fetches Twilio credentials from Replit's managed connection API
 * This works in both development and production deployments
 */

import twilio from 'twilio';
import { logger } from '../utils/production-safe-logger';

interface TwilioCredentials {
  accountSid: string;
  apiKey: string;
  apiKeySecret: string;
  phoneNumber: string;
  authToken?: string; // Auth token for webhook signature validation
}

let cachedCredentials: TwilioCredentials | null = null;
let cachedClient: ReturnType<typeof twilio> | null = null;

/**
 * Check if Replit connector environment is available
 * Returns true only if all required env vars exist for Replit Twilio integration
 */
function isReplitEnvironmentAvailable(): boolean {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const hasAuthToken = !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);

  return !!(hostname && hasAuthToken);
}

/**
 * Get Twilio credentials from Replit's managed connection
 * Uses REPL_IDENTITY in development and WEB_REPL_RENEWAL in production
 */
async function getCredentials(): Promise<TwilioCredentials> {
  // Return cached credentials if available
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;

  // Determine the authentication token based on environment
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!hostname) {
    throw new Error('Replit connector hostname not available - falling back to manual credentials');
  }

  if (!xReplitToken) {
    throw new Error('Replit session token not available (REPL_IDENTITY or WEB_REPL_RENEWAL missing) - falling back to manual credentials');
  }

  try {
    const response = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    );

    if (!response.ok) {
      // Check for specific session/auth errors
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Replit session expired or invalid (${response.status}) - falling back to manual credentials`);
      }
      throw new Error(`Failed to fetch Twilio credentials from Replit: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    if (!connectionSettings ||
        !connectionSettings.settings.account_sid ||
        !connectionSettings.settings.api_key ||
        !connectionSettings.settings.api_key_secret) {
      throw new Error('Twilio not connected in Replit or missing required settings - falling back to manual credentials');
    }

    cachedCredentials = {
      accountSid: connectionSettings.settings.account_sid,
      apiKey: connectionSettings.settings.api_key,
      apiKeySecret: connectionSettings.settings.api_key_secret,
      phoneNumber: connectionSettings.settings.phone_number || '',
      authToken: connectionSettings.settings.auth_token || undefined
    };

    // Debug: Log credential info (not the secrets themselves)
    logger.log('✅ Twilio credentials loaded from Replit connection');
    logger.log(`📱 Twilio Account SID prefix: ${cachedCredentials.accountSid?.substring(0, 8)}...`);
    logger.log(`📱 Twilio API Key prefix: ${cachedCredentials.apiKey?.substring(0, 8)}...`);
    logger.log(`📱 Twilio API Key Secret length: ${cachedCredentials.apiKeySecret?.length || 0}`);
    logger.log(`📱 Twilio Phone Number: ${cachedCredentials.phoneNumber}`);
    logger.log(`📱 Twilio Auth Token available: ${cachedCredentials.authToken ? 'Yes' : 'No (webhook validation may fail)'}`);

    return cachedCredentials;
  } catch (error) {
    // Clear cache on failure to allow retry
    cachedCredentials = null;
    cachedClient = null;
    logger.warn('Failed to load Twilio credentials from Replit connection:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Get a configured Twilio client using Replit's managed connection
 * Uses API Key authentication (more secure than auth token)
 */
export async function getTwilioClient(): Promise<ReturnType<typeof twilio>> {
  // Return cached client if available
  if (cachedClient) {
    return cachedClient;
  }

  const { accountSid, apiKey, apiKeySecret } = await getCredentials();
  
  cachedClient = twilio(apiKey, apiKeySecret, {
    accountSid: accountSid
  });

  return cachedClient;
}

/**
 * Get the Twilio phone number from Replit's managed connection
 */
export async function getTwilioFromPhoneNumber(): Promise<string> {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}

/**
 * Check if Twilio connection is available via Replit integration
 * First performs a quick sync check, then validates async if env is available
 */
export async function isTwilioConnected(): Promise<boolean> {
  // Quick sync check - if Replit env vars aren't available, don't even try
  if (!isReplitEnvironmentAvailable()) {
    logger.log('📝 Replit Twilio integration not available (missing env vars), will use manual credentials');
    return false;
  }

  // If we have cached credentials, assume still connected
  if (cachedCredentials) {
    return true;
  }

  // Try to fetch credentials
  try {
    await getCredentials();
    return true;
  } catch (error) {
    logger.log('📝 Replit Twilio integration failed, will use manual credentials if available');
    return false;
  }
}

/**
 * Check if Replit environment is available (synchronous check)
 * Exported for use in provider factory
 */
export { isReplitEnvironmentAvailable };

/**
 * Get the Twilio Auth Token for webhook signature validation
 * Priority:
 * 1. TWILIO_AUTH_TOKEN environment variable (manual override)
 * 2. Auth token from Replit's managed connection (if available)
 *
 * Note: Replit's connector may not provide auth_token as it uses API Key auth.
 * In that case, TWILIO_AUTH_TOKEN must be set manually in Replit Secrets.
 */
export async function getTwilioAuthToken(): Promise<string | null> {
  // Priority 1: Environment variable override
  const envAuthToken = process.env.TWILIO_AUTH_TOKEN;
  if (envAuthToken) {
    logger.log('📱 Using TWILIO_AUTH_TOKEN from environment variable');
    return envAuthToken;
  }

  // Priority 2: Try to get from Replit connector
  try {
    const credentials = await getCredentials();
    if (credentials.authToken) {
      logger.log('📱 Using auth token from Replit Twilio connection');
      return credentials.authToken;
    }
  } catch (error) {
    // Replit connector not available or failed
    logger.log('📱 Replit Twilio connector not available for auth token');
  }

  // No auth token available
  logger.warn('⚠️ No Twilio auth token available for webhook validation. Set TWILIO_AUTH_TOKEN in environment.');
  return null;
}

/**
 * Clear cached credentials (for testing or reconnection)
 */
export function clearTwilioCache(): void {
  logger.log('🔄 Clearing Twilio cache...');
  cachedCredentials = null;
  cachedClient = null;
}

/**
 * Force reload credentials (bypasses cache)
 */
export async function reloadCredentials(): Promise<TwilioCredentials> {
  clearTwilioCache();
  return getCredentials();
}
