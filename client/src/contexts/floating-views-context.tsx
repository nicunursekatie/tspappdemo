import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface FloatingView {
  id: string;
  section: string;
  title: string;
  isMinimized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}

interface FloatingViewsContextType {
  views: FloatingView[];
  openView: (section: string, title: string) => void;
  closeView: (id: string) => void;
  toggleMinimize: (id: string) => void;
  minimizeAll: () => void;
  closeAll: () => void;
  bringToFront: (id: string) => void;
  updatePosition: (id: string, position: { x: number; y: number }) => void;
  updateSize: (id: string, size: { width: number; height: number }) => void;
  maxViews: number;
}

const FloatingViewsContext = createContext<FloatingViewsContextType | undefined>(undefined);

const MAX_FLOATING_VIEWS = 5;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 500;
const WINDOW_OFFSET = 30;

function generateViewId(): string {
  return `floating-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function FloatingViewsProvider({ children }: { children: React.ReactNode }) {
  const [views, setViews] = useState<FloatingView[]>([]);
  const [highestZIndex, setHighestZIndex] = useState(2000);

  const openView = useCallback((section: string, title: string) => {
    setViews(prev => {
      // Check if view already exists for this section
      const existingIndex = prev.findIndex(v => v.section === section);

      if (existingIndex !== -1) {
        // Bring existing view to front and unminimize
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          isMinimized: false,
          zIndex: highestZIndex + 1,
        };
        setHighestZIndex(z => z + 1);
        return updated;
      }

      // Don't add more than max views
      if (prev.length >= MAX_FLOATING_VIEWS) {
        // Close the oldest view to make room
        const [, ...rest] = prev;
        return [...rest, createNewView(section, title, rest.length)];
      }

      return [...prev, createNewView(section, title, prev.length)];
    });
  }, [highestZIndex]);

  const createNewView = (section: string, title: string, index: number): FloatingView => {
    // Position new windows with an offset from previous ones
    const baseX = 100 + (index * WINDOW_OFFSET);
    const baseY = 100 + (index * WINDOW_OFFSET);

    setHighestZIndex(z => z + 1);

    return {
      id: generateViewId(),
      section,
      title,
      isMinimized: false,
      position: { x: baseX, y: baseY },
      size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      zIndex: highestZIndex + 1,
    };
  };

  const closeView = useCallback((id: string) => {
    setViews(prev => prev.filter(v => v.id !== id));
  }, []);

  const toggleMinimize = useCallback((id: string) => {
    setViews(prev =>
      prev.map(v => (v.id === id ? { ...v, isMinimized: !v.isMinimized } : v))
    );
  }, []);

  const minimizeAll = useCallback(() => {
    setViews(prev => prev.map(v => ({ ...v, isMinimized: true })));
  }, []);

  const closeAll = useCallback(() => {
    setViews([]);
  }, []);

  const bringToFront = useCallback((id: string) => {
    setViews(prev =>
      prev.map(v =>
        v.id === id ? { ...v, zIndex: highestZIndex + 1 } : v
      )
    );
    setHighestZIndex(z => z + 1);
  }, [highestZIndex]);

  const updatePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setViews(prev =>
      prev.map(v => (v.id === id ? { ...v, position } : v))
    );
  }, []);

  const updateSize = useCallback((id: string, size: { width: number; height: number }) => {
    setViews(prev =>
      prev.map(v => (v.id === id ? { ...v, size } : v))
    );
  }, []);

  const value = useMemo(() => ({
    views,
    openView,
    closeView,
    toggleMinimize,
    minimizeAll,
    closeAll,
    bringToFront,
    updatePosition,
    updateSize,
    maxViews: MAX_FLOATING_VIEWS,
  }), [
    views,
    openView,
    closeView,
    toggleMinimize,
    minimizeAll,
    closeAll,
    bringToFront,
    updatePosition,
    updateSize,
  ]);

  return (
    <FloatingViewsContext.Provider value={value}>
      {children}
    </FloatingViewsContext.Provider>
  );
}

export function useFloatingViews() {
  const context = useContext(FloatingViewsContext);
  if (!context) {
    throw new Error('useFloatingViews must be used within FloatingViewsProvider');
  }
  return context;
}

// Convenience hook for opening a section as a floating view
export function usePopOutView() {
  const { openView } = useFloatingViews();
  return openView;
}
