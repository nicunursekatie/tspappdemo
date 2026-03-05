import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  X,
  Mail,
  MessageSquare,
  Bell
} from 'lucide-react';

interface AnalyticsOverview {
  totalStats: {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    totalDismissed: number;
    avgMlScore: number;
  };
  channelStats: Array<{
    channel: string;
    sent: number;
    opened: number;
    clicked: number;
    avgMlScore: number;
  }>;
  typeStats: Array<{
    type: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

interface NotificationAnalyticsDashboardProps {
  period?: '1d' | '7d' | '30d' | '90d';
}

export function NotificationAnalyticsDashboard({
  period = '30d'
}: NotificationAnalyticsDashboardProps) {
  const { data: analytics, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/notifications/analytics/overview', period],
    queryFn: () => apiRequest('GET', `/api/notifications/analytics/overview?period=${period}`),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8 text-gray-500">
        No analytics data available
      </div>
    );
  }

  const { totalStats, channelStats, typeStats } = analytics;

  const openRate = totalStats.totalSent > 0
    ? ((totalStats.totalOpened / totalStats.totalSent) * 100).toFixed(1)
    : '0';

  const clickRate = totalStats.totalSent > 0
    ? ((totalStats.totalClicked / totalStats.totalSent) * 100).toFixed(1)
    : '0';

  const dismissRate = totalStats.totalSent > 0
    ? ((totalStats.totalDismissed / totalStats.totalSent) * 100).toFixed(1)
    : '0';

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'in_app':
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Overview Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last {period}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalStats.totalOpened} opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clickRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalStats.totalClicked} clicked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dismiss Rate</CardTitle>
            <X className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dismissRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalStats.totalDismissed} dismissed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Channel</CardTitle>
          <CardDescription>
            Breakdown of notification performance across different delivery channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {channelStats.map((channel) => {
              const channelOpenRate = channel.sent > 0
                ? ((channel.opened / channel.sent) * 100).toFixed(1)
                : '0';
              const channelClickRate = channel.sent > 0
                ? ((channel.clicked / channel.sent) * 100).toFixed(1)
                : '0';

              return (
                <div key={channel.channel} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel.channel)}
                    <span className="font-medium capitalize">
                      {channel.channel.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-medium">{channel.sent}</div>
                      <div className="text-xs text-muted-foreground">sent</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{channelOpenRate}%</div>
                      <div className="text-xs text-muted-foreground">open</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{channelClickRate}%</div>
                      <div className="text-xs text-muted-foreground">click</div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      ML: {(channel.avgMlScore * 100).toFixed(0)}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Type</CardTitle>
          <CardDescription>
            Engagement metrics grouped by notification type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {typeStats.map((type) => {
              const typeOpenRate = type.sent > 0
                ? ((type.opened / type.sent) * 100).toFixed(1)
                : '0';
              const typeClickRate = type.sent > 0
                ? ((type.clicked / type.sent) * 100).toFixed(1)
                : '0';

              return (
                <div key={type.type} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {type.type.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-medium">{type.sent}</div>
                      <div className="text-xs text-muted-foreground">sent</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {parseFloat(typeOpenRate) >= 50 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="font-medium">{typeOpenRate}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground">open</div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        {parseFloat(typeClickRate) >= 30 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                        <span className="font-medium">{typeClickRate}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground">click</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
