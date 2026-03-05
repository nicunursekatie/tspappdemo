# Event Requests Lazy Loading Optimization Plan

## Current Behavior (Problem)
- **Server-side**: `/api/event-requests/list` calls `storage.getAllEventRequests()` which loads ALL 1147 rows from the database, then filters in JavaScript
- **Client-side**: On initial page load with default tab "new", the query includes `?status=new` but the server still loads everything first
- Result: ~1000+ unnecessary rows fetched from database on every request

## Proposed Solution

### Overview
1. **Initial page load**: Only fetch events with `status IN ('new', 'in_process', 'scheduled')` - about 44 rows
2. **Lazy load completed/archived**: When user clicks "Completed", "Declined", or "Postponed" tabs, THEN fetch those events
3. **Status counts**: Keep the existing `/api/event-requests/status-counts` endpoint as-is (just counts, not full records)

### Implementation Steps

---

### Step 1: Add Database-Level Status Filtering to Storage Layer

**File**: `server/database-storage.ts`

Add a new method that accepts a status filter:

```typescript
async getEventRequestsByStatuses(statuses: string[]): Promise<EventRequest[]> {
  const results = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        isNull(eventRequests.deletedAt),
        inArray(eventRequests.status, statuses)
      )
    )
    .orderBy(desc(eventRequests.createdAt));

  return results;
}
```

Also add to:
- `server/storage.ts` (IStorage interface)
- `server/storage-wrapper.ts` (wrapper implementation)

---

### Step 2: Update `/api/event-requests/list` Endpoint

**File**: `server/routes/event-requests.ts` (around line 1218)

Change from:
```typescript
let eventRequests = await storage.getAllEventRequests();
// ... then filter in JS
```

To:
```typescript
// If status filter provided, use database-level filtering
if (statusParam && statusParam !== 'all') {
  const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
  eventRequests = await storage.getEventRequestsByStatuses(statuses);
} else {
  // Fallback for "all" - still loads everything
  eventRequests = await storage.getAllEventRequests();
}
// Continue with other filters (days, needsDriver, etc.) in JS
```

---

### Step 3: Update Client Query Strategy

**File**: `client/src/components/event-requests/lib/eventRequestsListQuery.ts`

Change the "all" tab behavior to NOT fetch everything:

```typescript
// Current (line 63-64):
// For "all", "my_assignments", admin_overview, planning, etc: fetch unfiltered list
return {};

// New approach - for initial load, use active statuses only:
if (activeTab === 'all' || activeTab === 'my_assignments' ||
    activeTab === 'admin_overview' || activeTab === 'planning') {
  // Load only active events by default (new, in_process, scheduled)
  return { status: 'new,in_process,scheduled' };
}
```

---

### Step 4: Ensure Completed Tab Lazy Loads Properly

The current code already handles this correctly (lines 59-61):
```typescript
if (['completed', 'declined', 'postponed'].includes(activeTab)) {
  return { status: activeTab };
}
```

When user clicks "Completed" tab, it will request `?status=completed` which will now filter at the database level.

---

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| Initial page load (new tab) | ~1147 rows from DB | ~5-10 rows |
| Switch to "Scheduled" tab | ~1147 rows from DB | ~20-30 rows |
| Switch to "Completed" tab | ~1147 rows from DB | ~1000+ rows (lazy) |
| "All" tab / admin views | ~1147 rows from DB | ~44 rows (active only) |

## Files to Modify

1. `server/storage.ts` - Add interface method
2. `server/database-storage.ts` - Add implementation
3. `server/storage-wrapper.ts` - Add wrapper
4. `server/routes/event-requests.ts` - Use new method in /list endpoint
5. `client/src/components/event-requests/lib/eventRequestsListQuery.ts` - Update "all" tab behavior

## Risks & Considerations

1. **"All" tab behavior change**: Users clicking "All" will now only see active events (new/in_process/scheduled). This is intentional per requirements, but worth noting.

2. **My Assignments tab**: Currently shows events across all statuses where user is assigned. With this change, it will only show active events. May need to adjust if users want to see their past completed assignments.

3. **Admin Overview / Planning tabs**: Same as above - will only show active events.

4. **Query caching**: TanStack Query will cache each status combination separately, which is good - switching back to a tab won't refetch if cache is still valid.

## Questions for User

1. For the "All" tab - should it show ALL events (including completed) or just active events? Current plan shows only active.

2. For "My Assignments" - should users see their completed past assignments, or only active ones?
