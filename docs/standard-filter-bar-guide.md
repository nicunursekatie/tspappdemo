# StandardFilterBar Implementation Guide

## Overview

The `StandardFilterBar` is a reusable, consistent filter component designed to provide a uniform filtering experience across all modules in the application.

## Features

✅ **Search with Type-Ahead**: Real-time search with keyboard navigation
✅ **Multiple Filter Types**: Select, multi-select, tags, date range
✅ **Active Filter Display**: Visual badges showing current filters
✅ **Clear All**: Quick reset of all filters
✅ **Responsive Design**: Works on mobile and desktop
✅ **Keyboard Navigation**: Arrow keys, Enter, Escape support
✅ **Result Counts**: Show item counts for each filter option

## Filter Types

### 1. Select (Single Choice)
- Single selection dropdown
- Good for: Role, Status, Category
- Shows "All [Label]" option by default

### 2. Multi-Select (Multiple Choice)
- Checkbox-based multi-selection
- Good for: Status (multiple), Tags, Categories
- Shows count of selected items

### 3. Tags (Visual Toggles)
- Button-based toggles
- Good for: Quick filters, Categories
- Visual and easy to scan

### 4. Date Range
- Calendar picker with range selection
- Good for: Created date, Event date, Date range filters
- Shows formatted date range

## Basic Implementation

```tsx
import { StandardFilterBar } from '@/components/ui/standard-filter-bar';

function MyModule() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    role: '',
    status: [],
    dateRange: {},
  });

  return (
    <StandardFilterBar
      // Search configuration
      searchPlaceholder="Search users..."
      searchValue={search}
      onSearchChange={setSearch}
      searchSuggestions={['John Doe', 'Jane Smith', 'Admin Users']}

      // Filters configuration
      filters={[
        {
          id: 'role',
          label: 'Role',
          type: 'select',
          options: [
            { value: 'admin', label: 'Admin', count: 5 },
            { value: 'user', label: 'User', count: 120 },
          ],
        },
        {
          id: 'status',
          label: 'Status',
          type: 'multi-select',
          options: [
            { value: 'active', label: 'Active', count: 100 },
            { value: 'inactive', label: 'Inactive', count: 25 },
          ],
        },
        {
          id: 'dateRange',
          label: 'Date Range',
          type: 'date-range',
          placeholder: 'Select date range',
        },
      ]}
      filterValues={filters}
      onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}

      // Display options
      showActiveFilters
      onClearAll={() => {
        setSearch('');
        setFilters({ role: '', status: [], dateRange: {} });
      }}
    />
  );
}
```

## Real-World Examples

### User Management Module

```tsx
const [search, setSearch] = useState('');
const [filters, setFilters] = useState({
  role: '',
  status: [],
  permissions: [],
});

const roleOptions = [
  { value: 'admin', label: 'Admin', count: 5 },
  { value: 'host', label: 'Host', count: 45 },
  { value: 'driver', label: 'Driver', count: 30 },
  { value: 'volunteer', label: 'Volunteer', count: 150 },
];

const statusOptions = [
  { value: 'active', label: 'Active', count: 200 },
  { value: 'inactive', label: 'Inactive', count: 30 },
];

<StandardFilterBar
  searchPlaceholder="Search by name, email, or phone..."
  searchValue={search}
  onSearchChange={setSearch}
  filters={[
    { id: 'role', label: 'Role', type: 'select', options: roleOptions },
    { id: 'status', label: 'Status', type: 'multi-select', options: statusOptions },
  ]}
  filterValues={filters}
  onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
  showActiveFilters
  onClearAll={() => {
    setSearch('');
    setFilters({ role: '', status: [], permissions: [] });
  }}
/>
```

### Groups Catalog

```tsx
const [search, setSearch] = useState('');
const [filters, setFilters] = useState({
  category: '',
  eventStatus: [],
  tags: [],
  dateRange: {},
});

<StandardFilterBar
  searchPlaceholder="Search organizations..."
  searchValue={search}
  onSearchChange={setSearch}
  filters={[
    {
      id: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'church', label: 'Church', count: 45 },
        { value: 'school', label: 'School', count: 67 },
        { value: 'corporate', label: 'Corporate', count: 23 },
      ],
    },
    {
      id: 'eventStatus',
      label: 'Event Status',
      type: 'multi-select',
      options: [
        { value: 'scheduled', label: 'Scheduled', count: 12 },
        { value: 'completed', label: 'Completed', count: 89 },
        { value: 'pending', label: 'Pending', count: 8 },
      ],
    },
    {
      id: 'tags',
      label: 'Quick Filters',
      type: 'tags',
      options: [
        { value: 'previousHost', label: 'Previous Host', count: 56 },
        { value: 'newOrg', label: 'New Organization', count: 12 },
        { value: 'recurring', label: 'Recurring', count: 23 },
      ],
    },
    {
      id: 'dateRange',
      label: 'Last Event Date',
      type: 'date-range',
    },
  ]}
  filterValues={filters}
  onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
  showActiveFilters
  onClearAll={() => {
    setSearch('');
    setFilters({ category: '', eventStatus: [], tags: [], dateRange: {} });
  }}
/>
```

### Collections Log

```tsx
const [search, setSearch] = useState('');
const [filters, setFilters] = useState({
  eventType: '',
  sandwichRange: '',
  dateRange: {},
});

<StandardFilterBar
  searchPlaceholder="Search by organization or event..."
  searchValue={search}
  onSearchChange={setSearch}
  filters={[
    {
      id: 'eventType',
      label: 'Event Type',
      type: 'select',
      options: [
        { value: 'group', label: 'Group Event', count: 234 },
        { value: 'individual', label: 'Individual', count: 567 },
      ],
    },
    {
      id: 'sandwichRange',
      label: 'Sandwich Count',
      type: 'select',
      options: [
        { value: '0-100', label: '0-100', count: 123 },
        { value: '100-500', label: '100-500', count: 345 },
        { value: '500+', label: '500+', count: 67 },
      ],
    },
    {
      id: 'dateRange',
      label: 'Collection Date',
      type: 'date-range',
    },
  ]}
  filterValues={filters}
  onFilterChange={(id, value) => setFilters({ ...filters, [id]: value })}
  showActiveFilters
  onClearAll={() => {
    setSearch('');
    setFilters({ eventType: '', sandwichRange: '', dateRange: {} });
  }}
/>
```

## Applying Filters to Data

```tsx
// Combine all filters to filter your data
const filteredData = useMemo(() => {
  let result = [...originalData];

  // Apply search
  if (search) {
    const query = search.toLowerCase();
    result = result.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.email.toLowerCase().includes(query)
    );
  }

  // Apply role filter
  if (filters.role) {
    result = result.filter(item => item.role === filters.role);
  }

  // Apply multi-select status filter
  if (filters.status.length > 0) {
    result = result.filter(item => filters.status.includes(item.status));
  }

  // Apply date range filter
  if (filters.dateRange.from) {
    result = result.filter(item => {
      const itemDate = new Date(item.createdAt);
      return itemDate >= filters.dateRange.from! &&
             (!filters.dateRange.to || itemDate <= filters.dateRange.to);
    });
  }

  return result;
}, [originalData, search, filters]);
```

## Best Practices

### 1. Always Show Result Counts
```tsx
options: [
  { value: 'active', label: 'Active', count: activeUsers.length },
  { value: 'inactive', label: 'Inactive', count: inactiveUsers.length },
]
```

### 2. Provide Clear Placeholders
```tsx
searchPlaceholder="Search by name, email, or phone..."
```

### 3. Use Appropriate Filter Types
- **Select**: When only one option makes sense (e.g., sort order, single category)
- **Multi-Select**: When multiple selections are common (e.g., status filters)
- **Tags**: For quick toggles and frequently used filters
- **Date Range**: For any date-based filtering

### 4. Group Related Filters
Put related filters near each other in the filters array.

### 5. Persist Filter State
Consider using URL params or localStorage to persist filters:

```tsx
// URL params
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (filters.role) params.set('role', filters.role);
  setSearchParams(params);
}, [search, filters]);
```

## Styling and Customization

### Compact Mode
```tsx
<StandardFilterBar compact />
```

### Custom Class
```tsx
<StandardFilterBar className="bg-gray-50 p-4 rounded-lg" />
```

## Performance Tips

1. **Memoize filter options** if they're computed
2. **Debounce search** for large datasets
3. **Use useMemo** for filtered results
4. **Paginate results** after filtering

## Modules to Implement

Priority list for implementing StandardFilterBar:

### High Priority
1. ✅ User Management
2. ✅ Groups Catalog
3. ✅ Collections Log
4. Event Requests
5. Hosts Management
6. Drivers Management

### Medium Priority
7. Recipients Management
8. Volunteers Management
9. Document Management
10. Analytics

### Low Priority (already have some filtering)
11. Projects
12. Meetings
13. Work Log

## Migration Checklist

When adding StandardFilterBar to an existing module:

- [ ] Identify current filter state
- [ ] Define filter configurations
- [ ] Replace old filter UI with StandardFilterBar
- [ ] Update filtering logic to use new filter values
- [ ] Add result counts to filter options
- [ ] Test all filter combinations
- [ ] Remove old filter code
- [ ] Update documentation

## Support

For questions or issues with StandardFilterBar, contact the development team or open an issue.
