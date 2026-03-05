import React, { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Search, X, Filter, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multi-select' | 'tags' | 'date-range';
  options?: FilterOption[];
  placeholder?: string;
}

export interface StandardFilterBarProps {
  // Search configuration
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchSuggestions?: string[];

  // Filter configurations
  filters?: FilterConfig[];
  filterValues?: Record<string, any>;
  onFilterChange?: (filterId: string, value: any) => void;

  // Active filters display
  showActiveFilters?: boolean;
  onClearAll?: () => void;

  // Visual customization
  className?: string;
  compact?: boolean;
}

/**
 * StandardFilterBar - A reusable, consistent filter component for all modules
 *
 * Features:
 * - Search with type-ahead suggestions
 * - Multiple filter types (select, multi-select, tags, date range)
 * - Active filter badges
 * - Clear all functionality
 * - Responsive design
 *
 * @example
 * ```tsx
 * <StandardFilterBar
 *   searchPlaceholder="Search users..."
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   filters={[
 *     { id: 'role', label: 'Role', type: 'select', options: roleOptions },
 *     { id: 'status', label: 'Status', type: 'multi-select', options: statusOptions },
 *     { id: 'dateRange', label: 'Date Range', type: 'date-range' }
 *   ]}
 *   filterValues={filters}
 *   onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
 *   showActiveFilters
 * />
 * ```
 */
export function StandardFilterBar({
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  searchSuggestions = [],
  filters = [],
  filterValues = {},
  onFilterChange,
  showActiveFilters = true,
  onClearAll,
  className,
  compact = false,
}: StandardFilterBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);

  // Filter suggestions based on search value
  const filteredSuggestions = useMemo(() => {
    if (!searchValue || !searchSuggestions.length) return [];
    const query = searchValue.toLowerCase();
    return searchSuggestions
      .filter(s => s.toLowerCase().includes(query) && s.toLowerCase() !== query)
      .slice(0, 5);
  }, [searchValue, searchSuggestions]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    return Object.values(filterValues).filter(v => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object' && v !== null) {
        return Object.values(v).some(val => val !== null && val !== undefined);
      }
      return v !== null && v !== undefined && v !== '';
    }).length;
  }, [filterValues]);

  // Handle search keyboard navigation
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedSuggestion(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedSuggestion(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedSuggestion >= 0) {
          onSearchChange?.(filteredSuggestions[focusedSuggestion]);
          setShowSuggestions(false);
          setFocusedSuggestion(-1);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setFocusedSuggestion(-1);
        break;
    }
  };

  // Render individual filter based on type
  const renderFilter = (filter: FilterConfig) => {
    const value = filterValues[filter.id];

    switch (filter.type) {
      case 'select':
        return (
          <Select
            value={value || '__all__'}
            onValueChange={(val) => onFilterChange?.(filter.id, val === '__all__' ? '' : val)}
          >
            <SelectTrigger className={cn("w-full sm:w-[180px]", compact && "h-9")}>
              <SelectValue placeholder={filter.placeholder || filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All {filter.label}</SelectItem>
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {option.count}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multi-select':
        const selectedValues = (value || []) as string[];
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[180px] justify-between",
                  compact && "h-9",
                  selectedValues.length > 0 && "border-brand-primary"
                )}
              >
                <span className="truncate">
                  {selectedValues.length > 0
                    ? `${filter.label} (${selectedValues.length})`
                    : filter.placeholder || filter.label}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2">
              <div className="space-y-1">
                {filter.options?.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option.value)}
                      onChange={(e) => {
                        const newValues = e.target.checked
                          ? [...selectedValues, option.value]
                          : selectedValues.filter(v => v !== option.value);
                        onFilterChange?.(filter.id, newValues);
                      }}
                      className="rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    <span className="flex-1 text-sm">{option.label}</span>
                    {option.count !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {option.count}
                      </Badge>
                    )}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        );

      case 'tags':
        const selectedTags = (value || []) as string[];
        return (
          <div className="flex flex-wrap gap-1">
            {filter.options?.map((option) => {
              const isSelected = selectedTags.includes(option.value);
              return (
                <Button
                  key={option.value}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={cn("h-7 text-xs", compact && "h-6")}
                  onClick={() => {
                    const newTags = isSelected
                      ? selectedTags.filter(t => t !== option.value)
                      : [...selectedTags, option.value];
                    onFilterChange?.(filter.id, newTags);
                  }}
                >
                  {option.label}
                  {option.count !== undefined && (
                    <Badge variant={isSelected ? "secondary" : "outline"} className="ml-1 text-xs">
                      {option.count}
                    </Badge>
                  )}
                </Button>
              );
            })}
          </div>
        );

      case 'date-range':
        const dateRange = value as { from?: Date; to?: Date } || {};
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-[240px] justify-start text-left font-normal",
                  compact && "h-9",
                  !dateRange.from && "text-muted-foreground",
                  (dateRange.from || dateRange.to) && "border-brand-primary"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} -{" "}
                      {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>{filter.placeholder || 'Pick a date range'}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => onFilterChange?.(filter.id, range)}
                numberOfMonths={2}
              />
              {(dateRange.from || dateRange.to) && (
                <div className="p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => onFilterChange?.(filter.id, {})}
                  >
                    Clear dates
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        );

      default:
        return null;
    }
  };

  // Get active filter labels for display
  const activeFilterLabels = useMemo(() => {
    const labels: { id: string; label: string; value: string }[] = [];

    filters.forEach(filter => {
      const value = filterValues[filter.id];
      if (!value) return;

      if (filter.type === 'select' && value) {
        const option = filter.options?.find(o => o.value === value);
        if (option) {
          labels.push({ id: filter.id, label: filter.label, value: option.label });
        }
      } else if (filter.type === 'multi-select' || filter.type === 'tags') {
        const selectedValues = value as string[];
        if (selectedValues.length > 0) {
          selectedValues.forEach(val => {
            const option = filter.options?.find(o => o.value === val);
            if (option) {
              labels.push({ id: filter.id, label: filter.label, value: option.label });
            }
          });
        }
      } else if (filter.type === 'date-range') {
        const dateRange = value as { from?: Date; to?: Date };
        if (dateRange.from || dateRange.to) {
          const dateStr = dateRange.from && dateRange.to
            ? `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d, yyyy')}`
            : dateRange.from
              ? format(dateRange.from, 'MMM d, yyyy')
              : '';
          labels.push({ id: filter.id, label: filter.label, value: dateStr });
        }
      }
    });

    return labels;
  }, [filters, filterValues]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search and Main Filters Row */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        {/* Search Box */}
        {onSearchChange && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleSearchKeyDown}
              className={cn(
                "pl-9 pr-9 bg-white",
                compact ? "h-9" : "h-10"
              )}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Search Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors",
                      index === focusedSuggestion && "bg-gray-100"
                    )}
                    onClick={() => {
                      onSearchChange(suggestion);
                      setShowSuggestions(false);
                    }}
                  >
                    <Search className="inline w-3 h-3 mr-2 text-gray-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-2">
          {filters.filter(f => f.type !== 'tags').map(filter => (
            <div key={filter.id}>
              {renderFilter(filter)}
            </div>
          ))}

          {/* Clear All Button */}
          {activeFilterCount > 0 && onClearAll && (
            <Button
              variant="ghost"
              size={compact ? "sm" : "default"}
              onClick={onClearAll}
              className={cn("text-gray-600 hover:text-gray-900", compact && "h-9")}
            >
              <X className="w-4 h-4 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Tag Filters Row (if any) */}
      {filters.some(f => f.type === 'tags') && (
        <div className="space-y-2">
          {filters.filter(f => f.type === 'tags').map(filter => (
            <div key={filter.id} className="space-y-1">
              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {filter.label}
              </label>
              {renderFilter(filter)}
            </div>
          ))}
        </div>
      )}

      {/* Active Filters Display */}
      {showActiveFilters && activeFilterLabels.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <span className="text-xs font-medium text-gray-500">Active filters:</span>
          {activeFilterLabels.map((filter, index) => (
            <Badge
              key={`${filter.id}-${index}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="text-xs">
                <span className="font-medium">{filter.label}:</span> {filter.value}
              </span>
              <button
                onClick={() => {
                  // Remove this specific filter value
                  const currentValue = filterValues[filter.id];
                  if (Array.isArray(currentValue)) {
                    const filterConfig = filters.find(f => f.id === filter.id);
                    const option = filterConfig?.options?.find(o => o.label === filter.value);
                    if (option) {
                      const newValues = currentValue.filter(v => v !== option.value);
                      onFilterChange?.(filter.id, newValues);
                    }
                  } else {
                    onFilterChange?.(filter.id, null);
                  }
                }}
                className="hover:bg-gray-300 rounded p-0.5 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
