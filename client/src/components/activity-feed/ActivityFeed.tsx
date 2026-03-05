import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Activity, ArrowRight, Plus, User, RefreshCw, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityItem {
  id: number;
  timestamp: string;
  eventId: string;
  organizationName: string;
  userName: string;
  userId: string;
  activityType: 'status_change' | 'created' | 'assignment' | 'update';
  description: string;
  oldStatus?: string;
  newStatus?: string;
  eventDate?: string | null;
}

interface ActivityFeedResponse {
  activities: ActivityItem[];
  count: number;
  totalCount: number;
  timeRange: {
    hours: number;
    since: string;
  };
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  in_process: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  scheduled: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-gray-100 text-gray-800 border-gray-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  postponed: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const activityTypeIcons: Record<string, typeof Activity> = {
  status_change: ArrowRight,
  created: Plus,
  assignment: User,
  update: RefreshCw,
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
  return (
    <Badge variant="outline" className={`${colorClass} text-xs capitalize`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function ActivityItemCard({ activity }: { activity: ActivityItem }) {
  const Icon = activityTypeIcons[activity.activityType] || Activity;
  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });
  
  const formattedEventDate = activity.eventDate 
    ? format(parseISO(activity.eventDate), 'MMM d, yyyy')
    : null;

  return (
    <div className="flex items-start gap-3 p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
      <div className="flex-shrink-0 mt-1">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate max-w-[200px]">
            {activity.organizationName}
          </span>
          {activity.activityType === 'status_change' && activity.oldStatus && activity.newStatus && (
            <div className="flex items-center gap-1">
              <StatusBadge status={activity.oldStatus} />
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <StatusBadge status={activity.newStatus} />
            </div>
          )}
          {activity.activityType === 'created' && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
              New Request
            </Badge>
          )}
        </div>
        {formattedEventDate && (
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Event: {formattedEventDate}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-0.5">
          by <span className="font-medium">{activity.userName}</span> {timeAgo}
        </p>
      </div>
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ActivityFeedProps {
  limit?: number;
  hours?: number;
  showHeader?: boolean;
  maxHeight?: string;
}

export function ActivityFeed({ 
  limit = 20, 
  hours = 72, 
  showHeader = true,
  maxHeight = '400px'
}: ActivityFeedProps) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivityFeedResponse>({
    queryKey: ['/api/audit-logs/activity-feed', { limit, hours }],
    refetchInterval: 60000,
  });

  if (error) {
    return (
      <Card>
        {showHeader && (
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Feed
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <p className="text-sm text-red-500">Failed to load activity feed</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Feed
              {data?.count ? (
                <Badge variant="secondary" className="ml-2">
                  {data.count}
                </Badge>
              ) : null}
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Last {hours} hours of event activity
          </p>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {isLoading ? (
          <ActivityFeedSkeleton />
        ) : data?.activities.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight }}>
            <div className="divide-y divide-gray-100">
              {data?.activities.map((activity) => (
                <ActivityItemCard key={activity.id} activity={activity} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
