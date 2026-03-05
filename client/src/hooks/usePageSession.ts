import { useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface PageSessionConfig {
  // Required: What section of the app (e.g., "Event Requests", "Collections", "User Management")
  section: string;

  // Required: What specific page/feature (e.g., "Event Detail", "Contacts Directory", "Audit Log")
  page: string;

  // Optional: What specific item they're viewing (e.g., "Event #12345", "Contact: John Smith")
  itemDescription?: string;

  // Optional: ID of the item being viewed (for linking)
  itemId?: string | number;

  // Optional: Additional context (e.g., organization name, status)
  context?: Record<string, any>;
}

/**
 * Tracks meaningful page sessions with duration and specific context.
 *
 * Usage:
 * ```tsx
 * // In a component
 * usePageSession({
 *   section: 'Event Requests',
 *   page: 'Event Detail',
 *   itemDescription: `Event #${event.id}: ${event.organizationName}`,
 *   itemId: event.id,
 *   context: { status: event.status, sandwichCount: event.sandwichCount }
 * });
 * ```
 *
 * This will log:
 * - Entry: When the user lands on the page
 * - Exit: When they leave (with duration)
 */
export function usePageSession(config: PageSessionConfig) {
  const startTimeRef = useRef<number>(Date.now());
  const configRef = useRef(config);
  const hasLoggedEntryRef = useRef(false);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const logActivity = useCallback(async (
    action: string,
    details: string,
    duration?: number
  ) => {
    try {
      const payload: any = {
        action,
        section: configRef.current.section,
        feature: configRef.current.page,
        page: window.location.pathname,
        details,
        metadata: {
          ...configRef.current.context,
          itemId: configRef.current.itemId,
          timestamp: new Date().toISOString(),
        },
      };

      if (duration !== undefined) {
        payload.duration = duration;
        payload.metadata.durationSeconds = Math.round(duration / 1000);
        payload.metadata.durationReadable = formatDuration(duration);
      }

      await fetch('/api/activity-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      logger.log('Page session tracking failed:', error);
    }
  }, []);

  // Log page entry
  useEffect(() => {
    if (hasLoggedEntryRef.current) return;
    hasLoggedEntryRef.current = true;
    startTimeRef.current = Date.now();

    const { section, page, itemDescription } = config;
    const details = itemDescription
      ? `Opened ${page}: ${itemDescription}`
      : `Opened ${page}`;

    logActivity('View', details);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Log page exit with duration
  useEffect(() => {
    return () => {
      const duration = Date.now() - startTimeRef.current;
      const { section, page, itemDescription } = configRef.current;

      // Only log if they spent more than 2 seconds (filter out quick bounces)
      if (duration > 2000) {
        const details = itemDescription
          ? `Closed ${page}: ${itemDescription} (spent ${formatDuration(duration)})`
          : `Closed ${page} (spent ${formatDuration(duration)})`;

        // Use sendBeacon for reliable exit logging
        const payload = {
          action: 'Exit',
          section,
          feature: page,
          page: window.location.pathname,
          details,
          duration,
          metadata: {
            ...configRef.current.context,
            itemId: configRef.current.itemId,
            timestamp: new Date().toISOString(),
            durationSeconds: Math.round(duration / 1000),
            durationReadable: formatDuration(duration),
          },
        };

        // Use sendBeacon for more reliable delivery on page unload
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/activity-log',
            new Blob([JSON.stringify(payload)], { type: 'application/json' })
          );
        } else {
          // Fallback to fetch
          fetch('/api/activity-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
  }, []);

  // Track specific actions within the page
  const trackAction = useCallback((
    action: string,
    description: string,
    additionalContext?: Record<string, any>
  ) => {
    const details = configRef.current.itemDescription
      ? `${description} in ${configRef.current.page}: ${configRef.current.itemDescription}`
      : `${description} in ${configRef.current.page}`;

    const payload: any = {
      action,
      section: configRef.current.section,
      feature: configRef.current.page,
      page: window.location.pathname,
      details,
      metadata: {
        ...configRef.current.context,
        ...additionalContext,
        itemId: configRef.current.itemId,
        timestamp: new Date().toISOString(),
      },
    };

    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, []);

  return { trackAction };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
