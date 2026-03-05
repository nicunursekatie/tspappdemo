# Event Requests Performance Optimization Plan

## Current State Analysis

- ✅ Already lazy-loaded via `lazyWithRetry` in dashboard.tsx
- ✅ Lightweight list endpoint (`/api/event-requests/list`) - 60-80% smaller payload
- ✅ Server-side filtering (days, status, needsAction params)
- ✅ Server-side search endpoint (`/api/event-requests/search`)
- ✅ React Query caching (5 min staleTime)
- ✅ Stale-while-revalidate pattern
- ✅ Quick filter buttons (Needs Driver, This Week, Today)

## Recommended Implementation Order

### Phase 1: Quick Wins ✅ COMPLETE

### Phase 2: Medium Impact ✅ COMPLETE

#### 4. Create Lightweight List Endpoint ✅
- `/api/event-requests/list` endpoint exists and is in use
- Returns only fields needed for list/card display (60-80% smaller payload)
- Frontend uses this endpoint by default via EventRequestContext

#### 5. Server-Side Search ✅
- `/api/event-requests/search` endpoint exists
- Searches across org name, contact, email, phone, address, message
- Frontend currently uses client-side filtering on lightweight data (acceptable for current dataset size)

### Phase 3: Advanced ✅ COMPLETE

#### 6. Background Preloading ✅
- Added prefetch in dashboard.tsx that runs on mount
- Prefetches `/api/event-requests/status-counts` for instant tab badges
- Prefetches `/api/event-requests/list?status=new` for default tab

#### 7. Better Skeleton Loading ✅
- Added comprehensive skeleton loader in event-requests/index.tsx
- Shows animated placeholders for header, tabs, filters, and event cards
- Matches the actual layout for better perceived performance

### Additional Fixes Applied
- Fixed status counts showing 0 until tab was active
- Added `my_assignments` count to server-side `/status-counts` endpoint
- Frontend now relies entirely on server-side counts (no incorrect client-side fallback)

---

### Phase 1 (Original Documentation): Quick Wins ✅ COMPLETE

#### 1. Add Default View Filtering ✅
**Backend:** Modify `/api/event-requests` to accept query params
```typescript
// Accept: ?days=14&status=new,in_process,scheduled&needsAction=true
GET /api/event-requests?days=14&status=new,in_process,scheduled&needsAction=true
```

**Frontend:** Update EventRequestContext to fetch default view first
```typescript
// Default query for "Needs Action" tab
const { data: eventRequests = [], isLoading } = useQuery<EventRequest[]>({
  queryKey: ['/api/event-requests', 'needsAction', 'v2'],
  queryFn: () => apiRequest('/api/event-requests?days=14&needsAction=true'),
  staleTime: 5 * 60 * 1000,
});
```

**Impact:** Reduce initial payload from 500+ events to ~20-50

#### 2. Improve Stale-While-Revalidate ✅
**Frontend:** Use React Query's built-in SWR
```typescript
const { data, isPlaceholderData } = useQuery({
  queryKey: ['/api/event-requests', 'needsAction', 'v2'],
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  placeholderData: (previousData) => previousData, // Show old data while fetching
});
```

**Impact:** Instant UI with background refresh

#### 3. Add Quick Filters (#7)
**Frontend:** Add filter pills in EventRequestsManagement
- "Needs Driver" button → filters to events needing drivers
- "This Week" button → filters to next 7 days
- "Today" button → filters to today's events

**Impact:** Better UX, fewer clicks

### Phase 2: Medium Impact (3-4 days)

#### 4. Create Lightweight List Endpoint (#6)
**Backend:** New endpoint `/api/event-requests/list`
```typescript
// Returns only fields needed for list view:
// - id, organizationName, status, dates, basic counts
// - NO: notes, attachments, full contact threads, audit logs
GET /api/event-requests/list?days=14&status=new,in_process,scheduled
```

**Frontend:** Use lightweight endpoint for list, full endpoint for detail view
```typescript
// List view uses lightweight
const { data: events = [] } = useQuery({
  queryKey: ['/api/event-requests/list', filters],
});

// Detail view fetches full data when opening
const { data: fullEvent } = useQuery({
  queryKey: ['/api/event-requests', eventId],
  enabled: !!selectedEventId,
});
```

**Impact:** Reduce payload by 60-80%

#### 5. Server-Side Search (#5)
**Backend:** Add search endpoint
```typescript
GET /api/event-requests/search?q=term&fields=orgName,address,contact,eventId
```

**Frontend:** Use search endpoint instead of client-side filtering
```typescript
const { data: searchResults } = useQuery({
  queryKey: ['/api/event-requests/search', searchQuery],
  enabled: searchQuery.length > 2,
});
```

**Impact:** Fast searches without loading everything

### Phase 3: Advanced (Optional, 2-3 days)

#### 6. Background Preloading (#4)
**Frontend:** Prefetch on dashboard load
```typescript
// In Dashboard component
useEffect(() => {
  // Prefetch "Needs Action" events when dashboard loads
  queryClient.prefetchQuery({
    queryKey: ['/api/event-requests', 'needsAction', 'v2'],
    queryFn: () => apiRequest('/api/event-requests?days=14&needsAction=true'),
    staleTime: 5 * 60 * 1000,
  });
}, []);
```

**Impact:** Events appear instant when clicked

#### 7. Better Skeleton Loading (#1)
**Frontend:** Add skeleton loaders
- Skeleton for event cards
- Skeleton for filters
- Progressive loading states

**Impact:** Better perceived performance

## Implementation Notes

### Backend Changes Required

1. **Modify `server/routes/event-requests.ts`**
   - Add query parameter parsing for `days`, `status`, `needsAction`
   - Filter events server-side before returning
   - Create lightweight list endpoint
   - Create search endpoint

2. **Modify `server/database-storage.ts`**
   - Add methods for filtered queries
   - Optimize queries with proper indexes

### Frontend Changes Required

1. **Modify `client/src/components/event-requests/context/EventRequestContext.tsx`**
   - Update query keys to include filter params
   - Add separate queries for list vs detail

2. **Modify `client/src/components/event-requests/index.tsx`**
   - Add quick filter buttons
   - Update to use lightweight endpoint for list

3. **Add skeleton loaders**
   - Create `EventCardSkeleton.tsx`
   - Add to list view during loading

## Expected Performance Improvements

- **Initial Load Time:** 3-5 seconds → 0.5-1 second (80% improvement)
- **Payload Size:** 500KB+ → 50-100KB (80% reduction)
- **Search Speed:** 2-3 seconds → 0.3-0.5 seconds (85% improvement)
- **User Experience:** Instant with background refresh

## Testing Strategy

1. Test with 500+ events in database
2. Measure payload sizes before/after
3. Test cache behavior (stale-while-revalidate)
4. Test search performance
5. Test on slow network (3G throttling)

## Rollout Plan

1. **Week 1:** Implement Phase 1 (Quick Wins)
2. **Week 2:** Implement Phase 2 (Medium Impact)
3. **Week 3:** Implement Phase 3 (Advanced) + Testing
4. **Week 4:** Monitor and optimize based on real usage

