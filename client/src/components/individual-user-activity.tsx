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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Eye,
  MousePointer,
  FileText,
  Clock,
  Calendar,
} from 'lucide-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

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

interface IndividualUserActivityProps {
  user: User;
  onBack: () => void;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'View':
      return <Eye className="h-4 w-4" />;
    case 'Click':
      return <MousePointer className="h-4 w-4" />;
    case 'Submit':
      return <FileText className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case 'View':
      return 'bg-brand-primary-light text-brand-primary-dark';
    case 'Click':
      return 'bg-green-100 text-green-800';
    case 'Submit':
      return 'bg-purple-100 text-purple-800';
    case 'Create':
      return 'bg-emerald-100 text-emerald-800';
    case 'Update':
      return 'bg-orange-100 text-orange-800';
    case 'Export':
      return 'bg-indigo-100 text-indigo-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const formatFieldName = (fieldName: string) => {
  // Convert camelCase/snake_case to readable format
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

export function IndividualUserActivity({
  user,
  onBack,
}: IndividualUserActivityProps) {
  const [timeFilter, setTimeFilter] = useState('7d');
  const [actionFilter, setActionFilter] = useState('all');

  // Fetch individual user activity data
  const { data: userActivity, isLoading } = useQuery<{
    activities: ActivityLog[];
    summary: {
      totalActions: number;
      loginCount: number;
      lastActivity: string | null;
      topActions: Array<{ action: string; count: number }>;
      topSections: Array<{ section: string; count: number }>;
    };
  }>({
    queryKey: [
      '/api/enhanced-user-activity',
      'individual',
      user.id,
      timeFilter,
      actionFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        userId: user.id,
        timeFilter,
        actionFilter,
        individual: 'true',
      });
      const response = await fetch(`/api/enhanced-user-activity?${params}`);
      if (!response.ok) throw new Error('Failed to fetch user activity data');
      return response.json();
    },
    refetchInterval: 3 * 60 * 1000, // 3 minutes (reduced from 30 seconds for cost optimization)
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span>
                  {user.firstName} {user.lastName}
                </span>
                <Badge variant="secondary">{user.email}</Badge>
              </CardTitle>
              <CardDescription>
                Individual user activity and engagement analytics
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Time Period:</span>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Action Type:</span>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
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
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {userActivity?.summary.totalActions || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold">
              {userActivity?.summary.loginCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Login Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-bold">
              {userActivity?.summary.lastActivity
                ? formatDate(userActivity.summary.lastActivity)
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">Last Activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-bold">
              {userActivity?.summary.topActions?.[0]?.action || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Most Common Action</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Actions and Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Top Actions</CardTitle>
            <CardDescription>Most frequently performed actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userActivity?.summary.topActions
                ?.slice(0, 5)
                .map((item, index) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      {getActionIcon(item.action)}
                      <span className="font-medium">{item.action}</span>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                )) || (
                <div className="text-center py-4 text-muted-foreground">
                  No action data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Sections</CardTitle>
            <CardDescription>Most visited application sections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userActivity?.summary.topSections
                ?.slice(0, 5)
                .map((item, index) => (
                  <div
                    key={item.section}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{item.section}</span>
                    </div>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                )) || (
                <div className="text-center py-4 text-muted-foreground">
                  No section data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Chronological list of all user activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <div className="space-y-3">
              {userActivity?.activities?.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
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
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {activity.feature}
                      </span>
                      {activity.duration && (
                        <>
                          <span className="text-xs text-muted-foreground">
                            ·
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(activity.duration)}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-foreground">
                      {activity.details}
                    </p>
                    {/* Show specific field changes for Updates */}
                    {activity.action === 'Update' &&
                      activity.metadata?.auditDetails && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                          <div className="font-medium text-gray-700 mb-1">
                            Changes made:
                          </div>
                          <div className="space-y-1">
                            {Object.entries(activity.metadata.auditDetails).map(
                              ([field, details]: [string, any]) => (
                                <div key={field} className="flex flex-col">
                                  <span className="font-medium text-gray-600">
                                    {formatFieldName(field)}:
                                  </span>
                                  <div className="ml-2 text-gray-700">
                                    <span className="text-red-600">
                                      From: {details.from || '(empty)'}
                                    </span>
                                    <span className="mx-2">→</span>
                                    <span className="text-green-600">
                                      To: {details.to || '(empty)'}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1 inline" />
                        {formatDate(activity.createdAt)}
                      </span>
                      {activity.metadata &&
                        Object.keys(activity.metadata).length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {Object.keys(activity.metadata).length} metadata
                            field
                            {Object.keys(activity.metadata).length > 1
                              ? 's'
                              : ''}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center py-8 text-muted-foreground">
                  {isLoading
                    ? 'Loading activity data...'
                    : 'No activity found for this user in the selected time period'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
