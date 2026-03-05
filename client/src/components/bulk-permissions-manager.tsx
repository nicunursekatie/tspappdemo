import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Search,
  Edit,
  Shield,
  Crown,
  Settings,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  Hash,
  Calendar,
  Truck,
  BarChart3,
  ListTodo,
  ClipboardList,
  Receipt,
  MessageCircle,
  StickyNote,
  Building,
  Car,
  Building2,
  FileText,
  UserCog,
  Loader2,
  HelpCircle,
  Link,
  Gift,
  FileInput,
  Clock,
  Upload,
  Trash2,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, USER_ROLES, getRoleDisplayName, applyPermissionDependencies } from '@shared/auth-utils';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import CleanPermissionsEditor from '@/components/clean-permissions-editor';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface PermissionStats {
  permission: string;
  userCount: number;
  percentage: number;
  users: { id: string; name: string; email: string }[];
}

interface FeatureWithIcon {
  permission: string;
  label: string;
  icon: LucideIcon;
}

// Curated list of key features for component-centric management
// Organized by category for easy navigation
const COMPONENT_ACCESS_CONFIG = {
  'Navigation Tabs': {
    icon: LayoutGrid,
    description: 'Control which tabs users can see in the sidebar',
    features: [
      // Core Operations
      { permission: PERMISSIONS.NAV_DRIVER_PLANNING, label: 'Driver Planning', icon: Truck },
      { permission: PERMISSIONS.NAV_EVENT_PLANNING, label: 'Event Planning', icon: Calendar },
      { permission: PERMISSIONS.NAV_COLLECTIONS_LOG, label: 'Collections Log', icon: ClipboardList },
      { permission: PERMISSIONS.NAV_TEAM_CHAT, label: 'Team Chat', icon: Hash },
      { permission: PERMISSIONS.VIEW_HOLDING_ZONE, label: 'Holding Zone', icon: StickyNote },
      // Analytics & Reporting
      { permission: PERMISSIONS.NAV_ANALYTICS, label: 'Analytics', icon: BarChart3 },
      { permission: PERMISSIONS.NAV_GRANT_METRICS, label: 'Grant Metrics', icon: BarChart3 },
      { permission: PERMISSIONS.NAV_WEEKLY_MONITORING, label: 'Weekly Monitoring', icon: BarChart3 },
      // Projects & Work
      { permission: PERMISSIONS.NAV_PROJECTS, label: 'Projects', icon: ListTodo },
      { permission: PERMISSIONS.NAV_MEETINGS, label: 'Meetings', icon: ClipboardList },
      { permission: PERMISSIONS.NAV_WORK_LOG, label: 'Work Log', icon: ClipboardList },
      { permission: PERMISSIONS.NAV_EXPENSES, label: 'Expenses & Receipts', icon: Receipt },
      // Directories
      { permission: PERMISSIONS.NAV_HOSTS, label: 'Hosts Directory', icon: Building2 },
      { permission: PERMISSIONS.NAV_DRIVERS, label: 'Drivers Directory', icon: Car },
      { permission: PERMISSIONS.NAV_VOLUNTEERS, label: 'Volunteers Directory', icon: Users },
      { permission: PERMISSIONS.NAV_RECIPIENTS, label: 'Recipients Directory', icon: Building },
      { permission: PERMISSIONS.NAV_GROUPS_CATALOG, label: 'Groups Catalog', icon: Building },
      // Calendar & Availability
      { permission: PERMISSIONS.NAV_YEARLY_CALENDAR, label: 'Yearly Calendar', icon: Calendar },
      { permission: PERMISSIONS.NAV_MY_AVAILABILITY, label: 'My Availability', icon: Calendar },
      { permission: PERMISSIONS.NAV_TEAM_AVAILABILITY, label: 'Team Availability', icon: Calendar },
      // Documentation & Resources
      { permission: PERMISSIONS.NAV_RESOURCES, label: 'Resources', icon: FileText },
      { permission: PERMISSIONS.NAV_IMPORTANT_LINKS, label: 'Quick Tools', icon: Link },
      { permission: PERMISSIONS.NAV_AUTO_FORM_FILLER, label: 'Auto Form Filler', icon: FileInput },
      { permission: PERMISSIONS.NAV_SERVICE_HOURS_FORM, label: 'Service Hours Form', icon: Clock },
      { permission: PERMISSIONS.NAV_WISHLIST, label: 'Amazon Wishlist', icon: Gift },
      { permission: PERMISSIONS.NAV_DOCUMENT_MANAGEMENT, label: 'Document Management', icon: FileText },
      { permission: PERMISSIONS.NAV_VOLUNTEER_HUB, label: 'Volunteer Hub', icon: Users },
      { permission: PERMISSIONS.NAV_HOST_RESOURCES, label: 'Host Resources', icon: Building2 },
      // Admin
      { permission: PERMISSIONS.ADMIN_PANEL_ACCESS, label: 'Admin Panel', icon: Settings },
      { permission: PERMISSIONS.NAV_USER_MANAGEMENT, label: 'User Management', icon: UserCog },
      { permission: PERMISSIONS.NAV_HISTORICAL_IMPORT, label: 'Historical Import', icon: Upload },
      // Help
      { permission: PERMISSIONS.NAV_HELP, label: 'Help', icon: HelpCircle },
    ],
  },
  'Chat Rooms': {
    icon: MessageCircle,
    description: 'Control access to specific chat rooms',
    features: [
      { permission: PERMISSIONS.CHAT_GENERAL, label: 'General Chat', icon: Hash },
      { permission: PERMISSIONS.CHAT_CORE_TEAM, label: 'Core Team Chat', icon: Users },
      { permission: PERMISSIONS.CHAT_BOARD, label: 'Board Chat', icon: Users },
      { permission: PERMISSIONS.CHAT_COMMITTEE, label: 'Committee Chat', icon: Users },
      { permission: PERMISSIONS.CHAT_GRANTS_COMMITTEE, label: 'Grants Committee', icon: Users },
      { permission: PERMISSIONS.CHAT_EVENTS_COMMITTEE, label: 'Events Committee', icon: Calendar },
      { permission: PERMISSIONS.CHAT_WEB_COMMITTEE, label: 'Web Committee', icon: Users },
      { permission: PERMISSIONS.CHAT_VOLUNTEER_MANAGEMENT, label: 'Volunteer Chat', icon: Users },
      { permission: PERMISSIONS.CHAT_DRIVER, label: 'Driver Chat', icon: Car },
      { permission: PERMISSIONS.CHAT_HOST, label: 'Host Chat', icon: Building2 },
      { permission: PERMISSIONS.CHAT_RECIPIENT, label: 'Recipient Chat', icon: Building },
      { permission: PERMISSIONS.CHAT_DIRECT, label: 'Direct Messages', icon: MessageCircle },
      { permission: PERMISSIONS.CHAT_GROUP, label: 'Group Chats', icon: Users },
      { permission: PERMISSIONS.CHAT_GROUP_ADD_MEMBERS, label: 'Add Members to Groups', icon: Users },
      { permission: PERMISSIONS.CHAT_GROUP_REMOVE_MEMBERS, label: 'Remove Members from Groups', icon: Users },
      { permission: PERMISSIONS.CHAT_MODERATE_MESSAGES, label: 'Moderate Messages (Edit/Delete Any)', icon: Shield },
    ],
  },
  'Event Capabilities': {
    icon: Calendar,
    description: 'Control what users can do with events',
    features: [
      { permission: PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS, label: 'Assign Others to Events', icon: Users },
      { permission: PERMISSIONS.EVENT_REQUESTS_SELF_SIGNUP, label: 'Self Sign-up for Events', icon: Users },
      { permission: PERMISSIONS.EVENT_REQUESTS_SEND_TOOLKIT, label: 'Send Event Toolkit', icon: FileText },
      { permission: PERMISSIONS.EVENT_REQUESTS_SEND_SMS, label: 'Send Event SMS', icon: MessageCircle },
      { permission: PERMISSIONS.EVENT_REQUESTS_FOLLOW_UP, label: 'Event Follow-up Actions', icon: Calendar },
      { permission: PERMISSIONS.EVENT_REQUESTS_EDIT_TSP_CONTACT, label: 'Edit TSP Contact', icon: UserCog },
      { permission: PERMISSIONS.EVENT_REQUESTS_VIEW_ADMIN_OVERVIEW, label: 'View Admin Overview', icon: BarChart3 },
      { permission: PERMISSIONS.EVENT_REQUESTS_EDIT_ALL_DETAILS, label: 'Edit All Event Details', icon: Edit },
      { permission: PERMISSIONS.EVENT_REQUESTS_DELETE_CARD, label: 'Delete Event Cards', icon: Edit },
    ],
  },
  'Data Management': {
    icon: Settings,
    description: 'Control data editing and management capabilities',
    features: [
      { permission: PERMISSIONS.USERS_EDIT, label: 'Edit Users', icon: UserCog },
      { permission: PERMISSIONS.HOSTS_EDIT, label: 'Edit Hosts', icon: Building2 },
      { permission: PERMISSIONS.DRIVERS_EDIT, label: 'Edit Drivers', icon: Car },
      { permission: PERMISSIONS.VOLUNTEERS_EDIT, label: 'Edit Volunteers', icon: Users },
      { permission: PERMISSIONS.RECIPIENTS_EDIT, label: 'Edit Recipients', icon: Building },
      { permission: PERMISSIONS.COLLECTIONS_EDIT_ALL, label: 'Edit All Collections', icon: ClipboardList },
      { permission: PERMISSIONS.PROJECTS_EDIT_ALL, label: 'Edit All Projects', icon: ListTodo },
      { permission: PERMISSIONS.WORK_LOGS_EDIT_ALL, label: 'Edit All Work Logs', icon: ClipboardList },
      { permission: PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL, label: 'Edit All Calendar Items', icon: Calendar },
      { permission: PERMISSIONS.EXPENSES_APPROVE, label: 'Approve Expenses', icon: Receipt },
      { permission: PERMISSIONS.DOCUMENTS_MANAGE, label: 'Manage Documents', icon: FileText },
      { permission: PERMISSIONS.DATA_EXPORT, label: 'Export Data', icon: FileText },
      { permission: PERMISSIONS.DATA_IMPORT, label: 'Import Data', icon: FileText },
    ],
  },
  'Holding Zone': {
    icon: Inbox,
    description: 'Control Holding Zone (Team Board) capabilities',
    features: [
      { permission: PERMISSIONS.VIEW_HOLDING_ZONE, label: 'View Holding Zone', icon: StickyNote },
      { permission: PERMISSIONS.SUBMIT_HOLDING_ZONE, label: 'Submit Items', icon: StickyNote },
      { permission: PERMISSIONS.HOLDING_ZONE_EDIT_OWN, label: 'Edit Own Items', icon: Edit },
      { permission: PERMISSIONS.HOLDING_ZONE_EDIT_ALL, label: 'Edit All Items', icon: Edit },
      { permission: PERMISSIONS.HOLDING_ZONE_DELETE_OWN, label: 'Delete Own Items', icon: Trash2 },
      { permission: PERMISSIONS.HOLDING_ZONE_DELETE_ALL, label: 'Delete All Items', icon: Trash2 },
      { permission: PERMISSIONS.MANAGE_HOLDING_ZONE, label: 'Full Management (Categories, Status)', icon: Settings },
      { permission: PERMISSIONS.COMMENT_HOLDING_ZONE, label: 'Comment on Items', icon: MessageCircle },
    ],
  },
  'Yearly Calendar': {
    icon: Calendar,
    description: 'Control TSP Yearly Calendar capabilities',
    features: [
      { permission: PERMISSIONS.YEARLY_CALENDAR_VIEW, label: 'View Calendar', icon: Calendar },
      { permission: PERMISSIONS.YEARLY_CALENDAR_ADD, label: 'Add Items', icon: Calendar },
      { permission: PERMISSIONS.YEARLY_CALENDAR_EDIT_OWN, label: 'Edit Own Items', icon: Edit },
      { permission: PERMISSIONS.YEARLY_CALENDAR_EDIT_ALL, label: 'Edit All Items', icon: Edit },
      { permission: PERMISSIONS.YEARLY_CALENDAR_DELETE_OWN, label: 'Delete Own Items', icon: Trash2 },
      { permission: PERMISSIONS.YEARLY_CALENDAR_DELETE_ALL, label: 'Delete All Items', icon: Trash2 },
    ],
  },
  'Hosts': {
    icon: Building2,
    description: 'Control Host location and contact management',
    features: [
      { permission: PERMISSIONS.HOSTS_VIEW, label: 'View Hosts', icon: Building2 },
      { permission: PERMISSIONS.HOSTS_ADD, label: 'Add Hosts', icon: Building2 },
      { permission: PERMISSIONS.HOSTS_EDIT_OWN, label: 'Edit Own Contact Details', icon: Edit },
      { permission: PERMISSIONS.HOSTS_EDIT, label: 'Edit All Hosts/Contacts', icon: Edit },
      { permission: PERMISSIONS.HOSTS_DELETE, label: 'Delete Hosts', icon: Trash2 },
      { permission: PERMISSIONS.HOST_RESOURCES_ACCESS, label: 'Access Host Resources', icon: FileText },
    ],
  },
};

export default function BulkPermissionsManager() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [permissionFilter, setPermissionFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'users' | 'permissions' | 'components'>('components');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Navigation Tabs']));
  const [selectedFeature, setSelectedFeature] = useState<{ permission: string; label: string } | null>(null);
  const [showAllPermissions, setShowAllPermissions] = useState(false);
  const [componentSearchQuery, setComponentSearchQuery] = useState('');
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 30000,
  });

  // Calculate permission statistics
  const permissionStats = useMemo(() => {
    if (!users.length) return [];

    const stats: PermissionStats[] = [];
    const allPermissions = Object.values(PERMISSIONS);

    allPermissions.forEach(permission => {
      const usersWithPermission = users.filter(user =>
        user.permissions?.includes(permission) || user.role === 'super_admin'
      );

      stats.push({
        permission,
        userCount: usersWithPermission.length,
        percentage: Math.round((usersWithPermission.length / users.length) * 100),
        users: usersWithPermission.map(user => ({
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
          email: user.email || ''
        }))
      });
    });

    return stats.sort((a, b) => b.userCount - a.userCount);
  }, [users]);

  // Filter users based on search and filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = !searchQuery ||
        `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;

      const matchesPermission = permissionFilter === 'all' ||
        user.permissions?.includes(permissionFilter) ||
        (user.role === 'super_admin' && permissionFilter !== 'none');

      return matchesSearch && matchesRole && matchesPermission;
    });
  }, [users, searchQuery, roleFilter, permissionFilter]);

  // Get all permissions organized by category for the "all permissions" view
  const allPermissionsByCategory = useMemo(() => {
    const categories: Record<string, { permission: string; label: string }[]> = {};

    Object.entries(PERMISSIONS).forEach(([key, value]) => {
      // Determine category based on permission prefix
      let category = 'Other';
      if (key.startsWith('NAV_')) category = 'Navigation';
      else if (key.startsWith('CHAT_')) category = 'Chat Rooms';
      else if (key.startsWith('EVENT_REQUESTS_')) category = 'Event Requests';
      else if (key.startsWith('HOSTS_')) category = 'Hosts';
      else if (key.startsWith('DRIVERS_')) category = 'Drivers';
      else if (key.startsWith('VOLUNTEERS_')) category = 'Volunteers';
      else if (key.startsWith('RECIPIENTS_')) category = 'Recipients';
      else if (key.startsWith('COLLECTIONS_')) category = 'Collections';
      else if (key.startsWith('PROJECTS_')) category = 'Projects';
      else if (key.startsWith('USERS_')) category = 'Users';
      else if (key.startsWith('WORK_LOGS_')) category = 'Work Logs';
      else if (key.startsWith('EXPENSES_')) category = 'Expenses';
      else if (key.startsWith('DOCUMENTS_')) category = 'Documents';
      else if (key.startsWith('MEETINGS_')) category = 'Meetings';
      else if (key.startsWith('SUGGESTIONS_')) category = 'Suggestions';
      else if (key.startsWith('AVAILABILITY_')) category = 'Availability';
      else if (key.startsWith('HOLDING_ZONE_') || key.includes('HOLDING_ZONE')) category = 'Holding Zone';
      else if (key.startsWith('ANALYTICS_') || key.startsWith('GRANT_METRICS_')) category = 'Analytics';
      else if (key.startsWith('DATA_')) category = 'Data Management';
      else if (key.startsWith('KUDOS_')) category = 'Kudos';
      else if (key.startsWith('COOLERS_')) category = 'Coolers';
      else if (key.startsWith('DISTRIBUTIONS_')) category = 'Distributions';
      else if (key === 'ADMIN_ACCESS' || key === 'ADMIN_PANEL_ACCESS') category = 'Admin';

      if (!categories[category]) categories[category] = [];
      categories[category].push({
        permission: value,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      });
    });

    return categories;
  }, []);

  // Single user permission update mutation
  const updateUserPermissionMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: string[] }) => {
      return apiRequest('PATCH', `/api/users/${userId}`, { permissions });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setUpdatingUsers(prev => {
        const next = new Set(prev);
        next.delete(variables.userId);
        return next;
      });
    },
    onError: (error: any, variables) => {
      setUpdatingUsers(prev => {
        const next = new Set(prev);
        next.delete(variables.userId);
        return next;
      });
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user permission.',
        variant: 'destructive',
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { userId: string; permissions: string[] }[]) => {
      const promises = updates.map(update =>
        apiRequest('PATCH', `/api/users/${update.userId}`, {
          permissions: update.permissions
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setSelectedUsers([]);
      toast({
        title: 'Bulk Update Complete',
        description: `Updated permissions for multiple users.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Bulk Update Failed',
        description: error.message || 'Failed to update user permissions.',
        variant: 'destructive',
      });
    },
  });

  const handleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const addPermissionToSelected = (permission: string) => {
    const updates = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return null;

      const newPermissions = [...(user.permissions || [])];
      if (!newPermissions.includes(permission)) {
        newPermissions.push(permission);
      }

      return { userId, permissions: applyPermissionDependencies(newPermissions) };
    }).filter(Boolean) as { userId: string; permissions: string[] }[];

    bulkUpdateMutation.mutate(updates);
  };

  const removePermissionFromSelected = (permission: string) => {
    const updates = selectedUsers.map(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return null;

      const newPermissions = (user.permissions || []).filter(p => p !== permission);

      return { userId, permissions: newPermissions };
    }).filter(Boolean) as { userId: string; permissions: string[] }[];

    bulkUpdateMutation.mutate(updates);
  };

  // Toggle a single user's permission for a specific feature
  const toggleUserPermission = (user: User, permission: string, enabled: boolean) => {
    if (user.role === 'super_admin') return; // Can't modify super admin

    setUpdatingUsers(prev => new Set(prev).add(user.id));

    let newPermissions: string[];
    if (enabled) {
      newPermissions = [...(user.permissions || []), permission];
      // Apply dependencies when granting permission
      newPermissions = applyPermissionDependencies(newPermissions);
    } else {
      newPermissions = (user.permissions || []).filter(p => p !== permission);
    }

    updateUserPermissionMutation.mutate({ userId: user.id, permissions: newPermissions });
  };

  // Grant permission to all users of a specific role
  const grantToRole = (permission: string, role: string) => {
    const usersToUpdate = users.filter(u => u.role === role && !u.permissions?.includes(permission));

    if (usersToUpdate.length === 0) {
      toast({
        title: 'No Changes Needed',
        description: `All ${getRoleDisplayName(role)} users already have this permission.`,
      });
      return;
    }

    const updates = usersToUpdate.map(user => ({
      userId: user.id,
      permissions: applyPermissionDependencies([...(user.permissions || []), permission]),
    }));

    bulkUpdateMutation.mutate(updates);
    toast({
      title: 'Granting Permission',
      description: `Adding permission to ${updates.length} ${getRoleDisplayName(role)} users...`,
    });
  };

  // Revoke permission from all users
  const revokeFromAll = (permission: string) => {
    const usersToUpdate = users.filter(u =>
      u.role !== 'super_admin' && u.permissions?.includes(permission)
    );

    if (usersToUpdate.length === 0) {
      toast({
        title: 'No Changes Needed',
        description: 'No users currently have this permission.',
      });
      return;
    }

    const updates = usersToUpdate.map(user => ({
      userId: user.id,
      permissions: (user.permissions || []).filter(p => p !== permission),
    }));

    bulkUpdateMutation.mutate(updates);
    toast({
      title: 'Revoking Permission',
      description: `Removing permission from ${updates.length} users...`,
    });
  };

  const getPermissionDisplayName = (permission: string) => {
    if (!permission) return '';
    return permission.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Check if user has permission
  const userHasPermission = (user: User, permission: string): boolean => {
    if (user.role === 'super_admin') return true;
    return user.permissions?.includes(permission) || false;
  };

  // Get users with/without a specific permission
  const getUsersForPermission = (permission: string) => {
    const activeUsers = users.filter(u => u.isActive !== false);
    const withPermission = activeUsers.filter(u => userHasPermission(u, permission));
    const withoutPermission = activeUsers.filter(u => !userHasPermission(u, permission) && u.role !== 'super_admin');
    return { withPermission, withoutPermission, total: activeUsers.length };
  };

  // Filter features based on search
  const filterFeatures = <T extends { permission: string; label: string }>(features: T[]): T[] => {
    if (!componentSearchQuery) return features;
    const query = componentSearchQuery.toLowerCase();
    return features.filter(f =>
      f.label.toLowerCase().includes(query) ||
      f.permission.toLowerCase().includes(query)
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Users...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bulk Permissions Manager</h2>
          <p className="text-gray-600">Manage permissions for multiple users at once</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'components' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('components')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Component Access
          </Button>
          <Button
            variant={viewMode === 'users' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('users')}
          >
            <Users className="h-4 w-4 mr-2" />
            Users View
          </Button>
          <Button
            variant={viewMode === 'permissions' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('permissions')}
          >
            <Shield className="h-4 w-4 mr-2" />
            Permissions View
          </Button>
        </div>
      </div>

      {/* Component Access View */}
      {viewMode === 'components' && (
        <div className="space-y-4">
          {/* Search and Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Component Access Manager</CardTitle>
                  <CardDescription>
                    Select a feature to see and manage which users have access
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Show all permissions</span>
                  <Switch
                    checked={showAllPermissions}
                    onCheckedChange={setShowAllPermissions}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search features or permissions..."
                  value={componentSearchQuery}
                  onChange={(e) => setComponentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Feature List */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {showAllPermissions ? 'All Permissions' : 'Key Features'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {showAllPermissions ? (
                      // Show all permissions organized by category
                      Object.entries(allPermissionsByCategory).map(([category, features]) => {
                        const filteredFeatures = filterFeatures(features);
                        if (filteredFeatures.length === 0) return null;

                        return (
                          <Collapsible
                            key={category}
                            open={expandedCategories.has(category)}
                            onOpenChange={() => toggleCategory(category)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  {expandedCategories.has(category) ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <span className="font-medium text-sm">{category}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {filteredFeatures.length}
                                  </Badge>
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-6 space-y-1">
                                {filteredFeatures.map((feature) => {
                                  const stats = getUsersForPermission(feature.permission);
                                  const isSelected = selectedFeature?.permission === feature.permission;

                                  return (
                                    <button
                                      key={feature.permission}
                                      onClick={() => setSelectedFeature(feature)}
                                      className={`w-full text-left p-2 rounded-lg transition-colors ${
                                        isSelected
                                          ? 'bg-brand-primary/10 border border-brand-primary'
                                          : 'hover:bg-gray-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm">{feature.label}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {stats.withPermission.length}/{stats.total}
                                        </Badge>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    ) : (
                      // Show curated features
                      Object.entries(COMPONENT_ACCESS_CONFIG).map(([category, config]) => {
                        const CategoryIcon = config.icon;
                        const features = config.features as FeatureWithIcon[];
                        const filteredFeatures = filterFeatures(features);
                        if (filteredFeatures.length === 0) return null;

                        return (
                          <Collapsible
                            key={category}
                            open={expandedCategories.has(category)}
                            onOpenChange={() => toggleCategory(category)}
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg border">
                                <div className="flex items-center gap-3">
                                  {expandedCategories.has(category) ? (
                                    <ChevronDown className="h-4 w-4 text-gray-500" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-500" />
                                  )}
                                  <CategoryIcon className="h-5 w-5 text-brand-primary" />
                                  <div className="text-left">
                                    <span className="font-medium">{category}</span>
                                    <p className="text-xs text-muted-foreground">{config.description}</p>
                                  </div>
                                </div>
                                <Badge variant="outline">
                                  {filteredFeatures.length} features
                                </Badge>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-8 mt-2 space-y-1">
                                {filteredFeatures.map((feature) => {
                                  const FeatureIcon = feature.icon;
                                  const stats = getUsersForPermission(feature.permission);
                                  const isSelected = selectedFeature?.permission === feature.permission;

                                  return (
                                    <button
                                      key={feature.permission}
                                      onClick={() => setSelectedFeature(feature)}
                                      className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between ${
                                        isSelected
                                          ? 'bg-brand-primary/10 border border-brand-primary'
                                          : 'hover:bg-gray-50 border border-transparent'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <FeatureIcon className="h-4 w-4 text-gray-500" />
                                        <span className="text-sm">{feature.label}</span>
                                      </div>
                                      <Badge
                                        variant={stats.withPermission.length === stats.total ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {stats.withPermission.length}/{stats.total}
                                      </Badge>
                                    </button>
                                  );
                                })}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Right: User Access Grid */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {selectedFeature ? (
                      <>User Access: {selectedFeature.label}</>
                    ) : (
                      'Select a feature to manage access'
                    )}
                  </span>
                  {selectedFeature && (
                    <div className="flex gap-2">
                      <Select onValueChange={(role) => grantToRole(selectedFeature.permission, role)}>
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue placeholder="Grant to role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(USER_ROLES).filter(r => r !== 'super_admin').map(role => (
                            <SelectItem key={role} value={role} className="text-xs">
                              Grant to {getRoleDisplayName(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => revokeFromAll(selectedFeature.permission)}
                      >
                        Revoke All
                      </Button>
                    </div>
                  )}
                </CardTitle>
                {selectedFeature && (
                  <CardDescription className="text-xs font-mono">
                    {selectedFeature.permission}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {selectedFeature ? (
                  <ScrollArea className="h-[450px]">
                    <div className="space-y-1">
                      {users
                        .filter(u => u.isActive !== false)
                        .sort((a, b) => {
                          // Sort: users with permission first, then by name
                          const aHas = userHasPermission(a, selectedFeature.permission);
                          const bHas = userHasPermission(b, selectedFeature.permission);
                          if (aHas !== bHas) return bHas ? 1 : -1;
                          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                        })
                        .map(user => {
                          const hasPermission = userHasPermission(user, selectedFeature.permission);
                          const isSuperAdmin = user.role === 'super_admin';
                          const isUpdating = updatingUsers.has(user.id);

                          return (
                            <div
                              key={user.id}
                              className={`flex items-center justify-between p-2 rounded-lg border ${
                                hasPermission ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                                  {user.firstName?.[0]}{user.lastName?.[0]}
                                </div>
                                <div>
                                  <div className="text-sm font-medium">
                                    {user.firstName} {user.lastName}
                                    {isSuperAdmin && (
                                      <Crown className="inline-block h-3 w-3 ml-1 text-amber-500" />
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {getRoleDisplayName(user.role)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isUpdating && (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                                <Switch
                                  checked={hasPermission}
                                  onCheckedChange={(checked) => toggleUserPermission(user, selectedFeature.permission, checked)}
                                  disabled={isSuperAdmin || isUpdating}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="h-[450px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Select a feature from the left panel</p>
                      <p className="text-sm">to manage user access</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Users View */}
      {viewMode === 'users' && (
        <>
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.values(USER_ROLES).map(role => (
                      <SelectItem key={role} value={role}>
                        {getRoleDisplayName(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={permissionFilter} onValueChange={setPermissionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Permissions</SelectItem>
                    <SelectItem value="none">No Permissions</SelectItem>
                    {Object.values(PERMISSIONS).slice(0, 20).map(permission => (
                      <SelectItem key={permission} value={permission}>
                        {getPermissionDisplayName(permission)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {filteredUsers.length} of {users.length} users
                  </Badge>
                  {selectedUsers.length > 0 && (
                    <Badge variant="default">
                      {selectedUsers.length} selected
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <Card className="border-brand-primary bg-brand-primary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Bulk Actions ({selectedUsers.length} users selected)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Select onValueChange={addPermissionToSelected}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add permission to all" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(PERMISSIONS).map(permission => (
                        <SelectItem key={permission} value={permission}>
                          + {getPermissionDisplayName(permission)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select onValueChange={removePermissionFromSelected}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Remove permission from all" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(PERMISSIONS).map(permission => (
                        <SelectItem key={permission} value={permission}>
                          - {getPermissionDisplayName(permission)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => setSelectedUsers([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Users & Permissions</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedUsers.length === filteredUsers.length ? 'Deselect All' : 'Select All'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map(user => (
                      <TableRow key={user.id} className={selectedUsers.includes(user.id) ? 'bg-brand-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(user.id)}
                            onCheckedChange={() => handleUserSelect(user.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getRoleDisplayName(user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {user.role === 'super_admin' ? (
                              <Badge className="bg-red-100 text-red-800">
                                <Crown className="h-3 w-3 mr-1" />
                                All Permissions
                              </Badge>
                            ) : (
                              <>
                                {(user.permissions || []).slice(0, 3).map(permission => (
                                  <TooltipProvider key={permission}>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="secondary" className="text-xs">
                                          {getPermissionDisplayName(permission)}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{permission}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ))}
                                {(user.permissions || []).length > 3 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-xs">
                                          +{(user.permissions || []).length - 3} more
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-xs">
                                          <p className="font-semibold mb-2">All Permissions:</p>
                                          <div className="space-y-1">
                                            {(user.permissions || []).filter(Boolean).map(perm => (
                                              <div key={perm} className="text-xs">
                                                {getPermissionDisplayName(perm)}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Permissions View */}
      {viewMode === 'permissions' && (
        <Card>
          <CardHeader>
            <CardTitle>Permission Distribution Analysis</CardTitle>
            <CardDescription>
              See which permissions are assigned to how many users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>User List</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissionStats
                    .filter(stat => stat.userCount > 0 || permissionFilter === 'all')
                    .map(stat => (
                    <TableRow key={stat.permission}>
                      <TableCell>
                        <div className="font-medium">
                          {getPermissionDisplayName(stat.permission)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stat.permission}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stat.userCount > 0 ? 'default' : 'outline'}>
                          {stat.userCount}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-brand-primary h-2 rounded-full"
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm">{stat.percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {stat.users.slice(0, 3).map(user => (
                            <TooltipProvider key={user.id}>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs">
                                    {user.name ? user.name.split(' ').map(n => n[0]).join('') : '?'}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {stat.users.length > 3 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className="text-xs">
                                    +{stat.users.length - 3}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="max-w-xs">
                                    <p className="font-semibold mb-2">All Users:</p>
                                    <div className="space-y-1">
                                      {stat.users.map(user => (
                                        <div key={user.id} className="text-xs">
                                          {user.name} ({user.email})
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Individual User Permissions Editor */}
      <CleanPermissionsEditor
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUser(null);
          }
        }}
        onSave={(userId, role, permissions) => {
          apiRequest('PATCH', `/api/users/${userId}`, { role, permissions })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['/api/users'] });
              queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
              setSelectedUser(null);
              toast({
                title: 'User Updated',
                description: 'User permissions have been successfully updated.',
              });
            })
            .catch((error: any) => {
              toast({
                title: 'Update Failed',
                description: error.message || 'Failed to update user permissions.',
                variant: 'destructive',
              });
            });
        }}
      />
    </div>
  );
}
