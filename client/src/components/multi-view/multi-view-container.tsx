import React, { Suspense } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useMultiView, type ViewPanel } from '@/contexts/multi-view-context';
import { ViewPanelHeader } from './view-panel-header';
import { ErrorBoundary } from '@/components/error-boundary';
import { cn } from '@/lib/utils';

interface MultiViewContainerProps {
  renderContent: (section: string) => React.ReactNode;
  onSectionChange: (section: string, panelId?: string) => void;
  className?: string;
}

// Loading fallback for lazy-loaded content
const PanelLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
      <p className="text-muted-foreground text-sm">Loading section...</p>
    </div>
  </div>
);

interface SinglePanelContentProps {
  panel: ViewPanel;
  renderContent: (section: string) => React.ReactNode;
  onSectionChange: (section: string, panelId?: string) => void;
  isMultiView: boolean;
}

function SinglePanelContent({
  panel,
  renderContent,
  onSectionChange,
  isMultiView,
}: SinglePanelContentProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Show panel header only in multi-view mode */}
      {isMultiView && (
        <ViewPanelHeader
          panel={panel}
          onSectionChange={(section) => onSectionChange(section, panel.id)}
        />
      )}
      <div className={cn('flex-1 overflow-hidden min-h-0', !isMultiView && 'h-full')}>
        <ErrorBoundary>
          <Suspense fallback={<PanelLoader />}>
            {renderContent(panel.section)}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

export function MultiViewContainer({
  renderContent,
  onSectionChange,
  className,
}: MultiViewContainerProps) {
  const { panels, activePanel, setActivePanel, isMultiViewEnabled, splitLayout, updatePanelSection } = useMultiView();

  // Handle section change - update panel section in multi-view, or call parent handler
  const handleSectionChange = (section: string, panelId?: string) => {
    if (isMultiViewEnabled && panelId) {
      updatePanelSection(panelId, section);
    } else {
      onSectionChange(section, panelId);
    }
  };

  // Single panel mode - render normally without split
  if (!isMultiViewEnabled || panels.length === 1) {
    const panel = panels[0];
    return (
      <div className={cn('h-full', className)}>
        <SinglePanelContent
          panel={panel}
          renderContent={renderContent}
          onSectionChange={handleSectionChange}
          isMultiView={false}
        />
      </div>
    );
  }

  // Multi-panel mode with resizable panels
  return (
    <div className={cn('h-full', className)}>
      <ResizablePanelGroup
        direction={splitLayout}
        className="h-full"
      >
        {panels.map((panel, index) => {
          const isActive = activePanel === panel.id;
          return (
            <React.Fragment key={panel.id}>
              <ResizablePanel
                defaultSize={100 / panels.length}
                minSize={20}
                className="flex flex-col"
              >
                {/* Click-to-focus wrapper: clicking a panel makes it the sidebar target */}
                <div
                  className={cn(
                    'h-full flex flex-col relative',
                    isActive
                      ? 'ring-2 ring-teal-400 ring-inset'
                      : 'ring-1 ring-transparent hover:ring-slate-300 ring-inset'
                  )}
                  onClick={() => {
                    if (!isActive) {
                      setActivePanel(panel.id);
                    }
                  }}
                >
                  {/* Active panel indicator bar */}
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-teal-500 z-10" />
                  )}
                  <SinglePanelContent
                    panel={panel}
                    renderContent={renderContent}
                    onSectionChange={handleSectionChange}
                    isMultiView={true}
                  />
                </div>
              </ResizablePanel>
              {index < panels.length - 1 && (
                <ResizableHandle withHandle />
              )}
            </React.Fragment>
          );
        })}
      </ResizablePanelGroup>
    </div>
  );
}
