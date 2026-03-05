import { Badge } from '@/components/ui/badge';
import { getRoleDisplayName } from '@shared/auth-utils';
import { Shield } from 'lucide-react';

interface RolePermissionBadgeProps {
  role: string;
  permissionCount: number;
}

export function RolePermissionBadge({ role, permissionCount }: RolePermissionBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">{getRoleDisplayName(role)}</span>
      {permissionCount > 0 && (
        <>
          <span className="text-gray-400">·</span>
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {permissionCount} {permissionCount === 1 ? 'permission' : 'permissions'}
          </Badge>
        </>
      )}
    </div>
  );
}
