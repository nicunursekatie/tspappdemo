import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Users,
  Sandwich,
  MapPin,
  Clock,
  Target,
  History,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SandwichCollection, Host } from '@shared/schema';
import { parseCollectionDate, calculateGroupSandwiches } from '@/lib/analytics-utils';
import { FloatingAIChat } from '@/components/floating-ai-chat';
import { useCollectionsData } from '@/hooks/useCollectionsData';

interface HostAnalyticsProps {
  selectedHost?: string;
  onHostChange?: (hostName: string) => void;
}

interface MonthlyStats {
  month: string;
  totalSandwiches: number;
  individualSandwiches: number;
  groupSandwiches: number;
  totalCollections: number;
  groups: string[];
}

export default function HostAnalytics({
  selectedHost,
  onHostChange,
}: HostAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<
    '3months' | '6months' | '1year' | 'all'
  >('all');
  const [includeHistoricalData, setIncludeHistoricalData] = useState(false);

  // Reset historical data state when changing hosts
  React.useEffect(() => {
    setIncludeHistoricalData(false);
  }, [selectedHost]);

  // Use shared collections data hook
  const { collections, hosts, isLoading } = useCollectionsData();

  // Get available hosts from collections data
  const availableHosts: string[] = useMemo(() => {
    const hostNames = Array.from(
      new Set(
        collections.map((c: SandwichCollection) => c.hostName).filter((name: string | undefined | null): name is string => Boolean(name))
      )
    );
    return hostNames.sort();
  }, [collections]);

  // Helper function to detect if a location is a combined location (contains "/")
  const isCombinedLocation = (hostName: string): boolean => {
    return hostName.includes('/');
  };

  // Helper function to parse component locations from a combined location name
  const parseComponentLocations = (hostName: string): string[] => {
    if (!isCombinedLocation(hostName)) return [hostName];
    return hostName.split('/').map(name => name.trim());
  };

  // Helper function to get all relevant host names for filtering (includes historical component locations)
  const getRelevantHostNames = (hostName: string, includeHistorical: boolean): string[] => {
    if (!includeHistorical || !isCombinedLocation(hostName)) {
      return [hostName];
    }
    // For combined locations with historical data enabled, include both the combined name and component names
    const componentNames = parseComponentLocations(hostName);
    return [hostName, ...componentNames];
  };

  // Helper function to get group collections from a collection
  const getGroupCollections = (collection: SandwichCollection) => {
    if (
      collection.groupCollections &&
      Array.isArray(collection.groupCollections) &&
      collection.groupCollections.length > 0
    ) {
      return collection.groupCollections
        .filter((group: any) => group.name && group.count > 0)
        .map((group: any) => group.name);
    }
    const groups = [];
    const group1Name = (collection as any).group1Name;
    const group2Name = (collection as any).group2Name;
    if (group1Name) groups.push(group1Name);
    if (group2Name) groups.push(group2Name);
    return groups;
  };

  // Filter and analyze data for selected host
  const hostData = useMemo(() => {
    if (!selectedHost || !collections.length) return null;

    // Get relevant host names (includes historical component locations if enabled)
    const relevantHostNames = getRelevantHostNames(selectedHost, includeHistoricalData);
    
    // Filter collections for selected host and historical component locations if enabled
    const hostCollections = collections.filter(
      (c: SandwichCollection) => relevantHostNames.includes(c.hostName)
    );

    if (hostCollections.length === 0) return null;

    // Apply time filter
    const now = new Date();
    let cutoffDate = new Date();

    switch (timeRange) {
      case '3months':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case '6months':
        cutoffDate.setMonth(now.getMonth() - 6);
        break;
      case '1year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'all':
        cutoffDate = parseCollectionDate('2020-01-01'); // Far back date
        break;
    }

    const filteredCollections = hostCollections.filter(
      (c: SandwichCollection) =>
        parseCollectionDate(c.collectionDate).getTime() >= cutoffDate.getTime()
    );

    // Calculate overall statistics
    let totalIndividual = 0;
    let totalGroup = 0;
    const allGroups = new Set<string>();
    const dates: Date[] = [];

    filteredCollections.forEach((collection: SandwichCollection) => {
      totalIndividual += collection.individualSandwiches || 0;
      totalGroup += calculateGroupSandwiches(collection);
      const parsedDate = parseCollectionDate(collection.collectionDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        dates.push(parsedDate);
      }

      const groups = getGroupCollections(collection);
      groups.forEach((group) => allGroups.add(group));
    });

    // Calculate monthly breakdown
    const monthlyData = new Map<string, MonthlyStats>();

    filteredCollections.forEach((collection: SandwichCollection) => {
      const date = parseCollectionDate(collection.collectionDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthName,
          totalSandwiches: 0,
          individualSandwiches: 0,
          groupSandwiches: 0,
          totalCollections: 0,
          groups: [],
        });
      }

      const monthStats = monthlyData.get(monthKey)!;
      const individualCount = collection.individualSandwiches || 0;
      const groupCount = calculateGroupSandwiches(collection);

      monthStats.individualSandwiches += individualCount;
      monthStats.groupSandwiches += groupCount;
      monthStats.totalSandwiches += individualCount + groupCount;
      monthStats.totalCollections += 1;

      const groups = getGroupCollections(collection);
      groups.forEach((group) => {
        if (!monthStats.groups.includes(group)) {
          monthStats.groups.push(group);
        }
      });
    });

    // Sort monthly data by date
    const sortedMonthlyData = Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, stats]) => stats);

    // Calculate date range
    dates.sort((a, b) => a.getTime() - b.getTime());
    const dateRange =
      dates.length > 0
        ? {
            earliest: dates[0].toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            latest: dates[dates.length - 1].toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric', year: 'numeric' }
            ),
          }
        : null;

    return {
      totalIndividual,
      totalGroup,
      totalSandwiches: totalIndividual + totalGroup,
      totalCollections: filteredCollections.length,
      uniqueGroups: Array.from(allGroups).sort(),
      monthlyData: sortedMonthlyData,
      dateRange,
      averagePerCollection:
        filteredCollections.length > 0
          ? Math.round(
              (totalIndividual + totalGroup) / filteredCollections.length
            )
          : 0,
    };
  }, [selectedHost, collections, timeRange, includeHistoricalData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 bg-gray-200 rounded animate-pulse"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-6 h-6 mr-3 text-teal-600" />
            Host Analytics
          </h2>
          <p className="text-gray-600 mt-1">
            View performance metrics for your location
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Host Selection */}
          <Select value={selectedHost || ''} onValueChange={onHostChange}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select a host location" />
            </SelectTrigger>
            <SelectContent>
              {availableHosts.map((hostName: string) => (
                <SelectItem key={hostName} value={hostName}>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    {hostName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time Range Selection */}
          {selectedHost && (
            <Select
              value={timeRange}
              onValueChange={(value: any) => setTimeRange(value)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />3 Months
                  </div>
                </SelectItem>
                <SelectItem value="6months">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />6 Months
                  </div>
                </SelectItem>
                <SelectItem value="1year">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />1 Year
                  </div>
                </SelectItem>
                <SelectItem value="all">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    All Time
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Historical Data Toggle for Combined Locations */}
          {selectedHost && isCombinedLocation(selectedHost) && (
            <Button
              variant={includeHistoricalData ? "default" : "outline"}
              onClick={() => setIncludeHistoricalData(!includeHistoricalData)}
              className="flex items-center gap-2 whitespace-nowrap"
              data-testid="button-toggle-historical-data"
            >
              <History className="w-4 h-4" />
              {includeHistoricalData ? 'Hide Historical Data' : 'Include Historical Data'}
            </Button>
          )}
        </div>
      </div>

      {!selectedHost ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Select a Host Location
            </h3>
            <p className="text-gray-600 text-center max-w-md">
              Choose a host location from the dropdown above to view detailed
              analytics and performance metrics.
            </p>
          </CardContent>
        </Card>
      ) : !hostData ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Data Available
            </h3>
            <p className="text-gray-600 text-center max-w-md">
              No collection data found for {selectedHost} in the selected time
              range.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sandwiches
                </CardTitle>
                <Sandwich className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {hostData.totalSandwiches.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {hostData.totalIndividual.toLocaleString()} individual +{' '}
                  {hostData.totalGroup.toLocaleString()} group
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Collections
                </CardTitle>
                <Calendar className="h-4 w-4 text-brand-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-brand-primary">
                  {hostData.totalCollections.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Total events recorded
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average per Event
                </CardTitle>
                <Target className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {hostData.averagePerCollection}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Sandwiches per collection
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Group Partners
                </CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {hostData.uniqueGroups.length}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Unique groups served
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Date Range and Period Info */}
          {hostData.dateRange && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>
                      Data from {hostData.dateRange.earliest} to{' '}
                      {hostData.dateRange.latest}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Badge variant="outline" className="w-fit">
                      {timeRange === 'all'
                        ? 'All Time'
                        : timeRange === '1year'
                          ? '1 Year'
                          : timeRange === '6months'
                            ? '6 Months'
                            : '3 Months'}
                    </Badge>
                    {includeHistoricalData && isCombinedLocation(selectedHost) && (
                      <Badge variant="secondary" className="w-fit flex items-center gap-1">
                        <History className="w-3 h-3" />
                        Includes Historical Data
                      </Badge>
                    )}
                  </div>
                </div>
                {includeHistoricalData && isCombinedLocation(selectedHost) && (
                  <div className="mt-4 p-3 bg-brand-primary-lighter border border-brand-primary-border rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-brand-primary-dark">
                      <History className="w-4 h-4" />
                      <span className="font-medium">Historical Data Included</span>
                    </div>
                    <p className="text-sm text-brand-primary mt-1">
                      This view includes data from component locations: {parseComponentLocations(selectedHost).join(', ')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Monthly Breakdown */}
          {hostData.monthlyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Monthly Performance
                </CardTitle>
                <CardDescription>
                  Sandwich collection trends over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {hostData.monthlyData.map((month, index) => (
                    <div key={month.month} className="border rounded-lg p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="font-medium">{month.month}</h4>
                          <div className="text-sm text-gray-600 mt-1">
                            {month.totalCollections} collection
                            {month.totalCollections !== 1 ? 's' : ''}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-bold text-lg text-orange-600">
                              {month.totalSandwiches.toLocaleString()}
                            </div>
                            <div className="text-gray-600">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-teal-600">
                              {month.individualSandwiches.toLocaleString()}
                            </div>
                            <div className="text-gray-600">Individual</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-brand-primary">
                              {month.groupSandwiches.toLocaleString()}
                            </div>
                            <div className="text-gray-600">Groups</div>
                          </div>
                        </div>
                      </div>

                      {month.groups.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-600 mb-2">
                            Group Partners:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {month.groups.map((group) => (
                              <Badge
                                key={group}
                                variant="secondary"
                                className="text-xs"
                              >
                                {group}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Groups Summary */}
          {hostData.uniqueGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Group Partners
                </CardTitle>
                <CardDescription>
                  Organizations you've collaborated with
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {hostData.uniqueGroups.map((group) => (
                    <Badge
                      key={group}
                      variant="outline"
                      className="text-sm py-1 px-3"
                    >
                      {group}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="collections"
        title="Host Analytics Assistant"
        subtitle="Ask about host performance and trends"
        contextData={{
          currentView: 'host-analytics',
          filters: {
            selectedHost: selectedHost || 'all',
            timeRange,
            includeHistoricalData,
          },
          summaryStats: hostData ? {
            totalSandwiches: hostData.totalSandwiches,
            totalCollections: hostData.totalCollections,
            avgPerCollection: hostData.avgPerCollection,
            uniqueGroups: hostData.uniqueGroups?.length || 0,
          } : null,
          availableHosts: hosts?.map((h: Host) => h.name) || [],
        }}
      />
    </div>
  );
}
