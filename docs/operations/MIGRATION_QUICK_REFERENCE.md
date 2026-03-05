# Quick Reference: Unified Task + Communication Migration

## 🎯 One-Sentence Summary
Add a new unified activities system **alongside** your existing tables, migrate incrementally with feature flags, and only sunset the old system once proven stable.

---

## 🗺️ Migration Flow (6-8 Weeks)

```
WEEK 1: PHASE 0 - Preparation
├── Set up feature flags
├── Create staging environment
├── Write tests
└── RISK: None (no production changes)

WEEK 2: PHASE 1 - Add Schema
├── Create activities, activity_participants, activity_reactions tables
├── Add indexes for performance
├── Run migrations on staging → production
└── RISK: Low (additive only, no logic changes)

WEEK 3: PHASE 2 - Read Operations
├── Build ActivityService (read-only)
├── Create GET /api/activities endpoint
├── Add Socket.IO subscriptions
└── RISK: Low (feature flagged, fallback to old system)

WEEK 4: PHASE 3 - Write Operations
├── Add create/update/delete to ActivityService
├── Add POST/PATCH/DELETE endpoints
├── Integrate notifications
└── RISK: Medium (new writes, but feature flagged)

WEEK 5: PHASE 4 - Data Migration
├── Copy historical data (projects → activities)
├── Migrate tasks, events, messages, kudos
├── Bidirectional sync for transition period
└── RISK: Medium (data integrity, but read-only migration)

WEEK 6: PHASE 5 - Frontend Components
├── Build thread UI (ActivityThread, ActivityCard, etc.)
├── Add React Query hooks
├── Test in isolation
└── RISK: Low (not integrated yet)

WEEK 7: PHASE 6 - Frontend Integration
├── Add thread drawer to task cards
├── Add to event requests
├── Create Activity Stream page
└── RISK: Medium (user-facing changes, but feature flagged)

WEEK 8: PHASE 7 - Gradual Rollout
├── Enable for internal team (Week 8 Day 1-2)
├── Enable for volunteer managers (Week 8 Day 3-5)
├── Enable for all users (Week 8 Day 6-7)
└── RISK: Medium-High (full rollout, but monitored closely)
```

---

## 🔄 Rollback Strategy

Each phase has a **panic button**:

| Phase | Rollback Action | Data Loss? |
|-------|----------------|------------|
| 0 | N/A | N/A |
| 1 | Drop new tables | No |
| 2-3 | Disable feature flag | No |
| 4 | Delete migrated records | No (original data intact) |
| 5 | Delete component files | No |
| 6 | Disable UI feature flag | No |
| 7 | Disable master feature flag | No |

**Key Principle:** Old system keeps running until Phase 7 is proven stable for 2-4 weeks.

---

## 🏗️ Architecture: Before vs After

### Before (Current):
```
Tasks       → projects + projectTasks tables
Events      → eventRequests table
Messages    → messages + chatMessages tables
Kudos       → kudosTracking table
Discussions → Scattered in chat, no task context
```

### After (Target):
```
Everything  → activities table (unified)
Threading   → parent_id for nested replies
Context     → context_type + context_id links to events/projects/etc
Real-time   → Socket.IO broadcasts activity:updated events
```

### Transition (During Migration):
```
Both systems run in parallel
├── Feature flag OFF → uses old tables
├── Feature flag ON  → uses activities table
└── Bidirectional sync keeps both in sync
```

---

## 🎚️ Feature Flags (Master Control)

```typescript
// Phase 1: Schema exists but inactive
{ 'unified-activities-schema': true }

// Phase 2-3: Backend can read/write (not exposed to users)
{ 'unified-activities-read': true, 'unified-activities-write': true }

// Phase 4: Migration running
{ 'unified-activities-migration': true }

// Phase 5-6: Frontend components active for beta users
{ 'unified-activities-ui': true, enabled_for_users: ['katie-id', 'lisa-id'] }

// Phase 7: Full rollout
{ 'unified-activities': true } // Everyone sees new system
```

**To rollback at any point:**
```sql
UPDATE feature_flags SET enabled = false WHERE flag_name = 'unified-activities';
```

---

## 🛡️ Safety Guarantees

1. **No Destructive Changes** - Old tables never deleted until 4 weeks after successful rollout
2. **Backwards Compatibility** - Old API endpoints keep working during entire migration
3. **Data Redundancy** - Data exists in both old and new systems during transition
4. **Incremental Testing** - Each phase tested on staging before production
5. **User Opt-In** - Beta users test first before general rollout
6. **Audit Trail** - Every change logged in auditLogs table
7. **Soft Deletes** - Deleted activities marked `is_deleted = true`, not hard deleted

---

## 📋 Pre-Flight Checklist

Before starting Phase 1:
- [ ] Stakeholder approval received
- [ ] Staging environment configured
- [ ] Automated backups enabled
- [ ] Test suite written
- [ ] Team trained on rollback procedures
- [ ] Communication plan for users

---

## 🚨 When to Abort

Stop the migration and rollback if:
- [ ] Data loss detected in staging
- [ ] Test coverage <80%
- [ ] Performance degrades >20% in staging
- [ ] Critical bugs found in new system
- [ ] User feedback overwhelmingly negative
- [ ] Team lacks confidence to proceed

**Remember:** It's safer to delay than to rush.

---

## 📊 Key Metrics to Watch

### During Migration:
- Database query latency (<100ms target)
- Socket.IO connection count (monitor for drops)
- Error rates (should stay <0.1%)
- API response times (should stay within 10% of baseline)

### After Rollout:
- Task completion time (should decrease)
- Comment adoption rate (should increase)
- Support requests about "where to discuss" (should decrease)
- User satisfaction (survey 2 weeks post-rollout)

---

## 🎓 One-Page User Guide (Post-Migration)

```
What's New?
-----------
✨ Every task, event, and project now has a built-in discussion thread
💬 Click the comment icon on any card to open the thread
🔔 Get notified when someone replies to your items
📌 Mention users with @username or reference tasks with #task-name
🎯 See all your activity in one unified feed (Activity Stream page)

Where Did Things Move?
----------------------
✅ My Actions → Same place, now with comment icons
📅 Event Requests → Same place, now with discussion threads
📊 Collection Log → Same place, now with comment threads
💬 Team Chat → Same place, plus you can now @mention tasks
🆕 Activity Stream → NEW! See everything in one chronological feed

How to Use Threads?
-------------------
1. Click 💬 icon on any task/event/project
2. Type your message in the reply box
3. Mention teammates with @ or reference other items with #
4. Hit Cmd+Enter (Mac) or Ctrl+Enter (Windows) to send
5. React with 👍 🎉 ✅ to show quick acknowledgment

Need Help?
----------
Click the ? icon in the top right, or contact support
```

---

## 🔗 Related Documents

- **Full Plan:** `/UNIFIED_TASK_COMMUNICATION_MIGRATION_PLAN.md` (detailed 8-phase breakdown)
- **Schema Reference:** `/shared/schema.ts` (database tables)
- **Permission System:** `/shared/auth-utils.ts` (100+ permissions)
- **Current Architecture:** See the full codebase exploration report above

---

## ✅ Final Pre-Launch Question

**Are we ready to start?**
- [ ] Yes, begin Phase 0 (Preparation)
- [ ] Not yet, need to clarify: _______________
- [ ] Need to adjust the plan: _______________

**Estimated Total Effort:**
- 1 senior full-stack developer: 6-8 weeks
- OR 2 developers (backend + frontend): 4-5 weeks
- Plus QA time: +1 week for comprehensive testing

**Go / No-Go Decision Point:**
- After Phase 3 (Week 4): Evaluate if write operations are stable
- After Phase 6 (Week 7): Evaluate if UI is ready for beta users
- After Phase 7 (Week 8): Evaluate if ready for 100% rollout
