import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart3,
  TrendingUp,
  Users,
  MousePointer,
  Eye,
  CheckCircle,
  AlertCircle,
  Target,
  Zap,
  Sheet,
  LayoutGrid,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Progress } from '@/components/ui/progress';

interface AnalyticsEvent {
  eventName: string;
  properties: any;
  timestamp: string;
  userId: string;
  userRole: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: 'success' | 'warning' | 'error';
  target?: {
    current: number;
    goal: number;
    label: string;
  };
}

function MetricCard({ title, value, description, icon, trend, status, target }: MetricCardProps) {
  const statusColors = {
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusIcons = {
    success: <CheckCircle className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <div className="p-2 bg-brand-primary/10 rounded-lg">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-bold text-gray-900">{value}</div>
            {trend && (
              <div
                className={`flex items-center gap-1 text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                <TrendingUp
                  className={`w-4 h-4 ${trend.isPositive ? '' : 'rotate-180'}`}
                />
                {Math.abs(trend.value)}%
              </div>
            )}
          </div>

          {description && (
            <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
          )}

          {status && (
            <Badge
              variant="outline"
              className={`${statusColors[status]} border flex items-center gap-1 w-fit`}
            >
              {statusIcons[status]}
              {status === 'success' && 'Target Met'}
              {status === 'warning' && 'Needs Attention'}
              {status === 'error' && 'Below Target'}
            </Badge>
          )}

          {target && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{target.label}</span>
                <span className="font-medium text-gray-700">
                  {target.current}% / {target.goal}%
                </span>
              </div>
              <Progress value={target.current} className="h-2" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SpreadsheetAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Fetch activity logs that contain our analytics events
  const { data: activityLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/enhanced-user-activity/logs', timeRange],
    queryFn: async () => {
      try {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

        const response = await apiRequest('GET', `/api/enhanced-user-activity/logs?days=${days}`);
        return response || [];
      } catch (error) {
        console.error('Failed to fetch activity logs:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Process analytics from activity logs
  // NOTE: This implementation assumes Google Analytics events are stored in activity logs.
  // If GA events are not being stored in the database, this dashboard will show no data.
  // Consider implementing a backend endpoint to capture and store GA events, or query
  // the Google Analytics API directly instead.
  const analytics = useMemo(() => {
    const events = activityLogs.filter((log: any) =>
      log.action?.includes('event_requests') ||
      log.action?.includes('spreadsheet') ||
      log.action?.includes('view_mode') ||
      (typeof log.details === 'string' && log.details?.includes('scheduled'))
    );

    // Calculate metrics
    const totalPageLoads = events.filter((e: any) =>
      e.action?.includes('event_requests_page_loaded')
    ).length;

    const scheduledTabViews = events.filter((e: any) =>
      e.action?.includes('tab_scheduled_viewed')
    ).length;

    const spreadsheetSwitches = events.filter((e: any) =>
      e.action?.includes('switch_to_spreadsheet_view')
    ).length;

    const cardSwitches = events.filter((e: any) =>
      e.action?.includes('switch_to_card_view')
    ).length;

    const floatingButtonClicks = events.filter((e: any) =>
      e.action?.includes('floating_spreadsheet_button')
    ).length;

    // Calculate percentages - use initial_tab === 'scheduled' for accurate landing rate
    const scheduledInitialViews = events.filter((e: any) =>
      e.action?.includes('event_requests_initial_view') &&
      (e.properties?.initial_tab === 'scheduled' || e.details?.includes('initial_tab":"scheduled'))
    ).length;

    const scheduledLandingRate = totalPageLoads > 0
      ? Math.round((scheduledInitialViews / totalPageLoads) * 100)
      : 0;

    const spreadsheetPreference = (spreadsheetSwitches + cardSwitches) > 0
      ? Math.round((spreadsheetSwitches / (spreadsheetSwitches + cardSwitches)) * 100)
      : 100; // Default to 100% if no switches

    const uniqueUsers = new Set(events.map((e: any) => e.userId)).size;

    const floatingButtonAdoption = uniqueUsers > 0
      ? Math.round((new Set(
          events
            .filter((e: any) => e.action?.includes('floating_spreadsheet_button'))
            .map((e: any) => e.userId)
        ).size / uniqueUsers) * 100)
      : 0;

    // Role breakdown
    const roleBreakdown = events.reduce((acc: any, log: any) => {
      const role = log.metadata?.userRole || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {});

    // Daily activity
    const dailyActivity = events.reduce((acc: any, log: any) => {
      const date = new Date(log.timestamp).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPageLoads,
      scheduledTabViews,
      spreadsheetSwitches,
      cardSwitches,
      floatingButtonClicks,
      scheduledLandingRate,
      spreadsheetPreference,
      uniqueUsers,
      floatingButtonAdoption,
      roleBreakdown,
      dailyActivity,
      switchAwayRate: 100 - spreadsheetPreference,
    };
  }, [activityLogs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Spreadsheet View Analytics
          </h2>
          <p className="text-gray-600">
            Track adoption and usage of the new spreadsheet view feature
          </p>
        </div>

        {/* Time Range Selector */}
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Success Overview Banner */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500 rounded-xl">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-green-900">
                Overall Adoption Status
              </CardTitle>
              <CardDescription className="text-green-700">
                Measuring success against target KPIs
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Landing on Scheduled</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.scheduledLandingRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Target: &gt;80%</div>
              {analytics.scheduledLandingRate >= 80 ? (
                <Badge className="mt-2 bg-green-500">✓ Target Met</Badge>
              ) : (
                <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-700">
                  {80 - analytics.scheduledLandingRate}% to target
                </Badge>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Spreadsheet Preference</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.spreadsheetPreference}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Target: &gt;75%</div>
              {analytics.spreadsheetPreference >= 75 ? (
                <Badge className="mt-2 bg-green-500">✓ Target Met</Badge>
              ) : (
                <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-700">
                  {75 - analytics.spreadsheetPreference}% to target
                </Badge>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Floating Button Usage</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.floatingButtonAdoption}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Target: &gt;50%</div>
              {analytics.floatingButtonAdoption >= 50 ? (
                <Badge className="mt-2 bg-green-500">✓ Target Met</Badge>
              ) : (
                <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-700">
                  {50 - analytics.floatingButtonAdoption}% to target
                </Badge>
              )}
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-600 mb-1">Switch Away Rate</div>
              <div className="text-2xl font-bold text-gray-900">
                {analytics.switchAwayRate}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Target: &lt;10%</div>
              {analytics.switchAwayRate <= 10 ? (
                <Badge className="mt-2 bg-green-500">✓ Target Met</Badge>
              ) : (
                <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-700">
                  {analytics.switchAwayRate - 10}% above target
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Page Loads"
          value={analytics.totalPageLoads}
          description="Event Requests page visits"
          icon={<Eye className="w-5 h-5 text-brand-primary" />}
        />

        <MetricCard
          title="Scheduled Tab Views"
          value={analytics.scheduledTabViews}
          description="Users viewing scheduled events"
          icon={<Sheet className="w-5 h-5 text-brand-primary" />}
          target={{
            current: analytics.scheduledLandingRate,
            goal: 80,
            label: 'Landing rate target',
          }}
        />

        <MetricCard
          title="Unique Users"
          value={analytics.uniqueUsers}
          description="Active users in time period"
          icon={<Users className="w-5 h-5 text-brand-primary" />}
        />

        <MetricCard
          title="Floating Button Clicks"
          value={analytics.floatingButtonClicks}
          description="Quick navigation usage"
          icon={<MousePointer className="w-5 h-5 text-brand-primary" />}
          target={{
            current: analytics.floatingButtonAdoption,
            goal: 50,
            label: 'User adoption target',
          }}
        />
      </div>

      {/* View Preferences */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="w-5 h-5" />
              View Mode Preferences
            </CardTitle>
            <CardDescription>
              User switching behavior between card and spreadsheet views
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Sheet className="w-4 h-4 text-green-600" />
                    <span>Switch to Spreadsheet</span>
                  </div>
                  <span className="font-semibold">{analytics.spreadsheetSwitches}</span>
                </div>
                <Progress
                  value={analytics.spreadsheetPreference}
                  className="h-3"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-orange-600" />
                    <span>Switch to Card</span>
                  </div>
                  <span className="font-semibold">{analytics.cardSwitches}</span>
                </div>
                <Progress
                  value={analytics.switchAwayRate}
                  className="h-3 [&>div]:bg-orange-500"
                />
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-gray-600 mb-2">Interpretation:</div>
                {analytics.spreadsheetPreference >= 75 ? (
                  <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Strong preference for spreadsheet view.</strong> Users are
                      adopting the familiar layout well.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Some users prefer card view.</strong> Consider interviewing
                      users who switch frequently.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Recommended actions based on current metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.scheduledLandingRate >= 80 && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-green-900">Great landing rate!</strong>
                    <p className="text-green-700 mt-1">
                      Most users are seeing spreadsheet view by default. Feature is
                      discoverable.
                    </p>
                  </div>
                </div>
              )}

              {analytics.scheduledLandingRate < 80 && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-yellow-900">Increase visibility</strong>
                    <p className="text-yellow-700 mt-1">
                      Add announcement banner or onboarding tooltip to guide users to
                      spreadsheet view.
                    </p>
                  </div>
                </div>
              )}

              {analytics.floatingButtonAdoption >= 50 && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-green-900">Floating button success!</strong>
                    <p className="text-green-700 mt-1">
                      Half of users have discovered the quick navigation button. Feature
                      is valuable.
                    </p>
                  </div>
                </div>
              )}

              {analytics.floatingButtonClicks === 0 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-red-900">Button not used</strong>
                    <p className="text-red-700 mt-1">
                      No one has clicked the floating button. Consider making it more
                      prominent or animated.
                    </p>
                  </div>
                </div>
              )}

              {analytics.switchAwayRate > 10 && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <strong className="text-orange-900">Users switching away</strong>
                    <p className="text-orange-700 mt-1">
                      {analytics.switchAwayRate}% prefer card view. Interview these users
                      to understand why.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity by Role */}
      <Card>
        <CardHeader>
          <CardTitle>Activity by Role</CardTitle>
          <CardDescription>
            Breakdown of event requests interactions by user role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(analytics.roleBreakdown)
              .sort(([, a]: any, [, b]: any) => b - a)
              .map(([role, count]: [string, any]) => (
                <div key={role} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge variant="outline" className="capitalize">
                      {role.replace(/_/g, ' ')}
                    </Badge>
                    <Progress
                      value={(count / Math.max(...Object.values(analytics.roleBreakdown))) * 100}
                      className="h-2 flex-1"
                    />
                  </div>
                  <span className="font-semibold text-gray-700 ml-4">{count}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <strong>Need more detailed analytics?</strong>
              <p className="text-blue-700 mt-1">
                For comprehensive tracking including time duration, view transitions, and
                user journeys, check the full analytics guide at{' '}
                <code className="bg-blue-100 px-1 py-0.5 rounded">
                  docs/SPREADSHEET_VIEW_ANALYTICS.md
                </code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
