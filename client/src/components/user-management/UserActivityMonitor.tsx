import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  Clock,
  User,
  Monitor,
  TrendingUp,
  Calendar,
  Eye,
  MousePointer,
  LogIn,
  Timer,
  Users,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow, format, parseISO } from 'date-fns';

interface UserActivity {
  userId: string;
  userName: string;
  totalActions: number;
  lastActivity: string;
  topActions: Array<{ action: string; count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
  featureUsage: Array<{ feature: string; count: number; avgDuration: number }>;
  sectionBreakdown: Array<{ section: string; actions: number; timeSpent: number }>;
  peakUsageTimes: Array<{ hour: number; count: number }>;
}

interface EnhancedStats {
  totalUsers: number;
  activeUsers: number;
  activeUsersLast24h: number;
  activeUsersLast12h: number;
  totalActions: number;
  averageActionsPerUser: number;
  topSections: Array<{ section: string; actions: number; usage: number }>;
  topFeatures: Array<{ feature: string; usage: number }>;
  dailyActiveUsers: Array<{ date: string; users: number }>;
}

interface ActivityLog {
  id: number;
  userId: string;
  userName: string;
  action: string;
  section: string;
  feature: string | null;
  page: string | null;
  details: any;
  duration: number | null;
  createdAt: string;
  metadata: any;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function getActionIcon(action: string) {
  switch (action) {
    case 'PAGE_VIEW':
      return <Eye className="h-3.5 w-3.5 text-blue-500" />;
    case 'LOGIN':
      return <LogIn className="h-3.5 w-3.5 text-green-500" />;
    case 'FEATURE_USE':
      return <MousePointer className="h-3.5 w-3.5 text-purple-500" />;
    case 'SESSION_START':
      return <Timer className="h-3.5 w-3.5 text-teal-500" />;
    default:
      return <Activity className="h-3.5 w-3.5 text-gray-500" />;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'PAGE_VIEW':
      return 'bg-blue-100 text-blue-800';
    case 'LOGIN':
      return 'bg-green-100 text-green-800';
    case 'FEATURE_USE':
      return 'bg-purple-100 text-purple-800';
    case 'SESSION_START':
      return 'bg-teal-100 text-teal-800';
    case 'SESSION_END':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/** Build a helpful context line from section/feature/details so "in dashboard" becomes meaningful */
function getActivityContextLabel(log: ActivityLog): string {
  const section = (log.section || '').trim();
  const feature = (log.feature || '').trim();
  const details = typeof log.details === 'string' ? (log.details || '').trim() : '';

  // Prefer details when they describe the action (e.g. "Opened Event Detail", "Closed Collection Log")
  if (details && details.length > 0 && details.length <= 80) {
    return details;
  }
  if (details && details.length > 80) {
    return details.slice(0, 77) + '...';
  }

  // Section + feature when they add info (avoid "Dashboard • Main Dashboard")
  if (section && feature && feature !== section) {
    const s = section.toLowerCase();
    const f = feature.toLowerCase();
    if (s === 'dashboard' && (f === 'main dashboard' || f === 'dashboard')) {
      return feature;
    }
    return `${section} • ${feature}`;
  }
  if (feature) return feature;
  if (section) return section;
  return 'Activity';
}

export function UserActivityMonitor() {
  const [timeRange, setTimeRange] = useState<string>('7');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Fetch enhanced stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<EnhancedStats>({
    queryKey: ['enhanced-activity-stats', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/enhanced-stats?days=${timeRange}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Fetch detailed user activities
  const { data: userActivities, isLoading: usersLoading, refetch: refetchUsers } = useQuery<UserActivity[]>({
    queryKey: ['detailed-user-activities', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/detailed-users?days=${timeRange}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch user activities');
      return res.json();
    },
  });

  // Fetch activity logs
  const { data: activityLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<ActivityLog[]>({
    queryKey: ['activity-logs', timeRange, selectedUser],
    queryFn: async () => {
      const params = new URLSearchParams({ days: timeRange });
      if (selectedUser !== 'all') params.append('userId', selectedUser);
      const res = await fetch(`/api/enhanced-user-activity/logs?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchUsers();
    refetchLogs();
  };

  // Sort users by most recent activity
  const sortedUsers = [...(userActivities || [])].sort((a, b) => {
    const dateA = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
    const dateB = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
    return dateB - dateA;
  });

  // Check if a user is currently online (active in last 15 minutes)
  const isOnline = (lastActivity: string | null): boolean => {
    if (!lastActivity) return false;
    const lastActiveTime = new Date(lastActivity).getTime();
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    return lastActiveTime > fifteenMinutesAgo;
  };

  // Get online status badge
  const getOnlineStatus = (lastActivity: string | null) => {
    if (!lastActivity) return null;

    const lastActiveTime = new Date(lastActivity).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastActiveTime) / (1000 * 60));

    if (diffMinutes < 5) {
      return <Badge className="bg-green-500 text-white text-xs">Online now</Badge>;
    } else if (diffMinutes < 15) {
      return <Badge className="bg-yellow-500 text-white text-xs">Active {diffMinutes}m ago</Badge>;
    } else if (diffMinutes < 60) {
      return <Badge variant="outline" className="text-xs">{diffMinutes}m ago</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">User Activity Monitor</h2>
          <p className="text-sm text-gray-500">Track who's online and what they're doing</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="3">Last 3 days</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Online Now</p>
                <p className="text-2xl font-bold text-green-600">
                  {sortedUsers.filter(u => isOnline(u.lastActivity)).length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Monitor className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Today</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.activeUsersLast24h || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Actions</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats?.totalActions?.toLocaleString() || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg Actions/User</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats?.averageActionsPerUser || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent User Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Sign-ins & Activity
            </CardTitle>
            <CardDescription>
              Who's been active and what they've been doing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {usersLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : sortedUsers.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No activity recorded in this time period
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedUsers.map((user) => (
                    <div
                      key={user.userId}
                      className={`p-3 rounded-lg border ${
                        isOnline(user.lastActivity)
                          ? 'border-green-200 bg-green-50/50'
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${
                            isOnline(user.lastActivity) ? 'bg-green-500' : 'bg-gray-400'
                          }`}>
                            {user.userName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {user.userName || 'Unknown User'}
                              </span>
                              {getOnlineStatus(user.lastActivity)}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {user.lastActivity ? (
                                <>
                                  Last active: {formatDistanceToNow(parseISO(user.lastActivity), { addSuffix: true })}
                                </>
                              ) : (
                                'No recent activity'
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {user.totalActions} actions
                          </div>
                        </div>
                      </div>

                      {/* Top sections for this user */}
                      {user.sectionBreakdown && user.sectionBreakdown.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {user.sectionBreakdown.slice(0, 4).map((section) => (
                            <Badge
                              key={section.section}
                              variant="secondary"
                              className="text-xs"
                            >
                              {section.section}: {section.actions}
                              {section.timeSpent ? ` (${formatDuration(section.timeSpent)})` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Live Activity Feed
                </CardTitle>
                <CardDescription>
                  Real-time log of user actions
                </CardDescription>
              </div>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {sortedUsers.map((user) => (
                    <SelectItem key={user.userId} value={user.userId}>
                      {user.userName || user.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {logsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : !activityLogs || activityLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No activity logs found
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.slice(0, 100).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors"
                    >
                      <div className="mt-1">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-gray-900">
                            {log.userName}
                          </span>
                          <Badge className={`text-xs ${getActionColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {getActivityContextLabel(log)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {log.createdAt ? formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true }) : ''}
                          </span>
                          {log.duration != null && log.duration > 0 && (
                            <span className="text-xs text-gray-400">
                              • {formatDuration(log.duration)}
                            </span>
                          )}
                          {log.page && log.page !== '/' && log.page !== '/dashboard' && (
                            <span className="text-xs text-gray-400 truncate max-w-[150px]" title={log.page}>
                              • {log.page}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Top Sections Usage */}
      {stats?.topSections && stats.topSections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Most Used Sections
            </CardTitle>
            <CardDescription>
              Where users spend their time in the app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {stats.topSections.slice(0, 10).map((section, index) => (
                <div
                  key={section.section}
                  className="p-3 rounded-lg bg-gray-50 border border-gray-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {section.section}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {section.actions.toLocaleString()} actions by {section.usage} users
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default UserActivityMonitor;
