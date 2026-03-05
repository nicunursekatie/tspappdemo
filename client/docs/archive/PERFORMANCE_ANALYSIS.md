# Performance Analysis Report

## Executive Summary

This report identifies performance anti-patterns, N+1 queries, unnecessary re-renders, and inefficient algorithms in the Sandwich Project Platform codebase. The analysis reveals several critical areas requiring optimization.

---

## 1. N+1 Query Patterns (Critical)

### 1.1 Staff Name Matching - `server/routes/event-requests.ts:327-341`

**Problem**: The `matchStaffNamesToUserIds` function makes sequential database queries inside a loop.

```typescript
// Current (N+1 pattern)
for (const name of names) {
  const userId = await findUserByName(name);  // Each call fetches ALL users
  // ...
}
```

`findUserByName` (line 283-324) fetches ALL active users on every call, then iterates through them. For 5 staff names, this means 5 full table scans.

**Impact**: O(n * m) where n = staff names, m = total users

**Recommendation**:
```typescript
// Batch approach - fetch all users once
const allUsers = await db.select().from(users).where(eq(users.isActive, true));
const userMap = new Map(allUsers.map(u => [u.displayName?.toLowerCase(), u]));
const matchedIds = names.map(name => userMap.get(name.toLowerCase())?.id || name);
```

### 1.2 Cron Job Volunteer Reminders - `server/services/cron-jobs.ts:52-89`

**Problem**: Triple-nested N+1 pattern.

```typescript
for (const event of upcomingEvents) {           // N events
  const volunteers = await db.select()...;       // N queries
  for (const volunteer of volunteers) {          // N * M volunteers
    const [foundUser] = await db.select()...;    // N * M queries
  }
}
```

**Impact**: For 10 events with 5 volunteers each = 10 + 50 = 60 queries instead of 3.

**Recommendation**: Use JOINs or batch queries with `inArray()`:
```typescript
// Batch: Get all events, volunteers, and users in 3 queries
const events = await db.select().from(eventRequests)...;
const eventIds = events.map(e => e.id);
const volunteers = await db.select().from(eventVolunteers)
  .where(inArray(eventVolunteers.eventRequestId, eventIds));
const userIds = volunteers.map(v => v.volunteerUserId).filter(Boolean);
const users = await db.select().from(users).where(inArray(users.id, userIds));
```

### 1.3 Google Sheets Sync - `server/google-sheets-sync.ts:46-61`

**Problem**: Sequential updates and queries in loops.

```typescript
for (const project of projects) {
  const projectTasks = await this.storage.getProjectTasks(project.id);  // N queries
}
for (const project of projects) {
  await this.storage.updateProject(project.id, { ... });  // N updates
}
```

**Impact**: 2N database operations instead of 2.

**Recommendation**: Use `Promise.all` for parallel operations or batch updates.

### 1.4 Assigned Events Endpoint - `server/routes/event-requests.ts:740-741`

**Problem**: Fetches entire tables then filters in memory.

```typescript
const allEventRequests = await storage.getAllEventRequests();  // Could be 1000s of rows
const users = await storage.getAllUsers();                       // Fetches ALL users
const currentUser = users.find((u) => u.id === userId);         // O(n) search
```

**Impact**: Transfers potentially megabytes of data from database when only a few rows are needed.

**Recommendation**: Use database-level filtering:
```typescript
const assignedEvents = await db.select().from(eventRequests)
  .where(or(
    eq(eventRequests.assignedTo, userId),
    eq(eventRequests.tspContact, userId)
  ));
```

### 1.5 Event Details by Org/Contact - `server/routes/event-requests.ts:603-608`

**Problem**: Fetches ALL event requests to find one by organization name.

```typescript
const allEventRequests = await storage.getAllEventRequests();
const eventRequest = allEventRequests.find(
  (request) => request.organizationName === organizationName && ...
);
```

**Recommendation**: Add a proper indexed query method.

---

## 2. React Re-render Issues (High Priority)

### 2.1 Minimal Use of React.memo

**Finding**: Only 2 out of 200+ components use `React.memo`:
- `client/src/components/email-style-messaging.tsx`
- `client/src/components/enhanced-notifications.tsx`

**Impact**: All components re-render on every parent state change.

**Recommendation**: Wrap pure components with `React.memo`:
```typescript
// Before
export function UserCard({ user }: Props) { ... }

// After
export const UserCard = React.memo(function UserCard({ user }: Props) { ... });
```

### 2.2 Inline Arrow Functions in Event Handlers

**Finding**: 50+ occurrences of inline arrow functions in onClick handlers.

```typescript
// Anti-pattern (creates new function on every render)
onClick={() => setShowFilters(!showFilters)}
onClick={() => handleEdit(item)}
onClick={() => handleDownload(logo.filename, logo.name)}
```

**Files with most violations**:
- `client/src/pages/suggestions.tsx`
- `client/src/pages/yearly-calendar.tsx`
- `client/src/components/email-style-messaging.tsx`

**Recommendation**: Use `useCallback` for handlers passed to child components:
```typescript
const handleToggleFilters = useCallback(() => {
  setShowFilters(prev => !prev);
}, []);
```

### 2.3 Missing useMemo for Expensive Computations

**Finding**: Many filter/map chains recalculated on every render:

```typescript
// Anti-pattern - recalculated every render
{tasks.filter((t) => t.status !== 'archived').map((task) => (...))}

// Found in:
// - client/src/pages/project-detail-clean.tsx:1199
// - client/src/components/action-tracking-enhanced.tsx:272-288
// - client/src/components/event-requests/views/ScheduledSpreadsheetView.tsx:265
```

**Recommendation**:
```typescript
const activeTasks = useMemo(() =>
  tasks.filter(t => t.status !== 'archived'),
  [tasks]
);
```

### 2.4 No List Virtualization

**Finding**: No use of react-window, react-virtualized, or similar libraries.

Large lists render all items even when only a few are visible:
- Event requests list (potentially 1000+ items)
- User management (100+ users)
- Audit logs (thousands of entries)

**Impact**: Slow initial render and unnecessary DOM nodes.

**Recommendation**: Implement virtualization for lists > 50 items:
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => <Row item={items[index]} style={style} />}
</FixedSizeList>
```

---

## 3. Inefficient Algorithms (Medium Priority)

### 3.1 O(n) Lookups Instead of O(1) Maps

**Finding**: Using `.find()` on arrays for ID lookups in multiple locations:

```typescript
// O(n) lookup - happens frequently
const currentUser = users.find((u) => u.id === userId);
```

**Files affected**:
- `server/routes/event-requests.ts:742`
- `server/routes/me.ts:287, 367, 427`
- `server/routes/documents.ts:186, 247, 319`
- `server/routes/meetings/index.ts:192, 602`

**Recommendation**: Build Maps for frequent lookups:
```typescript
const userMap = new Map(users.map(u => [u.id, u]));
const currentUser = userMap.get(userId);  // O(1)
```

### 3.2 Nested Filter Operations

**Finding**: 51 files contain nested filter/map operations that could be optimized:

```typescript
// Inefficient - multiple iterations
categories = projects.map(p => p.category).filter(Boolean);
uniqueCategories = [...new Set(categories)];

// Better - single pass
const categorySet = new Set<string>();
for (const project of projects) {
  if (project.category) categorySet.add(project.category);
}
```

### 3.3 String Matching in Loops

**Finding**: Assignment checking uses string.includes() searches:

```typescript
// server/routes/event-requests.ts:754-795
// Checks if user email/name appears in string fields
additionalContacts.includes(userEmail) ||
additionalContacts.includes(userName) ||
driverText.includes(userEmail) ||
speakerText.includes(userFirstName)
```

**Impact**: Multiple O(n*m) string searches per event, per user.

**Recommendation**: Store IDs in proper array/JSONB fields, not comma-separated strings.

---

## 4. Database/Query Optimization Issues

### 4.1 Low Promise.all Usage

**Finding**: Only 36 `Promise.all` occurrences across 25 files vs 113 files with for-await loops.

Many sequential awaits could run in parallel:
```typescript
// Current - sequential (slow)
const projects = await storage.getAllProjects();
const users = await storage.getAllUsers();
const drivers = await storage.getAllDrivers();

// Better - parallel
const [projects, users, drivers] = await Promise.all([
  storage.getAllProjects(),
  storage.getAllUsers(),
  storage.getAllDrivers()
]);
```

### 4.2 Missing Database Indexes

The schema shows some indexes but several commonly-queried fields lack them:
- `eventRequests.assignedTo` (used in filter queries)
- `eventRequests.tspContact` (used in filter queries)
- `eventRequests.status` (used in most list views)

### 4.3 Overly Broad Queries

Several API endpoints fetch entire tables:
- `getAllEventRequests()` - called 8+ times in routes
- `getAllUsers()` - called 12+ times in routes
- `getAllProjects()` - called 6+ times in routes

**Recommendation**: Add filtered query methods:
```typescript
// Instead of: getAllEventRequests() then filter
// Use: getEventRequestsByStatus('scheduled')
// Or: getEventRequestsForUser(userId)
```

---

## 5. React Query Configuration Issues

### 5.1 Inconsistent staleTime Values

**Finding**: staleTime ranges from 0ms to 10 minutes with no clear pattern:

| Component | staleTime |
|-----------|-----------|
| real-time-kudos-notifier | 0 (always stale) |
| performance-dashboard | 15 seconds |
| read-receipts | 30 seconds |
| messaging | 2 minutes |
| projects | 3 minutes |
| default | 5 minutes |
| recipient-selector | 10 minutes |

**Impact**: Inconsistent data freshness and potentially excessive refetching.

**Recommendation**: Establish clear staleTime tiers based on data update frequency.

---

## 6. Priority Recommendations

### Immediate (High Impact, Low Effort)
1. Add `React.memo` to 20 most-used presentational components
2. Batch the staff name matching function (event-requests.ts)
3. Add `Promise.all` to parallel-safe sequential queries

### Short-term (High Impact, Medium Effort)
4. Replace `getAllEventRequests()` with filtered queries
5. Add database indexes for commonly-filtered columns
6. Implement user/event ID Maps for O(1) lookups

### Medium-term (Medium Impact, Higher Effort)
7. Refactor cron-jobs.ts to use batch queries
8. Add react-window for large lists
9. Wrap expensive computations in `useMemo`

### Long-term (Architecture)
10. Consider read replicas for heavy read operations
11. Implement database-level caching (Redis)
12. Add query result pagination for all list endpoints

---

## Summary Statistics

| Category | Count | Severity |
|----------|-------|----------|
| N+1 Query Patterns | 15+ locations | Critical |
| Missing React.memo | 200+ components | High |
| Inline Handler Functions | 50+ occurrences | Medium |
| Missing useMemo | 40+ locations | Medium |
| O(n) Array Lookups | 25+ locations | Medium |
| Sequential vs Parallel Queries | 113 vs 36 files | Medium |

---

*Analysis performed on: December 18, 2025*
*Codebase: Sandwich-Project-Platform-Final*
