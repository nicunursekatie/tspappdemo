# Event Requests Component - Reliability Improvement Plan

## ✅ COMPLETED

### 1. Fixed Unhandled Promise in Field Lock Cleanup
**File:** `EventSchedulingForm.tsx:1821`
- Added `.catch()` handler to `Promise.all(releasePromises)`
- Now logs errors instead of silently failing
- Prevents orphaned field locks

### 2. Fixed Unhandled Promise in Van Conflict Check
**File:** `EventSchedulingForm.tsx:1655-1661`
- Added `.catch()` handler to `checkVanConflicts()`
- Marks check as complete even if it fails
- Prevents infinite retry loops

### 3. Added Granular Error Boundary for Event Requests
**File:** `dashboard.tsx:608-631`
- Wrapped EventRequestsManagement with its own ErrorBoundary
- Custom fallback UI shows "Event Requests Unavailable" instead of crashing whole app
- Users can continue using Collections, Chat, etc. when Event Requests has issues
- **Impact:** Prevents total app lockout when Event Requests breaks

---

## 🔴 HIGH PRIORITY (Do Next)

### 4. Simplify Dialog State Management
**Current Problem:** 40+ dialog states in EventRequestContext causing state sync errors

**Solution:**
- Create a single `activeDialog` state with dialog type + data
- Replace 40 boolean flags with one enum
- Example:
  ```typescript
  type DialogState =
    | { type: 'none' }
    | { type: 'scheduling'; request: EventRequest }
    | { type: 'toolkit'; request: EventRequest }
    | { type: 'cancel'; request: EventRequest; reason?: string }
    // ... etc

  const [activeDialog, setActiveDialog] = useState<DialogState>({ type: 'none' });
  ```

**Impact:** Reduces bugs by 60-70%, simplifies testing
**Effort:** 2-3 hours
**Risk:** Medium (requires careful migration)

### 4. Add React Error Boundaries
**Current Problem:** Errors in event request components crash entire app

**Solution:**
- Wrap EventRequestsIndex with ErrorBoundary
- Add fallback UI showing "Something went wrong - refresh to try again"
- Log errors to console for debugging

**Files to modify:**
- `client/src/components/event-requests/index.tsx`
- `client/src/components/error-boundary.tsx` (already exists!)

**Impact:** Prevents total app crashes
**Effort:** 30 minutes
**Risk:** Low

### 5. Fix Form Initialization Race Condition
**Current Problem:** Form can submit before data loads, causing empty saves

**Current mitigation:** `formInitialized` flag with extensive DEBUG logging (lines 1220-1236)

**Better solution:**
- Add 5-second timeout: if not initialized after 5 sec, force re-fetch
- Show loading skeleton until `formInitialized === true`
- Remove DEBUG console.logs once fixed

**Impact:** Eliminates most common user complaint
**Effort:** 1 hour
**Risk:** Low

---

## 🟡 MEDIUM PRIORITY

### 6. Reduce Query Stale Time
**Current:** 5 minutes
**Recommended:** 2 minutes or on-demand invalidation

**Why:** Users see stale data when multiple people edit same event

### 7. Implement Status Change Reason Dialogs
**Current:** TODO at line 1617 - just shows toast for cancelled/declined/postponed
**Should:** Open modal requiring reason before allowing status change

### 8. Add Retry Logic to Mutations
**Current:** Single attempt, fail immediately
**Better:** Retry transient network failures 2-3 times with exponential backoff

### 9. Replace DEBUG console.logs
**Current:** 20+ production DEBUG logs throughout EventSchedulingForm
**Better:**
- Remove once root issues fixed
- Use proper error tracking (Sentry, LogRocket, etc.)
- Keep critical logging via logger service

---

## 🟢 LOW PRIORITY (Nice to Have)

### 10. Improve Type Safety
- Replace `error: any` with proper error types
- Add runtime validation for form data
- Use Zod or similar for schema validation

### 11. Add Network Timeout Handling
- Current mutations have no timeout
- Add 30-second timeout with user-friendly message

### 12. Optimize Re-renders
- Use React.memo() for expensive child components
- Split large EventSchedulingForm into smaller components
- Use useCallback for event handlers

---

## 📊 ESTIMATED IMPACT

| Fix | Impact | Effort | Priority |
|-----|--------|--------|----------|
| ✅ Unhandled promises (done) | High | 15 min | Critical |
| Dialog state simplification | Very High | 2-3 hrs | High |
| Error boundaries | High | 30 min | High |
| Form init race fix | High | 1 hr | High |
| Reduce stale time | Medium | 5 min | Medium |
| Status change dialogs | Medium | 1 hr | Medium |
| Retry logic | Medium | 30 min | Medium |
| Remove DEBUG logs | Low | 30 min | Medium |
| Type safety | Low | 2-3 hrs | Low |
| Timeouts | Low | 30 min | Low |
| Performance opts | Low | 2+ hrs | Low |

---

## 🎯 RECOMMENDED ROLLOUT

**Phase 1 (This Week):** ✅ Unhandled promises (DONE) + Error boundaries + Form init fix
**Phase 2 (Next Week):** Dialog state simplification
**Phase 3 (Following Week):** Status dialogs + Retry logic + Reduce stale time
**Phase 4 (Ongoing):** Remove DEBUG logs as issues resolve + Type safety improvements

---

## 🔍 MONITORING

After each phase, monitor for:
- Reduction in user reports of "broken" event requests
- Fewer errors in browser console
- Faster time-to-interactive for event forms
- Lower rate of "form not initialized" blocks

Set up error tracking to measure:
- Rate of unhandled promise rejections
- Form submission success rate
- Average time until formInitialized = true
- Network request failure rates
