import { useState, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // Distance to pull before triggering refresh
  resistance?: number; // How much to resist pulling (higher = harder to pull)
}

interface UsePullToRefreshReturn {
  isPulling: boolean;
  isRefreshing: boolean;
  pullDistance: number;
  pullProgress: number; // 0-1, how close to threshold
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  containerStyle: React.CSSProperties;
  indicatorStyle: React.CSSProperties;
}

/**
 * Hook for pull-to-refresh functionality on mobile
 *
 * Usage:
 * ```tsx
 * const { handlers, containerStyle, indicatorStyle, isRefreshing, pullProgress } = usePullToRefresh({
 *   onRefresh: async () => {
 *     await refetch();
 *   }
 * });
 *
 * return (
 *   <div {...handlers} style={containerStyle}>
 *     <PullIndicator style={indicatorStyle} progress={pullProgress} isRefreshing={isRefreshing} />
 *     <YourContent />
 *   </div>
 * );
 * ```
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollableRef = useRef<Element | null>(null);

  // Check if we're at the top of the scrollable container
  const isAtTop = useCallback(() => {
    if (scrollableRef.current) {
      return scrollableRef.current.scrollTop <= 0;
    }
    return window.scrollY <= 0;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;

    // Find the scrollable container
    scrollableRef.current = e.currentTarget.querySelector('[data-pull-scroll]') || e.currentTarget;

    if (isAtTop() && e.touches[0]) {
      startY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  }, [isRefreshing, isAtTop]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing || !e.touches[0]) return;

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    // Only allow pulling down
    if (diff > 0 && isAtTop()) {
      // Apply resistance - pulling gets harder as you go
      const resistedDistance = diff / resistance;
      setPullDistance(Math.min(resistedDistance, threshold * 1.5));

      // Prevent default scrolling while pulling
      if (resistedDistance > 5) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, isRefreshing, resistance, threshold, isAtTop]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold / 2); // Keep indicator visible during refresh

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    startY.current = 0;
    currentY.current = 0;
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh]);

  // Calculate progress (0-1)
  const pullProgress = Math.min(pullDistance / threshold, 1);

  // Container style - translates content down while pulling
  const containerStyle: React.CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
    transition: isPulling ? 'none' : 'transform 0.2s ease-out',
  };

  // Indicator style - positioned above content
  const indicatorStyle: React.CSSProperties = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: `${threshold}px`,
    transform: `translateY(${-threshold + pullDistance}px)`,
    transition: isPulling ? 'none' : 'transform 0.2s ease-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none' as const,
  };

  return {
    isPulling,
    isRefreshing,
    pullDistance,
    pullProgress,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    containerStyle,
    indicatorStyle,
  };
}

export default usePullToRefresh;
