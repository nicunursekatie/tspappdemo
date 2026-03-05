import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Shield,
  Clock,
  User,
  FileText,
  Trash2,
  Edit,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  MapPin,
  Users,
  Truck,
  Heart,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { PermissionDenied } from '@/components/permission-denied';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AuditLogEntry {
  id: number;
  action: string;
  tableName: string;
  recordId: string;
  oldData: any;
  newData: any;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  timestamp: string;
}

const TABLE_NAMES = {
  hosts: { label: 'Hosts', icon: MapPin, color: 'bg-blue-500' },
  host_contacts: { label: 'Host Contacts', icon: Users, color: 'bg-indigo-500' },
  recipients: { label: 'Recipients', icon: Heart, color: 'bg-pink-500' },
  recipient_tsp_contacts: {
    label: 'Recipient TSP Contacts',
    icon: Users,
    color: 'bg-purple-500',
  },
  drivers: { label: 'Drivers', icon: Truck, color: 'bg-green-500' },
  volunteers: { label: 'Volunteers', icon: Users, color: 'bg-orange-500' },
};

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN: 'bg-gray-100 text-gray-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
};

const ACTION_ICONS = {
  CREATE: Plus,
  UPDATE: Edit,
  DELETE: Trash2,
  LOGIN: User,
  LOGOUT: User,
};

export function ComprehensiveAuditLog() {
  const { user: currentUser } = useAuth();
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(100);

  // Check permissions
  if (!hasPermission(currentUser, PERMISSIONS.ADMIN_PANEL_ACCESS)) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-full max-w-md">
          <PermissionDenied
            action="view audit logs"
            requiredPermission="ADMIN_PANEL_ACCESS"
            variant="card"
          />
        </div>
      </div>
    );
  }

  // Fetch audit logs
  const {
    data: logs,
    isLoading,
    error,
    refetch,
  } = useQuery<AuditLogEntry[]>({
    queryKey: ['/api/audit-logs', { limit, tableName: tableFilter !== 'all' ? tableFilter : undefined }],
    queryFn: async ({ queryKey }) => {
      const [_key, params] = queryKey as [string, any];
      const queryParams = new URLSearchParams();
      if (params.tableName) queryParams.append('tableName', params.tableName);
      queryParams.append('limit', limit.toString());

      const response = await fetch(`/api/audit-logs?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
    enabled: hasPermission(currentUser, PERMISSIONS.ADMIN_PANEL_ACCESS),
  });

  // Fetch users for display names
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: hasPermission(currentUser, PERMISSIONS.ADMIN_PANEL_ACCESS),
  });

  const userMap = React.useMemo(() => {
    if (!users) return {};
    return users.reduce((acc: any, user: any) => {
      const displayName =
        user.displayName ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        user.email?.split('@')[0] ||
        'Unknown User';
      acc[user.id] = displayName;
      return acc;
    }, {});
  }, [users]);

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    if (!logs) return [];

    return logs.filter((log) => {
      // Filter out legacy EVENT_REQUEST_SIGNIFICANT_CHANGE entries (replaced with detailed logs)
      if (log.action === 'EVENT_REQUEST_SIGNIFICANT_CHANGE') return false;

      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const tableName = log.tableName.toLowerCase();
        const recordId = log.recordId.toLowerCase();
        const userName = userMap[log.userId || '']?.toLowerCase() || '';

        if (
          !tableName.includes(searchLower) &&
          !recordId.includes(searchLower) &&
          !userName.includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, actionFilter, searchTerm, userMap]);

  const renderChangeDetails = (log: AuditLogEntry) => {
    const metadata = log.newData?._auditMetadata;

    if (metadata?.changes && metadata.changes.length > 0) {
      return (
        <div className="mt-3 space-y-2">
          <h4 className="font-semibold text-sm text-gray-700">Changes:</h4>
          <ul className="space-y-1 text-sm">
            {metadata.changes.map((change: any, idx: number) => (
              <li key={idx} className="text-gray-600">
                {change.description}
              </li>
            ))}
          </ul>
          {metadata.summary && (
            <p className="text-xs text-gray-500 mt-2 italic">
              Summary: {metadata.summary}
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  const getTableInfo = (tableName: string) => {
    return (
      TABLE_NAMES[tableName as keyof typeof TABLE_NAMES] || {
        label: tableName,
        icon: FileText,
        color: 'bg-gray-500',
      }
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Audit Logs</CardTitle>
            <CardDescription>
              Track all changes to hosts, recipients, drivers, and volunteers
            </CardDescription>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by table, record ID, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tables</SelectItem>
              {Object.entries(TABLE_NAMES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="CREATE">Create</SelectItem>
              <SelectItem value="UPDATE">Update</SelectItem>
              <SelectItem value="DELETE">Delete</SelectItem>
            </SelectContent>
          </Select>

          <Select value={limit.toString()} onValueChange={(v) => setLimit(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 logs</SelectItem>
              <SelectItem value="100">100 logs</SelectItem>
              <SelectItem value="200">200 logs</SelectItem>
              <SelectItem value="500">500 logs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading audit logs...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading audit logs</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {filteredLogs.map((log) => {
                const tableInfo = getTableInfo(log.tableName);
                const TableIcon = tableInfo.icon;
                const ActionIcon =
                  ACTION_ICONS[log.action as keyof typeof ACTION_ICONS] || FileText;
                const actionColor =
                  ACTION_COLORS[log.action as keyof typeof ACTION_COLORS] ||
                  'bg-gray-100 text-gray-800';

                return (
                  <Collapsible key={log.id}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${tableInfo.color}`}>
                                <TableIcon className="h-4 w-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={actionColor}>
                                    <ActionIcon className="h-3 w-3 mr-1" />
                                    {log.action}
                                  </Badge>
                                  <span className="font-semibold text-gray-900">
                                    {tableInfo.label}
                                  </span>
                                  <span className="text-gray-500">#{log.recordId}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    <span>{userMap[log.userId || ''] || 'Unknown'}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {format(
                                        parseISO(log.timestamp),
                                        'MMM d, yyyy h:mm a'
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="pt-0">
                          <Separator className="mb-4" />
                          {renderChangeDetails(log)}
                          {log.ipAddress && (
                            <div className="mt-3 text-xs text-gray-500">
                              IP: {log.ipAddress}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {filteredLogs.length} of {logs?.length || 0} audit logs
        </div>
      </CardContent>
    </Card>
  );
}
