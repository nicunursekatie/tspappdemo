import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '../hooks/use-pull-to-refresh';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  disabled?: boolean;
}

/**
 * Pull-to-refresh wrapper component for mobile screens
 *
 * Usage:
 * ```tsx
 * <PullToRefresh onRefresh={async () => await refetch()}>
 *   <YourContent />
 * </PullToRefresh>
 * ```
 */
export function PullToRefresh({
  children,
  onRefresh,
  className,
  disabled = false,
}: PullToRefreshProps) {
  const {
    handlers,
    containerStyle,
    indicatorStyle,
    pullProgress,
    isRefreshing,
  } = usePullToRefresh({
    onRefresh,
    threshold: 70,
  });

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      {...handlers}
    >
      {/* Pull indicator */}
      <div style={indicatorStyle}>
        <div
          className={cn(
            "flex flex-col items-center gap-1 transition-opacity",
            pullProgress > 0 ? "opacity-100" : "opacity-0"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center",
              isRefreshing && "animate-pulse"
            )}
          >
            <RefreshCw
              className={cn(
                "w-5 h-5 text-brand-primary transition-transform",
                isRefreshing && "animate-spin"
              )}
              style={{
                transform: !isRefreshing ? `rotate(${pullProgress * 360}deg)` : undefined,
              }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {isRefreshing ? 'Refreshing...' : pullProgress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={containerStyle}>
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
