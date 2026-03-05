import { Request, Response, NextFunction } from 'express';
import { createServiceLogger, logError } from '../../utils/logger';
import { ZodError } from 'zod';

const hostsLogger = createServiceLogger('hosts');

export interface HostsErrorResponse {
  error: string;
  message: string;
  status: number;
  module: 'hosts';
  timestamp: string;
  code?: string;
  details?: any;
}

export interface HostsError extends Error {
  status?: number;
  code?: string;
  details?: any;
  userId?: string;
}

/**
 * Creates a structured error response for hosts module
 */
export function createHostsErrorResponse(
  error: HostsError,
  userId?: string
): HostsErrorResponse {
  const timestamp = new Date().toISOString();
  
  return {
    error: error.code || 'HOSTS_ERROR',
    message: error.message,
    status: error.status || 500,
    module: 'hosts',
    timestamp,
    code: error.code,
    details: error.details,
  };
}

/**
 * Logs error with Winston and returns structured response
 */
export function handleHostsError(
  error: HostsError,
  req: Request,
  res: Response,
  userId?: string
): void {
  // Extract user ID from request if not provided
  const userIdFromReq = (req as any).user?.id || userId;
  
  // Log error with Winston
  logError(error, 'Hosts module error', userIdFromReq, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
    code: error.code,
    details: error.details,
  });

  // Additional module-specific logging
  hostsLogger.error(`Hosts operation failed: ${error.message}`, {
    method: req.method,
    url: req.url,
    userId: userIdFromReq,
    errorCode: error.code,
    statusCode: error.status || 500,
  });

  // Create structured response
  const errorResponse = createHostsErrorResponse(error, userIdFromReq);
  
  // Don't expose internal details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!isDevelopment && error.status === 500) {
    errorResponse.message = 'An internal error occurred';
    delete errorResponse.details;
  }

  res.status(errorResponse.status).json(errorResponse);
}

/**
 * Express error handler middleware for hosts routes
 */
export function hostsErrorHandler() {
  return (error: HostsError, req: Request, res: Response, next: NextFunction) => {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const zodError: HostsError = {
        name: 'ValidationError',
        message: 'Request validation failed',
        status: 400,
        code: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      };
      handleHostsError(zodError, req, res);
      return;
    }

    // Handle database constraint errors
    if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint')) {
      const constraintError: HostsError = {
        name: 'ConstraintError',
        message: 'A record with this information already exists',
        status: 409,
        code: 'CONSTRAINT_VIOLATION',
        details: { originalError: error.message },
      };
      handleHostsError(constraintError, req, res);
      return;
    }

    // Handle foreign key constraint errors
    if (error.message?.includes('foreign key constraint') || error.message?.includes('referential integrity')) {
      const fkError: HostsError = {
        name: 'ForeignKeyError',
        message: 'Cannot perform this operation due to existing relationships',
        status: 409,
        code: 'FOREIGN_KEY_VIOLATION',
        details: { originalError: error.message },
      };
      handleHostsError(fkError, req, res);
      return;
    }

    // Handle not found errors
    if (error.message?.includes('not found') || error.status === 404) {
      const notFoundError: HostsError = {
        name: 'NotFoundError',
        message: error.message || 'Resource not found',
        status: 404,
        code: 'NOT_FOUND',
        details: { resource: req.params },
      };
      handleHostsError(notFoundError, req, res);
      return;
    }

    // Handle permission errors
    if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      const permissionError: HostsError = {
        name: 'PermissionError',
        message: 'Insufficient permissions for this operation',
        status: 403,
        code: 'PERMISSION_DENIED',
        details: { requiredPermission: 'HOSTS_EDIT' },
      };
      handleHostsError(permissionError, req, res);
      return;
    }

    // Handle all other errors
    handleHostsError(error, req, res);
  };
}

/**
 * Creates a custom error for hosts operations
 */
export function createHostsError(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): HostsError {
  const error = new Error(message) as HostsError;
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Async wrapper to catch errors in route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validates required fields and throws structured error if missing
 */
export function validateRequired(
  data: any,
  requiredFields: string[],
  context: string = 'request'
): void {
  const missing = requiredFields.filter(field => 
    data[field] === undefined || data[field] === null || data[field] === ''
  );
  
  if (missing.length > 0) {
    throw createHostsError(
      `Missing required fields: ${missing.join(', ')}`,
      400,
      'MISSING_REQUIRED_FIELDS',
      { missingFields: missing, context }
    );
  }
}

/**
 * Validates ID parameter and throws structured error if invalid
 */
export function validateId(id: string | undefined, resourceName: string = 'resource'): number {
  if (!id) {
    throw createHostsError(
      `${resourceName} ID is required`,
      400,
      'MISSING_ID',
      { resourceName }
    );
  }
  
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw createHostsError(
      `Invalid ${resourceName} ID: ${id}`,
      400,
      'INVALID_ID',
      { providedId: id, resourceName }
    );
  }
  
  return numericId;
}
