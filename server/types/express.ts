import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Session } from 'express-session';
import type { User, UserMetadata } from '../../shared/types';

// User session data structure - must match auth.ts SessionData.user
export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  profileImageUrl: string | null;
  role: string;
  permissions: string[];
  isActive: boolean;
}

// Re-export shared types for convenience
export type { User, UserMetadata };

// Replit auth user structure
export interface ReplitUser {
  id?: string;
  email?: string;
  claims?: {
    sub: string;
    email?: string;
  };
}

// Extended request interface with typed user and session
// Uses Omit to avoid conflicts with global Request augmentation
export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  // User is optional (undefined when not authenticated)
  // but when present, all fields are required to ensure type safety
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    profileImageUrl: string | null;
    role: string;
    permissions: string[];
    isActive: boolean;
    // Support for Replit auth structure
    claims?: {
      sub: string;
      email?: string;
    };
  };
  session?: Request['session'] & {
    user?: SessionUser;
  };
  fileMetadata?: {
    fileName: string;
    filePath: string;
    fileType: string;
    mimeType: string;
  };
}

// Optional auth request (may or may not have user) - same as AuthenticatedRequest
export type MaybeAuthenticatedRequest = AuthenticatedRequest;

// Typed middleware signatures
export type AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export type PermissionMiddleware = (
  permission: string
) => (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

// Typed handler with authenticated request
export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

// Typed handler with optional auth
export type MaybeAuthenticatedHandler = (
  req: MaybeAuthenticatedRequest,
  res: Response,
  next?: NextFunction
) => void | Promise<void>;

// Standard handler (no auth required)
export type StandardHandler = RequestHandler;

// Helper to get user ID from request
export function getUserId(req: AuthenticatedRequest): string | undefined {
  if (!req.user) return undefined;

  // Check for Replit auth structure
  if (req.user.claims?.sub) {
    return req.user.claims.sub;
  }

  // Check for session user
  if (req.user.id) {
    return req.user.id;
  }

  return undefined;
}

// Helper to get user from session or Replit auth
export function getSessionUser(req: AuthenticatedRequest): SessionUser | undefined {
  // First, try to get user from session - this is the most reliable source
  if (req.session?.user) {
    return req.session.user;
  }

  // If no session user, try to construct from req.user if it has all required fields
  if (req.user && 
      req.user.id && 
      req.user.email && 
      req.user.firstName && 
      req.user.lastName && 
      req.user.role && 
      req.user.permissions && 
      req.user.isActive !== undefined) {
    return {
      id: req.user.id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      displayName: req.user.displayName,
      profileImageUrl: req.user.profileImageUrl,
      role: req.user.role,
      permissions: req.user.permissions,
      isActive: req.user.isActive,
    };
  }

  return undefined;
}
