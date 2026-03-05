/**
 * Device Detection Utilities
 *
 * Centralized utilities for detecting device type and capabilities.
 * Use these instead of duplicating detection logic across components.
 */

/**
 * Detects if user is on a mobile device.
 *
 * Uses a combination of:
 * - Screen width detection
 * - User agent parsing
 * - Touch capability detection
 *
 * @returns true if the user is on a mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Check screen width
  const isSmallScreen = window.innerWidth < 768;

  // Check user agent for mobile devices
  const isMobileUserAgent = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return (isSmallScreen && hasTouch) || isMobileUserAgent;
}

/**
 * Detects if user is on a tablet device.
 *
 * @returns true if the user is on a tablet
 */
export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const isTabletWidth = window.innerWidth >= 768 && window.innerWidth < 1024;
  const isTabletUserAgent = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);

  return isTabletWidth || isTabletUserAgent;
}

/**
 * Detects if user is on a touch-enabled device.
 *
 * @returns true if the device supports touch
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;

  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Gets the current device type.
 *
 * @returns 'mobile' | 'tablet' | 'desktop'
 */
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (isTabletDevice()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
}
