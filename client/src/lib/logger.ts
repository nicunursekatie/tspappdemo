/**
 * Production-safe logger utility
 *
 * In production, only errors are logged to avoid console noise and performance impact.
 * In development, all log levels work normally.
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Debug-level logging - only in development
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Warning-level logging - only in development
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Error-level logging - always logged
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info-level logging - only in development
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Debug group - only in development
   */
  group: (label: string) => {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End debug group - only in development
   */
  groupEnd: () => {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Debug table - only in development
   */
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  },
};
