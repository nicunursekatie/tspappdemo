# Data Fetching Pattern Guide

This document describes the standardized data fetching and mutation pattern used throughout the Sandwich Project Platform. Following this pattern ensures:

- **Consistent UI updates** after data changes
- **Proper loading and error states**
- **Automatic cache invalidation**
- **Predictable user feedback via toasts**

---

## Core Principles

1. **Use React Query for all data operations**
   - Queries (`useQuery`) for reading data
   - Mutations (`useMutation`) for creating, updating, or deleting data

2. **Centralized cache invalidation**
   - Use `invalidateEventRequestQueries(queryClient)` after mutations
   - Never rely on callback chains (`onUpdate?.()`) for cache updates

3. **Standardized user feedback**
   - Show toast notifications for success and error states
   - Use `isPending` for loading indicators

4. **Shared mutation hooks**
   - Put reusable mutations in hooks like `useEventMutations`
   - Single-use mutations can be defined locally if they follow the pattern

---

## Pattern: Queries (Reading Data)

```tsx
import { useQuery } from '@tanstack/react-query';

// Standard query pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/event-requests', params],  // Unique key for caching
  queryFn: async () => {
    const response = await fetch('/api/event-requests', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },
  staleTime: 5 * 60 * 1000,  // 5 minutes
  gcTime: 10 * 60 * 1000,    // 10 minutes cache
});
```

### Key Points:
- Always include `credentials: 'include'` for authenticated requests
- Use consistent query keys that match the API path
- Set appropriate `staleTime` for your use case

---

## Pattern: Mutations (Writing Data)

### Option 1: Shared Mutation Hook (Preferred for reusable mutations)

```tsx
// hooks/useEventMutations.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

export function useEventMutations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/event-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Event updated',
        description: 'Changes saved successfully.',
      });
      invalidateEventRequestQueries(queryClient);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update event.',
        variant: 'destructive',
      });
    },
  });

  return { updateEventMutation };
}
```

Usage in component:
```tsx
function MyComponent() {
  const { updateEventMutation } = useEventMutations();

  const handleSave = () => {
    updateEventMutation.mutate(
      { id: eventId, data: formData },
      {
        onSuccess: () => {
          // Optional: additional UI updates specific to this component
          setDialogOpen(false);
        },
      }
    );
  };

  return (
    <Button
      onClick={handleSave}
      disabled={updateEventMutation.isPending}
    >
      {updateEventMutation.isPending ? 'Saving...' : 'Save'}
    </Button>
  );
}
```

### Option 2: Local Mutation (For single-use mutations)

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

function MyComponent({ eventId }: { eventId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleConfirmMutation = useMutation({
    mutationFn: async (confirmed: boolean) => {
      const response = await fetch(`/api/event-requests/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isConfirmed: confirmed }),
      });
      if (!response.ok) throw new Error('Failed to update');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Confirmation updated' });
      invalidateEventRequestQueries(queryClient);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update confirmation.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Button
      onClick={() => toggleConfirmMutation.mutate(true)}
      disabled={toggleConfirmMutation.isPending}
    >
      Confirm
    </Button>
  );
}
```

---

## Cache Invalidation

### Event Requests

Always use the centralized invalidation function:

```tsx
import { invalidateEventRequestQueries } from '@/lib/queryClient';

// After any event request mutation
invalidateEventRequestQueries(queryClient);
```

This function invalidates all queries that start with `/api/event-requests`, including:
- `/api/event-requests` (main list)
- `/api/event-requests/list` (lightweight list)
- `/api/event-requests/status-counts` (tab badges)
- `/api/event-requests/{id}` (individual events)

### Other Resources

For other data types, use React Query's built-in invalidation:

```tsx
// Invalidate specific query
queryClient.invalidateQueries({ queryKey: ['/api/collections'] });

// Invalidate all queries matching a prefix
queryClient.invalidateQueries({
  predicate: (query) => {
    const key = query.queryKey;
    if (!Array.isArray(key) || typeof key[0] !== 'string') return false;
    return key[0].startsWith('/api/collections');
  },
});
```

---

## Anti-Patterns (DON'T DO THIS)

### ❌ Direct fetch without React Query

```tsx
// BAD: No caching, no loading states, manual refresh needed
const handleSave = async () => {
  await fetch(`/api/event-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  onUpdate?.();  // ❌ Callback-based refresh
};
```

### ❌ Callback-based updates

```tsx
// BAD: Relies on parent to refresh data
interface Props {
  onUpdate?: () => void;  // ❌ Don't pass refresh callbacks
}

const handleSave = async () => {
  await saveData();
  onUpdate?.();  // ❌ Inconsistent, error-prone
};
```

### ❌ Manual state updates instead of cache invalidation

```tsx
// BAD: Trying to manually update state instead of invalidating
const handleSave = async () => {
  const result = await saveData();
  setEvents(prev => prev.map(e => e.id === result.id ? result : e));  // ❌ Fragile
};
```

---

## Existing Mutation Hooks

### `useEventMutations` (event-requests/hooks/useEventMutations.tsx)

| Mutation | Description |
|----------|-------------|
| `deleteEventRequestMutation` | Delete an event request (with undo) |
| `updateEventRequestMutation` | Update event request fields |
| `createEventRequestMutation` | Create new event request |
| `markToolkitSentMutation` | Mark toolkit as sent |
| `scheduleCallMutation` | Schedule a follow-up call |
| `updateScheduledFieldMutation` | Update single field (optimistic) |
| `oneDayFollowUpMutation` | Mark 1-day follow-up complete |
| `oneMonthFollowUpMutation` | Mark 1-month follow-up complete |
| `rescheduleEventMutation` | Change event date |
| `assignRecipientsMutation` | Assign recipients to event |
| `assignTspContactMutation` | Assign TSP contact |

### `usePreEventFlagMutations` (event-requests/hooks/usePreEventFlagMutations.tsx)

| Mutation | Description |
|----------|-------------|
| `addFlagMutation` | Add a pre-event flag |
| `resolveFlagMutation` | Mark a flag as resolved |

---

## Checklist for New Mutations

When adding a new mutation, ensure:

- [ ] Uses `useMutation` from React Query
- [ ] Calls appropriate invalidation function on success
- [ ] Shows success toast on `onSuccess`
- [ ] Shows error toast on `onError` with `variant: 'destructive'`
- [ ] Uses `isPending` for loading states in UI
- [ ] Includes `credentials: 'include'` for authenticated requests
- [ ] Throws on non-OK responses

---

## Migration Guide

If you find a component using the old pattern:

1. Remove `onUpdate` prop if it only exists for cache refresh
2. Replace direct `fetch()` calls with `useMutation`
3. Add `invalidateEventRequestQueries(queryClient)` in `onSuccess`
4. Move toast calls to the mutation's `onSuccess`/`onError` handlers
5. Replace manual loading state with `mutation.isPending`

Example migration:

```tsx
// BEFORE
const handleSave = async () => {
  setIsLoading(true);
  try {
    await fetch(`/api/event/${id}`, { method: 'PATCH', body: data });
    toast({ title: 'Saved' });
    onUpdate?.();
  } catch (e) {
    toast({ title: 'Error', variant: 'destructive' });
  } finally {
    setIsLoading(false);
  }
};

// AFTER
const saveMutation = useMutation({
  mutationFn: async () => {
    const res = await fetch(`/api/event/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      body: data
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },
  onSuccess: () => {
    toast({ title: 'Saved' });
    invalidateEventRequestQueries(queryClient);
  },
  onError: () => {
    toast({ title: 'Error', variant: 'destructive' });
  },
});

const handleSave = () => saveMutation.mutate();
// Use saveMutation.isPending for loading state
```
