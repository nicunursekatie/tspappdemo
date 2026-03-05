/**
 * Common types and interfaces for SMS providers
 */

export interface SMSMessage {
  to: string;
  body: string;
  from?: string; // Optional for phone gateway (uses device number)
}

export interface SMSResult {
  success: boolean;
  message: string;
  messageId?: string;
  sentTo?: string;
  error?: string;
}

export interface SMSProvider {
  name: string;
  isConfigured(): boolean;
  validateConfig(): { isValid: boolean; missingItems: string[] };
  sendSMS(message: SMSMessage): Promise<SMSResult>;
  supportsVerification(): boolean;
  getFromNumber?(): string | null;
}

export interface SMSProviderConfig {
  provider: 'twilio' | 'phone_gateway';
  twilio?: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    useReplitIntegration?: boolean;
  };
  phoneGateway?: {
    gatewayUrl: string;
    apiKey?: string;
    deviceNumber?: string;
    timeout?: number;
  };
}