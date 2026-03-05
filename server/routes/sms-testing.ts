import { Router } from 'express';
import { isAuthenticated } from '../auth';
import { requirePermission } from '../middleware/auth';
import {
  sendTestSMS,
  sendSMSReminder,
  sendWeeklyReminderSMS,
  validateSMSConfig,
} from '../sms-service';
import { z } from 'zod';
import { logger } from '../utils/production-safe-logger';

const router = Router();

const testSMSSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  message: z.string().optional(),
});

const reminderSMSSchema = z.object({
  hostLocation: z.string().min(1, 'Host location is required'),
});

/**
 * Get SMS configuration status
 */
router.get(
  '/sms/config',
  isAuthenticated,
  requirePermission('USERS_EDIT'),
  async (req, res) => {
    try {
      const config = validateSMSConfig();

      // Test SMS provider connection if configured
      let twilioStatus = 'not_configured';
      let twilioError = null;

      if (config.isConfigured && config.provider) {
        try {
          // Use the provider factory to get the configured provider
          const { SMSProviderFactory } = await import('../sms-providers/provider-factory');
          const factory = SMSProviderFactory.getInstance();
          const provider = await factory.getProviderAsync();

          if (provider && provider.isConfigured()) {
            // For Twilio provider, test the connection
            if (provider.name === 'twilio') {
              // Check if using Replit integration or manual credentials
              const { isReplitEnvironmentAvailable } = await import('../sms-providers/replit-twilio-connector');
              const usingReplit = isReplitEnvironmentAvailable();

              if (usingReplit) {
                // Test via Replit integration
                const { getTwilioClient } = await import('../sms-providers/replit-twilio-connector');
                const client = await getTwilioClient();
                if (client) {
                  twilioStatus = 'connected';
                  logger.log('✅ Twilio connection successful (Replit integration)');
                } else {
                  twilioStatus = 'error';
                  twilioError = 'Failed to initialize Twilio client via Replit';
                }
              } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                // Test via manual credentials
                const Twilio = await import('twilio');
                const client = Twilio.default(
                  process.env.TWILIO_ACCOUNT_SID,
                  process.env.TWILIO_AUTH_TOKEN
                );

                // Try to fetch account info to verify credentials
                const account = await client.api
                  .accounts(process.env.TWILIO_ACCOUNT_SID)
                  .fetch();
                twilioStatus = 'connected';
                logger.log('✅ Twilio connection successful:', account.friendlyName);
              } else {
                twilioStatus = 'error';
                twilioError = 'No Twilio credentials available';
              }
            } else {
              // For other providers (like phone_gateway), just mark as connected if configured
              twilioStatus = 'connected';
              logger.log(`✅ ${provider.name} provider configured`);
            }
          } else {
            twilioStatus = 'not_configured';
            twilioError = 'SMS provider not properly configured';
          }
        } catch (err: any) {
          twilioStatus = 'error';
          twilioError = err.message;
          logger.error('❌ SMS provider connection error:', err);
        }
      }

      res.json({
        isConfigured: config.isConfigured,
        missingItems: config.missingItems,
        provider: config.provider || 'none',
        twilioInitialized:
          !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
        twilioStatus,
        twilioError,
        twilioPhone: process.env.TWILIO_PHONE_NUMBER
          ? process.env.TWILIO_PHONE_NUMBER.substring(0, 3) +
            '****' +
            process.env.TWILIO_PHONE_NUMBER.slice(-4)
          : null,
        environment: {
          hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
          hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
          hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER,
          hasReplitIntegration: (await import('../sms-providers/replit-twilio-connector')).isReplitEnvironmentAvailable(),
        },
      });
    } catch (error: any) {
      logger.error('Error checking SMS configuration:', error);
      res.status(500).json({
        error: 'Failed to check SMS configuration',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Send test SMS
 */
router.post(
  '/sms/test',
  isAuthenticated,
  requirePermission('USERS_EDIT'),
  async (req, res) => {
    try {
      const { phoneNumber, message } = testSMSSchema.parse(req.body);
      const appUrl = process.env.PUBLIC_APP_URL ||
        (process.env.REPLIT_DOMAIN
          ? `https://${process.env.REPLIT_DOMAIN}`
          : req.headers.origin || 'https://sandwich-project-platform-final-katielong2316.replit.app');

      logger.log(
        `🧪 Sending test SMS to ${phoneNumber} from user ${req.user?.email}`
      );

      const result = await sendTestSMS(phoneNumber, appUrl);

      if (result.success) {
        logger.log(`✅ Test SMS sent successfully to ${phoneNumber}`);
      } else {
        logger.error(`❌ Test SMS failed: ${result.message}`);
      }

      res.json(result);
    } catch (error) {
      logger.error('Error sending test SMS:', error);

      if ((error as any).name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid request data',
          details: (error as any).errors,
        });
      }

      res.status(500).json({
        error: 'Failed to send test SMS',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Send SMS reminder for a specific host location
 */
router.post(
  '/sms/reminder',
  isAuthenticated,
  requirePermission('USERS_EDIT'),
  async (req, res) => {
    try {
      const { hostLocation } = reminderSMSSchema.parse(req.body);
      const appUrl = process.env.PUBLIC_APP_URL ||
        (process.env.REPLIT_DOMAIN
          ? `https://${process.env.REPLIT_DOMAIN}`
          : req.headers.origin || 'https://sandwich-project-platform-final-katielong2316.replit.app');

      logger.log(
        `📱 Sending SMS reminder for location "${hostLocation}" from user ${req.user?.email}`
      );

      const result = await sendSMSReminder(hostLocation, appUrl);

      if (result.success) {
        logger.log(
          `✅ SMS reminder sent for ${hostLocation}: ${result.message}`
        );
      } else {
        logger.error(
          `❌ SMS reminder failed for ${hostLocation}: ${result.message}`
        );
      }

      res.json(result);
    } catch (error) {
      logger.error('Error sending SMS reminder:', error);

      if ((error as any).name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid request data',
          details: (error as any).errors,
        });
      }

      res.status(500).json({
        error: 'Failed to send SMS reminder',
        message: (error as Error).message,
      });
    }
  }
);

/**
 * Send SMS reminders for multiple missing locations
 */
router.post(
  '/sms/weekly-reminders',
  isAuthenticated,
  requirePermission('USERS_EDIT'),
  async (req, res) => {
    try {
      const { missingLocations } = z
        .object({
          missingLocations: z
            .array(z.string())
            .min(1, 'At least one location is required'),
        })
        .parse(req.body);

      const appUrl = process.env.PUBLIC_APP_URL ||
        (process.env.REPLIT_DOMAIN
          ? `https://${process.env.REPLIT_DOMAIN}`
          : req.headers.origin || 'https://sandwich-project-platform-final-katielong2316.replit.app');

      logger.log(
        `📱 Sending weekly SMS reminders for ${missingLocations.length} locations from user ${req.user?.email}`
      );

      const results = await sendWeeklyReminderSMS(missingLocations, appUrl);

      // Count successes and failures
      const locationResults = Object.entries(results);
      const successCount = locationResults.filter(
        ([_, result]) => result.success
      ).length;
      const failureCount = locationResults.length - successCount;

      logger.log(
        `✅ Weekly SMS reminders completed: ${successCount} successes, ${failureCount} failures`
      );

      res.json({
        success: successCount > 0,
        message: `SMS reminders sent: ${successCount}/${locationResults.length} locations processed`,
        results: results,
        summary: {
          total: locationResults.length,
          successful: successCount,
          failed: failureCount,
        },
      });
    } catch (error) {
      logger.error('Error sending weekly SMS reminders:', error);

      if ((error as any).name === 'ZodError') {
        return res.status(400).json({
          error: 'Invalid request data',
          details: (error as any).errors,
        });
      }

      res.status(500).json({
        error: 'Failed to send weekly SMS reminders',
        message: (error as Error).message,
      });
    }
  }
);

export { router as smsTestingRoutes };
