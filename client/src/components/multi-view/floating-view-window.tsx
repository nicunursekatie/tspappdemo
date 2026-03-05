import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { X, Minus, Maximize2, Move, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFloatingViews, type FloatingView } from '@/contexts/floating-views-context';
import { ErrorBoundary } from '@/components/error-boundary';

interface FloatingViewWindowProps {
  view: FloatingView;
  renderContent: (section: string) => React.ReactNode;
}

// Simple loading fallback
const ViewLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export function FloatingViewWindow({ view, renderContent }: FloatingViewWindowProps) {
  const { closeView, toggleMinimize, bringToFront, updatePosition, updateSize } = useFloatingViews();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const MIN_WIDTH = 400;
  const MIN_HEIGHT = 300;

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    setIsDragging(true);
    bringToFront(view.id);
    setDragOffset({
      x: e.clientX - view.position.x,
      y: e.clientY - view.position.y,
    });
  }, [view.id, view.position, bringToFront]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - view.size.width));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - view.size.height));
      updatePosition(view.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, view.id, view.size, updatePosition]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    bringToFront(view.id);
  }, [view.id, bringToFront]);

  // Handle resize
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(MIN_WIDTH, e.clientX - view.position.x);
      const newHeight = Math.max(MIN_HEIGHT, e.clientY - view.position.y);
      updateSize(view.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, view.id, view.position, updateSize]);

  // Focus window on click
  const handleWindowClick = useCallback(() => {
    bringToFront(view.id);
  }, [view.id, bringToFront]);

  return (
    <div
      ref={windowRef}
      className={cn(
        'fixed bg-white border border-slate-200 rounded-lg shadow-2xl flex flex-col overflow-hidden',
        isDragging && 'cursor-grabbing',
        isResizing && 'cursor-se-resize',
        view.isMinimized && 'h-10'
      )}
      style={{
        left: view.position.x,
        top: view.position.y,
        width: view.isMinimized ? 250 : view.size.width,
        height: view.isMinimized ? 40 : view.size.height,
        zIndex: view.zIndex,
      }}
      onClick={handleWindowClick}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2 bg-gradient-to-r from-brand-primary to-brand-primary-dark text-white select-none',
          !view.isMinimized && 'cursor-grab',
          isDragging && 'cursor-grabbing'
        )}
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Move className="h-4 w-4 opacity-60 flex-shrink-0" />
          <span className="font-semibold text-sm truncate">{view.title}</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize(view.id);
            }}
            title={view.isMinimized ? 'Restore' : 'Minimize'}
          >
            {view.isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              closeView(view.id);
            }}
            title="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {!view.isMinimized && (
        <div className="flex-1 overflow-auto bg-[#F6F9FA]">
          <ErrorBoundary>
            <Suspense fallback={<ViewLoader />}>
              <div className="h-full">
                {renderContent(view.section)}
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      {/* Resize Handle */}
      {!view.isMinimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
          onMouseDown={handleResizeStart}
        >
          <svg
            className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V20H18V22ZM22 14H20V18H22V14Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
