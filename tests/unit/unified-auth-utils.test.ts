/**
 * Unit tests for unified permission system
 * Tests the core permission checking logic used throughout the application
 */

import { describe, it, expect } from '@jest/globals';
import {
  checkPermission,
  hasPermission,
  checkOwnershipPermission,
  validatePermissionFormat,
  getUserPermissions,
  debugPermissions,
} from '../../shared/unified-auth-utils';
import { PERMISSIONS, USER_ROLES } from '../../shared/auth-utils';
import type { UserForPermissions } from '../../shared/types';

describe('Unified Permission System', () => {
  describe('checkPermission', () => {
    it('should deny access when user is null', () => {
      const result = checkPermission(null, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('No user provided');
    });

    it('should deny access when user is undefined', () => {
      const result = checkPermission(undefined, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('No user provided');
    });

    it('should deny access when permission is empty string', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      const result = checkPermission(user, '');
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Invalid permission string');
    });

    it('should deny access when user is inactive', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: false,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User account is inactive');
    });

    it('should grant universal permissions to all authenticated users', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [],
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.VOLUNTEERS_VIEW);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Universal permission (all users have access)');
    });

    it('should grant all permissions to super_admin with no explicit permissions', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: USER_ROLES.SUPER_ADMIN,
        permissions: null as any, // No explicit permissions set
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_DELETE);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Super admin access (no explicit permissions set)');
      expect(result.userPermissions).toEqual(['*ALL*']);
    });

    it('should NOT auto-grant permissions to super_admin with explicit permissions array', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: USER_ROLES.SUPER_ADMIN,
        permissions: [PERMISSIONS.NAV_HOSTS], // Explicit permissions set
        isActive: true,
      };
      // Super admin should only have NAV_HOSTS (and its dependencies), not HOSTS_DELETE
      const result = checkPermission(user, PERMISSIONS.HOSTS_DELETE);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });

    it('should grant permissions to super_admin that are in their explicit array', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: USER_ROLES.SUPER_ADMIN,
        permissions: [PERMISSIONS.NAV_HOSTS, PERMISSIONS.HOSTS_DELETE],
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_DELETE);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Permission granted');
    });

    it('should grant permission when user has it in permissions array', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.DRIVERS_VIEW],
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Permission granted');
    });

    it('should deny permission when user does not have it', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_DELETE);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });

    it('should reject numeric permission format', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: 123 as any, // Numeric format (legacy)
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Numeric permission format not supported');
    });

    it('should NOT auto-grant NAV_ permissions for admin when explicit permissions are stored', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: [], // Explicitly stored (even empty) -> must be respected
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.NAV_HOSTS);
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('not found in user permissions');
    });

    it('should grant legacy admin compatibility for NAV_ permissions when permissions are missing', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: null as any, // Legacy: no explicit permissions stored
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.NAV_HOSTS);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Legacy admin compatibility (no explicit permissions stored)');
    });

    it('should grant legacy admin compatibility for EVENT_REQUESTS_ permissions when permissions are missing', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        permissions: undefined as any, // Legacy: no explicit permissions stored
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.EVENT_REQUESTS_VIEW);
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Legacy admin compatibility (no explicit permissions stored)');
    });

    it('should apply permission dependencies (NAV grants functional permissions)', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.NAV_HOSTS], // Navigation permission
        isActive: true,
      };
      const result = checkPermission(user, PERMISSIONS.HOSTS_VIEW); // Functional permission
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Permission granted');
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission is granted', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      expect(hasPermission(user, PERMISSIONS.HOSTS_VIEW)).toBe(true);
    });

    it('should return false when permission is denied', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      expect(hasPermission(user, PERMISSIONS.HOSTS_DELETE)).toBe(false);
    });
  });

  describe('checkOwnershipPermission', () => {
    const user: UserForPermissions = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'volunteer',
      permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      isActive: true,
    };

    it('should grant access with ALL permission regardless of ownership', () => {
      const adminUser: UserForPermissions = {
        ...user,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_ALL],
      };
      const result = checkOwnershipPermission(
        adminUser,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'different-user-id'
      );
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('All-access permission granted');
    });

    it('should grant access with OWN permission when user owns resource', () => {
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'user-123'
      );
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Own-resource permission granted (verified with current permissions)');
    });

    it('should deny access with OWN permission when user does not own resource', () => {
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'different-user-id'
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Neither');
    });

    it('should handle array of owner IDs', () => {
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        ['user-123', 'other-user']
      );
      expect(result.granted).toBe(true);
      expect(result.reason).toBe('Own-resource permission granted (verified with current permissions)');
    });

    it('should require resource owner ID for ownership check', () => {
      const result = checkOwnershipPermission(
        user,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        null
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('Resource owner ID required for ownership check');
    });

    it('should deny when user has neither permission and does not own resource', () => {
      const restrictedUser: UserForPermissions = {
        ...user,
        permissions: [PERMISSIONS.HOSTS_VIEW], // Unrelated permission
      };
      const result = checkOwnershipPermission(
        restrictedUser,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'different-user-id' // User does NOT own this resource
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Neither');
    });

    it('should deny when user owns resource but lacks the OWN permission', () => {
      const restrictedUser: UserForPermissions = {
        ...user,
        permissions: [PERMISSIONS.HOSTS_VIEW], // Unrelated permission
      };
      const result = checkOwnershipPermission(
        restrictedUser,
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'user-123' // User owns this resource but doesn't have COLLECTIONS_EDIT_OWN
      );
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('lacks required permission');
    });
  });

  describe('validatePermissionFormat', () => {
    it('should validate known permissions', () => {
      expect(validatePermissionFormat(PERMISSIONS.HOSTS_VIEW)).toBe(true);
      expect(validatePermissionFormat(PERMISSIONS.DRIVERS_EDIT)).toBe(true);
    });

    it('should reject unknown permissions', () => {
      expect(validatePermissionFormat('INVALID_PERMISSION')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(validatePermissionFormat('')).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(validatePermissionFormat(null as any)).toBe(false);
      expect(validatePermissionFormat(undefined as any)).toBe(false);
      expect(validatePermissionFormat(123 as any)).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for super_admin with no explicit permissions', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'admin@example.com',
        role: USER_ROLES.SUPER_ADMIN,
        permissions: null as any, // No explicit permissions
        isActive: true,
      };
      const perms = getUserPermissions(user);
      expect(perms.length).toBeGreaterThan(50); // Should have many permissions
      expect(perms).toContain(PERMISSIONS.HOSTS_VIEW);
      expect(perms).toContain(PERMISSIONS.USERS_DELETE);
    });

    it('should return user permissions array', () => {
      const user: UserForPermissions = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.DRIVERS_VIEW],
        isActive: true,
      };
      const perms = getUserPermissions(user);
      expect(perms).toContain(PERMISSIONS.HOSTS_VIEW);
      expect(perms).toContain(PERMISSIONS.DRIVERS_VIEW);
    });

    it('should return empty array for null user', () => {
      expect(getUserPermissions(null)).toEqual([]);
    });
  });

  describe('debugPermissions', () => {
    it('should return debug info without permission check', () => {
      const user: UserForPermissions = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      const debug = debugPermissions(user);
      expect(debug.userId).toBe('user-123');
      expect(debug.userRole).toBe('volunteer');
      expect(debug.permissionFormat).toBe('array');
      expect(debug.isActive).toBe(true);
    });

    it('should include permission check result when permission specified', () => {
      const user: UserForPermissions = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
        isActive: true,
      };
      const debug = debugPermissions(user, PERMISSIONS.HOSTS_VIEW);
      expect(debug.permissionCheck).toBeDefined();
      expect(debug.permissionCheck?.permission).toBe(PERMISSIONS.HOSTS_VIEW);
      expect(debug.permissionCheck?.granted).toBe(true);
    });

    it('should handle null user gracefully', () => {
      const debug = debugPermissions(null);
      expect(debug.userId).toBe('N/A');
      expect(debug.userRole).toBe('N/A');
      expect(debug.isActive).toBe('N/A');
    });
  });
});
