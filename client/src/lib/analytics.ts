import { logger } from '@/lib/logger';

/**
 * Google Analytics Integration
 * Tracks user events and page views to Google Analytics
 */

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// Get the Google Analytics Measurement ID from environment variables
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

/**
 * Initialize Google Analytics
 * This should be called once when the app loads
 */
export function initGA(): void {
  if (!GA_MEASUREMENT_ID) {
    logger.warn('Google Analytics: No measurement ID found. Set VITE_GA_MEASUREMENT_ID in your environment variables.');
    return;
  }

  // Check if already initialized
  if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) {
    logger.log('Google Analytics: Already initialized');
    return;
  }

  // Load the Google Analytics script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer if it doesn't exist
  window.dataLayer = window.dataLayer || [];
  
  // Define gtag function if it doesn't exist
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer!.push(arguments);
    };
  }
  
  // Initialize with current timestamp
  window.gtag('js', new Date());
  
  // Configure with measurement ID
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: true,
    cookie_flags: 'SameSite=None;Secure', // For cross-domain tracking
  });

  logger.log('✅ Google Analytics initialized:', GA_MEASUREMENT_ID);
}

/**
 * Track a custom event in Google Analytics
 * 
 * @param action - The action being performed (e.g., 'click', 'download', 'submit')
 * @param category - The category of the event (e.g., 'button', 'form', 'navigation')
 * @param label - Optional label for more context
 * @param value - Optional numeric value
 */
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
): void {
  if (!window.gtag) {
    logger.warn('Google Analytics: gtag not initialized');
    return;
  }

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });

  logger.log('GA Event:', { action, category, label, value });
}

/**
 * Track a page view in Google Analytics
 * 
 * @param path - The page path (e.g., '/dashboard', '/collections')
 * @param title - Optional page title
 */
export function trackPageView(path: string, title?: string): void {
  if (!window.gtag) {
    logger.warn('Google Analytics: gtag not initialized');
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });

  logger.log('GA Page View:', { path, title });
}

/**
 * Track user properties in Google Analytics
 * 
 * @param properties - User properties to track (e.g., user_id, role)
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!window.gtag) {
    logger.warn('Google Analytics: gtag not initialized');
    return;
  }

  window.gtag('set', 'user_properties', properties);
  logger.log('GA User Properties:', properties);
}
