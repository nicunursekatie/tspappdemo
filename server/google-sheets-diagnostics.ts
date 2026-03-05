import { google } from 'googleapis';
import { logger } from './utils/production-safe-logger';

export interface DiagnosticResult {
  issue: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  solution: string;
  detailsFound?: any;
}

export class GoogleSheetsDiagnostics {
  async runFullDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];

    logger.log('🔍 Starting comprehensive Google Sheets diagnostics...');

    // Check 1: Environment Variables
    results.push(...this.checkEnvironmentVariables());

    // Check 2: Private Key Format
    results.push(...this.checkPrivateKeyFormat());

    // Check 3: Service Account Configuration
    results.push(...(await this.checkServiceAccountConfiguration()));

    // Check 4: Project ID and Email Validation
    results.push(...this.validateServiceAccountDetails());

    logger.log('🔍 Diagnostics complete. Found', results.length, 'issues.');

    return results;
  }

  private checkEnvironmentVariables(): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    const requiredVars = [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_PROJECT_ID',
      'GOOGLE_SPREADSHEET_ID',
      'EVENT_REQUESTS_SHEET_ID',
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        results.push({
          issue: `Missing Environment Variable: ${varName}`,
          severity: 'critical',
          description: `Required environment variable ${varName} is not set`,
          solution: `Set the ${varName} environment variable in your Replit Secrets`,
        });
      } else if (varName === 'GOOGLE_PRIVATE_KEY' && value.length < 1000) {
        results.push({
          issue: 'Private Key Too Short',
          severity: 'critical',
          description: `GOOGLE_PRIVATE_KEY appears to be incomplete (${value.length} characters)`,
          solution:
            'Verify you copied the complete private key from your Google Cloud service account JSON file',
          detailsFound: { length: value.length },
        });
      } else if (
        varName === 'GOOGLE_SERVICE_ACCOUNT_EMAIL' &&
        !value.includes('@')
      ) {
        results.push({
          issue: 'Invalid Service Account Email',
          severity: 'critical',
          description: `Service account email "${value}" is not a valid email format`,
          solution:
            'Use the email from your Google Cloud service account (should end with @your-project.iam.gserviceaccount.com)',
          detailsFound: { email: value },
        });
      }
    }

    return results;
  }

  private checkPrivateKeyFormat(): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (!privateKey) return results;

    logger.log('🔍 Analyzing private key format...');

    // Check for common formatting issues
    const hasEscapedNewlines = privateKey.includes('\\n');
    const hasRealNewlines = privateKey.includes('\n');
    const hasBeginHeader = privateKey.includes('-----BEGIN PRIVATE KEY-----');
    const hasEndHeader = privateKey.includes('-----END PRIVATE KEY-----');
    const isWrappedInQuotes =
      (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"));

    if (!hasBeginHeader || !hasEndHeader) {
      results.push({
        issue: 'Missing PEM Headers',
        severity: 'critical',
        description: 'Private key is missing proper PEM format headers',
        solution:
          'Ensure your private key starts with "-----BEGIN PRIVATE KEY-----" and ends with "-----END PRIVATE KEY-----"',
        detailsFound: { hasBeginHeader, hasEndHeader },
      });
    }

    if (hasEscapedNewlines && !hasRealNewlines) {
      results.push({
        issue: 'Escaped Newlines in Private Key',
        severity: 'warning',
        description:
          'Private key contains escaped \\n instead of real newlines',
        solution:
          'The application will auto-convert these, but consider updating your key format',
        detailsFound: { hasEscapedNewlines, hasRealNewlines },
      });
    }

    if (isWrappedInQuotes) {
      results.push({
        issue: 'Private Key Wrapped in Quotes',
        severity: 'warning',
        description:
          'Private key is wrapped in quotes which may cause parsing issues',
        solution: 'Remove surrounding quotes from your private key',
        detailsFound: { isWrappedInQuotes },
      });
    }

    // Check line count (typical RSA 2048 key has ~27-30 lines)
    const lines = privateKey
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);
    if (lines.length < 25 || lines.length > 35) {
      results.push({
        issue: 'Unusual Private Key Line Count',
        severity: 'warning',
        description: `Private key has ${lines.length} lines (expected 25-35 for RSA 2048)`,
        solution:
          'Verify this is a complete RSA private key. Consider regenerating if suspicious.',
        detailsFound: { lineCount: lines.length },
      });
    }

    return results;
  }

  private async checkServiceAccountConfiguration(): Promise<
    DiagnosticResult[]
  > {
    const results: DiagnosticResult[] = [];

    try {
      logger.log('🔍 Testing service account configuration...');

      const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY;
      const projectId = process.env.GOOGLE_PROJECT_ID;

      if (!clientEmail || !privateKey || !projectId) {
        return results; // Already handled in environment check
      }

      // Clean the private key using the same logic as the main service
      let cleanPrivateKey = privateKey;
      if (cleanPrivateKey.includes('\\n')) {
        cleanPrivateKey = cleanPrivateKey.replace(/\\n/g, '\n');
      }
      if (
        (cleanPrivateKey.startsWith('"') && cleanPrivateKey.endsWith('"')) ||
        (cleanPrivateKey.startsWith("'") && cleanPrivateKey.endsWith("'"))
      ) {
        cleanPrivateKey = cleanPrivateKey.slice(1, -1);
      }

      // Test token generation without API call
      try {
        const credentials = {
          type: 'service_account',
          project_id: projectId,
          private_key_id: '',
          private_key: cleanPrivateKey,
          client_email: clientEmail,
          client_id: '',
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          auth_provider_x509_cert_url:
            'https://www.googleapis.com/oauth2/v1/certs',
        };

        const auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const authClient = await auth.getClient();
        logger.log('✅ Service account client created successfully');

        // Try to get an access token without making API calls
        const accessToken = await authClient.getAccessToken();

        if (accessToken.token) {
          logger.log('✅ Access token generated successfully');
          results.push({
            issue: 'Service Account Working',
            severity: 'info',
            description:
              'Service account can generate access tokens successfully',
            solution: 'No action needed for service account configuration',
          });
        } else {
          results.push({
            issue: 'Failed to Generate Access Token',
            severity: 'critical',
            description:
              'Service account exists but cannot generate access tokens',
            solution:
              'Check if the service account key is expired or revoked in Google Cloud Console',
          });
        }
      } catch (tokenError) {
        logger.error('❌ Token generation failed:', tokenError.message);

        if (tokenError.message.includes('invalid_grant')) {
          results.push({
            issue: 'Invalid Service Account Grant',
            severity: 'critical',
            description: 'Google rejected the service account credentials',
            solution:
              'Service account key may be expired, revoked, or from wrong project. Generate new key in Google Cloud Console.',
            detailsFound: { error: tokenError.message },
          });
        } else if (
          tokenError.message.includes('DECODER') ||
          tokenError.message.includes('OSSL_UNSUPPORTED')
        ) {
          results.push({
            issue: 'Private Key Encoding Issue',
            severity: 'critical',
            description: 'Private key format is incompatible with Node.js v20',
            solution:
              'Regenerate service account key in Google Cloud Console (newer keys are Node.js v20 compatible)',
            detailsFound: { error: tokenError.message },
          });
        } else {
          results.push({
            issue: 'Unknown Authentication Error',
            severity: 'critical',
            description: `Authentication failed: ${tokenError.message}`,
            solution:
              'Check Google Cloud Console for service account status and regenerate key if needed',
            detailsFound: { error: tokenError.message },
          });
        }
      }
    } catch (error) {
      results.push({
        issue: 'Service Account Test Failed',
        severity: 'critical',
        description: `Cannot test service account: ${error.message}`,
        solution: 'Verify all credentials are properly set and formatted',
        detailsFound: { error: error.message },
      });
    }

    return results;
  }

  private validateServiceAccountDetails(): DiagnosticResult[] {
    const results: DiagnosticResult[] = [];

    const projectId = process.env.GOOGLE_PROJECT_ID;
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (projectId && clientEmail) {
      // Verify email matches project ID format
      const expectedDomain = `${projectId}.iam.gserviceaccount.com`;
      if (!clientEmail.endsWith(expectedDomain)) {
        results.push({
          issue: 'Service Account Email/Project Mismatch',
          severity: 'critical',
          description: `Service account email "${clientEmail}" does not match project ID "${projectId}"`,
          solution: `Expected email format: *@${expectedDomain}. Verify both values are from the same Google Cloud project.`,
          detailsFound: { projectId, clientEmail, expectedDomain },
        });
      }
    }

    return results;
  }

  printDiagnosticReport(results: DiagnosticResult[]) {
    logger.log('\n📋 GOOGLE SHEETS AUTHENTICATION DIAGNOSTIC REPORT');
    logger.log('='.repeat(60));

    const critical = results.filter((r) => r.severity === 'critical');
    const warnings = results.filter((r) => r.severity === 'warning');
    const info = results.filter((r) => r.severity === 'info');

    if (critical.length === 0) {
      logger.log('✅ No critical issues found');
    } else {
      logger.log(`❌ ${critical.length} CRITICAL ISSUES FOUND:`);
      critical.forEach((result, i) => {
        logger.log(`\n${i + 1}. ${result.issue}`);
        logger.log(`   Problem: ${result.description}`);
        logger.log(`   Solution: ${result.solution}`);
        if (result.detailsFound) {
          logger.log(
            `   Details: ${JSON.stringify(result.detailsFound, null, 2)}`
          );
        }
      });
    }

    if (warnings.length > 0) {
      logger.log(`\n⚠️  ${warnings.length} WARNINGS:`);
      warnings.forEach((result, i) => {
        logger.log(`${i + 1}. ${result.issue}: ${result.description}`);
      });
    }

    if (info.length > 0) {
      logger.log(`\n💡 ${info.length} INFO:`);
      info.forEach((result, i) => {
        logger.log(`${i + 1}. ${result.issue}: ${result.description}`);
      });
    }

    logger.log('\n🔧 NEXT STEPS:');
    if (critical.length > 0) {
      logger.log('1. Fix all CRITICAL issues listed above');
      logger.log('2. Restart the application to test the fixes');
      logger.log('3. Try a manual sync to verify functionality');
    } else {
      logger.log('1. Address any warnings if needed');
      logger.log('2. Authentication should be working - test manual sync');
    }

    logger.log('\n📍 Google Cloud Console Links:');
    logger.log(
      '- Service Accounts: https://console.cloud.google.com/iam-admin/serviceaccounts'
    );
    logger.log(
      '- API Credentials: https://console.cloud.google.com/apis/credentials'
    );
    logger.log(
      '- Sheets API: https://console.cloud.google.com/apis/library/sheets.googleapis.com'
    );

    logger.log('='.repeat(60));
  }
}

// Export singleton
export const googleSheetsDiagnostics = new GoogleSheetsDiagnostics();
