/**
 * Unit tests for permission-based component rendering
 * Tests that components correctly show/hide based on user permissions
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { hasPermission } from '../../../../shared/unified-auth-utils';
import { PERMISSIONS } from '../../../../shared/auth-utils';
import type { UserForPermissions } from '../../../../shared/types';

// Mock component that uses permission-based rendering
const ProtectedButton = ({ user, permission, children }: any) => {
  if (!hasPermission(user, permission)) {
    return null;
  }

  return <button data-testid="protected-button">{children}</button>;
};

describe('Permission-Based Rendering', () => {
  const volunteerUser: UserForPermissions = {
    id: '1',
    email: 'volunteer@example.com',
    role: 'volunteer',
    permissions: [PERMISSIONS.HOSTS_VIEW, PERMISSIONS.COLLECTIONS_ADD],
    isActive: true,
  };

  const adminUser: UserForPermissions = {
    id: '2',
    email: 'admin@example.com',
    role: 'super_admin',
    permissions: [],
    isActive: true,
  };

  describe('ProtectedButton Component', () => {
    it('should render button when user has required permission', () => {
      render(
        <ProtectedButton user={volunteerUser} permission={PERMISSIONS.HOSTS_VIEW}>
          View Hosts
        </ProtectedButton>
      );

      expect(screen.getByTestId('protected-button')).toBeInTheDocument();
      expect(screen.getByTestId('protected-button')).toHaveTextContent('View Hosts');
    });

    it('should not render button when user lacks permission', () => {
      render(
        <ProtectedButton user={volunteerUser} permission={PERMISSIONS.HOSTS_DELETE}>
          Delete Host
        </ProtectedButton>
      );

      expect(screen.queryByTestId('protected-button')).not.toBeInTheDocument();
    });

    it('should render button for super_admin regardless of permission', () => {
      render(
        <ProtectedButton user={adminUser} permission={PERMISSIONS.HOSTS_DELETE}>
          Delete Host
        </ProtectedButton>
      );

      expect(screen.getByTestId('protected-button')).toBeInTheDocument();
    });

    it('should not render when user is null', () => {
      render(
        <ProtectedButton user={null} permission={PERMISSIONS.HOSTS_VIEW}>
          View Hosts
        </ProtectedButton>
      );

      expect(screen.queryByTestId('protected-button')).not.toBeInTheDocument();
    });

    it('should not render when user is inactive', () => {
      const inactiveUser: UserForPermissions = {
        ...volunteerUser,
        isActive: false,
      };

      render(
        <ProtectedButton user={inactiveUser} permission={PERMISSIONS.HOSTS_VIEW}>
          View Hosts
        </ProtectedButton>
      );

      expect(screen.queryByTestId('protected-button')).not.toBeInTheDocument();
    });
  });

  describe('Multi-Permission Components', () => {
    const MultiPermissionComponent = ({ user, requiredPermissions }: any) => {
      const hasAllPermissions = requiredPermissions.every((perm: string) =>
        hasPermission(user, perm)
      );

      if (!hasAllPermissions) {
        return <div data-testid="no-access">No access</div>;
      }

      return <div data-testid="full-access">Full access granted</div>;
    };

    it('should render when user has all required permissions', () => {
      render(
        <MultiPermissionComponent
          user={volunteerUser}
          requiredPermissions={[PERMISSIONS.HOSTS_VIEW, PERMISSIONS.COLLECTIONS_ADD]}
        />
      );

      expect(screen.getByTestId('full-access')).toBeInTheDocument();
    });

    it('should not render when user lacks one permission', () => {
      render(
        <MultiPermissionComponent
          user={volunteerUser}
          requiredPermissions={[
            PERMISSIONS.HOSTS_VIEW,
            PERMISSIONS.HOSTS_DELETE, // User doesn't have this
          ]}
        />
      );

      expect(screen.getByTestId('no-access')).toBeInTheDocument();
      expect(screen.queryByTestId('full-access')).not.toBeInTheDocument();
    });

    it('should render for super_admin with all permissions', () => {
      render(
        <MultiPermissionComponent
          user={adminUser}
          requiredPermissions={[
            PERMISSIONS.HOSTS_VIEW,
            PERMISSIONS.HOSTS_DELETE,
            PERMISSIONS.USERS_DELETE,
          ]}
        />
      );

      expect(screen.getByTestId('full-access')).toBeInTheDocument();
    });
  });

  describe('Permission-Dependent UI Elements', () => {
    const ConditionalUI = ({ user }: any) => {
      const canView = hasPermission(user, PERMISSIONS.HOSTS_VIEW);
      const canEdit = hasPermission(user, PERMISSIONS.HOSTS_EDIT);
      const canDelete = hasPermission(user, PERMISSIONS.HOSTS_DELETE);

      return (
        <div>
          {canView && <button data-testid="view-btn">View</button>}
          {canEdit && <button data-testid="edit-btn">Edit</button>}
          {canDelete && <button data-testid="delete-btn">Delete</button>}
        </div>
      );
    };

    it('should show only view button for view-only user', () => {
      const viewOnlyUser: UserForPermissions = {
        ...volunteerUser,
        permissions: [PERMISSIONS.HOSTS_VIEW],
      };

      render(<ConditionalUI user={viewOnlyUser} />);

      expect(screen.getByTestId('view-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();
    });

    it('should show all buttons for admin user', () => {
      const fullAccessUser: UserForPermissions = {
        ...volunteerUser,
        permissions: [
          PERMISSIONS.HOSTS_VIEW,
          PERMISSIONS.HOSTS_EDIT,
          PERMISSIONS.HOSTS_DELETE,
        ],
      };

      render(<ConditionalUI user={fullAccessUser} />);

      expect(screen.getByTestId('view-btn')).toBeInTheDocument();
      expect(screen.getByTestId('edit-btn')).toBeInTheDocument();
      expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
    });

    it('should show no buttons for user with no permissions', () => {
      const noPermUser: UserForPermissions = {
        ...volunteerUser,
        permissions: [],
      };

      render(<ConditionalUI user={noPermUser} />);

      expect(screen.queryByTestId('view-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('edit-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('delete-btn')).not.toBeInTheDocument();
    });
  });
});
