/**
 * Responsive Design Utilities
 *
 * Helper functions and hooks for responsive design and breakpoint management.
 *
 * NOTE: These hooks are designed to work with SSR. They will return default values
 * during server-side rendering and update after hydration on the client.
 */

import { useState, useEffect } from 'react';

/**
 * Breakpoint values (must match tailwind.config.ts)
 */
export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,  // Mobile breakpoint
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Check if code is running on the client side
 */
const isClient = typeof window !== 'undefined';

/**
 * Hook to get current window width
 * SSR-safe: Returns a default value during SSR, updates after mount
 */
export function useWindowWidth(): number {
  const [windowWidth, setWindowWidth] = useState<number>(
    isClient ? window.innerWidth : 1024 // Default to desktop width for SSR
  );

  useEffect(() => {
    if (!isClient) return;

    // Update immediately after mount to get actual window width
    setWindowWidth(window.innerWidth);

    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowWidth;
}

/**
 * Hook to check if screen is at or above a breakpoint
 * SSR-safe: Assumes desktop breakpoint during SSR
 */
export function useMediaQuery(breakpoint: Breakpoint): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS[breakpoint];
}

/**
 * Hook to get current breakpoint
 * SSR-safe: Returns 'lg' (desktop) during SSR
 */
export function useCurrentBreakpoint(): Breakpoint {
  const windowWidth = useWindowWidth();

  if (windowWidth >= BREAKPOINTS['2xl']) return '2xl';
  if (windowWidth >= BREAKPOINTS.xl) return 'xl';
  if (windowWidth >= BREAKPOINTS.lg) return 'lg';
  if (windowWidth >= BREAKPOINTS.md) return 'md';
  if (windowWidth >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

/**
 * Check if screen is mobile (below md breakpoint)
 * SSR-safe: Returns false (desktop) during SSR
 */
export function useIsMobileScreen(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth < BREAKPOINTS.md;
}

/**
 * Check if screen is tablet (md to lg)
 * SSR-safe: Returns false during SSR
 */
export function useIsTablet(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS.md && windowWidth < BREAKPOINTS.lg;
}

/**
 * Check if screen is desktop (lg and above)
 * SSR-safe: Returns true during SSR
 */
export function useIsDesktop(): boolean {
  const windowWidth = useWindowWidth();
  return windowWidth >= BREAKPOINTS.lg;
}

/**
 * Responsive value helper
 * Returns different values based on current breakpoint with proper cascading fallback
 *
 * Example:
 * - Breakpoint: xl, Values: { base: 'A', lg: 'B' }
 * - Returns: 'B' (cascades from xl → lg, finds 'B')
 *
 * SSR-safe: Uses base value during SSR
 */
export function useResponsiveValue<T>(values: {
  base: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T {
  const breakpoint = useCurrentBreakpoint();

  // Cascade down from current breakpoint to find the first defined value
  // This ensures proper fallback behavior (e.g., xl falls back to lg, not base)
  switch (breakpoint) {
    case '2xl':
      if (values['2xl'] !== undefined) return values['2xl'];
      // Fall through to xl
    case 'xl':
      if (values.xl !== undefined) return values.xl;
      // Fall through to lg
    case 'lg':
      if (values.lg !== undefined) return values.lg;
      // Fall through to md
    case 'md':
      if (values.md !== undefined) return values.md;
      // Fall through to sm
    case 'sm':
      if (values.sm !== undefined) return values.sm;
      // Fall through to base
    default:
      return values.base;
  }
}

/**
 * Get columns for responsive grid
 * SSR-safe: Uses desktop config during SSR
 */
export function useResponsiveColumns(config: {
  mobile: number;
  tablet: number;
  desktop: number;
}): number {
  const isMobile = useIsMobileScreen();
  const isTablet = useIsTablet();

  if (isMobile) return config.mobile;
  if (isTablet) return config.tablet;
  return config.desktop;
}

/**
 * Responsive class helper
 * Returns static class names (Tailwind JIT compatible)
 * NOTE: This does NOT use template literals for class names
 */
export function responsiveClass(
  base: string,
  responsive: {
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    '2xl'?: string;
  }
): string {
  const classes = [base];

  if (responsive.sm) classes.push(`sm:${responsive.sm}`);
  if (responsive.md) classes.push(`md:${responsive.md}`);
  if (responsive.lg) classes.push(`lg:${responsive.lg}`);
  if (responsive.xl) classes.push(`xl:${responsive.xl}`);
  if (responsive['2xl']) classes.push(`2xl:${responsive['2xl']}`);

  return classes.join(' ');
}

/**
 * Container max width helper
 */
export const CONTAINER_WIDTHS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
} as const;

/**
 * Get container class for responsive width
 *
 * WARNING: This function uses predefined static classes only.
 * For Tailwind JIT compatibility, only use the standard max-width values.
 */
export function getContainerClass(maxWidth: keyof typeof CONTAINER_WIDTHS = 'xl'): string {
  // Use predefined classes to ensure Tailwind JIT can detect them
  const maxWidthClasses: Record<keyof typeof CONTAINER_WIDTHS, string> = {
    sm: 'w-full max-w-sm mx-auto px-4 sm:px-6 lg:px-8',
    md: 'w-full max-w-md mx-auto px-4 sm:px-6 lg:px-8',
    lg: 'w-full max-w-lg mx-auto px-4 sm:px-6 lg:px-8',
    xl: 'w-full max-w-xl mx-auto px-4 sm:px-6 lg:px-8',
    '2xl': 'w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8',
    full: 'w-full mx-auto px-4 sm:px-6 lg:px-8',
  };

  return maxWidthClasses[maxWidth];
}

/**
 * Responsive spacing helper
 * SSR-safe: Uses mobile config during SSR
 */
export function useResponsiveSpacing(config: {
  mobile: string;
  tablet?: string;
  desktop?: string;
}): string {
  const isMobile = useIsMobileScreen();
  const isTablet = useIsTablet();

  if (isMobile) return config.mobile;
  if (isTablet && config.tablet) return config.tablet;
  if (config.desktop) return config.desktop;

  return config.mobile;
}

/**
 * Safe area inset helper for notched devices
 */
export function useSafeAreaInsets(): {
  top: string;
  right: string;
  bottom: string;
  left: string;
} {
  return {
    top: 'env(safe-area-inset-top)',
    right: 'env(safe-area-inset-right)',
    bottom: 'env(safe-area-inset-bottom)',
    left: 'env(safe-area-inset-left)',
  };
}

/**
 * Orientation detection
 * SSR-safe: Returns 'landscape' during SSR
 */
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    isClient && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );

  useEffect(() => {
    if (!isClient) return;

    // Update immediately after mount
    setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');

    function handleResize() {
      setOrientation(
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
      );
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return orientation;
}

/**
 * Responsive grid classes helper
 *
 * WARNING: For Tailwind JIT compatibility, this function returns predefined classes only.
 * Supports columns 1-12 and common gap values (1-8, 10, 12, 16).
 */
export function getResponsiveGridClasses(config: {
  mobile: number;
  tablet?: number;
  desktop?: number;
  gap?: '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '10' | '12' | '16';
}): string {
  const classes: string[] = ['grid'];

  // Mobile columns (base)
  const mobileClass = `grid-cols-${config.mobile}` as const;
  classes.push(mobileClass);

  // Tablet columns (md breakpoint)
  if (config.tablet) {
    const tabletClass = `md:grid-cols-${config.tablet}` as const;
    classes.push(tabletClass);
  }

  // Desktop columns (lg breakpoint)
  if (config.desktop) {
    const desktopClass = `lg:grid-cols-${config.desktop}` as const;
    classes.push(desktopClass);
  }

  // Gap (if specified)
  if (config.gap) {
    const gapClass = `gap-${config.gap}` as const;
    classes.push(gapClass);
  }

  return classes.join(' ');
}

/**
 * Touch device detection
 * SSR-safe: Returns false during SSR, detects on mount
 */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(false);

  useEffect(() => {
    if (!isClient) return;

    const hasTouchScreen =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0;

    setIsTouch(hasTouchScreen);
  }, []);

  return isTouch;
}

/**
 * Prefers reduced motion detection (for accessibility)
 * SSR-safe: Returns false during SSR, detects on mount
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (!isClient) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Viewport height helper (accounts for mobile browser chrome)
 * SSR-safe: Returns 0 during SSR, updates on mount
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState<number>(
    isClient ? window.innerHeight : 0
  );

  useEffect(() => {
    if (!isClient) return;

    // Update immediately after mount
    setHeight(window.innerHeight);

    function handleResize() {
      setHeight(window.innerHeight);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return height;
}
