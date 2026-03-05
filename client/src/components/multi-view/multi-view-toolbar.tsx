import React, { useMemo } from 'react';
import {
  Plus,
  Columns,
  Rows,
  PanelLeft,
  X,
  ExternalLink,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useMultiView } from '@/contexts/multi-view-context';
import { useFloatingViews } from '@/contexts/floating-views-context';
import { NAV_ITEMS } from '@/nav.config';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@shared/unified-auth-utils';
import type { UserForPermissions } from '@shared/types';
import type { NavItem } from '@/nav.types';

interface MultiViewToolbarProps {
  currentSection: string;
  className?: string;
}

const GROUP_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'quick-links': 'Quick Links',
  'workspace': 'Workspace',
  'logistics': 'Logistics',
  'network': 'Network',
  'operations': 'Operations',
  'admin': 'Admin & Resources',
  'help': 'Help',
  'communication': 'Communication',
};

// Build the same list the sidebar shows: permission-filtered, including topNav (Help, Suggestions)
function getGroupedNavItemsForUser(user: unknown): Record<string, NavItem[]> {
  const u = user as { id: string; email?: string | null; role: string; permissions?: string[] | number | null; isActive?: boolean } | null | undefined;
  const userForPermissions: UserForPermissions | null | undefined = u ? {
    id: u.id,
    email: u.email ?? '',
    role: u.role,
    permissions: (u.permissions as string[] | null | undefined) ?? null,
    isActive: u.isActive,
  } : null;

  const permissionFiltered = NAV_ITEMS.filter(item => {
    if (!item.href || item.external) return false;
    if (!item.permission) return true;
    return hasPermission(userForPermissions, item.permission);
  });

  // Hide parents that have no visible children (match SimpleNav behavior)
  const filtered = permissionFiltered.filter(item => {
    if (item.isSubItem) return true;
    const hasChildrenInConfig = NAV_ITEMS.some(navItem => navItem.parentId === item.id);
    if (!hasChildrenInConfig) return true;
    const hasVisibleChildren = permissionFiltered.some(navItem => navItem.parentId === item.id);
    return hasVisibleChildren;
  });

  const groups: Record<string, NavItem[]> = {};
  filtered.forEach(item => {
    const group = item.group || 'other';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
  });

  return groups;
}

export function MultiViewToolbar({ currentSection, className }: MultiViewToolbarProps) {
  const { user } = useAuth();
  const {
    panels,
    addPanel,
    canAddPanel,
    isMultiViewEnabled,
    setMultiViewEnabled,
    splitLayout,
    setSplitLayout,
  } = useMultiView();
  const { openView, views } = useFloatingViews();

  const groupedItems = useMemo(() => getGroupedNavItemsForUser(user), [user]);

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200',
      className
    )}>
      {/* Multi-View Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isMultiViewEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setMultiViewEnabled(!isMultiViewEnabled)}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">
              {isMultiViewEnabled ? 'Multi-View On' : 'Multi-View'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMultiViewEnabled
            ? 'Click to disable multi-view mode'
            : 'Enable multi-view to see multiple sections at once'}
        </TooltipContent>
      </Tooltip>

      {/* Add Panel Dropdown */}
      {isMultiViewEnabled && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!canAddPanel}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Add Panel</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-[400px] overflow-y-auto">
              {Object.entries(groupedItems).map(([group, items]) => (
                <React.Fragment key={group}>
                  <DropdownMenuLabel className="text-xs text-slate-500">
                    {GROUP_LABELS[group] || group}
                  </DropdownMenuLabel>
                  {items.map(item => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => addPanel(item.href, item.label)}
                        disabled={panels.some(p => p.section === item.href)}
                        className="flex items-center gap-2"
                      >
                        {item.customIcon ? (
                          <img src={item.customIcon} alt="" className="h-4 w-4 opacity-60 flex-shrink-0" />
                        ) : Icon ? (
                          <Icon className="h-4 w-4 opacity-60 flex-shrink-0" />
                        ) : null}
                        <span className="truncate">{item.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Layout Toggle */}
          <div className="flex items-center border rounded-md">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={splitLayout === 'horizontal' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-r-none"
                  onClick={() => setSplitLayout('horizontal')}
                >
                  <Columns className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split horizontally (side by side)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={splitLayout === 'vertical' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 w-8 p-0 rounded-l-none"
                  onClick={() => setSplitLayout('vertical')}
                >
                  <Rows className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split vertically (stacked)</TooltipContent>
            </Tooltip>
          </div>

          {/* Panel Count Indicator */}
          <span className="text-xs text-slate-500 hidden sm:inline">
            {panels.length} of 4 panels
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pop-out current view */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const navItem = NAV_ITEMS.find(item => item.href === currentSection);
              const title = navItem?.label || currentSection;
              openView(currentSection, title);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Pop Out</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open current view in a floating window</TooltipContent>
      </Tooltip>

      {/* Floating Windows Indicator */}
      {views.length > 0 && (
        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {views.length} floating {views.length === 1 ? 'window' : 'windows'}
        </span>
      )}
    </div>
  );
}
