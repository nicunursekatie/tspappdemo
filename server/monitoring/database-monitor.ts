/**
 * Database Query Performance Monitor
 *
 * Wraps database operations to track query performance and errors
 */

import { recordDbQuery } from './metrics';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

/**
 * Wrap a database operation with monitoring (async version)
 * Executes the query INSIDE a Sentry span for proper tracing
 */
export async function monitorDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan({
    op: 'db.query',
    name: `${operation} ${table}`,
    attributes: {
      'db.operation': operation,
      'db.table': table,
    },
  }, async () => {
    const startTime = process.hrtime.bigint();
    
    try {
      // Execute the database query INSIDE the span
      const result = await fn();
      
      // Calculate duration
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      
      // Record metrics
      recordDbQuery(operation, table, duration, true);
      
      // Log slow queries
      if (duration > 0.5) {
        logger.warn('Slow database query detected', {
          operation,
          table,
          duration: `${duration.toFixed(3)}s`,
        });
      }
      
      return result;
    } catch (error) {
      // Calculate duration even on error
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      
      // Record error metrics
      recordDbQuery(operation, table, duration, false, error as Error);
      
      // Log error
      logger.error('Database query error', {
        operation,
        table,
        duration: `${duration.toFixed(3)}s`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      
      // Capture in Sentry
      Sentry.captureException(error, {
        extra: {
          operation,
          table,
          duration,
        },
      });
      
      throw error;
    }
  });
}

/**
 * Wrap a database operation with monitoring (sync version)
 * Executes the query INSIDE a Sentry span for proper tracing
 */
export function monitorDbOperationSync<T>(
  operation: string,
  table: string,
  fn: () => T,
): T {
  return Sentry.startSpan({
    op: 'db.query',
    name: `${operation} ${table}`,
    attributes: {
      'db.operation': operation,
      'db.table': table,
    },
  }, () => {
    const startTime = process.hrtime.bigint();
    
    try {
      // Execute the database query INSIDE the span
      const result = fn();
      
      // Calculate duration
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      
      // Record metrics
      recordDbQuery(operation, table, duration, true);
      
      // Log slow queries
      if (duration > 0.5) {
        logger.warn('Slow database query detected', {
          operation,
          table,
          duration: `${duration.toFixed(3)}s`,
        });
      }
      
      return result;
    } catch (error) {
      // Calculate duration even on error
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9;
      
      // Record error metrics
      recordDbQuery(operation, table, duration, false, error as Error);
      
      // Log error
      logger.error('Database query error', {
        operation,
        table,
        duration: `${duration.toFixed(3)}s`,
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      
      // Capture in Sentry
      Sentry.captureException(error, {
        extra: {
          operation,
          table,
          duration,
        },
      });
      
      throw error;
    }
  });
}

/**
 * Create a database operation wrapper for a storage method
 */
export function createDbWrapper(storage: any): any {
  return new Proxy(storage, {
    get(target, prop) {
      const original = target[prop];

      // Only wrap functions
      if (typeof original !== 'function') {
        return original;
      }

      // Infer operation and table from method name
      const methodName = String(prop);
      let operation = 'unknown';
      let table = 'unknown';

      // Parse method name (e.g., getChatMessages -> get, chat_messages)
      if (methodName.startsWith('get')) {
        operation = 'SELECT';
        table = methodName.slice(3).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('create')) {
        operation = 'INSERT';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('add')) {
        operation = 'INSERT';
        table = methodName.slice(3).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('update')) {
        operation = 'UPDATE';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      } else if (methodName.startsWith('delete')) {
        operation = 'DELETE';
        table = methodName.slice(6).replace(/([A-Z])/g, '_$1').toLowerCase();
      }

      // Return wrapped function that preserves sync/async behavior
      return function (...args: any[]) {
        const result = original.apply(target, args);

        // If the original method returns a Promise, monitor it asynchronously
        if (result instanceof Promise) {
          return monitorDbOperation(operation, table, () => result);
        }

        // If the original method is synchronous, monitor it synchronously
        return monitorDbOperationSync(operation, table, () => result);
      };
    },
  });
}
