import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Heart,
  Users,
  Calendar,
  MapPin,
  Award,
  Target,
  Clock,
  DollarSign,
  PieChart,
  BarChart3,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
} from 'recharts';
import { useState, useEffect, useMemo } from 'react';
import MonthlyComparisonAnalytics from '@/components/monthly-comparison-analytics';
import ActionCenter from '@/components/action-center';
import PredictiveForecasts from '@/components/predictive-forecasts';
import {
  processCollectionDataForChart,
  calculateHostPerformance,
  calculateTrendAnalysis,
  calculateImpactMetrics,
  parseCollectionDate,
  calculateTotalSandwiches,
  type DateRangeFilter,
  type ChartViewType,
} from '@/lib/analytics-utils';
import { usePageSession } from '@/hooks/usePageSession';
import { logger } from '@/lib/logger';
import { FloatingAIChat } from '@/components/floating-ai-chat';
import { useCollectionsData } from '@/hooks/useCollectionsData';

export default function ImpactDashboard() {
  // Track page session for activity logging
  usePageSession({
    section: 'Analytics',
    page: 'Impact Dashboard',
  });

  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>('1year');
  const [trendsView, setTrendsView] = useState<'recent' | 'seasonal' | 'historical'>('recent');

  // Use shared collections data hook
  const { collections, hosts, stats, hybridStats } = useCollectionsData();

  // Use shared utility functions with memoization
  const chartData = useMemo(
    () => processCollectionDataForChart(collections, dateRange, chartView as ChartViewType),
    [collections, dateRange, chartView]
  );

  const hostPerformance = useMemo(
    () => calculateHostPerformance(collections),
    [collections]
  );

  const trendAnalysis = useMemo(
    () => calculateTrendAnalysis(collections),
    [collections]
  );

  const impactMetrics = useMemo(
    () => calculateImpactMetrics(collections, hybridStats, stats),
    [collections, hybridStats, stats]
  );

  // Debug logging for final data
  logger.log('=== IMPACT DASHBOARD DEBUG ===');
  logger.log('Final chartData:', chartData);
  logger.log('Final chartData length:', chartData?.length);
  logger.log('Chart view:', chartView);
  logger.log('Collections count:', collections?.length);
  logger.log('Stats data from API:', stats);
  logger.log('=== END DEBUG ===');

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <div className="bg-gradient-to-br from-brand-primary-lighter to-brand-primary-light p-6 rounded-lg">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Impact Dashboard
          </h1>
          <p className="text-lg text-gray-600">
            Visualizing our community impact through sandwich collections
          </p>
        </div>

        {/* Key Impact Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                Verified Sandwiches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.totalSandwiches?.toLocaleString()}
              </div>
              <p className="text-white/90 text-sm">
                From collections log database
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Active Hosts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.uniqueHosts}
              </div>
              <p className="text-white/90 text-sm">Collection locations</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-teal-500 to-teal-600 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.currentMonthTotal?.toLocaleString() || '0'}
              </div>
              <p className="text-teal-100 text-sm">
                {impactMetrics.currentMonthCollections || 0} collection{impactMetrics.currentMonthCollections !== 1 ? 's' : ''} so far
              </p>
            </CardContent>
          </Card>

          <Card 
            className="text-white"
            style={{
              background: 'linear-gradient(135deg, #FBAD3F 0%, #f59e0b 50%, #d97706 100%)'
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                2025 Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {impactMetrics.year2025YTD?.toLocaleString()}
              </div>
              <p className="text-white/90 text-sm">Year-to-date total</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Visualizations */}
        <Tabs defaultValue="actions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              Action Center
            </TabsTrigger>
            <TabsTrigger value="forecasts" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Forecasts
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Collection Trends
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <PieChart className="w-4 h-4" />
              Monthly Analysis
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Team Impact
            </TabsTrigger>
          </TabsList>

          {/* Action Center Tab - NEW! */}
          <TabsContent value="actions">
            <ActionCenter />
          </TabsContent>

          {/* Predictive Forecasts Tab */}
          <TabsContent value="forecasts">
            <PredictiveForecasts />
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            {/* View Selection */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Collection Trends Views</CardTitle>
                <CardDescription>Choose the right view for your analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={trendsView === 'recent' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('recent');
                      setDateRange('3months');
                      setChartView('weekly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <Clock className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Recent Trends</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      3 months of weekly data - see recent performance patterns
                    </span>
                  </Button>

                  <Button
                    variant={trendsView === 'seasonal' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('seasonal');
                      setDateRange('1year');
                      setChartView('monthly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <Activity className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Seasonal Patterns</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      1 year of monthly data - identify seasonal trends
                    </span>
                  </Button>

                  <Button
                    variant={trendsView === 'historical' ? 'default' : 'outline'}
                    className="h-auto min-h-[100px] w-full py-4 px-4 flex flex-col items-start justify-start"
                    onClick={() => {
                      setTrendsView('historical');
                      setDateRange('all');
                      setChartView('monthly');
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-shrink-0">
                      <TrendingUp className="w-5 h-5 flex-shrink-0" />
                      <span className="font-semibold whitespace-nowrap">Historical Growth</span>
                    </div>
                    <span className="text-left opacity-80 whitespace-normal break-words w-full text-[16px]">
                      All-time monthly totals - track long-term growth
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="flex items-center mb-2">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        {trendsView === 'recent' && 'Recent Collection Trends'}
                        {trendsView === 'seasonal' && 'Seasonal Collection Patterns'}
                        {trendsView === 'historical' && 'Historical Collection Growth'}
                      </CardTitle>
                      <CardDescription>
                        {trendsView === 'recent' && 'Weekly collections over the last 3 months'}
                        {trendsView === 'seasonal' && 'Monthly collections showing seasonal patterns'}
                        {trendsView === 'historical' && 'All-time monthly collection totals'}
                      </CardDescription>
                    </div>

                    {/* Date Range Controls */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={dateRange === '3months' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('3months')}
                      >
                        3 Months
                      </Button>
                      <Button
                        variant={dateRange === '6months' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('6months')}
                      >
                        6 Months
                      </Button>
                      <Button
                        variant={dateRange === '1year' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('1year')}
                      >
                        1 Year
                      </Button>
                      <Button
                        variant={dateRange === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDateRange('all')}
                      >
                        All Time
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorSandwiches" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#236383" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#236383" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                          dataKey={chartView === 'weekly' ? 'week' : 'month'}
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          tickFormatter={(value) => {
                            if (chartView === 'weekly') {
                              return value.includes('Week of')
                                ? value.replace('Week of ', '').slice(5)
                                : value;
                            }
                            const parts = (value || '').split('-');
                            return parts.length >= 2
                              ? parts[1] + '/' + parts[0].slice(2)
                              : value;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            padding: '10px'
                          }}
                          labelFormatter={(value) =>
                            `${chartView === 'weekly' ? 'Week' : 'Month'}: ${value}`
                          }
                          formatter={(value: any, name: string) => [
                            typeof value === 'number' ? value.toLocaleString() : value,
                            name === 'sandwiches' ? 'Sandwiches' : name === 'collections' ? 'Collections' : 'Hosts',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="sandwiches"
                          stroke="#236383"
                          strokeWidth={2}
                          fill="url(#colorSandwiches)"
                          fillOpacity={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-gray-500">
                      <div className="text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">
                          No collection data available for this time period
                        </p>
                        <p className="text-sm">
                          Try selecting a different date range
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Period Summary
                  </CardTitle>
                  <CardDescription>
                    Key metrics for the selected time range
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {chartData && chartData.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-brand-primary-lighter p-4 rounded-lg">
                          <div className="text-2xl font-bold text-brand-primary">
                            {chartData.reduce((sum, item) => sum + item.sandwiches, 0).toLocaleString()}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Total Sandwiches</p>
                        </div>

                        <div className="bg-teal-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-teal-700">
                            {chartData.reduce((sum, item) => sum + item.collections, 0).toLocaleString()}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">Total Collections</p>
                        </div>
                      </div>

                      <div className="bg-brand-primary-light p-4 rounded-lg">
                        <div className="text-2xl font-bold text-brand-primary">
                          {Math.round(
                            chartData.reduce((sum, item) => sum + item.sandwiches, 0) /
                            chartData.reduce((sum, item) => sum + item.collections, 0)
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Average Sandwiches per Collection</p>
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-2">Data Range</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>• {chartData.length} {chartView === 'weekly' ? 'weeks' : 'months'} of data</p>
                          <p>• {dateRange === '3months' ? 'Last 3 months' : dateRange === '6months' ? 'Last 6 months' : dateRange === '1year' ? 'Last 12 months' : 'All-time history'}</p>
                          <p>• Peak: {Math.max(...chartData.map(d => d.sandwiches)).toLocaleString()} sandwiches</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>No data available for the selected period</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Weekly Breakdown for Planning */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Weekly Breakdown
                  </CardTitle>
                  <CardDescription>
                    Week-by-week collection totals for operational planning
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={(() => {
                        // Calculate weekly data for last 16 weeks
                        const weeklyData: Record<string, { sandwiches: number; collections: number }> = {};
                        const now = new Date();
                        const sixteenWeeksAgo = new Date(now);
                        sixteenWeeksAgo.setDate(now.getDate() - (16 * 7));

                        collections.forEach((collection: any) => {
                          if (!collection.collectionDate) return;

                          const date = parseCollectionDate(collection.collectionDate);
                          if (Number.isNaN(date.getTime()) || date < sixteenWeeksAgo) return;

                          // Calculate week starting Monday
                          const monday = new Date(date);
                          const day = monday.getDay();
                          const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
                          monday.setDate(diff);
                          monday.setHours(0, 0, 0, 0);
                          const weekKey = monday.toISOString().split('T')[0];

                          if (!weeklyData[weekKey]) {
                            weeklyData[weekKey] = { sandwiches: 0, collections: 0 };
                          }

                          weeklyData[weekKey].sandwiches += calculateTotalSandwiches(collection);
                          weeklyData[weekKey].collections += 1;
                        });

                        return Object.entries(weeklyData)
                          .map(([week, data]) => ({
                            week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            sandwiches: data.sandwiches,
                            collections: data.collections,
                          }))
                          .sort((a, b) => {
                            const dateA = new Date(a.week);
                            const dateB = new Date(b.week);
                            return dateA.getTime() - dateB.getTime();
                          });
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        label={{ value: 'Sandwiches', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === 'sandwiches') return [(value ?? 0).toLocaleString(), 'Sandwiches'];
                          if (name === 'collections') return [value ?? 0, 'Collections'];
                          return [value ?? 0, name];
                        }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          border: '1px solid #ccc',
                          borderRadius: '8px',
                          padding: '10px'
                        }}
                      />
                      <Bar dataKey="sandwiches" fill="#236383" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 text-sm text-gray-600">
                    <p>Showing last 16 weeks of collection activity • Week starting Monday</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Monthly Comparison Analytics Tab */}
          <TabsContent value="analysis">
            <MonthlyComparisonAnalytics />
          </TabsContent>

          {/* Impact Analysis Tab */}
          <TabsContent value="impact">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="w-5 h-5 mr-2" />
                    Collection Trends & Context
                  </CardTitle>
                  <CardDescription>
                    Weekly performance and external benchmarks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">
                        Recent Trend (Last 4 weeks)
                      </span>
                      <span className="font-bold text-brand-primary">{trendAnalysis.recentTrend.status}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-brand-primary h-2 rounded-full"
                        style={{ width: `${trendAnalysis.recentTrend.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {trendAnalysis.recentTrend.description}
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">Seasonal Context</span>
                      <span className="font-bold">{trendAnalysis.seasonalContext.status}</span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${trendAnalysis.seasonalContext.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {trendAnalysis.seasonalContext.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900">
                      Atlanta Hunger Context
                    </h4>
                    <div className="space-y-1">
                      <a
                        href="https://www.atlantaregionalfoodbank.org/impact/"
                        target="_blank"
                        className="text-brand-primary text-sm hover:underline block"
                      >
                        → Atlanta Regional Food Bank Data
                      </a>
                      <a
                        href="https://hungerandhealth.feedingamerica.org/understand-food-insecurity/hunger-facts/"
                        target="_blank"
                        className="text-brand-primary text-sm hover:underline block"
                      >
                        → Georgia Food Insecurity Stats
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Impact Highlights</CardTitle>
                  <CardDescription>
                    Key achievements and milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                      <Heart className="w-5 h-5 text-green-600 mt-1" />
                      <div>
                        <p className="font-medium text-green-900">
                          Sandwiches Provided
                        </p>
                        <p className="text-sm text-green-700">
                          {impactMetrics.totalSandwiches?.toLocaleString()}{' '}
                          sandwiches delivered to community members in need
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-brand-primary-lighter rounded-lg">
                      <Users className="w-5 h-5 text-brand-primary mt-1" />
                      <div>
                        <p className="font-medium text-brand-primary-darker">
                          Community Engagement
                        </p>
                        <p className="text-sm text-brand-primary">
                          {impactMetrics.uniqueHosts} active host locations
                          contributing to the cause
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-teal-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-teal-600 mt-1" />
                      <div>
                        <p className="font-medium text-teal-900">
                          Collection Records
                        </p>
                        <p className="text-sm text-teal-700">
                          {impactMetrics.totalCollections?.toLocaleString()}{' '}
                          collection events documented
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-orange-600 mt-1" />
                      <div>
                        <p className="font-medium text-orange-900">
                          2025 Progress
                        </p>
                        <p className="text-sm text-orange-700">
                          {impactMetrics.year2025YTD?.toLocaleString()}{' '}
                          sandwiches collected year-to-date
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="collections"
        title="Impact Dashboard Assistant"
        subtitle="Ask about impact metrics and trends"
        contextData={{
          currentView: 'impact-dashboard',
          filters: {
            dateRange,
            chartView,
            trendsView,
          },
          summaryStats: {
            totalCollections: collections?.length || 0,
            totalSandwiches: hybridStats?.total || (stats as any)?.completeTotalSandwiches || 0,
            activeHosts: hosts?.length || 0,
          },
          hybridStats: hybridStats || null,
        }}
      />
    </div>
  );
}
