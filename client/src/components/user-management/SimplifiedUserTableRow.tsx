import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Edit,
  Eye,
  EyeOff,
  Trash2,
  KeyRound,
  Phone,
  BarChart3,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { RolePermissionBadge } from './RolePermissionBadge';
import { StatusBadge } from './StatusBadge';
import { formatLastLogin, formatDateCreated } from '@/lib/userHelpers';
import type { User } from '@/types/user';

interface SimplifiedUserTableRowProps {
  user: User;
  onEditUser: (user: User) => void;
  onToggleStatus: (userId: string, isActive: boolean) => void;
  onDeleteUser: (userId: string) => void;
  onSetPassword: (user: User) => void;
  onManageSMS: (user: User) => void;
  onViewActivity: (user: User) => void;
  isSelected?: boolean;
  onToggleSelection?: (userId: string) => void;
}

export function SimplifiedUserTableRow({
  user,
  onEditUser,
  onToggleStatus,
  onDeleteUser,
  onSetPassword,
  onManageSMS,
  onViewActivity,
  isSelected = false,
  onToggleSelection,
}: SimplifiedUserTableRowProps) {
  return (
    <TableRow
      key={user.id}
      className="hover:bg-gray-50 cursor-pointer"
      onClick={() => onEditUser(user)}
    >
      {onToggleSelection && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(user.id)}
            className="cursor-pointer"
            data-testid={`checkbox-user-${user.id}`}
          />
        </TableCell>
      )}
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
        <RolePermissionBadge
          role={user.role}
          permissionCount={user.permissions?.length || 0}
        />
      </TableCell>
      <TableCell>
        <StatusBadge isActive={user.isActive} />
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {formatLastLogin(user.lastLoginAt)}
      </TableCell>
      <TableCell className="text-sm text-gray-600">
        {formatDateCreated(user.createdAt)}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditUser(user)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
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
            <DropdownMenuItem
              onClick={() => onDeleteUser(user.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoreVertical className="h-4 w-4 mr-2" />
                More Actions
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
