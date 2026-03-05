/**
 * Centralized Middleware Configuration
 *
 * Re-exports all commonly used middleware from existing files to provide
 * a single import point for consistent middleware usage across the application.
 *
 * Usage:
 * import { requirePermission, sanitizeMiddleware, requestLogger } from '../middleware';
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import {
  createErrorResponse,
  ApiErrorCode,
  ApiResponse,
  createSuccessResponse,
} from '../../shared/types';

// Import functions for use within this file
import { requestLogger, errorLogger, logger } from './logger';
import { sanitizeMiddleware, sanitizeHtml, sanitizeText } from './sanitizer';
import { requirePermission, requireOwnershipPermission } from './auth';

// Authentication and authorization middleware
export { isAuthenticated, requirePermission, requireOwnershipPermission } from './auth';

// Input sanitization middleware
export { sanitizeMiddleware, sanitizeHtml, sanitizeText } from './sanitizer';

// Logging and monitoring middleware
export { requestLogger, errorLogger, logger } from './logger';

// File upload handling middleware
export {
  upload,
  meetingMinutesUpload,
  importUpload,
  projectFilesUpload,
  projectDataUpload,
  documentsUpload,
} from './uploads';

// Version control class and utilities
export { VersionControl } from './version-control';
export type { VersionedRecord, ChangesetRequest } from './version-control';

// Activity logging middleware factory
export { createActivityLogger } from './activity-logger';

/**
 * Standard middleware stack for API routes
 *
 * This provides a consistent middleware ordering that can be applied
 * to route groups. Order matters - authentication should come before
 * authorization, sanitization before validation, etc.
 */
export function createStandardMiddleware(permissions?: string[]) {
  const middleware = [requestLogger, sanitizeMiddleware];

  // Add permission checking if specified
  if (permissions && permissions.length > 0) {
    middleware.push(...permissions.map((p) => requirePermission(p)));
  }

  return middleware;
}

/**
 * Create middleware stack for public routes (no authentication required)
 * Includes basic logging and sanitization but no auth checks
 */
export function createPublicMiddleware() {
  return [requestLogger, sanitizeMiddleware];
}

/**
 * Create middleware stack for authenticated routes with optional permissions
 * Combines authentication check with standard middleware
 */
export function createAuthenticatedMiddleware(
  permissions?: string[],
  isAuthenticated?: any
) {
  const middleware = createStandardMiddleware(permissions);

  if (isAuthenticated) {
    return [isAuthenticated, ...middleware];
  }

  return middleware;
}

/**
 * Create a complete middleware stack for a route module
 * Includes authentication, standard middleware, and error handling
 */
export function createCompleteMiddlewareStack(options: {
  moduleId: string;
  isAuthenticated?: any;
  permissions?: string[];
  requireAuth?: boolean;
}) {
  const {
    moduleId,
    isAuthenticated,
    permissions,
    requireAuth = true,
  } = options;

  const middleware = [];

  // Add authentication if required
  if (requireAuth && isAuthenticated) {
    middleware.push(isAuthenticated);
  }

  // Add standard middleware (logging, sanitization, permissions)
  middleware.push(...createStandardMiddleware(permissions));

  // Add error handler
  const errorHandler = createErrorHandler(moduleId);

  return {
    middleware,
    errorHandler,
  };
}

/**
 * Validation middleware factory using shared schemas
 *
 * @param schema - Zod schema for validation
 * @param target - What to validate ('body', 'params', 'query')
 */
export function validateRequest(
  schema: any,
  target: 'body' | 'params' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error: any) {
      const response = createErrorResponse(
        'Validation failed',
        'VALIDATION_ERROR',
        error.errors?.[0]?.message || error.message
      );
      res.status(400).json(response);
    }
  };
}

/**
 * Custom error class with status code and error code support
 */
export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;

  constructor(message: string, status: number = 500, code: ApiErrorCode = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  static badRequest(message: string): ApiError {
    return new ApiError(message, 400, 'BAD_REQUEST');
  }

  static notFound(message: string): ApiError {
    return new ApiError(message, 404, 'NOT_FOUND');
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string): ApiError {
    return new ApiError(message, 403, 'FORBIDDEN');
  }

  static conflict(message: string): ApiError {
    return new ApiError(message, 409, 'CONFLICT');
  }

  static validationError(message: string): ApiError {
    return new ApiError(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * Map HTTP status codes to API error codes
 */
function getErrorCodeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMITED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Error handling middleware for specific route modules
 *
 * Provides consistent error formatting and logging for feature-specific routes
 * Now uses the standardized ApiResponse format
 */
export function createErrorHandler(moduleId: string): ErrorRequestHandler {
  return (error: any, req: Request, res: Response, _next: NextFunction) => {
    const fullPath = req.originalUrl || req.url;

    logger.error(`${moduleId} error: ${error.message}`, error, {
      method: req.method,
      url: fullPath,
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const status = error.status || 500;
    const code: ApiErrorCode = error.code || getErrorCodeFromStatus(status);

    const response = createErrorResponse(
      isDevelopment ? error.message : `${moduleId} error`,
      code,
      isDevelopment ? error.stack : undefined
    );

    res.status(status).json(response);
  };
}

/**
 * Global error handler middleware
 *
 * Should be registered last in the middleware chain to catch all unhandled errors.
 * Uses the standardized ApiResponse format for consistent error responses.
 */
export function globalErrorHandler(): ErrorRequestHandler {
  return (error: any, req: Request, res: Response, _next: NextFunction) => {
    const fullPath = req.originalUrl || req.url;

    // Log error with context
    logger.error(`Global error handler: ${error.message}`, error, {
      method: req.method,
      url: fullPath,
      stack: error.stack,
    });

    const isDevelopment = process.env.NODE_ENV === 'development';
    const status = error.status || 500;
    const code: ApiErrorCode = error.code || getErrorCodeFromStatus(status);

    const response = createErrorResponse(
      isDevelopment ? error.message : 'An unexpected error occurred',
      code
    );

    // Prevent sending response if headers already sent
    if (res.headersSent) {
      return;
    }

    res.status(status).json(response);
  };
}

/**
 * Response helper middleware
 *
 * Adds helper methods to the response object for consistent API responses.
 * Call this middleware early in your route setup.
 */
export function responseHelpers() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add success response helper
    (res as any).success = <T>(data: T, message?: string, meta?: ApiResponse['meta']) => {
      res.json(createSuccessResponse(data, message, meta));
    };

    // Add error response helper
    (res as any).apiError = (
      error: string,
      status: number = 500,
      code?: ApiErrorCode,
      message?: string
    ) => {
      const errorCode = code || getErrorCodeFromStatus(status);
      res.status(status).json(createErrorResponse(error, errorCode, message));
    };

    // Add not found helper
    (res as any).notFound = (message: string = 'Resource not found') => {
      res.status(404).json(createErrorResponse(message, 'NOT_FOUND'));
    };

    // Add bad request helper
    (res as any).badRequest = (message: string = 'Bad request') => {
      res.status(400).json(createErrorResponse(message, 'BAD_REQUEST'));
    };

    // Add unauthorized helper
    (res as any).unauthorized = (message: string = 'Unauthorized') => {
      res.status(401).json(createErrorResponse(message, 'UNAUTHORIZED'));
    };

    // Add forbidden helper
    (res as any).forbidden = (message: string = 'Forbidden') => {
      res.status(403).json(createErrorResponse(message, 'FORBIDDEN'));
    };

    next();
  };
}

/**
 * DEPRECATED: Legacy CORS configuration - use centralized config instead
 * @deprecated Use getExpressCorsConfig() from './config/cors' instead
 */
export const corsConfig = {
  origin: false, // Disabled - use centralized config
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Export types for TypeScript support
export type { LogEntry } from './logger';

// Export standardized API response utilities
export {
  createErrorResponse,
  createSuccessResponse,
  type ApiResponse,
  type ApiErrorCode,
  type ApiSuccessResponse,
  type ApiErrorResponse,
} from '../../shared/types';

// Export extended Response type with helpers
export interface ApiResponseMethods {
  success: <T>(data: T, message?: string, meta?: ApiResponse['meta']) => void;
  apiError: (error: string, status?: number, code?: ApiErrorCode, message?: string) => void;
  notFound: (message?: string) => void;
  badRequest: (message?: string) => void;
  unauthorized: (message?: string) => void;
  forbidden: (message?: string) => void;
}

// Extend Express Response type
declare global {
  namespace Express {
    interface Response extends ApiResponseMethods {}
  }
}
