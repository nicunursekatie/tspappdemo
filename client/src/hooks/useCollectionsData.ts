import { useQuery } from '@tanstack/react-query';
import type { SandwichCollection, Host } from '@shared/schema';

/**
 * Shared hook for fetching collections data across analytics components.
 * Eliminates duplicate data fetching and provides consistent caching.
 */

export interface CollectionsStats {
  totalSandwiches?: number;
  completeTotalSandwiches?: number;
  totalHosts?: number;
  uniqueGroups?: number;
  [key: string]: any;
}

export interface HybridStats {
  total: number;
  byYear?: Record<string, { sandwiches: number; records: number }>;
  [key: string]: any;
}

export interface UseCollectionsDataResult {
  // Raw data
  collections: SandwichCollection[];
  hosts: Host[];
  stats: CollectionsStats | null;
  hybridStats: HybridStats | null;

  // Loading states
  isLoading: boolean;
  isCollectionsLoading: boolean;
  isHostsLoading: boolean;
  isStatsLoading: boolean;
  isHybridStatsLoading: boolean;

  // Error states
  error: Error | null;
  collectionsError: Error | null;
  hostsError: Error | null;

  // Refetch functions
  refetchCollections: () => void;
  refetchAll: () => void;
}

export function useCollectionsData(): UseCollectionsDataResult {
  // Fetch sandwich collections data
  const {
    data: collectionsData,
    isLoading: isCollectionsLoading,
    error: collectionsError,
    refetch: refetchCollections,
  } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=5000', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  // Fetch hybrid stats (authoritative data + collection log)
  const {
    data: hybridStats,
    isLoading: isHybridStatsLoading,
  } = useQuery<HybridStats>({
    queryKey: ['/api/sandwich-collections/hybrid-stats'],
    staleTime: 2 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch collection stats
  const {
    data: stats,
    isLoading: isStatsLoading,
  } = useQuery<CollectionsStats>({
    queryKey: ['/api/sandwich-collections/stats'],
    staleTime: 30 * 1000, // 30 seconds for stats
    refetchOnMount: true,
    refetchInterval: 2 * 60 * 1000,
  });

  // Fetch hosts data
  const {
    data: hosts = [],
    isLoading: isHostsLoading,
    error: hostsError,
  } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: 10 * 60 * 1000,
  });

  const collections = collectionsData?.collections || [];
  const isLoading = isCollectionsLoading || isHostsLoading || isStatsLoading || isHybridStatsLoading;
  const error = collectionsError || hostsError || null;

  const refetchAll = () => {
    refetchCollections();
  };

  return {
    collections,
    hosts,
    stats: stats || null,
    hybridStats: hybridStats || null,
    isLoading,
    isCollectionsLoading,
    isHostsLoading,
    isStatsLoading,
    isHybridStatsLoading,
    error,
    collectionsError: collectionsError as Error | null,
    hostsError: hostsError as Error | null,
    refetchCollections,
    refetchAll,
  };
}
