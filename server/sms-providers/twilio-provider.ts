/**
 * Twilio SMS Provider
 * Wraps Twilio SDK for the common SMS provider interface
 * Supports both manual credentials and Replit's managed Twilio connection
 */

import Twilio from 'twilio';
import { SMSProvider, SMSMessage, SMSResult } from './types';
import { getTwilioClient, getTwilioFromPhoneNumber, isTwilioConnected } from './replit-twilio-connector';
import { logger } from '../utils/production-safe-logger';

export class TwilioProvider implements SMSProvider {
  name = 'twilio';
  
  private client: ReturnType<typeof Twilio> | null = null;
  private phoneNumber: string;
  private useReplitIntegration: boolean;
  private clientPromise: Promise<ReturnType<typeof Twilio>> | null = null;
  private phoneNumberPromise: Promise<string> | null = null;

  constructor(accountSid: string, authToken: string, phoneNumber: string, useReplitIntegration = false) {
    this.phoneNumber = phoneNumber;
    this.useReplitIntegration = useReplitIntegration;
    
    // If using manual credentials
    if (!useReplitIntegration && accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
    }
  }

  /**
   * Get Twilio client (lazy-loads from Replit integration if enabled)
   * Caches the result onto this.client for subsequent synchronous access
   */
  private async getClient(): Promise<ReturnType<typeof Twilio> | null> {
    if (this.useReplitIntegration) {
      // Check if already cached from previous async call
      if (this.client) {
        return this.client;
      }
      
      // Lazy-load client from Replit integration
      if (!this.clientPromise) {
        this.clientPromise = getTwilioClient()
          .then(client => {
            // Cache the resolved client for synchronous access
            if (client) {
              this.client = client;
            }
            return client;
          })
          .catch(error => {
            logger.error('Failed to get Twilio client from Replit integration:', error);
            throw error;
          });
      }
      return this.clientPromise;
    }
    return this.client;
  }

  /**
   * Get phone number (lazy-loads from Replit integration if enabled)
   * Caches the result onto this.phoneNumber for subsequent synchronous access
   * 
   * Priority:
   * 1. TWILIO_PHONE_NUMBER env var (allows override even when using Replit integration)
   * 2. Replit integration phone number (if useReplitIntegration is true)
   * 3. Constructor-provided phone number
   */
  private async getPhoneNumber(): Promise<string> {
    // Priority 1: Check for env var override (allows using different number with Replit auth)
    const envPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    if (envPhoneNumber) {
      if (this.phoneNumber !== envPhoneNumber) {
        logger.log(`📱 Using TWILIO_PHONE_NUMBER env var override: ${envPhoneNumber}`);
        this.phoneNumber = envPhoneNumber;
      }
      return this.phoneNumber;
    }

    if (this.useReplitIntegration) {
      // Check if already cached from previous async call
      if (this.phoneNumber) {
        return this.phoneNumber;
      }
      
      // Lazy-load phone number from Replit integration
      if (!this.phoneNumberPromise) {
        this.phoneNumberPromise = getTwilioFromPhoneNumber()
          .then(phoneNumber => {
            // Cache the resolved phone number for synchronous access
            if (phoneNumber) {
              this.phoneNumber = phoneNumber;
            }
            return phoneNumber;
          })
          .catch(error => {
            logger.error('Failed to get Twilio phone number from Replit integration:', error);
            return '';
          });
      }
      return this.phoneNumberPromise;
    }
    return this.phoneNumber;
  }

  isConfigured(): boolean {
    if (this.useReplitIntegration) {
      // For Replit integration, we'll check lazily
      return true;
    }
    return !!this.client && !!this.phoneNumber;
  }

  validateConfig(): { isValid: boolean; missingItems: string[] } {
    if (this.useReplitIntegration) {
      // Replit integration handles validation dynamically
      return {
        isValid: true,
        missingItems: []
      };
    }

    const missingItems: string[] = [];
    
    if (!process.env.TWILIO_ACCOUNT_SID) missingItems.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missingItems.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_PHONE_NUMBER) missingItems.push('TWILIO_PHONE_NUMBER');

    return {
      isValid: missingItems.length === 0,
      missingItems
    };
  }

  supportsVerification(): boolean {
    return true; // Twilio supports all SMS functionality
  }

  getFromNumber(): string | null {
    return this.phoneNumber || null;
  }

  /**
   * Get the Twilio phone number SID for the configured phone number
   * Works with both manual credentials and Replit integration
   */
  async getPhoneNumberSid(): Promise<string | null> {
    try {
      // Use async helpers to support Replit integration
      const client = await this.getClient();
      const phoneNumber = await this.getPhoneNumber();

      if (!client || !phoneNumber) {
        return null;
      }

      // Search for the phone number to get its SID
      const phoneNumbers = await client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber,
        limit: 1
      });

      if (phoneNumbers.length > 0) {
        return phoneNumbers[0].sid;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching phone number SID:', error);
      return null;
    }
  }

  /**
   * Get the underlying Twilio client synchronously (for advanced operations)
   * Note: This only returns the cached client and won't trigger Replit integration fetch
   * Use the private async getClient() for full support
   */
  getClientSync(): ReturnType<typeof Twilio> | null {
    return this.client;
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    try {
      // Get client and phone number (supports both integration and manual config)
      const client = await this.getClient();
      const phoneNumber = await this.getPhoneNumber();

      logger.log(`📱 SMS Debug: useReplitIntegration=${this.useReplitIntegration}, hasClient=${!!client}, phoneNumber=${phoneNumber}`);

      if (!client) {
        return {
          success: false,
          message: 'Twilio SMS service not configured - missing credentials',
          error: 'MISSING_CONFIG'
        };
      }

      if (!phoneNumber) {
        return {
          success: false,
          message: 'Twilio SMS service not configured - missing phone number',
          error: 'MISSING_PHONE'
        };
      }

      logger.log(`📱 Attempting to send SMS from ${phoneNumber} to ${message.to}`);

      const result = await client.messages.create({
        body: message.body,
        from: phoneNumber,
        to: message.to,
      });

      logger.log(`✅ SMS sent via Twilio ${this.useReplitIntegration ? '(Replit integration)' : ''} to ${message.to} (${result.sid})`);

      return {
        success: true,
        message: `SMS sent successfully via Twilio to ${message.to}`,
        messageId: result.sid,
        sentTo: message.to
      };
    } catch (error) {
      logger.error('Twilio SMS error:', error);
      return {
        success: false,
        message: `Twilio error: ${(error as Error).message}`,
        error: (error as Error).message
      };
    }
  }
}