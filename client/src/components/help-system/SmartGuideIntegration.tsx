import React from 'react';
import {
  IntelligentGuideSystem,
  FeatureTooltip,
  TipTooltip,
  InfoTooltip,
} from './IntelligentGuideSystem';

// Integration wrapper that demonstrates how to use the Smart Contextual Tooltip Guide System
// throughout the application

interface SmartGuideIntegrationProps {
  children: React.ReactNode;
}

export function SmartGuideIntegration({
  children,
}: SmartGuideIntegrationProps) {
  return <IntelligentGuideSystem>{children}</IntelligentGuideSystem>;
}

// Example usage components that show how to integrate tooltips into UI elements
export function SmartCollectionButton({
  onClick,
  children,
  ...props
}: {
  onClick: () => void;
  children: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <FeatureTooltip
      title="Record New Collection"
      description="Start entering sandwich collection data. Choose between the quick form for experienced users or the step-by-step walkthrough for beginners."
      trigger="hover"
      placement="bottom"
    >
      <button
        onClick={onClick}
        data-guide="add-collection"
        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-md transition-colors"
        {...props}
      >
        {children}
      </button>
    </FeatureTooltip>
  );
}

export function SmartNavigationItem({
  to,
  children,
  guideId,
  tooltipContent,
}: {
  to: string;
  children: React.ReactNode;
  guideId: string;
  tooltipContent: {
    title: string;
    description: string;
  };
}) {
  return (
    <InfoTooltip
      title={tooltipContent.title}
      description={tooltipContent.description}
      trigger="hover"
      placement="right"
    >
      <a
        href={to}
        data-guide={guideId}
        className="flex items-center px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
        {children}
      </a>
    </InfoTooltip>
  );
}

export function SmartFormField({
  label,
  tooltip,
  children,
  guideId,
}: {
  label: string;
  tooltip: string;
  children: React.ReactNode;
  guideId?: string;
}) {
  return (
    <div className="space-y-2">
      <TipTooltip
        title={label}
        description={tooltip}
        trigger="hover"
        placement="top"
      >
        <label
          className="block text-sm font-medium text-slate-700"
          data-guide={guideId}
        >
          {label}
        </label>
      </TipTooltip>
      {children}
    </div>
  );
}

// Usage examples and integration patterns
export const SmartGuideExamples = {
  // Collections page integration
  collectionsPage: `
    <SmartCollectionButton onClick={handleAddCollection}>
      Record New Collection
    </SmartCollectionButton>
    
    <SmartFormField 
      label="Sandwich Count" 
      tooltip="Enter the total number of sandwiches collected. Don't worry about being exact - estimates are fine!"
      guideId="sandwich-count-field"
    >
      <input type="number" />
    </SmartFormField>
  `,

  // Navigation integration
  sidebar: `
    <SmartNavigationItem 
      to="/collections" 
      guideId="nav-collections"
      tooltipContent={{
        title: "Collections",
        description: "Record and manage sandwich collection data"
      }}
    >
      <FileText className="w-5 h-5 mr-3" />
      Collections
    </SmartNavigationItem>
  `,

  // Dashboard integration
  dashboard: `
    <IntelligentGuideSystem>
      <div data-guide="main-navigation">
        {/* Sidebar content */}
      </div>
      
      <div data-guide="analytics">
        {/* Analytics dashboard */}
      </div>
      
      <div data-guide="user-management">
        {/* User management section */}
      </div>
    </IntelligentGuideSystem>
  `,
};
