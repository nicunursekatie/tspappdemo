import { Store } from 'express-session';
import { IStorage } from '../storage';
import { AuthMiddleware, PermissionMiddleware } from './express';

/**
 * Standard dependencies for route modules
 */
export interface RouterDependencies {
  isAuthenticated: AuthMiddleware;
  requirePermission: PermissionMiddleware;
  sessionStore: Store;
  storage: IStorage;
}

/**
 * Minimal auth dependencies (for routes that only need auth)
 */
export interface AuthDependencies {
  isAuthenticated?: AuthMiddleware;
}

/**
 * Admin route dependencies
 */
export interface AdminDependencies {
  isAuthenticated: AuthMiddleware;
  requirePermission: PermissionMiddleware;
  sessionStore: Store;
}

/**
 * Groups catalog dependencies
 */
export interface GroupsCatalogDependencies {
  isAuthenticated: AuthMiddleware;
}

/**
 * Project route dependencies
 */
export interface ProjectDependencies {
  storage: IStorage;
  isAuthenticated: AuthMiddleware;
  requirePermission: PermissionMiddleware;
}
