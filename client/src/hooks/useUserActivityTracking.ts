import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { logger } from '@/lib/logger';

interface TrackEventParams {
  action: string;
  section: string;
  feature?: string;
  details: string;
  metadata?: Record<string, any>;
}

/**
 * Hook for tracking detailed user interactions in the frontend
 * This captures what users actually DO, not just what pages they visit
 */
export function useUserActivityTracking() {
  const { user } = useAuth();

  const trackEvent = useCallback(async (params: TrackEventParams) => {
    if (!user?.id) return;

    try {
      await fetch('/api/enhanced-user-activity/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userId: user.id,
          action: params.action,
          section: params.section,
          feature: params.feature || params.section,
          page: window.location.pathname,
          details: params.details,
          metadata: {
            ...params.metadata,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
          },
        }),
      });
    } catch (error) {
      // Silent fail - don't disrupt user experience if tracking fails
      logger.warn('Failed to track user activity:', error);
    }
  }, [user?.id]);

  // Convenience methods for common actions
  const trackDownload = useCallback((fileName: string, fileType: string, section: string) => {
    trackEvent({
      action: 'Download',
      section,
      details: `Downloaded ${fileType}: ${fileName}`,
      metadata: { fileName, fileType },
    });
  }, [trackEvent]);

  const trackExport = useCallback((exportType: string, section: string, recordCount?: number) => {
    trackEvent({
      action: 'Export',
      section,
      details: `Exported ${recordCount ? `${recordCount} records as` : ''} ${exportType}`,
      metadata: { exportType, recordCount },
    });
  }, [trackEvent]);

  const trackSearch = useCallback((searchQuery: string, section: string, resultCount?: number) => {
    trackEvent({
      action: 'Search',
      section,
      details: `Searched for: "${searchQuery}"${resultCount !== undefined ? ` (${resultCount} results)` : ''}`,
      metadata: { searchQuery, resultCount },
    });
  }, [trackEvent]);

  const trackFilter = useCallback((filterType: string, filterValue: string, section: string) => {
    trackEvent({
      action: 'Filter',
      section,
      details: `Filtered by ${filterType}: ${filterValue}`,
      metadata: { filterType, filterValue },
    });
  }, [trackEvent]);

  const trackFormSubmit = useCallback((formName: string, section: string, recordId?: string | number) => {
    trackEvent({
      action: 'Create',
      section,
      details: `Submitted ${formName}${recordId ? ` (ID: ${recordId})` : ''}`,
      metadata: { formName, recordId },
    });
  }, [trackEvent]);

  const trackKudosSent = useCallback((recipientName: string, context?: string) => {
    trackEvent({
      action: 'Send',
      section: 'Communication',
      feature: 'Kudos System',
      details: `Sent kudos to ${recipientName}${context ? ` for ${context}` : ''}`,
      metadata: { recipientName, context },
    });
  }, [trackEvent]);

  const trackButtonClick = useCallback((buttonName: string, section: string, context?: string) => {
    trackEvent({
      action: 'Click',
      section,
      details: `Clicked: ${buttonName}${context ? ` (${context})` : ''}`,
      metadata: { buttonName, context },
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackDownload,
    trackExport,
    trackSearch,
    trackFilter,
    trackFormSubmit,
    trackKudosSent,
    trackButtonClick,
  };
}
