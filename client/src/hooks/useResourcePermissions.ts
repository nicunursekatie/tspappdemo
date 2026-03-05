import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS, applyPermissionDependencies } from '@shared/auth-utils';
import { hasPermission as unifiedHasPermission } from '@shared/unified-auth-utils';

/**
 * Custom hook for checking common CRUD permissions for a resource.
 * Eliminates repetitive permission checking code across components.
 * Applies permission dependencies automatically (e.g., NAV_HOSTS grants HOSTS_VIEW).
 *
 * @param resource - The resource name (e.g., 'VOLUNTEERS', 'HOSTS', 'RECIPIENTS')
 * @returns Object with canView, canAdd, canEdit, canDelete boolean flags
 *
 * @example
 * const permissions = useResourcePermissions('VOLUNTEERS');
 * if (permissions.canEdit) { ... }
 */
export function useResourcePermissions(resource: string) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return {
        canView: false,
        canAdd: false,
        canEdit: false,
        canDelete: false,
      };
    }

    // Build permission keys dynamically
    const viewKey = `${resource}_VIEW` as keyof typeof PERMISSIONS;
    const addKey = `${resource}_ADD` as keyof typeof PERMISSIONS;
    const editKey = `${resource}_EDIT` as keyof typeof PERMISSIONS;
    const deleteKey = `${resource}_DELETE` as keyof typeof PERMISSIONS;

    return {
      canView: unifiedHasPermission(user, PERMISSIONS[viewKey]),
      canAdd: unifiedHasPermission(user, PERMISSIONS[addKey]),
      canEdit: unifiedHasPermission(user, PERMISSIONS[editKey]),
      canDelete: unifiedHasPermission(user, PERMISSIONS[deleteKey]),
    };
  }, [user, resource]);
}

/**
 * Custom hook for checking specific custom permissions.
 * Use this for non-standard permission patterns.
 * Applies permission dependencies automatically (e.g., NAV_HOSTS grants HOSTS_VIEW).
 *
 * @param permissionKeys - Array of permission keys to check
 * @returns Object mapping permission keys to boolean values
 *
 * @example
 * const { VOLUNTEERS_VIEW, VOLUNTEERS_EXPORT } = usePermissions(['VOLUNTEERS_VIEW', 'VOLUNTEERS_EXPORT']);
 */
export function usePermissions(permissionKeys: string[]) {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return permissionKeys.reduce((acc, key) => {
        acc[key] = false;
        return acc;
      }, {} as Record<string, boolean>);
    }

    const result: Record<string, boolean> = {};
    permissionKeys.forEach(key => {
      result[key] = unifiedHasPermission(user, PERMISSIONS[key as keyof typeof PERMISSIONS]);
    });
    return result;
  }, [user, permissionKeys]);
}
