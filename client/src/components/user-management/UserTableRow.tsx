import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ButtonTooltip } from '@/components/ui/button-tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Settings,
  KeyRound,
  Phone,
  BarChart3,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { RoleBadge } from './RoleBadge';
import { StatusBadge } from './StatusBadge';
import { SMSBadge } from './SMSBadge';
import { formatLastLogin } from '@/lib/userHelpers';
import type { User } from '@/types/user';

interface UserTableRowProps {
  user: User;
  usersById: Map<string, User>;
  onEditUser: (user: User) => void;
  onEditPermissions: (user: User) => void;
  onSetPassword: (user: User) => void;
  onManageSMS: (user: User) => void;
  onViewActivity: (user: User) => void;
  onToggleStatus: (userId: string, isActive: boolean) => void;
  onDeleteUser: (userId: string) => void;
}

export function UserTableRow({
  user,
  usersById,
  onEditUser,
  onEditPermissions,
  onSetPassword,
  onManageSMS,
  onViewActivity,
  onToggleStatus,
  onDeleteUser,
}: UserTableRowProps) {
  const getPermissionsTooltip = (user: User) => {
    const permissionCount = user.permissions?.length || 0;
    const baseMessage = `Shows how many specific permissions this user has been granted. ${permissionCount} permission${
      permissionCount === 1 ? '' : 's'
    } assigned.`;
    const menuHint = ' Click the menu to edit their permissions.';

    if (!user.permissionsModifiedAt) {
      return `${baseMessage} Permissions have not been updated since the user was created.${menuHint}`;
    }

    const modifiedDate = new Date(user.permissionsModifiedAt);
    const formattedDate = modifiedDate.toLocaleString();

    let modifierLabel = '';
    if (user.permissionsModifiedBy) {
      const modifier = usersById.get(user.permissionsModifiedBy);
      if (modifier) {
        const name = [modifier.firstName, modifier.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        modifierLabel = name || modifier.email || modifier.id;
      } else {
        modifierLabel = user.permissionsModifiedBy;
      }
    }

    return `${baseMessage} Last updated on ${formattedDate}${
      modifierLabel ? ` by ${modifierLabel}` : ''
    }.${menuHint}`;
  };

  return (
    <TableRow key={user.id} className="hover:bg-gray-50">
      <TableCell>
        <div className="flex items-center gap-3">
          <UserAvatar firstName={user.firstName} lastName={user.lastName} />
          <div>
            <div className="font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <RoleBadge role={user.role} />
      </TableCell>
      <TableCell>
        <StatusBadge isActive={user.isActive} />
      </TableCell>
      <TableCell>
        <SMSBadge smsConsent={user.metadata?.smsConsent} />
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {formatLastLogin(user.lastLoginAt)}
      </TableCell>
      <TableCell>
        <ButtonTooltip explanation={getPermissionsTooltip(user)}>
          <Badge variant="outline">
            {user.permissions?.length || 0} permissions
          </Badge>
        </ButtonTooltip>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditUser(user)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit User Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditPermissions(user)}>
              <Settings className="h-4 w-4 mr-2" />
              Edit Permissions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSetPassword(user)}>
              <KeyRound className="h-4 w-4 mr-2" />
              Set Password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageSMS(user)}>
              <Phone className="h-4 w-4 mr-2" />
              Manage SMS
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewActivity(user)}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Activity
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onToggleStatus(user.id, !user.isActive)}
            >
              {user.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteUser(user.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
