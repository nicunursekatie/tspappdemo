import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Calendar, Clock, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserActivityTabProps {
  userId: string;
  userName: string;
  lastLoginAt?: string | null;
}

export function UserActivityTab({ userId, userName, lastLoginAt }: UserActivityTabProps) {
  const { data: activityStats, isLoading } = useQuery({
    queryKey: ['/api/enhanced-user-activity/user-stats', userId],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/user-stats/${userId}?days=30`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity stats');
      return res.json();
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['/api/enhanced-user-activity/logs', userId],
    queryFn: async () => {
      const res = await fetch(`/api/enhanced-user-activity/logs?userId=${userId}&days=7`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  const totalActions = activityStats?.totalActions || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">User Activity</h3>
        <p className="text-sm text-gray-600">
          Activity history for {userName} (last 30 days)
        </p>
      </div>

      {/* Last Login - Matches table display */}
      {lastLoginAt && (
        <Card className="mb-4 bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-700 font-medium">Last Login</p>
                <p className="text-sm font-semibold text-blue-900">
                  {(() => {
                    const date = new Date(lastLoginAt);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

                    if (diffDays === 0) return `Today, ${time}`;
                    if (diffDays === 1) return `Yesterday, ${time}`;
                    if (diffDays < 7) return `${diffDays} days ago, ${time}`;
                    return date.toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                  })()}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Login events and basic navigation are filtered from the activity list below
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-primary-light rounded-lg flex-shrink-0">
                <Activity className="h-6 w-6 text-brand-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">Total Actions</p>
                <p className="text-2xl font-bold truncate">{totalActions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">Top Sections</p>
                <p className="text-lg font-semibold truncate" title={activityStats?.sectionBreakdown?.[0]?.section || 'N/A'}>
                  {activityStats?.sectionBreakdown?.[0]?.section || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg flex-shrink-0">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">Most Active</p>
                <p className="text-lg font-semibold truncate">
                  {activityStats?.peakUsageTimes?.[0]?.hour !== undefined
                    ? (() => {
                        const hour = activityStats.peakUsageTimes[0].hour;
                        const period = hour >= 12 ? 'PM' : 'AM';
                        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                        return `${displayHour}:00 ${period}`;
                      })()
                    : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Most Used Features */}
      {activityStats?.sectionBreakdown && activityStats.sectionBreakdown.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Most Used Features</h4>
          <div className="space-y-2">
            {activityStats.sectionBreakdown.slice(0, 5).map((section: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm font-medium">
                  {section.section}
                </span>
                <Badge variant="secondary">{section.count} actions</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentLogs && recentLogs.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Recent Activity (Last 7 Days)
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentLogs
              // Filter out useless generic entries that don't provide insight
              .filter((log: any) => {
                // Handle details that might be string or object
                let details = '';
                if (typeof log.details === 'string') {
                  details = log.details;
                } else if (log.details && typeof log.details === 'object') {
                  details = log.details.message || JSON.stringify(log.details);
                }
                const feature = log.feature || '';
                const section = log.section || '';

                // Skip generic dashboard access entries
                if (details.includes('Accessed main dashboard') ||
                    details.includes('Created new main dashboard') ||
                    details.includes('User accessed dashboard') ||
                    details.includes('Accessed main overview dashboard')) {
                  return false;
                }

                // Skip "Online" entries which are just connection status
                if (feature === 'Online' || feature.toLowerCase() === 'online') {
                  return false;
                }

                // Skip entries with just numbers as features (meaningless)
                if (/^\d+$/.test(feature)) {
                  return false;
                }

                // Skip noisy "Dismissed" section entries that are just announcement polling
                // but keep actual "Dismissed X" action events
                if (section === 'Dismissed' && details.includes('Viewed')) {
                  return false;
                }

                // Skip generic "Main Dashboard" feature entries
                if (feature === 'Main Dashboard' && log.action === 'View') {
                  return false;
                }

                // Skip vague "Viewed list" or "Viewed X" without context
                if (details.match(/^Viewed\s+(list|status counts?|counts?)$/i)) {
                  return false;
                }

                // Skip "Navigated the platform" or similar useless entries
                if (details.match(/^Navigated\s+(the\s+)?platform$/i)) {
                  return false;
                }

                // Skip generic "Platform" section with no meaningful info
                if (section === 'Platform' && !details.includes('#')) {
                  return false;
                }

                // Skip entries that are just "Navigation" section with no specifics
                if (section === 'Navigation' && !log.metadata?.itemId) {
                  return false;
                }

                return true;
              })
              .slice(0, 10).map((log: any) => {
              // Helper function to make descriptions more readable
              const getReadableDescription = () => {
                if (log.details) {
                  // Handle details that could be string, object, or object with message
                  let desc: string;
                  if (typeof log.details === 'string') {
                    desc = log.details;
                  } else if (log.details && typeof log.details === 'object') {
                    // Extract message from object if present, otherwise use feature/action
                    desc = log.details.message || '';
                    if (!desc) {
                      // Don't show raw JSON - use feature name instead
                      desc = log.feature || log.action || 'Activity';
                    }
                  } else {
                    desc = 'Activity';
                  }
                  
                  // Clean up underscored feature names only if they're all lowercase
                  // Preserve intentional capitalization like SMS_ALERTS
                  if (desc.includes('_') && desc === desc.toLowerCase()) {
                    desc = desc.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  } else if (desc.includes('_')) {
                    // Just replace underscores with spaces, keep original casing
                    desc = desc.replace(/_/g, ' ');
                  }
                  
                  // Skip showing raw JSON strings
                  if (desc.startsWith('{') || desc.startsWith('[')) {
                    return log.feature || log.action || 'Activity';
                  }
                  
                  // Make common patterns more meaningful
                  if (desc.includes('Viewed kudos system')) {
                    return 'Checked kudos inbox';
                  }
                  if (desc.includes('Viewed counts') || desc.includes('Viewed count ')) {
                    return 'Reviewed collection counts';
                  }
                  if (desc.includes('Viewed hosts')) {
                    return 'Browsed hosts directory';
                  }
                  if (desc.includes('Viewed announcements')) {
                    return 'Read team announcements';
                  }
                  if (desc.includes('Viewed') && desc.includes('content')) {
                    // Extract the feature name from "Viewed X content"
                    const match = desc.match(/Viewed (.+?) content/);
                    if (match && match[1]) {
                      const cleanName = match[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return `Viewed ${cleanName}`;
                    }
                  }
                  
                  return desc;
                }
                return log.action?.replace(/_/g, ' ') || 'Activity';
              };

              // Map section names to cleaner display names (only for truly generic labels)
              const sectionMap: Record<string, string> = {
                'Basic': 'Dashboard',
                'Count': 'Collection Counts',
                'Counts': 'Collection Statistics',
              };
              const displaySection = log.section ? (sectionMap[log.section] || log.section) : null;

              // Format duration if available
              const getDurationDisplay = () => {
                const duration = log.duration || log.metadata?.durationSeconds;
                if (!duration) return null;

                const seconds = typeof duration === 'number' ? duration : parseInt(duration);
                if (isNaN(seconds) || seconds < 1) return null;

                if (seconds < 60) return `${seconds}s`;
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                if (minutes < 60) {
                  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
                }
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                return `${hours}h ${remainingMinutes}m`;
              };

              const durationDisplay = getDurationDisplay();

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {displaySection && (
                        <Badge variant="outline" className="text-xs">
                          {displaySection}
                        </Badge>
                      )}
                      {durationDisplay && (
                        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                          <Clock className="h-3 w-3 mr-1" />
                          {durationDisplay}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {getReadableDescription()}
                    </p>
                    {log.feature && log.feature !== log.section && log.feature !== getReadableDescription() && (
                      <p className="text-xs text-gray-500 mt-1">{log.feature}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalActions === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No activity recorded in the last 30 days</p>
        </div>
      )}
    </div>
  );
}
