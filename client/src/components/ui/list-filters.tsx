import * as React from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface FilterOption {
  /** Unique identifier used for filtering logic */
  id: string;
  /** Display label shown to users */
  label: string;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface ListFiltersProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterGroups?: FilterGroup[];
  activeFilters?: Record<string, string[]>;
  onFilterChange?: (groupId: string, optionId: string, checked: boolean) => void;
  onClearFilters?: () => void;
  className?: string;
}

/**
 * Reusable filter and search component for list views
 */
export function ListFilters({
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  filterGroups = [],
  activeFilters = {},
  onFilterChange,
  onClearFilters,
  className,
}: ListFiltersProps) {
  const activeFilterCount = Object.values(activeFilters).reduce(
    (sum, filters) => sum + filters.length,
    0
  );

  return (
    <div className={cn('flex flex-col sm:flex-row gap-3', className)}>
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Search"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onSearchChange?.('')}
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Dropdown */}
      {filterGroups.length > 0 && (
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {filterGroups.map((group, index) => (
                <React.Fragment key={group.id}>
                  {index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.options.map((option) => {
                    const isChecked = activeFilters[group.id]?.includes(
                      option.id
                    );
                    return (
                      <DropdownMenuCheckboxItem
                        key={option.id}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          onFilterChange?.(group.id, option.id, checked)
                        }
                      >
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </React.Fragment>
              ))}
              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearFilters}
                      className="w-full justify-center"
                    >
                      Clear all filters
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

/**
 * Display active filter tags
 */
export interface ActiveFilterTagsProps {
  filterGroups: FilterGroup[];
  activeFilters: Record<string, string[]>;
  onRemoveFilter: (groupId: string, optionId: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ActiveFilterTags({
  filterGroups,
  activeFilters,
  onRemoveFilter,
  onClearAll,
  className,
}: ActiveFilterTagsProps) {
  const activeFilterCount = Object.values(activeFilters).reduce(
    (sum, filters) => sum + filters.length,
    0
  );

  if (activeFilterCount === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">Filters:</span>
      {filterGroups.map((group) => {
        const activeOptions = activeFilters[group.id] || [];
        return activeOptions.map((optionId) => {
          const option = group.options.find((opt) => opt.id === optionId);
          if (!option) return null;

          return (
            <Badge
              key={`${group.id}-${optionId}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              {option.label}
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => onRemoveFilter(group.id, optionId)}
                aria-label={`Remove ${option.label} filter`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          );
        });
      })}
      {activeFilterCount > 1 && onClearAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-7 px-2 text-xs"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
