/**
 * Sentry Error Tracking and Performance Monitoring
 *
 * Provides comprehensive error tracking, performance monitoring,
 * and distributed tracing capabilities.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Application } from 'express';
import logger from '../utils/logger';

/**
 * Initialize Sentry monitoring
 * Should be called before any other application code
 */
export function initializeSentry(app?: Application): void {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  // Skip initialization in test environment or if DSN not provided
  if (environment === 'test' || !sentryDsn) {
    logger.warn('Sentry not initialized', {
      reason: !sentryDsn ? 'SENTRY_DSN not configured' : 'test environment',
      environment
    });
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn,
      environment,

      // Enable performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

      // Enable profiling
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,

      integrations: [
        // Profiling integration
        nodeProfilingIntegration(),

        // HTTP integration for Express
        ...(app ? [
          Sentry.httpIntegration({
            tracing: {
              // Don't trace health check endpoints
              shouldCreateSpanForRequest: (url) => {
                return !url.includes('/health') && !url.includes('/metrics');
              },
            },
          }),
        ] : []),

        // PostgreSQL integration
        Sentry.postgresIntegration(),

        // Console integration for logging
        Sentry.consoleIntegration(),
      ],

      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive query parameters
        if (event.request?.query_string) {
          const sensitiveParams = ['password', 'token', 'api_key', 'secret'];
          sensitiveParams.forEach(param => {
            if (event.request?.query_string?.includes(param)) {
              event.request.query_string = event.request.query_string.replace(
                new RegExp(`${param}=[^&]*`, 'gi'),
                `${param}=[REDACTED]`
              );
            }
          });
        }

        return event;
      },

      // Ignore certain errors
      ignoreErrors: [
        // Network errors
        'NetworkError',
        'Network request failed',
        'Failed to fetch',

        // Client-side errors that shouldn't be tracked server-side
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',

        // Common expected errors
        'AbortError',
        'cancelled',
      ],

      // Release tracking
      release: process.env.SENTRY_RELEASE || `sandwich-platform@${process.env.npm_package_version || 'unknown'}`,

      // Server name for better grouping
      serverName: process.env.HOSTNAME || 'sandwich-platform-server',
    });

    logger.info('Sentry initialized successfully', {
      environment,
      release: Sentry.getCurrentScope().getClient()?.getOptions().release,
    });
  } catch (error) {
    logger.error('Failed to initialize Sentry', { error });
  }
}

/**
 * Capture an exception with additional context
 */
export function captureException(error: Error, context?: Record<string, any>): string {
  return Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null): void {
  Sentry.setUser(user);
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
    timestamp: Date.now() / 1000,
  });
}


/**
 * Wrap async function with error handling
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error);
      throw error;
    }
  }) as T;
}

/**
 * Express error handler middleware
 * Should be registered AFTER all routes
 */
export const sentryErrorHandler = Sentry.setupExpressErrorHandler;

/**
 * Express request handler middleware
 * Should be registered BEFORE all routes
 */
export const sentryRequestHandler = Sentry.setupExpressRequestHandler;

export { Sentry };
