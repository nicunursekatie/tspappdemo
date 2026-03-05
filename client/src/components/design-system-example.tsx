/**
 * Design System Example Component
 *
 * This component demonstrates proper usage of the design system including:
 * - Consistent spacing and layout
 * - Proper color usage
 * - Accessible components
 * - Responsive design
 * - Date formatting
 * - Empty states
 * - Filter/search functionality
 */

import { useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ListFilters, ActiveFilterTags } from '@/components/ui/list-filters';
import { LoadingState, CardSkeleton } from '@/components/ui/loading';
import {
  formatRelativeDate,
  formatRelativeDateTime,
  formatTimeAgo,
} from '@/lib/date-formats';
import {
  getIconButtonLabel,
  getStatusAriaLabel,
  announceToScreenReader,
} from '@/lib/accessibility';
import { useIsMobileScreen, useResponsiveColumns } from '@/lib/responsive-utils';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';

interface Item {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  date: Date;
  category: string;
}

const SAMPLE_ITEMS: Item[] = [
  {
    id: '1',
    title: 'Event Planning Meeting',
    description: 'Discuss upcoming community event logistics',
    status: 'in-progress',
    date: new Date(Date.now() - 86400000), // Yesterday
    category: 'meetings',
  },
  {
    id: '2',
    title: 'Food Drive Coordination',
    description: 'Coordinate with local partners for food drive',
    status: 'completed',
    date: new Date(Date.now() - 172800000), // 2 days ago
    category: 'events',
  },
  {
    id: '3',
    title: 'Volunteer Training',
    description: 'Train new volunteers on safety procedures',
    status: 'pending',
    date: new Date(Date.now() + 86400000), // Tomorrow
    category: 'training',
  },
];

const FILTER_GROUPS = [
  {
    id: 'status',
    label: 'Status',
    options: [
      { id: 'pending', label: 'Pending' },
      { id: 'in-progress', label: 'In Progress' },
      { id: 'completed', label: 'Completed' },
      { id: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    id: 'category',
    label: 'Category',
    options: [
      { id: 'meetings', label: 'Meetings' },
      { id: 'events', label: 'Events' },
      { id: 'training', label: 'Training' },
    ],
  },
];

export function DesignSystemExample() {
  const [items, setItems] = useState<Item[]>(SAMPLE_ITEMS);
  const [isLoading, setIsLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );

  const isMobile = useIsMobileScreen();
  const columns = useResponsiveColumns({
    mobile: 1,
    tablet: 2,
    desktop: 3,
  });

  // Filter items based on search and active filters
  const filteredItems = items.filter((item) => {
    // Search filter
    const matchesSearch =
      searchValue === '' ||
      item.title.toLowerCase().includes(searchValue.toLowerCase()) ||
      item.description.toLowerCase().includes(searchValue.toLowerCase());

    // Status filter
    const statusFilters = activeFilters.status || [];
    const matchesStatus =
      statusFilters.length === 0 || statusFilters.includes(item.status);

    // Category filter
    const categoryFilters = activeFilters.category || [];
    const matchesCategory =
      categoryFilters.length === 0 || categoryFilters.includes(item.category);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleFilterChange = (
    groupId: string,
    optionId: string,
    checked: boolean
  ) => {
    setActiveFilters((prev) => {
      const groupFilters = prev[groupId] || [];
      const newFilters = checked
        ? [...groupFilters, optionId]
        : groupFilters.filter((id) => id !== optionId);

      return {
        ...prev,
        [groupId]: newFilters,
      };
    });
  };

  const handleRemoveFilter = (groupId: string, optionId: string) => {
    setActiveFilters((prev) => {
      const groupFilters = prev[groupId] || [];
      return {
        ...prev,
        [groupId]: groupFilters.filter((id) => id !== optionId),
      };
    });
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    announceToScreenReader('All filters cleared', 'polite');
  };

  const handleCreateItem = () => {
    // Simulate creating a new item
    announceToScreenReader('Creating new item', 'polite');
    console.log('Create new item');
  };

  const handleEditItem = (id: string) => {
    announceToScreenReader('Editing item', 'polite');
    console.log('Edit item:', id);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    announceToScreenReader('Item deleted', 'polite');
  };

  const getStatusVariant = (
    status: string
  ): 'pending' | 'in-progress' | 'completed' | 'cancelled' => {
    return status as 'pending' | 'in-progress' | 'completed' | 'cancelled';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Design System Example
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Demonstrating consistent design patterns and components
          </p>
        </div>
        <Button
          onClick={handleCreateItem}
          className="w-full sm:w-auto"
          aria-label={getIconButtonLabel('add', 'new item')}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Item
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <ListFilters
            searchPlaceholder="Search items..."
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filterGroups={FILTER_GROUPS}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
          />

          {Object.values(activeFilters).some((f) => f.length > 0) && (
            <div className="mt-4">
              <ActiveFilterTags
                filterGroups={FILTER_GROUPS}
                activeFilters={activeFilters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearFilters}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <EmptyState
          icon={<Calendar className="h-12 w-12" />}
          title="No items found"
          description={
            searchValue || Object.values(activeFilters).some((f) => f.length > 0)
              ? 'Try adjusting your search or filters to find what you\'re looking for.'
              : 'Get started by creating your first item using the button above.'
          }
          action={
            searchValue || Object.values(activeFilters).some((f) => f.length > 0)
              ? {
                  label: 'Clear Filters',
                  onClick: handleClearFilters,
                }
              : {
                  label: 'Create Item',
                  onClick: handleCreateItem,
                }
          }
          secondaryAction={
            searchValue || Object.values(activeFilters).some((f) => f.length > 0)
              ? {
                  label: 'Create New Item',
                  onClick: handleCreateItem,
                  variant: 'outline',
                }
              : undefined
          }
        />
      )}

      {/* Items Grid */}
      {filteredItems.length > 0 && (
        <div
          className={`grid gap-4 md:gap-6`}
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {filteredItems.map((item) => (
            <Card key={item.id} className="card-elevated hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base md:text-lg truncate">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">
                      {item.description}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={getStatusVariant(item.status)}
                    aria-label={getStatusAriaLabel(item.status)}
                  >
                    {item.status.replace('-', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {/* Date Information */}
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{formatRelativeDate(item.date)}</span>
                    </div>
                    <div className="mt-1 text-xs">
                      {formatTimeAgo(item.date)}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditItem(item.id)}
                      className="flex-1 focus-ring"
                      aria-label={getIconButtonLabel('edit', item.title)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                      className="flex-1 focus-ring-destructive"
                      aria-label={getIconButtonLabel('delete', item.title)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Design System Features</CardTitle>
          <CardDescription className="text-blue-700">
            This example demonstrates:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Responsive:</span>
              <span>Adapts from mobile to desktop seamlessly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Accessible:</span>
              <span>ARIA labels, keyboard navigation, screen reader support</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Consistent:</span>
              <span>Uses design tokens for colors, spacing, and typography</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Date Formatting:</span>
              <span>Standardized date display throughout</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Empty States:</span>
              <span>Helpful guidance when no data is available</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold min-w-[140px]">✓ Filters:</span>
              <span>Reusable search and filter components</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
