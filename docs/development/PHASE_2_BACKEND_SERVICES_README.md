# Phase 2: Backend Services Complete ✅

**Status:** Complete
**Date:** 2025-10-26
**Risk Level:** Zero (feature-flagged, tables exist but API inactive by default)
**Depends On:** Phase 0 (Feature Flags) + Phase 1 (Schema)

---

## What Was Built

### 1. ActivityService Class
**File:** `/server/services/activities/index.ts` (638 lines)

Complete backend service with all CRUD operations:

**Core Methods:**
- ✅ `createActivity()` - Create tasks, events, messages with threading
- ✅ `getActivities()` - Query with filters (type, context, user, status)
- ✅ `getActivityById()` - Get single activity with full details
- ✅ `getActivityThread()` - Get root + all replies in one call
- ✅ `updateActivity()` - Update any activity fields
- ✅ `deleteActivity()` - Soft delete (sets `isDeleted = true`)

**Thread Operations:**
- ✅ `updateThreadMetrics()` - Auto-update reply counts and timestamps
- ✅ Smart parent/root resolution (handles nested replies)

**Participant Management:**
- ✅ `addParticipant()` - Add users with roles (assignee, follower, mentioned, creator)
- ✅ `getParticipants()` - Get all participants for an activity
- ✅ `markAsRead()` - Track last read time for unread badges
- ✅ `getUnreadCount()` - Get total unread count per user

**Reactions:**
- ✅ `addReaction()` - Add like/celebrate/helpful/complete/question
- ✅ `removeReaction()` - Remove a reaction
- ✅ `getReactions()` - Get all reactions for an activity

**Attachments:**
- ✅ `addAttachment()` - Upload files (links to Google Cloud Storage)
- ✅ `getAttachments()` - Get all attachments for an activity

### 2. API Routes
**File:** `/server/routes/activities.ts` (492 lines)

**Complete REST API with feature flag protection:**

#### Activities CRUD
- `GET /api/activities` - List activities with filters
- `GET /api/activities/:id` - Get single activity
- `GET /api/activities/:id/thread` - Get full thread (root + replies)
- `POST /api/activities` - Create new activity
- `PATCH /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Soft delete

#### Participants
- `POST /api/activities/:id/participants` - Add participant
- `GET /api/activities/:id/participants` - Get participants

#### Reactions
- `POST /api/activities/:id/reactions` - Add reaction
- `DELETE /api/activities/:id/reactions/:type` - Remove reaction
- `GET /api/activities/:id/reactions` - Get reactions

#### Attachments
- `POST /api/activities/:id/attachments` - Add attachment
- `GET /api/activities/:id/attachments` - Get attachments

#### Utilities
- `GET /api/activities/unread/count` - Get unread count
- `POST /api/activities/:id/mark-read` - Mark as read

### 3. Socket.IO Integration
**File:** `/server/socket-chat.ts` (added lines 388-477)

**Real-time events for live updates:**

**Client → Server:**
- `activity:subscribe` - Subscribe to activity or context updates
- `activity:unsubscribe` - Unsubscribe from updates
- `activity:typing` - Broadcast typing indicator

**Server → Client** (emit these from API routes):
- `activity:created` - New activity created
- `activity:updated` - Activity updated
- `activity:reply` - New reply added
- `activity:reaction` - Reaction added/removed
- `activity:user-typing` - User is typing

### 4. Route Registration
**File:** `/server/routes/index.ts` (lines 58, 334-341)

Activities routes registered at `/api/activities` with:
- ✅ Authentication middleware
- ✅ Standard error handling
- ✅ Feature flag checking

---

## Feature Flag Integration

**All endpoints check feature flags before allowing access:**

**Read Operations:** Require `unified-activities-read` flag
**Write Operations:** Require `unified-activities-write` flag

If flag is disabled for a user:
- Returns 403 Forbidden
- Old system continues working normally
- Zero impact on users without access

---

## API Reference

### Query Parameters

#### GET /api/activities
```typescript
{
  type?: string,              // Comma-separated: 'task,event,message'
  contextType?: string,       // 'event_request', 'project', 'collection'
  contextId?: string,         // ID of related context
  userId?: string,            // Filter by creator or assignee
  status?: string,            // Comma-separated: 'open,in_progress'
  includeDeleted?: boolean,   // Default: false
  parentId?: string | 'null', // 'null' = root only, id = replies
  limit?: number,             // Default: 50
  offset?: number,            // Default: 0
}
```

**Response:**
```typescript
[
  {
    id: string,
    type: 'task' | 'event' | 'message' | ...,
    title: string,
    content?: string,
    createdBy: string,
    creatorName?: string,
    creatorEmail?: string,
    assignedTo: string[],
    status?: string,
    priority?: string,
    parentId?: string,
    rootId?: string,
    contextType?: string,
    contextId?: string,
    metadata: object,
    isDeleted: boolean,
    threadCount: number,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
]
```

### Creating Activities

#### POST /api/activities
```typescript
{
  id?: string,              // Optional UUID (generated if not provided)
  type: string,             // Required: 'task', 'event', 'message', etc.
  title: string,            // Required
  content?: string,
  assignedTo?: string[],
  status?: string,
  priority?: string,
  parentId?: string,        // For replies
  rootId?: string,          // Auto-resolved if parentId provided
  contextType?: string,
  contextId?: string,
  metadata?: object,
}
```

**Response:** Created activity object

### Threading Examples

#### Create Root Activity (Task)
```bash
POST /api/activities
{
  "type": "task",
  "title": "Update driver database",
  "content": "Clean up old entries and verify contacts",
  "assignedTo": ["user-123"],
  "status": "open",
  "priority": "high"
}
```

#### Create Reply
```bash
POST /api/activities
{
  "type": "message",
  "title": "Question",
  "content": "Should I include retired drivers?",
  "parentId": "task-uuid-123"  // Points to task above
}
```

The service automatically:
- Sets `rootId` to the task's ID
- Increments task's `threadCount`
- Updates task's `lastActivityAt`
- Adds replier as participant with role='mentioned'

---

## Socket.IO Usage

### Frontend Setup

```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
});

// Subscribe to an activity thread
socket.emit('activity:subscribe', {
  activityId: 'task-123',
});

// Listen for new replies
socket.on('activity:reply', (reply) => {
  console.log('New reply:', reply);
  // Update UI to show new reply
});

// Unsubscribe when leaving
socket.emit('activity:unsubscribe', {
  activityId: 'task-123',
});
```

### Backend Emit Example

```typescript
// In routes/activities.ts after creating a reply:
import { getSocketInstance } from '../socket-chat';

const io = getSocketInstance();
io.to(`activity:${rootId}`).emit('activity:reply', newReply);
```

---

## Example Use Cases

### 1. Task with Thread

```typescript
// Create task
const task = await activityService.createActivity({
  type: 'task',
  title: 'Coordinate Procare Therapy event',
  createdBy: 'katie-id',
  assignedTo: ['katie-id', 'lisa-id'],
  status: 'open',
  priority: 'high',
  contextType: 'event_request',
  contextId: 'event-456',
});

// Someone asks a question
const question = await activityService.createActivity({
  type: 'message',
  title: 'Question about sandwiches',
  content: 'Do they need veggie options?',
  createdBy: 'lisa-id',
  parentId: task.id,
});

// Katie replies
const reply = await activityService.createActivity({
  type: 'message',
  title: 'Reply',
  content: 'Yes, 10 veggie sandwiches',
  createdBy: 'katie-id',
  parentId: task.id,
});

// Get full thread
const thread = await activityService.getActivityThread(task.id);
// Returns: { root: task, replies: [question, reply], totalReplies: 2 }
```

### 2. Event Request Discussion

```typescript
// Link discussion to an event
const discussion = await activityService.createActivity({
  type: 'message',
  title: 'Driver availability',
  content: 'Who can drive on Oct 28?',
  createdBy: 'coordinator-id',
  contextType: 'event_request',
  contextId: 'event-789',
});

// People reply
const volunteer = await activityService.createActivity({
  type: 'message',
  content: 'I can drive!',
  createdBy: 'volunteer-id',
  parentId: discussion.id,
});

// Query all discussions for this event
const eventDiscussions = await activityService.getActivities({
  contextType: 'event_request',
  contextId: 'event-789',
  parentId: null, // Root activities only
});
```

### 3. Reactions

```typescript
// Add like
await activityService.addReaction('activity-123', 'user-id', 'like');

// Add celebrate
await activityService.addReaction('activity-123', 'user-id', 'celebrate');

// Get all reactions
const reactions = await activityService.getReactions('activity-123');
// Returns: [{ userId: 'user-id', reactionType: 'like', ... }]
```

---

## Testing the API

### Prerequisites
1. Apply Phase 1 migration (create tables)
2. Apply Phase 0 migration (feature flags)
3. Enable feature flags for your user

### Enable Feature Flags

```sql
-- Enable read operations
UPDATE feature_flags
SET enabled_for_users = array['your-user-id']
WHERE flag_name = 'unified-activities-read';

-- Enable write operations
UPDATE feature_flags
SET enabled_for_users = array['your-user-id']
WHERE flag_name = 'unified-activities-write';
```

### Test with curl

```bash
# Login first to get session cookie
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"password"}' \
  -c cookies.txt

# Create an activity
curl -X POST http://localhost:5000/api/activities \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "task",
    "title": "Test task",
    "content": "This is a test"
  }'

# Get activities
curl http://localhost:5000/api/activities \
  -b cookies.txt

# Create a reply
curl -X POST http://localhost:5000/api/activities \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "type": "message",
    "title": "Reply",
    "content": "This is a reply",
    "parentId": "task-id-from-above"
  }'

# Get thread
curl http://localhost:5000/api/activities/task-id/thread \
  -b cookies.txt
```

---

## Data Flow Diagram

```
User Action (React)
    ↓
API Request → /api/activities
    ↓
Feature Flag Check (unified-activities-read/write)
    ↓ (if enabled)
ActivityService Method
    ↓
Database Query (Drizzle ORM)
    ↓
PostgreSQL (activities table)
    ↓
Response + Socket.IO Emit
    ↓
Real-time Update to Subscribed Clients
```

---

## Performance Considerations

### Indexing
All queries use proper indexes:
- `type` - Fast filtering by activity type
- `contextType, contextId` - Fast context lookups
- `parentId`, `rootId` - Fast thread queries
- `createdBy` - Fast user activity queries
- `lastActivityAt` - Fast "recent activity" sorting

### Query Efficiency
- Thread queries use `rootId` for single-query fetches (no recursive joins)
- Participant checks use composite index `(activityId, userId)`
- Unread counts use indexed `lastReadAt` comparisons

### Expected Performance
| Operation | Rows | Time | Index Used |
|-----------|------|------|------------|
| Get activities (filtered) | 50 | <10ms | Multiple |
| Get thread | 1 root + 20 replies | <15ms | `rootId` |
| Create activity | 1 | <20ms | None (insert) |
| Get unread count | 100 activities | <30ms | `userId` + `lastReadAt` |

---

## Security & Permissions

### Authentication
All endpoints require `isAuthenticated` middleware

### Feature Flags
- Read operations check `unified-activities-read`
- Write operations check `unified-activities-write`
- Falls back gracefully if disabled (403 response)

### Future Permissions (Phase 3)
Will add granular permission checks:
- `ACTIVITIES_VIEW_ALL` vs `ACTIVITIES_VIEW_OWN`
- `ACTIVITIES_CREATE_TASK` vs `ACTIVITIES_CREATE_MESSAGE`
- `ACTIVITIES_EDIT_OWN` vs `ACTIVITIES_EDIT_ALL`

---

## Error Handling

All routes return consistent error format:
```json
{
  "error": "Error type",
  "message": "Detailed message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad request (missing fields)
- `403` - Forbidden (feature flag disabled or permissions)
- `404` - Not found
- `500` - Server error

---

## Files Created/Modified

### Created:
- `/server/services/activities/index.ts` - ActivityService (638 lines)
- `/server/routes/activities.ts` - API routes (492 lines)
- `/PHASE_2_BACKEND_SERVICES_README.md` - This file

### Modified:
- `/server/routes/index.ts` - Registered activities routes
- `/server/socket-chat.ts` - Added activity Socket.IO events
- `/shared/schema.ts` - Fixed lastActivityAt omission bug

---

## Known Limitations (To Address in Phase 3)

❌ **No notifications yet** - Creating activities doesn't send emails
❌ **No permission checks** - Only feature flags, no granular permissions
❌ **No Socket.IO emit from routes** - Need to pass `io` instance to routes
❌ **No mention parsing** - `@username` not auto-detected yet
❌ **No attachment upload** - Only URL storage, not file upload handling
❌ **No audit logging** - Activity changes not logged in auditLogs table

These will be addressed in future phases.

---

## Next Steps

**Phase 3: Write Operations + Notifications** (3-4 hours)
- Add notification triggers (email when assigned, replied, mentioned)
- Add permission checks (granular ACTIVITIES_* permissions)
- Integrate with existing NotificationService
- Add @mention parsing and auto-participant-add
- Add audit logging for all activity changes
- Pass Socket.IO instance to routes for real-time emits

---

## Questions or Issues?

**API returns 403?**
- Check feature flags enabled for your user
- Verify you're authenticated (valid session cookie)

**Thread not updating?**
- Check `parentId` and `rootId` set correctly
- Verify `updateThreadMetrics()` being called

**Socket.IO not working?**
- Confirm client connected: `socket.connected === true`
- Check subscribed to correct room: `activity:${activityId}`
- Verify server emitting to correct room

**Performance slow?**
- Check indexes exist: `\d activities` in psql
- Monitor query times in logs
- Ensure `rootId` being used for thread queries

---

## Summary

**Phase 2 adds a complete backend API for the unified activities system:**

✅ **ActivityService** - All CRUD + threading + participants + reactions + attachments
✅ **API Routes** - 15 endpoints with feature flag protection
✅ **Socket.IO** - Real-time subscriptions and events
✅ **Route Registration** - Integrated into main router
✅ **Error Handling** - Consistent error responses
✅ **Performance** - Optimized queries with proper indexes

**Status:** Backend ready, API inactive by default (feature flags disabled)

**Next:** Phase 3 will add notifications, permissions, and real-time emits!
