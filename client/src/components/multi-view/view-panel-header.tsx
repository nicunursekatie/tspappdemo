import React from 'react';
import { X, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useMultiView, type ViewPanel } from '@/contexts/multi-view-context';
import { useFloatingViews } from '@/contexts/floating-views-context';
import { NAV_ITEMS } from '@/nav.config';
import { cn } from '@/lib/utils';

interface ViewPanelHeaderProps {
  panel: ViewPanel;
  onSectionChange: (section: string) => void;
}

// Get display label for a section
function getSectionLabel(section: string): string {
  const navItem = NAV_ITEMS.find(item => item.href === section);
  if (navItem) return navItem.label;

  // Handle special cases
  if (section.startsWith('project-')) return 'Project Details';

  // Capitalize and format the section name
  return section
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Group nav items by their group for the dropdown
function getGroupedNavItems() {
  const groups: Record<string, typeof NAV_ITEMS> = {};

  NAV_ITEMS.forEach(item => {
    // Skip items without href or external items
    if (!item.href || item.external || item.topNav) return;

    const group = item.group || 'other';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
  });

  return groups;
}

const GROUP_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'quick-links': 'Quick Links',
  'workspace': 'Workspace',
  'logistics': 'Logistics',
  'network': 'Network',
  'operations': 'Operations',
  'admin': 'Admin & Resources',
};

export function ViewPanelHeader({ panel, onSectionChange }: ViewPanelHeaderProps) {
  const { panels, removePanel } = useMultiView();
  const { openView } = useFloatingViews();

  const canClose = panels.length > 1;
  const sectionLabel = getSectionLabel(panel.section);
  const groupedItems = getGroupedNavItems();

  const handlePopOut = () => {
    // Open as floating window
    openView(panel.section, sectionLabel);
    // Remove from split view if we have more than one panel
    if (canClose) {
      removePanel(panel.id);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
      {/* Section Selector Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <span className="truncate max-w-[150px]">{sectionLabel}</span>
            <ChevronDown className="h-4 w-4 ml-1 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
          {Object.entries(groupedItems).map(([group, items]) => (
            <React.Fragment key={group}>
              <DropdownMenuLabel className="text-xs text-slate-500">
                {GROUP_LABELS[group] || group}
              </DropdownMenuLabel>
              {items.map(item => (
                <DropdownMenuItem
                  key={item.id}
                  onClick={() => onSectionChange(item.href)}
                  className={cn(
                    'flex items-center gap-2',
                    panel.section === item.href && 'bg-slate-100'
                  )}
                >
                  {item.icon && <item.icon className="h-4 w-4 opacity-60" />}
                  <span className="truncate">{item.label}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Panel Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-200"
          onClick={handlePopOut}
          title="Pop out to floating window"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        {canClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => removePanel(panel.id)}
            title="Close panel"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
