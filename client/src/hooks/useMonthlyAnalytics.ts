import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SandwichCollection } from '@shared/schema';
import {
  calculateGroupSandwiches,
  calculateTotalSandwiches,
  parseCollectionDate,
} from '@/lib/analytics-utils';

export interface MonthlyStats {
  month: string;
  year: number;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
  avgPerCollection: number;
  hostParticipation: Record<string, number>;
  weeklyDistribution: number[];
  individualCount: number;
  groupCount: number;
  groupEventCount: number;
  daysWithCollections: number;
}

export function useMonthlyAnalytics() {
  // Fetch collections data
  const { data: collectionsData, isLoading } = useQuery<{
    collections: SandwichCollection[];
  }>({
    queryKey: ['/api/sandwich-collections/all'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
  });

  // Fetch hosts data
  const { data: hostsData } = useQuery({
    queryKey: ['/api/hosts'],
    queryFn: async () => {
      const response = await fetch('/api/hosts');
      if (!response.ok) throw new Error('Failed to fetch hosts');
      return response.json();
    },
  });

  const collections = collectionsData?.collections || [];

  // Process data for analytics
  const monthlyAnalytics = useMemo(() => {
    if (!collections?.length) return null;

    const monthlyStats: Record<string, MonthlyStats> = {};

    collections.forEach((collection) => {
      if (!collection.collectionDate) return;

      const date = parseCollectionDate(collection.collectionDate);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const year = date.getFullYear();
      const month = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      if (!monthlyStats[monthKey]) {
        monthlyStats[monthKey] = {
          month,
          year,
          totalSandwiches: 0,
          totalCollections: 0,
          uniqueHosts: 0,
          avgPerCollection: 0,
          hostParticipation: {},
          weeklyDistribution: [0, 0, 0, 0], // Week 1, 2, 3, 4+
          individualCount: 0,
          groupCount: 0,
          groupEventCount: 0,
          daysWithCollections: 0,
        };
      }

      const stats = monthlyStats[monthKey];

      // Calculate sandwich totals using standardized calculation
      const individualSandwiches = collection.individualSandwiches || 0;
      const groupSandwiches = calculateGroupSandwiches(collection);
      const totalSandwiches = calculateTotalSandwiches(collection);

      stats.totalSandwiches += totalSandwiches;
      stats.individualCount += individualSandwiches;
      stats.groupCount += groupSandwiches;
      stats.totalCollections += 1;

      // Track group event count - increment when collection has group participants
      if (groupSandwiches > 0) {
        stats.groupEventCount += 1;
      }

      // Track host participation
      const hostName = collection.hostName || 'Unknown';
      stats.hostParticipation[hostName] =
        (stats.hostParticipation[hostName] || 0) + totalSandwiches;

      // Weekly distribution within month
      const dayOfMonth = date.getDate();
      const weekIndex = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
      stats.weeklyDistribution[weekIndex] += totalSandwiches;
    });

    // Calculate derived metrics
    Object.values(monthlyStats).forEach((stats) => {
      stats.uniqueHosts = Object.keys(stats.hostParticipation).length;
      stats.avgPerCollection =
        stats.totalCollections > 0
          ? Math.round(stats.totalSandwiches / stats.totalCollections)
          : 0;
      stats.daysWithCollections = stats.totalCollections; // Approximation
    });

    return monthlyStats;
  }, [collections]);

  return {
    monthlyAnalytics,
    collections,
    hostsData,
    isLoading,
  };
}
