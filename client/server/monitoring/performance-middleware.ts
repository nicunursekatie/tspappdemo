/**
 * Performance Monitoring Middleware
 *
 * Tracks API response times, request sizes, and other performance metrics
 * Note: Sentry HTTP tracing is handled by setupExpressRequestHandler()
 */

import type { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from './metrics';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';

/**
 * Normalize route path for better metric grouping
 * Replaces IDs and UUIDs with placeholders
 */
function normalizeRoute(path: string): string {
  return path
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace UUIDs
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:uuid')
    // Replace MongoDB-style IDs
    .replace(/\/[0-9a-f]{24}/gi, '/:id')
    // Normalize trailing slashes
    .replace(/\/$/,  '');
}

/**
 * Get approximate request size
 */
function getRequestSize(req: Request): number {
  let size = 0;

  // Headers
  if (req.headers) {
    size += JSON.stringify(req.headers).length;
  }

  // Body
  if (req.body) {
    size += JSON.stringify(req.body).length;
  }

  // Query params
  if (req.query) {
    size += JSON.stringify(req.query).length;
  }

  return size;
}

/**
 * Performance monitoring middleware
 * Should be registered early in the middleware chain
 * 
 * Note: HTTP request tracing is automatically handled by Sentry's Express integration
 * (sentryRequestHandler). This middleware focuses on Prometheus metrics collection.
 */
export function performanceMonitoringMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip monitoring for certain paths
  const skipPaths = ['/health', '/healthz', '/metrics', '/favicon.ico'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  const requestSize = getRequestSize(req);

  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;

  let responseSize = 0;
  let responseSent = false;

  // Wrap res.json to capture response size
  res.json = function (body: any): Response {
    if (!responseSent) {
      responseSize = JSON.stringify(body).length;
      responseSent = true;
    }
    return originalJson.call(this, body);
  };

  // Wrap res.end to capture metrics
  res.end = function (chunk?: any, ...args: any[]): Response {
    if (!responseSent) {
      if (chunk) {
        responseSize = Buffer.isBuffer(chunk) ? chunk.length : String(chunk).length;
      }
      responseSent = true;

      // Calculate duration
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e9; // Convert to seconds

      // Calculate memory delta
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

      // Normalize route for metrics
      const route = normalizeRoute(req.path);
      const method = req.method;
      const statusCode = res.statusCode;

      // Record Prometheus metrics
      try {
        recordHttpRequest(method, route, statusCode, duration, requestSize, responseSize);

        // Log slow requests
        if (duration > 1) {
          logger.warn('Slow request detected', {
            method,
            route,
            duration: `${duration.toFixed(3)}s`,
            statusCode,
            requestSize,
            responseSize,
            memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)} MB`,
          });
        }
      } catch (error) {
        logger.error('Failed to record performance metrics', { error });
      }
    }

    return originalEnd.call(this, chunk, ...args);
  };

  next();
}

/**
 * Error tracking middleware
 * Should be registered AFTER all routes but BEFORE final error handler
 */
export function errorTrackingMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  // Capture error in Sentry
  Sentry.captureException(err, {
    extra: {
      url: req.url,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
      user: (req as any).user,
    },
  });

  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  next(err);
}

/**
 * Middleware to track active users
 */
export function trackActiveUsers(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
  next();
}
