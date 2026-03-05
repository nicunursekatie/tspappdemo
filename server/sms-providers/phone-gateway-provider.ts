/**
 * Phone Gateway SMS Provider
 * Sends SMS via HTTP requests to Android SMS gateway apps
 * Supports apps like SMS Sender, SMSMobileAPI, etc.
 */

import { SMSProvider, SMSMessage, SMSResult } from './types';

export class PhoneGatewayProvider implements SMSProvider {
  name = 'phone_gateway';
  
  private gatewayUrl: string;
  private apiKey?: string;
  private deviceNumber?: string;
  private timeout: number;

  constructor(
    gatewayUrl: string,
    apiKey?: string,
    deviceNumber?: string,
    timeout: number = 30000
  ) {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
    this.deviceNumber = deviceNumber;
    this.timeout = timeout;
  }

  isConfigured(): boolean {
    return !!this.gatewayUrl;
  }

  validateConfig(): { isValid: boolean; missingItems: string[] } {
    const missingItems: string[] = [];
    
    if (!this.gatewayUrl) {
      missingItems.push('PHONE_GATEWAY_URL');
    }

    // Check for recommended but optional configuration
    const warnings: string[] = [];
    if (!this.deviceNumber) {
      warnings.push('PHONE_GATEWAY_DEVICE_NUMBER (recommended for better tracking)');
    }
    if (!this.apiKey) {
      warnings.push('PHONE_GATEWAY_API_KEY (recommended for security)');
    }

    return {
      isValid: missingItems.length === 0,
      missingItems,
      warnings
    };
  }

  supportsVerification(): boolean {
    return true; // Phone gateway supports all SMS functionality
  }

  /**
   * Perform health check / handshake with the phone gateway
   */
  async healthCheck(): Promise<{ success: boolean; message: string; responseTime?: number; deviceInfo?: any }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Phone gateway not configured - missing gateway URL'
      };
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SandwichProject/1.0'
      };

      // Add API key if provided
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['X-API-Key'] = this.apiKey;
      }

      // Try different health check endpoints that common gateway apps use
      const healthEndpoints = [
        '/health',
        '/status',
        '/ping',
        '/info',
        '/' // Some gateways respond to root with status info
      ];

      let lastError = 'No health check endpoints responded';
      
      for (const endpoint of healthEndpoints) {
        try {
          const healthUrl = this.gatewayUrl.replace(/\/$/, '') + endpoint;
          
          const response = await fetch(healthUrl, {
            method: 'GET',
            headers,
            signal: controller.signal
          });

          const responseTime = Date.now() - startTime;
          clearTimeout(timeoutId);

          if (response.ok) {
            const deviceInfo = await response.json().catch(() => ({ status: 'online' }));
            
            return {
              success: true,
              message: `Phone gateway is healthy (${endpoint})`,
              responseTime,
              deviceInfo
            };
          } else {
            lastError = `HTTP ${response.status} from ${endpoint}`;
          }
        } catch (endpointError) {
          lastError = `${endpoint}: ${(endpointError as Error).message}`;
          continue; // Try next endpoint
        }
      }

      clearTimeout(timeoutId);
      
      // If no health endpoints work, try sending a test payload to the main URL
      try {
        const testPayload = {
          phone: '+10000000000', // Invalid test number
          message: 'HEALTH_CHECK_TEST',
          test: true
        };

        const response = await fetch(this.gatewayUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(testPayload),
          signal: controller.signal
        });

        const responseTime = Date.now() - startTime;
        
        if (response.ok || response.status === 400) {
          // 400 is acceptable for invalid test number
          return {
            success: true,
            message: 'Phone gateway is reachable (via SMS endpoint)',
            responseTime,
            deviceInfo: { endpoint_test: true }
          };
        }
      } catch {
        // Continue to error handling below
      }

      return {
        success: false,
        message: `Phone gateway unreachable: ${lastError}`
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as any).name === 'AbortError') {
        return {
          success: false,
          message: `Health check timeout after ${this.timeout}ms`
        };
      }
      
      return {
        success: false,
        message: `Health check failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get device information and status
   */
  async getDeviceInfo(): Promise<{ success: boolean; deviceInfo?: any; message: string }> {
    const healthResult = await this.healthCheck();
    
    if (healthResult.success) {
      return {
        success: true,
        deviceInfo: {
          ...healthResult.deviceInfo,
          gatewayUrl: this.gatewayUrl,
          deviceNumber: this.deviceNumber,
          hasApiKey: !!this.apiKey,
          timeout: this.timeout,
          responseTime: healthResult.responseTime
        },
        message: 'Device info retrieved successfully'
      };
    } else {
      return {
        success: false,
        message: healthResult.message
      };
    }
  }

  getFromNumber(): string | null {
    return this.deviceNumber || null;
  }

  async sendSMS(message: SMSMessage): Promise<SMSResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Phone gateway not configured - missing gateway URL',
        error: 'MISSING_CONFIG'
      };
    }

    try {
      // Prepare request payload - supports multiple common gateway formats
      const payload = this.preparePayload(message);
      
      const response = await this.makeRequest(payload);
      
      if (response.success) {
        console.log(`✅ SMS sent via phone gateway to ${message.to}`);
        return {
          success: true,
          message: `SMS sent successfully via phone gateway to ${message.to}`,
          messageId: response.messageId || `gateway_${Date.now()}`,
          sentTo: message.to
        };
      } else {
        console.error(`❌ Phone gateway SMS failed: ${response.error}`);
        return {
          success: false,
          message: response.error || 'Failed to send SMS via phone gateway',
          error: response.error
        };
      }
    } catch (error) {
      console.error('Phone gateway SMS error:', error);
      return {
        success: false,
        message: `Phone gateway error: ${(error as Error).message}`,
        error: (error as Error).message
      };
    }
  }

  private preparePayload(message: SMSMessage): any {
    // Support multiple common SMS gateway app formats
    return {
      // SMS Sender / SMSMobileAPI format
      phone: message.to,
      message: message.body,
      
      // Alternative formats for compatibility
      to: message.to,
      text: message.body,
      body: message.body,
      number: message.to,
      
      // Metadata
      timestamp: new Date().toISOString(),
      source: 'sandwich_project'
    };
  }

  private async makeRequest(payload: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SandwichProject/1.0'
      };

      // Add API key if provided
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        headers['X-API-Key'] = this.apiKey;
      }

      const response = await fetch(this.gatewayUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      
      // Handle different response formats from various gateway apps
      if (result.success !== false && result.error === undefined) {
        return {
          success: true,
          messageId: result.id || result.messageId || result.message_id || `gw_${Date.now()}`
        };
      } else {
        return {
          success: false,
          error: result.error || result.message || 'Gateway returned error'
        };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if ((error as any).name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${this.timeout}ms`
        };
      }
      
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}