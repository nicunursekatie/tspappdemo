import { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileShell } from '@/mobile/components/mobile-shell';

interface ResponsivePageLayoutProps {
  children: ReactNode;
  /** Title shown in mobile header */
  title?: string;
  /** Show back button in mobile header */
  showBack?: boolean;
  /** Custom back handler */
  onBack?: () => void;
  /** Show bottom navigation (set false for auth pages) */
  showNav?: boolean;
  /** Show mobile header */
  showHeader?: boolean;
  /** Right action slot for mobile header */
  rightAction?: ReactNode;
  /** Additional class names for desktop wrapper */
  className?: string;
  /** Desktop max width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Center content on desktop */
  centered?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
};

/**
 * ResponsivePageLayout - Unified layout wrapper for all pages
 *
 * Automatically switches between:
 * - Mobile: Full MobileShell with header, safe areas, and bottom nav
 * - Desktop: Simple centered container
 *
 * Usage:
 * ```tsx
 * // For authenticated pages with navigation
 * <ResponsivePageLayout title="Dashboard">
 *   <YourContent />
 * </ResponsivePageLayout>
 *
 * // For auth pages (no bottom nav)
 * <ResponsivePageLayout title="Login" showNav={false} showBack={false}>
 *   <LoginForm />
 * </ResponsivePageLayout>
 * ```
 */
export function ResponsivePageLayout({
  children,
  title,
  showBack = false,
  onBack,
  showNav = true,
  showHeader = true,
  rightAction,
  className = '',
  maxWidth = 'full',
  centered = false,
}: ResponsivePageLayoutProps) {
  const isMobile = useIsMobile();

  // Mobile: Use MobileShell wrapper
  if (isMobile) {
    return (
      <MobileShell
        title={title}
        showBack={showBack}
        onBack={onBack}
        showNav={showNav}
        showHeader={showHeader}
        rightAction={rightAction}
      >
        {children}
      </MobileShell>
    );
  }

  // Desktop: Wrap children with configurable container
  const widthClass = maxWidthClasses[maxWidth];
  const containerClasses = [
    'w-full',
    widthClass,
    centered ? 'mx-auto' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={containerClasses}>{children}</div>;
}

/**
 * AuthPageLayout - Preset for authentication pages
 *
 * - No bottom navigation
 * - Centered content
 * - Constrained width on desktop
 */
export function AuthPageLayout({
  children,
  title,
  showBack = true,
}: {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
}) {
  return (
    <ResponsivePageLayout
      title={title}
      showBack={showBack}
      showNav={false}
      showHeader={true}
      maxWidth="md"
      centered={true}
    >
      {children}
    </ResponsivePageLayout>
  );
}
