/**
 * Production-safe console wrapper for server-side logging
 *
 * This wrapper ensures console.* statements only run in development,
 * preventing log pollution and performance overhead in production.
 *
 * Usage:
 *   import { logger } from './utils/production-safe-logger';
 *   logger.log('Debug message');      // Only in development
 *   logger.error('Error message');    // Always logged
 */

import winstonLogger, { createServiceLogger } from './logger';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Helper to serialize arguments including error objects
 */
const serializeArgs = (args: any[]): string => {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack || ''}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          const seen = new WeakSet();
          return JSON.stringify(
            arg,
            (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return '[Circular]';
                }
                seen.add(value);
              }
              return value;
            },
            2
          );
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
};

/**
 * Production-safe logger that wraps both console and Winston
 * - In development: Uses console for immediate feedback
 * - In production: Uses Winston with proper log levels and rotation
 */
export const logger = {
  /**
   * Debug-level logging - development only
   * In production, these are silent to reduce noise
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Debug-level logging - development only
   * Same as .log() but semantically clearer
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Info-level logging - logged to Winston in production
   * Use for important operational information
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    } else {
      const serialized = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack || ''}`;
          }
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
      winstonLogger.info(serialized);
    }
  },

  /**
   * Warning-level logging - logged to Winston in production
   * Use for recoverable errors or concerning situations
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    } else {
      const serialized = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack || ''}`;
          }
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
      winstonLogger.warn(serialized);
    }
  },

  /**
   * Error-level logging - always logged
   * Logged to console in dev, Winston in production
   */
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    } else {
      // Properly serialize errors and objects for production logging
      const serialized = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack || ''}`;
          }
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');
      winstonLogger.error(serialized);
    }
  },

  /**
   * Table output - development only
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },

  /**
   * Group output - development only
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End group - development only
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },
};

/**
 * Export Winston utilities for structured logging
 */
export { createServiceLogger, winstonLogger };

/**
 * Helper for timing operations
 */
export const timeOperation = async <T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> => {
  const start = Date.now();
  try {
    const result = await operation();
    const duration = Date.now() - start;
    logger.debug(`${label} took ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`${label} failed after ${duration}ms:`, error);
    throw error;
  }
};

export default logger;
