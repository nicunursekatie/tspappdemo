# 🔄 Unified Task + Communication System - Safe Migration Plan

**Platform:** Sandwich Project Platform
**Architecture:** React + Drizzle ORM + PostgreSQL (Neon) + Socket.IO
**Migration Type:** Additive (Zero Breaking Changes)
**Estimated Timeline:** 6-8 weeks (phased rollout)

---

## 🎯 Executive Summary

This plan migrates your platform to a unified **Task + Communication** system where every action, event, and project becomes a conversation object with built-in threading. The migration is designed to be **100% backwards compatible** with the ability to roll back at any phase.

### Key Principles:
1. ✅ **Additive Only** - No destructive schema changes
2. ✅ **Backwards Compatible** - Existing APIs continue working
3. ✅ **Feature-Flagged** - Roll out incrementally to specific users/teams
4. ✅ **Rollback-Safe** - Each phase can be reverted without data loss
5. ✅ **Test-Driven** - Comprehensive testing before production deployment

---

## 🚨 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data integrity issues during schema migration | Low | High | Use Drizzle migrations with transactions; test on staging DB first |
| Permission system breaks with new unified model | Medium | High | Maintain existing permission checks; add new ones alongside |
| Real-time chat performance degrades | Low | Medium | Socket.IO already handles chat; extend events, don't replace |
| Frontend components break from API changes | Low | High | Keep existing endpoints; add new versioned endpoints |
| User confusion from UI changes | Medium | Medium | Feature flag for gradual rollout; provide in-app help tooltips |
| Socket.IO message throughput issues | Low | Medium | Monitor message volume; add rate limiting if needed |
| Foreign key cascade deletes cause data loss | Medium | High | Add soft deletes before enabling threading; audit log all deletions |
| Mobile responsiveness breaks with new UI | Low | Medium | Test slide-in drawers on mobile; use existing responsive patterns |

---

## 📊 Current State Analysis

### Existing Tables That Need Integration:
- **`messages`** - Direct messages with contextType (suggestion, project, task, direct)
- **`chatMessages`** - Socket.IO chat by channel
- **`projects`** + **`projectTasks`** - Project management with nested tasks
- **`eventRequests`** - Event lifecycle tracking (100+ fields)
- **`sandwichCollections`** - Collection operations
- **`kudosTracking`** - Recognition system

### Current Communication Flows:
1. **Direct Messages** → `messages` table + `messageRecipients` (no threading currently)
2. **Chat** → `chatMessages` + Socket.IO broadcast
3. **Notifications** → `notifications` + SendGrid email + Socket.IO push
4. **Kudos** → `kudosTracking` with unread flags

### Challenges:
- **No unified thread structure** - Comments on tasks stored separately from messages
- **Context scattered** - Task updates in audit logs, not conversational
- **Duplicate notification logic** - Each system has its own notification triggers
- **Permission complexity** - 100+ permissions with _OWN vs _ALL variants

---

## 🏗️ Target Architecture

### New Unified Model:

```
activities (new table)
├── id (uuid, primary key)
├── type (enum: 'task', 'event', 'project', 'collection', 'message', 'kudos', 'system_log')
├── title (text, main description)
├── content (text, detailed body - for messages)
├── created_by (uuid, FK to users)
├── assigned_to (uuid[], array of user IDs)
├── status (enum: 'open', 'in_progress', 'done', 'declined', 'postponed', NULL for messages)
├── priority (enum: 'low', 'medium', 'high', 'urgent', NULL for non-tasks)
├── parent_id (uuid, nullable, self-referential FK for threading)
├── root_id (uuid, nullable, denormalized root of thread for efficient queries)
├── context_type (enum: 'event_request', 'project', 'collection', 'kudos', 'direct', 'channel')
├── context_id (uuid, nullable, FK to eventRequests/projects/collections/etc)
├── metadata (jsonb, flexible field for type-specific data)
├── is_deleted (boolean, soft delete flag)
├── created_at (timestamptz)
├── updated_at (timestamptz)
├── thread_count (integer, denormalized count of replies)
├── last_activity_at (timestamptz, for sorting threads by recent activity)
```

### Companion Tables:

```
activity_participants (new)
├── activity_id (uuid, FK to activities)
├── user_id (uuid, FK to users)
├── role (enum: 'assignee', 'follower', 'mentioned', 'creator')
├── last_read_at (timestamptz, for unread tracking)
├── notifications_enabled (boolean, per-thread notification preference)

activity_attachments (new)
├── activity_id (uuid, FK to activities)
├── file_url (text)
├── file_type (text)
├── file_name (text)
├── uploaded_by (uuid, FK to users)
├── uploaded_at (timestamptz)

activity_reactions (new)
├── activity_id (uuid, FK to activities)
├── user_id (uuid, FK to users)
├── reaction_type (enum: 'like', 'celebrate', 'helpful', 'complete', 'question')
├── created_at (timestamptz)
```

---

## 🔀 Migration Phases

### **PHASE 0: Preparation** (Week 1)
**Goal:** Set up infrastructure without touching production

#### Tasks:
1. **Create feature flags table and service**
   ```sql
   CREATE TABLE feature_flags (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     flag_name TEXT UNIQUE NOT NULL,
     enabled BOOLEAN DEFAULT false,
     enabled_for_users UUID[] DEFAULT '{}',
     enabled_for_roles TEXT[] DEFAULT '{}',
     description TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - Create server-side feature flag service
   - Add React hook `useFeatureFlag('unified-activities')`

2. **Set up staging environment**
   - Clone production DB schema to staging (Neon branch or separate DB)
   - Configure environment variables for staging
   - Deploy current codebase to staging

3. **Create comprehensive test suite**
   - Unit tests for new schema
   - Integration tests for API endpoints
   - E2E tests for critical user flows (send message, create task, comment on event)

4. **Database backup strategy**
   - Automated backups before each migration
   - Document rollback procedures
   - Test restore from backup on staging

**Rollback:** N/A (no changes deployed)

---

### **PHASE 1: Schema Addition** (Week 2)
**Goal:** Add new tables without changing existing ones

#### Tasks:
1. **Create Drizzle schema for new tables**
   - Add to `/shared/schema.ts`:
     ```typescript
     export const activities = pgTable('activities', {
       id: uuid('id').primaryKey().defaultRandom(),
       type: varchar('type', { length: 50 }).notNull(),
       title: text('title').notNull(),
       content: text('content'),
       createdBy: uuid('created_by').notNull().references(() => users.id),
       assignedTo: uuid('assigned_to').array().default([]),
       status: varchar('status', { length: 50 }),
       priority: varchar('priority', { length: 20 }),
       parentId: uuid('parent_id').references(() => activities.id, { onDelete: 'cascade' }),
       rootId: uuid('root_id').references(() => activities.id),
       contextType: varchar('context_type', { length: 50 }),
       contextId: uuid('context_id'),
       metadata: jsonb('metadata').default({}),
       isDeleted: boolean('is_deleted').default(false),
       threadCount: integer('thread_count').default(0),
       lastActivityAt: timestamp('last_activity_at').defaultNow(),
       createdAt: timestamp('created_at').defaultNow(),
       updatedAt: timestamp('updated_at').defaultNow(),
     });

     export const activityParticipants = pgTable('activity_participants', {
       id: uuid('id').primaryKey().defaultRandom(),
       activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
       userId: uuid('user_id').notNull().references(() => users.id),
       role: varchar('role', { length: 50 }).notNull(),
       lastReadAt: timestamp('last_read_at'),
       notificationsEnabled: boolean('notifications_enabled').default(true),
       createdAt: timestamp('created_at').defaultNow(),
     });

     export const activityReactions = pgTable('activity_reactions', {
       id: uuid('id').primaryKey().defaultRandom(),
       activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
       userId: uuid('user_id').notNull().references(() => users.id),
       reactionType: varchar('reaction_type', { length: 50 }).notNull(),
       createdAt: timestamp('created_at').defaultNow(),
     });

     export const activityAttachments = pgTable('activity_attachments', {
       id: uuid('id').primaryKey().defaultRandom(),
       activityId: uuid('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
       fileUrl: text('file_url').notNull(),
       fileType: varchar('file_type', { length: 100 }),
       fileName: text('file_name').notNull(),
       uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
       uploadedAt: timestamp('uploaded_at').defaultNow(),
     });
     ```

2. **Add indexes for performance**
   ```typescript
   // In schema.ts, add indexes
   export const activitiesIndexes = {
     typeIdx: index('activities_type_idx').on(activities.type),
     createdByIdx: index('activities_created_by_idx').on(activities.createdBy),
     parentIdIdx: index('activities_parent_id_idx').on(activities.parentId),
     rootIdIdx: index('activities_root_id_idx').on(activities.rootId),
     contextIdx: index('activities_context_idx').on(activities.contextType, activities.contextId),
     lastActivityIdx: index('activities_last_activity_idx').on(activities.lastActivityAt),
     deletedIdx: index('activities_deleted_idx').on(activities.isDeleted),
   };
   ```

3. **Generate and run migration**
   ```bash
   npm run db:generate  # Generate migration files
   # Review migration SQL manually
   npm run db:migrate   # Apply to staging first
   ```

4. **Verify migration on staging**
   - Check all tables created
   - Verify foreign keys and indexes
   - Test cascade deletes with test data
   - Ensure no impact on existing tables

**Rollback:**
```sql
DROP TABLE activity_attachments CASCADE;
DROP TABLE activity_reactions CASCADE;
DROP TABLE activity_participants CASCADE;
DROP TABLE activities CASCADE;
DROP TABLE feature_flags CASCADE;
```

---

### **PHASE 2: Service Layer - Read Operations** (Week 3)
**Goal:** Build backend services to read from new tables (no writes yet)

#### Tasks:
1. **Create Activity Service** (`/server/services/activities/index.ts`)
   ```typescript
   export class ActivityService {
     // Get activities with threading
     async getActivities(filters: {
       type?: string[];
       contextType?: string;
       contextId?: string;
       userId?: string;
       includeDeleted?: boolean;
       parentId?: string | null; // null = root activities only
     }) {
       // Query activities table with joins
       // Include thread counts and participant info
     }

     // Get single activity with full thread
     async getActivityThread(rootId: string, userId: string) {
       // Fetch root activity
       // Fetch all replies (parentId = rootId)
       // Mark user's last read time
       // Return nested structure
     }

     // Get unread counts per user
     async getUnreadCounts(userId: string) {
       // Compare lastReadAt vs last_activity_at
       // Group by context type
     }
   }
   ```

2. **Create migration adapters** (temporary bridge code)
   - `/server/services/activities/adapters/tasks-adapter.ts` - Read from `projects` and `projectTasks`, return as activity format
   - `/server/services/activities/adapters/events-adapter.ts` - Read from `eventRequests`, return as activity format
   - `/server/services/activities/adapters/messages-adapter.ts` - Read from `messages`, return as activity format

3. **Create unified read endpoint** (`/server/routes/activities/index.ts`)
   ```typescript
   router.get('/api/activities', async (req, res) => {
     const { type, contextType, contextId, includeThreads } = req.query;

     // Feature flag check
     if (!featureFlags.isEnabled('unified-activities-read', req.user)) {
       // Fallback to old adapter logic
       return res.json(await adapters.getLegacyActivities(req.query));
     }

     // New unified query
     const activities = await activityService.getActivities({
       type: type?.split(','),
       contextType,
       contextId,
       userId: req.user.id,
     });

     return res.json(activities);
   });
   ```

4. **Add Socket.IO events for activities**
   - Extend `/server/socket-chat.ts`:
     ```typescript
     socket.on('activity:subscribe', ({ activityId }) => {
       socket.join(`activity:${activityId}`);
     });

     socket.on('activity:unsubscribe', ({ activityId }) => {
       socket.leave(`activity:${activityId}`);
     });
     ```

5. **Test read operations on staging**
   - Seed test data into `activities` table
   - Verify queries return correct data
   - Test permission filtering
   - Load test with 10,000+ activities

**Rollback:** Remove routes and service files (no DB changes)

---

### **PHASE 3: Service Layer - Write Operations** (Week 4)
**Goal:** Enable creating activities and threads (still behind feature flag)

#### Tasks:
1. **Add write methods to ActivityService**
   ```typescript
   async createActivity(data: {
     type: string;
     title: string;
     content?: string;
     createdBy: string;
     assignedTo?: string[];
     contextType?: string;
     contextId?: string;
     parentId?: string; // For threading
   }) {
     // Start transaction
     // Create activity record
     // If parentId provided:
     //   - Update thread_count on parent
     //   - Set root_id to parent's root_id (or parent.id if parent is root)
     //   - Update last_activity_at on root
     // Create activity_participants records
     // Trigger notifications
     // Emit Socket.IO event
     // Commit transaction
   }

   async updateActivity(activityId: string, updates: Partial<Activity>) {
     // Check permissions
     // Update record
     // Update last_activity_at
     // Emit Socket.IO event
     // Create audit log
   }

   async softDeleteActivity(activityId: string, userId: string) {
     // Set is_deleted = true
     // Keep for audit trail
     // Emit Socket.IO event
   }
   ```

2. **Add write endpoints**
   ```typescript
   // POST /api/activities
   router.post('/api/activities', async (req, res) => {
     if (!featureFlags.isEnabled('unified-activities-write', req.user)) {
       return res.status(403).json({ error: 'Feature not enabled' });
     }

     // Validate permissions based on type
     // Create activity
     // Return created record
   });

   // POST /api/activities/:id/reply
   router.post('/api/activities/:id/reply', async (req, res) => {
     // Create child activity with parentId
   });

   // PATCH /api/activities/:id
   router.patch('/api/activities/:id', async (req, res) => {
     // Update activity
   });

   // DELETE /api/activities/:id (soft delete)
   router.delete('/api/activities/:id', async (req, res) => {
     // Soft delete
   });
   ```

3. **Add notification integration**
   - Extend notification service to handle activity events
   - Send email when:
     - Assigned to new activity
     - Someone replies to your activity
     - Mentioned in an activity
   - Use existing SendGrid templates, add new ones for activities

4. **Add permission checks**
   - Create new permissions in `/shared/auth-utils.ts`:
     - `ACTIVITIES_VIEW_ALL`, `ACTIVITIES_VIEW_OWN`
     - `ACTIVITIES_CREATE_TASK`, `ACTIVITIES_CREATE_MESSAGE`, `ACTIVITIES_CREATE_EVENT`
     - `ACTIVITIES_EDIT_OWN`, `ACTIVITIES_EDIT_ALL`
     - `ACTIVITIES_DELETE_OWN`, `ACTIVITIES_DELETE_ALL`
     - `ACTIVITIES_COMMENT` (can reply to threads)

5. **Test write operations on staging**
   - Create activities via API
   - Create threaded replies
   - Test cascade updates (thread_count, last_activity_at)
   - Test soft deletes
   - Verify notifications sent
   - Test permission enforcement

**Rollback:** Disable feature flag; data persists in `activities` table but not exposed

---

### **PHASE 4: Data Migration - Historical Data** (Week 5)
**Goal:** Copy existing data into unified activities table

#### Tasks:
1. **Create migration scripts** (`/server/scripts/migrate-to-activities.ts`)
   ```typescript
   // IMPORTANT: This is read-only migration - doesn't delete old data

   async function migrateProjects() {
     const projects = await db.select().from(schema.projects);

     for (const project of projects) {
       // Create activity record
       await activityService.createActivity({
         type: 'project',
         title: project.title,
         content: project.description,
         createdBy: project.createdBy,
         assignedTo: project.assigneeIds || [],
         status: project.status,
         priority: project.priority,
         contextType: 'project',
         contextId: project.id,
         metadata: {
           deadline: project.deadline,
           originalProjectId: project.id,
         },
         // Don't trigger notifications for historical data
         skipNotifications: true,
       });
     }
   }

   async function migrateProjectTasks() {
     // Similar to projects, but set parentId to project's activity
   }

   async function migrateEventRequests() {
     // Map eventRequests to activities
   }

   async function migrateMessages() {
     // Map direct messages to activities
   }

   async function migrateKudos() {
     // Map kudos to activities with type='kudos'
   }
   ```

2. **Run migration incrementally**
   - Migrate in batches of 1000 records
   - Log progress to console
   - Store migration state in case of interruption
   - Verify data integrity after each batch

3. **Add bidirectional sync (temporary)**
   - When old system creates a task → also create in activities
   - When activities system creates task → also create in old system (if feature flag off)
   - Ensures consistency during transition period

4. **Validate migrated data**
   - Compare counts between old and new tables
   - Spot-check random records for accuracy
   - Verify all relationships preserved
   - Check no data loss

**Rollback:**
```sql
-- Delete migrated data (keeps new data created during testing)
DELETE FROM activities WHERE metadata->>'migrated' = 'true';
```

---

### **PHASE 5: Frontend - Thread Components** (Week 6)
**Goal:** Build reusable thread UI components (not yet integrated)

#### Tasks:
1. **Create thread components** (`/client/src/components/activities/`)
   ```typescript
   // ActivityThread.tsx - Main thread container
   // ActivityCard.tsx - Individual activity item
   // ActivityReply.tsx - Reply composer
   // ActivityReactions.tsx - Like/celebrate buttons
   // ActivityParticipants.tsx - Avatars of participants
   // ActivityTimeline.tsx - Chronological feed view
   ```

2. **Add React Query hooks** (`/client/src/hooks/activities/`)
   ```typescript
   // useActivities.ts - Fetch and filter activities
   // useActivityThread.ts - Get full thread
   // useCreateActivity.ts - Create mutation
   // useUpdateActivity.ts - Update mutation
   // useActivitySubscription.ts - Socket.IO real-time updates
   ```

3. **Build slide-in drawer UI**
   - Reuse existing modal/drawer patterns from your codebase
   - Mobile-responsive (full screen on mobile, sidebar on desktop)
   - Keyboard shortcuts (Esc to close, Cmd+Enter to send)

4. **Add mention/autocomplete**
   - `@username` autocomplete
   - `#task-123` autocomplete for referencing activities
   - Rich text editor with basic formatting

5. **Test components in isolation (Storybook or dedicated test page)**
   - Render thread with mock data
   - Test reply submission
   - Test reactions
   - Test mobile responsiveness

**Rollback:** Components not yet integrated, just delete files

---

### **PHASE 6: Frontend - Integration** (Week 7)
**Goal:** Integrate thread UI into existing pages (feature flagged)

#### Tasks:
1. **Add thread drawer to task cards**
   - Modify `/client/src/components/action-tracking-enhanced.tsx`:
     ```typescript
     const [selectedActivityId, setSelectedActivityId] = useState(null);

     // Add click handler to task card
     <TaskCard
       onClick={() => setSelectedActivityId(task.activityId)}
     />

     // Render thread drawer
     {selectedActivityId && (
       <ActivityThreadDrawer
         activityId={selectedActivityId}
         onClose={() => setSelectedActivityId(null)}
       />
     )}
     ```

2. **Add thread drawer to event requests**
   - Modify event request tabs to show comment icon
   - Click opens thread sidebar
   - Show unread count badge

3. **Add thread drawer to collection entries**
   - Similar pattern to tasks
   - Collection discussions can reference specific entries

4. **Update Team Chat to show activity mentions**
   - When someone types `@task Task Title`, render as clickable link
   - Click opens activity thread drawer

5. **Add Activity Stream page** (`/client/src/pages/ActivityStream.tsx`)
   - New navigation item (behind feature flag)
   - Chronological feed of all activity
   - Filters: Me / Team / All, and by type
   - Infinite scroll with React Query

6. **Test integration on staging**
   - Navigate to tasks → click task → thread opens
   - Post reply → appears in thread
   - Verify real-time updates via Socket.IO
   - Test on mobile devices

**Rollback:**
- Set feature flag `unified-activities-ui` to disabled
- Old UI still works

---

### **PHASE 7: Gradual Rollout** (Week 8)
**Goal:** Enable for beta users, monitor, then full rollout

#### Tasks:
1. **Enable for internal team first**
   ```sql
   UPDATE feature_flags
   SET enabled_for_users = ARRAY['katie-user-id', 'lisa-user-id']
   WHERE flag_name = 'unified-activities';
   ```

2. **Monitor for issues**
   - Check error logs (Sentry)
   - Monitor Socket.IO message volume
   - Watch database query performance
   - Collect user feedback

3. **Enable for volunteer management team**
   - Add more users to feature flag
   - Monitor for one week

4. **Enable for all users**
   ```sql
   UPDATE feature_flags
   SET enabled = true
   WHERE flag_name = 'unified-activities';
   ```

5. **Sunset old system** (2-4 weeks after full rollout)
   - Once confident in new system:
   - Stop writing to old tables
   - Archive old data
   - Remove old API endpoints (keep for 1 more month)
   - Remove old UI components

**Rollback:**
- Set feature flag to disabled
- Users fall back to old system
- All data preserved in both systems

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] ActivityService CRUD operations
- [ ] Permission checks for activities
- [ ] Thread nesting logic
- [ ] Notification triggers

### Integration Tests
- [ ] API endpoints (create, read, update, delete activities)
- [ ] Socket.IO event handling
- [ ] Database transactions (thread_count updates)
- [ ] Permission enforcement

### E2E Tests (Playwright/Cypress)
- [ ] User creates task → adds comment → marks done
- [ ] User mentioned in activity → receives notification
- [ ] User opens event request → sees discussion thread
- [ ] Real-time updates appear without refresh

### Performance Tests
- [ ] Load test: 10,000 activities with threading
- [ ] Query performance: Complex filters with joins
- [ ] Socket.IO stress test: 100 concurrent users
- [ ] Mobile performance on slow connection

### Manual QA Checklist
- [ ] Create activity from each context (task, event, collection, message)
- [ ] Reply to activity thread
- [ ] Edit activity
- [ ] Delete activity (verify soft delete)
- [ ] Mention user in comment
- [ ] Receive email notification
- [ ] Mark thread as read
- [ ] Filter activity stream
- [ ] Test permissions (view own vs view all)
- [ ] Test on mobile (iOS Safari, Android Chrome)

---

## 🔧 Configuration & Feature Flags

### Feature Flags:
```typescript
{
  'unified-activities-schema': false,        // Phase 1
  'unified-activities-read': false,          // Phase 2
  'unified-activities-write': false,         // Phase 3
  'unified-activities-migration': false,     // Phase 4
  'unified-activities-ui': false,            // Phase 5-6
  'unified-activities': false,               // Phase 7 (master toggle)
}
```

### Environment Variables:
```bash
# Add to .env
ENABLE_ACTIVITY_MIGRATION=false
ACTIVITY_MIGRATION_BATCH_SIZE=1000
ACTIVITY_SOCKET_THROTTLE_MS=100  # Throttle real-time updates
```

---

## 📋 Rollback Procedures

### Phase 1 Rollback (Schema):
```sql
DROP TABLE activity_attachments CASCADE;
DROP TABLE activity_reactions CASCADE;
DROP TABLE activity_participants CASCADE;
DROP TABLE activities CASCADE;
```

### Phase 2-3 Rollback (Services):
1. Remove routes from Express app
2. Delete service files
3. Restart server
4. No data loss

### Phase 4 Rollback (Data Migration):
```sql
-- Keep manually created activities, remove migrated ones
DELETE FROM activities WHERE metadata->>'migrated' = 'true';
```

### Phase 5-6 Rollback (Frontend):
1. Set feature flag `unified-activities-ui = false`
2. Users see old UI
3. Delete component files if needed

### Phase 7 Rollback (Full Rollout):
1. Set feature flag `unified-activities = false`
2. Stop bidirectional sync
3. System reverts to old tables
4. New data in activities table preserved but not displayed

---

## 📊 Success Metrics

### Technical Metrics:
- [ ] Zero data loss during migration
- [ ] <100ms API response time for activity queries
- [ ] <50ms Socket.IO message latency
- [ ] >99% uptime during rollout
- [ ] All tests passing

### User Experience Metrics:
- [ ] Reduced "where did I discuss this task?" support requests
- [ ] Increased task comment usage (measure adoption)
- [ ] Decreased time to resolve tasks (measure efficiency)
- [ ] Positive user feedback (survey after 2 weeks)

### Performance Benchmarks:
- [ ] Existing task list loads in <500ms
- [ ] New activity stream loads in <1s
- [ ] Thread drawer opens in <200ms
- [ ] Real-time updates appear in <100ms

---

## 🛠️ Development Checklist

### Pre-Migration:
- [ ] Create staging environment
- [ ] Set up automated backups
- [ ] Write comprehensive tests
- [ ] Document rollback procedures
- [ ] Get stakeholder approval

### During Migration:
- [ ] Run each phase on staging first
- [ ] Verify tests pass before production
- [ ] Monitor error logs continuously
- [ ] Communicate progress to users
- [ ] Keep rollback scripts ready

### Post-Migration:
- [ ] Monitor performance for 1 week
- [ ] Collect user feedback
- [ ] Fix any bugs discovered
- [ ] Optimize slow queries
- [ ] Update documentation

---

## 🎓 Training & Documentation

### User Docs to Create:
1. "How to comment on tasks" - Short tutorial
2. "Activity Stream overview" - Navigation guide
3. "Mentioning users and tasks" - Feature guide
4. "Managing notifications" - Settings guide

### Developer Docs to Create:
1. Activity schema reference
2. API endpoints documentation
3. Permission system updates
4. Socket.IO events reference
5. Migration runbook

---

## 💡 Future Enhancements (Post-Migration)

Once the core system is stable, consider:
1. **AI Summaries** - "3 messages requesting drivers haven't become tasks"
2. **Smart Notifications** - ML-powered delivery optimization (you already have this!)
3. **Voice Messages** - Audio comments on activities
4. **Rich Embeds** - Preview links, images in threads
5. **Activity Templates** - Quick-create common task types
6. **Workflow Automation** - "When task is marked done, notify team in chat"
7. **External Integrations** - Slack/Discord bridge for activities
8. **Mobile App** - Native iOS/Android with push notifications

---

## ✅ Next Steps

1. **Review this plan** with your team
2. **Get approval** from stakeholders
3. **Set up staging** environment
4. **Begin Phase 0** (preparation)
5. **Schedule weekly check-ins** during migration

---

## 📞 Support & Questions

If any issues arise during migration:
1. Check rollback procedures above
2. Review error logs in Sentry
3. Test on staging before reverting production
4. Document any new edge cases discovered

**Remember:** This migration is designed to be **zero-risk** with multiple rollback points. Take your time with each phase and don't rush to production until tests pass.
