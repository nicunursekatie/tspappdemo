import { useCallback } from 'react';
import { trackEvent as gaTrackEvent } from '../../lib/analytics';

/**
 * Hook for tracking Google Analytics events
 *
 * Common event categories:
 * - 'navigation' - Page navigation, menu clicks
 * - 'engagement' - Content interaction, downloads
 * - 'form' - Form submissions, input interactions
 * - 'button' - Button clicks
 * - 'social' - Social shares, communications
 * - 'error' - Error occurrences
 */
export function useAnalytics() {
  // Generic event tracking with custom properties
  const trackEvent = useCallback((eventName: string, properties?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, properties);
    }
  }, []);
  // Navigation tracking
  const trackNavigation = useCallback((destination: string, source?: string) => {
    gaTrackEvent('navigate', 'navigation', `${source || 'unknown'} -> ${destination}`);
  }, []);

  // Button click tracking
  const trackButtonClick = useCallback((buttonName: string, location?: string) => {
    gaTrackEvent('click', 'button', `${location || 'unknown'} - ${buttonName}`);
  }, []);

  // Form submission tracking
  const trackFormSubmit = useCallback((formName: string, success: boolean = true) => {
    gaTrackEvent(
      success ? 'submit_success' : 'submit_error',
      'form',
      formName
    );
  }, []);

  // Download tracking
  const trackDownload = useCallback((fileName: string, fileType?: string) => {
    gaTrackEvent('download', 'engagement', `${fileType || 'file'} - ${fileName}`);
  }, []);

  // Document view tracking
  const trackDocumentView = useCallback((documentName: string, documentType?: string) => {
    gaTrackEvent('view', 'engagement', `${documentType || 'document'} - ${documentName}`);
  }, []);

  // Communication tracking
  const trackCommunication = useCallback((type: 'email' | 'sms' | 'chat', recipient?: string) => {
    gaTrackEvent('send', 'social', `${type}${recipient ? ` - ${recipient}` : ''}`);
  }, []);

  // Search tracking
  const trackSearch = useCallback((query: string, resultsCount?: number) => {
    gaTrackEvent('search', 'engagement', query, resultsCount);
  }, []);

  // Error tracking
  const trackError = useCallback((errorMessage: string, location?: string) => {
    gaTrackEvent('error', 'error', `${location || 'unknown'} - ${errorMessage}`);
  }, []);

  // Report generation tracking
  const trackReportGeneration = useCallback((reportType: string, format?: string) => {
    gaTrackEvent('generate', 'engagement', `${reportType}${format ? ` - ${format}` : ''}`);
  }, []);

  // Data entry tracking
  const trackDataEntry = useCallback((dataType: string, location?: string) => {
    gaTrackEvent('entry', 'form', `${location || 'unknown'} - ${dataType}`);
  }, []);

  // Feature usage tracking
  const trackFeatureUse = useCallback((featureName: string, action?: string) => {
    gaTrackEvent(action || 'use', 'engagement', featureName);
  }, []);

  return {
    trackEvent,
    trackNavigation,
    trackButtonClick,
    trackFormSubmit,
    trackDownload,
    trackDocumentView,
    trackCommunication,
    trackSearch,
    trackError,
    trackReportGeneration,
    trackDataEntry,
    trackFeatureUse,
  };
}
