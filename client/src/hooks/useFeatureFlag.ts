import { useQuery } from '@tanstack/react-query';
import { getQueryFn, apiRequest } from '@/lib/queryClient';
import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';

interface FeatureFlagCheck {
  enabled: boolean;
  reason?: string;
}

/**
 * Hook to check if a feature flag is enabled for the current user
 *
 * @param flagName - The name of the feature flag to check
 * @param options - Query options
 * @returns Object with enabled status and loading state
 *
 * @example
 * const { enabled, isLoading } = useFeatureFlag('unified-activities');
 * if (enabled) {
 *   // Show new UI
 * }
 */
export function useFeatureFlag(
  flagName: string,
  options?: {
    enabled?: boolean; // Can be used to conditionally enable the query
  }
) {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error,
  } = useQuery<FeatureFlagCheck>({
    queryKey: [`/api/feature-flags/check/${flagName}`, user?.id],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled: options?.enabled !== false && !!flagName,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Retry once on failure
  });

  if (error) {
    logger.error(`Error checking feature flag ${flagName}:`, error);
  }

  return {
    enabled: data?.enabled ?? false, // Default to false if no data
    isLoading,
    reason: data?.reason,
  };
}

/**
 * Hook to check multiple feature flags at once
 *
 * @param flagNames - Array of feature flag names to check
 * @returns Object mapping flag names to enabled status
 *
 * @example
 * const flags = useFeatureFlags(['unified-activities', 'new-ui-v2']);
 * if (flags['unified-activities']) {
 *   // Show new activities UI
 * }
 */
export function useFeatureFlags(flagNames: string[]) {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error,
  } = useQuery<Record<string, boolean>>({
    queryKey: ['/api/feature-flags/check-multiple', flagNames, user?.id],
    queryFn: async () => {
      try {
        return await apiRequest('POST', '/api/feature-flags/check-multiple', {
          flags: flagNames,
        });
      } catch (error: any) {
        if (error.message === 'AUTH_EXPIRED') {
          return null;
        }
        throw error;
      }
    },
    enabled: flagNames.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  if (error) {
    logger.error('Error checking feature flags:', error);
  }

  // Return an object with all flags defaulted to false
  const flags = flagNames.reduce((acc, name) => {
    acc[name] = data?.[name] ?? false;
    return acc;
  }, {} as Record<string, boolean>);

  return {
    flags,
    isLoading,
  };
}
