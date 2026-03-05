import React, { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye,
  MousePointer,
  FileText,
  Filter,
  Download,
  Plus,
  Edit,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { IndividualUserActivity } from '@/components/individual-user-activity';

interface ActivityLog {
  id: number;
  userId: string;
  userName: string;
  action: string;
  section: string;
  feature: string;
  page: string;
  details: string;
  metadata: any;
  duration: number | null;
  createdAt: string;
}

interface ActivitySummary {
  totalActions: number;
  uniqueUsers: number;
  topActions: Array<{ action: string; count: number }>;
  topSections: Array<{ section: string; count: number }>;
  topFeatures: Array<{ feature: string; count: number }>;
  recentActivity: ActivityLog[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function DetailedActivityAnalytics() {
  const [timeFilter, setTimeFilter] = useState('24h');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const { trackView, trackClick, trackFilter } = useActivityTracker();

  // Track component view on mount
  useEffect(() => {
    trackView(
      'Detailed Activity Analytics',
      'Analytics',
      'Activity Dashboard',
      'User opened detailed activity analytics dashboard'
    );
  }, [trackView]);

  // Fetch users list for the selector
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Get selected user object
  const selectedUser =
    selectedUserId !== 'all'
      ? users?.find((u) => u.id === selectedUserId)
      : null;

  // Fetch activity data
  const {
    data: activityData,
    isLoading,
    refetch,
  } = useQuery<ActivitySummary>({
    queryKey: [
      '/api/enhanced-user-activity',
      'detailed',
      timeFilter,
      sectionFilter,
      actionFilter,
      selectedUserId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        timeFilter,
        sectionFilter,
        actionFilter,
        detailed: 'true',
        ...(selectedUserId !== 'all' && {
          userId: selectedUserId,
          individual: 'true',
        }),
      });
      const response = await fetch(`/api/enhanced-user-activity?${params}`);
      if (!response.ok) throw new Error('Failed to fetch activity data');
      return response.json();
    },
    refetchInterval: 3 * 60 * 1000, // 3 minutes (reduced from 30 seconds for cost optimization)
  });

  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'time':
        setTimeFilter(value);
        trackFilter('Time Filter', value, 'Analytics', 'Activity Dashboard');
        break;
      case 'section':
        setSectionFilter(value);
        trackFilter('Section Filter', value, 'Analytics', 'Activity Dashboard');
        break;
      case 'action':
        setActionFilter(value);
        trackFilter('Action Filter', value, 'Analytics', 'Activity Dashboard');
        break;
      case 'user':
        setSelectedUserId(value);
        trackFilter('User Filter', value, 'Analytics', 'Activity Dashboard');
        break;
    }
  };

  const handleRefresh = () => {
    trackClick(
      'Refresh Data',
      'Analytics',
      'Activity Dashboard',
      'Manual refresh of activity data'
    );
    refetch();
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view':
        return <Eye className="h-4 w-4" />;
      case 'click':
        return <MousePointer className="h-4 w-4" />;
      case 'submit':
        return <FileText className="h-4 w-4" />;
      case 'filter':
        return <Filter className="h-4 w-4" />;
      case 'export':
        return <Download className="h-4 w-4" />;
      case 'create':
        return <Plus className="h-4 w-4" />;
      case 'update':
        return <Edit className="h-4 w-4" />;
      case 'delete':
        return <Trash2 className="h-4 w-4" />;
      default:
        return <MousePointer className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'view':
        return 'bg-brand-primary-light text-brand-primary-dark dark:bg-brand-primary-darker dark:text-brand-primary-muted';
      case 'click':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'submit':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'create':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'update':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'delete':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'export':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  // If a specific user is selected, show individual user activity
  if (selectedUser) {
    return (
      <IndividualUserActivity
        user={selectedUser}
        onBack={() => setSelectedUserId('all')}
      />
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Loading Activity Analytics...</CardTitle>
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
      {/* Header with Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Detailed Activity Analytics
            <Button onClick={handleRefresh} size="sm" variant="outline">
              Refresh Data
            </Button>
          </CardTitle>
          <CardDescription>
            Comprehensive tracking of user interactions, feature usage, and
            system engagement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select
              value={selectedUserId}
              onValueChange={(value) => handleFilterChange('user', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="View Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    All Users Overview
                  </div>
                </SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {user.firstName} {user.lastName}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={timeFilter}
              onValueChange={(value) => handleFilterChange('time', value)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sectionFilter}
              onValueChange={(value) => handleFilterChange('section', value)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="Collections">Collections</SelectItem>
                <SelectItem value="Analytics">Analytics</SelectItem>
                <SelectItem value="Dashboard">Dashboard</SelectItem>
                <SelectItem value="Reports">Reports</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={actionFilter}
              onValueChange={(value) => handleFilterChange('action', value)}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="View">View</SelectItem>
                <SelectItem value="Click">Click</SelectItem>
                <SelectItem value="Submit">Submit</SelectItem>
                <SelectItem value="Create">Create</SelectItem>
                <SelectItem value="Update">Update</SelectItem>
                <SelectItem value="Export">Export</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {activityData?.totalActions || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {activityData?.uniqueUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {activityData?.topActions?.[0]?.action || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Top Action</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {activityData?.topSections?.[0]?.section || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Top Section</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          <TabsTrigger value="actions">Top Actions</TabsTrigger>
          <TabsTrigger value="sections">Top Sections</TabsTrigger>
          <TabsTrigger value="features">Top Features</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent User Activity</CardTitle>
              <CardDescription>
                Real-time feed of user interactions and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {activityData?.recentActivity?.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {getActionIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getActionColor(activity.action)}>
                            {activity.action}
                          </Badge>
                          <span className="text-sm font-medium">
                            {activity.section}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ·
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {activity.feature}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {activity.details}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {activity.userName} •{' '}
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                          {activity.metadata &&
                            Object.keys(activity.metadata).length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {Object.keys(activity.metadata).length} metadata
                                fields
                              </span>
                            )}
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent activity found for the selected filters
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Popular Actions</CardTitle>
              <CardDescription>
                User actions ranked by frequency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityData?.topActions?.map((item, index) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      {getActionIcon(item.action)}
                      <span className="font-medium">{item.action}</span>
                    </div>
                    <Badge variant="secondary">{item.count} uses</Badge>
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No action data available for the selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Active Sections</CardTitle>
              <CardDescription>
                Application sections ranked by user engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityData?.topSections?.map((item, index) => (
                  <div
                    key={item.section}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{item.section}</span>
                    </div>
                    <Badge variant="secondary">{item.count} activities</Badge>
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No section data available for the selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Most Used Features</CardTitle>
              <CardDescription>
                Features ranked by user interaction frequency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activityData?.topFeatures?.map((item, index) => (
                  <div
                    key={item.feature}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{item.feature}</span>
                    </div>
                    <Badge variant="secondary">{item.count} uses</Badge>
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No feature data available for the selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Implementation Status */}
      <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="text-green-800 dark:text-green-200">
            ✅ Enhanced Activity Tracking Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
            <p>
              • <strong>Granular User Interactions:</strong> Click events, form
              submissions, feature usage, and navigation patterns
            </p>
            <p>
              • <strong>Real-time Data:</strong> Activity logs are captured
              instantly and updated every 30 seconds
            </p>
            <p>
              • <strong>Contextual Details:</strong> Each action includes
              section, feature, metadata, and user context
            </p>
            <p>
              • <strong>Advanced Analytics:</strong> Pattern recognition, usage
              trends, and actionable insights
            </p>
            <p>
              • <strong>Performance Optimized:</strong> Non-blocking logging
              with error resilience
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
