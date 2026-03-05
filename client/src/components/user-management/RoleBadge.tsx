import { Badge } from '@/components/ui/badge';
import { USER_ROLES, getRoleDisplayName } from '@shared/auth-utils';
import {
  Users,
  Shield,
  Award,
  UserCheck,
  MapPin,
  Eye,
  Clock,
  Trophy,
  Building,
} from 'lucide-react';

function Crown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm8 8h4" />
    </svg>
  );
}

const ROLE_COLORS = {
  [USER_ROLES.SUPER_ADMIN]: 'bg-red-100 text-red-800 border-red-200',
  [USER_ROLES.ADMIN]: 'bg-brand-primary text-white border-brand-primary',
  [USER_ROLES.COMMITTEE_MEMBER]: 'bg-teal-100 text-teal-800 border-teal-200',
  [USER_ROLES.CORE_TEAM]: 'bg-orange-100 text-orange-800 border-orange-200',
  [USER_ROLES.HOST]: 'bg-green-100 text-green-800 border-green-200',
  [USER_ROLES.DEMO_USER]: 'bg-purple-100 text-purple-800 border-purple-200',
  [USER_ROLES.VOLUNTEER]: 'bg-purple-100 text-purple-800 border-purple-200',
  [USER_ROLES.RECIPIENT]: 'bg-teal-100 text-teal-800 border-teal-200',
  [USER_ROLES.DRIVER]: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  [USER_ROLES.VIEWER]: 'bg-gray-100 text-gray-800 border-gray-200',
  [USER_ROLES.WORK_LOGGER]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [USER_ROLES.REVIEWER]: 'bg-amber-100 text-amber-800 border-amber-200',
};

const ROLE_ICONS = {
  [USER_ROLES.SUPER_ADMIN]: Crown,
  [USER_ROLES.ADMIN]: Shield,
  [USER_ROLES.COMMITTEE_MEMBER]: Users,
  [USER_ROLES.CORE_TEAM]: Trophy,
  [USER_ROLES.HOST]: Building,
  [USER_ROLES.VOLUNTEER]: Award,
  [USER_ROLES.RECIPIENT]: UserCheck,
  [USER_ROLES.DRIVER]: MapPin,
  [USER_ROLES.VIEWER]: Eye,
  [USER_ROLES.WORK_LOGGER]: Clock,
  [USER_ROLES.REVIEWER]: Eye,
};

interface RoleBadgeProps {
  role: string;
  showIcon?: boolean;
  iconSize?: string;
}

export function RoleBadge({ role, showIcon = true, iconSize = 'h-3 w-3' }: RoleBadgeProps) {
  const RoleIcon = ROLE_ICONS[role as keyof typeof ROLE_ICONS] || Users;
  const colorClass = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || 'bg-gray-100';

  return (
    <Badge variant="outline" className={colorClass}>
      {showIcon && <RoleIcon className={`${iconSize} mr-1`} />}
      {getRoleDisplayName(role)}
    </Badge>
  );
}

export { ROLE_COLORS, ROLE_ICONS };
