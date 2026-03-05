import sgMail from '@sendgrid/mail';
import { logger } from '../utils/production-safe-logger';

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  logger.warn('⚠️  SENDGRID_API_KEY not found in environment variables');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.log('✅ SendGrid configured successfully');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SendGrid API key not configured');
    }

    const msg: sgMail.MailDataRequired = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || params.text?.replace(/\n/g, '<br>') || '',
    };

    await sgMail.send(msg);
    logger.log(`✅ Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    logger.error('❌ SendGrid email error:', error);

    // Log more details for debugging
    if ((error as any).response?.body) {
      logger.error('SendGrid error details:', (error as any).response.body);
    }

    throw error;
  }
}

export async function sendBulkEmail(
  emails: EmailParams[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const email of emails) {
    try {
      await sendEmail(email);
      success++;
    } catch (error) {
      failed++;
      errors.push(`Failed to send to ${email.to}: ${(error as Error).message}`);
    }
  }

  return { success, failed, errors };
}
