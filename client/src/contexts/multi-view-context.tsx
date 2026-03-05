import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

export interface ViewPanel {
  id: string;
  section: string;
  title?: string;
}

interface MultiViewContextType {
  panels: ViewPanel[];
  activePanel: string | null;
  maxPanels: number;
  addPanel: (section: string, title?: string) => void;
  removePanel: (id: string) => void;
  updatePanelSection: (id: string, section: string, title?: string) => void;
  setActivePanel: (id: string) => void;
  canAddPanel: boolean;
  isMultiViewEnabled: boolean;
  setMultiViewEnabled: (enabled: boolean) => void;
  splitLayout: 'horizontal' | 'vertical';
  setSplitLayout: (layout: 'horizontal' | 'vertical') => void;
  navigateActivePanel: (section: string, title?: string) => void;
}

const MultiViewContext = createContext<MultiViewContextType | undefined>(undefined);

const MAX_PANELS = 4;

function generatePanelId(): string {
  return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function MultiViewProvider({
  children,
  initialSection = 'dashboard'
}: {
  children: React.ReactNode;
  initialSection?: string;
}) {
  const [panels, setPanels] = useState<ViewPanel[]>([
    { id: 'primary', section: initialSection, title: 'Main View' }
  ]);
  const [activePanel, setActivePanel] = useState<string | null>('primary');
  const [isMultiViewEnabled, setMultiViewEnabled] = useState(false);
  const [splitLayout, setSplitLayout] = useState<'horizontal' | 'vertical'>('horizontal');

  // Sync primary panel with initialSection when it changes from URL navigation
  useEffect(() => {
    setPanels(prev => {
      const primary = prev.find(p => p.id === 'primary');
      if (primary && primary.section !== initialSection) {
        // In multi-view mode, update the active panel instead of primary
        if (isMultiViewEnabled && activePanel && activePanel !== 'primary') {
          return prev.map(p =>
            p.id === activePanel ? { ...p, section: initialSection } : p
          );
        }
        // In single-view or when primary is active, update primary panel
        return prev.map(p =>
          p.id === 'primary' ? { ...p, section: initialSection } : p
        );
      }
      return prev;
    });
  }, [initialSection, isMultiViewEnabled, activePanel]);

  const canAddPanel = useMemo(() => panels.length < MAX_PANELS, [panels.length]);

  const addPanel = useCallback((section: string, title?: string) => {
    if (!canAddPanel) return;

    setPanels(prev => {
      // Check if this section already has a panel
      const existingPanel = prev.find(p => p.section === section);
      if (existingPanel) {
        // Just focus the existing panel
        setActivePanel(existingPanel.id);
        return prev;
      }

      const newPanel: ViewPanel = {
        id: generatePanelId(),
        section,
        title: title || section,
      };

      // Auto-enable multi-view when adding a second panel
      if (prev.length === 1) {
        setMultiViewEnabled(true);
      }

      setActivePanel(newPanel.id);
      return [...prev, newPanel];
    });
  }, [canAddPanel]);

  const removePanel = useCallback((id: string) => {
    setPanels(prev => {
      // Don't allow removing the last panel
      if (prev.length <= 1) return prev;

      const newPanels = prev.filter(p => p.id !== id);

      // If we removed the active panel, activate another one
      if (activePanel === id && newPanels.length > 0) {
        setActivePanel(newPanels[newPanels.length - 1].id);
      }

      // Auto-disable multi-view when back to single panel
      if (newPanels.length === 1) {
        setMultiViewEnabled(false);
      }

      return newPanels;
    });
  }, [activePanel]);

  const updatePanelSection = useCallback((id: string, section: string, title?: string) => {
    setPanels(prev =>
      prev.map(panel =>
        panel.id === id
          ? { ...panel, section, title: title || section }
          : panel
      )
    );
  }, []);

  // Navigate whichever panel is currently focused (active)
  // This is the method sidebar navigation should call in multi-view mode
  const navigateActivePanel = useCallback((section: string, title?: string) => {
    const targetPanelId = activePanel || 'primary';
    setPanels(prev =>
      prev.map(panel =>
        panel.id === targetPanelId
          ? { ...panel, section, title: title || section }
          : panel
      )
    );
  }, [activePanel]);

  const value = useMemo(() => ({
    panels,
    activePanel,
    maxPanels: MAX_PANELS,
    addPanel,
    removePanel,
    updatePanelSection,
    setActivePanel,
    canAddPanel,
    isMultiViewEnabled,
    setMultiViewEnabled,
    splitLayout,
    setSplitLayout,
    navigateActivePanel,
  }), [
    panels,
    activePanel,
    addPanel,
    removePanel,
    updatePanelSection,
    canAddPanel,
    isMultiViewEnabled,
    splitLayout,
    navigateActivePanel,
  ]);

  return (
    <MultiViewContext.Provider value={value}>
      {children}
    </MultiViewContext.Provider>
  );
}

export function useMultiView() {
  const context = useContext(MultiViewContext);
  if (!context) {
    throw new Error('useMultiView must be used within MultiViewProvider');
  }
  return context;
}

// Hook for components that want to open content in a new panel
export function useOpenInPanel() {
  const { addPanel, canAddPanel } = useMultiView();

  return useCallback((section: string, title?: string) => {
    if (canAddPanel) {
      addPanel(section, title);
    }
  }, [addPanel, canAddPanel]);
}
