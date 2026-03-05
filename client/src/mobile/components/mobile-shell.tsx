import { ReactNode } from 'react';
import { MobileBottomNav } from './mobile-bottom-nav';
import { MobileHeader } from './mobile-header';

interface MobileShellProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  showNav?: boolean;
  showHeader?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
  headerActions?: ReactNode;
}

/**
 * Mobile shell component - the main layout wrapper for mobile views
 * Provides header, content area, and bottom navigation
 */
export function MobileShell({
  children,
  title,
  showBack = false,
  showNav = true,
  showHeader = true,
  onBack,
  rightAction,
  headerActions,
}: MobileShellProps) {
  return (
    <div className="mobile-shell flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Safe area padding for notched devices */}
      <div className="safe-area-top bg-white dark:bg-slate-800" style={{ paddingTop: 'env(safe-area-inset-top)' }} />

      {/* Header */}
      {showHeader && (
        <MobileHeader
          title={title}
          showBack={showBack}
          onBack={onBack}
          rightAction={rightAction || headerActions}
        />
      )}

      {/* Main content area - scrollable */}
      <main
        className="flex-1 overflow-y-auto overscroll-y-contain"
        style={{
          paddingBottom: showNav ? 'calc(4rem + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)'
        }}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      {showNav && <MobileBottomNav />}
    </div>
  );
}
