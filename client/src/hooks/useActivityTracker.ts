import { useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface ActivityData {
  action: string;
  section: string;
  feature: string;
  page?: string;
  details?: string;
  metadata?: Record<string, any>;
}

export function useActivityTracker() {
  const trackActivity = useCallback(async (data: ActivityData) => {
    try {
      await fetch('/api/activity-log', {
        method: 'POST',
        body: JSON.stringify({
          action: data.action,
          section: data.section,
          feature: data.feature,
          page: data.page || window.location.pathname,
          details: data.details,
          metadata: data.metadata,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Silently fail to avoid disrupting user experience
      logger.log('Activity tracking failed:', error);
    }
  }, []);

  // Specific tracking functions for common actions
  const trackClick = useCallback(
    (element: string, section: string, feature: string, details?: string) => {
      trackActivity({
        action: 'Click',
        section,
        feature,
        details: details || `Clicked ${element}`,
        metadata: { element, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackFormSubmit = useCallback(
    (
      formName: string,
      section: string,
      feature: string,
      success: boolean = true
    ) => {
      trackActivity({
        action: success ? 'Submit' : 'Submit Failed',
        section,
        feature,
        details: `${
          success ? 'Successfully submitted' : 'Failed to submit'
        } ${formName}`,
        metadata: { formName, success, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackView = useCallback(
    (
      contentType: string,
      section: string,
      feature: string,
      details?: string
    ) => {
      trackActivity({
        action: 'View',
        section,
        feature,
        details: details || `Viewed ${contentType}`,
        metadata: { contentType, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackSearch = useCallback(
    (
      query: string,
      section: string,
      feature: string,
      resultsCount?: number
    ) => {
      trackActivity({
        action: 'Search',
        section,
        feature,
        details: `Searched for "${query}"${
          resultsCount !== undefined ? ` (${resultsCount} results)` : ''
        }`,
        metadata: { query, resultsCount, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackFilter = useCallback(
    (
      filterType: string,
      filterValue: string,
      section: string,
      feature: string
    ) => {
      trackActivity({
        action: 'Filter',
        section,
        feature,
        details: `Applied ${filterType} filter: ${filterValue}`,
        metadata: {
          filterType,
          filterValue,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [trackActivity]
  );

  const trackExport = useCallback(
    (
      exportType: string,
      section: string,
      feature: string,
      recordCount?: number
    ) => {
      trackActivity({
        action: 'Export',
        section,
        feature,
        details: `Exported ${exportType}${
          recordCount ? ` (${recordCount} records)` : ''
        }`,
        metadata: {
          exportType,
          recordCount,
          timestamp: new Date().toISOString(),
        },
      });
    },
    [trackActivity]
  );

  const trackCreate = useCallback(
    (itemType: string, section: string, feature: string, itemId?: string) => {
      trackActivity({
        action: 'Create',
        section,
        feature,
        details: `Created new ${itemType}${itemId ? ` (ID: ${itemId})` : ''}`,
        metadata: { itemType, itemId, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackUpdate = useCallback(
    (itemType: string, section: string, feature: string, itemId?: string) => {
      trackActivity({
        action: 'Update',
        section,
        feature,
        details: `Updated ${itemType}${itemId ? ` (ID: ${itemId})` : ''}`,
        metadata: { itemType, itemId, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  const trackDelete = useCallback(
    (itemType: string, section: string, feature: string, itemId?: string) => {
      trackActivity({
        action: 'Delete',
        section,
        feature,
        details: `Deleted ${itemType}${itemId ? ` (ID: ${itemId})` : ''}`,
        metadata: { itemType, itemId, timestamp: new Date().toISOString() },
      });
    },
    [trackActivity]
  );

  return {
    trackActivity,
    trackClick,
    trackFormSubmit,
    trackView,
    trackSearch,
    trackFilter,
    trackExport,
    trackCreate,
    trackUpdate,
    trackDelete,
  };
}
