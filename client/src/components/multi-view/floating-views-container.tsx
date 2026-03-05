import React from 'react';
import { useFloatingViews } from '@/contexts/floating-views-context';
import { FloatingViewWindow } from './floating-view-window';

interface FloatingViewsContainerProps {
  renderContent: (section: string) => React.ReactNode;
}

export function FloatingViewsContainer({ renderContent }: FloatingViewsContainerProps) {
  const { views } = useFloatingViews();

  if (views.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[2000]">
      <div className="pointer-events-auto">
        {views.map((view) => (
          <FloatingViewWindow
            key={view.id}
            view={view}
            renderContent={renderContent}
          />
        ))}
      </div>
    </div>
  );
}
