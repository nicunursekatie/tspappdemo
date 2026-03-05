/**
 * SMS Provider Factory
 * Creates and manages SMS providers based on configuration
 * Prioritizes Replit's managed Twilio connection when available
 */

import { SMSProvider, SMSProviderConfig } from './types';
import { TwilioProvider } from './twilio-provider';
import { PhoneGatewayProvider } from './phone-gateway-provider';
import { isTwilioConnected, isReplitEnvironmentAvailable } from './replit-twilio-connector';
import { logger } from '../utils/production-safe-logger';

export class SMSProviderFactory {
  private static instance: SMSProviderFactory;
  private currentProvider: SMSProvider | null = null;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): SMSProviderFactory {
    if (!SMSProviderFactory.instance) {
      SMSProviderFactory.instance = new SMSProviderFactory();
    }
    return SMSProviderFactory.instance;
  }

  /**
   * Asynchronously ensure the provider is initialized
   * This should be called during server startup or before using the provider
   */
  async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.currentProvider) {
      return;
    }

    const config = await this.loadConfigFromEnv();
    this.currentProvider = this.createProvider(config);
    this.isInitialized = true;
  }

  /**
   * Get SMS provider (synchronous, returns cached provider)
   * Call ensureInitialized() during startup to populate the cache
   */
  getProvider(): SMSProvider {
    if (!this.currentProvider) {
      // Fallback: Load synchronously using manual env vars if not initialized
      // This maintains backward compatibility but won't use Replit integration
      logger.log('⚠️  SMS provider not initialized, using manual env vars as fallback');
      const config: SMSProviderConfig = {
        provider: (process.env.SMS_PROVIDER as 'twilio' | 'phone_gateway') || 'twilio',
        twilio: {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
          useReplitIntegration: false
        }
      };
      this.currentProvider = this.createProvider(config);
    }
    return this.currentProvider;
  }

  /**
   * Get SMS provider asynchronously (refreshes config)
   * Use this when you want to ensure you have the latest configuration
   */
  async getProviderAsync(): Promise<SMSProvider> {
    await this.ensureInitialized();
    return this.currentProvider!;
  }

  /**
   * Reset the provider cache (useful for testing)
   */
  reset(): void {
    this.currentProvider = null;
    this.isInitialized = false;
  }

  /**
   * Create provider from explicit config (for testing)
   */
  createProvider(config: SMSProviderConfig): SMSProvider {
    switch (config.provider) {
      case 'phone_gateway':
        // Allow PhoneGatewayProvider creation with missing config for graceful fallback
        return new PhoneGatewayProvider(
          config.phoneGateway?.gatewayUrl || '',
          config.phoneGateway?.apiKey,
          config.phoneGateway?.deviceNumber,
          config.phoneGateway?.timeout
        );

      case 'twilio':
        // Allow TwilioProvider creation with missing credentials for graceful fallback
        // The provider will handle missing credentials gracefully in its methods
        return new TwilioProvider(
          config.twilio?.accountSid || '',
          config.twilio?.authToken || '',
          config.twilio?.phoneNumber || '',
          config.twilio?.useReplitIntegration || false
        );

      default:
        throw new Error(`Unsupported SMS provider: ${config.provider}`);
    }
  }

  /**
   * Load configuration from environment variables
   * Prioritizes Replit's managed Twilio connection when available
   */
  private async loadConfigFromEnv(): Promise<SMSProviderConfig> {
    // Determine which provider to use based on environment
    const provider = (process.env.SMS_PROVIDER as 'twilio' | 'phone_gateway') || 'twilio';

    const config: SMSProviderConfig = {
      provider
    };

    if (provider === 'phone_gateway') {
      config.phoneGateway = {
        gatewayUrl: process.env.PHONE_GATEWAY_URL || '',
        apiKey: process.env.PHONE_GATEWAY_API_KEY,
        deviceNumber: process.env.PHONE_GATEWAY_DEVICE_NUMBER,
        timeout: parseInt(process.env.PHONE_GATEWAY_TIMEOUT || '30000', 10)
      };
    } else if (provider === 'twilio') {
      // Check for manual credentials first (allows explicit override)
      const hasManualCredentials =
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER;

      // Quick sync check - if Replit env vars aren't available, skip async check entirely
      const replitEnvAvailable = isReplitEnvironmentAvailable();

      // Priority 1: Check if Replit Twilio integration is connected (API Key authentication)
      // This is preferred as it uses secure API key auth and is managed by Replit
      // Only attempt Replit integration if env vars are present
      let isReplitConnected = false;
      if (replitEnvAvailable) {
        try {
          isReplitConnected = await isTwilioConnected();
        } catch (error) {
          logger.warn('⚠️ Replit Twilio integration check failed:', error instanceof Error ? error.message : error);
          isReplitConnected = false;
        }
      }

      if (isReplitConnected) {
        logger.log('🔗 Using Replit Twilio integration (API Key authentication)');
        config.twilio = {
          accountSid: '', // Will be loaded from Replit integration
          authToken: '',  // Will be loaded from Replit integration
          phoneNumber: '', // Will be loaded from Replit integration
          useReplitIntegration: true
        };
      } else if (hasManualCredentials) {
        // Priority 2: Fallback to manual environment variables (Auth Token authentication)
        logger.log('📝 Using manual Twilio environment variables (Auth Token authentication)');
        config.twilio = {
          accountSid: process.env.TWILIO_ACCOUNT_SID || '',
          authToken: process.env.TWILIO_AUTH_TOKEN || '',
          phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
          useReplitIntegration: false
        };
      } else {
        // No credentials available
        logger.warn('⚠️ No Twilio credentials found (configure Replit Twilio integration or set manual env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)');
        config.twilio = {
          accountSid: '',
          authToken: '',
          phoneNumber: '',
          useReplitIntegration: false
        };
      }
    }

    return config;
  }

  /**
   * Get available providers and their configuration status
   */
  getProvidersStatus(): { [key: string]: { configured: boolean; missingItems: string[] } } {
    const providers = ['twilio', 'phone_gateway'];
    const status: { [key: string]: { configured: boolean; missingItems: string[] } } = {};

    for (const providerName of providers) {
      try {
        const config: SMSProviderConfig = {
          provider: providerName as 'twilio' | 'phone_gateway'
        };

        if (providerName === 'twilio') {
          config.twilio = {
            accountSid: process.env.TWILIO_ACCOUNT_SID || '',
            authToken: process.env.TWILIO_AUTH_TOKEN || '',
            phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
          };
        } else if (providerName === 'phone_gateway') {
          config.phoneGateway = {
            gatewayUrl: process.env.PHONE_GATEWAY_URL || ''
          };
        }

        const provider = this.createProvider(config);
        const validation = provider.validateConfig();

        status[providerName] = {
          configured: validation.isValid,
          missingItems: validation.missingItems
        };
      } catch (error) {
        status[providerName] = {
          configured: false,
          missingItems: ['CONFIGURATION_ERROR']
        };
      }
    }

    return status;
  }
}