/**
 * Unit tests for authentication middleware
 * Tests requirePermission and requireOwnershipPermission middleware functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { PERMISSIONS } from '../../shared/auth-utils';

// Mock dependencies
const mockStorage = {
  getUserByEmail: jest.fn(),
};

const mockCheckPermission = jest.fn();
const mockCheckOwnershipPermission = jest.fn();

jest.mock('../../server/storage-wrapper', () => ({
  storage: mockStorage,
}));

jest.mock('../../shared/unified-auth-utils', () => ({
  checkPermission: mockCheckPermission,
  checkOwnershipPermission: mockCheckOwnershipPermission,
}));

// Import after mocking
import { requirePermission, requireOwnershipPermission } from '../../server/middleware/auth';

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;
  let jsonMock: jest.MockedFunction<any>;
  let statusMock: jest.MockedFunction<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockReq = {
      user: undefined,
      session: undefined,
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('requirePermission', () => {
    it('should deny access when no user in request', async () => {
      const middleware = requirePermission(PERMISSIONS.HOSTS_VIEW);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should deny access when user is not active', async () => {
      const inactiveUser = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: false,
      };

      mockReq.user = inactiveUser;
      mockStorage.getUserByEmail.mockResolvedValue(inactiveUser);

      const middleware = requirePermission(PERMISSIONS.HOSTS_VIEW);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'User account not found or inactive',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should grant access when permission check passes', async () => {
      const activeUser = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.HOSTS_VIEW],
      };

      mockReq.user = activeUser;
      mockStorage.getUserByEmail.mockResolvedValue(activeUser);
      mockCheckPermission.mockReturnValue({
        granted: true,
        reason: 'Permission granted',
        userRole: 'volunteer',
        userPermissions: [PERMISSIONS.HOSTS_VIEW],
      });

      const middleware = requirePermission(PERMISSIONS.HOSTS_VIEW);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when permission check fails', async () => {
      const activeUser = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.HOSTS_VIEW],
      };

      mockReq.user = activeUser;
      mockStorage.getUserByEmail.mockResolvedValue(activeUser);
      mockCheckPermission.mockReturnValue({
        granted: false,
        reason: 'Permission not found',
        userRole: 'volunteer',
        userPermissions: [PERMISSIONS.HOSTS_VIEW],
      });

      const middleware = requirePermission(PERMISSIONS.HOSTS_DELETE);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
          required: PERMISSIONS.HOSTS_DELETE,
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockReq.user = {
        id: '1',
        email: 'test@example.com',
      };

      mockStorage.getUserByEmail.mockRejectedValue(new Error('Database error'));

      const middleware = requirePermission(PERMISSIONS.HOSTS_VIEW);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Unable to verify user permissions',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should update req.user with fresh user data', async () => {
      const staleUser = {
        id: '1',
        email: 'test@example.com',
        role: 'volunteer',
        permissions: [PERMISSIONS.HOSTS_VIEW],
      };

      const freshUser = {
        id: '1',
        email: 'test@example.com',
        role: 'admin', // Role changed
        isActive: true,
        permissions: [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.HOSTS_EDIT],
      };

      mockReq.user = staleUser;
      mockStorage.getUserByEmail.mockResolvedValue(freshUser);
      mockCheckPermission.mockReturnValue({
        granted: true,
        reason: 'Permission granted',
        userRole: 'admin',
        userPermissions: freshUser.permissions,
      });

      const middleware = requirePermission(PERMISSIONS.HOSTS_VIEW);
      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockReq.user).toEqual(freshUser);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireOwnershipPermission', () => {
    it('should grant access with ALL permission', async () => {
      const adminUser = {
        id: '1',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_ALL],
      };

      mockReq.user = adminUser;
      mockReq.params = { id: '123' };
      mockStorage.getUserByEmail.mockResolvedValue(adminUser);
      mockCheckOwnershipPermission.mockReturnValue({
        granted: true,
        reason: 'All-access permission granted',
        userRole: 'admin',
        userPermissions: [PERMISSIONS.COLLECTIONS_EDIT_ALL],
      });

      const getResourceUserId = async () => 'different-user-id';
      const middleware = requireOwnershipPermission(
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        getResourceUserId
      );

      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should grant access with OWN permission when user owns resource', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      };

      mockReq.user = user;
      mockStorage.getUserByEmail.mockResolvedValue(user);
      mockCheckOwnershipPermission.mockReturnValue({
        granted: true,
        reason: 'Own-resource permission granted',
        userRole: 'volunteer',
        userPermissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      });

      const getResourceUserId = async () => 'user-123';
      const middleware = requireOwnershipPermission(
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        getResourceUserId
      );

      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should deny access when user does not own resource', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      };

      mockReq.user = user;
      mockStorage.getUserByEmail.mockResolvedValue(user);
      mockCheckOwnershipPermission.mockReturnValue({
        granted: false,
        reason: 'User does not own this resource',
        userRole: 'volunteer',
        userPermissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      });

      const getResourceUserId = async () => 'different-user-id';
      const middleware = requireOwnershipPermission(
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        getResourceUserId
      );

      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle errors in getResourceUserId', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN],
      };

      mockReq.user = user;
      mockStorage.getUserByEmail.mockResolvedValue(user);

      const getResourceUserId = async () => {
        throw new Error('Resource not found');
      };

      const middleware = requireOwnershipPermission(
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        getResourceUserId
      );

      await middleware(mockReq as any, mockRes as any, mockNext);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Permission check failed',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('SECURITY TEST: should deny access when user owns resource but permissions were revoked', async () => {
      // Simulate a user who created a resource when they had permissions
      // but their permissions were revoked after creation
      const staleUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [PERMISSIONS.COLLECTIONS_EDIT_OWN], // Had permission in session
      };

      const freshUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'volunteer',
        isActive: true,
        permissions: [], // Permission revoked in database
      };

      mockReq.user = staleUser; // Stale session data
      mockStorage.getUserByEmail.mockResolvedValue(freshUser); // Fresh data from DB
      
      // Mock checkOwnershipPermission to verify it checks ownership BEFORE permission
      // and denies access when user owns resource but lacks current permission
      mockCheckOwnershipPermission.mockReturnValue({
        granted: false,
        reason: "User owns resource but lacks required permission 'COLLECTIONS_EDIT_OWN'",
        userRole: 'volunteer',
        userPermissions: [],
      });

      const getResourceUserId = async () => 'user-123'; // User owns the resource
      const middleware = requireOwnershipPermission(
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        getResourceUserId
      );

      await middleware(mockReq as any, mockRes as any, mockNext);

      // Should fetch fresh user data
      expect(mockStorage.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      
      // Should call checkOwnershipPermission with FRESH user data
      expect(mockCheckOwnershipPermission).toHaveBeenCalledWith(
        freshUser, // Fresh user data, not stale
        PERMISSIONS.COLLECTIONS_EDIT_OWN,
        PERMISSIONS.COLLECTIONS_EDIT_ALL,
        'user-123'
      );

      // Should DENY access even though user owns the resource
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
          reason: "User owns resource but lacks required permission 'COLLECTIONS_EDIT_OWN'",
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
