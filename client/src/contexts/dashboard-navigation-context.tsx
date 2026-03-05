import React, { createContext, useContext } from 'react';

interface DashboardNavigationContextType {
  setActiveSection: (section: string) => void;
}

const DashboardNavigationContext = createContext<DashboardNavigationContextType | undefined>(undefined);

export function DashboardNavigationProvider({
  children,
  setActiveSection,
}: {
  children: React.ReactNode;
  setActiveSection: (section: string) => void;
}) {
  return (
    <DashboardNavigationContext.Provider value={{ setActiveSection }}>
      {children}
    </DashboardNavigationContext.Provider>
  );
}

export function useDashboardNavigation() {
  const context = useContext(DashboardNavigationContext);
  if (!context) {
    // Graceful fallback - return a no-op function if used outside dashboard
    console.warn('useDashboardNavigation used outside DashboardNavigationProvider');
    return {
      setActiveSection: (section: string) => {
        console.log('Navigation requested but not available:', section);
      },
    };
  }
  return context;
}
