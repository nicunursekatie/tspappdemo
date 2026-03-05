# Event Request API Call Audit

**Date:** December 26, 2024
**Finding:** 30+ API calls on page load

---

## Context Level Queries (Always load on page entry)

| File | Line | Endpoint | Query Key | Purpose |
|------|------|----------|-----------|---------|
| EventRequestContext.tsx | 261 | `/api/event-requests/list` | Dynamic based on filters | Main event list |
| EventRequestContext.tsx | 285 | `/api/event-requests/status-counts` | `/api/event-requests/status-counts` | Tab badge counts |
| EventRequestContext.tsx | 309 | `/api/event-requests/my-volunteers` | `/api/event-requests/my-volunteers` | User's volunteer assignments |

---

## Helper Hook - useEventQueries (7 queries)

| File | Line | Endpoint | Query Key |
|------|------|----------|-----------|
| useEventQueries.ts | 5 | `/api/users/basic` | `/api/users/basic` |
| useEventQueries.ts | 10 | `/api/users/for-assignments` | `/api/users/for-assignments` |
| useEventQueries.ts | 15 | `/api/drivers` | `/api/drivers` |
| useEventQueries.ts | 19 | `/api/hosts` | `/api/hosts` |
| useEventQueries.ts | 23 | `/api/hosts-with-contacts` | `/api/hosts-with-contacts` |
| useEventQueries.ts | 27 | `/api/volunteers` | `/api/volunteers` |
| useEventQueries.ts | 32 | `/api/recipients` | `/api/recipients` |

---

## Filter Hooks (2 queries)

| File | Line | Endpoint | Query Key |
|------|------|----------|-----------|
| useEventFilters.ts | 22 | `/api/event-requests/all-volunteers` | `/api/event-requests/all-volunteers` |
| useEventFilters.ts | 28 | `/api/users` | `/api/users` |

---

## Card-Level Queries (Duplicated per card type)

### CompletedCard.tsx

| Line | Endpoint |
|------|----------|
| 1910 | `/api/recipients` |
| 1915 | `/api/hosts` |
| 1921 | `/api/host-contacts` |
| 1927 | `/api/users/basic` |

### ScheduledCard.tsx

| Line | Endpoint |
|------|----------|
| 358 | `/api/host-contacts` |
| 363 | `/api/recipients` |
| 368 | `/api/hosts` |

### ScheduledCardEnhanced.tsx

| Line | Endpoint |
|------|----------|
| 279 | `/api/host-contacts` |
| 290 | `/api/recipients` |
| 295 | `/api/hosts` |

### NewRequestCard.tsx

| Line | Endpoint |
|------|----------|
| 610 | `/api/users/basic` |

---

## Dialog-Level Queries (Load when dialogs open)

### AssignmentDialog.tsx

- `/api/users/for-assignments`
- `/api/drivers`
- `/api/volunteers`
- `/api/hosts-with-contacts`
- `/api/availability?startDate=...&endDate=...`

### EventEditDialog.tsx

- `/api/users/for-assignments`
- `/api/drivers`
- `/api/volunteers`
- `/api/users/basic`

### TspContactAssignmentDialog.tsx

- `/api/users/for-assignments`

---

## Redundancy Analysis

### Duplicate Endpoints (Same data fetched multiple times)

| Endpoint | Called By | Times Duplicated |
|----------|-----------|------------------|
| `/api/recipients` | useEventQueries, CompletedCard, ScheduledCard, ScheduledCardEnhanced, RecipientAllocationEditor | **5x** |
| `/api/hosts` | useEventQueries, CompletedCard, ScheduledCard, ScheduledCardEnhanced | **4x** |
| `/api/drivers` | useEventQueries, AssignmentDialog, EventEditDialog, EventSchedulingForm | **4x** |
| `/api/users/for-assignments` | useEventQueries, AssignmentDialog, EventEditDialog, TspContactAssignmentDialog, EventSchedulingForm | **5x** |
| `/api/users/basic` | useEventQueries, CompletedCard, NewRequestCard, EventEditDialog | **4x** |
| `/api/host-contacts` | CompletedCard, ScheduledCard, ScheduledCardEnhanced | **3x** |
| `/api/volunteers` | useEventQueries, AssignmentDialog, EventEditDialog | **3x** |
| `/api/hosts-with-contacts` | useEventQueries, AssignmentDialog | **2x** |

---

## Consolidation Opportunities

### 1. Create a single "reference data" endpoint

Combine into one `/api/reference-data` call:

- `/api/users/basic`
- `/api/users/for-assignments`
- `/api/drivers`
- `/api/hosts`
- `/api/hosts-with-contacts`
- `/api/host-contacts`
- `/api/volunteers`
- `/api/recipients`

**Saves: 7 network requests**

### 2. Cards should NOT have their own queries

All cards currently duplicate queries that `useEventQueries` already provides. Cards should consume from the shared hook, not make their own calls.

**Saves: 11+ duplicate requests**

### 3. Dialogs should share cache with useEventQueries

AssignmentDialog, EventEditDialog, etc. all re-fetch the same data that's already cached.

**Saves: 8+ duplicate requests**

### 4. Remove /api/users duplication

These are 3 different endpoints returning overlapping user data:

- `/api/users`
- `/api/users/basic`
- `/api/users/for-assignments`

Could be one endpoint with query params.

---

## Summary

| Category | Count |
|----------|-------|
| Context-level queries | 3 |
| useEventQueries hook | 7 |
| Filter hooks | 2 |
| Card-level duplicates | 11 |
| Dialog queries (on open) | 13 |
| **Total on full page load** | **30+** |

---

## Root Causes

1. **Cards define their own queries** instead of using shared hooks
2. **No single source of truth** for reference data (hosts, drivers, recipients, etc.)
3. **Multiple user endpoints** with overlapping data
4. **Dialogs don't reuse cached data** from parent components

---

## Recommended Fix Priority

1. **High Impact:** Create `/api/reference-data` consolidated endpoint
2. **High Impact:** Remove duplicate queries from cards - use `useEventQueries` hook
3. **Medium Impact:** Ensure dialogs use cached data via shared query keys
4. **Low Impact:** Consolidate user endpoints into one with query params
